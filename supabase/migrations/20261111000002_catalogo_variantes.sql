-- =====================================================================
-- Fase 2 — Catálogo: precio de referencia, clave de importación y variantes
-- Ejecutar DESPUÉS de 20261110000001_esquema_inicial.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Productos: precio DETAL de referencia, clave estable y estado de variantes
-- ---------------------------------------------------------------------
alter table public.products
  -- Precio DETAL del catálogo del proveedor. Solo referencia interna:
  -- nunca se muestra al cliente ni se usa como costo.
  add column reference_price_cop integer check (reference_price_cop is null or reference_price_cop > 0),
  -- Identificador estable del origen (ej. "pdf-0039"). Permite repetir la
  -- importación sin duplicar, aunque haya referencias repetidas.
  add column import_key text unique,
  add column has_variants boolean not null default false,
  add column variants_verified boolean not null default false,
  add column description_needs_review boolean not null default false;

comment on column public.products.price_cop is
  'Precio FINAL de venta (lo que ve y paga el cliente). Null = sin aprobar, no se puede comprar.';
comment on column public.products.reference_price_cop is
  'Precio DETAL del proveedor. Referencia interna; no es costo ni precio de venta.';

-- Un producto con variantes solo se publica cuando están verificadas
alter table public.products
  add constraint products_variants_verified_to_publish
  check (not (is_active and has_variants and not variants_verified));

-- El precio DETAL es interno: la API pública no puede leerlo.
-- (RLS filtra filas; los permisos de columna filtran columnas.)
revoke select on public.products from anon;
grant select (
  id, sku, name, slug, description, category_id, price_cop, availability,
  is_active, is_featured, is_new, has_variants, created_at, updated_at
) on public.products to anon;

-- ---------------------------------------------------------------------
-- 2. Variantes (tonos, colores, presentaciones)
-- ---------------------------------------------------------------------
create table public.product_variants (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 80),
  -- Null = usa el precio del producto
  price_cop    integer check (price_cop is null or price_cop > 0),
  availability public.product_availability not null default 'consultar',
  is_active    boolean not null default true,
  image_path   text,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (product_id, name)
);

create index product_variants_product_idx on public.product_variants (product_id, sort_order);

create trigger product_variants_updated_at
  before update on public.product_variants
  for each row execute function public.set_updated_at();

alter table public.product_variants enable row level security;

create policy "variantes lectura" on public.product_variants
  for select to anon, authenticated using (
    (is_active and exists (
      select 1 from public.products p where p.id = product_id and p.is_active))
    or public.is_admin()
  );
create policy "variantes admin" on public.product_variants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 3. Imágenes: marca de baja resolución y unicidad para importación repetible
-- ---------------------------------------------------------------------
alter table public.product_images
  add column is_low_res boolean not null default false,
  add constraint product_images_unique_path unique (product_id, storage_path);

-- ---------------------------------------------------------------------
-- 4. Pedidos: variante elegida
-- ---------------------------------------------------------------------
alter table public.order_items
  add column variant_id   uuid references public.product_variants (id) on delete set null,
  add column variant_name text;

-- create_order con variantes. Reemplaza la versión de la fase 1.
-- Cada línea: {"product_id": uuid, "variant_id": uuid | null, "quantity": n}
create or replace function public.create_order(
  p_customer jsonb,
  p_items    jsonb,
  p_ip_hash  text default null
)
returns table (
  out_order_id     uuid,
  out_order_number integer,
  out_public_token text,
  out_subtotal_cop integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uuid_re      constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_token        text := encode(extensions.gen_random_bytes(24), 'hex');
  v_name         text := btrim(coalesce(p_customer ->> 'name', ''));
  v_whatsapp     text := regexp_replace(coalesce(p_customer ->> 'whatsapp', ''), '[^0-9]', '', 'g');
  v_email        text := nullif(btrim(coalesce(p_customer ->> 'email', '')), '');
  v_city         text := btrim(coalesce(p_customer ->> 'city', ''));
  v_address      text := nullif(btrim(coalesce(p_customer ->> 'address', '')), '');
  v_notes        text := nullif(btrim(coalesce(p_customer ->> 'notes', '')), '');
  v_expected     integer;
  v_inserted     integer;
  v_recent       integer;
  v_subtotal     bigint;
  v_order_id     uuid;
  v_order_number integer;
begin
  if not exists (select 1 from public.store_settings where id = 1 and whatsapp_number is not null) then
    raise exception 'TIENDA_NO_CONFIGURADA';
  end if;

  if char_length(v_name) not between 3 and 120 then raise exception 'NOMBRE_INVALIDO'; end if;
  if char_length(v_whatsapp) not between 10 and 15 then raise exception 'WHATSAPP_INVALIDO'; end if;
  if char_length(v_city) not between 2 and 80 then raise exception 'CIUDAD_INVALIDA'; end if;
  if v_email is not null and (char_length(v_email) > 160 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'EMAIL_INVALIDO';
  end if;
  if char_length(coalesce(v_address, '')) > 300 then raise exception 'DIRECCION_INVALIDA'; end if;
  if char_length(coalesce(v_notes, '')) > 1000 then raise exception 'NOTAS_INVALIDAS'; end if;

  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 60 then
    raise exception 'CARRITO_INVALIDO';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) e
    where case
            when coalesce(e ->> 'quantity', '') !~ '^[0-9]{1,3}$' then true
            when coalesce(e ->> 'product_id', '') !~* v_uuid_re then true
            when (e ->> 'variant_id') is not null and (e ->> 'variant_id') !~* v_uuid_re then true
            else (e ->> 'quantity')::integer not between 1 and 99
          end
  ) then
    raise exception 'CANTIDAD_INVALIDA';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) e
    group by (e ->> 'product_id')::uuid, (e ->> 'variant_id')
    having sum((e ->> 'quantity')::integer) > 99
  ) then
    raise exception 'CANTIDAD_INVALIDA';
  end if;

  select count(*) into v_expected from (
    select distinct (e ->> 'product_id')::uuid, (e ->> 'variant_id')
    from jsonb_array_elements(p_items) e
  ) d;

  if p_ip_hash is not null then
    select count(*) into v_recent from public.orders
    where client_ip_hash = p_ip_hash and created_at > now() - interval '1 hour';
    if v_recent >= 5 then raise exception 'DEMASIADOS_PEDIDOS'; end if;
  end if;

  select count(*) into v_recent from public.orders
  where customer_whatsapp = v_whatsapp and created_at > now() - interval '1 hour';
  if v_recent >= 5 then raise exception 'DEMASIADOS_PEDIDOS'; end if;

  insert into public.orders (
    public_token_hash, customer_name, customer_whatsapp, customer_email,
    customer_city, customer_address, customer_notes, client_ip_hash
  ) values (
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    v_name, v_whatsapp, v_email, v_city, v_address, v_notes, p_ip_hash
  )
  returning id, order_number into v_order_id, v_order_number;

  -- Reglas por línea:
  --   producto activo, sin revisión pendiente y no agotado;
  --   si tiene variantes: variante obligatoria, del mismo producto, activa y no agotada;
  --   si no tiene variantes: no se acepta variant_id;
  --   precio = precio de la variante si existe, si no el del producto (nunca el DETAL).
  insert into public.order_items (
    order_id, product_id, variant_id, product_sku, product_name, variant_name,
    unit_price_cop, unit_cost_cop, quantity, line_total_cop
  )
  select
    v_order_id, p.id, v.id, p.sku, p.name, v.name,
    coalesce(v.price_cop, p.price_cop),
    c.cost_cop,
    r.quantity,
    coalesce(v.price_cop, p.price_cop) * r.quantity
  from (
    select (e ->> 'product_id')::uuid as product_id,
           (e ->> 'variant_id')::uuid as variant_id,
           sum((e ->> 'quantity')::integer) as quantity
    from jsonb_array_elements(p_items) e
    group by 1, 2
  ) r
  join public.products p
    on p.id = r.product_id
   and p.is_active
   and not p.needs_review
   and p.availability <> 'agotado'
  left join public.product_variants v
    on v.id = r.variant_id
   and v.product_id = p.id
   and v.is_active
   and v.availability <> 'agotado'
  left join public.product_costs c on c.product_id = p.id
  where (
          (p.has_variants and p.variants_verified and r.variant_id is not null and v.id is not null)
       or (not p.has_variants and r.variant_id is null)
        )
    and coalesce(v.price_cop, p.price_cop) is not null;

  get diagnostics v_inserted = row_count;

  if v_inserted <> v_expected then
    raise exception 'PRODUCTO_NO_DISPONIBLE';
  end if;

  select sum(line_total_cop) into v_subtotal
  from public.order_items where order_id = v_order_id;

  update public.orders set subtotal_cop = v_subtotal where id = v_order_id;

  return query select v_order_id, v_order_number, v_token, v_subtotal::integer;
end;
$$;

revoke execute on function public.create_order(jsonb, jsonb, text) from public, anon, authenticated;
grant  execute on function public.create_order(jsonb, jsonb, text) to service_role;

-- Estado por token: ahora incluye la variante elegida
create or replace function public.get_order_by_token(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'order_number',  o.order_number,
    'status',        o.status,
    'created_at',    o.created_at,
    'subtotal_cop',  o.subtotal_cop,
    'shipping_cop',  o.shipping_cop,
    'total_cop',     o.total_cop,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', i.product_name,
               'variant', i.variant_name,
               'sku', i.product_sku,
               'quantity', i.quantity,
               'unit_price_cop', i.unit_price_cop,
               'line_total_cop', i.line_total_cop)
             order by i.product_name, i.variant_name)
      from public.order_items i where i.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  where p_token ~ '^[0-9a-f]{48}$'
    and o.public_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

revoke execute on function public.get_order_by_token(text) from public, anon, authenticated;
grant  execute on function public.get_order_by_token(text) to service_role;

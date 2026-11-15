-- =====================================================================
-- Tienda de belleza — Esquema inicial (Fase 1)
-- Ejecutar completo en Supabase: SQL Editor → New query → pegar → Run.
-- Es seguro para un proyecto NUEVO. No lo ejecutes dos veces sobre la
-- misma base (los "create type" fallarían).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tipos
-- ---------------------------------------------------------------------
create type public.order_status as enum (
  'pendiente', 'confirmado', 'preparando', 'enviado', 'entregado', 'cancelado'
);

create type public.payment_status as enum ('sin_pago', 'parcial', 'pagado');

-- disponible: se puede pedir.
-- consultar:  se puede pedir, pero se muestra "Consultar disponibilidad".
-- agotado:    visible, pero no se puede añadir al carrito.
create type public.product_availability as enum ('disponible', 'consultar', 'agotado');

-- ---------------------------------------------------------------------
-- 2. Administradores y función de autorización
-- ---------------------------------------------------------------------
create table public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

-- Utilidad: mantener updated_at al día
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Configuración de la tienda (una sola fila, id = 1)
-- ---------------------------------------------------------------------
create table public.store_settings (
  id               smallint primary key default 1 check (id = 1),
  store_name       text not null default 'Tienda Belleza',
  tagline          text,
  logo_path        text,
  -- Obligatorio antes de recibir pedidos. Solo dígitos, con indicativo (ej. 573001234567).
  whatsapp_number  text check (whatsapp_number is null or whatsapp_number ~ '^[0-9]{10,15}$'),
  instagram_url    text,
  facebook_url     text,
  tiktok_url       text,
  contact_email    text,
  city             text,
  business_hours   text,
  delivery_info    text,
  payment_info     text,
  currency         text not null default 'COP' check (currency = 'COP'),
  updated_at       timestamptz not null default now()
);

insert into public.store_settings (id) values (1);

create trigger store_settings_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. Categorías
-- ---------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text not null,
  description text,
  image_path  text,
  sort_order  smallint not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Nombres y descripciones tomados del Excel del catálogo (hoja "Índice").
insert into public.categories (slug, name, description, sort_order) values
  ('rostro',                    'Rostro',                    'Bases, correctores, polvos, rubores, tónicos y cuidado facial.', 1),
  ('ojos',                      'Ojos',                      'Pestañinas, sombras, delineadores, cejas y todo para la mirada.', 2),
  ('labios',                    'Labios',                    'Labiales, gloss y tintes para labios en distintos acabados y tonos.', 3),
  ('cabello',                   'Cabello',                   'Shampoos, acondicionadores, tratamientos y productos de cuidado capilar.', 4),
  ('cuerpo',                    'Cuerpo',                    'Cremas, mantequillas corporales, bronceadores y cuidado para la piel.', 5),
  ('perfumeria',                'Perfumería',                'Perfumes y fragancias para el cabello y el cuerpo.', 6),
  ('maquillaje-y-sets',         'Maquillaje y Sets',         'Fijadores de maquillaje, kits y sets completos.', 7),
  ('herramientas-y-accesorios', 'Herramientas y Accesorios', 'Brochas, esponjas, paletas y accesorios para aplicar tu maquillaje.', 8);

-- ---------------------------------------------------------------------
-- 5. Productos
-- ---------------------------------------------------------------------
create table public.products (
  id             uuid primary key default gen_random_uuid(),
  -- La referencia NO es única: en el Excel hay referencias repetidas
  -- en productos distintos (ver docs/analisis-catalogo.md).
  sku            text,
  name           text not null check (char_length(name) between 2 and 200),
  slug           text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description    text,
  category_id    uuid not null references public.categories (id),
  -- Precio de VENTA al público, en pesos enteros. Null = sin precio (no se puede comprar).
  price_cop      integer check (price_cop is null or price_cop > 0),
  availability   public.product_availability not null default 'consultar',
  is_active      boolean not null default false,
  is_featured    boolean not null default false,
  is_new         boolean not null default false,
  needs_review   boolean not null default true,
  review_notes   text,
  -- Trazabilidad con el Excel de origen
  source_section text,
  source_row     integer,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index products_category_idx on public.products (category_id) where is_active;
create index products_sku_idx      on public.products (sku);
create index products_name_idx     on public.products (lower(name));

create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- Costo del proveedor: tabla SEPARADA y solo para administradores.
-- Así ninguna consulta pública sobre "products" puede exponer costos.
create table public.product_costs (
  product_id uuid primary key references public.products (id) on delete cascade,
  cost_cop   integer not null check (cost_cop > 0),
  updated_at timestamptz not null default now()
);

create trigger product_costs_updated_at
  before update on public.product_costs
  for each row execute function public.set_updated_at();

create table public.product_images (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products (id) on delete cascade,
  storage_path   text not null,
  alt            text,
  sort_order     smallint not null default 0,
  created_at     timestamptz not null default now()
);

create index product_images_product_idx on public.product_images (product_id, sort_order);

-- Vista de ganancia bruta estimada (solo administradores; ver permisos abajo)
create view public.admin_product_margins
with (security_invoker = true)
as
select
  p.id            as product_id,
  p.name,
  p.sku,
  p.price_cop,
  c.cost_cop,
  case when p.price_cop is not null and c.cost_cop is not null
       then p.price_cop - c.cost_cop end as gross_profit_cop,
  case when p.price_cop is not null and c.cost_cop is not null
       then round(((p.price_cop - c.cost_cop)::numeric / p.price_cop) * 100, 1) end as margin_pct
from public.products p
left join public.product_costs c on c.product_id = p.id;

-- ---------------------------------------------------------------------
-- 6. Pedidos
-- ---------------------------------------------------------------------
create sequence public.order_number_seq start with 1001;

create table public.orders (
  id                 uuid primary key default gen_random_uuid(),
  order_number       integer not null unique default nextval('public.order_number_seq'),
  -- Solo se guarda el hash del token del enlace de seguimiento.
  public_token_hash  text not null unique,
  status             public.order_status not null default 'pendiente',
  payment_status     public.payment_status not null default 'sin_pago',
  customer_name      text not null,
  customer_whatsapp  text not null,
  customer_email     text,
  customer_city      text not null,
  customer_address   text,
  customer_notes     text,
  subtotal_cop       integer not null default 0 check (subtotal_cop >= 0),
  -- Null = envío por definir (la encargada lo confirma por WhatsApp).
  shipping_cop       integer check (shipping_cop is null or shipping_cop >= 0),
  total_cop          integer not null default 0 check (total_cop >= 0),
  admin_notes        text,
  -- Null = la encargada aún no abrió el pedido ("nuevo" en el dashboard).
  seen_at            timestamptz,
  client_ip_hash     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter sequence public.order_number_seq owned by public.orders.order_number;

create index orders_status_idx   on public.orders (status, created_at desc);
create index orders_whatsapp_idx on public.orders (customer_whatsapp);
create index orders_ip_idx       on public.orders (client_ip_hash, created_at);

create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- Total = subtotal + envío (si ya está definido). Se recalcula siempre en la base.
create or replace function public.orders_compute_total()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.total_cop := new.subtotal_cop + coalesce(new.shipping_cop, 0);
  return new;
end;
$$;

create trigger orders_compute_total
  before insert or update of subtotal_cop, shipping_cop on public.orders
  for each row execute function public.orders_compute_total();

create table public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders (id) on delete cascade,
  product_id     uuid references public.products (id) on delete set null,
  -- Copia fija del momento de la compra
  product_sku    text,
  product_name   text not null,
  unit_price_cop integer not null check (unit_price_cop > 0),
  unit_cost_cop  integer check (unit_cost_cop is null or unit_cost_cop > 0),
  quantity       integer not null check (quantity between 1 and 99),
  line_total_cop integer not null check (line_total_cop > 0)
);

create index order_items_order_idx on public.order_items (order_id);

create table public.order_status_history (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status   public.order_status not null,
  changed_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

create or replace function public.log_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger orders_log_status
  after insert or update of status on public.orders
  for each row execute function public.log_order_status();

-- Pagos registrados manualmente por la encargada
create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  amount_cop  integer not null check (amount_cop > 0),
  method      text not null check (method in
                ('nequi', 'daviplata', 'bancolombia', 'efecty', 'efectivo', 'contra_entrega', 'otro')),
  reference   text,
  notes       text,
  paid_at     timestamptz not null default now(),
  recorded_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create index payments_order_idx on public.payments (order_id);

-- Estado de pago derivado de los pagos registrados
create or replace function public.refresh_payment_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid := coalesce(new.order_id, old.order_id);
  v_paid     bigint;
  v_total    integer;
begin
  select coalesce(sum(amount_cop), 0) into v_paid
  from public.payments where order_id = v_order_id;

  select total_cop into v_total from public.orders where id = v_order_id;

  update public.orders
     set payment_status = case
           when v_paid = 0 then 'sin_pago'::public.payment_status
           when v_paid >= v_total then 'pagado'::public.payment_status
           else 'parcial'::public.payment_status
         end
   where id = v_order_id;

  return null;
end;
$$;

create trigger payments_refresh_status
  after insert or update or delete on public.payments
  for each row execute function public.refresh_payment_status();

-- ---------------------------------------------------------------------
-- 7. Crear pedido (única vía de escritura pública)
--    - Solo la puede ejecutar el servidor (service_role).
--    - El navegador solo envía IDs y cantidades; los precios salen de la base.
--    - Todo ocurre en una transacción: si un producto falla, no se guarda nada.
-- ---------------------------------------------------------------------
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
  -- Tienda configurada
  if not exists (select 1 from public.store_settings where id = 1 and whatsapp_number is not null) then
    raise exception 'TIENDA_NO_CONFIGURADA';
  end if;

  -- Datos del cliente
  if char_length(v_name) not between 3 and 120 then raise exception 'NOMBRE_INVALIDO'; end if;
  if char_length(v_whatsapp) not between 10 and 15 then raise exception 'WHATSAPP_INVALIDO'; end if;
  if char_length(v_city) not between 2 and 80 then raise exception 'CIUDAD_INVALIDA'; end if;
  if v_email is not null and (char_length(v_email) > 160 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'EMAIL_INVALIDO';
  end if;
  if char_length(coalesce(v_address, '')) > 300 then raise exception 'DIRECCION_INVALIDA'; end if;
  if char_length(coalesce(v_notes, '')) > 1000 then raise exception 'NOTAS_INVALIDAS'; end if;

  -- Carrito
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 60 then
    raise exception 'CARRITO_INVALIDO';
  end if;

  -- (CASE garantiza que solo se convierte a número lo que ya pasó la validación)
  if exists (
    select 1 from jsonb_array_elements(p_items) e
    where case
            when coalesce(e ->> 'quantity', '') !~ '^[0-9]{1,3}$' then true
            when coalesce(e ->> 'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then true
            else (e ->> 'quantity')::integer not between 1 and 99
          end
  ) then
    raise exception 'CANTIDAD_INVALIDA';
  end if;

  -- La misma referencia repetida no puede sumar más de 99 unidades
  if exists (
    select 1 from jsonb_array_elements(p_items) e
    group by (e ->> 'product_id')::uuid
    having sum((e ->> 'quantity')::integer) > 99
  ) then
    raise exception 'CANTIDAD_INVALIDA';
  end if;

  select count(distinct (e ->> 'product_id')::uuid) into v_expected
  from jsonb_array_elements(p_items) e;

  -- Protección básica contra abuso: máx. 5 pedidos por hora por IP / por número
  if p_ip_hash is not null then
    select count(*) into v_recent from public.orders
    where client_ip_hash = p_ip_hash and created_at > now() - interval '1 hour';
    if v_recent >= 5 then raise exception 'DEMASIADOS_PEDIDOS'; end if;
  end if;

  select count(*) into v_recent from public.orders
  where customer_whatsapp = v_whatsapp and created_at > now() - interval '1 hour';
  if v_recent >= 5 then raise exception 'DEMASIADOS_PEDIDOS'; end if;

  -- Pedido
  insert into public.orders (
    public_token_hash, customer_name, customer_whatsapp, customer_email,
    customer_city, customer_address, customer_notes, client_ip_hash
  ) values (
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    v_name, v_whatsapp, v_email, v_city, v_address, v_notes, p_ip_hash
  )
  returning id, order_number into v_order_id, v_order_number;

  -- Líneas: precio y costo leídos de la base, solo productos comprables
  insert into public.order_items (
    order_id, product_id, product_sku, product_name,
    unit_price_cop, unit_cost_cop, quantity, line_total_cop
  )
  select
    v_order_id, p.id, p.sku, p.name,
    p.price_cop, c.cost_cop, r.quantity, p.price_cop * r.quantity
  from (
    select (e ->> 'product_id')::uuid as product_id,
           sum((e ->> 'quantity')::integer) as quantity
    from jsonb_array_elements(p_items) e
    group by 1
  ) r
  join public.products p
    on p.id = r.product_id
   and p.is_active
   and not p.needs_review
   and p.price_cop is not null
   and p.availability <> 'agotado'
  left join public.product_costs c on c.product_id = p.id;

  get diagnostics v_inserted = row_count;

  if v_inserted <> v_expected then
    -- Revierte todo, incluido el pedido creado arriba
    raise exception 'PRODUCTO_NO_DISPONIBLE';
  end if;

  select sum(line_total_cop) into v_subtotal
  from public.order_items where order_id = v_order_id;

  update public.orders set subtotal_cop = v_subtotal where id = v_order_id;

  return query select v_order_id, v_order_number, v_token, v_subtotal::integer;
end;
$$;

-- Estado del pedido por enlace seguro: sin datos personales.
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
               'sku', i.product_sku,
               'quantity', i.quantity,
               'unit_price_cop', i.unit_price_cop,
               'line_total_cop', i.line_total_cop)
             order by i.product_name)
      from public.order_items i where i.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  where p_token ~ '^[0-9a-f]{48}$'
    and o.public_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

-- ---------------------------------------------------------------------
-- 8. Seguridad: Row Level Security
-- ---------------------------------------------------------------------
alter table public.admin_users          enable row level security;
alter table public.store_settings       enable row level security;
alter table public.categories           enable row level security;
alter table public.products             enable row level security;
alter table public.product_costs        enable row level security;
alter table public.product_images       enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.order_status_history enable row level security;
alter table public.payments             enable row level security;

-- admin_users: cada admin ve solo su fila; nadie la modifica desde la API
create policy "admin ve su fila" on public.admin_users
  for select to authenticated using (user_id = auth.uid());

-- Configuración: lectura pública, edición solo admin
create policy "config lectura publica" on public.store_settings
  for select to anon, authenticated using (true);
create policy "config edicion admin" on public.store_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Categorías
create policy "categorias lectura" on public.categories
  for select to anon, authenticated using (is_active or public.is_admin());
create policy "categorias admin" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Productos: el público solo ve activos
create policy "productos lectura" on public.products
  for select to anon, authenticated using (is_active or public.is_admin());
create policy "productos admin" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Imágenes: visibles si el producto es visible
create policy "imagenes lectura" on public.product_images
  for select to anon, authenticated using (
    exists (select 1 from public.products p
            where p.id = product_id and (p.is_active or public.is_admin()))
  );
create policy "imagenes admin" on public.product_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Costos, pedidos, historial y pagos: SOLO administradores
create policy "costos admin" on public.product_costs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "pedidos admin lectura" on public.orders
  for select to authenticated using (public.is_admin());
create policy "pedidos admin edicion" on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "items admin" on public.order_items
  for select to authenticated using (public.is_admin());

create policy "historial admin" on public.order_status_history
  for select to authenticated using (public.is_admin());

create policy "pagos admin" on public.payments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Defensa adicional: el rol anónimo no tiene ningún permiso sobre datos privados
revoke all on public.product_costs, public.orders, public.order_items,
              public.order_status_history, public.payments, public.admin_users
  from anon;
revoke all on public.admin_product_margins from anon;

-- Las funciones de pedido solo las ejecuta el servidor
revoke execute on function public.create_order(jsonb, jsonb, text) from public, anon, authenticated;
revoke execute on function public.get_order_by_token(text)         from public, anon, authenticated;
grant  execute on function public.create_order(jsonb, jsonb, text) to service_role;
grant  execute on function public.get_order_by_token(text)         to service_role;

-- ---------------------------------------------------------------------
-- 9. Almacenamiento de imágenes (bucket público de solo lectura)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imagenes', 'imagenes', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "imagenes ver admin" on storage.objects
  for select to authenticated using (bucket_id = 'imagenes' and public.is_admin());
create policy "imagenes subir admin" on storage.objects
  for insert to authenticated with check (bucket_id = 'imagenes' and public.is_admin());
create policy "imagenes editar admin" on storage.objects
  for update to authenticated using (bucket_id = 'imagenes' and public.is_admin());
create policy "imagenes borrar admin" on storage.objects
  for delete to authenticated using (bucket_id = 'imagenes' and public.is_admin());

-- =====================================================================
-- Fase 4 — Pedidos: confirmación sin duplicados y gestión administrativa
-- Ejecutar DESPUÉS de 20261112000003_tienda_publica.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Clave de idempotencia: el mismo intento de compra nunca crea dos pedidos
-- ---------------------------------------------------------------------
alter table public.orders
  add column idempotency_key uuid unique;

-- ---------------------------------------------------------------------
-- 2. create_order v3
--    - El servidor de la tienda envía el token del enlace de seguimiento
--      (HMAC de la clave de idempotencia); la base solo guarda su hash.
--    - Si llega otra vez la misma clave (doble clic, reintento de red),
--      devuelve el pedido ya creado en lugar de crear otro.
--    - Precios, disponibilidad y variantes se verifican aquí, no en el navegador.
-- ---------------------------------------------------------------------
drop function if exists public.create_order(jsonb, jsonb, text);

create or replace function public.create_order(
  p_customer        jsonb,
  p_items           jsonb,
  p_token           text,
  p_idempotency_key uuid,
  p_ip_hash         text default null
)
returns table (
  out_order_id     uuid,
  out_order_number integer,
  out_subtotal_cop integer,
  out_existing     boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uuid_re      constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
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
  if p_idempotency_key is null then raise exception 'CLAVE_INVALIDA'; end if;
  if coalesce(p_token, '') !~ '^[0-9a-f]{64}$' then raise exception 'TOKEN_INVALIDO'; end if;

  -- Reintento del mismo intento de compra: devolver el pedido existente
  select o.id, o.order_number, o.subtotal_cop into v_order_id, v_order_number, v_subtotal
  from public.orders o where o.idempotency_key = p_idempotency_key;
  if found then
    return query select v_order_id, v_order_number, v_subtotal::integer, true;
    return;
  end if;

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

  begin
    insert into public.orders (
      public_token_hash, idempotency_key, customer_name, customer_whatsapp, customer_email,
      customer_city, customer_address, customer_notes, client_ip_hash
    ) values (
      encode(extensions.digest(p_token, 'sha256'), 'hex'), p_idempotency_key,
      v_name, v_whatsapp, v_email, v_city, v_address, v_notes, p_ip_hash
    )
    returning id, order_number into v_order_id, v_order_number;
  exception when unique_violation then
    -- Dos peticiones simultáneas con la misma clave: la segunda devuelve la primera
    select o.id, o.order_number, o.subtotal_cop into v_order_id, v_order_number, v_subtotal
    from public.orders o where o.idempotency_key = p_idempotency_key;
    if v_order_id is null then raise; end if;
    return query select v_order_id, v_order_number, v_subtotal::integer, true;
    return;
  end;

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

  select sum(line_total_cop) into v_subtotal from public.order_items where order_id = v_order_id;
  update public.orders set subtotal_cop = v_subtotal where id = v_order_id;

  return query select v_order_id, v_order_number, v_subtotal::integer, false;
end;
$$;

revoke execute on function public.create_order(jsonb, jsonb, text, uuid, text) from public, anon, authenticated;
grant  execute on function public.create_order(jsonb, jsonb, text, uuid, text) to service_role;

-- Enlace de seguimiento: ahora el token tiene 64 caracteres hexadecimales
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
  where p_token ~ '^[0-9a-f]{64}$'
    and o.public_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

revoke execute on function public.get_order_by_token(text) from public, anon, authenticated;
grant  execute on function public.get_order_by_token(text) to service_role;

-- ---------------------------------------------------------------------
-- 3. Panel: la encargada solo puede cambiar estado, envío, notas y "visto".
--    Los montos y los datos del cliente no se editan desde la API.
-- ---------------------------------------------------------------------
revoke update on public.orders from authenticated;
grant update (status, shipping_cop, admin_notes, seen_at) on public.orders to authenticated;

-- Si cambia el total (por el envío), se recalcula el estado de pago.
-- (El total lo calcula un trigger BEFORE, por eso se escucha shipping/subtotal.)
create or replace function public.refresh_payment_status_on_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paid bigint;
begin
  select coalesce(sum(amount_cop), 0) into v_paid from public.payments where order_id = new.id;
  update public.orders
     set payment_status = case
           when v_paid = 0 then 'sin_pago'::public.payment_status
           when v_paid >= new.total_cop then 'pagado'::public.payment_status
           else 'parcial'::public.payment_status
         end
   where id = new.id;
  return null;
end;
$$;

create trigger orders_refresh_payment_on_total
  after update of shipping_cop, subtotal_cop on public.orders
  for each row
  when (old.total_cop is distinct from new.total_cop)
  execute function public.refresh_payment_status_on_total();

-- Los pagos registrados no se editan: se borran y se registran de nuevo
drop policy "pagos admin" on public.payments;
create policy "pagos admin lectura" on public.payments
  for select to authenticated using (public.is_admin());
create policy "pagos admin registro" on public.payments
  for insert to authenticated with check (public.is_admin());
create policy "pagos admin borrado" on public.payments
  for delete to authenticated using (public.is_admin());

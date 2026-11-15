-- =====================================================================
-- Fase 5.3 — Cambio masivo de precios con registro y opción de deshacer
-- Ejecutar DESPUÉS de 20261113000004_pedidos.sql.
-- =====================================================================

-- Cada cambio masivo queda registrado (quién, cuándo, qué) y se puede deshacer
create table public.price_change_batches (
  id          uuid primary key default gen_random_uuid(),
  description text not null check (char_length(description) <= 300),
  item_count  integer not null check (item_count >= 0),
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  undone_at   timestamptz,
  undone_by   uuid references auth.users (id) on delete set null
);

create table public.price_changes (
  id         bigint generated always as identity primary key,
  batch_id   uuid not null references public.price_change_batches (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  old_price  integer check (old_price is null or old_price > 0),
  new_price  integer not null check (new_price > 0)
);

create index price_changes_batch_idx on public.price_changes (batch_id);

alter table public.price_change_batches enable row level security;
alter table public.price_changes        enable row level security;

create policy "lotes de precios admin" on public.price_change_batches
  for select to authenticated using (public.is_admin());
create policy "cambios de precios admin" on public.price_changes
  for select to authenticated using (public.is_admin());

revoke all on public.price_change_batches, public.price_changes from anon;

-- ---------------------------------------------------------------------
-- Aplicar: todo o nada. Cada línea trae el precio que la encargada vio en
-- la vista previa; si alguno cambió entretanto, no se aplica ninguno.
-- p_changes: [{ "product_id": uuid, "old_price": int|null, "new_price": int }]
-- ---------------------------------------------------------------------
create or replace function public.admin_apply_price_batch(p_description text, p_changes jsonb)
returns table (out_batch_id uuid, out_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch uuid;
  v_count integer;
  v_mismatch integer;
begin
  if not public.is_admin() then raise exception 'SOLO_ADMINISTRADORAS'; end if;
  if jsonb_typeof(p_changes) is distinct from 'array'
     or jsonb_array_length(p_changes) = 0
     or jsonb_array_length(p_changes) > 2000 then
    raise exception 'CAMBIOS_INVALIDOS';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_changes) e
    where coalesce(e ->> 'new_price', '') !~ '^[0-9]{1,9}$'
       or (e ->> 'new_price')::integer <= 0
       or coalesce(e ->> 'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or ((e ->> 'old_price') is not null and (e ->> 'old_price') !~ '^[0-9]{1,9}$')
  ) then
    raise exception 'CAMBIOS_INVALIDOS';
  end if;
  if (select count(distinct (e ->> 'product_id')::uuid) from jsonb_array_elements(p_changes) e) <> jsonb_array_length(p_changes) then
    raise exception 'CAMBIOS_INVALIDOS'; -- un producto repetido
  end if;

  -- Bloquea las filas y comprueba que nadie cambió esos precios desde la vista previa
  perform 1 from public.products p
  where p.id in (select (e ->> 'product_id')::uuid from jsonb_array_elements(p_changes) e)
  for update;

  select count(*) into v_mismatch
  from jsonb_array_elements(p_changes) e
  left join public.products p on p.id = (e ->> 'product_id')::uuid
  where p.id is null or p.price_cop is distinct from (e ->> 'old_price')::integer;
  if v_mismatch > 0 then raise exception 'PRECIOS_CAMBIARON'; end if;

  insert into public.price_change_batches (description, item_count)
  values (left(coalesce(p_description, 'Cambio masivo'), 300), jsonb_array_length(p_changes))
  returning id into v_batch;

  insert into public.price_changes (batch_id, product_id, old_price, new_price)
  select v_batch, (e ->> 'product_id')::uuid, (e ->> 'old_price')::integer, (e ->> 'new_price')::integer
  from jsonb_array_elements(p_changes) e;

  update public.products p
     set price_cop = c.new_price
    from public.price_changes c
   where c.batch_id = v_batch and p.id = c.product_id;
  get diagnostics v_count = row_count;

  return query select v_batch, v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- Deshacer: devuelve el precio anterior solo donde nadie lo cambió después.
-- Si el precio anterior era "sin precio" y el producto ya está publicado,
-- se deja como está (un producto publicado no puede quedar sin precio).
-- ---------------------------------------------------------------------
create or replace function public.admin_undo_price_batch(p_batch uuid)
returns table (out_reverted integer, out_skipped integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_reverted integer;
begin
  if not public.is_admin() then raise exception 'SOLO_ADMINISTRADORAS'; end if;
  if not exists (select 1 from public.price_change_batches where id = p_batch and undone_at is null) then
    raise exception 'LOTE_NO_DISPONIBLE';
  end if;

  select count(*) into v_total from public.price_changes where batch_id = p_batch;

  update public.products p
     set price_cop = c.old_price
    from public.price_changes c
   where c.batch_id = p_batch
     and p.id = c.product_id
     and p.price_cop = c.new_price
     and not (c.old_price is null and p.is_active);
  get diagnostics v_reverted = row_count;

  update public.price_change_batches set undone_at = now(), undone_by = auth.uid() where id = p_batch;
  return query select v_reverted, v_total - v_reverted;
end;
$$;

revoke execute on function public.admin_apply_price_batch(text, jsonb) from public, anon;
revoke execute on function public.admin_undo_price_batch(uuid)        from public, anon;
grant  execute on function public.admin_apply_price_batch(text, jsonb) to authenticated;
grant  execute on function public.admin_undo_price_batch(uuid)        to authenticated;

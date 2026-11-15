-- =====================================================================
-- Fase 3 — Tienda pública
-- Ejecutar DESPUÉS de 20261111000002_catalogo_variantes.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Búsqueda sin tildes: "pocion" encuentra "Poción"
-- ---------------------------------------------------------------------
create extension if not exists unaccent with schema extensions;

create or replace function public.f_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1);
$$;

alter table public.products
  add column search_text text generated always as (
    lower(public.f_unaccent(name || ' ' || coalesce(sku, '')))
  ) stored;

grant select (search_text, is_featured) on public.products to anon;

-- ---------------------------------------------------------------------
-- 2. Garantía en la base: un producto visible siempre está aprobado y con precio
--    (además de la regla de variantes verificadas de la fase 2)
-- ---------------------------------------------------------------------
alter table public.products
  add constraint products_publish_requires_price_and_review
  check (not is_active or (price_cop is not null and not needs_review));

-- ---------------------------------------------------------------------
-- 3. Fotos: no se muestran al público hasta autorizarlo en la configuración
-- ---------------------------------------------------------------------
alter table public.store_settings
  add column product_photos_enabled boolean not null default false,
  -- Identidad visual editable desde el panel
  add column brand_color   text check (brand_color is null or brand_color ~ '^#[0-9a-fA-F]{6}$'),
  add column hero_title    text check (hero_title is null or char_length(hero_title) <= 90),
  add column hero_subtitle text check (hero_subtitle is null or char_length(hero_subtitle) <= 220),
  add column hero_image_path text;

drop policy "imagenes lectura" on public.product_images;
create policy "imagenes lectura" on public.product_images
  for select to anon, authenticated using (
    public.is_admin()
    or (
      exists (select 1 from public.store_settings s where s.id = 1 and s.product_photos_enabled)
      and exists (select 1 from public.products p where p.id = product_id and p.is_active)
    )
  );

-- Las fotos de variantes (product_variants.image_path) se muestran solo si
-- store_settings.product_photos_enabled es true: lo controla la tienda pública.

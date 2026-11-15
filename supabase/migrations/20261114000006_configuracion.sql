-- =====================================================================
-- Fase 6.1 — Configuración desde el panel: política de privacidad editable
-- Ejecutar DESPUÉS de 20261114000005_precios_masivos.sql.
-- =====================================================================

alter table public.store_settings
  add column privacy_policy text check (privacy_policy is null or char_length(privacy_policy) <= 20000);

-- La configuración ya es de lectura pública (excepto nada sensible: no contiene
-- claves ni costos) y solo las administradoras pueden editarla (políticas de la fase 1).

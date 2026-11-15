-- =====================================================================
-- Dar permisos de administradora a una usuaria existente.
--
-- Pasos:
--   1. Supabase → Authentication → Users → "Add user" → "Create new user".
--      Escribe el correo y una contraseña segura. Marca "Auto Confirm User".
--   2. Cambia el correo de abajo y ejecuta este archivo en el SQL Editor.
--   3. Supabase → Authentication → Sign In / Providers → desactiva
--      "Allow new users to sign up" para que nadie pueda registrarse solo.
-- =====================================================================

insert into public.admin_users (user_id)
select id from auth.users where email = 'CAMBIA-ESTE-CORREO@ejemplo.com'
on conflict (user_id) do nothing;

-- Comprobación: debe devolver una fila con el correo.
select u.email, a.created_at
from public.admin_users a
join auth.users u on u.id = a.user_id;

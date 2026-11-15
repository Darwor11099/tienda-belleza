# Tienda de belleza — Next.js + Supabase

Tienda online con catálogo, carrito, pedidos sin cuenta, WhatsApp y panel de pedidos.

**Estado:** código de las fases 1 a 4 completo y probado con datos simulados.
Falta la verificación en un entorno real: ver `docs/VERIFICACIONES-PENDIENTES.md`.
**No publicar todavía.**

## Empezar
Sigue `docs/GUIA-WINDOWS.md` paso a paso (requisitos, Supabase, migraciones, `.env.local`,
verificación, pruebas de seguridad y cómo iniciar la tienda).

## Comandos
| Comando | Qué hace |
|---|---|
| `npm install` | Instala dependencias |
| `npm run dev` | Tienda en http://localhost:3000 (panel en `/admin`) |
| `npm run verificar` | Pruebas + TypeScript + build de producción |
| `npm run probar-seguridad -- --confirmo-proyecto-de-prueba` | Pruebas reales de permisos y RLS en Supabase |
| `npm run importar -- --archivo X.xlsx [--aplicar]` | Importa el catálogo desde el Excel de revisión |

## Documentación
- `docs/GUIA-WINDOWS.md` — instalación y pruebas en Windows.
- `docs/VERIFICACIONES-PENDIENTES.md` — lista exacta de lo que falta comprobar.
- `docs/FUNCIONALIDADES.md` — qué está terminado.
- `docs/importacion-catalogo.md`, `docs/tienda-publica.md`, `docs/analisis-catalogo.md`.
- `PROGRESO.md` — registro de avances por fase.

## Estructura
```
src/app/(tienda)/         Tienda: inicio, catálogo, producto, carrito, checkout, pedido/[token]
src/app/admin/            Panel: login y pedidos
src/app/api/              carrito/precios (verificación) y pedidos (registro)
src/components/           Interfaz (layout y tienda)
src/lib/                  Lógica: carrito, catálogo, pedidos, importación, Supabase
src/proxy.ts              Sesión del panel (Next 16)
supabase/migrations/      Esquema SQL (ejecutar en orden)
supabase/scripts/         Crear administradora
scripts/                  Importación y pruebas de seguridad
tests/                    Pruebas automáticas
```

## Reglas de seguridad
- El navegador nunca envía precios: el pedido se calcula en la base (`create_order`).
- El público no puede leer el precio DETAL, los costos, los pedidos ni productos sin aprobar (permisos por columna + RLS).
- La base impide publicar productos sin precio, sin aprobar o con variantes sin verificar.
- Las fotos no se muestran hasta activar `product_photos_enabled` (requiere permiso de uso).
- La clave secreta y `ORDER_TOKEN_SECRET` solo existen en el servidor.

# Tienda pública

## Páginas
| Ruta | Qué muestra |
|---|---|
| `/` | Portada, categorías, destacados (o recién publicados), novedades, cómo pedir |
| `/catalogo?q=&categoria=&orden=&pagina=` | Catálogo con búsqueda, filtro, orden y paginación |
| `/producto/[slug]` | Ficha con galería, tonos, cantidad, carrito y WhatsApp |
| `/carrito` | Carrito con subtotales y total |
| `POST /api/carrito/precios` | Confirma precios y disponibilidad actuales del carrito |

## Qué ve el público
- Solo productos activos. La base impide activar un producto sin precio de venta, sin aprobar
  o con variantes sin verificar (restricciones en `products`).
- Nunca el precio DETAL ni el costo: no tiene permiso sobre esas columnas/tablas.
  Por eso las consultas públicas listan columnas; `select=*` daría error de permisos.
- Fotos: solo cuando `store_settings.product_photos_enabled = true` (lo exige la regla RLS
  de `product_images`). Mientras tanto se muestra «Imagen próximamente».

## Identidad editable (tabla `store_settings`)
`store_name`, `tagline`, `logo_path`, `brand_color` (hex; si no tiene contraste con texto
blanco se usa el color por defecto), `hero_title`, `hero_subtitle`, `hero_image_path`,
WhatsApp, redes, horario, envíos y pagos. Las imágenes de categoría salen de `categories.image_path`.

## Carrito
Se guarda en el navegador (`localStorage`), por eso se conserva al navegar y recargar.
Sus precios son informativos: al abrir el carrito se confirman con el servidor, y el pedido
(fase 4) se recalculará en la base con `create_order`.

# Funcionalidades terminadas (código)

«Terminado» significa: escrito, con pruebas automáticas y probado en el entorno de Claude con
datos simulados. **Falta la verificación real** (ver `VERIFICACIONES-PENDIENTES.md`).

## Fase 1 — Base
- Esquema de base de datos con RLS en todas las tablas, configuración de la tienda, categorías.
- Sistema visual: paleta crema/rosa/dorado, Bodoni Moda + Jost, godets de categoría.

## Fase 2 — Catálogo e importación
- Excel de revisión de 740 productos (resumen, productos con miniaturas, variantes, instrucciones).
- 740 fotos optimizadas (no se publican sin permiso).
- Precio DETAL de referencia, costo real y precio final de venta separados.
- Variantes con precio, disponibilidad y foto propios.
- Script de importación repetible con simulación (`npm run importar`).

## Fase 3 — Tienda pública
- Inicio con portada editable, categorías, destacados y novedades.
- Catálogo con búsqueda sin tildes, filtros, orden y paginación.
- Ficha con galería, selector de tono, cantidad, carrito y consulta por WhatsApp.
- Carrito persistente con verificación de precios en el servidor.
- Identidad editable: nombre, logo, color, portada.

## Fase 4 — Pedidos
- Checkout sin cuenta: nombre, WhatsApp, correo opcional, ciudad, dirección, observaciones y autorización de datos.
- Validación en el navegador, en el servidor (Zod) y en la base (create_order).
- Precios y disponibilidad recalculados en la base; el navegador solo envía IDs y cantidades.
- Sin pedidos duplicados: botón bloqueado + clave de idempotencia + control en la base para peticiones simultáneas.
- Número de pedido, página de confirmación y enlace de seguimiento sin datos personales.
- Resumen por WhatsApp con productos, tonos y total (el pedido ya está guardado antes de abrirlo).
- Protección básica: campo trampa contra robots y máximo 5 pedidos por hora por número o conexión.

## Panel de pedidos
- Acceso con correo y contraseña solo para administradoras (servidor + base).
- Pestañas: nuevos, pendientes, confirmados, preparando, enviados, completados, cancelados.
- Detalle: cliente, WhatsApp directo, productos con tono, total, saldo, historial.
- Cambiar estado, fijar costo de envío (recalcula total y estado de pago), notas internas.
- Registrar y eliminar pagos manuales (Nequi, Daviplata, Bancolombia, Efecty, efectivo, contra entrega, otro).
- La base solo permite al panel modificar estado, envío, notas y «visto»: montos y datos del cliente no se editan.

## Panel de productos (fase 5.1)
- Listado con búsqueda, filtros y contadores; ficha de edición completa.
- Precio de venta, costo real privado y ganancia bruta en vivo.
- Publicar u ocultar con explicación de lo que falta; crear y eliminar productos.
- Tonos o presentaciones con precio, disponibilidad y foto propios (5.2).
- Fotos: subir (optimizadas), principal, orden y quitar; ocultas al público hasta autorizarlas (5.2).
- Cambio masivo de precios con vista previa, confirmación, historial y deshacer (5.3).

## Configuración (fase 6.1)
- Nombre, logo, color, portada, contacto, envíos, pagos, redes, política de privacidad e interruptor de fotos, sin tocar código ni SQL.

## Herramientas
- `npm run verificar`: pruebas + TypeScript + build.
- `npm run probar-seguridad`: pruebas reales de permisos y RLS contra Supabase.

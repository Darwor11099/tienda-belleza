# Verificaciones pendientes antes de publicar

Marca cada punto cuando lo compruebes en tu computadora y en el proyecto de PRUEBA.
Nada de esto se ha podido ejecutar en el entorno de Claude (sin internet: no se pudo
instalar Next.js ni conectar a Supabase).

## A. Instalación y compilación
- [x] `npm install` (Node 24.18, npm 11.16): 256 paquetes.
- [x] Actualización 4.1 (Next 16, zod 4): `npm audit` solo mostró uuid dentro de exceljs.
- [x] `npm test` 37/37, `npm run typecheck` sin errores (tras corrección 4.1a), `npm run build` correcto.
- [x] Actualización 4.2 (sin exceljs): `npm audit` 0 vulnerabilidades y `npm test` 39/39.
- [ ] Corrección 4.4: `npm run verificar` (40 pruebas + TypeScript + build).
- [ ] `npm test`: 37 pruebas, `# fail 0`.
- [ ] `npm run typecheck`: sin errores (es la primera vez que se comprueba el tipado completo con React y Next).
- [ ] `next build` termina con «Compiled successfully».

## B. Base de datos
- [x] Las 4 migraciones se ejecutan en orden sin errores.
- [x] `crear-admin.sql` muestra la fila de la administradora.
- [x] Registro público desactivado en Authentication.

## C. Seguridad (con datos reales)
- [x] `npm run probar-seguridad -- --confirmo-proyecto-de-prueba`: 37/37 correctas. Cubre:
  precio DETAL y costos ilegibles para el público; productos ocultos sin aprobar o sin precio;
  fotos ocultas hasta autorizarlas; escrituras y funciones prohibidas; registro público cerrado;
  reglas de publicación; precios calculados en la base; tonos agotados rechazados; un solo
  pedido con doble clic simultáneo; enlace de seguimiento sin datos personales.

## D. Funcionamiento con Supabase real
- [x] Simulación e importación del Excel de prueba (`Errores: 0`).
- [x] Catálogo: búsqueda, filtro por categoría (relación entre tablas). (Paginación: requiere más de 24 productos publicados.)
- [x] Ficha con tonos, carrito, checkout, confirmación y WhatsApp.
- [x] Doble clic en «Confirmar pedido» crea un solo pedido (revisar en el panel).
- [x] Panel: login, pestañas, estado, envío (recalcula total y estado de pago), pagos, historial.
- [ ] Panel: una cuenta sin permiso es rechazada (opcional; el registro público está cerrado).
- [ ] Enlace de seguimiento refleja el estado actualizado.

## E. Dispositivos
- [ ] Celular Android y iPhone reales (tienda y panel).
- [x] Las fuentes Bodoni Moda y Jost se ven.
- [ ] Cambiar la Secret key del proyecto de prueba (estuvo abierta con una extensión de IA activa).

## F. Pendientes de negocio (antes de publicar)
- [ ] Aprobación del Excel: precios finales, variantes, descripciones.
- [ ] Permiso escrito para usar las fotos (luego `FOTOS_AUTORIZADAS=si` y activar `product_photos_enabled`).
- [ ] Número de WhatsApp, ciudad, horario, envíos y medios de pago de la propietaria.
- [ ] Texto de autorización de datos y política de privacidad revisados (Ley 1581 de 2012).
- [ ] Nombre comercial, logo y dominio.
- [ ] Proyecto de Supabase de producción (repetir pasos 4 a 8) y despliegue en Vercel.

## Limitaciones conocidas de esta versión
- No hay reservas automáticas de inventario: la disponibilidad es manual.
- No se envían correos ni notificaciones automáticas; el contacto es por WhatsApp.
- El límite de pedidos por conexión usa la IP que informa el servidor (en Vercel funciona; en local todas las pruebas comparten IP).

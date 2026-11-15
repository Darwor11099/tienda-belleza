# Registro de avances

## Fase 1 — Estructura, base de datos y diseño (10 nov 2026)

Hecho:
- Revisión del Excel: 740 productos, 739 con precio numérico, sin descripciones,
  sin costos y sin fotos de producto (ver `docs/analisis-catalogo.md`).
- Esquema SQL: categorías (8, con textos del Excel), productos, costos separados,
  imágenes, pedidos, líneas, historial de estados, pagos manuales, configuración.
- Seguridad: RLS en todas las tablas, función `create_order` que recalcula precios,
  enlace de seguimiento con token (solo se guarda su hash), límite de pedidos por hora.
- Sistema visual: paleta con contrastes verificados, Bodoni Moda + Jost,
  godets de categoría.
- Inicio de prueba que lee configuración y categorías desde Supabase.
- Utilidades con pruebas: formato COP, totales, ganancia bruta, enlaces wa.me.

Verificado en el entorno de Claude:
- `npm test`: 6/6 pruebas pasan.
- Sintaxis de todos los archivos .ts/.tsx.

Pendiente de verificar en el equipo de la usuaria (no se pudo ejecutar sin red):
- `npm run dev` y `npm run build`.
- Ejecución del SQL en Supabase.

Decisiones abiertas:
- ¿«Precio Detal» del Excel es el precio de venta de la tienda o solo referencia?
- ¿Costos del proveedor: lista aparte o % de descuento sobre el precio detal?
- Número de WhatsApp comercial, ciudad, horario y condiciones de envío propias.
- Productos de la lista de revisión (duplicados, nombres cortados, sin precio).

## Fase 2 — Preparación de la importación (11 nov 2026)

Hecho:
- PDF leído (746 páginas, 740 productos) y emparejado al 100% con el Excel; precios DETAL coinciden.
- Excel de revisión con resumen, productos (miniaturas), variantes e instrucciones.
- 740 fotos WebP optimizadas (10 MB); 2 marcadas como baja resolución.
- Descripciones corregidas: 727 correctas, 11 a revisar, 2 vacías.
- Variantes: 6 productos con opciones nombradas en el catálogo (sin verificar); 162 «Posible».
- Migración 0002: precio DETAL de referencia (oculto al público), import_key, variantes,
  pedidos con variante, imágenes con marca de baja resolución.
- Script de importación con simulación por defecto, `--aplicar`, `--solo-nuevos`, `--subir-fotos`.

Verificado en el entorno de Claude:
- 14/14 pruebas automáticas (incluye reglas de publicación, variantes, slugs y referencias repetidas).
- Plan de importación sobre el Excel real: 740 productos, 0 errores, 0 publicados, 740 slugs únicos.
- Tipado estricto de la lógica de importación.

Pendiente de verificar en el equipo de la usuaria:
- Migración 0002 en Supabase y el script contra la base real (lectura con exceljs).

Decisiones abiertas:
- Aprobación del Excel de revisión (precios de venta, variantes, descripciones).
- Permiso de uso de las fotos.
- Herramienta de cambio masivo de precios: se construye en la fase del panel.

## Fase 3 — Tienda pública y carrito (12 nov 2026)

Hecho:
- Inicio: portada editable (título, texto, foto o paleta), categorías, destacados, novedades, cómo pedir.
- Catálogo desde Supabase: búsqueda por nombre y referencia sin tildes, filtro por categoría,
  orden por precio y nombre, paginación de 24, estados vacíos y de carga.
- Ficha: galería, referencia, precio, selector de tono (con agotados), cantidad, añadir, consulta por WhatsApp, relacionados.
- Carrito en el navegador: añadir, quitar, +/-, subtotales, total, vaciar; se conserva al navegar y recargar;
  al abrirlo confirma precios y disponibilidad con el servidor.
- Migración 0003: búsqueda sin tildes (search_text), regla en la base que impide publicar sin precio
  o sin aprobar, fotos ocultas al público hasta activar product_photos_enabled, color de marca y portada editables.

Verificado en el entorno de Claude (sin internet, sin Next.js instalable):
- 27/27 pruebas unitarias; tipado estricto de toda la lógica sin dependencias.
- Páginas renderizadas con los componentes reales y datos de prueba (740 productos del Excel,
  precios de venta simulados = DETAL solo para la prueba), CSS generado con Tailwind 4.
- 34/34 comprobaciones en navegador: sin desbordamiento horizontal en 9 páginas a 390 px y 1280 px,
  botones táctiles ≥ 36 px, recorrido completo del carrito (totales, tonos, persistencia, precio actualizado).

Pendiente de verificar en el equipo de la usuaria:
- `npm run verificar` (pruebas + TypeScript completo + `next build`).
- Consultas reales a Supabase: filtros sobre la relación de categoría y permisos por columna.

## Fase 4 — Checkout, pedidos y panel (13 nov 2026)

Hecho:
- Proyecto autónomo (package.json, tsconfig, PostCSS): `npm install` y listo.
- Checkout sin cuenta, confirmación con número, enlace de seguimiento y resumen por WhatsApp.
- Migración 0004: idempotencia en create_order (doble clic y peticiones simultáneas), token
  derivado en el servidor, el panel solo puede editar estado/envío/notas/visto, recálculo del
  estado de pago al cambiar el envío, pagos sin edición (registrar o borrar).
- Panel: login, pestañas por estado, detalle, estado, envío, notas, pagos, WhatsApp al cliente.
- Script `probar-seguridad` con pruebas reales de permisos de columna y RLS.
- Guía para Windows y lista de verificaciones pendientes.

Verificado en el entorno de Claude (datos simulados):
- 34/34 pruebas unitarias.
- 34/34 comprobaciones de navegador de la tienda y el carrito; 15/15 del checkout
  (doble clic = 1 petición, misma clave en reintentos, solo IDs y cantidades, redirección,
  carrito vaciado, funciona sin crypto.randomUUID en el celular por red local).

NO verificado (requiere tu equipo): `npm install`, TypeScript completo, `next build`,
migraciones en Supabase y `probar-seguridad`. Ver docs/VERIFICACIONES-PENDIENTES.md.

## Ajuste 4.1 — Seguridad de dependencias (verificación en Windows)

Resultado de `npm audit` en el equipo de la usuaria y decisiones:
- postcss (alta) dentro de Next 15: se actualiza a **Next 16.4.6**. Cambios: `src/middleware.ts`
  pasa a `src/proxy.ts` (función `proxy`) y se quita la opción `eslint` de next.config.ts.
- zod (alta, memoria con listas enormes): se actualiza a **zod 4.6.7** (esquemas migrados) y
  además las rutas /api/pedidos y /api/carrito/precios cortan cuerpos de más de 20 KB / 12 KB
  antes de validar.
- uuid (moderada) dentro de exceljs: se acepta. exceljs solo se usa en tu computadora para
  importar tu propio Excel; no forma parte de la tienda publicada.
- npm 11 bloquea el script de instalación de esbuild (lo usa tsx para las pruebas); solo se
  aprobará si las pruebas lo necesitan.

Verificado en el entorno de Claude: 37/37 pruebas con zod v4, 34/34 + 15/15 comprobaciones de navegador.

## Ajuste 4.2 — Lector de Excel propio (verificación en Windows)

- En el equipo de la usuaria, la simulación de importación falló con
  «Cannot read properties of undefined (reading 'anchors')», un fallo de la librería
  exceljs al leer libros con imágenes/dibujos.
- Se reemplaza exceljs por `src/lib/xlsx-reader.ts` (sin dependencias): lee solo los
  valores de las celdas e ignora imágenes. Se elimina exceljs del proyecto, y con ello
  el aviso de seguridad de uuid y los avisos de paquetes obsoletos.
- Verificado en el entorno de Claude: 8.880 celdas idénticas a las leídas con openpyxl;
  la simulación real del script con revision_prueba.xlsx da 10 publicados, 0 errores y
  los 3 avisos esperados; también lee el Excel original con 740 miniaturas; 39/39 pruebas.

## Verificación en Windows — avance

- [x] Proyecto de prueba en Supabase (tienda-pruebas, región París; producción irá en São Paulo).
- [x] Registro público desactivado. Migraciones 1 a 4 sin errores. Administradora creada.
- [x] WhatsApp de prueba configurado. Importación real: 740 productos (10 visibles), 2 costos, 26 variantes.
- Corrección 4.3: el script de seguridad enviaba filas con columnas distintas en inserciones
  múltiples (supabase-js las completa con NULL y fallarían columnas NOT NULL); ahora todas
  las filas llevan las mismas columnas. La limpieza se ejecuta al inicio y al final, incluso
  si algo falla a mitad.

- [x] Pruebas de seguridad reales: 37/37 (permisos de columna, RLS, reglas de publicación, precios en la base, sin duplicados).
- [x] Tienda en el navegador con Next 16 y datos reales: inicio, categorías, búsqueda sin tildes, ficha con tonos.
- [x] Pedido 1011 (doble clic → un solo pedido) y pedido 1012 con tono Russet Orange.
- [x] Panel: login, pestañas, detalle, estado, envío (total recalculado), pago parcial, historial, etiqueta de tono.
- Corrección 4.4 (hallazgos de la verificación):
  - WhatsApp de la clienta: ya no se aceptan 10 dígitos que no empiecen por 3 (quedaban sin
    indicativo y el enlace de WhatsApp apuntaba a otro país). Se aceptan celulares colombianos
    o números internacionales completos.
  - Nombres de producto en las tarjetas con la fuente de texto (Jost), más legible.
  - tsconfig.json con los ajustes que Next 16 aplica automáticamente.
- [x] Corrección 4.4 verificada: `npm run verificar` 40/40 + TypeScript + build; WhatsApp ambiguo rechazado.
- Corrección 4.5: en escritorio, las tarjetas con nombres cortos se encogían (fotos de distinto
  tamaño en la misma fila). Ahora cada tarjeta ocupa todo el ancho de su columna.

## Fase 5.1 — Productos en el panel

- Listado con búsqueda sin tildes, categoría, filtros con contadores (publicados, ocultos, por revisar,
  sin precio, variantes por resolver, agotados) y paginación de 50.
- Ficha de edición: nombre, referencia, categoría, descripción, disponibilidad, destacado, nuevo.
- Precio de venta, costo real (privado) y ganancia bruta calculada mientras se escribe; DETAL como referencia.
- Publicar / ocultar con las razones visibles cuando no se puede publicar (mismas reglas que la base).
- Si un cambio deja un producto publicado sin cumplir las reglas, se oculta y se avisa (en lugar de fallar).
- Crear producto (nace oculto) y eliminar con confirmación (los pedidos conservan su copia).
- Verificado en el entorno de Claude: 46/46 pruebas; páginas renderizadas sin desbordes en móvil y escritorio.

- [x] Fase 5.1 verificada en Windows con Supabase de prueba (contadores, ganancia en vivo, bloqueos, crear/publicar/eliminar).

## Fase 5.2 — Variantes y fotos

- Lista de tonos o presentaciones en la ficha: añadir, editar nombre, precio propio, disponibilidad,
  activar/desactivar, foto del tono y eliminar. Si un producto publicado se queda sin tonos válidos, se oculta y avisa.
- Fotos: subida desde el navegador directamente a Supabase Storage (solo administradoras), optimizadas
  en el navegador a WebP de máx. 1600 px, aviso de baja resolución, elegir principal, reordenar y quitar
  (también borra el archivo). Siguen ocultas al público hasta activar product_photos_enabled.
- Tienda: al elegir un tono con foto propia se muestra su miniatura y se usa en el carrito.
- Ajustes: porcentaje en formato español («31,6 %») y plural correcto en el listado.
- Verificado en el entorno de Claude: 49/49 pruebas; editor renderizado sin desbordes en móvil y escritorio.

- [x] Fase 5.2 verificada en Windows (tonos en la tienda al instante, fotos subidas, ocultas sin permiso).

## Fase 5.3 — Cambio masivo de precios

- Página «Cambiar precios en bloque»: alcance por grupo (publicados, sin precio…), categoría y búsqueda;
  cálculo sobre el precio de venta o el DETAL; porcentaje o monto fijo (subir o bajar);
  redondeo a centena, millar o terminación en 900.
- Vista previa con precio actual, nuevo y ganancia; aviso de productos que quedarían bajo el costo.
- Aplicar exige confirmación y es todo o nada (migración 0005): si algún precio cambió desde la
  vista previa, no se aplica ninguno. Cada cambio queda en un historial con opción de deshacer.
- Seguridad: el público no puede ejecutar el cambio masivo ni leer su historial (probar-seguridad: 40 comprobaciones).
- Verificado en el entorno de Claude: 54/54 pruebas; página renderizada sin desbordes.

- [x] Fase 5.3 verificada en Windows (vista previa, aplicar +10 %, deshacer).

## Fase 6.1 — Configuración desde el panel

- Página Configuración: nombre, frase corta, color de marca (con aviso si no se lee en botones),
  textos de portada, logo y foto de portada (subida optimizada, reemplazo y quitar),
  WhatsApp (validado), correo, ciudad, horario, envíos, pagos, redes (solo https) y
  política de privacidad; interruptor de fotos con advertencia de permiso.
- Página pública /privacidad, enlace en el pie y en el formulario de pedido.
- Migración 0006: columna privacy_policy. Plantilla en docs/plantilla-politica-privacidad.md.
- Cabecera del panel adaptada al móvil (los enlaces bajan a una segunda línea).
- Verificado en el entorno de Claude: 58/58 pruebas; todas las páginas del panel sin desbordes.

## Próxima fase

6.2 contenido real · 6.3 Supabase de producción · 6.4 GitHub + Vercel · 6.5 dominio · 6.6 prueba final. Después: gestión de productos en el panel (precios,
cambio masivo con vista previa, variantes, fotos) y lanzamiento.

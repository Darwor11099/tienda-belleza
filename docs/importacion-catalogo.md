# Importación del catálogo

## Archivos

- `revision_catalogo.xlsx`: 740 productos para revisar y aprobar (hojas Resumen, Productos, Variantes, Instrucciones).
- `fotos_catalogo/`: 740 fotos WebP (máx. 1000 px), una por producto, nombradas con el ID de importación (`pdf-0039.webp`).
- `scripts/importar-catalogo.ts`: lee el Excel aprobado (con un lector propio, `src/lib/xlsx-reader.ts`, que ignora las miniaturas) y lo carga en Supabase.
- `supabase/migrations/20261111000002_catalogo_variantes.sql`: precio de referencia, variantes y pedidos con variante.

## Precios

| Campo | Columna en la base | Quién lo ve |
|---|---|---|
| Precio DETAL del proveedor | `products.reference_price_cop` | Solo el panel |
| Costo real de compra | `product_costs.cost_cop` | Solo el panel |
| Precio final de venta | `products.price_cop` | Clientes |

La ganancia bruta se calcula solo con el costo real. El precio DETAL nunca se usa como costo
ni se copia automáticamente al precio de venta. La API pública no puede leer `reference_price_cop`
(permisos por columna), por lo que las consultas públicas a `products` deben listar columnas
explícitas, nunca `select=*`.

## Cuándo se publica un producto

Solo si: «Aprobado para publicar» = Sí, tiene precio final de venta y sus variantes están
resueltas (`No`, o `Sí` + verificadas + al menos una activa). Todo lo demás se importa oculto
con `needs_review = true` y el motivo en `review_notes`.

## Pasos

```bash
# 1. Ejecutar la migración 20261111000002 en el SQL Editor de Supabase.
# 2. Simulación (no escribe nada):
npm run importar -- --archivo revision_catalogo.xlsx
# 3. Importar de verdad, después de aprobar el Excel:
npm run importar -- --archivo revision_catalogo.xlsx --aplicar
# 4. Fotos, solo cuando el permiso esté confirmado (FOTOS_AUTORIZADAS=si en .env.local):
npm run importar -- --archivo revision_catalogo.xlsx --aplicar --subir-fotos --fotos ./fotos_catalogo
```

La importación es repetible: usa el ID de importación (página del PDF), así que no duplica
productos aunque haya referencias repetidas. **Ojo:** al repetirla se sobrescriben los campos
con lo que diga el Excel. Una vez que la encargada edite productos desde el panel, usa
`--solo-nuevos` para no pisar sus cambios.

## Cómo se prepararon los datos

- 740 páginas de producto del PDF leídas con OCR y emparejadas con las 740 filas del Excel.
  Los precios DETAL del PDF coinciden con el Excel.
- Nombres: los del Excel con tildes restauradas; 36 nombres cortados se completaron leyendo el título en el PDF.
- Descripciones: OCR corregido automáticamente (mayúsculas, tildes y eñes con diccionario y reglas,
  signos ¡ ¿, errores típicos de lectura). Las dudosas quedan marcadas y las ilegibles vacías.
- Fotos: recortadas del recuadro del producto, sin logo ni datos del proveedor y sin los sellos de «AGOTADO».
- Variantes: solo se precargaron las que el texto del catálogo nombra explícitamente (6 productos),
  y todas quedan sin verificar. 162 productos con señales de tonos quedan como «Posible».

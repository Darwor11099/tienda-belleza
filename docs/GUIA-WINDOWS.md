# Guía para ejecutar la tienda en Windows

Esta guía usa un **proyecto de Supabase de PRUEBA**. No uses el proyecto definitivo
hasta terminar todas las verificaciones.

---

## 1. Requisitos previos

| Programa | Para qué | Cómo comprobarlo |
|---|---|---|
| Windows 10 u 11 | | |
| **Node.js 22 LTS** (o superior) | Ejecutar la tienda | `node -v` debe mostrar `v22…` o mayor |
| Visual Studio Code (recomendado) | Editar archivos y abrir una terminal | |
| Una cuenta en supabase.com | Base de datos | |

Instalar Node.js: entra en nodejs.org, descarga el instalador **LTS** para Windows (.msi),
ejecútalo con las opciones por defecto (deja marcado «Add to PATH»). Cierra y vuelve a abrir
la terminal después de instalarlo.

---

## 2. Descomprimir el proyecto

1. Descomprime el ZIP en una carpeta **fuera de OneDrive**, por ejemplo `C:\proyectos\tienda-belleza`.
   (OneDrive intenta sincronizar miles de archivos de `node_modules` y causa errores.)
2. Abre esa carpeta en VS Code (**Archivo → Abrir carpeta**) y abre una terminal con **Terminal → Nueva terminal**.
   Todos los comandos de esta guía se escriben en esa terminal, dentro de la carpeta del proyecto.

> Si PowerShell muestra «la ejecución de scripts está deshabilitada en este sistema» al usar `npm`,
> ejecuta una sola vez:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
> ```
> y responde `S`. Otra opción es escribir `npm.cmd` en lugar de `npm`.

---

## 3. Instalar dependencias

```powershell
npm install
```

Tarda unos minutos la primera vez. Al final no debe aparecer ninguna línea que empiece por
`npm ERR!` (los avisos `npm warn` se pueden ignorar).

---

## 4. Crear el proyecto de prueba en Supabase

1. En supabase.com → **New project**. Nombre: `tienda-pruebas`. Región: **South America (São Paulo)**.
   Guarda la contraseña de la base de datos en un lugar seguro.
2. Cuando termine de crearse, ve a **Project Settings → API Keys** y deja la página abierta:
   necesitarás la **URL del proyecto**, la **Publishable key** y la **Secret key**.
3. **Desactiva el registro público**: **Authentication → Sign In / Providers** → apaga
   «Allow new users to sign up». (Solo la administradora tendrá cuenta y la crearás tú.)

---

## 5. Ejecutar las migraciones (en orden)

En Supabase → **SQL Editor → New query**. Para cada archivo, en este orden:

1. `supabase/migrations/20261110000001_esquema_inicial.sql`
2. `supabase/migrations/20261111000002_catalogo_variantes.sql`
3. `supabase/migrations/20261112000003_tienda_publica.sql`
4. `supabase/migrations/20261113000004_pedidos.sql`
5. `supabase/migrations/20261114000005_precios_masivos.sql`
6. `supabase/migrations/20261114000006_configuracion.sql`

haz lo siguiente: ábrelo en VS Code, selecciona todo (`Ctrl+A`), cópialo (`Ctrl+C`), pégalo
en el SQL Editor y pulsa **Run**. Debe responder **«Success. No rows returned»**.

Si alguno da error, **detente**, no ejecutes los siguientes y envíame el mensaje completo.
Cada archivo se ejecuta **una sola vez**.

---

## 6. Variables de entorno (`.env.local`)

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

Completa:

- `NEXT_PUBLIC_SUPABASE_URL`: la URL del proyecto (`https://xxxx.supabase.co`).
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: la Publishable key (`sb_publishable_…`).
- `SUPABASE_SECRET_KEY`: la Secret key (`sb_secret_…`).
- `ORDER_TOKEN_SECRET`: genera un valor aleatorio con este comando y pega el resultado:
  ```powershell
  [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
  ```

Guarda el archivo. `.env.local` nunca se sube a GitHub ni se comparte.

---

## 7. Crear la cuenta de la administradora

1. Supabase → **Authentication → Users → Add user → Create new user**.
   Escribe un correo y una contraseña segura, marca **Auto Confirm User** y crea.
2. Abre `supabase/scripts/crear-admin.sql`, cambia `CAMBIA-ESTE-CORREO@ejemplo.com` por ese correo,
   pégalo en el SQL Editor y pulsa **Run**. La consulta final debe mostrar una fila con el correo.

---

## 8. Configurar el WhatsApp de prueba

(Desde la fase 6.1 también puedes hacerlo en **Panel → Configuración**.)

Sin número la tienda no acepta pedidos. En el SQL Editor (usa tu propio número para probar,
con 57 delante y sin espacios):

```sql
update public.store_settings set whatsapp_number = '573001234567' where id = 1;
```

---

## 9. Cargar productos de prueba

El catálogo definitivo no se importa todavía. Para probar, usa una **copia** del Excel:

1. Copia `revision_catalogo.xlsx` como `revision_prueba.xlsx` dentro de la carpeta del proyecto.
2. En la copia, elige unos 10 productos (incluye uno con variantes, por ejemplo `pdf-0525`):
   escribe un **Precio final de venta**, pon **Aprobado para publicar = Sí** y, en el que tiene
   variantes, **Variantes verificadas = Sí**.
3. Simula y luego importa **en el proyecto de prueba**:
   ```powershell
   npm run importar -- --archivo revision_prueba.xlsx
   npm run importar -- --archivo revision_prueba.xlsx --aplicar
   ```
   La simulación debe decir `Errores: 0`. Las fotos **no** se suben (no hay permiso todavía).

---

## 10. Verificación automática

```powershell
npm run verificar
```

Hace tres cosas, en orden; si una falla, se detiene:

1. **Pruebas** (`npm test`): al final debe decir `# fail 0`.
2. **TypeScript** (`tsc --noEmit`): no debe mostrar nada (sin errores).
3. **Build de producción** (`next build`): debe terminar con «Compiled successfully» y la lista de rutas.

---

## 11. Pruebas reales de seguridad contra Supabase

```powershell
npm run probar-seguridad -- --confirmo-proyecto-de-prueba
```

Se conecta con la **clave pública** (como cualquier visitante) e intenta leer costos, precio
DETAL, pedidos, productos ocultos y fotos; intenta cambiar precios y crear pedidos con productos
no permitidos. Crea datos de prueba marcados `prueba-seg` y los borra al terminar.
Debe terminar con **«N/N pruebas de seguridad correctas»**. El detalle queda en `seguridad-reporte.json`.

---

## 12. Iniciar la tienda localmente

```powershell
npm run dev
```

Abre http://localhost:3000. Para detenerla: `Ctrl+C` en la terminal.

### Recorrido manual sugerido
1. Inicio → buscar «pocion» y una referencia → filtrar por categoría → ordenar por precio.
2. Abrir un producto con tonos → intentar añadir sin tono (debe pedirlo) → elegir tono → añadir.
3. Carrito → cambiar cantidades → **Continuar con el pedido**.
4. Completar el formulario → **Confirmar pedido** (pulsa dos veces: debe crearse uno solo).
5. En la confirmación, **Enviar resumen por WhatsApp** (se abre WhatsApp; el envío lo confirmas tú).
6. Panel: http://localhost:3000/admin → entrar con la administradora → abrir el pedido →
   cambiar estado, poner costo de envío, registrar un pago → volver al enlace del pedido y
   comprobar que el estado cambió.

### Probar desde el celular (misma red Wi-Fi)
```powershell
npm run dev -- -H 0.0.0.0
ipconfig
```
Busca la «Dirección IPv4» (por ejemplo `192.168.1.20`) y abre `http://192.168.1.20:3000` en el
celular. Si Windows pregunta por el firewall, permite el acceso en **redes privadas**.

---

## Problemas frecuentes

| Mensaje | Solución |
|---|---|
| `'node' no se reconoce como un comando` | Reinstala Node.js y abre una terminal nueva. |
| La tienda dice «Falta conectar Supabase» | Revisa `.env.local` y reinicia `npm run dev`. |
| `permission denied for table products` en la tienda | Una consulta pide columnas privadas: avísame con la ruta. |
| «La tienda todavía no está recibiendo pedidos» | Falta el número de WhatsApp (paso 8). |
| No aparecen productos | No hay productos aprobados con precio (paso 9). |
| `Falta ORDER_TOKEN_SECRET` | Completa el paso 6. |
| El build falla | Copia el error completo y envíamelo. |

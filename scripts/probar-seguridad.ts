/**
 * Pruebas REALES de seguridad contra tu proyecto de Supabase de PRUEBA.
 *
 *   npm run probar-seguridad -- --confirmo-proyecto-de-prueba
 *
 * Usa dos clientes:
 *   - "público": la clave publishable, exactamente lo que tiene cualquier visitante.
 *   - "servidor": la clave secreta, solo para preparar datos y simular el servidor de la tienda.
 * Crea productos y pedidos de prueba marcados con "prueba-seg" y los borra al terminar.
 * No lo ejecutes en el proyecto de producción con clientes reales.
 */
import { randomUUID, createHmac } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvLocal();

if (!process.argv.includes("--confirmo-proyecto-de-prueba")) {
  console.error("Este script crea y borra datos de prueba. Ejecútalo solo en un proyecto de PRUEBA:\n  npm run probar-seguridad -- --confirmo-proyecto-de-prueba");
  process.exit(1);
}
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;
if (!URL_ || !PUB || !SECRET) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY o SUPABASE_SECRET_KEY en .env.local");
  process.exit(1);
}
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const anon: SupabaseClient = createClient(URL_, PUB, opts);
const srv: SupabaseClient = createClient(URL_, SECRET, opts);

const results: { ok: boolean; name: string; detail?: string }[] = [];
function check(name: string, ok: boolean, detail?: string) {
  results.push({ ok, name, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? `  — ${detail}` : ""}`);
}
const errText = (e: { message?: string; code?: string } | null) => (e ? `${e.code ?? ""} ${e.message ?? ""}`.trim() : "sin error");
const token = () => createHmac("sha256", "prueba").update(randomUUID()).digest("hex");
const phone = () => `5730${Math.floor(10000000 + Math.random() * 89999999)}`;
const createdOrderKeys: string[] = [];

async function order(items: { product_id: string; variant_id: string | null; quantity: number; [k: string]: unknown }[], key = randomUUID(), tok = token()) {
  createdOrderKeys.push(key);
  return srv.rpc("create_order", {
    p_customer: { name: "Prueba Seguridad", whatsapp: phone(), city: "Prueba", email: null, address: null, notes: "prueba-seg" },
    p_items: items,
    p_token: tok,
    p_idempotency_key: key,
    p_ip_hash: null,
  });
}

/** Borra SOLO lo creado por este script: pedidos con nota "prueba-seg" y productos "prueba-seg-…". */
async function cleanup() {
  const o = await srv.from("orders").delete().eq("customer_notes", "prueba-seg").select("id");
  const p = await srv.from("products").delete().like("import_key", "prueba-seg-%").select("id");
  return { orders: o.data?.length ?? 0, products: p.data?.length ?? 0 };
}

let settingsBefore: { whatsapp_number: string | null; product_photos_enabled: boolean } | null = null;

async function main() {
  const left = await cleanup();
  if (left.orders || left.products) console.log(`Se limpiaron restos de una ejecución anterior: ${left.orders} pedidos, ${left.products} productos.`);
  console.log("\nPreparando datos de prueba…\n");
  const { data: cat, error: catErr } = await srv.from("categories").select("id").eq("slug", "rostro").single();
  if (catErr || !cat) throw new Error(`No hay categoría "rostro": ¿ejecutaste las migraciones? ${errText(catErr)}`);

  const { data: sb } = await srv.from("store_settings").select("whatsapp_number, product_photos_enabled").eq("id", 1).single();
  settingsBefore = sb;
  await srv.from("store_settings").update({ whatsapp_number: settingsBefore?.whatsapp_number ?? "573000000000", product_photos_enabled: false }).eq("id", 1);

  const base = { category_id: cat.id, availability: "disponible", source_section: "prueba-seg" };
  // Todas las filas con las mismas columnas: en inserciones múltiples, supabase-js pone NULL en las que falten
  const mk = (k: string, extra: Record<string, unknown>) => ({
    ...base, import_key: `prueba-seg-${k}`, slug: `prueba-seg-${k}`, name: `Prueba seguridad ${k}`, sku: "PS",
    reference_price_cop: null, has_variants: false, variants_verified: false, ...extra,
  });
  const { data: prods, error: pErr } = await srv
    .from("products")
    .upsert(
      [
        mk("a", { price_cop: 10000, reference_price_cop: 9000, is_active: true, needs_review: false }),
        mk("b", { price_cop: 20000, reference_price_cop: 18000, is_active: false, needs_review: true }),
        mk("c", { price_cop: null, reference_price_cop: 5000, is_active: false, needs_review: true }),
        mk("d", { price_cop: 30000, is_active: true, needs_review: false, has_variants: true, variants_verified: true }),
        mk("e", { price_cop: 15000, is_active: false, needs_review: true, has_variants: true, variants_verified: false }),
      ],
      { onConflict: "import_key" },
    )
    .select("id, import_key");
  if (pErr || !prods) throw new Error(`No se pudieron crear productos de prueba: ${errText(pErr)}`);
  const id = (k: string) => prods.find((p) => p.import_key === `prueba-seg-${k}`)!.id as string;
  await srv.from("product_costs").upsert({ product_id: id("a"), cost_cop: 6000 }, { onConflict: "product_id" });
  const { data: vars, error: vErr } = await srv
    .from("product_variants")
    .upsert(
      [
        { product_id: id("d"), name: "Tono disponible", price_cop: 32000, availability: "disponible", is_active: true, sort_order: 0 },
        { product_id: id("d"), name: "Tono agotado", price_cop: null, availability: "agotado", is_active: true, sort_order: 1 },
        { product_id: id("b"), name: "Tono de oculto", price_cop: null, availability: "disponible", is_active: true, sort_order: 0 },
      ],
      { onConflict: "product_id,name" },
    )
    .select("id, name, product_id");
  if (vErr || !vars) throw new Error(`No se pudieron crear variantes de prueba: ${errText(vErr)}`);
  const vid = (n: string) => vars.find((v) => v.name === n)!.id as string;
  await srv.from("product_images").upsert({ product_id: id("a"), storage_path: "productos/prueba-seg-a.webp", alt: "prueba" }, { onConflict: "product_id,storage_path" });

  console.log("1. Lo que puede leer un visitante (clave pública)\n");
  {
    const r = await anon.from("products").select("reference_price_cop").eq("slug", "prueba-seg-a");
    check("No puede leer el precio DETAL (reference_price_cop)", !!r.error, errText(r.error));
    const all = await anon.from("products").select("*").eq("slug", "prueba-seg-a");
    check("select=* sobre productos también se rechaza (incluye columnas privadas)", !!all.error, errText(all.error));
    const nr = await anon.from("products").select("needs_review, review_notes, import_key").eq("slug", "prueba-seg-a");
    check("No puede leer notas internas de revisión", !!nr.error, errText(nr.error));
    const c = await anon.from("product_costs").select("cost_cop");
    check("No puede leer costos (product_costs)", !!c.error || (c.data ?? []).length === 0, c.error ? errText(c.error) : `${c.data?.length} filas`);
    const m = await anon.from("admin_product_margins").select("*");
    check("No puede leer la vista de márgenes", !!m.error || (m.data ?? []).length === 0, errText(m.error));
    const pub = await anon.from("products").select("id, price_cop").eq("slug", "prueba-seg-a");
    check("Sí ve el producto aprobado y su precio de venta", (pub.data ?? []).length === 1 && pub.data![0].price_cop === 10000, errText(pub.error));
    const hid = await anon.from("products").select("id").in("slug", ["prueba-seg-b", "prueba-seg-c", "prueba-seg-e"]);
    check("No ve productos sin aprobar ni sin precio", !hid.error && (hid.data ?? []).length === 0, `${hid.data?.length ?? "?"} visibles`);
    const hv = await anon.from("product_variants").select("id").eq("product_id", id("b"));
    check("No ve variantes de productos ocultos", (hv.data ?? []).length === 0, `${hv.data?.length ?? "?"} visibles`);
    const vv = await anon.from("product_variants").select("name, availability").eq("product_id", id("d"));
    check("Ve las variantes del producto publicado, con el agotado marcado", (vv.data ?? []).some((v) => v.availability === "agotado"), errText(vv.error));
  }

  console.log("\n2. Fotografías\n");
  {
    const off = await anon.from("product_images").select("storage_path").eq("product_id", id("a"));
    check("Con fotos deshabilitadas, el público no ve ninguna foto", (off.data ?? []).length === 0, `${off.data?.length ?? "?"} visibles`);
    await srv.from("store_settings").update({ product_photos_enabled: true }).eq("id", 1);
    const on = await anon.from("product_images").select("storage_path").eq("product_id", id("a"));
    check("Al autorizarlas, se ven (control de la regla)", (on.data ?? []).length === 1, `${on.data?.length ?? "?"} visibles`);
    await srv.from("store_settings").update({ product_photos_enabled: false }).eq("id", 1);
  }

  console.log("\n3. Escrituras y funciones prohibidas al público\n");
  {
    const up = await anon.from("products").update({ price_cop: 1 }).eq("slug", "prueba-seg-a").select("id");
    const after = await srv.from("products").select("price_cop").eq("id", id("a")).single();
    check("No puede cambiar precios", after.data?.price_cop === 10000, up.error ? errText(up.error) : `${up.data?.length ?? 0} filas`);
    const ins = await anon.from("orders").insert({ public_token_hash: "x", customer_name: "x", customer_whatsapp: "3000000000", customer_city: "x" });
    check("No puede insertar pedidos directamente", !!ins.error, errText(ins.error));
    const rpc = await anon.rpc("create_order", { p_customer: {}, p_items: [], p_token: token(), p_idempotency_key: randomUUID(), p_ip_hash: null });
    check("No puede ejecutar create_order (solo el servidor)", !!rpc.error, errText(rpc.error));
    const tok = await anon.rpc("get_order_by_token", { p_token: "0".repeat(64) });
    check("No puede ejecutar get_order_by_token", !!tok.error, errText(tok.error));
    for (const t of ["orders", "order_items", "payments", "order_status_history", "admin_users", "price_change_batches", "price_changes"]) {
      const r = await anon.from(t).select("*").limit(1);
      check(`No puede leer ${t}`, !!r.error || (r.data ?? []).length === 0, r.error ? errText(r.error) : `${r.data?.length} filas`);
    }
    const bulk = await anon.rpc("admin_apply_price_batch", { p_description: "x", p_changes: [{ product_id: id("a"), old_price: 10000, new_price: 1 }] });
    const stillPrice = await srv.from("products").select("price_cop").eq("id", id("a")).single();
    check("No puede ejecutar el cambio masivo de precios", !!bulk.error && stillPrice.data?.price_cop === 10000, errText(bulk.error));
    const sign = await anon.auth.signUp({ email: `prueba-seg-${Date.now()}@ejemplo.com`, password: randomUUID() });
    check("El registro público de cuentas está desactivado", !!sign.error, errText(sign.error));
    if (!sign.error && sign.data.user) await srv.auth.admin.deleteUser(sign.data.user.id);
  }

  console.log("\n4. Reglas de publicación en la base\n");
  {
    const c = await srv.from("products").update({ is_active: true, needs_review: false }).eq("id", id("c"));
    check("No se puede publicar un producto sin precio de venta", !!c.error, errText(c.error));
    const e = await srv.from("products").update({ is_active: true, needs_review: false }).eq("id", id("e"));
    check("No se puede publicar con variantes sin verificar", !!e.error, errText(e.error));
    const b = await srv.from("products").update({ is_active: true }).eq("id", id("b"));
    check("No se puede publicar un producto pendiente de revisión", !!b.error, errText(b.error));
  }

  console.log("\n5. Pedidos: el servidor controla precios y disponibilidad\n");
  {
    const r = await order([{ product_id: id("a"), variant_id: null, quantity: 2, unit_price_cop: 1, price_cop: 1 }]);
    check("El precio sale de la base, no de lo enviado (2 × $10.000)", r.data?.[0]?.out_subtotal_cop === 20000, errText(r.error));
    const items = await srv.from("order_items").select("unit_price_cop, unit_cost_cop").eq("order_id", r.data?.[0]?.out_order_id ?? "");
    check("La línea guarda precio y costo del momento", items.data?.[0]?.unit_price_cop === 10000 && items.data?.[0]?.unit_cost_cop === 6000);

    const key = randomUUID();
    const tok = token();
    const [x, y] = await Promise.all([
      order([{ product_id: id("a"), variant_id: null, quantity: 1 }], key, tok),
      order([{ product_id: id("a"), variant_id: null, quantity: 1 }], key, tok),
    ]);
    const n = await srv.from("orders").select("id", { count: "exact", head: true }).eq("idempotency_key", key);
    check(
      "Doble clic simultáneo: un solo pedido y el mismo número",
      n.count === 1 && x.data?.[0]?.out_order_number === y.data?.[0]?.out_order_number,
      `${n.count} pedidos; ${errText(x.error)} / ${errText(y.error)}`,
    );
    const again = await order([{ product_id: id("a"), variant_id: null, quantity: 1 }], key, tok);
    check("Reintento posterior con la misma clave devuelve el pedido existente", again.data?.[0]?.out_existing === true, errText(again.error));

    const expectErr = async (name: string, items: Parameters<typeof order>[0], code: string) => {
      const res = await order(items);
      check(name, !!res.error && res.error.message.includes(code), errText(res.error));
    };
    await expectErr("Producto sin aprobar no se puede comprar", [{ product_id: id("b"), variant_id: null, quantity: 1 }], "PRODUCTO_NO_DISPONIBLE");
    await expectErr("Producto sin precio no se puede comprar", [{ product_id: id("c"), variant_id: null, quantity: 1 }], "PRODUCTO_NO_DISPONIBLE");
    await expectErr("Producto con tonos exige elegir uno", [{ product_id: id("d"), variant_id: null, quantity: 1 }], "PRODUCTO_NO_DISPONIBLE");
    await expectErr("Tono agotado no se puede comprar", [{ product_id: id("d"), variant_id: vid("Tono agotado"), quantity: 1 }], "PRODUCTO_NO_DISPONIBLE");
    await expectErr("Tono de otro producto no se acepta", [{ product_id: id("a"), variant_id: vid("Tono disponible"), quantity: 1 }], "PRODUCTO_NO_DISPONIBLE");
    await expectErr("Más de 99 unidades se rechaza", [{ product_id: id("a"), variant_id: null, quantity: 100 }], "CANTIDAD_INVALIDA");
    await expectErr("Un producto malo anula todo el pedido", [
      { product_id: id("a"), variant_id: null, quantity: 1 },
      { product_id: id("b"), variant_id: null, quantity: 1 },
    ], "PRODUCTO_NO_DISPONIBLE");
    const v = await order([{ product_id: id("d"), variant_id: vid("Tono disponible"), quantity: 1 }]);
    check("El tono con precio propio cobra su precio ($32.000)", v.data?.[0]?.out_subtotal_cop === 32000, errText(v.error));

    const tk = token();
    await order([{ product_id: id("a"), variant_id: null, quantity: 1 }], randomUUID(), tk);
    const view = await srv.rpc("get_order_by_token", { p_token: tk });
    const keys = Object.keys(view.data ?? {});
    check(
      "El enlace de seguimiento no expone datos personales",
      !!view.data && !keys.some((k) => /customer|whatsapp|email|address|name$/.test(k)),
      keys.join(", "),
    );
  }

}

async function finish(crashed: unknown) {
  console.log("\nLimpiando datos de prueba…");
  const c = await cleanup();
  if (settingsBefore) {
    await srv.from("store_settings").update({
      whatsapp_number: settingsBefore.whatsapp_number,
      product_photos_enabled: settingsBefore.product_photos_enabled,
    }).eq("id", 1);
  }
  console.log(`  Borrados: ${c.orders} pedidos de prueba y ${c.products} productos de prueba. Configuración restaurada.`);
  const failed = results.filter((r) => !r.ok);
  // El reporte solo contiene nombres de pruebas y mensajes de Supabase; nunca claves
  writeFileSync("seguridad-reporte.json", JSON.stringify({ fecha: new Date().toISOString(), resultados: results }, null, 2));
  if (crashed) {
    console.error("\n✗ Error inesperado:", crashed instanceof Error ? crashed.message : crashed);
    process.exit(1);
  }
  console.log(`\n${results.length - failed.length}/${results.length} pruebas de seguridad correctas. Detalle en seguridad-reporte.json\n`);
  process.exit(failed.length ? 1 : 0);
}

main().then(() => finish(null), (e) => finish(e));

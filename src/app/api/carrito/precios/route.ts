import { NextResponse } from "next/server";
import { parseCheckBody, priceUpdates } from "@/lib/cart/price-check";
import { readJsonBody } from "@/lib/http";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Confirma precios y disponibilidad del carrito con los datos publicados.
 * Usa el cliente público: solo ve productos activos y nunca costos ni precio DETAL.
 */
export async function POST(request: Request) {
  const read = await readJsonBody(request, 12_000);
  if (!read.ok) return NextResponse.json({ error: "Solicitud no válida" }, { status: read.status });
  const items = parseCheckBody(read.data);
  if (!items) return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });

  const db = createPublicClient();
  if (!db) return NextResponse.json({ error: "Tienda sin configurar" }, { status: 503 });

  const ids = [...new Set(items.map((i) => i.productId))];
  const { data, error } = await db
    .from("products")
    .select("id, price_cop, availability, has_variants, variants:product_variants(id, price_cop, availability)")
    .in("id", ids)
    .eq("is_active", true);
  if (error) return NextResponse.json({ error: "No se pudieron confirmar los precios" }, { status: 502 });

  return NextResponse.json(
    { updates: priceUpdates(items, (data ?? []) as never) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

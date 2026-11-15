import { NextResponse } from "next/server";
import { placeOrder } from "@/lib/checkout";
import { readJsonBody } from "@/lib/http";
import { ipFingerprint, orderToken } from "@/lib/order-token";
import { createAdminClient } from "@/lib/supabase/admin";

/** Registra un pedido. El precio y la disponibilidad se verifican en la base (create_order). */
export async function POST(request: Request) {
  // Un pedido real (60 líneas como máximo) ocupa unos pocos KB
  const read = await readJsonBody(request, 20_000);
  if (!read.ok) return NextResponse.json({ ok: false, message: "Solicitud no válida." }, { status: read.status });
  const body = read.data;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip");
  const db = createAdminClient();
  const result = await placeOrder(body, {
    rpc: async (args) => {
      const { data, error } = await db.rpc("create_order", args);
      return { data, error };
    },
    token: orderToken,
    ipHash: ipFingerprint(ip),
  });
  if (!result.ok) console.warn("[pedidos] rechazado:", result.status, result.message);
  return NextResponse.json(result, { status: result.status, headers: { "Cache-Control": "no-store" } });
}

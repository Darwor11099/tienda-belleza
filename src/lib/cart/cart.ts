/**
 * Lógica pura del carrito (sin React ni navegador): se puede probar sola.
 * Los precios del carrito son informativos; el pedido real se recalcula en la base.
 */
export const MAX_QTY = 99;
export const MAX_LINES = 60;

export type CartLine = {
  key: string; // productId:variantId
  productId: string;
  variantId: string | null;
  slug: string;
  name: string;
  variantName: string | null;
  sku: string | null;
  unitPrice: number;
  imageUrl: string | null;
  quantity: number;
  /** true si al verificar precios el producto/variante ya no se puede comprar */
  unavailable?: boolean;
};

export type CartState = { version: 1; lines: CartLine[] };
export const EMPTY_CART: CartState = { version: 1, lines: [] };

export type NewLine = Omit<CartLine, "key" | "quantity" | "unavailable">;
export type PriceUpdate = { key: string; unitPrice: number | null; available: boolean };

export type CartAction =
  | { type: "add"; line: NewLine; quantity: number }
  | { type: "set"; key: string; quantity: number }
  | { type: "increment"; key: string }
  | { type: "decrement"; key: string }
  | { type: "remove"; key: string }
  | { type: "clear" }
  | { type: "sync"; updates: PriceUpdate[] };

export const lineKey = (productId: string, variantId: string | null) => `${productId}:${variantId ?? "-"}`;

const clampQty = (n: number) => Math.min(MAX_QTY, Math.max(1, Math.floor(Number.isFinite(n) ? n : 1)));

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "add": {
      const key = lineKey(action.line.productId, action.line.variantId);
      const qty = clampQty(action.quantity);
      const existing = state.lines.find((l) => l.key === key);
      if (existing) {
        return {
          ...state,
          lines: state.lines.map((l) =>
            l.key === key ? { ...l, ...action.line, key, quantity: clampQty(l.quantity + qty), unavailable: false } : l,
          ),
        };
      }
      if (state.lines.length >= MAX_LINES) return state;
      return { ...state, lines: [...state.lines, { ...action.line, key, quantity: qty }] };
    }
    case "set":
      return { ...state, lines: state.lines.map((l) => (l.key === action.key ? { ...l, quantity: clampQty(action.quantity) } : l)) };
    case "increment":
      return { ...state, lines: state.lines.map((l) => (l.key === action.key ? { ...l, quantity: clampQty(l.quantity + 1) } : l)) };
    case "decrement":
      return { ...state, lines: state.lines.map((l) => (l.key === action.key ? { ...l, quantity: clampQty(l.quantity - 1) } : l)) };
    case "remove":
      return { ...state, lines: state.lines.filter((l) => l.key !== action.key) };
    case "clear":
      return EMPTY_CART;
    case "sync": {
      const byKey = new Map(action.updates.map((u) => [u.key, u]));
      return {
        ...state,
        lines: state.lines.map((l) => {
          const u = byKey.get(l.key);
          if (!u) return { ...l, unavailable: true };
          return { ...l, unitPrice: u.unitPrice ?? l.unitPrice, unavailable: !u.available || u.unitPrice === null };
        }),
      };
    }
  }
}

export function cartTotals(state: CartState) {
  const valid = state.lines.filter((l) => !l.unavailable);
  return {
    lines: state.lines.map((l) => ({ key: l.key, subtotal: l.unitPrice * l.quantity })),
    units: valid.reduce((n, l) => n + l.quantity, 0),
    total: valid.reduce((n, l) => n + l.unitPrice * l.quantity, 0),
    hasUnavailable: state.lines.some((l) => l.unavailable),
  };
}

/** Lee lo guardado en el navegador y descarta todo lo que no tenga la forma esperada. */
export function parseStoredCart(raw: string | null): CartState {
  if (!raw) return EMPTY_CART;
  try {
    const data = JSON.parse(raw) as Partial<CartState>;
    if (data?.version !== 1 || !Array.isArray(data.lines)) return EMPTY_CART;
    const lines = data.lines
      .filter(
        (l): l is CartLine =>
          !!l &&
          typeof l.productId === "string" &&
          (l.variantId === null || typeof l.variantId === "string") &&
          typeof l.slug === "string" &&
          typeof l.name === "string" &&
          typeof l.unitPrice === "number" &&
          Number.isInteger(l.unitPrice) &&
          l.unitPrice > 0 &&
          typeof l.quantity === "number",
      )
      .slice(0, MAX_LINES)
      .map((l) => ({ ...l, key: lineKey(l.productId, l.variantId), quantity: clampQty(l.quantity) }));
    return { version: 1, lines };
  } catch {
    return EMPTY_CART;
  }
}

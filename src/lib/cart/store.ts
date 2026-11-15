"use client";

import { useSyncExternalStore } from "react";
import { cartReducer, cartTotals, EMPTY_CART, parseStoredCart, type CartAction, type CartState } from "@/lib/cart/cart";

/**
 * Carrito guardado en el navegador (localStorage). Se conserva al navegar,
 * al recargar y se sincroniza entre pestañas.
 */
const STORAGE_KEY = "tienda:carrito:v1";
let state: CartState = EMPTY_CART;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    state = parseStoredCart(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    state = EMPTY_CART; // navegación privada sin almacenamiento
  }
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    state = parseStoredCart(e.newValue);
    listeners.forEach((l) => l());
  });
}

export function dispatchCart(action: CartAction) {
  load();
  state = cartReducer(state, action);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sin almacenamiento: el carrito funciona mientras la página esté abierta
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  load();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => {
  load();
  return state;
};
const getServerSnapshot = () => EMPTY_CART;

export function useCart() {
  const cart = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { cart, totals: cartTotals(cart), dispatch: dispatchCart };
}

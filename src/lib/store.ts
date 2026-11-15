import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";

export type StoreSettings = {
  store_name: string;
  tagline: string | null;
  logo_path: string | null;
  whatsapp_number: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  contact_email: string | null;
  city: string | null;
  business_hours: string | null;
  delivery_info: string | null;
  payment_info: string | null;
  product_photos_enabled: boolean;
  brand_color: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_image_path: string | null;
  privacy_policy: string | null;
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_path: string | null;
  sort_order: number;
};

export type LoadResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "sin-configurar" | "error"; message?: string };

const SETTINGS_SELECT =
  "store_name, tagline, logo_path, whatsapp_number, instagram_url, facebook_url, tiktok_url, contact_email, " +
  "city, business_hours, delivery_info, payment_info, product_photos_enabled, brand_color, hero_title, hero_subtitle, hero_image_path, privacy_policy";

/** Una sola lectura por petición aunque la usen el layout y la página. */
export const getStoreSettings = cache(async (): Promise<LoadResult<StoreSettings>> => {
  const supabase = createPublicClient();
  if (!supabase) return { ok: false, reason: "sin-configurar" };
  const { data, error } = await supabase.from("store_settings").select(SETTINGS_SELECT).eq("id", 1).single();
  if (error) return { ok: false, reason: "error", message: error.message };
  return { ok: true, data: data as unknown as StoreSettings };
});

export const getCategories = cache(async (): Promise<LoadResult<Category[]>> => {
  const supabase = createPublicClient();
  if (!supabase) return { ok: false, reason: "sin-configurar" };
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name, description, image_path, sort_order")
    .order("sort_order");
  if (error) return { ok: false, reason: "error", message: error.message };
  return { ok: true, data: data as Category[] };
});

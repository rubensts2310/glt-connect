import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://sqcsjcdtahptpxwczoyy.supabase.co";
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || "sb_publishable_7k7XlZVRJEw5XYUuk2hzCA_LiEtF9QJ";
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
export const asset = (name) => (name ? `${SUPABASE_URL}/storage/v1/object/public/assets/${name}.webp` : null);
export const assetFile = (file) => `${SUPABASE_URL}/storage/v1/object/public/assets/${file}`;

// Llama una edge function. Las públicas (bot, quote) no requieren sesión.
export async function fn(name, body) {
  const { data: s } = await sb.auth.getSession();
  const token = s?.session?.access_token;
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body || {}),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Error ${r.status}`);
  return d;
}

export async function ensureDemoSession() {
  const { data } = await sb.auth.getSession();
  if (data.session) return data.session;
  const { data: d, error } = await sb.auth.signInWithPassword({
    email: import.meta.env.VITE_DEMO_EMAIL || "demo@gltconnect.app",
    password: import.meta.env.VITE_DEMO_PASSWORD || "vkCQGU61dhdZ_83zabPOnV_5",
  });
  if (error) throw error;
  return d.session;
}

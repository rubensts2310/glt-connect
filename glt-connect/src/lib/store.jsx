import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ensureDemoSession, sb } from "./supabase";

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const LEAD_COLS = "id,name,phone,channel,model_id,stage,score,score_breakdown,temperature,qualification,qualification_complete,bot_active,handoff_reason,summary,lost_reason,sale_amount,seller_id,showroom_id,created_at,first_response_at,assigned_at,last_activity_at,next_followup_at,followup_step,won_at,chat_token";

export function StoreProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [leads, setLeads] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [models, setModels] = useState([]);
  const [brands, setBrands] = useState([]);
  const [settings, setSettings] = useState({});
  const [toasts, setToasts] = useState([]);
  const [viewAs, setViewAsState] = useState(() => {
    try { return JSON.parse(localStorage.getItem("glt_viewas")) || { role: "gerente" }; } catch { return { role: "gerente" }; }
  });
  const [tick, setTick] = useState(0);
  const leadsRef = useRef([]);
  leadsRef.current = leads;

  const setViewAs = (v) => { setViewAsState(v); try { localStorage.setItem("glt_viewas", JSON.stringify(v)); } catch {} };

  const toast = useCallback((t) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((x) => [...x, { id, ...t }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), t.ms || 5000);
  }, []);

  const loadLeads = useCallback(async () => {
    const { data } = await sb.from("leads").select(LEAD_COLS).order("created_at", { ascending: false }).limit(1000);
    const prev = leadsRef.current;
    if (prev.length && data) {
      const byId = Object.fromEntries(prev.map((l) => [l.id, l]));
      data.forEach((l) => {
        const p = byId[l.id];
        if (!p) toast({ title: "Nuevo lead", body: `${l.name || "Prospecto"} entró por ${l.channel}`, lead: l.id });
        else if (!p.seller_id && l.seller_id) toast({ title: "Lead calificado y asignado", body: `${l.name || "Prospecto"} · puntaje ${l.score}`, lead: l.id, kind: "hot" });
      });
    }
    setLeads(data || []);
  }, [toast]);

  useEffect(() => {
    let ch, poll, live = false;
    (async () => {
      try {
        await ensureDemoSession();
        const [s, m, b, st] = await Promise.all([
          sb.from("sellers").select("*").order("name"),
          sb.from("models").select("*").order("sort"),
          sb.from("brands").select("*").order("sort"),
          sb.from("settings").select("*"),
        ]);
        setSellers(s.data || []); setModels(m.data || []); setBrands(b.data || []);
        setSettings(Object.fromEntries((st.data || []).map((r) => [r.key, r.value])));
        await loadLeads();
        setReady(true);
        ch = sb.channel("crm")
          .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, (p) => {
            if (p.eventType === "INSERT") {
              setLeads((x) => [p.new, ...x]);
            } else if (p.eventType === "UPDATE") {
              const prev = leadsRef.current.find((l) => l.id === p.new.id);
              if (prev && !prev.seller_id && p.new.seller_id) toast({ title: "Lead calificado y asignado", body: `${p.new.name || "Nuevo prospecto"} · puntaje ${p.new.score}`, lead: p.new.id, kind: "hot" });
              setLeads((x) => x.map((l) => (l.id === p.new.id ? { ...l, ...p.new } : l)));
            } else if (p.eventType === "DELETE") setLeads((x) => x.filter((l) => l.id !== p.old.id));
          })
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "lead_events" }, (p) => {
            const e = p.new;
            if (e.type === "creado") toast({ title: "Nuevo lead", body: e.detail, lead: e.lead_id });
            if (["cotizacion_abierta", "test_drive", "quiero_este", "whatsapp"].includes(e.type)) toast({ title: "Actividad del cliente", body: e.detail, lead: e.lead_id, kind: e.type === "quiero_este" ? "hot" : undefined });
            setTick((t) => t + 1);
          })
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => setTick((t) => t + 1))
          .on("postgres_changes", { event: "*", schema: "public", table: "quotes" }, () => setTick((t) => t + 1))
          .subscribe((status) => { live = status === "SUBSCRIBED"; });
        // Respaldo: si el tiempo real no conecta (redes corporativas), refresca cada 6 s
        poll = setInterval(() => { if (!live) { loadLeads(); setTick((t) => t + 1); } }, 6000);
      } catch (e) { setError(e.message); }
    })();
    const iv = setInterval(() => setTick((t) => t + 1), 30000); // refresca relojes de SLA
    return () => { ch && sb.removeChannel(ch); clearInterval(iv); clearInterval(poll); };
  }, [loadLeads, toast]);

  const sellerById = useMemo(() => Object.fromEntries(sellers.map((s) => [s.id, s])), [sellers]);
  const modelById = useMemo(() => Object.fromEntries(models.map((m) => [m.id, m])), [models]);
  const vendedores = sellers.filter((s) => s.role === "vendedor");

  const visibleLeads = useMemo(() => {
    if (viewAs.role === "vendedor") return leads.filter((l) => l.seller_id === (viewAs.sellerId || vendedores[0]?.id));
    return leads;
  }, [leads, viewAs, vendedores]);

  const updateLead = useCallback(async (id, patch, event) => {
    setLeads((x) => x.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    await sb.from("leads").update(patch).eq("id", id);
    if (event) await sb.from("lead_events").insert({ lead_id: id, ...event });
    await sb.rpc("compute_score", { p_lead: id });
  }, []);

  const value = {
    ready, error, leads, visibleLeads, sellers, vendedores, models, brands, settings, sellerById, modelById,
    viewAs, setViewAs, toast, toasts, tick, loadLeads, updateLead,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

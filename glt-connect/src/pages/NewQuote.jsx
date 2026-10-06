import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { sb } from "../lib/supabase";
import { CHANNELS, stageLabel } from "../lib/format";
import { Modal, TempChip } from "../components/bits";
import QuoteBuilder from "./QuoteBuilder";

const OPEN = ["nuevo", "contactado", "calificado", "cotizado", "test_drive", "financiamiento", "negociacion"];

// Botón + flujo: elegir cliente (existente o nuevo) y abrir el cotizador
export function NewQuoteButton({ modelId, className = "btn", label = "Nueva cotización" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>＋ {label}</button>
      {open && <NewQuoteFlow modelId={modelId} onClose={() => setOpen(false)} />}
    </>
  );
}

export function NewQuoteFlow({ modelId, onClose }) {
  const { visibleLeads, vendedores, sellerById, meId, models, toast, loadLeads } = useStore();
  const [tab, setTab] = useState("existente");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(null);
  const [f, setF] = useState({ name: "", phone: "", channel: "sala", seller: meId || vendedores[0]?.id || "" });
  const [busy, setBusy] = useState(false);
  const model = models.find((m) => m.id === modelId);

  const list = useMemo(() => visibleLeads
    .filter((l) => OPEN.includes(l.stage) && l.seller_id && (!q || `${l.name} ${l.phone}`.toLowerCase().includes(q.toLowerCase())))
    .slice(0, 40), [visibleLeads, q]);

  const create = async () => {
    if (!f.name.trim()) return;
    setBusy(true);
    const s = sellerById[f.seller];
    const now = new Date().toISOString();
    const { data, error } = await sb.from("leads").insert({
      name: f.name.trim(), phone: f.phone.trim() || null, channel: f.channel, model_id: modelId || null, stage: "contactado",
      seller_id: s?.id, showroom_id: s?.showroom_id, assigned_at: now, first_response_at: now, bot_active: false,
      qualification: { nombre: f.name.trim(), telefono: f.phone.trim() || undefined, sala: s?.showroom_id === "jlib" ? "Liberación" : "20 Calle" },
      summary: `Cliente registrado por ${s?.name} para cotizar${model ? ` la ${model.name}` : ""}.`,
    }).select("*").single();
    if (error) { toast({ title: "No se pudo crear el cliente", body: error.message, kind: "hot" }); setBusy(false); return; }
    await sb.from("lead_events").insert({ lead_id: data.id, type: "creado", detail: `${data.name} registrado por ${s?.name} (${CHANNELS[f.channel] || f.channel})` });
    await sb.rpc("compute_score", { p_lead: data.id });
    loadLeads();
    setBusy(false);
    setPicked(data);
  };

  if (picked) return <QuoteBuilder lead={{ ...picked, model_id: modelId || picked.model_id }} seller={sellerById[picked.seller_id]} onClose={onClose} />;

  return (
    <Modal onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
        <div>
          <h2 style={{ margin: 0 }}>Nueva cotización{model ? ` · ${model.name}` : ""}</h2>
          <span className="muted" style={{ fontSize: 13 }}>¿Para quién es?</span>
        </div>
        <div className="seg" style={{ alignSelf: "flex-start" }}>
          <button className={tab === "existente" ? "on" : ""} onClick={() => setTab("existente")}>Cliente existente</button>
          <button className={tab === "nuevo" ? "on" : ""} onClick={() => setTab("nuevo")}>Cliente nuevo</button>
        </div>
        {tab === "existente" ? (
          <>
            <input className="inp" autoFocus placeholder="Buscar por nombre o teléfono" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar cliente" />
            <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {list.length === 0 && <span className="faint" style={{ padding: 10 }}>No hay clientes abiertos con ese nombre. Créelo en «Cliente nuevo».</span>}
              {list.map((l) => (
                <button key={l.id} className="pick-row" onClick={() => setPicked(l)}>
                  <b>{l.name || "Prospecto"}</b>
                  <span className="faint">{stageLabel(l.stage)}{!meId && sellerById[l.seller_id] ? ` · ${sellerById[l.seller_id].name}` : ""}</span>
                  <span style={{ marginLeft: "auto" }}><TempChip t={l.temperature} /></span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label className="field" style={{ gridColumn: "1 / -1" }}><span>Nombre del cliente</span><input className="inp" autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ej. Carlos Méndez" /></label>
            <label className="field"><span>Teléfono</span><input className="inp" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="5555 5555" inputMode="tel" /></label>
            <label className="field"><span>¿Cómo llegó?</span>
              <select className="sel" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}>
                {["sala", "llamada", "whatsapp", "evento", "web"].map((c) => <option key={c} value={c}>{CHANNELS[c] || c}</option>)}
              </select>
            </label>
            {!meId && (
              <label className="field" style={{ gridColumn: "1 / -1" }}><span>Asesor</span>
                <select className="sel" value={f.seller} onChange={(e) => setF({ ...f, seller: e.target.value })}>{vendedores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              </label>
            )}
            <button className="btn" style={{ gridColumn: "1 / -1" }} disabled={busy || !f.name.trim()} onClick={create}>{busy ? "Creando…" : "Continuar al cotizador →"}</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

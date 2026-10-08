// Panel de gerencia: avance del evento, asesores, configuración y exportación
import { useMemo, useState } from "react";
import { useAS } from "./store";
import { Avatar, squarePhoto } from "./Avatar";
import { fmtQ } from "../lib/format";
import { Lollipop } from "../components/charts";

export default function Manager({ onOpenSeller }) {
  const { data, manager, toast, refresh } = useAS();
  const [tab, setTab] = useState("avance");
  const leads = data.leads || [], quotes = data.quotes || [];
  const sellers = data.sellers || [];
  const today = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
  const isToday = (t) => t && new Date(new Date(t).getTime() - 6 * 3600e3).toISOString().slice(0, 10) === today;
  const stats = useMemo(() => {
    const by = Object.fromEntries(sellers.map((s) => [s.id, { s, leads: 0, hoy: 0, hot: 0, quotes: 0, opened: 0, overdue: 0, contacted: 0, won: 0 }]));
    const qLead = new Set(quotes.map((q) => q.lead_id));
    for (const l of leads) {
      const r = by[l.seller_id]; if (!r) continue;
      r.leads++; if (isToday(l.captured_at || l.created_at)) r.hoy++; if (l.temperature === "caliente") r.hot++;
      if (l.followup_step > 0) r.contacted++; if (l.stage === "ganado") r.won++;
      if (l.next_action_at && !["ganado", "perdido"].includes(l.stage) && new Date(l.next_action_at) < Date.now() - 864e5) r.overdue++;
    }
    for (const q of quotes) { const r = by[q.seller_id]; if (!r) continue; r.quotes++; if (q.open_count > 0) r.opened++; }
    const models = {};
    for (const l of leads) models[l.model_id] = (models[l.model_id] || 0) + 1;
    return { rows: Object.values(by).sort((a, b) => b.leads - a.leads), models, withQuote: leads.filter((l) => qLead.has(l.id)).length };
  }, [leads, quotes, sellers]); // eslint-disable-line
  const opened = quotes.filter((q) => q.open_count > 0).length;
  const doExport = async () => {
    try {
      const r = await manager("export");
      const blob = new Blob([r.csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `autoshow-leads-${today}.csv`; a.click();
    } catch (e) { toast("No se pudo exportar", e.message, "bad"); }
  };
  return (
    <div className="as-page">
      <div className="as-row-between">
        <div className="as-seg">{[["avance", "Avance"], ["asesores", "Asesores"], ["evento", "Evento"]].map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
        <button className="as-btn as-ghost" onClick={doExport}>Exportar a Excel (CSV)</button>
      </div>
      {tab === "avance" && (
        <>
          <div className="as-kpis">
            <div className="as-kpi dark"><span>Leads captados</span><b>{leads.length}</b><small>{leads.filter((l) => isToday(l.captured_at || l.created_at)).length} hoy</small></div>
            <div className="as-kpi"><span>Calientes</span><b>{leads.filter((l) => l.temperature === "caliente").length}</b><small>{leads.length ? Math.round((leads.filter((l) => l.temperature === "caliente").length / leads.length) * 100) : 0}% del total</small></div>
            <div className="as-kpi"><span>Cotizados</span><b>{stats.withQuote}</b><small>{quotes.length} cotizaciones · {quotes.length ? Math.round((opened / quotes.length) * 100) : 0}% abiertas</small></div>
            <div className="as-kpi accent"><span>Vendidos</span><b>{leads.filter((l) => l.stage === "ganado").length}</b><small>{fmtQ(quotes.filter((q) => leads.find((l) => l.id === q.lead_id && l.stage === "ganado")).reduce((a, q) => a + Number(q.total || 0), 0))}</small></div>
          </div>
          <div className="as-two">
            <div className="as-card pad">
              <span className="as-label">Por asesor</span>
              <div className="as-table">
                <div className="as-tr th"><span>Asesor</span><span>Leads</span><span>Hoy</span><span>🔥</span><span>Cotiz.</span><span>Abiertas</span><span>Contactados</span><span>Atrasados</span></div>
                {stats.rows.map((r) => (
                  <button key={r.s.id} className="as-tr" onClick={() => onOpenSeller(r.s.id)}>
                    <span><b>{r.s.name}</b></span><span>{r.leads}</span><span>{r.hoy}</span><span>{r.hot}</span><span>{r.quotes}</span><span>{r.opened}</span><span>{r.contacted}</span><span className={r.overdue ? "bad" : ""}>{r.overdue}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="as-card pad">
              <span className="as-label">Interés por modelo</span>
              <Lollipop items={Object.entries(stats.models).sort((a, b) => b[1] - a[1]).map(([id, v]) => ({ label: data.models.find((m) => m.id === id)?.name || id, value: v, color: "var(--as-blue)" }))} fmt={(v) => `${v}`} labelW={130} width={460} />
            </div>
          </div>
        </>
      )}
      {tab === "asesores" && <Sellers sellers={sellers} manager={manager} toast={toast} refresh={refresh} />}
      {tab === "evento" && <EventCfg data={data} manager={manager} toast={toast} refresh={refresh} />}
    </div>
  );
}

function Sellers({ sellers, manager, toast, refresh }) {
  const [f, setF] = useState(null);
  const save = async () => {
    try { await manager("seller_save", { data: f }); toast("Guardado", f.name); setF(null); refresh(); } catch (e) { toast("No se guardó", e.message, "bad"); }
  };
  return (
    <div className="as-two">
      <div className="as-card pad">
        <div className="as-row-between"><span className="as-label">Usuarios</span><button className="as-btn as-primary sm" onClick={() => setF({ name: "", role: "vendedor", phone: "", pin: "", active: true })}>＋ Agregar asesor</button></div>
        <div className="as-list">
          {sellers.map((s) => <button key={s.id} className="as-lrow" onClick={() => setF({ ...s, pin: "" })}><Avatar person={s} /><div className="as-lmain"><b>{s.name}</b><span className="as-muted">{s.role === "gerente" ? "Gerencia" : "Asesor"}{s.phone ? ` · WhatsApp ${s.phone}` : ""}</span></div>{s.active === false && <span className="as-pill bad">Inactivo</span>}</button>)}
        </div>
      </div>
      {f && (
        <div className="as-card pad">
          <span className="as-label">{f.id ? "Editar usuario" : "Nuevo asesor"}</span>
          <div className="as-field"><span>Foto (la ve el cliente en WhatsApp y en su cotización)</span>
            <div className="as-photo-pick">
              {f.photo_data ? <img className="as-av lg as-av-img" src={f.photo_data} alt="" /> : <Avatar person={f} className="as-av lg" />}
              <label className="as-btn as-ghost sm">{f.photo_data || f.photo ? "Cambiar foto" : "Tomar o subir foto"}
                <input type="file" accept="image/*" hidden onChange={async (e) => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; try { setF({ ...f, photo_data: await squarePhoto(file) }); } catch (x) { toast("Foto no válida", x.message, "bad"); } }} />
              </label>
              {(f.photo_data || f.photo) && <button className="as-btn as-ghost sm" onClick={() => setF({ ...f, photo: null, photo_data: null })}>Quitar</button>}
            </div>
          </div>
          <label className="as-field"><span>Nombre</span><input className="as-inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className="as-field"><span>WhatsApp del asesor (lo ve el cliente en su cotización)</span><input className="as-inp" inputMode="tel" value={f.phone || ""} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
          <div className="as-field"><span>Rol</span><div className="as-seg">{[["vendedor", "Asesor"], ["gerente", "Gerencia"]].map(([k, l]) => <button key={k} className={f.role === k ? "on" : ""} onClick={() => setF({ ...f, role: k })}>{l}</button>)}</div></div>
          <label className="as-field"><span>{f.id ? "Nuevo PIN (dejar vacío para no cambiar)" : "PIN (4 a 6 dígitos)"}</span><input className="as-inp" inputMode="numeric" value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })} /></label>
          {f.id && <label className="as-check"><input type="checkbox" checked={f.active !== false} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Usuario activo</label>}
          <div className="as-actions"><button className="as-btn as-ghost" onClick={() => setF(null)}>Cancelar</button><button className="as-btn as-primary" onClick={save}>Guardar</button></div>
        </div>
      )}
    </div>
  );
}

function EventCfg({ data, manager, toast, refresh }) {
  const ev = data.settings?.event || {};
  const [f, setF] = useState({ name: ev.name || "", stand: ev.stand || "", bono_label: ev.bono_label || "Bono Autoshow", bono_q: ev.bono_q || 0, validez_dias: ev.validez_dias || 15, bono_por_modelo: { ...(ev.bono_por_modelo || {}) } });
  const [code, setCode] = useState("");
  const save = async () => {
    try { await manager("settings_save", { event: { ...f, bono_q: Number(f.bono_q) || 0, validez_dias: Number(f.validez_dias) || 15 }, activation_code: code || undefined }); toast("Evento actualizado"); setCode(""); refresh(); } catch (e) { toast("No se guardó", e.message, "bad"); }
  };
  return (
    <div className="as-two">
      <div className="as-card pad">
        <span className="as-label">Evento</span>
        <label className="as-field"><span>Nombre del evento (aparece en mensajes y cotizaciones)</span><input className="as-inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="as-field"><span>Stand</span><input className="as-inp" value={f.stand} onChange={(e) => setF({ ...f, stand: e.target.value })} /></label>
        <div className="as-form-grid">
          <label className="as-field"><span>Nombre del bono</span><input className="as-inp" value={f.bono_label} onChange={(e) => setF({ ...f, bono_label: e.target.value })} /></label>
          <label className="as-field"><span>Bono general (Q)</span><input className="as-inp" inputMode="numeric" value={f.bono_q} onChange={(e) => setF({ ...f, bono_q: e.target.value.replace(/\D/g, "") })} /></label>
          <label className="as-field"><span>Vigencia de la cotización (días)</span><input className="as-inp" inputMode="numeric" value={f.validez_dias} onChange={(e) => setF({ ...f, validez_dias: e.target.value.replace(/\D/g, "") })} /></label>
        </div>
        <span className="as-label">Código para activar tablets</span>
        <input className="as-inp as-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Nuevo código (dejar vacío para no cambiar)" />
        <div className="as-actions">
          <button className="as-btn as-ghost" onClick={async () => { if (confirm("¿Cerrar la sesión en todas las demás tablets? Tendrán que activarse otra vez.")) { await manager("device_revoke_all"); toast("Listo", "Las demás tablets deben activarse de nuevo"); } }}>Desactivar otras tablets</button>
          <button className="as-btn as-primary" onClick={save}>Guardar</button>
        </div>
      </div>
      <div className="as-card pad">
        <span className="as-label">Bono por modelo (vacío = bono general)</span>
        {data.models.map((m) => (
          <div key={m.id} className="as-kv"><span>{m.name}</span>
            <input className="as-inp" style={{ width: 140 }} inputMode="numeric" value={f.bono_por_modelo[m.id] ?? ""} placeholder={String(f.bono_q || 0)}
              onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); const b = { ...f.bono_por_modelo }; if (v === "") delete b[m.id]; else b[m.id] = Number(v); setF({ ...f, bono_por_modelo: b }); }} />
          </div>
        ))}
      </div>
    </div>
  );
}

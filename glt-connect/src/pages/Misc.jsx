import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { SUPABASE_URL, asset, fn, sb } from "../lib/supabase";
import { ago, fmtQ, fmtUSD, priceMain, priceSub } from "../lib/format";
import { TopBar } from "../components/Shell";
import { NewQuoteButton } from "./NewQuote";
import { QR } from "../components/bits";
import { ACCESS, SCOPE, SECTIONS } from "../lib/perm";
import { IBolt, IChat, IFast } from "../components/icons";

export function Catalogo() {
  const { models } = useStore();
  const [sel, setSel] = useState({});
  return (
    <>
      <TopBar title="Catálogo Jetour" crumbs="Precios oficiales · IVA incluido"><NewQuoteButton /></TopBar>
      <div className="grid g3">
        {models.map((m) => {
          const cs = (m.colors || []).filter((c) => c.img);
          const c = cs[sel[m.id] || 0];
          return (
            <div key={m.id} className="card">
              <div className="card-head"><h2>{m.name}</h2><span className="chip">{m.powertrain}</span></div>
              {c && <img className="car-img" src={asset(c.img)} alt={`${m.name} ${c.name}`} loading="lazy" />}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{cs.map((x, i) => <button key={x.name} className={`swatch ${i === (sel[m.id] || 0) ? "on" : ""}`} style={{ background: x.hex, width: 24, height: 24 }} title={x.name} aria-label={x.name} onClick={() => setSel({ ...sel, [m.id]: i })} />)}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 8 }}>
                <div><span className="label">{m.price_from ? "Desde" : "Precio"}</span><div style={{ fontSize: 22, fontWeight: 800 }} className="num">{priceMain(m)}</div>{priceSub(m) && <span className="faint" style={{ fontSize: 12 }}>{priceSub(m)}</span>}</div>
                <span className="chip good">{m.warranty}</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <NewQuoteButton modelId={m.id} className="btn sm" label="Cotizar" />
                <Link to={`/catalogo/${m.id}`} className="btn ghost sm">Ficha completa{(m.media || []).some((x) => x.type === "video") ? " · videos" : ""}{(m.media || []).some((x) => x.type === "pano") ? " · 360°" : ""}</Link>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                {(m.highlights || []).map((h, i) => <div key={i} style={{ background: "var(--card2)", borderRadius: 12, padding: 8, textAlign: "center" }}><b>{h[0]}</b> <span className="faint" style={{ fontSize: 11 }}>{h[1]}</span><div className="faint" style={{ fontSize: 10.5 }}>{h[2]}</div></div>)}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function DemoCenter() {
  const { toast, visibleLeads: leads } = useStore();
  const chatUrl = `${window.location.origin}/chat`;
  const [busy, setBusy] = useState("");
  const [follows, setFollows] = useState([]);
  const run = async (key, f) => { setBusy(key); try { await f(); } catch (e) { toast({ title: "Algo falló", body: e.message, kind: "hot" }); } setBusy(""); };
  const importCsv = async (file) => {
    const rows = (await file.text()).split(/\r?\n/).slice(1).filter(Boolean).map((r) => r.split(","));
    for (const [name, phone, model_id] of rows.slice(0, 15)) await fn("ingest", { channel: "hubspot", name, phone, model_id: model_id?.trim() || null, source: "CSV HubSpot" });
    toast({ title: "Importación lista", body: `${Math.min(rows.length, 15)} contactos de HubSpot entraron al CRM` });
  };
  const live = leads.filter((l) => Date.now() - new Date(l.created_at) < 3 * 3600e3).slice(0, 6);
  return (
    <>
      <TopBar title="Centro de demo" crumbs="Para la presentación en vivo" />
      <div className="grid g3">
        <div className="card" style={{ alignItems: "center", textAlign: "center" }}>
          <span className="label">1 · El cliente escribe</span>
          <QR text={chatUrl} size={210} />
          <h2>Escaneá y chateá con el bot</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Abre un chat tipo WhatsApp con el asistente de IA. El lead aparece en el embudo en vivo, con su puntaje.</p>
          <a className="btn ghost sm" href="/chat" target="_blank" rel="noreferrer"><IChat /> Abrir chat aquí</a>
        </div>
        <div className="card">
          <span className="label">2 · Llega un lead de pauta</span>
          <h2>Simular lead de Meta</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Entra por la misma API que usarán Meta, WhatsApp, la web y HubSpot. El bot lo califica en unos 20 segundos y lo asigna.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[["meta", "Meta"], ["google", "Google"], ["web", "Web"]].map(([c, l]) => (
              <button key={c} className="btn" disabled={!!busy} onClick={() => run(c, async () => { await fn("ingest", { simulate: true, channel: c }); toast({ title: `Lead de ${l} recibido`, body: "El bot ya lo está calificando…" }); })}>{busy === c ? "Enviando…" : `Lead de ${l}`}</button>
            ))}
          </div>
          <span className="label" style={{ marginTop: 8 }}>Últimas 3 horas</span>
          {live.map((l) => <Link key={l.id} to={`/lead/${l.id}`} className="row link" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}><b>{l.name || "Prospecto"}</b><span className="chip">{l.stage} · {l.score}</span></Link>)}
        </div>
        <div className="card">
          <span className="label">3 · No dejar que se enfríe</span>
          <h2>Adelantar el tiempo</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Dispara los seguimientos que el bot enviaría en los próximos 3 días, redactados con IA según cada conversación.</p>
          <button className="btn blue" disabled={!!busy} onClick={() => run("ff", async () => { const r = await fn("followup", { advance_hours: 72, limit: 3 }); setFollows(r.done.filter(Boolean)); })}><IFast /> {busy === "ff" ? "Generando seguimientos…" : "Adelantar 3 días"}</button>
          {follows.map((f) => <Link key={f.lead_id} to={`/lead/${f.lead_id}`} className="card flat" style={{ padding: 12, gap: 4 }}><b style={{ fontSize: 13 }}>{f.name}</b><span style={{ fontSize: 13 }}>{f.mensaje}</span></Link>)}
        </div>
      </div>
      <div className="card">
        <div className="card-head"><h2>Migración desde HubSpot</h2><span className="chip blue">CSV · nombre, teléfono, modelo</span></div>
        <p className="muted" style={{ margin: 0 }}>Suba un CSV exportado de HubSpot. Cada contacto entra por la API de ingreso y el bot le escribe para calificarlo.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input type="file" accept=".csv" id="csv" onChange={(e) => e.target.files[0] && run("csv", () => importCsv(e.target.files[0]))} />
          <button className="btn ghost sm" onClick={() => run("csv", () => importCsv(new File(["nombre,telefono,modelo\nLaura Pineda,55218844,t2h\nMarco Solórzano,40119922,x50\nAna Lucía Reyes,31447788,g700"], "hubspot.csv")))}>Importar CSV de ejemplo</button>
        </div>
      </div>
    </>
  );
}

export function Integraciones() {
  const { settings } = useStore();
  const url = `${SUPABASE_URL}/functions/v1/ingest`;
  const items = [
    ["Meta Lead Ads", "Formularios de Facebook e Instagram", "Webhook listo · requiere app de Meta aprobada"],
    ["WhatsApp Business API", "Conversaciones del bot y asesores", "Chat web activo · número oficial en trámite"],
    ["Google Ads", "Formularios y llamadas", "Webhook listo"],
    ["Sitio web Jetour", "Formulario de cotización", "Webhook listo"],
    ["HubSpot", "Migración de contactos y negocios", "Importación CSV activa"],
    ["OpenAI", "Bot de calificación y seguimientos", "Conectado"],
    ["SAT Guatemala", "Inscripciones mensuales por marca", "Carga mensual"],
  ];
  return (
    <>
      <TopBar title="Integraciones" crumbs="Canales de entrada" />
      <div className="grid g3">
        {items.map(([n, d, s]) => (
          <div key={n} className="card" style={{ gap: 8 }}>
            <div className="card-head"><h2>{n}</h2><span className={`chip ${s.startsWith("Conectado") || s.includes("activa") || s.includes("activo") ? "good" : "blue"}`}>{s.split(" · ")[0]}</span></div>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>{d}</p>
            {s.includes(" · ") && <span className="faint" style={{ fontSize: 12 }}>{s.split(" · ")[1]}</span>}
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-head"><h2>Roles y accesos</h2><span className="faint" style={{ fontSize: 12 }}>Por sección y nivel jerárquico</span></div>
        <div className="tablewrap"><table className="t">
          <thead><tr><th>Sección</th><th>Director</th><th>Gerente</th><th>Asesor</th></tr></thead>
          <tbody>{Object.entries(SECTIONS).map(([k, n]) => (
            <tr key={k}><td><b>{n}</b></td>{["director", "gerente", "vendedor"].map((r) => <td key={r}>{ACCESS[r].includes(k) ? <span className="chip good">✓</span> : <span className="chip">—</span>}</td>)}</tr>
          ))}
          <tr><td><b>Datos visibles</b></td>{["director", "gerente", "vendedor"].map((r) => <td key={r} style={{ whiteSpace: "normal", fontSize: 12.5 }}>{SCOPE[r]}</td>)}</tr></tbody>
        </table></div>
      </div>
      <div className="card">
        <h2>API de entrada de leads</h2>
        <p className="muted" style={{ margin: 0 }}>Cualquier fuente envía un POST con <code className="mono">name, phone, email, channel, model_id, message</code>. El bot hace el primer contacto al instante.</p>
        <code className="mono" style={{ background: "var(--card2)", padding: 12, borderRadius: 12, userSelect: "all", wordBreak: "break-all" }}>POST {url}<br />x-glt-key: {settings.ingest_key}</code>
      </div>
    </>
  );
}

// GLT Connect · Autoshow — app de tablet para el stand (producción)
import { useEffect, useState } from "react";
import "./autoshow.css";
import { AutoshowProvider, useAS } from "./store";
import { Activate, Login } from "./Gate";
import { Stand } from "./Stand";
import Capture from "./Capture";
import { Clients, FollowUp, LeadSheet } from "./Clients";
import Manager from "./Manager";
import { assetFile } from "../lib/supabase";
import { initials } from "../lib/format";

function useInstallable() {
  useEffect(() => {
    document.title = "GLT Autoshow";
    if (!document.querySelector('link[rel="manifest"]')) {
      const l = document.createElement("link"); l.rel = "manifest"; l.href = "/autoshow.webmanifest"; document.head.appendChild(l);
    }
    const meta = document.querySelector('meta[name="theme-color"]') || Object.assign(document.createElement("meta"), { name: "theme-color" });
    meta.content = "#0d1014"; document.head.appendChild(meta);
    if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("/as-sw.js").catch(() => {});
  }, []);
}

// Descarga en segundo plano las fotos del catálogo para que funcione sin señal
function usePrecache() {
  const { data } = useAS();
  useEffect(() => {
    if (!data.models?.length || !("caches" in window)) return;
    const urls = new Set();
    for (const m of data.models) {
      for (const c of m.colors || []) if (c.img) { urls.add(assetUrl(c.img)); for (const a of c.angles || []) urls.add(assetUrl(c.img.replace("_hero", `_${a}`))); }
      for (const x of m.media || []) if (x.type !== "video") urls.add(assetUrl(x.src)); else if (x.poster) urls.add(x.poster);
    }
    caches.open("as-media-v1").then(async (c) => { for (const u of urls) { try { if (!(await c.match(u))) await c.add(u); } catch {} } }).catch(() => {});
  }, [data.models]);
}
const assetUrl = (n) => assetFile(`${n}.webp`);

function Shell() {
  const { me, online, pending, pendingOther, syncing, lastSync, signOut, toasts, data, flush } = useAS();
  const [tab, setTab] = useState("stand");
  const [sheet, setSheet] = useState(null);
  const [sellerFilter, setSellerFilter] = useState("");
  usePrecache();
  const today = (data.leads || []).filter((l) => !["ganado", "perdido"].includes(l.stage) && l.next_action_at && new Date(l.next_action_at) <= new Date(Date.now() + 18 * 3600e3) && l.seller_id === me.id).length;
  const TABS = [["stand", "Catálogo"], ["clientes", `Clientes (${(data.leads || []).length})`], ["seguimiento", `Seguimiento${today ? ` · ${today}` : ""}`], ...(me.role === "gerente" ? [["gerencia", "Gerencia"]] : [])];
  return (
    <div className="as-app">
      <header className="as-top">
        <div className="as-brand"><img src={assetFile("glt_icon.png")} alt="" /><div><b>{data.settings?.event?.name || "Autoshow"}</b><span>{data.settings?.event?.stand || "Jetour"}</span></div></div>
        <nav className="as-tabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => { setTab(k); if (k !== "clientes") setSellerFilter(""); }}>{l}</button>)}</nav>
        <div className="as-me">
          <button className={`as-sync ${!online ? "off" : pending ? "pend" : ""}`} onClick={() => flush()} title={lastSync ? `Última sincronización ${new Date(lastSync).toLocaleTimeString("es-GT")}` : ""}>
            <i />{!online ? `Sin señal${pending ? ` · ${pending} por subir` : ""}` : pending ? (syncing ? "Subiendo…" : `${pending} por subir`) : "Al día"}
          </button>
          <button className="as-who" onClick={() => { if (!pending || confirm(`Hay ${pending} cambios sin subir. Se subirán cuando ${me.name.split(" ")[0]} vuelva a entrar. ¿Cambiar de asesor?`)) signOut(true); }}>
            <span className="as-av">{initials(me.name)}</span><span className="as-hide-sm">{me.name.split(" ")[0]}</span><small>Cambiar</small>
          </button>
        </div>
      </header>
      {pendingOther > 0 && <div className="as-banner">Hay {pendingOther} cambios de otro asesor esperando en esta tablet. Se subirán cuando esa persona vuelva a entrar.</div>}
      <main className="as-main">
        {tab === "stand" && <Stand onQuote={(m) => setSheet({ t: "capture", model: m })} onCapture={(m) => setSheet({ t: "capture", model: m })} />}
        {tab === "clientes" && <Clients onOpen={(id) => setSheet({ t: "lead", id })} sellerFilter={sellerFilter} key={sellerFilter} />}
        {tab === "seguimiento" && <FollowUp onOpen={(id) => setSheet({ t: "lead", id })} />}
        {tab === "gerencia" && me.role === "gerente" && <Manager onOpenSeller={(id) => { setSellerFilter(id); setTab("clientes"); }} />}
      </main>
      {sheet?.t === "capture" && <Capture model={sheet.model} lead={sheet.lead} onClose={() => setSheet(null)} onOpenLead={(id) => setSheet({ t: "lead", id })} />}
      {sheet?.t === "lead" && <LeadSheet id={sheet.id} onClose={() => setSheet(null)} onQuote={(lead) => setSheet({ t: "capture", lead, model: null })} />}
      <div className="as-toasts">{toasts.map((t) => <div key={t.id} className={`as-toast ${t.kind || ""}`}><b>{t.title}</b>{t.body && <span>{t.body}</span>}</div>)}</div>
    </div>
  );
}

function Root() {
  const { device, session, me } = useAS();
  useInstallable();
  if (!device) return <Activate />;
  if (!session || !me) return <Login />;
  return <Shell />;
}

export default function AutoshowApp() {
  return <AutoshowProvider><Root /></AutoshowProvider>;
}

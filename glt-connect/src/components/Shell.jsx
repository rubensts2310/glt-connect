import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useStore } from "../lib/store";
import { can } from "../lib/perm";
import { assetFile } from "../lib/supabase";
import { IChart, IDoc, IHome, IKanban, IPlay, IPlug, ICar } from "./icons";
import { Loading, Toasts } from "./bits";

const NAV = [
  { to: "/", icon: <IHome />, tip: "Inicio", end: true, sec: "inicio" },
  { to: "/pipeline", icon: <IKanban />, tip: "Embudo", sec: "pipeline" },
  { to: "/direccion", icon: <IChart />, tip: "Dirección", sec: "direccion" },
  { to: "/catalogo", icon: <ICar />, tip: "Catálogo", sec: "catalogo" },
  { to: "/cotizaciones", icon: <IDoc />, tip: "Cotizaciones", sec: "cotizaciones" },
  { to: "/demo", icon: <IPlay />, tip: "Centro de demo", sec: "demo" },
  { to: "/integraciones", icon: <IPlug />, tip: "Integraciones", sec: "integraciones" },
];

export function ViewAs() {
  const { viewAs, setViewAs, vendedores } = useStore();
  const val = viewAs.role === "vendedor" ? `v:${viewAs.sellerId || vendedores[0]?.id}` : viewAs.role;
  return (
    <label className="pill" style={{ paddingRight: 8 }}>
      <span className="faint" style={{ fontWeight: 600 }}>Ver como</span>
      <select aria-label="Ver como" value={val} onChange={(e) => {
        const v = e.target.value;
        setViewAs(v.startsWith("v:") ? { role: "vendedor", sellerId: v.slice(2) } : { role: v });
      }} style={{ border: 0, background: "transparent", fontWeight: 700, outline: "none" }}>
        <option value="director">Dirección · Roberto Aldana</option>
        <option value="gerente">Gerente Jetour · Mónica Rivas</option>
        {vendedores.map((s) => <option key={s.id} value={`v:${s.id}`}>Asesor · {s.name}</option>)}
      </select>
    </label>
  );
}

export function BrandSwitch() {
  const { brands } = useStore();
  return (
    <div className="seg" role="group" aria-label="Marca">
      {brands.slice(0, 6).map((b) => (
        <button key={b.id} className={b.active ? "on" : ""} disabled={!b.active} title={b.active ? b.name : `${b.name} · próximamente`} style={!b.active ? { opacity: 0.45, cursor: "not-allowed" } : undefined}>
          {b.name}{!b.active && " 🔒"}
        </button>
      ))}
      <button disabled style={{ opacity: 0.45 }} title="Ferrari, Lotus, Maserati, Lynk & Co, AODES · próximamente">+5</button>
    </div>
  );
}

export function TopBar({ title, crumbs, children }) {
  return (
    <div className="top">
      <div className="title"><span className="crumbs">{crumbs || "Grupo Los Tres · Jetour"}</span><h1>{title}</h1></div>
      {children}
      <ViewAs />
    </div>
  );
}

export function Guard({ sec, children }) {
  const { viewAs } = useStore();
  if (can(viewAs.role, sec)) return children;
  return (
    <>
      <TopBar title="Sin acceso" crumbs="Permisos por rol" />
      <div className="card"><h2>Esta sección no está disponible para su rol</h2><p className="muted" style={{ margin: 0 }}>Cambie a un rol con acceso desde «Ver como», o vuelva al inicio.</p></div>
    </>
  );
}

export default function Shell() {
  const { ready, error, viewAs } = useStore();
  const loc = useLocation();
  return (
    <div className="shell">
      <nav className="side" aria-label="Navegación">
        <div className="logo"><img src={assetFile("glt_icon.png")} alt="Grupo Los Tres" /></div>
        {NAV.filter((n) => can(viewAs.role, n.sec)).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive || (n.to === "/pipeline" && loc.pathname.startsWith("/lead")) ? "active" : "")}>
            {n.icon}<span className="tip">{n.tip}</span>
          </NavLink>
        ))}
        <div className="spacer" />
      </nav>
      <main className="main">
        {error ? <div className="card"><h2>No se pudo conectar</h2><p className="muted">{error}</p></div> : ready ? <Outlet /> : <Loading text="Conectando con GLT Connect…" />}
      </main>
      <Toasts />
    </div>
  );
}

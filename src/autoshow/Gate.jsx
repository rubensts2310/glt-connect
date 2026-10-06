// Activación de la tablet y entrada con PIN
import { useEffect, useState } from "react";
import { api, useAS } from "./store";
import { assetFile } from "../lib/supabase";
import { initials } from "../lib/format";

export function Activate() {
  const { activate } = useAS();
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { await activate(code, label || "Tablet stand"); } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <div className="as-gate">
      <form className="as-gate-card" onSubmit={go}>
        <img src={assetFile("glt_icon.png")} alt="" style={{ width: 64 }} />
        <h1>GLT Connect · Autoshow</h1>
        <p className="as-muted">Active esta tablet con el código del evento que le dio su gerente. Solo se hace una vez.</p>
        <label className="as-field"><span>Código del evento</span>
          <input className="as-inp as-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" placeholder="XXXXXXXX" required />
        </label>
        <label className="as-field"><span>Nombre de esta tablet (opcional)</span>
          <input className="as-inp" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej. Tablet 1 · T2" />
        </label>
        {err && <div className="as-err">{err}</div>}
        <button className="as-btn as-primary as-lg" disabled={busy || code.length < 6}>{busy ? "Activando…" : "Activar tablet"}</button>
      </form>
    </div>
  );
}

export function Login() {
  const { device, login, signOut } = useAS();
  const [sellers, setSellers] = useState(() => { try { return JSON.parse(localStorage.getItem("as_sellers")) || []; } catch { return []; } });
  const [sel, setSel] = useState(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api("sellers", { device }).then((r) => { setSellers(r.sellers || []); try { localStorage.setItem("as_sellers", JSON.stringify(r.sellers || [])); } catch {} })
      .catch((e) => { if (e.status === 401) { setErr(e.message); setTimeout(() => signOut(false), 2500); } else if (e.status === 0) setErr("Sin conexión: necesita internet para ingresar la primera vez del día."); });
  }, [device, signOut]);
  const press = async (d) => {
    if (busy) return;
    const p = (pin + d).slice(0, 6); setPin(p); setErr("");
    if (p.length >= 4 && d === "ok") return;
  };
  const submit = async () => {
    if (pin.length < 4) return;
    setBusy(true);
    try { await login(sel.id, pin); } catch (e) { setErr(e.message); setPin(""); }
    setBusy(false);
  };
  if (!sel) return (
    <div className="as-gate">
      <div className="as-gate-card wide">
        <img src={assetFile("glt_icon.png")} alt="" style={{ width: 56 }} />
        <h1>¿Quién atiende?</h1>
        {err && <div className="as-err">{err}</div>}
        <div className="as-sellers">
          {sellers.map((s) => (
            <button key={s.id} className="as-seller" onClick={() => setSel(s)}>
              <span className="as-av">{initials(s.name)}</span><b>{s.name}</b>{s.role === "gerente" && <small>Gerencia</small>}
            </button>
          ))}
          {!sellers.length && !err && <p className="as-muted">Cargando asesores…</p>}
        </div>
      </div>
    </div>
  );
  return (
    <div className="as-gate">
      <div className="as-gate-card">
        <button className="as-link" onClick={() => { setSel(null); setPin(""); setErr(""); }}>← Cambiar asesor</button>
        <span className="as-av lg">{initials(sel.name)}</span>
        <h1 style={{ marginTop: 6 }}>{sel.name}</h1>
        <p className="as-muted">Ingrese su PIN</p>
        <div className="as-dots">{Array.from({ length: Math.max(4, pin.length) }).map((_, i) => <i key={i} className={i < pin.length ? "on" : ""} />)}</div>
        {err && <div className="as-err">{err}</div>}
        <div className="as-pad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"].map((k) => (
            <button key={k} className={`as-key ${k === "OK" ? "ok" : ""}`} disabled={busy || (k === "OK" && pin.length < 4)}
              onClick={() => (k === "⌫" ? setPin((p) => p.slice(0, -1)) : k === "OK" ? submit() : press(k))}>{k === "OK" ? (busy ? "…" : "Entrar") : k}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

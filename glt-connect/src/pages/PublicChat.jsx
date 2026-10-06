import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { assetFile, fn } from "../lib/supabase";
import { ISend } from "../components/icons";

const WA = { bg: "#efeae2", head: "#075e54", out: "#d9fdd3", in: "#ffffff" };

export default function PublicChat() {
  const { token } = useParams();
  const nav = useNavigate();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [seller, setSeller] = useState(null);
  const [err, setErr] = useState(null);
  const box = useRef(null);

  useEffect(() => {
    if (!token) {
      fn("bot", { action: "start" }).then((r) => nav(`/chat/${r.token}`, { replace: true })).catch((e) => setErr(e.message));
      return;
    }
    let alive = true;
    const poll = () => fn("bot", { action: "poll", token }).then((r) => { if (alive) { setMsgs(r.messages); setSeller(r.seller); } }).catch((e) => setErr(e.message));
    poll();
    const iv = setInterval(poll, 2500);
    return () => { alive = false; clearInterval(iv); };
  }, [token]);
  useEffect(() => { box.current && (box.current.scrollTop = box.current.scrollHeight); }, [msgs.length, typing]);

  const send = async (e) => {
    e.preventDefault();
    const t = text.trim(); if (!t || typing) return;
    setText("");
    setMsgs((m) => [...m, { sender: "cliente", body: t, created_at: new Date().toISOString(), tmp: true }]);
    setTyping(true);
    try { const r = await fn("bot", { action: "send", token, text: t }); setMsgs(r.messages); if (r.seller) setSeller(r.seller); }
    catch (e2) { setErr(e2.message); }
    setTyping(false);
  };

  return (
    <div style={{ height: "100%", display: "flex", justifyContent: "center", background: "#d1d7db" }}>
      <div style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", height: "100dvh", background: WA.bg }}>
        <header style={{ background: WA.head, color: "#fff", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", paddingTop: "calc(12px + env(safe-area-inset-top, 0px))" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center" }}><img src={assetFile("glt_icon.png")} alt="" style={{ width: 26 }} /></div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <b>Jetour Guatemala</b>
            <span style={{ fontSize: 12, opacity: 0.85 }}>{typing ? "escribiendo…" : seller ? `Atiende: ${seller}` : "Asistente virtual · en línea"}</span>
          </div>
        </header>
        <div ref={box} style={{ flex: 1, overflowY: "auto", padding: "14px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ alignSelf: "center", background: "#fff7c5", fontSize: 11.5, padding: "5px 10px", borderRadius: 8, color: "#54656f", textAlign: "center", maxWidth: 320 }}>
            Demo de GLT Connect. Los mensajes llegan en vivo al CRM de la sala.
          </div>
          {msgs.map((m, i) => {
            const mine = m.sender === "cliente";
            return (
              <div key={i} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%", background: mine ? WA.out : WA.in, padding: "7px 10px 5px", borderRadius: 10, boxShadow: "0 1px .5px rgba(0,0,0,.13)", fontSize: 14.5, whiteSpace: "pre-wrap" }}>
                {m.sender === "vendedor" && <div style={{ fontSize: 12, fontWeight: 700, color: "#06a88f" }}>Asesor Jetour</div>}
                {m.body}
                <div style={{ fontSize: 10.5, color: "#667781", textAlign: "right", marginTop: 2 }}>{new Date(m.created_at).toLocaleTimeString("es-GT", { hour: "numeric", minute: "2-digit" })}</div>
              </div>
            );
          })}
          {typing && <div style={{ alignSelf: "flex-start", background: WA.in, padding: "9px 14px", borderRadius: 10, color: "#667781" }}>• • •</div>}
          {err && <div style={{ alignSelf: "center", color: "#b3261e", fontSize: 12.5 }}>{err}</div>}
        </div>
        <form onSubmit={send} style={{ display: "flex", gap: 8, padding: 10, paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))", background: "#f0f2f5" }}>
          <input id="wa-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Escriba un mensaje" autoComplete="off"
            style={{ flex: 1, border: 0, borderRadius: 22, padding: "11px 16px", fontSize: 15, outline: "none" }} />
          <button type="submit" aria-label="Enviar" style={{ width: 44, height: 44, borderRadius: "50%", border: 0, background: "#00a884", color: "#fff", display: "grid", placeItems: "center" }}><ISend /></button>
        </form>
      </div>
    </div>
  );
}

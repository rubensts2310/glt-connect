// Registro express del cliente + cotización + envío (QR y WhatsApp)
import { useMemo, useState } from "react";
import { calcQuote, quoteLink, TEMPS, useAS, uuid, waLink } from "./store";
import { asset } from "../lib/supabase";
import { fmtQ } from "../lib/format";
import { QR } from "../components/bits";
import { bonusFor, colorPhoto, modelPhoto, priceTxt } from "./Stand";

const PAGOS = [["contado", "Contado"], ["credito", "Financiado"], ["no_sabe", "No sabe"]];
const PLAZOS = [["inmediato", "Este mes"], ["1-3m", "1–3 meses"], ["3-6m", "3–6 meses"], ["6m+", "Más adelante"]];

export default function Capture({ model, lead: existing, mode = "full", onClose, onOpenLead }) {
  const { data, me, saveLead, saveQuote, fx, online, logActivity } = useAS();
  const [step, setStep] = useState(existing ? "cotizar" : "cliente");
  const [c, setC] = useState(() => existing || { id: uuid(), name: "", phone: "", email: "", model_id: model?.id || "", temperature: "tibio", pago: null, plazo: null, parte_pago: null, parte_pago_desc: "", enganche_q: "", notes: "", consent: true });
  const [err, setErr] = useState("");
  const [quote, setQuote] = useState(null);
  const up = (k, v) => setC((x) => ({ ...x, [k]: v }));

  const saveClient = (andQuote) => {
    const phone = String(c.phone || "").replace(/\D/g, "");
    if (!c.name.trim()) return setErr("Escriba el nombre del cliente");
    if (phone.length < 8) return setErr("El WhatsApp debe tener 8 dígitos");
    if (!c.model_id) return setErr("Elija el modelo de interés");
    setErr("");
    const saved = saveLead({ ...c, name: c.name.trim(), phone, enganche_q: c.enganche_q ? Number(String(c.enganche_q).replace(/\D/g, "")) : null });
    setC(saved);
    if (andQuote) setStep("cotizar"); else setStep("listo");
  };

  return (
    <div className="as-sheet">
      <div className="as-sheet-head">
        <button className="as-btn as-ghost" onClick={onClose}>✕ Cerrar</button>
        <div className="as-steps">
          {!existing && <span className={step === "cliente" ? "on" : "done"}>1 · Cliente</span>}
          <span className={step === "cotizar" ? "on" : step === "compartir" ? "done" : ""}>{existing ? "1" : "2"} · Cotización</span>
          <span className={step === "compartir" ? "on" : ""}>{existing ? "2" : "3"} · Enviar</span>
        </div>
        <span className={`as-net ${online ? "" : "off"}`}>{online ? "En línea" : "Sin señal · se guarda en la tablet"}</span>
      </div>
      <div className="as-sheet-body single">
        {step === "cliente" && <ClientForm c={c} up={up} models={data.models} err={err} onSave={() => saveClient(false)} onQuote={() => saveClient(true)} />}
        {step === "cotizar" && <QuoteForm lead={c} initialModel={data.models.find((m) => m.id === (model?.id || c.model_id))} onBack={existing ? onClose : () => setStep("cliente")}
          onSave={(q) => { saveQuote(q); setQuote(q); setStep("compartir"); }} />}
        {step === "compartir" && quote && <Share lead={c} quote={quote} onNew={() => { onClose(); }} onOpenLead={() => onOpenLead?.(c.id)} logActivity={logActivity} me={me} />}
        {step === "listo" && (
          <div className="as-done">
            <div className="as-done-ic">✓</div>
            <h2>{c.name.split(" ")[0]} quedó registrado</h2>
            <p className="as-muted">Aparecerá en su cola de seguimiento {c.temperature === "caliente" ? "mañana" : c.temperature === "tibio" ? "en 2 días" : "en 4 días"} con un mensaje listo para enviar.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button className="as-btn as-ghost as-lg" onClick={() => setStep("cotizar")}>Cotizarle ahora</button>
              <button className="as-btn as-primary as-lg" onClick={onClose}>Siguiente cliente</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ClientForm({ c, up, models, err, onSave, onQuote }) {
  return (
    <div className="as-form">
      <div className="as-form-grid">
        <label className="as-field span2"><span>Nombre del cliente *</span><input className="as-inp" value={c.name} onChange={(e) => up("name", e.target.value)} autoFocus placeholder="Nombre y apellido" autoComplete="off" /></label>
        <label className="as-field"><span>WhatsApp *</span><input className="as-inp" value={c.phone} onChange={(e) => up("phone", e.target.value.replace(/[^\d ]/g, "").slice(0, 12))} inputMode="tel" placeholder="5555 5555" autoComplete="off" /></label>
        <label className="as-field"><span>Correo (opcional)</span><input className="as-inp" value={c.email || ""} onChange={(e) => up("email", e.target.value)} inputMode="email" autoComplete="off" /></label>
      </div>
      <div className="as-field"><span>¿Qué tan listo está?</span>
        <div className="as-temps">{Object.entries(TEMPS).map(([k, t]) => <button key={k} className={`as-temp ${t.cls} ${c.temperature === k ? "on" : ""}`} onClick={() => up("temperature", k)}><b>{t.emoji}</b><span>{t.label}</span></button>)}</div>
      </div>
      <div className="as-field"><span>Modelo de interés *</span>
        <div className="as-modelpick">{models.map((m) => <button key={m.id} className={c.model_id === m.id ? "on" : ""} onClick={() => up("model_id", m.id)}>{modelPhoto(m) && <img src={asset(modelPhoto(m).img)} alt="" />}<span>{m.name}</span></button>)}</div>
      </div>
      <div className="as-form-grid">
        <div className="as-field"><span>Forma de pago</span><div className="as-seg">{PAGOS.map(([k, l]) => <button key={k} className={c.pago === k ? "on" : ""} onClick={() => up("pago", c.pago === k ? null : k)}>{l}</button>)}</div></div>
        <div className="as-field"><span>¿Cuándo compraría?</span><div className="as-seg">{PLAZOS.map(([k, l]) => <button key={k} className={c.plazo === k ? "on" : ""} onClick={() => up("plazo", c.plazo === k ? null : k)}>{l}</button>)}</div></div>
        {c.pago === "credito" && <label className="as-field"><span>Enganche disponible (Q)</span><input className="as-inp" value={c.enganche_q || ""} onChange={(e) => up("enganche_q", e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="50000" /></label>}
        <div className="as-field"><span>¿Da un vehículo como parte de pago?</span>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="as-seg">{[[true, "Sí"], [false, "No"]].map(([k, l]) => <button key={l} className={c.parte_pago === k ? "on" : ""} onClick={() => up("parte_pago", c.parte_pago === k ? null : k)}>{l}</button>)}</div>
            {c.parte_pago && <input className="as-inp" style={{ flex: 1 }} value={c.parte_pago_desc || ""} onChange={(e) => up("parte_pago_desc", e.target.value)} placeholder="Marca, modelo, año" />}
          </div>
        </div>
        <label className="as-field span2"><span>Notas</span><input className="as-inp" value={c.notes || ""} onChange={(e) => up("notes", e.target.value)} placeholder="Ej. viene con su esposa, le gustó el color verde, quiere 7 asientos" /></label>
      </div>
      <label className="as-check"><input type="checkbox" checked={!!c.consent} onChange={(e) => up("consent", e.target.checked)} /> El cliente acepta que Jetour le contacte por WhatsApp sobre esta cotización.</label>
      {err && <div className="as-err">{err}</div>}
      <div className="as-actions">
        <button className="as-btn as-ghost as-lg" onClick={onSave}>Solo registrar</button>
        <button className="as-btn as-primary as-lg" onClick={onQuote}>Guardar y cotizar →</button>
      </div>
    </div>
  );
}

export function QuoteForm({ lead, initialModel, onBack, onSave }) {
  const { data, fx } = useAS();
  const ev = data.settings?.event || {};
  const banks = data.settings?.banks || [{ name: "Banco Industrial", rate: 9.5 }];
  const ACC = data.settings?.accessories || [];
  const [mid, setMid] = useState(initialModel?.id || data.models[0]?.id);
  const model = data.models.find((m) => m.id === mid);
  const colors = model?.colors || [];
  const [ci, setCi] = useState(0);
  const photo = colorPhoto(colors[ci]);
  const interiors = model?.interior_colors || [];
  const [ii, setIi] = useState(0);
  const [acc, setAcc] = useState([]);
  const [bonus, setBonus] = useState(() => bonusFor(data.settings, initialModel?.id || data.models[0]?.id));
  const [tradeOn, setTradeOn] = useState(!!lead.parte_pago);
  const [trade, setTrade] = useState({ desc: lead.parte_pago_desc || "", value: "" });
  const [eng, setEng] = useState(() => Number(lead.enganche_q) || 0);
  const [term, setTerm] = useState(60);
  const [bank, setBank] = useState(banks[0]?.name);
  const rate = banks.find((b) => b.name === bank)?.rate ?? 9.5;
  const accItems = ACC.filter((a) => acc.includes(a.id));
  const q = useMemo(() => calcQuote({ model, fx, bonus, accessories: accItems, trade: tradeOn ? Number(trade.value) || 0 : 0, enganche: eng, term, rate }), [model, fx, bonus, accItems, tradeOn, trade, eng, term, rate]);
  const contado = lead.pago === "contado";
  const setModel = (id) => { setMid(id); setCi(0); setIi(0); setBonus(bonusFor(data.settings, id)); };
  const valid = new Date(Date.now() + (Number(ev.validez_dias) || 15) * 864e5).toISOString().slice(0, 10);
  const save = () => onSave({
    id: uuid(), public_token: uuid(), lead_id: lead.id, model_id: model.id, color: colors[ci]?.name, color_img: photo?.img, interior: interiors[ii]?.name || null,
    price: model.price, currency: model.currency, bonus_label: bonus ? ev.bono_label || "Bono Autoshow" : null, bonus_amount: Number(bonus) || 0,
    accessories: accItems, trade_in: tradeOn && trade.desc ? { desc: trade.desc, value: Number(trade.value) || 0 } : null,
    enganche_q: contado ? q.total : q.eng, term_months: contado ? null : term, bank: contado ? null : bank, rate: contado ? null : rate,
    monthly: contado ? null : Math.round(q.monthly), total: Math.round(q.total), valid_until: valid,
  });
  if (!model) return null;
  return (
    <div className="as-quote">
      <div className="as-quote-left">
        <select className="as-inp" value={mid} onChange={(e) => setModel(e.target.value)} aria-label="Modelo">{data.models.map((m) => <option key={m.id} value={m.id}>{m.name} · {priceTxt(m)}</option>)}</select>
        <div className="as-photo">
          {photo ? <img className="as-quote-car" src={asset(photo.img)} alt={model.name} /> : <div className="as-nophoto">Foto próximamente</div>}
          {photo?.isRef && <span className="as-refnote">Foto referencial</span>}
        </div>
        <div className="as-field"><span>Color exterior</span>
          <div className="as-swatches">{colors.map((x, i) => <button key={x.name} className={`as-sw ${i === ci ? "on" : ""}`} style={{ background: x.hex }} onClick={() => setCi(i)} aria-label={x.name} />)}<span className="as-muted">{colors[ci]?.name}</span></div>
        </div>
        {interiors.length > 0 && <div className="as-field"><span>Color interior</span>
          <div className="as-swatches">{interiors.map((x, i) => <button key={x.name} className={`as-sw ${i === ii ? "on" : ""}`} style={{ background: x.hex }} onClick={() => setIi(i)} aria-label={x.name} />)}<span className="as-muted">{interiors[ii]?.name}</span></div>
        </div>}
        {ACC.length > 0 && <div className="as-field"><span>Accesorios</span><div className="as-accs">{ACC.map((a) => <button key={a.id} className={acc.includes(a.id) ? "on" : ""} onClick={() => setAcc((x) => (x.includes(a.id) ? x.filter((y) => y !== a.id) : [...x, a.id]))}>{a.name}<small>{fmtQ(a.price)}</small></button>)}</div></div>}
      </div>
      <div className="as-quote-right">
        <div className="as-form-grid">
          <label className="as-field"><span>{ev.bono_label || "Bono Autoshow"} (Q)</span><input className="as-inp" inputMode="numeric" value={bonus || ""} onChange={(e) => setBonus(Number(e.target.value.replace(/\D/g, "")) || 0)} placeholder="0" /></label>
          <div className="as-field"><span>Parte de pago</span>
            <div style={{ display: "flex", gap: 6 }}><div className="as-seg"><button className={tradeOn ? "on" : ""} onClick={() => setTradeOn(true)}>Sí</button><button className={!tradeOn ? "on" : ""} onClick={() => setTradeOn(false)}>No</button></div>
              {tradeOn && <input className="as-inp" style={{ width: 130 }} inputMode="numeric" value={trade.value} onChange={(e) => setTrade({ ...trade, value: e.target.value.replace(/\D/g, "") })} placeholder="Valor Q" />}</div>
            {tradeOn && <input className="as-inp" style={{ marginTop: 6 }} value={trade.desc} onChange={(e) => setTrade({ ...trade, desc: e.target.value })} placeholder="Marca, modelo, año" />}
          </div>
        </div>
        {!contado && (
          <>
            <div className="as-field"><span>Enganche · {fmtQ(q.eng)} ({q.pct}%)</span>
              <input type="range" className="as-range" min={0} max={Math.max(5000, Math.round((q.total * 0.7) / 5000) * 5000)} step={5000} value={Math.min(eng, q.total)} onChange={(e) => setEng(Number(e.target.value))} />
            </div>
            <div className="as-form-grid">
              <div className="as-field"><span>Plazo</span><div className="as-seg">{[24, 36, 48, 60, 72].map((t) => <button key={t} className={term === t ? "on" : ""} onClick={() => setTerm(t)}>{t}m</button>)}</div></div>
              <label className="as-field"><span>Banco</span><select className="as-inp" value={bank} onChange={(e) => setBank(e.target.value)}>{banks.map((b) => <option key={b.name} value={b.name}>{b.name} · {b.rate}%</option>)}</select></label>
            </div>
          </>
        )}
        <div className="as-total">
          <div className="as-total-rows">
            <div><span>Precio{model.currency === "USD" ? ` (${priceTxt(model)})` : ""}</span><b>{fmtQ(q.base)}</b></div>
            {q.acc > 0 && <div><span>Accesorios</span><b>+ {fmtQ(q.acc)}</b></div>}
            {bonus > 0 && <div className="good"><span>{ev.bono_label || "Bono Autoshow"}</span><b>− {fmtQ(bonus)}</b></div>}
            {tradeOn && Number(trade.value) > 0 && <div className="good"><span>Parte de pago</span><b>− {fmtQ(trade.value)}</b></div>}
          </div>
          <div className="as-total-big"><div><span>Total</span><b>{fmtQ(q.total)}</b></div>{!contado && <div><span>Cuota estimada</span><b>{fmtQ(q.monthly)}<small>/mes</small></b></div>}</div>
          {!contado && <span className="as-fine">Enganche {fmtQ(q.eng)} · {term} meses · {bank} {rate}% anual · cálculo referencial sujeto a aprobación del banco.</span>}
        </div>
        <div className="as-actions">
          <button className="as-btn as-ghost as-lg" onClick={onBack}>← Atrás</button>
          <button className="as-btn as-primary as-lg" onClick={save}>Generar cotización</button>
        </div>
      </div>
    </div>
  );
}

function Share({ lead, quote, onNew, onOpenLead, logActivity, me }) {
  const { data, online } = useAS();
  const link = quoteLink(quote.public_token);
  const m = data.models.find((x) => x.id === quote.model_id);
  const first = (lead.name || "").split(" ")[0];
  const text = `¡Hola ${first}! Soy ${me?.name || "su asesor"}, su asesor de Jetour 👋 Aquí está su cotización de la ${m?.name} ${quote.color || ""} con el ${data.settings?.event?.bono_label || "bono del autoshow"}: ${link}

Cualquier duda, le atiendo por aquí.`;
  const wa = waLink(lead.phone, text);
  const [sent, setSent] = useState(false);
  return (
    <div className="as-share">
      <div className="as-share-qr">
        <QR text={link} size={300} />
        <b>Escanee con la cámara de su celular</b>
        <span className="as-muted">La cotización se abre con videos, interior 360° y simulador de cuota.</span>
        {!online && <div className="as-warn">Sin señal: la cotización se sube apenas la tablet se conecte. El QR ya es definitivo.</div>}
      </div>
      <div className="as-share-side">
        <h2>Cotización lista para {first}</h2>
        <p className="as-muted">{m?.name} · {quote.color}{quote.interior ? ` · interior ${quote.interior}` : ""} · Total {fmtQ(quote.total)}{quote.monthly ? ` · cuota ${fmtQ(quote.monthly)}/mes` : ""}</p>
        {wa && <a className="as-btn as-wa as-lg" href={wa} target="_blank" rel="noreferrer" onClick={() => { if (!sent) { logActivity(lead.id, "whatsapp_stand", "Cotización enviada por WhatsApp desde el stand"); setSent(true); } }}>Enviar por WhatsApp a {lead.phone}</a>}
        <button className="as-btn as-ghost as-lg" onClick={() => navigator.clipboard?.writeText(link)}>Copiar enlace</button>
        <button className="as-btn as-ghost as-lg" onClick={onOpenLead}>Ver ficha del cliente</button>
        <button className="as-btn as-primary as-lg" onClick={onNew}>Siguiente cliente</button>
      </div>
    </div>
  );
}

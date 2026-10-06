import { createPortal } from "react-dom";
import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { asset, sb } from "../lib/supabase";
import { FX, cuota, fmtQ, priceMain, priceSub, toGTQ } from "../lib/format";
import { QR } from "../components/bits";

export const ACCESSORIES = [
  { id: "polarizado", name: "Polarizado de seguridad", price: 1800 },
  { id: "alfombras", name: "Alfombras 3D a medida", price: 950 },
  { id: "baul", name: "Protector de baúl", price: 900 },
  { id: "barras", name: "Barras de techo", price: 2400 },
  { id: "camara", name: "Cámara de tablero", price: 1500 },
  { id: "ceramico", name: "Tratamiento cerámico", price: 3200 },
];

export default function QuoteBuilder({ lead, seller, onClose }) {
  const { models, settings, updateLead, toast } = useStore();
  const [modelId, setModelId] = useState(lead.model_id || models[0]?.id);
  const model = models.find((m) => m.id === modelId);
  const colors = (model?.colors || []).filter((c) => c.img);
  const [colorIdx, setColorIdx] = useState(0);
  const color = colors[colorIdx] || colors[0];
  const [acc, setAcc] = useState([]);
  const [bonus, setBonus] = useState(model?.currency === "USD" ? 5000 : 5000);
  const [bank, setBank] = useState("Banco Industrial");
  const [down, setDown] = useState(Number(lead.qualification?.enganche_pct) || 20);
  const [engMode, setEngMode] = useState(lead.qualification?.enganche_monto ? "monto" : "pct");
  const [engMonto, setEngMonto] = useState(Number(lead.qualification?.enganche_monto) || 50000);
  const [term, setTerm] = useState(60);
  const [trade, setTrade] = useState(lead.qualification?.parte_pago === "si" ? { desc: "", value: 0 } : null);
  const [days, setDays] = useState(10);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const banks = settings.banks || [];
  const rate = banks.find((b) => b.name === bank)?.rate ?? 9.5;

  const calc = useMemo(() => {
    if (!model) return {};
    const base = toGTQ(Number(model.price), model.currency);
    const accT = ACCESSORIES.filter((a) => acc.includes(a.id)).reduce((a, x) => a + x.price, 0);
    const total = base + accT - Number(bonus || 0) - Number(trade?.value || 0);
    const eng = engMode === "monto" ? Math.min(engMonto, total) : (total * down) / 100;
    const pct = total ? Math.round((eng / total) * 100) : 0;
    return { base, accT, total, eng, pct, fin: total - eng, cuota: cuota(total - eng, rate, term) };
  }, [model, acc, bonus, trade, down, rate, term, engMode, engMonto]);

  const save = async () => {
    setBusy(true);
    const valid = new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
    const { data, error } = await sb.from("quotes").insert({
      lead_id: lead.id, seller_id: seller?.id || lead.seller_id, model_id: model.id, color: color?.name, color_img: color?.img,
      accessories: ACCESSORIES.filter((a) => acc.includes(a.id)), price: model.price, currency: model.currency,
      bonus_label: bonus ? "Bono de temporada" : null, bonus_amount: bonus || 0, down_payment_pct: calc.pct, term_months: term, bank, rate,
      trade_in: trade && trade.value ? trade : null, valid_until: valid, status: "enviada", sent_at: new Date().toISOString(),
    }).select().single();
    if (error) { toast({ title: "No se guardó", body: error.message, kind: "hot" }); setBusy(false); return; }
    const link = `${window.location.origin}/c/${data.public_token}`;
    await sb.from("messages").insert({ lead_id: lead.id, sender: "vendedor", body: `Le comparto su cotización de la ${model.name} ${color?.name ?? ""}: ${link}`, meta: { seller: seller?.name } });
    const order = ["nuevo", "contactado", "calificado", "cotizado"];
    const patch = { model_id: model.id, last_activity_at: new Date().toISOString(), bot_active: false, next_followup_at: new Date(Date.now() + 24 * 3600e3).toISOString(), followup_step: 0 };
    if (order.includes(lead.stage)) patch.stage = "cotizado";
    if (!lead.first_response_at) patch.first_response_at = new Date().toISOString();
    await updateLead(lead.id, patch, { type: "cotizacion", detail: `Cotización enviada: ${model.name} ${color?.name ?? ""} · ${fmtQ(calc.total)}` });
    setSaved({ ...data, link }); setBusy(false);
  };

  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="card-head"><h1 style={{ fontSize: 22 }}>{saved ? "Cotización enviada" : `Cotizar para ${lead.name || "prospecto"}`}</h1><button className="btn ghost sm" onClick={onClose}>Cerrar</button></div>
        {saved ? (
          <div className="card" style={{ alignItems: "center", textAlign: "center" }}>
            <p className="muted" style={{ margin: 0 }}>El cliente recibe este enlace por WhatsApp. Escanéelo para abrirlo en su celular:</p>
            <QR text={saved.link} size={220} />
            <code className="mono" style={{ userSelect: "all", wordBreak: "break-all", background: "var(--card2)", padding: "8px 12px", borderRadius: 10 }}>{saved.link}</code>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn ghost" onClick={() => { navigator.clipboard?.writeText(saved.link).then(() => toast({ title: "Enlace copiado" }), () => {}); }}>Copiar enlace</button>
              <a className="btn" href={saved.link} target="_blank" rel="noreferrer">Abrir como cliente</a>
            </div>
          </div>
        ) : (
          <>
            <div className="card">
              <span className="label">Modelo</span>
              <select className="sel" value={modelId} onChange={(e) => { setModelId(e.target.value); setColorIdx(0); }}>
                {models.map((m) => <option key={m.id} value={m.id}>{m.name} · {priceMain(m)}{m.price_from ? " (desde)" : ""}</option>)}
              </select>
              {color && <img className="car-img" src={asset(color.img)} alt={`${model.name} ${color.name}`} />}
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                {colors.map((c, i) => <button key={c.name} className={`swatch ${i === colorIdx ? "on" : ""}`} style={{ background: c.hex }} title={c.name} aria-label={c.name} onClick={() => setColorIdx(i)} />)}
                <span className="muted">{color?.name}</span>
              </div>
            </div>
            <div className="card">
              <span className="label">Accesorios</span>
              <div className="grid g2" style={{ gap: 8 }}>
                {ACCESSORIES.map((a) => (
                  <label key={a.id} className="pill" style={{ justifyContent: "space-between", cursor: "pointer", background: acc.includes(a.id) ? "var(--blue-soft)" : undefined }}>
                    <span><input type="checkbox" checked={acc.includes(a.id)} onChange={() => setAcc((x) => (x.includes(a.id) ? x.filter((y) => y !== a.id) : [...x, a.id]))} style={{ marginRight: 8 }} />{a.name}</span>
                    <span className="num faint">{fmtQ(a.price)}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="grid g2">
                <label className="field"><span>Bono vigente (Q)</span><input className="inp num" type="number" value={bonus} onChange={(e) => setBonus(Number(e.target.value))} /></label>
                <label className="field"><span>Vigencia de la oferta (días)</span><input className="inp num" type="number" value={days} min={1} onChange={(e) => setDays(Number(e.target.value))} /></label>
                <label className="field"><span>Banco</span><select className="sel" value={bank} onChange={(e) => setBank(e.target.value)}>{banks.map((b) => <option key={b.name}>{b.name}</option>)}</select></label>
                <div className="field"><span>Enganche</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <div className="seg" role="group" aria-label="Tipo de enganche"><button className={engMode === "monto" ? "on" : ""} onClick={() => setEngMode("monto")}>Q</button><button className={engMode === "pct" ? "on" : ""} onClick={() => setEngMode("pct")}>%</button></div>
                    {engMode === "monto"
                      ? <input className="inp num" type="number" step={5000} value={engMonto} onChange={(e) => setEngMonto(Number(e.target.value))} aria-label="Enganche en quetzales" />
                      : <input className="inp" type="range" min={10} max={60} step={5} value={down} onChange={(e) => setDown(Number(e.target.value))} aria-label="Enganche en porcentaje" />}
                  </div>
                  <span className="faint" style={{ fontSize: 12 }}>{fmtQ(calc.eng || 0)} · {calc.pct}% del total</span>
                </div>
                <label className="field"><span>Plazo</span><select className="sel" value={term} onChange={(e) => setTerm(Number(e.target.value))}>{[24, 36, 48, 60, 72].map((t) => <option key={t} value={t}>{t} meses</option>)}</select></label>
                <label className="field"><span>Vehículo como parte de pago</span>
                  {trade ? <div style={{ display: "flex", gap: 6 }}><input className="inp" placeholder="Marca, modelo, año" value={trade.desc} onChange={(e) => setTrade({ ...trade, desc: e.target.value })} /><input className="inp num" style={{ width: 120 }} type="number" placeholder="Valor Q" value={trade.value || ""} onChange={(e) => setTrade({ ...trade, value: Number(e.target.value) })} /></div>
                    : <button className="btn ghost sm" onClick={() => setTrade({ desc: "", value: 0 })}>Agregar vehículo</button>}
                </label>
              </div>
            </div>
            <div className="card kpi dark" style={{ gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div><span className="label">Total a pagar</span><div className="v">{fmtQ(calc.total)}</div>{priceSub(model || {}) && <span className="d">Precio base {priceMain(model)} · TC {FX}</span>}</div>
                <div style={{ textAlign: "right" }}><span className="label">Cuota estimada</span><div className="v">{fmtQ(calc.cuota)}<span style={{ fontSize: 14 }}>/mes</span></div><span className="d">Enganche {fmtQ(calc.eng)} ({calc.pct}%) · {term} meses · {rate}% {bank}</span></div>
              </div>
              <button className="btn blue" onClick={save} disabled={busy || !model}>{busy ? "Enviando…" : "Enviar cotización por WhatsApp"}</button>
            </div>
          </>
        )}
      </div>
    </div>, document.body
  );
}

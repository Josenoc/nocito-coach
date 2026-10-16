"use client";

import { useEffect, useRef, useState } from "react";
import type { FoodItem, MealSlot, NutritionPlan } from "@/lib/app-types";

const SLOT_ORDER: MealSlot[] = ["desayuno", "almuerzo", "merienda", "cena", "extra"];

const SLOT_LABELS: Record<MealSlot, string> = {
  desayuno: "Desayuno",
  almuerzo: "Almuerzo",
  merienda: "Merienda",
  cena: "Cena",
  extra: "Extras / antojos",
};

type Totals = { cal: number; prot: number; carbs: number; fat: number };

function sumTotals(items: FoodItem[]): Totals {
  return items.reduce(
    (a, it) => ({
      cal: a.cal + (it.cal || 0),
      prot: a.prot + (it.prot || 0),
      carbs: a.carbs + (it.carbs || 0),
      fat: a.fat + (it.fat || 0),
    }),
    { cal: 0, prot: 0, carbs: 0, fat: 0 }
  );
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function MacroRow({
  label,
  value,
  target,
  unit,
}: {
  label: string;
  value: number;
  target?: number | null;
  unit: string;
}) {
  const t = target && target > 0 ? target : 0;
  const pct = t > 0 ? Math.min(100, Math.round((value / t) * 100)) : 0;
  const over = target && target > 0 && value > target;
  return (
    <div className="macro-row">
      <div className="macro-row-top">
        <span className="macro-label">{label}</span>
        <span className={`macro-val ${over ? "over" : ""}`}>
          <b>{value}</b>
          {target ? ` / ${target}` : ""} {unit}
        </span>
      </div>
      <div className="macro-bar">
        <span className={target && value > target ? "over" : ""} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function NutritionTracker({ nutrition }: { nutrition: NutritionPlan | null }) {
  const [date, setDate] = useState<string>(todayStr());
  const [items, setItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"manual" | "voice" | null>(null);
  const [rec, setRec] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const wantStop = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/app/food?date=${date}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j.ok) setItems(j.items ?? []);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [date]);

  const totals = sumTotals(items);
  const target: Totals | null = nutrition
    ? { cal: nutrition.cal, prot: nutrition.prot, carbs: nutrition.carbs, fat: nutrition.fat }
    : null;

  const persist = async (newItems: unknown[], source: "manual" | "voice") => {
    const res = await fetch("/api/app/food", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, items: newItems, source }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "No se pudo guardar");
    setItems(json.items ?? []);
  };

  const addManual = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy("manual");
    setMsg(null);
    try {
      const res = await fetch("/api/app/food-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Error");
      await persist(json.items, "manual");
      setText("");
      setMsg({ type: "ok", text: "Alimentos agregados al registro de hoy." });
    } catch (err: any) {
      setMsg({ type: "err", text: err?.message || "No se pudo calcular." });
    } finally {
      setBusy(null);
    }
  };

  const processVoice = async (blob: Blob) => {
    setBusy("voice");
    setMsg({ type: "ok", text: "Transcribiendo y calculando macros…" });
    try {
      const fd = new FormData();
      fd.append("audio", blob, "comida.webm");
      const res = await fetch("/api/app/food-voice", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "No se pudo procesar el audio");
      if (!json.items?.length) {
        setMsg({ type: "err", text: json.warning || "No se reconocieron alimentos." });
        return;
      }
      await persist(json.items, "voice");
      setMsg({
        type: "ok",
        text: `Listo: ${json.items.length} alimento${json.items.length === 1 ? "" : "s"} cargado${
          json.items.length === 1 ? "" : "s"
        } por voz.`,
      });
    } catch (err: any) {
      setMsg({ type: "err", text: err?.message || "No se pudo procesar el audio." });
    } finally {
      setBusy(null);
    }
  };

  const startRec = async () => {
    if (rec || busy) return;
    setMsg(null);
    wantStop.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      const startedAt = Date.now();
      mr.ondataavailable = (ev) => ev.data.size > 0 && chunks.push(ev.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRec(false);
        if (Date.now() - startedAt < 700 || chunks.length === 0) {
          setMsg({ type: "err", text: "Grabación muy corta. Mantené apretado mientras hablás." });
          return;
        }
        await processVoice(new Blob(chunks, { type: "audio/webm" }));
      };
      mediaRef.current = mr;
      mr.start();
      setRec(true);
      if (wantStop.current && mr.state !== "inactive") mr.stop();
    } catch {
      setMsg({ type: "err", text: "No se pudo acceder al micrófono." });
    }
  };

  const stopRec = () => {
    wantStop.current = true;
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stop();
    }
    setRec(false);
  };

  const removeFood = async (id: string) => {
    try {
      const res = await fetch(`/api/app/food?date=${date}&id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) setItems(json.items ?? []);
    } catch {
      /* ignore */
    }
  };

  const grouped = SLOT_ORDER.map((slot) => ({
    slot,
    list: items.filter((it) => it.slot === slot),
  })).filter((g) => g.list.length > 0);

  return (
    <div className="nutri-wrap">
      <div className="row-between" style={{ marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: "1.3rem" }}>Nutrición</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="date"
            className="input"
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value || todayStr())}
            style={{ width: "auto", padding: "8px 10px" }}
          />
          {date !== todayStr() && (
            <button className="btn btn-outline" onClick={() => setDate(todayStr())}>
              Hoy
            </button>
          )}
        </div>
      </div>

      {target && (
        <div className="card" style={{ marginTop: 0 }}>
          <div className="row-between" style={{ marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <h3 style={{ margin: 0 }}>Tus objetivos del día</h3>
            <span className="badge">{target.cal} kcal</span>
          </div>
          <div className="macro-list">
            <MacroRow label="Calorías" value={totals.cal} target={target.cal} unit="kcal" />
            <MacroRow label="Proteínas" value={totals.prot} target={target.prot} unit="g" />
            <MacroRow label="Carbohidratos" value={totals.carbs} target={target.carbs} unit="g" />
            <MacroRow label="Grasas" value={totals.fat} target={target.fat} unit="g" />
          </div>
          <p className="muted" style={{ margin: "12px 0 0", fontSize: ".85rem" }}>
            El total compara lo que registrás por fuera del plan contra tus objetivos diarios.
          </p>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Registrar lo que comí fuera del plan</h3>

        <div className="food-input-row">
          <input
            className="input"
            type="text"
            placeholder="Ej: una milanesa con ensalada y un alfajor"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addManual()}
            disabled={busy !== null}
          />
          <button
            className="btn btn-primary"
            onClick={addManual}
            disabled={busy !== null || !text.trim()}
          >
            {busy === "manual" ? "Calculando…" : "Calcular y añadir"}
          </button>
        </div>

        <div className="food-voice">
          <button
            className={`mic-btn ${rec ? "rec" : ""}`}
            disabled={busy !== null}
            onPointerDown={(e) => {
              e.preventDefault();
              startRec();
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              stopRec();
            }}
            onPointerLeave={() => rec && stopRec()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <MicIcon />
            {busy === "voice"
              ? "Procesando…"
              : rec
              ? "Soltá para enviar"
              : "Mantené apretado para dictar por voz"}
          </button>
          <p className="muted" style={{ fontSize: ".9rem", marginTop: 8 }}>
            Describí lo que comiste, por ejemplo «me comí una milanesa con ensalada y un alfajor a la tarde».
          </p>
        </div>

        {msg && <div className={`toast ${msg.type}`} style={{ marginTop: 12 }}>{msg.text}</div>}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Registro del día</h3>
        {loading && <p className="muted">Cargando…</p>}
        {!loading && grouped.length === 0 && (
          <p className="muted" style={{ marginBottom: 0 }}>
            Todavía no registraste comidas fuera del plan.
          </p>
        )}
        {grouped.map((g) => (
          <div key={g.slot} className="food-slot">
            <div className="food-slot-head">
              <span>{SLOT_LABELS[g.slot]}</span>
              <span className="muted" style={{ fontSize: ".82rem" }}>
                {g.list.reduce((s, it) => s + (it.cal || 0), 0)} kcal
              </span>
            </div>
            {g.list.map((it) => (
              <div key={it.id} className="food-item">
                <div className="food-item-main">
                  <strong>{it.name}</strong>
                  {it.quantity && <span className="food-qty">{it.quantity}</span>}
                  <span className={`food-src ${it.source}`}>
                    {it.source === "voice" ? "voz" : "texto"}
                  </span>
                </div>
                <div className="food-item-macros">
                  <span>{it.cal} kcal</span>
                  <span>P {it.prot}</span>
                  <span>C {it.carbs}</span>
                  <span>G {it.fat}</span>
                  <button
                    className="food-remove"
                    onClick={() => removeFood(it.id)}
                    aria-label="Eliminar"
                    title="Eliminar"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {nutrition && (nutrition.proteinSources || nutrition.meals?.length > 0) && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Tu plan nutricional</h3>
          {nutrition.proteinSources && (
            <p className="muted" style={{ marginTop: 0 }}>
              Fuentes de proteína sugeridas: {nutrition.proteinSources}
            </p>
          )}
          {nutrition.meals?.length > 0 && (
            <div className="scroll-x">
              <table className="data-table" style={{ minWidth: 480 }}>
                <thead>
                  <tr>
                    <th>Comida</th>
                    <th>Sugerencia</th>
                  </tr>
                </thead>
                <tbody>
                  {nutrition.meals.map((m, i) => (
                    <tr key={i}>
                      <td>
                        <b>{m[0]}</b>
                      </td>
                      <td>{m[1]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

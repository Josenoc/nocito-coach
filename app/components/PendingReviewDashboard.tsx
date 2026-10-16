"use client";

import { useRef, useState } from "react";
import type { Anamnesis, PhotoSlot } from "@/lib/app-types";
import { COACH_EMAIL, COACH_TEL, coachWhatsApp } from "@/app/lib/coach";

const GOAL_LABELS: Record<string, string> = {
  hipertrofia: "Hipertrofia",
  "perdida-grasa": "Pérdida de grasa",
  fuerza: "Fuerza",
  "rendimiento-deportivo": "Rendimiento deportivo",
};
const NUTRITION_LABELS: Record<string, string> = {
  omnivoro: "Omnívoro",
  vegetariano: "Vegetariano",
  carnivoro: "Carnívoro",
  vegano: "Vegano",
};
const PLACE_LABELS: Record<string, string> = {
  gimnasio: "Gimnasio",
  casa: "Casa",
  "aire-libre": "Aire libre",
};
const EXP_LABELS: Record<string, string> = {
  principiante: "Principiante",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
};

const DIAS = [3, 4, 5];
const SEXOS = ["Masculino", "Femenino", "Otro"];
const GOALS: [string, string][] = Object.entries(GOAL_LABELS);
const NUTRIS: [string, string][] = Object.entries(NUTRITION_LABELS);
const PLACES: [string, string][] = Object.entries(PLACE_LABELS);
const EXPS: [string, string][] = Object.entries(EXP_LABELS);

function bmiInfo(weight?: number, height?: number) {
  if (!weight || !height) return null;
  const m = height / 100;
  const value = weight / (m * m);
  let label = "Normal";
  if (value < 18.5) label = "Bajo";
  else if (value >= 30) label = "Obesidad";
  else if (value >= 25) label = "Sobrepeso";
  return { value: value.toFixed(1), label };
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Metric({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="metric">
      <span className="metric-k">{k}</span>
      <span className="metric-v">{v}</span>
      {sub && <span className="metric-sub">{sub}</span>}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="pref-row">
      <span className="metric-k">{k}</span>
      <span className="pref-v">{v}</span>
    </div>
  );
}

export default function PendingReviewDashboard({
  profile,
  anamnesis,
  onRefresh,
}: {
  profile: { full_name?: string; email: string };
  anamnesis: Anamnesis | null;
  onRefresh: () => Promise<void> | void;
}) {
  const a = anamnesis ?? ({} as Anamnesis);
  const displayName = profile.full_name || profile.email.split("@")[0];

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [restrictions, setRestrictions] = useState(a.food_restrictions ?? "");
  const [uploading, setUploading] = useState<PhotoSlot | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const bmi = bmiInfo(Number(a.weight_kg), Number(a.height_cm));
  const days = Number(a.training_days) || 0;

  const openEdit = () => {
    setError(null);
    setOkMsg(null);
    setForm({
      sex: a.sex ?? "Masculino",
      age: a.age ? String(a.age) : "",
      height_cm: a.height_cm ? String(a.height_cm) : "",
      weight_kg: a.weight_kg ? String(a.weight_kg) : "",
      goal: a.goal ?? "hipertrofia",
      training_days: String(a.training_days ?? 4),
      training_place: (a.training_place as string) ?? "gimnasio",
      experience: (a.experience as string) ?? "intermedio",
      nutrition: a.nutrition ?? "omnivoro",
      injuries: a.injuries ?? "",
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/app/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setEditing(false);
      setOkMsg("Datos actualizados. José ya fue avisado.");
      await onRefresh();
    } catch (err: any) {
      setError(err.message || "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const saveRestrictions = async () => {
    setError(null);
    setOkMsg(null);
    setSaving(true);
    try {
      const res = await fetch("/api/app/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ food_restrictions: restrictions }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setOkMsg("Preferencias guardadas.");
      await onRefresh();
    } catch (err: any) {
      setError(err.message || "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const onPickPhoto = (slot: PhotoSlot, file?: File | null) => {
    if (!file) return;
    setError(null);
    setOkMsg(null);
    setUploading(slot);
    const fd = new FormData();
    fd.append("slot", slot);
    fd.append("photo", file);
    fetch("/api/app/photos", { method: "POST", body: fd })
      .then((r) => r.json())
      .then(async (json) => {
        if (!json.ok) throw new Error(json.error);
        setOkMsg("Foto actualizada. José la va a ver.");
        await onRefresh();
      })
      .catch((err: any) => setError(err.message || "No se pudo subir la foto."))
      .finally(() => setUploading(null));
  };

  const contact = (subject: string) =>
    `mailto:${COACH_EMAIL}?subject=${encodeURIComponent(subject)}`;

  const steps = [
    { label: "Cuenta creada", state: "done" as const },
    { label: "Pago confirmado", state: "done" as const },
    { label: "En revisión del coach", state: "active" as const },
    { label: "Plan activo", state: "todo" as const },
  ];

  return (
    <>
      <div className="dash-hero">
        <div>
          <span className="dash-eyebrow">Plan personalizado</span>
          <h1 style={{ margin: "6px 0 10px" }}>Hola, {displayName}</h1>
          <div className="dash-badges">
            {days > 0 && <span className="badge">Plan {days} días</span>}
            {a.training_place && (
              <span className="badge">{PLACE_LABELS[a.training_place as string] ?? a.training_place}</span>
            )}
            {a.experience && (
              <span className="badge">{EXP_LABELS[a.experience as string] ?? a.experience}</span>
            )}
          </div>
        </div>
        <a
          className="btn btn-primary"
          href={coachWhatsApp("Hola José, soy alumno de Nocito Coach.")}
          target="_blank"
          rel="noreferrer"
        >
          Escribirle a José
        </a>
      </div>

      <div className="card notice-review dash-notice">
        <span className="notice-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </span>
        <h3>José Nocito está armando tu plan</h3>
        <p className="muted">
          Tus datos ya están en la mesa de trabajo de José. En breve tu programa personalizado estará
          activo — normalmente en menos de 48 horas.
        </p>
      </div>

      <div className="timeline">
        {steps.map((s, i) => (
          <div key={s.label} className={`timeline-step ${s.state}`}>
            <span className="timeline-dot">{s.state === "done" ? <IconCheck /> : i + 1}</span>
            <span className="timeline-text">{s.label}</span>
          </div>
        ))}
      </div>

      {error && <div className="toast err">{error}</div>}
      {okMsg && <div className="toast ok">{okMsg}</div>}

      <div className="dash-grid">
        <div className="card">
          <div className="row-between" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: "1rem" }}>Mis datos</h3>
            <button className="btn btn-outline" style={{ padding: "7px 13px", fontSize: ".85rem" }} onClick={openEdit}>
              Editar
            </button>
          </div>
          <div className="metric-grid">
            <Metric k="Altura" v={a.height_cm ? `${a.height_cm} cm` : "—"} />
            <Metric k="Peso" v={a.weight_kg ? `${a.weight_kg} kg` : "—"} />
            <Metric k="IMC" v={bmi ? bmi.value : "—"} sub={bmi?.label} />
            <Metric k="Edad" v={a.age ? `${a.age} años` : "—"} />
          </div>
          <p className="muted" style={{ margin: "12px 0 0", fontSize: ".85rem" }}>
            Si cambiás algo, José lo ve antes de cerrar tu plan.
          </p>
        </div>

        <div className="card">
          <div className="row-between" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: "1rem" }}>Objetivo y preferencias</h3>
            <button className="btn btn-outline" style={{ padding: "7px 13px", fontSize: ".85rem" }} onClick={openEdit}>
              Editar
            </button>
          </div>
          <div className="pref-list">
            <Row k="Objetivo" v={GOAL_LABELS[a.goal] ?? a.goal ?? "—"} />
            <Row k="Dieta" v={NUTRITION_LABELS[a.nutrition] ?? a.nutrition ?? "—"} />
            <Row k="Días / semana" v={a.training_days ? `${a.training_days} días` : "—"} />
            <Row k="Lugar" v={PLACE_LABELS[a.training_place as string] ?? (a.training_place as string) ?? "—"} />
            <Row k="Experiencia" v={EXP_LABELS[a.experience as string] ?? (a.experience as string) ?? "—"} />
          </div>
        </div>

        <div className="card coach-card">
          <div className="coach-avatar">JN</div>
          <h3 style={{ margin: "10px 0 2px", fontSize: "1.05rem" }}>José Nocito</h3>
          <span className="coach-role">Entrenador · Nutrición deportiva</span>
          <p className="muted" style={{ fontSize: ".9rem", lineHeight: 1.55 }}>
            Entrenador personal y coach de composición corporal. Diseña tu plan a medida según tu
            objetivo, tu experiencia y tu disponibilidad.
          </p>
          <div className="coach-actions">
            <a
              className="btn btn-primary"
              href={coachWhatsApp("Hola José, soy alumno de Nocito Coach.")}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
            <a className="btn btn-outline" href={COACH_TEL}>
              Llamar
            </a>
            <a className="btn btn-outline" href={contact("Consulta antes de arrancar")}>
              Email
            </a>
          </div>
        </div>
      </div>

      <section className="waiting-module">
        <div className="waiting-head">
          <h2 style={{ margin: 0 }}>Mientras esperás</h2>
          <p className="muted" style={{ margin: 0 }}>
            Sumá estos detalles para que tu plan salga perfecto desde el primer día.
          </p>
        </div>

        <div className="waiting-grid">
          <div className="card">
            <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Fotos iniciales</h3>
            <p className="muted" style={{ marginTop: 0, fontSize: ".88rem" }}>
              Frente, perfil y espalda. Nos sirven como punto de partida.
            </p>
            <div className="photo-slots">
              {(["front", "side", "back"] as PhotoSlot[]).map((slot) => {
                const url = a.photos?.[slot];
                const label = slot === "front" ? "Frente" : slot === "side" ? "Perfil" : "Espalda";
                return (
                  <div className="photo-slot" key={slot}>
                    <div className="photo-frame">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={`Foto ${label}`} />
                      ) : (
                        <span>{label}</span>
                      )}
                    </div>
                    <input
                      ref={(el) => {
                        fileRefs.current[slot] = el;
                      }}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onPickPhoto(slot, file);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ padding: "7px 12px", fontSize: ".8rem" }}
                      disabled={uploading === slot}
                      onClick={() => fileRefs.current[slot]?.click()}
                    >
                      {uploading === slot ? "Subiendo…" : url ? "Cambiar" : "Subir"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Restricciones y gustos</h3>
            <p className="muted" style={{ marginTop: 0, fontSize: ".88rem" }}>
              Alimentos que no podés comer o que preferís evitar.
            </p>
            <textarea
              className="input"
              rows={5}
              value={restrictions}
              onChange={(e) => setRestrictions(e.target.value)}
              placeholder="Ej: sin lactosa, no me gusta el pescado, soy celíaco…"
            />
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 10, width: "100%" }}
              disabled={saving}
              onClick={saveRestrictions}
            >
              {saving ? "Guardando…" : "Guardar preferencias"}
            </button>
          </div>
        </div>
      </section>

      {editing && (
        <div className="modal-overlay" onClick={() => !saving && setEditing(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="row-between" style={{ marginBottom: 14 }}>
              <h3 style={{ margin: 0 }}>Editar mis datos</h3>
              <button className="btn btn-outline" style={{ padding: "6px 12px" }} onClick={() => setEditing(false)}>
                Cerrar
              </button>
            </div>

            <div className="modal-body">
              <div className="grid-2">
                <div>
                  <label className="lbl">Sexo</label>
                  <select className="input" value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
                    {SEXOS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="lbl">Edad</label>
                  <input className="input" inputMode="numeric" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value.replace(/\D/g, "").slice(0, 3) })} />
                </div>
              </div>
              <div className="grid-2">
                <div>
                  <label className="lbl">Altura (cm)</label>
                  <input className="input" inputMode="numeric" value={form.height_cm} onChange={(e) => setForm({ ...form, height_cm: e.target.value.replace(/\D/g, "").slice(0, 3) })} />
                </div>
                <div>
                  <label className="lbl">Peso (kg)</label>
                  <input className="input" inputMode="decimal" value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value.replace(/[^\d.,]/g, "").slice(0, 6) })} />
                </div>
              </div>
              <div className="grid-2">
                <div>
                  <label className="lbl">Objetivo</label>
                  <select className="input" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })}>
                    {GOALS.map(([k, l]) => (
                      <option key={k} value={k}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="lbl">Días por semana</label>
                  <select className="input" value={form.training_days} onChange={(e) => setForm({ ...form, training_days: e.target.value })}>
                    {DIAS.map((d) => (
                      <option key={d} value={d}>{d} días</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid-2">
                <div>
                  <label className="lbl">Dónde entrenás</label>
                  <select className="input" value={form.training_place} onChange={(e) => setForm({ ...form, training_place: e.target.value })}>
                    {PLACES.map(([k, l]) => (
                      <option key={k} value={k}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="lbl">Experiencia</label>
                  <select className="input" value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })}>
                    {EXPS.map(([k, l]) => (
                      <option key={k} value={k}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="lbl">Preferencia alimentaria</label>
                <select className="input" value={form.nutrition} onChange={(e) => setForm({ ...form, nutrition: e.target.value })}>
                  {NUTRIS.map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="lbl">Lesiones o notas de salud</label>
                <textarea className="input" rows={3} value={form.injuries} onChange={(e) => setForm({ ...form, injuries: e.target.value })} />
              </div>
            </div>

            {error && <div className="toast err">{error}</div>}

            <button className="btn btn-primary" style={{ marginTop: 14, width: "100%" }} disabled={saving} onClick={saveEdit}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

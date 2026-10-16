"use client";

import { useState } from "react";

export interface RegisterPayload {
  full_name: string;
  username: string;
  email: string;
  phone: string;
  sex: string;
  age: string;
  height_cm: string;
  weight_kg: string;
  goal: string;
  training_days: string;
  training_place: string;
  experience: string;
  nutrition: string;
  injuries: string;
  food_restrictions: string;
  pin: string;
  pin_confirm: string;
}

const SEXOS = ["Masculino", "Femenino", "Otro"];
const OBJETIVOS: [string, string][] = [
  ["hipertrofia", "Hipertrofia"],
  ["perdida-grasa", "Pérdida de grasa"],
  ["fuerza", "Fuerza"],
  ["rendimiento-deportivo", "Rendimiento deportivo"],
];
const DIAS = [3, 4, 5];
const LUGARES: [string, string][] = [
  ["gimnasio", "Gimnasio"],
  ["casa", "Casa"],
  ["aire-libre", "Aire libre"],
];
const EXPERIENCIAS: [string, string][] = [
  ["principiante", "Principiante"],
  ["intermedio", "Intermedio"],
  ["avanzado", "Avanzado"],
];
const NUTRICION: [string, string][] = [
  ["omnivoro", "Omnívoro"],
  ["vegetariano", "Vegetariano"],
  ["carnivoro", "Carnívoro"],
  ["vegano", "Vegano"],
];

const EMPTY: RegisterPayload = {
  full_name: "",
  username: "",
  email: "",
  phone: "",
  sex: "Masculino",
  age: "",
  height_cm: "",
  weight_kg: "",
  goal: "hipertrofia",
  training_days: "4",
  training_place: "gimnasio",
  experience: "intermedio",
  nutrition: "omnivoro",
  injuries: "",
  food_restrictions: "",
  pin: "",
  pin_confirm: "",
};

const STEPS = ["Acceso", "Tu cuerpo", "Objetivo", "Notas"];

export default function RegisterWizard({
  onSuccess,
  onSwitchToLogin,
}: {
  onSuccess: (profile: any) => void | Promise<void>;
  onSwitchToLogin: () => void;
}) {
  const [step, setStep] = useState(1);
  const [reg, setReg] = useState<RegisterPayload>({ ...EMPTY });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (patch: Partial<RegisterPayload>) => setReg((r) => ({ ...r, ...patch }));

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!reg.full_name.trim()) return "Contanos tu nombre completo.";
      if (!/^[a-z0-9_]{3,20}$/.test(reg.username)) return "El usuario debe tener 3 a 20 caracteres.";
      if (!/^\S+@\S+\.\S+$/.test(reg.email.trim())) return "Ingresá un email válido.";
      if (reg.phone.replace(/\D/g, "").length < 6) return "Ingresá un teléfono / WhatsApp válido.";
      if (!/^\d{4}$/.test(reg.pin)) return "El PIN debe tener 4 dígitos.";
      if (reg.pin !== reg.pin_confirm) return "Los PIN no coinciden.";
    }
    if (s === 2) {
      const age = Number(reg.age);
      if (!age || age < 10 || age > 100) return "Ingresá una edad válida (10 a 100).";
      const h = Number(reg.height_cm);
      if (!h || h < 100 || h > 250) return "Ingresá una altura válida en cm.";
      const w = Number(reg.weight_kg);
      if (!w || w < 30 || w > 300) return "Ingresá un peso válido en kg.";
    }
    return null;
  };

  const next = () => {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(4, s + 1));
  };

  const back = () => {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    for (let s = 1; s <= 3; s++) {
      const err = validateStep(s);
      if (err) {
        setStep(s);
        setError(err);
        return;
      }
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reg),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await onSuccess(json.profile);
    } catch (err: any) {
      setError(err.message || "No se pudo crear la cuenta.");
    } finally {
      setLoading(false);
    }
  };

  const progress = Math.round(((step - 1) / (STEPS.length - 1)) * 100);

  return (
    <>
      <h1 style={{ margin: "0 0 4px", fontSize: "1.42rem" }}>Creá tu acceso</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {step === 1
          ? "Empezá con tus datos de ingreso y elegí un PIN para el gym."
          : step === 2
          ? "Estos datos nos permiten calibrar tu plan."
          : step === 3
          ? "Definamos tu objetivo y cómo vas a entrenar."
          : "Últimos detalles que José va a revisar antes de cerrar tu plan."}
      </p>

      <div className="wizard-progress" style={{ marginTop: 14 }}>
        <div className="wizard-track">
          <span className="wizard-fill" style={{ width: `${Math.max(6, progress)}%` }} />
        </div>
        <div className="wizard-labels">
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={`wizard-label ${i + 1 === step ? "active" : ""} ${
                i + 1 < step ? "done" : ""
              }`}
            >
              <i>{i + 1 < step ? "✓" : i + 1}</i>
              {label}
            </span>
          ))}
        </div>
      </div>

      <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 16 }}>
        {step === 1 && (
          <>
            <div>
              <label className="lbl">Nombre completo</label>
              <input
                className="input"
                value={reg.full_name}
                onChange={(e) => set({ full_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="lbl">Nombre de usuario (para ingresar rápido)</label>
              <input
                className="input"
                autoComplete="username"
                placeholder="ej: juanperez"
                value={reg.username}
                onChange={(e) =>
                  set({ username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20) })
                }
                required
              />
            </div>
            <div className="grid-2">
              <div>
                <label className="lbl">Email</label>
                <input
                  className="input"
                  type="email"
                  autoComplete="email"
                  value={reg.email}
                  onChange={(e) => set({ email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="lbl">Teléfono / WhatsApp</label>
                <input
                  className="input"
                  type="tel"
                  autoComplete="tel"
                  value={reg.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid-2">
              <div>
                <label className="lbl">PIN (4 dígitos)</label>
                <input
                  className="input"
                  inputMode="numeric"
                  maxLength={4}
                  value={reg.pin}
                  onChange={(e) => set({ pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                  style={{ letterSpacing: "0.4em", textAlign: "center" }}
                  required
                />
              </div>
              <div>
                <label className="lbl">Confirmar PIN</label>
                <input
                  className="input"
                  inputMode="numeric"
                  maxLength={4}
                  value={reg.pin_confirm}
                  onChange={(e) => set({ pin_confirm: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                  style={{ letterSpacing: "0.4em", textAlign: "center" }}
                  required
                />
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="grid-2">
              <div>
                <label className="lbl">Sexo</label>
                <select className="input" value={reg.sex} onChange={(e) => set({ sex: e.target.value })}>
                  {SEXOS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="lbl">Edad</label>
                <input
                  className="input"
                  inputMode="numeric"
                  placeholder="Años"
                  value={reg.age}
                  onChange={(e) => set({ age: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                  required
                />
              </div>
            </div>
            <div className="grid-2">
              <div>
                <label className="lbl">Altura (cm)</label>
                <input
                  className="input"
                  inputMode="numeric"
                  placeholder="178"
                  value={reg.height_cm}
                  onChange={(e) => set({ height_cm: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                  required
                />
              </div>
              <div>
                <label className="lbl">Peso (kg)</label>
                <input
                  className="input"
                  inputMode="decimal"
                  placeholder="78.5"
                  value={reg.weight_kg}
                  onChange={(e) => set({ weight_kg: e.target.value.replace(/[^\d.,]/g, "").slice(0, 6) })}
                  required
                />
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="grid-2">
              <div>
                <label className="lbl">Objetivo</label>
                <select className="input" value={reg.goal} onChange={(e) => set({ goal: e.target.value })}>
                  {OBJETIVOS.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="lbl">Días por semana</label>
                <select
                  className="input"
                  value={reg.training_days}
                  onChange={(e) => set({ training_days: e.target.value })}
                >
                  {DIAS.map((d) => (
                    <option key={d} value={d}>
                      {d} días
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div>
                <label className="lbl">Dónde entrenás</label>
                <select
                  className="input"
                  value={reg.training_place}
                  onChange={(e) => set({ training_place: e.target.value })}
                >
                  {LUGARES.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="lbl">Experiencia</label>
                <select
                  className="input"
                  value={reg.experience}
                  onChange={(e) => set({ experience: e.target.value })}
                >
                  {EXPERIENCIAS.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="lbl">Preferencia alimentaria</label>
              <select
                className="input"
                value={reg.nutrition}
                onChange={(e) => set({ nutrition: e.target.value })}
              >
                {NUTRICION.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div>
              <label className="lbl">Lesiones o notas de salud</label>
              <textarea
                className="input"
                rows={3}
                placeholder="Ej: molestia en hombro derecho, hernia lumbar, cirugía previa…"
                value={reg.injuries}
                onChange={(e) => set({ injuries: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl">Restricciones o alimentos que no te gustan</label>
              <textarea
                className="input"
                rows={3}
                placeholder="Ej: intolerancia a la lactosa, no me gusta el pescado…"
                value={reg.food_restrictions}
                onChange={(e) => set({ food_restrictions: e.target.value })}
              />
            </div>
            <p className="muted" style={{ margin: 0, fontSize: ".88rem" }}>
              Si algo queda incompleto, vas a poder editarlo mientras esperás la revisión de José.
            </p>
          </>
        )}

        {error && <div className="toast err">{error}</div>}

        <div style={{ display: "flex", gap: 10 }}>
          {step > 1 && (
            <button type="button" className="btn btn-outline" onClick={back} style={{ flex: 1 }}>
              Atrás
            </button>
          )}
          {step < 4 ? (
            <button type="button" className="btn btn-primary" onClick={next} style={{ flex: 2 }}>
              Continuar
            </button>
          ) : (
            <button className="btn btn-primary" disabled={loading} style={{ flex: 2 }}>
              {loading ? "Creando cuenta…" : "Crear cuenta y entrar"}
            </button>
          )}
        </div>
      </form>

      <p className="muted" style={{ marginTop: 14, textAlign: "center", fontSize: ".95rem" }}>
        ¿Ya tenés cuenta?{" "}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setError(null);
            onSwitchToLogin();
          }}
        >
          Ingresá
        </a>
      </p>
    </>
  );
}

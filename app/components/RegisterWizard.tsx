"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  BicepsFlexed,
  Dumbbell,
  Flame,
  IdCard,
  Medal,
  Repeat2,
  Ruler,
  Salad,
  BatteryCharging,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react";
import { EASE_OUT } from "@/app/lib/ui/motion";
import { computeMetabolic, fmt } from "@/app/lib/metabolic";

export interface RegisterPayload {
  full_name: string;
  username: string;
  email: string;
  phone: string;
  sex: string;
  age: string;
  height_cm: string;
  weight_kg: string;
  body_fat_pct: string;
  goal: string;
  training_days: string;
  session_length: string;
  training_place: string;
  experience: string;
  training_years: string;
  activity_level: string;
  sleep_quality: string;
  sleep_hours: string;
  stress_level: string;
  nutrition: string;
  allergies: string;
  foods_love: string;
  foods_avoid: string;
  meals_per_day: string;
  cook_time: string;
  meal_prep: string;
  budget: string;
  supplements: string;
  alcohol: string;
  injuries: string;
  food_restrictions: string;
  motivation: string;
  pin: string;
  pin_confirm: string;
}

const SEXOS = ["Masculino", "Femenino", "Otro"];

const GOALS: { key: string; label: string; icon: React.ReactNode }[] = [
  { key: "hipertrofia", label: "Ganar músculo", icon: <Dumbbell size={20} /> },
  { key: "perdida-grasa", label: "Perder grasa", icon: <Flame size={20} /> },
  { key: "fuerza", label: "Fuerza", icon: <BicepsFlexed size={20} /> },
  { key: "recomposicion", label: "Recomposición", icon: <Repeat2 size={20} /> },
  { key: "rendimiento-deportivo", label: "Rendimiento", icon: <Medal size={20} /> },
];

const DIAS = [3, 4, 5, 6];
const SESIONES = ["45 min", "60 min", "75 min", "90 min"];
const LUGARES: [string, string][] = [
  ["gimnasio", "Gimnasio completo"],
  ["casa", "Casa / Home gym"],
  ["aire-libre", "Peso corporal / Parques"],
];
const EXPERIENCIAS: [string, string][] = [
  ["principiante", "Principiante"],
  ["intermedio", "Intermedio"],
  ["avanzado", "Avanzado"],
];
const ACTIVIDADES: [string, string][] = [
  ["sedentario", "Sedentario"],
  ["ligero", "Ligero"],
  ["moderado", "Moderado"],
  ["alto", "Alto"],
  ["muy-alto", "Muy alto"],
];
const SUENO: [string, string][] = [
  ["mala", "Mala"],
  ["regular", "Regular"],
  ["buena", "Buena"],
  ["excelente", "Excelente"],
];
const NUTRICION: [string, string][] = [
  ["omnivoro", "Omnívoro"],
  ["vegetariano", "Vegetariano"],
  ["carnivoro", "Carnívoro"],
  ["vegano", "Vegano"],
];
const MEALS = [3, 4, 5, 6];
const COOK: [string, string][] = [
  ["menos de 15 min", "< 15 min"],
  ["15-30 min", "15-30 min"],
  ["30-60 min", "30-60 min"],
  ["más de 1 h", "Más de 1 h"],
];
const PREP: [string, string][] = [
  ["no hago", "No hago"],
  ["a veces", "A veces"],
  ["domingo completo", "Domingo"],
  ["2 veces por semana", "2× semana"],
];
const BUDGET: [string, string][] = [
  ["ajustado", "Ajustado"],
  ["medio", "Medio"],
  ["amplio", "Amplio"],
];
const ALCOHOL: [string, string][] = [
  ["no tomo", "No tomo"],
  ["ocasional", "Ocasional"],
  ["fines de semana", "Fines de semana"],
  ["frecuente", "Frecuente"],
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
  body_fat_pct: "",
  goal: "hipertrofia",
  training_days: "4",
  session_length: "60 min",
  training_place: "gimnasio",
  experience: "intermedio",
  training_years: "1",
  activity_level: "moderado",
  sleep_quality: "buena",
  sleep_hours: "7",
  stress_level: "5",
  nutrition: "omnivoro",
  allergies: "",
  foods_love: "",
  foods_avoid: "",
  meals_per_day: "4",
  cook_time: "15-30 min",
  meal_prep: "a veces",
  budget: "medio",
  supplements: "",
  alcohol: "ocasional",
  injuries: "",
  food_restrictions: "",
  motivation: "",
  pin: "",
  pin_confirm: "",
};

const STEPS = ["Acceso", "Tu cuerpo", "Objetivo", "Nutrición", "Hábitos"];
const STORAGE_KEY = "nocito-register-draft-v1";
const NAME_RE = /^[\p{L}\s'.-]+$/u;

function ChipGroup({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string; icon?: React.ReactNode }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="chipgroup">
      {options.map((o) => (
        <button
          type="button"
          key={o.key}
          className={`chipselect ${value === o.key ? "active" : ""}`}
          onClick={() => onChange(o.key)}
        >
          {o.icon && <span className="chipselect-ic">{o.icon}</span>}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function NumberChips({
  options,
  value,
  onChange,
  suffix,
}: {
  options: number[];
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
}) {
  return (
    <div className="chipgroup">
      {options.map((n) => (
        <button
          type="button"
          key={n}
          className={`chipselect ${value === String(n) ? "active" : ""}`}
          onClick={() => onChange(String(n))}
        >
          {n}
          {suffix ? ` ${suffix}` : ""}
        </button>
      ))}
    </div>
  );
}

export default function RegisterWizard({
  onSuccess,
  onSwitchToLogin,
}: {
  onSuccess: (profile: any) => void | Promise<void>;
  onSwitchToLogin: () => void;
}) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(1);
  const [reg, setReg] = useState<RegisterPayload>({ ...EMPTY });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const historyReady = useRef(false);

  const set = (patch: Partial<RegisterPayload>) => {
    setReg((r) => ({ ...r, ...patch }));
    if (error) setError(null);
  };

  useEffect(() => {
    let saved: { reg?: Partial<RegisterPayload>; step?: number } | null = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    } catch {
      saved = null;
    }
    if (saved?.reg && typeof saved.reg === "object") {
      setReg({ ...EMPTY, ...saved.reg });
    }
    const savedStep =
      typeof saved?.step === "number" && saved.step >= 1 && saved.step <= STEPS.length
        ? saved.step
        : 1;
    if (savedStep > 1) setStep(savedStep);
    try {
      history.replaceState({ ...history.state, nocitoWizard: true, step: 1 }, "");
      if (savedStep > 1) {
        history.pushState({ ...history.state, nocitoWizard: true, step: savedStep }, "");
      }
    } catch {
      /* history no disponible */
    }
    historyReady.current = true;
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      const safeReg = { ...reg, pin: "", pin_confirm: "" };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ reg: safeReg, step }));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [reg, step, loaded]);

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const target = event.state?.nocitoWizard ? Number(event.state.step) : NaN;
      if (Number.isInteger(target) && target >= 1 && target <= STEPS.length) {
        setError(null);
        setStep(target);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const goToStep = (target: number) => {
    setStep(target);
    if (historyReady.current) {
      try {
        history.pushState({ ...history.state, nocitoWizard: true, step: target }, "");
      } catch {
        /* history no disponible */
      }
    }
  };

  const metabolic = useMemo(
    () =>
      computeMetabolic({
        sex: reg.sex,
        weight_kg: Number(reg.weight_kg.replace(",", ".")) || 0,
        height_cm: Number(reg.height_cm) || 0,
        age: Number(reg.age) || 0,
        goal: reg.goal,
        activity_level: reg.activity_level,
        training_days: Number(reg.training_days) || 4,
      }),
    [reg.sex, reg.weight_kg, reg.height_cm, reg.age, reg.goal, reg.activity_level, reg.training_days]
  );
  const metabolicReady = Number(reg.weight_kg) > 0 && Number(reg.height_cm) > 0 && Number(reg.age) > 0;

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      const name = reg.full_name.trim().replace(/\s+/g, " ");
      if (!name) return "Contanos tu nombre completo.";
      if (name.length < 2 || name.length > 80)
        return "El nombre debe tener entre 2 y 80 caracteres.";
      if (!NAME_RE.test(name))
        return "El nombre solo puede incluir letras, espacios, apóstrofes, puntos o guiones.";
      if (/(.)\1{4,}/u.test(name)) return "Revisá el nombre: parece tener caracteres repetidos.";
      if (!/^[a-z0-9_]{3,20}$/.test(reg.username))
        return "El usuario debe tener de 3 a 20 caracteres: minúsculas, números o guion bajo.";
      const email = reg.email.trim().toLowerCase();
      if (email.length > 120 || !/^\S+@\S+\.\S+$/.test(email))
        return "Ingresá un email válido.";
      const phoneDigits = reg.phone.replace(/\D/g, "");
      if (phoneDigits.length < 8 || phoneDigits.length > 15)
        return "Ingresá un teléfono / WhatsApp válido (8 a 15 dígitos).";
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
      const bf = reg.body_fat_pct.trim();
      if (bf) {
        const n = Number(bf.replace(",", "."));
        if (!Number.isFinite(n) || n < 3 || n > 60)
          return "Ingresá un % de grasa válido (3 a 60) o dejàlo vacío.";
      }
    }
    if (s === 4) {
      if (reg.allergies.trim().length > 200) return "Alergias: máximo 200 caracteres.";
      if (reg.foods_love.trim().length > 200) return "Alimentos que te encantan: máximo 200 caracteres.";
      if (reg.foods_avoid.trim().length > 200) return "Alimentos que evitas: máximo 200 caracteres.";
    }
    if (s === 5) {
      const ty = Number(reg.training_years);
      if (!Number.isFinite(ty) || ty < 0 || ty > 60)
        return "Ingresá tus años de entrenamiento (0 a 60).";
      if (reg.injuries.trim().length > 500) return "Lesiones o notas de salud: máximo 500 caracteres.";
      if (reg.motivation.trim().length > 500) return "Motivación: máximo 500 caracteres.";
      if (!acceptedTerms)
        return "Para crear tu cuenta tenés que aceptar los términos y la política de privacidad.";
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
    goToStep(Math.min(STEPS.length, step + 1));
  };

  const back = () => {
    setError(null);
    if (step <= 1) return;
    if (historyReady.current && history.state?.nocitoWizard) {
      history.back();
    } else {
      setStep(step - 1);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    for (let s = 1; s < STEPS.length; s++) {
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
      const payload = {
        ...reg,
        full_name: reg.full_name.trim().replace(/\s+/g, " "),
        username: reg.username.trim().toLowerCase(),
        email: reg.email.trim().toLowerCase(),
        phone: reg.phone.trim(),
        termsAccepted: acceptedTerms,
      };
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "No pudimos crear la cuenta. Probá de nuevo.");
      }
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* almacenamiento no disponible */
      }
      await onSuccess(json.profile);
    } catch (err: any) {
      setError(err.message || "No se pudo crear la cuenta.");
    } finally {
      setLoading(false);
    }
  };

  const progress = Math.round(((step - 1) / (STEPS.length - 1)) * 100);
  const stepVariants = {
    hidden: { opacity: 0, x: reduce ? 0 : 24 },
    show: { opacity: 1, x: 0, transition: { duration: reduce ? 0 : 0.35, ease: EASE_OUT } },
    exit: { opacity: 0, x: reduce ? 0 : -24, transition: { duration: reduce ? 0 : 0.2 } },
  };

  return (
    <>
      <h1 style={{ margin: "0 0 4px", fontSize: "1.42rem" }}>Creá tu acceso</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {step === 1
          ? "Empezá con tus datos de ingreso y elegí un PIN para el gym."
          : step === 2
          ? "Estos datos nos permiten calcular tus calorías y macros automáticamente."
          : step === 3
          ? "Definamos tu objetivo y cómo vas a entrenar."
          : step === 4
          ? "Así armamos tu alimentación a tu medida."
          : "Últimos detalles que José va a revisar antes de cerrar tu plan."}
      </p>

      <div className="wizard-progress" style={{ marginTop: 14 }}>
        <div className="wizard-track">
          <motion.span
            className="wizard-fill"
            initial={false}
            animate={{ width: `${Math.max(6, progress)}%` }}
            transition={{ duration: reduce ? 0 : 0.45, ease: EASE_OUT }}
          />
        </div>
        <div className="wizard-labels">
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={`wizard-label ${i + 1 === step ? "active" : ""} ${
                i + 1 < step ? "done" : ""
              }`}
            >
              <i>{i + 1 < step ? <Check size={11} /> : i + 1}</i>
              {label}
            </span>
          ))}
        </div>
      </div>

      <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 16 }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            variants={stepVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{ display: "grid", gap: 14 }}
          >
            {step === 1 && (
              <>
                <div>
                  <label className="lbl" htmlFor="reg-name">Nombre completo</label>
                  <input
                    id="reg-name"
                    className="input"
                    autoComplete="name"
                    maxLength={80}
                    value={reg.full_name}
                    onChange={(e) => set({ full_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="lbl" htmlFor="reg-username">Nombre de usuario (para ingresar rápido)</label>
                  <input
                    id="reg-username"
                    className="input"
                    autoComplete="username"
                    placeholder="ej: juanperez"
                    maxLength={20}
                    value={reg.username}
                    onChange={(e) =>
                      set({ username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20) })
                    }
                    required
                  />
                </div>
                <div className="grid-2">
                  <div>
                    <label className="lbl" htmlFor="reg-email">Email</label>
                    <input
                      id="reg-email"
                      className="input"
                      type="email"
                      autoComplete="email"
                      maxLength={120}
                      value={reg.email}
                      onChange={(e) => set({ email: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="lbl" htmlFor="reg-phone">Teléfono / WhatsApp</label>
                    <input
                      id="reg-phone"
                      className="input"
                      type="tel"
                      autoComplete="tel"
                      maxLength={20}
                      value={reg.phone}
                      onChange={(e) => set({ phone: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid-2">
                  <div>
                    <label className="lbl" htmlFor="reg-pin">PIN (4 dígitos)</label>
                    <input
                      id="reg-pin"
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
                    <label className="lbl" htmlFor="reg-pin-confirm">Confirmar PIN</label>
                    <input
                      id="reg-pin-confirm"
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
                    <label className="lbl">
                      <Ruler size={13} /> Altura (cm)
                    </label>
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
                <div>
                  <label className="lbl">% de grasa corporal estimado (opcional)</label>
                  <input
                    className="input"
                    inputMode="decimal"
                    placeholder="Ej: 18 — si no lo sabés, dejàlo vacío"
                    value={reg.body_fat_pct}
                    onChange={(e) =>
                      set({ body_fat_pct: e.target.value.replace(/[^\d.,]/g, "").slice(0, 5) })
                    }
                  />
                </div>

                <AnimatePresence>
                  {metabolicReady && (
                    <motion.div
                      className="metab-preview"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 12 }}
                      transition={{ duration: reduce ? 0 : 0.4, ease: EASE_OUT }}
                    >
                      <div className="metab-preview-head">
                        <IdCard size={16} />
                        <span>Ya calculamos tus números</span>
                      </div>
                      <div className="metab-preview-grid">
                        <div>
                          <span className="metab-k">IMC</span>
                          <span className="metab-v">{metabolic.bmi}</span>
                          <span className="metab-tag">{metabolic.bmiCategory}</span>
                        </div>
                        <div>
                          <span className="metab-k">TMB</span>
                          <span className="metab-v">{fmt(metabolic.bmr)}</span>
                          <span className="metab-tag">kcal en reposo</span>
                        </div>
                        <div>
                          <span className="metab-k">Gasto diario</span>
                          <span className="metab-v">{fmt(metabolic.tdee)}</span>
                          <span className="metab-tag">kcal</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}

            {step === 3 && (
              <>
                <div>
                  <label className="lbl">Objetivo principal</label>
                  <ChipGroup
                    options={GOALS}
                    value={reg.goal}
                    onChange={(v) => set({ goal: v })}
                  />
                </div>
                <div className="grid-2">
                  <div>
                    <label className="lbl">Días por semana</label>
                    <NumberChips
                      options={DIAS}
                      value={reg.training_days}
                      onChange={(v) => set({ training_days: v })}
                    />
                  </div>
                  <div>
                    <label className="lbl">Duración por sesión</label>
                    <ChipGroup
                      options={SESIONES.map((s) => ({ key: s, label: s }))}
                      value={reg.session_length}
                      onChange={(v) => set({ session_length: v })}
                    />
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
              </>
            )}

            {step === 4 && (
              <>
                <div className="grid-2">
                  <div>
                    <label className="lbl">
                      <Salad size={13} /> Preferencia alimentaria
                    </label>
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
                  <div>
                    <label className="lbl">Comidas por día</label>
                    <NumberChips
                      options={MEALS}
                      value={reg.meals_per_day}
                      onChange={(v) => set({ meals_per_day: v })}
                    />
                  </div>
                </div>
                <div>
                  <label className="lbl">Alergias o intolerancias</label>
                  <input
                    className="input"
                    placeholder="Ej: lactosa, gluten, frutos secos…"
                    maxLength={200}
                    value={reg.allergies}
                    onChange={(e) => set({ allergies: e.target.value })}
                  />
                </div>
                <div className="grid-2">
                  <div>
                    <label className="lbl">Alimentos que te encantan</label>
                    <input
                      className="input"
                      placeholder="Ej: pollo, arroz, banana"
                      maxLength={200}
                      value={reg.foods_love}
                      onChange={(e) => set({ foods_love: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="lbl">Alimentos que evitas</label>
                    <input
                      className="input"
                      placeholder="Ej: pescado, hígado"
                      maxLength={200}
                      value={reg.foods_avoid}
                      onChange={(e) => set({ foods_avoid: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid-2">
                  <div>
                    <label className="lbl">Tiempo para cocinar</label>
                    <select
                      className="input"
                      value={reg.cook_time}
                      onChange={(e) => set({ cook_time: e.target.value })}
                    >
                      {COOK.map(([k, l]) => (
                        <option key={k} value={k}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="lbl">Meal prep</label>
                    <select
                      className="input"
                      value={reg.meal_prep}
                      onChange={(e) => set({ meal_prep: e.target.value })}
                    >
                      {PREP.map(([k, l]) => (
                        <option key={k} value={k}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="lbl">Presupuesto alimentario</label>
                  <ChipGroup
                    options={BUDGET.map(([k, l]) => ({ key: k, label: l }))}
                    value={reg.budget}
                    onChange={(v) => set({ budget: v })}
                  />
                </div>
              </>
            )}

            {step === 5 && (
              <>
                <div className="grid-2">
                  <div>
                    <label className="lbl">Años de entrenamiento</label>
                    <input
                      className="input"
                      inputMode="numeric"
                      placeholder="Ej: 2"
                      value={reg.training_years}
                      onChange={(e) =>
                        set({ training_years: e.target.value.replace(/\D/g, "").slice(0, 2) })
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="lbl">Actividad diaria</label>
                    <select
                      className="input"
                      value={reg.activity_level}
                      onChange={(e) => set({ activity_level: e.target.value })}
                    >
                      {ACTIVIDADES.map(([k, l]) => (
                        <option key={k} value={k}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="lbl">
                    <BatteryCharging size={13} /> Horas de sueño: {reg.sleep_hours} h
                  </label>
                  <input
                    className="slider"
                    type="range"
                    min={4}
                    max={10}
                    step={1}
                    value={reg.sleep_hours}
                    onChange={(e) => {
                      const h = e.target.value;
                      const q = Number(h) >= 8 ? "excelente" : Number(h) >= 7 ? "buena" : Number(h) >= 6 ? "regular" : "mala";
                      set({ sleep_hours: h, sleep_quality: q });
                    }}
                  />
                </div>

                <div>
                  <label className="lbl">Nivel de estrés: {reg.stress_level}/10</label>
                  <input
                    className="slider"
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={reg.stress_level}
                    onChange={(e) => set({ stress_level: e.target.value })}
                  />
                </div>

                <div className="grid-2">
                  <div>
                    <label className="lbl">Suplementos (opcional)</label>
                    <input
                      className="input"
                      placeholder="Ej: creatina, proteína"
                      value={reg.supplements}
                      onChange={(e) => set({ supplements: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="lbl">Alcohol</label>
                    <select
                      className="input"
                      value={reg.alcohol}
                      onChange={(e) => set({ alcohol: e.target.value })}
                    >
                      {ALCOHOL.map(([k, l]) => (
                        <option key={k} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="lbl">Lesiones o notas de salud</label>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="Ej: molestia en hombro derecho, hernia lumbar…"
                    maxLength={500}
                    value={reg.injuries}
                    onChange={(e) => set({ injuries: e.target.value })}
                  />
                </div>
                <div>
                  <label className="lbl">¿Qué te motiva? (opcional)</label>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="Contale a José por qué empezás este proceso."
                    maxLength={500}
                    value={reg.motivation}
                    onChange={(e) => set({ motivation: e.target.value })}
                  />
                </div>
                <p className="muted" style={{ margin: 0, fontSize: ".88rem" }}>
                  Si algo queda incompleto, vas a poder editarlo mientras esperás la revisión de José.
                </p>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {step === STEPS.length && (
          <div className="terms-check">
            <input
              id="reg-terms"
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => {
                setAcceptedTerms(e.target.checked);
                if (error) setError(null);
              }}
            />
            <label htmlFor="reg-terms">
              Acepto los{" "}
              <a
                href="/terminos"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                términos y condiciones
              </a>{" "}
              y la{" "}
              <a
                href="/privacidad"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                política de privacidad
              </a>
              .
            </label>
          </div>
        )}

        {error && <div className="toast err" role="alert">{error}</div>}

        <div style={{ display: "flex", gap: 10 }}>
          {step > 1 && (
            <button type="button" className="btn btn-outline" onClick={back} style={{ flex: 1 }}>
              <ChevronLeft size={16} /> Atrás
            </button>
          )}
          {step < STEPS.length ? (
            <button type="button" className="btn btn-primary" onClick={next} style={{ flex: 2 }}>
              Continuar <ChevronRight size={16} />
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

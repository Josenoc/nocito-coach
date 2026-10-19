"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  History,
  Pencil,
  RotateCcw,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import { EASE_OUT } from "@/app/lib/ui/motion";
import { computeMetabolic, fmt } from "@/app/lib/metabolic";

interface ChangeRow {
  id: string;
  field: string;
  field_label: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  created_at: string;
}

interface CoachProfileEditorProps {
  clientId: string;
  profile: any;
  changes: ChangeRow[];
  onSaved: () => void | Promise<void>;
}

const GOALS = [
  ["hipertrofia", "Hipertrofia"],
  ["perdida-grasa", "Pérdida de grasa"],
  ["fuerza", "Fuerza"],
  ["recomposicion", "Recomposición"],
  ["rendimiento-deportivo", "Rendimiento"],
];
const NUTRITION = [
  ["omnivoro", "Omnívoro"],
  ["vegetariano", "Vegetariano"],
  ["carnivoro", "Carnívoro"],
  ["vegano", "Vegano"],
];
const PLACES = [
  ["gimnasio", "Gimnasio"],
  ["casa", "Casa / Home gym"],
  ["aire-libre", "Peso corporal / Parques"],
];
const EXPERIENCE = [
  ["principiante", "Principiante"],
  ["intermedio", "Intermedio"],
  ["avanzado", "Avanzado"],
];
const ACTIVITY = [
  ["sedentario", "Sedentario"],
  ["ligero", "Ligero"],
  ["moderado", "Moderado"],
  ["alto", "Alto"],
  ["muy-alto", "Muy alto"],
];
const SLEEP = [
  ["mala", "Mala"],
  ["regular", "Regular"],
  ["buena", "Buena"],
  ["excelente", "Excelente"],
];
const SESSIONS = ["45 min", "60 min", "75 min", "90 min"];
const COOK = ["menos de 15 min", "15-30 min", "30-60 min", "más de 1 h"];
const PREP = ["no hago", "a veces", "domingo completo", "2 veces por semana"];
const BUDGET = ["ajustado", "medio", "amplio"];
const ALCOHOL = ["no tomo", "ocasional", "fines de semana", "frecuente"];
const SEXOS = ["Masculino", "Femenino", "Otro"];

type FormState = Record<string, string>;

function toForm(profile: any): FormState {
  const a = profile?.anamnesis ?? {};
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return {
    full_name: s(profile?.full_name),
    phone: s(profile?.phone),
    sex: s(a.sex),
    age: s(a.age),
    height_cm: s(a.height_cm),
    weight_kg: s(a.weight_kg),
    body_fat_pct: s(a.body_fat_pct),
    goal: s(a.goal),
    training_days: s(a.training_days),
    session_length: s(a.session_length),
    training_place: s(a.training_place),
    experience: s(a.experience),
    training_years: s(a.training_years),
    activity_level: s(a.activity_level),
    sleep_quality: s(a.sleep_quality),
    sleep_hours: s(a.sleep_hours),
    stress_level: s(a.stress_level),
    nutrition: s(a.nutrition),
    meals_per_day: s(a.meals_per_day),
    allergies: s(a.allergies),
    foods_love: s(a.foods_love),
    foods_avoid: s(a.foods_avoid),
    cook_time: s(a.cook_time),
    meal_prep: s(a.meal_prep),
    budget: s(a.budget),
    supplements: s(a.supplements),
    alcohol: s(a.alcohol),
    injuries: s(a.injuries),
    food_restrictions: s(a.food_restrictions),
    motivation: s(a.motivation),
  };
}

function F({
  label,
  editing,
  children,
  wide,
}: {
  label: string;
  editing: boolean;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`field-cell ${wide ? "field-wide" : ""}`}>
      <span className="field-label">{label}</span>
      {children}
    </div>
  );
}

function ReadOrInput({
  editing,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  editing: boolean;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  if (!editing) {
    return <span className={`field-value ${value ? "" : "empty"}`}>{value || "—"}</span>;
  }
  return (
    <input
      className="input field-input"
      type={type}
      inputMode={type === "number" ? "decimal" : undefined}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function ReadOrSelect({
  editing,
  value,
  onChange,
  options,
  labels,
}: {
  editing: boolean;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels?: Record<string, string>;
}) {
  const label = labels?.[value] ?? value;
  if (!editing) return <span className={`field-value ${value ? "" : "empty"}`}>{label || "—"}</span>;
  return (
    <select className="input field-input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {labels?.[o] ?? o}
        </option>
      ))}
    </select>
  );
}

export default function CoachProfileEditor({
  clientId,
  profile,
  changes,
  onSaved,
}: CoachProfileEditorProps) {
  const reduce = useReducedMotion();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(() => toForm(profile));
  const [baseline, setBaseline] = useState<FormState>(() => toForm(profile));
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const upd = (key: string, v: string) => setForm((f) => ({ ...f, [key]: v }));

  const metabolic = useMemo(
    () =>
      computeMetabolic({
        sex: form.sex,
        weight_kg: Number(form.weight_kg.replace(",", ".")) || 0,
        height_cm: Number(form.height_cm) || 0,
        age: Number(form.age) || 0,
        goal: form.goal,
        activity_level: form.activity_level,
        training_days: Number(form.training_days) || 0,
      }),
    [form.sex, form.weight_kg, form.height_cm, form.age, form.goal, form.activity_level, form.training_days]
  );

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline]
  );

  const startEdit = () => {
    setBaseline(form);
    setEditing(true);
  };

  const discard = () => {
    setForm(baseline);
    setEditing(false);
    setToast(null);
  };

  const save = async () => {
    setSaving(true);
    setToast(null);
    try {
      const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
      const intOrNull = (v: string) => (v.trim() === "" ? null : Math.round(Number(v)));
      const res = await fetch("/api/coach/client", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: clientId,
          full_name: form.full_name,
          phone: form.phone,
          anamnesis: {
            sex: form.sex,
            age: intOrNull(form.age),
            height_cm: intOrNull(form.height_cm),
            weight_kg: numOrNull(form.weight_kg),
            body_fat_pct: numOrNull(form.body_fat_pct),
            goal: form.goal,
            training_days: intOrNull(form.training_days),
            session_length: form.session_length,
            training_place: form.training_place,
            experience: form.experience,
            training_years: intOrNull(form.training_years),
            activity_level: form.activity_level,
            sleep_quality: form.sleep_quality,
            sleep_hours: intOrNull(form.sleep_hours),
            stress_level: intOrNull(form.stress_level),
            nutrition: form.nutrition,
            meals_per_day: intOrNull(form.meals_per_day),
            allergies: form.allergies,
            foods_love: form.foods_love,
            foods_avoid: form.foods_avoid,
            cook_time: form.cook_time,
            meal_prep: form.meal_prep,
            budget: form.budget,
            supplements: form.supplements,
            alcohol: form.alcohol,
            injuries: form.injuries,
            food_restrictions: form.food_restrictions,
            motivation: form.motivation,
          },
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "No se pudo guardar");
      setBaseline(form);
      setEditing(false);
      setToast({
        type: "ok",
        text:
          json.changed > 0
            ? `Perfil actualizado (${json.changed} cambio${json.changed === 1 ? "" : "s"}).`
            : "Perfil actualizado.",
      });
      window.setTimeout(() => setToast(null), 3200);
      await onSaved();
    } catch (err: any) {
      setToast({ type: "err", text: err?.message || "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-editor" style={{ "--accent": "#ffc400" } as CSSProperties}>
      <div className="profile-toolbar">
        <div>
          <h3 style={{ margin: 0 }}>Perfil del cliente</h3>
          <p className="muted" style={{ margin: "2px 0 0", fontSize: ".85rem" }}>
            Todos los datos del onboarding, editables. Los cálculos se recalculan solos.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!editing ? (
            <motion.button
              className="btn btn-primary"
              onClick={startEdit}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <Pencil size={15} /> Editar perfil
            </motion.button>
          ) : (
            <>
              <button className="btn btn-outline" onClick={discard} disabled={saving}>
                <RotateCcw size={15} /> Descartar
              </button>
              <motion.button
                className="btn btn-primary"
                onClick={save}
                disabled={saving || !dirty}
                whileHover={{ scale: dirty ? 1.03 : 1 }}
                whileTap={{ scale: dirty ? 0.97 : 1 }}
              >
                <Save size={15} /> {saving ? "Guardando…" : "Guardar"}
              </motion.button>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            className={`toast ${toast.type === "ok" ? "ok" : "err"}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: reduce ? 0 : 0.25, ease: EASE_OUT }}
          >
            {toast.type === "ok" && <Check size={14} />} {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cálculos metabólicos automáticos */}
      <div className="profile-metab">
        <div className="profile-metab-head">
          <Sparkles size={15} /> Cálculo automático
        </div>
        <div className="profile-metab-grid">
          <div>
            <span className="pm-k">IMC</span>
            <span className="pm-v">{metabolic.bmi}</span>
            <span className="pm-tag">{metabolic.bmiCategory}</span>
          </div>
          <div>
            <span className="pm-k">TMB</span>
            <span className="pm-v">{fmt(metabolic.bmr)}</span>
            <span className="pm-tag">kcal</span>
          </div>
          <div>
            <span className="pm-k">Gasto diario</span>
            <span className="pm-v">{fmt(metabolic.tdee)}</span>
            <span className="pm-tag">{metabolic.activityLabel}</span>
          </div>
          <div>
            <span className="pm-k">Objetivo</span>
            <span className="pm-v">{fmt(metabolic.targetCalories)}</span>
            <span className="pm-tag">kcal · {metabolic.calorieAdjustment}</span>
          </div>
        </div>
        <div className="profile-macros">
          <span>
            <b>{metabolic.macros.prot} g</b> proteína ({metabolic.macros.protPct}%)
          </span>
          <span>
            <b>{metabolic.macros.carbs} g</b> carbos ({metabolic.macros.carbsPct}%)
          </span>
          <span>
            <b>{metabolic.macros.fat} g</b> grasa ({metabolic.macros.fatPct}%)
          </span>
        </div>
      </div>

      <div className={`profile-grid ${editing ? "editing" : ""}`}>
        <F label="Nombre" editing={editing} wide>
          <ReadOrInput editing={editing} value={form.full_name} onChange={(v) => upd("full_name", v)} />
        </F>
        <F label="Teléfono" editing={editing}>
          <ReadOrInput editing={editing} value={form.phone} onChange={(v) => upd("phone", v)} />
        </F>
        <F label="Sexo" editing={editing}>
          <ReadOrSelect editing={editing} value={form.sex} onChange={(v) => upd("sex", v)} options={SEXOS} />
        </F>
        <F label="Edad" editing={editing}>
          <ReadOrInput editing={editing} type="number" value={form.age} onChange={(v) => upd("age", v)} />
        </F>
        <F label="Altura (cm)" editing={editing}>
          <ReadOrInput editing={editing} type="number" value={form.height_cm} onChange={(v) => upd("height_cm", v)} />
        </F>
        <F label="Peso (kg)" editing={editing}>
          <ReadOrInput editing={editing} type="number" value={form.weight_kg} onChange={(v) => upd("weight_kg", v)} />
        </F>
        <F label="% de grasa" editing={editing}>
          <ReadOrInput editing={editing} type="number" value={form.body_fat_pct} onChange={(v) => upd("body_fat_pct", v)} />
        </F>
        <F label="Objetivo" editing={editing}>
          <ReadOrSelect
            editing={editing}
            value={form.goal}
            onChange={(v) => upd("goal", v)}
            options={GOALS.map((g) => g[0])}
            labels={Object.fromEntries(GOALS)}
          />
        </F>
        <F label="Días / semana" editing={editing}>
          <ReadOrInput editing={editing} type="number" value={form.training_days} onChange={(v) => upd("training_days", v)} />
        </F>
        <F label="Duración sesión" editing={editing}>
          <ReadOrSelect
            editing={editing}
            value={form.session_length}
            onChange={(v) => upd("session_length", v)}
            options={SESSIONS}
          />
        </F>
        <F label="Lugar" editing={editing}>
          <ReadOrSelect
            editing={editing}
            value={form.training_place}
            onChange={(v) => upd("training_place", v)}
            options={PLACES.map((p) => p[0])}
            labels={Object.fromEntries(PLACES)}
          />
        </F>
        <F label="Experiencia" editing={editing}>
          <ReadOrSelect
            editing={editing}
            value={form.experience}
            onChange={(v) => upd("experience", v)}
            options={EXPERIENCE.map((p) => p[0])}
            labels={Object.fromEntries(EXPERIENCE)}
          />
        </F>
        <F label="Años entrenando" editing={editing}>
          <ReadOrInput editing={editing} type="number" value={form.training_years} onChange={(v) => upd("training_years", v)} />
        </F>
        <F label="Actividad diaria" editing={editing}>
          <ReadOrSelect
            editing={editing}
            value={form.activity_level}
            onChange={(v) => upd("activity_level", v)}
            options={ACTIVITY.map((p) => p[0])}
            labels={Object.fromEntries(ACTIVITY)}
          />
        </F>
        <F label="Calidad de sueño" editing={editing}>
          <ReadOrSelect
            editing={editing}
            value={form.sleep_quality}
            onChange={(v) => upd("sleep_quality", v)}
            options={SLEEP.map((p) => p[0])}
            labels={Object.fromEntries(SLEEP)}
          />
        </F>
        <F label="Horas de sueño" editing={editing}>
          <ReadOrInput editing={editing} type="number" value={form.sleep_hours} onChange={(v) => upd("sleep_hours", v)} />
        </F>
        <F label="Estrés (1-10)" editing={editing}>
          <ReadOrInput editing={editing} type="number" value={form.stress_level} onChange={(v) => upd("stress_level", v)} />
        </F>
        <F label="Alimentación" editing={editing}>
          <ReadOrSelect
            editing={editing}
            value={form.nutrition}
            onChange={(v) => upd("nutrition", v)}
            options={NUTRITION.map((p) => p[0])}
            labels={Object.fromEntries(NUTRITION)}
          />
        </F>
        <F label="Comidas / día" editing={editing}>
          <ReadOrInput editing={editing} type="number" value={form.meals_per_day} onChange={(v) => upd("meals_per_day", v)} />
        </F>
        <F label="Tiempo para cocinar" editing={editing}>
          <ReadOrSelect editing={editing} value={form.cook_time} onChange={(v) => upd("cook_time", v)} options={COOK} />
        </F>
        <F label="Meal prep" editing={editing}>
          <ReadOrSelect editing={editing} value={form.meal_prep} onChange={(v) => upd("meal_prep", v)} options={PREP} />
        </F>
        <F label="Presupuesto" editing={editing}>
          <ReadOrSelect editing={editing} value={form.budget} onChange={(v) => upd("budget", v)} options={BUDGET} />
        </F>
        <F label="Alcohol" editing={editing}>
          <ReadOrSelect editing={editing} value={form.alcohol} onChange={(v) => upd("alcohol", v)} options={ALCOHOL} />
        </F>
        <F label="Suplementos" editing={editing}>
          <ReadOrInput editing={editing} value={form.supplements} onChange={(v) => upd("supplements", v)} />
        </F>
        <F label="Alergias" editing={editing} wide>
          <ReadOrInput editing={editing} value={form.allergies} onChange={(v) => upd("allergies", v)} />
        </F>
        <F label="Alimentos favoritos" editing={editing}>
          <ReadOrInput editing={editing} value={form.foods_love} onChange={(v) => upd("foods_love", v)} />
        </F>
        <F label="Alimentos que evita" editing={editing}>
          <ReadOrInput editing={editing} value={form.foods_avoid} onChange={(v) => upd("foods_avoid", v)} />
        </F>
        <F label="Lesiones / notas" editing={editing} wide>
          <ReadOrInput editing={editing} value={form.injuries} onChange={(v) => upd("injuries", v)} />
        </F>
        <F label="Restricciones alimentarias" editing={editing} wide>
          <ReadOrInput editing={editing} value={form.food_restrictions} onChange={(v) => upd("food_restrictions", v)} />
        </F>
        <F label="Motivación" editing={editing} wide>
          <ReadOrInput editing={editing} value={form.motivation} onChange={(v) => upd("motivation", v)} />
        </F>
      </div>

      {/* Historial de cambios */}
      <div className="profile-history">
        <div className="profile-history-head">
          <History size={15} /> Historial de cambios
          {changes.length > 0 && <span className="history-count">{changes.length}</span>}
        </div>
        {changes.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: ".9rem" }}>
            Todavía no hay cambios registrados.
          </p>
        ) : (
          <ul className="history-list">
            {changes.map((c) => (
              <li key={c.id} className="history-item">
                <span className="history-date">
                  {new Date(c.created_at).toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                  })}
                </span>
                <span className="history-field">{c.field_label || c.field}</span>
                <span className="history-diff">
                  <em className="old">{c.old_value || "—"}</em>
                  <span className="arrow">→</span>
                  <em className="new">{c.new_value || "—"}</em>
                </span>
                {c.changed_by && <span className="history-by">{c.changed_by}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

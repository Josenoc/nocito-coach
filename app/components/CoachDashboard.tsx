"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { FoodItem, FoodLogs, MealSlot, NutritionPlan, Profile } from "@/lib/app-types";
import { waLink } from "@/app/lib/coach";
import { safeBase64ToUint8Array } from "@/app/lib/base64";
import type { GeneratedProgram } from "@/app/lib/program";
import ProgramEditor from "@/app/components/ProgramEditor";
import CoachProfileEditor from "@/app/components/CoachProfileEditor";

interface ClientRow {
  id: string;
  email: string;
  full_name: string;
  activo: boolean;
  has_pin: boolean;
  routine_status: "pending_review" | "active";
  has_client_update?: boolean;
}

interface ExRow {
  id?: string;
  name: string;
  video_url: string;
  technique_notes: string;
  target_sets: string;
  target_reps: string;
  target_weight: string;
  target_rir: string;
  unit: "kg" | "lbs";
}

interface Draft {
  id?: string;
  name: string;
  day_name: string;
  week_number: string;
  position: string;
  active: boolean;
  exercises: ExRow[];
}

const emptyEx = (): ExRow => ({
  name: "",
  video_url: "",
  technique_notes: "",
  target_sets: "3",
  target_reps: "10",
  target_weight: "",
  target_rir: "",
  unit: "kg",
});

// La RIR objetivo del coach se guarda dentro de `technique_notes` (convención
// existente: segmento "RIR n"), así no se toca el esquema de la base.
const RIR_RE = /RIR\s*([0-9]+(?:[.,][0-9]+)?)/i;

function rirFromNotes(notes: string): string {
  const m = String(notes ?? "").match(RIR_RE);
  return m ? m[1].replace(",", ".") : "";
}

function notesWithRir(notes: string, rir: string): string {
  const text = String(notes ?? "");
  const value = String(rir ?? "").trim();
  if (/RIR\s*[0-9]+(?:[.,][0-9]+)?/i.test(text)) {
    if (value) {
      return text.replace(/RIR\s*[0-9]+(?:[.,][0-9]+)?/i, `RIR ${value.replace(",", ".")}`);
    }
    return text
      .replace(/(?:·\s*)?RIR\s*[0-9]+(?:[.,][0-9]+)?/i, "")
      .replace(/[ \t]*·[ \t]*(?=·)/g, "")
      .replace(/(^|\n)[ \t]*·[ \t]*/g, "$1")
      .replace(/[ \t]*·[ \t]*$/gm, "")
      .replace(/[ \t]+$/gm, "")
      .trim();
  }
  const trimmed = text.trim();
  if (!value) return trimmed;
  const line = `RIR ${value.replace(",", ".")}`;
  return trimmed ? `${trimmed}\n${line}` : line;
}

const emptyDraft = (): Draft => ({
  name: "",
  day_name: "",
  week_number: "1",
  position: "0",
  active: true,
  exercises: [emptyEx()],
});

const emptyNutrition = (): NutritionPlan => ({
  cal: 0,
  prot: 0,
  carbs: 0,
  fat: 0,
  proteinSources: "",
  meals: [],
});

const GOAL_LABELS: Record<string, string> = {
  hipertrofia: "Hipertrofia",
  "perdida-grasa": "Pérdida de grasa",
  fuerza: "Fuerza",
  recomposicion: "Recomposición corporal",
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
  casa: "Casa / Home gym",
  "aire-libre": "Peso corporal / Parques",
};

const EXPERIENCE_LABELS: Record<string, string> = {
  principiante: "Principiante",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
};

const ACTIVITY_LABELS: Record<string, string> = {
  sedentario: "Sedentario",
  ligero: "Ligero",
  moderado: "Moderado",
  alto: "Alto",
  "muy-alto": "Muy alto",
};

const SLEEP_LABELS: Record<string, string> = {
  mala: "Mala",
  regular: "Regular",
  buena: "Buena",
  excelente: "Excelente",
};

const FOOD_SLOT_ORDER: MealSlot[] = ["desayuno", "almuerzo", "merienda", "cena", "extra"];
const FOOD_SLOT_LABELS: Record<MealSlot, string> = {
  desayuno: "Desayuno",
  almuerzo: "Almuerzo",
  merienda: "Merienda",
  cena: "Cena",
  extra: "Extras / antojos",
};

function sumFood(items: FoodItem[]) {
  return items.reduce(
    (acc, it) => ({
      cal: acc.cal + (it.cal || 0),
      prot: acc.prot + (it.prot || 0),
      carbs: acc.carbs + (it.carbs || 0),
      fat: acc.fat + (it.fat || 0),
    }),
    { cal: 0, prot: 0, carbs: 0, fat: 0 }
  );
}

function formatFoodDay(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

type ParsedExercise = {
  ejercicio: string;
  series: number | null;
  reps: string | null;
  descanso: string | null;
  notas: string | null;
};

type ParsedDay = {
  dia: string;
  nombre: string;
  ejercicios: ParsedExercise[];
};

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="muted"
        style={{ fontSize: ".72rem", textTransform: "uppercase", letterSpacing: ".04em" }}
      >
        {label}
      </div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function LastSessionBlock({ logs, routines }: { logs: any[]; routines: any[] }) {
  const loaded = logs.filter((l) => l.actual_reps != null || l.actual_weight != null);
  const fmt = (iso: string) => iso.split("-").reverse().join("/");
  const sessions = Array.from(new Set(loaded.map((l) => String(l.log_date)))).sort().reverse();
  const names: Record<string, string> = {};
  routines.forEach((r: any) =>
    (r.exercises ?? []).forEach((e: any) => {
      names[e.id] = e.name;
    })
  );
  // Fallback por exercise_name (cuando el ejercicio se recreo y perdio el vinculo).
  logs.forEach((l: any) => {
    if (l.exercise_id && !names[l.exercise_id] && l.exercise_name) {
      names[l.exercise_id] = l.exercise_name;
    }
    if (l.exercise_id && !names[l.exercise_id] && l.exercises?.name) {
      names[l.exercise_id] = l.exercises.name;
    }
  });
  const wrap = { marginTop: 16, paddingTop: 14, borderTop: "1px solid #242424" };
  const head = (
    <h4
      style={{
        margin: "0 0 10px",
        fontSize: ".74rem",
        letterSpacing: ".12em",
        textTransform: "uppercase",
        color: "#FFC400",
      }}
    >
      Actividad del alumno
    </h4>
  );
  if (sessions.length === 0) {
    return (
      <div style={wrap}>
        {head}
        <p className="muted" style={{ margin: 0 }}>Todavía no cargó series.</p>
      </div>
    );
  }
  const last = sessions[0];
  const byEx: Record<string, any[]> = {};
  loaded
    .filter((l) => l.log_date === last)
    .forEach((l) => {
      (byEx[l.exercise_id] = byEx[l.exercise_id] || []).push(l);
    });
  return (
    <div style={wrap}>
      {head}
      <div className="muted" style={{ fontSize: ".85rem", marginBottom: 8 }}>
        Última sesión: <b style={{ color: "#fff" }}>{fmt(last)}</b> · {sessions.length} sesiones
        registradas
      </div>
      {Object.keys(byEx).map((exId) => {
        const sets = [...byEx[exId]].sort((a, b) => a.set_number - b.set_number);
        return (
          <div key={exId} style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 600, color: "#f8fafc", marginBottom: 6, fontSize: ".85rem" }}>
              {names[exId] ?? "Ejercicio"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sets.map((set, index) => (
                <div
                  key={set.id || index}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: ".8rem",
                    padding: "6px 10px",
                    background: "#0f0f0f",
                    borderRadius: 6,
                    border: "1px solid #242424",
                  }}
                >
                  <span style={{ color: "#d4d4d8" }}>
                    {Number(set.set_number) === 0
                      ? "Calentamiento"
                      : `Serie ${set.set_number} (Efectiva)`}{" "}
                  </span>
                  <span style={{ fontFamily: "monospace", color: "#FFC400", fontWeight: 500 }}>
                    {set.actual_reps ?? "-"} reps @ {set.actual_weight ?? "-"} kg
                    {set.rir != null && set.rir !== "" ? ` · RIR ${set.rir}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Última sesión cargada por el alumno para un ejercicio. Se vincula por
// exercise_id (camino principal) y, si ese vínculo se perdió al recrear el
// ejercicio, por nombre + rutina como respaldo. Nunca toca la rutina.
function latestStudentLogs(
  logs: any[],
  opts: { exerciseId?: string; exerciseName?: string; routineId?: string }
): { date: string; sets: any[] } | null {
  const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
  const sameRoutine = (l: any) =>
    !opts.routineId || !l.routine_id || String(l.routine_id) === opts.routineId;
  const byId = opts.exerciseId
    ? logs.filter(
        (l) => sameRoutine(l) && String(l.exercise_id ?? "") === opts.exerciseId
      )
    : [];
  const name = norm(opts.exerciseName);
  const matches =
    byId.length > 0
      ? byId
      : name
      ? logs.filter(
          (l) =>
            sameRoutine(l) &&
            (norm(l.exercise_name) === name || norm(l.exercises?.name) === name)
        )
      : [];
  const loaded = matches.filter(
    (l) => l.actual_reps != null || l.actual_weight != null
  );
  if (!loaded.length) return null;
  const dates = Array.from(new Set(loaded.map((l) => String(l.log_date ?? ""))))
    .filter(Boolean)
    .sort()
    .reverse();
  if (!dates.length) return null;
  const date = dates[0];
  const sets = loaded
    .filter((l) => String(l.log_date ?? "") === date && Number(l.set_number) > 0)
    .sort((a, b) => Number(a.set_number) - Number(b.set_number));
  if (!sets.length) return null;
  return { date, sets };
}

function RoutineSummary({ routines, guideline }: { routines: any[]; guideline?: string }) {
  const active = routines.filter((r) => r.active !== false);
  const wrap = { marginTop: 16, paddingTop: 14, borderTop: "1px solid #242424" };
  const head = (
    <h4
      style={{
        margin: "0 0 10px",
        fontSize: ".74rem",
        letterSpacing: ".12em",
        textTransform: "uppercase",
        color: "#FFC400",
      }}
    >
      Rutina activa
    </h4>
  );
  if (active.length === 0) {
    return (
      <div style={wrap}>
        {head}
        <p className="muted" style={{ margin: 0 }}>Sin rutina activa.</p>
      </div>
    );
  }
  const byWeek: Record<number, any[]> = {};
  active.forEach((r) => {
    const w = Number(r.week_number) || 1;
    (byWeek[w] = byWeek[w] || []).push(r);
  });
  const weekKeys = Object.keys(byWeek).map(Number).sort((a, b) => a - b);

  return (
    <div style={wrap}>
      {head}
      {guideline && (
        <p
          style={{
            margin: "0 0 10px",
            fontSize: ".85rem",
            color: "#A6A6A6",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            overflowWrap: "anywhere",
          }}
        >
          {guideline}
        </p>
      )}
      {weekKeys.map((w) => {
        const days = [...byWeek[w]].sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));
        const total = days.reduce((acc, d) => acc + (d.exercises ?? []).length, 0);
        return (
          <div key={w} style={{ marginBottom: 10 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                padding: "6px 0",
                borderBottom: "1px solid #242424",
                fontSize: ".85rem",
              }}
            >
              <span style={{ fontWeight: 700, color: "#FFC400" }}>Semana {w}</span>
              <span className="muted">{days.length} días · {total} ejercicios</span>
            </div>
            {days.map((d, di) => {
              const exs = [...(d.exercises ?? [])].sort(
                (a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0)
              );
              return (
                <details key={d.id ?? di} style={{ borderBottom: "1px solid #1c1c1c" }}>
                  <summary
                    style={{
                      cursor: "pointer",
                      listStyle: "none",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 0",
                      fontSize: ".85rem",
                      fontWeight: 600,
                      minWidth: 0,
                    }}
                  >
                    <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                      {d.day_name || d.name || `Día ${di + 1}`}
                    </span>
                    <span className="muted" style={{ fontWeight: 400, whiteSpace: "nowrap" }}>
                      {exs.length} ej.
                    </span>
                  </summary>
                  <ul style={{ listStyle: "none", margin: "0 0 8px", padding: 0 }}>
                    {exs.map((ex: any, ei: number) => (
                      <li
                        key={ei}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(0, 1fr) auto",
                          gap: 8,
                          padding: "4px 0",
                          fontSize: ".8rem",
                          borderTop: "1px dashed #1c1c1c",
                        }}
                      >
                        <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                          {ei + 1}. {ex.name}
                        </span>
                        <span className="muted" style={{ whiteSpace: "nowrap" }}>
                          {ex.target_sets ?? "-"} × {ex.target_reps ?? "-"}
                          {ex.target_weight ? ` · ${ex.target_weight} ${ex.unit ?? "kg"}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

export default function CoachDashboard() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [coach, setCoach] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [filter, setFilter] = useState<"pending" | "active" | "all">("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [blockGuideline, setBlockGuideline] = useState("");
  const [blockSaving, setBlockSaving] = useState(false);
  const [tab, setTab] = useState<
    "historial" | "perfil" | "importar" | "generar" | "nutricion" | "acceso"
  >("historial");

  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [baseline, setBaseline] = useState<ExRow[] | null>(null);
  const [nutrition, setNutrition] = useState<NutritionPlan>(emptyNutrition());
  const [newClient, setNewClient] = useState({ email: "", full_name: "", pin: "" });
  const [pinFor, setPinFor] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [importText, setImportText] = useState("");
  const [importDays, setImportDays] = useState<ParsedDay[] | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [program, setProgram] = useState<GeneratedProgram | null>(null);
  const [editingProgram, setEditingProgram] = useState(false);
  const [publishingProgram, setPublishingProgram] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pushStatus, setPushStatus] = useState<
    "checking" | "idle" | "on" | "denied" | "unsupported" | "busy"
  >("checking");

  // La ficha del alumno es siempre inmersiva: al elegir un cliente se bloquea
  // el scroll del listado y Escape vuelve a la lista.
  useEffect(() => {
    if (!selectedId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSelectedId(null);
      setDetail(null);
      setProgram(null);
      setEditingProgram(false);
      setConfirmDelete(false);
      setMsg(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [selectedId]);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && j.profile) {
          if (j.profile.role !== "coach") {
            router.replace("/app");
            return;
          }
          setCoach(j.profile);
          loadClients();
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (!coach) return;
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setPushStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setPushStatus("denied");
      return;
    }
    navigator.serviceWorker
      .getRegistration()
      .then(async (reg) => {
        if (!reg) {
          setPushStatus("idle");
          return;
        }
        const sub = await reg.pushManager.getSubscription();
        setPushStatus(sub ? "on" : "idle");
      })
      .catch(() => setPushStatus("idle"));
  }, [coach]);

  const loadClients = async () => {
    const res = await fetch("/api/coach/clients", { cache: "no-store" });
    const json = await res.json();
    if (json.ok) {
      const list: ClientRow[] = [...(json.clients ?? [])];
      list.sort((a, b) => {
        const pa = a.routine_status === "pending_review" ? 0 : 1;
        const pb = b.routine_status === "pending_review" ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return (a.full_name || a.email).localeCompare(b.full_name || b.email);
      });
      setClients(list);
    }
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, pin }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      if (json.profile.role !== "coach") {
        router.replace("/app");
        return;
      }
      setCoach(json.profile);
      await loadClients();
    } catch (err: any) {
      setAuthError(err.message || "No se pudo ingresar");
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setCoach(null);
    setClients([]);
    setDetail(null);
  };

  const enablePush = async () => {
    try {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        setPushStatus("unsupported");
        setMsg({ type: "err", text: "Este navegador no soporta notificaciones." });
        return;
      }
      if (!VAPID_PUBLIC_KEY) {
        setPushStatus("unsupported");
        setMsg({ type: "err", text: "Falta configurar las claves VAPID." });
        return;
      }
      const applicationServerKey = safeBase64ToUint8Array(VAPID_PUBLIC_KEY);
      if (!applicationServerKey) {
        setPushStatus("idle");
        setMsg({
          type: "err",
          text: "La clave pública VAPID no es válida. Revisá NEXT_PUBLIC_VAPID_PUBLIC_KEY.",
        });
        return;
      }
      setPushStatus("busy");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushStatus("denied");
        setMsg({ type: "err", text: "Permiso de notificaciones denegado." });
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as BufferSource,
        });
      }
      const res = await fetch("/api/coach/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      const json = await res.json();
      if (json.ok) {
        setPushStatus("on");
        setMsg({
          type: "ok",
          text: `Notificaciones activadas en este dispositivo${json.devices ? ` (${json.devices})` : ""}.`,
        });
      } else {
        setPushStatus("idle");
        setMsg({ type: "err", text: json.error || "No se pudieron activar." });
      }
    } catch (err: any) {
      setPushStatus("idle");
      setMsg({ type: "err", text: err?.message || "No se pudo activar las notificaciones." });
    }
  };


  const syncNutrition = (json: any) => {
    const np = json?.profile?.nutrition_plan as NutritionPlan | null | undefined;
    setNutrition(
      np
        ? { ...emptyNutrition(), ...np, meals: Array.isArray(np.meals) ? np.meals : [] }
        : emptyNutrition()
    );
  };

  const syncBlock = (json: any) => {
    const tb = json?.profile?.anamnesis?.trainingBlock as
      | { guideline?: string; weeks?: number }
      | undefined;
    setBlockGuideline(tb?.guideline ?? "");
  };

  const saveBlock = async () => {
    if (!selectedId) return;
    setBlockSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/coach/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: selectedId, guideline: blockGuideline, weeks: 6 }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "No se pudo guardar");
      setMsg({ type: "ok", text: "Guía del bloque guardada." });
    } catch (err: any) {
      setMsg({ type: "err", text: err?.message || "Error al guardar" });
    } finally {
      setBlockSaving(false);
    }
  };

  const selectClient = async (id: string) => {
    setSelectedId(id);
    setTab("historial");
    setMsg(null);
    setDraft(emptyDraft());
    setBaseline(null);
    setImportText("");
    setImportDays(null);
    setProgram(null);
    setEditingProgram(false);
    setConfirmDelete(false);
    const res = await fetch(`/api/coach/client?id=${id}`);
    const json = await res.json();
    if (json.ok) {
      setDetail(json);
      syncNutrition(json);
      syncBlock(json);
    }
  };

  const reloadDetail = async () => {
    if (!selectedId) return;
    const res = await fetch(`/api/coach/client?id=${selectedId}`);
    const json = await res.json();
    if (json.ok) {
      setDetail(json);
      syncNutrition(json);
      syncBlock(json);
    }
  };

  // Refresco silencioso para el espejo en vivo: sólo actualiza los datos de
  // progreso del alumno (series, audios, rutinas y anamnesis), sin pisar
  // ediciones en curso (nutrición / guía del bloque).
  const refreshProgress = async (): Promise<void> => {
    if (!selectedId) return;
    const id = selectedId;
    const res = await fetch(`/api/coach/client?id=${id}`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!json?.ok) return;
    setDetail((prev: any) => {
      if (!prev) return json;
      return {
        ...prev,
        logs: json.logs ?? [],
        audio: json.audio ?? [],
        routines: json.routines ?? prev.routines,
        changes: json.changes ?? prev.changes,
        profile: {
          ...prev.profile,
          anamnesis: json.profile?.anamnesis ?? prev.profile?.anamnesis,
          routine_status: json.profile?.routine_status ?? prev.profile?.routine_status,
        },
      };
    });
  };

  // Sincronización automática del panel del coach: refresca la lista de
  // alumnos y la ficha abierta cada 20 s (sólo con la pestaña visible) y al
  // volver a la pestaña/ventana. Así las series que carga el alumno aparecen
  // sin recargar la página.
  useEffect(() => {
    if (!coach) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      try {
        await loadClients();
        // En la pestaña Perfil el "Espejo de entrenamiento" ya refresca solo
        // cada 20 s; evitamos duplicar la descarga de series.
        if (selectedId) await refreshProgress();
      } catch {
        /* la próxima pasada reintenta */
      }
    };
    const interval = window.setInterval(tick, 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    const onFocus = () => tick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coach, selectedId, tab]);

  const setMeal = (idx: number, col: 0 | 1, value: string) => {
    setNutrition((n) => ({
      ...n,
      meals: n.meals.map((m, i) =>
        i === idx ? (col === 0 ? [value, m[1]] : [m[0], value]) : m
      ) as [string, string][],
    }));
  };

  const saveNutrition = async () => {
    if (!selectedId) return;
    const res = await fetch("/api/coach/nutrition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: selectedId, nutrition }),
    });
    const json = await res.json();
    if (json.ok) {
      setMsg({ type: "ok", text: "Plan nutricional guardado." });
      await reloadDetail();
    } else {
      setMsg({ type: "err", text: json.error || "Error" });
    }
  };

  const approve = async () => {
    if (!selectedId) return;
    const res = await fetch("/api/coach/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: selectedId }),
    });
    const json = await res.json();
    if (json.ok) {
      setMsg({ type: "ok", text: "Rutina aprobada y publicada." });
      setFilter("active");
      await loadClients();
      await reloadDetail();
    } else {
      setMsg({ type: "err", text: json.error || "Error" });
    }
  };

  const markSeen = async () => {
    if (!selectedId) return;
    const res = await fetch("/api/coach/client-seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: selectedId }),
    });
    const json = await res.json();
    if (json.ok) {
      setMsg({ type: "ok", text: "Marcado como visto." });
      await loadClients();
      await reloadDetail();
      setSelectedId(selectedId);
    } else {
      setMsg({ type: "err", text: json.error || "Error" });
    }
  };

  const parseImport = async () => {
    if (!importText.trim()) {
      setMsg({ type: "err", text: "Pegá el texto de la rutina primero." });
      return;
    }
    setMsg(null);
    setParsing(true);
    setImportDays(null);
    try {
      const res = await fetch("/api/coach/parse-routine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: importText }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      if (!json.days?.length) {
        setMsg({ type: "err", text: "No se pudo reconocer ninguna rutina en el texto." });
        return;
      }
      setImportDays(json.days);
      setMsg({ type: "ok", text: "Rutina estructurada. Revisá la vista previa." });
    } catch (err: any) {
      setMsg({ type: "err", text: err.message || "No se pudo procesar el texto." });
    } finally {
      setParsing(false);
    }
  };

  const approveImport = async () => {
    if (!selectedId || !importDays?.length) return;
    setMsg(null);
    setImporting(true);
    try {
      const res = await fetch("/api/coach/import-routine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: selectedId, days: importDays }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setMsg({ type: "ok", text: "Rutina reemplazada y publicada para el cliente." });
      setImportText("");
      setImportDays(null);
      await loadClients();
      await reloadDetail();
    } catch (err: any) {
      setMsg({ type: "err", text: err.message || "No se pudo publicar la rutina." });
    } finally {
      setImporting(false);
    }
  };

  const generatePlan = async () => {
    if (!selectedId) return;
    setMsg(null);
    setGenerating(true);
    setProgram(null);
    try {
      const res = await fetch("/api/coach/generate-program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: selectedId }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setProgram(json.program);
      setEditingProgram(true);
      setMsg({ type: "ok", text: "Plan generado. Editalo y publicalo cuando esté listo." });
    } catch (err: any) {
      setMsg({ type: "err", text: err.message || "No se pudo generar el plan." });
    } finally {
      setGenerating(false);
    }
  };

  const publishProgram = async (edited: GeneratedProgram) => {
    if (!selectedId) return;
    setMsg(null);
    setPublishingProgram(true);
    try {
      const weeksCount = Math.max(1, edited.block?.weeks ?? 6);
      const weeks = Array.from({ length: weeksCount }, (_, i) => {
        const weekNumber = i + 1;
        return {
          week_number: weekNumber,
          days: edited.days.map((d) => ({
            dia: d.dia,
            nombre: d.nombre,
            ejercicios: d.ejercicios.map((ex) => {
              const t = ex.progresion?.find((p) => p.sem === weekNumber);
              return {
                ejercicio: ex.ejercicio,
                series: ex.series,
                reps: t?.reps ?? ex.reps,
                peso: t?.peso ?? ex.base_weight ?? null,
                rir: t?.rir ?? null,
                descanso: ex.descanso,
                notas: ex.notas,
              };
            }),
          })),
        };
      });

      const routineRes = await fetch("/api/coach/import-routine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: selectedId, weeks }),
      });
      const routineJson = await routineRes.json();
      if (!routineJson.ok) throw new Error(routineJson.error);

      if (edited.block) {
        await fetch("/api/coach/block", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: selectedId,
            guideline: edited.block.guideline ?? "",
            weeks: weeksCount,
          }),
        });
      }

      const nutritionRes = await fetch("/api/coach/nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: selectedId, nutrition: edited.nutrition }),
      });
      const nutritionJson = await nutritionRes.json();
      if (!nutritionJson.ok) throw new Error(nutritionJson.error);

      setNutrition(edited.nutrition);
      setBlockGuideline(edited.block?.guideline ?? "");
      setEditingProgram(false);
      setProgram(null);
      setTab("perfil");
      setMsg({ type: "ok", text: `Plan publicado (bloque de ${weeksCount} semanas).` });
      await loadClients();
      await reloadDetail();
    } catch (err: any) {
      setMsg({ type: "err", text: err.message || "No se pudo publicar el plan." });
    } finally {
      setPublishingProgram(false);
    }
  };

  const deleteClient = async () => {
    if (!selectedId) return;
    setMsg(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/coach/client?id=${selectedId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setConfirmDelete(false);
      setSelectedId(null);
      setDetail(null);
      setProgram(null);
      setMsg({ type: "ok", text: "Cliente eliminado." });
      await loadClients();
    } catch (err: any) {
      setMsg({ type: "err", text: err.message || "No se pudo eliminar el cliente." });
    } finally {
      setDeleting(false);
    }
  };

  const backToClients = () => {
    setSelectedId(null);
    setDetail(null);
    setProgram(null);
    setEditingProgram(false);
    setConfirmDelete(false);
    setMsg(null);
  };


  const setEx = (idx: number, patch: Partial<ExRow>) => {
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    }));
  };

  const persistExerciseSets = async (exerciseId: string, sets: number) => {
    const res = await fetch("/api/coach/exercise-sets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exercise_id: exerciseId, target_sets: sets }),
    });
    const json = await res.json().catch(() => ({ ok: false, error: "Error" }));
    if (!json.ok) {
      setMsg({ type: "err", text: json.error || "No se pudo guardar la serie." });
      return;
    }
    await reloadDetail();
  };

  const saveRoutine = async () => {
    if (!selectedId) return;
    if (!draft.exercises.some((e) => e.name.trim())) {
      setMsg({ type: "err", text: "Agregá al menos un ejercicio." });
      return;
    }
    const payload = {
      ...(draft.id ? { id: draft.id } : { client_id: selectedId }),
      name: draft.name || draft.day_name || "Rutina",
      day_name: draft.day_name,
      week_number: draft.week_number,
      position: draft.position,
      active: draft.active,
      exercises: draft.exercises
        .filter((e) => e.name.trim())
        .map((e, i) => ({
          name: e.name.trim(),
          id: e.id,
          video_url: e.video_url.trim(),
          technique_notes: notesWithRir(e.technique_notes, e.target_rir),
          order_index: i,
          target_sets: e.target_sets,
          target_reps: e.target_reps,
          target_weight: e.target_weight,
          unit: e.unit,
        })),
    };
    const res = await fetch("/api/coach/routine", {
      method: draft.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.ok) {
      setMsg({ type: "ok", text: draft.id ? "Rutina actualizada." : "Rutina creada." });
      setDraft(emptyDraft());
      setBaseline(null);
      await reloadDetail();
    } else {
      setMsg({ type: "err", text: json.error || "Error" });
    }
  };

  const editRoutine = async (r: any) => {
    // Traemos la última actividad real del alumno antes de abrir el editor,
    // así los objetivos se completan sin esperar al refresco de 20 s.
    let logs: any[] = detail?.logs ?? [];
    if (selectedId) {
      try {
        const res = await fetch(`/api/coach/client?id=${selectedId}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (json?.ok) {
          logs = json.logs ?? [];
          setDetail((prev: any) =>
            prev
              ? {
                  ...prev,
                  logs,
                  audio: json.audio ?? prev.audio,
                  routines: json.routines ?? prev.routines,
                }
              : json
          );
        }
      } catch {
        /* si falla, usamos lo que ya estaba cargado */
      }
    }

    const baseRows: ExRow[] = (r.exercises ?? [])
      .slice()
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((e: any) => ({
        name: e.name,
        id: e.id,
        video_url: e.video_url ?? "",
        technique_notes: e.technique_notes ?? "",
        target_sets: e.target_sets != null ? String(e.target_sets) : "",
        target_reps: e.target_reps != null ? String(e.target_reps) : "",
        target_weight: e.target_weight != null ? String(e.target_weight) : "",
        target_rir: rirFromNotes(e.technique_notes ?? ""),
        unit: e.unit ?? "kg",
      }));

    // La última sesión del alumno se vuelca en el objetivo de series. El
    // objetivo anterior queda como referencia fantasma en la tabla.
    const exercises: ExRow[] = baseRows.map((row) => {
      const latest = latestStudentLogs(logs, {
        exerciseId: row.id,
        exerciseName: row.name,
        routineId: r.id,
      });
      if (!latest) return row;
      const first = latest.sets[0];
      const plannedSets = parseInt(row.target_sets, 10) || 0;
      return {
        ...row,
        target_sets: String(Math.max(plannedSets, latest.sets.length)),
        target_reps:
          first?.actual_reps != null ? String(first.actual_reps) : row.target_reps,
        target_weight:
          first?.actual_weight != null ? String(first.actual_weight) : row.target_weight,
      };
    });

    setDraft({
      id: r.id,
      name: r.name,
      day_name: r.day_name,
      week_number: String(r.week_number),
      position: String(r.position),
      active: r.active,
      exercises,
    });
    setBaseline(baseRows.map((e) => ({ ...e })));
    setTab("perfil");
    setMsg(null);
  };

  const deleteRoutine = async (id: string) => {
    if (!confirm("¿Eliminar esta rutina del día?")) return;
    const res = await fetch(`/api/coach/routine?id=${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.ok) {
      setMsg({ type: "ok", text: "Rutina eliminada." });
      await reloadDetail();
    } else {
      setMsg({ type: "err", text: json.error || "Error" });
    }
  };

  const createClient = async () => {
    const res = await fetch("/api/coach/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newClient),
    });
    const json = await res.json();
    if (json.ok) {
      setMsg({ type: "ok", text: "Cliente creado." });
      setNewClient({ email: "", full_name: "", pin: "" });
      await loadClients();
    } else {
      setMsg({ type: "err", text: json.error || "Error" });
    }
  };

  const savePin = async () => {
    if (!selectedId) return;
    const res = await fetch("/api/coach/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: selectedId, pin: pinFor }),
    });
    const json = await res.json();
    if (json.ok) {
      setMsg({ type: "ok", text: "PIN actualizado." });
      setPinFor("");
      await loadClients();
    } else {
      setMsg({ type: "err", text: json.error || "Error" });
    }
  };

  if (checking) {
    return (
      <main className="auth-wrap">
        <p className="muted">Cargando…</p>
      </main>
    );
  }

  if (!coach) {
    return (
      <main className="auth-wrap">
        <div className="auth-card card">
          <p className="auth-logo">Nocito Coach</p>
          <h1 style={{ margin: "0 0 4px", fontSize: "1.5rem" }}>Panel del coach</h1>
          <p className="muted" style={{ marginTop: 0 }}>
            Acceso exclusivo de José.
          </p>
          <form onSubmit={login} style={{ display: "grid", gap: 14, marginTop: 16 }}>
            <div>
              <label className="lbl">Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="lbl">PIN</label>
              <input
                className="input"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                style={{ letterSpacing: "0.5em", textAlign: "center", fontSize: "1.3rem" }}
                required
              />
            </div>
            <button className="btn btn-primary" disabled={authLoading}>
              {authLoading ? "Ingresando…" : "Ingresar"}
            </button>
            {authError && <div className="toast err">{authError}</div>}
          </form>
        </div>
      </main>
    );
  }

  const selected = clients.find((c) => c.id === selectedId);
  const foodLogs = ((detail?.profile?.anamnesis?.foodLogs ?? {}) as FoodLogs);
  const clientWa = waLink(detail?.profile?.phone);
  const foodDates = Object.keys(foodLogs)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 14);
  const foodTargets = (detail?.profile?.nutrition_plan ?? nutrition) as NutritionPlan;
  const pendingCount = clients.filter(
    (c) => c.routine_status === "pending_review"
  ).length;
  const activeCount = clients.length - pendingCount;
  const visibleClients =
    filter === "pending"
      ? clients.filter((c) => c.routine_status === "pending_review")
      : filter === "active"
      ? clients.filter((c) => c.routine_status !== "pending_review")
      : clients;

  return (
    <main className="section">
      <div className="container">
        <div className="topbar sticky">
          <div className="topbar-title">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="brand-logo"
              src="/img/logo-nocitocoach.webp"
              width={636}
              height={547}
              alt="Nocito Coach"
              decoding="async"
            />
            <div>
              <h1>Panel de {coach.full_name || "José"}</h1>
              <span className="muted" style={{ fontSize: ".9rem" }}>
                {clients.length} clientes
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {selected && (
              <button className="btn btn-outline" onClick={backToClients}>
                ← Volver a Clientes
              </button>
            )}
            <button
              className={`btn ${pushStatus === "on" ? "btn-outline" : "btn-primary"}`}
              onClick={enablePush}
              disabled={
                pushStatus === "busy" ||
                pushStatus === "on" ||
                pushStatus === "unsupported" ||
                pushStatus === "checking"
              }
              title={
                pushStatus === "unsupported"
                  ? "Este navegador no soporta notificaciones push"
                  : undefined
              }
            >
              {pushStatus === "on"
                ? "Notificaciones activadas"
                : pushStatus === "busy"
                ? "Activando…"
                : pushStatus === "denied"
                ? "Notificaciones bloqueadas"
                : pushStatus === "unsupported"
                ? "Notificaciones no disponibles"
                : pushStatus === "checking"
                ? "Verificando…"
                : "Activar notificaciones"}
            </button>
            <button className="btn btn-outline" onClick={logout}>
              Salir
            </button>
          </div>
        </div>

        {!selected ? (
          <div className="coach-layout">
            <aside className="card">
            <div className="row-between" style={{ marginBottom: 12, gap: 8 }}>
              <h3 style={{ margin: 0 }}>Clientes</h3>
              {pendingCount > 0 && (
                <span className="pill pending">
                  {pendingCount} pendiente{pendingCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="tabs" style={{ margin: "0 0 12px" }}>
              <button
                className={`chip ${filter === "pending" ? "active" : ""}`}
                onClick={() => setFilter("pending")}
              >
                Pendientes ({pendingCount})
              </button>
              <button
                className={`chip ${filter === "active" ? "active" : ""}`}
                onClick={() => setFilter("active")}
              >
                Activos ({activeCount})
              </button>
              <button
                className={`chip ${filter === "all" ? "active" : ""}`}
                onClick={() => setFilter("all")}
              >
                Todos ({clients.length})
              </button>
            </div>
            {visibleClients.length === 0 && (
              <p className="muted">
                {clients.length === 0
                  ? "Sin clientes todavía."
                  : "No hay clientes pendientes."}
              </p>
            )}
            {visibleClients.map((c) => {
              const pending = c.routine_status === "pending_review";
              return (
                <button
                  key={c.id}
                  className={`list-item ${selectedId === c.id ? "active" : ""} ${
                    pending ? "pending" : ""
                  }`}
                  onClick={() => selectClient(c.id)}
                >
                  <div className="row-between" style={{ gap: 8 }}>
                    <strong>{c.full_name || c.email}</strong>
                    <span className={`pill ${pending ? "pending" : "active"}`}>
                      {pending ? "Pendiente" : "Activa"}
                    </span>
                  </div>
                  <small>
                    {c.email} · {c.has_pin ? "PIN ok" : "sin PIN"}
                  </small>
                  {c.has_client_update && (
                    <span className="update-flag">● Actualizó datos</span>
                  )}
                </button>
              );
            })}
          </aside>

          <section>
            <div className="card">
              <p className="muted">Seleccioná un cliente para ver su actividad.</p>
            </div>
          </section>
        </div>
        ) : (
          <div className="coach-focus">
                <div className="focus-bar">
                  <div style={{ minWidth: 0 }}>
                    <span className="focus-eyebrow">Ficha del alumno</span>
                    <h2 style={{ margin: "4px 0 0", fontSize: "1.15rem" }}>
                      {selected.full_name || selected.email}
                    </h2>
                    <div className="focus-meta">
                      <span className="badge">
                        {selected.routine_status === "pending_review"
                          ? "Pendiente de revisión"
                          : "Rutina activa"}
                      </span>
                      <button
                        className="btn btn-primary"
                        onClick={backToClients}
                        style={{ padding: "4px 10px", fontSize: ".78rem", marginLeft: 4 }}
                      >
                        Ver todos los clientes
                      </button>
                      {selected.has_client_update && (
                        <span className="pill update">● Actualizó datos</span>
                      )}
                    </div>
                  </div>
                  <div className="focus-actions">
                    {selected.routine_status === "pending_review" && (
                      <button className="btn btn-primary" onClick={approve}>
                        Aprobar y Publicar
                      </button>
                    )}
                    <button className="btn btn-outline" onClick={() => void reloadDetail()}>
                      Actualizar ahora
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={() => {
                        if (!selectedId) return;
                        const a = document.createElement("a");
                        a.href = `/api/coach/export-routine-pdf?id=${encodeURIComponent(selectedId)}`;
                        a.download = `Rutina.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                      }}
                      style={{ borderColor: "#FFC400", color: "#FFC400" }}
                    >
                      Exportar PDF
                    </button>
                    <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
                      Eliminar cliente
                    </button>
                  </div>
                </div>

                {confirmDelete && (
                  <div
                    className="modal-overlay"
                    onClick={() => !deleting && setConfirmDelete(false)}
                  >
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                      <h3 style={{ marginTop: 0 }}>Eliminar cliente</h3>
                      <p style={{ marginTop: 0, lineHeight: 1.6 }}>
                        ¿Seguro que querés eliminar a{" "}
                        <strong>{selected.full_name || selected.email}</strong>? Se borran su perfil,
                        rutinas, registros de entrenamiento y audios. Esta acción no se puede deshacer.
                      </p>
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          justifyContent: "flex-end",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          className="btn btn-outline"
                          onClick={() => setConfirmDelete(false)}
                          disabled={deleting}
                        >
                          Cancelar
                        </button>
                        <button className="btn btn-danger" onClick={deleteClient} disabled={deleting}>
                          {deleting ? "Eliminando…" : "Eliminar definitivamente"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {editingProgram && program && (
                  <ProgramEditor
                    program={program}
                    clientName={selected.full_name || selected.email}
                    onClose={() => setEditingProgram(false)}
                    onPublish={publishProgram}
                    publishing={publishingProgram}
                  />
                )}

                {msg && <div className={`toast ${msg.type}`}>{msg.text}</div>}

                <div className="split">
                  <aside>
                    {detail && (
                      <div className="card" style={{ marginTop: 0 }}>
                        <h3 style={{ marginTop: 0 }}>Ficha del alumno</h3>
                        {selected.has_client_update && (
                          <div className="notice-update">
                            <span>● El cliente actualizó sus datos.</span>
                            <button
                              className="btn btn-outline"
                              onClick={markSeen}
                              style={{ padding: "6px 12px" }}
                            >
                              Marcar como visto
                            </button>
                          </div>
                        )}
                    {detail.profile?.anamnesis ? (
                      <>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
                          gap: 10,
                        }}
                      >
                        <Dato label="Edad" value={`${detail.profile.anamnesis.age} años`} />
                        <Dato label="Sexo" value={detail.profile.anamnesis.sex} />
                        <Dato label="Altura" value={`${detail.profile.anamnesis.height_cm} cm`} />
                        <Dato label="Peso" value={`${detail.profile.anamnesis.weight_kg} kg`} />
                        <Dato
                          label="% de grasa"
                          value={
                            detail.profile.anamnesis.body_fat_pct
                              ? `${detail.profile.anamnesis.body_fat_pct} %`
                              : "Sin dato"
                          }
                        />
                        <Dato
                          label="Objetivo"
                          value={
                            GOAL_LABELS[detail.profile.anamnesis.goal] ??
                            detail.profile.anamnesis.goal
                          }
                        />
                        <Dato
                          label="Alimentación"
                          value={
                            NUTRITION_LABELS[detail.profile.anamnesis.nutrition] ??
                            detail.profile.anamnesis.nutrition
                          }
                        />
                        <Dato
                          label="Lugar de entrenamiento"
                          value={
                            PLACE_LABELS[detail.profile.anamnesis.training_place] ??
                            detail.profile.anamnesis.training_place ??
                            "Sin definir"
                          }
                        />
                        <Dato
                          label="Experiencia"
                          value={
                            EXPERIENCE_LABELS[detail.profile.anamnesis.experience] ??
                            detail.profile.anamnesis.experience ??
                            "Sin definir"
                          }
                        />
                        <Dato
                          label="Días / semana"
                          value={
                            detail.profile.anamnesis.training_days
                              ? `${detail.profile.anamnesis.training_days} días`
                              : "Sin definir"
                          }
                        />
                        <Dato
                          label="Años entrenando"
                          value={
                            detail.profile.anamnesis.training_years != null
                              ? `${detail.profile.anamnesis.training_years} años`
                              : "Sin dato"
                          }
                        />
                        <Dato
                          label="Actividad diaria"
                          value={
                            ACTIVITY_LABELS[detail.profile.anamnesis.activity_level as string] ??
                            "Sin definir"
                          }
                        />
                        <Dato
                          label="Calidad de sueño"
                          value={
                            SLEEP_LABELS[detail.profile.anamnesis.sleep_quality as string] ??
                            "Sin definir"
                          }
                        />
                        <Dato label="Teléfono" value={detail.profile.phone || "Sin dato"} />
                        {(clientWa || detail.profile.phone) && (
                          <div
                            style={{
                              gridColumn: "1 / -1",
                              display: "flex",
                              gap: 10,
                              flexWrap: "wrap",
                              marginTop: 4,
                            }}
                          >
                            {clientWa && (
                              <a
                                className="btn btn-outline"
                                href={clientWa}
                                target="_blank"
                                rel="noreferrer"
                              >
                                WhatsApp
                              </a>
                            )}
                            <a className="btn btn-outline" href={`tel:${detail.profile.phone}`}>
                              Llamar
                            </a>
                          </div>
                        )}
                      </div>
                      <div className="notes-block">
                        <div className="note-item">
                          <span className="note-k">Lesiones / notas</span>
                          <span
                            className={`note-v${
                              detail.profile.anamnesis.injuries ? "" : " note-empty"
                            }`}
                          >
                            {detail.profile.anamnesis.injuries || "Sin notas"}
                          </span>
                        </div>
                        <div className="note-item">
                          <span className="note-k">Restricciones alimentarias</span>
                          <span
                            className={`note-v${
                              detail.profile.anamnesis.food_restrictions ? "" : " note-empty"
                            }`}
                          >
                            {detail.profile.anamnesis.food_restrictions || "Sin restricciones"}
                          </span>
                        </div>
                      </div>
                      <div className="photo-block">
                        <h4>Fotos iniciales</h4>
                        {detail.profile.anamnesis.photos &&
                        Object.values(detail.profile.anamnesis.photos).some(Boolean) ? (
                          <div className="coach-photos">
                            {(["front", "side", "back"] as const).map((k) => {
                              const url = detail.profile.anamnesis.photos[k];
                              const label =
                                k === "front" ? "Frente" : k === "side" ? "Perfil" : "Espalda";
                              return url ? (
                                <a
                                  key={k}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={`Ver ${label}`}
                                >
                                  <img src={url} alt={`Foto ${label}`} />
                                  <span className="ph-label">{label}</span>
                                </a>
                              ) : null;
                            })}
                          </div>
                        ) : (
                          <p className="muted note-empty" style={{ margin: 0 }}>
                            Sin fotos cargadas.
                          </p>
                        )}
                      </div>
                      </>
                    ) : (
                      <p className="muted" style={{ margin: 0 }}>
                        El cliente todavía no completó su ficha inicial.
                      </p>
                    )}
                    <LastSessionBlock logs={detail.logs ?? []} routines={detail.routines ?? []} />
                    {tab !== "perfil" && (
                      <RoutineSummary
                        routines={detail.routines ?? []}
                        guideline={detail.profile?.anamnesis?.trainingBlock?.guideline}
                      />
                    )}
                  </div>
                )}
                  </aside>
                  <div key={tab} className="tab-panel">
                    <div className="tabs detail-tabs">
                      {(
                        ["historial", "perfil", "importar", "generar", "nutricion", "acceso"] as const
                      ).map((t) => (
                        <button
                          key={t}
                          className={`chip ${tab === t ? "active" : ""}`}
                          onClick={() => setTab(t)}
                        >
                          {t === "historial"
                            ? "Historial"
                            : t === "perfil"
                            ? "Perfil"
                            : t === "importar"
                            ? "Importar"
                            : t === "generar"
                            ? "Generar IA"
                            : t === "nutricion"
                            ? "Nutrición"
                            : "Acceso"}
                        </button>
                      ))}
                    </div>

                {tab === "historial" && (
                  <div className="card" style={{ marginTop: 12 }}>
                    <h3 style={{ marginTop: 0 }}>Métricas generales</h3>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                        gap: 12,
                      }}
                    >
                      {[
                        { label: "Clientes", value: clients.length },
                        { label: "Activos", value: clients.filter((c) => c.activo).length },
                        {
                          label: "Rutina publicada",
                          value: clients.filter((c) => c.routine_status === "active").length,
                        },
                        {
                          label: "Pendientes de revisión",
                          value: clients.filter((c) => c.routine_status === "pending_review")
                            .length,
                        },
                        {
                          label: "Con novedades",
                          value: clients.filter((c) => c.has_client_update).length,
                        },
                        { label: "Suspendidos", value: clients.filter((c) => !c.activo).length },
                      ].map((m) => (
                        <div
                          key={m.label}
                          style={{
                            background: "#121212",
                            border: "1px solid #242424",
                            borderRadius: 12,
                            padding: "14px 16px",
                          }}
                        >
                          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#FFC400" }}>
                            {m.value}
                          </div>
                          <div
                            className="muted"
                            style={{
                              fontSize: ".72rem",
                              textTransform: "uppercase",
                              letterSpacing: ".08em",
                            }}
                          >
                            {m.label}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="muted" style={{ fontSize: ".85rem", marginBottom: 0 }}>
                      Series, ejercicios y progreso de cada alumno están en su ficha, pestaña Perfil.
                    </p>
                  </div>
                )}

                {tab === "perfil" && detail && (
                  <div style={{ marginTop: 12 }}>
                    <CoachProfileEditor
                      key={`perfil-${selectedId ?? "none"}`}
                      clientId={selectedId ?? ""}
                      profile={detail.profile}
                      changes={detail.changes ?? []}
                      onSaved={async () => {
                        await loadClients();
                        await reloadDetail();
                      }}
                    />
                  </div>
                )}

                {tab === "importar" && (
                  <div style={{ marginTop: 12 }}>
                    <div className="card">
                      <h3 style={{ marginTop: 0 }}>Importar rutina desde texto</h3>
                      <p className="muted" style={{ marginTop: 0 }}>
                        Pegá la rutina del cuaderno o apunte. El sistema la estructura en días y
                        ejercicios para que la revises antes de publicarla.
                      </p>
                      <textarea
                        className="input import-textarea"
                        rows={10}
                        placeholder={"Ej: Lunes - Tren Superior A\nPress de Banca con Barra 4x6-8 (4-5 min)\nPress Inclinado con Mancuernas 3x8-10 (2-3 min)\n..."}
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                      />
                      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                        <button
                          className="btn btn-primary"
                          onClick={parseImport}
                          disabled={parsing}
                        >
                          {parsing ? "Procesando…" : "Procesar y estructurar"}
                        </button>
                        {importDays && (
                          <button className="btn btn-outline" onClick={() => setImportDays(null)}>
                            Limpiar vista previa
                          </button>
                        )}
                      </div>
                    </div>

                    {importDays && (
                      <div className="card">
                        <h3 style={{ marginTop: 0 }}>Vista previa</h3>
                        <p className="muted" style={{ marginTop: 0 }}>
                          Verificá los bloques antes de enviarlos. Al aprobar, se{" "}
                          <strong>reemplazan</strong> las rutinas actuales del cliente y se publican.
                        </p>

                        {importDays.map((d, di) => (
                          <div className="day-section" key={di}>
                            <h4>
                              {d.nombre}
                              {d.nombre !== d.dia ? (
                                <span className="muted"> · {d.dia}</span>
                              ) : null}
                            </h4>
                            <div className="scroll-x">
                              <table className="data-table" style={{ minWidth: 560 }}>
                                <thead>
                                  <tr>
                                    <th>Ejercicio</th>
                                    <th>Series</th>
                                    <th>Reps</th>
                                    <th>Descanso</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {d.ejercicios.map((ex, ei) => (
                                    <tr key={ei}>
                                      <td>
                                        <b>{ex.ejercicio}</b>
                                      </td>
                                      <td>{ex.series ?? "—"}</td>
                                      <td>{ex.reps ?? "—"}</td>
                                      <td>{ex.descanso ?? "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}

                        <button
                          className="btn btn-success"
                          onClick={approveImport}
                          disabled={importing}
                          style={{ marginTop: 8 }}
                        >
                          {importing ? "Publicando…" : "Aprobar y enviar al cliente"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {tab === "generar" && (
                  <div style={{ marginTop: 12 }}>
                    <div className="card">
                      <h3 style={{ marginTop: 0 }}>Generar plan con IA</h3>
                      <p className="muted" style={{ marginTop: 0, fontSize: ".88rem" }}>
                        Analiza la anamnesis del alumno (edad, sexo, peso, altura, nivel y objetivo) y
                        crea un borrador de rutina + nutrición personalizadas. Se abre en el editor
                        para que lo revises, edites todo y recién ahí lo publiques.
                      </p>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button
                          className="btn btn-primary"
                          onClick={generatePlan}
                          disabled={generating}
                        >
                          {generating
                            ? "Generando plan…"
                            : program
                            ? "Volver a generar"
                            : "Generar plan con IA"}
                        </button>
                        {program && (
                          <>
                            <button
                              className="btn btn-success"
                              onClick={() => setEditingProgram(true)}
                              disabled={generating}
                            >
                              Abrir editor (borrador)
                            </button>
                            <button className="btn btn-outline" onClick={() => setProgram(null)}>
                              Limpiar
                            </button>
                          </>
                        )}
                      </div>
                      {program && (
                        <p className="muted" style={{ margin: "12px 0 0", fontSize: ".9rem" }}>
                          Borrador: <strong>{program.esquema || `${program.days.length} días`}</strong> ·{" "}
                          {program.days.length} días · {program.nutrition.cal} kcal · sin publicar.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {tab === "perfil" && detail && (
                  <div style={{ marginTop: 12 }}>
                    <div className="card" style={{ marginBottom: 16 }}>
                      <h3 style={{ marginTop: 0 }}>Guía del bloque (Sem 1–6)</h3>
                      <p className="muted" style={{ marginTop: 0, fontSize: ".88rem" }}>
                        Texto que ve el alumno arriba de sus semanas. Ej: «Mismas reps, +2,5 kg en
                        los básicos y dejá 2 reps en reserva».
                      </p>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <input
                          className="input"
                          style={{ flex: "1 1 340px" }}
                          value={blockGuideline}
                          onChange={(e) => setBlockGuideline(e.target.value)}
                          placeholder="Indicación de la semana / bloque"
                        />
                        <button
                          className="btn btn-primary"
                          onClick={saveBlock}
                          disabled={blockSaving}
                        >
                          {blockSaving ? "Guardando…" : "Guardar guía"}
                        </button>
                      </div>
                    </div>
                    <div className="card" style={{ marginBottom: 16 }}>
                      <div className="row-between" style={{ marginBottom: 6 }}>
                        <h3 style={{ margin: 0 }}>
                          {draft.id ? "Editar rutina" : "Nueva rutina (día)"}
                        </h3>
                      </div>
                      <div className="grid-4" style={{ marginBottom: 12 }}>
                        <div>
                          <label className="lbl">Día</label>
                          <input
                            className="input"
                            placeholder="Día 1 · Push"
                            value={draft.day_name}
                            onChange={(e) => setDraft({ ...draft, day_name: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="lbl">Semana</label>
                          <input
                            className="input"
                            type="number"
                            value={draft.week_number}
                            onChange={(e) =>
                              setDraft({ ...draft, week_number: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <label className="lbl">Orden</label>
                          <input
                            className="input"
                            type="number"
                            value={draft.position}
                            onChange={(e) => setDraft({ ...draft, position: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="lbl">Activa</label>
                          <select
                            className="input"
                            value={draft.active ? "1" : "0"}
                            onChange={(e) =>
                              setDraft({ ...draft, active: e.target.value === "1" })
                            }
                          >
                            <option value="1">Sí</option>
                            <option value="0">No</option>
                          </select>
                        </div>
                      </div>

                      {draft.exercises.map((ex, idx) => {
                        const base = baseline?.[idx];
                        const setCount = Math.max(
                          1,
                          Math.min(12, parseInt(ex.target_sets, 10) || 1)
                        );
                        const setSets = (n: number) => {
                          const next = Math.max(1, Math.min(12, n));
                          setEx(idx, { target_sets: String(next) });
                          if (ex.id) void persistExerciseSets(ex.id, next);
                        };
                        return (
                          <div key={idx} className="card ex-edit-block">
                            <div className="ex-edit-head">
                              <span className="ex-badge">{idx + 1}</span>
                              <input
                                className="input ex-name-input"
                                placeholder="Nombre del ejercicio"
                                value={ex.name}
                                onChange={(e) => setEx(idx, { name: e.target.value })}
                              />
                              <button
                                className="btn btn-danger"
                                type="button"
                                onClick={() => {
                                  setDraft((d) => ({
                                    ...d,
                                    exercises: d.exercises.filter((_, i) => i !== idx),
                                  }));
                                  setBaseline((b) => (b ? b.filter((_, i) => i !== idx) : b));
                                }}
                              >
                                Quitar
                              </button>
                            </div>

                            <div className="ex-edit-row">
                              <input
                                className="input"
                                placeholder="URL de video (YouTube o mp4)"
                                value={ex.video_url}
                                onChange={(e) => setEx(idx, { video_url: e.target.value })}
                              />
                              <select
                                className="input ex-unit-select"
                                value={ex.unit}
                                onChange={(e) =>
                                  setEx(idx, { unit: e.target.value as "kg" | "lbs" })
                                }
                              >
                                <option value="kg">kg</option>
                                <option value="lbs">lbs</option>
                              </select>
                            </div>

                            <div className="track-head" style={{ marginTop: 12, marginBottom: 4 }}>
                              <h4>Objetivo de series</h4>
                              <div className="set-stepper">
                                <button
                                  type="button"
                                  className="step-btn"
                                  aria-label="Quitar serie"
                                  onClick={() => setSets(setCount - 1)}
                                >
                                  −
                                </button>
                                <span className="step-val">{setCount}</span>
                                <button
                                  type="button"
                                  className="step-btn"
                                  aria-label="Agregar serie"
                                  onClick={() => setSets(setCount + 1)}
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            <table className="track-table coach-track">
                              <thead>
                                <tr>
                                  <th>Series</th>
                                  <th>Reps</th>
                                  <th>Peso ({ex.unit})</th>
                                  <th>RIR</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Array.from({ length: setCount }, (_, i) => (
                                  <tr key={i}>
                                    <td className="set-index">{i + 1}</td>
                                    <td>
                                      <div className="cell-wrap">
                                        {base?.target_reps &&
                                          base.target_reps !== ex.target_reps && (
                                            <span className="phantom">{base.target_reps}</span>
                                          )}
                                        <input
                                          className="num-input"
                                          inputMode="numeric"
                                          placeholder="Reps"
                                          value={ex.target_reps}
                                          onChange={(e) =>
                                            setEx(idx, {
                                              target_reps: e.target.value.replace(/[^\d]/g, ""),
                                            })
                                          }
                                        />
                                      </div>
                                    </td>
                                    <td>
                                      <div className="cell-wrap">
                                        {base?.target_weight &&
                                          base.target_weight !== ex.target_weight && (
                                            <span className="phantom">{base.target_weight}</span>
                                          )}
                                        <input
                                          className="num-input"
                                          inputMode="decimal"
                                          placeholder="kg"
                                          value={ex.target_weight}
                                          onChange={(e) =>
                                            setEx(idx, {
                                              target_weight: e.target.value.replace(
                                                /[^\d.,]/g,
                                                ""
                                              ),
                                            })
                                          }
                                        />
                                      </div>
                                    </td>
                                    <td>
                                      <div className="cell-wrap">
                                        <input
                                          className="num-input rir-input"
                                          inputMode="numeric"
                                          placeholder="—"
                                          value={ex.target_rir}
                                          onChange={(e) =>
                                            setEx(idx, {
                                              target_rir: e.target.value
                                                .replace(/[^\d]/g, "")
                                                .slice(0, 1),
                                            })
                                          }
                                        />
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <p className="muted" style={{ margin: "6px 0 0", fontSize: ".76rem" }}>
                              Se completa con la última sesión del alumno. Ajustá y guardá los
                              cambios.
                            </p>

                            <textarea
                              className="input"
                              placeholder="Técnica (una indicación por línea)"
                              value={ex.technique_notes}
                              onChange={(e) => setEx(idx, { technique_notes: e.target.value })}
                              rows={2}
                              style={{ marginTop: 10 }}
                            />
                            {base?.name && (
                              <span
                                className="muted"
                                style={{ fontSize: ".78rem", display: "block", marginTop: 6 }}
                              >
                                Base: {base.target_sets || "-"}×{base.target_reps || "-"}
                                {base.target_weight ? ` · ${base.target_weight} ${base.unit}` : ""}
                              </span>
                            )}
                          </div>
                        );
                      })}

                      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                        <button
                          className="btn btn-outline"
                          onClick={() => {
                            setDraft((d) => ({ ...d, exercises: [...d.exercises, emptyEx()] }));
                            setBaseline((b) => (b ? [...b, emptyEx()] : b));
                          }}
                        >
                          + Ejercicio
                        </button>
                        <button className="btn btn-primary" onClick={saveRoutine}>
                          {draft.id ? "Guardar cambios" : "Crear rutina"}
                        </button>
                        {draft.id && (
                          <button
                            className="btn btn-outline"
                            onClick={() => {
                              setDraft(emptyDraft());
                              setBaseline(null);
                            }}
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>

                    {(detail.routines ?? []).map((r: any) => (
                      <div className="card" key={r.id} style={{ marginBottom: 12 }}>
                        <div className="row-between">
                          <div>
                            <strong>{r.day_name || r.name}</strong>
                            <div className="muted" style={{ fontSize: ".85rem" }}>
                              Semana {r.week_number} · {(r.exercises ?? []).length} ejercicios ·{" "}
                              {r.active ? "activa" : "inactiva"}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="btn btn-outline" onClick={() => editRoutine(r)}>
                              Editar
                            </button>
                            <button
                              className="btn btn-danger"
                              onClick={() => deleteRoutine(r.id)}
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                        {(r.exercises ?? []).length > 0 && (
                          <div style={{ marginTop: 10, borderTop: "1px solid #242424", paddingTop: 6 }}>
                            {[...r.exercises]
                              .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
                              .map((ex: any) => {
                                const sets = ex.target_sets ?? 1;
                                return (
                                  <div
                                    key={ex.id}
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      gap: 10,
                                      flexWrap: "wrap",
                                      padding: "8px 0",
                                      borderBottom: "1px solid #1c1c1c",
                                    }}
                                  >
                                    <div style={{ minWidth: 0, flex: "1 1 180px" }}>
                                      <div style={{ fontSize: ".9rem", overflowWrap: "anywhere" }}>{ex.name}</div>
                                      <div className="muted" style={{ fontSize: ".78rem" }}>
                                        {ex.target_reps ?? "-"} reps · {ex.target_weight ?? "-"} {ex.unit ?? "kg"}
                                      </div>
                                    </div>
                                    <div className="set-stepper">
                                      <button
                                        type="button"
                                        className="step-btn"
                                        aria-label="Quitar serie"
                                        disabled={sets <= 1}
                                        onClick={() => persistExerciseSets(ex.id, sets - 1)}
                                      >
                                        -
                                      </button>
                                      <span className="step-val">{sets}</span>
                                      <button
                                        type="button"
                                        className="step-btn"
                                        aria-label="Agregar serie"
                                        disabled={sets >= 12}
                                        onClick={() => persistExerciseSets(ex.id, sets + 1)}
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {tab === "nutricion" && (
                  <div style={{ marginTop: 12 }}>
                    <div className="card">
                      <div className="row-between" style={{ marginBottom: 6 }}>
                        <h3 style={{ margin: 0 }}>Plan nutricional</h3>
                      </div>
                      <div className="grid-4" style={{ marginBottom: 10 }}>
                        <div>
                          <label className="lbl">Calorías (kcal)</label>
                          <input
                            className="input"
                            inputMode="numeric"
                            value={nutrition.cal}
                            onChange={(e) =>
                              setNutrition({
                                ...nutrition,
                                cal: Number(e.target.value.replace(/\D/g, "")) || 0,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="lbl">Proteínas (g)</label>
                          <input
                            className="input"
                            inputMode="numeric"
                            value={nutrition.prot}
                            onChange={(e) =>
                              setNutrition({
                                ...nutrition,
                                prot: Number(e.target.value.replace(/\D/g, "")) || 0,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="lbl">Carbohidratos (g)</label>
                          <input
                            className="input"
                            inputMode="numeric"
                            value={nutrition.carbs}
                            onChange={(e) =>
                              setNutrition({
                                ...nutrition,
                                carbs: Number(e.target.value.replace(/\D/g, "")) || 0,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="lbl">Grasas (g)</label>
                          <input
                            className="input"
                            inputMode="numeric"
                            value={nutrition.fat}
                            onChange={(e) =>
                              setNutrition({
                                ...nutrition,
                                fat: Number(e.target.value.replace(/\D/g, "")) || 0,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <label className="lbl">Fuentes de proteína</label>
                        <input
                          className="input"
                          value={nutrition.proteinSources}
                          onChange={(e) =>
                            setNutrition({ ...nutrition, proteinSources: e.target.value })
                          }
                        />
                      </div>

                      <h4 style={{ margin: "18px 0 8px" }}>Comidas</h4>
                      {nutrition.meals.map((m, i) => (
                        <div className="grid-2" key={i} style={{ marginBottom: 8 }}>
                          <input
                            className="input"
                            placeholder="Comida (ej. Desayuno)"
                            value={m[0]}
                            onChange={(e) => setMeal(i, 0, e.target.value)}
                          />
                          <input
                            className="input"
                            placeholder="Sugerencia"
                            value={m[1]}
                            onChange={(e) => setMeal(i, 1, e.target.value)}
                          />
                        </div>
                      ))}

                      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                        <button
                          className="btn btn-outline"
                          onClick={() =>
                            setNutrition((n) => ({
                              ...n,
                              meals: [...n.meals, ["", ""] as [string, string]],
                            }))
                          }
                        >
                          + Comida
                        </button>
                        <button className="btn btn-primary" onClick={saveNutrition}>
                          Guardar nutrición
                        </button>
                      </div>
                    </div>

                    <div className="card" style={{ marginTop: 16 }}>
                      <h3 style={{ marginTop: 0 }}>Comidas registradas por el alumno</h3>
                      <p className="muted" style={{ marginTop: 0 }}>
                        Alimentos fuera del plan que registró el alumno (texto o voz), con el total
                        del día frente a sus objetivos.
                      </p>
                      {foodDates.length === 0 ? (
                        <p className="muted" style={{ margin: 0 }}>
                          El alumno todavía no registró comidas fuera del plan.
                        </p>
                      ) : (
                        <div className="food-coach">
                          {foodDates.map((d) => {
                            const items = (foodLogs[d] ?? []) as FoodItem[];
                            if (items.length === 0) return null;
                            const t = sumFood(items);
                            return (
                              <div className="food-coach-day" key={d}>
                                <div className="food-coach-head">
                                  <strong>{formatFoodDay(d)}</strong>
                                  <span className="food-coach-totals">
                                    {t.cal}
                                    {foodTargets.cal ? ` / ${foodTargets.cal}` : ""} kcal · P{" "}
                                    {t.prot}
                                    {foodTargets.prot ? ` / ${foodTargets.prot}` : ""} · C {t.carbs}
                                    {foodTargets.carbs ? ` / ${foodTargets.carbs}` : ""} · G {t.fat}
                                    {foodTargets.fat ? ` / ${foodTargets.fat}` : ""}
                                  </span>
                                </div>
                                {FOOD_SLOT_ORDER.map((slot) => {
                                  const its = items.filter((it) => it.slot === slot);
                                  if (its.length === 0) return null;
                                  return (
                                    <div className="food-coach-slot" key={slot}>
                                      <div className="food-slot-head">
                                        <span>{FOOD_SLOT_LABELS[slot]}</span>
                                        <span>{sumFood(its).cal} kcal</span>
                                      </div>
                                      {its.map((it) => (
                                        <div className="food-item" key={it.id}>
                                          <div className="food-item-main">
                                            <span>{it.name}</span>
                                            {it.quantity && (
                                              <span className="food-qty">{it.quantity}</span>
                                            )}
                                            <span
                                              className={`food-src${
                                                it.source === "voice" ? " voice" : ""
                                              }`}
                                            >
                                              {it.source === "voice" ? "voz" : "manual"}
                                            </span>
                                          </div>
                                          <div className="food-item-macros">
                                            <span>{it.cal} kcal</span>
                                            <span>P {it.prot}</span>
                                            <span>C {it.carbs}</span>
                                            <span>G {it.fat}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {tab === "acceso" && (
                  <div style={{ marginTop: 12 }}>
                    <div className="card" style={{ marginBottom: 16 }}>
                      <h3 style={{ marginTop: 0 }}>PIN de {selected.full_name || selected.email}</h3>
                      <p className="muted">
                        {selected.has_pin ? "Tiene PIN asignado." : "Sin PIN asignado."}
                      </p>
                      <div className="grid-2">
                        <input
                          className="input"
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="Nuevo PIN (4 dígitos)"
                          value={pinFor}
                          onChange={(e) =>
                            setPinFor(e.target.value.replace(/\D/g, "").slice(0, 4))
                          }
                        />
                        <button className="btn btn-primary" onClick={savePin}>
                          Actualizar PIN
                        </button>
                      </div>
                    </div>

                    <div className="card">
                      <h3 style={{ marginTop: 0 }}>Nuevo cliente</h3>
                      <div className="grid-3">
                        <input
                          className="input"
                          placeholder="Email"
                          value={newClient.email}
                          onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                        />
                        <input
                          className="input"
                          placeholder="Nombre completo"
                          value={newClient.full_name}
                          onChange={(e) =>
                            setNewClient({ ...newClient, full_name: e.target.value })
                          }
                        />
                        <input
                          className="input"
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="PIN (4 dígitos)"
                          value={newClient.pin}
                          onChange={(e) =>
                            setNewClient({
                              ...newClient,
                              pin: e.target.value.replace(/\D/g, "").slice(0, 4),
                            })
                          }
                        />
                      </div>
                      <button
                        className="btn btn-primary"
                        style={{ marginTop: 12 }}
                        onClick={createClient}
                      >
                        Crear cliente
                      </button>
                    </div>
                  </div>
                )}
                  </div>
                </div>
              </div>
            )}
      </div>
    </main>
  );
}

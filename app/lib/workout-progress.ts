import type { Routine, SetLog } from "@/lib/app-types";

// ============================================================
// Modelo de progreso para el panel del coach (espejo + tracker).
// Reconstruye, a partir de las rutinas (todas las semanas), los
// registros de series y los reportes de voz, una vista navegable
// semana -> día -> ejercicio con detección de estancamiento y de
// series por debajo del objetivo.
// ============================================================

export type CoachAudio = {
  id: string;
  exercise_id?: string | null;
  audio_storage_url: string;
  created_at: string;
  exercises?: { name?: string } | null;
};

export type ExerciseStatus = "none" | "logged" | "stalled" | "below";

export interface ProgressSet {
  set_number: number;
  target_reps: number | null;
  target_weight: number | null;
  actual_reps: number | null;
  actual_weight: number | null;
  rir: number | null;
  log_date: string | null;
  logged: boolean;
  belowTarget: boolean;
}

export interface ProgressExercise {
  key: string;
  exerciseId: string | null;
  name: string;
  unit: string;
  targetSets: number | null;
  targetReps: number | null;
  targetWeight: number | null;
  sets: ProgressSet[];
  lastDate: string | null;
  bestWeight: number | null;
  avgReps: number | null;
  totalVolume: number;
  loggedSets: number;
  totalSets: number;
  belowCount: number;
  status: ExerciseStatus;
  weightDelta: number | null;
  prevBestWeight: number | null;
  audio: CoachAudio[];
  suggestion: string;
}

export interface ProgressDay {
  routineId: string;
  dayName: string;
  position: number;
  exercises: ProgressExercise[];
  completed: boolean;
  lastDate: string | null;
  loggedSets: number;
  totalSets: number;
  status: "done" | "active" | "pending";
}

export type WeekStatus = "done" | "active" | "upcoming" | "empty";

export interface ProgressWeek {
  week: number;
  days: ProgressDay[];
  completedDays: number;
  totalDays: number;
  status: WeekStatus;
  alerts: number;
  lastActivity: string | null;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const normalizeName = (s: string | undefined | null): string =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const maxIso = (a: string | null, b: string | null): string | null => {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
};

export function buildCoachProgress(input: {
  routines: Routine[];
  logs: SetLog[];
  setRir?: Record<string, number>;
  audio?: CoachAudio[];
  totalWeeks?: number;
}): ProgressWeek[] {
  const { routines, logs } = input;
  const setRir = input.setRir ?? {};
  const audio = input.audio ?? [];

  const logsByExercise = new Map<string, SetLog[]>();
  for (const l of logs) {
    const arr = logsByExercise.get(l.exercise_id);
    if (arr) arr.push(l);
    else logsByExercise.set(l.exercise_id, [l]);
  }

  const audioByExercise = new Map<string, CoachAudio[]>();
  for (const a of audio) {
    if (!a.exercise_id) continue;
    const arr = audioByExercise.get(a.exercise_id);
    if (arr) arr.push(a);
    else audioByExercise.set(a.exercise_id, [a]);
  }

  const byWeek = new Map<number, Routine[]>();
  for (const r of routines) {
    const w = r.week_number || 1;
    const arr = byWeek.get(w);
    if (arr) arr.push(r);
    else byWeek.set(w, [r]);
  }

  const maxPresent = byWeek.size ? Math.max(...Array.from(byWeek.keys())) : 1;
  const totalWeeks = Math.max(input.totalWeeks ?? 6, maxPresent);

  // Mejor peso registrado la última vez que apareció cada ejercicio
  // (mismo día + mismo nombre), para comparar entre semanas.
  const lastBest = new Map<string, { week: number; best: number | null }>();

  const weeks: ProgressWeek[] = [];

  for (let w = 1; w <= totalWeeks; w++) {
    const dayRoutines = (byWeek.get(w) ?? [])
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const days: ProgressDay[] = [];

    for (const routine of dayRoutines) {
      const dayName = (routine.day_name || routine.name || "").trim();
      const exercises = (routine.exercises ?? [])
        .slice()
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

      const dayExercises: ProgressExercise[] = [];
      let dayLast: string | null = null;
      let dayLogged = 0;
      let dayTotal = 0;

      for (const ex of exercises) {
        const exLogs = (logsByExercise.get(ex.id) ?? [])
          .slice()
          .sort((a, b) => a.set_number - b.set_number);

        const targetSets = num(ex.target_sets) ?? 3;
        const maxLogSet = exLogs.reduce((m, l) => Math.max(m, l.set_number || 0), 0);
        const setCount = Math.max(1, targetSets, maxLogSet);

        const sets: ProgressSet[] = [];
        for (let i = 1; i <= setCount; i++) {
          const log = exLogs.find((l) => l.set_number === i);
          const actualReps = num(log?.actual_reps);
          const targetReps = num(log?.target_reps) ?? num(ex.target_reps);
          sets.push({
            set_number: i,
            target_reps: targetReps,
            target_weight: num(log?.target_weight) ?? num(ex.target_weight),
            actual_reps: actualReps,
            actual_weight: num(log?.actual_weight),
            rir: num(setRir[`${ex.id}|${log?.log_date ?? ""}|${i}`]),
            log_date: log?.log_date ?? null,
            logged:
              !!log && (actualReps !== null || num(log?.actual_weight) !== null),
            belowTarget:
              actualReps !== null && targetReps !== null && actualReps < targetReps,
          });
        }

        const loggedSets = sets.filter((s) => s.logged);
        const belowCount = sets.filter((s) => s.belowTarget).length;
        const weights = loggedSets
          .map((s) => s.actual_weight)
          .filter((n): n is number => n !== null);
        const reps = loggedSets
          .map((s) => s.actual_reps)
          .filter((n): n is number => n !== null);
        const bestWeight = weights.length ? Math.max(...weights) : null;
        const avgReps = reps.length
          ? Math.round((reps.reduce((a, b) => a + b, 0) / reps.length) * 10) / 10
          : null;
        const totalVolume = Math.round(
          loggedSets.reduce(
            (acc, s) => acc + (s.actual_reps ?? 0) * (s.actual_weight ?? 0),
            0
          )
        );
        const lastDate = loggedSets.reduce<string | null>(
          (acc, s) => maxIso(acc, s.log_date),
          null
        );

        const key = `${normalizeName(dayName)}::${normalizeName(ex.name)}`;
        const prev = lastBest.get(key);
        const prevBestWeight =
          prev && prev.week < w && prev.best !== null ? prev.best : null;
        const weightDelta =
          bestWeight !== null && prevBestWeight !== null
            ? Math.round((bestWeight - prevBestWeight) * 10) / 10
            : null;

        const hasLog = loggedSets.length > 0;
        const stalled =
          hasLog && weightDelta !== null && weightDelta <= 0 && belowCount === 0;
        const status: ExerciseStatus = !hasLog
          ? "none"
          : belowCount > 0
          ? "below"
          : stalled
          ? "stalled"
          : "logged";

        dayExercises.push({
          key,
          exerciseId: ex.id,
          name: ex.name,
          unit: ex.unit ?? "kg",
          targetSets: num(ex.target_sets),
          targetReps: num(ex.target_reps),
          targetWeight: num(ex.target_weight),
          sets,
          lastDate,
          bestWeight,
          avgReps,
          totalVolume,
          loggedSets: loggedSets.length,
          totalSets: sets.length,
          belowCount,
          status,
          weightDelta,
          prevBestWeight,
          audio: audioByExercise.get(ex.id) ?? [],
          suggestion: buildSuggestion({
            status,
            weightDelta,
            belowCount,
            unit: ex.unit ?? "kg",
          }),
        });

        // Registra el mejor peso de esta semana para la próxima comparación.
        if (hasLog) lastBest.set(key, { week: w, best: bestWeight });
        else if (!lastBest.has(key)) lastBest.set(key, { week: w, best: null });

        dayLast = maxIso(dayLast, lastDate);
        dayLogged += loggedSets.length;
        dayTotal += sets.length;
      }

      const completed =
        dayExercises.length > 0 && dayExercises.every((e) => e.loggedSets > 0);

      days.push({
        routineId: routine.id,
        dayName,
        position: routine.position ?? 0,
        exercises: dayExercises,
        completed,
        lastDate: dayLast,
        loggedSets: dayLogged,
        totalSets: dayTotal,
        status: completed ? "done" : dayLogged > 0 ? "active" : "pending",
      });
    }

    const totalDays = days.length;
    const completedDays = days.filter((d) => d.completed).length;
    const alerts = days.reduce(
      (acc, d) =>
        acc +
        d.exercises.filter((e) => e.status === "below" || e.status === "stalled").length,
      0
    );
    const lastActivity = days.reduce<string | null>(
      (acc, d) => maxIso(acc, d.lastDate),
      null
    );

    weeks.push({
      week: w,
      days,
      completedDays,
      totalDays,
      status: totalDays === 0 ? "empty" : "upcoming",
      alerts,
      lastActivity,
    });
  }

  // Estado de cada semana: hecha / en curso (primera incompleta) / próxima.
  const firstIncomplete = weeks.find(
    (wk) => wk.totalDays > 0 && wk.completedDays < wk.totalDays
  );
  for (const wk of weeks) {
    if (wk.totalDays === 0) wk.status = "empty";
    else if (wk.completedDays >= wk.totalDays) wk.status = "done";
    else if (firstIncomplete && wk.week === firstIncomplete.week) wk.status = "active";
    else wk.status = "upcoming";
  }

  return weeks;
}

function buildSuggestion(args: {
  status: ExerciseStatus;
  weightDelta: number | null;
  belowCount: number;
  unit: string;
}): string {
  const { status, weightDelta, belowCount, unit } = args;
  if (status === "below") {
    return `No llegó a las reps objetivo (${belowCount} ${
      belowCount === 1 ? "serie" : "series"
    }). Considerá mantener la carga o bajarla 5–10%.`;
  }
  if (status === "stalled") {
    return "Sin progresión de carga vs la semana anterior. Probá +2,5 kg en los básicos o cambiar la variante.";
  }
  if (status === "logged" && weightDelta !== null && weightDelta > 0) {
    return `Buena progresión: +${weightDelta} ${unit} vs la semana anterior.`;
  }
  if (status === "logged") {
    return "Sesión registrada y en rango. Podés subir la carga si la técnica lo permite.";
  }
  return "Sin registro todavía.";
}

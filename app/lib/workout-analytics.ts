import type { Exercise, Routine, SetLog } from "@/lib/app-types";

/**
 * Lógica de detección de adherencia y progreso.
 * Funciones *puras* (sin React) que alimentan al hook `useWorkoutDetection`.
 */

/* ------------------------------------------------------------------ */
/* Fechas (UTC, consistentes con log_date = YYYY-MM-DD)               */
/* ------------------------------------------------------------------ */

export function isoToday(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado. */
export function weekdayOf(iso: string): number {
  return new Date(iso + "T00:00:00Z").getUTCDay();
}

const WEEKDAY_LABELS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
export function weekdayLabel(iso: string): string {
  return WEEKDAY_LABELS[weekdayOf(iso)];
}

function startOfWeekISO(iso: string): string {
  const off = (weekdayOf(iso) + 6) % 7; // días desde el lunes
  return addDaysISO(iso, -off);
}
/** Fecha (ISO) del `weekday` dentro de la semana (lunes inicio) que contiene `today`. */
export function dateOfWeekday(todayISO: string, weekday: number): string {
  const monday = startOfWeekISO(todayISO);
  return addDaysISO(monday, (weekday + 6) % 7);
}

/* ------------------------------------------------------------------ */
/* Calendario de entrenamiento según días/semana                       */
/* ------------------------------------------------------------------ */

/**
 * Distribución profesional de los días de entrenamiento en la semana.
 * Respeta fines de semana solo cuando el plan lo exige (5+ días).
 */
export function scheduleWeekdays(trainingDays: number): number[] {
  const d = Math.max(1, Math.min(6, Math.round(trainingDays) || 3));
  switch (d) {
    case 1:
      return [1];
    case 2:
      return [1, 4];
    case 3:
      return [1, 3, 5];
    case 4:
      return [1, 2, 4, 5];
    case 5:
      return [1, 2, 3, 4, 5];
    default:
      return [1, 2, 3, 4, 5, 6];
  }
}

/* ------------------------------------------------------------------ */
/* Resúmenes                                                          */
/* ------------------------------------------------------------------ */

export interface ExerciseProgress {
  exercise: Exercise;
  logged: boolean;
  setsLogged: number;
  bestWeight: number | null;
  bestReps: number | null;
  volume: number;
}

export interface DaySummary {
  routine: Routine;
  exercises: ExerciseProgress[];
  completedCount: number;
  totalCount: number;
  allCompleted: boolean;
  volume: number;
  setsLogged: number;
  rirAvg: number | null;
  estMinutes: number;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function logsFor(logs: SetLog[], exerciseId: string, date?: string): SetLog[] {
  return logs.filter(
    (l) => l.exercise_id === exerciseId && (!date || l.log_date === date)
  );
}

function isEffective(l: SetLog): boolean {
  return num(l.actual_reps) !== null || num(l.actual_weight) !== null;
}

export function buildExerciseProgress(
  exercise: Exercise,
  logs: SetLog[],
  date?: string
): ExerciseProgress {
  const rows = logsFor(logs, exercise.id, date);
  const effective = rows.filter(isEffective);
  const weights = effective.map((l) => num(l.actual_weight)).filter((n): n is number => n !== null);
  const reps = effective.map((l) => num(l.actual_reps)).filter((n): n is number => n !== null);
  const volume = effective.reduce((sum, l) => {
    const r = num(l.actual_reps) ?? 0;
    const w = num(l.actual_weight) ?? 0;
    return sum + r * w;
  }, 0);
  return {
    exercise,
    logged: effective.length > 0,
    setsLogged: effective.length,
    bestWeight: weights.length ? Math.max(...weights) : null,
    bestReps: reps.length ? Math.max(...reps) : null,
    volume,
  };
}

export function buildDaySummary(
  routine: Routine,
  logs: SetLog[],
  date?: string
): DaySummary {
  const exercises = routine.exercises ?? [];
  const progress = exercises.map((ex) => buildExerciseProgress(ex, logs, date));
  const completedCount = progress.filter((p) => p.logged).length;
  const totalCount = exercises.length;
  const setsLogged = progress.reduce((s, p) => s + p.setsLogged, 0);
  const volume = progress.reduce((s, p) => s + p.volume, 0);

  const rirVals = logsForAny(logs, exercises, date)
    .map((l) => num(l.rir))
    .filter((n): n is number => n !== null);
  const rirAvg = rirVals.length
    ? Math.round((rirVals.reduce((a, b) => a + b, 0) / rirVals.length) * 10) / 10
    : null;

  const targetSets = exercises.reduce((s, e) => s + (e.target_sets ?? 3), 0);
  const estMinutes = Math.max(15, Math.round((targetSets * 3 + exercises.length) / 5) * 5);

  return {
    routine,
    exercises: progress,
    completedCount,
    totalCount,
    allCompleted: totalCount > 0 && completedCount === totalCount,
    volume,
    setsLogged,
    rirAvg,
    estMinutes,
  };
}

function logsForAny(logs: SetLog[], exercises: Exercise[], date?: string): SetLog[] {
  const ids = new Set(exercises.map((e) => e.id));
  return logs.filter((l) => ids.has(l.exercise_id) && (!date || l.log_date === date));
}

/* ------------------------------------------------------------------ */
/* Resumen instantáneo desde las filas que el alumno está editando     */
/* ------------------------------------------------------------------ */

export interface EditableSetRow {
  set_number: number;
  actual_reps: string;
  actual_weight: string;
  rir: string;
  saved?: boolean;
}

function rowFilled(r: EditableSetRow): boolean {
  return r.saved === true || r.actual_reps !== "" || r.actual_weight !== "";
}

/**
 * Construye el resumen del día a partir del estado local de las filas
 * (edición en vivo), sin esperar a recargar los logs del servidor.
 */
export function buildDaySummaryFromRows(
  routine: Routine,
  rows: Record<string, EditableSetRow[] | undefined>
): DaySummary {
  const exercises = routine.exercises ?? [];
  const progress: ExerciseProgress[] = exercises.map((exercise) => {
    const list = rows[exercise.id] ?? [];
    const filled = list.filter(rowFilled);
    const weights = filled
      .map((r) => num(r.actual_weight))
      .filter((n): n is number => n !== null);
    const reps = filled
      .map((r) => num(r.actual_reps))
      .filter((n): n is number => n !== null);
    const volume = filled.reduce((sum, r) => {
      const rr = num(r.actual_reps) ?? 0;
      const ww = num(r.actual_weight) ?? 0;
      return sum + rr * ww;
    }, 0);
    return {
      exercise,
      logged: filled.length > 0,
      setsLogged: filled.length,
      bestWeight: weights.length ? Math.max(...weights) : null,
      bestReps: reps.length ? Math.max(...reps) : null,
      volume,
    };
  });

  const completedCount = progress.filter((p) => p.logged).length;
  const totalCount = exercises.length;
  const rirVals = exercises
    .flatMap((e) => rows[e.id] ?? [])
    .filter(rowFilled)
    .map((r) => num(r.rir))
    .filter((n): n is number => n !== null);
  const rirAvg = rirVals.length
    ? Math.round((rirVals.reduce((a, b) => a + b, 0) / rirVals.length) * 10) / 10
    : null;
  const targetSets = exercises.reduce((s, e) => s + (e.target_sets ?? 3), 0);
  const estMinutes = Math.max(15, Math.round((targetSets * 3 + exercises.length) / 5) * 5);

  return {
    routine,
    exercises: progress,
    completedCount,
    totalCount,
    allCompleted: totalCount > 0 && completedCount === totalCount,
    volume: progress.reduce((s, p) => s + p.volume, 0),
    setsLogged: progress.reduce((s, p) => s + p.setsLogged, 0),
    rirAvg,
    estMinutes,
  };
}

/* ------------------------------------------------------------------ */
/* Comparación entre semanas                                           */
/* ------------------------------------------------------------------ */

function normName(s: string): string {
  return s.trim().toLowerCase();
}

/** Ejercicio (de la semana actual) con mayor mejora de peso vs. la semana previa. */
export function mostImproved(
  current: Routine[],
  previous: Routine[],
  logs: SetLog[]
): { name: string; deltaKg: number } | null {
  const prevByName = new Map<string, Exercise>();
  for (const r of previous) for (const e of r.exercises ?? []) prevByName.set(normName(e.name), e);

  let best: { name: string; deltaKg: number } | null = null;
  for (const r of current) {
    for (const e of r.exercises ?? []) {
      const prev = prevByName.get(normName(e.name));
      if (!prev) continue;
      const cur = buildExerciseProgress(e, logs).bestWeight;
      const was = buildExerciseProgress(prev, logs).bestWeight;
      if (cur === null || was === null) continue;
      const delta = Math.round((cur - was) * 100) / 100;
      if (delta > 0 && (!best || delta > best.deltaKg)) {
        best = { name: e.name, deltaKg: delta };
      }
    }
  }
  return best;
}

export type WeekType = "carga" | "descarga" | "normal";

/** Tipo de semana (heurística de periodización de un bloque de 6). */
export function weekTypeOf(weekNumber: number, guideline?: string): WeekType {
  const g = (guideline ?? "").toLowerCase();
  if (weekNumber > 0 && weekNumber % 4 === 0) return "descarga";
  if (g.includes("descarga")) return "descarga";
  if (weekNumber <= 3) return "carga";
  return "normal";
}

export interface WeekSummary {
  routines: Routine[];
  days: DaySummary[];
  daysCompleted: number;
  totalDays: number;
  allCompleted: boolean;
  volume: number;
  prevVolume: number | null;
  volumeDeltaPct: number | null;
  mostImproved: { name: string; deltaKg: number } | null;
  weekType: WeekType;
  rirAvg: number | null;
}

export function buildWeekSummary(
  routines: Routine[],
  logs: SetLog[],
  opts: { weekNumber: number; prevRoutines?: Routine[]; guideline?: string }
): WeekSummary {
  const days = routines.map((r) => buildDaySummary(r, logs));
  const daysCompleted = days.filter((d) => d.allCompleted).length;
  const volume = days.reduce((s, d) => s + d.volume, 0);

  const prevRoutines = opts.prevRoutines ?? [];
  const prevVolume = prevRoutines.length
    ? prevRoutines.reduce((s, r) => s + buildDaySummary(r, logs).volume, 0)
    : null;
  const volumeDeltaPct =
    prevVolume && prevVolume > 0
      ? Math.round(((volume - prevVolume) / prevVolume) * 100)
      : null;

  const rirVals = days
    .map((d) => d.rirAvg)
    .filter((n): n is number => n !== null);
  const rirAvg = rirVals.length
    ? Math.round((rirVals.reduce((a, b) => a + b, 0) / rirVals.length) * 10) / 10
    : null;

  return {
    routines,
    days,
    daysCompleted,
    totalDays: days.length,
    allCompleted: days.length > 0 && daysCompleted === days.length,
    volume,
    prevVolume,
    volumeDeltaPct,
    mostImproved: mostImproved(routines, prevRoutines, logs),
    weekType: weekTypeOf(opts.weekNumber, opts.guideline),
    rirAvg,
  };
}

/* ------------------------------------------------------------------ */
/* Días perdidos + nudge                                              */
/* ------------------------------------------------------------------ */

export interface MissedDay {
  routine: Routine;
  date: string;
  weekday: string;
}

/**
 * Días entrenables del bloque actual cuya fecha programada ya pasó y que no
 * tienen ninguna serie registrada.
 */
export function detectMissedDays(
  weekRoutines: Routine[],
  logs: SetLog[],
  trainingDays: number,
  todayISO: string
): MissedDay[] {
  if (!todayISO) return [];
  const schedule = scheduleWeekdays(trainingDays);
  const missed: MissedDay[] = [];
  weekRoutines.forEach((routine, i) => {
    const wd = schedule[i % schedule.length];
    const date = dateOfWeekday(todayISO, wd);
    if (date >= todayISO) return; // aún no llegó
    const done = buildDaySummary(routine, logs).allCompleted;
    if (!done) {
      missed.push({ routine, date, weekday: weekdayLabel(date) });
    }
  });
  return missed.sort((a, b) => a.date.localeCompare(b.date));
}

export interface NudgeDecision {
  show: boolean;
  missedDate?: string;
  weekday?: string;
}

/**
 * Nudge suave: se muestra el día siguiente a un día entrenable perdido,
 * como máximo 1 vez por día perdido y 2 veces por semana.
 */
export function shouldShowNudge(input: {
  logs: SetLog[];
  todayISO: string;
  trainingDays: number;
  dismissedDates: string[];
  nudgesThisWeek: number;
}): NudgeDecision {
  if (!input.todayISO) return { show: false };
  if (input.nudgesThisWeek >= 2) return { show: false };
  const yesterday = addDaysISO(input.todayISO, -1);
  const schedule = scheduleWeekdays(input.trainingDays);
  if (!schedule.includes(weekdayOf(yesterday))) return { show: false };
  if (input.dismissedDates.includes(yesterday)) return { show: false };
  const loggedYesterday = input.logs.some(
    (l) => l.log_date === yesterday && isEffective(l)
  );
  if (loggedYesterday) return { show: false };
  const loggedToday = input.logs.some((l) => l.log_date === input.todayISO && isEffective(l));
  if (loggedToday) return { show: false };
  return { show: true, missedDate: yesterday, weekday: weekdayLabel(yesterday) };
}

/* ------------------------------------------------------------------ */
/* Escenarios del resumen post-sesión                                  */
/* ------------------------------------------------------------------ */

export type SessionScenario = "success" | "consistency" | "incomplete" | "discomfort";

export function resolveScenario(input: {
  day: DaySummary;
  improved: boolean;
  discomfort?: boolean;
}): SessionScenario {
  if (input.discomfort) return "discomfort";
  if (!input.day.allCompleted) return "incomplete";
  if (input.improved) return "success";
  return "consistency";
}

import { getSupabaseAdmin } from "@/lib/supabase-server";
import { sendCoachPush, sendPushToProfile, profileDisplayName } from "@/app/lib/push";

/**
 * Disparadores de notificaciones push. Nunca lanzan: un fallo de push no debe
 * romper el guardado de una serie.
 */

type Loaded = { exercise_id: string | null; set_number: number; actual_reps: number | null; actual_weight: number | null };

function hasValues(l: Loaded): boolean {
  return l.actual_reps != null || l.actual_weight != null;
}

/** Aviso al coach: un alumno cargó o actualizó series. Un tag por alumno: se reemplaza, no se apila. */
export async function notifyCoachLoad(clientId: string, action: string): Promise<void> {
  try {
    const name = await profileDisplayName(clientId);
    await sendCoachPush({
      title: "Nocito Coach",
      body: `${name}: ${action}`,
      url: "/app/admin",
      tag: `load-${clientId}`,
    });
  } catch (err) {
    console.error("[push] notifyCoachLoad", err);
  }
}

/** Aviso al coach con tag propio (dictado / notas). */
export async function notifyCoachEvent(clientId: string, tagPrefix: string, action: string): Promise<void> {
  try {
    const name = await profileDisplayName(clientId);
    await sendCoachPush({
      title: "Nocito Coach",
      body: `${name}: ${action}`,
      url: "/app/admin",
      tag: `${tagPrefix}-${clientId}`,
    });
  } catch (err) {
    console.error("[push] notifyCoachEvent", err);
  }
}

/**
 * Tras guardar una serie del alumno, avisa al alumno si acaba de completar la
 * sesión del día o la semana. Solo avisa en el guardado que completa cada hito.
 */
export async function notifyStudentMilestones(args: {
  clientId: string;
  routineId: string;
  weekNumber: number | null;
  logDate: string;
  exerciseId: string;
  setNumber: number;
}): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();

    // Sesión: ejercicios de la rutina del día.
    const { data: dayExs } = await supabase
      .from("exercises")
      .select("id")
      .eq("routine_id", args.routineId);
    const dayIds = (dayExs ?? []).map((e: { id: string }) => e.id);
    if (dayIds.length === 0) return;

    const { data: dayLogs } = await supabase
      .from("sets_logs")
      .select("exercise_id, set_number, actual_reps, actual_weight")
      .eq("client_id", args.clientId)
      .eq("log_date", args.logDate)
      .in("exercise_id", dayIds)
      .gt("set_number", 0);
    const dayRows = (dayLogs ?? []) as Loaded[];

    const sessionDoneNow = allDone(dayIds, dayRows, null);
    const current = { exerciseId: args.exerciseId, setNumber: args.setNumber };
    const sessionDoneBefore = allDone(dayIds, dayRows, current);

    if (sessionDoneNow && !sessionDoneBefore) {
      await sendPushToProfile(args.clientId, {
        title: "Sesión completa",
        body: "Terminaste el entrenamiento de hoy. Cada serie cuenta: buen trabajo.",
        url: "/app",
        tag: `session-${args.routineId}-${args.logDate}`,
      });
    }

    // Semana: todas las rutinas de la misma semana.
    if (args.weekNumber == null) return;
    const { data: weekRoutines } = await supabase
      .from("routines")
      .select("id, exercises(id)")
      .eq("client_id", args.clientId)
      .eq("week_number", args.weekNumber);
    const weekIds: string[] = [];
    for (const r of (weekRoutines ?? []) as { exercises: { id: string }[] | null }[]) {
      for (const e of r.exercises ?? []) weekIds.push(e.id);
    }
    if (weekIds.length === 0) return;

    const { data: weekLogs } = await supabase
      .from("sets_logs")
      .select("exercise_id, set_number, actual_reps, actual_weight")
      .eq("client_id", args.clientId)
      .in("exercise_id", weekIds)
      .gt("set_number", 0);
    const weekRows = (weekLogs ?? []) as Loaded[];

    const weekDoneNow = allDone(weekIds, weekRows, null);
    const weekDoneBefore = allDone(weekIds, weekRows, current);

    if (weekDoneNow && !weekDoneBefore) {
      await sendPushToProfile(args.clientId, {
        title: "Semana completa",
        body: "Cumpliste todas las sesiones de la semana. Eso es constancia: a por la próxima.",
        url: "/app",
        tag: `week-${args.clientId}-${args.weekNumber}`,
      });
    }
  } catch (err) {
    console.error("[push] notifyStudentMilestones", err);
  }
}

/**
 * ¿Todos los ejercicios tienen al menos una serie con valores?
 * Si `exclude` se pasa, ignora esa serie (para saber el estado previo al guardado).
 */
function allDone(
  exerciseIds: string[],
  rows: Loaded[],
  exclude: { exerciseId: string; setNumber: number } | null
): boolean {
  const done = new Set<string>();
  for (const r of rows) {
    if (!r.exercise_id || !hasValues(r)) continue;
    if (exclude && r.exercise_id === exclude.exerciseId && r.set_number === exclude.setNumber) continue;
    done.add(r.exercise_id);
  }
  return exerciseIds.every((id) => done.has(id));
}

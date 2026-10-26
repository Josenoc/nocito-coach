import type { Exercise } from "@/lib/app-types";

/**
 * Motor de propuesta de progresión individual para el alumno.
 * Función *pura* (sin React ni red): compara lo que el alumno acaba de
 * registrar contra el objetivo prescripto (reps + RIR del ejercicio) y su
 * historial semanal de cargas, y devuelve una recomendación concreta para la
 * próxima sesión: subir carga, mantener, deload o cambiar variante.
 *
 * Regla de progresión: solo se sugiere SUBIR la carga cuando el mismo ejercicio
 * se hizo con el mismo peso durante SUSTAIN_WEEKS semanas consecutivas.
 */

export const SUSTAIN_WEEKS = 4;

export type AdviceKind = "progress" | "hold" | "deload" | "variation";

export interface ProgressionAdvice {
  kind: AdviceKind;
  title: string;
  detail: string;
  nextWeight: number | null;
  nextReps: number | null;
  targetRir: number | null;
}

export interface AdviceSetInput {
  actual_reps: string | number | null;
  actual_weight: string | number | null;
  rir: string | number | null;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseTargetReps(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const m = String(v).match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** RIR objetivo guardado en las notas de técnica del ejercicio ("... RIR 2 ..."). */
export function targetRirFromNotes(notes?: string | null): number | null {
  if (!notes) return null;
  const m = notes.match(/RIR\s*([0-9]+(?:[.,][0-9]+)?)/i);
  return m ? Number(m[1].replace(",", ".")) : null;
}

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

function fmtKg(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

/**
 * Cuántas semanas seguidas (contando la actual, al final) el ejercicio se hizo
 * con exactamente la misma carga. Una semana sin registro corta la racha.
 */
export function sameWeightStreak(
  weeklyBests: (number | null | undefined)[],
  currentWeight: number | null
): number {
  if (currentWeight === null || currentWeight <= 0) return 0;
  const series = [...weeklyBests, currentWeight];
  let streak = 0;
  for (let i = series.length - 1; i >= 0; i--) {
    const w = series[i];
    if (w === null || w === undefined || w !== currentWeight) break;
    streak++;
  }
  return streak;
}

export function proposeProgression(input: {
  exercise: Exercise;
  sets: AdviceSetInput[];
  /** Mejor carga de cada semana anterior, de la más vieja a la más nueva. */
  weeklyBests?: (number | null | undefined)[];
  unit?: string | null;
}): ProgressionAdvice | null {
  const { exercise, sets, weeklyBests = [], unit = "kg" } = input;

  const effective = sets.filter(
    (s) => toNum(s.actual_reps) !== null || toNum(s.actual_weight) !== null
  );
  if (effective.length === 0) return null;

  const reps = effective
    .map((s) => toNum(s.actual_reps))
    .filter((n): n is number => n !== null);
  const weights = effective
    .map((s) => toNum(s.actual_weight))
    .filter((n): n is number => n !== null);
  const rirs = effective
    .map((s) => toNum(s.rir))
    .filter((n): n is number => n !== null);

  const targetReps = parseTargetReps(exercise.target_reps) ?? 8;
  const targetRir = targetRirFromNotes(exercise.technique_notes) ?? 2;

  const bestWeight = weights.length
    ? Math.max(...weights)
    : toNum(exercise.target_weight);
  const minReps = reps.length ? Math.min(...reps) : null;
  const avgRir = rirs.length
    ? Math.round((rirs.reduce((a, b) => a + b, 0) / rirs.length) * 10) / 10
    : null;

  const hitReps = minReps !== null && minReps >= targetReps;
  const belowCount = reps.filter((r) => r < targetReps).length;
  const canLoad = bestWeight !== null && bestWeight > 0;
  const step = 2.5;
  const streak = sameWeightStreak(weeklyBests, bestWeight);
  const canRaise = canLoad && streak >= SUSTAIN_WEEKS;
  const weeksLeft = Math.max(0, SUSTAIN_WEEKS - streak);

  // 1) Falló reps en alguna serie → mantener o deload.
  if (!hitReps && minReps !== null && belowCount > 0) {
    const severe = belowCount >= 2 || (avgRir !== null && avgRir <= 0);
    if (severe && canLoad) {
      const next = roundTo(bestWeight * 0.925, step);
      return {
        kind: "deload",
        title: "Bajá un escalón esta sesión",
        detail: `No llegaste a las ${targetReps} reps con margen. Bajá ~7,5% para recuperar técnica y RIR objetivo.`,
        nextWeight: next,
        nextReps: targetReps,
        targetRir,
      };
    }
    return {
      kind: "hold",
      title: "Mantené la carga",
      detail: `Te faltaron reps objetivo. Repetí ${fmtKg(bestWeight ?? 0)} ${unit} y buscá completar todas las series antes de subir.`,
      nextWeight: canLoad ? bestWeight : null,
      nextReps: targetReps,
      targetRir,
    };
  }

  // 2) Cumplió reps: decidir por el RIR registrado y la racha de semanas.
  if (hitReps) {
    const tooEasy = avgRir !== null && avgRir > targetRir + 0.5;
    const grinding = avgRir !== null && avgRir <= targetRir;

    if (tooEasy) {
      if (canRaise) {
        return {
          kind: "progress",
          title: `Subí ${fmtKg(step)} ${unit} la próxima`,
          detail: `Hiciste ${fmtKg(bestWeight ?? 0)} ${unit} durante ${SUSTAIN_WEEKS} semanas seguidas y cerraste con RIR ${avgRir} (objetivo ${targetRir}). Ya es momento de sumar carga.`,
          nextWeight: roundTo((bestWeight ?? 0) + step, step),
          nextReps: targetReps,
          targetRir,
        };
      }
      return {
        kind: "hold",
        title: "Mantené la carga",
        detail: `Te sobra margen, pero la carga todavía no se sube: llevás ${streak} de ${SUSTAIN_WEEKS} semanas con ${fmtKg(bestWeight ?? 0)} ${unit}. Sostenela ${weeksLeft} semana${weeksLeft === 1 ? "" : "s"} más.`,
        nextWeight: canLoad ? bestWeight : null,
        nextReps: targetReps,
        targetRir,
      };
    }

    if (grinding) {
      return {
        kind: "hold",
        title: "Consolidá antes de subir",
        detail: `Llegaste al RIR objetivo (${targetRir}). Repetí ${fmtKg(bestWeight ?? 0)} ${unit}. Semana ${streak} de ${SUSTAIN_WEEKS} con esta carga.`,
        nextWeight: canLoad ? bestWeight : null,
        nextReps: targetReps + 1,
        targetRir,
      };
    }

    // Estancado: misma carga durante varias semanas con reps cumplidas → variante.
    if (canLoad && streak >= SUSTAIN_WEEKS && (avgRir === null || avgRir >= targetRir)) {
      return {
        kind: "variation",
        title: "Probá una variante",
        detail: `Llevás ${SUSTAIN_WEEKS} semanas con ${fmtKg(bestWeight)} ${unit} sin subir. Cambiá a una variante del mismo patrón para desestancar.`,
        nextWeight: null,
        nextReps: targetReps,
        targetRir,
      };
    }

    // Cumplió todas las reps, sin RIR suficiente para decidir: mantener y contar semanas.
    return {
      kind: "hold",
      title: "Mantené la carga",
      detail: `Completaste ${reps.length} serie${reps.length === 1 ? "" : "s"} en objetivo. ${
        canLoad
          ? `Semana ${streak} de ${SUSTAIN_WEEKS} con ${fmtKg(bestWeight)} ${unit}: la carga sube recién después de ${SUSTAIN_WEEKS} semanas seguidas.`
          : "Sumá carga externa cuando puedas."
      }`,
      nextWeight: canLoad ? bestWeight : null,
      nextReps: targetReps,
      targetRir,
    };
  }

  return null;
}

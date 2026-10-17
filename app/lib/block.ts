import type {
  GeneratedProgram,
  ProgramExercise,
  WeekTarget,
} from "@/app/lib/program";

/**
 * Motor de sobrecarga progresiva (puro, sin dependencias de servidor).
 * Toma el bloque base generado por el coach/IA (Sem 1) y calcula la curva de
 * progresión semanal (reps, peso y RIR) para todas las semanas del bloque.
 */

type Category = "cardio" | "core" | "iso" | "compound";

function parseReps(reps?: string | null): { lo: number; hi: number } {
  const nums = String(reps ?? "").match(/\d+/g);
  if (!nums || !nums.length) return { lo: 10, hi: 12 };
  const lo = Number(nums[0]) || 10;
  const hi = nums.length > 1 ? Number(nums[1]) || lo : lo;
  return { lo, hi: Math.max(lo, hi) };
}

function categoryOf(name: string): Category {
  const n = (name || "").toLowerCase();
  if (/cardio|hiit|trote|cinta|bici|ergometro|ergómetro|eliptica|elíptica/.test(n)) {
    return "cardio";
  }
  if (/plancha|abdominal|abdomen|colgado|crunch|rueda|hollow|encogimiento/.test(n)) {
    return "core";
  }
  if (
    /curl|extensi|elevacion|elevaciones|apertura|pajar|pájaro|gemelo|femoral|triceps|tríceps|fondos|pantorrilla|face pull|press frances|patada/.test(
      n
    )
  ) {
    return "iso";
  }
  return "compound";
}

function roundHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

/** Construye la progresión de un ejercicio para todo el bloque. */
export function buildProgression(
  ex: ProgramExercise,
  weeks: number,
  params: { incrementoKg: number; repWave: number; rirInicio: number; rirFin: number }
): WeekTarget[] {
  const cat = categoryOf(ex.ejercicio);
  const { lo, hi } = parseReps(ex.reps);
  const base = typeof ex.base_weight === "number" && ex.base_weight > 0 ? ex.base_weight : null;
  const repWave = Math.max(2, Math.round(params.repWave));
  const totalWeeks = Math.max(1, Math.round(weeks));

  const inc =
    cat === "compound"
      ? params.incrementoKg
      : cat === "iso"
      ? Math.max(1.25, params.incrementoKg / 2)
      : 0;

  const span = Math.max(1, totalWeeks - 1);
  const out: WeekTarget[] = [];

  for (let w = 1; w <= totalWeeks; w++) {
    if (cat === "cardio") {
      out.push({ sem: w, reps: null, peso: null, rir: null });
      continue;
    }

    const step = Math.floor((w - 1) / repWave); // cada cuántos "waves" subimos peso
    const pos = (w - 1) % repWave; // avance de reps dentro del wave
    const repsNum = Math.min(lo + pos, hi); // nunca supera el tope prescrito
    const peso = base != null && inc > 0 ? roundHalf(base + step * inc) : null;

    const rir =
      w === 1
        ? params.rirInicio
        : Math.max(
            params.rirFin,
            Math.round(params.rirInicio - ((w - 1) / span) * (params.rirInicio - params.rirFin))
          );

    out.push({ sem: w, reps: String(repsNum), peso, rir });
  }

  return out;
}

/**
 * Devuelve una copia del programa con la `progresion` calculada en cada
 * ejercicio, según los parámetros del bloque.
 */
export function expandProgramBlock(program: GeneratedProgram): GeneratedProgram {
  const b = program.block;
  const weeks = b?.weeks ?? 6;
  const params = {
    incrementoKg: b?.incrementoKg ?? 2.5,
    repWave: b?.repWave ?? 3,
    rirInicio: b?.rirInicio ?? 2,
    rirFin: b?.rirFin ?? 1,
  };

  return {
    ...program,
    days: program.days.map((day) => ({
      ...day,
      ejercicios: day.ejercicios.map((ex) => ({
        ...ex,
        progresion: buildProgression(ex, weeks, params),
      })),
    })),
  };
}

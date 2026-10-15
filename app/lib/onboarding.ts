import { getSupabaseAdmin } from "@/lib/supabase-server";
import type { Anamnesis, NutritionPlan } from "@/lib/app-types";
import { buildRoutine, buildNutrition, computeTdee } from "./routine-gen";
import type { RoutineData } from "./routine";

const GOAL_TO_OBJECTIVE: Record<string, string> = {
  hipertrofia: "ganar-masa",
  "perdida-grasa": "perder-grasa",
  fuerza: "ganar-masa",
  "rendimiento-deportivo": "recomposicion",
};

const NUTRITION_TO_PREFS: Record<string, string> = {
  omnivoro: "Omnívoro",
  vegetariano: "Vegetariano",
  carnivoro: "Carnívoro",
  vegano: "Vegano",
};

const DEFAULT_EXPERIENCE = "intermedio";

function intOrNull(value: string): number | null {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

export function buildOnboardingPlan(anamnesis: Anamnesis): {
  routine: RoutineData;
  nutrition: NutritionPlan;
} {
  const objectiveKey = GOAL_TO_OBJECTIVE[anamnesis.goal] ?? "ganar-masa";
  const days = Number(anamnesis.training_days) || 3;
  const prefLabel = NUTRITION_TO_PREFS[anamnesis.nutrition] ?? "Omnívoro";

  const tdee = computeTdee(
    anamnesis.sex,
    anamnesis.weight_kg,
    anamnesis.height_cm,
    anamnesis.age,
    days
  );

  const routine = buildRoutine(objectiveKey, DEFAULT_EXPERIENCE, days, "");
  const nutrition = buildNutrition(
    objectiveKey,
    anamnesis.weight_kg,
    [prefLabel],
    tdee
  ) as NutritionPlan;

  return { routine, nutrition };
}

export async function generateOnboardingDraft(
  clientId: string,
  anamnesis: Anamnesis
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { count } = await supabase
    .from("routines")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);

  const { routine, nutrition } = buildOnboardingPlan(anamnesis);

  if (!count) {
    for (let d = 0; d < routine.days.length; d++) {
      const day = routine.days[d];
      const { data: row } = await supabase
        .from("routines")
        .insert({
          client_id: clientId,
          name: day.name,
          day_name: day.name,
          week_number: 1,
          position: d,
          active: false,
        })
        .select("id")
        .single();

      if (!row) continue;

      const exercises = day.items.map((item, index) => ({
        routine_id: row.id,
        name: item[0],
        order_index: index,
        target_sets: intOrNull(item[1]) ?? 3,
        target_reps: intOrNull(item[2]) ?? 10,
        target_weight: null,
        unit: "kg" as const,
      }));
      if (exercises.length) {
        await supabase.from("exercises").insert(exercises);
      }
    }
  }

  await supabase
    .from("profiles")
    .update({ routine_status: "pending_review", nutrition_plan: nutrition })
    .eq("id", clientId);
}

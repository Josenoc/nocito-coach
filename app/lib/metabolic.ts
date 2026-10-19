/**
 * Cálculos metabólicos automáticos del onboarding y la ficha del cliente.
 *
 * Todo se deriva del peso, altura, edad, sexo, nivel de actividad y objetivo.
 * El alumno NUNCA ve preguntas de calorías: el sistema las calcula y las
 * muestra ya resueltas (con una explicación simple).
 *
 * Fórmulas:
 *  - IMC/BMI = peso(kg) / altura(m)²
 *  - TMB/BMR = Mifflin-St Jeor
 *      Hombre: 10·kg + 6.25·cm − 5·edad + 5
 *      Mujer:  10·kg + 6.25·cm − 5·edad − 161
 *  - TDEE = TMB × factor de actividad (1.2 – 1.9)
 *  - Calorías objetivo = TDEE ajustado por objetivo (déficit / superávit)
 *  - Macros: proteína 2 g/kg · grasa 25–30 % · carbohidratos el resto
 */

export type Sex = string;
export type Goal = string;
export type ActivityLevel =
  | "sedentario"
  | "ligero"
  | "moderado"
  | "alto"
  | "muy-alto"
  | string;

export interface MetabolicInput {
  sex: Sex;
  weight_kg: number;
  height_cm: number;
  age: number;
  goal?: Goal;
  activity_level?: ActivityLevel;
  /** Días de entrenamiento por semana (fallback si no hay activity_level). */
  training_days?: number;
  /** % de grasa corporal estimado (opcional, ajusta el objetivo calórico). */
  body_fat_pct?: number | null;
}

export interface Macros {
  /** Gramos de proteína. */
  prot: number;
  /** Gramos de carbohidratos. */
  carbs: number;
  /** Gramos de grasa. */
  fat: number;
  /** % de las calorías proveniente de cada macro. */
  protPct: number;
  carbsPct: number;
  fatPct: number;
}

export interface MetabolicResult {
  bmi: number;
  bmiLabel: string;
  bmiCategory: "Bajo peso" | "Normal" | "Sobrepeso" | "Obesidad";
  bmr: number;
  activityFactor: number;
  activityLabel: string;
  tdee: number;
  /** Calorías objetivo según el objetivo (déficit / mantenimiento / superávit). */
  targetCalories: number;
  /** Ajuste aplicado, ej: "+12 % (superávit)". */
  calorieAdjustment: string;
  /** Objetivo de macro resumido, listo para mostrar. */
  macros: Macros;
  /** Explicación corta y humana, estilo José. */
  headline: string;
  detail: string;
}

const ACTIVITY_FACTORS: Record<string, number> = {
  sedentario: 1.2,
  ligero: 1.375,
  moderado: 1.55,
  alto: 1.725,
  "muy-alto": 1.9,
};

const ACTIVITY_LABELS: Record<string, string> = {
  sedentario: "Sedentario",
  ligero: "Ligero",
  moderado: "Moderado",
  alto: "Alto",
  "muy-alto": "Muy alto",
};

const GOAL_ADJUSTMENTS: Record<
  string,
  { factor: number; label: string; headline: string; detail: string }
> = {
  hipertrofia: {
    factor: 1.12,
    label: "+12 % (superávit)",
    headline: "Vas a comer un poco por encima de lo que gastás para construir músculo.",
    detail:
      "Un superávit moderado maximiza la ganancia muscular minimizando la grasa. Si subís de peso demasiado rápido, ajustamos.",
  },
  "perdida-grasa": {
    factor: 0.82,
    label: "−18 % (déficit)",
    headline: "Vas a comer por debajo de lo que gastás para bajar grasa sin perder músculo.",
    detail:
      "Con la proteína alta y un déficit controlado cuidamos tu masa muscular mientras bajás de peso.",
  },
  fuerza: {
    factor: 1.07,
    label: "+7 % (superávit leve)",
    headline: "Vamos a sostener tu energía en niveles altos para rendir en cargas pesadas.",
    detail:
      "Un pequeño superávit te da el combustible extra que necesitás para mover más peso cada semana.",
  },
  recomposicion: {
    factor: 0.95,
    label: "−5 % (mantenimiento)",
    headline: "Vamos a comer casi en mantenimiento para ganar músculo y perder grasa a la vez.",
    detail:
      "La recomposición funciona con proteína alta, entrenamiento de fuerza y una ingesta muy cercana a tu gasto.",
  },
  "rendimiento-deportivo": {
    factor: 1.08,
    label: "+8 % (rendimiento)",
    headline: "Ajustamos tus calorías para que rindas y recuperes bien en cada sesión.",
    detail:
      "Priorizamos carbohidratos para la energía de tus entrenamientos y proteína para la recuperación.",
  },
};

function round(n: number, decimals = 0): number {
  const p = Math.pow(10, decimals);
  return Math.round(n * p) / p;
}

export function calcBmi(weightKg: number, heightCm: number): number {
  if (!weightKg || !heightCm) return 0;
  const m = heightCm / 100;
  return round(weightKg / (m * m), 1);
}

export function bmiCategory(
  bmi: number
): "Bajo peso" | "Normal" | "Sobrepeso" | "Obesidad" {
  if (bmi < 18.5) return "Bajo peso";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Sobrepeso";
  return "Obesidad";
}

export function calcBmr(
  sex: Sex,
  weightKg: number,
  heightCm: number,
  age: number
): number {
  if (!weightKg || !heightCm || !age) return 0;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const isFemale = /femen|mujer|female|f\b/i.test(String(sex));
  return Math.round(isFemale ? base - 161 : base + 5);
}

export function activityFactor(
  activityLevel?: ActivityLevel,
  trainingDays?: number
): { factor: number; label: string } {
  if (activityLevel && ACTIVITY_FACTORS[activityLevel]) {
    return {
      factor: ACTIVITY_FACTORS[activityLevel],
      label: ACTIVITY_LABELS[activityLevel],
    };
  }
  const d = Number(trainingDays) || 0;
  if (d >= 5) return { factor: 1.725, label: "Alto" };
  if (d >= 3) return { factor: 1.55, label: "Moderado" };
  if (d > 0) return { factor: 1.375, label: "Ligero" };
  return { factor: 1.2, label: "Sedentario" };
}

export function calcMacros(
  calories: number,
  weightKg: number,
  goal?: Goal
): Macros {
  const cal = Math.max(0, Math.round(calories));
  // Proteína: 2 g/kg (subimos a 2.2 en déficit para proteger músculo).
  const protPerKg = goal === "perdida-grasa" ? 2.2 : 2;
  const prot = Math.round((weightKg || 0) * protPerKg);
  const protCal = prot * 4;

  // Grasa: 25–30 % del total (28 % como valor central; más alta en déficit).
  const fatPctTarget = goal === "perdida-grasa" ? 0.3 : 0.28;
  const fat = Math.round((cal * fatPctTarget) / 9);
  const fatCal = fat * 9;

  // Carbohidratos: el resto (nunca negativo).
  const carbsCal = Math.max(0, cal - protCal - fatCal);
  const carbs = Math.round(carbsCal / 4);

  const total = Math.max(1, protCal + fatCal + carbsCal);
  return {
    prot,
    carbs,
    fat,
    protPct: Math.round((protCal / total) * 100),
    carbsPct: Math.round((carbsCal / total) * 100),
    fatPct: Math.round((fatCal / total) * 100),
  };
}

export function computeMetabolic(input: MetabolicInput): MetabolicResult {
  const weight = Number(input.weight_kg) || 0;
  const height = Number(input.height_cm) || 0;
  const age = Number(input.age) || 0;

  const bmi = calcBmi(weight, height);
  const category = bmiCategory(bmi);
  const bmr = calcBmr(input.sex, weight, height, age);
  const { factor, label: activityLabel } = activityFactor(
    input.activity_level,
    input.training_days
  );
  const tdee = Math.round(bmr * factor);

  const goalCfg =
    GOAL_ADJUSTMENTS[input.goal ?? ""] ?? {
      factor: 1,
      label: "mantenimiento",
      headline: "Vamos a comer según tu gasto diario para sostener tu progreso.",
      detail: "Ajustamos las calorías a tu objetivo a medida que avancemos.",
    };

  const targetCalories = Math.round(tdee * goalCfg.factor);
  const macros = calcMacros(targetCalories, weight, input.goal);

  return {
    bmi,
    bmiLabel: `IMC ${bmi} · ${category}`,
    bmiCategory: category,
    bmr,
    activityFactor: factor,
    activityLabel,
    tdee,
    targetCalories,
    calorieAdjustment: goalCfg.label,
    macros,
    headline: goalCfg.headline,
    detail: goalCfg.detail,
  };
}

/** Formatea números con separador de miles es-AR (para count-up y fichas). */
export function fmt(n: number): string {
  return Math.round(n).toLocaleString("es-AR");
}

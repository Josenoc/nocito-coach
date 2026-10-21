export type Role = "client" | "coach";

export type TrainingPlace = "gimnasio" | "casa" | "aire-libre";
export type Experience = "principiante" | "intermedio" | "avanzado";
export type ActivityLevel = "sedentario" | "ligero" | "moderado" | "alto" | "muy-alto";
export type SleepQuality = "mala" | "regular" | "buena" | "excelente";
export type PhotoSlot = "front" | "side" | "back";

export interface ClientPhotos {
  front?: string | null;
  side?: string | null;
  back?: string | null;
}

export type MealSlot = "desayuno" | "almuerzo" | "merienda" | "cena" | "extra";

export interface FoodItem {
  id: string;
  name: string;
  quantity?: string | null;
  cal: number;
  prot: number;
  carbs: number;
  fat: number;
  slot: MealSlot;
  source: "manual" | "voice";
  created_at: string;
}

export type ParsedFoodItem = Omit<FoodItem, "id" | "created_at" | "source">;

export type FoodLogs = Record<string, FoodItem[]>;

/** Mapa de RIR registrado por el alumno: clave `${exercise_id}|${log_date}|${set_number}`. */
export type SetRirMap = Record<string, number>;

export interface TrainingBlock {
  /** Indicación de la semana/bloque, ej: "Mismas reps, +2,5 kg en los básicos y 2 RIR". */
  guideline?: string;
  /** Cantidad de semanas del bloque (por defecto 6). */
  weeks?: number;
}

export interface Anamnesis {
  sex: string;
  age: number;
  height_cm: number;
  weight_kg: number;
  /** % de grasa corporal estimado (composición corporal). */
  body_fat_pct?: number;
  goal: string;
  training_days: number;
  /** Duración objetivo de cada sesión (ej: "60 min"). */
  session_length?: string;
  nutrition: string;
  /** Acceso a equipamiento: gimnasio comercial, casa/home gym o peso corporal/parques. */
  training_place?: TrainingPlace | string;
  experience?: Experience | string;
  /** Años de entrenamiento estructurado (continuo). */
  training_years?: number;
  /** Nivel de actividad diaria (NEAT / energía cotidiana). */
  activity_level?: ActivityLevel | string;
  /** Calidad del descanso nocturno. */
  sleep_quality?: SleepQuality | string;
  /** Lesiones o limitaciones estructurales activas o pasadas. */
  injuries?: string;
  food_restrictions?: string;
  /** Alergias o intolerancias declaradas. */
  allergies?: string;
  /** Alimentos que le encantan (para armar el plan a su gusto). */
  foods_love?: string;
  /** Alimentos que evita / no le gustan. */
  foods_avoid?: string;
  /** Comidas por día (3 a 6+). */
  meals_per_day?: number;
  /** Tiempo disponible para cocinar (ej: "menos de 15 min"). */
  cook_time?: string;
  /** Frecuencia de meal prep (ej: "domingo completo"). */
  meal_prep?: string;
  /** Presupuesto alimentario (ej: "ajustado", "medio", "amplio"). */
  budget?: string;
  /** Nivel de estrés percibido (1 a 10). */
  stress_level?: number;
  /** Horas de sueño promedio por noche (4 a 10). */
  sleep_hours?: number;
  /** Suplementación actual. */
  supplements?: string;
  /** Consumo de alcohol. */
  alcohol?: string;
  /** Objetivo / motivación principal, en palabras del alumno. */
  motivation?: string;
  /** Preferencia de género para los días del plan, si aplica. */
  preferred_days?: string;
  photos?: ClientPhotos;
  foodLogs?: FoodLogs;
  setRir?: SetRirMap;
  trainingBlock?: TrainingBlock;
  completedAt?: string;
  /** Fecha/hora en que el alumno aceptó términos y privacidad al registrarse. */
  termsAcceptedAt?: string;
  clientUpdatedAt?: string;
  coachSeenAt?: string;
}

export type RoutineStatus = "pending_review" | "active";

export interface NutritionPlan {
  cal: number;
  prot: number;
  carbs: number;
  fat: number;
  proteinSources: string;
  meals: [string, string][];
}

export interface Profile {
  id: string;
  email: string;
  username?: string | null;
  role: Role;
  full_name: string;
  activo: boolean;
  created_at: string;
  phone?: string | null;
  anamnesis?: Anamnesis | null;
  routine_status?: RoutineStatus | null;
  nutrition_plan?: NutritionPlan | null;
  approved_at?: string | null;
}

export interface Routine {
  id: string;
  client_id: string;
  name: string;
  day_name: string;
  week_number: number;
  position: number;
  active: boolean;
  created_at: string;
  exercises?: Exercise[];
}

export interface Exercise {
  id: string;
  routine_id: string;
  name: string;
  video_url?: string | null;
  technique_notes?: string | null;
  order_index: number;
  target_sets?: number | null;
  target_reps?: number | null;
  target_weight?: number | null;
  unit: "kg" | "lbs";
}

export interface SetLog {
  id: string;
  exercise_id: string;
  client_id: string;
  set_number: number;
  target_reps?: number | null;
  target_weight?: number | null;
  actual_reps?: number | null;
  actual_weight?: number | null;
  rir?: number | null;
  phantom_reference_10_percent?: number | null;
  log_date: string;
  created_at: string;
}

export interface AudioReport {
  id: string;
  client_id: string;
  exercise_id?: string | null;
  audio_storage_url: string;
  created_at: string;
}

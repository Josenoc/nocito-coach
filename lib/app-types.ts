export type Role = "client" | "coach";

export interface Anamnesis {
  sex: string;
  age: number;
  height_cm: number;
  weight_kg: number;
  goal: string;
  training_days: number;
  nutrition: string;
  completedAt?: string;
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

import type {
  ClientPayload,
  RoutineData,
  NutritionData,
  ExerciseItem,
  RoutineDay,
} from "./routine";

export const OBJECTIVE_LABELS: Record<string, string> = {
  "ganar-masa": "Ganar masa muscular",
  "perder-grasa": "Perder grasa corporal",
  recomposicion: "RecomposiciÃ³n corporal",
};

export const EXPERIENCE_LABELS: Record<string, string> = {
  principiante: "Principiante",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
};

const FOCUS: Record<string, string> = {
  "ganar-masa": "Hipertrofia Aislada",
  "perder-grasa": "Hipertrofia + Quema de grasa",
  recomposicion: "RecomposiciÃ³n Corporal",
};

export const PRIORITY_LABELS: Record<string, string> = {
  "tren-superior": "Tren superior",
  "tren-inferior": "Tren inferior",
  "cuerpo-completo": "Cuerpo completo",
};

const PRIORITY_EXTRA: Record<string, ExerciseItem[]> = {
  "tren-superior": [
    ["Aperturas con mancuernas", "3", "12-15", "60"],
    ["PÃ¡jaros (deltoides posterior)", "3", "12-15", "60"],
  ],
  "tren-inferior": [
    ["Hip thrust", "3", "10-12", "90"],
    ["ElevaciÃ³n de talÃ³n de pie", "3", "12-15", "45"],
  ],
  "cuerpo-completo": [],
};

function applyPriority(days: RoutineDay[], prioridad: string): void {
  const extras = PRIORITY_EXTRA[prioridad] ?? [];
  if (!extras.length) return;
  for (const day of days) {
    const text = day.name + " " + (day.focus ?? "");
    const isUpper = /(Push|Pecho|Espalda|Upper|Tren superior|Cuerpo completo)/i.test(text);
    const isLower = /(Legs|Pierna|Lower|Tren inferior|Cuerpo completo)/i.test(text);
    if (prioridad === "tren-superior" && isUpper && !isLower) day.items.push(...extras);
    else if (prioridad === "tren-inferior" && isLower && !isUpper) day.items.push(...extras);
    else if (prioridad === "cuerpo-completo" && isUpper && isLower) day.items.push(...extras);
  }
}

type Meta = Record<string, unknown>;

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return value.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function metaString(meta: Meta, camel: string, snake: string): string {
  return asString(meta[camel]) || asString(meta[snake]);
}

function metaNumber(meta: Meta, camel: string, snake: string, fallback = 0): number {
  return asNumber(meta[camel] ?? meta[snake], fallback);
}

function repsFor(obj: string): string {
  if (obj === "perder-grasa") return "10-15";
  if (obj === "ganar-masa") return "8-12";
  return "8-12";
}

function cardioNote(obj: string): number {
  if (obj === "perder-grasa") return 20;
  if (obj === "recomposicion") return 10;
  return 0;
}

function pushExercises(o: string, _dIndex: number): ExerciseItem[] {
  const r = repsFor(o);
  const c = cardioNote(o);
  const list: ExerciseItem[] = [
    ["Press banca con barra", "4", r, "90"],
    ["Press inclinado con mancuernas", "3", r, "75"],
    ["Aperturas con mancuernas", "3", "12-15", "60"],
    ["Press militar con barra", "3", r, "75"],
    ["Elevaciones laterales con mancuernas", "3", "12-15", "60"],
    ["Extensiones de trÃ­ceps en polea", "3", r, "60"],
  ];
  if (c) list.push(["Cardio HIIT " + c + " min", "1", "3 rondas", "0"]);
  return list;
}

function pullExercises(o: string): ExerciseItem[] {
  const r = repsFor(o);
  const c = cardioNote(o);
  const list: ExerciseItem[] = [
    ["Dominadas asistidas o jalÃ³n al pecho", "4", r, "90"],
    ["Remo con barra", "4", r, "90"],
    ["Remo sentado en polea agarre angosto", "3", r, "75"],
    ["JalÃ³n al frente agarre abierto", "3", r, "75"],
    ["Curl con barra", "3", r, "60"],
    ["Curl martillo alternado", "3", "10-12", "60"],
  ];
  if (c) list.push(["Cardio HIIT " + c + " min", "1", "3 rondas", "0"]);
  return list;
}

function legsExercises(o: string): ExerciseItem[] {
  const r = repsFor(o);
  const c = cardioNote(o);
  const list: ExerciseItem[] = [
    ["Sentadilla con barra", "4", r, "120"],
    ["Prensa 45Â°", "4", r, "90"],
    ["Peso muerto rumano", "3", "8-10", "90"],
    ["ExtensiÃ³n de cuÃ¡driceps", "3", r, "60"],
    ["Curl femoral acostado", "3", r, "60"],
    ["ElevaciÃ³n de gemelos de pie", "4", "12-15", "45"],
  ];
  if (c) list.push(["Cardio HIIT " + c + " min", "1", "3 rondas", "0"]);
  return list;
}

function upperExercises(o: string): ExerciseItem[] {
  const r = repsFor(o);
  return [
    ["Press banca con barra", "4", r, "90"],
    ["Dominadas o jalÃ³n al pecho", "4", r, "90"],
    ["Press inclinado con mancuernas", "3", r, "75"],
    ["Remo con barra", "3", r, "90"],
    ["Press militar", "3", r, "75"],
    ["Curl con barra + ExtensiÃ³n de trÃ­ceps en polea", "3", r, "60"],
  ];
}

function lowerExercises(o: string): ExerciseItem[] {
  const r = repsFor(o);
  const c = cardioNote(o);
  const list: ExerciseItem[] = [
    ["Sentadilla con barra", "4", r, "120"],
    ["Peso muerto rumano", "4", "8-10", "90"],
    ["Prensa 45Â°", "3", r, "90"],
    ["ExtensiÃ³n de cuÃ¡driceps", "3", r, "60"],
    ["Curl femoral acostado", "3", r, "60"],
    ["ElevaciÃ³n de gemelos sentado", "4", "12-15", "45"],
  ];
  if (c) list.push(["Cardio HIIT " + c + " min", "1", "3 rondas", "0"]);
  return list;
}

function fullBodyExercises(o: string, variant: string): ExerciseItem[] {
  const r = repsFor(o);
  const c = cardioNote(o);
  let list: ExerciseItem[];
  if (variant === "A") {
    list = [
      ["Sentadilla con barra", "3", r, "90"],
      ["Press banca con barra", "3", r, "90"],
      ["Remo con barra", "3", r, "90"],
      ["Press militar", "2", r, "75"],
      ["ExtensiÃ³n de trÃ­ceps en polea", "2", r, "60"],
      ["Plancha abdominal", "3", "45-60 seg", "45"],
    ];
  } else {
    list = [
      ["Peso muerto rumano", "3", r, "120"],
      ["Press inclinado con mancuernas", "3", r, "90"],
      ["Dominadas o jalÃ³n al pecho", "3", r, "90"],
      ["Curl de bÃ­ceps", "2", r, "60"],
      ["Curl femoral acostado", "3", r, "60"],
      ["ElevaciÃ³n de piernas colgado", "3", "10-15", "45"],
    ];
  }
  if (c) list.push(["Cardio HIIT " + c + " min", "1", "3 rondas", "0"]);
  return list;
}

function chestExercises(o: string): ExerciseItem[] {
  return pushExercises(o, 0).slice(0, 4);
}

function backExercises(o: string): ExerciseItem[] {
  return pullExercises(o).slice(0, 4);
}

function shoulderExercises(o: string): ExerciseItem[] {
  const r = repsFor(o);
  return [
    ["Press militar con barra", "4", r, "90"],
    ["Elevaciones laterales", "4", "12-15", "60"],
    ["PÃ¡jaros (deltoides posterior)", "3", "12-15", "60"],
    ["Elevaciones frontales", "3", "10-12", "60"],
  ];
}

function armsExercises(o: string): ExerciseItem[] {
  const r = repsFor(o);
  return [
    ["Curl con barra", "4", r, "60"],
    ["Curl martillo alternado", "3", "10-12", "60"],
    ["ExtensiÃ³n de trÃ­ceps en polea con soga", "4", r, "60"],
    ["Fondos en banco", "3", "10-15", "60"],
    ["Curl en banco Scott", "3", r, "60"],
    ["ExtensiÃ³n de trÃ­ceps por encima de la cabeza", "3", r, "60"],
  ];
}

export function buildRoutine(
  objetivo: string,
  experiencia: string,
  dias: number,
  prioridad = ""
): { label: string; splitName: string; days: RoutineDay[] } {
  const o = objetivo;
  const exp = experiencia;
  const d = Number(dias);
  let days: RoutineDay[] = [];
  let splitName = "";

  if (exp === "principiante") {
    if (d === 2) {
      splitName = "Full Body A / B";
      days = [
        { name: "DÃ­a 1 Â· Full Body A", focus: "Cuerpo completo Â· Compuestos", items: fullBodyExercises(o, "A") },
        { name: "DÃ­a 2 Â· Full Body B", focus: "Cuerpo completo Â· Variantes", items: fullBodyExercises(o, "B") },
      ];
    } else if (d === 3) {
      splitName = "Full Body A / B / C";
      days = [
        { name: "DÃ­a 1 Â· Full Body A", focus: "Cuerpo completo Â· Compuestos", items: fullBodyExercises(o, "A") },
        { name: "DÃ­a 2 Â· Full Body B", focus: "Cuerpo completo Â· Variantes", items: fullBodyExercises(o, "B") },
        { name: "DÃ­a 3 Â· Full Body A", focus: "Cuerpo completo Â· Compuestos", items: fullBodyExercises(o, "A") },
      ];
    } else if (d === 4) {
      splitName = "Upper / Lower Ã—2";
      days = [
        { name: "DÃ­a 1 Â· Upper A", focus: "Tren superior", items: upperExercises(o) },
        { name: "DÃ­a 2 Â· Lower A", focus: "Tren inferior", items: lowerExercises(o) },
        { name: "DÃ­a 3 Â· Upper B", focus: "Tren superior Â· Variantes", items: upperExercises(o) },
        { name: "DÃ­a 4 Â· Lower B", focus: "Tren inferior Â· Variantes", items: lowerExercises(o) },
      ];
    } else if (d === 5) {
      splitName = "Full Body + Upper / Lower mix";
      days = [
        { name: "DÃ­a 1 Â· Full Body A", focus: "Cuerpo completo", items: fullBodyExercises(o, "A") },
        { name: "DÃ­a 2 Â· Upper", focus: "Tren superior", items: upperExercises(o) },
        { name: "DÃ­a 3 Â· Full Body B", focus: "Cuerpo completo", items: fullBodyExercises(o, "B") },
        { name: "DÃ­a 4 Â· Lower", focus: "Tren inferior", items: lowerExercises(o) },
        { name: "DÃ­a 5 Â· Full Body A", focus: "Cuerpo completo", items: fullBodyExercises(o, "A") },
      ];
    } else {
      splitName = "Upper / Lower alternado";
      days = [
        { name: "DÃ­a 1 Â· Upper A", focus: "Tren superior", items: upperExercises(o) },
        { name: "DÃ­a 2 Â· Lower A", focus: "Tren inferior", items: lowerExercises(o) },
        { name: "DÃ­a 3 Â· Upper B", focus: "Tren superior Â· Variantes", items: upperExercises(o) },
        { name: "DÃ­a 4 Â· Lower B", focus: "Tren inferior Â· Variantes", items: lowerExercises(o) },
        { name: "DÃ­a 5 Â· Upper A", focus: "Tren superior", items: upperExercises(o) },
        { name: "DÃ­a 6 Â· Lower A", focus: "Tren inferior", items: lowerExercises(o) },
      ];
    }
  } else if (exp === "intermedio") {
    if (d === 2) {
      splitName = "Full Body A / B";
      days = [
        { name: "DÃ­a 1 Â· Full Body A", focus: "Cuerpo completo", items: fullBodyExercises(o, "A") },
        { name: "DÃ­a 2 Â· Full Body B", focus: "Cuerpo completo Â· Variantes", items: fullBodyExercises(o, "B") },
      ];
    } else if (d === 3) {
      splitName = "Push / Pull / Legs";
      days = [
        { name: "DÃ­a 1 Â· Push", focus: "Pecho Â· Hombros Â· TrÃ­ceps", items: pushExercises(o, 0) },
        { name: "DÃ­a 2 Â· Pull", focus: "Espalda Â· BÃ­ceps", items: pullExercises(o) },
        { name: "DÃ­a 3 Â· Legs", focus: "Piernas Â· GlÃºteos", items: legsExercises(o) },
      ];
    } else if (d === 4) {
      splitName = "Upper / Lower Ã—2";
      days = [
        { name: "DÃ­a 1 Â· Upper A", focus: "Tren superior intenso", items: upperExercises(o) },
        { name: "DÃ­a 2 Â· Lower A", focus: "Tren inferior intenso", items: lowerExercises(o) },
        { name: "DÃ­a 3 Â· Upper B", focus: "Tren superior Â· Variantes", items: upperExercises(o) },
        { name: "DÃ­a 4 Â· Lower B", focus: "Tren inferior Â· Variantes", items: lowerExercises(o) },
      ];
    } else if (d === 5) {
      splitName = "Push / Pull / Legs + Upper / Lower";
      days = [
        { name: "DÃ­a 1 Â· Push", focus: "Pecho Â· Hombros Â· TrÃ­ceps", items: pushExercises(o, 0) },
        { name: "DÃ­a 2 Â· Pull", focus: "Espalda Â· BÃ­ceps", items: pullExercises(o) },
        { name: "DÃ­a 3 Â· Legs", focus: "Piernas Â· GlÃºteos", items: legsExercises(o) },
        { name: "DÃ­a 4 Â· Upper", focus: "Tren superior", items: upperExercises(o) },
        { name: "DÃ­a 5 Â· Lower", focus: "Tren inferior", items: lowerExercises(o) },
      ];
    } else {
      splitName = "Push / Pull / Legs Ã—2";
      days = [
        { name: "DÃ­a 1 Â· Push A", focus: "Pecho Â· Hombros Â· TrÃ­ceps", items: pushExercises(o, 0) },
        { name: "DÃ­a 2 Â· Pull A", focus: "Espalda Â· BÃ­ceps", items: pullExercises(o) },
        { name: "DÃ­a 3 Â· Legs A", focus: "Piernas Â· GlÃºteos", items: legsExercises(o) },
        { name: "DÃ­a 4 Â· Push B", focus: "Pecho Â· Hombros Â· TrÃ­ceps", items: pushExercises(o, 0) },
        { name: "DÃ­a 5 Â· Pull B", focus: "Espalda Â· BÃ­ceps", items: pullExercises(o) },
        { name: "DÃ­a 6 Â· Legs B", focus: "Piernas Â· GlÃºteos", items: legsExercises(o) },
      ];
    }
  } else {
    if (d === 2) {
      splitName = "Full Body A / B Intensivo";
      days = [
        { name: "DÃ­a 1 Â· Full Body A", focus: "Cuerpo completo Â· Sobrecarga", items: fullBodyExercises(o, "A") },
        { name: "DÃ­a 2 Â· Full Body B", focus: "Cuerpo completo Â· Variantes", items: fullBodyExercises(o, "B") },
      ];
    } else if (d === 3) {
      splitName = "Push / Pull / Legs Â· Intensivo";
      days = [
        { name: "DÃ­a 1 Â· Push", focus: "Pecho Â· Hombros Â· TrÃ­ceps", items: pushExercises(o, 1) },
        { name: "DÃ­a 2 Â· Pull", focus: "Espalda Â· BÃ­ceps", items: pullExercises(o) },
        { name: "DÃ­a 3 Â· Legs", focus: "Piernas Â· GlÃºteos", items: legsExercises(o) },
      ];
    } else if (d === 4) {
      splitName = "Upper / Lower Ã—2 Avanzado";
      days = [
        { name: "DÃ­a 1 Â· Upper A", focus: "Tren superior con sobrecarga", items: upperExercises(o) },
        { name: "DÃ­a 2 Â· Lower A", focus: "Tren inferior con sobrecarga", items: lowerExercises(o) },
        { name: "DÃ­a 3 Â· Upper B", focus: "Tren superior con sobrecarga", items: upperExercises(o) },
        { name: "DÃ­a 4 Â· Lower B", focus: "Tren inferior con sobrecarga", items: lowerExercises(o) },
      ];
    } else if (d === 5) {
      splitName = "Weider Â· Pecho / Espalda / Piernas / Hombros / Brazos";
      days = [
        { name: "DÃ­a 1 Â· Pecho + Abdomen", focus: "Pecho Â· Core", items: chestExercises(o).concat([["Plancha con peso", "3", "45-60 seg", "45"]]) },
        { name: "DÃ­a 2 Â· Espalda", focus: "Espalda Â· Dorsales", items: backExercises(o) },
        { name: "DÃ­a 3 Â· Piernas", focus: "Piernas Â· GlÃºteos", items: legsExercises(o) },
        { name: "DÃ­a 4 Â· Hombros + Trampa", focus: "Hombros Â· Deltoides", items: shoulderExercises(o) },
        { name: "DÃ­a 5 Â· Brazos + Cardio", focus: "BÃ­ceps Â· TrÃ­ceps", items: armsExercises(o) },
      ];
    } else {
      splitName = "Push / Pull / Legs Ã—2 Â· Avanzado";
      days = [
        { name: "DÃ­a 1 Â· Push A", focus: "Pecho Â· Hombros Â· TrÃ­ceps", items: pushExercises(o, 1) },
        { name: "DÃ­a 2 Â· Pull A", focus: "Espalda Â· BÃ­ceps", items: pullExercises(o) },
        { name: "DÃ­a 3 Â· Legs A", focus: "Piernas Â· GlÃºteos", items: legsExercises(o) },
        { name: "DÃ­a 4 Â· Push B", focus: "Pecho Â· Hombros Â· TrÃ­ceps", items: pushExercises(o, 1) },
        { name: "DÃ­a 5 Â· Pull B", focus: "Espalda Â· BÃ­ceps", items: pullExercises(o) },
        { name: "DÃ­a 6 Â· Legs B", focus: "Piernas Â· GlÃºteos", items: legsExercises(o) },
      ];
    }
  }

  applyPriority(days, prioridad);

  const prio = PRIORITY_LABELS[prioridad];
  const label =
    d + " DÃ­as " + splitName + " / Enfoque: " + FOCUS[o] + (prio ? " Â· Prioridad: " + prio : "");
  return { label, days, splitName };
}

export function buildNutrition(
  objetivo: string,
  weight: unknown,
  prefs: string[],
  tdee?: number
): NutritionData {
  const w = Number(weight) || 75;
  let cal: number, prot: number, cg: number, gr: number;
  if (tdee) {
    if (objetivo === "ganar-masa") {
      cal = Math.round(tdee * 1.10);
    } else if (objetivo === "perder-grasa") {
      cal = Math.round(tdee * 0.80);
    } else {
      cal = tdee;
    }
    prot = Math.round(w * 2.0);
    gr = Math.round(Math.max(w * 0.8, 40));
    cg = Math.round(Math.max((cal - prot * 4 - gr * 9) / 4, 0));
  } else if (objetivo === "ganar-masa") {
    cal = Math.round(w * 36); prot = Math.round(w * 1.9); cg = Math.round(w * 4.5); gr = Math.round(w * 0.9);
  } else if (objetivo === "perder-grasa") {
    cal = Math.round(w * 26); prot = Math.round(w * 2.2); cg = Math.round(w * 2.2); gr = Math.round(w * 0.9);
  } else {
    cal = Math.round(w * 31); prot = Math.round(w * 2.1); cg = Math.round(w * 3.2); gr = Math.round(w * 0.9);
  }

  let meat: string;
  if (prefs.indexOf("Vegano") !== -1) {
    meat = "Soja texturizada, legumbres, quinoa, tofu, tempeh y proteÃ­na vegetal";
  } else if (prefs.indexOf("Vegetariano") !== -1) {
    meat = "Tofu, tempeh, legumbres, proteÃ­na vegetal, huevos y lÃ¡cteos";
  } else {
    meat = "Pollo, carne magra, pescado, huevos y lÃ¡cteos";
  }
  const carbsNote =
    prefs.indexOf("CelÃ­aco") !== -1
      ? " (solo alimentos sin TACC: arroz, papa, batata, quinoa, avena certificada)"
      : "";

  return {
    cal,
    prot,
    carbs: cg,
    fat: gr,
    proteinSources: meat + carbsNote,
    meals: [
      ["Desayuno", "Avena/pan integral" + (meat.indexOf("Tofu") !== -1 ? carbsNote : "") + " + proteÃ­na + fruta y frutos secos"],
      ["Almuerzo", "PorciÃ³n de proteÃ­na + arroz/papa/batata o legumbres + vegetales + aceite de oliva"],
      ["Merienda", "Yogur griego o licuado con proteÃ­na + banana + 1 porciÃ³n de frutos secos"],
      ["Cena", "ProteÃ­na + vegetales abundantes + grasa saludable (palta/aceite)"],
    ],
  };
}

export function generatePayload(meta: Meta): ClientPayload | null {
  const name = metaString(meta, "name", "name");
  if (!name) return null;

  const objectiveKey = metaString(meta, "objectiveKey", "objective_key");
  const experienceKey = metaString(meta, "experienceKey", "experience_key");
  const priorityKey = metaString(meta, "priority", "priority") || "";
  const days = metaNumber(meta, "days", "days", 3);
  const weight = metaNumber(meta, "weight", "weight", 75);
  const height = metaNumber(meta, "height", "height", 0);
  const age = metaNumber(meta, "age", "age", 0);
  const prefsRaw = asStringArray(meta.prefs);
  const prefs =
    prefsRaw.length > 0
      ? prefsRaw
      : (() => {
          const raw = asString(meta.prefsRaw);
          return raw ? raw.split(", ").filter(Boolean) : ["OmnÃ­voro"];
        })();

  const objective = OBJECTIVE_LABELS[objectiveKey] ?? (objectiveKey || "Sin objetivo");
  const experience = EXPERIENCE_LABELS[experienceKey] ?? (experienceKey || "Sin experiencia");

  const sex = metaString(meta, "sex", "sex") || "Masculino";

  const imc =
    height > 0
      ? (weight / Math.pow(height / 100, 2)).toFixed(1)
      : "";
  let imcCategory = "";
  if (height > 0) {
    const imcNum = weight / Math.pow(height / 100, 2);
    if (imcNum < 18.5) imcCategory = "Bajo peso";
    else if (imcNum < 25) imcCategory = "Normal";
    else if (imcNum < 30) imcCategory = "Sobrepeso";
    else imcCategory = "Obesidad";
  }

  let tmb = 0;
  if (sex === "Femenino") {
    tmb = 10 * weight + 6.25 * height - 5 * age - 161;
  } else {
    tmb = 10 * weight + 6.25 * height - 5 * age + 5;
  }

  let actFactor = 1.2;
  if (days >= 5) actFactor = 1.725;
  else if (days >= 3) actFactor = 1.55;
  else actFactor = 1.375;

  const tdee = Math.round(tmb * actFactor);

  const routine = buildRoutine(objectiveKey, experienceKey, days, priorityKey);
  const nutrition = buildNutrition(objectiveKey, weight, prefs, tdee);

  const planName = metaString(meta, "planName", "plan_name");

  return {
    fecha: metaString(meta, "fecha", "fecha") || new Date().toISOString().slice(0, 10),
    name,
    contact: metaString(meta, "contact", "contact"),
    sex,
    priority: PRIORITY_LABELS[priorityKey] || "",
    age,
    height,
    weight,
    objective,
    experience,
    days,
    prefs,
    bmi: imc,
    imcCategory,
    tmb: Math.round(tmb),
    tdee,
    activityFactor: actFactor,
    routineLabel: routine.label,
    routine: routine as RoutineData,
    nutrition,
    plan: planName ? { name: planName } : undefined,
  };
}
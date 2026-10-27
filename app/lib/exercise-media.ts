export const ANATOMY_DIR = "/img/exercises";
export const ANATOMY_EXT = "webp";
export const GENERIC_ANATOMY_SLUG = "_anatomy-3d";

export const GENERIC_ANATOMY_SRC = `${ANATOMY_DIR}/${GENERIC_ANATOMY_SLUG}.svg`;

function normalize(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type Rule = { match: RegExp; slug: string; en: string };

const RULES: Rule[] = [
  { match: /curl femoral/, slug: "lying-leg-curl", en: "Lying Leg Curl" },
  { match: /scott/, slug: "preacher-curl", en: "Preacher Curl" },
  { match: /curl martillo/, slug: "hammer-curl", en: "Hammer Curl" },
  { match: /curl con barra/, slug: "barbell-curl", en: "Barbell Curl" },
  { match: /curl de biceps|curl biceps/, slug: "biceps-curl", en: "Dumbbell Biceps Curl" },
  {
    match: /triceps.*(por encima|sobre la cabeza)|triceps sobre|overhead/,
    slug: "overhead-triceps-extension",
    en: "Overhead Triceps Extension",
  },
  { match: /extension de triceps|triceps en polea/, slug: "triceps-pushdown", en: "Triceps Pushdown" },
  { match: /triceps.*(polea|agarre individual)|polea.*triceps/, slug: "triceps-pushdown", en: "Triceps Pushdown" },
  { match: /press.*(triceps|frances|a 45)|triceps.*press/, slug: "overhead-triceps-extension", en: "Overhead Triceps Extension" },
  { match: /fondos en banco|fondos/, slug: "bench-dips", en: "Bench Dips" },
  { match: /dominadas/, slug: "pull-up", en: "Pull-Up" },
  { match: /jalon/, slug: "lat-pulldown", en: "Lat Pulldown" },
  { match: /remo con barra/, slug: "barbell-row", en: "Barbell Row" },
  { match: /remo (sentado|en polea)/, slug: "seated-cable-row", en: "Seated Cable Row" },
  { match: /peso muerto rumano/, slug: "romanian-deadlift", en: "Romanian Deadlift" },
  { match: /sentadilla/, slug: "barbell-squat", en: "Barbell Back Squat" },
  { match: /prensa/, slug: "leg-press", en: "45-Degree Leg Press" },
  { match: /extension(es)? de cuadriceps/, slug: "leg-extension", en: "Leg Extension" },
  { match: /gemelos sentado|elevacion de gemelos sentado/, slug: "seated-calf-raise", en: "Seated Calf Raise" },
  { match: /gemelos|elevacion de talon/, slug: "standing-calf-raise", en: "Standing Calf Raise" },
  { match: /hip thrust/, slug: "hip-thrust", en: "Hip Thrust" },
  { match: /plancha/, slug: "plank", en: "Plank" },
  { match: /elevacion de piernas/, slug: "hanging-leg-raise", en: "Hanging Leg Raise" },
  { match: /press (de )?banca/, slug: "barbell-bench-press", en: "Barbell Bench Press" },
  { match: /press inclinado/, slug: "incline-dumbbell-press", en: "Incline Dumbbell Press" },
  { match: /aperturas/, slug: "dumbbell-fly", en: "Dumbbell Fly" },
  { match: /press militar/, slug: "overhead-press", en: "Overhead Press" },
  { match: /elevaciones laterales|elevacion lateral/, slug: "lateral-raise", en: "Lateral Raise" },
  { match: /elevaciones frontales|elevacion frontal/, slug: "front-raise", en: "Front Raise" },
  { match: /pajaros|deltoides posterior/, slug: "rear-delt-fly", en: "Rear Delt Fly" },
  { match: /rotacion externa/, slug: "rear-delt-fly", en: "Rear Delt Fly" },
  { match: /cardio|hiit/, slug: "hiit-cardio", en: "HIIT Cardio" },
];

export function exerciseAnatomySlug(name: string): string | null {
  const text = normalize(name);
  if (!text) return null;
  for (const rule of RULES) {
    if (rule.match.test(text)) return rule.slug;
  }
  return null;
}

export function exerciseEnglishName(name: string): string | null {
  const text = normalize(name);
  if (!text) return null;
  for (const rule of RULES) {
    if (rule.match.test(text)) return rule.en;
  }
  return null;
}

export function exerciseAnatomySrc(name: string): string {
  const slug = exerciseAnatomySlug(name);
  return slug ? `${ANATOMY_DIR}/${slug}.${ANATOMY_EXT}` : GENERIC_ANATOMY_SRC;
}

/**
 * Demostraciones animadas (GIF en loop) hosteadas en un CDN público, por slug.
 * Fuente: ExerciseGymGifsDB (https://github.com/JahelCuadrado/ExerciseGymGifsDB).
 * La app cae a la ilustracion 3D si el GIF no está disponible.
 */
const GIF_CDN = "https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0";

const GIF_BY_SLUG: Record<string, string> = {
  "barbell-bench-press": "pectorals/barbell-bench-press",
  "incline-dumbbell-press": "pectorals/dumbbell-incline-bench-press",
  "dumbbell-fly": "pectorals/dumbbell-fly",
  "overhead-press": "delts/barbell-standing-wide-military-press",
  "lateral-raise": "delts/dumbbell-lateral-raise",
  "front-raise": "delts/dumbbell-front-raise",
  "rear-delt-fly": "delts/dumbbell-rear-lateral-raise",
  "triceps-pushdown": "triceps/cable-pushdown",
  "overhead-triceps-extension": "triceps/barbell-standing-overhead-triceps-extension",
  "bench-dips": "triceps/bench-dip-knees-bent",
  "pull-up": "lats/pull-up",
  "lat-pulldown": "lats/cable-pulldown",
  "barbell-row": "upper-back/barbell-bent-over-row",
  "seated-cable-row": "upper-back/cable-seated-row",
  "barbell-curl": "biceps/barbell-curl",
  "hammer-curl": "biceps/dumbbell-alternate-seated-hammer-curl",
  "biceps-curl": "biceps/dumbbell-biceps-curl",
  "preacher-curl": "biceps/barbell-preacher-curl",
  "barbell-squat": "glutes/barbell-low-bar-squat",
  "leg-press": "glutes/sled-45-leg-press",
  "romanian-deadlift": "glutes/barbell-romanian-deadlift",
  "hip-thrust": "glutes/resistance-band-hip-thrusts-on-knees-female",
  "leg-extension": "quads/lever-leg-extension",
  "lying-leg-curl": "hamstrings/lever-lying-leg-curl",
  "standing-calf-raise": "calves/standing-calves",
  "seated-calf-raise": "calves/lever-seated-calf-raise",
  "plank": "abs/weighted-front-plank",
  "hanging-leg-raise": "abs/hanging-leg-raise",
  "hiit-cardio": "cardio/burpee",
};

export function exerciseGifSrc(name: string): string | null {
  const slug = exerciseAnatomySlug(name);
  if (!slug) return null;
  const path = GIF_BY_SLUG[slug];
  return path ? `${GIF_CDN}/${path}.gif` : null;
}

/**
 * Modo de media para las demostraciones:
 *  - "gif" (default): GIF animado real (movimiento fluido, sin parpadeo) del CDN
 *          ExerciseGymGifsDB (© Gym visual; verificar licencia para uso comercial).
 *  - "pd": imagenes fijas de dominio publico (free-exercise-db, Unlicense). Sin animación.
 * Se controla con NEXT_PUBLIC_EXERCISE_MEDIA ("gif" | "pd").
 */
export const EXERCISE_MEDIA_MODE: "gif" | "pd" =
  process.env.NEXT_PUBLIC_EXERCISE_MEDIA === "pd" ? "pd" : "gif";

const PD_CDN = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises";

const PD_BY_SLUG: Record<string, string> = {
  "barbell-bench-press": "Barbell_Bench_Press_-_Medium_Grip",
  "incline-dumbbell-press": "Incline_Dumbbell_Press",
  "dumbbell-fly": "Dumbbell_Flyes",
  "overhead-press": "Standing_Military_Press",
  "lateral-raise": "Side_Lateral_Raise",
  "front-raise": "Front_Dumbbell_Raise",
  "rear-delt-fly": "Cable_Rear_Delt_Fly",
  "triceps-pushdown": "Triceps_Pushdown",
  "overhead-triceps-extension": "Cable_Rope_Overhead_Triceps_Extension",
  "bench-dips": "Bench_Dips",
  "pull-up": "Pullups",
  "lat-pulldown": "Wide-Grip_Lat_Pulldown",
  "barbell-row": "Bent_Over_Barbell_Row",
  "seated-cable-row": "Seated_Cable_Rows",
  "barbell-curl": "Barbell_Curl",
  "hammer-curl": "Hammer_Curls",
  "biceps-curl": "Dumbbell_Bicep_Curl",
  "preacher-curl": "Preacher_Curl",
  "barbell-squat": "Barbell_Squat",
  "leg-press": "Leg_Press",
  "romanian-deadlift": "Romanian_Deadlift",
  "hip-thrust": "Barbell_Hip_Thrust",
  "leg-extension": "Leg_Extensions",
  "lying-leg-curl": "Lying_Leg_Curls",
  "standing-calf-raise": "Standing_Calf_Raises",
  "seated-calf-raise": "Seated_Calf_Raise",
  "plank": "Plank",
  "hanging-leg-raise": "Hanging_Leg_Raise",
  "hiit-cardio": "Mountain_Climbers",
};

/** Dos fotogramas (posición inicial/final) de free-exercise-db, o null. */
export function exercisePdFrames(name: string): string[] | null {
  const slug = exerciseAnatomySlug(name);
  if (!slug) return null;
  const id = PD_BY_SLUG[slug];
  if (!id) return null;
  return [`${PD_CDN}/${id}/0.jpg`, `${PD_CDN}/${id}/1.jpg`];
}

/** Un solo fotograma fijo (posición inicial) de free-exercise-db, o null. */
export function exercisePdStill(name: string): string | null {
  const frames = exercisePdFrames(name);
  return frames ? frames[0] : null;
}

/** Fuentes a precargar según el modo activo. */
export function exerciseDemoPreload(name: string): string[] {
  if (EXERCISE_MEDIA_MODE === "gif") {
    const gif = exerciseGifSrc(name);
    if (gif) return [gif];
  }
  const still = exercisePdStill(name);
  return still ? [still] : [exerciseAnatomySrc(name)];
}



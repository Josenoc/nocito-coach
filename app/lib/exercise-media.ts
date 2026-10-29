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
  { match: /curl.*(inclinado|banco a 45|banco inclinado)/, slug: "incline-dumbbell-curl", en: "Incline Dumbbell Curl" },
  { match: /curl de biceps|curl biceps/, slug: "biceps-curl", en: "Dumbbell Biceps Curl" },
  {
    match: /triceps.*(por encima|sobre la cabeza)|triceps sobre|overhead/,
    slug: "overhead-triceps-extension",
    en: "Overhead Triceps Extension",
  },
  { match: /extension de triceps|triceps en polea/, slug: "triceps-pushdown", en: "Triceps Pushdown" },
  { match: /triceps.*(polea|agarre individual)|polea.*triceps/, slug: "triceps-pushdown", en: "Triceps Pushdown" },
  { match: /press.*(frances|a 45)/, slug: "overhead-triceps-extension", en: "Overhead Triceps Extension" },
  { match: /press.*(triceps|mancuerna)|triceps.*press/, slug: "dumbbell-lying-triceps-extension", en: "Dumbbell Lying Triceps Extension" },
  { match: /fondos en banco|fondos/, slug: "bench-dips", en: "Bench Dips" },
  { match: /dominadas/, slug: "pull-up", en: "Pull-Up" },
  { match: /jalon/, slug: "lat-pulldown", en: "Lat Pulldown" },
  { match: /remo con barra/, slug: "barbell-row", en: "Barbell Row" },
  { match: /remo en barra t|remo.*barra.*t\b/, slug: "barbell-row", en: "Barbell Row" },
  { match: /remo t|remo.*maquina.*45|remo.*45/, slug: "barbell-row", en: "Barbell Row" },
  { match: /remo (sentado|en polea)/, slug: "seated-cable-row", en: "Seated Cable Row" },
  { match: /peso muerto rumano/, slug: "romanian-deadlift", en: "Romanian Deadlift" },
  { match: /sentadilla/, slug: "barbell-squat", en: "Barbell Back Squat" },
  { match: /prensa/, slug: "leg-press", en: "45-Degree Leg Press" },
  { match: /extension(es)? de cuadriceps/, slug: "leg-extension", en: "Leg Extension" },
  { match: /gemelos sentado|elevacion de gemelos sentado/, slug: "seated-calf-raise", en: "Seated Calf Raise" },
  { match: /gemelos.*(parado|maquina|pie)/, slug: "lever-standing-calf-raise", en: "Lever Standing Calf Raise" },
  { match: /gemelos|elevacion de talon/, slug: "standing-calf-raise", en: "Standing Calf Raise" },
  { match: /hip thrust/, slug: "hip-thrust", en: "Hip Thrust" },
  { match: /plancha/, slug: "plank", en: "Plank" },
  { match: /elevacion de piernas/, slug: "hanging-leg-raise", en: "Hanging Leg Raise" },
  { match: /press (de )?banca/, slug: "barbell-bench-press", en: "Barbell Bench Press" },
  { match: /press inclinado/, slug: "incline-dumbbell-press", en: "Incline Dumbbell Press" },
  { match: /aperturas.*(posterior|deltoides trasero)/, slug: "rear-delt-fly", en: "Rear Delt Fly" },
  { match: /aperturas/, slug: "dumbbell-fly", en: "Dumbbell Fly" },
  { match: /elevaciones laterales|elevacion lateral/, slug: "lateral-raise", en: "Lateral Raise" },
  { match: /elevaciones frontales|elevacion frontal/, slug: "front-raise", en: "Front Raise" },
  { match: /pajaros|deltoides posterior/, slug: "rear-delt-fly", en: "Rear Delt Fly" },
  { match: /rotacion externa/, slug: "rear-delt-fly", en: "Rear Delt Fly" },
  { match: /sentadilla isometrica/, slug: "wall-sit", en: "Wall Sit" },
  { match: /sentadilla bulgara/, slug: "bulgarian-split-squat", en: "Bulgarian Split Squat" },
  { match: /subidas a la silla|subidas.*banco/, slug: "step-up", en: "Step Up" },
  { match: /puente de gluteos/, slug: "hip-thrust", en: "Hip Thrust" },
  { match: /elevaciones de talon|elevacion de talon/, slug: "standing-calf-raise", en: "Standing Calf Raise" },
  { match: /estocadas/, slug: "dumbbell-lunge", en: "Dumbbell Lunge" },
  { match: /flexiones con rodillas/, slug: "kneeling-push-up-male", en: "Kneeling Push Up" },
  { match: /flexiones en pica/, slug: "exercise-ball-pike-push-up", en: "Pike Push Up" },
  { match: /flexiones de brazo/, slug: "push-up", en: "Push Up" },
  { match: /fondos de triceps en silla/, slug: "bench-dip-knees-bent", en: "Bench Dip" },
  { match: /espinales|nados secos/, slug: "back-extension", en: "Back Extension" },
  { match: /remo horizontal.*(mochila|bidon)/, slug: "barbell-row", en: "Barbell Row" },
  { match: /plancha lateral/, slug: "side-plank", en: "Side Plank" },
  { match: /plancha tradicional|plancha$/, slug: "plank", en: "Plank" },
  { match: /abdominales cortitos|crunch/, slug: "crunch-floor", en: "Crunch" },
  { match: /abdominales bici|abdominales.*bici/, slug: "air-bike", en: "Air Bike" },
  { match: /elevaciones de piernas/, slug: "hanging-leg-raise", en: "Hanging Leg Raise" },
  { match: /abdominales bolita|crunch invertido/, slug: "cable-reverse-crunch", en: "Reverse Crunch" },
  { match: /espabiladas|mountain climbers/, slug: "mountain-climber", en: "Mountain Climber" },
  { match: /angelitos|jumping jacks/, slug: "jack-jump-male", en: "Jumping Jack" },
  { match: /burpees/, slug: "burpee", en: "Burpee" },
  { match: /saltos de soga/, slug: "jump-rope", en: "Jump Rope" },
  { match: /sentadillas con salto/, slug: "semi-squat-jump-male", en: "Squat Jump" },
  { match: /trote en el lugar|skipping/, slug: "walking-high-knees-lunge", en: "High Knees" },
  { match: /cardio|hiit/, slug: "hiit-cardio", en: "HIIT Cardio" },

  { match: /zancadas/, slug: "dumbbell-lunge", en: "Dumbbell Lunge" },
  { match: /bulgara/, slug: "bulgarian-split-squat", en: "Bulgarian Split Squat" },
  { match: /patada.*(gluteo|polea)/, slug: "cable-glute-kickback", en: "Cable Glute Kickback" },
  { match: /abductor/, slug: "hip-abduction", en: "Hip Abduction" },
  { match: /aductor/, slug: "hip-adduction", en: "Hip Adduction" },
  { match: /press plano.*(mancuerna|dumbbell)/, slug: "dumbbell-bench-press", en: "Dumbbell Bench Press" },
  { match: /press declinado/, slug: "decline-bench-press", en: "Decline Bench Press" },
  { match: /remo.*(mancuerna|una mano)/, slug: "one-arm-dumbbell-row", en: "One Arm Dumbbell Row" },
  { match: /pullover.*(polea|alta)/, slug: "cable-pullover", en: "Cable Pullover" },
  { match: /extension(es)? lumbares|lumbares en banco/, slug: "back-extension", en: "Back Extension" },
  { match: /press militar.*(mancuerna|dumbbell)/, slug: "dumbbell-shoulder-press", en: "Dumbbell Shoulder Press" },
  { match: /face pull/, slug: "face-pull", en: "Face Pull" },
  { match: /curl concentrado/, slug: "concentration-curl", en: "Concentration Curl" },
  { match: /fondos en paralelas/, slug: "parallel-bar-dip", en: "Parallel Bar Dip" },
  { match: /pallof/, slug: "pallof-press", en: "Pallof Press" },
  { match: /caminata aerobica|caminata/, slug: "treadmill-walk", en: "Treadmill Walk" },
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
  "hip-thrust": "glutes/barbell-glute-bridge",
  "leg-extension": "quads/lever-leg-extension",
  "lying-leg-curl": "hamstrings/lever-lying-leg-curl",
  "standing-calf-raise": "calves/standing-calves",
  "seated-calf-raise": "calves/lever-seated-calf-raise",
  "plank": "abs/weighted-front-plank",
  "hanging-leg-raise": "abs/hanging-leg-raise",
  "hiit-cardio": "cardio/burpee",
  "incline-dumbbell-curl": "biceps/dumbbell-incline-biceps-curl",
  "dumbbell-lying-triceps-extension": "triceps/dumbbell-lying-triceps-extension",
  "lever-standing-calf-raise": "calves/lever-standing-calf-raise",
  "dumbbell-lunge": "glutes/dumbbell-lunge",
  "dumbbell-bench-press": "pectorals/dumbbell-bench-press",
  "decline-bench-press": "pectorals/barbell-decline-bench-press",
  "one-arm-dumbbell-row": "upper-back/dumbbell-one-arm-bent-over-row",
  "concentration-curl": "biceps/dumbbell-concentration-curl",
  "push-up": "pectorals/push-up",
  "kneeling-push-up-male": "pectorals/kneeling-push-up-male",
  "exercise-ball-pike-push-up": "pectorals/exercise-ball-pike-push-up",
  "bench-dip-knees-bent": "triceps/bench-dip-knees-bent",
  "mountain-climber": "cardio/mountain-climber",
  "jack-jump-male": "cardio/jack-jump-male",
  "jump-rope": "cardio/jump-rope",
  "burpee": "cardio/burpee",
  "semi-squat-jump-male": "cardio/semi-squat-jump-male",
  "walking-high-knees-lunge": "cardio/walking-high-knees-lunge",
  "crunch-floor": "abs/crunch-floor",
  "air-bike": "abs/air-bike",
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
  "incline-dumbbell-curl": "Dumbbell_Bicep_Curl",
  "dumbbell-lying-triceps-extension": "Triceps_Pushdown",
  "lever-standing-calf-raise": "Standing_Calf_Raises",
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



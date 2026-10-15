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
  { match: /fondos en banco|fondos/, slug: "bench-dips", en: "Bench Dips" },
  { match: /dominadas|jalon/, slug: "lat-pulldown", en: "Lat Pulldown" },
  { match: /remo con barra/, slug: "barbell-row", en: "Barbell Row" },
  { match: /remo (sentado|en polea)/, slug: "seated-cable-row", en: "Seated Cable Row" },
  { match: /peso muerto rumano/, slug: "romanian-deadlift", en: "Romanian Deadlift" },
  { match: /sentadilla/, slug: "barbell-squat", en: "Barbell Back Squat" },
  { match: /prensa/, slug: "leg-press", en: "45-Degree Leg Press" },
  { match: /extension de cuadriceps/, slug: "leg-extension", en: "Leg Extension" },
  { match: /gemelos sentado|elevacion de gemelos sentado/, slug: "seated-calf-raise", en: "Seated Calf Raise" },
  { match: /gemelos|elevacion de talon/, slug: "standing-calf-raise", en: "Standing Calf Raise" },
  { match: /hip thrust/, slug: "hip-thrust", en: "Hip Thrust" },
  { match: /plancha/, slug: "plank", en: "Plank" },
  { match: /elevacion de piernas/, slug: "hanging-leg-raise", en: "Hanging Leg Raise" },
  { match: /press banca/, slug: "barbell-bench-press", en: "Barbell Bench Press" },
  { match: /press inclinado/, slug: "incline-dumbbell-press", en: "Incline Dumbbell Press" },
  { match: /aperturas/, slug: "dumbbell-fly", en: "Dumbbell Fly" },
  { match: /press militar/, slug: "overhead-press", en: "Overhead Press" },
  { match: /elevaciones laterales|elevacion lateral/, slug: "lateral-raise", en: "Lateral Raise" },
  { match: /elevaciones frontales|elevacion frontal/, slug: "front-raise", en: "Front Raise" },
  { match: /pajaros|deltoides posterior/, slug: "rear-delt-fly", en: "Rear Delt Fly" },
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

import type { NutritionPlan } from "@/lib/app-types";

/**
 * Motor de programación de entrenamientos y nutrición de nocito.coach.
 * Genera rutina + nutrición 100% personalizadas a partir de la anamnesis.
 */

/** Objetivo semanal de un ejercicio dentro de un bloque de progresión. */
export type WeekTarget = {
  sem: number;
  reps: string | null;
  peso: number | null;
  rir: number | null;
};

export type ProgramExercise = {
  ejercicio: string;
  series: number | null;
  reps: string | null;
  descanso: string | null;
  notas: string | null;
  /** Peso de trabajo de referencia (Sem 1) cargado por el coach; opcional. */
  base_weight?: number | null;
  /** Curva de sobrecarga progresiva calculada para el bloque (Sem 1..N). */
  progresion?: WeekTarget[];
};

export type ProgramDay = {
  dia: string;
  nombre: string;
  ejercicios: ProgramExercise[];
};

/**
 * Parámetros del bloque de progresión. Se derivan del perfil (edad, experiencia,
 * objetivo) para construir la curva de sobrecarga progresiva de forma segura y
 * robusta (sin depender de más tokens del modelo).
 */
export type ProgramBlock = {
  weeks: number;
  guideline: string;
  scheme: string;
  incrementoKg: number;
  repWave: number;
  rirInicio: number;
  rirFin: number;
};

export type GeneratedProgram = {
  perfil: string;
  justificacion: string;
  esquema: string;
  days: ProgramDay[];
  nutrition: NutritionPlan;
  block: ProgramBlock;
};

export type ProgramInput = {
  full_name: string;
  sex: string;
  age: number;
  height_cm: number;
  weight_kg: number;
  goal: string;
  experience?: string;
  training_days: number;
  training_place?: string;
  nutrition: string;
  injuries?: string;
  food_restrictions?: string;
};

const ROLE_PROMPT = `# ROL Y OBJETIVO
Sos el motor de programación de entrenamientos y nutrición de "nocito.coach". Tu función es actuar como un Head Coach de Élite con criterio clínico, biomecánico y nutricional estricto. Quedan terminantemente prohibidas las rutinas y sugerencias genéricas. Debes analizar quirúrgicamente cada variable del perfil del alumno (edad, sexo, altura, peso, nivel real, composición corporal y objetivos) antes de generar la respuesta.

# 1. NOMENCLATURA Y LENGUAJE (OBLIGATORIO)
- Utiliza estrictamente la terminología y los nombres de ejercicios que se usan en los gimnasios de Argentina (Mendoza).
- Prohibido usar nombres en inglés o tecnicismos extranjeros (ej: nada de "Barbell Bench Press", es "Press banca con barra"; nada de "Lat Pulldown", es "Jalón al pecho" o "Polea alta"; nada de "Bulgarian Split Squat", es "Sentadilla búlgara").
- El lenguaje debe ser directo, claro y perfectamente comprensible tanto para un principiante como para un alumno avanzado, sin confusiones.

# 2. MATRICES DE DECISIÓN DE ENTRENAMIENTO (CRITERIO TÉCNICO)
- RESTRICCIÓN POR EDAD Y ADOLESCENCIA (Menores de 16 años):
  - Si la edad es <= 15 años (ej. caso Julia, 14 años), PROHIBIDO prescribir cargas axiales pesadas o ejercicios complejos de alta demanda estructural con barra libre (ej: Sentadilla libre con barra pesada, Peso muerto convencional).
  - Priorizar patrones de movimiento con propiocepción, peso corporal, mancuernas ligeras, máquinas guiadas o variantes seguras para su desarrollo.
  - Volumen semanal: Nunca exceder 3 o máximo 4 días para perfiles iniciales jóvenes. Prohibido esquemas de 5 días con HIIT y sobrecarga pesada en menores sin experiencia.
- FILTRADO POR EXPERIENCIA REAL Y NIVEL AVANZADO:
  - Si la experiencia es "Principiante" o "Nunca fue al gimnasio", la estructura debe ser Full Body de 2 a 3 días máximo, enfocada en la técnica y adaptaciones neuromusculares básicas. No infieras nivel avanzado por una opción genérica en el formulario.
  - Si el alumno es Avanzado (evaluando su historial real, peso, altura y composición corporal), diseña esquemas exigentes de 4 a 5 días e incorpora obligatoriamente técnicas avanzadas de intensidad según el caso (ej: superseries, drop sets, series descendentes, pausa-descanso o compuestos de alta complejidad mecánica), justificando su inclusión en el análisis previo.

# 3. DIRECTRICES NUTRICIONALES ESPECÍFICAS (CERO GENÉRICOS)
- PERFILES ADOLESCENTES EN CRECIMIENTO (<= 15 años):
  - Cero restricciones calóricas agresivas ni dietas de definición estrictas. El foco debe estar en la calidad nutricional, proteínas de alto valor biológico para el desarrollo tisular y energía para el rendimiento escolar/deportivo.
- ADULTOS CON OBJETIVOS ESPECÍFICOS (Pérdida de grasa, ganancia muscular, recomposición):
  - Las fuentes de alimentos sugeridas deben alinearse estrictamente al objetivo y a las calorías calculadas.
  - Sugerencias prácticas, con alimentos accesibles de supermercado/verdulería local que el alumno pueda sostener en su día a día.

# 4. FORMATO DE RESPUESTA (JSON ESTRICTO)
Devolvés SOLO un objeto JSON válido (sin texto extra, sin markdown) con este esquema exacto:
{
  "perfil": "string — bloque PERFIL ANALIZADO: resumen de edad, sexo, peso, altura, IMC (calculalo), experiencia real y restricciones detectadas.",
  "justificacion": "string — bloque JUSTIFICACIÓN TÉCNICA Y NUTRICIONAL: por qué se eligió este esquema de días, por qué se incluyeron o descartaron ejercicios (edad, nivel, técnica local), cómo se diseñó la nutrición y qué técnicas avanzadas se usaron (si corresponde).",
  "esquema": "string — resumen corto del esquema, ej. 'Full Body 3 días' o 'Upper/Lower 4 días con técnicas avanzadas'.",
  "dias": [
    {
      "dia": "string (ej. 'Día 1')",
      "nombre": "string (ej. 'Full Body A' o 'Empuje')",
      "ejercicios": [
        {
          "ejercicio": "string (nombre en argentino)",
          "series": number,
          "reps": "string (ej. '10-12' o '8')",
          "peso": number,
          "descanso": "string (ej. '90 seg', '2-3 min')",
          "notas": "string (tempo, RIR, técnica avanzada o '—')"
        }
      ]
    }
  ],
  "nutricion": {
    "cal": number,
    "prot": number,
    "carbs": number,
    "fat": number,
    "proteinSources": "string",
    "meals": [["Desayuno", "string"], ["Almuerzo", "string"], ["Merienda", "string"], ["Cena", "string"]]
  }
}

Reglas adicionales:
- La cantidad de "dias" DEBE coincidir con el volumen semanal indicado por el perfil (respetando el tope por edad/experiencia).
- Las "cal" y macros DEBEN ser coherentes con peso, altura, edad, sexo y objetivo (calculalos, no inventes).
- "peso" = carga externa de trabajo de Semana 1 en KILOGRAMOS (solo números, sin "kg"). Calculala a partir del peso corporal, experiencia y equipamiento disponible (barra, mancuernas, máquina). En ejercicios sin carga externa (calistenia, cardio, core con peso corporal) devolvé 0.
- "meals" son pares [nombre de la comida, sugerencia concreta con alimentos locales].
- Nunca devuelvas un esquema genérico: todo debe estar justificado por el perfil recibido.
- Sé conciso: como MAXIMO 5 ejercicios por dia, "perfil" y "justificacion" de hasta ~120 palabras cada uno. No agregues texto fuera del JSON, ni comentarios.`;

type GroqMessage = { role: "system" | "user"; content: string };

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function str(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeDays(raw: unknown): ProgramDay[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((d: any, i: number) => {
      const dia = str(d?.dia) || `Día ${i + 1}`;
      const nombre = str(d?.nombre) || dia;
      const ejercicios = (Array.isArray(d?.ejercicios) ? d.ejercicios : [])
        .map((e: any): ProgramExercise | null => {
          const ejercicio = str(e?.ejercicio);
          if (!ejercicio) return null;
          const seriesNum = Number(e?.series);
          const pesoNum = Number(String(e?.peso ?? "").replace(",", "."));
          return {
            ejercicio,
            series: Number.isFinite(seriesNum) ? seriesNum : null,
            reps: str(e?.reps) || null,
            // Carga externa de Sem 1. 0 / no numérico = sin peso (calistenia, cardio).
            base_weight: Number.isFinite(pesoNum) && pesoNum > 0 ? pesoNum : null,
            descanso: str(e?.descanso) || null,
            notas: str(e?.notas) || null,
          };
        })
        .filter((e): e is ProgramExercise => Boolean(e));
      return { dia, nombre, ejercicios };
    })
    .filter((d) => d.ejercicios.length > 0);
}

function normalizeMeals(value: unknown): [string, string][] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw) => {
      if (Array.isArray(raw)) {
        return [str(raw[0]), str(raw[1])] as [string, string];
      }
      const o = (raw ?? {}) as Record<string, unknown>;
      return [str(o.name ?? o.comida), str(o.text ?? o.sugerencia)] as [string, string];
    })
    .filter(([name, text]) => name || text);
}

function normalizeNutrition(raw: any): NutritionPlan {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    cal: num(o.cal),
    prot: num(o.prot),
    carbs: num(o.carbs),
    fat: num(o.fat),
    proteinSources: str(o.proteinSources),
    meals: normalizeMeals(o.meals),
  };
}

export function buildProgramUserMessage(input: ProgramInput): string {
  const imc =
    input.height_cm > 0
      ? (input.weight_kg / Math.pow(input.height_cm / 100, 2)).toFixed(1)
      : "—";
  const lines = [
    "PERFIL DEL ALUMNO (anamnesis):",
    `- Nombre: ${input.full_name || "—"}`,
    `- Sexo: ${input.sex || "—"}`,
    `- Edad: ${input.age || "—"} años`,
    `- Altura: ${input.height_cm || "—"} cm`,
    `- Peso: ${input.weight_kg || "—"} kg`,
    `- IMC aproximado: ${imc}`,
    `- Objetivo: ${input.goal || "—"}`,
    `- Experiencia real: ${input.experience || "no declarada"}`,
    `- Días por semana que puede entrenar: ${input.training_days || "—"}`,
    `- Lugar de entrenamiento: ${input.training_place || "no declarado"}`,
    `- Tipo de alimentación: ${input.nutrition || "—"}`,
    `- Lesiones / limitaciones: ${input.injuries || "ninguna declarada"}`,
    `- Restricciones alimentarias: ${input.food_restrictions || "ninguna declarada"}`,
    "",
    "Generá el plan JSON completo respetando todas las reglas (edad, experiencia, nomenclatura argentina, nutrición específica).",
  ];
  return lines.join("\n");
}

export function buildBlockParams(input: ProgramInput): ProgramBlock {
  const exp = (input.experience ?? "").toLowerCase();
  const goal = (input.goal ?? "").toLowerCase();
  const age = Number(input.age) || 0;

  const young = age > 0 && age <= 15;
  const beginner = /principiante|nunca|inicial|basa/.test(exp);
  const advanced = /avanzad|elite|compet/.test(exp);
  const fatLoss = /grasa|perder|defin|descenso/.test(goal);

  // Bloque de 4 a 6 semanas según perfil.
  const weeks = young || beginner ? 4 : advanced ? 6 : 6;
  // Incremento base (kilos por mesociclo) en básicos.
  const incrementoKg = young ? 1 : beginner ? 1.25 : advanced ? 2.5 : 2.5;
  // Cada cuántas semanas se sube el peso (wave de reps).
  const repWave = young || beginner ? 3 : 2;
  const rirInicio = beginner || fatLoss ? 3 : 2;
  const rirFin = 1;

  const scheme = `Doble progresión · ${weeks} semanas`;
  const guideline =
    `Bloque de ${weeks} semanas (doble progresión). Empezá cerca de RIR ${rirInicio} y ` +
    `subí la exigencia hasta RIR ${rirFin} sobre el final del bloque. Sumá repeticiones dentro ` +
    `del rango indicado y cada ${repWave} semanas subí ${incrementoKg} kg en los básicos ` +
    `(la mitad en los accesorios). Si llegás al tope del rango con buena técnica, priorizá el ` +
    `aumento de peso.`;

  return { weeks, guideline, scheme, incrementoKg, repWave, rirInicio, rirFin };
}

export async function generateProgram(input: ProgramInput): Promise<GeneratedProgram> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error("GROQ_API_KEY faltante");

  const messages: GroqMessage[] = [
    { role: "system", content: ROLE_PROMPT },
    { role: "user", content: buildProgramUserMessage(input) },
  ];

  const MAX_ATTEMPTS = 3;
  let lastError = "No se pudo generar el plan.";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let payload: any;
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          messages,
          temperature: 0,
          max_tokens: 4096,
          response_format: { type: "json_object" },
        }),
      });
      payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message: string = payload?.error?.message || "Error del modelo";
        lastError = message;
        const code: string = payload?.error?.code || "";
        const retryable =
          res.status === 429 ||
          res.status >= 500 ||
          code === "rate_limit_exceeded" ||
          code === "json_validate_failed" ||
          /rate limit|tokens per minute|json/i.test(message);
        if (retryable && attempt < MAX_ATTEMPTS) {
          await sleep(retryDelayMs(message, attempt));
          continue;
        }
        break;
      }
    } catch (err: any) {
      lastError = err?.message || "Error de red";
      if (attempt < MAX_ATTEMPTS) {
        await sleep(retryDelayMs("", attempt));
        continue;
      }
      break;
    }

    const content: string = payload?.choices?.[0]?.message?.content || "";
    const parsed = extractJson(content);
    if (parsed) {
      const days = normalizeDays(parsed?.dias ?? parsed?.days);
      if (days.length) {
        return {
          perfil: str(parsed?.perfil),
          justificacion: str(parsed?.justificacion),
          esquema: str(parsed?.esquema),
          days,
          nutrition: normalizeNutrition(parsed?.nutricion ?? parsed?.nutrition),
          block: buildBlockParams(input),
        };
      }
    }
    lastError = "La respuesta del modelo no fue válida.";
    if (attempt < MAX_ATTEMPTS) {
      await sleep(600 * attempt);
      continue;
    }
  }

  throw new Error(friendlyProgramError(lastError));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(message: string, attempt: number): number {
  const match = message.match(/try again in ([\d.]+)\s*s/i);
  if (match) return Math.min(Math.ceil(Number(match[1]) * 1000) + 600, 20000);
  return Math.min(800 * attempt, 8000);
}

function extractJson(content: string): any | null {
  if (!content) return null;
  let text = content.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  try {
    return JSON.parse(text);
  } catch {
    /* sigue con la extracción por llaves */
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

function friendlyProgramError(message: string): string {
  if (/rate limit|tokens per minute|TPM|429/i.test(message)) {
    return "El servicio de IA está saturado (límite por minuto de Groq). Esperá unos segundos y volvé a intentar.";
  }
  if (/json/i.test(message)) {
    return "La IA devolvió una respuesta inválida. Volvé a intentar (normalmente se resuelve al reintentar).";
  }
  return message;
}

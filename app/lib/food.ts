import type { FoodItem, MealSlot, ParsedFoodItem } from "@/lib/app-types";

export const MEAL_SLOTS: MealSlot[] = ["desayuno", "almuerzo", "merienda", "cena", "extra"];

export const SLOT_LABELS: Record<MealSlot, string> = {
  desayuno: "Desayuno",
  almuerzo: "Almuerzo",
  merienda: "Merienda",
  cena: "Cena",
  extra: "Extras / antojos",
};

const SYSTEM_PROMPT = `Sos un nutricionista que estima los macronutrientes de lo que una persona comió, en Argentina.
Recibís un texto en español describiendo alimentos (puede venir de un dictado por voz, con errores leves).
Devolvés SOLO JSON válido con este esquema exacto:
{
  "items": [
    { "name": string, "quantity": string|null, "cal": number, "prot": number, "carbs": number, "fat": number, "slot": "desayuno"|"almuerzo"|"merienda"|"cena"|"extra" }
  ]
}
Reglas:
- Separá cada alimento o preparación como un ítem distinto (ej: "milanesa con ensalada" -> "Milanesa de carne" y "Ensalada mixta").
- Estimá porciones típicas argentinas si no se aclara cantidad (1 milanesa, 1 alfajor, 1 porción, 1 vaso, etc.).
- "quantity" es la cantidad estimada en texto (ej: "1 unidad", "1 porción", "200 g", "1 vaso"). Si no aplica, null.
- cal = kilocalorías (entero). prot, carbs y fat = gramos (enteros). No negativos.
- Elegí el "slot" de CADA ítem por separado según su tipo y cualquier horario mencionado. Nunca apliques un horario mencionado a un alimento que claramente es de otra comida.
- Por tipo de alimento: platos principales (carnes, milanesa, pollo, pescado, pasta, arroz, guiso, tarta, empanadas, hamburguesa, ensalada como plato) => "almuerzo" o "cena" (usá "almuerzo" si es de día, "cena" si es de noche; sin pista, "almuerzo"). Dulces, postres, facturas, galletitas, alfajor, tortas y snacks => "merienda". Café, té, mate, tostadas, cereales o yogur por la mañana => "desayuno".
- Si el texto menciona un horario ("a la tarde", "al mediodía", "a la noche", "por la mañana"), aplicalo solo a los ítems compatibles (ej: "milanesa con ensalada y un alfajor a la tarde" => milanesa y ensalada "almuerzo", alfajor "merienda").
- Si recibís "horaActual" (0-23, hora de Argentina) y no hay otra pista de horario, usá: 5-10 desayuno, 12-15 almuerzo, 16-19 merienda, 20-23 cena, en otro caso "extra".
- No inventes alimentos que no se mencionan. No agregues comentarios ni texto fuera del JSON.`;

function clampNum(value: unknown, max: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(max, n);
}

export function normalizeFoodItems(raw: unknown): ParsedFoodItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ParsedFoodItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const name = String((r as any).name ?? "").trim().slice(0, 120);
    if (!name) continue;
    const slotRaw = String((r as any).slot ?? "").trim().toLowerCase();
    const slot = (MEAL_SLOTS as string[]).includes(slotRaw)
      ? (slotRaw as MealSlot)
      : "extra";
    const qRaw = (r as any).quantity;
    const quantity =
      typeof qRaw === "string" && qRaw.trim() ? qRaw.trim().slice(0, 80) : null;
    out.push({
      name,
      quantity,
      cal: clampNum((r as any).cal, 5000),
      prot: clampNum((r as any).prot, 600),
      carbs: clampNum((r as any).carbs, 1000),
      fat: clampNum((r as any).fat, 600),
      slot,
    });
    if (out.length >= 25) break;
  }
  return out;
}

export function foodTotals(items: FoodItem[]): {
  cal: number;
  prot: number;
  carbs: number;
  fat: number;
} {
  return items.reduce(
    (acc, it) => ({
      cal: acc.cal + (it.cal || 0),
      prot: acc.prot + (it.prot || 0),
      carbs: acc.carbs + (it.carbs || 0),
      fat: acc.fat + (it.fat || 0),
    }),
    { cal: 0, prot: 0, carbs: 0, fat: 0 }
  );
}

export async function estimateFoodItems(
  text: string,
  hora?: number
): Promise<ParsedFoodItem[]> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY faltante");

  const userPayload: Record<string, unknown> = { texto: text };
  if (typeof hora === "number" && Number.isFinite(hora)) userPayload.horaActual = hora;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "openai/gpt-oss-20b",
      temperature: 0,
      max_tokens: 1500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message || "Error estimando los alimentos");
  }
  let parsed: any = {};
  try {
    parsed = JSON.parse(json?.choices?.[0]?.message?.content || "{}");
  } catch {
    parsed = {};
  }
  return normalizeFoodItems(parsed?.items);
}

export function argentinaHour(date = new Date()): number {
  const h = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(date);
  const n = Number(h);
  return Number.isFinite(n) ? n : 0;
}

export async function transcribeAudio(file: File): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY faltante");

  const fd = new FormData();
  fd.append("file", file);
  fd.append("model", "whisper-large-v3-turbo");
  fd.append("language", "es");
  fd.append("response_format", "json");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: fd,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message || "Error transcribiendo el audio");
  }
  return String(json?.text ?? "").trim();
}

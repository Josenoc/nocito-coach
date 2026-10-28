import { getSupabaseAdmin } from "@/lib/supabase-server";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

export type PushContext = {
  clientId: string;
  name: string;
  kind: "morning" | "evening_completed" | "evening_audit" | "weekly";
  muscleGroup?: string;
  dayName?: string;
};

export async function generatePersonalizedPush(ctx: PushContext): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;

  const supabase = getSupabaseAdmin() as any;
  const { data: history } = await supabase
    .from("push_interactions")
    .select("kind, response_type, content, choice, created_at")
    .eq("client_id", ctx.clientId)
    .order("created_at", { ascending: false })
    .limit(10);

  const hist = (history ?? [])
    .map((h: any) => {
      if (h.choice) return `[${h.kind}] opción: ${h.choice}`;
      if (h.content) return `[${h.kind}] ${h.content.slice(0, 200)}`;
      return `[${h.kind}] ${h.response_type}`;
    })
    .join("\n");

  const basePrompt = `Sos un entrenador estricto pero empático para Nocito Coach (Argentina). 
Generá UN ÚNICO mensaje corto para una notificación push nativa (máximo 110 caracteres si es posible, máximo 140).
Usá tono argentino, voseo/cordial, directo. No uses emojis. 
No inventes datos. Sé concreto.

Alumno: ${ctx.name || "atleta"}
Contexto: ${ctx.kind}
${ctx.muscleGroup ? `Grupo muscular: ${ctx.muscleGroup}` : ""}
${ctx.dayName ? `Día: ${ctx.dayName}` : ""}

Historial de interacciones (más reciente primero):
${hist || "Sin historial previo."}`;

  let userPrompt = "";
  if (ctx.kind === "morning") {
    userPrompt = `${basePrompt}
Tarea: Recordatorio pre-entrenamiento. Motivador y personalizado según historial. 
Ejemplo estilo: "Vamos que hoy toca ${ctx.muscleGroup || "entrenar"}. No aflojes." pero adaptalo al historial.`;
  } else if (ctx.kind === "evening_completed") {
    userPrompt = `${basePrompt}
Tarea: Refuerzo positivo por haber completado la rutina hoy. Cierre de jornada. 
Reconocer el esfuerzo. Mantener motivador sin exagerar.`;
  } else if (ctx.kind === "evening_audit") {
    userPrompt = `${basePrompt}
Tarea: Auditoría estricta. Preguntar por qué no completó los datos/rutina hoy. 
Debe generar curiosidad para que responda en la app. 
Usar tono firme pero justo.`;
  } else if (ctx.kind === "weekly") {
    userPrompt = `${basePrompt}
Tarea: Cierre semanal viernes. Pedir feedback breve. Invitar a elegir opción o responder.`;
  }

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: "Sos un generador de mensajes push para fitness. Respuesta ultra corta." },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 80,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const msg = json?.choices?.[0]?.message?.content?.trim();
    if (!msg) return null;
    // Limpiar comillas
    return msg.replace(/^["']|["']$/g, "").slice(0, 140);
  } catch {
    return null;
  }
}

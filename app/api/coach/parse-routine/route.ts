import { NextRequest, NextResponse } from "next/server";
import { getCoach } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `Sos un asistente que estructura planes de entrenamiento escritos en español latinoamericano.
Recibís texto crudo (de un cuaderno, apunte o mensaje) y lo devolvés como JSON ordenado.

Devolvé SOLO JSON válido con este esquema exacto:
{
  "days": [
    {
      "dia": "string",
      "nombre": "string",
      "ejercicios": [
        {
          "ejercicio": "string",
          "series": number | null,
          "reps": "string" | null,
          "descanso": "string" | null,
          "notas": "string" | null
        }
      ]
    }
  ]
}

Reglas:
- "dia" es el día de la semana o etiqueta ("Lunes", "Día 1", "Tren Superior A"). Si no hay, usá "Día 1", "Día 2", etc.
- "nombre" es el título/foco del día ("Tren Superior A", "Empuje", "Full Body"). Si no hay, repetí "dia".
- "series" y "reps": interpretá "4x6-8" como series=4, reps="6-8". "3x10" -> series=3, reps="10".
- "descanso" tal como aparece ("4-5 min", "60-90 seg"), o null.
- "notas" para indicaciones extra (tempo, técnica, RIR), o null.
- Normalizá nombres de ejercicios (ej: "press banca", "sentadilla", "peso muerto", "dominadas").
- No inventes ejercicios ni días. Si el texto no tiene estructura reconocible, devolvé days: [].
- Respetá el orden de aparición.`;

type GroqMessage = { role: "system" | "user"; content: string };

export async function POST(req: NextRequest) {
  const coach = await getCoach();
  if (!coach) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const text = String(body?.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ ok: false, error: "Pegá el texto de la rutina." }, { status: 400 });
  }
  if (text.length > 8000) {
    return NextResponse.json(
      { ok: false, error: "El texto es demasiado largo (máx. 8000 caracteres)." },
      { status: 400 }
    );
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return NextResponse.json({ ok: false, error: "GROQ_API_KEY no configurada" }, { status: 500 });
  }

  const messages: GroqMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: text },
  ];

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
        max_tokens: 3000,
        response_format: { type: "json_object" },
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: json.error?.message || "Error del modelo" },
        { status: 500 }
      );
    }

    const content = json.choices?.[0]?.message?.content || "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { ok: false, error: "La respuesta del modelo no es JSON válido" },
        { status: 500 }
      );
    }

    const days = normalizeDays(parsed?.days);
    return NextResponse.json({ ok: true, days });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Error interno" },
      { status: 500 }
    );
  }
}

function normalizeDays(raw: unknown): { dia: string; nombre: string; ejercicios: any[] }[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((d: any, i: number) => {
      const dia = String(d?.dia ?? "").trim() || `Día ${i + 1}`;
      const nombre = String(d?.nombre ?? "").trim() || dia;
      const ejercicios = (Array.isArray(d?.ejercicios) ? d.ejercicios : [])
        .map((e: any) => {
          const ejercicio = String(e?.ejercicio ?? "").trim();
          if (!ejercicio) return null;
          return {
            ejercicio,
            series: Number.isFinite(Number(e?.series)) ? Number(e.series) : null,
            reps: e?.reps ? String(e.reps).trim() : null,
            descanso: e?.descanso ? String(e.descanso).trim() : null,
            notas: e?.notas ? String(e.notas).trim() : null,
          };
        })
        .filter(Boolean);
      return { dia, nombre, ejercicios };
    })
    .filter((d) => d.ejercicios.length > 0);
}

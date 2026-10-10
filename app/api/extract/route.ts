import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `Eres un extractor de datos de entrenamiento para español latinoamericano.
Extrae series, repeticiones, peso, ejercicio y notas desde texto hablado o escrito.
Devuelve SOLO JSON válido con este esquema:
{
  "sets": [
    {
      "ejercicio": "string",
      "series": number | null,
      "repeticiones": number | null,
      "peso_utilizado": number | null,
      "unidad_peso": "kg" | "lbs" | null,
      "notas": "string" | null
    }
  ],
  "notas_generales": "string" | null
}
Reglas:
- Normaliza nombres de ejercicio (ej: "sentadillas", "press banca", "peso muerto", "dominadas").
- Convierte pesos a número (ej: "40 kilos" -> 40, "95 lbs" -> 95). Inferir unidad_peso si aparece kg/lbs, sino null.
- Series/reps números enteros cuando posible.
- Si dice "3x8", extrae series=3, repeticiones=8.
- Puede haber 1 o más sets. Si no hay datos estructurables, devuelve sets: [].
- No inventes datos. Responde solo JSON.`;

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ ok: false, error: 'Texto requerido' }, { status: 400 });
    }

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return NextResponse.json({ ok: false, error: 'GROQ_API_KEY faltante' }, { status: 500 });
    }

    const body = {
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text }
      ],
      temperature: 0,
      max_tokens: 600,
      response_format: { type: 'json_object' }
    };

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqKey}`
      },
      body: JSON.stringify(body)
    });

    const json = await res.json();
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: json.error?.message || 'Error LLM' }, { status: 500 });
    }

    const content = json.choices?.[0]?.message?.content || '{}';
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      return NextResponse.json({ ok: false, error: 'Respuesta LLM no es JSON válido' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, ...parsed });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Error interno' }, { status: 500 });
  }
}
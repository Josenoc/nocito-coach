import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `Eres un asistente que convierte lo que dice un alumno de gimnasio (español latinoamericano) en series registradas para UN ejercicio especifico.
Recibis: nombre del ejercicio, numero de series objetivo, unidad de peso del ejercicio, y el texto dictado por el alumno.
Devolve SOLO JSON valido con este esquema:
{
  "sets": [
    { "set_number": number, "reps": number | null, "weight": number | null }
  ],
  "notas": string | null
}
Reglas:
- Si el alumno dice "3 series de 10 con 50", devolve 3 objetos: set_number 1, 2 y 3, reps 10, weight 50.
- Si dice "4x8 con 40", igual: 4 objetos con reps 8 y weight 40.
- Si menciona un solo valor global para todas las series, repetilo en las series objetivo indicadas.
- Si menciona series distintas ("primera 12 con 30, segunda 10 con 35"), respeta cada set_number.
- No inventes reps ni peso que no dijo: usa null.
- "sin peso" o "solo el peso corporal" -> weight 0.
- Si el alumno dice una unidad distinta a la del ejercicio, converti el peso a la unidad del ejercicio (1 kg = 2.20462 lbs y viceversa).
- set_number empieza en 1. Maximo 12 sets. Responde solo JSON.`;

type SetOut = { set_number: number; reps: number | null; weight: number | null };

function clampSets(input: unknown, fallbackCount: number): SetOut[] {
  if (!Array.isArray(input)) return [];
  const out: SetOut[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const n = Number((raw as any).set_number);
    const setNumber = Number.isFinite(n)
      ? Math.min(12, Math.max(1, Math.round(n)))
      : out.length + 1;
    const repsRaw = Number((raw as any).reps);
    const weightRaw = Number((raw as any).weight);
    const reps = Number.isFinite(repsRaw) ? Math.min(999, Math.max(0, Math.round(repsRaw))) : null;
    const weight = Number.isFinite(weightRaw) ? Math.min(2000, Math.max(0, weightRaw)) : null;
    if (reps === null && weight === null) continue;
    out.push({ set_number: setNumber, reps, weight });
  }
  const seen = new Set<number>();
  return out
    .filter((s) => (seen.has(s.set_number) ? false : (seen.add(s.set_number), true)))
    .sort((a, b) => a.set_number - b.set_number)
    .slice(0, Math.max(1, Math.min(12, fallbackCount || 12)));
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return NextResponse.json({ ok: false, error: "GROQ_API_KEY faltante" }, { status: 500 });
    }

    const form = await req.formData();
    const audio = form.get("audio") as File | null;
    const exerciseId = (form.get("exercise_id") as string) || "";

    if (!audio || !exerciseId) {
      return NextResponse.json(
        { ok: false, error: "audio y exercise_id requeridos" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: ex, error: exErr } = await supabase
      .from("exercises")
      .select("id, name, target_sets, target_reps, unit, routines!inner(client_id)")
      .eq("id", exerciseId)
      .single();

    if (exErr || !ex) {
      return NextResponse.json({ ok: false, error: "Ejercicio no encontrado" }, { status: 404 });
    }
    const ownerId = (ex as any).routines?.client_id;
    if (session.role !== "coach" && ownerId !== session.id) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const whisperFd = new FormData();
    whisperFd.append("file", audio);
    whisperFd.append("model", "whisper-large-v3-turbo");
    whisperFd.append("language", "es");
    whisperFd.append("response_format", "json");

    const trRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}` },
      body: whisperFd,
    });
    const trJson = await trRes.json().catch(() => ({}));
    if (!trRes.ok) {
      return NextResponse.json(
        { ok: false, error: trJson?.error?.message || "Error transcribiendo el audio" },
        { status: 502 }
      );
    }
    const transcript: string = (trJson?.text || "").toString().trim();
    if (!transcript) {
      return NextResponse.json(
        { ok: false, error: "No se escucho nada. Intenta de nuevo." },
        { status: 200 }
      );
    }

    const targetSets = Number((ex as any).target_sets) || 3;
    const unit = ((ex as any).unit as string) || "kg";

    const chatRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        temperature: 0,
        max_tokens: 600,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              ejercicio: (ex as any).name,
              series_objetivo: targetSets,
              unidad: unit,
              texto: transcript,
            }),
          },
        ],
      }),
    });

    const chatJson = await chatRes.json().catch(() => ({}));
    if (!chatRes.ok) {
      return NextResponse.json(
        { ok: false, error: chatJson?.error?.message || "Error interpretando el audio" },
        { status: 502 }
      );
    }

    let parsed: any = {};
    try {
      parsed = JSON.parse(chatJson?.choices?.[0]?.message?.content || "{}");
    } catch {
      return NextResponse.json(
        { ok: false, error: "No se pudo interpretar lo que se dijo" },
        { status: 200 }
      );
    }

    const sets = clampSets(parsed?.sets, targetSets);
    return NextResponse.json({
      ok: true,
      transcript,
      sets,
      notas: typeof parsed?.notas === "string" ? parsed.notas : null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Error interno" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token;
    const registro = body.registro;

    if (!token || !registro) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: alumno, error: errA } = await supabase
      .from("alumnos")
      .select("id")
      .eq("token_acceso", token)
      .eq("activo", true)
      .single();
    if (errA || !alumno) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 401 });
    }

    const payload = {
      alumno_id: alumno.id,
      fecha: registro.fecha || new Date().toISOString().split("T")[0],
      ejercicio: registro.ejercicio,
      series: registro.series ?? null,
      repeticiones: registro.repeticiones ?? null,
      peso_utilizado: registro.peso_utilizado ?? null,
      unidad_peso: registro.unidad_peso || "kg",
      notas: registro.notas || null,
      fuente: registro.fuente || "manual",
      audio_url: registro.audio_url || null,
      raw_transcripcion: registro.raw_transcripcion || null,
      raw_estructurado: registro.raw_estructurado || null,
    };

    const { data, error } = await supabase
      .from("registros_progreso")
      .insert(payload)
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, registro: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const password = body.password;
    const alumno_id = body.alumno_id;
    const nombre = body.nombre;
    const ejercicios = body.ejercicios;

    if (password !== "nocito-entrenador-2026") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }
    if (!alumno_id || !nombre) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    await supabase
      .from("rutinas")
      .update({ activa: false })
      .eq("alumno_id", alumno_id)
      .eq("activa", true);

    const { data: rutina, error: errRut } = await supabase
      .from("rutinas")
      .insert({ alumno_id, nombre, activa: true })
      .select()
      .single();
    if (errRut || !rutina) {
      return NextResponse.json({ error: errRut?.message || "Error creando rutina" }, { status: 500 });
    }

    if (Array.isArray(ejercicios) && ejercicios.length > 0) {
      const rows = ejercicios.map((e: any, i: number) => ({
        rutina_id: rutina.id,
        nombre: e.nombre,
        orden: e.orden ?? i,
        series_default: e.series_default ?? null,
        reps_default: e.reps_default ?? null,
        peso_default: e.peso_default ?? null,
        unidad_peso: e.unidad_peso ?? "kg",
      }));
      const { error: errE } = await supabase.from("ejercicios_asignados").insert(rows);
      if (errE) {
        return NextResponse.json({ error: errE.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, rutina });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const password = searchParams.get("password");
    const alumno_id = searchParams.get("alumno_id");
    if (password !== "nocito-entrenador-2026") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }
    if (!alumno_id) {
      return NextResponse.json({ error: "alumno_id requerido" }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const { data: rutinas, error } = await supabase
      .from("rutinas")
      .select("*, ejercicios_asignados(*)")
      .eq("alumno_id", alumno_id)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ rutinas });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

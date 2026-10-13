import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const ejercicio = searchParams.get("ejercicio");
    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
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
    let query = supabase
      .from("registros_progreso")
      .select("id, fecha, ejercicio, series, repeticiones, peso_utilizado, unidad_peso, notas, fuente, created_at")
      .eq("alumno_id", alumno.id)
      .order("fecha", { ascending: true });
    if (ejercicio) query = query.eq("ejercicio", ejercicio);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ registros: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

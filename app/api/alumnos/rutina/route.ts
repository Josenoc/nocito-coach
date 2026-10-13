import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const { data: alumno, error: errA } = await supabase
      .from("alumnos")
      .select("id, nombre")
      .eq("token_acceso", token)
      .eq("activo", true)
      .single();
    if (errA || !alumno) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 401 });
    }
    const { data: rutina, error } = await supabase
      .from("rutinas")
      .select("*, ejercicios_asignados(*)")
      .eq("alumno_id", alumno.id)
      .eq("activa", true)
      .single();
    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ alumno, rutina: rutina || null });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

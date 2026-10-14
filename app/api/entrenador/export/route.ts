import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PASSWORD = "nocito-entrenador-2026";

function slug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("password") !== PASSWORD) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const alumnoId = searchParams.get("alumno_id");

  const supabase = getSupabaseAdmin();

  let alumnosQuery = supabase.from("alumnos").select("id, nombre, email").order("nombre", { ascending: true });
  if (alumnoId) alumnosQuery = alumnosQuery.eq("id", alumnoId);
  const { data: alumnos, error: errA } = await alumnosQuery;
  if (errA) return NextResponse.json({ ok: false, error: errA.message }, { status: 500 });

  let regQuery = supabase.from("registros_progreso").select("*").limit(20000);
  if (alumnoId) regQuery = regQuery.eq("alumno_id", alumnoId);
  const { data: registros, error: errR } = await regQuery;
  if (errR) return NextResponse.json({ ok: false, error: errR.message }, { status: 500 });

  const infoPorId = new Map<string, { nombre: string; email: string }>();
  (alumnos || []).forEach((a: any) => infoPorId.set(a.id, { nombre: a.nombre, email: a.email }));

  const rows = (registros || [])
    .map((r: any) => ({
      ...r,
      alumno: infoPorId.get(r.alumno_id)?.nombre || "(sin alumno)",
      email: infoPorId.get(r.alumno_id)?.email || "",
    }))
    .sort((a: any, b: any) => {
      const na = String(a.alumno).localeCompare(String(b.alumno), "es");
      if (na !== 0) return na;
      const fa = String(a.fecha).localeCompare(String(b.fecha));
      if (fa !== 0) return fa;
      return String(a.ejercicio).localeCompare(String(b.ejercicio), "es");
    });

  const wb = new ExcelJS.Workbook();
  wb.creator = "nocito.coach";
  wb.created = new Date();

  const ws = wb.addWorksheet("Bitácora");
  ws.columns = [
    { header: "Alumno", key: "alumno", width: 22 },
    { header: "Email", key: "email", width: 26 },
    { header: "Fecha", key: "fecha", width: 12 },
    { header: "Ejercicio", key: "ejercicio", width: 26 },
    { header: "Series", key: "series", width: 8 },
    { header: "Reps", key: "repeticiones", width: 8 },
    { header: "Peso", key: "peso", width: 10 },
    { header: "Unidad", key: "unidad", width: 8 },
    { header: "Fuente", key: "fuente", width: 10 },
    { header: "Notas / Sensaciones", key: "notas", width: 42 },
    { header: "Transcripción de audio", key: "transcripcion", width: 52 },
    { header: "Audio", key: "audio", width: 14 },
  ];
  ws.getRow(1).font = { bold: true, color: { argb: "FF0A0A0A" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC400" } };
  ws.getRow(1).alignment = { vertical: "middle" };
  ws.getRow(1).height = 20;
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: "A1", to: "L1" };

  rows.forEach((r: any) => {
    const row = ws.addRow({
      alumno: r.alumno,
      email: r.email,
      fecha: r.fecha,
      ejercicio: r.ejercicio,
      series: r.series ?? "",
      repeticiones: r.repeticiones ?? "",
      peso: r.peso_utilizado ?? "",
      unidad: r.unidad_peso ?? "",
      fuente: r.fuente === "audio" ? "Audio" : "Manual",
      notas: r.notas ?? "",
      transcripcion: r.raw_transcripcion ?? "",
    });
    const cell = row.getCell("audio");
    if (r.audio_url) {
      cell.value = { text: "Escuchar", hyperlink: r.audio_url };
      cell.font = { color: { argb: "FF0563C1" }, underline: true };
    } else {
      cell.value = "";
    }
  });

  const stats = new Map<string, { cant: number; audios: number; primero: string; ultimo: string }>();
  (registros || []).forEach((r: any) => {
    const s = stats.get(r.alumno_id) || { cant: 0, audios: 0, primero: r.fecha, ultimo: r.fecha };
    s.cant += 1;
    if (r.audio_url) s.audios += 1;
    if (String(r.fecha) < String(s.primero)) s.primero = r.fecha;
    if (String(r.fecha) > String(s.ultimo)) s.ultimo = r.fecha;
    stats.set(r.alumno_id, s);
  });

  const ws2 = wb.addWorksheet("Resumen");
  ws2.columns = [
    { header: "Alumno", key: "alumno", width: 24 },
    { header: "Email", key: "email", width: 28 },
    { header: "Registros", key: "cant", width: 12 },
    { header: "Con audio", key: "audios", width: 12 },
    { header: "Primer registro", key: "primero", width: 16 },
    { header: "Último registro", key: "ultimo", width: 16 },
  ];
  ws2.getRow(1).font = { bold: true, color: { argb: "FF0A0A0A" } };
  ws2.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC400" } };
  ws2.getRow(1).height = 20;
  (alumnos || []).forEach((a: any) => {
    const s = stats.get(a.id);
    ws2.addRow({
      alumno: a.nombre,
      email: a.email,
      cant: s?.cant ?? 0,
      audios: s?.audios ?? 0,
      primero: s?.primero ?? "",
      ultimo: s?.ultimo ?? "",
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  const etiqueta = alumnoId ? slug(infoPorId.get(alumnoId)?.nombre || "alumno") : "todos";
  const fileName = `bitacora-${etiqueta}-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(Buffer.from(buffer as ArrayBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

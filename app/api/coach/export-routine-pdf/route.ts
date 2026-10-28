import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCoach } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACCENT = "#FFC400";
const DARK = "#0A0A0A";
const WHITE = "#FFFFFF";
const GRAY = "#9a9a9a";
const LIGHT = "#f4f4f4";

export async function GET(req: NextRequest) {
  const coach = await getCoach();
  if (!coach) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const [profileRes, routinesRes, logsRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").eq("id", id).single(),
    supabase
      .from("routines")
      .select("*, exercises(*)")
      .eq("client_id", id)
      .eq("active", true)
      .order("week_number", { ascending: true })
      .order("position", { ascending: true }),
    supabase
      .from("sets_logs")
      .select("*, exercises(name)")
      .eq("client_id", id)
      .order("log_date", { ascending: false })
      .order("set_number", { ascending: true }),
  ]);

  if (profileRes.error || !profileRes.data) {
    return NextResponse.json({ ok: false, error: "Cliente no encontrado" }, { status: 404 });
  }

  const profile = profileRes.data as { id: string; full_name: string | null; email: string | null };
  const routines = (routinesRes.data ?? []) as any[];
  const logs = (logsRes.data ?? []) as any[];

  const name = (profile.full_name || profile.email || "Alumno").trim();
  const safeName = name.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-") || "Alumno";

  // Group logs by exercise_id
  const logsByEx: Record<string, any[]> = {};
  for (const l of logs) {
    if (!l.exercise_id) continue;
    (logsByEx[l.exercise_id] = logsByEx[l.exercise_id] || []).push(l);
  }

  const doc = new PDFDocument({ size: "A4", margin: 44, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // Header band
  doc.rect(0, 0, doc.page.width, 70).fill(DARK);
  doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(16).text("NOCITO COACH", 44, 22, { width: pageWidth });
  doc.fillColor(WHITE).font("Helvetica").fontSize(10).text("Rutina de entrenamiento", 44, 44, { width: pageWidth });
  doc.moveDown(2);

  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(14).text(name, { width: pageWidth });
  doc.font("Helvetica").fontSize(9).fillColor(GRAY).text(`Generado: ${new Date().toLocaleDateString("es-AR")}`, { width: pageWidth });
  doc.moveDown(1);

  if (!routines.length) {
    doc.fillColor(DARK).fontSize(11).text("Este alumno todavia no tiene rutinas publicadas.", { width: pageWidth });
  }

  // Group routines by week
  const byWeek: Record<number, any[]> = {};
  for (const r of routines) {
    const w = Number(r.week_number) || 1;
    (byWeek[w] = byWeek[w] || []).push(r);
  }

  for (const week of Object.keys(byWeek).map(Number).sort((a, b) => a - b)) {
    doc.moveDown(0.6);
    doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(12).text(`Semana ${week}`, { width: pageWidth });
    doc.moveDown(0.3);

    for (const r of byWeek[week]) {
      doc.fillColor(DARK).font("Helvetica-Bold").fontSize(11).text(r.day_name || r.name || "Dia", { width: pageWidth });
      doc.moveDown(0.2);

      const exs = (r.exercises ?? []).sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0));
      for (const ex of exs) {
        doc.font("Helvetica-Bold").fontSize(10).fillColor(DARK).text(ex.name || "Ejercicio", { width: pageWidth });
        const target = `${ex.target_sets ?? "-"} series x ${ex.target_reps ?? "-"} reps${ex.target_weight ? ` @ ${ex.target_weight} ${ex.unit ?? "kg"}` : ""}`;
        doc.font("Helvetica").fontSize(9).fillColor(GRAY).text(`Objetivo: ${target}`, { width: pageWidth });
        if (ex.technique_notes) {
          doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(GRAY).text(ex.technique_notes, { width: pageWidth });
        }

        const sets = (logsByEx[ex.id] ?? []).filter((l) => l.log_date);
        // show latest session sets
        if (sets.length) {
          const lastDate = sets.map((s) => String(s.log_date)).sort().reverse()[0];
          const daySets = sets.filter((s) => s.log_date === lastDate).sort((a, b) => a.set_number - b.set_number);
          doc.font("Helvetica-Bold").fontSize(9).fillColor(DARK).text(`Series cargadas (${lastDate.split("-").reverse().join("/")}):`, { width: pageWidth });
          for (const st of daySets) {
            const tipo = Number(st.set_number) === 0 ? "Calentamiento" : "Efectiva";
            const rir = st.rir != null && st.rir !== "" ? `  RIR ${st.rir}` : "";
            doc.font("Helvetica").fontSize(9).fillColor(GRAY).text(`  - ${tipo}: ${st.actual_reps ?? "-"} reps @ ${st.actual_weight ?? "-"} kg${rir}`, { width: pageWidth });
          }
        }
        doc.moveDown(0.4);
      }
      doc.moveDown(0.6);
    }
  }

  doc.end();
  const buffer = await new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Rutina-${safeName}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

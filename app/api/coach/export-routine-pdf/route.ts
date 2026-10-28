import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCoach } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACCENT = "#FFC400";
const DARK = "#0A0A0A";
const WHITE = "#FFFFFF";
const GRAY = "#6b7280";
const CARD_BG = "#f5f5f5";
const BORDER = "#e5e5e5";
const MARGIN = 44;

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

  const logsByEx: Record<string, any[]> = {};
  for (const l of logs) {
    if (!l.exercise_id) continue;
    (logsByEx[l.exercise_id] = logsByEx[l.exercise_id] || []).push(l);
  }

  const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));

  const pageWidth = doc.page.width - MARGIN * 2;

  // ---- Header band ----
  doc.rect(0, 0, doc.page.width, 78).fill(DARK);
  doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(22).text("NOCITO COACH", MARGIN, 24, { width: pageWidth, align: "center" });
  doc.fillColor(WHITE).font("Helvetica").fontSize(10).text("Rutina de entrenamiento", MARGIN, 52, { width: pageWidth, align: "center" });

  doc.y = 96;

  // ---- Student info ----
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(16).text(name, MARGIN, doc.y, { width: pageWidth, align: "center" });
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(9).fillColor(GRAY).text(`Generado: ${new Date().toLocaleDateString("es-AR")}`, MARGIN, doc.y, { width: pageWidth, align: "center" });
  doc.moveDown(1);

  // Divider
  doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + pageWidth, doc.y).strokeColor(BORDER).lineWidth(1).stroke();
  doc.moveDown(1);

  if (!routines.length) {
    doc.fillColor(DARK).font("Helvetica").fontSize(11).text("Este alumno todavia no tiene rutinas publicadas.", MARGIN, doc.y, { width: pageWidth, align: "center" });
  }

  const byWeek: Record<number, any[]> = {};
  for (const r of routines) {
    const w = Number(r.week_number) || 1;
    (byWeek[w] = byWeek[w] || []).push(r);
  }

  for (const week of Object.keys(byWeek).map(Number).sort((a, b) => a - b)) {
    // Week title
    doc.moveDown(0.3);
    doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(12).text(`SEMANA ${week}`, MARGIN, doc.y, { width: pageWidth });
    doc.moveDown(0.4);

    for (const r of byWeek[week]) {
      // Day card header
      const cardY = doc.y;
      doc.rect(MARGIN, cardY, pageWidth, 20).fill(CARD_BG);
      doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10.5).text(r.day_name || r.name || "Dia", MARGIN + 10, cardY + 5, { width: pageWidth - 20 });
      doc.y = cardY + 24;

      const exs = (r.exercises ?? []).sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0));
      for (const ex of exs) {
        doc.font("Helvetica-Bold").fontSize(10).fillColor(DARK).text(ex.name || "Ejercicio", MARGIN + 6, doc.y, { width: pageWidth - 12 });
        doc.moveDown(0.1);
        const target = `${ex.target_sets ?? "-"} series x ${ex.target_reps ?? "-"} reps${ex.target_weight ? `  @  ${ex.target_weight} ${ex.unit ?? "kg"}` : ""}`;
        doc.font("Helvetica").fontSize(8.5).fillColor(GRAY).text(`Objetivo: ${target}`, MARGIN + 6, doc.y, { width: pageWidth - 12 });
        if (ex.technique_notes) {
          doc.font("Helvetica-Oblique").fontSize(8).fillColor(GRAY).text(ex.technique_notes, MARGIN + 6, doc.y, { width: pageWidth - 12 });
        }

        const sets = (logsByEx[ex.id] ?? []);
        if (sets.length) {
          const lastDate = sets.map((s: any) => String(s.log_date)).sort().reverse()[0];
          const daySets = sets.filter((s: any) => s.log_date === lastDate).sort((a: any, b: any) => a.set_number - b.set_number);
          doc.moveDown(0.15);
          doc.font("Helvetica-Bold").fontSize(8.5).fillColor(DARK).text(`Series cargadas (${lastDate.split("-").reverse().join("/")}):`, MARGIN + 6, doc.y, { width: pageWidth - 12 });
          for (const st of daySets) {
            const tipo = Number(st.set_number) === 0 ? "Calentamiento" : "Efectiva";
            const rir = st.rir != null && st.rir !== "" ? `   RIR ${st.rir}` : "";
            doc.font("Helvetica").fontSize(8.5).fillColor(GRAY).text(`   ${tipo}: ${st.actual_reps ?? "-"} reps  @  ${st.actual_weight ?? "-"} kg${rir}`, MARGIN + 6, doc.y, { width: pageWidth - 12 });
          }
        }
        doc.moveDown(0.45);
      }
      doc.moveDown(0.5);
    }
  }

  // Footer
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.font("Helvetica").fontSize(8).fillColor(GRAY).text(
      `Nocito Coach  ·  ${name}  ·  Página ${i + 1} de ${pages.count}`,
      MARGIN,
      doc.page.height - 30,
      { width: pageWidth, align: "center" }
    );
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

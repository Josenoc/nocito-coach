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
const BORDER = "#d4d4d4";
const MARGIN = 36;

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

  const name = (profile.full_name || profile.email || "Alumno").trim().toUpperCase();
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
  const colW = (pageWidth - 12) / 2;

  // ---- Header ----
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(15).text("NOCITO COACH", MARGIN, 28, { width: pageWidth, align: "center" });
  doc.moveDown(0.1);
  doc.fillColor(GRAY).font("Helvetica").fontSize(8.5).text("RUTINA DE ENTRENAMIENTO", MARGIN, doc.y, { width: pageWidth, align: "center", characterSpacing: 2 });
  doc.moveDown(0.6);

  // Student name + week + date
  const weekNum = routines.length ? (routines[0]?.week_number ?? 1) : 1;
  const dayCount = new Set(routines.map((r) => r.day_name || r.name)).size || routines.length;
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(13).text(name, MARGIN, doc.y, { width: pageWidth, align: "center" });
  doc.moveDown(0.2);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(ACCENT).text(`SEMANA ${weekNum}  ·  ${dayCount} DÍAS`, MARGIN, doc.y, { width: pageWidth, align: "center" });
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(8).fillColor(GRAY).text(`Generado: ${new Date().toLocaleDateString("es-AR")}`, MARGIN, doc.y, { width: pageWidth, align: "center" });
  doc.moveDown(0.8);

  // Divider
  doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + pageWidth, doc.y).strokeColor(BORDER).lineWidth(0.8).stroke();
  doc.moveDown(0.8);

  if (!routines.length) {
    doc.fillColor(DARK).font("Helvetica").fontSize(11).text("Este alumno todavia no tiene rutinas publicadas.", MARGIN, doc.y, { width: pageWidth, align: "center" });
  }

  // Group routines by week then by day
  const byWeek: Record<number, any[]> = {};
  for (const r of routines) {
    const w = Number(r.week_number) || 1;
    (byWeek[w] = byWeek[w] || []).push(r);
  }

  for (const week of Object.keys(byWeek).map(Number).sort((a, b) => a - b)) {
    const days = byWeek[week];

    // Render days in 2 columns
    let col = 0;
    let rowTop = doc.y;

    for (let di = 0; di < days.length; di++) {
      const r = days[di];
      const x = MARGIN + (col === 0 ? 0 : colW + 12);
      if (col === 0) rowTop = doc.y;

      // Day card
      const exs = (r.exercises ?? []).sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0));
      const cardHeight = 14 + exs.length * 30 + 6;
      // Check page overflow
      if (rowTop + cardHeight > doc.page.height - 60) {
        doc.addPage();
        rowTop = MARGIN;
        col = 0;
      }
      const cardY = col === 0 ? rowTop : rowTop;

      // Card background
      doc.rect(x, cardY, colW, cardHeight).fill(CARD_BG).strokeColor(BORDER).lineWidth(0.6).stroke();
      // Day title
      doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10).text(r.day_name || r.name || `Dia ${di + 1}`, x + 8, cardY + 4, { width: colW - 16 });

      let y = cardY + 18;
      for (const ex of exs) {
        doc.fillColor(DARK).font("Helvetica-Bold").fontSize(8.5).text(ex.name || "Ejercicio", x + 8, y, { width: colW - 16 });
        y += 11;
        const target = `${ex.target_sets ?? "-"} x ${ex.target_reps ?? "-"}${ex.target_weight ? `  @  ${ex.target_weight} ${ex.unit ?? "kg"}` : ""}${ex.technique_notes ? `   RIR ${ex.target_rir ?? ""}` : ""}`;
        doc.font("Helvetica").fontSize(7.5).fillColor(GRAY).text(target, x + 8, y, { width: colW - 16 });
        y += 10;
        if (ex.technique_notes) {
          doc.font("Helvetica-Oblique").fontSize(7).fillColor(GRAY).text(ex.technique_notes, x + 8, y, { width: colW - 16 });
          y += 9;
        }

        const sets = (logsByEx[ex.id] ?? []);
        if (sets.length) {
          const lastDate = sets.map((s: any) => String(s.log_date)).sort().reverse()[0];
          const daySets = sets.filter((s: any) => s.log_date === lastDate).sort((a: any, b: any) => a.set_number - b.set_number);
          doc.font("Helvetica-Bold").fontSize(7.5).fillColor(DARK).text(`Cargadas:`, x + 8, y, { width: colW - 16 });
          y += 9;
          for (const st of daySets) {
            const tipo = Number(st.set_number) === 0 ? "Cal" : "Ef";
            const rir = st.rir != null && st.rir !== "" ? ` RIR ${st.rir}` : "";
            doc.font("Helvetica").fontSize(7.5).fillColor(GRAY).text(`  ${tipo}: ${st.actual_reps ?? "-"} x ${st.actual_weight ?? "-"} kg${rir}`, x + 8, y, { width: colW - 16 });
            y += 9;
          }
        }
        y += 2;
      }

      col++;
      if (col >= 2) {
        col = 0;
        doc.y = rowTop + cardHeight + 8;
      }
    }
    if (col !== 0) {
      doc.y = rowTop + 14 + (days.length % 2 === 0 ? 0 : 0) + 8;
      // advance y past the last row's cards
    }
    doc.moveDown(0.5);
  }

  // Footer
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(DARK).text("@NOCITO.COACH", MARGIN, doc.page.height - 28, { width: pageWidth / 2, align: "left" });
    doc.font("Helvetica").fontSize(8).fillColor(GRAY).text("NOCITO-COACH.VERCEL.APP", MARGIN + pageWidth / 2, doc.page.height - 28, { width: pageWidth / 2, align: "right" });
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

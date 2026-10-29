import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCoach } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACCENT = "#FFC400";
const DARK = "#141414";
const WHITE = "#FFFFFF";
const GRAY = "#6B6B6B";
const GOLD_DARK = "#B37A00";
const UPPER_BG = "#ECECEC";
const LOWER_BG = "#D9DCE0";
const NEUTRAL_BG = "#F6F6F6";
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 28;
const MARGIN = M;
const PAGE_WIDTH = PAGE_W - M * 2;
const CENTER = PAGE_W / 2;
const ZONE_TOP = 120;
const ZONE_BOTTOM = 23;
const ZONE_H = PAGE_H - ZONE_TOP - ZONE_BOTTOM;

function normalize(s: string): string {
  return String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function rirFromNotes(notes: string): string {
  const m = String(notes ?? "").match(/RIR\s*([0-9]+(?:[.,][0-9]+)?(?:\s*-\s*[0-9]+(?:[.,][0-9]+)?)?)/i);
  return m ? m[1].replace(",", ".") : "";
}
function weightTypeFromNotes(notes: string): string {
  const low = normalize(notes ?? "");
  if (/sin peso/.test(low)) return "sin peso";
  if (/corporal/.test(low)) return "corporal";
  if (/pesado/.test(low)) return "pesado";
  if (/moderado/.test(low)) return "moderado";
  if (/liviano/.test(low)) return "liviano";
  const m = String(notes ?? "").match(/peso\s+(\w+)/i);
  if (m) {
    const t = m[1].toLowerCase();
    if (["liviano", "moderado", "pesado", "corporal"].includes(t)) return t;
  }
  return "";
}
function dayType(name: string): "UPPER" | "LOWER" | "NEUTRAL" {
  const n = normalize(name);
  if (n.includes("upper") || n.includes("superior")) return "UPPER";
  if (n.includes("lower") || n.includes("inferior")) return "LOWER";
  return "NEUTRAL";
}
function dayBg(type: "UPPER" | "LOWER" | "NEUTRAL"): string {
  if (type === "UPPER") return UPPER_BG;
  if (type === "LOWER") return LOWER_BG;
  return NEUTRAL_BG;
}
function subtitleFor(name: string, type: "UPPER" | "LOWER" | "NEUTRAL"): string | null {
  if (type === "UPPER") return "TREN SUPERIOR";
  if (type === "LOWER") return "TREN INFERIOR";
  const n = normalize(name);
  if (n.includes("aer") || n.includes("cardio") || n.includes("core")) return "CARDIO · CORE";
  return null;
}
function stripDayPrefix(name: string): string {
  const m = String(name ?? "").match(/^d[ií]a\s*\d+\s*[-–]\s*(.+)$/i);
  if (m) return m[1].trim();
  const m2 = String(name ?? "").match(/^d[ií]a\s*\d+\s+(.+)$/i);
  if (m2) return m2[1].trim();
  return String(name ?? "").trim();
}
function dayNumber(name: string, idx: number): string {
  const m = String(name ?? "").match(/d[ií]a\s*(\d+)/i);
  if (m) return String(Number(m[1])).padStart(2, "0");
  return String(idx + 1).padStart(2, "0");
}
function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function formatSeriesReps(ex: any): string {
  const sets = ex.target_sets;
  const reps = ex.target_reps;
  const notes = String(ex.technique_notes ?? "");
  if (reps == null || reps === 0 || reps === "") {
    const minMatch = notes.match(/(\d+)\s*min/i);
    if (minMatch) return `${minMatch[1]} min`;
    const segMatch = notes.match(/(\d+)\s*seg/i);
    if (segMatch && sets) return `${sets} × ${segMatch[1]} seg`;
    if (segMatch) return `${segMatch[1]} seg`;
    return sets ? `${sets}` : "";
  }
  return `${sets ?? 1} × ${reps}`;
}
function formatDetail(ex: any): string {
  const rir = ex.target_rir != null ? String(ex.target_rir) : rirFromNotes(ex.technique_notes ?? "");
  const w = weightTypeFromNotes(ex.technique_notes ?? "");
  if (rir && w) return `RIR ${rir} · ${w}`;
  if (rir) return `RIR ${rir}`;
  if (w) return w;
  return "";
}

export async function GET(req: NextRequest) {
  try {
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
      const nameUpper = name.toUpperCase();
      const safeName = name.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-") || "Alumno";
    
      const logsByEx: Record<string, any[]> = {};
      for (const l of logs) {
        if (!l.exercise_id) continue;
        (logsByEx[l.exercise_id] = logsByEx[l.exercise_id] || []).push(l);
      }
    
      const byWeek: Record<number, any[]> = {};
      for (const r of routines) {
        const w = Number(r.week_number) || 1;
        (byWeek[w] = byWeek[w] || []).push(r);
      }
      const weeks = Object.keys(byWeek).map(Number).sort((a, b) => a - b);
      const weekNum = weeks.length ? weeks[0] : 1;
      const days = (byWeek[weekNum] || []).sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
      const n = days.length || 1;
    
      const dateStr = new Date().toLocaleDateString("es-AR").split("/").map((p) => p.padStart(2, "0")).join("/");
    
      const maxEx = Math.max(...days.map((d: any) => (d.exercises ?? []).length), 1);
    
      function makeDoc(k: number): { doc: PDFKit.PDFDocument; chunks: Buffer[] } {
        const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true });
        const chunks: Buffer[] = [];
        doc.on("data", (c: Buffer) => chunks.push(c));
    
        const pageWidth = PAGE_W - MARGIN * 2;
    
        // Header
        doc.rect(0, 0, doc.page.width, 78).fill(DARK);
        doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(22).text("NOCITO COACH", 3, 24, { width: PAGE_W, align: "center", characterSpacing: 3.2 });
        doc.fillColor(WHITE).font("Helvetica").fontSize(10).text("RUTINA DE ENTRENAMIENTO", 3, 52, { width: PAGE_W, align: "center", characterSpacing: 2.2 });
    
        doc.y = 96;
    
        const words = nameUpper.split(/\s+/).filter(Boolean);
        let fontSize = 38;
        const maxWidth = PAGE_W - 80;
        function totalWidth(size: number): number {
          doc.fontSize(size);
          let w = 0;
          for (let i = 0; i < words.length; i++) {
            w += doc.widthOfString(words[i]);
            if (i < words.length - 1) w += doc.widthOfString(" ");
          }
          return w;
        }
        while (fontSize > 12 && totalWidth(fontSize) > maxWidth) fontSize -= 1;
        const tw = totalWidth(fontSize);
        let x = (PAGE_W - tw) / 2;
        const nameY = 90 - fontSize * 0.75;
        for (let i = 0; i < words.length; i++) {
          doc.fontSize(fontSize);
          const w = doc.widthOfString(words[i]);
          const color = i === 0 ? DARK : GOLD_DARK;
          doc.fillColor(color).font("Helvetica-Bold").fontSize(fontSize).text(words[i], x, nameY, { lineBreak: false });
          x += w;
          if (i < words.length - 1) { doc.fontSize(fontSize); x += doc.widthOfString(" "); }
        }
    
        doc.font("Helvetica").fontSize(9).fillColor(GRAY).text(`Generado: ${new Date().toLocaleDateString("es-AR")}`, 3, 110 - 9 * 0.75, { width: PAGE_W, align: "center" });
        doc.y = 118;
    
        doc.moveTo(M, doc.y).lineTo(M + pageWidth, doc.y).strokeColor("#e5e5e5").lineWidth(0.8).stroke();
        doc.y += 12;
    
        if (!routines.length) {
          doc.fillColor(DARK).font("Helvetica").fontSize(11).text("Este alumno todavia no tiene rutinas publicadas.", M, doc.y, { width: pageWidth, align: "center" });
        }
    
        const rh = Math.min(190, (ZONE_H - (n - 1) * 8) / n);
    
        const gx = M + 100 + 16;
        const gw = PAGE_W - M - 14 - gx;
        const cw = gw / 2;
    
        let y = ZONE_TOP;
        for (let di = 0; di < days.length; di++) {
          const d = days[di];
          const dayName = d.day_name || d.name || `Día ${di + 1}`;
          const type = dayType(dayName);
          const bg = dayBg(type);
          const subTitle = subtitleFor(dayName, type);
          const exs = (d.exercises ?? []).sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0));
          const numEx = exs.length;
          const filas = Math.ceil(numEx / 2) || 1;
          const ch = (rh - 16) / filas;
          const my = y + rh / 2;
    
          doc.roundedRect(M, y, pageWidth, rh, 6).fill(bg);
    
          const leftX = M + 16;
          doc.fillColor(GRAY).font("Helvetica").fontSize(7).text("DÍA", leftX, y + 26 * k - 7 * 0.75, { characterSpacing: 2.6, lineBreak: false });
          const numStr = dayNumber(dayName, di);
          doc.fillColor(DARK).font("Helvetica-Bold").fontSize(32 * k).text(numStr, M + 15, y + rh / 2 - 6 * k - 32 * k * 0.75, { lineBreak: false });
          const typeName = stripDayPrefix(dayName).toUpperCase();
          doc.fillColor(DARK).font("Helvetica-Bold").fontSize(11).text(typeName, leftX, y + rh / 2 - 22 * k - 11 * 0.75, { characterSpacing: 1.6, lineBreak: false });
          if (subTitle) {
            doc.fillColor(GRAY).font("Helvetica").fontSize(5.8).text(subTitle, leftX, y + rh / 2 - 33 * k - 5.8 * 0.75, { characterSpacing: 1.4, lineBreak: false });
          }
    
          for (let j = 0; j < numEx; j++) {
            const ex = exs[j];
            const r = Math.floor(j / 2);
            const col = j % 2;
            const exX = gx + col * cw;
            const ey = y + (r + 1) * ch - ch / 2 + 8;
    
            const exName = capitalize(String(ex.name ?? ""));
            let nameSize = 11.5 * k;
            while (nameSize > 7.5 && (doc.fontSize(nameSize), doc.widthOfString(exName)) > cw - 14) {
              nameSize -= 0.3;
            }
            doc.fillColor(DARK).font("Helvetica-Bold").fontSize(nameSize).text(exName, exX, ey + 6 * k - nameSize * 0.75, { width: cw - 14, lineBreak: false });
    
            const seriesText = formatSeriesReps(ex);
            const seriesSize = 12 * k;
            const seriesY = ey - 9 * k - seriesSize * 0.75;
            doc.fillColor(DARK).font("Helvetica").fontSize(seriesSize).text(seriesText, exX, seriesY, { width: cw - 14, lineBreak: false });
    
            const detail = formatDetail(ex);
            if (detail) {
              const seriesW = (doc.fontSize(seriesSize), doc.widthOfString(seriesText));
              const detailSize = 7.4 * Math.min(k, 1.1);
              doc.fillColor(GRAY).font("Helvetica").fontSize(detailSize).text(detail, exX + seriesW + 8, ey - 8.5 * k - detailSize * 0.75, { width: cw - 14 - seriesW - 8, lineBreak: false });
            }
          }
    
          y += rh + 8;
        }
    
        // Footer
        const footerY1 = PAGE_H - 58;
        const footerY2 = PAGE_H - 40;
        const footerY3 = PAGE_H - 28;
        doc.fillColor(GRAY).font("Helvetica").fontSize(6.8).text("RIR = repeticiones en reserva: cuántas te quedan antes de no poder más.", MARGIN, footerY1 - 6.8 * 0.75, { width: PAGE_WIDTH, align: "center" });
        doc.fillColor(GOLD_DARK).font("Helvetica-Bold").fontSize(9).text("@NOCITO.COACH", MARGIN, footerY2 - 9 * 0.75, { width: PAGE_WIDTH, align: "center", characterSpacing: 2.6 });
        doc.fillColor(GRAY).font("Helvetica").fontSize(6.6).text("NOCITO-COACH.VERCEL.APP", MARGIN, footerY3 - 6.6 * 0.75, { width: PAGE_WIDTH, align: "center", characterSpacing: 2.2 });
    
        doc.end();
        return { doc, chunks };
      }
    
      let k = Math.min(1.2, (ZONE_H - (n - 1) * 8) / n / 118);
      if (maxEx > 8) k = k * (8 / maxEx);
      let result: { doc: PDFKit.PDFDocument; chunks: Buffer[] } | null = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        const r = makeDoc(k);
        const bufPromise = new Promise<Buffer>((resolve) => {
          r.doc.on("end", () => resolve(Buffer.concat(r.chunks)));
        });
        r.doc.end();
        await bufPromise;
        const pageCount = r.doc.bufferedPageRange().count;
        if (pageCount <= 1) {
          result = r;
          break;
        }
        k *= 0.85;
        if (k < 0.5) k = 0.5;
      }
      if (!result) {
        const r = makeDoc(k);
        const p = new Promise<void>((resolve) => {
          r.doc.on("end", () => resolve());
        });
        r.doc.end();
        await p;
        result = r;
      }
    
      const buffer = Buffer.concat(result.chunks);
      const fileName = `Rutina-${safeName}-Nocito-Coach.pdf`;
    
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Cache-Control": "no-store",
        },
      });
  } catch (err: any) {
    console.error("[export-routine-pdf]", err);
    return NextResponse.json({ ok: false, error: err?.message || "Error interno" }, { status: 500 });
  }

}

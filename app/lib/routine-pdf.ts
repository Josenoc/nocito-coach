import type { ClientPayload } from "./routine";
import PDFDocument from "pdfkit";

const DARK = "#0B0B0B";
const WHITE = "#FFFFFF";
const ACCENT = "#FF8A65";
const GREEN = "#8AF0A8";
const GRAY = "#555555";

function clean(value: unknown): string {
  return String(value ?? "").replace(/\u0000/g, "");
}

export function renderRoutinePdf(p: ClientPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 44, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const bandH = 96;
  let y = 0;

  function newPage() {
    doc.addPage();
    y = doc.page.margins.top;
    doc
      .fillColor(DARK)
      .rect(doc.page.margins.left, y, pageWidth, 16)
      .fill()
      .fillColor(WHITE)
      .fontSize(7)
      .font("Helvetica-Bold")
      .text("NOCITO COACH", doc.page.margins.left + 6, y + 4, {
        width: pageWidth - 12,
        characterSpacing: 1,
      });
    y += 28;
  }

  function section(title: string) {
    if (y > doc.page.height - doc.page.margins.bottom - 44) newPage();
    doc
      .fillColor("#111111")
      .fontSize(13)
      .font("Helvetica-Bold")
      .text(title, doc.page.margins.left, y);
    y += 20;
  }

  function labelValue(label: string, value: string) {
    const left = doc.page.margins.left;
    const labelW = 124;
    const rowH = 24;
    if (y + rowH > doc.page.height - doc.page.margins.bottom) newPage();
    doc
      .fillColor("#F5F5F5")
      .rect(left, y, pageWidth, rowH)
      .fill()
      .fillColor("#111111")
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(label, left + 6, y + 8, { width: labelW - 12 })
      .font("Helvetica")
      .text(value, left + labelW, y + 8, { width: pageWidth - labelW - 12 });
    y += rowH;
  }

  function tableHead(cols: number[], labels: string[]) {
    const left = doc.page.margins.left;
    const h = 20;
    doc.fillColor(DARK).rect(left, y, pageWidth, h).fill();
    let x = left;
    for (let i = 0; i < cols.length; i++) {
      doc
        .fillColor(WHITE)
        .font("Helvetica-Bold")
        .fontSize(8)
        .text(labels[i] ?? "", x + 4, y + 6, { width: cols[i] - 8 });
      x += cols[i];
    }
    y += h;
  }

  function tableRows(cols: number[], rows: string[][]) {
    const left = doc.page.margins.left;
    const pad = 4;
    for (const row of rows) {
      let rowH = 22;
      const line = doc.font("Helvetica").fontSize(9);
      let maxTxt = 0;
      for (let i = 0; i < cols.length; i++) {
        const w = cols[i];
        const h = line.heightOfString(row[i] ?? "", { width: w - pad * 2 });
        if (h > maxTxt) maxTxt = h;
      }
      if (maxTxt + pad * 2 > rowH) rowH = maxTxt + pad * 2;
      if (y + rowH > doc.page.height - doc.page.margins.bottom) {
        newPage();
        tableHead(cols, ["EJERCICIO", "SERIES", "REPS", "DESC"].slice(0, cols.length));
      }
      let x = left;
      for (let i = 0; i < cols.length; i++) {
        const w = cols[i];
        doc
          .fillColor(i % 2 === 1 ? "#FAFAFA" : WHITE)
          .rect(x, y, w, rowH)
          .fill();
        doc
          .fillColor("#111111")
          .font("Helvetica")
          .fontSize(9)
          .text(row[i] ?? "", x + pad, y + pad, { width: w - pad * 2 });
        x += w;
      }
      y += rowH;
    }
    y += 10;
  }

  doc.rect(0, 0, doc.page.width, bandH).fill(DARK);
  doc
    .fillColor(ACCENT)
    .fontSize(9)
    .font("Helvetica-Bold")
    .text("NOCITO COACH", doc.page.margins.left, 18, { characterSpacing: 3 });
  doc
    .fillColor(WHITE)
    .fontSize(20)
    .font("Helvetica-Bold")
    .text("RUTINA Y PLAN NUTRICIONAL", doc.page.margins.left, 34);
  const subj = p.plan ? `${p.plan.name} · ${p.name}` : p.name;
  doc
    .fillColor("#BBBBBB")
    .fontSize(11)
    .font("Helvetica")
    .text(`Preparado para ${clean(subj)}`, doc.page.margins.left, 62);
  doc
    .fillColor(GREEN)
    .fontSize(10)
    .font("Helvetica-Bold")
    .text("PAGO CONFIRMADO", doc.page.margins.left, 80, { characterSpacing: 2 });

  y = bandH + 24;

  section("DATOS DEL CLIENTE");
  labelValue("NOMBRE", clean(p.name));
  labelValue("CONTACTO", clean(p.contact));
  labelValue("SEXO", clean(p.sex || "No especificado"));
  labelValue("EDAD / PESO / ALTURA", `${p.age} años · ${p.weight} kg · ${p.height} cm`);
  labelValue("OBJETIVO", clean(p.objective));
  labelValue("PRIORIDAD", clean(p.priority || "Cuerpo completo"));
  labelValue("EXPERIENCIA", `${clean(p.experience)} · ${p.days} días/semana`);
  labelValue("PREFERENCIAS", clean((p.prefs || []).join(", ") || "Omnívoro"));
  labelValue("IMC", clean(p.bmi) + (p.imcCategory ? " — " + clean(p.imcCategory) : ""));
  labelValue("TMB", p.tmb ? `${p.tmb} kcal/día` : "—");
  labelValue("GET (TDEE)", p.tdee ? `${p.tdee} kcal/día` : "—");
  y += 6;

  section("MACROS DIARIOS");
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#111111")
    .text(
      `Calorías: ${p.nutrition.cal} kcal  ·  Proteínas: ${p.nutrition.prot} g  ·  Carbohidratos: ${p.nutrition.carbs} g  ·  Grasas: ${p.nutrition.fat} g`,
      doc.page.margins.left,
      y,
      { width: pageWidth }
    );
  y += 18;
  doc.fontSize(9).text(`Fuentes de proteína sugeridas: ${clean(p.nutrition.proteinSources)}`, doc.page.margins.left, y, {
    width: pageWidth,
  });
  y += doc.heightOfString(clean(p.nutrition.proteinSources), { width: pageWidth }) + 16;

  section("RUTINA SUGERIDA");
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#111111")
    .text(clean(p.routineLabel), doc.page.margins.left, y, { width: pageWidth });
  y += doc.heightOfString(clean(p.routineLabel), { width: pageWidth }) + 12;

  const dayCols = [pageWidth - 110, 34, 44, 32];
  const dayLabels = ["EJERCICIO", "SERIES", "REPS", "DESC."];
  for (const day of p.routine.days) {
    if (y > doc.page.height - doc.page.margins.bottom - 60) newPage();
    doc
      .fillColor("#111111")
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(clean(day.name), doc.page.margins.left, y);
    y += 16;
    if (day.focus) {
      doc
        .fillColor(GRAY)
        .font("Helvetica-Oblique")
        .fontSize(9)
        .text(clean(day.focus), doc.page.margins.left, y);
      y += 14;
    }
    y += 2;
    tableHead(dayCols, dayLabels);
    tableRows(dayCols, day.items.map((r) => r.map((c) => String(c ?? ""))));
    if (y > doc.page.height - doc.page.margins.bottom - 44) newPage();
  }
  y += 4;

  section("PLAN DE COMIDAS");
  const mealCols = [110, pageWidth - 110];
  tableHead(mealCols, ["COMIDA", "SUGERENCIA"]);
  tableRows(mealCols, p.nutrition.meals.map((m) => [String(m[0]), String(m[1])]));

  if (y + 60 > doc.page.height - doc.page.margins.bottom) newPage();
  doc
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.margins.left + pageWidth, y)
    .strokeColor("#DDDDDD")
    .lineWidth(1)
    .stroke();
  y += 14;
  doc
    .fillColor(GRAY)
    .fontSize(8)
    .font("Helvetica")
    .text(
      `Generado el ${clean(p.fecha)} · Pago confirmado automáticamente por Mercado Pago.`,
      doc.page.margins.left,
      y,
      { width: pageWidth }
    );

  doc.end();
  });
}
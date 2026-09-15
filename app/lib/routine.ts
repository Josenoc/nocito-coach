import { SOURCES_CITATION } from "./sources";

export type ExerciseItem = [string, string, string, string];

export type RoutineDay = {
  name: string;
  focus: string;
  items: ExerciseItem[];
};

export type RoutineData = {
  label: string;
  splitName: string;
  days: RoutineDay[];
  reglas?: string[];
};

export type NutritionData = {
  cal: number;
  prot: number;
  carbs: number;
  fat: number;
  proteinSources: string;
  sugerencias?: string[];
  meals: [string, string][];
};

export type ClientPayload = {
  fecha?: string;
  name: string;
  contact: string;
  sex?: string;
  priority?: string;
  age: number;
  height: number;
  weight: number;
  objective: string;
  experience: string;
  days: number;
  prefs: string[];
  bmi: string;
  imcCategory?: string;
  tmb?: number;
  tdee?: number;
  activityFactor?: number;
  routineLabel: string;
  routine: RoutineData;
  nutrition: NutritionData;
  plan?: { name: string; confirmed?: boolean };
};

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function parsePayload(value: unknown): ClientPayload | null {
  const o = asObject(value);
  if (!asString(o.name)) return null;
  const routine = asObject(o.routine);
  const nutrition = asObject(o.nutrition);
  return {
    fecha: asString(o.fecha, new Date().toISOString().slice(0, 10)),
    name: asString(o.name),
    contact: asString(o.contact),
    age: asNumber(o.age),
    height: asNumber(o.height),
    weight: asNumber(o.weight),
    objective: asString(o.objective),
    experience: asString(o.experience),
    days: asNumber(o.days),
    prefs: Array.isArray(o.prefs) ? o.prefs.map(String) : [],
    bmi: asString(o.bmi),
    sex: asString(o.sex),
    priority: asString(o.priority),
    imcCategory: asString(o.imcCategory),
    tmb: asNumber(o.tmb),
    tdee: asNumber(o.tdee),
    activityFactor: asNumber(o.activityFactor),
    routineLabel: asString(o.routineLabel),
    routine: {
      label: asString(routine.label),
      splitName: asString(routine.splitName),
      reglas: Array.isArray(routine.reglas) ? (routine.reglas as unknown[]).map(String) : undefined,
      days: Array.isArray(routine.days)
        ? (routine.days as unknown[])
            .map((d) => asObject(d))
            .filter((d) => asString(d.name))
            .map((d) => ({
              name: asString(d.name),
              focus: asString(d.focus),
              items: Array.isArray(d.items)
                ? (d.items as unknown[]).map((row) => {
                    const r = Array.isArray(row) ? row : [];
                    return [
                      asString(r[0]),
                      asString(r[1]),
                      asString(r[2]),
                      asString(r[3]),
                    ] as ExerciseItem;
                  })
                : [],
            }))
        : [],
    },
    nutrition: {
      cal: asNumber(nutrition.cal),
      prot: asNumber(nutrition.prot),
      carbs: asNumber(nutrition.carbs),
      fat: asNumber(nutrition.fat),
      proteinSources: asString(nutrition.proteinSources),
      sugerencias: Array.isArray(nutrition.sugerencias)
        ? (nutrition.sugerencias as unknown[]).map(String)
        : undefined,
      meals: Array.isArray(nutrition.meals)
        ? (nutrition.meals as unknown[]).map((m) => {
            const r = Array.isArray(m) ? m : [];
            return [asString(r[0]), asString(r[1])] as [string, string];
          })
        : [],
    },
    plan: (() => {
      const planObj = asObject(o.plan);
      return asString(planObj.name) ? { name: asString(planObj.name) } : undefined;
    })(),
  };
}

function clientDataBlock(p: ClientPayload): string[] {
  return [
    `<tr><td style="padding:6px 10px;border:1px solid #ddd;width:180px;"><b>NOMBRE</b></td><td style="padding:6px 10px;border:1px solid #ddd;">${esc(p.name)}</td></tr>`,
    `<tr><td style="padding:6px 10px;border:1px solid #ddd;"><b>CONTACTO</b></td><td style="padding:6px 10px;border:1px solid #ddd;">${esc(p.contact)}</td></tr>`,
    `<tr><td style="padding:6px 10px;border:1px solid #ddd;"><b>SEXO</b></td><td style="padding:6px 10px;border:1px solid #ddd;">${esc(p.sex || "No especificado")}</td></tr>`,
    `<tr><td style="padding:6px 10px;border:1px solid #ddd;"><b>EDAD / PESO / ALTURA</b></td><td style="padding:6px 10px;border:1px solid #ddd;">${p.age} años · ${p.weight} kg · ${p.height} cm</td></tr>`,
    `<tr><td style="padding:6px 10px;border:1px solid #ddd;"><b>OBJETIVO</b></td><td style="padding:6px 10px;border:1px solid #ddd;">${esc(p.objective)}</td></tr>`,
    `<tr><td style="padding:6px 10px;border:1px solid #ddd;"><b>PRIORIDAD</b></td><td style="padding:6px 10px;border:1px solid #ddd;">${esc(p.priority || "Cuerpo completo")}</td></tr>`,
    `<tr><td style="padding:6px 10px;border:1px solid #ddd;"><b>EXPERIENCIA</b></td><td style="padding:6px 10px;border:1px solid #ddd;">${esc(p.experience)} · ${p.days} días/semana</td></tr>`,
    `<tr><td style="padding:6px 10px;border:1px solid #ddd;"><b>PREFERENCIAS</b></td><td style="padding:6px 10px;border:1px solid #ddd;">${esc((p.prefs || []).join(", ") || "Omnívoro")}</td></tr>`,
    `<tr><td style="padding:6px 10px;border:1px solid #ddd;"><b>IMC</b></td><td style="padding:6px 10px;border:1px solid #ddd;">${esc(p.bmi)}${p.imcCategory ? " — " + esc(p.imcCategory) : ""}</td></tr>`,
    `<tr><td style="padding:6px 10px;border:1px solid #ddd;"><b>TMB</b></td><td style="padding:6px 10px;border:1px solid #ddd;">${p.tmb ? p.tmb + " kcal/día" : "—"}</td></tr>`,
    `<tr><td style="padding:6px 10px;border:1px solid #ddd;"><b>GET (TDEE)</b></td><td style="padding:6px 10px;border:1px solid #ddd;">${p.tdee ? p.tdee + " kcal/día" : "—"}</td></tr>`,
  ];
}

function macrosBlock(p: ClientPayload): string {
  const cal = p.nutrition.cal;
  return [
    `<p><b>Rutina sugerida:</b> ${esc(p.routineLabel)}</p>`,
    `<h3 style="margin:18px 0 6px;color:#111;">MACROS DIARIOS</h3>`,
    `<p style="margin:0;">Calorías: <b>${cal} kcal</b></p>`,
    `<p style="margin:0;">Proteínas: <b>${p.nutrition.prot} g</b> · Carbohidratos: <b>${p.nutrition.carbs} g</b> · Grasas: <b>${p.nutrition.fat} g</b></p>`,
    `<p style="margin:0;">Fuentes de proteína sugeridas: ${esc(p.nutrition.proteinSources)}</p>`,
  ].join("\n");
}

function settingsBlock(p: ClientPayload): string {
  const parts: string[] = [];
  if (p.routine.reglas && p.routine.reglas.length) {
    parts.push(
      `<h3 style="margin:18px 0 6px;color:#111;">REGLAS DE CARGA</h3>`,
      `<div style="background:#f7f7f7;border-left:3px solid #ff8a65;padding:10px 14px;font-size:13px;color:#111;line-height:1.55;">${p.routine.reglas
        .map((r) => "• " + esc(r))
        .join("<br>")}</div>`
    );
  }
  if (p.nutrition.sugerencias && p.nutrition.sugerencias.length) {
    parts.push(
      `<h3 style="margin:18px 0 6px;color:#111;">NUTRICIÓN Y SUPLEMENTACIÓN</h3>`,
      `<div style="background:#f0f9f2;border-left:3px solid #8af0a8;padding:10px 14px;font-size:13px;color:#111;line-height:1.55;">${p.nutrition.sugerencias
        .map((s) => "• " + esc(s))
        .join("<br>")}</div>`
    );
  }
  return parts.join("\n");
}

function routineBlocks(p: ClientPayload): string[] {
  const blocks: string[] = [];
  for (const day of p.routine.days) {
    const head = `<tr><th style="padding:6px 10px;border:1px solid #ddd;background:#f0f0f0;text-align:left;">EJERCICIO</th><th style="padding:6px 10px;border:1px solid #ddd;background:#f0f0f0;">SERIES</th><th style="padding:6px 10px;border:1px solid #ddd;background:#f0f0f0;">REPS</th><th style="padding:6px 10px;border:1px solid #ddd;background:#f0f0f0;">DESCANSO</th></tr>`;
    const rows = day.items
      .map(
        (row) =>
          `<tr><td style="padding:5px 10px;border:1px solid #ddd;">${esc(row[0])}</td><td style="padding:5px 10px;border:1px solid #ddd;text-align:center;">${esc(row[1])}</td><td style="padding:5px 10px;border:1px solid #ddd;text-align:center;">${esc(row[2])}</td><td style="padding:5px 10px;border:1px solid #ddd;text-align:center;">${esc(row[3])}″</td></tr>`
      )
      .join("\n");
    blocks.push(
      `<h3 style="margin:20px 0 4px;color:#111;">${esc(day.name)}</h3>` +
        (day.focus ? `<p style="margin:0 0 6px;"><i>${esc(day.focus)}</i></p>` : "") +
        `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;font-size:13px;color:#111;">${head}\n${rows}</table>`
    );
  }
  return blocks;
}

function mealsBlock(p: ClientPayload): string {
  const rows = p.nutrition.meals
    .map(
      (m) =>
        `<tr><td style="padding:6px 10px;border:1px solid #ddd;"><b>${esc(m[0])}</b></td><td style="padding:6px 10px;border:1px solid #ddd;">${esc(m[1])}</td></tr>`
    )
    .join("\n");
  return [
    `<h3 style="margin:18px 0 6px;color:#111;">PLAN DE COMIDAS</h3>`,
    `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;font-size:13px;color:#111;"><tr><th style="padding:6px 10px;border:1px solid #ddd;background:#f0f0f0;width:150px;">COMIDA</th><th style="padding:6px 10px;border:1px solid #ddd;background:#f0f0f0;text-align:left;">SUGERENCIA</th></tr>\n${rows}</table>`,
  ].join("\n");
}

export function renderRoutineHtml(p: ClientPayload): string {
  const title = p.plan ? `${esc(p.plan.name)} · ${esc(p.name)}` : esc(p.name);
  return [
    `<div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;">`,
    `<div style="background:#0b0b0b;color:#fff;padding:22px 26px;border-radius:8px;">`,
    `<p style="margin:0;font-size:11px;letter-spacing:2px;color:#ff8a65;">NOCITO COACH</p>`,
    `<h1 style="margin:6px 0 0;font-size:22px;">RUTINA Y PLAN NUTRICIONAL</h1>`,
    `<p style="margin:6px 0 0;color:#bbb;font-size:13px;">Preparado para ${title}</p>`,
    `<p style="margin:10px 0 0;font-size:12px;letter-spacing:1px;color:#8af0a8;font-weight:700;">PAGO CONFIRMADO</p>`,
    `</div>`,
    `<div style="background:#fff;padding:26px;border-radius:0 0 8px 8px;">`,
    `<h3 style="margin:0 0 6px;color:#111;">DATOS DEL CLIENTE</h3>`,
    `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;font-size:13px;color:#111;">${clientDataBlock(p).join("\n")}</table>`,
    macrosBlock(p),
    settingsBlock(p),
    routineBlocks(p).join("\n"),
    mealsBlock(p),
    `<hr style="border:none;border-top:1px solid #ddd;margin:22px 0;">`,
    `<p style="font-size:12px;color:#555;margin:0;">Generado el ${esc(p.fecha)} · Pago confirmado automáticamente por Mercado Pago.</p>`,
    `<p style="font-size:11px;color:#888;margin:6px 0 0;">Fuentes de referencia: ${esc(SOURCES_CITATION)}.</p>`,
    `</div>`,
    `</div>`,
  ].join("\n");
}

export function renderRoutineText(p: ClientPayload): string {
  const L: string[] = [];
  L.push("NOCITO COACH — RUTINA Y PLAN NUTRICIONAL");
  L.push("Preparado para " + (p.plan ? `${p.plan.name} · ` : "") + p.name);
  L.push("PAGO CONFIRMADO");
  L.push("");
  L.push("DATOS DEL CLIENTE:");
  L.push("- Nombre: " + p.name);
  L.push("- Contacto: " + p.contact);
  L.push("- Edad/Peso/Altura: " + p.age + " años / " + p.weight + " kg / " + p.height + " cm");
  L.push("- Sexo: " + (p.sex || "No especificado"));
  L.push("- Objetivo: " + p.objective);
  L.push("- Prioridad: " + (p.priority || "Cuerpo completo"));
  L.push("- Experiencia: " + p.experience + " · " + p.days + " días/semana");
  L.push("- Preferencias: " + (p.prefs.join(", ") || "Omnívoro"));
  L.push("- IMC: " + p.bmi + (p.imcCategory ? " — " + p.imcCategory : ""));
  L.push("- TMB: " + (p.tmb ? p.tmb + " kcal/día" : "—"));
  L.push("- GET (TDEE): " + (p.tdee ? p.tdee + " kcal/día" : "—"));
  L.push("");
  L.push("Rutina sugerida: " + p.routineLabel);
  L.push("MACROS DIARIOS (kcal " + p.nutrition.cal + "):");
  L.push(
    "- Proteínas: " + p.nutrition.prot + " g / Carbos: " + p.nutrition.carbs + " g / Grasas: " + p.nutrition.fat + " g"
  );
  L.push("- Fuentes de proteína: " + p.nutrition.proteinSources);
  L.push("");
  if (p.routine.reglas && p.routine.reglas.length) {
    L.push("REGLAS DE CARGA:");
    for (const r of p.routine.reglas) L.push("- " + r);
    L.push("");
  }
  if (p.nutrition.sugerencias && p.nutrition.sugerencias.length) {
    L.push("NUTRICIÓN Y SUPLEMENTACIÓN:");
    for (const s of p.nutrition.sugerencias) L.push("- " + s);
    L.push("");
  }
  for (const day of p.routine.days) {
    L.push(day.name.toUpperCase() + (day.focus ? " — " + day.focus : ""));
    for (const row of day.items) {
      L.push(`- ${row[0]}: ${row[1]} x ${row[2]} (desc. ${row[3]}″)`);
    }
    L.push("");
  }
  L.push("PLAN DE COMIDAS:");
  for (const m of p.nutrition.meals) {
    L.push("- " + m[0] + ": " + m[1]);
  }
  L.push("");
  L.push("Generado el " + p.fecha + " · Pago confirmado automáticamente por Mercado Pago.");
  L.push("Fuentes de referencia: " + SOURCES_CITATION + ".");
  return L.join("\n");
}
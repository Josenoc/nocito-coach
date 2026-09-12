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
};

export type NutritionData = {
  cal: number;
  prot: number;
  carbs: number;
  fat: number;
  proteinSources: string;
  meals: [string, string][];
};

export type ClientPayload = {
  fecha?: string;
  name: string;
  contact: string;
  age: number;
  height: number;
  weight: number;
  objective: string;
  experience: string;
  days: number;
  prefs: string[];
  bmi: string;
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
    routineLabel: asString(o.routineLabel),
    routine: {
      label: asString(routine.label),
      splitName: asString(routine.splitName),
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
    `<tr><td style="padding:6px 10px;border:1px solid #ddd;"><b>EDAD / PESO / ALTURA</b></td><td style="padding:6px 10px;border:1px solid #ddd;">${p.age} años · ${p.weight} kg · ${p.height} cm</td></tr>`,
    `<tr><td style="padding:6px 10px;border:1px solid #ddd;"><b>OBJETIVO</b></td><td style="padding:6px 10px;border:1px solid #ddd;">${esc(p.objective)}</td></tr>`,
    `<tr><td style="padding:6px 10px;border:1px solid #ddd;"><b>EXPERIENCIA</b></td><td style="padding:6px 10px;border:1px solid #ddd;">${esc(p.experience)} · ${p.days} días/semana</td></tr>`,
    `<tr><td style="padding:6px 10px;border:1px solid #ddd;"><b>PREFERENCIAS</b></td><td style="padding:6px 10px;border:1px solid #ddd;">${esc((p.prefs || []).join(", ") || "Omnívoro")}</td></tr>`,
    `<tr><td style="padding:6px 10px;border:1px solid #ddd;"><b>IMC</b></td><td style="padding:6px 10px;border:1px solid #ddd;">${esc(p.bmi)}</td></tr>`,
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
    `<p style="margin:10px 0 0;font-size:12px;letter-spacing:1px;color:#ffcc80;font-weight:700;">SOLICITUD PENDIENTE DE PAGO</p>`,
    `</div>`,
    `<div style="background:#fff;padding:26px;border-radius:0 0 8px 8px;">`,
    `<h3 style="margin:0 0 6px;color:#111;">DATOS DEL CLIENTE</h3>`,
    `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;font-size:13px;color:#111;">${clientDataBlock(p).join("\n")}</table>`,
    macrosBlock(p),
    routineBlocks(p).join("\n"),
    mealsBlock(p),
    `<hr style="border:none;border-top:1px solid #ddd;margin:22px 0;">`,
    `<p style="font-size:12px;color:#555;margin:0;">Generado el ${esc(p.fecha)} · Solicitud recibida, pendiente de pago. Enviar la rutina al cliente cuando confirmes el pago en Mercado Pago.</p>`,
    `</div>`,
    `</div>`,
  ].join("\n");
}

export function renderRoutineText(p: ClientPayload): string {
  const L: string[] = [];
  L.push("NOCITO COACH — RUTINA Y PLAN NUTRICIONAL");
  L.push("Preparado para " + (p.plan ? `${p.plan.name} · ` : "") + p.name);
  L.push("SOLICITUD PENDIENTE DE PAGO");
  L.push("");
  L.push("DATOS DEL CLIENTE:");
  L.push("- Nombre: " + p.name);
  L.push("- Contacto: " + p.contact);
  L.push("- Edad/Peso/Altura: " + p.age + " años / " + p.weight + " kg / " + p.height + " cm");
  L.push("- Objetivo: " + p.objective);
  L.push("- Experiencia: " + p.experience + " · " + p.days + " días/semana");
  L.push("- Preferencias: " + (p.prefs.join(", ") || "Omnívoro"));
  L.push("- IMC: " + p.bmi);
  L.push("");
  L.push("Rutina sugerida: " + p.routineLabel);
  L.push("MACROS DIARIOS (kcal " + p.nutrition.cal + "):");
  L.push(
    "- Proteínas: " + p.nutrition.prot + " g / Carbos: " + p.nutrition.carbs + " g / Grasas: " + p.nutrition.fat + " g"
  );
  L.push("- Fuentes de proteína: " + p.nutrition.proteinSources);
  L.push("");
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
  L.push("Generado el " + p.fecha + " · Solicitud recibida, pendiente de pago.");
  return L.join("\n");
}
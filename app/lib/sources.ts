export const SOURCES = [
  {
    id: "anselmi",
    cite: "Manual de Fuerza, Potencia y Acondicionamiento Físico (H. Anselmi)",
  },
  {
    id: "bueno",
    cite: "Guía GANAR MASA MUSCULAR (Á. Bueno)",
  },
  {
    id: "yared",
    cite: "Hipertrofia Muscular (Yared)",
  },
  {
    id: "raygoza",
    cite: "Recomposición corporal: revisión de estrategias nutricionales (2025)",
  },
] as const;

export const SOURCES_CITATION = SOURCES.map((s) => s.cite).join(" · ");

export const ZONAS = [
  { id: "Z1", reps: "4-8", enfasis: "Fuerza y potencia" },
  { id: "Z2", reps: "8-12", enfasis: "Hipertrofia" },
  { id: "Z3", reps: "10-15", enfasis: "Resistencia y acondicionamiento" },
] as const;

export function repsForObjetivo(objetivo: string): string {
  if (objetivo === "perder-grasa") return ZONAS[2].reps;
  return ZONAS[1].reps;
}

export const RIR_BY_EXPERIENCE: Record<string, string> = {
  principiante: "2-3",
  intermedio: "1-2",
  avanzado: "0-1",
};

export const PROTEINA_G_PER_KG: Record<string, [number, number]> = {
  "ganar-masa": [1.7, 2.0],
  "perder-grasa": [2.0, 2.2],
  recomposicion: [1.6, 2.2],
};

export const CHO_G_PER_KG: [number, number] = [3, 5];

export const GRASA_PORCENTAJE: [number, number] = [20, 30];

export const CREATINA_NOTA = "Creatina: 3-5 g por día, todos los días incluidos los de descanso.";

export const PROTEINA_DISTRIBUCIÓN =
  "Distribuí la proteína en 4-6 comidas de 0,25-0,4 g/kg cada 3-4 horas; al menos 2 g de leucina por comida principal.";

export const CHO_POST_ENTRENO =
  "Post-entreno: 0,7 g/kg de carbohidratos simples para acelerar la reposición de glucógeno.";

export const GRASAS_NOTA =
  "Grasas: 20-30% de las calorías diarias, priorizando las insaturadas (palta, aceite de oliva, frutos secos).";

export function rirPara(experiencia: string): string {
  return RIR_BY_EXPERIENCE[experiencia] ?? "1-2";
}

export function reglasDeCarga(
  objetivo: string,
  experiencia: string,
  dias: number
): string[] {
  const rir = rirPara(experiencia);
  const lines: string[] = [
    "Zonas de repeticiones: Z1 4-8 (fuerza/potencia), Z2 8-12 (hipertrofia), Z3 10-15 (resistencia/acondicionamiento).",
    "Intensidad: dejá " +
      rir +
      " repeticiones en reserva (RIR " +
      rir +
      "), sin llegar al fallo; no frenes la serie menos de " +
      rir +
      " reps antes del fallo.",
    "Tempo: controlá la bajada (2 s) y empujá con fuerza en la subida (1 s); sin rebotes ni balanceos, con amplitud de recorrido completa.",
    "Descansos: respetá los indicados en la tabla (60-90 s en aislados, 2-3 min en compuestos).",
    "Volumen: 10-20 series por grupo muscular por semana; sobrecarga progresiva: primero técnica y rango completo, luego peso o volumen.",
  ];
  if (dias <= 2 || experiencia === "principiante") {
    lines.push(
      "Frecuencia: el cuerpo completo se entrena " +
        dias +
        " veces por semana; progresá de circuitos de 2 a 3 sesiones semanales antes de sumar divididos."
    );
  } else if (dias === 3) {
    lines.push(
      "Con 3 días (Push / Pull / Legs) cada grupo recibe un estímulo semanal intenso; mantené el volumen de cada sesión para compensar la frecuencia."
    );
  } else {
    lines.push("Frecuencia: cada grupo muscular al menos 2 días por semana, ideal para hipertrofia.");
  }
  if (objetivo === "ganar-masa") {
    lines.push("Hipertrofia: la mayor parte del trabajo en 6-12 reps (Z2) cerca del fallo (RIR 1-2).");
  } else if (objetivo === "perder-grasa") {
    lines.push(
      "Definición: mantené la fuerza en Z2/Z3 y sumá el cardio HIIT indicado; el déficit calórico hace el resto."
    );
  } else {
    lines.push(
      "Recomposición: la fuerza es el estímulo principal; mantené la proteína alta y repartida durante el día."
    );
  }
  return lines;
}
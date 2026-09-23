/**
 * BIBLIOTECA DE FUENTES (knowledge base interna)
 *
 * Estas referencias sustentan el criterio de armado de rutinas y planes
 * nutricionales. Este módulo es puramente documental: NO se importa desde
 * el pipeline de generación, por lo tanto NO se cita en los resultados
 * (PDF / rutina.html) ni en los mensajes de WhatsApp/correo.
 *
 * Nota: los libros "Elevify" llegaron como PDF solo-imagen (sin capa de
 * texto legible), por lo que su contenido aún no está indexado en la
 * lógica; se registran aquí como bibliografía de base, pendiente de
 * incorporación de contenido.
 *
 * Lo mismo aplica al material del "Curso de Personal Trainer 2025":
 * las guías y unidades (anatomía, metabolismo, fisiología) son
 * presentaciones exportadas a PDF, en gran parte solo-imagen, por lo que
 * se catalogan como pendientes hasta indexar su contenido completo.
 */

export type Fuente = {
  id: string;
  autor: string;
  titulo: string;
  anio?: string;
  tipo: "libro" | "guia" | "articulo-academico" | "manual" | "consenso" | "pendiente";
  temas: string[];
  estado: "integrada" | "pendiente";
};

export const FUENTES: Fuente[] = [
  {
    id: "anselmi",
    autor: "H. Anselmi",
    titulo: "Manual de Fuerza, Potencia y Acondicionamiento Físico",
    tipo: "manual",
    temas: ["fuerza", "potencia", "acondicionamiento", "periodización"],
    estado: "integrada",
  },
  {
    id: "bueno",
    autor: "Á. Bueno",
    titulo: "Guía GANAR MASA MUSCULAR",
    tipo: "guia",
    temas: ["hipertrofia", "volumen", "nutrición"],
    estado: "integrada",
  },
  {
    id: "yared",
    autor: "Yared",
    titulo: "Hipertrofia Muscular",
    tipo: "guia",
    temas: ["hipertrofia", "entrenamiento"],
    estado: "integrada",
  },
  {
    id: "raygoza",
    autor: "Raygoza",
    titulo: "Recomposición corporal: revisión de estrategias nutricionales",
    anio: "2025",
    tipo: "articulo-academico",
    temas: ["recomposición corporal", "nutrición", "déficit", "proteína"],
    estado: "integrada",
  },
  {
    id: "elevify-estiramientos",
    autor: "Elevify",
    titulo: "Estiramientos y Movilidad",
    tipo: "pendiente",
    temas: ["movilidad", "flexibilidad", "preparación", "recuperación"],
    estado: "pendiente",
  },
  {
    id: "elevify-nutricion",
    autor: "Elevify",
    titulo: "Guía de Nutrición para Hipertrofia",
    tipo: "pendiente",
    temas: ["nutrición", "hipertrofia", "macros"],
    estado: "pendiente",
  },
  {
    id: "elevify-kit",
    autor: "Elevify",
    titulo: "Kit Profesional del Entrenador",
    tipo: "pendiente",
    temas: ["coaching", "programación", "entrenador"],
    estado: "pendiente",
  },
  {
    id: "elevify-metodos",
    autor: "Elevify",
    titulo: "Métodos de Entrenamiento para Hipertrofia",
    tipo: "pendiente",
    temas: ["hipertrofia", "métodos", "volumen", "intensidad"],
    estado: "pendiente",
  },
  {
    id: "mifflin-st-jeor",
    autor: "Mifflin, M. D.; St Jeor, S. T.; et al.",
    titulo:
      "A new predictive equation for resting energy expenditure in healthy individuals (Am. J. Clin. Nutr., 1990)",
    anio: "1990",
    tipo: "articulo-academico",
    temas: ["tmb", "gasto energético", "ecuación predictiva"],
    estado: "integrada",
  },
  {
    id: "issn-proteina",
    autor: "Jäger, R.; Kerksick, C. M.; Campbell, B. I.; et al.",
    titulo:
      "International Society of Sports Nutrition position stand: protein and exercise (J. Int. Soc. Sports Nutr., 2017)",
    anio: "2017",
    tipo: "consenso",
    temas: ["proteína", "recomendaciones", "hipertrofia"],
    estado: "integrada",
  },
  {
    id: "isma-cho-post",
    autor: "Keri Marshall; International Society of Sports Nutrition",
    titulo:
      "ISSN exercise & sports nutrition review update (post-exercise carbohydrate, 2013)",
    anio: "2013",
    tipo: "consenso",
    temas: ["carbohidratos", "reposición de glucógeno", "post-entreno"],
    estado: "integrada",
  },
  {
    id: "pt-osteoarticular",
    autor: "Curso de Personal Trainer 2025",
    titulo: "Sistema Osteoarticular",
    tipo: "pendiente",
    temas: ["anatomía", "sistema esquelético", "huesos", "articulaciones", "tejido óseo"],
    estado: "pendiente",
  },
  {
    id: "pt-musculo-esqueletico",
    autor: "Curso de Personal Trainer 2025",
    titulo: "Músculo Esquelético",
    tipo: "pendiente",
    temas: ["anatomía", "tejido muscular", "tipos de fibras", "contracción"],
    estado: "pendiente",
  },
  {
    id: "pt-metabolismo",
    autor: "Curso de Personal Trainer 2025",
    titulo: "Metabolismo y Sistemas Energéticos",
    tipo: "pendiente",
    temas: ["metabolismo", "sistemas energéticos", "nutrientes", "digestión"],
    estado: "pendiente",
  },
  {
    id: "pt-respiratorio-circulatorio",
    autor: "Curso de Personal Trainer 2025",
    titulo: "Sistemas Respiratorio y Circulatorio",
    tipo: "pendiente",
    temas: ["fisiología", "respiración", "cardiovascular", "sangre"],
    estado: "pendiente",
  },
  {
    id: "pt-nervioso-endocrino",
    autor: "Curso de Personal Trainer 2025",
    titulo: "Sistema Nervioso y Sistema Endocrino",
    tipo: "pendiente",
    temas: ["fisiología", "sistema nervioso", "endócrino", "sinapsis", "contracción"],
    estado: "pendiente",
  },
  {
    id: "pt-guia-1",
    autor: "Curso de Personal Trainer 2025",
    titulo: "Guía Nº 1 · MOD 1-3 + Alimentación, Descanso y Suplementación",
    tipo: "pendiente",
    temas: ["curso personal trainer", "mod", "alimentación", "descanso", "suplementación"],
    estado: "pendiente",
  },
  {
    id: "pt-guia-2",
    autor: "Curso de Personal Trainer 2025",
    titulo: "Guía Nº 2 · MOD 1-3 + Alimentación, Descanso",
    tipo: "pendiente",
    temas: ["curso personal trainer", "mod", "alimentación", "descanso"],
    estado: "pendiente",
  },
  {
    id: "pt-guia-3",
    autor: "Curso de Personal Trainer 2025",
    titulo: "Guía Nº 3 · MOD 1-3",
    tipo: "pendiente",
    temas: ["curso personal trainer", "mod"],
    estado: "pendiente",
  },
  {
    id: "pt-guia-4",
    autor: "Curso de Personal Trainer 2025",
    titulo: "Guía Nº 4 · MOD 1-3",
    tipo: "pendiente",
    temas: ["curso personal trainer", "mod"],
    estado: "pendiente",
  },
  {
    id: "pt-guia-5",
    autor: "Curso de Personal Trainer 2025",
    titulo: "Guía Nº 5 · MOD 1-3",
    tipo: "pendiente",
    temas: ["curso personal trainer", "mod"],
    estado: "pendiente",
  },
  {
    id: "pt-guia-6",
    autor: "Curso de Personal Trainer 2025",
    titulo: "Guía Nº 6 · MOD 1-3",
    tipo: "pendiente",
    temas: ["curso personal trainer", "mod"],
    estado: "pendiente",
  },
  {
    id: "pt-guia-7",
    autor: "Curso de Personal Trainer 2025",
    titulo: "Guía Nº 7 · MOD 1-3",
    tipo: "pendiente",
    temas: ["curso personal trainer", "mod"],
    estado: "pendiente",
  },
  {
    id: "pt-guia-8",
    autor: "Curso de Personal Trainer 2025",
    titulo: "Guía Nº 8 · MOD 1-3",
    tipo: "pendiente",
    temas: ["curso personal trainer", "mod"],
    estado: "pendiente",
  },
];

/** Fuentes por estado: integradas en el criterio de la lógica interna. */
export const FUENTES_INTEGRADAS = FUENTES.filter((f) => f.estado === "integrada");

/** Fuentes pendientes de incorporar contenido (PDF solo-imagen, sin OCR). */
export const FUENTES_PENDIENTES = FUENTES.filter((f) => f.estado === "pendiente");
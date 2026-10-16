import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Módulo de nutrición del alumno.
 *
 * La app del alumno es una sola vista (`/app`) con pestañas (entrenamiento /
 * nutrición). Esta ruta amigable redirige a la pestaña de nutrición para que
 * `/app/nutrition` sea la URL oficial del módulo.
 */
export default function NutritionPage() {
  redirect("/app?tab=nutrition");
}

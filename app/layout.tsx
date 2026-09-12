import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nocito Coach | Planes personalizados de entrenamiento y nutrición",
  description:
    "Rutinas y pauta nutricional personalizadas con seguimiento semanal de Jose Nocito.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
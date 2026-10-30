"use client";

import React, { useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export type ExportClientData = { name?: string | null; email?: string | null };
export type ExportExercise = { name: string; sets: number; reps: number | string; rir: string; note: string };
export type ExportDay = { type: string; subtitle: string; exercises: ExportExercise[] };
export type ExportRoutineData = { week: number; daysCount: number; days: ExportDay[] };

export default function ExportRoutineButton({
  clientData,
  routineData,
}: {
  clientData: ExportClientData;
  routineData: ExportRoutineData;
}) {
  const [loading, setLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!printRef.current) return;
    setLoading(true);

    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: "#0A0A0A",
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.9);

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Rutina_${clientData?.name || "Cliente"}_Nocito_Coach.pdf`);
    } catch (error) {
      console.error("Error:", error);
      alert("Error al generar el PDF.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        className="bg-[#FFC400] text-black font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-all flex items-center gap-2"
      >
        {loading ? "Generando PDF..." : "Exportar PDF"}
      </button>

      <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
        <div
          ref={printRef}
          style={{
            width: "794px",
            height: "1123px",
            backgroundColor: "#0A0A0A",
            color: "#FFFFFF",
            padding: "30px 40px",
            fontFamily: "Helvetica, Arial, sans-serif",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            {/* Cabecera */}
            <div style={{ borderBottom: "1px solid #333", paddingBottom: "10px", marginBottom: "12px" }}>
              <h1 style={{ margin: 0, fontSize: "13pt", color: "#FFC400", fontWeight: "bold", letterSpacing: "2px" }}>NOCITO COACH</h1>
              <h2 style={{ margin: "4px 0 0 0", fontSize: "18pt", textTransform: "uppercase", fontWeight: "800", color: "#FFFFFF" }}>{clientData?.name || "ALUMNO"}</h2>
              <p style={{ margin: "4px 0 0 0", fontSize: "9pt", fontWeight: "bold", color: "#FFC400" }}>
                RUTINA DE ENTRENAMIENTO SEMANA {routineData?.week || 1} ({routineData?.daysCount || 5} DÍAS)
              </p>
            </div>

            {/* Cuadrícula de Días */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {routineData?.days?.map((day: ExportDay, idx: number) => (
                <div key={idx} style={{ backgroundColor: "#161616", border: "1px solid #262626", borderRadius: "4px", padding: "8px 12px" }}>
                  <div style={{ fontSize: "8.5pt", fontWeight: "bold", color: "#FFC400", textTransform: "uppercase", marginBottom: "4px" }}>
                    DÍA {idx + 1} &bull; {day.type || "ENTRENAMIENTO"}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {day.exercises?.map((ex: ExportExercise, i: number) => (
                      <div key={i} style={{ fontSize: "9pt", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: "#E5E5E5", fontWeight: "500" }}>{ex.name}</span>
                        <span style={{ color: "#A0A0A0" }}>{ex.sets}x{ex.reps} | {ex.rir} RIR {ex.note ? `· ${ex.note}` : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Oficial */}
          <div style={{ borderTop: "1px solid #333", paddingTop: "8px" }}>
            <p style={{ margin: 0, fontSize: "7.5pt", color: "#A0A0A0" }}>RIR (repeticiones en reserva): cuántas te quedan antes de no poder más.</p>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "8.5pt", fontWeight: "bold", color: "#FFC400", marginTop: "4px" }}>
              <span>@NOCITO.COACH</span>
              <span>NOCITO-COACH.VERCEL.APP</span>
            </div>
            <p style={{ margin: "6px 0 0 0", fontSize: "7pt", color: "#666", textAlign: "center" }}>nocito.coach nocito-coach.vercel.app Todos los derechos reservados</p>
          </div>
        </div>
      </div>
    </>
  );
}

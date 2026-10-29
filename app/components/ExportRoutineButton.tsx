"use client";

import React, { useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export type ExportClientData = { name?: string | null; email?: string | null };
export type ExportExercise = { name: string; sets: number; reps: number | string; rir: string; note: string };
export type ExportDay = { type: string; subtitle: string; exercises: ExportExercise[] };
export type ExportRoutineData = { week: number; daysCount: number; days: ExportDay[] };

function dayType(name: string): string {
  const n = String(name ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (n.includes("upper") || n.includes("superior")) return "Upper";
  if (n.includes("lower") || n.includes("inferior")) return "Lower";
  if (n.includes("aer") || n.includes("cardio") || n.includes("core")) return "Cardio";
  if (n.includes("full")) return "Full body";
  return name || "Dia";
}

function daySubtitle(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("upper") || t.includes("superior")) return "TREN SUPERIOR";
  if (t.includes("lower") || t.includes("inferior")) return "TREN INFERIOR";
  if (t.includes("cardio") || t.includes("core") || t.includes("aer")) return "CARDIO · CORE";
  return "";
}

export default function ExportRoutineButton({
  clientData,
  routineData,
}: {
  clientData: ExportClientData;
  routineData: ExportRoutineData;
}) {
  const [loading, setLoading] = useState(false);
  const routineRef = useRef<HTMLDivElement>(null);

  const handleDownloadPDF = async () => {
    if (!routineRef.current) return;
    setLoading(true);
    try {
      const canvas = await html2canvas(routineRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#0A0A0A",
      });

      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      if (imgHeight <= pdfHeight) {
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      } else {
        const scale = pdfHeight / imgHeight;
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth * scale, pdfHeight);
      }

      pdf.save(`Rutina_${clientData?.name || "Alumno"}_Nocito_Coach.pdf`);
    } catch (error) {
      console.error("Error generando PDF:", error);
      alert("Hubo un error al generar el PDF.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleDownloadPDF}
        disabled={loading}
        className="bg-[#FFC400] text-black font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-all flex items-center gap-2"
      >
        {loading ? "Generando PDF..." : "Exportar PDF"}
      </button>

      <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
        <div
          ref={routineRef}
          style={{
            width: "794px",
            minHeight: "1123px",
            backgroundColor: "#0A0A0A",
            color: "#FFFFFF",
            padding: "35px",
            fontFamily: "Helvetica, Arial, sans-serif",
            boxSizing: "border-box",
          }}
        >
          <div style={{ borderBottom: "1px solid #333", paddingBottom: "10px", marginBottom: "15px", display: "flex", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "14pt", color: "#FFC400", fontWeight: "bold" }}>NOCITO COACH</h1>
              <h2 style={{ margin: "4px 0 0 0", fontSize: "18pt", textTransform: "uppercase", fontWeight: 800 }}>{clientData?.name || "JULIA SAMPIERI"}</h2>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: "10pt", fontWeight: "bold", color: "#FFC400" }}>RUTINA</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "8pt", color: "#A0A0A0" }}>SEMANA {routineData?.week || 1} - {routineData?.daysCount || 5} DÍAS</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "8pt", color: "#A0A0A0" }}>{new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {routineData?.days?.map((day: ExportDay, index: number) => (
              <div key={index} style={{ backgroundColor: "#161616", border: "1px solid #262626", borderRadius: "4px", padding: "10px" }}>
                <div style={{ fontSize: "8.5pt", fontWeight: "bold", color: "#FFC400", textTransform: "uppercase", marginBottom: "8px", borderBottom: "1px solid #222", paddingBottom: "4px" }}>
                  DÍA {index + 1} &bull; {day.type} &bull; {day.subtitle}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {day.exercises?.map((ex: ExportExercise, i: number) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "9pt" }}>
                      <span style={{ fontWeight: 600, color: "#E5E5E5" }}>{ex.name}</span>
                      <span style={{ color: "#A0A0A0" }}>{ex.sets}&times;{ex.reps} &bull; RIR {ex.rir} &bull; {ex.note}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "20px", borderTop: "1px solid #333", paddingTop: "8px", fontSize: "8pt", color: "#A0A0A0" }}>
            RIR (repeticiones en reserva): cuántas te quedan antes de no poder más.
          </div>
          <div style={{ marginTop: "8px", display: "flex", justifyContent: "space-between", fontSize: "9pt", fontWeight: "bold", color: "#FFC400" }}>
            <span>@NOCITO.COACH</span>
            <span>NOCITO-COACH.VERCEL.APP</span>
          </div>
        </div>
      </div>
    </>
  );
}

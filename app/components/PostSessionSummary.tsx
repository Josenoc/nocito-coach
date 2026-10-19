"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  Dumbbell,
  Mic,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import type { DaySummary, SessionScenario } from "@/app/lib/workout-analytics";
import {
  EASE_OUT,
  modalVariants,
  overlayVariants,
  staggerContainer,
  staggerItem,
} from "@/app/lib/ui/motion";

interface PostSessionSummaryProps {
  open: boolean;
  onClose: () => void;
  studentName: string;
  day: DaySummary;
  scenario: SessionScenario;
  improvedExercise?: { name: string; deltaKg: number } | null;
  discomfort?: { zone: string; exercise: string } | null;
  onSendVoiceNote?: () => void;
}

const SCENARIO_STYLES: Record<
  SessionScenario,
  { hue: string; rgb: string; title: string }
> = {
  success: { hue: "#34d399", rgb: "52,211,153", title: "success" },
  consistency: { hue: "#60a5fa", rgb: "96,165,250", title: "consistency" },
  incomplete: { hue: "#f59e0b", rgb: "245,158,11", title: "incomplete" },
  discomfort: { hue: "#f472b6", rgb: "244,114,182", title: "discomfort" },
};

function useCountUp(target: number, duration = 1.1) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? target : 0);
  useEffect(() => {
    if (reduce) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduce]);
  return value;
}

function MetricCard({
  icon,
  label,
  children,
  rgb,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  rgb: string;
}) {
  return (
    <motion.div
      className="psx-metric"
      variants={staggerItem}
      style={{ "--psx": rgb } as CSSProperties}
    >
      <span className="psx-metric-ic">{icon}</span>
      <div className="psx-metric-body">
        <span className="psx-metric-value">{children}</span>
        <span className="psx-metric-label">{label}</span>
      </div>
    </motion.div>
  );
}

function fmtInt(n: number) {
  return Math.round(n).toLocaleString("es-AR");
}

export default function PostSessionSummary({
  open,
  onClose,
  studentName,
  day,
  scenario,
  improvedExercise,
  discomfort,
  onSendVoiceNote,
}: PostSessionSummaryProps) {
  const style = SCENARIO_STYLES[scenario];
  const name = studentName.split(" ")[0] || studentName;

  const copy = useMemo(() => {
    switch (scenario) {
      case "success": {
        const ex = improvedExercise?.name ?? "tu ejercicio clave";
        const inc = improvedExercise?.deltaKg ?? 2.5;
        return {
          title: `¡Sesión impecable, ${name}!`,
          message: `Superaste tu marca en ${ex}. Vas en excelente camino.`,
          focus: `La próxima sesión intentaremos subir ${inc} kg más en ese movimiento. Descansa bien.`,
        };
      }
      case "incomplete":
        return {
          title: `Buen esfuerzo, ${name}`,
          message: `Completaste ${day.completedCount} de ${day.totalCount} ejercicios. Entiendo que el día fue complicado.`,
          focus:
            "La próxima semana apunta a completar el volumen planificado. La consistencia es clave.",
        };
      case "discomfort":
        return {
          title: `Sesión registrada, ${name}`,
          message: `Noté que reportaste molestias en ${
            discomfort?.zone ?? "una zona"
          }. Es importante escuchar al cuerpo.`,
          focus: `Voy a ajustar la técnica de ${
            discomfort?.exercise ?? "ese ejercicio"
          } la próxima sesión. Si persiste, avisame por WhatsApp.`,
        };
      default:
        return {
          title: `¡Sesión completada, ${name}!`,
          message: "Técnica sólida y volumen cumplido. La base está firme.",
          focus:
            "La próxima semana vamos a aumentar ligeramente la intensidad. Seguí así.",
        };
    }
  }, [scenario, name, improvedExercise, discomfort, day]);

  const volume = useCountUp(day.volume);
  const minutes = useCountUp(day.estMinutes);
  const completed = useCountUp(day.completedCount);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="psx-overlay"
          variants={overlayVariants}
          initial="hidden"
          animate="show"
          exit="exit"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Resumen de tu sesión"
        >
          <motion.div
            className="psx-card"
            variants={modalVariants}
            style={{ "--psx": style.rgb, "--accent": style.hue } as CSSProperties}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="psx-close" onClick={onClose} aria-label="Cerrar">
              <X size={18} />
            </button>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="psx-body"
            >
              <motion.span variants={staggerItem} className="psx-eyebrow">
                <Trophy size={14} /> Resumen del día
              </motion.span>

              <motion.h2 variants={staggerItem} className="psx-title">
                {copy.title}
              </motion.h2>
              <motion.p variants={staggerItem} className="psx-message">
                {copy.message}
              </motion.p>

              <motion.div
                variants={staggerItem}
                className="psx-focus"
                style={{ borderColor: `rgba(${style.rgb},0.35)`, background: `rgba(${style.rgb},0.08)` }}
              >
                <span className="psx-focus-label">Enfoque para la próxima</span>
                <p>{copy.focus}</p>
              </motion.div>

              <motion.div variants={staggerItem} className="psx-metrics">
                <MetricCard
                  icon={<Dumbbell size={18} />}
                  label="Volumen total"
                  rgb={style.rgb}
                >
                  {fmtInt(volume)} kg
                </MetricCard>
                <MetricCard
                  icon={<CheckCircle2 size={18} />}
                  label="Ejercicios"
                  rgb={style.rgb}
                >
                  {Math.round(completed)}/{day.totalCount}
                </MetricCard>
                <MetricCard icon={<Clock size={18} />} label="Tiempo estimado" rgb={style.rgb}>
                  {Math.round(minutes)} min
                </MetricCard>
                <MetricCard icon={<Zap size={18} />} label="RIR promedio" rgb={style.rgb}>
                  {day.rirAvg !== null ? `RIR ${day.rirAvg}` : "—"}
                </MetricCard>
              </motion.div>

              <motion.div variants={staggerItem} className="psx-actions">
                <motion.button
                  className="psx-btn psx-btn-primary"
                  onClick={onClose}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                >
                  Volver al inicio
                </motion.button>
                {onSendVoiceNote && (
                  <motion.button
                    className="psx-btn psx-btn-ghost"
                    onClick={onSendVoiceNote}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.2, ease: EASE_OUT }}
                  >
                    <Mic size={16} /> Enviar nota de voz al Coach
                  </motion.button>
                )}
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

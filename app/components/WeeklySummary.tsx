"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CalendarX2,
  Dumbbell,
  Flame,
  HeartPulse,
  Moon,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import type { MissedReportKind } from "@/app/lib/useWorkoutDetection";
import type { MissedDay, WeekSummary as WeekSummaryData } from "@/app/lib/workout-analytics";
import {
  EASE_OUT,
  modalVariants,
  overlayVariants,
  staggerContainer,
  staggerItem,
} from "@/app/lib/ui/motion";

interface WeeklySummaryProps {
  open: boolean;
  onClose: () => void;
  weekNumber: number;
  studentName: string;
  summary: WeekSummaryData;
  missedDays: MissedDay[];
  onReport: (date: string, kind: MissedReportKind) => void;
  onRetroLoad?: (missed: MissedDay) => void;
  onViewNextWeek?: () => void;
}

const WEEK_MESSAGES: Record<string, string> = {
  carga:
    "Semana de carga completada. La prÃ³xima serÃ¡ de descarga activa para recuperar.",
  descarga: "RecuperaciÃ³n Ã³ptima. La prÃ³xima semana volvemos a empujar fuerte.",
  normal: "ProgresiÃ³n sostenida. Mantenemos el rumbo.",
};

function fmtInt(n: number) {
  return Math.round(n).toLocaleString("es-AR");
}

function RingChart({ completed, total }: { completed: number; total: number }) {
  const reduce = useReducedMotion();
  const pct = total > 0 ? completed / total : 0;
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  return (
    <div className="ws-ring">
      <svg viewBox="0 0 130 130" width="150" height="150" aria-hidden="true">
        <circle
          cx="65"
          cy="65"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="11"
        />
        <motion.circle
          cx="65"
          cy="65"
          r={r}
          fill="none"
          stroke="var(--gold)"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? offset : c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: reduce ? 0 : 1.1, ease: EASE_OUT }}
          transform="rotate(-90 65 65)"
          style={{ filter: "drop-shadow(0 0 8px rgba(255,196,0,0.4))" }}
        />
      </svg>
      <div className="ws-ring-center">
        <span className="ws-ring-num">
          {completed}
          <small>/{total}</small>
        </span>
        <span className="ws-ring-label">dÃ­as completados</span>
      </div>
    </div>
  );
}

export default function WeeklySummary({
  open,
  onClose,
  weekNumber,
  studentName,
  summary,
  missedDays,
  onReport,
  onRetroLoad,
  onViewNextWeek,
}: WeeklySummaryProps) {
  const reduce = useReducedMotion();
  const [reporting, setReporting] = useState<MissedDay | null>(null);
  const name = studentName.split(" ")[0] || studentName;

  const maxDayVolume = useMemo(
    () => Math.max(1, ...summary.days.map((d) => d.volume)),
    [summary.days]
  );

  const delta = summary.volumeDeltaPct;
  const deltaTxt =
    delta === null
      ? "Sin comparaciÃ³n disponible"
      : `${delta >= 0 ? "+" : ""}${delta}% vs semana pasada`;

  const handleKind = (kind: MissedReportKind) => {
    if (!reporting) return;
    if (kind === "injury") {
      const msg = encodeURIComponent(
        "Hola JosÃ©, tuve una molestia/lesiÃ³n y no pude completar un dÃ­a de entrenamiento."
      );
      window.open(`https://wa.me/5492616224718?text=${msg}`, "_blank");
      onReport(reporting.date, kind);
      setReporting(null);
      return;
    }
    if (kind === "trained" && onRetroLoad) {
      onRetroLoad(reporting);
    } else {
      onReport(reporting.date, kind);
    }
    setReporting(null);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="ws-view"
          variants={overlayVariants}
          initial="hidden"
          animate="show"
          exit="exit"
          role="dialog"
          aria-modal="true"
          aria-label={`Resumen de la semana ${weekNumber}`}
        >
          <div className="ws-scroll">
            <div className="ws-inner">
              <div className="ws-topbar">
                <button className="ws-back" onClick={onClose}>
                  <ArrowLeft size={18} /> Volver
                </button>
                <span className="ws-week-badge">Semana {weekNumber}</span>
              </div>

              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="ws-content"
              >
                <motion.h2 variants={staggerItem} className="ws-title">
                  Resumen de la Semana {weekNumber}
                </motion.h2>
                <motion.p variants={staggerItem} className="ws-sub">
                  AsÃ­ fue tu avance, {name}.
                </motion.p>

                <motion.div variants={staggerItem} className="ws-hero">
                  <RingChart completed={summary.daysCompleted} total={summary.totalDays} />
                  <div className="ws-hero-stats">
                    <div className="ws-stat">
                      <span className="ws-stat-ic" style={{ "--c": "245,158,11" } as CSSProperties}>
                        <Dumbbell size={17} />
                      </span>
                      <div>
                        <span className="ws-stat-value">{fmtInt(summary.volume)} kg</span>
                        <span className="ws-stat-label">
                          Volumen semanal
                          {delta !== null && (
                            <em className={delta >= 0 ? "up" : "down"}>
                              <TrendingUp size={12} /> {deltaTxt}
                            </em>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="ws-stat">
                      <span className="ws-stat-ic" style={{ "--c": "96,165,250" } as CSSProperties}>
                        <Zap size={17} />
                      </span>
                      <div>
                        <span className="ws-stat-value">
                          {summary.rirAvg !== null ? `RIR ${summary.rirAvg}` : "â€”"}
                        </span>
                        <span className="ws-stat-label">Intensidad promedio</span>
                      </div>
                    </div>
                    <div className="ws-stat">
                      <span className="ws-stat-ic" style={{ "--c": "52,211,153" } as CSSProperties}>
                        <Trophy size={17} />
                      </span>
                      <div>
                        <span className="ws-stat-value">
                          {summary.mostImproved
                            ? `+${summary.mostImproved.deltaKg} kg`
                            : "â€”"}
                        </span>
                        <span className="ws-stat-label">
                          {summary.mostImproved
                            ? summary.mostImproved.name
                            : "Mayor progreso"}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  variants={staggerItem}
                  className={`ws-coach ws-coach-${summary.weekType}`}
                >
                  <span className="ws-coach-ic">
                    {summary.weekType === "descarga" ? (
                      <Moon size={16} />
                    ) : (
                      <Flame size={16} />
                    )}
                  </span>
                  <div>
                    <span className="ws-coach-label">
                      Mensaje del coach Â·{" "}
                      {summary.weekType === "carga"
                        ? "Semana de carga"
                        : summary.weekType === "descarga"
                        ? "Semana de descarga"
                        : "Semana normal"}
                    </span>
                    <p>{WEEK_MESSAGES[summary.weekType]}</p>
                  </div>
                </motion.div>

                <motion.div variants={staggerItem} className="ws-days">
                  <span className="ws-section-label">Carga por dÃ­a</span>
                  <div className="ws-bars">
                    {summary.days.map((d) => {
                      const h = Math.round((d.volume / maxDayVolume) * 100);
                      return (
                        <div className="ws-bar-col" key={d.routine.id}>
                          <div className="ws-bar-track">
                            <motion.div
                              className={`ws-bar ${d.allCompleted ? "done" : ""}`}
                              initial={{ height: reduce ? `${h}%` : 0 }}
                              animate={{ height: `${h}%` }}
                              transition={{
                                duration: reduce ? 0 : 0.7,
                                ease: EASE_OUT,
                              }}
                            />
                          </div>
                          <span className="ws-bar-label">
                            {(d.routine.day_name || d.routine.name || "")
                              .replace(/^D[Ã­i]a\s*\d+\s*[â€”â€“-]\s*/i, "")
                              .slice(0, 8) || `D${d.routine.position + 1}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>

                {missedDays.length > 0 && (
                  <motion.div variants={staggerItem} className="ws-missed">
                    <span className="ws-section-label">
                      <CalendarX2 size={15} /> DÃ­as no registrados esta semana
                    </span>
                    <div className="ws-missed-list">
                      {missedDays.map((m) => (
                        <div className="ws-missed-item" key={m.date}>
                          <div>
                            <strong>{m.weekday}</strong>
                            <span className="ws-missed-sub">
                              {m.routine.day_name || m.routine.name}
                            </span>
                          </div>
                          <button
                            className="ws-missed-btn"
                            onClick={() => setReporting(m)}
                          >
                            Reportar quÃ© pasÃ³
                          </button>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {onViewNextWeek && (
                  <motion.div variants={staggerItem} className="ws-cta">
                    <motion.button
                      className="psx-btn psx-btn-primary"
                      onClick={onViewNextWeek}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.97 }}
                      transition={{ duration: 0.2, ease: EASE_OUT }}
                    >
                      Ver plan de la prÃ³xima semana <ArrowRight size={16} />
                    </motion.button>
                  </motion.div>
                )}
              </motion.div>
            </div>
          </div>

          {/* Modal "Reportar quÃ© pasÃ³" */}
          <AnimatePresence>
            {reporting && (
              <motion.div
                className="psx-overlay"
                variants={overlayVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                onClick={() => setReporting(null)}
                role="dialog"
                aria-modal="true"
              >
                <motion.div
                  className="report-card"
                  variants={modalVariants}
                  onClick={(e) => e.stopPropagation()}
                  style={{ "--psx": "245,158,11", "--accent": "#f59e0b" } as CSSProperties}
                >
                  <button
                    className="psx-close"
                    onClick={() => setReporting(null)}
                    aria-label="Cerrar"
                  >
                    Ã—
                  </button>
                  <h3 className="report-title">
                    Â¿QuÃ© pasÃ³ el {reporting.weekday.toLowerCase()}?
                  </h3>
                  <p className="report-sub">
                    {reporting.routine.day_name || reporting.routine.name} Â·{" "}
                    {reporting.date}
                  </p>
                  <div className="report-options">
                    <motion.button
                      className="report-opt"
                      onClick={() => handleKind("trained")}
                      whileHover={{ y: -2 }}
                    >
                      <span className="report-opt-ic" style={{ "--c": "52,211,153" } as CSSProperties}>
                        <Zap size={17} />
                      </span>
                      <div>
                        <strong>EntrenÃ© pero no carguÃ©</strong>
                        <span>CargÃ¡ tus series de ese dÃ­a ahora.</span>
                      </div>
                    </motion.button>
                    <motion.button
                      className="report-opt"
                      onClick={() => handleKind("rest")}
                      whileHover={{ y: -2 }}
                    >
                      <span className="report-opt-ic" style={{ "--c": "96,165,250" } as CSSProperties}>
                        <Moon size={17} />
                      </span>
                      <div>
                        <strong>No pude entrenar</strong>
                        <span>MarcÃ¡ el dÃ­a como descanso.</span>
                      </div>
                    </motion.button>
                    <motion.button
                      className="report-opt"
                      onClick={() => handleKind("injury")}
                      whileHover={{ y: -2 }}
                    >
                      <span className="report-opt-ic" style={{ "--c": "244,114,182" } as CSSProperties}>
                        <HeartPulse size={17} />
                      </span>
                      <div>
                        <strong>LesiÃ³n / Molestia</strong>
                        <span>Hablar con JosÃ© por WhatsApp.</span>
                      </div>
                    </motion.button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

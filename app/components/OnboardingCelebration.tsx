"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Flame, HeartPulse, Salad, Sparkles } from "lucide-react";
import { EASE_OUT, staggerContainer, staggerItem } from "@/app/lib/ui/motion";
import { fmt, type MetabolicResult } from "@/app/lib/metabolic";

interface OnboardingCelebrationProps {
  open: boolean;
  name: string;
  metabolic: MetabolicResult;
  onDone: () => void;
}

function useCountUp(target: number, duration = 1.3, started = true) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce || !started ? target : 0);
  useEffect(() => {
    if (reduce || !started) {
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
  }, [target, duration, reduce, started]);
  return value;
}

function StatCard({
  icon,
  label,
  value,
  unit,
  rgb,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit?: string;
  rgb: string;
}) {
  const shown = useCountUp(value);
  return (
    <motion.div className="celebrate-stat" variants={staggerItem} style={{ "--c": rgb } as CSSProperties}>
      <span className="celebrate-stat-ic">{icon}</span>
      <span className="celebrate-stat-value">
        {fmt(shown)}
        {unit && <small>{unit}</small>}
      </span>
      <span className="celebrate-stat-label">{label}</span>
    </motion.div>
  );
}

/**
 * Pantalla de celebración (~4 s) al terminar el onboarding.
 * Confeti con los colores de marca + conteo animado de los datos metabólicos.
 */
export default function OnboardingCelebration({
  open,
  name,
  metabolic,
  onDone,
}: OnboardingCelebrationProps) {
  const reduce = useReducedMotion();
  const firstName = useMemo(() => (name || "").trim().split(/\s+/)[0] || "", [name]);
  const title = `¡Tu perfil está listo${firstName ? `, ${firstName}` : ""}!`;
  const [typed, setTyped] = useState(reduce ? title : "");

  // Confeti (se importa en cliente para no cargarlo en SSR).
  useEffect(() => {
    if (!open || reduce) return;
    let cancelled = false;
    import("canvas-confetti").then((mod) => {
      if (cancelled) return;
      const confetti = ((mod as any).default ?? mod) as typeof import("canvas-confetti");
      const colors = ["#FFC400", "#FFD94A", "#f59e0b", "#ffffff"];
      const burst = (x: number) =>
        confetti({
          particleCount: 90,
          spread: 70,
          startVelocity: 45,
          origin: { x, y: 0.35 },
          colors,
          scalar: 1.05,
          disableForReducedMotion: true,
        });
      burst(0.5);
      window.setTimeout(() => burst(0.28), 220);
      window.setTimeout(() => burst(0.72), 380);
    });
    return () => {
      cancelled = true;
    };
  }, [open, reduce]);

  // Efecto máquina de escribir.
  useEffect(() => {
    if (!open || reduce) {
      setTyped(title);
      return;
    }
    setTyped("");
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTyped(title.slice(0, i));
      if (i >= title.length) window.clearInterval(id);
    }, 60);
    return () => window.clearInterval(id);
  }, [open, title, reduce]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="celebrate-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.4 }}
          role="dialog"
          aria-modal="true"
          aria-label="Perfil listo"
        >
          <div className="celebrate-mesh" aria-hidden="true" />

          {/* Círculo ripple */}
          {!reduce && (
            <motion.span
              className="celebrate-ripple"
              initial={{ scale: 0.2, opacity: 0.5 }}
              animate={{ scale: 2.6, opacity: 0 }}
              transition={{ duration: 1.4, ease: EASE_OUT }}
              aria-hidden="true"
            />
          )}

          <motion.div
            className="celebrate-inner"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            <motion.span
              className="celebrate-check"
              variants={{
                hidden: { scale: 0, rotate: -20 },
                show: {
                  scale: 1,
                  rotate: 0,
                  transition: reduce ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 16 },
                },
              }}
            >
              <svg viewBox="0 0 52 52" width="52" height="52" fill="none" aria-hidden="true">
                <motion.path
                  d="M14 27l8 8 17-19"
                  stroke="#0a0a0a"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: reduce ? 1 : 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: reduce ? 0 : 0.5, ease: EASE_OUT, delay: reduce ? 0 : 0.25 }}
                />
              </svg>
            </motion.span>

            <motion.h1 variants={staggerItem} className="celebrate-title">
              {typed}
              <span className="celebrate-caret" aria-hidden="true">
                {typed.length < title.length ? "|" : ""}
              </span>
            </motion.h1>

            <motion.p variants={staggerItem} className="celebrate-sub">
              Calculamos tus números para que solo te preocupes por entrenar.
            </motion.p>

            <motion.div variants={staggerItem} className="celebrate-stats">
              <StatCard
                icon={<HeartPulse size={18} />}
                label="IMC"
                value={metabolic.bmi}
                rgb="96,165,250"
              />
              <StatCard
                icon={<Flame size={18} />}
                label="TMB (kcal)"
                value={metabolic.bmr}
                rgb="244,114,182"
              />
              <StatCard
                icon={<Flame size={18} />}
                label="Gasto diario (kcal)"
                value={metabolic.tdee}
                rgb="255,196,0"
              />
              <StatCard
                icon={<Salad size={18} />}
                label="Objetivo (kcal)"
                value={metabolic.targetCalories}
                rgb="52,211,153"
              />
            </motion.div>

            <motion.div variants={staggerItem} className="celebrate-macros">
              <span>
                <b>{metabolic.macros.prot} g</b> proteína
              </span>
              <span>
                <b>{metabolic.macros.carbs} g</b> carbos
              </span>
              <span>
                <b>{metabolic.macros.fat} g</b> grasa
              </span>
            </motion.div>

            <motion.p variants={staggerItem} className="celebrate-note">
              <Sparkles size={14} /> {metabolic.headline}
            </motion.p>

            <motion.button
              variants={staggerItem}
              className="celebrate-btn"
              onClick={onDone}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
            >
              Ver mi plan
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { EASE_OUT } from "@/app/lib/ui/motion";

interface WelcomeScreenProps {
  open: boolean;
  name: string;
  /** Texto opcional bajo el saludo. */
  subtitle?: string;
  /** ms antes de auto-cerrar (0 = requiere acción manual). */
  autoMs?: number;
  onDone: () => void;
}

/**
 * Pantalla de bienvenida cinematográfica (~3 s).
 *
 * 1. Fondo mesh que se desplaza lentamente.
 * 2. Logo SVG que se "dibuja" (stroke-dashoffset animado).
 * 3. Saludo con efecto máquina de escribir: "Bienvenido, [Nombre]".
 * 4. Bajada: "Vamos a construir tu mejor versión".
 *
 * Respeta `prefers-reduced-motion`: se muestra todo de golpe, sin animación.
 */
export default function WelcomeScreen({
  open,
  name,
  subtitle = "Vamos a construir tu mejor versión",
  autoMs = 3200,
  onDone,
}: WelcomeScreenProps) {
  const reduce = useReducedMotion();
  const firstName = useMemo(() => (name || "").trim().split(/\s+/)[0] || "", [name]);
  const greeting = firstName ? `Bienvenido, ${firstName}` : "Bienvenido";
  const [typed, setTyped] = useState(reduce ? greeting : "");

  // Efecto máquina de escribir.
  useEffect(() => {
    if (!open || reduce) {
      setTyped(greeting);
      return;
    }
    setTyped("");
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTyped(greeting.slice(0, i));
      if (i >= greeting.length) window.clearInterval(id);
    }, 55);
    return () => window.clearInterval(id);
  }, [open, greeting, reduce]);

  // Auto-cierre.
  useEffect(() => {
    if (!open || !autoMs) return;
    const t = window.setTimeout(onDone, reduce ? Math.min(autoMs, 1200) : autoMs);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoMs, reduce]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="welcome-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.03 }}
          transition={{ duration: reduce ? 0 : 0.5, ease: EASE_OUT }}
          role="dialog"
          aria-modal="true"
          aria-label="Bienvenida"
          onClick={onDone}
        >
          <div className="welcome-mesh" aria-hidden="true" />

          <motion.div
            className="welcome-inner"
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: reduce ? 0 : 0.12, delayChildren: 0.15 } },
            }}
          >
            <motion.div
              className="welcome-logo"
              variants={{
                hidden: { opacity: 0, scale: 0.9 },
                show: {
                  opacity: 1,
                  scale: 1,
                  transition: { duration: reduce ? 0 : 0.7, ease: EASE_OUT },
                },
              }}
            >
              <svg viewBox="0 0 96 96" width="96" height="96" fill="none" aria-hidden="true">
                <motion.circle
                  cx="48"
                  cy="48"
                  r="42"
                  stroke="url(#wg)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  initial={{ pathLength: reduce ? 1 : 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: reduce ? 0 : 1.4, ease: EASE_OUT, delay: 0.1 }}
                />
                <motion.path
                  d="M30 66V30l36 36V30"
                  stroke="url(#wg)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: reduce ? 1 : 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: reduce ? 0 : 1.2, ease: EASE_OUT, delay: 0.35 }}
                />
                <defs>
                  <linearGradient id="wg" x1="0" y1="0" x2="96" y2="96">
                    <stop stopColor="var(--orange-soft, #FFD94A)" />
                    <stop offset="1" stopColor="var(--amber, #f59e0b)" />
                  </linearGradient>
                </defs>
              </svg>
            </motion.div>

            <motion.h1
              className="welcome-title"
              variants={{
                hidden: { opacity: 0, y: 18 },
                show: { opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.6, ease: EASE_OUT } },
              }}
            >
              {typed}
              <span className="welcome-caret" aria-hidden="true">
                {typed.length < greeting.length ? "|" : ""}
              </span>
            </motion.h1>

            <motion.p
              className="welcome-sub"
              variants={{
                hidden: { opacity: 0, y: 14 },
                show: { opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.6, ease: EASE_OUT } },
              }}
            >
              {subtitle}
            </motion.p>

            <motion.button
              type="button"
              className="welcome-skip"
              onClick={(e) => {
                e.stopPropagation();
                onDone();
              }}
              variants={{
                hidden: { opacity: 0 },
                show: { opacity: 1, transition: { delay: reduce ? 0 : 1.6, duration: 0.4 } },
              }}
            >
              Empezar <ChevronRight size={16} />
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

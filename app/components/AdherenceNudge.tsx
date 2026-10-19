"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Moon, X, Zap } from "lucide-react";
import { EASE_OUT, nudgeVariants } from "@/app/lib/ui/motion";

const AUTO_MS = 8000;

interface AdherenceNudgeProps {
  open: boolean;
  studentName: string;
  weekday?: string;
  onDismiss: () => void;
  onTrained: () => void;
  onRest: () => void;
}

export default function AdherenceNudge({
  open,
  studentName,
  weekday,
  onDismiss,
  onTrained,
  onRest,
}: AdherenceNudgeProps) {
  const name = studentName.split(" ")[0] || studentName;

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onDismiss, AUTO_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="nudge-wrap"
          variants={nudgeVariants}
          initial="hidden"
          animate="show"
          exit="exit"
          role="status"
          aria-live="polite"
        >
          <div className="nudge-card">
            <button className="nudge-close" onClick={onDismiss} aria-label="Ignorar aviso">
              <X size={16} />
            </button>
            <span className="nudge-ic">
              <MessageCircle size={18} />
            </span>
            <div className="nudge-body">
              <strong className="nudge-title">Hey {name}, ¿todo bien?</strong>
              <p className="nudge-text">
                Noté que {weekday ? `el ${weekday.toLowerCase()}` : "ayer"} no registraste tu
                sesión. Si entrenaste pero no alcanzaste a cargar, podés hacerlo ahora. Si no
                pudiste, no te preocupes: descansá y retomamos cuando puedas.
              </p>
              <div className="nudge-actions">
                <motion.button
                  className="nudge-btn nudge-btn-primary"
                  onClick={onTrained}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                >
                  <Zap size={14} /> Entrené pero no cargué
                </motion.button>
                <motion.button
                  className="nudge-btn nudge-btn-ghost"
                  onClick={onRest}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                >
                  <Moon size={14} /> No pude entrenar
                </motion.button>
                <button className="nudge-btn nudge-btn-text" onClick={onDismiss}>
                  Ignorar
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

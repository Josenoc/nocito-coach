"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HeartPulse, X } from "lucide-react";
import {
  EASE_OUT,
  modalVariants,
  overlayVariants,
} from "@/app/lib/ui/motion";

const ZONES = [
  "Hombro",
  "Espalda baja",
  "Rodilla",
  "Codo",
  "Cadera",
  "Cuello",
  "Tobillo",
  "Muñeca",
];

interface DiscomfortReporterProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (zones: string[]) => void;
}

export default function DiscomfortReporter({
  open,
  onClose,
  onSubmit,
}: DiscomfortReporterProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (z: string) =>
    setSelected((prev) => (prev.includes(z) ? prev.filter((x) => x !== z) : [...prev, z]));

  const confirm = () => {
    onSubmit(selected.length ? selected : ["general"]);
    setSelected([]);
    onClose();
  };

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
          aria-label="Reportar molestias"
        >
          <motion.div
            className="report-card"
            variants={modalVariants}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="psx-close" onClick={onClose} aria-label="Cerrar">
              <X size={18} />
            </button>
            <span className="vn-eyebrow">
              <HeartPulse size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
              Escuchar al cuerpo
            </span>
            <h3 className="report-title" style={{ marginTop: 8 }}>
              ¿Sentiste alguna molestia hoy?
            </h3>
            <p className="report-sub">
              Marcá las zonas para que José ajuste tu próxima sesión. Es parte del proceso.
            </p>
            <div className="zone-grid">
              {ZONES.map((z) => (
                <button
                  key={z}
                  className={`zone-chip ${selected.includes(z) ? "on" : ""}`}
                  onClick={() => toggle(z)}
                >
                  {z}
                </button>
              ))}
            </div>
            <div className="psx-actions" style={{ marginTop: 18 }}>
              <motion.button
                className="psx-btn psx-btn-primary"
                onClick={confirm}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
              >
                Guardar y finalizar
              </motion.button>
              <button className="psx-btn psx-btn-ghost" onClick={onClose}>
                Ahora no
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

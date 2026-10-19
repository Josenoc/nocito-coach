"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, RotateCcw, Send, Square, X } from "lucide-react";
import {
  EASE_OUT,
  modalVariants,
  overlayVariants,
} from "@/app/lib/ui/motion";

const WHATSAPP_NUMBER = "5492616224718";

interface VoiceNoteRecorderProps {
  open: boolean;
  onClose: () => void;
  onSent?: () => void;
}

function fmtTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function VoiceNoteRecorder({ open, onClose, onSent }: VoiceNoteRecorderProps) {
  const [phase, setPhase] = useState<"idle" | "recording" | "preview" | "sending">("idle");
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    if (!open) {
      cleanupStream();
      setPhase("idle");
      setSeconds(0);
      setBlob(null);
      setError(null);
      setPreviewUrl((u) => {
        if (u) URL.revokeObjectURL(u);
        return null;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    return () => {
      cleanupStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = () => {
        const b = new Blob(chunksRef.current, { type: "audio/webm" });
        setBlob(b);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(b);
        });
        setPhase("preview");
        cleanupStream();
      };
      mediaRef.current = mr;
      mr.start();
      setSeconds(0);
      setPhase("recording");
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("No pudimos acceder al micrófono. Revisá los permisos del navegador.");
    }
  };

  const stop = () => {
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stop();
    }
  };

  const reset = () => {
    setBlob(null);
    setPhase("idle");
    setSeconds(0);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const send = async () => {
    if (!blob) return;
    setPhase("sending");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("audio", blob, "nota.webm");
      const res = await fetch("/api/app/coach-note", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "No se pudo enviar la nota.");
      onSent?.();
      onClose();
    } catch (err: any) {
      // Fallback: abrir WhatsApp con un mensaje para que el alumno adjunte la nota.
      setError(
        (err?.message || "No se pudo enviar la nota.") +
          " Podés avisarle por WhatsApp."
      );
      setPhase("preview");
      const msg = encodeURIComponent(
        "Hola José, terminé mi sesión y quiero dejarte una nota de voz."
      );
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="vn-overlay"
          variants={overlayVariants}
          initial="hidden"
          animate="show"
          exit="exit"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Enviar nota de voz al coach"
        >
          <motion.div
            className="vn-card"
            variants={modalVariants}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="psx-close" onClick={onClose} aria-label="Cerrar">
              <X size={18} />
            </button>

            <span className="vn-eyebrow">Nota de voz</span>
            <h3 className="vn-title">Contale a José cómo te fue</h3>
            <p className="vn-sub">
              Grabá un mensaje corto: sensaciones, molestias o cómo te sentiste hoy.
            </p>

            <div className="vn-stage">
              {phase === "recording" ? (
                <>
                  <span className="wave vn-wave" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="vn-timer">{fmtTime(seconds)}</span>
                  <span className="vn-hint">Grabando…</span>
                </>
              ) : phase === "preview" && previewUrl ? (
                <>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio className="vn-audio" src={previewUrl} controls />
                  <span className="vn-hint">Escuchá tu nota antes de enviarla.</span>
                </>
              ) : (
                <>
                  <span className="vn-mic">
                    <Mic size={30} />
                  </span>
                  <span className="vn-hint">Tocá para empezar a grabar.</span>
                </>
              )}
            </div>

            {error && <div className="vn-error">{error}</div>}

            <div className="vn-actions">
              {phase === "idle" && (
                <motion.button
                  className="psx-btn psx-btn-primary"
                  onClick={start}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                >
                  <Mic size={16} /> Grabar nota
                </motion.button>
              )}
              {phase === "recording" && (
                <motion.button
                  className="psx-btn psx-btn-danger"
                  onClick={stop}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                >
                  <Square size={15} /> Detener
                </motion.button>
              )}
              {phase === "preview" && (
                <>
                  <motion.button
                    className="psx-btn psx-btn-ghost"
                    onClick={reset}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.2, ease: EASE_OUT }}
                  >
                    <RotateCcw size={15} /> Grabar de nuevo
                  </motion.button>
                  <motion.button
                    className="psx-btn psx-btn-primary"
                    onClick={send}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.2, ease: EASE_OUT }}
                  >
                    <Send size={15} /> Enviar al Coach
                  </motion.button>
                </>
              )}
              {phase === "sending" && <span className="vn-hint">Enviando…</span>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

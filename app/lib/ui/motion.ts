import type { Transition, Variants } from "framer-motion";

/**
 * Sistema de movimiento premium (estilo Whoop / Apple Fitness / Future).
 * Todas las curvas son suaves y elegantes — nunca bruscas ni exageradas.
 *
 * Importá estos helpers en cualquier componente para mantener una firma de
 * animación coherente en toda la Web App.
 */

/** Curva principal: arranque rápido, frenada muy suave. */
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
/** Curva suave simétrica (para transiciones de estado). */
export const EASE_SOFT: [number, number, number, number] = [0.4, 0, 0.2, 1];

export const spring = {
  type: "spring",
  stiffness: 260,
  damping: 26,
  mass: 0.9,
} as const;

/** Fade + slide-up (entrada base de secciones y tarjetas). */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE_OUT },
  },
};

/** Contenedor con hijos escalonados. */
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

/** Ítem dentro de un contenedor escalonado. */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

/** Modal: overlay + tarjeta (scale 0.95 → 1). */
export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.25, ease: EASE_SOFT } },
  exit: { opacity: 0, transition: { duration: 0.2, ease: EASE_SOFT } },
};

export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 12 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.3, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 8,
    transition: { duration: 0.2, ease: EASE_SOFT },
  },
};

/** Toast / banner: slide-down desde arriba. */
export const nudgeVariants: Variants = {
  hidden: { opacity: 0, y: -28, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    y: -20,
    scale: 0.98,
    transition: { duration: 0.25, ease: EASE_SOFT },
  },
};

/** Micro-interacción de botones (hover scale 1.05 + glow lo pone el CSS). */
export const tapScale = { whileTap: { scale: 0.97 } };
export const hoverLift = { whileHover: { scale: 1.05 } };

export const listTransition: Transition = {
  duration: 0.5,
  ease: EASE_OUT,
};

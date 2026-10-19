"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Routine, SetLog } from "@/lib/app-types";
import {
  buildDaySummary,
  buildWeekSummary,
  detectMissedDays,
  shouldShowNudge,
  type DaySummary,
  type MissedDay,
  type NudgeDecision,
  type WeekSummary,
} from "./workout-analytics";

/* ------------------------------------------------------------------ */
/* Persistencia ligera (localStorage) de adherencia                    */
/* ------------------------------------------------------------------ */

export type MissedReportKind = "trained" | "rest" | "injury";

export interface AdherenceState {
  /** Lunes de la semana en la que se contó `nudges`. */
  weekStart: string;
  /** Cantidad de nudges mostrados esta semana (límite 2). */
  nudges: number;
  /** Fechas (ISO) cuyo nudge fue descartado/respondido. */
  dismissed: string[];
  /** Fechas reportadas como descanso. */
  rest: string[];
  /** Reportes de días perdidos. */
  reports: Record<string, MissedReportKind>;
  /** Molestias reportadas: fecha -> zonas. */
  discomfort: Record<string, string[]>;
}

const EMPTY: AdherenceState = {
  weekStart: "",
  nudges: 0,
  dismissed: [],
  rest: [],
  reports: {},
  discomfort: {},
};

function key(clientId: string) {
  return `nc_adherence:${clientId}`;
}

function load(clientId: string): AdherenceState {
  if (typeof window === "undefined") return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(key(clientId));
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<AdherenceState>) };
  } catch {
    return { ...EMPTY };
  }
}

function save(clientId: string, state: AdherenceState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(clientId), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function weekStartOf(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return "";
  const off = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - off);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Hook                                                               */
/* ------------------------------------------------------------------ */

export interface UseWorkoutDetectionArgs {
  clientId?: string | null;
  routines: Routine[];
  logs: SetLog[];
  week: number;
  today: string;
  trainingDays: number;
  guideline?: string;
}

export interface WorkoutDetection {
  weekRoutines: Routine[];
  prevWeekRoutines: Routine[];
  weekSummary: WeekSummary;
  isWeekCompleted: boolean;
  missedDays: MissedDay[];
  nudge: NudgeDecision;
  discomfortZones: string[];
  daySummary: (routine: Routine) => DaySummary;
  markNudgeShown: () => void;
  dismissNudge: (missedDate: string) => void;
  reportMissedDay: (date: string, kind: MissedReportKind) => void;
  isRestDay: (date: string) => boolean;
  reportDiscomfort: (date: string, zones: string[]) => void;
}

export function useWorkoutDetection(args: UseWorkoutDetectionArgs): WorkoutDetection {
  const { clientId, routines, logs, week, today, trainingDays, guideline } = args;

  const [state, setState] = useState<AdherenceState>({ ...EMPTY });

  useEffect(() => {
    if (!clientId || !today) return;
    const loaded = load(clientId);
    const ws = weekStartOf(today);
    if (loaded.weekStart !== ws) {
      // Nueva semana: reseteamos el contador de nudges.
      const reset = { ...loaded, weekStart: ws, nudges: 0 };
      save(clientId, reset);
      setState(reset);
    } else {
      setState(loaded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, today]);

  const persist = useCallback(
    (updater: (prev: AdherenceState) => AdherenceState) => {
      setState((prev) => {
        const next = updater(prev);
        if (clientId) save(clientId, next);
        return next;
      });
    },
    [clientId]
  );

  const weekRoutines = useMemo(
    () =>
      routines
        .filter((r) => (r.week_number || 1) === week)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [routines, week]
  );

  const prevWeekRoutines = useMemo(
    () =>
      routines
        .filter((r) => (r.week_number || 1) === week - 1)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [routines, week]
  );

  const weekSummary = useMemo(
    () =>
      buildWeekSummary(weekRoutines, logs, {
        weekNumber: week,
        prevRoutines: prevWeekRoutines,
        guideline,
      }),
    [weekRoutines, prevWeekRoutines, logs, week, guideline]
  );

  const missedDays = useMemo(() => {
    const all = detectMissedDays(weekRoutines, logs, trainingDays, today);
    return all.filter(
      (m) => !state.rest.includes(m.date) && !state.reports[m.date]
    );
  }, [weekRoutines, logs, trainingDays, today, state.rest, state.reports]);

  const nudge = useMemo(
    () =>
      shouldShowNudge({
        logs,
        todayISO: today,
        trainingDays,
        dismissedDates: state.dismissed,
        nudgesThisWeek: state.nudges,
      }),
    [logs, today, trainingDays, state.dismissed, state.nudges]
  );

  const daySummary = useCallback(
    (routine: Routine) => buildDaySummary(routine, logs),
    [logs]
  );

  const markNudgeShown = useCallback(() => {
    persist((prev) => ({ ...prev, nudges: Math.min(2, prev.nudges + 1) }));
  }, [persist]);

  const dismissNudge = useCallback(
    (missedDate: string) => {
      persist((prev) => ({
        ...prev,
        dismissed: prev.dismissed.includes(missedDate)
          ? prev.dismissed
          : [...prev.dismissed, missedDate],
      }));
    },
    [persist]
  );

  const reportMissedDay = useCallback(
    (date: string, kind: MissedReportKind) => {
      persist((prev) => ({
        ...prev,
        reports: { ...prev.reports, [date]: kind },
        rest: kind === "rest" && !prev.rest.includes(date) ? [...prev.rest, date] : prev.rest,
        dismissed: prev.dismissed.includes(date)
          ? prev.dismissed
          : [...prev.dismissed, date],
      }));
    },
    [persist]
  );

  const isRestDay = useCallback(
    (date: string) => state.rest.includes(date),
    [state.rest]
  );

  const reportDiscomfort = useCallback(
    (date: string, zones: string[]) => {
      persist((prev) => ({
        ...prev,
        discomfort: { ...prev.discomfort, [date]: zones },
      }));
    },
    [persist]
  );

  const discomfortZones = state.discomfort[today] ?? [];

  return {
    weekRoutines,
    prevWeekRoutines,
    weekSummary,
    isWeekCompleted: weekSummary.allCompleted,
    missedDays,
    nudge,
    discomfortZones,
    daySummary,
    markNudgeShown,
    dismissNudge,
    reportMissedDay,
    isRestDay,
    reportDiscomfort,
  };
}

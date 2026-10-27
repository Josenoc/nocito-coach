"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildCoachProgress,
  type ProgressDay,
  type ProgressExercise,
  type ProgressWeek,
} from "@/app/lib/workout-progress";

interface CoachProgressMirrorProps {
  detail: any;
  clientName: string;
  onRefresh: () => Promise<void> | void;
}

const fmtDate = (iso: string | null): string => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

const STATUS_LABEL: Record<ProgressExercise["status"], string> = {
  none: "Sin registro",
  logged: "OK",
  stalled: "Estancado",
  below: "Bajo objetivo",
};

function fmtWeight(n: number | null): string {
  if (n === null) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function StatusBadge({ status }: { status: ProgressExercise["status"] }) {
  const cls =
    status === "below"
      ? "prog-badge below"
      : status === "stalled"
      ? "prog-badge stalled"
      : status === "logged"
      ? "prog-badge ok"
      : "prog-badge none";
  return <span className={cls}>{STATUS_LABEL[status]}</span>;
}

function DeltaChip({ ex }: { ex: ProgressExercise }) {
  if (ex.weightDelta === null) return null;
  const positive = ex.weightDelta > 0;
  const flat = ex.weightDelta === 0;
  return (
    <span
      className={`prog-delta ${positive ? "up" : flat ? "flat" : "down"}`}
      title="Diferencia vs semana anterior"
    >
      {positive ? "▲" : flat ? "=" : "▼"} {positive ? "+" : ""}
      {ex.weightDelta} {ex.unit}
    </span>
  );
}

function EditableExerciseRow({
  ex,
  onSave,
}: {
  ex: ProgressExercise;
  onSave: (patch: {
    target_sets: number | null;
    target_reps: number | null;
    target_weight: number | null;
  }) => Promise<void>;
}) {
  const [sets, setSets] = useState(
    ex.targetSets != null ? String(ex.targetSets) : ""
  );
  const [reps, setReps] = useState(
    ex.targetReps != null ? String(ex.targetReps) : ""
  );
  const [weight, setWeight] = useState(
    ex.targetWeight != null ? String(ex.targetWeight) : ""
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const focusedRef = useRef(false);
  const latestRef = useRef({ sets, reps, weight });
  latestRef.current = { sets, reps, weight };
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sincroniza cuando cambian los valores del servidor, si no estoy editando.
  useEffect(() => {
    if (focusedRef.current) return;
    setSets(ex.targetSets != null ? String(ex.targetSets) : "");
    setReps(ex.targetReps != null ? String(ex.targetReps) : "");
    setWeight(ex.targetWeight != null ? String(ex.targetWeight) : "");
  }, [ex.targetSets, ex.targetReps, ex.targetWeight]);

  const doSave = async (vals: { sets: string; reps: string; weight: string }) => {
    setSaving(true);
    setError(null);
    try {
      await onSave({
        target_sets: vals.sets === "" ? null : Number(vals.sets),
        target_reps: vals.reps === "" ? null : Number(vals.reps),
        target_weight: vals.weight === "" ? null : Number(vals.weight),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    } catch (e: any) {
      setError(e?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const scheduleSave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSave(latestRef.current), 600);
  };

  const flushSave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    void doSave(latestRef.current);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className={`mirror-row status-${ex.status}`}>
      <div className="mirror-row-head">
        <strong>{ex.name}</strong>
        <DeltaChip ex={ex} />
        <StatusBadge status={ex.status} />
      </div>

      <div className="mirror-row-targets">
        <label>
          Series
          <input
            inputMode="numeric"
            value={sets}
            onFocus={() => (focusedRef.current = true)}
            onBlur={() => {
              focusedRef.current = false;
              flushSave();
            }}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d]/g, "");
              setSets(v);
              scheduleSave();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                flushSave();
              }
            }}
          />
        </label>
        <span className="mirror-sep">×</span>
        <label>
          Reps
          <input
            inputMode="numeric"
            value={reps}
            onFocus={() => (focusedRef.current = true)}
            onBlur={() => {
              focusedRef.current = false;
              flushSave();
            }}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d]/g, "");
              setReps(v);
              scheduleSave();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                flushSave();
              }
            }}
          />
        </label>
        <span className="mirror-sep">·</span>
        <label>
          Peso
          <input
            inputMode="decimal"
            value={weight}
            onFocus={() => (focusedRef.current = true)}
            onBlur={() => {
              focusedRef.current = false;
              flushSave();
            }}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d.,]/g, "");
              setWeight(v);
              scheduleSave();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                flushSave();
              }
            }}
          />
          <span className="mirror-unit">{ex.unit}</span>
        </label>
        <span className="mirror-saving">
          {saving ? "Guardando…" : saved ? "✓ Guardado" : error ? `⚠ ${error}` : ""}
        </span>
      </div>

      <div className="mirror-row-meta">
        Real: {ex.loggedSets}/{ex.totalSets} series · vol {ex.totalVolume} {ex.unit} · mejor{" "}
        {fmtWeight(ex.bestWeight)} {ex.unit} · último {fmtDate(ex.lastDate)}
      </div>

      {ex.suggestion && <p className="mirror-suggestion">{ex.suggestion}</p>}

      {ex.audio.length > 0 && (
        <div className="mirror-audio">
          <span className="mirror-audio-label">Notas de voz del ejercicio</span>
          {ex.audio.map((a) => (
            <div className="row-between" key={a.id}>
              <span className="muted" style={{ fontSize: ".82rem" }}>
                {new Date(a.created_at).toLocaleString("es-AR")}
              </span>
              <audio src={a.audio_storage_url} controls preload="none" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DayView({
  day,
  onSave,
}: {
  day: ProgressDay;
  onSave: (exerciseId: string, patch: {
    target_sets: number | null;
    target_reps: number | null;
    target_weight: number | null;
  }) => Promise<void>;
}) {
  if (!day) return null;
  return (
    <div className="mirror-day">
      <div className="mirror-day-head">
        <strong>{day.dayName}</strong>
        <span className="muted" style={{ fontSize: ".85rem" }}>
          {day.loggedSets}/{day.totalSets} series · último registro {fmtDate(day.lastDate)}
        </span>
      </div>
      {day.exercises.length === 0 && (
        <p className="muted" style={{ margin: 0 }}>
          Este día no tiene ejercicios cargados.
        </p>
      )}
      <div className="mirror-compact">
        {day.exercises.map((ex) => (
          <EditableExerciseRow
            key={ex.key}
            ex={ex}
            onSave={(patch) => onSave(ex.exerciseId, patch)}
          />
        ))}
      </div>
    </div>
  );
}

export default function CoachProgressMirror({
  detail,
  clientName,
  onRefresh,
}: CoachProgressMirrorProps) {
  const [weekNum, setWeekNum] = useState<number | null>(null);
  const [dayId, setDayId] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<number>(() => Date.now());

  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  const routines = detail?.routines ?? [];
  const logs = detail?.logs ?? [];
  const audio = detail?.audio ?? [];

  const saveExercise = async (
    exerciseId: string,
    patch: { target_sets: number | null; target_reps: number | null; target_weight: number | null }
  ) => {
    const res = await fetch("/api/coach/exercise", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exercise_id: exerciseId, ...patch }),
    });
    const json = await res.json().catch(() => ({ ok: false, error: "Error" }));
    if (!json.ok) throw new Error(json.error || "No se pudo guardar");
    await onRefresh();
  };

  const weeks = useMemo(
    () =>
      buildCoachProgress({
        routines,
        logs,
        audio,
        setRir: detail?.profile?.anamnesis?.setRir ?? {},
        totalWeeks: detail?.profile?.anamnesis?.trainingBlock?.weeks ?? 6,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [detail]
  );

  useEffect(() => setLastSync(Date.now()), [detail]);

  const runRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshRef.current();
    } finally {
      setRefreshing(false);
      setLastSync(Date.now());
    }
  };

  // Sincronización en vivo: refleja lo que el alumno registra en su app.
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      refreshRef.current();
    }, 20000);
    return () => clearInterval(id);
  }, [live]);

  const activeWeek: ProgressWeek | undefined =
    weeks.find((w) => w.week === weekNum) ??
    weeks.find((w) => w.status === "active") ??
    weeks[weeks.length - 1];

  const activeDay: ProgressDay | undefined =
    activeWeek?.days.find((d) => d.routineId === dayId) ?? activeWeek?.days[0];

  const totalAlerts = weeks.reduce((acc, w) => acc + w.alerts, 0);
  const lastActivity = weeks.reduce<string | null>(
    (acc, w) => (w.lastActivity && (!acc || w.lastActivity > acc) ? w.lastActivity : acc),
    null
  );
  const generalAudio = audio.filter((a: any) => !a.exercise_id);

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="row-between" style={{ marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h3 style={{ margin: 0 }}>Espejo de entrenamiento</h3>
          <span className="muted" style={{ fontSize: ".85rem" }}>
            Todo lo que registra {clientName} en su app, semana por semana · último{" "}
            {fmtDate(lastActivity)}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <label className="mirror-live">
            <input
              type="checkbox"
              checked={live}
              onChange={(e) => setLive(e.target.checked)}
            />
            En vivo
          </label>
          <button className="btn btn-outline" onClick={runRefresh} disabled={refreshing}>
            {refreshing ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </div>

      <div className="mirror-summary">
        <span className="mirror-stat">
          <b>{weeks.filter((w) => w.status === "done").length}</b> semanas completas
        </span>
        <span className="mirror-stat">
          <b>{totalAlerts}</b> alertas de progreso
        </span>
        <span className="mirror-stat">
          <b>{fmtDate(lastActivity)}</b> última actividad
        </span>
        {totalAlerts > 0 && (
          <span className="mirror-alert-hint">
            Revisá los ejercicios marcados para ajustar el próximo bloque.
          </span>
        )}
      </div>

      <div className="mirror-weeks">
        {weeks.map((w) => (
          <button
            key={w.week}
            className={[
              "week-pill",
              w.status,
              w.week === activeWeek?.week ? "current" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => {
              setWeekNum(w.week);
              setDayId(null);
            }}
            title={`Semana ${w.week}`}
          >
            <span className="week-pill-top">
              {w.status === "done" ? "✓" : `Sem ${w.week}`}
            </span>
            <span className="week-pill-sub">
              {w.totalDays === 0
                ? "—"
                : `${w.completedDays}/${w.totalDays} días`}
            </span>
            {w.alerts > 0 && <span className="week-pill-alert">{w.alerts}</span>}
          </button>
        ))}
      </div>

      {activeWeek && activeWeek.days.length > 0 ? (
        <>
          <div className="day-tabs" style={{ marginTop: 14 }}>
            {activeWeek.days.map((d) => (
              <button
                key={d.routineId}
                className={`chip ${d.routineId === activeDay?.routineId ? "active" : ""}`}
                onClick={() => setDayId(d.routineId)}
              >
                {d.dayName || `Día ${d.position + 1}`}
                {d.completed ? " ✓" : ""}
              </button>
            ))}
          </div>
          <DayView day={activeDay as ProgressDay} onSave={saveExercise} />
        </>
      ) : (
        <p className="muted" style={{ margin: "14px 0 0" }}>
          Esta semana todavía no tiene rutina cargada.
        </p>
      )}

      {generalAudio.length > 0 && (
        <div className="mirror-general-audio">
          <h4 style={{ margin: "22px 0 8px" }}>Notas de voz generales</h4>
          {generalAudio.map((a: any) => (
            <div className="row-between" key={a.id}>
              <span className="muted" style={{ fontSize: ".85rem" }}>
                {new Date(a.created_at).toLocaleString("es-AR")}
              </span>
              <audio src={a.audio_storage_url} controls preload="none" />
            </div>
          ))}
        </div>
      )}

      <details className="mirror-raw">
        <summary>Historial completo (tabla)</summary>
        <div className="scroll-x" style={{ marginTop: 12 }}>
          <table className="data-table" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Ejercicio</th>
                <th>Serie</th>
                <th>Reps</th>
                <th>Peso</th>
                <th>Objetivo</th>
              </tr>
            </thead>
            <tbody>
              {(logs ?? []).map((l: any) => (
                <tr key={l.id}>
                  <td>{l.log_date}</td>
                  <td>{l.exercises?.name ?? "-"}</td>
                  <td>{l.set_number}</td>
                  <td>{l.actual_reps ?? "-"}</td>
                  <td>{l.actual_weight ?? "-"}</td>
                  <td className="muted">
                    {l.target_reps ?? "-"} × {l.target_weight ?? "-"}
                  </td>
                </tr>
              ))}
              {(logs ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    Sin registros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

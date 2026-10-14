"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Exercise, Profile, Routine, SetLog } from "@/lib/app-types";

type SetRow = {
  set_number: number;
  actual_reps: string;
  actual_weight: string;
  saved?: boolean;
};

function embedUrl(url?: string | null): { kind: "iframe" | "video" | "none"; src: string } {
  if (!url) return { kind: "none", src: "" };
  const yt = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/
  );
  if (yt) return { kind: "iframe", src: `https://www.youtube.com/embed/${yt[1]}` };
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) return { kind: "video", src: url };
  return { kind: "iframe", src: url };
}

export default function ClientApp() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, SetRow[]>>({});
  const [loadingData, setLoadingData] = useState(false);

  const [recordingFor, setRecordingFor] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const [audioMsg, setAudioMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && j.profile) {
          if (j.profile.role === "coach") {
            router.replace("/entrenador");
            return;
          }
          setProfile(j.profile);
          loadRoutine();
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const loadRoutine = async () => {
    setLoadingData(true);
    try {
      const res = await fetch("/api/app/routine");
      const json = await res.json();
      if (!json.ok) return;
      const rl: Routine[] = json.routines ?? [];
      const logs: SetLog[] = json.logs ?? [];
      setRoutines(rl);
      setActiveDay((prev) => prev ?? rl[0]?.id ?? null);

      const next: Record<string, SetRow[]> = {};
      for (const routine of rl) {
        for (const ex of routine.exercises ?? []) {
          const count = Math.max(1, ex.target_sets || 3);
          const existing = logs.filter((l) => l.exercise_id === ex.id);
          next[ex.id] = Array.from({ length: count }, (_, i) => {
            const setNumber = i + 1;
            const log = existing.find((l) => l.set_number === setNumber);
            return {
              set_number: setNumber,
              actual_reps:
                log?.actual_reps !== null && log?.actual_reps !== undefined
                  ? String(log.actual_reps)
                  : "",
              actual_weight:
                log?.actual_weight !== null && log?.actual_weight !== undefined
                  ? String(log.actual_weight)
                  : "",
            };
          });
        }
      }
      setRows(next);
    } finally {
      setLoadingData(false);
    }
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, pin }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      if (json.profile.role === "coach") {
        router.replace("/entrenador");
        return;
      }
      setProfile(json.profile);
      await loadRoutine();
    } catch (err: any) {
      setAuthError(err.message || "No se pudo ingresar");
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setProfile(null);
    setRoutines([]);
    setRows({});
    setActiveDay(null);
  };

  const updateRow = (exId: string, setNumber: number, patch: Partial<SetRow>) => {
    setRows((prev) => ({
      ...prev,
      [exId]: (prev[exId] ?? []).map((r) =>
        r.set_number === setNumber ? { ...r, ...patch } : r
      ),
    }));
  };

  const saveSet = async (ex: Exercise, setNumber: number) => {
    const row = rows[ex.id]?.find((r) => r.set_number === setNumber);
    if (!row) return;
    try {
      const res = await fetch("/api/app/sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercise_id: ex.id,
          set_number: setNumber,
          actual_reps: row.actual_reps,
          actual_weight: row.actual_weight,
          target_reps: ex.target_reps,
          target_weight: ex.target_weight,
          phantom_reference_10_percent: ex.target_weight,
        }),
      });
      const json = await res.json();
      if (json.ok) updateRow(ex.id, setNumber, { saved: true });
    } catch {
      /* ignore */
    }
  };

  const startRec = async (exerciseId: string) => {
    setAudioMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const c: Blob[] = [];
      mr.ondataavailable = (ev) => ev.data.size > 0 && c.push(ev.data);
      mr.onstop = async () => {
        const blob = new Blob(c, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        await uploadAudio(blob, exerciseId);
      };
      mediaRef.current = mr;
      mr.start();
      setRecordingFor(exerciseId);
    } catch {
      setAudioMsg("No se pudo acceder al micrófono.");
    }
  };

  const stopRec = () => {
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stop();
    }
    setRecordingFor(null);
  };

  const uploadAudio = async (blob: Blob, exerciseId: string) => {
    const fd = new FormData();
    fd.append("audio", blob, "nota.webm");
    fd.append("exercise_id", exerciseId);
    try {
      const res = await fetch("/api/app/audio", { method: "POST", body: fd });
      const json = await res.json();
      setAudioMsg(
        json.ok ? "Nota de voz enviada al coach." : json.error || "Error subiendo audio"
      );
    } catch {
      setAudioMsg("Error subiendo audio");
    }
  };

  if (checking) {
    return (
      <main className="auth-wrap">
        <p className="muted">Cargando…</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="auth-wrap">
        <div className="auth-card card">
          <p className="auth-logo">Nocito Coach</p>
          <h1 style={{ margin: "0 0 4px", fontSize: "1.5rem" }}>Mi entrenamiento</h1>
          <p className="muted" style={{ marginTop: 0 }}>
            Ingresá con tu email y tu PIN de 4 dígitos.
          </p>
          <form onSubmit={login} style={{ display: "grid", gap: 14, marginTop: 16 }}>
            <div>
              <label className="lbl">Email</label>
              <input
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="lbl">PIN (4 dígitos)</label>
              <input
                className="input"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                autoComplete="one-time-code"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                style={{ letterSpacing: "0.5em", textAlign: "center", fontSize: "1.3rem" }}
                required
              />
            </div>
            <button className="btn btn-primary" disabled={authLoading}>
              {authLoading ? "Ingresando…" : "Ingresar"}
            </button>
            {authError && <div className="toast err">{authError}</div>}
          </form>
        </div>
      </main>
    );
  }

  const current = routines.find((r) => r.id === activeDay) ?? routines[0];

  return (
    <main className="section">
      <div className="container">
        <div className="topbar">
          <div>
            <h1>Hola, {profile.full_name || profile.email.split("@")[0]}</h1>
            <span className="muted" style={{ fontSize: ".9rem" }}>
              Tu entrenamiento de hoy
            </span>
          </div>
          <button className="btn btn-outline" onClick={logout}>
            Salir
          </button>
        </div>

        {loadingData && <p className="muted">Cargando tu rutina…</p>}

        {!loadingData && routines.length === 0 && (
          <div className="card">
            <span className="badge">Sin rutina asignada</span>
            <p className="muted">
              Tu coach todavía no cargó una rutina. Volvé a intentar más tarde.
            </p>
          </div>
        )}

        {routines.length > 0 && (
          <>
            <div className="tabs">
              {routines.map((r) => (
                <button
                  key={r.id}
                  className={`chip ${r.id === current?.id ? "active" : ""}`}
                  onClick={() => setActiveDay(r.id)}
                >
                  {r.day_name || r.name}
                </button>
              ))}
            </div>

            {audioMsg && <div className="toast ok">{audioMsg}</div>}

            {(current?.exercises ?? []).map((ex) => {
              const media = embedUrl(ex.video_url);
              const notes = (ex.technique_notes ?? "").split("\n").filter(Boolean);
              return (
                <div className="exercise-card" key={ex.id}>
                  <div className="workout-grid">
                    <div>
                      <div className="exercise-head">
                        <h3 className="exercise-name">{ex.name}</h3>
                        <span className="muted" style={{ fontSize: ".88rem" }}>
                          {ex.target_sets ?? "-"} series × {ex.target_reps ?? "-"} reps
                          {ex.target_weight ? ` · ${ex.target_weight} ${ex.unit}` : ""}
                        </span>
                      </div>
                      {media.kind === "iframe" && (
                        <div className="video-frame">
                          <iframe
                            src={media.src}
                            title={ex.name}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      )}
                      {media.kind === "video" && (
                        <div className="video-frame">
                          <video src={media.src} controls playsInline />
                        </div>
                      )}
                      {media.kind === "none" && (
                        <div className="video-frame" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span className="muted">Sin video de referencia</span>
                        </div>
                      )}
                      {notes.length > 0 && (
                        <ul className="tech-list">
                          {notes.map((n, i) => (
                            <li key={i}>{n.replace(/^[-•]\s*/, "")}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <table className="track-table">
                        <thead>
                          <tr>
                            <th>Set</th>
                            <th>Reps</th>
                            <th>Peso ({ex.unit})</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {(rows[ex.id] ?? []).map((r) => (
                            <tr key={r.set_number}>
                              <td className="set-index">{r.set_number}</td>
                              <td>
                                <div className="cell-wrap">
                                  <span className="phantom">{ex.target_reps ?? ""}</span>
                                  <input
                                    className="num-input"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={r.actual_reps}
                                    onChange={(e) =>
                                      updateRow(ex.id, r.set_number, {
                                        actual_reps: e.target.value.replace(/[^\d]/g, ""),
                                      })
                                    }
                                    onBlur={() => saveSet(ex, r.set_number)}
                                  />
                                </div>
                              </td>
                              <td>
                                <div className="cell-wrap">
                                  <span className="phantom">{ex.target_weight ?? ""}</span>
                                  <input
                                    className="num-input"
                                    inputMode="decimal"
                                    value={r.actual_weight}
                                    onChange={(e) =>
                                      updateRow(ex.id, r.set_number, {
                                        actual_weight: e.target.value.replace(/[^\d.,]/g, ""),
                                      })
                                    }
                                    onBlur={() => saveSet(ex, r.set_number)}
                                  />
                                </div>
                              </td>
                              <td style={{ width: 24, textAlign: "center", color: "var(--ok)" }}>
                                {r.saved ? "✓" : ""}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <div style={{ marginTop: 12 }}>
                        <button
                          className={`mic-btn ${recordingFor === ex.id ? "rec" : ""}`}
                          onClick={() =>
                            recordingFor === ex.id ? stopRec() : startRec(ex.id)
                          }
                        >
                          {recordingFor === ex.id ? "● Detener" : "🎙️ Nota de voz"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </main>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import RegisterWizard from "@/app/components/RegisterWizard";
import PendingReviewDashboard from "@/app/components/PendingReviewDashboard";
import type { Anamnesis, Exercise, NutritionPlan, Profile, Routine, SetLog } from "@/lib/app-types";
import {
  exerciseAnatomySrc,
  exerciseGifSrc,
  exercisePdStill,
  exerciseDemoPreload,
  EXERCISE_MEDIA_MODE,
  GENERIC_ANATOMY_SRC,
} from "@/app/lib/exercise-media";

const TEST_LOGIN_ENABLED =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_ENABLE_TEST_LOGIN === "true";

type SetRow = {
  set_number: number;
  actual_reps: string;
  actual_weight: string;
  saved?: boolean;
};

type VoiceSet = { set_number: number; reps: number | null; weight: number | null };

function embedUrl(url?: string | null): { kind: "iframe" | "video" | "none"; src: string } {
  if (!url) return { kind: "none", src: "" };
  const yt = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/
  );
  if (yt) return { kind: "iframe", src: `https://www.youtube.com/embed/${yt[1]}` };
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) return { kind: "video", src: url };
  return { kind: "iframe", src: url };
}

function ExerciseDemo({ name }: { name: string }) {
  const gif = EXERCISE_MEDIA_MODE === "gif" ? exerciseGifSrc(name) : null;
  const still = exercisePdStill(name);
  const anatomy = exerciseAnatomySrc(name);
  const fallback = Array.from(
    new Set([still, anatomy, GENERIC_ANATOMY_SRC].filter(Boolean))
  ) as string[];
  const [gifBroken, setGifBroken] = useState(false);
  const [idx, setIdx] = useState(0);

  if (gif && !gifBroken) {
    return (
      <figure className="anatomy-fallback is-motion">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="demo-media"
          src={gif}
          alt={`Demostración animada de ${name}`}
          loading="eager"
          onError={() => setGifBroken(true)}
        />
      </figure>
    );
  }

  const src = fallback[Math.min(idx, fallback.length - 1)];
  const isGeneric = src === GENERIC_ANATOMY_SRC;
  return (
    <figure className="anatomy-fallback">
      <span className="anatomy-badge">{isGeneric ? "3D" : "FOTO"}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="demo-media"
        src={src}
        alt={`Imagen de referencia de ${name}`}
        loading="eager"
        onError={() => setIdx((i) => (i < fallback.length - 1 ? i + 1 : i))}
      />
      <figcaption>
        <span className="anatomy-sub">Imagen de referencia de la técnica</span>
      </figcaption>
    </figure>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

export default function ClientApp() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [mode, setMode] = useState<"login" | "register">("login");

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, SetRow[]>>({});
  const [loadingData, setLoadingData] = useState(false);
  const [planStatus, setPlanStatus] = useState<string>("active");
  const [nutrition, setNutrition] = useState<NutritionPlan | null>(null);
  const [anamnesis, setAnamnesis] = useState<Anamnesis | null>(null);

  const [recordingFor, setRecordingFor] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const [voiceBusy, setVoiceBusy] = useState<string | null>(null);
  const [audioMsg, setAudioMsg] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<Record<string, boolean>>({});

  const flashSet = (exId: string, setNumber: number) => {
    const key = `${exId}:${setNumber}`;
    setSavedFlash((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setSavedFlash((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, 900);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("registro") || params.get("onboarding") === "1") {
      setMode("register");
    }
  }, []);

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

  useEffect(() => {
    const day = routines.find((r) => r.id === activeDay) ?? routines[0];
    for (const ex of day?.exercises ?? []) {
      if (embedUrl(ex.video_url).kind === "none") {
        for (const src of exerciseDemoPreload(ex.name)) {
          const img = new Image();
          img.src = src;
        }
      }
    }
  }, [routines, activeDay]);

  const loadRoutine = async () => {
    setLoadingData(true);
    try {
      const res = await fetch("/api/app/routine");
      const json = await res.json();
      if (!json.ok) return;
      const rl: Routine[] = json.routines ?? [];
      const logs: SetLog[] = json.logs ?? [];
      setRoutines(rl);
      setPlanStatus(json.status ?? "active");
      setNutrition((json.nutrition as NutritionPlan | null) ?? null);
      setAnamnesis((json.anamnesis as Anamnesis | null) ?? null);
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

  const testLogin = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth/test-login", { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setProfile(json.profile);
      await loadRoutine();
    } catch (err: any) {
      setAuthError(err.message || "No se pudo iniciar sesión de prueba");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegistered = async (p: Profile) => {
    setProfile(p);
    await loadRoutine();
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setProfile(null);
    setRoutines([]);
    setRows({});
    setActiveDay(null);
    setPlanStatus("active");
    setNutrition(null);
    setAnamnesis(null);
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
      if (json.ok) {
        updateRow(ex.id, setNumber, { saved: true });
        flashSet(ex.id, setNumber);
      }
    } catch {
      /* ignore */
    }
  };

  const startRec = async (ex: Exercise) => {
    setAudioMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const c: Blob[] = [];
      mr.ondataavailable = (ev) => ev.data.size > 0 && c.push(ev.data);
      mr.onstop = async () => {
        const blob = new Blob(c, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        await processVoice(blob, ex);
      };
      mediaRef.current = mr;
      mr.start();
      setRecordingFor(ex.id);
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

  const applyVoiceSets = async (ex: Exercise, sets: VoiceSet[]) => {
    const lastSet = sets.reduce((m, s) => Math.max(m, s.set_number), 0);
    const total = Math.min(12, Math.max(lastSet, rows[ex.id]?.length ?? 0, ex.target_sets ?? 0));
    setRows((prev) => {
      const base = (prev[ex.id] ?? []).map((r) => ({ ...r }));
      while (base.length < total) {
        base.push({ set_number: base.length + 1, actual_reps: "", actual_weight: "" });
      }
      for (const s of sets) {
        const r = base.find((x) => x.set_number === s.set_number);
        if (!r) continue;
        if (s.reps !== null) r.actual_reps = String(s.reps);
        if (s.weight !== null) r.actual_weight = String(s.weight);
      }
      return { ...prev, [ex.id]: base };
    });

    for (const s of sets) {
      try {
        await fetch("/api/app/sets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            exercise_id: ex.id,
            set_number: s.set_number,
            actual_reps: s.reps,
            actual_weight: s.weight,
            target_reps: ex.target_reps,
            target_weight: ex.target_weight,
            phantom_reference_10_percent: ex.target_weight,
          }),
        });
      } catch {
        /* ignore */
      }
    }

    setRows((prev) => ({
      ...prev,
      [ex.id]: (prev[ex.id] ?? []).map((r) =>
        sets.some((s) => s.set_number === r.set_number) ? { ...r, saved: true } : r
      ),
    }));
    sets.forEach((s) => flashSet(ex.id, s.set_number));
  };

  const processVoice = async (blob: Blob, ex: Exercise) => {
    setVoiceBusy(ex.id);
    setAudioMsg("Procesando audio…");
    try {
      const fd = new FormData();
      fd.append("audio", blob, "nota.webm");
      fd.append("exercise_id", ex.id);
      const res = await fetch("/api/app/voice-sets", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "No se pudo procesar el audio");
      const sets: VoiceSet[] = Array.isArray(json.sets) ? json.sets : [];
      if (sets.length === 0) {
        setAudioMsg("No se detectaron series. Probá de nuevo.");
        return;
      }
      await applyVoiceSets(ex, sets);
      setAudioMsg(
        `Listo: ${sets.length} serie${sets.length === 1 ? "" : "s"} cargada${
          sets.length === 1 ? "" : "s"
        } por voz.`
      );
    } catch (err: any) {
      setAudioMsg(err?.message || "No se pudo procesar el audio.");
    } finally {
      setVoiceBusy(null);
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
        <div className="auth-card" style={{ maxWidth: mode === "register" ? 560 : 400 }}>
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <span className="brand">
              <img className="brand-logo" src="/img/logo-nocitocoach.jpeg" alt="Nocito Coach" />
            </span>
          </div>
          <div className="card">
            {mode === "login" ? (
              <>
                <h1 style={{ margin: "0 0 4px", fontSize: "1.42rem" }}>Mi entrenamiento</h1>
                <p className="muted" style={{ marginTop: 0 }}>
                  Ingresá con tu usuario o email y tu PIN de 4 dígitos.
                </p>
                <form onSubmit={login} style={{ display: "grid", gap: 14, marginTop: 16 }}>
                  <div>
                    <label className="lbl">Usuario o email</label>
                    <input
                      className="input"
                      type="text"
                      autoComplete="username"
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
                {TEST_LOGIN_ENABLED && (
                  <div style={{ marginTop: 14 }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ width: "100%", fontSize: ".9rem" }}
                      disabled={authLoading}
                      onClick={testLogin}
                    >
                      {authLoading ? "Entrando…" : "Test Student Login"}
                    </button>
                    <p
                      className="muted"
                      style={{ marginTop: 8, fontSize: ".82rem", textAlign: "center" }}
                    >
                      Solo para pruebas: entra como Alumno Test (plan de 4 días).
                    </p>
                  </div>
                )}
                <p className="muted" style={{ marginTop: 14, textAlign: "center", fontSize: ".95rem" }}>
                  ¿Primera vez?{" "}
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setMode("register");
                      setAuthError(null);
                    }}
                  >
                    Creá tu acceso
                  </a>
                </p>
              </>
            ) : (
              <>
                <h1 style={{ margin: "0 0 4px", fontSize: "1.42rem" }}>Creá tu acceso</h1>
                <p className="muted" style={{ marginTop: 0 }}>
                  Completá tus datos y elegí tu PIN para entrar rápido desde el gym.
                </p>
                <RegisterWizard onSuccess={handleRegistered} onSwitchToLogin={() => setMode("login")} />
              </>
            )}
          </div>
        </div>
      </main>
    );
  }

  const current = routines.find((r) => r.id === activeDay) ?? routines[0];
  const exList = current?.exercises ?? [];

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <span className="brand">
            <img className="brand-logo" src="/img/logo-nocitocoach.jpeg" alt="Nocito Coach" />
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="muted hide-sm" style={{ fontSize: ".9rem" }}>
              {profile.full_name || profile.email.split("@")[0]}
            </span>
            <button className="btn btn-outline" onClick={logout} style={{ padding: "8px 14px" }}>
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="section">
        <div className="container">
          {planStatus === "pending_review" ? (
            <PendingReviewDashboard profile={profile} anamnesis={anamnesis} onRefresh={loadRoutine} />
          ) : (
            <>
          <div className="row-between" style={{ marginBottom: 18 }}>
            <div>
              <h1 style={{ margin: "0 0 2px", fontSize: "1.6rem" }}>
                Hola, {profile.full_name || profile.email.split("@")[0]}
              </h1>
              <span className="muted" style={{ fontSize: ".92rem" }}>
                Tu entrenamiento de hoy
              </span>
            </div>
          </div>

          {loadingData && <p className="muted">Cargando tu rutina…</p>}

          {!loadingData && routines.length === 0 && (
            planStatus === "pending_review" ? (
              <div className="card notice-review">
                <span className="notice-mark" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                </span>
                <span className="badge">Supervisión profesional</span>
                <h3>Tus datos ya están en la mesa de trabajo de José Nocito</h3>
                <p className="muted">En breve tu programa personalizado estará activo.</p>
              </div>
            ) : (
              <div className="card">
                <span className="badge">Sin rutina asignada</span>
                <p className="muted" style={{ marginBottom: 0 }}>
                  Tu coach todavía no cargó una rutina. Volvé a intentar más tarde.
                </p>
              </div>
            )
          )}

          {routines.length > 0 && (
            <>
              <div className="day-tabs">
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

              <div className="row-between" style={{ marginBottom: 14 }}>
                <span className="badge">
                  {exList.length} ejercicio{exList.length === 1 ? "" : "s"}
                </span>
              </div>

              {audioMsg && <div className="toast ok">{audioMsg}</div>}

              {exList.map((ex, idx) => {
                const media = embedUrl(ex.video_url);
                const notes = (ex.technique_notes ?? "").split("\n").filter(Boolean);
                const recording = recordingFor === ex.id;
                const processing = voiceBusy === ex.id;
                return (
                  <div className="exercise-card" key={ex.id}>
                    <div className="workout-grid">
                      <div>
                        <div className="exercise-head">
                          <span className="ex-badge">{idx + 1}</span>
                          <h3 className="exercise-name">{ex.name}</h3>
                          <span className="target-chip">
                            <b>{ex.target_sets ?? "-"}</b> × <b>{ex.target_reps ?? "-"}</b>
                            {ex.target_weight ? (
                              <>
                                {" · "}
                                <b>
                                  {ex.target_weight} {ex.unit}
                                </b>
                              </>
                            ) : null}
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
                        {media.kind === "none" && <ExerciseDemo name={ex.name} />}
                        {notes.length > 0 && (
                          <ul className="tech-list">
                            {notes.map((n, i) => (
                              <li key={i}>{n.replace(/^[-•]\s*/, "")}</li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div>
                        <div className="track-head">
                          <h4>Mis series</h4>
                          <span className="legend">
                            <span className="legend-dot">{ex.target_reps ?? "-"}</span>
                            reps objetivo
                          </span>
                        </div>
                        <table className="track-table">
                          <thead>
                            <tr>
                              <th>Series</th>
                              <th>Reps</th>
                              <th>Peso ({ex.unit})</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {(rows[ex.id] ?? []).map((r) => (
                              <tr
                                key={r.set_number}
                                className={
                                  savedFlash[`${ex.id}:${r.set_number}`] ? "row-flash" : undefined
                                }
                              >
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
                                <td>
                                  <div className="save-flag">{r.saved ? "✓" : ""}</div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <div style={{ marginTop: 14 }}>
                          <button
                            className={`mic-btn ${recording ? "rec" : ""}`}
                            disabled={processing || (voiceBusy !== null && !processing)}
                            onClick={() => (recording ? stopRec() : startRec(ex))}
                          >
                            <MicIcon />
                            {processing
                              ? "Procesando…"
                              : recording
                              ? "Detener y cargar"
                              : "Dictar series por voz"}
                          </button>
                          <p className="muted" style={{ fontSize: ".9rem", marginTop: 8 }}>
                            Dictá tus series por voz, por ejemplo «3 series de 10 con 50 kilos».
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {planStatus === "active" && nutrition && (
            <div className="card" style={{ marginTop: 22 }}>
              <h3 style={{ marginTop: 0 }}>Sugerencia nutricional</h3>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 14 }}>
                <span className="badge">{nutrition.cal} kcal/día</span>
                <span className="muted">
                  Proteínas: <b>{nutrition.prot} g</b>
                </span>
                <span className="muted">
                  Carbohidratos: <b>{nutrition.carbs} g</b>
                </span>
                <span className="muted">
                  Grasas: <b>{nutrition.fat} g</b>
                </span>
              </div>
              {nutrition.proteinSources && (
                <p className="muted" style={{ marginTop: 0 }}>
                  Fuentes de proteína sugeridas: {nutrition.proteinSources}
                </p>
              )}
              {nutrition.meals?.length > 0 && (
                <div className="scroll-x">
                  <table className="data-table" style={{ minWidth: 480 }}>
                    <thead>
                      <tr>
                        <th>Comida</th>
                        <th>Sugerencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nutrition.meals.map((m, i) => (
                        <tr key={i}>
                          <td>
                            <b>{m[0]}</b>
                          </td>
                          <td>{m[1]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
            </>
          )}
        </div>
      </main>
    </>
  );
}

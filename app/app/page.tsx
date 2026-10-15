"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Exercise, NutritionPlan, Profile, Routine, SetLog } from "@/lib/app-types";

const SEXOS = ["Masculino", "Femenino", "Otro"];
const OBJETIVOS_REG: [string, string][] = [
  ["hipertrofia", "Hipertrofia"],
  ["perdida-grasa", "Pérdida de grasa"],
  ["fuerza", "Fuerza"],
  ["rendimiento-deportivo", "Rendimiento deportivo"],
];
const DIAS_REG = [3, 4, 5];
const NUTRICION_REG: [string, string][] = [
  ["omnivoro", "Omnívoro"],
  ["vegetariano", "Vegetariano"],
  ["carnivoro", "Carnívoro"],
  ["vegano", "Vegano"],
];

const EMPTY_REG = {
  full_name: "",
  email: "",
  phone: "",
  sex: "Masculino",
  age: "",
  height_cm: "",
  weight_kg: "",
  goal: "hipertrofia",
  training_days: "3",
  nutrition: "omnivoro",
  pin: "",
  pin_confirm: "",
};

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
  const [reg, setReg] = useState({ ...EMPTY_REG });
  const [regError, setRegError] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, SetRow[]>>({});
  const [loadingData, setLoadingData] = useState(false);
  const [planStatus, setPlanStatus] = useState<string>("active");
  const [nutrition, setNutrition] = useState<NutritionPlan | null>(null);

  const [recordingFor, setRecordingFor] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const [audioMsg, setAudioMsg] = useState<string | null>(null);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("registro")
    ) {
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

  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reg),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setProfile(json.profile);
      setConfirm(true);
      await loadRoutine();
    } catch (err: any) {
      setRegError(err.message || "No se pudo crear la cuenta");
    } finally {
      setRegLoading(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setProfile(null);
    setRoutines([]);
    setRows({});
    setActiveDay(null);
    setPlanStatus("active");
    setNutrition(null);
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
        <div className="auth-card" style={{ maxWidth: mode === "register" ? 560 : 400 }}>
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <span className="brand">
              <span className="brand-mark">J</span>
              <span className="brand-name">nocito.coach</span>
            </span>
          </div>
          <div className="card">
            {mode === "login" ? (
              <>
                <h1 style={{ margin: "0 0 4px", fontSize: "1.42rem" }}>Mi entrenamiento</h1>
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
                <p className="muted" style={{ marginTop: 14, textAlign: "center", fontSize: ".9rem" }}>
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
                <form onSubmit={register} style={{ display: "grid", gap: 14, marginTop: 16 }}>
                  <div>
                    <label className="lbl">Nombre completo</label>
                    <input
                      className="input"
                      value={reg.full_name}
                      onChange={(e) => setReg({ ...reg, full_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid-2">
                    <div>
                      <label className="lbl">Email</label>
                      <input
                        className="input"
                        type="email"
                        autoComplete="email"
                        value={reg.email}
                        onChange={(e) => setReg({ ...reg, email: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="lbl">Teléfono / WhatsApp</label>
                      <input
                        className="input"
                        type="tel"
                        autoComplete="tel"
                        value={reg.phone}
                        onChange={(e) => setReg({ ...reg, phone: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid-2">
                    <div>
                      <label className="lbl">Sexo</label>
                      <select
                        className="input"
                        value={reg.sex}
                        onChange={(e) => setReg({ ...reg, sex: e.target.value })}
                      >
                        {SEXOS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="lbl">Edad</label>
                      <input
                        className="input"
                        inputMode="numeric"
                        placeholder="Años"
                        value={reg.age}
                        onChange={(e) =>
                          setReg({ ...reg, age: e.target.value.replace(/\D/g, "").slice(0, 3) })
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="grid-2">
                    <div>
                      <label className="lbl">Altura (cm)</label>
                      <input
                        className="input"
                        inputMode="numeric"
                        placeholder="178"
                        value={reg.height_cm}
                        onChange={(e) =>
                          setReg({ ...reg, height_cm: e.target.value.replace(/\D/g, "").slice(0, 3) })
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className="lbl">Peso (kg)</label>
                      <input
                        className="input"
                        inputMode="decimal"
                        placeholder="78.5"
                        value={reg.weight_kg}
                        onChange={(e) =>
                          setReg({ ...reg, weight_kg: e.target.value.replace(/[^0-9.]/g, "") })
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="grid-2">
                    <div>
                      <label className="lbl">Objetivo principal</label>
                      <select
                        className="input"
                        value={reg.goal}
                        onChange={(e) => setReg({ ...reg, goal: e.target.value })}
                      >
                        {OBJETIVOS_REG.map(([k, l]) => (
                          <option key={k} value={k}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="lbl">Días por semana</label>
                      <select
                        className="input"
                        value={reg.training_days}
                        onChange={(e) => setReg({ ...reg, training_days: e.target.value })}
                      >
                        {DIAS_REG.map((d) => (
                          <option key={d} value={d}>
                            {d} días
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="lbl">Preferencia alimentaria</label>
                    <select
                      className="input"
                      value={reg.nutrition}
                      onChange={(e) => setReg({ ...reg, nutrition: e.target.value })}
                    >
                      {NUTRICION_REG.map(([k, l]) => (
                        <option key={k} value={k}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid-2">
                    <div>
                      <label className="lbl">PIN (4 dígitos)</label>
                      <input
                        className="input"
                        inputMode="numeric"
                        maxLength={4}
                        value={reg.pin}
                        onChange={(e) =>
                          setReg({ ...reg, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })
                        }
                        style={{ letterSpacing: "0.4em", textAlign: "center" }}
                        required
                      />
                    </div>
                    <div>
                      <label className="lbl">Confirmar PIN</label>
                      <input
                        className="input"
                        inputMode="numeric"
                        maxLength={4}
                        value={reg.pin_confirm}
                        onChange={(e) =>
                          setReg({
                            ...reg,
                            pin_confirm: e.target.value.replace(/\D/g, "").slice(0, 4),
                          })
                        }
                        style={{ letterSpacing: "0.4em", textAlign: "center" }}
                        required
                      />
                    </div>
                  </div>
                  <button className="btn btn-primary" disabled={regLoading}>
                    {regLoading ? "Creando cuenta…" : "Crear cuenta y entrar"}
                  </button>
                  {regError && <div className="toast err">{regError}</div>}
                </form>
                <p className="muted" style={{ marginTop: 14, textAlign: "center", fontSize: ".9rem" }}>
                  ¿Ya tenés cuenta?{" "}
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setMode("login");
                      setRegError(null);
                    }}
                  >
                    Ingresá
                  </a>
                </p>
              </>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (confirm) {
    return (
      <main className="auth-wrap">
        <div className="auth-card" style={{ maxWidth: 480 }}>
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <span className="brand">
              <span className="brand-mark">J</span>
              <span className="brand-name">nocito.coach</span>
            </span>
          </div>
          <div className="card">
            <span className="badge">¡Datos registrados!</span>
            <h1 style={{ margin: "12px 0 8px", fontSize: "1.42rem" }}>
              ¡Listo, {profile.full_name || profile.email.split("@")[0]}!
            </h1>
            <p className="muted" style={{ marginTop: 0, lineHeight: 1.6 }}>
              En unos momentos vas a recibir tu rutina y sugerencia nutricional en esta
              pantalla. Si en unos minutos no aparece, por las dudas volvé a entrar con el
              mismo usuario y contraseña que elegiste.
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: 18, width: "100%" }}
              onClick={() => setConfirm(false)}
            >
              Ver mi entrenamiento
            </button>
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
            <span className="brand-mark">J</span>
            <span className="brand-name">nocito.coach</span>
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="muted hide-sm" style={{ fontSize: ".86rem" }}>
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
            <div className="card">
              {planStatus === "pending_review" ? (
                <>
                  <span className="badge">Rutina en revisión</span>
                  <p className="muted" style={{ marginBottom: 0 }}>
                    Tu coach está revisando tu rutina. En cuanto la apruebe vas a poder verla
                    acá. Si en unos minutos no aparece, volvé a entrar con tu email y PIN.
                  </p>
                </>
              ) : (
                <>
                  <span className="badge">Sin rutina asignada</span>
                  <p className="muted" style={{ marginBottom: 0 }}>
                    Tu coach todavía no cargó una rutina. Volvé a intentar más tarde.
                  </p>
                </>
              )}
            </div>
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
                <span className="legend">
                  Número tenue = objetivo · <span className="legend-dot">objetivo</span>
                </span>
              </div>

              {audioMsg && <div className="toast ok">{audioMsg}</div>}

              {exList.map((ex, idx) => {
                const media = embedUrl(ex.video_url);
                const notes = (ex.technique_notes ?? "").split("\n").filter(Boolean);
                const recording = recordingFor === ex.id;
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
                        {media.kind === "none" && (
                          <div
                            className="video-frame"
                            style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
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
                            onClick={() => (recording ? stopRec() : startRec(ex.id))}
                          >
                            <MicIcon />
                            {recording ? "Detener y enviar" : "Nota de voz para el coach"}
                          </button>
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
        </div>
      </main>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { NutritionPlan, Profile } from "@/lib/app-types";

interface ClientRow {
  id: string;
  email: string;
  full_name: string;
  activo: boolean;
  has_pin: boolean;
  routine_status: "pending_review" | "active";
}

interface ExRow {
  name: string;
  video_url: string;
  technique_notes: string;
  target_sets: string;
  target_reps: string;
  target_weight: string;
  unit: "kg" | "lbs";
}

interface Draft {
  id?: string;
  name: string;
  day_name: string;
  week_number: string;
  position: string;
  active: boolean;
  exercises: ExRow[];
}

const emptyEx = (): ExRow => ({
  name: "",
  video_url: "",
  technique_notes: "",
  target_sets: "3",
  target_reps: "10",
  target_weight: "",
  unit: "kg",
});

const emptyDraft = (): Draft => ({
  name: "",
  day_name: "",
  week_number: "1",
  position: "0",
  active: true,
  exercises: [emptyEx()],
});

const emptyNutrition = (): NutritionPlan => ({
  cal: 0,
  prot: 0,
  carbs: 0,
  fat: 0,
  proteinSources: "",
  meals: [],
});

const GOAL_LABELS: Record<string, string> = {
  hipertrofia: "Hipertrofia",
  "perdida-grasa": "Pérdida de grasa",
  fuerza: "Fuerza",
  "rendimiento-deportivo": "Rendimiento deportivo",
};

const NUTRITION_LABELS: Record<string, string> = {
  omnivoro: "Omnívoro",
  vegetariano: "Vegetariano",
  carnivoro: "Carnívoro",
  vegano: "Vegano",
};

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="muted"
        style={{ fontSize: ".72rem", textTransform: "uppercase", letterSpacing: ".04em" }}
      >
        {label}
      </div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

export default function CoachDashboard() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [coach, setCoach] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [tab, setTab] = useState<"historial" | "rutinas" | "nutricion" | "acceso">(
    "historial"
  );

  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [baseline, setBaseline] = useState<ExRow[] | null>(null);
  const [nutrition, setNutrition] = useState<NutritionPlan>(emptyNutrition());
  const [newClient, setNewClient] = useState({ email: "", full_name: "", pin: "" });
  const [pinFor, setPinFor] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && j.profile) {
          if (j.profile.role !== "coach") {
            router.replace("/app");
            return;
          }
          setCoach(j.profile);
          loadClients();
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const loadClients = async () => {
    const res = await fetch("/api/coach/clients");
    const json = await res.json();
    if (json.ok) {
      const list: ClientRow[] = [...(json.clients ?? [])];
      list.sort((a, b) => {
        const pa = a.routine_status === "pending_review" ? 0 : 1;
        const pb = b.routine_status === "pending_review" ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return (a.full_name || a.email).localeCompare(b.full_name || b.email);
      });
      setClients(list);
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
      if (json.profile.role !== "coach") {
        router.replace("/app");
        return;
      }
      setCoach(json.profile);
      await loadClients();
    } catch (err: any) {
      setAuthError(err.message || "No se pudo ingresar");
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setCoach(null);
    setClients([]);
    setDetail(null);
  };

  const syncNutrition = (json: any) => {
    const np = json?.profile?.nutrition_plan as NutritionPlan | null | undefined;
    setNutrition(
      np
        ? { ...emptyNutrition(), ...np, meals: Array.isArray(np.meals) ? np.meals : [] }
        : emptyNutrition()
    );
  };

  const selectClient = async (id: string) => {
    setSelectedId(id);
    setTab("historial");
    setMsg(null);
    setDraft(emptyDraft());
    setBaseline(null);
    const res = await fetch(`/api/coach/client?id=${id}`);
    const json = await res.json();
    if (json.ok) {
      setDetail(json);
      syncNutrition(json);
    }
  };

  const reloadDetail = async () => {
    if (!selectedId) return;
    const res = await fetch(`/api/coach/client?id=${selectedId}`);
    const json = await res.json();
    if (json.ok) {
      setDetail(json);
      syncNutrition(json);
    }
  };

  const setMeal = (idx: number, col: 0 | 1, value: string) => {
    setNutrition((n) => ({
      ...n,
      meals: n.meals.map((m, i) =>
        i === idx ? (col === 0 ? [value, m[1]] : [m[0], value]) : m
      ) as [string, string][],
    }));
  };

  const saveNutrition = async () => {
    if (!selectedId) return;
    const res = await fetch("/api/coach/nutrition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: selectedId, nutrition }),
    });
    const json = await res.json();
    if (json.ok) {
      setMsg({ type: "ok", text: "Plan nutricional guardado." });
      await reloadDetail();
    } else {
      setMsg({ type: "err", text: json.error || "Error" });
    }
  };

  const approve = async () => {
    if (!selectedId) return;
    const res = await fetch("/api/coach/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: selectedId }),
    });
    const json = await res.json();
    if (json.ok) {
      setMsg({ type: "ok", text: "Rutina aprobada y publicada." });
      await loadClients();
      await reloadDetail();
    } else {
      setMsg({ type: "err", text: json.error || "Error" });
    }
  };

  const setEx = (idx: number, patch: Partial<ExRow>) => {
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    }));
  };

  const saveRoutine = async () => {
    if (!selectedId) return;
    if (!draft.exercises.some((e) => e.name.trim())) {
      setMsg({ type: "err", text: "Agregá al menos un ejercicio." });
      return;
    }
    const payload = {
      ...(draft.id ? { id: draft.id } : { client_id: selectedId }),
      name: draft.name || draft.day_name || "Rutina",
      day_name: draft.day_name,
      week_number: draft.week_number,
      position: draft.position,
      active: draft.active,
      exercises: draft.exercises
        .filter((e) => e.name.trim())
        .map((e, i) => ({
          name: e.name.trim(),
          video_url: e.video_url.trim(),
          technique_notes: e.technique_notes,
          order_index: i,
          target_sets: e.target_sets,
          target_reps: e.target_reps,
          target_weight: e.target_weight,
          unit: e.unit,
        })),
    };
    const res = await fetch("/api/coach/routine", {
      method: draft.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.ok) {
      setMsg({ type: "ok", text: draft.id ? "Rutina actualizada." : "Rutina creada." });
      setDraft(emptyDraft());
      setBaseline(null);
      await reloadDetail();
    } else {
      setMsg({ type: "err", text: json.error || "Error" });
    }
  };

  const editRoutine = (r: any) => {
    const exercises: ExRow[] = (r.exercises ?? [])
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((e: any) => ({
        name: e.name,
        video_url: e.video_url ?? "",
        technique_notes: e.technique_notes ?? "",
        target_sets: e.target_sets != null ? String(e.target_sets) : "",
        target_reps: e.target_reps != null ? String(e.target_reps) : "",
        target_weight: e.target_weight != null ? String(e.target_weight) : "",
        unit: e.unit ?? "kg",
      }));
    setDraft({
      id: r.id,
      name: r.name,
      day_name: r.day_name,
      week_number: String(r.week_number),
      position: String(r.position),
      active: r.active,
      exercises,
    });
    setBaseline(exercises.map((e) => ({ ...e })));
    setTab("rutinas");
    setMsg(null);
  };

  const deleteRoutine = async (id: string) => {
    if (!confirm("¿Eliminar esta rutina del día?")) return;
    const res = await fetch(`/api/coach/routine?id=${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.ok) {
      setMsg({ type: "ok", text: "Rutina eliminada." });
      await reloadDetail();
    } else {
      setMsg({ type: "err", text: json.error || "Error" });
    }
  };

  const createClient = async () => {
    const res = await fetch("/api/coach/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newClient),
    });
    const json = await res.json();
    if (json.ok) {
      setMsg({ type: "ok", text: "Cliente creado." });
      setNewClient({ email: "", full_name: "", pin: "" });
      await loadClients();
    } else {
      setMsg({ type: "err", text: json.error || "Error" });
    }
  };

  const savePin = async () => {
    if (!selectedId) return;
    const res = await fetch("/api/coach/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: selectedId, pin: pinFor }),
    });
    const json = await res.json();
    if (json.ok) {
      setMsg({ type: "ok", text: "PIN actualizado." });
      setPinFor("");
      await loadClients();
    } else {
      setMsg({ type: "err", text: json.error || "Error" });
    }
  };

  if (checking) {
    return (
      <main className="auth-wrap">
        <p className="muted">Cargando…</p>
      </main>
    );
  }

  if (!coach) {
    return (
      <main className="auth-wrap">
        <div className="auth-card card">
          <p className="auth-logo">Nocito Coach</p>
          <h1 style={{ margin: "0 0 4px", fontSize: "1.5rem" }}>Panel del coach</h1>
          <p className="muted" style={{ marginTop: 0 }}>
            Acceso exclusivo de José.
          </p>
          <form onSubmit={login} style={{ display: "grid", gap: 14, marginTop: 16 }}>
            <div>
              <label className="lbl">Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="lbl">PIN</label>
              <input
                className="input"
                inputMode="numeric"
                maxLength={4}
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

  const selected = clients.find((c) => c.id === selectedId);

  return (
    <main className="section">
      <div className="container">
        <div className="topbar">
          <div>
            <h1>Panel de {coach.full_name || "José"}</h1>
            <span className="muted" style={{ fontSize: ".9rem" }}>
              {clients.length} clientes
            </span>
          </div>
          <button className="btn btn-outline" onClick={logout}>
            Salir
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(240px, 300px) 1fr",
            gap: 22,
            alignItems: "start",
          }}
        >
          <aside className="card">
            <h3 style={{ margin: "0 0 12px" }}>Clientes</h3>
            {clients.length === 0 && <p className="muted">Sin clientes todavía.</p>}
            {clients.map((c) => {
              const pending = c.routine_status === "pending_review";
              return (
                <button
                  key={c.id}
                  className={`list-item ${selectedId === c.id ? "active" : ""} ${
                    pending ? "pending" : ""
                  }`}
                  onClick={() => selectClient(c.id)}
                >
                  <div className="row-between" style={{ gap: 8 }}>
                    <strong>{c.full_name || c.email}</strong>
                    <span className={`pill ${pending ? "pending" : "active"}`}>
                      {pending ? "Pendiente" : "Activa"}
                    </span>
                  </div>
                  <small>
                    {c.email} · {c.has_pin ? "PIN ok" : "sin PIN"}
                  </small>
                </button>
              );
            })}
          </aside>

          <section>
            {!selected && (
              <div className="card">
                <p className="muted">Seleccioná un cliente para ver su actividad.</p>
              </div>
            )}

            {selected && (
              <>
                <div
                  className="row-between"
                  style={{ marginBottom: 16, flexWrap: "wrap", gap: 10 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <h2 style={{ margin: 0, fontSize: "1.3rem" }}>
                      {selected.full_name || selected.email}
                    </h2>
                    <span className="badge">
                      {selected.routine_status === "pending_review"
                        ? "Pendiente de revisión"
                        : "Rutina activa"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    {selected.routine_status === "pending_review" && (
                      <button className="btn btn-primary" onClick={approve}>
                        Aprobar y Publicar Rutina
                      </button>
                    )}
                    <div className="tabs" style={{ margin: 0 }}>
                      {(["historial", "rutinas", "nutricion", "acceso"] as const).map((t) => (
                        <button
                          key={t}
                          className={`chip ${tab === t ? "active" : ""}`}
                          onClick={() => setTab(t)}
                        >
                          {t === "historial"
                            ? "Historial"
                            : t === "rutinas"
                            ? "Rutinas"
                            : t === "nutricion"
                            ? "Nutrición"
                            : "Acceso"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {msg && <div className={`toast ${msg.type}`}>{msg.text}</div>}

                <div className="split">
                  <aside>
                    {detail && (
                      <div className="card" style={{ marginTop: 0 }}>
                        <h3 style={{ marginTop: 0 }}>Ficha y anamnesis</h3>
                    {detail.profile?.anamnesis ? (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
                          gap: 10,
                        }}
                      >
                        <Dato label="Edad" value={`${detail.profile.anamnesis.age} años`} />
                        <Dato label="Sexo" value={detail.profile.anamnesis.sex} />
                        <Dato label="Altura" value={`${detail.profile.anamnesis.height_cm} cm`} />
                        <Dato label="Peso" value={`${detail.profile.anamnesis.weight_kg} kg`} />
                        <Dato
                          label="Objetivo"
                          value={
                            GOAL_LABELS[detail.profile.anamnesis.goal] ??
                            detail.profile.anamnesis.goal
                          }
                        />
                        <Dato
                          label="Días/semana"
                          value={`${detail.profile.anamnesis.training_days}`}
                        />
                        <Dato
                          label="Alimentación"
                          value={
                            NUTRITION_LABELS[detail.profile.anamnesis.nutrition] ??
                            detail.profile.anamnesis.nutrition
                          }
                        />
                        <Dato label="Teléfono" value={detail.profile.phone || "-"} />
                      </div>
                    ) : (
                      <p className="muted" style={{ margin: 0 }}>
                        El cliente todavía no completó su anamnesis.
                      </p>
                    )}
                  </div>
                )}
                  </aside>
                  <div>

                {tab === "historial" && detail && (
                  <div className="card" style={{ marginTop: 12 }}>
                    <h3 style={{ marginTop: 0 }}>Series registradas</h3>
                    <div className="scroll-x">
                      <table className="data-table" style={{ minWidth: 640 }}>
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Ejercicio</th>
                            <th>Set</th>
                            <th>Reps</th>
                            <th>Peso</th>
                            <th>Objetivo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(detail.logs ?? []).map((l: any) => (
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
                          {(detail.logs ?? []).length === 0 && (
                            <tr>
                              <td colSpan={6} className="muted">
                                Sin registros.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <h3 style={{ marginTop: 24 }}>Notas de voz</h3>
                    {(detail.audio ?? []).length === 0 && (
                      <p className="muted">Sin notas de voz.</p>
                    )}
                    {(detail.audio ?? []).map((a: any) => (
                      <div
                        key={a.id}
                        className="row-between"
                        style={{
                          borderTop: "1px solid var(--border)",
                          padding: "10px 0",
                        }}
                      >
                        <span className="muted">
                          {a.exercises?.name ?? "General"} ·{" "}
                          {new Date(a.created_at).toLocaleString()}
                        </span>
                        <audio src={a.audio_storage_url} controls preload="none" />
                      </div>
                    ))}
                  </div>
                )}

                {tab === "rutinas" && detail && (
                  <div style={{ marginTop: 12 }}>
                    <div className="card" style={{ marginBottom: 16 }}>
                      <h3 style={{ marginTop: 0 }}>
                        {draft.id ? "Editar rutina" : "Nueva rutina (día)"}
                      </h3>
                      <div className="grid-4" style={{ marginBottom: 12 }}>
                        <div>
                          <label className="lbl">Día</label>
                          <input
                            className="input"
                            placeholder="Día 1 · Push"
                            value={draft.day_name}
                            onChange={(e) => setDraft({ ...draft, day_name: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="lbl">Semana</label>
                          <input
                            className="input"
                            type="number"
                            value={draft.week_number}
                            onChange={(e) =>
                              setDraft({ ...draft, week_number: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <label className="lbl">Orden</label>
                          <input
                            className="input"
                            type="number"
                            value={draft.position}
                            onChange={(e) => setDraft({ ...draft, position: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="lbl">Activa</label>
                          <select
                            className="input"
                            value={draft.active ? "1" : "0"}
                            onChange={(e) =>
                              setDraft({ ...draft, active: e.target.value === "1" })
                            }
                          >
                            <option value="1">Sí</option>
                            <option value="0">No</option>
                          </select>
                        </div>
                      </div>

                      {draft.exercises.map((ex, idx) => {
                        const base = baseline?.[idx];
                        return (
                        <div
                          key={idx}
                          className="card"
                          style={{ background: "var(--surface)", marginBottom: 10 }}
                        >
                          <div className="grid-4">
                            <input
                              className="input"
                              placeholder="Ejercicio"
                              value={ex.name}
                              onChange={(e) => setEx(idx, { name: e.target.value })}
                            />
                            <input
                              className="input"
                              placeholder="URL de video (YouTube)"
                              value={ex.video_url}
                              onChange={(e) => setEx(idx, { video_url: e.target.value })}
                            />
                            <div className="cell-wrap">
                              {base?.target_sets && base.target_sets !== ex.target_sets && (
                                <span className="phantom">{base.target_sets}</span>
                              )}
                              <input
                                className="num-input"
                                placeholder="Series"
                                inputMode="numeric"
                                value={ex.target_sets}
                                onChange={(e) => setEx(idx, { target_sets: e.target.value })}
                              />
                            </div>
                            <div className="cell-wrap">
                              {base?.target_reps && base.target_reps !== ex.target_reps && (
                                <span className="phantom">{base.target_reps}</span>
                              )}
                              <input
                                className="num-input"
                                placeholder="Reps"
                                inputMode="numeric"
                                value={ex.target_reps}
                                onChange={(e) => setEx(idx, { target_reps: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="grid-4" style={{ marginTop: 10 }}>
                            <div className="cell-wrap">
                              {base?.target_weight && base.target_weight !== ex.target_weight && (
                                <span className="phantom">{base.target_weight}</span>
                              )}
                              <input
                                className="num-input"
                                placeholder="Peso objetivo"
                                inputMode="decimal"
                                value={ex.target_weight}
                                onChange={(e) => setEx(idx, { target_weight: e.target.value })}
                              />
                            </div>
                            <select
                              className="input"
                              value={ex.unit}
                              onChange={(e) =>
                                setEx(idx, { unit: e.target.value as "kg" | "lbs" })
                              }
                            >
                              <option value="kg">kg</option>
                              <option value="lbs">lbs</option>
                            </select>
                            <input
                              className="input"
                              placeholder="Técnica (una indicación por línea)"
                              value={ex.technique_notes}
                              onChange={(e) => setEx(idx, { technique_notes: e.target.value })}
                              style={{ gridColumn: "span 2" }}
                            />
                          </div>
                          <div
                            style={{
                              marginTop: 8,
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              className="btn btn-danger"
                              type="button"
                              onClick={() => {
                                setDraft((d) => ({
                                  ...d,
                                  exercises: d.exercises.filter((_, i) => i !== idx),
                                }));
                                setBaseline((b) => (b ? b.filter((_, i) => i !== idx) : b));
                              }}
                            >
                              Quitar
                            </button>
                            {base?.name && (
                              <span className="muted" style={{ fontSize: ".78rem" }}>
                                Base: {base.target_sets || "-"}×{base.target_reps || "-"}
                                {base.target_weight
                                  ? ` · ${base.target_weight} ${base.unit}`
                                  : ""}
                              </span>
                            )}
                          </div>
                        </div>
                        );
                      })}

                      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                        <button
                          className="btn btn-outline"
                          onClick={() => {
                            setDraft((d) => ({ ...d, exercises: [...d.exercises, emptyEx()] }));
                            setBaseline((b) => (b ? [...b, emptyEx()] : b));
                          }}
                        >
                          + Ejercicio
                        </button>
                        <button className="btn btn-primary" onClick={saveRoutine}>
                          {draft.id ? "Guardar cambios" : "Crear rutina"}
                        </button>
                        {draft.id && (
                          <button
                            className="btn btn-outline"
                            onClick={() => {
                              setDraft(emptyDraft());
                              setBaseline(null);
                            }}
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>

                    {(detail.routines ?? []).map((r: any) => (
                      <div className="card" key={r.id} style={{ marginBottom: 12 }}>
                        <div className="row-between">
                          <div>
                            <strong>{r.day_name || r.name}</strong>
                            <div className="muted" style={{ fontSize: ".85rem" }}>
                              Semana {r.week_number} · {(r.exercises ?? []).length} ejercicios ·{" "}
                              {r.active ? "activa" : "inactiva"}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="btn btn-outline" onClick={() => editRoutine(r)}>
                              Editar
                            </button>
                            <button
                              className="btn btn-danger"
                              onClick={() => deleteRoutine(r.id)}
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {tab === "nutricion" && (
                  <div style={{ marginTop: 12 }}>
                    <div className="card">
                      <h3 style={{ marginTop: 0 }}>Plan nutricional</h3>
                      <div className="grid-4" style={{ marginBottom: 10 }}>
                        <div>
                          <label className="lbl">Calorías (kcal)</label>
                          <input
                            className="input"
                            inputMode="numeric"
                            value={nutrition.cal}
                            onChange={(e) =>
                              setNutrition({
                                ...nutrition,
                                cal: Number(e.target.value.replace(/\D/g, "")) || 0,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="lbl">Proteínas (g)</label>
                          <input
                            className="input"
                            inputMode="numeric"
                            value={nutrition.prot}
                            onChange={(e) =>
                              setNutrition({
                                ...nutrition,
                                prot: Number(e.target.value.replace(/\D/g, "")) || 0,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="lbl">Carbohidratos (g)</label>
                          <input
                            className="input"
                            inputMode="numeric"
                            value={nutrition.carbs}
                            onChange={(e) =>
                              setNutrition({
                                ...nutrition,
                                carbs: Number(e.target.value.replace(/\D/g, "")) || 0,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="lbl">Grasas (g)</label>
                          <input
                            className="input"
                            inputMode="numeric"
                            value={nutrition.fat}
                            onChange={(e) =>
                              setNutrition({
                                ...nutrition,
                                fat: Number(e.target.value.replace(/\D/g, "")) || 0,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <label className="lbl">Fuentes de proteína</label>
                        <input
                          className="input"
                          value={nutrition.proteinSources}
                          onChange={(e) =>
                            setNutrition({ ...nutrition, proteinSources: e.target.value })
                          }
                        />
                      </div>

                      <h4 style={{ margin: "18px 0 8px" }}>Comidas</h4>
                      {nutrition.meals.map((m, i) => (
                        <div className="grid-2" key={i} style={{ marginBottom: 8 }}>
                          <input
                            className="input"
                            placeholder="Comida (ej. Desayuno)"
                            value={m[0]}
                            onChange={(e) => setMeal(i, 0, e.target.value)}
                          />
                          <input
                            className="input"
                            placeholder="Sugerencia"
                            value={m[1]}
                            onChange={(e) => setMeal(i, 1, e.target.value)}
                          />
                        </div>
                      ))}

                      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                        <button
                          className="btn btn-outline"
                          onClick={() =>
                            setNutrition((n) => ({
                              ...n,
                              meals: [...n.meals, ["", ""] as [string, string]],
                            }))
                          }
                        >
                          + Comida
                        </button>
                        <button className="btn btn-primary" onClick={saveNutrition}>
                          Guardar nutrición
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {tab === "acceso" && (
                  <div style={{ marginTop: 12 }}>
                    <div className="card" style={{ marginBottom: 16 }}>
                      <h3 style={{ marginTop: 0 }}>PIN de {selected.full_name || selected.email}</h3>
                      <p className="muted">
                        {selected.has_pin ? "Tiene PIN asignado." : "Sin PIN asignado."}
                      </p>
                      <div className="grid-2">
                        <input
                          className="input"
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="Nuevo PIN (4 dígitos)"
                          value={pinFor}
                          onChange={(e) =>
                            setPinFor(e.target.value.replace(/\D/g, "").slice(0, 4))
                          }
                        />
                        <button className="btn btn-primary" onClick={savePin}>
                          Actualizar PIN
                        </button>
                      </div>
                    </div>

                    <div className="card">
                      <h3 style={{ marginTop: 0 }}>Nuevo cliente</h3>
                      <div className="grid-3">
                        <input
                          className="input"
                          placeholder="Email"
                          value={newClient.email}
                          onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                        />
                        <input
                          className="input"
                          placeholder="Nombre completo"
                          value={newClient.full_name}
                          onChange={(e) =>
                            setNewClient({ ...newClient, full_name: e.target.value })
                          }
                        />
                        <input
                          className="input"
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="PIN (4 dígitos)"
                          value={newClient.pin}
                          onChange={(e) =>
                            setNewClient({
                              ...newClient,
                              pin: e.target.value.replace(/\D/g, "").slice(0, 4),
                            })
                          }
                        />
                      </div>
                      <button
                        className="btn btn-primary"
                        style={{ marginTop: 12 }}
                        onClick={createClient}
                      >
                        Crear cliente
                      </button>
                    </div>
                  </div>
                )}
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

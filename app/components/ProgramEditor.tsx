"use client";

import { useMemo, useState } from "react";
import type {
  GeneratedProgram,
  ProgramBlock,
  ProgramDay,
  ProgramExercise,
  WeekTarget,
} from "@/app/lib/program";
import { buildProgression, expandProgramBlock } from "@/app/lib/block";

function clone(program: GeneratedProgram): GeneratedProgram {
  return JSON.parse(JSON.stringify(program)) as GeneratedProgram;
}

const emptyExercise = (): ProgramExercise => ({
  ejercicio: "",
  series: 3,
  reps: "10",
  descanso: "90 seg",
  notas: "",
});

function numOrNull(value: string): number | null {
  const raw = value.replace(",", ".").replace(/[^0-9.]/g, "");
  if (!raw.trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export default function ProgramEditor({
  program,
  clientName,
  onClose,
  onPublish,
  publishing,
}: {
  program: GeneratedProgram;
  clientName: string;
  onClose: () => void;
  onPublish: (edited: GeneratedProgram) => void;
  publishing: boolean;
}) {
  const [p, setP] = useState<GeneratedProgram>(() => expandProgramBlock(clone(program)));

  const weeks = Math.max(1, p.block?.weeks ?? 6);
  const weekNums = useMemo(() => Array.from({ length: weeks }, (_, i) => i + 1), [weeks]);

  const blockParams = (block?: ProgramBlock) => ({
    incrementoKg: block?.incrementoKg ?? 2.5,
    repWave: block?.repWave ?? 3,
    rirInicio: block?.rirInicio ?? 2,
    rirFin: block?.rirFin ?? 1,
  });

  const patchBlock = (patch: Partial<ProgramBlock>) =>
    setP((prev) => ({ ...prev, block: { ...prev.block, ...patch } }));

  const setWeeks = (n: number) =>
    setP((prev) => expandProgramBlock({ ...prev, block: { ...prev.block, weeks: n } }));

  const recalc = () => setP((prev) => expandProgramBlock(prev));

  const patchDay = (di: number, patch: Partial<ProgramDay>) =>
    setP((prev) => ({
      ...prev,
      days: prev.days.map((d, i) => (i === di ? { ...d, ...patch } : d)),
    }));

  const patchEx = (di: number, ei: number, patch: Partial<ProgramExercise>) =>
    setP((prev) => ({
      ...prev,
      days: prev.days.map((d, i) =>
        i === di
          ? { ...d, ejercicios: d.ejercicios.map((e, j) => (j === ei ? { ...e, ...patch } : e)) }
          : d
      ),
    }));

  const setBaseWeight = (di: number, ei: number, base: number | null) =>
    setP((prev) => ({
      ...prev,
      days: prev.days.map((d, i) =>
        i === di
          ? {
              ...d,
              ejercicios: d.ejercicios.map((e, j) => {
                if (j !== ei) return e;
                const next: ProgramExercise = { ...e, base_weight: base };
                return {
                  ...next,
                  progresion: buildProgression(next, prev.block?.weeks ?? 6, blockParams(prev.block)),
                };
              }),
            }
          : d
      ),
    }));

  const patchWeek = (di: number, ei: number, sem: number, patch: Partial<WeekTarget>) =>
    setP((prev) => ({
      ...prev,
      days: prev.days.map((d, i) =>
        i === di
          ? {
              ...d,
              ejercicios: d.ejercicios.map((e, j) => {
                if (j !== ei) return e;
                const list = e.progresion ?? [];
                const has = list.some((t) => t.sem === sem);
                const progresion = has
                  ? list.map((t) => (t.sem === sem ? { ...t, ...patch } : t))
                  : [...list, { sem, reps: null, peso: null, rir: null, ...patch }].sort(
                      (a, b) => a.sem - b.sem
                    );
                return { ...e, progresion };
              }),
            }
          : d
      ),
    }));

  const addEx = (di: number) =>
    setP((prev) => ({
      ...prev,
      days: prev.days.map((d, i) =>
        i === di ? { ...d, ejercicios: [...d.ejercicios, emptyExercise()] } : d
      ),
    }));

  const removeEx = (di: number, ei: number) =>
    setP((prev) => ({
      ...prev,
      days: prev.days.map((d, i) =>
        i === di ? { ...d, ejercicios: d.ejercicios.filter((_, j) => j !== ei) } : d
      ),
    }));

  const addDay = () =>
    setP((prev) => ({
      ...prev,
      days: [
        ...prev.days,
        { dia: `Día ${prev.days.length + 1}`, nombre: "Nuevo día", ejercicios: [emptyExercise()] },
      ],
    }));

  const removeDay = (di: number) =>
    setP((prev) => ({ ...prev, days: prev.days.filter((_, i) => i !== di) }));

  const patchNutrition = (patch: Partial<GeneratedProgram["nutrition"]>) =>
    setP((prev) => ({ ...prev, nutrition: { ...prev.nutrition, ...patch } }));

  const patchMeal = (mi: number, col: 0 | 1, value: string) =>
    setP((prev) => ({
      ...prev,
      nutrition: {
        ...prev.nutrition,
        meals: prev.nutrition.meals.map((m, i) =>
          i === mi ? ([col === 0 ? value : m[0], col === 1 ? value : m[1]] as [string, string]) : m
        ),
      },
    }));

  const addMeal = () =>
    setP((prev) => ({
      ...prev,
      nutrition: { ...prev.nutrition, meals: [...prev.nutrition.meals, ["", ""] as [string, string]] },
    }));

  const removeMeal = (mi: number) =>
    setP((prev) => ({
      ...prev,
      nutrition: { ...prev.nutrition, meals: prev.nutrition.meals.filter((_, i) => i !== mi) },
    }));

  const num = (value: string) => Number(value.replace(/[^0-9.]/g, "")) || 0;

  return (
    <div className="modal-overlay" onClick={() => !publishing && onClose()}>
      <div className="modal program-editor" onClick={(e) => e.stopPropagation()}>
        <div className="focus-bar">
          <div>
            <span className="focus-eyebrow">Editor del plan sugerido por IA</span>
            <h2 style={{ margin: "4px 0 0", fontSize: "1.15rem" }}>
              Revisá y editá antes de publicar — {clientName}
            </h2>
          </div>
          <button className="btn btn-outline" onClick={onClose} disabled={publishing}>
            Cerrar
          </button>
        </div>

        {(p.perfil || p.justificacion) && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Análisis (referencia)</h3>
            {p.perfil && (
              <p style={{ whiteSpace: "pre-wrap", margin: "0 0 10px", fontSize: ".92rem" }}>
                <b>Perfil:</b> {p.perfil}
              </p>
            )}
            {p.justificacion && (
              <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: ".92rem" }}>
                <b>Justificación:</b> {p.justificacion}
              </p>
            )}
          </div>
        )}

        <div className="card block-config" style={{ marginBottom: 16 }}>
          <div className="row-between" style={{ marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>Bloque de progresión</h3>
            <span className="badge">{p.block?.scheme ?? `Doble progresión · ${weeks} semanas`}</span>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "0 0 160px" }}>
              <label className="lbl">Semanas del bloque</label>
              <select
                className="input"
                value={weeks}
                onChange={(e) => setWeeks(Number(e.target.value))}
              >
                <option value={4}>4 semanas</option>
                <option value={5}>5 semanas</option>
                <option value={6}>6 semanas</option>
              </select>
            </div>
            <button className="btn btn-outline" onClick={recalc} title="Recalcular la curva desde Sem 1">
              Recalcular progresión
            </button>
          </div>
          <div style={{ marginTop: 12 }}>
            <label className="lbl">Guía del bloque (la ve el alumno)</label>
            <textarea
              className="input"
              rows={2}
              value={p.block?.guideline ?? ""}
              onChange={(e) => patchBlock({ guideline: e.target.value })}
            />
          </div>
          <p className="muted" style={{ margin: "8px 0 0", fontSize: ".82rem" }}>
            La curva (reps / peso / RIR) se calcula automáticamente según el perfil. Cargá el
            “Peso Sem 1” de cada ejercicio para obtener los kilos exactos por semana.
          </p>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="row-between" style={{ marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>Rutina ({p.days.length} días)</h3>
            <button className="btn btn-outline" onClick={addDay}>
              + Día
            </button>
          </div>

          {p.days.map((d, di) => (
            <div className="day-section" key={di}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div style={{ flex: "1 1 200px" }}>
                  <label className="lbl">Nombre del día</label>
                  <input
                    className="input"
                    value={d.nombre}
                    onChange={(e) => patchDay(di, { nombre: e.target.value })}
                  />
                </div>
                <div style={{ flex: "0 1 140px" }}>
                  <label className="lbl">Etiqueta</label>
                  <input
                    className="input"
                    value={d.dia}
                    onChange={(e) => patchDay(di, { dia: e.target.value })}
                  />
                </div>
                <button
                  className="btn btn-danger"
                  style={{ padding: "8px 12px" }}
                  onClick={() => removeDay(di)}
                  disabled={p.days.length <= 1}
                >
                  Eliminar día
                </button>
              </div>

              <div className="scroll-x" style={{ marginTop: 10 }}>
                <table className="data-table" style={{ minWidth: 800 }}>
                  <thead>
                    <tr>
                      <th>Ejercicio</th>
                      <th style={{ width: 66 }}>Series</th>
                      <th style={{ width: 84 }}>Reps</th>
                      <th style={{ width: 92 }}>Peso S1</th>
                      <th style={{ width: 104 }}>Descanso</th>
                      <th>Notas</th>
                      <th style={{ width: 44 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {d.ejercicios.map((ex, ei) => (
                      <tr key={ei}>
                        <td>
                          <input
                            className="input ex-name-input"
                            value={ex.ejercicio}
                            onChange={(e) => patchEx(di, ei, { ejercicio: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            className="input"
                            inputMode="numeric"
                            value={ex.series ?? ""}
                            onChange={(e) =>
                              patchEx(di, ei, {
                                series: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null,
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="input"
                            value={ex.reps ?? ""}
                            onChange={(e) => patchEx(di, ei, { reps: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            className="input"
                            inputMode="decimal"
                            placeholder="kg"
                            value={ex.base_weight ?? ""}
                            onChange={(e) => setBaseWeight(di, ei, numOrNull(e.target.value))}
                          />
                        </td>
                        <td>
                          <input
                            className="input"
                            value={ex.descanso ?? ""}
                            onChange={(e) => patchEx(di, ei, { descanso: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            className="input"
                            value={ex.notas ?? ""}
                            onChange={(e) => patchEx(di, ei, { notas: e.target.value })}
                          />
                        </td>
                        <td>
                          <button
                            className="btn btn-danger"
                            style={{ padding: "6px 10px" }}
                            onClick={() => removeEx(di, ei)}
                            title="Quitar ejercicio"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="btn btn-outline"
                style={{ marginTop: 8 }}
                onClick={() => addEx(di)}
              >
                + Ejercicio
              </button>

              {d.ejercicios.length > 0 && (
                <div className="scroll-x" style={{ marginTop: 14 }}>
                  <h4 style={{ margin: "0 0 8px", fontSize: ".9rem" }}>
                    Progresión del bloque (Sem 1–{weeks})
                  </h4>
                  <table className="data-table progression-edit" style={{ minWidth: 140 + weeks * 118 }}>
                    <thead>
                      <tr>
                        <th>Ejercicio</th>
                        {weekNums.map((w) => (
                          <th key={w}>Sem {w}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {d.ejercicios.map((ex, ei) => (
                        <tr key={ei}>
                          <td>
                            <b className="ex-name-text">{ex.ejercicio || "—"}</b>
                          </td>
                          {weekNums.map((w) => {
                            const t =
                              (ex.progresion ?? []).find((x) => x.sem === w) ??
                              ({ sem: w, reps: null, peso: null, rir: null } as WeekTarget);
                            return (
                              <td key={w}>
                                <div className="prog-cell">
                                  <input
                                    className="input prog-input"
                                    placeholder="reps"
                                    value={t.reps ?? ""}
                                    onChange={(e) =>
                                      patchWeek(di, ei, w, { reps: e.target.value || null })
                                    }
                                  />
                                  <input
                                    className="input prog-input"
                                    placeholder="kg"
                                    inputMode="decimal"
                                    value={t.peso ?? ""}
                                    onChange={(e) =>
                                      patchWeek(di, ei, w, { peso: numOrNull(e.target.value) })
                                    }
                                  />
                                  <span className="prog-rir">RIR {t.rir ?? "—"}</span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Nutrición</h3>
          <div className="grid-4" style={{ marginBottom: 10 }}>
            <div>
              <label className="lbl">Calorías (kcal)</label>
              <input
                className="input"
                inputMode="numeric"
                value={p.nutrition.cal}
                onChange={(e) => patchNutrition({ cal: num(e.target.value) })}
              />
            </div>
            <div>
              <label className="lbl">Proteínas (g)</label>
              <input
                className="input"
                inputMode="numeric"
                value={p.nutrition.prot}
                onChange={(e) => patchNutrition({ prot: num(e.target.value) })}
              />
            </div>
            <div>
              <label className="lbl">Carbohidratos (g)</label>
              <input
                className="input"
                inputMode="numeric"
                value={p.nutrition.carbs}
                onChange={(e) => patchNutrition({ carbs: num(e.target.value) })}
              />
            </div>
            <div>
              <label className="lbl">Grasas (g)</label>
              <input
                className="input"
                inputMode="numeric"
                value={p.nutrition.fat}
                onChange={(e) => patchNutrition({ fat: num(e.target.value) })}
              />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="lbl">Fuentes de proteína</label>
            <input
              className="input"
              value={p.nutrition.proteinSources}
              onChange={(e) => patchNutrition({ proteinSources: e.target.value })}
            />
          </div>

          <h4 style={{ margin: "16px 0 8px" }}>Comidas</h4>
          {p.nutrition.meals.map((m, mi) => (
            <div className="grid-2" key={mi} style={{ marginBottom: 8, alignItems: "end" }}>
              <input
                className="input"
                placeholder="Comida (ej. Desayuno)"
                value={m[0]}
                onChange={(e) => patchMeal(mi, 0, e.target.value)}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="input"
                  placeholder="Sugerencia"
                  value={m[1]}
                  onChange={(e) => patchMeal(mi, 1, e.target.value)}
                />
                <button
                  className="btn btn-danger"
                  style={{ padding: "8px 12px" }}
                  onClick={() => removeMeal(mi)}
                  title="Quitar comida"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          <button className="btn btn-outline" onClick={addMeal}>
            + Comida
          </button>
        </div>

        <div className="editor-actions">
          <button className="btn btn-outline" onClick={onClose} disabled={publishing}>
            Cancelar
          </button>
          <button
            className="btn btn-success"
            onClick={() => onPublish(p)}
            disabled={publishing || !p.days.length}
          >
            {publishing ? "Publicando…" : "Aprobar y Publicar"}
          </button>
        </div>
      </div>
    </div>
  );
}

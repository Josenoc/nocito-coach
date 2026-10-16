"use client";

import { useState } from "react";
import type { GeneratedProgram, ProgramDay, ProgramExercise } from "@/app/lib/program";

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
  const [p, setP] = useState<GeneratedProgram>(() => clone(program));

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
                <table className="data-table" style={{ minWidth: 720 }}>
                  <thead>
                    <tr>
                      <th>Ejercicio</th>
                      <th style={{ width: 70 }}>Series</th>
                      <th style={{ width: 90 }}>Reps</th>
                      <th style={{ width: 110 }}>Descanso</th>
                      <th>Notas</th>
                      <th style={{ width: 44 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {d.ejercicios.map((ex, ei) => (
                      <tr key={ei}>
                        <td>
                          <input
                            className="input"
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

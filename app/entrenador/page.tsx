'use client';

import { useState } from 'react';
import type { Alumno, RegistroProgreso, Rutina } from '@/lib/types';

export default function EntrenadorPage() {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [registros, setRegistros] = useState<RegistroProgreso[]>([]);
  const [selected, setSelected] = useState<Alumno | null>(null);
  const [pass, setPass] = useState('');
  const [auth, setAuth] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'historial' | 'rutinas'>('historial');
  const [rutinas, setRutinas] = useState<Rutina[]>([]);
  const [nuevaRutina, setNuevaRutina] = useState('');
  const [ejercicios, setEjercicios] = useState<Array<{nombre: string; series_default?: number|null; reps_default?: number|null; peso_default?: number|null; unidad_peso: 'kg'|'lbs'}>>([
    { nombre: '', unidad_peso: 'kg' }
  ]);

  const login = (e: React.FormEvent) => {
    e.preventDefault();
    if (pass === 'nocito-entrenador-2026') {
      setAuth(true);
      cargarAlumnos();
    } else {
      alert('Contraseña incorrecta');
    }
  };

  const cargarAlumnos = async () => {
    setLoading(true);
    const res = await fetch('/api/entrenador/alumnos');
    const json = await res.json();
    if (json.ok) setAlumnos(json.alumnos);
    setLoading(false);
  };

  const verAlumno = async (al: Alumno) => {
    setSelected(al);
    setTab('historial');
    const res = await fetch(`/api/progreso?alumno_id=${al.id}`);
    const json = await res.json();
    if (json.ok) setRegistros(json.registros);
    await cargarRutinas(al);
  };

  const cargarRutinas = async (al: Alumno) => {
    const res = await fetch(`/api/entrenador/rutinas?password=nocito-entrenador-2026&alumno_id=${al.id}`);
    const json = await res.json();
    if (!json.error) setRutinas(json.rutinas || []);
  };

  const agregarEjercicio = () => {
    setEjercicios([...ejercicios, { nombre: '', unidad_peso: 'kg' }]);
  };

  const crearRutina = async () => {
    if (!selected || !nuevaRutina.trim()) return;
    const payload = {
      password: 'nocito-entrenador-2026',
      alumno_id: selected.id,
      nombre: nuevaRutina.trim(),
      ejercicios: ejercicios.filter(e => e.nombre.trim()).map(e => ({
        ...e,
        nombre: e.nombre.trim(),
        series_default: e.series_default || null,
        reps_default: e.reps_default || null,
        peso_default: e.peso_default || null
      }))
    };
    const res = await fetch('/api/entrenador/rutinas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      alert('Rutina creada');
      setNuevaRutina('');
      setEjercicios([{ nombre: '', unidad_peso: 'kg' }]);
      await cargarRutinas(selected);
    } else {
      alert(json.error || 'Error');
    }
  };

  const exportarExcel = (alumnoId?: string) => {
    const q = new URLSearchParams({ password: 'nocito-entrenador-2026' });
    if (alumnoId) q.set('alumno_id', alumnoId);
    window.location.href = `/api/entrenador/export?${q.toString()}`;
  };

  if (!auth) {
    return (
      <main className="section">
        <div className="container" style={{ maxWidth: 420, margin: '60px auto' }}>
          <h2>Panel Entrenador</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 20 }}>Acceso exclusivo para José</p>
          <form onSubmit={login}>
            <input type="password" placeholder="Contraseña" value={pass} onChange={(e) => setPass(e.target.value)} style={{ width: '100%', padding: 12, marginBottom: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)' }} />
            <button className="btn btn-primary">Ingresar</button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="section">
      <div className="container">
        <h2>Panel de Control - José</h2>
        <p style={{ color: 'var(--muted)' }}>Seguimiento y evolución de cargas por alumno</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px,320px) 1fr', gap: 24, marginTop: 32 }}>
          <aside style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 18, background: 'linear-gradient(180deg,#121212,#0D0D0D)', height: 'fit-content' }}>
            <h4 style={{ marginBottom: 14 }}>Alumnos ({alumnos.length})</h4>
            {loading && <p style={{ color: 'var(--muted)' }}>Cargando...</p>}
            {alumnos.map((a) => (
              <button key={a.id} onClick={() => verAlumno(a)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 12, marginBottom: 8, background: selected?.id === a.id ? 'var(--orange)' : 'transparent', color: selected?.id === a.id ? '#000' : 'inherit', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', transition: '.2s' }}>
                {a.nombre}
              </button>
            ))}
          </aside>
          <section>
            {selected && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <button className={`btn ${tab === 'historial' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('historial')}>Historial</button>
                <button className={`btn ${tab === 'rutinas' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('rutinas')}>Rutinas</button>
              </div>
            )}
            {tab === 'historial' && (
              <>
                <h3 style={{ marginBottom: 8 }}>{selected ? `Historial: ${selected.nombre}` : 'Selecciona un alumno para ver su evolución'}</h3>
                {selected && <p style={{ color: 'var(--muted)', marginBottom: 16 }}>{registros.length} registros</p>}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                  <button className="btn btn-outline" onClick={() => exportarExcel()}>Exportar todos (.xlsx)</button>
                  {selected && (
                    <button className="btn btn-primary" onClick={() => exportarExcel(selected.id)}>Exportar {selected.nombre} (.xlsx)</button>
                  )}
                </div>
                <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
                    <thead style={{ background: 'linear-gradient(180deg,#121212,#0D0D0D)' }}>
                      <tr>
                        <th style={{ textAlign: 'left', padding: 12, fontSize: '.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Fecha</th>
                        <th style={{ textAlign: 'left', padding: 12, fontSize: '.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Ejercicio</th>
                        <th style={{ textAlign: 'left', padding: 12, fontSize: '.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Series</th>
                        <th style={{ textAlign: 'left', padding: 12, fontSize: '.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Reps</th>
                        <th style={{ textAlign: 'left', padding: 12, fontSize: '.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Peso</th>
                        <th style={{ textAlign: 'left', padding: 12, fontSize: '.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Fuente</th>
                        <th style={{ textAlign: 'left', padding: 12, fontSize: '.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Notas</th>
                        <th style={{ textAlign: 'left', padding: 12, fontSize: '.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Audio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registros.map((r) => (
                        <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: 12 }}>{r.fecha}</td>
                          <td style={{ padding: 12 }}>{r.ejercicio}</td>
                          <td style={{ padding: 12 }}>{r.series ?? '-'}</td>
                          <td style={{ padding: 12 }}>{r.repeticiones ?? '-'}</td>
                          <td style={{ padding: 12 }}>{r.peso_utilizado ? `${r.peso_utilizado} ${r.unidad_peso}` : '-'}</td>
                          <td style={{ padding: 12 }}>{r.fuente === 'audio' ? 'Audio' : 'Manual'}</td>
                          <td style={{ padding: 12, color: 'var(--muted)', maxWidth: 240, whiteSpace: 'pre-wrap' }}>{r.notas || '-'}</td>
                          <td style={{ padding: 12 }}>
                            {r.audio_url ? (
                              <a href={r.audio_url} target="_blank" rel="noopener" className="link-internal">Escuchar</a>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {tab === 'rutinas' && selected && (
              <div>
                <h3 style={{ marginBottom: 8 }}>Rutinas - {selected.nombre}</h3>
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 18, background: 'linear-gradient(180deg,#121212,#0D0D0D)', marginBottom: 20 }}>
                  <h4 style={{ marginBottom: 12 }}>Crear nueva rutina activa</h4>
                  <input placeholder="Nombre de rutina (ej: Fuerza 3x)" value={nuevaRutina} onChange={(e) => setNuevaRutina(e.target.value)} style={{ width: '100%', padding: 10, marginBottom: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
                  <div style={{ display: 'grid', gap: 10 }}>
                    {ejercicios.map((ex, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr repeat(4, 1fr)', gap: 8 }}>
                        <input placeholder="Ejercicio" value={ex.nombre} onChange={(e) => { const arr = [...ejercicios]; arr[idx].nombre = e.target.value; setEjercicios(arr); }} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
                        <input type="number" placeholder="Series" value={ex.series_default ?? ''} onChange={(e) => { const arr = [...ejercicios]; arr[idx].series_default = e.target.value ? Number(e.target.value) : null; setEjercicios(arr); }} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
                        <input type="number" placeholder="Reps" value={ex.reps_default ?? ''} onChange={(e) => { const arr = [...ejercicios]; arr[idx].reps_default = e.target.value ? Number(e.target.value) : null; setEjercicios(arr); }} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
                        <input type="number" step="0.1" placeholder="Peso" value={ex.peso_default ?? ''} onChange={(e) => { const arr = [...ejercicios]; arr[idx].peso_default = e.target.value ? Number(e.target.value) : null; setEjercicios(arr); }} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
                        <select value={ex.unidad_peso} onChange={(e) => { const arr = [...ejercicios]; arr[idx].unidad_peso = e.target.value as 'kg'|'lbs'; setEjercicios(arr); }} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
                          <option value="kg">kg</option>
                          <option value="lbs">lbs</option>
                        </select>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button className="btn btn-outline" onClick={agregarEjercicio}>Agregar ejercicio</button>
                    <button className="btn btn-primary" onClick={crearRutina}>Guardar rutina</button>
                  </div>
                </div>
                <div>
                  {rutinas.map(r => (
                    <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <strong>{r.nombre}</strong>
                        <span style={{ color: r.activa ? 'var(--orange)' : 'var(--muted)' }}>{r.activa ? 'ACTIVA' : 'Inactiva'}</span>
                      </div>
                      {(r as any).ejercicios_asignados?.length > 0 && (
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {(r as any).ejercicios_asignados.map((e: any) => (
                            <li key={e.id} style={{ color: 'var(--muted)' }}>
                              {e.orden+1}. {e.nombre} {e.series_default ? `- ${e.series_default}x${e.reps_default || ''}` : ''} {e.peso_default ? `@${e.peso_default}${e.unidad_peso}` : ''}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
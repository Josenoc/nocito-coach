'use client';

import { useState } from 'react';
import type { Alumno, RegistroProgreso } from '@/lib/types';

export default function EntrenadorPage() {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [registros, setRegistros] = useState<RegistroProgreso[]>([]);
  const [selected, setSelected] = useState<Alumno | null>(null);
  const [pass, setPass] = useState('');
  const [auth, setAuth] = useState(false);
  const [loading, setLoading] = useState(false);

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
    const res = await fetch(`/api/progreso?alumno_id=${al.id}`);
    const json = await res.json();
    if (json.ok) setRegistros(json.registros);
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
            <h3 style={{ marginBottom: 8 }}>{selected ? `Historial: ${selected.nombre}` : 'Seleccioná un alumno para ver su evolución'}</h3>
            {selected && <p style={{ color: 'var(--muted)', marginBottom: 16 }}>{registros.length} registros</p>}
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
                      <td style={{ padding: 12 }}>{r.fuente === 'audio' ? '🎙️ Audio' : '📝 Manual'}</td>
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
          </section>
        </div>
      </div>
    </main>
  );
}
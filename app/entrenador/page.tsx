'use client';

import { useState } from 'react';
import type { Alumno, RegistroProgreso } from '@/lib/types';

export default function EntrenadorPage() {
  const [token, setToken] = useState('');
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [registros, setRegistros] = useState<RegistroProgreso[]>([]);
  const [selected, setSelected] = useState<Alumno | null>(null);
  const [pass, setPass] = useState('');
  const [auth, setAuth] = useState(false);

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
    const res = await fetch('/api/entrenador/alumnos');
    const json = await res.json();
    if (json.ok) setAlumnos(json.alumnos);
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
          <form onSubmit={login}>
            <input type="password" placeholder="Contraseña" value={pass} onChange={(e) => setPass(e.target.value)} style={{ width: '100%', padding: 12, marginBottom: 12 }} />
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
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, marginTop: 32 }}>
          <aside style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
            <h4>Alumnos</h4>
            {alumnos.map((a) => (
              <button key={a.id} onClick={() => verAlumno(a)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 10, marginBottom: 8, background: selected?.id === a.id ? 'var(--orange)' : 'transparent', color: selected?.id === a.id ? '#000' : 'inherit', border: '1px solid var(--border)', borderRadius: 6 }}>
                {a.nombre}
              </button>
            ))}
          </aside>
          <section>
            <h3>{selected ? `Historial: ${selected.nombre}` : 'Seleccioná un alumno'}</h3>
            <div style={{ overflowX: 'auto', marginTop: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: 10 }}>Fecha</th>
                    <th style={{ textAlign: 'left', padding: 10 }}>Ejercicio</th>
                    <th style={{ textAlign: 'left', padding: 10 }}>Series</th>
                    <th style={{ textAlign: 'left', padding: 10 }}>Reps</th>
                    <th style={{ textAlign: 'left', padding: 10 }}>Peso</th>
                    <th style={{ textAlign: 'left', padding: 10 }}>Fuente</th>
                    <th style={{ textAlign: 'left', padding: 10 }}>Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((r) => (
                    <tr key={r.id}>
                      <td style={{ padding: 10 }}>{r.fecha}</td>
                      <td style={{ padding: 10 }}>{r.ejercicio}</td>
                      <td style={{ padding: 10 }}>{r.series ?? '-'}</td>
                      <td style={{ padding: 10 }}>{r.repeticiones ?? '-'}</td>
                      <td style={{ padding: 10 }}>{r.peso_utilizado ? `${r.peso_utilizado} ${r.unidad_peso}` : '-'}</td>
                      <td style={{ padding: 10 }}>{r.fuente}</td>
                      <td style={{ padding: 10 }}>{r.notas || '-'}</td>
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
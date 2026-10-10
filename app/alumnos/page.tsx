'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Alumno, RegistroProgreso } from '@/lib/types';

export default function AlumnosPage() {
  const [token, setToken] = useState('');
  const [alumno, setAlumno] = useState<Alumno | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registros, setRegistros] = useState<RegistroProgreso[]>([]);
  const [form, setForm] = useState({
    ejercicio: '',
    series: '',
    repeticiones: '',
    peso_utilizado: '',
    unidad_peso: 'kg' as 'kg' | 'lbs',
    notas: '',
    fuente: 'manual' as 'manual' | 'audio'
  });
  const [grabando, setGrabando] = useState(false);
  const [transcribiendo, setTranscribiendo] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [chunks, setChunks] = useState<Blob[]>([]);
  const audioRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('alumno_token');
    if (t) setToken(t);
  }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/alumnos/acceso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setAlumno(json.alumno);
      localStorage.setItem('alumno_token', token);
      await cargarRegistros(json.alumno.id);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  const cargarRegistros = async (alumno_id: string) => {
    const res = await fetch(`/api/progreso?alumno_id=${alumno_id}`);
    const json = await res.json();
    if (json.ok) setRegistros(json.registros);
  };

  const logout = () => {
    setAlumno(null);
    setRegistros([]);
    localStorage.removeItem('alumno_token');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioRef.current = stream;
      const mr = new MediaRecorder(stream);
      const c: Blob[] = [];
      mr.ondataavailable = (e) => e.data.size > 0 && c.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(c, { type: 'audio/webm' });
        await transcribirAudio(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      setChunks([]);
      setMediaRecorder(mr);
      mr.start();
      setGrabando(true);
    } catch (err) {
      alert('No se pudo acceder al micrófono');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setGrabando(false);
    }
  };

  const transcribirAudio = async (blob: Blob) => {
    setTranscribiendo(true);
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'nota.webm');
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      const extRes = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: json.text })
      });
      const extJson = await extRes.json();
      if (extJson.ok && extJson.sets?.length) {
        const s = extJson.sets[0];
        setForm((f) => ({
          ...f,
          ejercicio: s.ejercicio || f.ejercicio,
          series: s.series?.toString() || f.series,
          repeticiones: s.repeticiones?.toString() || f.repeticiones,
          peso_utilizado: s.peso_utilizado?.toString() || f.peso_utilizado,
          unidad_peso: s.unidad_peso || f.unidad_peso,
          notas: s.notas || extJson.notas_generales || f.notas,
          fuente: 'audio'
        }));
        alert('Datos extraídos desde audio. Revisá y guardá.');
      } else {
        setForm((f) => ({ ...f, fuente: 'audio', notas: json.text }));
        alert('Transcripción lista. Copiá/ajustá en notas.');
      }
    } catch (err: any) {
      alert(err.message || 'Error transcribiendo');
    } finally {
      setTranscribiendo(false);
    }
  };

  const guardarManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alumno) return;
    try {
      const res = await fetch('/api/progreso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alumno_id: alumno.id,
          ejercicio: form.ejercicio,
          series: form.series || null,
          repeticiones: form.repeticiones || null,
          peso_utilizado: form.peso_utilizado || null,
          unidad_peso: form.unidad_peso,
          notas: form.notas || null,
          fuente: form.fuente
        })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setForm({ ejercicio: '', series: '', repeticiones: '', peso_utilizado: '', unidad_peso: 'kg', notas: '', fuente: 'manual' });
      await cargarRegistros(alumno.id);
      alert('Guardado');
    } catch (err: any) {
      alert(err.message || 'Error guardando');
    }
  };

  if (!alumno) {
    return (
      <main className="section">
        <div className="container" style={{ maxWidth: 480, margin: '60px auto' }}>
          <h2>Acceso Alumnos</h2>
          <form onSubmit={login}>
            <input placeholder="Ingresá tu token de acceso" value={token} onChange={(e) => setToken(e.target.value)} style={{ width: '100%', padding: 12, marginBottom: 12 }} />
            <button className="btn btn-primary" disabled={loading}>{loading ? 'Ingresando...' : 'Ingresar'}</button>
            {error && <p style={{ color: 'var(--orange)', marginTop: 12 }}>{error}</p>}
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="section">
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Hola, {alumno.nombre}</h2>
          <button onClick={logout} className="btn btn-outline">Salir</button>
        </div>

        <section style={{ marginTop: 40 }}>
          <h3>Registrar progreso semanal</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <button type="button" onClick={grabando ? stopRecording : startRecording} className={`btn ${grabando ? 'btn-outline' : 'btn-primary'}`} disabled={transcribiendo}>
              {grabando ? 'Detener grabación' : transcribiendo ? 'Procesando...' : 'Grabar audio (nota de voz)'}
            </button>
          </div>

          <form onSubmit={guardarManual} style={{ display: 'grid', gap: 12, maxWidth: 680 }}>
            <input placeholder="Ejercicio (ej: Sentadillas)" value={form.ejercicio} onChange={(e) => setForm({ ...form, ejercicio: e.target.value })} required />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
              <input type="number" placeholder="Series" value={form.series} onChange={(e) => setForm({ ...form, series: e.target.value })} />
              <input type="number" placeholder="Repeticiones" value={form.repeticiones} onChange={(e) => setForm({ ...form, repeticiones: e.target.value })} />
              <input type="number" step="0.1" placeholder="Peso" value={form.peso_utilizado} onChange={(e) => setForm({ ...form, peso_utilizado: e.target.value })} />
              <select value={form.unidad_peso} onChange={(e) => setForm({ ...form, unidad_peso: e.target.value as 'kg' | 'lbs' })}>
                <option value="kg">kg</option>
                <option value="lbs">lbs</option>
              </select>
            </div>
            <textarea placeholder="Notas / comentarios" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={3} />
            <button className="btn btn-primary" type="submit">Guardar registro</button>
          </form>
        </section>

        <section style={{ marginTop: 60 }}>
          <h3>Mis registros</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
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
    </main>
  );
}
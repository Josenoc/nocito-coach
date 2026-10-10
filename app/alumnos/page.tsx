'use client';

import { useState, useEffect, useRef } from 'react';
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
  const [subiendoAudio, setSubiendoAudio] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [chunks, setChunks] = useState<Blob[]>([]);
  const audioRef = useRef<MediaStream | null>(null);
  const [ultimoAudioUrl, setUltimoAudioUrl] = useState<string | null>(null);

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

  const uploadAudio = async (blob: Blob): Promise<string | null> => {
    if (!alumno) return null;
    setSubiendoAudio(true);
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'nota.webm');
      formData.append('alumno_id', alumno.id);
      const res = await fetch('/api/audio/upload', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setUltimoAudioUrl(json.audio_url);
      return json.audio_url;
    } catch (err: any) {
      alert(err.message || 'Error subiendo audio');
      return null;
    } finally {
      setSubiendoAudio(false);
    }
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
        setChunks([]);
        const audioUrl = await uploadAudio(blob);
        await transcribirAudio(blob, audioUrl);
        stream.getTracks().forEach((t) => t.stop());
      };
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

  const transcribirAudio = async (blob: Blob, audioUrl: string | null = null) => {
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
        alert('Transcripción lista. Ajustá los campos y guardá.');
      }
      if (audioUrl) setUltimoAudioUrl(audioUrl);
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
          fuente: form.fuente,
          audio_url: ultimoAudioUrl || null
        })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setForm({ ejercicio: '', series: '', repeticiones: '', peso_utilizado: '', unidad_peso: 'kg', notas: '', fuente: 'manual' });
      setUltimoAudioUrl(null);
      await cargarRegistros(alumno.id);
      alert('Guardado correctamente');
    } catch (err: any) {
      alert(err.message || 'Error guardando');
    }
  };

  if (!alumno) {
    return (
      <main className="section">
        <div className="container" style={{ maxWidth: 480, margin: '60px auto' }}>
          <h2>Acceso Alumnos</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 20 }}>Ingresá con tu token de acceso</p>
          <form onSubmit={login}>
            <input placeholder="Token de acceso" value={token} onChange={(e) => setToken(e.target.value)} style={{ width: '100%', padding: 12, marginBottom: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)' }} />
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2>Panel del alumno</h2>
            <p style={{ color: 'var(--muted)' }}>Hola, {alumno.nombre}</p>
          </div>
          <button onClick={logout} className="btn btn-outline">Salir</button>
        </div>

        <section style={{ marginTop: 40, background: 'linear-gradient(180deg,#121212,#0D0D0D)', border: '1px solid var(--border)', borderRadius: 10, padding: 24 }}>
          <h3 style={{ marginBottom: 16 }}>Registrar progreso semanal</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
            <button type="button" onClick={grabando ? stopRecording : startRecording} className={`btn ${grabando ? 'btn-outline' : 'btn-primary'}`} disabled={transcribiendo || subiendoAudio}>
              {grabando ? 'Detener grabación' : transcribiendo ? 'Transcribiendo...' : subiendoAudio ? 'Subiendo audio...' : 'Grabar audio (nota de voz)'}
            </button>
            {ultimoAudioUrl && <span style={{ color: 'var(--blue)', fontSize: '.9rem', alignSelf: 'center' }}>Audio guardado en Storage</span>}
          </div>

          <form onSubmit={guardarManual} style={{ display: 'grid', gap: 14, maxWidth: 720 }}>
            <input placeholder="Ejercicio (ej: Sentadillas)" value={form.ejercicio} onChange={(e) => setForm({ ...form, ejercicio: e.target.value })} required style={{ padding: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 12 }}>
              <input type="number" placeholder="Series" value={form.series} onChange={(e) => setForm({ ...form, series: e.target.value })} style={{ padding: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
              <input type="number" placeholder="Repeticiones" value={form.repeticiones} onChange={(e) => setForm({ ...form, repeticiones: e.target.value })} style={{ padding: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
              <input type="number" step="0.1" placeholder="Peso" value={form.peso_utilizado} onChange={(e) => setForm({ ...form, peso_utilizado: e.target.value })} style={{ padding: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
              <select value={form.unidad_peso} onChange={(e) => setForm({ ...form, unidad_peso: e.target.value as 'kg' | 'lbs' })} style={{ padding: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
                <option value="kg">kg</option>
                <option value="lbs">lbs</option>
              </select>
            </div>
            <textarea placeholder="Notas / comentarios" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={3} style={{ padding: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" type="submit">Guardar registro</button>
              <select value={form.fuente} onChange={(e) => setForm({ ...form, fuente: e.target.value as 'manual' | 'audio' })} style={{ padding: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
                <option value="manual">Fuente: Manual</option>
                <option value="audio">Fuente: Audio</option>
              </select>
            </div>
          </form>
        </section>

        <section style={{ marginTop: 60 }}>
          <h3 style={{ marginBottom: 16 }}>Mis registros</h3>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead style={{ background: 'linear-gradient(180deg,#121212,#0D0D0D)' }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: 12, fontSize: '.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Fecha</th>
                  <th style={{ textAlign: 'left', padding: 12, fontSize: '.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Ejercicio</th>
                  <th style={{ textAlign: 'left', padding: 12, fontSize: '.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Series</th>
                  <th style={{ textAlign: 'left', padding: 12, fontSize: '.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Reps</th>
                  <th style={{ textAlign: 'left', padding: 12, fontSize: '.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Peso</th>
                  <th style={{ textAlign: 'left', padding: 12, fontSize: '.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Fuente</th>
                  <th style={{ textAlign: 'left', padding: 12, fontSize: '.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Notas</th>
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
                    <td style={{ padding: 12, color: 'var(--muted)' }}>{r.notas || '-'}</td>
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
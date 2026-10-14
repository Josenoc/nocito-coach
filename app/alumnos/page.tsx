'use client';

import { useState, useEffect, useRef } from 'react';
import type { Alumno, RegistroProgreso, PerfilAlumno } from '@/lib/types';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const OBJETIVOS: [string, string][] = [
  ['ganar-masa', 'Ganar masa muscular'],
  ['perder-grasa', 'Perder grasa corporal'],
  ['recomposicion', 'Recomposición corporal'],
];

const EXPERIENCIAS: [string, string][] = [
  ['principiante', 'Principiante'],
  ['intermedio', 'Intermedio'],
  ['avanzado', 'Avanzado'],
];

const PREFERENCIAS = ['Omnívoro', 'Vegetariano', 'Vegano', 'Celíaco', 'Sin lactosa'];

const inputStyle = {
  padding: 12,
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  width: '100%',
} as const;

const EMPTY_PERFIL = {
  sexo: 'Masculino',
  edad: '',
  altura: '',
  peso: '',
  objetivo: 'ganar-masa',
  experiencia: 'principiante',
  dias: '3',
  preferencias: ['Omnívoro'] as string[],
};

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
  const [tab, setTab] = useState<'progreso' | 'rutina' | 'evolucion'>('progreso');
  const [rutina, setRutina] = useState<any>(null);
  const [evolucion, setEvolucion] = useState<RegistroProgreso[]>([]);
  const [ejercicioSel, setEjercicioSel] = useState('');
  const [perfilForm, setPerfilForm] = useState({ ...EMPTY_PERFIL });
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [perfilMsg, setPerfilMsg] = useState<string | null>(null);
  const [perfilError, setPerfilError] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('alumno_token');
    if (t) setToken(t);
  }, []);

  const aplicarPerfil = (p?: PerfilAlumno | null) => {
    if (!p) {
      setPerfilForm({ ...EMPTY_PERFIL });
      return;
    }
    setPerfilForm({
      sexo: p.sexo || 'Masculino',
      edad: p.edad ? String(p.edad) : '',
      altura: p.altura ? String(p.altura) : '',
      peso: p.peso ? String(p.peso) : '',
      objetivo: p.objetivo || 'ganar-masa',
      experiencia: p.experiencia || 'principiante',
      dias: p.dias ? String(p.dias) : '3',
      preferencias: p.preferencias?.length ? p.preferencias : ['Omnívoro'],
    });
  };

  const togglePref = (p: string) => {
    setPerfilForm((f) => {
      const has = f.preferencias.includes(p);
      const next = has
        ? f.preferencias.filter((x) => x !== p)
        : [...f.preferencias, p];
      return { ...f, preferencias: next.length ? next : ['Omnívoro'] };
    });
  };

  const guardarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alumno) return;
    setGuardandoPerfil(true);
    setPerfilMsg(null);
    setPerfilError(null);
    try {
      const res = await fetch('/api/alumnos/perfil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: alumno.token_acceso,
          perfil: perfilForm,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setAlumno({ ...alumno, perfil: json.perfil });
      setPerfilMsg('Perfil guardado. ¡Tu plan nutricional está listo!');
    } catch (err: any) {
      setPerfilError(err.message || 'Error guardando el perfil');
    } finally {
      setGuardandoPerfil(false);
    }
  };

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
      aplicarPerfil(json.alumno.perfil);
      localStorage.setItem('alumno_token', token);
      await cargarRegistros(json.alumno.id);
      await cargarDatos(json.alumno);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  const cargarDatos = async (al: Alumno) => {
    try {
      const r = await fetch(`/api/alumnos/rutina?token=${al.token_acceso}`);
      const j = await r.json();
      if (j.rutina) setRutina(j.rutina);
      const e = await fetch(`/api/alumnos/evolucion?token=${al.token_acceso}`);
      const ej = await e.json();
      if (ej.registros) setEvolucion(ej.registros);
    } catch {}
  };

  const cargarRegistros = async (alumno_id: string) => {
    const res = await fetch(`/api/progreso?alumno_id=${alumno_id}`);
    const json = await res.json();
    if (json.ok) setRegistros(json.registros);
  };

  const logout = () => {
    setAlumno(null);
    setRegistros([]);
    setRutina(null);
    setEvolucion([]);
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
          <h3 style={{ marginBottom: 8 }}>Tu perfil y plan nutricional</h3>
          <p style={{ color: 'var(--muted)', marginBottom: 20 }}>
            Completá tus datos para calcular tus macros. Podés actualizarlos cuando quieras.
          </p>

          <form onSubmit={guardarPerfil} style={{ display: 'grid', gap: 16, maxWidth: 720 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 12 }}>
              <select value={perfilForm.sexo} onChange={(e) => setPerfilForm({ ...perfilForm, sexo: e.target.value })} style={inputStyle}>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
              </select>
              <input type="number" placeholder="Edad (años)" value={perfilForm.edad} onChange={(e) => setPerfilForm({ ...perfilForm, edad: e.target.value })} style={inputStyle} required />
              <input type="number" placeholder="Altura (cm)" value={perfilForm.altura} onChange={(e) => setPerfilForm({ ...perfilForm, altura: e.target.value })} style={inputStyle} required />
              <input type="number" step="0.1" placeholder="Peso (kg)" value={perfilForm.peso} onChange={(e) => setPerfilForm({ ...perfilForm, peso: e.target.value })} style={inputStyle} required />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 12 }}>
              <select value={perfilForm.objetivo} onChange={(e) => setPerfilForm({ ...perfilForm, objetivo: e.target.value })} style={inputStyle}>
                {OBJETIVOS.map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
              <select value={perfilForm.experiencia} onChange={(e) => setPerfilForm({ ...perfilForm, experiencia: e.target.value })} style={inputStyle}>
                {EXPERIENCIAS.map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
              <select value={perfilForm.dias} onChange={(e) => setPerfilForm({ ...perfilForm, dias: e.target.value })} style={inputStyle}>
                {[2, 3, 4, 5, 6].map((d) => (
                  <option key={d} value={d}>{d} días / semana</option>
                ))}
              </select>
            </div>

            <div>
              <p style={{ color: 'var(--muted)', fontSize: '.85rem', marginBottom: 8 }}>Preferencias alimentarias</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {PREFERENCIAS.map((p) => {
                  const active = perfilForm.preferencias.includes(p);
                  return (
                    <button type="button" key={p} onClick={() => togglePref(p)} style={{ padding: '8px 14px', borderRadius: 999, cursor: 'pointer', fontSize: '.9rem', border: '1px solid ' + (active ? 'var(--orange)' : 'var(--border)'), background: active ? 'rgba(255,196,0,.12)' : 'var(--surface)', color: active ? 'var(--orange)' : 'var(--text)' }}>{p}</button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" type="submit" disabled={guardandoPerfil}>
                {guardandoPerfil ? 'Guardando...' : 'Guardar perfil'}
              </button>
              {perfilMsg && <span style={{ color: 'var(--blue)', fontSize: '.9rem' }}>{perfilMsg}</span>}
              {perfilError && <span style={{ color: 'var(--orange)', fontSize: '.9rem' }}>{perfilError}</span>}
            </div>
          </form>

          {alumno.perfil?.macros && (
            <div style={{ marginTop: 28, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
              <h4 style={{ marginBottom: 4 }}>Tu plan nutricional</h4>
              <p style={{ color: 'var(--muted)', marginBottom: 16 }}>Mantenimiento estimado: {alumno.perfil.tdee} kcal/día</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 12, marginBottom: 16 }}>
                {[['Calorías', alumno.perfil.macros.cal + ' kcal'], ['Proteínas', alumno.perfil.macros.prot + ' g'], ['Carbohidratos', alumno.perfil.macros.carbs + ' g'], ['Grasas', alumno.perfil.macros.fat + ' g']].map(([label, val]) => (
                  <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
                    <div style={{ color: 'var(--muted)', fontSize: '.8rem', textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</div>
                    <div style={{ color: 'var(--orange)', fontSize: '1.3rem', fontWeight: 700, marginTop: 6 }}>{val}</div>
                  </div>
                ))}
              </div>
              <p style={{ color: 'var(--muted)', marginBottom: 16 }}>{alumno.perfil.macros.proteinSources}</p>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {alumno.perfil.macros.meals.map(([comida, sug]) => (
                    <tr key={comida} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, width: 130 }}>{comida}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{sug}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

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
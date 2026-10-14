import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import type { PerfilAlumno } from '@/lib/types';
import {
  buildNutrition,
  computeTdee,
  OBJECTIVE_LABELS,
  EXPERIENCE_LABELS,
} from '@/app/lib/routine-gen';

export const dynamic = 'force-dynamic';

const SEXOS = ['Masculino', 'Femenino'];
const PREFERENCIAS = ['Omnívoro', 'Vegetariano', 'Vegano', 'Celíaco', 'Sin lactosa'];

function clampInt(value: unknown, min: number, max: number): number | null {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

async function findAlumno(token: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('alumnos')
    .select('*')
    .eq('token_acceso', token)
    .eq('activo', true)
    .single();
  if (error || !data) return null;
  return data as { id: string; perfil?: PerfilAlumno | null };
}

type NormalizeResult =
  | { ok: true; perfil: PerfilAlumno }
  | { ok: false; error: string };

function normalize(raw: unknown): NormalizeResult {
  const o = (raw ?? {}) as Record<string, unknown>;

  const sexo = String(o.sexo ?? '');
  if (!SEXOS.includes(sexo)) return { ok: false, error: 'Elegí un sexo válido.' };

  const edad = clampInt(o.edad, 10, 100);
  if (edad === null) return { ok: false, error: 'Edad inválida (10 a 100 años).' };

  const altura = clampInt(o.altura, 100, 250);
  if (altura === null) return { ok: false, error: 'Altura inválida (100 a 250 cm).' };

  const peso = clampInt(o.peso, 30, 300);
  if (peso === null) return { ok: false, error: 'Peso inválido (30 a 300 kg).' };

  const objetivo = String(o.objetivo ?? '');
  if (!OBJECTIVE_LABELS[objetivo]) return { ok: false, error: 'Elegí un objetivo válido.' };

  const experiencia = String(o.experiencia ?? '');
  if (!EXPERIENCE_LABELS[experiencia]) return { ok: false, error: 'Elegí un nivel válido.' };

  const dias = clampInt(o.dias, 2, 6);
  if (dias === null) return { ok: false, error: 'Elegí los días de entrenamiento (2 a 6).' };

  const rawPrefs = Array.isArray(o.preferencias) ? o.preferencias.map(String) : [];
  const preferencias = rawPrefs.filter((p) => PREFERENCIAS.includes(p));
  const prefs = preferencias.length ? preferencias : ['Omnívoro'];

  const tdee = computeTdee(sexo, peso, altura, edad, dias);
  const macros = buildNutrition(objetivo, peso, prefs, tdee);

  return {
    ok: true,
    perfil: {
      sexo,
      edad,
      altura,
      peso,
      objetivo,
      objetivoLabel: OBJECTIVE_LABELS[objetivo],
      experiencia,
      experienciaLabel: EXPERIENCE_LABELS[experiencia],
      dias,
      preferencias: prefs,
      tdee,
      macros,
      actualizado: new Date().toISOString(),
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    const token = new URL(req.url).searchParams.get('token');
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Token requerido' }, { status: 400 });
    }
    const alumno = await findAlumno(token);
    if (!alumno) {
      return NextResponse.json({ ok: false, error: 'Alumno no encontrado' }, { status: 401 });
    }
    return NextResponse.json({ ok: true, perfil: alumno.perfil ?? null });
  } catch {
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = typeof body?.token === 'string' ? body.token : '';
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Token requerido' }, { status: 400 });
    }

    const alumno = await findAlumno(token);
    if (!alumno) {
      return NextResponse.json(
        { ok: false, error: 'Alumno no encontrado o inactivo' },
        { status: 401 }
      );
    }

    const norm = normalize(body?.perfil);
    if ('error' in norm) {
      return NextResponse.json({ ok: false, error: norm.error }, { status: 400 });
    }

    const { error } = await getSupabaseAdmin()
      .from('alumnos')
      .update({ perfil: norm.perfil })
      .eq('id', alumno.id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, perfil: norm.perfil });
  } catch {
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}

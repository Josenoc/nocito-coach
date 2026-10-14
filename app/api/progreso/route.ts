import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const alumno_id = searchParams.get('alumno_id');
    if (!alumno_id) {
      return NextResponse.json({ ok: false, error: 'alumno_id requerido' }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from('registros_progreso')
      .select('*')
      .eq('alumno_id', alumno_id)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, registros: data });
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { alumno_id, fecha, ejercicio, series, repeticiones, peso_utilizado, unidad_peso, notas, fuente, audio_url, raw_transcripcion, raw_estructurado } = body;

    if (!alumno_id || !ejercicio || !fuente) {
      return NextResponse.json({ ok: false, error: 'alumno_id, ejercicio y fuente son requeridos' }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from('registros_progreso')
      .insert({
        alumno_id,
        fecha: fecha || new Date().toISOString().split('T')[0],
        ejercicio,
        series: series ? Number(series) : null,
        repeticiones: repeticiones ? Number(repeticiones) : null,
        peso_utilizado: peso_utilizado ? Number(peso_utilizado) : null,
        unidad_peso: unidad_peso || 'kg',
        notas: notas || null,
        fuente,
        audio_url: audio_url || null,
        raw_transcripcion: raw_transcripcion || null,
        raw_estructurado: raw_estructurado || null
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, registro: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ ok: false, error: 'Token inválido' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('alumnos')
      .select('*')
      .eq('token_acceso', token)
      .eq('activo', true)
      .single();

    if (error || !data) {
      return NextResponse.json({ ok: false, error: 'Alumno no encontrado o inactivo' }, { status: 401 });
    }

    return NextResponse.json({ ok: true, alumno: data });
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}
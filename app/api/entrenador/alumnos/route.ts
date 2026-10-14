import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('alumnos')
      .select('*')
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, alumnos: data });
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get('audio') as File | null;
    const alumno_id = formData.get('alumno_id') as string | null;
    
    if (!audio || !alumno_id) {
      return NextResponse.json({ ok: false, error: 'audio y alumno_id requeridos' }, { status: 400 });
    }

    const ext = audio.name.split('.').pop() || 'webm';
    const timestamp = Date.now();
    const path = `${alumno_id}/${timestamp}.${ext}`;

    const arrayBuffer = await audio.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.storage
      .from('audios')
      .upload(path, buffer, {
        contentType: audio.type || 'audio/webm',
        upsert: false
      });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('audios')
      .getPublicUrl(path);

    return NextResponse.json({
      ok: true,
      path: data.path,
      audio_url: publicUrlData.publicUrl
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Error interno' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get('audio') as File | null;
    if (!audio) {
      return NextResponse.json({ ok: false, error: 'No se envió audio' }, { status: 400 });
    }

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return NextResponse.json({ ok: false, error: 'GROQ_API_KEY faltante' }, { status: 500 });
    }

    const fd = new FormData();
    fd.append('file', audio);
    fd.append('model', 'whisper-large-v3');
    fd.append('language', 'es');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}` },
      body: fd
    });

    const json = await res.json();
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: json.error?.message || 'Error Whisper' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, text: json.text || '' });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Error interno' }, { status: 500 });
  }
}
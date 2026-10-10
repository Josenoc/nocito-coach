export interface Alumno {
  id: string;
  nombre: string;
  email: string;
  token_acceso: string;
  activo: boolean;
  created_at: string;
}

export interface Rutina {
  id: string;
  alumno_id: string;
  nombre: string;
  activa: boolean;
  created_at: string;
}

export interface EjercicioAsignado {
  id: string;
  rutina_id: string;
  nombre: string;
  orden: number;
  series_default?: number | null;
  reps_default?: number | null;
  peso_default?: number | null;
  unidad_peso: 'kg' | 'lbs';
}

export interface RegistroProgreso {
  id: string;
  alumno_id: string;
  fecha: string;
  ejercicio: string;
  series?: number | null;
  repeticiones?: number | null;
  peso_utilizado?: number | null;
  unidad_peso: 'kg' | 'lbs';
  notas?: string | null;
  fuente: 'audio' | 'manual';
  audio_url?: string | null;
  raw_transcripcion?: string | null;
  raw_estructurado?: any;
  created_at: string;
}

export interface ExtractedSet {
  ejercicio: string;
  series?: number | null;
  repeticiones?: number | null;
  peso_utilizado?: number | null;
  unidad_peso?: 'kg' | 'lbs';
  notas?: string | null;
}

export interface ExtractedProgress {
  sets: ExtractedSet[];
  notas_generales?: string | null;
}
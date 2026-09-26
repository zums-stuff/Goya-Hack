// lib/api-errors.ts — Helpers para que los forms muestren el `details[]` del
// server campo por campo (no solo el `message` opaco).
//
// El server (handleApiError) devuelve:
//   { error, message, details: [{ path: "title", message: "Too small..." }, ...] }
// Mapeamos `path` -> etiqueta humana y traducimos el mensaje Zod.

type Field = { path: string; message: string };

const LABELS: Record<string, string> = {
  title: 'título',
  description: 'descripción',
  priceXlm: 'precio (XLM)',
  type: 'tipo',
  condition: 'condición',
  majors: 'carreras aceptadas',
  photoUrl: 'URL de foto',
  videoVerified: 'video verificado',
  name: 'nombre',
  major: 'carrera',
  displayName: 'nombre visible',
  email: 'correo',
  xlmAmount: 'monto XLM',
  offeredItems: 'objetos ofrecidos',
  message: 'mensaje',
  reason: 'motivo',
  escrowId: 'ID de escrow',
  offerId: 'ID de oferta',
  listingId: 'ID de listing',
};

export type FormattedError = { label: string; message: string; raw: Field };

/** Decodifica un body de error del server (en formato JSON). */
export async function parseApiError(res: Response): Promise<FormattedError[]> {
  let body: { details?: Field[]; message?: string } = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!Array.isArray(body.details)) return [];
  return body.details.map((f) => ({
    label: LABELS[f.path] ?? f.path,
    message: translateServerMessage(f.message),
    raw: f,
  }));
}

function translateServerMessage(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('too small')) return 'es demasiado corto';
  if (m.includes('too big')) return 'es demasiado largo';
  if (m.includes('expected string')) return 'formato inválido';
  if (m.includes('expected number')) return 'debe ser un número';
  if (m.includes('expected boolean')) return 'debe ser sí o no';
  if (m.includes('invalid email')) return 'correo inválido';
  if (m.includes('invalid url')) return 'URL inválida (debe empezar por https://)';
  if (m.includes('invalid enum value')) return 'valor fuera de las opciones';
  if (m.includes('required')) return 'falta este campo';
  if (m.includes('must be')) return 'tipo o formato incorrecto';
  return msg;
}

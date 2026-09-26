// components/listings/ListingForm.tsx — Form con feedback explícito.
// UX: indica estado (Enviando → escrito), navega a detalle al éxito.
// Majors se preseleccionan con la major del usuario como mejor guess.
// Errores del server (zod validation) se muestran campo por campo desde
// `details[]`, no como mensaje opaco.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Plus } from 'lucide-react';
import { ListingTypeSchema, MajorSchema, ConditionSchema } from '@/lib/schemas';
import { parseApiError, type FormattedError } from '@/lib/api-errors';

const LISTING_TYPES = ListingTypeSchema.options;
const MAJORS = MajorSchema.options;
const CONDITIONS = ConditionSchema.options;

const CONDITION_LABEL: Record<string, string> = {
  'como-nuevo': 'Como nuevo',
  bueno: 'Bueno',
  aceptable: 'Aceptable',
};

type Props = {
  /** preselecciona el major del usuario logueado como default */
  defaultMajor?: string;
};

export function ListingForm({ defaultMajor }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FormattedError[]>([]);

  // majors prechecked: la major del usuario (si la tiene) como forecast mínimo.
  const initialMajors = defaultMajor && MAJORS.includes(defaultMajor as never)
    ? [defaultMajor]
    : MAJORS.length > 0
      ? [MAJORS[0]!]
      : [];

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    const formData = new FormData(event.currentTarget);

    const majors = (formData.getAll('majors') as string[]).filter(Boolean);
    if (majors.length === 0) {
      setBusy(false);
      setError('Marca al menos una carrera aceptada.');
      return;
    }

    const priceStr = (formData.get('priceXlm') ?? '').toString();
    const priceNum = Number(priceStr);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setBusy(false);
      setFieldErrors([]);
      setError('Precio debe ser un número mayor a 0.');
      return;
    }
    const priceXlm = Math.round(priceNum * 100);

    const photoUrl = (formData.get('photoUrl') ?? '').toString();
    try {
      new URL(photoUrl);
    } catch {
      setBusy(false);
      setFieldErrors([]);
      setError('URL de foto inválida (debe empezar por http:// o https://).');
      return;
    }

    const payload = {
      title: formData.get('title')?.toString() ?? '',
      description: formData.get('description')?.toString() ?? '',
      priceXlm,
      type: formData.get('type')?.toString() ?? '',
      majors,
      condition: formData.get('condition')?.toString() ?? 'bueno',
      photoUrl,
      videoVerified: formData.get('videoVerified') === 'on',
    };

    try {
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errors = await parseApiError(res);
        if (errors.length > 0) {
          setFieldErrors(errors);
          setError(null);
        } else {
          setFieldErrors([]);
          const err: { message?: string } = await res
            .json()
            .catch(() => ({}));
          setError(err.message ?? 'Error creando listing');
        }
        return;
      }
      const { listing } = (await res.json()) as { listing: { id: string } };
      // Navegamos directo al detalle — sin refresh intermedio para evitar
      // race con router.push() en Next 16.
      router.push(`/marketplace/${listing.id}`);
    } catch (e) {
      setError((e as Error).message);
      setFieldErrors([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <label className="form-label">
        <span>Título</span>
        <span className="form-hint">5–80 caracteres</span>
        <input
          className="form-field"
          name="title"
          minLength={5}
          maxLength={80}
          required
          placeholder="Calculadora TI-89 Titanium"
        />
      </label>

      <label className="form-label">
        <span>Descripción</span>
        <span className="form-hint">Cuenta el estado real — los demás valoran honestidad</span>
        <textarea
          className="form-field"
          name="description"
          minLength={20}
          maxLength={500}
          required
          rows={4}
          placeholder="Calculadora gráfica usada 2 semestres. Funciona perfecto, sin marcas."
        />
      </label>

      <div className="form-row">
        <label className="form-label">
          <span>Precio (XLM)</span>
          <span className="form-hint">Conserva decimales</span>
          <input
            className="form-field"
            name="priceXlm"
            type="number"
            min={0.01}
            max={5_000}
            step={0.01}
            required
          />
        </label>

        <label className="form-label">
          <span>Tipo</span>
          <select className="form-field" name="type" required defaultValue="">
            <option value="" disabled>
              Selecciona…
            </option>
            {LISTING_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className="form-label">
          <span>Condición</span>
          <select className="form-field" name="condition" required defaultValue="bueno">
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {CONDITION_LABEL[c] ?? c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="form-fieldset">
        <legend>Majors aceptados</legend>
        {MAJORS.map((m) => (
          <label key={m} className="form-check">
            <input
              type="checkbox"
              name="majors"
              value={m}
              defaultChecked={initialMajors.includes(m)}
            />
            {m}
          </label>
        ))}
      </fieldset>

      <label className="form-label">
        <span>URL de foto</span>
        <span className="form-hint">Productos con foto reciben 3× más ofertas</span>
        <input
          className="form-field"
          name="photoUrl"
          type="url"
          required
          placeholder="https://images.unsplash.com/..."
        />
      </label>

      <label className="form-check">
        <input type="checkbox" name="videoVerified" defaultChecked />
        Subí un video del artículo (verificado por la comunidad)
      </label>

      {error && (
        <div className="form-error">
          <AlertCircle />
          {error}
        </div>
      )}

      {fieldErrors.length > 0 && (
        <div>
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#c45f4e',
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              marginTop: 12,
              marginBottom: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <AlertCircle />
            Corrige estos campos para publicar:
          </p>
          <ul className="error-list">
            {fieldErrors.map((e, i) => (
              <li key={`${e.raw.path}-${i}`}>
                <strong>{e.label}</strong> — {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="submit-row">
        <button
          type="submit"
          className="sell-button"
          disabled={busy}
          style={{
            opacity: busy ? 0.6 : 1,
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          <Plus />
          {busy ? 'Publicando…' : 'Publicar artículo'}
        </button>
      </div>
    </form>
  );
}

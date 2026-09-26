// components/listings/ListingForm.tsx — Form de crear listing.
// Sistema: form-field, form-label, form-fieldset (majors), sell-button.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Plus } from 'lucide-react';
import { ListingTypeSchema, MajorSchema, ConditionSchema } from '@/lib/schemas';

const LISTING_TYPES = ListingTypeSchema.options;
const MAJORS = MajorSchema.options;
const CONDITIONS = ConditionSchema.options;

const CONDITION_LABEL: Record<string, string> = {
  'como-nuevo': 'Como nuevo',
  bueno: 'Bueno',
  aceptable: 'Aceptable',
};

export function ListingForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    try {
      const majors = (formData.getAll('majors') as string[]).filter(Boolean);
      const priceXlm = Math.round(Number(formData.get('priceXlm')) * 100);
      const photoUrl = (formData.get('photoUrl') ?? '').toString();
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
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err: { message?: string } = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Error creando listing');
      }
      const { listing } = (await res.json()) as { listing: { id: string } };
      router.refresh();
      router.push(`/marketplace/${listing.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
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
            <input type="checkbox" name="majors" value={m} />
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

      <div className="submit-row">
        <button
          type="submit"
          className="sell-button"
          disabled={busy}
          style={{ opacity: busy ? 0.5 : 1 }}
        >
          <Plus />
          {busy ? 'Publicando…' : 'Publicar artículo'}
        </button>
      </div>
    </form>
  );
}

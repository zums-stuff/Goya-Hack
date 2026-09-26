// components/listings/ListingForm.tsx — Form de crear listing.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ListingTypeSchema, MajorSchema, ConditionSchema } from '@/lib/schemas';

const LISTING_TYPES = ListingTypeSchema.options;
const MAJORS = MajorSchema.options;
const CONDITIONS = ConditionSchema.options;

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
      const priceXlm = Math.round(Number(formData.get('priceXlm')) * 100); // XLM → centavos
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
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="text-sm">Título</span>
        <input
          name="title"
          minLength={5}
          maxLength={80}
          required
          className="w-full border rounded px-3 py-2 mt-1"
          placeholder="Calculadora TI-89 Titanium"
        />
      </label>

      <label className="block">
        <span className="text-sm">Descripción</span>
        <textarea
          name="description"
          minLength={20}
          maxLength={500}
          required
          className="w-full border rounded px-3 py-2 mt-1"
          rows={4}
        />
      </label>

      <div className="flex gap-3">
        <label className="block flex-1">
          <span className="text-sm">Precio (XLM)</span>
          <input
            name="priceXlm"
            type="number"
            min={0.01}
            max={5_000}
            step={0.01}
            required
            className="w-full border rounded px-3 py-2 mt-1"
          />
        </label>
        <label className="block flex-1">
          <span className="text-sm">Tipo</span>
          <select name="type" required className="w-full border rounded px-3 py-2 mt-1">
            {LISTING_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block flex-1">
          <span className="text-sm">Condición</span>
          <select name="condition" required className="w-full border rounded px-3 py-2 mt-1">
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="border rounded p-3 space-y-1">
        <legend className="text-sm">Majors aceptados</legend>
        <div className="grid grid-cols-2 gap-1 text-sm">
          {MAJORS.map((m) => (
            <label key={m} className="flex items-center gap-2">
              <input type="checkbox" name="majors" value={m} />
              {m}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-sm">URL de foto</span>
        <input
          name="photoUrl"
          type="url"
          required
          className="w-full border rounded px-3 py-2 mt-1"
          placeholder="https://images.unsplash.com/..."
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="videoVerified" defaultChecked />
        Video verificado
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="bg-green-600 text-white py-2 px-4 rounded disabled:opacity-50"
      >
        {busy ? 'Publicando...' : 'Publicar'}
      </button>
    </form>
  );
}

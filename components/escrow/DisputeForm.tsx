// components/escrow/DisputeForm.tsx — Sube foto + razón + descripción.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  escrowId: string;
  initialReason?: string;
  disabled?: boolean;
};

const REASONS: Array<{ code: 'item-damaged' | 'exchange-never-happened' | 'item-different'; label: string }> = [
  { code: 'item-damaged', label: 'El artículo tiene defectos o no funciona' },
  { code: 'exchange-never-happened', label: 'El intercambio nunca ocurrió' },
  { code: 'item-different', label: 'Lo recibido no es lo publicado' },
];

export function DisputeForm({ escrowId, initialReason, disabled }: Props) {
  const router = useRouter();
  const [reason, setReason] = useState<string>(
    initialReason && REASONS.some((r) => r.code === initialReason)
      ? initialReason
      : REASONS[0].code,
  );
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!photo) {
      setError('Sube una foto de evidencia (≤2 MB, jpeg/png/webp).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set('escrowId', escrowId);
      formData.set('reason', reason);
      formData.set('description', description);
      formData.set('photo', photo);
      const res = await fetch('/api/escrow/dispute', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err: { message?: string } = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Error abriendo disputa');
      }
      router.refresh();
      router.push(`/escrow/${escrowId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (disabled) {
    return (
      <p className="text-sm text-gray-500">
        Este escrow ya tiene una disputa abierta. No se puede escalar otra.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">¿Qué pasó?</legend>
        {REASONS.map((r) => (
          <label key={r.code} className="block text-sm">
            <input
              type="radio"
              name="reason"
              value={r.code}
              checked={reason === r.code}
              onChange={() => setReason(r.code)}
              className="mr-2"
            />
            {r.label}
          </label>
        ))}
      </fieldset>

      <label className="block">
        <span className="text-sm">Descripción (máx 500 chars)</span>
        <textarea
          required
          minLength={10}
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full border rounded px-3 py-2 mt-1"
        />
      </label>

      <label className="block">
        <span className="text-sm">Foto (≤2 MB, jpeg/png/webp)</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          className="block mt-1 text-sm"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="bg-red-600 text-white py-2 px-4 rounded disabled:opacity-50"
      >
        {busy ? 'Enviando...' : 'Enviar disputa'}
      </button>
    </form>
  );
}

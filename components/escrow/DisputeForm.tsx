// components/escrow/DisputeForm.tsx — Sube foto + razón + descripción.
// Sistema: radio-card (.form-check), form-field, form-error, cancel-button.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Image as ImageIcon } from 'lucide-react';

type Props = {
  escrowId: string;
  initialReason?: string;
  disabled?: boolean;
};

const REASONS: Array<{ code: 'item-damaged' | 'exchange-never-happened' | 'item-different'; label: string; description: string }> = [
  {
    code: 'item-damaged',
    label: 'El artículo tiene defectos o no funciona',
    description: 'Llega roto, no enciende, le falta una pieza clave…',
  },
  {
    code: 'exchange-never-happened',
    label: 'El intercambio nunca ocurrió',
    description: 'La otra parte no se presentó o canceló a último momento.',
  },
  {
    code: 'item-different',
    label: 'Lo recibido no es lo publicado',
    description: 'Diferente modelo, condición peor, o no coincide con la foto.',
  },
];

export function DisputeForm({ escrowId, initialReason, disabled }: Props) {
  const router = useRouter();
  const [reason, setReason] = useState<string>(
    initialReason && REASONS.some((r: { code: string; label: string }) => r.code === initialReason)
      ? initialReason
      : (REASONS[0]?.code ?? 'item-damaged'),
  );
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<File | null | undefined>(undefined);
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
      <div className="empty-state">
        <strong>Este escrow ya tiene una disputa abierta</strong>
        No se puede escalar otra. Espera a que un administrador la resuelva.
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <fieldset style={{ display: 'flex', flexDirection: 'column', gap: 8, border: 0, padding: 0 }}>
        <legend
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#6b7280',
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            marginBottom: 2,
            padding: 0,
          }}
        >
          ¿Qué pasó?
        </legend>
        {REASONS.map((r) => (
          <label
            key={r.code}
            style={{
              display: 'flex',
              gap: 12,
              border: '1px solid var(--line)',
              background: reason === r.code ? '#f7f9fc' : '#fff',
              borderColor: reason === r.code ? 'var(--primary)' : 'var(--line)',
              borderRadius: 9,
              padding: '11px 13px',
              cursor: 'pointer',
              transition: 'border-color 0.15s ease, background 0.15s ease',
            }}
          >
            <input
              type="radio"
              name="reason"
              value={r.code}
              checked={reason === r.code}
              onChange={() => setReason(r.code)}
              style={{ accentColor: 'var(--primary)', marginTop: 2, flexShrink: 0 }}
            />
            <span style={{ minWidth: 0 }}>
              <strong style={{ display: 'block', fontSize: 12, color: 'var(--ink)' }}>
                {r.label}
              </strong>
              <small style={{ fontSize: 10, color: '#7f8c9d' }}>{r.description}</small>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="form-label">
        <span>Descripción (máx 500 chars)</span>
        <textarea
          className="form-field"
          required
          minLength={10}
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Cuenta qué pasó con detalles verificables: lugar, fecha, número de mensajes, etc."
        />
      </label>

      <label className="form-label">
        <span>
          <ImageIcon
            style={{ width: 12, height: 12, display: 'inline-block', verticalAlign: 'text-bottom', marginRight: 4 }}
          />
          Foto de evidencia
        </span>
        <span className="form-hint">jpeg/png/webp · ≤2 MB · La foto ayuda al administrador a resolver.</span>
        <input
          className="form-field"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          onChange={(e) => {
            setPhoto(e.target.files?.[0] ?? null);
          }}
        />
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
          {busy ? 'Enviando…' : 'Enviar evidencia'}
        </button>
      </div>
    </form>
  );
}

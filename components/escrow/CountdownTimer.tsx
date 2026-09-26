// components/escrow/CountdownTimer.tsx — Timer countdown para ventanas.
// Sistema: .timeout-text + .critical + .ai-price-signal cuando expires.
'use client';

import { useEffect, useState } from 'react';

type Props = {
  targetDate: Date | string | null;
  status: string;
};

export function CountdownTimer({ targetDate, status }: Props) {
  const [remaining, setRemaining] = useState<string | null>(null);

  useEffect(() => {
    if (!targetDate) {
      setRemaining(null);
      return;
    }
    const t = new Date(targetDate).getTime();
    if (Number.isNaN(t)) {
      setRemaining(null);
      return;
    }
    const tick = () => {
      const diff = t - Date.now();
      if (diff <= 0) {
        setRemaining('00:00:00');
        return;
      }
      const hours = Math.floor(diff / 3_600_000);
      const minutes = Math.floor((diff % 3_600_000) / 60_000);
      const seconds = Math.floor((diff % 60_000) / 1000);
      setRemaining(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  if (!targetDate || !remaining) return null;
  if (status === 'released' || status === 'auto-released' || status === 'refunded') return null;

  const isCritical = remaining === '00:00:00';
  if (isCritical) {
    return (
      <span className="ai-price-signal pricey" style={{ marginTop: 0 }}>
        Expirado — el cron procesará en la próxima pasada
      </span>
    );
  }
  return (
    <span className="timeout-text">
      ⏳ {remaining}
    </span>
  );
}

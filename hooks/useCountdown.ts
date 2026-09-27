'use client';

import { useState, useEffect } from 'react';

export function useCountdown(target: Date | null) {
  const [remaining, setRemaining] = useState<number>(0);
  
  useEffect(() => {
    if (!target) return;
    const tick = () => setRemaining(Math.max(0, target.getTime() - Date.now()));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [target]);
  
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  
  return { hours, minutes, seconds, expired: remaining === 0 };
}

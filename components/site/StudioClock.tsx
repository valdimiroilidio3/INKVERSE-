'use client';

import { useEffect, useState } from 'react';

export function StudioClock() {
  const [label, setLabel] = useState('LISBOA · --:--');
  useEffect(() => {
    const update = () => {
      const time = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Lisbon',
      }).format(new Date());
      setLabel(`LISBOA 38°43′N 9°08′W · ${time}`);
    };
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-mist">{label}</span>;
}

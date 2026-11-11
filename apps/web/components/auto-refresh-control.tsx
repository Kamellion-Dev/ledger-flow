'use client';

import { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { formatDateTime } from '../lib/format';

export function AutoRefreshControl({ updatedAt }: { updatedAt: string }) {
  const [paused, setPaused] = useState(false);
  return (
    <div className="refresh-control">
      <span className={`live-dot ${paused ? 'is-paused' : ''}`} aria-hidden="true" />
      <span>{paused ? 'Updates paused' : `Updated ${formatDateTime(updatedAt)}`}</span>
      <button
        className="icon-button"
        type="button"
        aria-label={paused ? 'Resume auto-refresh' : 'Pause auto-refresh'}
        onClick={() => setPaused((value) => !value)}
      >
        {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
      </button>
    </div>
  );
}

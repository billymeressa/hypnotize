import { useEffect, type ReactNode } from 'react';
import { trapBack } from '../lib/platform';

export function Glow({ small }: { small?: boolean }) {
  return (
    <div className="glow" style={small ? { height: 96 } : undefined} aria-hidden>
      <div className="glow-core" style={small ? { maxWidth: 96 } : undefined} />
      <div className="glow-ring" />
    </div>
  );
}

export function Wave({ bars = 9 }: { bars?: number }) {
  return (
    <div className="wave" aria-hidden>
      {Array.from({ length: bars }, (_, i) => (
        <i key={i} style={{ animationDelay: `${(i % 5) * 0.28}s` }} />
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="switch">
      <span className="switch-label">{label}</span>
      <button
        className="toggle"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
      />
    </div>
  );
}

export function Mood({ value, onChange }: { value?: number; onChange: (n: number) => void }) {
  const labels = ['Low', '', 'Even', '', 'Good'];
  return (
    <div className="mood">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} className={value === n ? 'on' : ''} onClick={() => onChange(n)} aria-label={`${n} of 5`}>
          {labels[n - 1] || n}
        </button>
      ))}
    </div>
  );
}

export function Sheet({ children, onClose, title }: { children: ReactNode; onClose: () => void; title: string }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    // Android back closes the sheet rather than leaving the screen behind it.
    const untrap = trapBack(onClose);
    return () => { document.removeEventListener('keydown', esc); untrap(); };
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row-between" style={{ marginBottom: 18 }}>
          <h2>{title}</h2>
          <button className="btn-text" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Sparkline({ values, max = 5 }: { values: (number | null)[]; max?: number }) {
  return (
    <div className="sparkline" aria-hidden>
      {values.map((v, i) =>
        v == null
          ? <i key={i} className="empty" />
          : <i key={i} style={{ height: `${Math.max(8, (v / max) * 100)}%` }} />,
      )}
    </div>
  );
}

export const mins = (sec: number) => `${Math.max(1, Math.round(sec / 60))} min`;

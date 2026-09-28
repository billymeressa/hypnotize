import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

/**
 * Service-worker update notice.
 *
 * Registered with `registerType: 'prompt'` so a redeploy never swaps the app out from under a
 * running session. The banner is suppressed entirely while a session is open.
 */
export default function AppUpdates({ sessionOpen }: { sessionOpen: boolean }) {
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [update, setUpdate] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const updateSW = registerSW({
      // Register now rather than on window 'load' — that event has usually already fired by the
      // time this effect runs, which would leave the app with no service worker at all.
      immediate: true,
      onNeedRefresh() {
        setUpdate(() => () => updateSW(true));
        setNeedsRefresh(true);
      },
    });
  }, []);

  if (!needsRefresh || sessionOpen) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed', left: 16, right: 16, bottom: 'calc(84px + var(--safe-b))', zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        padding: '12px 14px 12px 16px',
        background: 'var(--bg-raised)', border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)', boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
      }}
    >
      <span className="small">A newer version is ready.</span>
      <div className="row" style={{ gap: 6 }}>
        <button className="btn-text" onClick={() => setNeedsRefresh(false)}>Later</button>
        <button className="btn btn-sm" onClick={() => void update?.()}>Reload</button>
      </div>
    </div>
  );
}

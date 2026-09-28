/**
 * The bits that make a web page behave like an installed Android app.
 * Each one degrades silently where the API is missing.
 */

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as { standalone?: boolean }).standalone === true;

/* ---------------- screen wake lock ---------------- */

let lock: WakeLockSentinel | null = null;

/**
 * Keeps the screen on during a session. Without this the phone dims and sleeps mid-script,
 * which on Android also suspends speech synthesis.
 */
export async function keepAwake(): Promise<void> {
  try {
    if (!('wakeLock' in navigator)) return;
    lock = await navigator.wakeLock.request('screen');
    // Android drops the lock whenever the tab is backgrounded; re-take it on return.
    document.addEventListener('visibilitychange', reacquire);
  } catch {
    /* denied or unsupported — the session still runs, the screen just may dim */
  }
}

async function reacquire() {
  if (document.visibilityState === 'visible' && lock?.released !== false) {
    try { lock = await navigator.wakeLock.request('screen'); } catch { /* ignore */ }
  }
}

export async function releaseAwake(): Promise<void> {
  document.removeEventListener('visibilitychange', reacquire);
  try { await lock?.release(); } catch { /* already gone */ }
  lock = null;
}

/* ---------------- Android back button ---------------- */

/**
 * On Android the system back gesture would otherwise close the whole app from inside a session.
 * Pushing a history entry turns back into "stop this session" / "close this sheet".
 *
 * React Strict Mode (dev) mounts → unmounts → remounts components. The cleanup's history.back()
 * fires a popstate that the second-mount handler would otherwise receive and call onBack() on.
 * _skipNext guards against that: cleanup sets it true, next handler skips one popstate.
 */
let _skipNext = false;

export function trapBack(onBack: () => void): () => void {
  const state = { trap: Date.now() };
  history.pushState(state, '');
  const handler = () => {
    if (_skipNext) { _skipNext = false; return; }
    onBack();
  };
  addEventListener('popstate', handler);
  return () => {
    removeEventListener('popstate', handler);
    if (history.state?.trap === state.trap) {
      _skipNext = true;
      history.back();
    }
  };
}

/* ---------------- install prompt ---------------- */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<(available: boolean) => void>();

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();                 // show it on our terms, not Chrome's mini-infobar
  deferred = e as InstallPromptEvent;
  listeners.forEach((l) => l(true));
});

addEventListener('appinstalled', () => {
  deferred = null;
  listeners.forEach((l) => l(false));
});

export const installAvailable = () => deferred !== null;

export function onInstallAvailable(cb: (available: boolean) => void): () => void {
  listeners.add(cb);
  cb(deferred !== null);
  return () => { listeners.delete(cb); };
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  if (outcome === 'accepted') deferred = null;
  return outcome;
}

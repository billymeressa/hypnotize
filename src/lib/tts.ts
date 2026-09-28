/** Optional voice delivery via the Web Speech API. Silent no-op where unsupported. */

export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function listVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return [];
  return speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'));
}

/** Voices load asynchronously in some browsers. */
export function onVoicesReady(cb: () => void): () => void {
  if (!ttsSupported()) return () => {};
  const handler = () => cb();
  speechSynthesis.addEventListener('voiceschanged', handler);
  if (speechSynthesis.getVoices().length) cb();
  return () => speechSynthesis.removeEventListener('voiceschanged', handler);
}

// Android Chrome stops synthesis silently after ~15s. A periodic resume kick keeps it going.
let _keepAlive: ReturnType<typeof setInterval> | null = null;
function startKeepAlive() {
  if (_keepAlive) return;
  _keepAlive = setInterval(() => {
    if (!speechSynthesis.speaking) return;
    speechSynthesis.pause();
    speechSynthesis.resume();
  }, 10000);
}
function stopKeepAlive() {
  if (_keepAlive) { clearInterval(_keepAlive); _keepAlive = null; }
}

export function speak(text: string, opts: { rate: number; voiceUri: string | null; onEnd?: () => void }) {
  if (!ttsSupported()) { opts.onEnd?.(); return; }
  const chunks = text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const voice = opts.voiceUri ? listVoices().find((v) => v.voiceURI === opts.voiceUri) ?? null : null;
  let i = 0;
  startKeepAlive();
  const next = () => {
    if (i >= chunks.length) { stopKeepAlive(); opts.onEnd?.(); return; }
    const u = new SpeechSynthesisUtterance(chunks[i++]);
    u.rate = opts.rate;
    u.pitch = 0.95;
    if (voice) u.voice = voice;
    u.onend = () => setTimeout(next, 420);
    u.onerror = () => setTimeout(next, 200);
    speechSynthesis.speak(u);
  };
  next();
}

export function stopSpeaking() {
  stopKeepAlive();
  if (ttsSupported()) speechSynthesis.cancel();
}

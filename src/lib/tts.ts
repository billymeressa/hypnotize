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

/**
 * Score a voice for hypnosis delivery quality.
 * Google Neural / Premium / Enhanced voices on Android Chrome sound closest to a human guide.
 */
export function scoreVoice(v: SpeechSynthesisVoice): number {
  const n = v.name.toLowerCase();
  if (n.includes('neural') || n.includes('premium') || n.includes('enhanced')) return 100;
  if (n.includes('google') && n.includes('uk')) return 92;
  if (n.includes('google') && (n.includes('female') || n.includes('us'))) return 88;
  if (n.includes('google')) return 80;
  if (v.localService) return 55;   // downloaded device voices beat network voices
  return 35;
}

/** Returns voices sorted best-first. Use this for the settings dropdown. */
export function listVoicesSorted(): SpeechSynthesisVoice[] {
  return [...listVoices()].sort((a, b) => scoreVoice(b) - scoreVoice(a));
}

/** Returns the URI of the highest-quality English voice available right now, or null. */
export function bestVoiceUri(): string | null {
  const sorted = listVoicesSorted();
  return sorted.length ? sorted[0].voiceURI : null;
}

/** Short label shown alongside a voice in settings: Neural / Google / Device / System */
export function voiceQualityLabel(v: SpeechSynthesisVoice): string {
  const n = v.name.toLowerCase();
  if (n.includes('neural') || n.includes('premium') || n.includes('enhanced')) return 'Neural';
  if (n.includes('google')) return 'Google';
  if (v.localService) return 'Device';
  return 'System';
}

// --- Text chunking for natural pacing ---

type Chunk = { text: string; gapMs: number };

/**
 * Splits a script line into spoken chunks with natural gaps.
 * Sentence endings and ellipses get long pauses; commas get short ones.
 * This gives the cadence of a real guide rather than a flat read-aloud.
 */
function parseChunks(text: string): Chunk[] {
  const out: Chunk[] = [];

  // Normalise: collapse multiple spaces, replace smart quotes with plain ones.
  const cleaned = text.replace(/\s+/g, ' ').replace(/[""]/g, '"').replace(/['']/g, "'").trim();

  // We walk the string looking for break-points: sentence ends, ellipses, clause commas.
  // Between break-points we accumulate spoken words.
  let buf = '';
  let i = 0;

  while (i < cleaned.length) {
    const ch = cleaned[i];

    // Ellipsis (written or unicode) — long contemplative pause
    if (cleaned.slice(i, i + 3) === '...' || ch === '…') {
      if (buf.trim()) out.push({ text: buf.trim(), gapMs: 950 });
      buf = '';
      i += ch === '…' ? 1 : 3;
      continue;
    }

    // Sentence-ending punctuation
    if ('.!?'.includes(ch)) {
      if (buf.trim()) out.push({ text: buf.trim(), gapMs: 700 });
      buf = '';
      // Skip any trailing punctuation cluster (.! etc)
      while (i < cleaned.length && '.!?'.includes(cleaned[i])) i++;
      continue;
    }

    // Em dash or double hyphen — mid-thought pause
    if (ch === '—' || cleaned.slice(i, i + 2) === '--') {
      if (buf.trim()) out.push({ text: buf.trim(), gapMs: 480 });
      buf = '';
      i += ch === '—' ? 1 : 2;
      continue;
    }

    // Comma or semicolon — short breath
    if (ch === ',' || ch === ';') {
      if (buf.trim()) out.push({ text: buf.trim(), gapMs: 280 });
      buf = '';
      i++;
      continue;
    }

    // Paragraph / line break — pause slightly longer than a sentence end
    if (ch === '\n') {
      if (buf.trim()) out.push({ text: buf.trim(), gapMs: 800 });
      buf = '';
      while (i < cleaned.length && cleaned[i] === '\n') i++;
      continue;
    }

    buf += ch;
    i++;
  }

  if (buf.trim()) out.push({ text: buf.trim(), gapMs: 400 });
  return out.filter((c) => c.text.length > 0);
}

// --- Android keep-alive ---

let _keepAlive: ReturnType<typeof setInterval> | null = null;
function startKeepAlive() {
  if (_keepAlive) return;
  // Android Chrome silently stops speech synthesis after ~15s.
  _keepAlive = setInterval(() => {
    if (!speechSynthesis.speaking) return;
    speechSynthesis.pause();
    speechSynthesis.resume();
  }, 10000);
}
function stopKeepAlive() {
  if (_keepAlive) { clearInterval(_keepAlive); _keepAlive = null; }
}

// --- Public speak / stop ---

export function speak(
  text: string,
  opts: { rate: number; voiceUri: string | null; onEnd?: () => void },
) {
  if (!ttsSupported()) { opts.onEnd?.(); return; }

  const chunks = parseChunks(text);
  if (!chunks.length) { opts.onEnd?.(); return; }

  // Resolve voice: explicit URI → best available → browser default
  const voices = listVoices();
  const resolvedUri = opts.voiceUri ?? bestVoiceUri();
  const voice = resolvedUri ? (voices.find((v) => v.voiceURI === resolvedUri) ?? null) : null;

  let idx = 0;
  startKeepAlive();

  const next = () => {
    if (idx >= chunks.length) { stopKeepAlive(); opts.onEnd?.(); return; }
    const { text: body, gapMs } = chunks[idx++];

    const u = new SpeechSynthesisUtterance(body);
    u.rate = opts.rate;
    u.pitch = 0.87;   // slightly lower — calmer, more grounded
    if (voice) u.voice = voice;

    u.onend = () => setTimeout(next, gapMs);
    u.onerror = () => setTimeout(next, 200);
    speechSynthesis.speak(u);
  };

  next();
}

export function stopSpeaking() {
  stopKeepAlive();
  if (ttsSupported()) speechSynthesis.cancel();
}

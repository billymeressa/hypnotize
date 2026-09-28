/** Voice delivery — OpenAI TTS (premium) with Web Speech API fallback. */

export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function listVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return [];
  return speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'));
}

export function onVoicesReady(cb: () => void): () => void {
  if (!ttsSupported()) return () => {};
  const handler = () => cb();
  speechSynthesis.addEventListener('voiceschanged', handler);
  if (speechSynthesis.getVoices().length) cb();
  return () => speechSynthesis.removeEventListener('voiceschanged', handler);
}

export function scoreVoice(v: SpeechSynthesisVoice): number {
  const n = v.name.toLowerCase();
  if (n.includes('neural') || n.includes('premium') || n.includes('enhanced')) return 100;
  if (n.includes('google') && n.includes('uk')) return 92;
  if (n.includes('google') && (n.includes('female') || n.includes('us'))) return 88;
  if (n.includes('google')) return 80;
  if (v.localService) return 55;
  return 35;
}

export function listVoicesSorted(): SpeechSynthesisVoice[] {
  return [...listVoices()].sort((a, b) => scoreVoice(b) - scoreVoice(a));
}

export function bestVoiceUri(): string | null {
  const sorted = listVoicesSorted();
  return sorted.length ? sorted[0].voiceURI : null;
}

export function voiceQualityLabel(v: SpeechSynthesisVoice): string {
  const n = v.name.toLowerCase();
  if (n.includes('neural') || n.includes('premium') || n.includes('enhanced')) return 'Neural';
  if (n.includes('google')) return 'Google';
  if (v.localService) return 'Device';
  return 'System';
}

// --- OpenAI TTS ---

export const OPENAI_VOICES = [
  { id: 'onyx',  label: 'Onyx — deep, calm (best for hypnosis)' },
  { id: 'nova',  label: 'Nova — warm, natural' },
  { id: 'fable', label: 'Fable — warm, British' },
  { id: 'alloy', label: 'Alloy — neutral American' },
  { id: 'echo',  label: 'Echo — clean male' },
  { id: 'shimmer', label: 'Shimmer — expressive female' },
] as const;

export type OpenAIVoice = typeof OPENAI_VOICES[number]['id'];

let _currentAudio: HTMLAudioElement | null = null;

async function speakOpenAI(
  text: string,
  opts: { apiKey: string; voice: OpenAIVoice; speed: number; onEnd?: () => void },
): Promise<void> {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1-hd',
      input: text,
      voice: opts.voice,
      speed: opts.speed,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI TTS error ${res.status}`);

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  _currentAudio = audio;

  await new Promise<void>((resolve) => {
    audio.onended = () => { URL.revokeObjectURL(url); _currentAudio = null; opts.onEnd?.(); resolve(); };
    audio.onerror = () => { URL.revokeObjectURL(url); _currentAudio = null; opts.onEnd?.(); resolve(); };
    audio.play().catch(() => { opts.onEnd?.(); resolve(); });
  });
}

// --- Browser TTS chunking ---

type Chunk = { text: string; gapMs: number };

/**
 * Splits script text into spoken chunks with hypnotic gaps.
 * Paragraph breaks and ellipses get long contemplative pauses;
 * sentence ends get a full breath; commas get a short beat.
 */
function parseChunks(text: string): Chunk[] {
  const out: Chunk[] = [];
  const cleaned = text.replace(/\s+/g, ' ').replace(/[""]/g, '"').replace(/['']/g, "'").trim();

  let buf = '';
  let i = 0;

  while (i < cleaned.length) {
    const ch = cleaned[i];

    if (cleaned.slice(i, i + 3) === '...' || ch === '…') {
      if (buf.trim()) out.push({ text: buf.trim(), gapMs: 1400 });
      buf = '';
      i += ch === '…' ? 1 : 3;
      continue;
    }

    if ('.!?'.includes(ch)) {
      if (buf.trim()) out.push({ text: buf.trim(), gapMs: 1000 });
      buf = '';
      while (i < cleaned.length && '.!?'.includes(cleaned[i])) i++;
      continue;
    }

    if (ch === '—' || cleaned.slice(i, i + 2) === '--') {
      if (buf.trim()) out.push({ text: buf.trim(), gapMs: 650 });
      buf = '';
      i += ch === '—' ? 1 : 2;
      continue;
    }

    if (ch === ',' || ch === ';') {
      if (buf.trim()) out.push({ text: buf.trim(), gapMs: 380 });
      buf = '';
      i++;
      continue;
    }

    if (ch === '\n') {
      if (buf.trim()) out.push({ text: buf.trim(), gapMs: 1200 });
      buf = '';
      while (i < cleaned.length && cleaned[i] === '\n') i++;
      continue;
    }

    buf += ch;
    i++;
  }

  if (buf.trim()) out.push({ text: buf.trim(), gapMs: 500 });
  return out.filter((c) => c.text.length > 0);
}

// --- Android keep-alive ---

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

// --- Public speak / stop ---

export interface SpeakOpts {
  rate: number;
  voiceUri: string | null;
  onEnd?: () => void;
  engine?: 'kokoro' | 'openai' | 'browser';
  kokoroVoice?: string;
  openaiKey?: string;
  openaiVoice?: OpenAIVoice;
  onKokoroProgress?: (p: { status: string; progress?: number }) => void;
}

export function speak(text: string, opts: SpeakOpts) {
  const engine = opts.engine ?? (opts.openaiKey ? 'openai' : 'browser');

  if (engine === 'openai' && opts.openaiKey) {
    void speakOpenAI(text, {
      apiKey: opts.openaiKey,
      voice: opts.openaiVoice ?? 'onyx',
      speed: Math.max(0.25, Math.min(4.0, opts.rate * 0.75)),
      onEnd: opts.onEnd,
    });
    return;
  }

  if (engine === 'kokoro') {
    void import('./kokoroTts').then(({ speakKokoro }) =>
      speakKokoro(text, {
        voice: (opts.kokoroVoice ?? 'am_adam') as import('./kokoroTts').KokoroVoice,
        speed: Math.max(0.5, Math.min(2.0, opts.rate * 0.9)),
        onEnd: opts.onEnd,
        onProgress: opts.onKokoroProgress,
      }),
    );
    return;
  }

  // Browser TTS fallback
  if (!ttsSupported()) { opts.onEnd?.(); return; }

  const chunks = parseChunks(text);
  if (!chunks.length) { opts.onEnd?.(); return; }

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
    u.pitch = 0.82;
    if (voice) u.voice = voice;

    u.onend = () => setTimeout(next, gapMs);
    u.onerror = () => setTimeout(next, 200);
    speechSynthesis.speak(u);
  };

  next();
}


export function stopSpeaking() {
  stopKeepAlive();
  if (_currentAudio) { _currentAudio.pause(); _currentAudio = null; }
  if (ttsSupported()) speechSynthesis.cancel();
  void import('./kokoroTts').then(({ stopKokoro }) => stopKokoro()).catch(() => {});
}

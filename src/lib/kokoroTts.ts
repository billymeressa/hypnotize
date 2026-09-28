/**
 * Kokoro TTS — local neural voice that runs entirely in the browser via ONNX/WASM.
 * No API key, no account, no cost. ~82MB model download on first use, then cached forever.
 *
 * Model: onnx-community/Kokoro-82M-v1.0-ONNX (q8 quantised ≈ 82MB)
 */

export const KOKORO_VOICES = [
  { id: 'am_adam',   label: 'Adam — calm American male (best for hypnosis)' },
  { id: 'bm_daniel', label: 'Daniel — deep British male' },
  { id: 'bm_lewis',  label: 'Lewis — warm British male' },
  { id: 'af_heart',  label: 'Heart — warm American female' },
  { id: 'bf_emma',   label: 'Emma — warm British female' },
  { id: 'am_michael',label: 'Michael — American male' },
] as const;

export type KokoroVoice = typeof KOKORO_VOICES[number]['id'];

export type LoadProgress = { status: string; progress?: number; name?: string };

type Pipeline = (text: string, opts?: { voice?: string; speed?: number }) => Promise<{ audio: Float32Array; sampling_rate: number }>;

let _pipeline: Pipeline | null = null;
let _loading: Promise<Pipeline> | null = null;

export function kokoroReady() { return _pipeline !== null; }
export function kokoroLoading() { return _loading !== null && _pipeline === null; }

export async function loadKokoro(onProgress?: (p: LoadProgress) => void): Promise<Pipeline> {
  if (_pipeline) return _pipeline;
  if (_loading) return _loading;

  _loading = (async () => {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowRemoteModels = true;

    const pipe = await (pipeline as Function)(
      'text-to-speech',
      'onnx-community/Kokoro-82M-v1.0-ONNX',
      {
        dtype: 'q8',
        progress_callback: onProgress ?? (() => {}),
      },
    );
    _pipeline = pipe as Pipeline;
    return _pipeline;
  })().catch((err) => {
    _loading = null; // allow retry after failure
    throw err;
  });

  return _loading;
}

let _audioCtx: AudioContext | null = null;
let _currentSource: AudioBufferSourceNode | null = null;

export async function speakKokoro(
  text: string,
  opts: {
    voice?: KokoroVoice;
    speed?: number;
    onEnd?: () => void;
    onProgress?: (p: LoadProgress) => void;
  },
): Promise<void> {
  const pipe = await loadKokoro(opts.onProgress);
  const result = await pipe(text, { voice: opts.voice ?? 'am_adam', speed: opts.speed ?? 0.88 });

  if (!_audioCtx) _audioCtx = new AudioContext();
  const ctx = _audioCtx;

  const { audio, sampling_rate } = result;
  const buf = ctx.createBuffer(1, audio.length, sampling_rate);
  buf.getChannelData(0).set(audio);

  const source = ctx.createBufferSource();
  source.buffer = buf;
  source.connect(ctx.destination);
  _currentSource = source;

  source.onended = () => { _currentSource = null; opts.onEnd?.(); };
  source.start();
}

export function stopKokoro() {
  try { _currentSource?.stop(); } catch { /* already stopped */ }
  _currentSource = null;
}

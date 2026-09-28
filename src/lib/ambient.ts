/** Soft ambient sound, synthesised so nothing has to be downloaded and it works offline. */
type Kind = 'off' | 'hum' | 'rain' | 'air';

let ctx: AudioContext | null = null;
let node: { stop: () => void } | null = null;

function noiseBuffer(ac: AudioContext, seconds = 3) {
  const buf = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;   // brown-ish noise: softer than white
    data[i] = last * 3.2;
  }
  return buf;
}

export function startAmbient(kind: Kind, volume: number) {
  stopAmbient();
  if (kind === 'off') return;
  ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
  const ac = ctx;
  void ac.resume();

  const gain = ac.createGain();
  gain.gain.value = 0;
  gain.connect(ac.destination);

  let stopSrc: () => void;

  if (kind === 'hum') {
    const osc = ac.createOscillator();
    const osc2 = ac.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 110;
    osc2.type = 'sine'; osc2.frequency.value = 110.4;   // slow beat, breathing-paced
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
    osc.connect(lp); osc2.connect(lp); lp.connect(gain);
    osc.start(); osc2.start();
    stopSrc = () => { osc.stop(); osc2.stop(); };
  } else {
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac);
    src.loop = true;
    const filt = ac.createBiquadFilter();
    if (kind === 'rain') { filt.type = 'bandpass'; filt.frequency.value = 1100; filt.Q.value = 0.6; }
    else { filt.type = 'lowpass'; filt.frequency.value = 480; }
    src.connect(filt); filt.connect(gain);
    src.start();
    stopSrc = () => src.stop();
  }

  gain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, volume)) * 0.35, ac.currentTime + 2.5);
  node = {
    stop: () => {
      gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.8);
      setTimeout(() => { try { stopSrc(); } catch { /* already stopped */ } }, 900);
    },
  };
}

export function stopAmbient() {
  node?.stop();
  node = null;
}

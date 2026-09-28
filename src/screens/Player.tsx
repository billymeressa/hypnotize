import { useEffect, useRef, useState } from 'react';
import type { Completion, SessionPlan, Settings } from '../types';
import { db, today, uid } from '../db';
import { speak, stopSpeaking, ttsSupported } from '../lib/tts';
import { startAmbient, stopAmbient } from '../lib/ambient';
import { PACE_WPS } from '../lib/compose';
import { keepAwake, releaseAwake, trapBack } from '../lib/platform';
import { Glow, Mood, Wave, mins } from '../components/ui';

type Phase = 'preview' | 'mood-before' | 'playing' | 'mood-after' | 'done';

/**
 * The session player.
 *
 * Non-negotiables enforced here:
 *  - Preview lists every suggestion in plain language before anything starts. Nothing covert.
 *  - A Stop control is visible in every phase, including mid-script.
 *  - Stopping early still records the session as attempted; it is never framed as a failure.
 */
export default function Player({
  plan, settings, onClose,
}: { plan: SessionPlan; settings: Settings; onClose: (completed: boolean) => void }) {
  const [phase, setPhase] = useState<Phase>('preview');
  const [i, setI] = useState(0);
  const [moodBefore, setMoodBefore] = useState<number | undefined>();
  const [moodAfter, setMoodAfter] = useState<number | undefined>();
  const startedAt = useRef(0);
  const elapsed = useRef(0);
  const step = plan.steps[i];

  const isSleepSession = plan.session_type === 'pre-sleep';

  // Advance through the script. TTS drives the pace when on; otherwise a reading-speed timer does.
  useEffect(() => {
    if (phase !== 'playing' || !step) return;
    let cancelled = false;
    const advance = () => {
      if (cancelled) return;
      setI((n) => {
        if (n + 1 >= plan.steps.length) {
          setPhase(isSleepSession ? 'done' : 'mood-after');
          return n;
        }
        return n + 1;
      });
    };

    if (settings.tts_enabled && ttsSupported()) {
      speak(step.body, { rate: settings.tts_rate, voiceUri: settings.tts_voice_uri, onEnd: advance });
      return () => { cancelled = true; stopSpeaking(); };
    }
    const words = step.body.trim().split(/\s+/).length;
    const readSec = words / PACE_WPS[settings.pace];
    const ms = Math.max(step.duration_sec, readSec) * 1000;
    const t = setTimeout(advance, ms);
    return () => { cancelled = true; clearTimeout(t); };
  }, [phase, i, step, plan.steps.length, settings, isSleepSession]);

  // Ambient sound for the duration of the script only.
  useEffect(() => {
    if (phase === 'playing' && settings.ambient !== 'off') {
      startAmbient(settings.ambient, settings.ambient_volume);
    } else stopAmbient();
    return stopAmbient;
  }, [phase, settings.ambient, settings.ambient_volume]);

  // Hold the screen awake for the whole session, not just the script: the mood steps sit on
  // screen while the user decides, and a sleeping screen there kills the session too.
  useEffect(() => {
    void keepAwake();
    return () => { void releaseAwake(); };
  }, []);

  useEffect(() => () => { stopSpeaking(); stopAmbient(); }, []);

  // Android's back gesture must mean "stop the session", never "close the app".
  const stopRef = useRef<() => void>(() => {});
  useEffect(() => trapBack(() => stopRef.current()), []);

  const begin = () => {
    startedAt.current = Date.now();
    setPhase('playing');
  };

  const record = async (finished: boolean) => {
    elapsed.current = startedAt.current ? Date.now() - startedAt.current : 0;
    if (elapsed.current < 5000 && !finished) return;   // abandoned before it began — nothing to log
    const c: Completion = {
      id: uid(),
      ref: plan.id,
      kind: 'session',
      title: plan.title,
      date: today(),
      started_at: startedAt.current || Date.now(),
      ended_at: Date.now(),
      seconds: Math.round(elapsed.current / 1000),
      finished,
      mood_before: moodBefore,
      mood_after: moodAfter,
    };
    await db.sessions.put(plan);
    await db.completions.put(c);
  };

  const stop = async () => {
    stopSpeaking(); stopAmbient();
    if (phase === 'playing') { await record(false); onClose(false); return; }
    if (phase === 'mood-after') { setPhase('done'); return; }
    onClose(false);
  };

  const finish = async () => {
    await record(true);
    setPhase('done');
  };

  stopRef.current = stop;

  const StopButton = (
    <button className="stop" onClick={stop}>
      {phase === 'playing' ? 'Stop' : 'Leave'}
    </button>
  );

  return (
    <div className="player">
      {/* ---------- preview ---------- */}
      {phase === 'preview' && (
        <div className="player-body stack-lg" style={{ justifyContent: 'flex-start', overflowY: 'auto' }}>
          <div>
            <p className="eyebrow">Before we start</p>
            <h1 style={{ marginTop: 10 }}>{plan.title}</h1>
            <p className="dim small" style={{ marginTop: 8 }}>
              {mins(plan.target_sec)} · {plan.steps.length} parts
              {plan.origin === 'coach' ? ' · built from your conversation' : ''}
            </p>
          </div>

          <div className="stack">
            <p className="eyebrow">What this will suggest to you</p>
            {plan.suggestions.length ? (
              <ul className="stack" style={{ margin: 0, paddingLeft: 20 }}>
                {plan.suggestions.map((s, n) => (
                  <li key={n} className="serif-lead" style={{ fontSize: 16 }}>{s}</li>
                ))}
              </ul>
            ) : (
              <p className="dim small">This one is relaxation and depth only — no suggestions.</p>
            )}
            <p className="notice">
              That list is the whole of it. Nothing is delivered that is not written above, and you can
              stop at any point with the control at the bottom of the screen.
            </p>
          </div>

          {plan.rationale && (
            <div>
              <p className="eyebrow">Why these</p>
              <p className="small dim" style={{ marginTop: 8 }}>{plan.rationale}</p>
            </div>
          )}

          <details className="card-quiet card">
            <summary className="small dim" style={{ cursor: 'pointer' }}>Read the full script first</summary>
            <div className="stack" style={{ marginTop: 14 }}>
              {plan.steps.map((s, n) => (
                <div key={n}>
                  <p className="tag">{s.stage.replace('_', ' ')} · {mins(s.duration_sec)}</p>
                  <p className="small" style={{ margin: '4px 0 0' }}>{s.body}</p>
                </div>
              ))}
            </div>
          </details>

          {isSleepSession && (
            <p className="notice">
              This session ends in sleep rather than counting you back up. Start it lying down, somewhere
              you intend to stay. Not while driving or operating anything.
            </p>
          )}

          <button className="btn btn-block" onClick={() => setPhase('mood-before')}>Continue</button>
          <div className="player-foot">{StopButton}</div>
        </div>
      )}

      {/* ---------- mood before ---------- */}
      {phase === 'mood-before' && (
        <>
          <div className="player-body stack-lg">
            <Glow />
            <div>
              <h2 style={{ textAlign: 'center' }}>How are you right now?</h2>
              <p className="dim small" style={{ textAlign: 'center', marginTop: 8 }}>
                One tap. It only exists so you can see the trend later.
              </p>
            </div>
            <Mood value={moodBefore} onChange={setMoodBefore} />
            <button className="btn btn-block" onClick={begin} disabled={!moodBefore}>Begin</button>
            <button className="btn-text" style={{ textAlign: 'center' }} onClick={begin}>Skip the rating</button>
          </div>
          <div className="player-foot">{StopButton}</div>
        </>
      )}

      {/* ---------- playing ---------- */}
      {phase === 'playing' && step && (
        <>
          <div className="progress-dots">
            {plan.steps.map((_, n) => (
              <i key={n} className={n === i ? 'cur' : n < i ? 'on' : ''} />
            ))}
          </div>
          <div className="player-body">
            <p className="script">{step.body}</p>
          </div>
          <div style={{ paddingBottom: 14 }}><Wave /></div>
          <div className="player-foot">
            <button className="stop" onClick={stop}>Stop</button>
          </div>
        </>
      )}

      {/* ---------- mood after ---------- */}
      {phase === 'mood-after' && (
        <>
          <div className="player-body stack-lg">
            <Glow />
            <h2 style={{ textAlign: 'center' }}>And now?</h2>
            <Mood value={moodAfter} onChange={setMoodAfter} />
            <button className="btn btn-block" onClick={finish}>Done</button>
            <button className="btn-text" style={{ textAlign: 'center' }} onClick={finish}>Skip the rating</button>
          </div>
          <div className="player-foot">{StopButton}</div>
        </>
      )}

      {/* ---------- done ---------- */}
      {phase === 'done' && (
        <div className="player-body stack-lg">
          <Glow />
          <div style={{ textAlign: 'center' }}>
            <h2>{isSleepSession ? 'Goodnight.' : "That's the session."}</h2>
            <p className="dim small" style={{ marginTop: 10 }}>
              {isSleepSession
                ? 'Put the phone down and let it go.'
                : 'Nothing else is queued from here.'}
            </p>
          </div>
          <button className="btn btn-block" onClick={() => onClose(true)}>Close</button>
        </div>
      )}
    </div>
  );
}

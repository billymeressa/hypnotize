import { useEffect, useRef, useState } from 'react';
import type { Settings, RoutineItem } from '../types';
import { saveSettings } from '../db';
import { bestVoiceUri, listVoicesSorted, onVoicesReady, scoreVoice, speak, stopSpeaking, ttsSupported, voiceQualityLabel } from '../lib/tts';
import { startAmbient, stopAmbient } from '../lib/ambient';
import { activeReminders, inQuietHours, requestPermission, scheduleToday } from '../lib/reminders';
import { downloadExport, eraseAll, importBackup } from '../lib/backup';
import { Toggle } from '../components/ui';

export default function SettingsScreen({ settings }: { settings: Settings }) {
  const [voices, setVoices] = useState(listVoicesSorted());
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => onVoicesReady(() => setVoices(listVoicesSorted())), []);
  useEffect(() => () => { stopSpeaking(); stopAmbient(); }, []);

  const set = (patch: Partial<Settings>) => void saveSettings(patch);

  const toggleRoutine = (item: RoutineItem) => {
    set({ routine: settings.routine.map((r) => (r.id === item.id ? { ...r, enabled: !r.enabled } : r)) });
  };

  const enabledCount = settings.routine.filter((r) => r.enabled).length;

  return (
    <div className="screen">
      <div className="head">
        <button className="btn-text" onClick={() => (location.hash = '#/more')}>← More</button>
        <h1 style={{ marginTop: 12 }}>Settings</h1>
      </div>

      <div className="stack-lg">
        {/* ---------- delivery ---------- */}
        <section>
          <p className="eyebrow">Delivery</p>
          <div className="card" style={{ marginTop: 12 }}>
            <Toggle
              label="Speak the script aloud"
              on={settings.tts_enabled}
              onChange={(v) => set({ tts_enabled: v && ttsSupported() })}
            />
            {!ttsSupported() && (
              <p className="tiny faint" style={{ marginTop: 6 }}>This browser has no speech synthesis.</p>
            )}
            {settings.tts_enabled && (
              <div className="stack" style={{ marginTop: 16 }}>
                <label className="field">
                  <span>Voice</span>
                  <select
                    value={settings.tts_voice_uri ?? ''}
                    onChange={(e) => set({ tts_voice_uri: e.target.value || null })}
                  >
                    <option value="">Auto (best available)</option>
                    {voices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {voiceQualityLabel(v)} · {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                {voices.length > 0 && (
                  <p className="tiny faint" style={{ marginTop: -8 }}>
                    Best available: <strong>{voices[0]?.name}</strong>
                    {' '}({voiceQualityLabel(voices[0])}, score {scoreVoice(voices[0])})
                    {settings.tts_voice_uri && settings.tts_voice_uri !== bestVoiceUri() && (
                      <>
                        {' · '}
                        <button
                          className="btn-text"
                          style={{ fontSize: 'inherit', display: 'inline' }}
                          onClick={() => set({ tts_voice_uri: bestVoiceUri() })}
                        >
                          Switch to it
                        </button>
                      </>
                    )}
                  </p>
                )}
                <label className="field">
                  <span>Speaking rate — {settings.tts_rate.toFixed(2)}× (0.78 is default)</span>
                  <input
                    type="range" min={0.5} max={1.2} step={0.05}
                    value={settings.tts_rate}
                    onChange={(e) => set({ tts_rate: Number(e.target.value) })}
                  />
                </label>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => speak(
                    'Let your eyes close... and with every breath out, feel yourself settling a little deeper. There is nothing you need to do right now, and nowhere else to be.',
                    { rate: settings.tts_rate, voiceUri: settings.tts_voice_uri },
                  )}
                >
                  Hear it
                </button>
              </div>
            )}
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <p className="switch-label" style={{ marginBottom: 12 }}>Reading pace (when the voice is off)</p>
            <div className="scroll-x">
              {(['slow', 'natural', 'brisk'] as const).map((p) => (
                <button key={p} className="chip" aria-pressed={settings.pace === p} onClick={() => set({ pace: p })}>{p}</button>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <p className="switch-label" style={{ marginBottom: 12 }}>Ambient sound</p>
            <div className="scroll-x">
              {(['off', 'hum', 'rain', 'air'] as const).map((a) => (
                <button
                  key={a} className="chip" aria-pressed={settings.ambient === a}
                  onClick={() => {
                    set({ ambient: a });
                    a === 'off' ? stopAmbient() : startAmbient(a, settings.ambient_volume);
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
            {settings.ambient !== 'off' && (
              <label className="field" style={{ marginTop: 16 }}>
                <span>Volume</span>
                <input
                  type="range" min={0} max={1} step={0.05} value={settings.ambient_volume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    set({ ambient_volume: v });
                    startAmbient(settings.ambient, v);
                  }}
                />
              </label>
            )}
          </div>
        </section>

        {/* ---------- routine ---------- */}
        <section>
          <p className="eyebrow">Daily set</p>
          <p className="tiny faint" style={{ marginTop: 6 }}>
            {enabledCount} items on. Keep it between five and ten — a set that can't be finished stops
            being a set.
          </p>
          <div className="card" style={{ marginTop: 12 }}>
            {settings.routine.map((r) => (
              <Toggle
                key={r.id}
                label={`${r.title} · ${r.slot}`}
                on={r.enabled}
                onChange={() => toggleRoutine(r)}
              />
            ))}
          </div>
        </section>

        {/* ---------- reminders ---------- */}
        <section>
          <p className="eyebrow">Reminders</p>
          <div className="card" style={{ marginTop: 12 }}>
            <Toggle
              label="Reminders on"
              on={settings.reminders_enabled}
              onChange={async (v) => {
                if (v) {
                  const perm = await requestPermission();
                  if (perm !== 'granted') return;
                }
                const next = await saveSettings({ reminders_enabled: v });
                scheduleToday(next);
              }}
            />
            <label className="field" style={{ marginTop: 14 }}>
              <span>How many a day (max 8) — currently {activeReminders(settings).length} scheduled</span>
              <input
                type="number" min={0} max={8} value={settings.max_reminders_per_day}
                onChange={(e) => set({ max_reminders_per_day: Math.min(8, Math.max(0, Number(e.target.value))) })}
              />
            </label>
            <div className="row" style={{ marginTop: 14 }}>
              <label className="field grow">
                <span>Quiet from</span>
                <input type="time" value={settings.quiet_start} onChange={(e) => set({ quiet_start: e.target.value })} />
              </label>
              <label className="field grow">
                <span>Until</span>
                <input type="time" value={settings.quiet_end} onChange={(e) => set({ quiet_end: e.target.value })} />
              </label>
            </div>
            <p className="tiny faint" style={{ marginTop: 12 }}>
              {inQuietHours(settings) ? 'Quiet hours are active right now. ' : ''}
              No badges and no counts — a reminder is one line you can ignore.
            </p>
            <div className="stack" style={{ marginTop: 16 }}>
              {settings.reminders.map((r) => (
                <div key={r.id} className="row">
                  <input
                    type="time" value={r.time} style={{ width: 120 }}
                    onChange={(e) => set({
                      reminders: settings.reminders.map((x) => (x.id === r.id ? { ...x, time: e.target.value } : x)),
                    })}
                  />
                  <input
                    type="text" value={r.text} className="grow"
                    onChange={(e) => set({
                      reminders: settings.reminders.map((x) => (x.id === r.id ? { ...x, text: e.target.value } : x)),
                    })}
                  />
                  <button
                    className={`chip${r.enabled ? ' on' : ''}`}
                    onClick={() => set({
                      reminders: settings.reminders.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)),
                    })}
                  >
                    {r.enabled ? 'on' : 'off'}
                  </button>
                </div>
              ))}
            </div>
            <p className="tiny faint" style={{ marginTop: 12 }}>
              Reminders fire while the app is open or recently used. A web app can't reliably wake
              itself on iOS — see the README on going native.
            </p>
          </div>
        </section>

        {/* ---------- data ---------- */}
        <section>
          <p className="eyebrow">Your data</p>
          <div className="stack" style={{ marginTop: 12 }}>
            <button className="btn btn-ghost btn-block" onClick={downloadExport}>Export everything as JSON</button>
            <button className="btn btn-ghost btn-block" onClick={() => file.current?.click()}>Import a backup</button>
            <input
              ref={file} type="file" accept="application/json" hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const mode = confirm('OK = merge into what is here.\nCancel = replace everything.') ? 'merge' : 'replace';
                try {
                  const { counts } = await importBackup(await f.text(), mode);
                  setImportMsg(`Imported: ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}.`);
                } catch (err) {
                  setImportMsg(`Import failed: ${(err as Error).message}`);
                }
                e.target.value = '';
              }}
            />
            {importMsg && <p className="notice">{importMsg}</p>}
            <button
              className="btn btn-ghost btn-danger btn-block"
              onClick={async () => {
                if (!confirm('Delete every session, journal entry, conversation and profile fact on this device? This cannot be undone.')) return;
                if (!confirm('Really? Export first if you want a copy.')) return;
                await eraseAll();
                location.reload();
              }}
            >
              Erase all data
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

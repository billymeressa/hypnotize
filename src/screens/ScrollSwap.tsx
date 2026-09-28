import { useState } from 'react';
import type { Launcher } from '../App';
import { db, getProfile, today, uid } from '../db';
import { composeSession } from '../lib/compose';
import { Sheet } from '../components/ui';
import { entry } from '../lib/content';

/**
 * The "I want to scroll" interrupt. It asks what the urge is actually about, then offers a swap
 * sized to the feeling. No streak, no guilt, and no attempt to keep the user in the app afterwards.
 */

const FEELINGS = [
  { id: 'bored', label: 'Bored', swap: 'Boredom is usually under-stimulation, not a need for content. Stand up and do the thirty-second version of something physical — stretch, walk to a window, make a drink.' },
  { id: 'tired', label: 'Tired', swap: 'Scrolling is a poor substitute for rest and you know it by now. Two minutes with your eyes closed does more. Try the focus induction, or nothing at all.' },
  { id: 'anxious', label: 'Anxious', swap: 'The feed will amplify this. Name the specific thing you are anxious about in one sentence, then let a short session put the volume down.' },
  { id: 'lonely', label: 'Lonely', swap: 'A feed is people-shaped but not people. Message one actual person — one line is enough — then come back if you still want to.' },
  { id: 'avoiding', label: 'Avoiding something', swap: 'Name the task you are avoiding. Then do its first physical move, the one that takes under a minute. The avoidance is the whole problem, not the task.' },
  { id: 'habit', label: 'Just habit', swap: 'No feeling underneath it — just the hand reaching. Put the phone down across the room and see whether the urge survives ninety seconds.' },
];

export default function ScrollSwap({ ctx, onClose }: { ctx: Launcher; onClose: () => void }) {
  const [picked, setPicked] = useState<typeof FEELINGS[number] | null>(null);

  const logAndClose = async (note: string) => {
    await db.journal.put({
      id: uid(), date: today(), prompt: 'Scroll urge',
      text: note, created_at: Date.now(), updated_at: Date.now(),
    });
    onClose();
  };

  const runSession = async () => {
    const profile = await getProfile();
    const type = picked?.id === 'avoiding' ? 'focus-flow' : picked?.id === 'anxious' ? 'fear-screen' : 'habit-craving';
    const plan = composeSession({
      sessionType: type, targetMinutes: 4, facts: profile.facts,
      focus: picked ? `stay with the urge instead of feeding it` : undefined,
      rationale: picked ? `You said the urge was about feeling ${picked.label.toLowerCase()}.` : undefined,
    });
    onClose();
    ctx.launch(plan);
  };

  const craving = entry('original-starter/scroll-swap');

  return (
    <Sheet title="Before you scroll" onClose={onClose}>
      {!picked ? (
        <div className="stack-lg">
          <p className="serif-lead">{craving?.body ?? 'What is the feeling underneath it?'}</p>
          <div className="stack">
            {FEELINGS.map((f) => (
              <button key={f.id} className="card" onClick={() => setPicked(f)}>
                <span className="item-title">{f.label}</span>
              </button>
            ))}
          </div>
          <button className="btn-text" style={{ textAlign: 'center' }} onClick={onClose}>
            Actually, I'll just scroll
          </button>
        </div>
      ) : (
        <div className="stack-lg">
          <div>
            <p className="eyebrow">{picked.label}</p>
            <p className="serif-lead" style={{ marginTop: 10 }}>{picked.swap}</p>
          </div>
          <button className="btn btn-block" onClick={runSession}>Four-minute session instead</button>
          <button className="btn btn-ghost btn-block" onClick={() => logAndClose(`Urge to scroll — ${picked.label.toLowerCase()}. Noted and let it pass.`)}>
            Just noting it is enough
          </button>
          <button className="btn-text" style={{ textAlign: 'center' }} onClick={() => setPicked(null)}>Back</button>
        </div>
      )}
    </Sheet>
  );
}

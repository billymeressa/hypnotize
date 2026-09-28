import { ofType } from '../lib/content';

/**
 * Influence literacy. The argument this app has to be able to make about itself: if suggestion
 * works, then an app delivering suggestions owes the user a clear account of how it works on them.
 */
const NOTES = [
  {
    title: 'What hypnosis is here',
    body: 'A focused, relaxed state in which suggestions you already agree with land more easily than they do in ordinary chatter. Not sleep, not unconsciousness, not control. You can stop at any point and you will remember all of it.',
  },
  {
    title: 'Why every session shows its suggestions first',
    body: 'Because a suggestion you would reject if you saw it is a suggestion that has no business being delivered while you are relaxed. The Preview screen is the whole list. If something is not on it, it is not in the session.',
  },
  {
    title: 'The techniques used on you elsewhere',
    body: 'Variable rewards, infinite feeds, autoplay, streak guilt, red badges, engineered outrage, artificial scarcity. Each one works by putting a small pull on attention and repeating it. Recognising the mechanism does most of the work of resisting it.',
  },
  {
    title: 'What this app deliberately does not do',
    body: 'No infinite scroll, no autoplay into the next thing, no red badges, no streak that punishes you for stopping, no leaderboard, no notification designed to feel like a person needing you. The daily set ends and says so.',
  },
  {
    title: 'Where the app could still be manipulating you',
    body: 'A streak counter is still a streak counter, and a soothing interface still builds a habit. Those are here because repetition is how this works — but if the numbers start mattering more than how you actually feel, turn them off in Settings and keep the sessions.',
  },
  {
    title: 'On the limits of all of this',
    body: 'Hypnosis has reasonable evidence for pain, sleep onset, and some anxiety and habit work, and much weaker evidence for the sweeping claims often made around it. It is not treatment for a psychiatric or medical condition, and a session is not a substitute for a doctor, a therapist, or a decision you need to make awake.',
  },
];

export default function Influence() {
  const principles = ofType('principle');
  return (
    <div className="screen">
      <div className="head">
        <button className="btn-text" onClick={() => (location.hash = '#/more')}>← More</button>
        <h1 style={{ marginTop: 12 }}>Influence literacy</h1>
        <p>How suggestion works — including how it works in here.</p>
      </div>

      <div className="stack-lg">
        {NOTES.map((n) => (
          <div key={n.title}>
            <h3>{n.title}</h3>
            <p className="small dim" style={{ marginTop: 8 }}>{n.body}</p>
          </div>
        ))}

        {principles.length > 0 && (
          <>
            <div className="divider" />
            <div>
              <p className="eyebrow">From the library</p>
              <div className="stack" style={{ marginTop: 14 }}>
                {principles.map((p) => (
                  <div key={p.key} className="card">
                    <div className="item-title">{p.title}</div>
                    <p className="small dim" style={{ margin: '6px 0 0' }}>{p.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

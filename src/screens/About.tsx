import { CONTENT_STATS, SOURCES } from '../lib/content';

export default function About() {
  return (
    <div className="screen">
      <div className="head">
        <button className="btn-text" onClick={() => (location.hash = '#/more')}>← More</button>
        <h1 style={{ marginTop: 12 }}>About</h1>
      </div>

      <div className="stack-lg">
        <div>
          <h3>What this is</h3>
          <p className="small dim" style={{ marginTop: 8 }}>
            A private, single-user hypnosis app. Everything — profile, sessions, journal, chat — is
            stored on this device only. There is no account, no server, and nothing is uploaded.
            Export your data from Settings at any time.
          </p>
        </div>

        <div>
          <h3>The Guide</h3>
          <p className="small dim" style={{ marginTop: 8 }}>
            An original character, represented as light and sound rather than a person. It is not a
            depiction of, and does not use the name, voice, or likeness of, any real teacher. Source
            material is credited below and in each library entry.
          </p>
        </div>

        <div>
          <h3>Not medical</h3>
          <p className="small dim" style={{ marginTop: 8 }}>
            Nothing here treats or diagnoses anything. Don't run a session while driving or operating
            anything. If you're dealing with trauma, psychosis, or thoughts of harming yourself, work
            with a person rather than an app.
          </p>
        </div>

        <div>
          <h3>Sources</h3>
          <div className="stack" style={{ marginTop: 12 }}>
            {SOURCES.map((s) => (
              <div key={s.id} className="card">
                <div className="item-title" style={{ fontSize: 15 }}>{s.title}</div>
                <div className="meta" style={{ marginTop: 4 }}>{s.creator} · added {s.date_added}</div>
                {s.url && <a className="small" href={s.url} target="_blank" rel="noreferrer">Open</a>}
              </div>
            ))}
          </div>
          <p className="tiny faint" style={{ marginTop: 12 }}>
            {CONTENT_STATS.approved} approved entries, {CONTENT_STATS.draft} awaiting review across{' '}
            {CONTENT_STATS.sources} sources. Drafts are not readable by the app.
          </p>
        </div>
      </div>
    </div>
  );
}

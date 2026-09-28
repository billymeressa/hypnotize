import { TEACHER_VIEWS, sourceOf } from '../lib/content';

/**
 * Teacher's views — anecdotal or unverified claims from the source material, quarantined.
 * These never appear as practices, never as suggestions inside a session, and never as promises.
 * See CONTENT.md rule 5.
 */
export default function Views() {
  return (
    <div className="screen">
      <div className="head">
        <button className="btn-text" onClick={() => (location.hash = '#/more')}>← More</button>
        <h1 style={{ marginTop: 12 }}>Teacher's views</h1>
        <p>
          Claims made in the source videos that are anecdote rather than evidence. Kept here, on
          purpose, so they are readable without being treated as instructions or promised outcomes.
        </p>
      </div>

      {TEACHER_VIEWS.length === 0 ? (
        <div className="empty-state">
          <p>Nothing approved here yet.</p>
          <p className="small" style={{ marginTop: 8 }}>
            Claims land in content/teachers_views.json as drafts when a transcript is processed, and
            appear here only once you approve them.
          </p>
        </div>
      ) : (
        <div className="stack">
          {TEACHER_VIEWS.map((v) => (
            <div key={v.id} className="card stack">
              <p style={{ margin: 0, fontSize: 15 }}>{v.claim}</p>
              <div className="notice">{v.evidence_note}</div>
              {v.source_id && (
                <p className="tag" style={{ margin: 0 }}>
                  {sourceOf(v.source_id)?.title ?? v.source_id}{v.timestamp ? ` · ${v.timestamp}` : ''}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

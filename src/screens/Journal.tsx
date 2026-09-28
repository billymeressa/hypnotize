import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, today, uid } from '../db';
import type { JournalEntry } from '../types';
import { Sheet } from '../components/ui';

export default function Journal() {
  const entries = useLiveQuery(() => db.journal.orderBy('created_at').reverse().toArray(), [], []);
  const [open, setOpen] = useState<JournalEntry | 'new' | null>(null);

  return (
    <div className="screen">
      <div className="head">
        <h1>Journal</h1>
        <p>Private notes, on this device only.</p>
      </div>

      <button className="btn btn-block" onClick={() => setOpen('new')}>Write something</button>

      <div className="stack" style={{ marginTop: 30 }}>
        {entries.length === 0 && <p className="empty-state">Nothing written yet.</p>}
        {entries.map((e) => (
          <button key={e.id} className="card" onClick={() => setOpen(e)}>
            <div className="row-between">
              <span className="meta">{new Date(e.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
              {e.prompt && <span className="tag">{e.prompt}</span>}
            </div>
            <p className="small" style={{ margin: '8px 0 0' }}>
              {e.text.length > 160 ? `${e.text.slice(0, 157)}…` : e.text}
            </p>
          </button>
        ))}
      </div>

      {open && (
        <Editor
          entry={open === 'new'
            ? { id: uid(), date: today(), text: '', created_at: Date.now(), updated_at: Date.now() }
            : open}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function Editor({ entry, onClose }: { entry: JournalEntry; onClose: () => void }) {
  const [text, setText] = useState(entry.text);

  return (
    <Sheet title="Journal" onClose={onClose}>
      <div className="stack-lg">
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="…"
          style={{ minHeight: 220 }}
        />
        <button
          className="btn btn-block"
          disabled={!text.trim()}
          onClick={async () => {
            await db.journal.put({ ...entry, text: text.trim(), updated_at: Date.now() });
            onClose();
          }}
        >
          Save
        </button>
        <button
          className="btn btn-ghost btn-danger btn-block"
          onClick={async () => {
            if (confirm('Delete this entry?')) { await db.journal.delete(entry.id); onClose(); }
          }}
        >
          Delete
        </button>
      </div>
    </Sheet>
  );
}

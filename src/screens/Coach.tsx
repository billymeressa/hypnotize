import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Launcher } from '../App';
import type { ChatMessage, ProfileFact, SessionPlan } from '../types';
import { db, getProfile, uid } from '../db';
import { coachOpener, coachReply, conversationTitle, proposeFacts, suggestSessionType, type FactProposal } from '../lib/coach';
import { composeSession, personalSuggestions } from '../lib/compose';
import { SESSION_TYPE_META } from '../lib/content';
import { Sheet, Wave } from '../components/ui';

const CONV_KEY = 'hypnotize.conversation';

export default function Coach({ ctx }: { ctx: Launcher }) {
  const [conversationId, setConversationId] = useState(
    () => localStorage.getItem(CONV_KEY) ?? uid(),
  );
  const [draft, setDraft] = useState('');
  const [proposals, setProposals] = useState<FactProposal[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const openerSent = useRef<string | null>(null);

  useEffect(() => { localStorage.setItem(CONV_KEY, conversationId); }, [conversationId]);

  const messages = useLiveQuery(
    () => db.chat.where('conversation_id').equals(conversationId).sortBy('created_at'),
    [conversationId],
    [],
  );
  const allMessages = useLiveQuery(() => db.chat.orderBy('created_at').toArray(), [], []);
  const profile = useLiveQuery(() => getProfile(), [], undefined);
  const pastSessions = useLiveQuery(() => db.completions.orderBy('started_at').reverse().limit(3).toArray(), [], []);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages?.length]);

  // The Guide opens the conversation rather than leaving a blank box. The ref guards against a
  // second insert from React's double-invoked effects before the liveQuery has caught up.
  useEffect(() => {
    if (!messages || messages.length > 0) return;
    if (openerSent.current === conversationId) return;
    openerSent.current = conversationId;
    void db.chat.put({
      id: uid(), conversation_id: conversationId, role: 'guide',
      text: coachOpener(), created_at: Date.now(),
    });
  }, [messages, conversationId]);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const now = Date.now();
    await db.chat.put({ id: uid(), conversation_id: conversationId, role: 'user', text, created_at: now });
    const prior = await db.chat.where('conversation_id').equals(conversationId).sortBy('created_at');
    await db.chat.put({
      id: uid(), conversation_id: conversationId, role: 'guide',
      text: coachReply(prior, text), created_at: now + 1,
    });
  };

  const review = () => {
    const props = proposeFacts(messages ?? [], conversationId);
    setProposals(props);
    setChosen(new Set(props.map((p) => p.id)));   // pre-checked, but nothing saves until confirmed
  };

  const saveChosen = async () => {
    if (!proposals) return;
    const p = await getProfile();
    const add: ProfileFact[] = proposals
      .filter((x) => chosen.has(x.id))
      .map((x) => ({
        id: x.id, kind: x.kind, text: x.text, created_at: Date.now(),
        source: 'coach', from_conversation: conversationId,
      }));
    await db.profile.put({
      id: 'me',
      facts: [...p.facts.filter((f) => !add.some((a) => a.text.toLowerCase() === f.text.toLowerCase())), ...add],
      updated_at: Date.now(),
    });
    setProposals(null);
  };

  const buildSession = async (queue: boolean) => {
    const p = await getProfile();
    const st = suggestSessionType(messages ?? [], p.facts);
    const plan = composeSession({
      sessionType: st,
      targetMinutes: SESSION_TYPE_META[st].defaultMinutes,
      facts: p.facts,
      origin: 'coach',
      rationale: rationaleFor(p.facts, st),
    });
    if (queue) {
      await db.queue.put({ id: plan.id, plan, slot: 'next', created_at: Date.now() });
      ctx.go('today');
    } else ctx.launch(plan);
  };

  const conversations = groupConversations(allMessages ?? []);

  return (
    <div className="screen">
      <div className="head">
        <div className="row-between">
          <div>
            <h1>Change Coach</h1>
            <p>Tell it what you want to change. It asks; you do the talking.</p>
          </div>
        </div>
      </div>

      {pastSessions.length > 0 && messages && messages.length <= 1 && (
        <p className="notice" style={{ marginBottom: 18 }}>
          Last session: {pastSessions[0].title}
          {profile?.facts.length ? ` · ${profile.facts.length} facts in your profile` : ''}.
          It'll refer back to those.
        </p>
      )}

      <div className="stack" style={{ marginBottom: 20 }}>
        {(messages ?? []).map((m) => (
          <div key={m.id} className={`bubble bubble-${m.role}`}>{m.text}</div>
        ))}
        <div ref={bottom} />
      </div>

      <div className="stack">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type as much or as little as you want…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); }
          }}
        />
        <button className="btn btn-block" onClick={send} disabled={!draft.trim()}>Send</button>
      </div>

      {(messages?.filter((m) => m.role === 'user').length ?? 0) >= 2 && (
        <div className="stack" style={{ marginTop: 26 }}>
          <div className="divider" />
          <button className="btn btn-ghost btn-block" onClick={review}>Review what to remember</button>
          <button className="btn btn-ghost btn-block" onClick={() => buildSession(false)}>Build a session now</button>
          <button className="btn-text" style={{ textAlign: 'center' }} onClick={() => buildSession(true)}>
            Queue it for the next slot instead
          </button>
        </div>
      )}

      <div className="row-between" style={{ marginTop: 30 }}>
        <button className="btn-text" onClick={() => setHistory(true)}>Past conversations ({conversations.length})</button>
        <button
          className="btn-text"
          onClick={() => { const id = uid(); setConversationId(id); }}
        >
          New conversation
        </button>
      </div>
      <div style={{ marginTop: 30 }}><Wave bars={5} /></div>

      {proposals && (
        <Sheet title="Save to your profile?" onClose={() => setProposals(null)}>
          <div className="stack-lg">
            <p className="small dim">
              Nothing here has been saved yet. Untick anything you don't want kept, or close this and
              nothing changes.
            </p>
            {proposals.length === 0 && (
              <p className="dim small">Nothing durable stood out in this conversation yet — keep going.</p>
            )}
            <div className="stack">
              {proposals.map((p) => {
                const on = chosen.has(p.id);
                return (
                  <button
                    key={p.id}
                    className="card"
                    style={on ? { borderColor: 'var(--accent-deep)', background: 'var(--accent-wash)' } : undefined}
                    onClick={() => {
                      const next = new Set(chosen);
                      on ? next.delete(p.id) : next.add(p.id);
                      setChosen(next);
                    }}
                  >
                    <div className="row-between">
                      <span className="tag">{p.kind}</span>
                      <span className="tag">{on ? 'will save' : 'skipped'}</span>
                    </div>
                    <p style={{ margin: '8px 0 0', fontSize: 15 }}>{p.text}</p>
                    <p className="tiny faint" style={{ margin: '6px 0 0' }}>{p.because}</p>
                  </button>
                );
              })}
            </div>
            {proposals.length > 0 && (
              <button className="btn btn-block" onClick={saveChosen}>
                Save {chosen.size} of {proposals.length}
              </button>
            )}
            <button className="btn-text" style={{ textAlign: 'center' }} onClick={() => setProposals(null)}>
              Don't save anything
            </button>
          </div>
        </Sheet>
      )}

      {history && (
        <Sheet title="Past conversations" onClose={() => setHistory(false)}>
          <div className="stack">
            {conversations.length === 0 && <p className="dim small">Nothing yet.</p>}
            {conversations.map((c) => (
              <button
                key={c.id}
                className="card"
                onClick={() => { setConversationId(c.id); setHistory(false); }}
              >
                <div className="item-title" style={{ fontSize: 15 }}>{c.title}</div>
                <div className="meta" style={{ marginTop: 4 }}>
                  {new Date(c.at).toLocaleDateString()} · {c.count} messages
                </div>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}

function rationaleFor(facts: ProfileFact[], st: SessionPlan['session_type']) {
  const personal = personalSuggestions(facts, st);
  const lead = `Picked ${SESSION_TYPE_META[st].label.toLowerCase()} from what you described in this conversation.`;
  return personal.length
    ? `${lead} The personal suggestions come from your profile: ${personal.join('; ')}.`
    : `${lead} No profile facts were used — add some and future sessions get more specific.`;
}

function groupConversations(all: ChatMessage[]) {
  const map = new Map<string, ChatMessage[]>();
  for (const m of all) map.set(m.conversation_id, [...(map.get(m.conversation_id) ?? []), m]);
  return [...map.entries()]
    .map(([id, msgs]) => ({
      id,
      title: conversationTitle(msgs),
      at: msgs[msgs.length - 1].created_at,
      count: msgs.length,
    }))
    .filter((c) => c.count > 1)
    .sort((a, b) => b.at - a.at);
}

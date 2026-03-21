import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from "../lib/errorHandler";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'lige nu';
  if (m < 60) return `${m} min siden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}t siden`;
  const d = Math.floor(h / 24);
  return `${d}d siden`;
}

function Avatar({ name, size = 28 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--epic-dim)', border: '1px solid var(--epic-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, color: 'var(--epic)',
      flexShrink: 0,
    }}>
      {initials(name)}
    </div>
  );
}

function CommentItem({ comment, onReply, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!editBody.trim()) return;
    setSaving(true);
    try {
      const headers = await authHeaders();
      const r = await fetch(`/api/comments/${comment.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ body: editBody.trim() }),
      });
      if (r.ok) {
        const updated = await r.json();
        onEdit(updated);
        setEditing(false);
      }
    } catch (e) { handleError(e, "comments-api"); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!window.confirm('Slet kommentar?')) return;
    try {
      const headers = await authHeaders();
      await fetch(`/api/comments/${comment.id}`, { method: 'DELETE', headers });
      onDelete(comment.id);
    } catch (e) { handleError(e, "comments-api"); }
  }

  return (
    <div style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <Avatar name={comment.author_name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{comment.author_name}</span>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{timeAgo(comment.created_at)}</span>
          {comment.updated_at !== comment.created_at && (
            <span style={{ fontSize: 10, color: 'var(--text3)', fontStyle: 'italic' }}>redigeret</span>
          )}
        </div>

        {editing ? (
          <div>
            <textarea
              value={editBody}
              onChange={e => setEditBody(e.target.value)}
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg)', border: '1px solid var(--border2)',
                borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 12,
                padding: '6px 8px', resize: 'vertical', fontFamily: 'var(--sans)',
              }}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button
                onClick={handleSave}
                disabled={saving || !editBody.trim()}
                style={btnStyle('var(--jade)', saving)}
              >
                {saving ? 'Gemmer...' : 'Gem'}
              </button>
              <button onClick={() => setEditing(false)} style={btnStyle('transparent')}>
                Annullér
              </button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {comment.body}
          </div>
        )}

        {!editing && (
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button onClick={() => onReply(comment)} style={linkBtn}>↩ Svar</button>
            {comment.is_own && (
              <>
                <button onClick={() => setEditing(true)} style={linkBtn}>Rediger</button>
                <button onClick={handleDelete} style={{ ...linkBtn, color: 'var(--danger)' }}>Slet</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const linkBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 11, color: 'var(--text3)', padding: 0,
};

function btnStyle(bg, disabled = false) {
  return {
    fontSize: 11, padding: '4px 10px', borderRadius: 'var(--radius)',
    border: '1px solid var(--border2)',
    background: bg === 'transparent' ? 'transparent' : bg,
    color: bg === 'var(--jade)' ? '#0c0c0f' : 'var(--text2)',
    cursor: disabled ? 'wait' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    fontWeight: bg === 'var(--jade)' ? 600 : 400,
  };
}

export default function CommentsPanel({ itemId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!itemId) return;
    loadComments();
  }, [itemId]); // eslint-disable-line

  async function loadComments() {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const r = await fetch(`/api/items/${itemId}/comments`, { headers });
      if (r.ok) setComments(await r.json());
    } catch (e) { handleError(e, "comments-api"); }
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    try {
      const headers = await authHeaders();
      const r = await fetch(`/api/items/${itemId}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ body: body.trim(), parent_id: replyTo?.id || null }),
      });
      if (r.ok) {
        const newComment = await r.json();
        setComments(prev => [...prev, newComment]);
        setBody('');
        setReplyTo(null);
      }
    } catch (e) { handleError(e, "comments-api"); }
    setSubmitting(false);
  }

  function handleEdit(updated) {
    setComments(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
  }

  function handleDelete(id) {
    setComments(prev => prev.filter(c => c.id !== id));
  }

  function handleReply(comment) {
    setReplyTo(comment);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  // Split into roots and replies
  const roots = comments.filter(c => !c.parent_id);
  const repliesMap = comments.reduce((acc, c) => {
    if (c.parent_id) {
      if (!acc[c.parent_id]) acc[c.parent_id] = [];
      acc[c.parent_id].push(c);
    }
    return acc;
  }, {});

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        💬 Kommentarer
        {comments.length > 0 && (
          <span style={{ fontSize: 10, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '1px 6px', color: 'var(--text3)' }}>
            {comments.length}
          </span>
        )}
      </div>

      {loading && (
        <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0' }}>Henter kommentarer...</div>
      )}

      {!loading && roots.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0', fontStyle: 'italic' }}>
          Ingen kommentarer endnu. Skriv den første.
        </div>
      )}

      {!loading && roots.map(comment => (
        <div key={comment.id}>
          <CommentItem
            comment={comment}
            onReply={handleReply}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
          {/* Nested replies (1 level) */}
          {(repliesMap[comment.id] || []).map(reply => (
            <div key={reply.id} style={{ marginLeft: 38, borderLeft: '2px solid var(--border)', paddingLeft: 12 }}>
              <CommentItem
                comment={reply}
                onReply={() => {}} // no deeper nesting
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </div>
          ))}
        </div>
      ))}

      {/* Input */}
      <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
        {replyTo && (
          <div style={{
            fontSize: 11, color: 'var(--text3)', background: 'var(--bg2)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            padding: '5px 10px', marginBottom: 6,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span>↩ Svarer {replyTo.author_name}</span>
            <button type="button" onClick={() => setReplyTo(null)} style={{ ...linkBtn, fontSize: 13 }}>×</button>
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder={replyTo ? `Svar til ${replyTo.author_name}...` : 'Skriv en kommentar...'}
          rows={2}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e);
          }}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 12,
            padding: '8px 10px', resize: 'vertical', fontFamily: 'var(--sans)',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <button
            type="submit"
            disabled={submitting || !body.trim()}
            style={{
              fontSize: 12, padding: '5px 14px', borderRadius: 'var(--radius)',
              background: body.trim() ? 'var(--jade)' : 'var(--bg3)',
              color: body.trim() ? '#0c0c0f' : 'var(--text3)',
              border: 'none', cursor: submitting ? 'wait' : 'pointer',
              fontWeight: 600, transition: 'background 0.2s',
            }}
          >
            {submitting ? 'Sender...' : 'Send ⏎'}
          </button>
        </div>
      </form>
    </div>
  );
}

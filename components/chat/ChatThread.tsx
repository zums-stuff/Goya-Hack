// components/chat/ChatThread.tsx — Chat in-app, mobile-first.
//
// Scope:
//   - `listing`: regateo entre offerer y seller (pre-aceptación).
//   - `escrow` : coordinación de pickup entre buyer y seller (post-aceptación).
//
// Diseño:
//   - Burbujas con avatar, mensaje, hora relativa.
//   - Mis mensajes a la derecha (coral), los del otro a la izquierda (lavanda).
//   - Input fijo al fondo con botón enviar + estado de envío.
//   - Polling 4s mientras la pestaña está visible (Page Visibility API).
//   - Auto-scroll al último mensaje cuando llegan nuevos.
//
// Accesibilidad: role="log" con aria-live="polite" para nuevos mensajes;
// role="form" en el input.

'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2, Send } from 'lucide-react';

type Scope = 'listing' | 'escrow';

export type ChatMessage = {
  id: string;
  scope: Scope;
  scopeId: string;
  senderId: string;
  body: string;
  createdAt: string; // ISO
  readAt: string | null;
  sender: { id: string; displayName: string };
};

type Props = {
  scope: Scope;
  scopeId: string;
  meId: string;
  /** Mostrar el título del listing arriba del chat (opcional). */
  title?: string;
  /** Polling interval ms — default 4000. */
  pollMs?: number;
  /** Deshabilita input (escrow completado etc). */
  disabled?: boolean;
  disabledReason?: string;
};

function initials(name: string): string {
  const p = name.replace(/\./g, '').trim().split(/\s+/);
  return ((p[0]?.[0] ?? '?') + (p[1]?.[0] ?? '')).toUpperCase();
}

function relTime(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now - t);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ChatThread({
  scope,
  scopeId,
  meId,
  title,
  pollMs = 4000,
  disabled,
  disabledReason,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Para no re-scrlear si el usuario está scrolleando arriba.
  const stickToBottomRef = useRef(true);

  const endpoint = useMemo(
    () => (scope === 'listing'
      ? `/api/listings/${scopeId}/messages`
      : `/api/escrow/${scopeId}/messages`),
    [scope, scopeId],
  );

  async function fetchMessages(silent: boolean) {
    try {
      if (!silent) setLoading(true);
      const r = await fetch(endpoint, { cache: 'no-store' });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${r.status}`);
      }
      const data = (await r.json()) as { messages: ChatMessage[] };
      setMessages(data.messages);
      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Polling ajustado al tab visibility: solo corre si la pestaña está visible.
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (interval == null) {
        interval = setInterval(() => {
          if (document.visibilityState === 'visible') {
            void fetchMessages(true);
          }
        }, pollMs);
      }
    }
    function stop() {
      if (interval != null) {
        clearInterval(interval);
        interval = null;
      }
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') {
        void fetchMessages(true);
        start();
      } else {
        stop();
      }
    }

    void fetchMessages(true);
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [endpoint, pollMs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll al final solo si el usuario está abajo (stickToBottom).
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
    stickToBottomRef.current = distanceFromBottom < 60;
  }

  async function send() {
    const text = body.trim();
    if (!text || sending || disabled) return;
    setSending(true);
    setError(null);
    // Optimistic update.
    const optimistic: ChatMessage = {
      id: `temp-${Date.now()}`,
      scope,
      scopeId,
      senderId: meId,
      body: text,
      createdAt: new Date().toISOString(),
      readAt: null,
      sender: { id: meId, displayName: 'Tú' },
    };
    setMessages((m) => [...m, optimistic]);
    setBody('');
    stickToBottomRef.current = true;
    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as {
          message?: string;
          details?: Array<{ message: string }>;
        };
        throw new Error(j.message ?? j.details?.[0]?.message ?? `HTTP ${r.status}`);
      }
      // Re-fetch para obtener el mensaje con id real y metadata del server.
      await fetchMessages(true);
    } catch (e) {
      // Revierte el optimistic.
      setMessages((m) => m.filter((mm) => mm.id !== optimistic.id));
      setError((e as Error).message);
      // Restaura el body para que el usuario pueda reintentar.
      setBody(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envía; Shift+Enter hace newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  // Agrupo por día para headers intermedios (UX, no obligatorio).
  const grouped = useMemo(() => {
    const out: Array<{ day: string; items: ChatMessage[] }> = [];
    let current: { day: string; items: ChatMessage[] } | null = null;
    for (const m of messages) {
      const d = new Date(m.createdAt);
      const key = d.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
      });
      if (!current || current.day !== key) {
        current = { day: key, items: [] };
        out.push(current);
      }
      current.items.push(m);
    }
    return out;
  }, [messages]);

  return (
    <section className="trade-chat" role="region" aria-label="Conversación">
      {title && (
        <header className="trade-chat-header">
          <span aria-hidden style={{
            width: 28, height: 28, borderRadius: 999,
            background: 'var(--lavender)',
            display: 'grid', placeItems: 'center',
            color: '#4b3a8a', fontSize: 11, fontWeight: 800,
          }}>
            ✉
          </span>
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            <strong>{title}</strong>
            <small>
              {scope === 'listing'
                ? 'Conversación con el vendedor antes de aceptar la oferta'
                : 'Conversación con la otra parte para coordinar el encuentro'}
            </small>
          </span>
        </header>
      )}

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="trade-chat-scroller"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {loading && messages.length === 0 && (
          <div className="trade-chat-empty">
            <Loader2 className="trade-chat-spin" />
            <span>Cargando conversación…</span>
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="trade-chat-empty">
            <strong>Aún no hay mensajes</strong>
            <small>
              {scope === 'listing'
                ? 'Inicia la conversación con el vendedor para negociar el intercambio.'
                : 'Inicia la conversación con la otra parte para coordinar el encuentro.'}
            </small>
          </div>
        )}
        {grouped.map((g) => (
          <div key={g.day} className="trade-chat-day-group">
            <div className="trade-chat-day-header">
              <span>{g.day}</span>
            </div>
            {g.items.map((m) => {
              const mine = m.senderId === meId;
              return (
                <div
                  key={m.id}
                  className={`trade-chat-row ${mine ? 'mine' : 'theirs'}`}
                >
                  {!mine && (
                    <span className="trade-chat-avatar" aria-hidden>
                      {initials(m.sender.displayName)}
                    </span>
                  )}
                  <div className={`trade-chat-bubble ${mine ? 'mine' : 'theirs'}`}>
                    <p className="body">{m.body}</p>
                    <span className="meta">
                      {clockTime(m.createdAt)} · {relTime(m.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <form
        className="trade-chat-input"
        onSubmit={onSubmit}
        role="form"
      >
        <textarea
          ref={inputRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={1000}
          rows={2}
          placeholder={
            disabled
              ? disabledReason ?? 'Chat cerrado'
              : scope === 'listing'
                ? 'Pregúntale al vendedor cualquier cosa…'
                : 'Coordina el encuentro aquí…'
          }
          disabled={!!disabled || sending}
          aria-label="Mensaje"
        />
        <button
          type="submit"
          className="trade-chat-send"
          disabled={!!disabled || sending || body.trim().length === 0}
          aria-label="Enviar"
        >
          {sending ? <Loader2 className="trade-chat-spin" /> : <Send />}
          {sending ? 'Enviando' : 'Enviar'}
        </button>
      </form>

      {error && (
        <div className="form-error" style={{ margin: '8px 12px 12px' }}>
          <AlertCircle />
          {error}
        </div>
      )}

      {lastUpdated && !error && (
        <p
          style={{
            marginTop: -4,
            marginBottom: 6,
            fontSize: 9,
            color: '#94a0b0',
            textAlign: 'right',
            padding: '0 12px',
          }}
        >
          sincronizado · {lastUpdated.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
      )}
    </section>
  );
}

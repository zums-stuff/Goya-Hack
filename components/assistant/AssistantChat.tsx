// components/assistant/AssistantChat.tsx — Chat interactivo con POST a /api/assistant.
// Sistema: chat-panel + chat-messages + chat-input-row. Renderiza la lista
// de listings como chips linkables para que el user abra el que le
// interese sin salir del chat.
'use client';

import { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Bot, ChevronRight, Sparkles, Slash } from 'lucide-react';
import {
  type Listing,
  type AssistantReply,
} from './types';


export function AssistantChat() {
  const [messages, setMessages] = useState<
    Array<{ role: 'user' | 'assistant'; text: string; listings?: Listing[] }>
  >([
    {
      role: 'assistant',
      text: 'Hola. Describe lo que buscas y comparo precio, calidad y confianza entre los listings.',
      listings: [],
    },
  ]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setDraft('');
    setBusy(true);
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? 'Asistente caído');
      }
      const data = (await res.json()) as AssistantReply;
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.reply,
          listings: data.listings,
        },
      ]);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
      });
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: `Algo falló: ${(e as Error).message}. Vuelve a intentar.` },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat-panel">
      <div className="chat-head">
        <span className="ai-avatar">
          <Bot />
        </span>
        <div>
          <strong>Asistente PumaTrade</strong>
          <small>En línea · analiza precio y calidad</small>
        </div>
      </div>

      <div className="chat-messages" ref={listRef}>
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="chat-bubble user-bubble">
              {m.text}
            </div>
          ) : (
            <div key={i}>
              <div className="chat-bubble ai-bubble">{m.text}</div>
              {m.listings && m.listings.length > 0 && (
                <ul
                  style={{
                    marginTop: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    maxWidth: '78%',
                  }}
                >
                  {m.listings.map((l) => (
                    <li key={l.id}>
                      <Link
                        href={`/marketplace/${l.id}`}
                        className="ai-result"
                        style={{ textDecoration: 'none' }}
                      >
                        <div
                          className="mini-product"
                          style={{ background: 'var(--mint)' }}
                        >
                          <Sparkles />
                        </div>
                        <div>
                          <strong>{l.title}</strong>
                          <span>
                            P${' '}
                            {(l.priceXlm / 100).toLocaleString('es-MX', {
                              maximumFractionDigits: 0,
                            })}{' '}
                            · {l.seller.displayName} ({l.seller.major})
                          </span>
                        </div>
                        <ChevronRight />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ),
        )}
        {busy && (
          <div className="chat-bubble ai-bubble" style={{ opacity: 0.6 }}>
            <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              <Slash className="lucide-inline" /> Analizando…
            </span>
          </div>
        )}
      </div>

      <form className="chat-input-row" onSubmit={send}>
        <input
          aria-label="Escribe tu pregunta"
          placeholder='Ej. "mejor calculadora barata" o "laptop para mi carrera"'
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={busy}
        />
        <button
          type="submit"
          className="chat-send-btn"
          disabled={busy || draft.trim().length === 0}
          aria-label="Enviar"
        >
          <ChevronRight />
        </button>
      </form>
    </div>
  );
}

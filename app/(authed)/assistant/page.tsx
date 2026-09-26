// app/(authed)/assistant/page.tsx — Placeholder UI para "Asistente IA" del sidebar.
import { Bot, ChevronRight } from 'lucide-react';

export default function AssistantPage() {
  return (
    <section className="assistant-view">
      <p className="eyebrow">PUMATRADE AI</p>
      <h1 style={{ fontSize: 29, letterSpacing: '-1px', margin: '0 0 8px', color: '#26364c' }}>
        Encuentra justo lo que necesitas
      </h1>
      <p className="subcopy">
        Describe lo que buscas y compararé calidad, precio y confianza entre
        artículos del marketplace.
      </p>

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
        <div className="chat-messages">
          <div className="chat-bubble user-bubble">
            Necesito una calculadora científica para mi clase de circuitos.
          </div>
          <div className="chat-bubble ai-bubble">
            Encontré varias opciones verificadas en tu facultad. Revisa la
            sección <code className="font-mono">/marketplace</code> filtrando
            por tipo "calculadoras".
          </div>
          <div className="chat-bubble user-bubble">
            ¿Cuál tiene la mejor relación calidad-precio?
          </div>
          <div className="chat-bubble ai-bubble">
            Compara la TI-89 frente al multímetro Fluke de María R.: ambas
            tienen video verificado. La TI-89 está en precio de mercado
            (P$ 800); el multímetro, elevado (P$ 1,200). Si buscas
            durabilidad, el multímetro es mejor. Para una clase puntual, la
            calculadora.
          </div>
        </div>
        <div className="chat-composer">
          <input
            aria-label="Escribe tu pregunta"
            placeholder="Ej. Busca un multímetro económico..."
          />
          <button aria-label="Enviar">
            <ChevronRight />
          </button>
        </div>
      </div>

      <p
        className="subcopy"
        style={{ marginTop: 24, fontSize: 11, color: '#94a0b0' }}
      >
        Demo del módulo IA — la integración completa (OpenAI, comparador de
        precios, scores de confianza) se entrega post-MVP.
      </p>
    </section>
  );
}

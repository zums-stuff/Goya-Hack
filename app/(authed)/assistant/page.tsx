// app/(authed)/assistant/page.tsx — Asistente IA con chat funcional.
// POST -> /api/assistant; asistente heurístico (no LLM real) que busca
// en listings; renderiza resultados como links inline.
import { AssistantChat } from '@/components/assistant/AssistantChat';

export default function AssistantPage() {
  return (
    <section className="assistant-view" style={{ maxWidth: 760 }}>
      <p className="eyebrow">PUMATRADE AI · UNAM</p>
      <h1 style={{ fontSize: 27, letterSpacing: '-1px', margin: '0 0 8px', color: '#26364c' }}>
        Encuentra justo lo que necesitas
      </h1>
      <p className="subcopy">
        Describe lo que buscas y comparo precio, calidad y confianza entre
        los listings del marketplace. Las respuestas devuelven links
        directos al listing puntual.
      </p>

      <div style={{ marginTop: 24 }}>
        <AssistantChat />
      </div>

      <p
        className="subcopy"
        style={{ marginTop: 18, fontSize: 10, color: '#94a0b0' }}
      >
        Demo — el motor actual es heurístico (palabras clave sobre el seed).
        La integración con OpenAI + comparador semántico se entrega
        post-MVP. Mientras tanto, las recomendaciones son reales (vienen
        de la DB del seed).
      </p>
    </section>
  );
}

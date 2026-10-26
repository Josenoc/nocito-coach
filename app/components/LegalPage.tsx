import type { ReactNode } from "react";

export default function LegalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="legal-wrap">
      <article className="legal-card">
        <a className="legal-back" href="/index.html">
          ← Volver al inicio
        </a>
        <h1 className="legal-title">{title}</h1>
        <p className="legal-updated">
          Última actualización: 26 de octubre de 2026.
        </p>
        {children}
        <p className="legal-contact">
          Consultas sobre este documento:{" "}
          <a href="mailto:nocito.coach@gmail.com">nocito.coach@gmail.com</a> ·{" "}
          <a
            href="https://wa.me/5492616224718?text=Hola%20Jos%C3%A9%2C%20tengo%20una%20consulta%20legal%20sobre%20nocito.coach."
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp
          </a>
          .
        </p>
        <nav className="legal-links" aria-label="Documentos legales">
          <a href="/privacidad">Política de privacidad</a>
          <a href="/terminos">Términos y condiciones</a>
        </nav>
      </article>
    </main>
  );
}

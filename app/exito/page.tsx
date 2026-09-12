const WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5492616224718";

export default async function ExitoPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; status?: string }>;
}) {
  const params = await searchParams;
  const name = params.name || "";
  const pending = params.status === "pending";

  const msg = pending
    ? "Hola José, realicé el pago de mi plan pero quedó pendiente. Te escribo para coordinar."
    : `Hola José, ya realicé el pago de mi plan${name ? ` (${name})` : ""}. Espero mi rutina.`;
  const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(180deg,#0b0b0b 0%,#121212 100%)",
        color: "#fff",
        fontFamily: "Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "520px",
          textAlign: "center",
          background: "#151515",
          border: "1px solid #262626",
          borderRadius: "18px",
          padding: "40px 32px",
        }}
      >
        <div style={{ fontSize: "48px" }}>{pending ? "⏳" : "✅"}</div>
        <h1 style={{ fontSize: "26px", margin: "16px 0 8px" }}>
          {pending
            ? "Tu pago quedó pendiente"
            : name
              ? `¡Gracias, ${name}!`
              : "¡Gracias por tu compra!"}
        </h1>
        <p style={{ color: "#aaa", lineHeight: 1.6, margin: "0 0 24px" }}>
          {pending
            ? "Cuando completes el pago, tu rutina y tu pauta nutricional te llegan por email automáticamente."
            : "Tu rutina y tu pauta nutricional te llegan por email de forma automática en los próximos minutos. Si no lo ves, revisá spam o escribinos por WhatsApp."}
        </p>
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            background: "#25D366",
            color: "#04210f",
            fontWeight: 700,
            textDecoration: "none",
            padding: "14px 30px",
            borderRadius: "999px",
            fontSize: "16px",
          }}
        >
          {pending ? "Avisar a José por WhatsApp" : "Hablar con José por WhatsApp"}
        </a>
        <div style={{ marginTop: "20px" }}>
          <a
            href="/index.html"
            style={{ color: "#ff8a65", textDecoration: "none", fontSize: "14px" }}
          >
            Volver a la página principal
          </a>
        </div>
      </div>
    </main>
  );
}
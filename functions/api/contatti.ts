interface Env {
  TURNSTILE_SECRET: string;
  RESEND_API_KEY: string;
}

interface TurnstileResult {
  success: boolean;
  "error-codes"?: string[];
}

interface PagesContext<TEnv> {
  request: Request;
  env: TEnv;
}

const CONTACT_EMAIL = "info@difesapersonalesondrio.it";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const jsonResponse = (message: string, status: number): Response =>
  Response.json({ message }, { status });

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character
  );

export const onRequestPost = async (
  context: PagesContext<Env>
): Promise<Response> => {
  try {
    const formData = await context.request.formData();

    const token = String(formData.get("cf-turnstile-response") ?? "");
    const nome = String(formData.get("nome") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const telefono = String(formData.get("telefono") ?? "").trim();
    const corso = String(formData.get("corso") ?? "").trim();
    const messaggio = String(formData.get("messaggio") ?? "").trim();
    const privacy = String(formData.get("privacy") ?? "");
    const website = String(formData.get("website") ?? "").trim();

    if (website) {
      return jsonResponse("Richiesta ricevuta correttamente.", 200);
    }

    if (
      !token ||
      nome.length < 2 ||
      nome.length > 100 ||
      !EMAIL_PATTERN.test(email) ||
      email.length > 150 ||
      telefono.length > 30 ||
      !corso ||
      messaggio.length < 10 ||
      messaggio.length > 2000 ||
      privacy !== "accettata"
    ) {
      return jsonResponse(
        "Dati mancanti o non validi. Controlla i campi e riprova.",
        400
      );
    }

    const verificationData = new FormData();
    verificationData.append("secret", context.env.TURNSTILE_SECRET);
    verificationData.append("response", token);

    const ip = context.request.headers.get("CF-Connecting-IP");
    if (ip) {
      verificationData.append("remoteip", ip);
    }

    const verificationResponse = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: verificationData,
      }
    );

    if (!verificationResponse.ok) {
      console.error(
        JSON.stringify({
          event: "turnstile_verification_error",
          status: verificationResponse.status,
        })
      );
      return jsonResponse("Controllo di sicurezza non disponibile.", 502);
    }

    const verification =
      (await verificationResponse.json()) as TurnstileResult;

    if (!verification.success) {
      return jsonResponse("Controllo di sicurezza non superato.", 403);
    }

    if (!context.env.RESEND_API_KEY) {
      console.error(
        JSON.stringify({ event: "contact_email_secret_missing" })
      );
      return jsonResponse("Servizio di invio temporaneamente non disponibile.", 503);
    }

    const safeNome = escapeHtml(nome);
    const safeEmail = escapeHtml(email);
    const safeTelefono = escapeHtml(telefono || "Non indicato");
    const safeCorso = escapeHtml(corso);
    const safeMessaggio = escapeHtml(messaggio).replace(/\n/g, "<br>");

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${context.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Self Defense Sondrio <${CONTACT_EMAIL}>`,
        to: [CONTACT_EMAIL],
        reply_to: email,
        subject: `Nuova richiesta dal sito — ${nome}`,
        html: `
          <h1>Nuova richiesta dal sito</h1>
          <p><strong>Nome:</strong> ${safeNome}</p>
          <p><strong>Email:</strong> ${safeEmail}</p>
          <p><strong>Telefono:</strong> ${safeTelefono}</p>
          <p><strong>Corso di interesse:</strong> ${safeCorso}</p>
          <p><strong>Messaggio:</strong><br>${safeMessaggio}</p>
        `,
        text: [
          "Nuova richiesta dal sito",
          `Nome: ${nome}`,
          `Email: ${email}`,
          `Telefono: ${telefono || "Non indicato"}`,
          `Corso di interesse: ${corso}`,
          "",
          messaggio,
        ].join("\n"),
      }),
    });

    if (!emailResponse.ok) {
      console.error(
        JSON.stringify({
          event: "contact_email_send_error",
          status: emailResponse.status,
        })
      );
      return jsonResponse(
        "Non è stato possibile inviare la richiesta. Riprova più tardi.",
        502
      );
    }

    return jsonResponse(
      "Richiesta inviata correttamente. Ti ricontatteremo al più presto.",
      200
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "contact_form_error",
        message: error instanceof Error ? error.message : "unknown_error",
      })
    );

    return jsonResponse("Si è verificato un errore durante l’invio.", 500);
  }
};

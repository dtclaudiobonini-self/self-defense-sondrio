interface Env {
  TURNSTILE_SECRET: string;
}

interface TurnstileResult {
  success: boolean;
  "error-codes"?: string[];
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const formData = await context.request.formData();

    const token = formData.get("cf-turnstile-response");
    const nome = String(formData.get("nome") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const messaggio = String(formData.get("messaggio") ?? "").trim();

    if (!token || !nome || !email || !messaggio) {
      return new Response("Dati mancanti o controllo di sicurezza non completato.", {
        status: 400,
      });
    }

    const verificationData = new FormData();
    verificationData.append("secret", context.env.TURNSTILE_SECRET);
    verificationData.append("response", String(token));

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

    const verification =
      (await verificationResponse.json()) as TurnstileResult;

    if (!verification.success) {
      return new Response("Controllo di sicurezza non superato.", {
        status: 403,
      });
    }

    /*
     * Qui andrà inserito l'invio dell'email oppure il salvataggio
     * effettivo della richiesta.
     */

    return new Response(
      "Richiesta ricevuta correttamente. Ti ricontatteremo al più presto.",
      { status: 200 }
    );
  } catch (error) {
    console.error("Errore modulo contatti:", error);

    return new Response("Si è verificato un errore durante l'invio.", {
      status: 500,
    });
  }
};
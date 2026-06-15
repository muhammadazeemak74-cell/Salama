import { NextResponse } from "next/server";

// The webhook needs Node.js APIs and must not be statically optimized.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — Webhook verification handshake.
 *
 * When you subscribe the webhook in the Meta App dashboard, Meta sends a GET
 * request with `hub.mode`, `hub.verify_token` and `hub.challenge`. We must echo
 * back the challenge as plain text IF the verify token matches the one we
 * configured (WHATSAPP_VERIFY_TOKEN). Otherwise we reject with 403.
 *
 * Docs: https://developers.facebook.com/docs/graph-api/webhooks/getting-started
 */
export function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token && token === verifyToken) {
    console.log("[whatsapp-webhook] verification succeeded");
    // Meta expects the raw challenge string echoed back.
    return new NextResponse(challenge ?? "", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }

  console.warn("[whatsapp-webhook] verification failed", { mode, token });
  return new NextResponse("Forbidden", { status: 403 });
}

/**
 * POST — Receive inbound WhatsApp messages and status updates.
 *
 * Phase 1 scaffold: we only LOG the incoming payload to the server console.
 * No AI processing, transcription, validation, or storage happens here yet.
 *
 * We always return 200 quickly so Meta does not retry the delivery. Real
 * processing will later be moved off the request path.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    console.warn("[whatsapp-webhook] received non-JSON or empty body");
    return new NextResponse("Bad Request", { status: 400 });
  }

  console.log(
    "[whatsapp-webhook] incoming payload:",
    JSON.stringify(body, null, 2),
  );

  // Best-effort: surface individual messages in the log for readability.
  // The Cloud API nests messages under entry[].changes[].value.messages[].
  try {
    const entries = (body as { entry?: unknown[] }).entry ?? [];
    for (const entry of entries) {
      const changes = (entry as { changes?: unknown[] }).changes ?? [];
      for (const change of changes) {
        const value = (change as { value?: { messages?: unknown[] } }).value;
        const messages = value?.messages ?? [];
        for (const message of messages) {
          const { from, type, id } = message as {
            from?: string;
            type?: string;
            id?: string;
          };
          console.log("[whatsapp-webhook] message received", {
            id,
            from,
            type,
          });
        }
      }
    }
  } catch (err) {
    console.error("[whatsapp-webhook] error while parsing messages", err);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

import { createServer, type IncomingMessage } from "node:http";
import { checkRelayBody, checkRelayRequest, MAX_BODY_BYTES } from "../lib/relay-guard.ts";

const remoteUrl = process.env.LOVENSE_REMOTE_URL;
const port = Number(process.env.LOVENSE_RELAY_PORT ?? 8787);

if (!remoteUrl?.startsWith("https://")) {
  throw new Error("LOVENSE_REMOTE_URL doit être l'URL HTTPS Game Mode, par exemple https://192-168-1-20.lovense.club:30010");
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  const admission = checkRelayRequest(
    { method: request.method, url: request.url, origin, host: request.headers.host, contentType: request.headers["content-type"] },
    port,
  );
  if (!admission.ok) {
    // Aucun en-tête CORS : une origine refusée ne doit rien pouvoir lire.
    response.writeHead(admission.status, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: admission.error }));
    return;
  }

  const cors = {
    "access-control-allow-origin": origin as string,
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    vary: "Origin",
  };
  if (request.method === "OPTIONS") {
    response.writeHead(204, cors);
    response.end();
    return;
  }

  try {
    const body = await readBody(request);
    const verdict = checkRelayBody(body);
    if (!verdict.ok) {
      response.writeHead(verdict.status, { ...cors, "content-type": "application/json" });
      response.end(JSON.stringify({ error: verdict.error }));
      return;
    }
    const upstream = await fetch(`${remoteUrl.replace(/\/$/, "")}/command`, {
      method: "POST",
      headers: { "content-type": "application/json", "X-platform": "Lovense Arcade Number Shooter" },
      body,
      signal: AbortSignal.timeout(5000),
    });
    response.writeHead(upstream.status, { ...cors, "content-type": "application/json" });
    response.end(await upstream.text());
  } catch {
    response.writeHead(502, { ...cors, "content-type": "application/json" });
    response.end(JSON.stringify({ error: "Lovense Remote inaccessible depuis le relais local" }));
  }
});

// Loopback only: never expose a Lovense relay to the Internet or the LAN.
server.listen(port, "127.0.0.1", () => {
  console.log(`Relais Lovense local : http://127.0.0.1:${port}`);
});

function readBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = "";
    let size = 0;
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      size += Buffer.byteLength(chunk, "utf8");
      // On cesse d'accumuler au-delà de la limite ; checkRelayBody répondra 413.
      if (size <= MAX_BODY_BYTES + 1024) body += chunk;
    });
    request.on("end", () => resolve(size > MAX_BODY_BYTES ? " ".repeat(MAX_BODY_BYTES + 1) : body));
    request.on("error", reject);
  });
}

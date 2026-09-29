import { createServer } from "node:http";

const remoteUrl = process.env.LOVENSE_REMOTE_URL;
const port = Number(process.env.LOVENSE_RELAY_PORT ?? 8787);

if (!remoteUrl?.startsWith("https://")) {
  throw new Error("LOVENSE_REMOTE_URL doit être l'URL HTTPS Game Mode, par exemple https://192-168-1-20.lovense.club:30010");
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders(request));
    response.end();
    return;
  }
  if (request.method !== "POST" || request.url !== "/command") {
    response.writeHead(404).end("Not found");
    return;
  }

  try {
    const body = await readBody(request);
    const upstream = await fetch(`${remoteUrl.replace(/\/$/, "")}/command`, {
      method: "POST",
      headers: { "content-type": "application/json", "X-platform": "Lovense Arcade Number Shooter" },
      body,
    });
    response.writeHead(upstream.status, { ...corsHeaders(request), "content-type": "application/json" });
    response.end(await upstream.text());
  } catch {
    response.writeHead(502, { ...corsHeaders(request), "content-type": "application/json" });
    response.end(JSON.stringify({ error: "Lovense Remote inaccessible depuis le relais local" }));
  }
});

// Loopback only: never expose a Lovense relay to the Internet or the LAN.
server.listen(port, "127.0.0.1", () => {
  console.log(`Relais Lovense local : http://127.0.0.1:${port}`);
});

function corsHeaders(request: import("node:http").IncomingMessage) {
  const origin = request.headers.origin;
  const allowed = origin === "http://localhost:3000" || origin === "http://127.0.0.1:3000";
  return allowed ? { "access-control-allow-origin": origin, "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST, OPTIONS" } : {};
}

function readBody(request: import("node:http").IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => { body += chunk; });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

/* Règles d'admission du relais local (scripts/lovense-relay.ts), isolées ici
   pour être testées sans ouvrir de socket.

   Le relais écoute sur 127.0.0.1, mais « local » ne veut pas dire « privé » :
   n'importe quel site ouvert dans le navigateur peut envoyer une requête vers
   http://127.0.0.1:8787. Les en-têtes CORS n'empêchent pas la requête de
   partir, seulement la lecture de la réponse. Il faut donc refuser côté
   serveur tout ce qui ne vient pas de l'application. */

export const ALLOWED_ORIGINS: ReadonlySet<string> = new Set(["http://localhost:3000", "http://127.0.0.1:3000"]);
export const ALLOWED_COMMANDS: ReadonlySet<string> = new Set(["GetToys", "Function", "Pattern"]);
export const MAX_BODY_BYTES = 4096;

export interface RelayRequest {
  method?: string;
  url?: string;
  origin?: string;
  host?: string;
  contentType?: string;
}

export type RelayDecision = { ok: true } | { ok: false; status: number; error: string };

const deny = (status: number, error: string): RelayDecision => ({ ok: false, status, error });

/** Hôte attendu : bloque le DNS rebinding (un domaine externe résolu vers 127.0.0.1). */
export function isLoopbackHost(host: string | undefined, port: number) {
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}

export function checkRelayRequest(request: RelayRequest, port: number): RelayDecision {
  if (!isLoopbackHost(request.host, port)) return deny(403, "Hôte refusé");
  if (!request.origin || !ALLOWED_ORIGINS.has(request.origin)) return deny(403, "Origine refusée");
  if (request.method === "OPTIONS") return { ok: true };
  if (request.method !== "POST" || request.url !== "/command") return deny(404, "Introuvable");
  // application/json force un preflight CORS : une page tierce ne peut pas l'envoyer en douce.
  if (!/^application\/json\b/i.test(request.contentType ?? "")) return deny(415, "Content-Type application/json requis");
  return { ok: true };
}

/** Ne laisse passer que les commandes dont l'application a besoin. */
export function checkRelayBody(body: string): RelayDecision {
  if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) return deny(413, "Corps trop volumineux");
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return deny(400, "JSON invalide");
  }
  const command = (parsed as { command?: unknown } | null)?.command;
  if (typeof command !== "string" || !ALLOWED_COMMANDS.has(command)) return deny(400, "Commande non autorisée");
  return { ok: true };
}

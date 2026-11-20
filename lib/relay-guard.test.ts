import { describe, expect, it } from "vitest";
import { checkRelayBody, checkRelayRequest, MAX_BODY_BYTES } from "./relay-guard";

const PORT = 8787;
const valid = {
  method: "POST",
  url: "/command",
  origin: "http://localhost:3000",
  host: `127.0.0.1:${PORT}`,
  contentType: "application/json",
};

describe("relay request guard", () => {
  it("accepts a command posted by the local app", () => {
    expect(checkRelayRequest(valid, PORT)).toEqual({ ok: true });
    expect(checkRelayRequest({ ...valid, contentType: "application/json; charset=utf-8" }, PORT)).toEqual({ ok: true });
  });

  it("rejects a request from another website instead of forwarding it", () => {
    expect(checkRelayRequest({ ...valid, origin: "https://evil.example" }, PORT)).toMatchObject({ ok: false, status: 403 });
  });

  it("rejects a request without Origin (non-browser client or stripped header)", () => {
    expect(checkRelayRequest({ ...valid, origin: undefined }, PORT)).toMatchObject({ ok: false, status: 403 });
  });

  it("rejects a simple cross-site form post that skips the CORS preflight", () => {
    expect(checkRelayRequest({ ...valid, contentType: "text/plain" }, PORT)).toMatchObject({ ok: false, status: 415 });
  });

  it("rejects an unexpected Host header (DNS rebinding)", () => {
    expect(checkRelayRequest({ ...valid, host: `attacker.example:${PORT}` }, PORT)).toMatchObject({ ok: false, status: 403 });
  });

  it("answers a preflight only for an allowed origin", () => {
    expect(checkRelayRequest({ ...valid, method: "OPTIONS", contentType: undefined }, PORT)).toEqual({ ok: true });
    expect(checkRelayRequest({ ...valid, method: "OPTIONS", origin: "https://evil.example" }, PORT)).toMatchObject({ ok: false });
  });

  it("rejects other routes and methods", () => {
    expect(checkRelayRequest({ ...valid, url: "/other" }, PORT)).toMatchObject({ ok: false, status: 404 });
    expect(checkRelayRequest({ ...valid, method: "GET" }, PORT)).toMatchObject({ ok: false, status: 404 });
  });
});

describe("relay body guard", () => {
  it("accepts the commands the app uses", () => {
    expect(checkRelayBody(JSON.stringify({ command: "GetToys" }))).toEqual({ ok: true });
    expect(checkRelayBody(JSON.stringify({ command: "Function", action: "Stop" }))).toEqual({ ok: true });
    expect(checkRelayBody(JSON.stringify({ command: "Pattern" }))).toEqual({ ok: true });
  });

  it("rejects unknown commands, invalid JSON and oversized bodies", () => {
    expect(checkRelayBody(JSON.stringify({ command: "Preset" }))).toMatchObject({ ok: false, status: 400 });
    expect(checkRelayBody("null")).toMatchObject({ ok: false, status: 400 });
    expect(checkRelayBody("{not json")).toMatchObject({ ok: false, status: 400 });
    expect(checkRelayBody(JSON.stringify({ command: "GetToys", pad: "x".repeat(MAX_BODY_BYTES) }))).toMatchObject({ ok: false, status: 413 });
  });
});

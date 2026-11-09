import { API_URL, API_TIMEOUT_MS } from "./config.js";

let pending = 0;
let onSessionExpired = () => {};

const progressEl = () => document.getElementById("progress");

function track(delta) {
  pending = Math.max(0, pending + delta);
  const el = progressEl();
  if (el) el.hidden = pending === 0;
}

export function setSessionExpiredHandler(fn) {
  onSessionExpired = fn;
}

/**
 * Chama uma ação do Apps Script.
 * Usa Content-Type text/plain para evitar o preflight de CORS (o Apps Script não responde OPTIONS).
 * Nunca lança exceção: sempre retorna { success, message, ... }.
 */
export async function api(action, payload = {}) {
  track(+1);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...payload, action }),
      signal: controller.signal,
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (data?.code === "SESSION_EXPIRED") onSessionExpired(data.message);
    return data ?? { success: false, message: "Resposta vazia do servidor." };
  } catch (error) {
    console.error(`[api] ${action}`, error);
    const message = error.name === "AbortError"
      ? "O servidor demorou demais para responder. Tente novamente."
      : "Não foi possível falar com o servidor. Verifique sua conexão e tente novamente.";
    return { success: false, message };
  } finally {
    clearTimeout(timer);
    track(-1);
  }
}

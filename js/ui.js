import { html, raw, render, pad2, validarDezenas } from "./utils.js";

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

// ---------- Navegação entre telas ----------

/** Mostra uma view e ajusta os botões do cabeçalho conforme o contexto (guest/user/admin). */
export function showView(id) {
  const target = document.getElementById(id);
  $$("[data-view]").forEach((v) => { v.hidden = v !== target; });
  const ctx = target?.dataset.view ?? "guest";
  $$("[data-show]").forEach((el) => { el.hidden = !el.dataset.show.split(" ").includes(ctx); });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- Toasts ----------

const ICONS = { success: "✅", error: "⚠️", info: "ℹ️" };

export function toast(message, type = "info", { duration = 4500 } = {}) {
  if (!message) return;
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  el.setAttribute("role", type === "error" ? "alert" : "status");
  render(el, html`<span aria-hidden="true">${ICONS[type] ?? ""}</span><span>${message}</span>
    <button class="toast__close" aria-label="Fechar">×</button>`);

  const close = () => {
    el.classList.add("is-leaving");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  };
  el.querySelector("button").addEventListener("click", close);
  $("#toasts").append(el);
  setTimeout(close, type === "error" ? duration + 2500 : duration);
}

/** Exibe o resultado de uma chamada de API como toast. */
export function notify(res, successFallback = "Feito!") {
  if (res?.success) toast(res.message || successFallback, "success");
  else toast(res?.message || "Algo deu errado.", "error");
}

// ---------- Diálogos ----------

export function openDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog && !dialog.open) dialog.showModal();
  return dialog;
}

export function closeDialog(target) {
  const dialog = typeof target === "string" ? document.getElementById(target) : target?.closest("dialog");
  dialog?.close();
}

/** Fecha o diálogo ao clicar no fundo escurecido. */
export function enableBackdropClose() {
  $$("dialog.modal").forEach((dialog) => {
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.close();
    });
  });
}

/** Substituto moderno do confirm(): retorna Promise<boolean>. */
export function confirmDialog(message, { title = "Confirmar", okText = "Confirmar" } = {}) {
  const dialog = $("#dialog-confirm");
  $("#confirm-title").textContent = title;
  $("#confirm-message").textContent = message;
  $("#confirm-ok").textContent = okText;

  return new Promise((resolve) => {
    const onClick = (e) => {
      const btn = e.target.closest("[data-confirm]");
      if (btn) dialog.close(btn.dataset.confirm);
    };
    dialog.addEventListener("click", onClick);
    dialog.addEventListener("close", () => {
      dialog.removeEventListener("click", onClick);
      resolve(dialog.returnValue === "true");
    }, { once: true });
    dialog.returnValue = "";
    dialog.showModal();
  });
}

// ---------- Botões com carregamento ----------

/** Desabilita o botão e mostra spinner enquanto a função assíncrona roda. */
export async function withLoading(button, fn) {
  if (!button) return fn();
  if (button.classList.contains("is-loading")) return undefined;
  button.classList.add("is-loading");
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  try {
    return await fn();
  } finally {
    button.classList.remove("is-loading");
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}

// ---------- Bolinhas da loteria ----------

/**
 * @param {string[]} dezenas
 * @param {{ size?: ""|"sm"|"xs", variant?: ""|"muted", hits?: Set<string> }} opts
 */
export function balls(dezenas, { size = "", variant = "", hits } = {}) {
  const sizeCls = size ? ` ball--${size}` : "";
  return html`<div class="balls">${dezenas.map((n) => {
    let cls = `ball${sizeCls}`;
    if (hits) cls += hits.has(n) ? " ball--hit" : " ball--dim";
    else if (variant) cls += ` ball--${variant}`;
    return html`<span class="${cls}">${n}</span>`;
  })}</div>`;
}

export function gameCard(dezenas, label, opts = {}) {
  return html`<div class="game">
    <div class="game__label"><span>${label}</span>${opts.extra ? raw(opts.extra) : ""}</div>
    ${balls(dezenas, opts)}
  </div>`;
}

export const empty = (text) => html`<div class="empty">${text}</div>`;

// ---------- Campos de dezenas ----------

/** Cria os 6 inputs de dezenas em todos os containers [data-numbers]. */
export function setupNumberInputs() {
  $$("[data-numbers]").forEach((container) => {
    const group = container.dataset.numbers;
    container.innerHTML = Array.from({ length: 6 }, (_, i) =>
      `<input type="number" inputmode="numeric" min="1" max="60" placeholder="--" aria-label="Dezena ${i + 1}" data-group="${group}">`
    ).join("");

    container.addEventListener("input", (e) => {
      const input = e.target;
      input.value = input.value.replace(/\D/g, "").slice(0, 2);
      input.classList.toggle("is-filled", input.value !== "");
      input.classList.remove("is-invalid");
      if (input.value.length === 2) input.nextElementSibling?.focus();
    });
    container.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && e.target.value === "") e.target.previousElementSibling?.focus();
    });
    container.addEventListener("blur", (e) => {
      const n = Number(e.target.value);
      if (e.target.value && n >= 1 && n <= 9) e.target.value = pad2(n);
    }, true);
  });
}

export function fillNumberInputs(group, dezenas = []) {
  $$(`[data-group="${group}"]`).forEach((input, i) => {
    input.value = dezenas[i] ?? "";
    input.classList.toggle("is-filled", input.value !== "");
    input.classList.remove("is-invalid");
  });
}

/** Lê e valida um grupo de dezenas. Retorna o array ou null (mostrando o erro). */
export function readNumberInputs(group, label) {
  const inputs = $$(`[data-group="${group}"]`);
  const nums = inputs.map((i) => (i.value === "" ? NaN : Number(i.value)));
  const result = validarDezenas(nums, label);
  if (!result.ok) {
    const seen = new Set();
    inputs.forEach((input, i) => {
      const n = nums[i];
      const bad = !Number.isInteger(n) || n < 1 || n > 60 || seen.has(n);
      seen.add(n);
      input.classList.toggle("is-invalid", bad);
    });
    (inputs.find((i) => i.classList.contains("is-invalid")) ?? inputs[0])?.focus();
    toast(result.error, "error");
    return null;
  }
  return result.dezenas;
}

// ---------- Máscaras / calendário ----------

export function setupMasks({ phone, date }) {
  document.addEventListener("input", (e) => {
    const mask = e.target.dataset?.mask;
    if (mask === "phone") e.target.value = phone(e.target.value);
    if (mask === "date") e.target.value = date(e.target.value);
  });

  // Sincroniza o seletor nativo de data com o campo de texto
  document.addEventListener("change", (e) => {
    const forId = e.target.dataset?.proxyFor;
    if (!forId || !e.target.value) return;
    const [y, m, d] = e.target.value.split("-");
    document.getElementById(forId).value = `${d}/${m}/${y}`;
  });
}

export function openCalendar(targetId) {
  const proxy = $(`[data-proxy-for="${targetId}"]`);
  if (!proxy) return;
  try {
    if (typeof proxy.showPicker === "function") proxy.showPicker();
    else proxy.click();
  } catch {
    document.getElementById(targetId)?.focus();
  }
}

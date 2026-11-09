import { api } from "./api.js";
import { PLANOS, TIPO_FIXO } from "./config.js";
import { state } from "./state.js";
import { $, $$, showView, toast, withLoading, fillNumberInputs, readNumberInputs } from "./ui.js";
import { brToIsoDate, onlyDigits } from "./utils.js";
import { startSession } from "./participante.js";

export function abrirCadastro() {
  state.register = {};
  ["form-register-1", "form-register-2", "form-register-3"].forEach((id) => document.getElementById(id).reset());
  fillNumberInputs("reg-j1");
  fillNumberInputs("reg-j2");
  irParaEtapa(1);
  showView("view-register");
}

export function irParaEtapa(step) {
  const n = Number(step);
  $$("[data-step]").forEach((el) => {
    if (el.tagName === "FORM") el.hidden = Number(el.dataset.step) !== n;
  });
  $$("[data-step-indicator]").forEach((el) => {
    el.classList.toggle("is-active", Number(el.dataset.stepIndicator) <= n);
  });
  if (n === 3) atualizarCamposNumeros();
  document.querySelector(`form[data-step="${n}"] input:not([type=hidden])`)?.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function etapaDados(form) {
  const nome = $("#reg-nome").value.trim().replace(/\s+/g, " ");
  const celular = onlyDigits($("#reg-celular").value);
  const nascimento = brToIsoDate($("#reg-nascimento").value);

  if (nome.length < 3) return toast("Informe seu nome completo.", "error");
  if (celular.length < 10) return toast("Informe um celular válido com DDD.", "error");
  if (!nascimento) return toast("Data de nascimento inválida. Use DD/MM/AAAA.", "error");

  Object.assign(state.register, { nome, celular, dataNascimento: nascimento });
  irParaEtapa(2);
}

export function etapaPlano(form) {
  const plano = form.elements.plano.value;
  if (!plano) return toast("Escolha um plano para continuar.", "error");
  state.register.plano = plano;
  irParaEtapa(3);
}

export function atualizarCamposNumeros() {
  const tipo = $("#form-register-3").elements.tipo.value;
  const fixo = tipo === TIPO_FIXO;
  $("#reg-numeros").hidden = !fixo;
  $("#reg-jogo2").hidden = !(fixo && PLANOS[state.register.plano]?.jogos === 2);
}

export async function finalizarCadastro(form) {
  const tipoAposta = form.elements.tipo.value;
  const jogos = [];

  if (tipoAposta === TIPO_FIXO) {
    const j1 = readNumberInputs("reg-j1", "O jogo 1");
    if (!j1) return;
    jogos.push(j1);
    if (PLANOS[state.register.plano]?.jogos === 2) {
      const j2 = readNumberInputs("reg-j2", "O jogo 2");
      if (!j2) return;
      jogos.push(j2);
    }
  }

  const payload = {
    ...state.register,
    tipoAposta,
    jogosCadastrados: jogos.map((j) => j.join(",")).join(" | "),
  };

  const res = await withLoading(form.querySelector('[type="submit"]'), () => api("register", payload));
  if (!res?.success) return toast(res?.message, "error");

  toast(res.message || "Cadastro realizado!", "success");
  state.register = {};
  startSession(res);
}

import { api, setSessionExpiredHandler } from "./api.js";
import { state, clearSession } from "./state.js";
import {
  $, showView, toast, notify, openDialog, closeDialog, enableBackdropClose, withLoading,
  setupNumberInputs, setupMasks, openCalendar,
} from "./ui.js";
import { html, render, formatPhone, formatDateMask, onlyDigits } from "./utils.js";
import * as participante from "./participante.js";
import * as cadastro from "./cadastro.js";
import * as admin from "./admin.js";

// ---------- Ações de clique (data-action) ----------

const actions = {
  "go-login": () => showView("view-login"),
  "go-register": () => cadastro.abrirCadastro(),
  "go-admin-login": () => showView("view-admin-login"),
  "register-step": (el) => cadastro.irParaEtapa(el.dataset.step),
  "open-calendar": (el) => openCalendar(el.dataset.target),
  "open-dialog": (el) => openDialog(el.dataset.dialog),
  "close-dialog": (el) => closeDialog(el),
  "open-help": () => abrirAjuda(),
  install: () => instalarApp(),
  logout: () => sair(),

  "refresh-dashboard": (el) => participante.refreshDashboard(el),
  "copy-pix": () => participante.copiarPixBolao(),
  "notify-payment": (el) => participante.avisarPagamento(el),
  "share-whatsapp": () => participante.compartilhar("whatsapp"),
  "share-link": () => participante.compartilhar("link"),

  "refresh-admin": (el) => admin.carregarAdmin(el),
  "gerar-rodada": (el) => admin.gerarRodada(el),
  conferir: (el) => admin.conferir(el),
  ratear: (el) => admin.ratear(el),
  "validar-pagamento": (el) => admin.validarPagamento(el),
  "email-rateio": (el) => admin.enviarEmailRateio(el),
};

// ---------- Envio de formulários ----------

const forms = {
  "form-login": participante.login,
  "form-register-1": cadastro.etapaDados,
  "form-register-2": cadastro.etapaPlano,
  "form-register-3": cadastro.finalizarCadastro,
  "form-jogos": participante.salvarJogos,
  "form-plano": participante.salvarPlano,
  "form-pix": participante.salvarMinhaPix,
  "form-admin-login": admin.adminLogin,
  "form-adm-pix": admin.salvarPix,
  "form-adm-sorteio": admin.salvarSorteio,
  "form-help": enviarAjuda,
};

function bindEvents() {
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el || el.disabled) return;
    const handler = actions[el.dataset.action];
    if (handler) {
      e.preventDefault();
      handler(el);
    }
  });

  document.addEventListener("submit", (e) => {
    const handler = forms[e.target.id];
    if (handler) {
      e.preventDefault();
      handler(e.target);
    }
  });

  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.actionChange === "status") admin.alterarStatus(t);
    else if (t.id === "dash-edit-tipo") participante.toggleEditNumeros();
    else if (t.name === "tipo" && t.form?.id === "form-register-3") cadastro.atualizarCamposNumeros();
    else if (t.id === "adm-filtro-ativos") admin.renderTabela();
    else if (t.id === "adm-rodada") admin.resetarApuracao();
  });

  document.addEventListener("input", (e) => {
    if (e.target.id === "adm-busca") admin.renderTabela();
    else if (e.target.id === "adm-dezenas") admin.resetarApuracao();
  });
}

// ---------- Sessão ----------

async function sair() {
  const token = state.adminToken || state.userToken;
  const action = state.adminToken ? "adminLogout" : "logout";
  clearSession();
  admin.resetarApuracao();
  showView("view-login");
  if (token) api(action, { token }); // invalida no servidor sem bloquear a interface
}

setSessionExpiredHandler((message) => {
  if (!state.userToken && !state.adminToken) return;
  clearSession();
  showView("view-login");
  toast(message || "Sua sessão expirou. Entre novamente.", "info");
});

// ---------- Ajuda ----------

function abrirAjuda() {
  const form = $("#form-help");
  form.reset();
  if (state.user) {
    $("#help-nome").value = state.user.nome;
    $("#help-celular").value = formatPhone(state.user.celular);
  }
  openDialog("dialog-help");
}

async function enviarAjuda(form) {
  const nome = $("#help-nome").value.trim();
  const mensagem = $("#help-mensagem").value.trim();
  if (!nome || !mensagem) return toast("Informe seu nome e a mensagem.", "error");

  const res = await withLoading(form.querySelector('[type="submit"]'), () =>
    api("solicitarAjuda", { nome, celular: onlyDigits($("#help-celular").value), mensagem }));
  notify(res);
  if (res?.success) closeDialog("dialog-help");
}

// ---------- Instalação (PWA) ----------

let installPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
});

async function instalarApp() {
  if (installPrompt) {
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    installPrompt = null;
    if (outcome === "accepted") toast("App instalado!", "success");
    return;
  }

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;

  render($("#install-instructions"), standalone
    ? html`<p>O app já está instalado neste aparelho. 🎉</p>`
    : isIOS
      ? html`<p>No <strong>iPhone / iPad</strong> (Safari):</p>
          <ol><li>Toque em <strong>Compartilhar</strong> (quadrado com seta para cima).</li>
          <li>Escolha <strong>Adicionar à Tela de Início</strong>.</li>
          <li>Toque em <strong>Adicionar</strong>.</li></ol>`
      : html`<p>No <strong>Android</strong> (Chrome):</p>
          <ol><li>Toque no menu <strong>⋮</strong> no canto superior.</li>
          <li>Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</li>
          <li>Confirme em <strong>Instalar</strong>.</li></ol>`);
  openDialog("dialog-install");
}

// ---------- Inicialização ----------

async function boot() {
  setupNumberInputs();
  setupMasks({ phone: formatPhone, date: formatDateMask });
  enableBackdropClose();
  bindEvents();
  showView("view-login");

  // Restaura a sessão após recarregar a página (token guardado na sessionStorage)
  if (state.adminToken && await admin.carregarAdmin()) return;
  if (state.userToken && await participante.refreshDashboard()) {
    showView("view-dashboard");
    return;
  }
  clearSession();
  showView("view-login");
}

boot();

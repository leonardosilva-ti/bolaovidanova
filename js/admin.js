import { api } from "./api.js";
import { PLANOS, TIPO_FIXO } from "./config.js";
import { state, setAdminToken } from "./state.js";
import { $, showView, toast, notify, withLoading, confirmDialog, openDialog } from "./ui.js";
import { html, render, formatBRL, formatPhone, onlyDigits, parseNumberList, validarDezenas } from "./utils.js";

// ---------- Login / carregamento ----------

export async function adminLogin(form) {
  const user = $("#admin-user").value.trim();
  const pass = $("#admin-pass").value;
  if (!user || !pass) return toast("Informe usuário e senha.", "error");

  const button = form.querySelector('[type="submit"]');
  const res = await withLoading(button, () => api("adminLogin", { user, pass }));
  if (!res?.success) return toast(res?.message, "error");

  setAdminToken(res.token);
  form.reset();
  await withLoading(button, () => carregarAdmin());
}

/** Carrega o painel. Retorna true se deu certo. */
export async function carregarAdmin(button) {
  if (!state.adminToken) return false;
  const res = await withLoading(button, () => api("getAdminData", { token: state.adminToken }));
  if (!res?.success) {
    if (res?.code !== "SESSION_EXPIRED") toast(res?.message, "error");
    return false;
  }

  state.participantes = res.participantes ?? [];
  $("#adm-pix").value = res.chavePix || "";
  $("#adm-premio-estimado").value = res.weeklyInfo?.premio ?? "";
  $("#adm-data-sorteio").value = res.weeklyInfo?.dataHora ?? "";

  const select = $("#adm-rodada");
  const anterior = select.value;
  const rodadas = res.rodadasAbertas ?? [];
  render(select, rodadas.length
    ? rodadas.map((r) => html`<option value="${r}">${r}</option>`)
    : html`<option value="">Nenhuma rodada aberta</option>`);
  if (rodadas.includes(anterior)) select.value = anterior;

  const ativos = state.participantes.filter((p) => p.status !== "Inativo");
  const comCredito = ativos.filter((p) => p.apostasRestantes > 0);
  $("#adm-resumo").textContent =
    `${ativos.length} participante(s) ativo(s) · ${comCredito.length} com créditos · ${rodadas.length} rodada(s) aberta(s)`;

  renderTabela();
  showView("view-admin");
  return true;
}

// ---------- Tabela de participantes ----------

export function renderTabela() {
  const apenasAtivos = $("#adm-filtro-ativos").checked;
  const busca = $("#adm-busca").value.trim().toLowerCase();
  const buscaDigitos = onlyDigits(busca);

  const lista = state.participantes.filter((p) => {
    if (apenasAtivos && p.status === "Inativo") return false;
    if (!busca) return true;
    return p.nome.toLowerCase().includes(busca) || (buscaDigitos && p.celular.includes(buscaDigitos));
  });

  if (lista.length === 0) {
    render($("#adm-tabela"), html`<tr><td colspan="6" class="center muted">Nenhum participante encontrado.</td></tr>`);
    return;
  }

  render($("#adm-tabela"), lista.map((p) => {
    const jogos = p.tipoAposta === TIPO_FIXO && p.jogos.length
      ? p.jogos.map((j) => j.join(",")).join(" | ")
      : "🎲 Aleatório";
    const creditos = PLANOS[p.plano]?.creditos ?? 4;
    return html`<tr>
      <td><strong>${p.nome}</strong><br><span class="xsmall muted">${formatPhone(p.celular)}</span></td>
      <td>${p.plano}${p.proximoPlano ? html`<br><span class="xsmall" style="color:var(--purple)">→ ${p.proximoPlano}</span>` : ""}</td>
      <td class="mono xsmall truncate" title="${jogos}">${jogos}</td>
      <td class="mono xsmall">${p.chavePix || html`<span class="muted">não cadastrada</span>`}</td>
      <td><span class="badge ${p.apostasRestantes > 0 ? "badge--brand" : "badge--danger"}">${p.apostasRestantes}</span>
        ${p.dataPagamento ? html`<br><span class="xsmall muted">${p.dataPagamento}</span>` : ""}</td>
      <td>
        <div class="actions">
          <select class="select" data-action-change="status" data-celular="${p.celular}" aria-label="Status de ${p.nome}">
            <option value="Ativo" ${p.status !== "Inativo" ? "selected" : ""}>Ativo</option>
            <option value="Inativo" ${p.status === "Inativo" ? "selected" : ""}>Inativo</option>
          </select>
          <button class="btn btn--primary btn--sm" data-action="validar-pagamento" data-celular="${p.celular}">+${creditos} crédito(s)</button>
        </div>
      </td>
    </tr>`;
  }));
}

export async function alterarStatus(select) {
  const celular = select.dataset.celular;
  const status = select.value;
  select.disabled = true;
  const res = await api("updateParticipantStatus", { token: state.adminToken, celular, status });
  select.disabled = false;
  notify(res);
  const p = state.participantes.find((x) => x.celular === celular);
  if (res?.success && p) p.status = status;
  renderTabela();
}

export async function validarPagamento(button) {
  const p = state.participantes.find((x) => x.celular === button.dataset.celular);
  if (!p) return;
  const creditos = PLANOS[p.plano]?.creditos ?? 4;
  const ok = await confirmDialog(
    `Confirmar o recebimento do pagamento de ${p.nome} (plano ${p.plano}, ${PLANOS[p.plano]?.preco ?? ""})? Serão adicionados ${creditos} crédito(s).`,
    { title: "Validar pagamento", okText: "Validar" });
  if (!ok) return;

  const res = await withLoading(button, () => api("registerPayment", { token: state.adminToken, celular: p.celular }));
  notify(res);
  if (res?.success) {
    p.apostasRestantes = res.apostasRestantes;
    renderTabela();
  }
}

// ---------- Configurações ----------

export async function salvarPix(form) {
  const res = await withLoading(form.querySelector('[type="submit"]'), () =>
    api("savePixKey", { token: state.adminToken, chavePix: $("#adm-pix").value.trim() }));
  notify(res);
}

export async function salvarSorteio(form) {
  const res = await withLoading(form.querySelector('[type="submit"]'), () =>
    api("saveWeeklySorteio", {
      token: state.adminToken,
      premio: $("#adm-premio-estimado").value.trim(),
      dataHora: $("#adm-data-sorteio").value.trim(),
    }));
  notify(res);
}

export async function gerarRodada(button) {
  const ok = await confirmDialog(
    "Gerar a rodada semanal? Será descontado 1 crédito de cada participante ativo com saldo e os jogos serão consolidados para registro.",
    { title: "Gerar rodada", okText: "Gerar rodada" });
  if (!ok) return;
  const res = await withLoading(button, () => api("fazerAposta", { token: state.adminToken }));
  notify(res);
  if (res?.success) await carregarAdmin();
}

// ---------- Apuração em 2 etapas ----------

let conferido = null; // { idSorteio, numerosSorteados } validados na etapa 1

export function resetarApuracao() {
  conferido = null;
  const premio = $("#adm-premio-total");
  premio.disabled = true;
  premio.value = "";
  $("#btn-ratear").disabled = true;
  $("#adm-conferencia").hidden = true;
}

function lerDezenasSorteadas() {
  const result = validarDezenas(parseNumberList($("#adm-dezenas").value), "O resultado");
  if (!result.ok) {
    toast(result.error, "error");
    return null;
  }
  return result.dezenas.join(",");
}

export async function conferir(button) {
  const idSorteio = $("#adm-rodada").value;
  if (!idSorteio) return toast("Selecione uma rodada aberta.", "error");
  const numerosSorteados = lerDezenasSorteadas();
  if (!numerosSorteados) return;

  resetarApuracao();
  const res = await withLoading(button, () =>
    api("verificarGanhadoresAdmin", { token: state.adminToken, idSorteio, numerosSorteados }));
  if (!res?.success) return toast(res?.message, "error");

  conferido = { idSorteio, numerosSorteados };
  $("#adm-dezenas").value = numerosSorteados.replaceAll(",", ", ");

  const box = $("#adm-conferencia");
  box.className = `notice ${res.contemplado ? "notice--success" : "notice--warn"}`;
  box.textContent = res.message;
  box.hidden = false;

  const premio = $("#adm-premio-total");
  premio.disabled = !res.contemplado;
  premio.value = res.contemplado ? "" : "0";
  $("#btn-ratear").disabled = false;
  if (res.contemplado) premio.focus();
}

export async function ratear(button) {
  if (!conferido) return toast("Faça a conferência antes de ratear.", "error");
  const premioTotal = Number($("#adm-premio-total").value || 0);
  if (!Number.isFinite(premioTotal) || premioTotal < 0) return toast("Informe um valor de prêmio válido.", "error");

  const ok = await confirmDialog(
    `Finalizar a rodada ${conferido.idSorteio} com prêmio total de ${formatBRL(premioTotal)}? Essa ação não pode ser desfeita.`,
    { title: "Ratear e finalizar", okText: "Finalizar rodada" });
  if (!ok) return;

  const res = await withLoading(button, () =>
    api("finalizarRateioAdmin", { token: state.adminToken, ...conferido, premioTotal }));
  if (!res?.success) return toast(res?.message, "error");

  state.ultimoRateio = res.idSorteio;
  mostrarResumoRateio(res.resumo);
  $("#adm-dezenas").value = "";
  resetarApuracao();
  await carregarAdmin();
}

function mostrarResumoRateio(resumo) {
  $("#rateio-total").textContent = formatBRL(resumo.premioTotal);
  $("#rateio-participantes").textContent = resumo.totalParticipantes;
  render($("#rateio-lista"), resumo.lista.map((item) => html`<div class="list-item">
    <span>${item.nome} <span class="muted xsmall">(${item.plano})</span></span>
    <strong class="mono">${formatBRL(item.valorReceber)}</strong>
  </div>`));
  openDialog("dialog-rateio");
}

export async function enviarEmailRateio(button) {
  if (!state.ultimoRateio) return;
  const res = await withLoading(button, () =>
    api("enviarEmailRateio", { token: state.adminToken, idSorteio: state.ultimoRateio }));
  notify(res);
}

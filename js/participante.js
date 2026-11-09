import { api } from "./api.js";
import { PLANOS, SHARE_MESSAGE, TIPO_FIXO } from "./config.js";
import { state, setUserToken } from "./state.js";
import { $, showView, toast, notify, withLoading, confirmDialog, balls, gameCard, empty, fillNumberInputs, readNumberInputs } from "./ui.js";
import { html, render, brToIsoDate, formatBRL, formatPremio, copyToClipboard } from "./utils.js";

// ---------- Login ----------

export async function login(form) {
  const celular = form.elements.celular.value;
  const nascimentoTxt = form.elements.nascimento.value;
  const dataNascimento = brToIsoDate(nascimentoTxt);

  if (!celular || !nascimentoTxt) return toast("Preencha o celular e a data de nascimento.", "error");
  if (!dataNascimento) return toast("Data de nascimento inválida. Use o formato DD/MM/AAAA.", "error");

  const button = form.querySelector('[type="submit"]');
  const res = await withLoading(button, () => api("login", { celular, dataNascimento }));
  if (!res?.success) return toast(res?.message, "error");

  startSession(res);
  form.reset();
}

/** Recebe o payload de login/cadastro (token + dados do painel) e abre o painel. */
export function startSession(payload) {
  setUserToken(payload.token);
  applyDashboard(payload);
  showView("view-dashboard");
}

/** Recarrega os dados do painel com o token salvo. Retorna true se deu certo. */
export async function refreshDashboard(button) {
  if (!state.userToken) return false;
  const res = await withLoading(button, () => api("getParticipantHistory", { token: state.userToken }));
  if (!res?.success) {
    if (button) toast(res?.message, "error");
    return false;
  }
  applyDashboard(res);
  return true;
}

// ---------- Renderização ----------

function applyDashboard(data) {
  state.user = data.user;
  state.dashboard = data;
  renderResumo();
  renderSorteioAtual();
  renderHistorico();
}

function renderResumo() {
  const u = state.user;
  $("#dash-nome").textContent = u.nome.split(" ")[0] || u.nome;
  $("#dash-plano").textContent = u.plano || "—";
  $("#dash-creditos").textContent = u.apostasRestantes;
  $("#dash-tipo").textContent = u.tipoAposta === TIPO_FIXO ? "Números fixos" : "Aleatório";
  $("#dash-futuro").textContent = u.proximoPlano || "Sem mudança";

  // Aviso de créditos
  const aviso = $("#aviso-recarga");
  const n = Number(u.apostasRestantes);
  aviso.hidden = n > 1;
  aviso.classList.toggle("pulse", n === 1);
  $("#aviso-recarga-texto").innerHTML = n === 1
    ? "<strong>Última rodada restante!</strong> Faça o PIX e avise o administrador para continuar participando."
    : "<strong>Você está sem créditos.</strong> Faça o PIX do seu plano e avise o administrador para voltar a participar.";

  // Números cadastrados
  const jogos = u.jogos ?? [];
  render($("#dash-jogos"), u.tipoAposta === TIPO_FIXO && jogos.length
    ? jogos.map((j, i) => gameCard(j, `Jogo ${i + 1}`))
    : empty("🎲 Modo aleatório: suas dezenas são sorteadas a cada rodada."));

  // PIX
  $("#dash-pix-bolao").value = state.dashboard.chavePixBolao || "Não configurada";
  $("#dash-minha-pix").value = u.chavePix || "";

  // Formulários de edição
  $("#dash-edit-tipo").value = u.tipoAposta || "Aleatório";
  $("#dash-next-plano").value = u.proximoPlano || "";
  fillNumberInputs("edit-j1", jogos[0]);
  fillNumberInputs("edit-j2", jogos[1]);
  toggleEditNumeros();
}

function renderSorteioAtual() {
  const { weeklyInfo = {}, jogosSorteioAtual = [], todosJogosSorteioAtual = [] } = state.dashboard;
  $("#dash-sorteio-premio").textContent = formatPremio(weeklyInfo.premio) || "A definir";
  $("#dash-sorteio-data").textContent = weeklyInfo.dataHora || "Aguardando definição";

  render($("#dash-rodada-meus"), jogosSorteioAtual.length
    ? html`<div class="stack-sm">${jogosSorteioAtual.map((j, i) => gameCard(j, `Jogo ${i + 1}`, { size: "sm" }))}</div>`
    : html`<p class="small muted">Nenhum jogo seu na rodada atual ainda.</p>`);

  render($("#dash-rodada-todos"), todosJogosSorteioAtual.length
    ? todosJogosSorteioAtual.map((j, i) => gameCard(j, `Jogo ${i + 1}`, { size: "xs", variant: "muted" }))
    : html`<p class="small muted">Nenhum outro jogo nesta rodada.</p>`);
}

function renderHistorico() {
  const { pagamentos = [], sorteios = [] } = state.dashboard;

  render($("#hist-pagamentos"), pagamentos.length
    ? pagamentos.map((p) => html`<div class="list-item">
        <span>${p.data}</span><span class="badge badge--brand">+${p.creditos} crédito(s)</span>
      </div>`)
    : empty("Nenhum pagamento registrado."));

  render($("#hist-sorteios"), sorteios.length ? sorteios.map(renderSorteio) : empty("Nenhum sorteio apurado ainda."));
}

function renderSorteio(s) {
  const hits = new Set(s.sorteados);
  const premiado = s.premioTotal > 0;
  const meuPremio = s.minhas.reduce((t, a) => t + (a.premio || 0), 0);

  let melhor = null;
  s.minhas.forEach((a) => a.jogos.forEach((j, k) => {
    const n = a.acertos[k] ?? 0;
    if (!melhor || n > melhor.acertos) melhor = { dezenas: j, acertos: n };
  }));

  const meusJogos = s.minhas.flatMap((a) => a.jogos.map((j, k) => ({ dezenas: j, acertos: a.acertos[k] ?? 0 })));

  return html`<details class="draw">
    <summary>
      <span class="row row--wrap">
        <span class="draw__date">${s.data}</span>
        ${premiado ? html`<span class="badge badge--gold">🏆 Premiado</span>` : html`<span class="badge">Sem premiação</span>`}
        ${melhor ? html`<span class="badge badge--info">Seu melhor: ${melhor.acertos} acerto(s)</span>` : ""}
      </span>
      <span class="draw__chev" aria-hidden="true">▾</span>
    </summary>
    <div class="draw__body">
      <div class="stack-sm">
        <p class="section-title">Números sorteados</p>
        ${balls(s.sorteados, { size: "sm" })}
      </div>
      ${meuPremio > 0 ? html`<div class="notice notice--success small">
        <span class="notice__icon">🏆</span>
        <p><strong>Você foi premiado nesta rodada!</strong> Valor: <strong>${formatBRL(meuPremio)}</strong></p>
      </div>` : ""}
      ${premiado ? html`<p class="small muted">Prêmio do grupo: <strong>${formatBRL(s.premioTotal)}</strong> · por cota: <strong>${formatBRL(s.rateioCota)}</strong></p>` : ""}
      ${meusJogos.length
        ? html`<div class="stack-sm"><p class="section-title">Seus jogos</p>
            ${meusJogos.map((j, i) => gameCard(j.dezenas, `Jogo ${i + 1}`, { size: "xs", hits, extra: `<span>${j.acertos} acerto(s)</span>` }))}
          </div>`
        : html`<p class="small muted">Você não participou desta rodada.</p>`}
      ${s.todos.length ? html`<details class="disclosure">
        <summary>Ver todos os ${s.todos.length} jogos do grupo</summary>
        <div class="disclosure__body mini-games scroll-y">
          ${s.todos.map((t) => html`<div class="mini-game"><span>${t.dezenas.join(" ")}</span>${t.acertos != null ? html`<span class="badge">${t.acertos}</span>` : ""}</div>`)}
        </div>
      </details>` : ""}
    </div>
  </details>`;
}

// ---------- Ações ----------

export function toggleEditNumeros() {
  const fixo = $("#dash-edit-tipo").value === TIPO_FIXO;
  $("#dash-edit-numeros").hidden = !fixo;
  $("#dash-edit-jogo2").hidden = !(fixo && PLANOS[state.user?.plano]?.jogos === 2);
}

export async function salvarJogos(form) {
  const tipoAposta = $("#dash-edit-tipo").value;
  const jogos = [];
  if (tipoAposta === TIPO_FIXO) {
    const j1 = readNumberInputs("edit-j1", "O jogo 1");
    if (!j1) return;
    jogos.push(j1);
    if (PLANOS[state.user.plano]?.jogos === 2) {
      const j2 = readNumberInputs("edit-j2", "O jogo 2");
      if (!j2) return;
      jogos.push(j2);
    }
  }

  const res = await withLoading(form.querySelector('[type="submit"]'), () =>
    api("updateLuckyNumbers", { token: state.userToken, tipoAposta, jogosCadastrados: jogos.map((j) => j.join(",")).join(" | ") }));
  notify(res);
  if (res?.success) {
    state.user.tipoAposta = res.tipoAposta;
    state.user.jogos = res.jogos;
    renderResumo();
  }
}

export async function salvarPlano(form) {
  const proximoPlano = $("#dash-next-plano").value;
  const res = await withLoading(form.querySelector('[type="submit"]'), () =>
    api("updateNextPlan", { token: state.userToken, proximoPlano }));
  notify(res);
  if (res?.success) {
    state.user.proximoPlano = proximoPlano;
    renderResumo();
  }
}

export async function salvarMinhaPix(form) {
  const chavePix = $("#dash-minha-pix").value.trim();
  const res = await withLoading(form.querySelector('[type="submit"]'), () =>
    api("updateParticipantPix", { token: state.userToken, chavePix }));
  notify(res);
  if (res?.success) state.user.chavePix = chavePix;
}

export async function copiarPixBolao() {
  const chave = state.dashboard?.chavePixBolao;
  if (!chave) return toast("A chave PIX do bolão ainda não foi configurada.", "error");
  const ok = await copyToClipboard(chave);
  toast(ok ? "Chave PIX copiada! Transfira o valor do seu plano." : "Não foi possível copiar. Selecione e copie manualmente.", ok ? "success" : "error");
}

export async function avisarPagamento(button) {
  const plano = PLANOS[state.user.plano];
  const ok = await confirmDialog(
    `Confirma que você fez o PIX${plano ? ` de ${plano.preco} (plano ${state.user.plano})` : ""}? O administrador será avisado para liberar seus créditos.`,
    { title: "Avisar pagamento", okText: "Sim, avisar" });
  if (!ok) return;
  const res = await withLoading(button, () => api("notifyPaymentIntent", { token: state.userToken }));
  notify(res);
}

export async function compartilhar(canal) {
  if (canal === "whatsapp") {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(SHARE_MESSAGE)}`, "_blank", "noopener");
    return;
  }
  if (navigator.share) {
    try {
      await navigator.share({ title: "Bolão Mega Sena", text: SHARE_MESSAGE });
      return;
    } catch (err) {
      if (err.name === "AbortError") return; // usuário cancelou
    }
  }
  const ok = await copyToClipboard(SHARE_MESSAGE);
  toast(ok ? "Convite copiado! Cole no WhatsApp ou onde preferir." : "Não foi possível copiar o convite.", ok ? "success" : "error");
}

/* SafePoint — Frontend */
'use strict';

let CONFIG = { tipos: [], pontos: {}, conquistas: [], codigoValidade: 60, recompensas: [] };
let EVENTOS = [];
let COLABORADORES = [];
let OBSERVACOES = [];
let SUGESTOES = [];
let RANKING = [];
let EMPRESAS = [];
let GESTORES_ADMIN = [];
let CHECKIN_PENDENTE = null;
let AVAL_CHECKIN_ID = null;
let ESTRELAS_SEL = 0;
let codigoTimer = null;
let LOGO_PENDENTE = null;
let EMPRESA_INFO = { nome: '', unidades: [] };

const MODULOS_LABELS = {
  dds: 'DDS', treinamentos: 'Treinamentos', ranking: 'Ranking',
  loja: 'Loja de Recompensas', dashboardAvancado: 'Dashboard Avançado',
  ia: 'Inteligência Artificial', certificados: 'Certificados Automáticos'
};
const STATUS_LABELS = { ativa: 'Ativa', em_implantacao: 'Em implantação', suspensa: 'Suspensa', bloqueada: 'Bloqueada', cancelada: 'Cancelada' };
const PLANO_LABELS  = { basico: 'Básico', profissional: 'Profissional', enterprise: 'Enterprise' };
const STATUS_CORES  = { ativa: '#1a8a4c', em_implantacao: '#e8801a', suspensa: '#e8801a', bloqueada: '#c43a3a', cancelada: '#637080' };

/* ── Util ── */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function dataBr(iso) {
  if (!iso) return '';
  const d = iso.slice(0, 10).split('-');
  return `${d[2]}/${d[1]}/${d[0]}`;
}

function tsHora(ts) {
  if (!ts) return '';
  try { return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}

function tsDataHora(ts) {
  if (!ts) return '';
  try { return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}

async function api(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Erro na requisição.');
  return json;
}

let toastTimer = null;
function toast(msg, tipo = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (tipo ? ' ' + tipo + '-toast' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 4000);
}

/* ── Branding ── */

function aplicarBranding(branding) {
  if (!branding) return;
  const { cores, logo, nome } = branding;
  if (cores) {
    if (cores.primaria)   document.documentElement.style.setProperty('--azul', cores.primaria);
    if (cores.secundaria) document.documentElement.style.setProperty('--azul-escuro', cores.secundaria);
    if (cores.destaque)   document.documentElement.style.setProperty('--verde', cores.destaque);
    if (cores.laranja)    document.documentElement.style.setProperty('--laranja', cores.laranja);
  }
  // logo da empresa na topbar do gestor
  const gestorLogoWrap = document.getElementById('empresa-logo-wrap');
  if (gestorLogoWrap) {
    if (logo) {
      gestorLogoWrap.innerHTML = `<img src="${logo}" alt="${esc(nome || '')}" class="topbar-empresa-logo">`;
    } else if (nome) {
      gestorLogoWrap.innerHTML = `<span class="topbar-empresa">${esc(nome)}</span>`;
    }
  }
  // logo da empresa na topbar do colaborador
  const colabLogoWrap = document.getElementById('colab-logo-wrap');
  if (colabLogoWrap) {
    if (logo) {
      colabLogoWrap.innerHTML = `<img src="${logo}" alt="${esc(nome || '')}" class="topbar-empresa-logo">`;
    } else if (nome) {
      colabLogoWrap.innerHTML = `<span class="topbar-empresa">${esc(nome)}</span>`;
    }
  }
  // nome da empresa no gestor
  const gestorEmpresaNome = document.getElementById('gestor-empresa-nome');
  if (gestorEmpresaNome && nome && !logo) gestorEmpresaNome.textContent = nome;
}

/* ── Modal genérico ── */

function abrirModal(titulo, corpoHtml) {
  document.getElementById('modal-titulo').textContent = titulo;
  document.getElementById('modal-corpo').innerHTML = corpoHtml;
  document.getElementById('modal-fundo').classList.remove('hidden');
}
function fecharModal() { document.getElementById('modal-fundo').classList.add('hidden'); }
function fecharModalFundo(e) { if (e.target === document.getElementById('modal-fundo')) fecharModal(); }
function fecharDetalheEvento(e) {
  if (!e || e.target === document.getElementById('modal-evento-detalhe')) {
    document.getElementById('modal-evento-detalhe').classList.add('hidden');
  }
}

/* ── Papéis (SafePoint 2.1) ── */

const ROLE_LABELS = {
  sesmt: 'SESMT', cipa: 'CIPA', brigada: 'Brigada de Emergência',
  tecnico_seguranca: 'Técnico de Segurança', medico_trabalho: 'Médico do Trabalho', ergonomista: 'Ergonomista'
};
const ROLE_EMOJIS = {
  sesmt: '🦺', cipa: '⚠️', brigada: '🚒',
  tecnico_seguranca: '🔧', medico_trabalho: '🩺', ergonomista: '🪑'
};

function renderRoleBadges(roles) {
  if (!roles || !roles.length) return '';
  return roles.map(r => `<span class="role-badge role-${r}" title="${ROLE_LABELS[r] || r}">${ROLE_EMOJIS[r] || '🏅'} ${ROLE_LABELS[r] || r}</span>`).join('');
}

function renderRoleBadgesMini(roles) {
  if (!roles || !roles.length) return '';
  return roles.map(r => `<span class="role-badge-mini role-${r}" title="${ROLE_LABELS[r] || r}">${ROLE_EMOJIS[r] || '🏅'}</span>`).join('');
}

/* ── Login ── */

function mostrarErroLogin(msg) {
  const el = document.getElementById('login-erro');
  el.textContent = msg; el.classList.remove('hidden');
}

function mostrarLoginAdmin() {
  document.getElementById('form-login-unificado').classList.add('hidden');
  document.getElementById('form-login-admin').classList.remove('hidden');
  document.getElementById('login-erro').classList.add('hidden');
}

function esconderLoginAdmin() {
  document.getElementById('form-login-admin').classList.add('hidden');
  document.getElementById('form-login-unificado').classList.remove('hidden');
  document.getElementById('login-erro').classList.add('hidden');
}

async function loginUnificado(e) {
  e.preventDefault();
  const matricula = document.getElementById('login-mat').value.trim();
  const senha = document.getElementById('login-pwd').value;
  try {
    const r = await api('/api/login', { method: 'POST', body: { perfil: 'unificado', matricula, senha } });
    if (r.branding) aplicarBranding(r.branding);
    if (r.primeiroAcesso || !r.termosAceitos) {
      await iniciar();
      abrirPrimeiroAcesso(r.primeiroAcesso, r.termosAceitos);
    } else {
      await iniciar();
    }
  } catch (err) { mostrarErroLogin(err.message); }
  return false;
}

async function loginAdmin(e) {
  e.preventDefault();
  try {
    await api('/api/login', { method: 'POST', body: { perfil: 'admin', usuario: document.getElementById('login-admin-usuario').value, senha: document.getElementById('login-admin-senha').value } });
    await iniciar();
  } catch (err) { mostrarErroLogin(err.message); }
  return false;
}

/* ── Primeiro Acesso ── */

function abrirPrimeiroAcesso(precisaSenha, termosAceitos) {
  const overlay = document.getElementById('primeiro-acesso-overlay');
  overlay.classList.remove('hidden');
  document.getElementById('pa-step-senha').classList.toggle('hidden', !precisaSenha);
  document.getElementById('pa-step-termos').classList.toggle('hidden', precisaSenha || termosAceitos);
  document.getElementById('pa-titulo').textContent = precisaSenha
    ? 'Crie sua senha pessoal'
    : 'Termos de Uso';
}

async function confirmarNovaSenha() {
  const atual  = document.getElementById('pa-senha-atual').value;
  const nova   = document.getElementById('pa-senha-nova').value;
  const conf   = document.getElementById('pa-senha-confirma').value;
  const erro   = document.getElementById('pa-senha-erro');
  erro.classList.add('hidden');
  if (!atual || !nova || !conf) { erro.textContent = 'Preencha todos os campos.'; erro.classList.remove('hidden'); return; }
  if (nova.length < 6) { erro.textContent = 'A nova senha precisa ter no mínimo 6 caracteres.'; erro.classList.remove('hidden'); return; }
  if (nova !== conf) { erro.textContent = 'As senhas não coincidem.'; erro.classList.remove('hidden'); return; }
  try {
    await api('/api/alterar-senha-emp', { method: 'POST', body: { senhaAtual: atual, novaSenha: nova } });
    // show terms step
    document.getElementById('pa-step-senha').classList.add('hidden');
    document.getElementById('pa-step-termos').classList.remove('hidden');
    document.getElementById('pa-titulo').textContent = 'Termos de Uso';
  } catch (err) { erro.textContent = err.message; erro.classList.remove('hidden'); }
}

async function confirmarTermos() {
  const check = document.getElementById('pa-termos-check');
  const erro  = document.getElementById('pa-termos-erro');
  erro.classList.add('hidden');
  if (!check.checked) { erro.textContent = 'Você precisa aceitar os termos para continuar.'; erro.classList.remove('hidden'); return; }
  try {
    await api('/api/aceitar-termos', { method: 'POST' });
    document.getElementById('primeiro-acesso-overlay').classList.add('hidden');
    toast('Bem-vindo ao SafePoint! 🚀');
  } catch (err) { erro.textContent = err.message; erro.classList.remove('hidden'); }
}

async function sair() {
  await api('/api/logout', { method: 'POST' });
  location.reload();
}

/* ── Inicialização ── */

async function iniciar() {
  const me = await api('/api/me');
  document.getElementById('tela-login').classList.toggle('hidden', me.autenticado);
  document.getElementById('app-gestor').classList.add('hidden');
  document.getElementById('app-colab').classList.add('hidden');
  document.getElementById('app-admin').classList.add('hidden');
  if (!me.autenticado) { document.getElementById('tela-login').classList.remove('hidden'); return; }

  if (me.perfil === 'admin') {
    document.getElementById('admin-nome').textContent = me.nome;
    document.getElementById('app-admin').classList.remove('hidden');
    await carregarAdmin();
    return;
  }

  if (me.branding) aplicarBranding(me.branding);
  CONFIG = await api('/api/config');

  if (me.perfil === 'gestor') {
    document.getElementById('gestor-nome').textContent = me.nome;
    document.getElementById('app-gestor').classList.remove('hidden');
    // banner de impersonação
    const banner = document.getElementById('impersonation-banner');
    if (banner) banner.classList.toggle('hidden', !me.adminImpersonando);
    preencherFiltroTipos();
    await Promise.all([carregarColaboradores(), carregarEventos()]);
    try { EMPRESA_INFO = await api('/api/empresa/branding'); } catch {}
    navegar('dashboard');
    carregarBrandingConfig();
  } else {
    document.getElementById('colab-nome').textContent = me.nome;
    // show role badges in topbar
    const badgesEl = document.getElementById('colab-role-badges');
    if (badgesEl) badgesEl.innerHTML = renderRoleBadgesMini(me.roles || []);
    document.getElementById('app-colab').classList.remove('hidden');
    await carregarPainelColaborador();
    verificarCheckinPendente();
    // first-access check after rendering app
    if (me.primeiroAcesso || !me.termosAceitos) {
      abrirPrimeiroAcesso(me.primeiroAcesso, me.termosAceitos);
    }
  }
}

/* ── Navegação ── */

async function navegar(view) {
  document.querySelectorAll('#app-gestor .nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('#app-gestor .view').forEach(v => v.classList.add('hidden'));
  document.getElementById('view-' + view).classList.remove('hidden');
  if (view === 'dashboard')    await carregarDashboard();
  if (view === 'eventos')      await carregarEventos();
  if (view === 'colaboradores') await carregarColaboradores();
  if (view === 'observacoes')  await carregarObservacoes();
  if (view === 'sugestoes')    await carregarSugestoes();
  if (view === 'ranking')      await carregarRanking();
  if (view === 'comunicados')     await carregarComunicadosGestor();
  if (view === 'quiz-gestor')     await carregarQuizGestor();
  if (view === 'engajamento')     await carregarEngajamento();
  if (view === 'pesquisas-gestor') await carregarPesquisasGestor();
  if (view === 'quem-e-quem')    await carregarQuemEQuem();
  if (view === 'roles')          await carregarRoles();
  if (view === 'config') { renderConfig(); carregarBrandingConfig(); }
}

async function navegarColab(view) {
  document.querySelectorAll('#app-colab .nav-btn').forEach(b => b.classList.toggle('active', b.dataset.cview === view));
  document.querySelectorAll('#app-colab .cview').forEach(v => v.classList.add('hidden'));
  document.getElementById('cview-' + view).classList.remove('hidden');
  if (view === 'painel')       await carregarPainelColaborador();
  if (view === 'mural')        await carregarMural();
  if (view === 'comunicados')  await carregarComunicados();
  if (view === 'quiz')         await carregarQuiz();
  if (view === 'perfil')       await carregarPerfil();
  if (view === 'pesquisas')    await carregarPesquisasColab();
  if (view === 'quem-e-quem') await carregarQuemEQuemColab();
  if (view === 'observar')     await carregarMinhasObservacoes();
  if (view === 'sugerir')      await carregarMinhasSugestoes();
  if (view === 'historico')    await carregarHistoricoCompleto();
}

async function navegarAdmin(view) {
  document.querySelectorAll('#app-admin .nav-btn').forEach(b => b.classList.toggle('active', b.dataset.aview === view));
  document.querySelectorAll('#app-admin .aview').forEach(v => v.classList.add('hidden'));
  document.getElementById('aview-' + view).classList.remove('hidden');
  if (view === 'dashboard') await carregarStatsAdmin();
  if (view === 'empresas')  await carregarEmpresas();
  if (view === 'gestores')  await carregarGestoresAdmin();
}

async function carregarStatsAdmin() {
  try {
    const s = await api('/api/admin/stats');
    const grid = document.getElementById('admin-stats-grid');
    if (grid) grid.innerHTML = [
      { l: 'Empresas ativas',    n: s.totalEmpresas },
      { l: 'Colaboradores',      n: s.totalColaboradores },
      { l: 'Gestores SST',       n: s.totalGestores },
      { l: 'Eventos realizados', n: s.totalEventos },
      { l: 'Check-ins',          n: s.totalCheckins },
      { l: 'Pontos distribuídos',n: s.totalPontos.toLocaleString('pt-BR') },
      { l: 'Sugestões',          n: s.totalSugestoes },
      { l: 'Observações',        n: s.totalObservacoes }
    ].map(i => `<div class="card-stat"><div class="card-stat-n">${i.n}</div><div class="card-stat-l">${i.l}</div></div>`).join('');
    const statusDiv = document.getElementById('admin-stats-empresas');
    if (statusDiv && s.empresasPorStatus) {
      statusDiv.innerHTML = '<h3 style="margin-bottom:12px">Empresas por status</h3><div class="cards">' +
        Object.entries(s.empresasPorStatus).map(([k, v]) =>
          `<div class="card-stat" style="border-top:3px solid ${STATUS_CORES[k]||'#999'}">
             <div class="card-stat-n">${v}</div>
             <div class="card-stat-l">${STATUS_LABELS[k]||k}</div>
           </div>`
        ).join('') + '</div>';
    }
  } catch {}
}

async function entrarComoEmpresa(id) {
  const e = EMPRESAS.find(x => x.id === id);
  if (!e) return;
  if (!confirm(`Entrar no ambiente de "${e.nomeFantasia || e.nome}"?\n\nSua sessão de admin será substituída por uma sessão de gestor desta empresa. Para voltar ao painel admin, clique em "Encerrar visita" ou faça logout e logue novamente.`)) return;
  try {
    const r = await api('/api/admin/empresas/' + id + '/entrar', { method: 'POST', body: {} });
    if (r.branding) aplicarBranding(r.branding);
    await iniciar();
  } catch (err) { toast(err.message, 'erro'); }
}

/* ── Admin ── */

async function carregarAdmin() {
  await navegarAdmin('empresas');
}

async function carregarEmpresas() {
  EMPRESAS = await api('/api/admin/empresas');
  renderEmpresas();
}

function renderEmpresas() {
  const grid = document.getElementById('empresas-grid');
  if (!grid) return;
  if (!EMPRESAS.length) {
    grid.innerHTML = '<p class="hint" style="padding:20px">Nenhuma empresa cadastrada ainda.</p>';
    return;
  }
  grid.innerHTML = EMPRESAS.map(e => {
    const status = e.status || 'ativa';
    const statusCor = STATUS_CORES[status] || '#637080';
    return `
    <div class="empresa-card${e.ativo === false ? ' empresa-inativa' : ''}">
      <div class="empresa-card-header">
        ${e.logo && e.logo !== '[logo]'
          ? `<img src="${e.logo}" alt="${esc(e.nome)}" class="empresa-card-logo">`
          : `<div class="empresa-card-logo-placeholder">🏢</div>`}
        <div class="empresa-card-info">
          <h3>${esc(e.nomeFantasia || e.nome)}</h3>
          <div class="cnpj">${e.cnpj ? esc(e.cnpj) : 'CNPJ não informado'}</div>
          <span class="empresa-status-badge" style="background:${statusCor}">${STATUS_LABELS[status] || status}</span>
          ${e.plano ? `<span class="empresa-plano-badge">${PLANO_LABELS[e.plano]||e.plano}</span>` : ''}
        </div>
      </div>
      <div class="empresa-card-stats">
        <div class="empresa-stat"><div class="n">${e.totalGestores || 0}</div><div class="l">Gestores</div></div>
        <div class="empresa-stat"><div class="n">${e.totalColaboradores || 0}</div><div class="l">Colaboradores</div></div>
        ${e.dataVencimento ? `<div class="empresa-stat"><div class="n" style="font-size:11px">${esc(e.dataVencimento)}</div><div class="l">Vencimento</div></div>` : ''}
      </div>
      <div class="empresa-card-acoes">
        <button class="btn btn-sm btn-primary" onclick="abrirEditarEmpresa(${e.id})">Editar</button>
        <button class="btn btn-sm" onclick="abrirBrandingEmpresa(${e.id})">🎨 Visual</button>
        <button class="btn btn-sm" onclick="abrirAdicionarGestor(${e.id}, '${esc(e.nome)}')">+ Gestor</button>
        <button class="btn btn-sm btn-destaque" onclick="entrarComoEmpresa(${e.id})">👁 Entrar</button>
        <button class="btn btn-sm btn-perigo" onclick="inativarEmpresa(${e.id})">${e.ativo === false ? 'Reativar' : 'Inativar'}</button>
      </div>
    </div>`;
  }).join('');
}

function abrirNovaEmpresa() {
  abrirModal('Nova empresa', formEmpresaHtml(null));
}

function abrirEditarEmpresa(id) {
  const e = EMPRESAS.find(x => x.id === id);
  if (e) abrirModal('Editar empresa', formEmpresaHtml(e));
}

function formEmpresaHtml(e) {
  const unidades = e && e.unidades ? e.unidades : [{ nome: 'Matriz', endereco: '', cidade: '', estado: '' }];
  const modulos  = e && e.modulos ? e.modulos : {};
  const modulosHtml = Object.entries(MODULOS_LABELS).map(([k, v]) =>
    `<label class="check-inline"><input type="checkbox" id="mod-${k}" ${modulos[k] !== false ? 'checked' : ''}> ${esc(v)}</label>`
  ).join('');
  return `
    <div class="linha-2">
      <div><label>Razão Social *</label><input type="text" id="emp-nome" value="${e ? esc(e.nome) : ''}"></div>
      <div><label>Nome Fantasia</label><input type="text" id="emp-nomeFantasia" value="${e ? esc(e.nomeFantasia || '') : ''}"></div>
    </div>
    <div class="linha-2">
      <div><label>CNPJ</label><input type="text" id="emp-cnpj" value="${e ? esc(e.cnpj || '') : ''}" placeholder="00.000.000/0001-00"></div>
      <div><label>Responsável</label><input type="text" id="emp-responsavel" value="${e ? esc(e.responsavel || '') : ''}"></div>
    </div>
    <div class="linha-2">
      <div><label>E-mail</label><input type="email" id="emp-email" value="${e ? esc(e.email || '') : ''}"></div>
      <div><label>Telefone</label><input type="text" id="emp-telefone" value="${e ? esc(e.telefone || '') : ''}" placeholder="(11) 99999-9999"></div>
    </div>
    <div class="linha-3">
      <div><label>Status</label>
        <select id="emp-status">
          ${Object.entries(STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${(e?.status||'ativa')===k?'selected':''}>${v}</option>`).join('')}
        </select>
      </div>
      <div><label>Plano</label>
        <select id="emp-plano">
          ${Object.entries(PLANO_LABELS).map(([k, v]) => `<option value="${k}" ${(e?.plano||'basico')===k?'selected':''}>${v}</option>`).join('')}
        </select>
      </div>
      <div><label>Limite colaboradores</label><input type="number" id="emp-limite" value="${e ? (e.limiteColaboradores||0) : 0}" min="0"></div>
    </div>
    <div class="linha-2">
      <div><label>Data ativação</label><input type="date" id="emp-dataAtivacao" value="${e ? esc(e.dataAtivacao||'') : ''}"></div>
      <div><label>Data vencimento</label><input type="date" id="emp-dataVencimento" value="${e ? esc(e.dataVencimento||'') : ''}"></div>
    </div>
    <div style="margin:12px 0 6px"><strong>Módulos ativos</strong></div>
    <div class="modulos-grid">${modulosHtml}</div>
    <div style="margin:14px 0 6px"><strong>Unidades / Filiais</strong></div>
    <label>CNPJ</label>
    <input type="text" id="emp-cnpj" value="${e ? esc(e.cnpj || '') : ''}" placeholder="00.000.000/0001-00">
    <label>Unidades / Filiais</label>
    <div id="emp-unidades">
      ${unidades.map((u, i) => `
        <div class="linha-3" style="margin-bottom:8px" data-ui="${i}">
          <div><input type="text" placeholder="Nome da unidade *" value="${esc(u.nome || '')}" data-u="${i}" data-f="nome"></div>
          <div><input type="text" placeholder="Cidade" value="${esc(u.cidade || '')}" data-u="${i}" data-f="cidade"></div>
          <div><input type="text" placeholder="Estado (UF)" maxlength="2" value="${esc(u.estado || '')}" data-u="${i}" data-f="estado"></div>
        </div>`).join('')}
    </div>
    <button class="btn btn-sm" onclick="adicionarUnidade()" style="margin-bottom:12px">+ Unidade</button>
    <div class="modal-rodape">
      <button class="btn" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarEmpresa(${e ? e.id : 'null'})">Salvar</button>
    </div>`;
}

function adicionarUnidade() {
  const cont = document.getElementById('emp-unidades');
  if (!cont) return;
  const idx = cont.querySelectorAll('[data-ui]').length;
  const div = document.createElement('div');
  div.className = 'linha-3';
  div.style.marginBottom = '8px';
  div.dataset.ui = idx;
  div.innerHTML = `
    <div><input type="text" placeholder="Nome da unidade *" data-u="${idx}" data-f="nome"></div>
    <div><input type="text" placeholder="Cidade" data-u="${idx}" data-f="cidade"></div>
    <div><input type="text" placeholder="Estado (UF)" maxlength="2" data-u="${idx}" data-f="estado"></div>`;
  cont.appendChild(div);
}

function lerUnidades() {
  const cont = document.getElementById('emp-unidades');
  if (!cont) return [];
  const map = {};
  cont.querySelectorAll('input[data-u]').forEach(el => {
    const i = el.dataset.u;
    if (!map[i]) map[i] = {};
    map[i][el.dataset.f] = el.value.trim();
  });
  return Object.values(map).filter(u => u.nome);
}

async function salvarEmpresa(id) {
  const nome = document.getElementById('emp-nome').value.trim();
  if (!nome) return toast('Razão Social é obrigatória.', 'erro');
  const modulos = {};
  Object.keys(MODULOS_LABELS).forEach(k => {
    const el = document.getElementById('mod-' + k);
    if (el) modulos[k] = el.checked;
  });
  const body = {
    nome,
    nomeFantasia:       (document.getElementById('emp-nomeFantasia')?.value || '').trim(),
    responsavel:        (document.getElementById('emp-responsavel')?.value || '').trim(),
    email:              (document.getElementById('emp-email')?.value || '').trim(),
    telefone:           (document.getElementById('emp-telefone')?.value || '').trim(),
    limiteColaboradores: Number(document.getElementById('emp-limite')?.value) || 0,
    status:             document.getElementById('emp-status')?.value || 'ativa',
    plano:              document.getElementById('emp-plano')?.value || 'basico',
    dataAtivacao:       document.getElementById('emp-dataAtivacao')?.value || '',
    dataVencimento:     document.getElementById('emp-dataVencimento')?.value || '',
    modulos,
    cnpj: document.getElementById('emp-cnpj').value.trim(),
    unidades: lerUnidades()
  };
  try {
    if (id) await api('/api/admin/empresas/' + id, { method: 'PUT', body });
    else await api('/api/admin/empresas', { method: 'POST', body });
    fecharModal();
    toast('Empresa salva.', 'ok');
    await carregarEmpresas();
  } catch (err) { toast(err.message, 'erro'); }
}

async function inativarEmpresa(id) {
  const e = EMPRESAS.find(x => x.id === id);
  if (!e) return;
  const ativar = e.ativo === false;
  if (!confirm(`${ativar ? 'Reativar' : 'Inativar'} a empresa "${e.nome}"?`)) return;
  try {
    await api('/api/admin/empresas/' + id, { method: 'PUT', body: { ativo: ativar } });
    toast(`Empresa ${ativar ? 'reativada' : 'inativada'}.`, 'ok');
    await carregarEmpresas();
  } catch (err) { toast(err.message, 'erro'); }
}

function abrirBrandingEmpresa(id) {
  const e = EMPRESAS.find(x => x.id === id);
  if (!e) return;
  const cores = e.cores || {};
  abrirModal(`Visual — ${e.nome}`, `
    <div class="grid-2">
      <div>
        <label>Logo da empresa</label>
        <div id="adm-logo-preview" style="margin-bottom:10px">
          ${e.logo && e.logo !== '[logo]' ? `<img src="${e.logo}" class="logo-preview" alt="logo">` : '<span class="logo-sem-preview">Sem logo</span>'}
        </div>
        <input type="file" id="adm-logo-upload" accept="image/*" onchange="previewAdminLogo(this, ${id})">
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="btn btn-primary" style="flex:1" onclick="salvarBrandingAdmin(${id})">Salvar logo</button>
          <button class="btn btn-perigo" onclick="removerLogoAdmin(${id})">Remover</button>
        </div>
      </div>
      <div>
        <label>Cores</label>
        <div class="cor-grade">
          <div class="cor-item"><span>Primária</span><input type="color" id="adm-cor-primaria" value="${esc(cores.primaria || '#1e5aa8')}"></div>
          <div class="cor-item"><span>Secundária</span><input type="color" id="adm-cor-secundaria" value="${esc(cores.secundaria || '#14406e')}"></div>
          <div class="cor-item"><span>Destaque</span><input type="color" id="adm-cor-destaque" value="${esc(cores.destaque || '#1a8a4c')}"></div>
          <div class="cor-item"><span>Alertas</span><input type="color" id="adm-cor-laranja" value="${esc(cores.laranja || '#e8801a')}"></div>
        </div>
        <button class="btn btn-primary" style="margin-top:10px;width:100%" onclick="salvarCoresAdmin(${id})">Aplicar cores</button>
      </div>
    </div>
    <div class="modal-rodape"><button class="btn" onclick="fecharModal()">Fechar</button></div>`);
}

let admLogoTemp = {};
function previewAdminLogo(input, empresaId) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    admLogoTemp[empresaId] = reader.result;
    const prev = document.getElementById('adm-logo-preview');
    if (prev) prev.innerHTML = `<img src="${reader.result}" class="logo-preview" alt="logo">`;
  };
  reader.readAsDataURL(file);
}

async function salvarBrandingAdmin(empresaId) {
  const logo = admLogoTemp[empresaId];
  if (!logo) return toast('Selecione uma imagem primeiro.', 'erro');
  try {
    await api('/api/admin/empresas/' + empresaId + '/branding', { method: 'PUT', body: { logo } });
    delete admLogoTemp[empresaId];
    toast('Logo salva.', 'ok');
    await carregarEmpresas();
  } catch (err) { toast(err.message, 'erro'); }
}

async function removerLogoAdmin(empresaId) {
  try {
    await api('/api/admin/empresas/' + empresaId + '/branding', { method: 'PUT', body: { logo: null } });
    toast('Logo removida.', 'ok');
    fecharModal();
    await carregarEmpresas();
  } catch (err) { toast(err.message, 'erro'); }
}

async function salvarCoresAdmin(empresaId) {
  const cores = {
    primaria:   document.getElementById('adm-cor-primaria').value,
    secundaria: document.getElementById('adm-cor-secundaria').value,
    destaque:   document.getElementById('adm-cor-destaque').value,
    laranja:    document.getElementById('adm-cor-laranja').value
  };
  try {
    await api('/api/admin/empresas/' + empresaId + '/branding', { method: 'PUT', body: { cores } });
    toast('Cores atualizadas.', 'ok');
    await carregarEmpresas();
  } catch (err) { toast(err.message, 'erro'); }
}

function abrirAdicionarGestor(empresaId, empresaNome) {
  abrirModal(`Novo Gestor SST — ${empresaNome}`, `
    <label>Usuário (login) *</label>
    <input type="text" id="novo-gestor-usuario" placeholder="ex: gestor.empresa">
    <label>Nome completo *</label>
    <input type="text" id="novo-gestor-nome">
    <label>Senha inicial</label>
    <input type="password" id="novo-gestor-senha" placeholder="sesmt123 (padrão)">
    <div class="modal-rodape">
      <button class="btn" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarNovoGestor(${empresaId})">Criar gestor</button>
    </div>`);
}

async function salvarNovoGestor(empresaId) {
  const usuario = document.getElementById('novo-gestor-usuario').value.trim();
  const nome = document.getElementById('novo-gestor-nome').value.trim();
  const senha = document.getElementById('novo-gestor-senha').value.trim() || 'sesmt123';
  if (!usuario || !nome) return toast('Usuário e nome são obrigatórios.', 'erro');
  try {
    await api('/api/admin/empresas/' + empresaId + '/gestores', { method: 'POST', body: { usuario, nome, senha } });
    fecharModal();
    toast(`Gestor "${usuario}" criado.`, 'ok');
    await carregarEmpresas();
  } catch (err) { toast(err.message, 'erro'); }
}

async function carregarGestoresAdmin() {
  GESTORES_ADMIN = await api('/api/admin/gestores');
  renderGestoresAdmin();
}

function renderGestoresAdmin() {
  const tbl = document.getElementById('tabela-gestores');
  if (!tbl) return;
  let h = '<tr><th>Usuário</th><th>Nome</th><th>Empresa</th><th></th></tr>';
  if (!GESTORES_ADMIN.length) h += '<tr><td colspan="4" class="vazio">Nenhum gestor cadastrado.</td></tr>';
  for (const g of GESTORES_ADMIN) {
    h += `<tr>
      <td>${esc(g.username)}</td>
      <td>${esc(g.name)}</td>
      <td>${esc(g.nomeEmpresa || '—')}</td>
      <td class="acoes">
        <button class="btn btn-sm btn-perigo" onclick="excluirGestor(${g.id}, '${esc(g.username)}')">✕ Remover</button>
      </td>
    </tr>`;
  }
  tbl.innerHTML = h;
}

function abrirNovoGestor() {
  if (!EMPRESAS.length) return toast('Cadastre uma empresa antes de criar um gestor.', 'erro');
  abrirModal('Novo Gestor SST', `
    <label>Empresa *</label>
    <select id="novo-gestor-empresa">
      ${EMPRESAS.filter(e => e.ativo !== false).map(e => `<option value="${e.id}">${esc(e.nome)}</option>`).join('')}
    </select>
    <label>Usuário (login) *</label>
    <input type="text" id="novo-gestor-usuario2" placeholder="ex: gestor.empresa">
    <label>Nome completo *</label>
    <input type="text" id="novo-gestor-nome2">
    <label>Senha inicial</label>
    <input type="password" id="novo-gestor-senha2" placeholder="sesmt123 (padrão)">
    <div class="modal-rodape">
      <button class="btn" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarNovoGestor2()">Criar gestor</button>
    </div>`);
}

async function salvarNovoGestor2() {
  const empresaId = Number(document.getElementById('novo-gestor-empresa').value);
  const usuario = document.getElementById('novo-gestor-usuario2').value.trim();
  const nome = document.getElementById('novo-gestor-nome2').value.trim();
  const senha = document.getElementById('novo-gestor-senha2').value.trim() || 'sesmt123';
  if (!usuario || !nome) return toast('Usuário e nome são obrigatórios.', 'erro');
  try {
    await api('/api/admin/empresas/' + empresaId + '/gestores', { method: 'POST', body: { usuario, nome, senha } });
    fecharModal();
    toast(`Gestor "${usuario}" criado.`, 'ok');
    await carregarGestoresAdmin();
  } catch (err) { toast(err.message, 'erro'); }
}

async function excluirGestor(id, username) {
  if (!confirm(`Remover o gestor "${username}"?`)) return;
  try {
    await api('/api/admin/gestores/' + id, { method: 'DELETE' });
    toast('Gestor removido.', 'ok');
    await carregarGestoresAdmin();
  } catch (err) { toast(err.message, 'erro'); }
}

/* ── Dashboard ── */

async function carregarDashboard() {
  // Carrega tudo em paralelo
  const [d, hoje, mes, ics] = await Promise.all([
    api('/api/dashboard'),
    api('/api/dashboard/hoje').catch(() => null),
    api('/api/dashboard/mes').catch(() => null),
    api('/api/ics').catch(() => null)
  ]);

  // Indicadores do dia
  const hojeEl = document.getElementById('dash-hoje');
  const dataEl = document.getElementById('dash-hoje-data');
  if (dataEl) dataEl.textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  if (hojeEl && hoje) {
    hojeEl.innerHTML = [
      { n: hoje.ddsHoje,              l: 'DDS hoje',             cor: '' },
      { n: hoje.ddsRealizados,         l: 'DDS realizados',       cor: '' },
      { n: hoje.treinamentosAgendados, l: 'Treinamentos agend.',  cor: '' },
      { n: hoje.comunicadosPendentes,  l: 'Comunicados pend.',    cor: hoje.comunicadosPendentes > 0 ? 'color:var(--laranja)' : '' },
      { n: `${hoje.participacaoHojePct}%`, l: 'Participação hoje', cor: '' },
      { n: hoje.obsHoje,               l: 'Observações hoje',     cor: '' },
      { n: hoje.sugsHoje,              l: 'Sugestões hoje',       cor: '' },
      { n: hoje.pesquisasAtivas,       l: 'Pesquisas ativas',     cor: '' },
    ].map(k => `<div class="kpi-hoje-card"><div class="kpi-hoje-num" style="${k.cor}">${k.n}</div><div class="kpi-hoje-label">${k.l}</div></div>`).join('');
  }

  // Indicadores do mês
  const mesEl = document.getElementById('dash-mes');
  if (mesEl && mes) {
    mesEl.innerHTML = [
      { l: 'Total DDS',          v: mes.totalDDS },
      { l: 'Total treinamentos', v: mes.totalTreinamentos },
      { l: 'Participantes únicos', v: mes.totalParticipantes },
      { l: 'Horas de treinamento', v: mes.horasTreinamento + 'h' },
      { l: 'Taxa de adesão',     v: mes.taxaAdesao + '%' },
      { l: 'IEI médio (0-100)', v: mes.ieiMedio },
      { l: 'Sugestões aprovadas', v: mes.sugsAprovadas },
      { l: 'Observações',        v: mes.obsRegistradas },
      { l: '% Leitura comunicados', v: mes.pctLeituras + '%' },
    ].map(k => `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f0f3f7;font-size:13px"><span style="color:var(--texto-suave)">${k.l}</span><strong>${k.v}</strong></div>`).join('');
  }

  // ICS
  const icsEl = document.getElementById('dash-ics');
  if (icsEl && ics) renderICS(icsEl, ics);

  document.getElementById('dash-cards').innerHTML = `
    <div class="card"><div class="num">${d.colaboradoresAtivos}</div><div class="rotulo">Colaboradores ativos</div></div>
    <div class="card"><div class="num">${d.totalEventos}</div><div class="rotulo">Atividades realizadas</div></div>
    <div class="card destaque"><div class="num">${d.totalCheckins}</div><div class="rotulo">Check-ins</div></div>
    <div class="card card-laranja"><div class="num">${d.totalObs}</div><div class="rotulo">Observações registradas</div></div>
    <div class="card card-roxo"><div class="num">${d.totalSugs}</div><div class="rotulo">Sugestões enviadas</div></div>
    <div class="card card-vermelho"><div class="num">${d.obsAbertas}</div><div class="rotulo">Observações abertas</div></div>
    ${d.mediaGeralEstrelas ? `<div class="card"><div class="num">${d.mediaGeralEstrelas}⭐</div><div class="rotulo">Avaliação média</div></div>` : ''}
  `;
  let linhas = '<tr><th>Tipo</th><th>Eventos</th><th>Check-ins</th><th>⭐ Média</th></tr>';
  for (const t of CONFIG.tipos) {
    const i = d.porTipo[t] || { eventos: 0, checkins: 0, mediaEstrelas: null };
    linhas += `<tr><td>${esc(t)}</td><td>${i.eventos}</td><td>${i.checkins}</td><td>${i.mediaEstrelas ? i.mediaEstrelas + ' ⭐' : '—'}</td></tr>`;
  }
  document.getElementById('dash-tipos').innerHTML = linhas;
  document.getElementById('dash-top10').innerHTML = htmlRankingCompacto(d.top10);
  const obsAbertas = await api('/api/observacoes').then(l => l.filter(o => o.status === 'aberta').slice(0, 8)).catch(() => []);
  let obsHtml = '<tr><th>Colaborador</th><th>Tipo</th><th>Criticidade</th></tr>';
  if (!obsAbertas.length) obsHtml += '<tr><td colspan="3" class="vazio">Nenhuma observação aberta.</td></tr>';
  for (const o of obsAbertas) {
    obsHtml += `<tr><td>${esc(o.nomeColaborador)}</td><td>${tipoObsTag(o.tipo)}</td><td>${critTag(o.criticidade)}</td></tr>`;
  }
  document.getElementById('dash-obs').innerHTML = obsHtml;
}

function renderICS(el, ics) {
  const NOTA_CORES = { A: '#1a8a4c', B: '#2563eb', C: '#e8801a', D: '#f97316', E: '#c43a3a' };
  const NOTA_LABELS = { A: 'Excelente', B: 'Bom', C: 'Regular', D: 'Atenção', E: 'Crítico' };
  const cor = NOTA_CORES[ics.nota] || '#637080';
  const dims = [
    { nome: 'Participação',  val: ics.dimensoes.participacao,  peso: '30%' },
    { nome: 'Comunicação',   val: ics.dimensoes.comunicacao,   peso: '20%' },
    { nome: 'Observações',   val: ics.dimensoes.observacoes,   peso: '15%' },
    { nome: 'Sugestões',     val: ics.dimensoes.sugestoes,     peso: '10%' },
    { nome: 'Quiz',          val: ics.dimensoes.quiz,          peso: '10%' },
    { nome: 'Engajamento',   val: ics.dimensoes.engajamento,   peso: '15%' },
  ];
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:18px;margin-bottom:14px">
      <div style="text-align:center">
        <div class="ics-grade-badge" style="color:${cor}">${ics.nota}</div>
        <div style="font-size:11px;color:var(--texto-suave);margin-top:2px">${NOTA_LABELS[ics.nota]}</div>
      </div>
      <div>
        <div style="font-size:32px;font-weight:900;color:var(--azul-escuro)">${ics.ics}</div>
        <div style="font-size:11px;color:var(--texto-suave)">Pontos (0–100)</div>
      </div>
    </div>
    ${dims.map(d => `
      <div class="ics-dimensao-linha">
        <span class="ics-dimensao-nome">${d.nome}<span class="hint"> ${d.peso}</span></span>
        <div class="ics-dimensao-barra-wrap">
          <div class="ics-dimensao-barra" style="width:${d.val}%"></div>
        </div>
        <span class="ics-dimensao-valor">${d.val}%</span>
      </div>`).join('')}`;
}

function htmlRankingCompacto(lista) {
  let h = '<tr><th>Pos.</th><th>Nome</th><th>Conquista</th><th>Pts</th></tr>';
  if (!lista.length) return h + '<tr><td colspan="4" class="vazio">Nenhum dado ainda.</td></tr>';
  for (const r of lista) {
    const medalha = r.posicao === 1 ? '🥇' : r.posicao === 2 ? '🥈' : r.posicao === 3 ? '🥉' : r.posicao + 'º';
    h += `<tr><td class="medalha">${medalha}</td><td>${esc(r.nome)}</td><td>${r.conquista ? r.conquista.emoji : '—'}</td><td class="pontos-cel">${r.pontos}</td></tr>`;
  }
  return h;
}

function tipoObsTag(tipo) {
  return tipo === 'ato_inseguro'
    ? '<span class="tag tag-laranja">Ato Inseguro</span>'
    : '<span class="tag tag-vermelho">Condição Insegura</span>';
}

function critTag(crit) {
  return `<span class="tag crit-${crit}">${crit.charAt(0).toUpperCase() + crit.slice(1)}</span>`;
}

/* ── Eventos ── */

function preencherFiltroTipos() {
  const sel = document.getElementById('filtro-tipo');
  if (!sel) return;
  sel.innerHTML = '<option value="">Todos os tipos</option>' + CONFIG.tipos.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
}

async function carregarEventos() {
  EVENTOS = await api('/api/eventos');
  renderEventos();
}

function renderEventos() {
  const tipo = (document.getElementById('filtro-tipo') || {}).value || '';
  const busca = ((document.getElementById('filtro-busca') || {}).value || '').toLowerCase();
  const lista = EVENTOS.filter(ev =>
    (!tipo || ev.tipo === tipo) &&
    (!busca || (ev.tema + ' ' + ev.responsavel + ' ' + ev.local).toLowerCase().includes(busca))
  );
  let h = '<tr><th>Data</th><th>Tipo</th><th>Tema</th><th>Local</th><th>Responsável</th><th>Check-ins</th><th>⭐</th><th>Pts</th><th></th></tr>';
  if (!lista.length) h += '<tr><td colspan="9" class="vazio">Nenhuma atividade registrada.</td></tr>';
  for (const ev of lista) {
    const codBadge = ev.codigoAtivo ? `<span class="tag tag-verde" title="Código ativo: ${ev.codigoAtivo}">#${ev.codigoAtivo}</span>` : '';
    h += `<tr>
      <td>${dataBr(ev.data)}${ev.hora ? ' ' + ev.hora : ''}</td>
      <td><span class="tag">${esc(ev.tipo)}</span></td>
      <td>${esc(ev.tema)} ${codBadge}</td>
      <td>${esc(ev.local)}</td>
      <td>${esc(ev.responsavel)}</td>
      <td>${ev.totalCheckins} <small style="color:var(--texto-suave)">(${ev.avaliados} aval.)</small></td>
      <td>${ev.mediaEstrelas ? ev.mediaEstrelas + ' ⭐' : '—'}</td>
      <td class="pontos-cel">${ev.pontosAplicados}</td>
      <td class="acoes">
        <button class="btn btn-sm btn-primary" onclick="abrirCodigoCheckin(${ev.id})" title="Gerar código de check-in">Código</button>
        <button class="btn btn-sm" onclick="abrirDetalheEvento(${ev.id})">Ver</button>
        <button class="btn btn-sm" onclick="abrirEditarEvento(${ev.id})">Editar</button>
        <button class="btn btn-sm btn-perigo" onclick="excluirEvento(${ev.id})">✕</button>
      </td>
    </tr>`;
  }
  document.getElementById('tabela-eventos').innerHTML = h;
}

function formEventoHtml(ev) {
  const hoje = new Date().toISOString().slice(0, 10);
  return `
    <div class="linha-2">
      <div>
        <label>Tipo de atividade *</label>
        <select id="ev-tipo">${CONFIG.tipos.map(t => `<option value="${esc(t)}" ${ev && ev.tipo === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
      </div>
      <div>
        <label>Data *</label>
        <input type="date" id="ev-data" value="${ev ? ev.data : hoje}">
      </div>
    </div>
    <div class="linha-2">
      <div>
        <label>Horário</label>
        <input type="time" id="ev-hora" value="${ev ? esc(ev.hora || '') : ''}">
      </div>
      <div>
        <label>Local</label>
        <input type="text" id="ev-local" value="${ev ? esc(ev.local || '') : ''}" placeholder="Ex.: Sala de treinamento">
      </div>
    </div>
    <label>Tema / assunto</label>
    <input type="text" id="ev-tema" value="${ev ? esc(ev.tema) : ''}" placeholder="Ex.: Uso correto de EPI">
    <div class="linha-2">
      <div>
        <label>Responsável / facilitador</label>
        <input type="text" id="ev-resp" value="${ev ? esc(ev.responsavel) : ''}">
      </div>
      <div>
        <label>Pontos (vazio = padrão do tipo)</label>
        <input type="number" id="ev-pontos" min="0" step="1" value="${ev && ev.pontos !== null && ev.pontos !== undefined ? ev.pontos : ''}" placeholder="padrão">
      </div>
    </div>
    <label>Observações</label>
    <textarea id="ev-obs">${ev ? esc(ev.observacoes || '') : ''}</textarea>
    <div class="modal-rodape">
      <button class="btn" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarEvento(${ev ? ev.id : 'null'})">Salvar</button>
    </div>`;
}

async function abrirNovoEvento() { abrirModal('Nova atividade de SST', formEventoHtml(null)); }
async function abrirEditarEvento(id) {
  const ev = EVENTOS.find(e => e.id === id);
  if (!ev) return;
  abrirModal('Editar atividade', formEventoHtml(ev));
}

async function salvarEvento(id) {
  const body = {
    tipo: document.getElementById('ev-tipo').value,
    data: document.getElementById('ev-data').value,
    hora: document.getElementById('ev-hora').value,
    local: document.getElementById('ev-local').value,
    tema: document.getElementById('ev-tema').value,
    responsavel: document.getElementById('ev-resp').value,
    observacoes: document.getElementById('ev-obs').value,
    pontos: document.getElementById('ev-pontos').value === '' ? null : Number(document.getElementById('ev-pontos').value)
  };
  try {
    if (id) await api('/api/eventos/' + id, { method: 'PUT', body });
    else await api('/api/eventos', { method: 'POST', body });
    fecharModal();
    toast('Atividade salva.');
    await carregarEventos();
  } catch (err) { toast(err.message, 'erro'); }
}

async function excluirEvento(id) {
  if (!confirm('Excluir esta atividade? Os check-ins relacionados também serão removidos.')) return;
  try {
    await api('/api/eventos/' + id, { method: 'DELETE' });
    toast('Atividade excluída.');
    await carregarEventos();
  } catch (err) { toast(err.message, 'erro'); }
}

/* ── Código de Check-in ── */

async function abrirCodigoCheckin(eventId) {
  const ev = EVENTOS.find(e => e.id === eventId);
  if (!ev) return;
  const body = `
    <p><strong>Atividade:</strong> ${esc(ev.tipo)} — ${esc(ev.tema)}</p>
    <p class="hint" style="margin-top:4px">Data: ${dataBr(ev.data)}${ev.hora ? ' às ' + ev.hora : ''} | Local: ${esc(ev.local || 'não informado')}</p>
    <div id="codigo-area" style="margin-top:12px">
      <button class="btn btn-primary btn-block" onclick="gerarCodigo(${eventId})">Gerar código de check-in</button>
    </div>
    <div id="checkins-evento" style="margin-top:18px"></div>`;
  abrirModal('Código de Check-in', body);
  try {
    const r = await api('/api/eventos/' + eventId + '/codigo');
    if (r.ativo) mostrarCodigo(r.code, r.expiraEm, eventId);
  } catch { /* sem código ativo */ }
  carregarCheckinsEvento(eventId);
}

function mostrarCodigo(code, expiraEm, eventId) {
  const area = document.getElementById('codigo-area');
  if (!area) return;
  clearInterval(codigoTimer);
  const update = () => {
    const restante = Math.max(0, Math.floor((expiraEm - Date.now()) / 1000));
    const min = Math.floor(restante / 60).toString().padStart(2, '0');
    const seg = (restante % 60).toString().padStart(2, '0');
    const timerEl = document.getElementById('codigo-timer');
    if (timerEl) timerEl.textContent = `⏱ ${min}:${seg}`;
    if (restante <= 0) { clearInterval(codigoTimer); if (timerEl) timerEl.textContent = '⚠️ Código expirado'; }
  };
  area.innerHTML = `
    <div class="codigo-display">
      <div class="code">${code}</div>
      <div class="validade">Válido por ${CONFIG.codigoValidade} min</div>
      <div class="timer" id="codigo-timer"></div>
    </div>
    <div style="margin-top:10px;display:flex;gap:8px">
      <button class="btn btn-primary" style="flex:1" onclick="gerarCodigo(${eventId})">Novo código</button>
    </div>`;
  update();
  codigoTimer = setInterval(update, 1000);
}

async function gerarCodigo(eventId) {
  try {
    const r = await api('/api/eventos/' + eventId + '/codigo', { method: 'POST' });
    mostrarCodigo(r.code, r.expiraEm, eventId);
    toast('Código gerado: ' + r.code);
  } catch (err) { toast(err.message, 'erro'); }
}

async function carregarCheckinsEvento(eventId) {
  const area = document.getElementById('checkins-evento');
  if (!area) return;
  try {
    const checkins = await api('/api/eventos/' + eventId + '/avaliacoes');
    const ev = EVENTOS.find(e => e.id === eventId);
    const totalCheckins = ev ? ev.totalCheckins : 0;
    area.innerHTML = `<h4 style="margin-bottom:8px;color:var(--azul-escuro)">Participantes (${totalCheckins} check-ins, ${checkins.length} avaliações)</h4>
      <table class="tabela">
        <tr><th>Nome</th><th>Matrícula</th><th>Horário</th><th>⭐</th></tr>
        ${checkins.length === 0 ? '<tr><td colspan="4" class="vazio">Nenhuma avaliação registrada ainda.</td></tr>' :
          checkins.map(c => `<tr>
            <td>${esc(c.nomeColaborador)}</td>
            <td>${esc(c.matricula)}</td>
            <td>${tsHora(c.timestamp)}</td>
            <td>${c.avaliacao.estrelas > 0 ? '⭐'.repeat(c.avaliacao.estrelas) : '—'}</td>
          </tr>`).join('')}
      </table>`;
  } catch { /* ignore */ }
}

async function abrirDetalheEvento(eventId) {
  const ev = EVENTOS.find(e => e.id === eventId);
  if (!ev) return;
  document.getElementById('detalhe-titulo').textContent = `${ev.tipo} — ${ev.tema || 'sem tema'}`;
  const checkins = await api('/api/eventos/' + eventId + '/avaliacoes').catch(() => []);
  const feedbacks = checkins.filter(c => c.avaliacao && (c.avaliacao.gostou || c.avaliacao.melhorar || c.avaliacao.livre));
  const mediaStr = checkins.length > 0
    ? (checkins.reduce((s, c) => s + (c.avaliacao.estrelas || 0), 0) / checkins.length).toFixed(1)
    : '—';
  const palavras = {};
  checkins.forEach(c => {
    if (!c.avaliacao) return;
    const texto = [c.avaliacao.gostou, c.avaliacao.melhorar, c.avaliacao.temas, c.avaliacao.seguranca, c.avaliacao.livre].join(' ').toLowerCase();
    texto.split(/\W+/).filter(w => w.length > 4).forEach(w => { palavras[w] = (palavras[w] || 0) + 1; });
  });
  const topPalavras = Object.entries(palavras).sort((a, b) => b[1] - a[1]).slice(0, 10);
  document.getElementById('detalhe-corpo').innerHTML = `
    <div class="cards" style="margin-bottom:16px">
      <div class="card"><div class="num">${ev.totalCheckins || 0}</div><div class="rotulo">Check-ins</div></div>
      <div class="card destaque"><div class="num">${checkins.length}</div><div class="rotulo">Avaliações</div></div>
      <div class="card card-laranja"><div class="num">${mediaStr}⭐</div><div class="rotulo">Avaliação média</div></div>
    </div>
    <div class="grid-2">
      <div>
        <h4 style="margin-bottom:8px;color:var(--azul-escuro)">Informações</h4>
        <table class="tabela">
          <tr><td><strong>Data</strong></td><td>${dataBr(ev.data)}${ev.hora ? ' às ' + ev.hora : ''}</td></tr>
          <tr><td><strong>Local</strong></td><td>${esc(ev.local || 'Não informado')}</td></tr>
          <tr><td><strong>Responsável</strong></td><td>${esc(ev.responsavel)}</td></tr>
          <tr><td><strong>Pontos</strong></td><td>${ev.pontosAplicados} pts/participante</td></tr>
        </table>
        ${topPalavras.length ? `<h4 style="margin:14px 0 8px;color:var(--azul-escuro)">Palavras-chave nos feedbacks</h4>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${topPalavras.map(([w, n]) => `<span class="tag">${esc(w)} (${n})</span>`).join('')}
          </div>` : ''}
      </div>
      <div>
        <h4 style="margin-bottom:8px;color:var(--azul-escuro)">Feedbacks recebidos (${feedbacks.length})</h4>
        <div style="max-height:300px;overflow-y:auto">
          ${feedbacks.length === 0 ? '<p class="hint">Nenhum feedback textual ainda.</p>' :
            feedbacks.map(c => `<div style="border:1px solid var(--cinza-borda);border-radius:8px;padding:10px;margin-bottom:8px;font-size:13px">
              <strong>${esc(c.nomeColaborador)}</strong> ${'⭐'.repeat(c.avaliacao.estrelas || 0)}
              ${c.avaliacao.gostou ? `<p><em>Gostou:</em> ${esc(c.avaliacao.gostou)}</p>` : ''}
              ${c.avaliacao.melhorar ? `<p><em>Melhorar:</em> ${esc(c.avaliacao.melhorar)}</p>` : ''}
              ${c.avaliacao.livre ? `<p><em>Livre:</em> ${esc(c.avaliacao.livre)}</p>` : ''}
            </div>`).join('')}
        </div>
      </div>
    </div>
    <div class="modal-rodape">
      <button class="btn btn-primary" onclick="abrirPresencaManual(${eventId})">Adicionar presença manual</button>
      <button class="btn" onclick="window.open('/api/evidencias/${eventId}','_blank')">🖨 Gerar evidência</button>
      <button class="btn" onclick="fecharDetalheEvento()">Fechar</button>
    </div>`;
  document.getElementById('modal-evento-detalhe').classList.remove('hidden');
}

async function abrirPresencaManual(eventId) {
  await carregarColaboradores();
  const ativos = COLABORADORES.filter(c => c.ativo !== false);
  const html = `
    <p class="hint">Adicione colaboradores à lista de presença manualmente (sem avaliação).</p>
    <input type="text" id="pm-busca" placeholder="Filtrar..." oninput="filtrarParticipantes()" style="width:100%;padding:9px;border:1px solid var(--cinza-borda);border-radius:8px;margin-bottom:8px">
    <div class="lista-participantes" id="ev-lista-part">
      ${ativos.map(c => `
        <label class="item" data-busca="${esc((c.nome + ' ' + c.matricula).toLowerCase())}">
          <input type="checkbox" class="chk-part" value="${c.id}" onchange="atualizarContadorSel()">
          <span>${esc(c.nome)} <small>(${esc(c.matricula)})</small></span>
        </label>`).join('')}
    </div>
    <div class="contador-sel" id="ev-contador">0 selecionado(s)</div>
    <div class="modal-rodape">
      <button class="btn" onclick="fecharDetalheEvento()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarPresencaManual(${eventId})">Registrar presença</button>
    </div>`;
  document.getElementById('detalhe-corpo').innerHTML = html;
}

async function salvarPresencaManual(eventId) {
  const participantes = [...document.querySelectorAll('.chk-part:checked')].map(c => Number(c.value));
  if (!participantes.length) return toast('Selecione ao menos um colaborador.', 'erro');
  try {
    const r = await api('/api/eventos/' + eventId + '/presenca', { method: 'POST', body: { participantes } });
    toast(`${r.adicionados} presença(s) registrada(s).`, 'ok');
    fecharDetalheEvento();
    await carregarEventos();
  } catch (err) { toast(err.message, 'erro'); }
}

function filtrarParticipantes() {
  const input = document.getElementById('pm-busca') || document.getElementById('ev-busca-part');
  const q = input ? input.value.toLowerCase() : '';
  document.querySelectorAll('#ev-lista-part .item').forEach(el => {
    el.style.display = !q || (el.dataset.busca || '').includes(q) ? '' : 'none';
  });
}

function atualizarContadorSel() {
  const n = document.querySelectorAll('.chk-part:checked').length;
  const el = document.getElementById('ev-contador');
  if (el) el.textContent = n + ' selecionado(s)';
}

/* ── Colaboradores ── */

async function carregarColaboradores() {
  COLABORADORES = await api('/api/colaboradores');
  renderColaboradores();
}

function renderColaboradores() {
  const tbl = document.getElementById('tabela-colaboradores');
  if (!tbl) return;
  const busca = (document.getElementById('filtro-colab').value || '').toLowerCase();
  const verInativos = document.getElementById('filtro-inativos').checked;
  const lista = COLABORADORES.filter(c =>
    (verInativos || c.ativo !== false) &&
    (!busca || (c.nome + ' ' + c.matricula + ' ' + (c.setor || '') + ' ' + (c.empresa || '')).toLowerCase().includes(busca))
  );
  let h = '<tr><th>Matrícula</th><th>Nome</th><th>Setor/Equipe</th><th>Função</th><th>Empresa</th><th>IES</th><th>Conquista</th><th>Pts</th><th>Status</th><th></th></tr>';
  if (!lista.length) h += '<tr><td colspan="10" class="vazio">Nenhum colaborador encontrado.</td></tr>';
  for (const c of lista) {
    const conquista = c.conquista;
    h += `<tr>
      <td>${esc(c.matricula)}</td>
      <td>${esc(c.nome)}</td>
      <td>${esc(c.setor)}${c.equipe ? ' / ' + esc(c.equipe) : ''}</td>
      <td>${esc(c.funcao)}</td>
      <td>${esc(c.empresa || '—')}</td>
      <td><strong>${c.ies}</strong>/100</td>
      <td>${conquista ? conquista.emoji + ' ' + conquista.nome : '—'}</td>
      <td class="pontos-cel">${c.pontos}</td>
      <td>${c.ativo !== false ? '<span class="tag tag-verde">Ativo</span>' : '<span class="tag tag-inativo">Inativo</span>'}</td>
      <td class="acoes">
        <button class="btn btn-sm" onclick="abrirPerfilCompleto(${c.id})">👤 Perfil</button>
        <button class="btn btn-sm" onclick="abrirEditarColaborador(${c.id})">Editar</button>
        <button class="btn btn-sm btn-perigo" onclick="excluirColaborador(${c.id})">✕</button>
      </td>
    </tr>`;
  }
  tbl.innerHTML = h;
}

function formColaboradorHtml(c) {
  const unidades = (EMPRESA_INFO.unidades || []);
  const unidadeSelect = unidades.length > 0
    ? `<select id="co-unidade">
        <option value="">Selecione...</option>
        ${unidades.map(u => `<option value="${esc(u.nome)}" ${c && c.unidade === u.nome ? 'selected' : ''}>${esc(u.nome)}</option>`).join('')}
       </select>`
    : `<input type="text" id="co-unidade" value="${c ? esc(c.unidade || '') : ''}" placeholder="Nome da unidade">`;
  return `
    <div class="linha-2">
      <div><label>Matrícula *</label><input type="text" id="co-matricula" value="${c ? esc(c.matricula) : ''}"></div>
      <div><label>CPF</label><input type="text" id="co-cpf" value="${c ? esc(c.cpf || '') : ''}" placeholder="000.000.000-00"></div>
    </div>
    <label>Nome completo *</label>
    <input type="text" id="co-nome" value="${c ? esc(c.nome) : ''}">
    <div class="linha-2">
      <div><label>Setor</label><input type="text" id="co-setor" value="${c ? esc(c.setor || '') : ''}"></div>
      <div><label>Equipe</label><input type="text" id="co-equipe" value="${c ? esc(c.equipe || '') : ''}"></div>
    </div>
    <div class="linha-3">
      <div><label>Função</label><input type="text" id="co-funcao" value="${c ? esc(c.funcao || '') : ''}"></div>
      <div><label>Unidade</label>${unidadeSelect}</div>
      <div><label>Empresa</label><input type="text" id="co-empresa" value="${esc(EMPRESA_INFO.nome || (c ? c.empresa || '' : ''))}" readonly class="input-readonly"></div>
    </div>
    ${c ? `<label class="check-inline" style="margin-top:12px"><input type="checkbox" id="co-ativo" ${c.ativo !== false ? 'checked' : ''}> colaborador ativo</label>` : ''}
    <div class="modal-rodape">
      <button class="btn" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarColaborador(${c ? c.id : 'null'})">Salvar</button>
    </div>`;
}

function abrirNovoColaborador() { abrirModal('Novo colaborador', formColaboradorHtml(null)); }

function abrirEditarColaborador(id) {
  const c = COLABORADORES.find(x => x.id === id);
  if (c) abrirModal('Editar colaborador', formColaboradorHtml(c));
}

async function salvarColaborador(id) {
  const body = {
    matricula: document.getElementById('co-matricula').value,
    cpf: document.getElementById('co-cpf').value,
    nome: document.getElementById('co-nome').value,
    setor: document.getElementById('co-setor').value,
    equipe: document.getElementById('co-equipe').value,
    funcao: document.getElementById('co-funcao').value,
    unidade: document.getElementById('co-unidade').value,
    empresa: document.getElementById('co-empresa').value
  };
  const chkAtivo = document.getElementById('co-ativo');
  if (chkAtivo) body.ativo = chkAtivo.checked;
  try {
    if (id) await api('/api/colaboradores/' + id, { method: 'PUT', body });
    else await api('/api/colaboradores', { method: 'POST', body });
    fecharModal();
    toast('Colaborador salvo.', 'ok');
    await carregarColaboradores();
  } catch (err) { toast(err.message, 'erro'); }
}

async function excluirColaborador(id) {
  const c = COLABORADORES.find(x => x.id === id);
  if (!confirm(`Excluir ${c ? c.nome : 'colaborador'}?`)) return;
  try {
    const r = await api('/api/colaboradores/' + id, { method: 'DELETE' });
    toast(r.inativado ? 'Colaborador inativado.' : 'Colaborador removido.', 'ok');
    await carregarColaboradores();
  } catch (err) { toast(err.message, 'erro'); }
}

function abrirImportacao() {
  abrirModal('Importar colaboradores via planilha', `
    <p class="hint">Formato: <strong>matrícula;nome;setor;função;equipe;unidade;empresa</strong><br>
    Colunas setor em diante são opcionais. Aceita CSV, TXT e colagem direta do Excel.</p>
    <label>Arquivo CSV/TXT</label>
    <input type="file" id="imp-arquivo" accept=".csv,.txt" onchange="lerArquivoImportacao(this)">
    <label>Lista de colaboradores</label>
    <textarea id="imp-texto" style="min-height:160px" placeholder="1001;Maria Silva;Produção;Operadora;Equipe A;Unidade SP;Empresa XYZ"></textarea>
    <div class="modal-rodape">
      <button class="btn" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="enviarImportacao()">Importar</button>
    </div>
    <div id="imp-resultado" style="margin-top:12px"></div>`);
}

function lerArquivoImportacao(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { document.getElementById('imp-texto').value = reader.result; };
  reader.readAsText(file, 'utf-8');
}

async function enviarImportacao() {
  const texto = document.getElementById('imp-texto').value;
  if (!texto.trim()) return toast('Cole a lista ou selecione um arquivo.', 'erro');
  try {
    const r = await api('/api/colaboradores/importar', { method: 'POST', body: { texto } });
    let html = `<p style="color:var(--verde);font-weight:700">✔ ${r.inseridos} colaborador(es) importado(s).</p>`;
    if (r.duplicados.length) html += `<p class="hint">Ignoradas (já existem): ${r.duplicados.map(esc).join(', ')}</p>`;
    if (r.erros.length) html += `<p class="erro">Erros: ${r.erros.map(e => 'linha ' + e.linha).join(', ')}</p>`;
    document.getElementById('imp-resultado').innerHTML = html;
    toast(`${r.inseridos} importado(s).`, 'ok');
    await carregarColaboradores();
  } catch (err) { toast(err.message, 'erro'); }
}

/* ── Observações (gestor) ── */

async function carregarObservacoes() {
  OBSERVACOES = await api('/api/observacoes');
  renderObservacoes();
}

function renderObservacoes() {
  const statusFiltro = (document.getElementById('filtro-obs-status') || {}).value || '';
  const critFiltro = (document.getElementById('filtro-obs-crit') || {}).value || '';
  const lista = OBSERVACOES.filter(o =>
    (!statusFiltro || o.status === statusFiltro) &&
    (!critFiltro || o.criticidade === critFiltro)
  );
  let h = '<tr><th>Data</th><th>Colaborador</th><th>Tipo</th><th>Criticidade</th><th>Local</th><th>Status</th><th>Pontos</th><th></th></tr>';
  if (!lista.length) h += '<tr><td colspan="8" class="vazio">Nenhuma observação.</td></tr>';
  for (const o of lista) {
    const statusTag = o.status === 'aberta' ? '<span class="tag tag-vermelho">Aberta</span>'
      : o.status === 'em_analise' ? '<span class="tag tag-laranja">Em análise</span>'
      : '<span class="tag tag-verde">Resolvida</span>';
    h += `<tr>
      <td>${tsDataHora(o.criadoEm)}</td>
      <td>${esc(o.nomeColaborador)}</td>
      <td>${tipoObsTag(o.tipo)}</td>
      <td>${critTag(o.criticidade)}</td>
      <td>${esc(o.local || '—')}</td>
      <td>${statusTag}</td>
      <td class="pontos-cel">${o.pontos}</td>
      <td class="acoes">
        <button class="btn btn-sm" onclick="abrirTratarObs(${o.id})">Tratar</button>
      </td>
    </tr>`;
  }
  document.getElementById('tabela-observacoes').innerHTML = h;
}

function abrirTratarObs(id) {
  const o = OBSERVACOES.find(x => x.id === id);
  if (!o) return;
  abrirModal('Tratar observação', `
    <p><strong>${tipoObsTag(o.tipo)}</strong> ${critTag(o.criticidade)}</p>
    <p style="margin-top:8px;font-size:14px"><strong>Descrição:</strong> ${esc(o.descricao)}</p>
    <p style="font-size:13px;color:var(--texto-suave)">Local: ${esc(o.local || '—')} | Registrado por: ${esc(o.nomeColaborador)} em ${tsDataHora(o.criadoEm)}</p>
    <label>Status</label>
    <select id="obs-status">
      <option value="aberta" ${o.status === 'aberta' ? 'selected' : ''}>Aberta</option>
      <option value="em_analise" ${o.status === 'em_analise' ? 'selected' : ''}>Em análise</option>
      <option value="resolvida" ${o.status === 'resolvida' ? 'selected' : ''}>Resolvida</option>
    </select>
    <label>Ação corretiva</label>
    <textarea id="obs-acao">${esc(o.acaoCorretiva || '')}</textarea>
    <div class="linha-2">
      <div><label>Responsável pela ação</label><input type="text" id="obs-resp-acao" value="${esc(o.responsavelAcao || '')}"></div>
      <div><label>Prazo</label><input type="date" id="obs-prazo" value="${esc(o.prazo || '')}"></div>
    </div>
    <div class="modal-rodape">
      <button class="btn" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarTratamento(${id})">Salvar tratamento</button>
    </div>`);
}

async function salvarTratamento(id) {
  try {
    await api('/api/observacoes/' + id, { method: 'PUT', body: {
      status: document.getElementById('obs-status').value,
      acaoCorretiva: document.getElementById('obs-acao').value,
      responsavelAcao: document.getElementById('obs-resp-acao').value,
      prazo: document.getElementById('obs-prazo').value
    }});
    fecharModal();
    toast('Tratamento salvo.', 'ok');
    await carregarObservacoes();
  } catch (err) { toast(err.message, 'erro'); }
}

/* ── Sugestões (gestor) ── */

async function carregarSugestoes() {
  SUGESTOES = await api('/api/sugestoes');
  renderSugestoes();
}

function renderSugestoes() {
  const statusFiltro = (document.getElementById('filtro-sug-status') || {}).value || '';
  const lista = SUGESTOES.filter(s => !statusFiltro || s.status === statusFiltro);
  let h = '<tr><th>Data</th><th>Colaborador</th><th>Sugestão</th><th>Status</th><th></th></tr>';
  if (!lista.length) h += '<tr><td colspan="5" class="vazio">Nenhuma sugestão.</td></tr>';
  for (const s of lista) {
    const stTag = s.status === 'pendente' ? '<span class="tag tag-laranja">Pendente</span>'
      : s.status === 'aprovada' ? '<span class="tag tag-verde">Aprovada ✓</span>'
      : '<span class="tag tag-cinza">Rejeitada</span>';
    h += `<tr>
      <td>${tsDataHora(s.criadoEm)}</td>
      <td>${esc(s.nomeColaborador)}</td>
      <td>${esc(s.descricao).slice(0, 80)}${s.descricao.length > 80 ? '…' : ''}</td>
      <td>${stTag}</td>
      <td class="acoes">
        <button class="btn btn-sm" onclick="abrirAvaliarSugestao(${s.id})">Avaliar</button>
      </td>
    </tr>`;
  }
  document.getElementById('tabela-sugestoes').innerHTML = h;
}

function abrirAvaliarSugestao(id) {
  const s = SUGESTOES.find(x => x.id === id);
  if (!s) return;
  abrirModal('Avaliar sugestão', `
    <p style="font-size:14px"><strong>Colaborador:</strong> ${esc(s.nomeColaborador)}</p>
    <p style="margin:10px 0"><strong>Sugestão:</strong> ${esc(s.descricao)}</p>
    ${s.beneficio ? `<p style="font-size:13px;color:var(--texto-suave)"><strong>Benefício esperado:</strong> ${esc(s.beneficio)}</p>` : ''}
    <label>Status</label>
    <select id="sug-status-sel">
      <option value="pendente" ${s.status === 'pendente' ? 'selected' : ''}>Pendente</option>
      <option value="aprovada" ${s.status === 'aprovada' ? 'selected' : ''}>Aprovada (+50 pontos ao colaborador)</option>
      <option value="rejeitada" ${s.status === 'rejeitada' ? 'selected' : ''}>Rejeitada</option>
    </select>
    <label>Comentário do gestor</label>
    <textarea id="sug-comentario">${esc(s.comentarioGestor || '')}</textarea>
    <div class="modal-rodape">
      <button class="btn" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarAvaliacao(${id})">Salvar</button>
    </div>`);
}

async function salvarAvaliacao(id) {
  try {
    await api('/api/sugestoes/' + id, { method: 'PUT', body: {
      status: document.getElementById('sug-status-sel').value,
      comentarioGestor: document.getElementById('sug-comentario').value
    }});
    fecharModal();
    toast('Avaliação salva.', 'ok');
    await carregarSugestoes();
  } catch (err) { toast(err.message, 'erro'); }
}

/* ── Ranking ── */

async function carregarRanking() {
  RANKING = await api('/api/ranking');
  const setores = [...new Set(RANKING.map(r => r.setor).filter(Boolean))].sort();
  const equipes = [...new Set(RANKING.map(r => r.equipe).filter(Boolean))].sort();
  const selSetor = document.getElementById('filtro-rank-setor');
  const selEquipe = document.getElementById('filtro-rank-equipe');
  if (selSetor) selSetor.innerHTML = '<option value="">Todos os setores</option>' + setores.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  if (selEquipe) selEquipe.innerHTML = '<option value="">Todas as equipes</option>' + equipes.map(e => `<option value="${esc(e)}">${esc(e)}</option>`).join('');
  const resumo = {};
  CONFIG.conquistas.forEach(a => { resumo[a.key] = 0; });
  RANKING.forEach(r => { if (r.conquista) resumo[r.conquista.key]++; });
  document.getElementById('conquista-resumo').innerHTML = CONFIG.conquistas.map(a => `
    <div class="card"><div class="num">${resumo[a.key] || 0}</div><div class="rotulo">${a.emoji} ${a.nome}</div></div>`).join('');
  renderRanking();
}

function renderRanking() {
  const setorFiltro = (document.getElementById('filtro-rank-setor') || {}).value || '';
  const equipeFiltro = (document.getElementById('filtro-rank-equipe') || {}).value || '';
  const lista = RANKING.filter(r =>
    (!setorFiltro || r.setor === setorFiltro) &&
    (!equipeFiltro || r.equipe === equipeFiltro)
  );
  let h = '<tr><th>Pos.</th><th>Nome</th><th>Matrícula</th><th>Setor</th><th>Equipe</th><th>Empresa</th><th>Conquista</th><th>Pontos</th></tr>';
  if (!lista.length) h += '<tr><td colspan="8" class="vazio">Nenhum colaborador.</td></tr>';
  for (const r of lista) {
    const pos = r.posicao === 1 ? '🥇' : r.posicao === 2 ? '🥈' : r.posicao === 3 ? '🥉' : r.posicao + 'º';
    h += `<tr>
      <td class="medalha">${pos}</td>
      <td>${esc(r.nome)}</td>
      <td>${esc(r.matricula)}</td>
      <td>${esc(r.setor)}</td>
      <td>${esc(r.equipe || '—')}</td>
      <td>${esc(r.empresa || '—')}</td>
      <td>${r.conquista ? r.conquista.emoji + ' ' + r.conquista.nome : '—'}</td>
      <td class="pontos-cel">${r.pontos}</td>
    </tr>`;
  }
  document.getElementById('tabela-ranking').innerHTML = h;
}

/* ── Configurações ── */

function renderConfig() {
  const form = document.getElementById('form-pontos');
  const todosTipos = [...CONFIG.tipos, 'Registro de Desvio', 'Sugestão Aprovada'];
  form.innerHTML = todosTipos.map(t => `
    <div class="ponto-linha">
      <span>${esc(t)}</span>
      <input type="number" min="0" step="1" data-tipo="${esc(t)}" value="${CONFIG.pontos[t] || 0}">
      <small>pts</small>
    </div>`).join('') +
    '<button class="btn btn-primary" type="submit" style="margin-top:10px">Salvar pontuações</button>';
  const cfgVal = document.getElementById('cfg-validade');
  if (cfgVal) cfgVal.value = CONFIG.codigoValidade || 60;
  renderRecompensas();
}

async function carregarBrandingConfig() {
  try {
    const b = await api('/api/empresa/branding');
    const logoPreview = document.getElementById('logo-preview-wrap');
    if (logoPreview) {
      logoPreview.innerHTML = b.logo
        ? `<img src="${b.logo}" class="logo-preview" alt="logo"><br><small class="hint">Logo atual da empresa</small>`
        : '<span class="logo-sem-preview">Nenhuma logo cadastrada</span>';
    }
    const cores = b.cores || {};
    ['primaria', 'secundaria', 'destaque', 'laranja'].forEach(k => {
      const el = document.getElementById('cor-' + k);
      if (el && cores[k]) el.value = cores[k];
    });
  } catch { /* ignore */ }
}

async function salvarPontos(e) {
  e.preventDefault();
  const body = {};
  document.querySelectorAll('#form-pontos input[data-tipo]').forEach(i => { body[i.dataset.tipo] = Number(i.value); });
  try {
    const r = await api('/api/config/pontos', { method: 'PUT', body });
    CONFIG.pontos = r.pontos;
    toast('Pontuações atualizadas.', 'ok');
  } catch (err) { toast(err.message, 'erro'); }
  return false;
}

async function salvarConfigGeral() {
  const val = Number(document.getElementById('cfg-validade').value);
  try {
    await api('/api/config/geral', { method: 'PUT', body: { codigoValidade: val, recompensas: lerRecompensas() } });
    CONFIG.codigoValidade = val;
    toast('Configurações salvas.', 'ok');
  } catch (err) { toast(err.message, 'erro'); }
}

async function alterarSenha(e) {
  e.preventDefault();
  try {
    await api('/api/senha', { method: 'POST', body: { senhaAtual: document.getElementById('senha-atual').value, novaSenha: document.getElementById('senha-nova').value } });
    document.getElementById('senha-atual').value = '';
    document.getElementById('senha-nova').value = '';
    toast('Senha alterada.', 'ok');
  } catch (err) { toast(err.message, 'erro'); }
  return false;
}

/* ── Branding do Gestor ── */

function previewLogo(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    LOGO_PENDENTE = reader.result;
    const prev = document.getElementById('logo-preview-wrap');
    if (prev) prev.innerHTML = `<img src="${LOGO_PENDENTE}" class="logo-preview" alt="logo"><br><small class="hint">Pré-visualização</small>`;
  };
  reader.readAsDataURL(file);
}

async function salvarLogo() {
  if (!LOGO_PENDENTE) return toast('Selecione uma imagem primeiro.', 'erro');
  try {
    await api('/api/empresa/branding', { method: 'PUT', body: { logo: LOGO_PENDENTE } });
    aplicarBranding({ logo: LOGO_PENDENTE });
    LOGO_PENDENTE = null;
    toast('Logo salva com sucesso!', 'ok');
  } catch (err) { toast(err.message, 'erro'); }
}

async function removerLogo() {
  if (!confirm('Remover a logo da empresa?')) return;
  try {
    await api('/api/empresa/branding', { method: 'PUT', body: { logo: null } });
    const prev = document.getElementById('logo-preview-wrap');
    if (prev) prev.innerHTML = '<span class="logo-sem-preview">Nenhuma logo cadastrada</span>';
    aplicarBranding({ logo: null });
    toast('Logo removida.', 'ok');
  } catch (err) { toast(err.message, 'erro'); }
}

function previewCores() {
  const cores = {
    primaria:   document.getElementById('cor-primaria').value,
    secundaria: document.getElementById('cor-secundaria').value,
    destaque:   document.getElementById('cor-destaque').value,
    laranja:    document.getElementById('cor-laranja').value
  };
  aplicarBranding({ cores });
}

async function salvarCores() {
  const cores = {
    primaria:   document.getElementById('cor-primaria').value,
    secundaria: document.getElementById('cor-secundaria').value,
    destaque:   document.getElementById('cor-destaque').value,
    laranja:    document.getElementById('cor-laranja').value
  };
  try {
    await api('/api/empresa/branding', { method: 'PUT', body: { cores } });
    aplicarBranding({ cores });
    toast('Cores aplicadas!', 'ok');
  } catch (err) { toast(err.message, 'erro'); }
}

async function resetarCores() {
  const defaults = { primaria: '#1e5aa8', secundaria: '#14406e', destaque: '#1a8a4c', laranja: '#e8801a' };
  document.getElementById('cor-primaria').value = defaults.primaria;
  document.getElementById('cor-secundaria').value = defaults.secundaria;
  document.getElementById('cor-destaque').value = defaults.destaque;
  document.getElementById('cor-laranja').value = defaults.laranja;
  try {
    await api('/api/empresa/branding', { method: 'PUT', body: { cores: defaults } });
    aplicarBranding({ cores: defaults });
    toast('Cores restauradas ao padrão.', 'ok');
  } catch (err) { toast(err.message, 'erro'); }
}

function renderRecompensas() {
  const cont = document.getElementById('recompensas-lista');
  if (!cont) return;
  const recomp = CONFIG.recompensas || [];
  cont.innerHTML = recomp.map((r, i) => `
    <div class="recomp-row">
      <input type="number" min="1" step="1" placeholder="Pontos" value="${r.pontos}" data-recomp="${i}" data-campo="pontos">
      <input type="text" placeholder="Nome da recompensa" value="${esc(r.nome || '')}" data-recomp="${i}" data-campo="nome">
      <input type="text" placeholder="Descrição" value="${esc(r.descricao || '')}" data-recomp="${i}" data-campo="descricao">
      <button class="btn btn-sm btn-perigo" onclick="removerRecompensa(${i})">✕</button>
    </div>`).join('') || '<p class="hint">Nenhuma recompensa configurada.</p>';
}

function adicionarRecompensa() {
  CONFIG.recompensas = CONFIG.recompensas || [];
  CONFIG.recompensas.push({ pontos: 100, nome: '', descricao: '' });
  renderRecompensas();
}

function removerRecompensa(i) {
  CONFIG.recompensas.splice(i, 1);
  renderRecompensas();
}

function lerRecompensas() {
  const rows = document.querySelectorAll('[data-recomp]');
  const map = {};
  rows.forEach(el => {
    const i = el.dataset.recomp;
    if (!map[i]) map[i] = {};
    map[i][el.dataset.campo] = el.value;
  });
  return Object.values(map).filter(r => r.nome).map(r => ({ ...r, pontos: Number(r.pontos) || 100 }));
}

async function salvarRecompensas() {
  try {
    await api('/api/config/geral', { method: 'PUT', body: { codigoValidade: CONFIG.codigoValidade, recompensas: lerRecompensas() } });
    CONFIG.recompensas = lerRecompensas();
    toast('Recompensas salvas.', 'ok');
  } catch (err) { toast(err.message, 'erro'); }
}

/* ── Painel do Colaborador ── */

async function carregarPainelColaborador() {
  const p = await api('/api/meu-painel');
  CHECKIN_PENDENTE = p.checkinPendente;

  /* ── Nivel & Streak card ── */
  renderNivelCard(p);

  /* ── Missões diárias ── */
  renderMissoesCard(p.missoes || []);

  document.getElementById('colab-cards').innerHTML = `
    <div class="card destaque"><div class="num">${p.pontos}</div><div class="rotulo">Meus pontos</div></div>
    <div class="card"><div class="num">${p.posicao ? p.posicao + 'º' : '—'}</div><div class="rotulo">Ranking (de ${p.totalColaboradores})</div></div>
    <div class="card"><div class="num">${p.ies}</div><div class="rotulo">IES (0-100)</div></div>
    <div class="card card-laranja"><div class="num">${p.totalObs}</div><div class="rotulo">Observações</div></div>
    <div class="card card-roxo"><div class="num">${p.totalSugs}</div><div class="rotulo">Sugestões</div></div>
    <div class="card card-vermelho"><div class="num">${p.historico.length}</div><div class="rotulo">Participações</div></div>
  `;

  let tipos = '<tr><th>Tipo</th><th>Check-ins</th><th>Pontos</th></tr>';
  for (const [tipo, info] of Object.entries(p.porTipo)) {
    if (info.checkins > 0) tipos += `<tr><td>${esc(tipo)}</td><td>${info.checkins}</td><td class="pontos-cel">${info.pontos}</td></tr>`;
  }
  document.getElementById('colab-tipos').innerHTML = tipos;
  document.getElementById('colab-top10').innerHTML = htmlRankingCompacto(p.top10);

  const recomp = CONFIG.recompensas || [];
  const recompEl = document.getElementById('colab-recompensas');
  if (recompEl) {
    recompEl.innerHTML = recomp.length
      ? recomp.map(r => `
          <div class="recompensa-card">
            <div class="pts">${r.pontos} pts</div>
            <div class="nome">${esc(r.nome)}</div>
            <div class="desc">${esc(r.descricao || '')}</div>
          </div>`).join('')
      : '<p class="hint">Nenhuma recompensa configurada ainda.</p>';
  }

  if (p.checkinPendente) {
    mostrarAvisoPendente(p.checkinPendente.checkinId);
  }
}

function renderNivelCard(p) {
  const el = document.getElementById('colab-nivel-card');
  if (!el) return;
  const nivel = p.nivel || {};
  const prox = nivel.proximo || null;
  const streak = p.streakAtual || 0;
  const pct = prox ? Math.min(100, Math.round(((p.pontos - nivel.minPontos) / (prox.minPontos - nivel.minPontos)) * 100)) : 100;

  const banner = document.getElementById('colab-nivel-banner');
  if (p.subiu && banner) {
    banner.classList.remove('hidden');
    banner.innerHTML = `🎉 Parabéns! Você subiu para <strong>${nivel.emoji} ${nivel.nome}</strong>! +${nivel.bonus || 0} pts de bônus!`;
    setTimeout(() => banner.classList.add('hidden'), 6000);
  }

  el.innerHTML = `
    <div class="nivel-header">
      <div class="nivel-emoji">${nivel.emoji || '🔰'}</div>
      <div class="nivel-info">
        <div class="nivel-nome">${esc(nivel.nome || 'Iniciante')}</div>
        <div class="nivel-sub">Nível ${nivel.nivel || 1} de 10</div>
      </div>
      <div class="streak-badge ${streak >= 7 ? 'streak-fire' : ''}">
        🔥 <strong>${streak}</strong> dias
      </div>
    </div>
    <div class="nivel-barra-wrap">
      <div class="nivel-barra" style="width:${pct}%"></div>
    </div>
    <div class="nivel-progresso-label">
      ${prox ? `${p.pontos} / ${prox.minPontos} pts para ${prox.emoji} ${prox.nome}` : '🏆 Nível máximo atingido!'}
    </div>`;
}

function renderMissoesCard(missoes) {
  const el = document.getElementById('colab-missoes-card');
  if (!el) return;
  if (!missoes.length) { el.innerHTML = ''; return; }
  const feitas = missoes.filter(m => m.feita).length;
  el.innerHTML = `
    <h3>⚡ Missões do Dia <span class="hint">(${feitas}/${missoes.length} concluídas)</span></h3>
    <ul class="missoes-lista">
      ${missoes.map(m => `
        <li class="missao-item ${m.feita ? 'concluida' : ''}">
          <span class="missao-check">${m.feita ? '✅' : '⬜'}</span>
          <span class="missao-desc">${esc(m.desc)}</span>
          <span class="missao-pts">+${m.pontos} pts</span>
        </li>`).join('')}
    </ul>`;
}

function mostrarAvisoPendente(checkinId) {
  const el = document.getElementById('checkin-pendente-aviso');
  if (el) {
    el.classList.remove('hidden');
    el.innerHTML = `<div class="aviso-pendente"><strong>⚠ Avaliação pendente!</strong> Você tem um check-in aguardando avaliação. <a href="#" onclick="abrirModalAvaliacao(${checkinId});return false">Avaliar agora para receber seus pontos</a></div>`;
  }
}

async function verificarCheckinPendente() {
  try {
    const r = await api('/api/checkin/pendente');
    if (r.pendente) {
      CHECKIN_PENDENTE = { checkinId: r.checkinId };
      mostrarAvisoPendente(r.checkinId);
      abrirModalAvaliacao(r.checkinId, r.evento);
    }
  } catch { /* ignore */ }
}

/* ── Check-in do colaborador ── */

async function fazerCheckin() {
  const codigo = document.getElementById('checkin-codigo').value.trim();
  if (!codigo) return toast('Insira o código de participação.', 'erro');
  let gps = null;
  if (document.getElementById('checkin-gps').checked) {
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 }));
      gps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch { toast('Não foi possível obter localização. Check-in sem GPS.', ''); }
  }
  try {
    const r = await api('/api/checkin', { method: 'POST', body: { codigo, gps } });
    toast(r.mensagem, 'ok');
    document.getElementById('checkin-codigo').value = '';
    abrirModalAvaliacao(r.checkinId, r.evento);
  } catch (err) { toast(err.message, 'erro'); }
}

function abrirModalAvaliacao(checkinId, evento) {
  AVAL_CHECKIN_ID = checkinId;
  ESTRELAS_SEL = 0;
  selecionarEstrela(0);
  const info = evento ? `${esc(evento.tipo)} — ${esc(evento.tema || '')} (${dataBr(evento.data)})` : '';
  document.getElementById('aval-evento-info').textContent = info;
  ['aval-gostou', 'aval-melhorar', 'aval-temas', 'aval-seguranca', 'aval-livre'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('modal-avaliacao').classList.remove('hidden');
}

function selecionarEstrela(n) {
  ESTRELAS_SEL = n;
  document.querySelectorAll('.estrela').forEach(el => {
    el.classList.toggle('ativa', Number(el.dataset.v) <= n);
  });
  const labels = ['', 'Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente'];
  const lbl = document.getElementById('estrelas-label');
  if (lbl) lbl.textContent = n > 0 ? labels[n] : 'Selecione uma avaliação';
}

async function enviarAvaliacao() {
  if (ESTRELAS_SEL < 1) return toast('Selecione pelo menos 1 estrela para avaliar.', 'erro');
  try {
    const r = await api('/api/checkin/' + AVAL_CHECKIN_ID + '/avaliar', { method: 'POST', body: {
      estrelas: ESTRELAS_SEL,
      gostou: document.getElementById('aval-gostou').value,
      melhorar: document.getElementById('aval-melhorar').value,
      temas: document.getElementById('aval-temas').value,
      seguranca: document.getElementById('aval-seguranca').value,
      livre: document.getElementById('aval-livre').value
    }});
    document.getElementById('modal-avaliacao').classList.add('hidden');
    AVAL_CHECKIN_ID = null;
    CHECKIN_PENDENTE = null;
    const conquistaMsg = r.conquista ? ` Você desbloqueou: ${r.conquista.emoji} ${r.conquista.nome}!` : '';
    toast(`+${r.pontosRecebidos} pontos! Total: ${r.totalPontos} pts.${conquistaMsg}`, 'ok');
    await carregarPainelColaborador();
  } catch (err) { toast(err.message, 'erro'); }
}

/* ── Observações (colaborador) ── */

async function carregarMinhasObservacoes() {
  const list = await api('/api/observacoes/minhas');
  const ptObs = CONFIG.pontos['Registro de Desvio'] || 25;
  const el = document.getElementById('pts-obs');
  if (el) el.textContent = ptObs;
  let h = '<tr><th>Data</th><th>Tipo</th><th>Criticidade</th><th>Status</th></tr>';
  if (!list.length) h += '<tr><td colspan="4" class="vazio">Nenhuma observação registrada ainda.</td></tr>';
  for (const o of list) {
    const stTag = o.status === 'aberta' ? '<span class="tag tag-vermelho">Aberta</span>'
      : o.status === 'em_analise' ? '<span class="tag tag-laranja">Em análise</span>'
      : '<span class="tag tag-verde">Resolvida</span>';
    h += `<tr>
      <td>${tsDataHora(o.criadoEm)}</td>
      <td>${tipoObsTag(o.tipo)}</td>
      <td>${critTag(o.criticidade)}</td>
      <td>${stTag}</td>
    </tr>`;
  }
  document.getElementById('colab-observacoes').innerHTML = h;
}

async function enviarObservacao() {
  const descricao = document.getElementById('obs-desc').value.trim();
  if (!descricao) return toast('Descreva o que foi observado.', 'erro');
  try {
    await api('/api/observacoes', { method: 'POST', body: {
      tipo: document.getElementById('obs-tipo').value,
      criticidade: document.getElementById('obs-crit').value,
      local: document.getElementById('obs-local').value,
      descricao
    }});
    document.getElementById('obs-desc').value = '';
    document.getElementById('obs-local').value = '';
    toast(`Observação registrada! +${CONFIG.pontos['Registro de Desvio'] || 25} pts.`, 'ok');
    await carregarMinhasObservacoes();
    await carregarPainelColaborador();
  } catch (err) { toast(err.message, 'erro'); }
}

/* ── Sugestões (colaborador) ── */

async function carregarMinhasSugestoes() {
  const list = await api('/api/sugestoes/minhas');
  let h = '<tr><th>Data</th><th>Sugestão</th><th>Status</th></tr>';
  if (!list.length) h += '<tr><td colspan="3" class="vazio">Nenhuma sugestão enviada ainda.</td></tr>';
  for (const s of list) {
    const stTag = s.status === 'pendente' ? '<span class="tag tag-laranja">Pendente</span>'
      : s.status === 'aprovada' ? '<span class="tag tag-verde">Aprovada ✓ (+50 pts)</span>'
      : '<span class="tag tag-cinza">Rejeitada</span>';
    h += `<tr>
      <td>${tsDataHora(s.criadoEm)}</td>
      <td>${esc(s.descricao).slice(0, 80)}${s.descricao.length > 80 ? '…' : ''}</td>
      <td>${stTag}${s.comentarioGestor ? `<br><small style="color:var(--texto-suave)">${esc(s.comentarioGestor)}</small>` : ''}</td>
    </tr>`;
  }
  document.getElementById('colab-sugestoes').innerHTML = h;
}

async function enviarSugestao() {
  const descricao = document.getElementById('sug-desc').value.trim();
  if (!descricao) return toast('Descreva a sugestão.', 'erro');
  try {
    await api('/api/sugestoes', { method: 'POST', body: {
      descricao,
      beneficio: document.getElementById('sug-beneficio').value
    }});
    document.getElementById('sug-desc').value = '';
    document.getElementById('sug-beneficio').value = '';
    toast('Sugestão enviada! O gestor irá avaliá-la.', 'ok');
    await carregarMinhasSugestoes();
  } catch (err) { toast(err.message, 'erro'); }
}

/* ── Mural Social ── */

let FEED_POSTS = [];

async function carregarMural() {
  try {
    FEED_POSTS = await api('/api/feed');
    const el = document.getElementById('feed-lista');
    if (!el) return;
    el.innerHTML = FEED_POSTS.length
      ? FEED_POSTS.map(renderFeedPost).join('')
      : '<p class="hint" style="text-align:center;padding:24px">Nenhuma publicação ainda. Seja o primeiro a compartilhar!</p>';
  } catch (err) { toast(err.message, 'erro'); }
}

function renderFeedPost(p) {
  const tipoTag = p.tipo === 'reconhecimento' ? '<span class="tag tag-verde">🤝 Reconhecimento</span>'
    : p.tipo === 'conquista' ? '<span class="tag tag-ouro">⭐ Conquista</span>'
    : p.tipo === 'comunicado' ? '<span class="tag tag-azul">📢 Comunicado</span>'
    : '';
  const total = (p.totalLikes || 0) + (p.totalAplausos || 0) + (p.totalEstrelas || 0);
  return `
    <div class="feed-card">
      <div class="feed-header">
        <div class="feed-avatar">${esc((p.autorNome || '?')[0]).toUpperCase()}</div>
        <div class="feed-meta">
          <strong>${esc(p.autorNome || 'Usuário')}</strong>
          ${tipoTag}
          <span class="feed-ts">${tsDataHora(p.timestamp)}</span>
        </div>
      </div>
      <div class="feed-body">${esc(p.conteudo || '')}</div>
      <div class="feed-footer">
        <button class="btn-reacao ${p.minhasReacoes?.like ? 'ativo' : ''}" onclick="reagirFeed(${p.id},'like')" title="Curtir">👍 ${p.totalLikes || 0}</button>
        <button class="btn-reacao ${p.minhasReacoes?.aplausos ? 'ativo' : ''}" onclick="reagirFeed(${p.id},'aplausos')" title="Palmas">👏 ${p.totalAplausos || 0}</button>
        <button class="btn-reacao ${p.minhasReacoes?.estrela ? 'ativo' : ''}" onclick="reagirFeed(${p.id},'estrela')" title="Destaque">⭐ ${p.totalEstrelas || 0}</button>
        ${total ? `<span class="feed-total-reac">${total} reações</span>` : ''}
      </div>
    </div>`;
}

async function publicarFeed() {
  const txt = document.getElementById('feed-novo-post').value.trim();
  if (!txt) return toast('Escreva algo antes de publicar.', 'erro');
  try {
    await api('/api/feed', { method: 'POST', body: { conteudo: txt } });
    document.getElementById('feed-novo-post').value = '';
    toast('Publicado no mural! 📣', 'ok');
    await carregarMural();
  } catch (err) { toast(err.message, 'erro'); }
}

async function publicarReconhecimento() {
  abrirModal('🤝 Reconhecer Colega', `
    <p class="hint">Reconheça uma boa prática de um colega. Aparece no mural para todos!</p>
    <label>Mensagem de reconhecimento</label>
    <textarea id="rec-msg" style="min-height:80px" placeholder="Ex.: Parabéns ao João pela observação de segurança que evitou um acidente!"></textarea>
    <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="enviarReconhecimento()">Publicar reconhecimento</button>`);
}

async function enviarReconhecimento() {
  const msg = document.getElementById('rec-msg').value.trim();
  if (!msg) return toast('Descreva o reconhecimento.', 'erro');
  try {
    await api('/api/feed', { method: 'POST', body: { conteudo: msg, tipo: 'reconhecimento' } });
    fecharModal();
    toast('Reconhecimento publicado! 🤝', 'ok');
    await navegarColab('mural');
  } catch (err) { toast(err.message, 'erro'); }
}

async function reagirFeed(id, tipo) {
  try {
    await api(`/api/feed/${id}/reagir`, { method: 'POST', body: { tipo } });
    await carregarMural();
  } catch (err) { toast(err.message, 'erro'); }
}

/* ── Comunicados (colaborador) ── */

async function carregarComunicados() {
  try {
    const lista = await api('/api/comunicados');
    const el = document.getElementById('comunicados-lista');
    if (!el) return;
    if (!lista.length) {
      el.innerHTML = '<p class="hint" style="text-align:center;padding:24px">Nenhum comunicado disponível.</p>';
      return;
    }
    el.innerHTML = lista.map(c => `
      <div class="comunicado-card ${c.lido ? 'comunicado-lido' : 'comunicado-novo'}">
        <div class="comunicado-header">
          <span class="tag tag-azul">📢 Comunicado</span>
          <span class="comunicado-data">${tsDataHora(c.criadoEm)}</span>
          ${c.lido
            ? '<span class="tag tag-verde">✓ Confirmado</span>'
            : '<span class="tag tag-laranja">Pendente</span>'}
        </div>
        <h3 class="comunicado-titulo">${esc(c.titulo)}</h3>
        <p class="comunicado-corpo">${esc(c.conteudo)}</p>
        ${!c.lido ? `
          <button class="btn btn-primary" style="margin-top:10px" onclick="confirmarLeitura(${c.id})">
            ✅ Confirmar leitura (+${c.pontosPorLeitura || 10} pts)
          </button>` : ''}
      </div>`).join('');
  } catch (err) { toast(err.message, 'erro'); }
}

async function confirmarLeitura(id) {
  try {
    const r = await api(`/api/comunicados/${id}/confirmar`, { method: 'POST', body: {} });
    toast(`Leitura confirmada! +${r.pontos || 10} pontos 📢`, 'ok');
    await carregarComunicados();
  } catch (err) { toast(err.message, 'erro'); }
}

/* ── Quiz Diário (colaborador) ── */

let QUIZ_HOJE = null;

async function carregarQuiz() {
  const el = document.getElementById('quiz-conteudo');
  if (!el) return;
  try {
    const resp = await api('/api/quiz/hoje');
    const q = resp.quiz;
    QUIZ_HOJE = q;
    if (!q) {
      el.innerHTML = '<div class="panel" style="text-align:center;padding:32px"><div style="font-size:48px">🧠</div><h3>Quiz Diário</h3><p class="hint">Nenhum quiz disponível hoje. O gestor publicará um em breve!</p></div>';
      return;
    }
    if (q.jaRespondeu) {
      const corrIdx = (q.opcoes || []).findIndex(o => o.correta);
      const corrTxt = corrIdx >= 0 ? (q.opcoes[corrIdx].texto || '') : '';
      el.innerHTML = `
        <div class="quiz-card panel">
          <div class="quiz-badge">🧠 Quiz Diário</div>
          <h3>${esc(q.pergunta)}</h3>
          <p class="hint" style="margin-top:8px">Você já respondeu o quiz de hoje.</p>
          <div class="quiz-resultado quiz-neutro">
            Resposta correta: <strong>${String.fromCharCode(65 + corrIdx)}) ${esc(corrTxt)}</strong>
          </div>
          <p class="hint" style="margin-top:10px">Próximo quiz amanhã!</p>
        </div>`;
      return;
    }
    el.innerHTML = `
      <div class="quiz-card panel">
        <div class="quiz-badge">🧠 Quiz Diário — acerte e ganhe +${q.pontosPorAcerto || 20} pontos!</div>
        <h3>${esc(q.pergunta)}</h3>
        <div class="quiz-opcoes">
          ${(q.opcoes || []).map((op, i) => `
            <button class="quiz-opcao-btn" onclick="responderQuiz(${q.id}, ${i})">
              <span class="quiz-letra">${String.fromCharCode(65 + i)}</span>
              ${esc(op.texto || String(op))}
            </button>`).join('')}
        </div>
      </div>`;
  } catch {
    el.innerHTML = '<p class="hint" style="text-align:center;padding:24px">Não foi possível carregar o quiz.</p>';
  }
}

async function responderQuiz(id, opcao) {
  try {
    const r = await api(`/api/quiz/${id}/responder`, { method: 'POST', body: { opcao } });
    const corrTxt = QUIZ_HOJE && QUIZ_HOJE.opcoes
      ? (QUIZ_HOJE.opcoes[r.respostaCorreta]?.texto || String.fromCharCode(65 + r.respostaCorreta))
      : String.fromCharCode(65 + r.respostaCorreta);
    const el = document.getElementById('quiz-conteudo');
    if (el) {
      const card = el.querySelector('.quiz-card');
      if (card) {
        const btns = card.querySelector('.quiz-opcoes');
        if (btns) btns.remove();
        const res = document.createElement('div');
        res.className = `quiz-resultado ${r.correta ? 'quiz-acerto' : 'quiz-erro'}`;
        res.innerHTML = r.correta
          ? `✅ Correto! +${r.pontos} pontos`
          : `❌ Incorreto! A resposta certa era: <strong>${esc(corrTxt)}</strong>`;
        card.appendChild(res);
        const note = document.createElement('p');
        note.className = 'hint';
        note.style.marginTop = '10px';
        note.textContent = 'Próximo quiz amanhã!';
        card.appendChild(note);
      }
    }
    if (r.correta) toast(`Resposta correta! +${r.pontos} pontos 🎯`, 'ok');
    else toast('Resposta incorreta. Não desanime, tente amanhã!', '');
  } catch (err) { toast(err.message, 'erro'); }
}

/* ── Perfil completo (colaborador) ── */

async function carregarPerfil() {
  const el = document.getElementById('perfil-conteudo');
  if (!el) return;
  try {
    const p = await api('/api/meu-painel');
    const c = p.colaborador || {};
    const nivel = p.nivel || {};
    const prox = nivel.proximo || null;
    const streak = p.streakAtual || 0;
    const pct = prox ? Math.min(100, Math.round(((p.pontos - nivel.minPontos) / (prox.minPontos - nivel.minPontos)) * 100)) : 100;

    el.innerHTML = `
      <div class="perfil-hero panel">
        <div class="perfil-avatar">${esc((c.nome || '?')[0]).toUpperCase()}</div>
        <div class="perfil-dados">
          <h2>${esc(c.nome || '')}</h2>
          <p class="hint">${esc(c.funcao || '')} · ${esc(c.setor || '')} · ${esc(c.unidade || '')}</p>
          <p class="hint">Matrícula: ${esc(c.matricula || '')}</p>
          <div class="nivel-badge-grande">
            ${nivel.emoji || '🔰'} <span>${esc(nivel.nome || '')}</span> · Nível ${nivel.nivel || 1}
          </div>
        </div>
      </div>

      <div class="cards" style="margin-top:14px">
        <div class="card destaque"><div class="num">${p.pontos}</div><div class="rotulo">Pontos totais</div></div>
        <div class="card"><div class="num">${p.posicao ? p.posicao + 'º' : '—'}</div><div class="rotulo">Posição no ranking</div></div>
        <div class="card"><div class="num">${streak} 🔥</div><div class="rotulo">Dias seguidos</div></div>
        <div class="card"><div class="num">${p.maiorStreak || 0}</div><div class="rotulo">Recorde de streak</div></div>
        <div class="card"><div class="num">${p.ies || 0}</div><div class="rotulo">IES (0-100)</div></div>
        <div class="card card-laranja"><div class="num">${p.totalObs || 0}</div><div class="rotulo">Observações</div></div>
      </div>

      <div class="panel" style="margin-top:14px">
        <h3>Progresso de nível</h3>
        <div class="nivel-barra-wrap" style="margin-top:12px">
          <div class="nivel-barra" style="width:${pct}%"></div>
        </div>
        <p class="hint" style="margin-top:6px">
          ${prox ? `${p.pontos} / ${prox.minPontos} pts → ${prox.emoji} ${prox.nome}` : '🏆 Nível máximo atingido!'}
        </p>
      </div>

      <div class="panel" style="margin-top:14px">
        <h3>Histórico recente</h3>
        <table class="tabela">
          <tr><th>Data</th><th>Tipo</th><th>Tema</th><th>Pts</th></tr>
          ${(p.historico || []).slice(0, 10).map(ev => `
            <tr>
              <td>${dataBr(ev.timestamp)}</td>
              <td><span class="tag">${esc(ev.tipo)}</span></td>
              <td>${esc(ev.tema)}</td>
              <td class="pontos-cel">${ev.pontos}</td>
            </tr>`).join('') || '<tr><td colspan="4" class="vazio">Nenhuma participação ainda.</td></tr>'}
        </table>
      </div>`;
  } catch {
    el.innerHTML = '<p class="hint" style="text-align:center;padding:24px">Não foi possível carregar o perfil.</p>';
  }
}

/* ── Comunicados (gestor) ── */

async function carregarComunicadosGestor() {
  try {
    const lista = await api('/api/comunicados');
    const el = document.getElementById('comunicados-gestor-lista');
    if (!el) return;
    if (!lista.length) {
      el.innerHTML = '<p class="hint" style="text-align:center;padding:24px">Nenhum comunicado criado ainda. Clique em "+ Novo comunicado" para começar.</p>';
      return;
    }
    el.innerHTML = lista.map(c => `
      <div class="panel" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
          <div>
            <strong>${esc(c.titulo)}</strong>
            <span class="hint" style="margin-left:10px">${tsDataHora(c.criadoEm)} · ${esc(c.gestorNome || '')}</span>
          </div>
          <span class="tag tag-verde">✓ ${c.totalLeituras || 0} confirmações</span>
        </div>
        <p style="margin-top:8px;color:var(--texto-sec);font-size:0.9em">${esc(c.conteudo)}</p>
      </div>`).join('');
  } catch (err) { toast(err.message, 'erro'); }
}

function abrirNovoComunicado() {
  abrirModal('📢 Novo Comunicado', `
    <label>Título *</label>
    <input type="text" id="com-titulo" placeholder="Ex.: Nova NR-12 em vigor a partir de julho">
    <label>Conteúdo do comunicado *</label>
    <textarea id="com-conteudo" style="min-height:120px" placeholder="Digite o conteúdo completo do comunicado..."></textarea>
    <label>Pontos por confirmação de leitura</label>
    <input type="number" id="com-pontos" value="10" min="0" max="100">
    <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="salvarComunicado()">Publicar comunicado</button>`);
}

async function salvarComunicado() {
  const titulo = document.getElementById('com-titulo').value.trim();
  const conteudo = document.getElementById('com-conteudo').value.trim();
  if (!titulo || !conteudo) return toast('Título e conteúdo são obrigatórios.', 'erro');
  const pontosPorLeitura = Number(document.getElementById('com-pontos').value) || 10;
  try {
    await api('/api/comunicados', { method: 'POST', body: { titulo, conteudo, pontosPorLeitura } });
    fecharModal();
    toast('Comunicado publicado!', 'ok');
    await carregarComunicadosGestor();
  } catch (err) { toast(err.message, 'erro'); }
}

/* ── Quiz (gestor) ── */

async function carregarQuizGestor() {
  try {
    const lista = await api('/api/quiz');
    const el = document.getElementById('tabela-quizzes');
    if (!el) return;
    let h = '<tr><th>Data</th><th>Pergunta</th><th>Resposta correta</th><th>Respostas</th><th>% Acerto</th></tr>';
    if (!lista.length) h += '<tr><td colspan="5" class="vazio">Nenhum quiz cadastrado ainda.</td></tr>';
    for (const q of lista) {
      const corrIdx = (q.opcoes || []).findIndex(o => o.correta);
      const corrTxt = corrIdx >= 0 ? (q.opcoes[corrIdx].texto || '') : '';
      const pct = q.totalRespostas ? Math.round((q.acertos / q.totalRespostas) * 100) : 0;
      h += `<tr>
        <td>${q.data || ''}</td>
        <td>${esc(q.pergunta)}</td>
        <td><span class="tag tag-verde">${String.fromCharCode(65 + corrIdx)}) ${esc(corrTxt)}</span></td>
        <td>${q.totalRespostas || 0}</td>
        <td>${pct}%</td>
      </tr>`;
    }
    el.innerHTML = h;
  } catch (err) { toast(err.message, 'erro'); }
}

function abrirNovoQuiz() {
  abrirModal('🧠 Novo Quiz Diário', `
    <p class="hint">O quiz ficará disponível para todos os colaboradores hoje como Quiz Diário.</p>
    <label>Pergunta *</label>
    <input type="text" id="quiz-pergunta" placeholder="Ex.: Qual EPI é obrigatório em área com ruído acima de 85 dB?">
    <label>Opção A *</label><input type="text" id="quiz-op-0" placeholder="Protetor auricular">
    <label>Opção B *</label><input type="text" id="quiz-op-1" placeholder="Capacete">
    <label>Opção C</label><input type="text" id="quiz-op-2">
    <label>Opção D</label><input type="text" id="quiz-op-3">
    <label>Resposta correta</label>
    <select id="quiz-correta">
      <option value="0">Opção A</option>
      <option value="1">Opção B</option>
      <option value="2">Opção C</option>
      <option value="3">Opção D</option>
    </select>
    <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="salvarQuiz()">Publicar quiz</button>`);
}

async function salvarQuiz() {
  const pergunta = document.getElementById('quiz-pergunta').value.trim();
  const textos = [0, 1, 2, 3].map(i => { const el = document.getElementById('quiz-op-' + i); return el ? el.value.trim() : ''; }).filter(Boolean);
  if (!pergunta || textos.length < 2) return toast('Preencha a pergunta e pelo menos 2 opções.', 'erro');
  const corrIdx = Number(document.getElementById('quiz-correta').value);
  const opcoes = textos.map((txt, i) => ({ texto: txt, correta: i === corrIdx }));
  try {
    await api('/api/quiz', { method: 'POST', body: { pergunta, opcoes } });
    fecharModal();
    toast('Quiz publicado para hoje!', 'ok');
    await carregarQuizGestor();
  } catch (err) { toast(err.message, 'erro'); }
}

/* ── Histórico completo ── */

async function carregarHistoricoCompleto() {
  const p = await api('/api/meu-painel');
  let h = '<tr><th>Data/Hora</th><th>Tipo</th><th>Tema</th><th>Pts</th><th>Avaliação</th></tr>';
  if (!p.historico.length) h += '<tr><td colspan="5" class="vazio">Nenhuma participação ainda.</td></tr>';
  for (const ev of p.historico) {
    h += `<tr>
      <td>${tsDataHora(ev.timestamp)}</td>
      <td><span class="tag">${esc(ev.tipo)}</span></td>
      <td>${esc(ev.tema)}</td>
      <td class="pontos-cel">${ev.pontos}</td>
      <td>${ev.avaliado ? '✓' : '<span class="tag tag-laranja">Pendente</span>'}</td>
    </tr>`;
  }
  document.getElementById('colab-historico').innerHTML = h;
}

/* ── Perfil completo do colaborador (gestor) ── */

async function abrirPerfilCompleto(empId) {
  try {
    const p = await api(`/api/colaboradores/${empId}/perfil`);
    const c = p.colaborador;
    const nivel = p.nivel || {};
    const prox = nivel.proximo || null;
    const pct = prox ? Math.min(100, Math.round(((p.pontos - nivel.minPontos) / (prox.minPontos - nivel.minPontos)) * 100)) : 100;

    const extrasHtml = (p.extrasLog || []).slice(0, 15).map(e => `
      <div class="audit-entry">
        <span>${esc(e.descricao)}</span>
        <span class="${e.pontos >= 0 ? 'audit-pts-pos' : 'audit-pts-neg'}">${e.pontos >= 0 ? '+' : ''}${e.pontos}</span>
      </div>`).join('') || '<p class="hint">Nenhum registro.</p>';

    const recHtml = (p.reconhecimentos || []).map(r => `
      <div class="audit-entry"><span>${esc(r.badgeLabel)} — ${esc(r.mensagem)}</span><span class="hint">${tsDataHora(r.timestamp)}</span></div>`
    ).join('') || '<p class="hint">Nenhum reconhecimento ainda.</p>';

    abrirModal(`👤 ${esc(c.nome)}`, `
      <div class="cards" style="margin-bottom:14px">
        <div class="card destaque"><div class="num">${p.pontos}</div><div class="rotulo">Pontos</div></div>
        <div class="card"><div class="num">${nivel.emoji || '🔰'} ${nivel.nivel || 1}</div><div class="rotulo">Nível</div></div>
        <div class="card"><div class="num">${p.streakAtual || 0}🔥</div><div class="rotulo">Streak</div></div>
        <div class="card"><div class="num">${p.totalObs || 0}</div><div class="rotulo">Observações</div></div>
        <div class="card"><div class="num">${p.totalSugs || 0}</div><div class="rotulo">Sugestões</div></div>
        <div class="card"><div class="num">${p.sugsAprovadas || 0}</div><div class="rotulo">Sugs. aprovadas</div></div>
      </div>

      <div class="grid-2" style="margin-bottom:14px">
        <div>
          <p><strong>Matrícula:</strong> ${esc(c.matricula)}</p>
          <p><strong>CPF:</strong> ${esc(c.cpf || '—')}</p>
          <p><strong>Função:</strong> ${esc(c.funcao || '—')}</p>
          <p><strong>Setor:</strong> ${esc(c.setor || '—')}</p>
          <p><strong>Equipe:</strong> ${esc(c.equipe || '—')}</p>
          <p><strong>Unidade:</strong> ${esc(c.unidade || '—')}</p>
          <p><strong>Maior streak:</strong> ${p.maiorStreak || 0} dias</p>
        </div>
        <div>
          <h4 style="margin-bottom:6px">Progresso de nível</h4>
          <div class="nivel-barra-wrap" style="margin-bottom:4px"><div class="nivel-barra" style="width:${pct}%"></div></div>
          <p class="hint">${prox ? `${p.pontos} / ${prox.minPontos} pts → ${prox.emoji} ${prox.nome}` : '🏆 Nível máximo!'}</p>
          <h4 style="margin:10px 0 6px">Últimas participações</h4>
          <table class="tabela" style="font-size:12px">
            <tr><th>Data</th><th>Tipo</th><th>Pts</th></tr>
            ${(p.checkins || []).slice(0, 5).map(ck => `<tr><td>${dataBr(ck.timestamp)}</td><td>${esc(ck.eventTipo)}</td><td class="pontos-cel">${ck.pontos}</td></tr>`).join('') || '<tr><td colspan="3" class="vazio">—</td></tr>'}
          </table>
        </div>
      </div>

      <div class="grid-2">
        <div>
          <h4 style="margin-bottom:8px">Pontos extras / histórico</h4>
          ${extrasHtml}
        </div>
        <div>
          <h4 style="margin-bottom:8px">Reconhecimentos recebidos</h4>
          ${recHtml}
        </div>
      </div>

      <hr style="margin:16px 0;border:none;border-top:1px solid var(--cinza-borda)">
      <h4 style="margin-bottom:10px">⚡ Ajuste de pontos</h4>
      <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
        <div style="flex:1;min-width:80px">
          <label>Pontos (use negativo para remover)</label>
          <input type="number" id="adj-pontos-val" placeholder="Ex: 50 ou -20" style="width:100%">
        </div>
        <div style="flex:2;min-width:160px">
          <label>Motivo</label>
          <input type="text" id="adj-pontos-motivo" placeholder="Ex: Participação extraordinária">
        </div>
        <button class="btn btn-primary" onclick="ajustarPontos(${empId})">Aplicar</button>
      </div>
      <p id="adj-pontos-msg" class="hint" style="margin-top:6px"></p>`);
  } catch (err) { toast(err.message, 'erro'); }
}

async function ajustarPontos(empId) {
  const pontos = Number(document.getElementById('adj-pontos-val').value);
  const motivo = document.getElementById('adj-pontos-motivo').value.trim();
  if (!pontos || isNaN(pontos)) return toast('Informe um valor de pontos.', 'erro');
  try {
    const r = await api(`/api/colaboradores/${empId}/pontos`, { method: 'POST', body: { pontos, motivo } });
    const msg = document.getElementById('adj-pontos-msg');
    if (msg) msg.textContent = `Novo total: ${r.novoTotal} pontos.`;
    document.getElementById('adj-pontos-val').value = '';
    document.getElementById('adj-pontos-motivo').value = '';
    toast(`${pontos > 0 ? '+' : ''}${pontos} pontos aplicados!`, 'ok');
    await carregarColaboradores();
  } catch (err) { toast(err.message, 'erro'); }
}

/* ── Central de Engajamento ── */

let ENG_TAB_ATIVA = 'campanhas';

async function carregarEngajamento() {
  engTab(ENG_TAB_ATIVA);
}

function engTab(qual) {
  ENG_TAB_ATIVA = qual;
  document.querySelectorAll('.eng-tab').forEach(b => b.classList.toggle('active', b.textContent.toLowerCase().includes(qual === 'hall' ? 'campe' : qual === 'batalha' ? 'equipe' : qual === 'reconhecimentos' ? 'reconhec' : qual)));
  ['campanhas', 'desafios', 'reconhecimentos', 'batalha', 'hall'].forEach(t => {
    const el = document.getElementById('eng-' + t);
    if (el) el.classList.toggle('hidden', t !== qual);
  });
  if (qual === 'campanhas')       carregarCampanhas();
  if (qual === 'desafios')        carregarDesafios();
  if (qual === 'reconhecimentos') carregarReconhecimentos();
  if (qual === 'batalha')         carregarBatalhaEquipes();
  if (qual === 'hall')            carregarHallOfChampions();
}

/* Campanhas */
async function carregarCampanhas() {
  try {
    const lista = await api('/api/campanhas');
    const el = document.getElementById('campanhas-lista');
    if (!el) return;
    if (!lista.length) { el.innerHTML = '<p class="hint" style="text-align:center;padding:24px">Nenhuma campanha criada ainda.</p>'; return; }
    const TIPOS = { participacao: '✅ Participação', observacoes: '🔍 Observações', sugestoes: '💡 Sugestões', quiz: '🧠 Quiz', feed: '📣 Mural' };
    el.innerHTML = lista.map(c => `
      <div class="campanha-card panel" style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
          <div>
            <strong>${esc(c.nome)}</strong>
            <span class="tag tag-azul" style="margin-left:8px">${TIPOS[c.tipo] || c.tipo}</span>
            ${c.ativo ? '<span class="tag tag-verde">Ativa</span>' : '<span class="tag tag-inativo">Encerrada</span>'}
          </div>
          <div style="display:flex;gap:6px">
            ${c.ativo ? `<button class="btn btn-sm" onclick="encerrarCampanha(${c.id})">Encerrar</button>` : ''}
            <button class="btn btn-sm btn-perigo" onclick="excluirCampanha(${c.id})">✕</button>
          </div>
        </div>
        <p class="hint" style="margin-top:6px">${esc(c.descricao || '')} ${c.inicio ? `· ${dataBr(c.inicio)} a ${dataBr(c.fim) || '...'}` : ''} ${c.meta ? `· Meta: ${c.meta}` : ''} ${c.pontosBonus ? `· Bônus: ${c.pontosBonus} pts` : ''}</p>
      </div>`).join('');
  } catch (err) { toast(err.message, 'erro'); }
}

function abrirNovaCampanha() {
  abrirModal('🎯 Nova Campanha', `
    <label>Nome *</label>
    <input type="text" id="camp-nome" placeholder="Ex.: SIPAT 2026, Maio Amarelo">
    <label>Tipo de meta</label>
    <select id="camp-tipo">
      <option value="participacao">Participação (check-ins)</option>
      <option value="observacoes">Observações de segurança</option>
      <option value="sugestoes">Sugestões de melhoria</option>
      <option value="quiz">Respostas de quiz</option>
      <option value="feed">Publicações no mural</option>
    </select>
    <label>Descrição</label>
    <textarea id="camp-desc" style="min-height:60px" placeholder="Objetivo da campanha..."></textarea>
    <div class="grid-2">
      <div><label>Data início</label><input type="date" id="camp-ini"></div>
      <div><label>Data fim</label><input type="date" id="camp-fim"></div>
    </div>
    <div class="grid-2">
      <div><label>Meta (quantidade)</label><input type="number" id="camp-meta" min="0" value="0"></div>
      <div><label>Bônus de pontos</label><input type="number" id="camp-bonus" min="0" value="0"></div>
    </div>
    <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="salvarCampanha()">Criar campanha</button>`);
}

async function salvarCampanha() {
  const nome = document.getElementById('camp-nome').value.trim();
  if (!nome) return toast('Nome obrigatório.', 'erro');
  try {
    await api('/api/campanhas', { method: 'POST', body: {
      nome, tipo: document.getElementById('camp-tipo').value,
      descricao: document.getElementById('camp-desc').value,
      inicio: document.getElementById('camp-ini').value,
      fim: document.getElementById('camp-fim').value,
      meta: Number(document.getElementById('camp-meta').value),
      pontosBonus: Number(document.getElementById('camp-bonus').value)
    }});
    fecharModal();
    toast('Campanha criada!', 'ok');
    await carregarCampanhas();
  } catch (err) { toast(err.message, 'erro'); }
}

async function encerrarCampanha(id) {
  try {
    await api(`/api/campanhas/${id}`, { method: 'PUT', body: { ativo: false } });
    toast('Campanha encerrada.', 'ok');
    await carregarCampanhas();
  } catch (err) { toast(err.message, 'erro'); }
}

async function excluirCampanha(id) {
  if (!confirm('Excluir esta campanha?')) return;
  try {
    await api(`/api/campanhas/${id}`, { method: 'DELETE' });
    await carregarCampanhas();
  } catch (err) { toast(err.message, 'erro'); }
}

/* Desafios */
async function carregarDesafios() {
  try {
    const lista = await api('/api/desafios');
    const el = document.getElementById('desafios-lista');
    if (!el) return;
    if (!lista.length) { el.innerHTML = '<p class="hint" style="text-align:center;padding:24px">Nenhum desafio criado ainda.</p>'; return; }
    const TIPOS = { checkin: '✅ Check-in', observacoes: '🔍 Observações', sugestoes: '💡 Sugestões', quiz: '🧠 Quiz', feed: '📣 Mural' };
    el.innerHTML = lista.map(d => `
      <div class="panel" style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div>
            <strong>${esc(d.nome)}</strong>
            <span class="tag tag-azul" style="margin-left:8px">${TIPOS[d.tipo] || d.tipo}</span>
          </div>
          <button class="btn btn-sm" onclick="verProgressoDesafio(${d.id})">Ver progresso</button>
        </div>
        <p class="hint" style="margin-top:4px">${esc(d.descricao || '')} · Meta: ${d.metaValor} · +${d.pontosRecompensa} pts · ${dataBr(d.semanaInicio)} a ${dataBr(d.semanaFim)}</p>
      </div>`).join('');
  } catch (err) { toast(err.message, 'erro'); }
}

function abrirNovoDesafio() {
  const hoje = new Date().toISOString().slice(0, 10);
  const dom = new Date(); dom.setDate(dom.getDate() + (7 - dom.getDay()));
  const fimSemana = dom.toISOString().slice(0, 10);
  abrirModal('⚡ Novo Desafio da Semana', `
    <label>Nome *</label>
    <input type="text" id="des-nome" placeholder="Ex.: Registre uma observação esta semana">
    <label>Descrição</label>
    <textarea id="des-desc" style="min-height:60px" placeholder="Detalhe do desafio..."></textarea>
    <label>Tipo de ação</label>
    <select id="des-tipo">
      <option value="checkin">Participar de DDS/Treinamento</option>
      <option value="observacoes">Registrar observação de segurança</option>
      <option value="sugestoes">Enviar sugestão de melhoria</option>
      <option value="quiz">Responder quiz diário</option>
      <option value="feed">Publicar no mural</option>
    </select>
    <div class="grid-2">
      <div><label>Meta (quantidade)</label><input type="number" id="des-meta" min="1" value="1"></div>
      <div><label>Pontos de recompensa</label><input type="number" id="des-pts" min="0" value="50"></div>
    </div>
    <div class="grid-2">
      <div><label>Início</label><input type="date" id="des-ini" value="${hoje}"></div>
      <div><label>Fim</label><input type="date" id="des-fim" value="${fimSemana}"></div>
    </div>
    <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="salvarDesafio()">Criar desafio</button>`);
}

async function salvarDesafio() {
  const nome = document.getElementById('des-nome').value.trim();
  if (!nome) return toast('Nome obrigatório.', 'erro');
  try {
    await api('/api/desafios', { method: 'POST', body: {
      nome, descricao: document.getElementById('des-desc').value,
      tipo: document.getElementById('des-tipo').value,
      metaValor: Number(document.getElementById('des-meta').value),
      pontosRecompensa: Number(document.getElementById('des-pts').value),
      semanaInicio: document.getElementById('des-ini').value,
      semanaFim: document.getElementById('des-fim').value
    }});
    fecharModal();
    toast('Desafio criado!', 'ok');
    await carregarDesafios();
  } catch (err) { toast(err.message, 'erro'); }
}

async function verProgressoDesafio(id) {
  try {
    const r = await api(`/api/desafios/${id}/progresso`);
    const rows = r.progresso.map(p => `<tr><td>${esc(p.nome)}</td><td>${esc(p.equipe)}</td><td>${p.valor}/${p.meta}</td><td>${p.concluido ? '<span class="tag tag-verde">✅ Concluído</span>' : '<span class="tag tag-laranja">Em andamento</span>'}</td></tr>`).join('');
    abrirModal(`⚡ Progresso — ${esc(r.desafio.nome)}`, `
      <p class="hint">${r.concluidos} de ${r.progresso.length} colaboradores concluíram este desafio.</p>
      <table class="tabela"><tr><th>Colaborador</th><th>Equipe</th><th>Progresso</th><th>Status</th></tr>${rows}</table>`);
  } catch (err) { toast(err.message, 'erro'); }
}

/* Reconhecimentos */
async function carregarReconhecimentos() {
  try {
    const lista = await api('/api/reconhecimentos');
    const el = document.getElementById('reconhecimentos-lista');
    if (!el) return;
    if (!lista.length) { el.innerHTML = '<p class="hint" style="text-align:center;padding:24px">Nenhum reconhecimento publicado ainda.</p>'; return; }
    el.innerHTML = lista.map(r => `
      <div class="panel" style="margin-bottom:10px;border-left:4px solid var(--verde)">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-size:28px">${r.badgeLabel ? r.badgeLabel.split(' ')[0] : '🌟'}</div>
          <div>
            <strong>${esc(r.badgeLabel || 'Reconhecimento')}</strong>
            <span style="margin-left:8px;font-weight:700;color:var(--azul)">${esc(r.homenageadoNome)}</span>
            <span class="hint" style="margin-left:8px">por ${esc(r.gestorNome)} · ${tsDataHora(r.timestamp)}</span>
          </div>
        </div>
        ${r.mensagem ? `<p style="margin-top:8px;font-size:13px;color:var(--texto-sec)">${esc(r.mensagem)}</p>` : ''}
      </div>`).join('');
  } catch (err) { toast(err.message, 'erro'); }
}

function abrirNovoReconhecimento() {
  const opts = COLABORADORES.filter(c => c.ativo !== false).map(c => `<option value="${c.id}">${esc(c.nome)} (${esc(c.matricula)})</option>`).join('');
  abrirModal('🏆 Reconhecimento Público', `
    <label>Colaborador homenageado *</label>
    <select id="rec-hom">${opts || '<option value="">Nenhum colaborador cadastrado</option>'}</select>
    <label>Tipo de badge</label>
    <select id="rec-badge">
      <option value="destaque_mes">🏆 Destaque do Mês</option>
      <option value="heroi_seguranca">🛡 Herói da Segurança</option>
      <option value="inovador">💡 Inovador</option>
      <option value="persistencia">💪 Persistência</option>
    </select>
    <label>Mensagem *</label>
    <textarea id="rec-msg-g" style="min-height:80px" placeholder="Descreva a conquista ou comportamento reconhecido..."></textarea>
    <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="salvarReconhecimento()">Publicar reconhecimento</button>`);
}

async function salvarReconhecimento() {
  const homenageadoId = Number(document.getElementById('rec-hom').value);
  const mensagem = document.getElementById('rec-msg-g').value.trim();
  if (!homenageadoId || !mensagem) return toast('Selecione o colaborador e escreva a mensagem.', 'erro');
  try {
    await api('/api/reconhecimentos', { method: 'POST', body: { homenageadoId, tipoBadge: document.getElementById('rec-badge').value, mensagem } });
    fecharModal();
    toast('Reconhecimento publicado no mural! 🏆', 'ok');
    await carregarReconhecimentos();
  } catch (err) { toast(err.message, 'erro'); }
}

/* Batalha de Equipes */
async function carregarBatalhaEquipes() {
  try {
    const equipes = await api('/api/batalha-equipes');
    const el = document.getElementById('batalha-lista');
    if (!el) return;
    if (!equipes.length) { el.innerHTML = '<p class="hint" style="text-align:center;padding:24px">Nenhuma equipe cadastrada ainda. Adicione o campo "Equipe" nos colaboradores.</p>'; return; }
    const maxPts = equipes[0]?.pontos || 1;
    el.innerHTML = equipes.map(eq => {
      const pct = Math.round((eq.pontos / maxPts) * 100);
      const medalha = eq.posicao === 1 ? '🥇' : eq.posicao === 2 ? '🥈' : eq.posicao === 3 ? '🥉' : `${eq.posicao}º`;
      return `
        <div class="equipe-row">
          <div style="display:flex;align-items:center;gap:16px">
            <div style="font-size:28px;width:40px;text-align:center">${medalha}</div>
            <div style="flex:1">
              <div class="equipe-nome">${esc(eq.equipe)}</div>
              <div class="equipe-membros">${eq.membros.length} membros: ${eq.membros.slice(0, 5).map(m => esc(m.nome)).join(', ')}${eq.membros.length > 5 ? '...' : ''}</div>
              <div class="nivel-barra-wrap" style="margin-top:6px"><div class="nivel-barra" style="width:${pct}%"></div></div>
            </div>
            <div class="equipe-pts">${eq.pontos.toLocaleString('pt-BR')}<div style="font-size:11px;color:var(--texto-suave);font-weight:400">pontos</div></div>
          </div>
        </div>`;
    }).join('');
  } catch (err) { toast(err.message, 'erro'); }
}

/* Hall of Champions */
async function carregarHallOfChampions() {
  try {
    const h = await api('/api/hall-of-champions');
    const el = document.getElementById('hall-conteudo');
    if (!el) return;
    const top10Html = h.top10.map((r, i) => {
      const medalha = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${r.posicao}º`;
      return `<div class="champion-card"><div class="champion-pos">${medalha}</div><div class="champion-nome">${esc(r.nome)}</div><div style="font-size:12px;opacity:.8;margin-top:2px">${r.conquista ? r.conquista.emoji + ' ' + r.conquista.nome : '—'}</div><div class="champion-pts">${r.pontos.toLocaleString('pt-BR')}<span style="font-size:12px;font-weight:400;opacity:.8"> pts</span></div></div>`;
    }).join('');

    const top10EqHtml = h.top10Equipes.map((eq, i) => {
      const medalha = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${eq.posicao}º`;
      return `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #f0f3f7"><span style="font-size:20px;width:32px">${medalha}</span><span style="flex:1;font-weight:700">${esc(eq.equipe)}</span><span class="pontos-cel">${eq.pontos.toLocaleString('pt-BR')} pts</span></div>`;
    }).join('') || '<p class="hint">Nenhuma equipe cadastrada.</p>';

    const NIVEL_NOMES = ['', 'Iniciante', 'Observador', 'Protetor', 'Inspiração', 'Agente', 'Guardião Op.', 'Embaixador', 'Mestre', 'Lenda', 'Guardião Sup.'];
    const NIVEL_EMOJIS = ['', '🔰', '👀', '🛡️', '⭐', '⚡', '🏅', '👑', '🔥', '💎', '🏆'];
    const totalEmps = Object.values(h.nivelDist).reduce((a, b) => a + b, 0) || 1;
    const nivelDistHtml = Object.entries(h.nivelDist).map(([n, cnt]) => {
      const pct = Math.round((cnt / totalEmps) * 100);
      return `<div class="ics-dimensao-linha"><span class="ics-dimensao-nome">${NIVEL_EMOJIS[n]} N${n} ${NIVEL_NOMES[n]}</span><div class="ics-dimensao-barra-wrap"><div class="ics-dimensao-barra" style="width:${pct}%"></div></div><span class="ics-dimensao-valor">${cnt}</span></div>`;
    }).join('');

    el.innerHTML = `
      <h3 style="margin-bottom:14px">🏆 Top 10 Colaboradores — Todos os Tempos</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:24px">${top10Html || '<p class="hint">Nenhum dado.</p>'}</div>
      <div class="grid-2">
        <div class="panel">
          <h3 style="margin-bottom:12px">🏅 Top 10 Equipes</h3>
          ${top10EqHtml}
        </div>
        <div class="panel">
          <h3 style="margin-bottom:12px">📊 Distribuição de Níveis</h3>
          ${nivelDistHtml}
        </div>
      </div>`;
  } catch (err) { toast(err.message, 'erro'); }
}

/* ── Pesquisas (gestor) ── */

async function carregarPesquisasGestor() {
  try {
    const lista = await api('/api/pesquisas');
    const el = document.getElementById('tabela-pesquisas');
    if (!el) return;
    let h = '<tr><th>Título</th><th>Perguntas</th><th>Respostas</th><th>Status</th><th></th></tr>';
    if (!lista.length) h += '<tr><td colspan="5" class="vazio">Nenhuma pesquisa criada ainda.</td></tr>';
    for (const p of lista) {
      h += `<tr>
        <td><strong>${esc(p.titulo)}</strong><br><span class="hint">${esc(p.descricao || '')}</span></td>
        <td>${p.totalPerguntas || (p.perguntas || []).length}</td>
        <td>${p.totalRespostas || 0}</td>
        <td>${p.ativo ? '<span class="tag tag-verde">Ativa</span>' : '<span class="tag tag-inativo">Encerrada</span>'}</td>
        <td class="acoes">
          <button class="btn btn-sm" onclick="verResultados(${p.id})">Resultados</button>
          ${p.ativo ? `<button class="btn btn-sm" onclick="encerrarPesquisa(${p.id})">Encerrar</button>` : ''}
        </td>
      </tr>`;
    }
    el.innerHTML = h;
  } catch (err) { toast(err.message, 'erro'); }
}

let PERGUNTAS_FORM = [];

function abrirNovaPesquisa() {
  PERGUNTAS_FORM = [];
  abrirModal('📋 Nova Pesquisa', `
    <label>Título *</label>
    <input type="text" id="pes-titulo" placeholder="Ex.: Pesquisa de Clima 2026">
    <label>Descrição</label>
    <textarea id="pes-desc" style="min-height:60px" placeholder="Contexto e objetivo da pesquisa..."></textarea>
    <div style="display:flex;justify-content:space-between;align-items:center;margin:14px 0 8px">
      <h4 style="margin:0">Perguntas</h4>
      <button class="btn btn-sm btn-primary" onclick="adicionarPergunta()">+ Pergunta</button>
    </div>
    <div id="perguntas-form-lista"></div>
    <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="salvarPesquisa()">Publicar pesquisa</button>`);
  adicionarPergunta();
}

function adicionarPergunta() {
  const id = Date.now();
  PERGUNTAS_FORM.push(id);
  const el = document.getElementById('perguntas-form-lista');
  if (!el) return;
  const div = document.createElement('div');
  div.className = 'pergunta-row';
  div.id = 'perg-' + id;
  div.innerHTML = `
    <select id="perg-tipo-${id}">
      <option value="escala">Escala 1-5</option>
      <option value="sim_nao">Sim / Não</option>
      <option value="aberta">Resposta livre</option>
    </select>
    <input type="text" id="perg-txt-${id}" placeholder="Texto da pergunta *">
    <button class="btn btn-sm btn-perigo" onclick="removerPergunta(${id})">✕</button>`;
  el.appendChild(div);
}

function removerPergunta(id) {
  PERGUNTAS_FORM = PERGUNTAS_FORM.filter(x => x !== id);
  const el = document.getElementById('perg-' + id);
  if (el) el.remove();
}

async function salvarPesquisa() {
  const titulo = document.getElementById('pes-titulo').value.trim();
  if (!titulo) return toast('Título obrigatório.', 'erro');
  const perguntas = PERGUNTAS_FORM.map(id => ({
    texto: (document.getElementById('perg-txt-' + id) || {}).value?.trim() || '',
    tipo: (document.getElementById('perg-tipo-' + id) || {}).value || 'escala'
  })).filter(p => p.texto);
  if (!perguntas.length) return toast('Adicione ao menos uma pergunta.', 'erro');
  try {
    await api('/api/pesquisas', { method: 'POST', body: { titulo, descricao: document.getElementById('pes-desc').value, perguntas } });
    fecharModal();
    toast('Pesquisa publicada!', 'ok');
    await carregarPesquisasGestor();
  } catch (err) { toast(err.message, 'erro'); }
}

async function verResultados(id) {
  try {
    const r = await api(`/api/pesquisas/${id}/resultados`);
    const area = document.getElementById('pesquisa-resultados-area');
    if (!area) return;
    area.classList.remove('hidden');
    area.innerHTML = `
      <div class="panel">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <h3>${esc(r.pesquisa.titulo)} — Resultados</h3>
          <span class="hint">${r.totalRespostas} resposta(s)</span>
        </div>
        ${r.resultados.map(perg => {
          let detHtml = '';
          if (perg.tipo === 'escala') {
            const dist = perg.distribuicao || {};
            const maxVal = Math.max(...Object.values(dist), 1);
            detHtml = `<p class="hint">Média: <strong>${perg.media || '—'}</strong> / 5</p>` +
              [1,2,3,4,5].map(n => {
                const cnt = dist[n] || 0;
                const pct = Math.round((cnt / maxVal) * 100);
                return `<div class="survey-barra-wrap"><span class="survey-barra-label">${n} ⭐ (${cnt})</span><div class="survey-barra" style="width:${pct}%;max-width:200px"></div></div>`;
              }).join('');
          } else if (perg.tipo === 'sim_nao') {
            const total = (perg.sim || 0) + (perg.nao || 0) || 1;
            detHtml = `<div class="survey-barra-wrap"><span class="survey-barra-label">Sim (${perg.sim || 0})</span><div class="survey-barra" style="width:${Math.round(((perg.sim||0)/total)*100)}%;max-width:200px;background:var(--verde)"></div></div>
            <div class="survey-barra-wrap"><span class="survey-barra-label">Não (${perg.nao || 0})</span><div class="survey-barra" style="width:${Math.round(((perg.nao||0)/total)*100)}%;max-width:200px;background:var(--vermelho)"></div></div>`;
          } else {
            detHtml = (perg.textos || []).map(t => `<div class="audit-entry"><span>${esc(t)}</span></div>`).join('') || '<p class="hint">Sem respostas abertas ainda.</p>';
          }
          return `<div style="margin-bottom:16px;padding:12px;background:#f8fafc;border-radius:8px"><p style="font-weight:600;margin-bottom:6px">${esc(perg.texto)}</p>${detHtml}</div>`;
        }).join('')}
      </div>`;
    area.scrollIntoView({ behavior: 'smooth' });
  } catch (err) { toast(err.message, 'erro'); }
}

async function encerrarPesquisa(id) {
  if (!confirm('Encerrar esta pesquisa? Os colaboradores não poderão mais responder.')) return;
  try {
    await api(`/api/pesquisas/${id}`, { method: 'PUT', body: { ativo: false } });
    toast('Pesquisa encerrada.', 'ok');
    await carregarPesquisasGestor();
  } catch (err) { toast(err.message, 'erro'); }
}

/* ── Pesquisas (colaborador) ── */

async function carregarPesquisasColab() {
  const el = document.getElementById('pesquisas-colab-lista');
  if (!el) return;
  try {
    const lista = await api('/api/pesquisas/ativas');
    if (!lista.length) {
      el.innerHTML = '<div class="panel" style="text-align:center;padding:32px"><div style="font-size:48px">📋</div><h3>Nenhuma pesquisa ativa</h3><p class="hint">Fique atento! Novas pesquisas aparecerão aqui.</p></div>';
      return;
    }
    el.innerHTML = lista.map(p => `
      <div class="panel pesquisa-colab-card" id="pesq-card-${p.id}" style="margin-bottom:14px">
        <h3>${esc(p.titulo)}</h3>
        ${p.descricao ? `<p class="hint">${esc(p.descricao)}</p>` : ''}
        <div id="pesq-form-${p.id}">
          ${p.perguntas.map(perg => `
            <div style="margin-bottom:14px">
              <p style="font-weight:600;margin-bottom:6px">${esc(perg.texto)}</p>
              ${perg.tipo === 'escala' ? `
                <div class="quiz-opcoes" style="flex-direction:row;flex-wrap:wrap">
                  ${[1,2,3,4,5].map(n => `<button class="quiz-opcao-btn escala-btn" onclick="selecionarEscala(${p.id},${perg.id},${n},this)" data-perg="${perg.id}" data-val="${n}" style="min-width:60px"><span class="quiz-letra">${n}</span></button>`).join('')}
                  <span style="font-size:11px;align-self:center;color:var(--texto-suave)">1=Discordo · 5=Concordo</span>
                </div>` :
              perg.tipo === 'sim_nao' ? `
                <div style="display:flex;gap:8px">
                  <button class="quiz-opcao-btn simnao-btn" onclick="selecionarSimNao(${p.id},${perg.id},'sim',this)" data-perg="${perg.id}" data-val="sim">✅ Sim</button>
                  <button class="quiz-opcao-btn simnao-btn" onclick="selecionarSimNao(${p.id},${perg.id},'nao',this)" data-perg="${perg.id}" data-val="nao">❌ Não</button>
                </div>` :
              `<textarea class="aberta-resp" data-perg="${perg.id}" placeholder="Sua resposta..." style="width:100%;min-height:70px;margin-top:4px"></textarea>`}
            </div>`).join('')}
          <button class="btn btn-primary btn-block" onclick="enviarPesquisa(${p.id})">Enviar respostas (+15 pts)</button>
        </div>
      </div>`).join('');
    // Track selected values
    window._pesqRespostas = {};
  } catch (err) {
    el.innerHTML = '<p class="hint" style="text-align:center;padding:24px">Não foi possível carregar as pesquisas.</p>';
  }
}

function selecionarEscala(pesqId, pergId, val, btn) {
  document.querySelectorAll(`#pesq-form-${pesqId} .escala-btn[data-perg="${pergId}"]`).forEach(b => b.classList.remove('quiz-acerto'));
  btn.classList.add('quiz-acerto');
  if (!window._pesqRespostas) window._pesqRespostas = {};
  if (!window._pesqRespostas[pesqId]) window._pesqRespostas[pesqId] = {};
  window._pesqRespostas[pesqId][pergId] = val;
}

function selecionarSimNao(pesqId, pergId, val, btn) {
  document.querySelectorAll(`#pesq-form-${pesqId} .simnao-btn[data-perg="${pergId}"]`).forEach(b => b.classList.remove('quiz-acerto'));
  btn.classList.add('quiz-acerto');
  if (!window._pesqRespostas) window._pesqRespostas = {};
  if (!window._pesqRespostas[pesqId]) window._pesqRespostas[pesqId] = {};
  window._pesqRespostas[pesqId][pergId] = val;
}

async function enviarPesquisa(pesqId) {
  const formEl = document.getElementById('pesq-form-' + pesqId);
  if (!formEl) return;
  const respostas = [];
  const selecionadas = window._pesqRespostas?.[pesqId] || {};
  formEl.querySelectorAll('[data-perg]').forEach(el => {
    const pid = Number(el.dataset.perg);
    if (selecionadas[pid] !== undefined && !respostas.find(r => r.perguntaId === pid)) {
      respostas.push({ perguntaId: pid, valor: selecionadas[pid] });
    }
  });
  formEl.querySelectorAll('.aberta-resp').forEach(el => {
    const pid = Number(el.dataset.perg);
    const val = el.value.trim();
    if (val) respostas.push({ perguntaId: pid, valor: val });
  });
  try {
    await api(`/api/pesquisas/${pesqId}/responder`, { method: 'POST', body: { respostas } });
    const card = document.getElementById('pesq-card-' + pesqId);
    if (card) card.innerHTML = `<div style="text-align:center;padding:20px"><span style="font-size:40px">✅</span><h3 style="margin-top:8px">Obrigado pela sua resposta!</h3><p class="hint">+15 pontos adicionados.</p></div>`;
    toast('Pesquisa respondida! +15 pontos 📋', 'ok');
  } catch (err) { toast(err.message, 'erro'); }
}

/* ── Quem é Quem ── */

let QEQ_LISTA = [];

async function carregarQuemEQuem() {
  QEQ_LISTA = await api('/api/quem-e-quem').catch(() => []);
  filtrarQuemEQuem();
}

function filtrarQuemEQuem() {
  const busca = (document.getElementById('qeq-busca')?.value || '').toLowerCase();
  const role  = document.getElementById('qeq-role-filtro')?.value || '';
  const el    = document.getElementById('qeq-grid');
  if (!el) return;
  let lista = QEQ_LISTA;
  if (role)  lista = lista.filter(p => p.roles.includes(role));
  if (busca) lista = lista.filter(p => [p.nome, p.funcao, p.setor, p.equipe].join(' ').toLowerCase().includes(busca));
  el.innerHTML = lista.length
    ? lista.map(p => renderQeqCard(p)).join('')
    : '<p class="hint" style="padding:24px;text-align:center">Nenhum resultado encontrado.</p>';
}

function renderQeqCard(p) {
  const avatarBg = p.roles.includes('sesmt') ? 'var(--azul)' : p.roles.includes('cipa') ? '#e8801a' : p.roles.includes('brigada') ? '#c43a3a' : 'var(--cinza-borda)';
  const initial = (p.nome || '?').charAt(0).toUpperCase();
  return `<div class="qeq-card">
    <div class="qeq-avatar" style="background:${avatarBg}">${initial}</div>
    <div class="qeq-info">
      <div class="qeq-nome">${esc(p.nome)}</div>
      <div class="qeq-funcao hint">${esc(p.funcao || p.setor || '—')}</div>
      ${p.equipe ? `<div class="hint" style="font-size:11px">${esc(p.equipe)}</div>` : ''}
      <div class="qeq-roles" style="margin-top:6px">${renderRoleBadges(p.roles)}</div>
    </div>
  </div>`;
}

/* ── Quem é Quem (colaborador) ── */

let CQEQ_LISTA = [];

async function carregarQuemEQuemColab() {
  CQEQ_LISTA = await api('/api/quem-e-quem').catch(() => []);
  filtrarQuemEQuemColab();
}

function filtrarQuemEQuemColab() {
  const busca = (document.getElementById('cqeq-busca')?.value || '').toLowerCase();
  const role  = document.getElementById('cqeq-role-filtro')?.value || '';
  const el    = document.getElementById('cqeq-grid');
  if (!el) return;
  let lista = CQEQ_LISTA;
  if (role)  lista = lista.filter(p => p.roles.includes(role));
  if (busca) lista = lista.filter(p => [p.nome, p.funcao, p.setor, p.equipe].join(' ').toLowerCase().includes(busca));
  el.innerHTML = lista.length
    ? lista.map(p => renderQeqCard(p)).join('')
    : '<p class="hint" style="padding:24px;text-align:center">Nenhum resultado encontrado.</p>';
}

/* ── Papéis de Segurança (gestor) ── */

let ROLES_COLABORADORES = [];

async function carregarRoles() {
  ROLES_COLABORADORES = COLABORADORES.length ? COLABORADORES : await api('/api/colaboradores').catch(() => []);
  renderOrganograma();
  filtrarColabRoles();
}

function renderOrganograma() {
  const el = document.getElementById('organograma-wrap');
  if (!el) return;
  const grupos = {
    sesmt:             { label: '🦺 SESMT', cor: 'var(--azul)', membros: [] },
    cipa:              { label: '⚠️ CIPA', cor: '#e8801a', membros: [] },
    brigada:           { label: '🚒 Brigada de Emergência', cor: '#c43a3a', membros: [] },
    tecnico_seguranca: { label: '🔧 Técnico de Segurança', cor: '#637080', membros: [] },
    medico_trabalho:   { label: '🩺 Médico do Trabalho',  cor: '#1a8a4c', membros: [] },
    ergonomista:       { label: '🪑 Ergonomista',          cor: '#7b5ea7', membros: [] }
  };
  for (const c of ROLES_COLABORADORES) {
    for (const role of (c.roles || [])) {
      if (grupos[role]) grupos[role].membros.push(c);
    }
  }
  const ativos = Object.entries(grupos).filter(([, g]) => g.membros.length);
  if (!ativos.length) {
    el.innerHTML = '<p class="hint" style="text-align:center;padding:16px">Nenhum papel atribuído ainda. Utilize a seção abaixo para atribuir papéis aos colaboradores.</p>';
    return;
  }
  el.innerHTML = `<div class="organograma-grid">${ativos.map(([key, g]) => `
    <div class="org-grupo">
      <div class="org-grupo-header" style="background:${g.cor}">${g.label}</div>
      <div class="org-grupo-membros">
        ${g.membros.map(m => `<div class="org-membro"><span class="org-membro-nome">${esc(m.nome)}</span><span class="hint" style="font-size:11px">${esc(m.funcao || m.setor || '')}</span></div>`).join('')}
      </div>
    </div>`).join('')}
  </div>`;
}

function filtrarColabRoles() {
  const busca = (document.getElementById('roles-busca')?.value || '').toLowerCase();
  const el = document.getElementById('roles-lista');
  if (!el) return;
  const lista = ROLES_COLABORADORES.filter(c => !busca || c.nome.toLowerCase().includes(busca) || (c.matricula || '').toLowerCase().includes(busca));
  if (!lista.length) { el.innerHTML = '<p class="hint" style="padding:16px;text-align:center">Nenhum colaborador encontrado.</p>'; return; }
  const ROLE_LIST = ['sesmt', 'cipa', 'brigada', 'tecnico_seguranca', 'medico_trabalho', 'ergonomista'];
  el.innerHTML = `<table class="tabela">
    <thead><tr><th>Colaborador</th><th>Matrícula</th><th>Função</th><th>Papéis atuais</th><th>Atribuir / Remover</th></tr></thead>
    <tbody>${lista.map(c => `
      <tr>
        <td>${esc(c.nome)}</td>
        <td>${esc(c.matricula)}</td>
        <td>${esc(c.funcao || c.setor || '—')}</td>
        <td>${renderRoleBadges(c.roles || []) || '<span class="hint">—</span>'}</td>
        <td>
          <select id="role-sel-${c.id}" style="width:180px">
            ${ROLE_LIST.map(r => `<option value="${r}">${ROLE_EMOJIS[r]} ${ROLE_LABELS[r]}</option>`).join('')}
          </select>
          <button class="btn btn-sm btn-primary" onclick="atribuirRole(${c.id})" style="margin-left:4px">+ Atribuir</button>
          <button class="btn btn-sm btn-perigo" onclick="removerRolePrompt(${c.id})" style="margin-left:4px" ${!(c.roles && c.roles.length) ? 'disabled' : ''}>− Remover</button>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

async function atribuirRole(empId) {
  const sel = document.getElementById('role-sel-' + empId);
  if (!sel) return;
  try {
    await api(`/api/usuarios/${empId}/roles`, { method: 'POST', body: { role: sel.value } });
    toast(`Papel ${ROLE_LABELS[sel.value] || sel.value} atribuído!`, 'ok');
    ROLES_COLABORADORES = await api('/api/colaboradores').catch(() => ROLES_COLABORADORES);
    renderOrganograma();
    filtrarColabRoles();
  } catch (err) { toast(err.message, 'erro'); }
}

async function removerRolePrompt(empId) {
  const colab = ROLES_COLABORADORES.find(c => c.id === empId);
  if (!colab || !colab.roles || !colab.roles.length) return;
  const roles = colab.roles;
  const opcoes = roles.map((r, i) => `${i + 1}. ${ROLE_EMOJIS[r]} ${ROLE_LABELS[r] || r}`).join('\n');
  const resp = prompt(`Qual papel deseja remover de ${colab.nome}?\n${opcoes}\n\nDigite o número:`);
  if (!resp) return;
  const idx = parseInt(resp) - 1;
  if (isNaN(idx) || idx < 0 || idx >= roles.length) { toast('Opção inválida.', 'erro'); return; }
  const roleToRemove = roles[idx];
  try {
    await api(`/api/usuarios/${empId}/roles/${roleToRemove}`, { method: 'DELETE' });
    toast(`Papel ${ROLE_LABELS[roleToRemove] || roleToRemove} removido.`, 'ok');
    ROLES_COLABORADORES = await api('/api/colaboradores').catch(() => ROLES_COLABORADORES);
    renderOrganograma();
    filtrarColabRoles();
  } catch (err) { toast(err.message, 'erro'); }
}

/* ── Boot ── */

async function carregarEmpresasLogin() {
  try {
    const empresas = await api('/api/empresas-publicas');
    const sel = document.getElementById('login-empresa');
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecione sua empresa...</option>' +
      empresas.map(e => `<option value="${e.id}">${esc(e.nome)}</option>`).join('');
  } catch {}
}

iniciar().catch(err => {
  document.getElementById('tela-login').classList.remove('hidden');
  console.error(err);
});

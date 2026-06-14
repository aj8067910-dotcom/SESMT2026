/* SafePoint — Frontend */
'use strict';

let CONFIG = { tipos: [], pontos: {}, conquistas: [], codigoValidade: 60, recompensas: [] };
let TERMINOLOGIA = {};
const TERMINOLOGIA_DEFAULT = {
  dds:'DDS', observacao:'Observação', missao:'Missão', reconhecimento:'Reconhecimento',
  pontos:'Pontos', nivel:'Nível', score:'Safety Score', checkin:'Check-in',
  colaborador:'Colaborador', equipe:'Equipe', feed_nome:'Mural de Segurança',
  app_tema:'Segurança', cipa_nome:'CIPA', brigada_nome:'Brigada', sesmt_nome:'SESMT'
};
function T(key) { return TERMINOLOGIA[key] || TERMINOLOGIA_DEFAULT[key] || key; }
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
  ia: 'Inteligência Artificial', certificados: 'Certificados Automáticos',
  quiz: 'Quiz & Aprendizado', gamificacao: 'Gamificação', feed: 'Mural Social',
  cipa: 'CIPA', brigada: 'Brigada', pesquisas: 'Pesquisas', observacoes: 'Observações',
  insights: 'Insights 3.0', academia: 'Academia SST', ia_assistant: 'Assistente IA',
  cipa_eleicao: 'Eleição CIPA'
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

function mascaraCPF(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 11);
  if (v.length > 9)      v = v.replace(/^(\d{3})(\d{3})(\d{3})(\d{2}).*/, '$1.$2.$3-$4');
  else if (v.length > 6) v = v.replace(/^(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
  else if (v.length > 3) v = v.replace(/^(\d{3})(\d{1,3})/, '$1.$2');
  input.value = v;
}

function mascaraTelefone(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 11);
  if (v.length > 10)     v = v.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  else if (v.length > 6) v = v.replace(/^(\d{2})(\d{4,5})(\d{0,4})/, '($1) $2-$3');
  else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
  else if (v.length > 0) v = v.replace(/^(\d{0,2})/, '($1');
  input.value = v;
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

// Items marcados com data-sst="true" ficam visíveis apenas em plataformas SST
function adaptarSidebarPorTipo(tipo) {
  const isSST = tipo !== 'engajamento';
  document.querySelectorAll('#app-gestor [data-sst="true"]').forEach(el => {
    el.style.display = isSST ? '' : 'none';
  });
  // Rebrand labels for engagement platforms
  if (!isSST) {
    const brand = document.querySelector('#sidebar-gestor .sidebar-brand');
    if (brand) brand.textContent = 'SAFEPOINT · ENGAJAMENTO';
  }
}

function selecionarTipoEmpresa(valor) {
  document.querySelectorAll('.tipo-card').forEach(c => c.classList.remove('selecionado'));
  const card = document.getElementById('tipo-card-' + valor);
  if (card) { card.classList.add('selecionado'); card.querySelector('input').checked = true; }
}

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
  const codigoEmpresa = (document.getElementById('login-codigo')?.value || '').trim().toUpperCase();
  const matricula = document.getElementById('login-mat').value.trim();
  const senha = document.getElementById('login-pwd').value;
  if (!codigoEmpresa) { mostrarErroLogin('Informe o código da empresa.'); return false; }
  try {
    const r = await api('/api/login', { method: 'POST', body: { perfil: 'unificado', codigoEmpresa, matricula, senha } });
    if (r.branding) aplicarBranding(r.branding);
    await iniciar();
    if ((r.primeiroAcesso || !r.termosAceitos) && !r.perfilCompleto) {
      abrirPrimeiroAcesso(r.primeiroAcesso, r.termosAceitos, r.perfilCompleto);
    }
  } catch (err) { mostrarErroLogin(err.message); }
  return false;
}

async function verificarCodigoEmpresa() {
  const codigo = (document.getElementById('login-codigo')?.value || '').trim().toUpperCase();
  const preview = document.getElementById('login-empresa-preview');
  if (!preview) return;
  if (!codigo || codigo.length < 4) { preview.style.display = 'none'; return; }
  try {
    const r = await api('/api/lookup-empresa?codigo=' + encodeURIComponent(codigo));
    preview.style.display = '';
    preview.innerHTML = `✅ ${esc(r.nome)}`;
    preview.style.cssText = 'display:block;margin:6px 0 2px;padding:8px 12px;border-radius:8px;font-size:13px;font-weight:600;background:#f0fdf4;border:1px solid #86efac;color:#166534';
    if (r.branding) aplicarBranding(r.branding);
  } catch {
    preview.style.display = '';
    preview.innerHTML = `❌ Código não encontrado`;
    preview.style.cssText = 'display:block;margin:6px 0 2px;padding:8px 12px;border-radius:8px;font-size:13px;font-weight:600;background:#fef2f2;border:1px solid #fca5a5;color:#991b1b';
  }
}

function copiarCodigoEmpresa() {
  const el = document.getElementById('empresa-codigo-display');
  if (!el) return;
  const code = el.textContent.trim().replace(/\s/g, '');
  if (!code || code === '——') return;
  navigator.clipboard?.writeText(code)
    .then(() => toast('Código copiado!', 'ok'))
    .catch(() => toast(code, 'ok'));
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

let _paStep = 1;
let _paTermosNecessarios = false;

function paSetStep(n) {
  _paStep = n;
  document.querySelectorAll('[id^="pa-step-"]').forEach(el => el.classList.add('hidden'));
  const steps = ['termos','dados','emergencia','senha'];
  const el = document.getElementById('pa-step-' + steps[n-1]);
  if (el) el.classList.remove('hidden');
  document.querySelectorAll('.pa-step-dot').forEach((d, i) => {
    d.classList.toggle('active', i < n);
    d.classList.toggle('done', i < n - 1);
  });
  const titles = ['1/4 — Termos de Uso', '2/4 — Seus Dados', '3/4 — Contato de Emergência', '4/4 — Nova Senha'];
  const t = document.getElementById('pa-titulo');
  if (t) t.textContent = titles[n - 1] || '';
}

function paVoltarStep(n) { paSetStep(n); }

function abrirPrimeiroAcesso(precisaSenha, termosAceitos, perfilCompleto) {
  // Skip onboarding if profile is complete and terms are accepted
  if (perfilCompleto && termosAceitos) return;
  _paTermosNecessarios = !termosAceitos;
  document.getElementById('primeiro-acesso-overlay').classList.remove('hidden');
  if (!termosAceitos) {
    paSetStep(1);
  } else if (precisaSenha) {
    paSetStep(4);
  } else {
    paSetStep(1);
  }
}

async function paAceitarTermos() {
  const check = document.getElementById('pa-termos-check');
  const erro = document.getElementById('pa-termos-erro');
  erro.classList.add('hidden');
  if (!check.checked) { erro.textContent = 'Você precisa aceitar os termos para continuar.'; erro.classList.remove('hidden'); return; }
  try {
    await api('/api/aceitar-termos', { method: 'POST' });
    paSetStep(2);
  } catch (err) { erro.textContent = err.message; erro.classList.remove('hidden'); }
}

async function paSalvarDados() {
  const erro = document.getElementById('pa-dados-erro');
  erro.classList.add('hidden');
  const body = {
    telefone: (document.getElementById('pa-telefone') || {}).value || '',
    email: (document.getElementById('pa-email') || {}).value || '',
    dataNascimento: (document.getElementById('pa-dataNascimento') || {}).value || '',
  };
  try {
    await api('/api/primeiro-acesso/dados', { method: 'POST', body });
    paSetStep(3);
  } catch (err) { erro.textContent = err.message; erro.classList.remove('hidden'); }
}

async function paSalvarEmergencia() {
  const nome = (document.getElementById('pa-emerg-nome') || {}).value || '';
  const parentesco = (document.getElementById('pa-emerg-parentesco') || {}).value || '';
  const telefone1 = (document.getElementById('pa-emerg-tel1') || {}).value || '';
  const erro = document.getElementById('pa-emerg-erro');
  erro.classList.add('hidden');
  if (!nome || !parentesco || !telefone1) {
    erro.textContent = 'Preencha nome, parentesco e telefone principal.'; erro.classList.remove('hidden'); return;
  }
  try {
    await api('/api/primeiro-acesso/emergencia', { method: 'POST', body: {
      nome, parentesco, telefone1,
      telefone2: (document.getElementById('pa-emerg-tel2') || {}).value || '',
    }});
    paSetStep(4);
  } catch (err) { erro.textContent = err.message; erro.classList.remove('hidden'); }
}

async function confirmarNovaSenha() {
  const atual = document.getElementById('pa-senha-atual').value;
  const nova  = document.getElementById('pa-senha-nova').value;
  const conf  = document.getElementById('pa-senha-confirma').value;
  const erro  = document.getElementById('pa-senha-erro');
  erro.classList.add('hidden');
  if (!atual || !nova || !conf) { erro.textContent = 'Preencha todos os campos.'; erro.classList.remove('hidden'); return; }
  if (nova.length < 6) { erro.textContent = 'A nova senha precisa ter no mínimo 6 caracteres.'; erro.classList.remove('hidden'); return; }
  if (nova !== conf) { erro.textContent = 'As senhas não coincidem.'; erro.classList.remove('hidden'); return; }
  try {
    await api('/api/alterar-senha-emp', { method: 'POST', body: { senhaAtual: atual, novaSenha: nova } });
    document.getElementById('primeiro-acesso-overlay').classList.add('hidden');
    toast('Bem-vindo ao SafePoint! Configuração concluída 🚀', 'ok');
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
    const banner = document.getElementById('impersonation-banner');
    if (banner) banner.classList.toggle('hidden', !me.adminImpersonando);
    preencherFiltroTipos();
    await Promise.all([carregarColaboradores(), carregarEventos()]);
    try { EMPRESA_INFO = await api('/api/empresa/branding'); } catch {}
    try { TERMINOLOGIA = await api('/api/empresa/terminologia'); } catch {}
    try {
      const sc = await api('/api/empresa/submodulos');
      aplicarConfigModulos(sc.submodulos, sc.moduleNames);
    } catch {}
    adaptarSidebarPorTipo(EMPRESA_INFO?.tipoPlataforma || 'sst');
    navegar('dashboard');
    carregarBrandingConfig();
    if ((me.primeiroAcesso || !me.termosAceitos) && !me.perfilCompleto) {
      abrirPrimeiroAcesso(me.primeiroAcesso, me.termosAceitos, me.perfilCompleto);
    }
  } else {
    document.getElementById('colab-nome').textContent = me.nome;
    // show role badges in topbar
    const badgesEl = document.getElementById('colab-role-badges');
    if (badgesEl) badgesEl.innerHTML = renderRoleBadgesMini(me.roles || []);
    document.getElementById('app-colab').classList.remove('hidden');
    await carregarPainelColaborador();
    verificarCheckinPendente();
    // first-access check after rendering app
    if ((me.primeiroAcesso || !me.termosAceitos) && !me.perfilCompleto) {
      abrirPrimeiroAcesso(me.primeiroAcesso, me.termosAceitos, me.perfilCompleto);
    }
  }
}

/* ── Navegação ── */

function toggleSidebar(who) {
  const sb = document.getElementById('sidebar-' + who);
  if (!sb) return;
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    const isOpen = sb.classList.toggle('mobile-open');
    const overlay = document.getElementById('overlay-' + who);
    if (overlay) overlay.classList.toggle('visible', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  } else {
    sb.classList.toggle('collapsed');
  }
}

function closeSidebar(who) {
  const sb = document.getElementById('sidebar-' + who);
  if (!sb) return;
  sb.classList.remove('mobile-open');
  const overlay = document.getElementById('overlay-' + who);
  if (overlay) overlay.classList.remove('visible');
  document.body.style.overflow = '';
}

function toggleSbMod(mod) {
  const el = document.getElementById('sbmod-' + mod);
  if (!el) return;
  el.classList.toggle('open');
}

async function navegar(view) {
  // Acessos and Auditoria are sub-tabs inside view-estrutura
  if (view === 'acessos' || view === 'auditoria') {
    if (window.innerWidth <= 768) closeSidebar('gestor');
    document.querySelectorAll('#app-gestor .sidebar-item, #app-gestor .sidebar-module-single').forEach(b => {
      b.classList.toggle('active', b.dataset.view === view);
    });
    document.querySelectorAll('#app-gestor .view').forEach(v => v.classList.add('hidden'));
    const estruturaView = document.getElementById('view-estrutura');
    if (estruturaView) estruturaView.classList.remove('hidden');
    await carregarEstrutura();
    estruturaTab(view);
    return;
  }
  if (window.innerWidth <= 768) closeSidebar('gestor');
  document.querySelectorAll('#app-gestor .sidebar-item, #app-gestor .sidebar-module-single').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  document.querySelectorAll('#app-gestor .view').forEach(v => v.classList.add('hidden'));
  const target = document.getElementById('view-' + view);
  if (target) target.classList.remove('hidden');
  if (view === 'dashboard')         await carregarDashboard();
  if (view === 'eventos')           await carregarEventos();
  if (view === 'colaboradores')     await carregarColaboradores();
  if (view === 'observacoes')       await carregarObservacoes();
  if (view === 'sugestoes')         await carregarSugestoes();
  if (view === 'ranking')           await carregarRanking();
  if (view === 'comunicados')       await carregarComunicadosGestor();
  if (view === 'quiz-gestor')       await carregarQuizGestor();
  if (view === 'engajamento')       await carregarEngajamento();
  if (view === 'pesquisas-gestor')  await carregarPesquisasGestor();
  if (view === 'quem-e-quem')       await carregarQuemEQuem();
  if (view === 'roles')             await carregarRoles();
  if (view === 'estrutura')         await carregarEstrutura();
  if (view === 'insights')          await carregarInsights();
  if (view === 'ia')                carregarIAView();
  if (view === 'academia')          await carregarAcademiaGestor();
  if (view === 'config')            { renderConfig(); carregarBrandingConfig(); }
  if (view === 'submodulos')        await carregarSubmodulos();
  if (view === 'permissoes')        await carregarPermissoes();
  if (view === 'governance')        await carregarGovernance();
  if (view === 'auditoria-avancada') await carregarAuditAvancada();
  if (view === 'feedback-anonimo-gestor') carregarFeedbackAnonimo();
  if (view === 'personalizar')            carregarTerminologia();
  if (view === 'feedback-plataforma')     carregarFeedbackPlataformaGestor();
  // SafePoint 3.3 — novas views
  if (view === 'safety-score-corp') await carregarSafetyScoreCorp();
  if (view === 'risk-engine')       await carregarRiskEngine();
  if (view === 'cipa-estrutura')    await carregarCipaEstrutura();
  if (view === 'brigada-estrutura') await carregarBrigadaEstrutura();
  if (view === 'safety-score-ind')  await carregarSafetyScoreInd();
}

async function navegarColab(view) {
  if (window.innerWidth <= 768) closeSidebar('colab');
  document.querySelectorAll('#app-colab .sidebar-item').forEach(b => {
    b.classList.toggle('active', b.dataset.cview === view);
  });
  document.querySelectorAll('#app-colab .cview').forEach(v => v.classList.add('hidden'));
  const target = document.getElementById('cview-' + view);
  if (target) target.classList.remove('hidden');
  if (view === 'painel')       await carregarPainelColaborador();
  if (view === 'mural')        await carregarMural();
  if (view === 'comunicados')  await carregarComunicados();
  if (view === 'quiz')         await carregarQuiz();
  if (view === 'perfil')       await carregarPerfil();
  if (view === 'pesquisas')    await carregarPesquisasColab();
  if (view === 'quem-e-quem') await carregarQuemEQuemColab();
  if (view === 'estrutura')   await carregarEstruturaColab();
  if (view === 'academia')      await carregarAcademiaColab();
  if (view === 'eleicao')       await carregarEleicaoColab();
  if (view === 'observar')     await carregarMinhasObservacoes();
  if (view === 'sugerir')      await carregarMinhasSugestoes();
  if (view === 'historico')    await carregarHistoricoCompleto();
  if (view === 'feedback-anonimo') { /* just show */ }
  if (view === 'canal-lideranca')  { /* just show */ }
  if (view === 'reconhec-360')       await carregarReconhec360();
  if (view === 'missoes-center')     carregarMissoesCentral();
  if (view === 'feedback-plataforma') await carregarFeedbackPlataformaColab();
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
          ${e.codigoEmpresa ? `<div style="font-family:monospace;font-size:13px;font-weight:700;color:var(--azul);letter-spacing:3px;margin:3px 0">🔑 ${esc(e.codigoEmpresa)}</div>` : ''}
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
        <button class="btn btn-sm" onclick="abrirModulosEmpresa(${e.id}, '${esc(e.nomeFantasia || e.nome)}')">⚙️ Módulos</button>
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

async function abrirModulosEmpresa(id, nome) {
  abrirModal(`⚙️ Módulos — ${nome}`, '<p class="hint">Carregando...</p>');
  try {
    const resp = await api(`/api/admin/empresas/${id}/submodulos`);
    const data = resp.submodulos || resp;
    let html = '';
    const labels = resp.labels || SUBMODULO_LABELS;
    for (const [mod, subs] of Object.entries(labels)) {
      const modSubs = data[mod] || {};
      html += `<div class="submod-section" style="margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--cinza-borda)">
        <div class="submod-section-header"><strong>${MODULO_NOMES[mod] || mod}</strong></div>
        <div class="submod-grid">`;
      for (const [key, label] of Object.entries(subs)) {
        if (key === '_modulo') continue;
        const checked = modSubs[key] ? 'checked' : '';
        html += `<label class="submod-item">
          <input type="checkbox" data-mod="${mod}" data-sub="${key}" ${checked}>
          <span>${label}</span>
        </label>`;
      }
      html += `</div></div>`;
    }
    html += `<div class="modal-rodape">
      <button class="btn" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarModulosAdmin(${id})">Salvar módulos</button>
    </div>`;
    document.getElementById('modal-corpo').innerHTML = html;
  } catch (err) {
    document.getElementById('modal-corpo').innerHTML = `<p class="hint">Erro: ${esc(err.message)}</p>`;
  }
}

async function salvarModulosAdmin(id) {
  const checks = document.querySelectorAll('#modal-corpo input[type=checkbox]');
  const submodulos = {};
  checks.forEach(cb => {
    const mod = cb.dataset.mod, sub = cb.dataset.sub;
    if (!submodulos[mod]) submodulos[mod] = {};
    submodulos[mod][sub] = cb.checked;
  });
  try {
    await api(`/api/admin/empresas/${id}/submodulos`, { method: 'POST', body: { submodulos } });
    fecharModal();
    toast('Módulos da empresa atualizados!', 'ok');
  } catch (err) { toast(err.message, 'erro'); }
}

function formEmpresaHtml(e) {
  const unidades = e && e.unidades ? e.unidades : [{ nome: 'Matriz', endereco: '', cidade: '', estado: '' }];
  const modulos  = e && e.modulos ? e.modulos : {};
  const modulosHtml = Object.entries(MODULOS_LABELS).map(([k, v]) =>
    `<label class="check-inline"><input type="checkbox" id="mod-${k}" ${modulos[k] !== false ? 'checked' : ''}> ${esc(v)}</label>`
  ).join('');
  const tipoAtual = e ? (e.tipoPlataforma || 'sst') : null;
  const tipoSelector = !e ? `
    <div class="tipo-plataforma-wrap">
      <div class="tipo-plataforma-label">Qual o tipo de plataforma?</div>
      <div class="tipo-plataforma-cards">
        <label class="tipo-card selecionado" id="tipo-card-sst" onclick="selecionarTipoEmpresa('sst')">
          <input type="radio" name="emp-tipo" value="sst" checked style="display:none">
          <div class="tipo-card-inner">
            <span class="tipo-card-icon">🦺</span>
            <div class="tipo-card-titulo">Saúde e Segurança do Trabalho</div>
            <div class="tipo-card-desc">CIPA, Brigada, SESMT, NRs, DDS, observações, gestão de segurança</div>
          </div>
        </label>
        <label class="tipo-card" id="tipo-card-engajamento" onclick="selecionarTipoEmpresa('engajamento')">
          <input type="radio" name="emp-tipo" value="engajamento" style="display:none">
          <div class="tipo-card-inner">
            <span class="tipo-card-icon">🎯</span>
            <div class="tipo-card-titulo">Engajamento de Equipe</div>
            <div class="tipo-card-desc">Feed, missões, reconhecimentos, ranking, comunicados, aprendizagem e gamificação</div>
          </div>
        </label>
      </div>
    </div>` : `<div class="tipo-plataforma-badge">${tipoAtual === 'engajamento' ? '🎯 Plataforma de Engajamento de Equipe' : '🦺 Plataforma SST'}</div>`;
  return `
    ${tipoSelector}
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
    unidades: lerUnidades(),
    tipoPlataforma: (document.querySelector('input[name="emp-tipo"]:checked')?.value) || undefined
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
      <td>${c.status === 'desligado' ? '<span class="badge badge-perigo">Desligado</span>' : c.ativo !== false ? '<span class="tag tag-verde">Ativo</span>' : '<span class="tag tag-inativo">Inativo</span>'}</td>
      <td class="acoes">
        <button class="btn btn-sm" onclick="abrirPerfilCompleto(${c.id})">👤 Perfil</button>
        <button class="btn btn-sm" onclick="abrirEditarColaborador(${c.id})">Editar</button>
        ${c.status !== 'desligado' ? `<button class="btn btn-sm btn-perigo" onclick="abrirDesligamento(${c.id})">Desligar</button>` : ''}
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

  const ROLE_DEFS = [
    { key: 'lideranca',         emoji: '👔', label: 'Liderança',             desc: 'Gestores e supervisores' },
    { key: 'sesmt',             emoji: '🦺', label: 'SESMT',                 desc: 'Acesso ao Painel de Gestão', master: true },
    { key: 'cipa',              emoji: '⚠️', label: 'CIPA',                  desc: 'Membro da CIPA' },
    { key: 'brigada',           emoji: '🚒', label: 'Brigada de Emergência',  desc: 'Membro da Brigada' },
    { key: 'tecnico_seguranca', emoji: '🔧', label: 'Técnico de Segurança',  desc: '' },
    { key: 'medico_trabalho',   emoji: '🩺', label: 'Médico do Trabalho',    desc: '' },
    { key: 'ergonomista',       emoji: '🪑', label: 'Ergonomista',           desc: '' },
  ];
  const CIPA_CARGOS   = [
    { key: 'cipa_presidente', label: 'Presidente' },
    { key: 'cipa_vice',       label: 'Vice-Presidente' },
    { key: 'cipa_secretario', label: 'Secretário' },
    { key: 'cipa_titular',    label: 'Titular' },
    { key: 'cipa_suplente',   label: 'Suplente' },
  ];
  const BRIGADA_CARGOS = [
    { key: 'brigada_coordenador', label: 'Coordenador' },
    { key: 'brigada_lider',       label: 'Líder' },
    { key: 'brigada_brigadista',  label: 'Brigadista' },
    { key: 'brigada_socorrista',  label: 'Socorrista' },
  ];
  const rolesAtuais    = (c && c.roles)    ? c.roles    : [];
  const subRolesAtuais = (c && c.subRoles) ? c.subRoles.map(sr => sr.cargo) : [];

  return `
    <div class="emp-form-section">
      <div class="emp-form-section-title">👤 Dados Pessoais</div>
      <div class="linha-2">
        <div><label>Nome completo *</label><input type="text" id="co-nome" value="${c ? esc(c.nome) : ''}"></div>
        <div><label>CPF</label><input type="text" id="co-cpf" value="${c ? esc(c.cpf || '') : ''}" placeholder="000.000.000-00" oninput="mascaraCPF(this)"></div>
      </div>
      <div class="linha-3">
        <div><label>Matrícula *</label><input type="text" id="co-matricula" value="${c ? esc(c.matricula) : ''}"></div>
        <div><label>Data de Nascimento</label><input type="date" id="co-dataNascimento" value="${c ? esc(c.dataNascimento || '') : ''}"></div>
        <div><label>Telefone</label><input type="text" id="co-telefone" value="${c ? esc(c.telefone || '') : ''}" placeholder="(11) 99999-9999"></div>
      </div>
      <div class="linha-2">
        <div><label>E-mail pessoal</label><input type="email" id="co-email" value="${c ? esc(c.email || '') : ''}"></div>
        <div><label>E-mail corporativo</label><input type="email" id="co-emailCorp" value="${c ? esc(c.emailCorp || '') : ''}"></div>
      </div>
    </div>

    <div class="emp-form-section">
      <div class="emp-form-section-title">🏢 Dados Organizacionais</div>
      <div class="linha-2">
        <div><label>Empresa</label><input type="text" id="co-empresa" value="${esc(EMPRESA_INFO.nome || (c ? c.empresa || '' : ''))}" readonly class="input-readonly"></div>
        <div><label>Contrato</label><input type="text" id="co-contrato" value="${c ? esc(c.contrato || '') : ''}" placeholder="Ex.: CLT, PJ, Estágio..."></div>
      </div>
      <div class="linha-2">
        <div><label>Unidade</label>${unidadeSelect}</div>
        <div><label>Setor</label><input type="text" id="co-setor" value="${c ? esc(c.setor || '') : ''}"></div>
      </div>
      <div class="linha-3">
        <div><label>Equipe</label><input type="text" id="co-equipe" value="${c ? esc(c.equipe || '') : ''}"></div>
        <div><label>Cargo / Função</label><input type="text" id="co-funcao" value="${c ? esc(c.funcao || '') : ''}"></div>
        <div><label>Gestor Direto</label><input type="text" id="co-gestorDireto" value="${c ? esc(c.gestorDireto || '') : ''}" placeholder="Nome do gestor"></div>
      </div>
    </div>

    <div class="emp-form-section">
      <div class="emp-form-section-title">⚙️ Dados de Sistema</div>
      <div class="linha-${c ? '2' : '3'}">
        <div><label>Data de Admissão</label><input type="date" id="co-dataAdmissao" value="${c ? esc(c.dataAdmissao || '') : ''}"></div>
        <div><label>Status</label>
          <select id="co-status">
            <option value="ativo"    ${(!c || c.status === 'ativo')    ? 'selected' : ''}>Ativo</option>
            <option value="inativo"  ${c && c.status === 'inativo'     ? 'selected' : ''}>Inativo</option>
            <option value="afastado" ${c && c.status === 'afastado'    ? 'selected' : ''}>Afastado</option>
            <option value="desligado"${c && c.status === 'desligado'   ? 'selected' : ''}>Desligado</option>
          </select>
        </div>
        ${!c ? `<div><label>Senha temporária</label><input type="text" id="co-senha" placeholder="Padrão: mesma que a matrícula"></div>` : ''}
      </div>
      ${c ? `<label class="check-inline" style="margin-top:8px"><input type="checkbox" id="co-ativo" ${c.ativo !== false ? 'checked' : ''}> Conta ativa no sistema</label>` : ''}
    </div>

    <div class="emp-form-section">
      <div class="emp-form-section-title">🏅 Papéis de Acesso</div>
      <p class="hint" style="margin-bottom:10px">SESMT libera acesso completo ao Painel de Gestão. Os demais papéis são perfis informativos.</p>
      <div class="roles-check-grid">
        ${ROLE_DEFS.map(r => `
          <label class="role-check-item ${r.master ? 'role-check-master' : ''} ${rolesAtuais.includes(r.key) ? 'role-check-ativo' : ''}">
            <input type="checkbox" id="co-role-${r.key}" value="${r.key}" ${rolesAtuais.includes(r.key) ? 'checked' : ''}
              onchange="this.closest('.role-check-item').classList.toggle('role-check-ativo',this.checked)${r.key==='cipa'?';toggleCipaCargos(this.checked)':''}${r.key==='brigada'?';toggleBrigadaCargos(this.checked)':''}">
            <span class="role-check-emoji">${r.emoji}</span>
            <span class="role-check-label">
              <strong>${r.label}</strong>${r.master ? ' <span class="role-master-tag">gestor</span>' : ''}
              ${r.desc ? `<span class="hint" style="display:block;font-size:11px">${r.desc}</span>` : ''}
            </span>
          </label>`).join('')}
      </div>
    </div>

    <div class="emp-form-section" id="cipa-cargos-section" ${rolesAtuais.includes('cipa') ? '' : 'style="display:none"'}>
      <div class="emp-form-section-title">⚠️ Função na CIPA</div>
      <div class="roles-check-grid">
        ${CIPA_CARGOS.map(cargo => `
          <label class="role-check-item ${subRolesAtuais.includes(cargo.key) ? 'role-check-ativo' : ''}">
            <input type="checkbox" id="co-cargo-${cargo.key}" value="${cargo.key}" ${subRolesAtuais.includes(cargo.key) ? 'checked' : ''}
              onchange="this.closest('.role-check-item').classList.toggle('role-check-ativo',this.checked)">
            <span class="role-check-label"><strong>${cargo.label}</strong></span>
          </label>`).join('')}
      </div>
    </div>

    <div class="emp-form-section" id="brigada-cargos-section" ${rolesAtuais.includes('brigada') ? '' : 'style="display:none"'}>
      <div class="emp-form-section-title">🚒 Função na Brigada de Emergência</div>
      <div class="roles-check-grid">
        ${BRIGADA_CARGOS.map(cargo => `
          <label class="role-check-item ${subRolesAtuais.includes(cargo.key) ? 'role-check-ativo' : ''}">
            <input type="checkbox" id="co-cargo-${cargo.key}" value="${cargo.key}" ${subRolesAtuais.includes(cargo.key) ? 'checked' : ''}
              onchange="this.closest('.role-check-item').classList.toggle('role-check-ativo',this.checked)">
            <span class="role-check-label"><strong>${cargo.label}</strong></span>
          </label>`).join('')}
      </div>
    </div>

    <div class="modal-rodape">
      <button class="btn" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarColaborador(${c ? c.id : 'null'})">Salvar</button>
    </div>`;
}

function toggleCipaCargos(show) {
  const el = document.getElementById('cipa-cargos-section');
  if (el) el.style.display = show ? '' : 'none';
}
function toggleBrigadaCargos(show) {
  const el = document.getElementById('brigada-cargos-section');
  if (el) el.style.display = show ? '' : 'none';
}

function abrirNovoColaborador() { abrirModal('Novo colaborador', formColaboradorHtml(null)); }

function abrirEditarColaborador(id) {
  const c = COLABORADORES.find(x => x.id === id);
  if (c) abrirModal('Editar colaborador', formColaboradorHtml(c));
}

async function salvarColaborador(id) {
  const g = v => { const el = document.getElementById(v); return el ? el.value : ''; };
  const body = {
    matricula:       g('co-matricula'),
    cpf:             g('co-cpf'),
    nome:            g('co-nome'),
    setor:           g('co-setor'),
    equipe:          g('co-equipe'),
    funcao:          g('co-funcao'),
    unidade:         g('co-unidade'),
    empresa:         g('co-empresa'),
    telefone:        g('co-telefone'),
    email:           g('co-email'),
    emailCorp:       g('co-emailCorp'),
    dataNascimento:  g('co-dataNascimento'),
    dataAdmissao:    g('co-dataAdmissao'),
    gestorDireto:    g('co-gestorDireto'),
    contrato:        g('co-contrato'),
    status:          g('co-status') || 'ativo',
  };
  const chkAtivo = document.getElementById('co-ativo');
  if (chkAtivo) body.ativo = chkAtivo.checked;
  if (!id) {
    const senha = g('co-senha');
    if (senha) body.senha = senha;
  }
  try {
    let savedId = id;
    if (id) await api('/api/colaboradores/' + id, { method: 'PUT', body });
    else {
      const novo = await api('/api/colaboradores', { method: 'POST', body });
      savedId = novo.id;
    }
    if (savedId) {
      const ROLE_KEYS = ['lideranca', 'sesmt', 'cipa', 'brigada', 'tecnico_seguranca', 'medico_trabalho', 'ergonomista'];
      const CARGO_KEYS = ['cipa_presidente','cipa_vice','cipa_secretario','cipa_titular','cipa_suplente',
                          'brigada_coordenador','brigada_lider','brigada_brigadista','brigada_socorrista'];
      const existente = COLABORADORES.find(x => x.id === savedId);
      const rolesAntes = (existente && existente.roles) ? existente.roles : [];
      const rolesDepois = ROLE_KEYS.filter(r => { const el = document.getElementById('co-role-' + r); return el && el.checked; });
      for (const r of rolesDepois) {
        if (!rolesAntes.includes(r)) await api(`/api/usuarios/${savedId}/roles`, { method: 'POST', body: { role: r } }).catch(() => {});
      }
      for (const r of rolesAntes) {
        if (!rolesDepois.includes(r)) await api(`/api/usuarios/${savedId}/roles/${r}`, { method: 'DELETE' }).catch(() => {});
      }
      const subRolesAntes = existente && existente.subRoles ? existente.subRoles.map(sr => sr.cargo) : [];
      const subRolesDepois = CARGO_KEYS.filter(k => { const el = document.getElementById('co-cargo-' + k); return el && el.checked; });
      for (const k of subRolesDepois) {
        if (!subRolesAntes.includes(k)) await api(`/api/colaboradores/${savedId}/subroles`, { method: 'POST', body: { cargo: k } }).catch(() => {});
      }
      for (const k of subRolesAntes) {
        if (!subRolesDepois.includes(k)) await api(`/api/colaboradores/${savedId}/subroles/${k}`, { method: 'DELETE' }).catch(() => {});
      }
    }
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

function abrirDesligamento(id) {
  const c = COLABORADORES.find(x => x.id === id);
  if (!c) return;
  abrirModal(`🔴 Desligar colaborador — ${esc(c.nome)}`, `
    <p class="hint" style="margin-bottom:14px">O colaborador perderá acesso imediatamente. Os dados históricos serão preservados para auditoria.</p>
    <label>Motivo do desligamento *</label>
    <select id="desl-motivo">
      <option value="">Selecione...</option>
      <option value="Pedido de demissão">Pedido de demissão</option>
      <option value="Demissão sem justa causa">Demissão sem justa causa</option>
      <option value="Demissão por justa causa">Demissão por justa causa</option>
      <option value="Término de contrato">Término de contrato</option>
      <option value="Aposentadoria">Aposentadoria</option>
      <option value="Transferência">Transferência</option>
      <option value="Outro">Outro</option>
    </select>
    <label style="margin-top:10px">Observações</label>
    <textarea id="desl-obs" rows="3" placeholder="Informações adicionais sobre o desligamento..."></textarea>
    <div class="modal-rodape">
      <button class="btn" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-perigo" onclick="confirmarDesligamento(${id})">🔴 Confirmar desligamento</button>
    </div>`);
}

async function confirmarDesligamento(id) {
  const motivo = document.getElementById('desl-motivo').value;
  if (!motivo) return toast('Selecione o motivo do desligamento.', 'erro');
  const obs = document.getElementById('desl-obs').value;
  if (!confirm('Confirma o desligamento? O acesso será revogado imediatamente.')) return;
  try {
    await api(`/api/colaboradores/${id}/desligar`, { method: 'POST', body: { motivo, observacoes: obs } });
    fecharModal();
    toast('Colaborador desligado. Acesso revogado.', 'ok');
    await carregarColaboradores();
  } catch (err) { toast(err.message, 'erro'); }
}

function baixarModeloImportacao() {
  const header = 'matricula;nome;cpf;dataNascimento;dataAdmissao;telefone;email;empresa;contrato;unidade;setor;equipe;cargo;gestorDireto;status;perfil;funcaoCipa;funcaoBrigada';
  const exemplo = '001;Maria Silva;000.000.000-00;01/01/1990;01/01/2020;(11) 99999-9999;maria@email.com;Empresa XYZ;CLT;Unidade SP;Producao;Equipe A;Operadora;João;ativo;;cipa_titular;';
  const blob = new Blob(['﻿' + header + '\n' + exemplo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'modelo_importacao_safepoint.csv'; a.click();
  URL.revokeObjectURL(url);
}

function abrirImportacao() {
  abrirModal('📥 Importar colaboradores via planilha', `
    <p class="hint" style="margin-bottom:12px">
      Importe múltiplos colaboradores de uma vez. Baixe o modelo para garantir o formato correto.
    </p>
    <button class="btn" style="margin-bottom:14px" onclick="baixarModeloImportacao()">⬇️ Baixar planilha modelo (.csv)</button>
    <label>Arquivo CSV/TXT</label>
    <input type="file" id="imp-arquivo" accept=".csv,.txt,.xlsx" onchange="lerArquivoImportacao(this)">
    <label style="margin-top:10px">Ou cole os dados diretamente</label>
    <textarea id="imp-texto" style="min-height:120px" placeholder="matricula;nome;cpf;dataNascimento;..."></textarea>
    <div id="imp-preview" style="margin-top:12px"></div>
    <div class="modal-rodape">
      <button class="btn" onclick="fecharModal()">Cancelar</button>
      <button class="btn" onclick="validarImportacao()">🔍 Validar</button>
      <button class="btn btn-primary" id="imp-btn-importar" onclick="enviarImportacao()" disabled>✔ Importar</button>
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

async function validarImportacao() {
  const texto = document.getElementById('imp-texto').value;
  if (!texto.trim()) return toast('Cole a lista ou selecione um arquivo.', 'erro');
  const preview = document.getElementById('imp-preview');
  preview.innerHTML = '<p class="hint">Validando...</p>';
  try {
    const r = await api('/api/colaboradores/validar-importacao', { method: 'POST', body: { texto } });
    const btn = document.getElementById('imp-btn-importar');
    if (btn) btn.disabled = r.totalValidos === 0;
    let html = `<div class="panel" style="padding:12px">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px;text-align:center">
        <div style="padding:10px;background:#eaf9ee;border-radius:8px"><div style="font-size:24px;font-weight:900;color:#1a8a4c">${r.totalValidos}</div><div class="hint">Válidos</div></div>
        <div style="padding:10px;background:#fff8e6;border-radius:8px"><div style="font-size:24px;font-weight:900;color:#e8801a">${r.duplicados.length}</div><div class="hint">Duplicados</div></div>
        <div style="padding:10px;background:#fff0f0;border-radius:8px"><div style="font-size:24px;font-weight:900;color:#d32f2f">${r.totalErros}</div><div class="hint">Erros</div></div>
      </div>`;
    if (r.validos.length) {
      html += `<table class="tabela" style="font-size:12px"><thead><tr><th>Matrícula</th><th>Nome</th><th>Setor</th><th>Status</th></tr></thead><tbody>`;
      for (const v of r.validos.slice(0, 10)) {
        html += `<tr><td>${esc(v.matricula)}</td><td>${esc(v.nome)}</td><td>${esc(v.setor||'—')}</td><td><span class="tag tag-verde">OK</span></td></tr>`;
      }
      if (r.validos.length > 10) html += `<tr><td colspan="4" class="hint" style="text-align:center">... e mais ${r.validos.length - 10}</td></tr>`;
      html += `</tbody></table>`;
    }
    if (r.duplicados.length) html += `<p class="hint" style="margin-top:8px">⚠️ Matrícula já existente: ${r.duplicados.slice(0,5).map(esc).join(', ')}${r.duplicados.length>5?'...':''}</p>`;
    if (r.erros.length)     html += `<p class="erro" style="margin-top:6px">❌ Erros: ${r.erros.slice(0,3).map(e=>'linha '+(e.linha||0)+': '+esc(e.motivo||'')).join('; ')}</p>`;
    html += `</div>`;
    preview.innerHTML = html;
  } catch (err) { preview.innerHTML = `<p class="hint">Erro: ${esc(err.message)}</p>`; }
}

async function enviarImportacao() {
  const texto = document.getElementById('imp-texto').value;
  if (!texto.trim()) return toast('Cole a lista ou selecione um arquivo.', 'erro');
  try {
    const r = await api('/api/colaboradores/importar', { method: 'POST', body: { texto } });
    let html = `<p style="color:var(--verde);font-weight:700">✔ ${r.inseridos} colaborador(es) importado(s).</p>`;
    if (r.duplicados && r.duplicados.length) html += `<p class="hint">Ignorados (matrícula duplicada): ${r.duplicados.map(esc).join(', ')}</p>`;
    if (r.cpfDuplicados && r.cpfDuplicados.length) html += `<p class="hint">Ignorados (CPF duplicado): ${r.cpfDuplicados.map(esc).join(', ')}</p>`;
    if (r.erros && r.erros.length) html += `<p class="erro">Erros: ${r.erros.map(e => 'linha ' + (e.linha||0)).join(', ')}</p>`;
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
  // Carregar código de acesso da empresa
  try {
    const { codigo } = await api('/api/empresa/codigo');
    const el = document.getElementById('empresa-codigo-display');
    if (el && codigo) el.textContent = codigo;
  } catch {}
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

  renderSaudacaoCard(p);
  renderDnaCard(p.dna || []);
  renderPendenciasCard(p.pendencias || {});
  renderParticipacaoCard(p.participacao || {}, p);

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

function renderSaudacaoCard(p) {
  const el = document.getElementById('colab-saudacao-card');
  if (!el) return;
  const colab = p.colaborador || {};
  const nome = (colab.nome || '').split(' ')[0];
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const ini = (colab.nome || '?').slice(0,2).toUpperCase();
  // Badges CIPA/Brigada
  const part = p.participacao || {};
  const CARGO_LABELS_CIPA = { cipa_presidente:'Presidente da CIPA', cipa_vice:'Vice-Presidente CIPA', cipa_secretario:'Secretário CIPA', cipa_titular:'Titular CIPA', cipa_suplente:'Suplente CIPA' };
  const CARGO_LABELS_BRI  = { brigada_coordenador:'Coord. Brigada', brigada_lider:'Líder de Brigada', brigada_brigadista:'Brigadista', brigada_socorrista:'Socorrista' };
  const badgesCipa = part.cargoCipa ? `<span class="badge-institucional badge-cipa">${CARGO_LABELS_CIPA[part.cargoCipa] || 'CIPA'}</span>` : (part.isCipa ? '<span class="badge-institucional badge-cipa">🛡 CIPA</span>' : '');
  const badgesBri  = part.cargoBrigada ? `<span class="badge-institucional badge-brigada">${CARGO_LABELS_BRI[part.cargoBrigada] || 'Brigada'}</span>` : (part.isBrigada ? '<span class="badge-institucional badge-brigada">🚒 Brigada</span>' : '');

  // Tempo de empresa
  let tempoEmp = '';
  if (p.admissao) {
    const admDate = new Date(p.admissao);
    const hoje = new Date();
    const meses = (hoje.getFullYear() - admDate.getFullYear()) * 12 + (hoje.getMonth() - admDate.getMonth());
    tempoEmp = meses < 12 ? `${meses} meses na empresa` : `${Math.floor(meses/12)} ano${Math.floor(meses/12)>1?'s':''} na empresa`;
  }

  el.innerHTML = `
    <div class="colab-saudacao-inner">
      <div class="colab-saudacao-avatar">${ini}</div>
      <div class="colab-saudacao-info">
        <div class="colab-saudacao-text">${saudacao}, <strong>${esc(nome)}</strong>! 👋</div>
        <div class="colab-saudacao-badges">${badgesCipa}${badgesBri}</div>
        ${tempoEmp ? `<div class="hint" style="margin-top:4px">🏢 ${tempoEmp}</div>` : ''}
      </div>
    </div>`;
}

function renderDnaCard(dna) {
  const el = document.getElementById('colab-dna-card');
  if (!el || !dna.length) { if(el) el.style.display='none'; return; }
  el.style.display = '';
  el.innerHTML = `
    <h3>🧬 Safety DNA</h3>
    <div class="dna-badges">
      ${dna.map(d => `
        <div class="dna-badge">
          <span class="dna-emoji">${d.emoji}</span>
          <div>
            <div class="dna-nome">${esc(d.nome)}</div>
            <div class="dna-desc">${esc(d.desc)}</div>
          </div>
        </div>`).join('')}
    </div>`;
}

function renderPendenciasCard(pend) {
  const el = document.getElementById('colab-pendencias-card');
  if (!el) return;
  const total = (pend.comunicadosNaoLidos||0) + (pend.pesquisasPendentes||0);
  if (!total) { el.innerHTML = '<div style="display:flex;align-items:center;gap:10px"><span style="font-size:24px">✅</span><div><strong>Tudo em dia!</strong><div class="hint">Você não tem pendências no momento.</div></div></div>'; return; }
  const items = [];
  if (pend.comunicadosNaoLidos > 0) items.push(`<div class="pendencia-item" onclick="navegarColab('comunicados')"><span class="pend-icon">📢</span><span class="pend-text">${pend.comunicadosNaoLidos} comunicado${pend.comunicadosNaoLidos>1?'s':''} não lido${pend.comunicadosNaoLidos>1?'s':''}</span><span class="pend-arrow">›</span></div>`);
  if (pend.pesquisasPendentes > 0) items.push(`<div class="pendencia-item" onclick="navegarColab('pesquisas')"><span class="pend-icon">📋</span><span class="pend-text">${pend.pesquisasPendentes} pesquisa${pend.pesquisasPendentes>1?'s':''} pendente${pend.pesquisasPendentes>1?'s':''}</span><span class="pend-arrow">›</span></div>`);
  el.innerHTML = `<h3>⏳ Minhas Pendências <span class="badge-count">${total}</span></h3>${items.join('')}`;
}

function renderParticipacaoCard(part, p) {
  const el = document.getElementById('colab-participacao-card');
  if (!el) return;
  el.innerHTML = `
    <h3>📊 Minha Participação</h3>
    <div class="participacao-grid">
      <div class="partic-item">
        <div class="partic-val">${p.posicao ? p.posicao+'º' : '–'}</div>
        <div class="partic-label">Ranking</div>
      </div>
      <div class="partic-item">
        <div class="partic-val">${part.reconhecimentosRecebidos || 0}</div>
        <div class="partic-label">Reconhecimentos recebidos</div>
      </div>
      <div class="partic-item">
        <div class="partic-val">${part.reconhecimentosEnviados || 0}</div>
        <div class="partic-label">Reconhecimentos enviados</div>
      </div>
      <div class="partic-item">
        <div class="partic-val">${p.historico ? p.historico.length : 0}</div>
        <div class="partic-label">Participações</div>
      </div>
    </div>`;
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

function renderFeedConteudo(txt) {
  return esc(txt)
    .replace(/\n/g, '<br>')
    .replace(/#(\w+)/g, '<span class="feed-hashtag">#$1</span>')
    .replace(/@(\w[\w\s]*)/g, '<span class="feed-mention">@$1</span>');
}

function renderFeedPost(p) {
  const tipoTag = p.tipo === 'reconhecimento' ? '<span class="tag tag-verde">🤝 Reconhecimento</span>'
    : p.tipo === 'conquista' ? '<span class="tag tag-ouro">⭐ Conquista</span>'
    : p.tipo === 'comunicado' ? '<span class="tag tag-azul">📢 Comunicado</span>'
    : '';
  const mr = p.minhasReacoes || {};
  const REACOES = [
    { key:'aplausos',   emoji:'👏', label:'Excelente',             total: p.totalAplausos   || 0 },
    { key:'seguranca',  emoji:'🛡', label:'Exemplo de Segurança',  total: p.totalSeguranca  || 0 },
    { key:'boaideia',   emoji:'💡', label:'Boa Ideia',             total: p.totalBoaideia   || 0 },
    { key:'inspirador', emoji:'🔥', label:'Inspirador',            total: p.totalInspirador || 0 },
    { key:'reconhec',   emoji:'🏆', label:'Merece Reconhecimento', total: p.totalReconhec   || 0 },
    { key:'like',       emoji:'❤️', label:'Gostei',                total: p.totalLikes      || 0 },
  ];
  const total = REACOES.reduce((a, r) => a + r.total, 0);
  const comentarios = p.ultimosComentarios || [];
  const totalComent = p.totalComentarios || 0;
  return `
    <div class="feed-card" id="feed-post-${p.id}">
      <div class="feed-header">
        <div class="feed-avatar">${esc((p.autorNome || '?')[0]).toUpperCase()}</div>
        <div class="feed-meta">
          <strong>${esc(p.autorNome || 'Usuário')}</strong>
          ${tipoTag}
          <span class="feed-ts">${tsDataHora(p.timestamp)}</span>
        </div>
      </div>
      <div class="feed-body">${renderFeedConteudo(p.conteudo || '')}</div>
      <div class="feed-footer">
        ${REACOES.map(r => `<button class="btn-reacao ${mr[r.key] ? 'ativo' : ''}" onclick="reagirFeed(${p.id},'${r.key}')" title="${r.label}">${r.emoji} ${r.total || ''}</button>`).join('')}
        <button class="btn-reacao" onclick="toggleComentarios(${p.id})" title="Comentar">💬 ${totalComent || ''}</button>
        ${total ? `<span class="feed-total-reac">${total} reações</span>` : ''}
      </div>
      <div id="feed-coment-${p.id}" class="feed-comentarios" style="display:none">
        ${comentarios.map(c => `
          <div class="feed-comentario">
            <strong>${esc(c.autorNome)}</strong>
            <span>${esc(c.texto)}</span>
            <span class="feed-ts">${tsDataHora(c.timestamp)}</span>
          </div>`).join('')}
        ${totalComent > 2 ? `<button class="btn btn-sm" onclick="carregarComentarios(${p.id})">Ver todos (${totalComent})</button>` : ''}
        <div style="display:flex;gap:8px;margin-top:8px">
          <input type="text" id="coment-input-${p.id}" placeholder="Escreva um comentário..." style="flex:1;font-size:13px"
            onkeydown="if(event.key==='Enter')comentarFeed(${p.id})">
          <button class="btn btn-sm btn-primary" onclick="comentarFeed(${p.id})">Enviar</button>
        </div>
      </div>
    </div>`;
}

function toggleComentarios(id) {
  const el = document.getElementById('feed-coment-' + id);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
  if (el.style.display === 'block') {
    const inp = document.getElementById('coment-input-' + id);
    if (inp) inp.focus();
  }
}

async function carregarComentarios(id) {
  try {
    const list = await api(`/api/feed/${id}/comentarios`);
    const el = document.getElementById('feed-coment-' + id);
    if (!el) return;
    const inp = el.querySelector('input');
    const btns = el.querySelectorAll('button');
    el.innerHTML = list.map(c => `
      <div class="feed-comentario">
        <strong>${esc(c.autorNome)}</strong>
        <span>${esc(c.texto)}</span>
        <span class="feed-ts">${tsDataHora(c.timestamp)}</span>
      </div>`).join('') +
      `<div style="display:flex;gap:8px;margin-top:8px">
        <input type="text" id="coment-input-${id}" placeholder="Escreva um comentário..." style="flex:1;font-size:13px"
          onkeydown="if(event.key==='Enter')comentarFeed(${id})">
        <button class="btn btn-sm btn-primary" onclick="comentarFeed(${id})">Enviar</button>
      </div>`;
  } catch (err) { toast(err.message, 'erro'); }
}

async function comentarFeed(id) {
  const inp = document.getElementById('coment-input-' + id);
  const texto = inp?.value.trim();
  if (!texto) return;
  try {
    await api(`/api/feed/${id}/comentar`, { method: 'POST', body: { texto } });
    if (inp) inp.value = '';
    await carregarComentarios(id);
  } catch (err) { toast(err.message, 'erro'); }
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

/* ── Central de Aprendizado (colaborador) — tabs ── */

function quizTabColab(tab) {
  _quizTabColabAtiva = tab;
  document.querySelectorAll('#quiz-tabs-colab .quiz-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.ctab === tab));
  document.querySelectorAll('[id^="ctab-"]').forEach(p =>
    p.classList.toggle('hidden', p.id !== 'ctab-' + tab));
  if (tab === 'diario')     _carregarQuizDiario();
  if (tab === 'battle')     carregarBattleColab();
  if (tab === 'flashcards') carregarFlashcardsColab();
}

/* ── Quiz Diário (colaborador) ── */

let QUIZ_HOJE = null;

async function carregarQuiz() {
  pararPollBattle();
  _quizTabColabAtiva = 'diario';
  document.querySelectorAll('#quiz-tabs-colab .quiz-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.ctab === 'diario'));
  document.querySelectorAll('[id^="ctab-"]').forEach(p =>
    p.classList.toggle('hidden', p.id !== 'ctab-diario'));
  await _carregarQuizDiario();
}

async function _carregarQuizDiario() {
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

/* ── Central de Conhecimento — estado global ── */

let _quizTabAtiva = 'banco';
let _quizTabColabAtiva = 'diario';
let _bancoQuestoes = [];
let _battleSessaoAtiva = null;
let _battlePollTimer = null;

/* ── Quiz / Aprendizado — tabs (gestor) ── */

async function carregarQuizGestor() {
  _quizTabAtiva = 'banco';
  document.querySelectorAll('#quiz-tabs-gestor .quiz-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === 'banco'));
  document.querySelectorAll('[id^="qtab-"]').forEach(p =>
    p.classList.toggle('hidden', p.id !== 'qtab-banco'));
  await carregarBancoQuestoes();
}

function quizTab(tab) {
  _quizTabAtiva = tab;
  document.querySelectorAll('#quiz-tabs-gestor .quiz-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('[id^="qtab-"]').forEach(p =>
    p.classList.toggle('hidden', p.id !== 'qtab-' + tab));
  if (tab === 'banco')      carregarBancoQuestoes();
  if (tab === 'battle')     carregarBattleGestor();
  if (tab === 'flashcards') carregarFlashcardsGestor();
  if (tab === 'analytics')  carregarAnalytics();
}

/* ── Banco de Questões ── */

async function carregarBancoQuestoes() {
  try {
    _bancoQuestoes = await api('/api/questoes');
    filtrarBanco();
  } catch (err) { toast(err.message, 'erro'); }
}

function filtrarBanco() {
  const cat   = document.getElementById('banco-categoria')?.value || '';
  const dif   = document.getElementById('banco-dificuldade')?.value || '';
  const busca = (document.getElementById('banco-busca')?.value || '').toLowerCase();
  let lista = _bancoQuestoes;
  if (cat)   lista = lista.filter(q => q.categoria === cat);
  if (dif)   lista = lista.filter(q => q.dificuldade === dif);
  if (busca) lista = lista.filter(q => (q.texto || q.pergunta || '').toLowerCase().includes(busca));
  const countEl = document.getElementById('banco-count');
  if (countEl) countEl.textContent = `${lista.length} questão${lista.length !== 1 ? 'ões' : ''} (${_bancoQuestoes.length} total)`;
  const el = document.getElementById('banco-lista');
  if (!el) return;
  if (!lista.length) {
    el.innerHTML = '<p class="hint" style="text-align:center;padding:24px">Nenhuma questão encontrada. Clique em "+ Nova questão" para começar.</p>';
    return;
  }
  const difLabel = { facil:'🟢 Fácil', medio:'🟡 Médio', dificil:'🔴 Difícil' };
  el.innerHTML = lista.map(q => {
    const corrIdx = (q.opcoes || []).findIndex(o => o.correta);
    const corrTxt  = corrIdx >= 0 ? q.opcoes[corrIdx].texto : '';
    const pct = q.stats?.total ? Math.round((q.stats.acertos / q.stats.total) * 100) : null;
    return `<div class="questao-card">
      <div class="questao-card-top">
        <div class="questao-pergunta">${esc(q.texto || q.pergunta || '')}</div>
        <div class="questao-acoes">
          <button class="btn btn-sm" onclick="editarQuestao(${q.id})">✏️</button>
          <button class="btn btn-sm" style="color:#dc2626" onclick="excluirQuestao(${q.id})">🗑️</button>
        </div>
      </div>
      <div class="questao-badges">
        <span class="questao-badge cat">${esc(q.categoria || '')}</span>
        <span class="questao-badge ${q.dificuldade || 'facil'}">${difLabel[q.dificuldade] || '🟢 Fácil'}</span>
      </div>
      <div class="questao-stats">
        ✅ Correta: <strong>${esc(corrTxt)}</strong>
        ${pct !== null ? ` &nbsp;|&nbsp; 📊 ${pct}% acerto (${q.stats.total} resp.)` : ''}
      </div>
    </div>`;
  }).join('');
}

function abrirNovaQuestao() {
  abrirModal('📚 Nova Questão', _formQuestaoHtml(null));
}
function editarQuestao(id) {
  const q = _bancoQuestoes.find(x => x.id === id);
  if (q) abrirModal('✏️ Editar Questão', _formQuestaoHtml(q));
}
function _formQuestaoHtml(q) {
  const cats = ['NR-01','NR-05','NR-06','NR-10','NR-12','NR-18','NR-20','NR-33','NR-35',
    'APR','EPI','Primeiros Socorros','Combate a Incêndio','Ergonomia',
    'Direção Defensiva','Trabalho em Altura','Espaço Confinado','Procedimentos Gerais'];
  const corrIdx = q ? (q.opcoes || []).findIndex(o => o.correta) : 0;
  return `
    <label>Pergunta *</label>
    <textarea id="q-pergunta" rows="3" placeholder="Ex.: Qual EPI protege contra ruído acima de 85 dB?">${esc(q?.texto || q?.pergunta || '')}</textarea>
    ${[0,1,2,3].map(i => `
    <label>Opção ${String.fromCharCode(65+i)}${i<2?' *':''}</label>
    <input type="text" id="q-op-${i}" placeholder="${i<2?'Obrigatória':'Opcional'}" value="${esc(q?.opcoes?.[i]?.texto||'')}">
    `).join('')}
    <label>Resposta correta *</label>
    <select id="q-correta">
      ${[0,1,2,3].map(i=>`<option value="${i}" ${corrIdx===i?'selected':''}>Opção ${String.fromCharCode(65+i)}</option>`).join('')}
    </select>
    <label>Categoria</label>
    <select id="q-categoria">
      ${cats.map(c=>`<option value="${c}" ${(q?.categoria||'Procedimentos Gerais')===c?'selected':''}>${c}</option>`).join('')}
    </select>
    <label>Dificuldade</label>
    <select id="q-dificuldade">
      <option value="facil"  ${(q?.dificuldade||'facil')==='facil'?'selected':''}>🟢 Fácil</option>
      <option value="medio"  ${(q?.dificuldade||'')==='medio'?'selected':''}>🟡 Médio</option>
      <option value="dificil"${(q?.dificuldade||'')==='dificil'?'selected':''}>🔴 Difícil</option>
    </select>
    <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="salvarQuestao(${q?.id||'null'})">
      ${q?'Salvar alterações':'Criar questão'}
    </button>`;
}

async function salvarQuestao(id) {
  const pergunta = document.getElementById('q-pergunta')?.value.trim();
  const corrIdx  = Number(document.getElementById('q-correta')?.value);
  const textos   = [0,1,2,3].map(i => document.getElementById('q-op-'+i)?.value.trim()||'');
  if (!pergunta || !textos[0] || !textos[1]) return toast('Preencha pergunta e ao menos 2 opções.', 'erro');
  const opcoes = textos.filter(Boolean).map((texto, i) => ({ texto, correta: i === corrIdx }));
  const body = { texto: pergunta, opcoes,
    categoria:   document.getElementById('q-categoria')?.value,
    dificuldade: document.getElementById('q-dificuldade')?.value };
  try {
    if (id) {
      await api(`/api/questoes/${id}`, { method: 'PUT', body });
      toast('Questão atualizada!', 'ok');
    } else {
      await api('/api/questoes', { method: 'POST', body });
      toast('Questão criada!', 'ok');
    }
    fecharModal();
    await carregarBancoQuestoes();
  } catch (err) { toast(err.message, 'erro'); }
}

async function excluirQuestao(id) {
  if (!confirm('Excluir esta questão?')) return;
  try {
    await api(`/api/questoes/${id}`, { method: 'DELETE' });
    toast('Questão excluída.', 'ok');
    await carregarBancoQuestoes();
  } catch (err) { toast(err.message, 'erro'); }
}

function importarQuestoesCSV() {
  abrirModal('📥 Importar Questões via CSV', `
    <p class="hint" style="margin-bottom:10px">Cole o CSV abaixo. Formato: <code>pergunta;opcaoA;opcaoB;opcaoC;opcaoD;correta;categoria;dificuldade</code></p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px;margin-bottom:10px;font-size:12px;font-family:monospace">
      pergunta;opcaoA;opcaoB;opcaoC;opcaoD;correta;categoria;dificuldade<br>
      Qual EPI protege os olhos?;Óculos de segurança;Capacete;Luva;Bota;A;EPI;facil<br>
      NR-35 trata de?;Altura;Espaço Confinado;Ergonomia;;A;NR-35;medio
    </div>
    <textarea id="csv-importar" rows="10" style="font-family:monospace;font-size:12px" placeholder="Cole o CSV aqui..."></textarea>
    <div id="csv-resultado" style="margin-top:10px"></div>
    <button class="btn btn-primary btn-block" style="margin-top:10px" onclick="confirmarImportarCSV()">📥 Importar</button>
  `);
}

async function confirmarImportarCSV() {
  const csv = document.getElementById('csv-importar')?.value.trim();
  if (!csv) return toast('Cole o conteúdo CSV no campo.', 'erro');
  const resEl = document.getElementById('csv-resultado');
  if (resEl) resEl.innerHTML = '<p class="hint">Importando...</p>';
  try {
    const r = await api('/api/questoes/importar', { method: 'POST', body: { csv } });
    let html = `<div style="padding:10px;background:#f0fdf4;border-radius:6px;color:#166534;font-weight:600">✅ ${r.importados} questão${r.importados !== 1 ? 'ões' : ''} importada${r.importados !== 1 ? 's' : ''} com sucesso!</div>`;
    if (r.erros && r.erros.length) {
      html += `<div style="margin-top:8px"><strong>⚠️ ${r.erros.length} linha${r.erros.length !== 1 ? 's' : ''} com erro:</strong><ul style="margin:6px 0 0 16px;font-size:13px">`;
      html += r.erros.map(e => `<li>Linha ${e.linha}: ${esc(e.motivo)}</li>`).join('');
      html += '</ul></div>';
    }
    if (resEl) resEl.innerHTML = html;
    if (r.importados > 0) {
      toast(`${r.importados} questões importadas!`, 'ok');
      await carregarBancoQuestoes();
    }
  } catch (err) {
    if (resEl) resEl.innerHTML = `<p class="erro">${esc(err.message)}</p>`;
    toast(err.message, 'erro');
  }
}

/* ── DDS Battle (gestor) ── */

async function carregarBattleGestor() {
  const el = document.getElementById('battle-sessoes-lista');
  if (!el) return;
  try {
    const list = await api('/api/battle/sessoes');
    if (!list.length) {
      el.innerHTML = '<p class="hint" style="text-align:center;padding:24px">Nenhuma sessão criada ainda. Clique em "⚡ Criar Sessão" para começar!</p>';
      return;
    }
    const stLabel = {
      aguardando: '<span class="battle-status-badge battle-status-aguardando">⏳ Aguardando</span>',
      ativa:      '<span class="battle-status-badge battle-status-ativa">🔴 AO VIVO</span>',
      finalizada: '<span class="battle-status-badge battle-status-finalizada">✅ Encerrada</span>'
    };
    el.innerHTML = list.map(s => `
      <div class="battle-sessao-card">
        <div class="battle-sessao-info">
          <div class="battle-sessao-titulo">${esc(s.titulo)}</div>
          <div class="battle-sessao-meta">
            ${stLabel[s.status]||''} &nbsp;
            👥 ${s.participantes} &nbsp; ❓ ${s.questoes} questões
          </div>
        </div>
        <div class="battle-codigo">${s.codigo}</div>
        ${s.status!=='finalizada'
          ? `<button class="btn btn-primary" onclick="abrirBattleSala(${s.id})">Abrir Sala</button>`
          : `<button class="btn" onclick="verRankingFinal(${s.id})">🏆 Resultado</button>`}
      </div>`).join('');
  } catch (err) { toast(err.message, 'erro'); }
}

function criarBattle() {
  if (!_bancoQuestoes.length) return toast('Crie questões no Banco de Questões primeiro.', 'erro');
  abrirModal('⚡ Criar Sessão DDS Battle', `
    <label>Título da sessão</label>
    <input type="text" id="battle-titulo" placeholder="Ex.: DDS Semanal — Trabalho em Altura">
    <label>Tempo por questão (segundos)</label>
    <input type="number" id="battle-tempo" value="30" min="10" max="120">
    <label>Filtrar por categoria</label>
    <select id="battle-cat-filtro" onchange="filtrarQuestoesBattle()" style="margin-bottom:8px">
      <option value="">Todas as categorias</option>
      ${[...new Set(_bancoQuestoes.map(q => q.categoria).filter(Boolean))].sort().map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
    </select>
    <label>Selecione as questões (máx. 20)</label>
    <div id="battle-questoes-lista" style="max-height:260px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:8px;padding:8px">
      ${_bancoQuestoes.map(q => `
        <label class="battle-q-item" data-cat="${esc(q.categoria||'')}" style="display:flex;align-items:flex-start;gap:8px;padding:6px 4px;cursor:pointer">
          <input type="checkbox" class="battle-q-check" value="${q.id}" style="margin-top:2px;flex-shrink:0">
          <span style="font-size:13px"><span class="questao-badge cat" style="font-size:11px;margin-right:4px">${esc(q.categoria||'')}</span>${esc(q.texto||q.pergunta||'')}</span>
        </label>`).join('')}
    </div>
    <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="confirmarCriarBattle()">Criar Sessão</button>`);
}

function filtrarQuestoesBattle() {
  const cat = document.getElementById('battle-cat-filtro')?.value || '';
  document.querySelectorAll('#battle-questoes-lista .battle-q-item').forEach(el => {
    el.style.display = (!cat || el.dataset.cat === cat) ? '' : 'none';
  });
}

async function confirmarCriarBattle() {
  const titulo = document.getElementById('battle-titulo')?.value.trim() || 'DDS Battle';
  const tempoPorQuestao = Number(document.getElementById('battle-tempo')?.value) || 30;
  const questoesIds = [...document.querySelectorAll('.battle-q-check:checked')].map(c => Number(c.value));
  if (!questoesIds.length) return toast('Selecione ao menos 1 questão.', 'erro');
  if (questoesIds.length > 20) return toast('Máximo 20 questões por sessão.', 'erro');
  try {
    const sess = await api('/api/battle/sessoes', { method: 'POST', body: { titulo, questoesIds, tempoPorQuestao } });
    fecharModal();
    toast(`Sessão criada! Código: ${sess.codigo}`, 'ok');
    await abrirBattleSala(sess.id);
  } catch (err) { toast(err.message, 'erro'); }
}

async function abrirBattleSala(id) {
  _battleSessaoAtiva = id;
  const main = document.getElementById('battle-gestor-main');
  const sala = document.getElementById('battle-sala');
  if (main) main.classList.add('hidden');
  if (sala) sala.classList.remove('hidden');
  iniciarPollBattle(id, 'gestor');
}

function fecharBattleSala() {
  pararPollBattle();
  _battleSessaoAtiva = null;
  const main = document.getElementById('battle-gestor-main');
  const sala = document.getElementById('battle-sala');
  if (main) main.classList.remove('hidden');
  if (sala) sala.classList.add('hidden');
  carregarBattleGestor();
}

async function iniciarBattle(id) {
  try { await api(`/api/battle/sessoes/${id}/iniciar`, { method: 'POST' }); }
  catch (err) { toast(err.message, 'erro'); }
}
async function avancarBattle(id) {
  try { await api(`/api/battle/sessoes/${id}/avancar`, { method: 'POST' }); }
  catch (err) { toast(err.message, 'erro'); }
}
async function verRankingFinal(id) {
  try {
    const s = await api(`/api/battle/sessoes/${id}`);
    abrirModal('🏆 Resultado Final', _renderRankingHtml(s.ranking || []));
  } catch (err) { toast(err.message, 'erro'); }
}

function _renderRankingHtml(ranking) {
  if (!ranking.length) return '<p class="hint" style="text-align:center;padding:20px">Sem participantes.</p>';
  const med = ['🥇','🥈','🥉'];
  return `<div style="display:flex;flex-direction:column;gap:8px">
    ${ranking.map((r,i) => `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:${i===0?'#fef9c3':i===1?'#f1f5f9':i===2?'#fdf4ff':'#f9fafb'};border-radius:10px">
        <span style="font-size:22px;width:36px;text-align:center">${med[i]||(i+1)+'º'}</span>
        <span style="flex:1;font-weight:600">${esc(r.nome)}</span>
        <span style="font-weight:700;color:#1d4ed8">${r.pontos} pts</span>
        <span style="font-size:13px;color:#6b7280">${r.acertos} acertos</span>
      </div>`).join('')}
  </div>`;
}

function renderBattleSalaGestor(s) {
  const el = document.getElementById('battle-sala');
  if (!el) return;
  const cores   = ['battle-opcao-A','battle-opcao-B','battle-opcao-C','battle-opcao-D'];
  const letras  = ['A','B','C','D'];
  if (s.status === 'aguardando') {
    el.innerHTML = `<div class="battle-sala-wrap">
      <div class="battle-sala-header">
        <div class="battle-sala-titulo">⚡ ${esc(s.titulo)}</div>
        <button class="btn" style="background:rgba(255,255,255,.15);color:#fff" onclick="fecharBattleSala()">✕</button>
      </div>
      <div class="battle-espera-msg">
        <div style="font-size:14px;color:#93c5fd;margin-bottom:10px">Compartilhe o código</div>
        <div class="battle-sala-code">${s.codigo}</div>
        <div class="big-num">${s.participantes?.length||0}</div>
        <div style="color:#93c5fd;margin-bottom:18px">participante${(s.participantes?.length||0)!==1?'s':''} conectado${(s.participantes?.length||0)!==1?'s':''}</div>
        <div class="battle-participants-list">
          ${(s.participantes||[]).map(p=>`<div class="battle-participant-chip">${esc(p.nome)}</div>`).join('')}
        </div>
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:20px;font-size:16px" onclick="iniciarBattle(${s.id})">🚀 Iniciar Battle</button>
    </div>`;
  } else if (s.status === 'ativa') {
    const q = s.questaoAtualObj;
    if (!q) return;
    const pct = Math.max(0, Math.round(((s.tempoPorQuestao-(s.tempoDecorrido||0))/s.tempoPorQuestao)*100));
    if (s.mostrandoResultado) {
      const ci = (q.opcoes||[]).findIndex(o=>o.correta);
      el.innerHTML = `<div class="battle-sala-wrap">
        <div class="battle-sala-header">
          <div class="battle-sala-titulo">Questão ${s.questaoAtual}/${s.totalQuestoes}</div>
          <button class="btn" style="background:rgba(255,255,255,.15);color:#fff" onclick="fecharBattleSala()">✕</button>
        </div>
        <div class="battle-resultado-wrap">
          <div class="battle-correta-label">✅ ${letras[ci]}) ${esc(q.opcoes[ci]?.texto||'')}</div>
          <h3 style="margin-bottom:12px">Top 5</h3>
          <div class="battle-ranking-preview">
            ${(s.ranking||[]).slice(0,5).map((r,i)=>`
              <div class="battle-ranking-row">
                <span class="battle-ranking-pos">${['🥇','🥈','🥉','4º','5º'][i]}</span>
                <span class="battle-ranking-nome">${esc(r.nome)}</span>
                <span class="battle-ranking-pts">${r.pontos} pts</span>
              </div>`).join('')}
          </div>
        </div>
        <button class="btn btn-primary btn-block" style="margin-top:18px;font-size:16px" onclick="avancarBattle(${s.id})">
          ${s.questaoAtual>=s.totalQuestoes?'🏆 Finalizar Battle':'▶ Próxima Questão'}
        </button>
      </div>`;
    } else {
      const rc = {};
      (s.participantes||[]).forEach(p => { const r=p.respostas?.[s.questaoAtual-1]; if(r!==undefined) rc[r]=(rc[r]||0)+1; });
      const total = Object.values(rc).reduce((a,b)=>a+b,0);
      el.innerHTML = `<div class="battle-sala-wrap">
        <div class="battle-sala-header">
          <div class="battle-sala-titulo">Questão ${s.questaoAtual}/${s.totalQuestoes}</div>
          <button class="btn" style="background:rgba(255,255,255,.15);color:#fff" onclick="fecharBattleSala()">✕</button>
        </div>
        <div class="battle-pergunta-wrap">
          <div class="battle-pergunta-num">Questão ${s.questaoAtual} de ${s.totalQuestoes}</div>
          <div class="battle-pergunta-texto">${esc(q.pergunta)}</div>
        </div>
        <div class="battle-timer-bar-wrap"><div class="battle-timer-bar" style="width:${pct}%"></div></div>
        <div style="text-align:center;font-size:13px;color:#93c5fd;margin-bottom:10px">${total}/${(s.participantes||[]).length} responderam</div>
        <div class="battle-opcoes-grid">
          ${(q.opcoes||[]).map((op,i)=>`
            <div class="battle-opcao ${cores[i]}">
              <span style="font-weight:800">${letras[i]}</span> ${esc(op.texto)}
              <span class="battle-resposta-count">${rc[i]||0}</span>
            </div>`).join('')}
        </div>
        <button class="btn" style="margin-top:14px;background:rgba(255,255,255,.15);color:#fff;width:100%" onclick="avancarBattle(${s.id})">
          Mostrar resultado agora ▶
        </button>
      </div>`;
    }
  } else {
    el.innerHTML = `<div class="battle-sala-wrap">
      <div class="battle-sala-header">
        <div class="battle-sala-titulo">🏆 ${esc(s.titulo)} — Resultado Final</div>
        <button class="btn" style="background:rgba(255,255,255,.15);color:#fff" onclick="fecharBattleSala()">✕ Fechar</button>
      </div>
      <div style="margin-top:16px">${_renderRankingHtml(s.ranking||[])}</div>
    </div>`;
  }
}

/* ── Flashcards (gestor) ── */

async function carregarFlashcardsGestor() {
  const el = document.getElementById('flashcards-gestor-lista');
  if (!el) return;
  try {
    const list = await api('/api/flashcards');
    if (!list.length) {
      el.innerHTML = '<p class="hint" style="text-align:center;padding:24px">Nenhum flashcard criado. Clique em "+ Novo Flashcard" para começar.</p>';
      return;
    }
    el.innerHTML = list.map(f => `
      <div class="flashcard-gestor-item">
        <div class="flashcard-frente-back">
          <div class="flashcard-frente">📋 ${esc(f.frente)}</div>
          <div class="flashcard-verso">💡 ${esc(f.verso)}</div>
          ${f.categoria?`<div style="margin-top:4px"><span class="questao-badge cat">${esc(f.categoria)}</span></div>`:''}
        </div>
        <button class="btn btn-sm" style="color:#dc2626;flex-shrink:0" onclick="excluirFlashcard(${f.id})">🗑️</button>
      </div>`).join('');
  } catch (err) { toast(err.message, 'erro'); }
}

function abrirNovoFlashcard() {
  const cats = ['NR-01','NR-05','NR-06','NR-10','NR-12','NR-18','NR-20','NR-33','NR-35',
    'APR','EPI','Primeiros Socorros','Combate a Incêndio','Ergonomia',
    'Direção Defensiva','Trabalho em Altura','Espaço Confinado','Procedimentos Gerais'];
  abrirModal('🃏 Novo Flashcard', `
    <label>Frente (pergunta/conceito) *</label>
    <textarea id="fc-frente" rows="3" placeholder="Ex.: O que é NR-35?"></textarea>
    <label>Verso (resposta/explicação) *</label>
    <textarea id="fc-verso" rows="3" placeholder="Ex.: Norma que regulamenta trabalho em altura..."></textarea>
    <label>Categoria</label>
    <select id="fc-categoria">
      ${cats.map(c=>`<option value="${c}">${c}</option>`).join('')}
    </select>
    <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="salvarFlashcard()">Criar Flashcard</button>`);
}

async function salvarFlashcard() {
  const frente    = document.getElementById('fc-frente')?.value.trim();
  const verso     = document.getElementById('fc-verso')?.value.trim();
  const categoria = document.getElementById('fc-categoria')?.value;
  if (!frente || !verso) return toast('Preencha frente e verso do flashcard.', 'erro');
  try {
    await api('/api/flashcards', { method: 'POST', body: { frente, verso, categoria } });
    fecharModal();
    toast('Flashcard criado!', 'ok');
    await carregarFlashcardsGestor();
  } catch (err) { toast(err.message, 'erro'); }
}

async function excluirFlashcard(id) {
  if (!confirm('Excluir este flashcard?')) return;
  try {
    await api(`/api/flashcards/${id}`, { method: 'DELETE' });
    toast('Flashcard excluído.', 'ok');
    await carregarFlashcardsGestor();
  } catch (err) { toast(err.message, 'erro'); }
}

/* ── Analytics ── */

async function carregarAnalytics() {
  try {
    const [score, frags, comp] = await Promise.all([
      api('/api/analytics/score'),
      api('/api/analytics/fragilidades'),
      api('/api/analytics/comparativo'),
    ]);
    renderAnalyticsScore(score);
    renderFragilidades(frags);
    renderComparativo(comp);
  } catch (err) { toast(err.message, 'erro'); }
}

function renderAnalyticsScore(s) {
  const el = document.getElementById('analytics-score-box');
  if (!el) return;
  const c = s.score>=80?'#4ade80':s.score>=60?'#fbbf24':s.score>=40?'#fb923c':'#f87171';
  el.innerHTML = `
    <div class="analytics-score-num" style="color:${c}">${s.score}</div>
    <div class="analytics-score-info">
      <div class="analytics-score-nivel">${esc(s.nivel)}</div>
      <div class="analytics-score-detail">
        Taxa de acerto: ${Math.round((s.txAcerto||0)*100)}% &nbsp;|&nbsp;
        Participação: ${Math.round((s.txPartic||0)*100)}%
      </div>
    </div>`;
}

function renderFragilidades(list) {
  const el = document.getElementById('analytics-fragilidades');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<p class="hint" style="text-align:center;padding:20px">Nenhuma fragilidade identificada. Parabéns!</p>';
    return;
  }
  el.innerHTML = list.map(f => `
    <div class="fragilidade-item">
      <div class="fragilidade-pergunta">${esc(f.pergunta)}</div>
      <div class="fragilidade-bar-wrap">
        <div class="fragilidade-bar" style="width:${Math.round(f.txErro*100)}%"></div>
      </div>
      <div class="fragilidade-meta">
        ${Math.round(f.txErro*100)}% de erro &nbsp;|&nbsp;
        <span class="questao-badge cat" style="display:inline">${esc(f.categoria||'')}</span> &nbsp;
        ${f.total} respostas
      </div>
    </div>`).join('');
}

function renderComparativo(list) {
  const el = document.getElementById('analytics-comparativo');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<p class="hint" style="text-align:center;padding:20px">Dados insuficientes para comparativo.</p>';
    return;
  }
  const max = Math.max(...list.map(r=>r.txAcerto||0), 0.01);
  const bc  = v => v>=0.8?'#22c55e':v>=0.6?'#f59e0b':'#ef4444';
  el.innerHTML = list.map(r => `
    <div class="comparativo-row">
      <div class="comparativo-equipe">
        <span>${esc(r.equipe||'Sem equipe')}</span>
        <span>${Math.round((r.txAcerto||0)*100)}% acerto — ${r.participantes} participantes</span>
      </div>
      <div class="comparativo-bar-wrap">
        <div class="comparativo-bar" style="width:${Math.round((r.txAcerto/max)*100)}%;background:${bc(r.txAcerto)}"></div>
      </div>
    </div>`).join('');
}

/* ── Polling battle ── */

function iniciarPollBattle(id, role) {
  pararPollBattle();
  _pollBattleOnce(id, role);
  _battlePollTimer = setInterval(() => _pollBattleOnce(id, role), 2000);
}
function pararPollBattle() {
  if (_battlePollTimer) { clearInterval(_battlePollTimer); _battlePollTimer = null; }
}
async function _pollBattleOnce(id, role) {
  try {
    const s = await api(`/api/battle/sessoes/${id}`);
    if (role === 'gestor') renderBattleSalaGestor(s);
    else renderBattleSalaColab(s);
    if (s.status === 'finalizada') pararPollBattle();
  } catch { /* silent */ }
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
  renderOrgChartQeq('cipa', 'qeq-org-cipa');
  renderOrgChartQeq('brigada', 'qeq-org-brigada');
  renderOrgChartQeq('sesmt', 'qeq-org-sesmt');
}

function qeqTab(tab) {
  document.querySelectorAll('#qeq-tabs .quiz-tab').forEach(b => b.classList.toggle('active', b.dataset.qeqtab === tab));
  ['diretorio','cipa','brigada','sesmt'].forEach(t => {
    const el = document.getElementById('qeqtab-' + t);
    if (el) el.classList.toggle('hidden', t !== tab);
  });
}

function buscaInteligenteQeq() {
  const q = (document.getElementById('qeq-smart-busca') || {}).value || '';
  const el = document.getElementById('qeq-smart-resultado');
  if (!el) return;
  buscaInteligente(q, QEQ_LISTA, el);
}

function buscaInteligenteQeqColab() {
  const q = (document.getElementById('cqeq-smart-busca') || {}).value || '';
  const el = document.getElementById('cqeq-smart-resultado');
  if (!el) return;
  buscaInteligente(q, CQEQ_LISTA, el);
}

function buscaInteligente(q, lista, el) {
  if (!q || q.length < 3) { el.innerHTML = ''; return; }
  const qLow = q.toLowerCase();
  // Detect intent from natural language
  const rolemap = { 'presidente':'cipa_presidente','vice':'cipa_vice','secretário':'cipa_secretario','titular':'cipa_titular','suplente':'cipa_suplente','coordenador':'brigada_coordenador','líder':'brigada_lider','brigadista':'brigada_brigadista','socorrista':'brigada_socorrista','cipa':'cipa','brigada':'brigada','sesmt':'sesmt','técnico':'tecnico_seguranca','médico':'medico_trabalho','ergonomista':'ergonomista','liderança':'lideranca' };
  let results = [];
  for (const [keyword, role] of Object.entries(rolemap)) {
    if (qLow.includes(keyword)) {
      results = lista.filter(p => {
        if (p.roles && p.roles.includes(role)) return true;
        if (p.subRoles && p.subRoles.some(sr => sr.cargo === role)) return true;
        return false;
      });
      break;
    }
  }
  if (!results.length) {
    results = lista.filter(p => [p.nome, p.funcao, p.setor, p.equipe].join(' ').toLowerCase().includes(qLow));
  }
  if (!results.length) { el.innerHTML = '<p class="hint">Nenhum resultado encontrado.</p>'; return; }
  el.innerHTML = `<div class="qeq-grid" style="margin-top:0">${results.slice(0,4).map(p => renderQeqCard(p)).join('')}</div>`;
}

function renderOrgChartQeq(tipo, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const CARGO_ORDER = tipo === 'cipa'
    ? ['cipa_presidente','cipa_vice','cipa_secretario','cipa_titular','cipa_suplente']
    : tipo === 'brigada'
    ? ['brigada_coordenador','brigada_lider','brigada_brigadista','brigada_socorrista']
    : ['sesmt'];
  const CARGO_LABELS = {
    cipa_presidente:'Presidente',cipa_vice:'Vice-Presidente',cipa_secretario:'Secretário',
    cipa_titular:'Titular',cipa_suplente:'Suplente',
    brigada_coordenador:'Coordenador Geral',brigada_lider:'Líder de Brigada',
    brigada_brigadista:'Brigadista',brigada_socorrista:'Socorrista',
    sesmt:'Equipe SESMT'
  };
  const GRUPO_ICONS = { cipa:'⚠️', brigada:'🚒', sesmt:'🦺' };
  const lista = QEQ_LISTA.length ? QEQ_LISTA : CQEQ_LISTA;
  if (!lista.length) { el.innerHTML = '<p class="hint" style="padding:24px;text-align:center">Nenhum integrante cadastrado.</p>'; return; }
  let membros;
  if (tipo === 'sesmt') {
    membros = lista.filter(p => p.roles && p.roles.includes('sesmt'));
    el.innerHTML = `<div class="org-chart-section"><div class="org-chart-title">${GRUPO_ICONS.sesmt} SESMT</div>
      <div class="org-chart-group"><div class="qeq-grid">${membros.length ? membros.map(p => renderQeqCard(p)).join('') : '<p class="hint">Sem integrantes.</p>'}</div></div></div>`;
    return;
  }
  let html = `<div class="org-chart-section">`;
  for (const cargo of CARGO_ORDER) {
    membros = lista.filter(p => p.subRoles && p.subRoles.some(sr => sr.cargo === cargo));
    if (!membros.length) continue;
    html += `<div class="org-chart-level">
      <div class="org-chart-level-label">${GRUPO_ICONS[tipo]} ${CARGO_LABELS[cargo] || cargo}</div>
      <div class="qeq-grid">${membros.map(p => renderQeqCardOrg(p, cargo)).join('')}</div>
    </div>`;
  }
  // show members with just the group role but no specific cargo
  const semCargo = lista.filter(p => p.roles && p.roles.includes(tipo) && (!p.subRoles || !p.subRoles.some(sr => sr.cargo.startsWith(tipo + '_'))));
  if (semCargo.length) html += `<div class="org-chart-level"><div class="org-chart-level-label">${GRUPO_ICONS[tipo]} Integrantes</div><div class="qeq-grid">${semCargo.map(p => renderQeqCard(p)).join('')}</div></div>`;
  html += `</div>`;
  el.innerHTML = html || '<p class="hint" style="padding:24px;text-align:center">Nenhum integrante com cargo definido. Atribua funções em Papéis → editar colaborador.</p>';
}

function renderQeqCardOrg(p, cargo) {
  const avatarBg = p.roles.includes('sesmt') ? 'var(--azul)' : p.roles.includes('cipa') ? '#e8801a' : p.roles.includes('brigada') ? '#c43a3a' : '#637080';
  const initial = (p.nome || '?').charAt(0).toUpperCase();
  const foto = p.foto ? `<img src="${p.foto}" alt="" class="qeq-avatar-img">` : `<div class="qeq-avatar" style="background:${avatarBg}">${initial}</div>`;
  return `<div class="qeq-card" onclick="abrirPerfilQeq(${p.id})">
    ${foto}
    <div class="qeq-info">
      <div class="qeq-nome">${esc(p.nome)}</div>
      <div class="qeq-funcao hint">${esc(p.funcao || p.setor || '—')}</div>
      ${p.emailCorp ? `<div class="hint" style="font-size:11px">✉ ${esc(p.emailCorp)}</div>` : ''}
      ${p.telefone ? `<div class="hint" style="font-size:11px">📱 ${esc(p.telefone)}</div>` : ''}
    </div>
  </div>`;
}

function abrirPerfilQeq(id) {
  const p = (QEQ_LISTA.length ? QEQ_LISTA : CQEQ_LISTA).find(x => x.id === id);
  if (!p) return;
  const avatarBg = p.roles.includes('sesmt') ? 'var(--azul)' : p.roles.includes('cipa') ? '#e8801a' : p.roles.includes('brigada') ? '#c43a3a' : '#637080';
  const initial = (p.nome || '?').charAt(0).toUpperCase();
  const foto = p.foto ? `<img src="${p.foto}" alt="" style="width:80px;height:80px;border-radius:50%;object-fit:cover;margin:0 auto 12px;display:block">`
    : `<div style="width:80px;height:80px;border-radius:50%;background:${avatarBg};color:#fff;font-size:32px;font-weight:900;display:flex;align-items:center;justify-content:center;margin:0 auto 12px">${initial}</div>`;
  const cargosSr = (p.subRoles || []).map(sr => `<span class="badge">${esc(sr.cargo.replace(/_/g,' '))}</span>`).join(' ');
  abrirModal('👤 Perfil', `
    ${foto}
    <div style="text-align:center;margin-bottom:16px">
      <div style="font-size:18px;font-weight:700">${esc(p.nome)}</div>
      <div class="hint">${esc(p.funcao || '—')} · ${esc(p.setor || '—')}</div>
      <div style="margin-top:6px">${renderRoleBadges(p.roles)} ${cargosSr}</div>
    </div>
    <div style="display:grid;gap:6px;font-size:13px">
      ${p.equipe ? `<div><strong>Equipe:</strong> ${esc(p.equipe)}</div>` : ''}
      ${p.unidade ? `<div><strong>Unidade:</strong> ${esc(p.unidade)}</div>` : ''}
      ${p.telefone ? `<div><strong>Telefone:</strong> ${esc(p.telefone)}</div>` : ''}
      ${p.emailCorp ? `<div><strong>E-mail corp.:</strong> ${esc(p.emailCorp)}</div>` : ''}
      ${p.gestorDireto ? `<div><strong>Gestor:</strong> ${esc(p.gestorDireto)}</div>` : ''}
    </div>`);
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
  const avatarBg = p.roles.includes('sesmt') ? 'var(--azul)' : p.roles.includes('cipa') ? '#e8801a' : p.roles.includes('brigada') ? '#c43a3a' : p.roles.includes('lideranca') ? '#7b5ea7' : '#637080';
  const initial = (p.nome || '?').charAt(0).toUpperCase();
  const foto = p.foto
    ? `<img src="${p.foto}" alt="" class="qeq-avatar-img">`
    : `<div class="qeq-avatar" style="background:${avatarBg}">${initial}</div>`;
  return `<div class="qeq-card" onclick="abrirPerfilQeq(${p.id})">
    ${foto}
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
  renderOrgChartQeq('cipa', 'cqeq-org-cipa');
  renderOrgChartQeq('brigada', 'cqeq-org-brigada');
  renderOrgChartQeq('sesmt', 'cqeq-org-sesmt');
}

function cqeqTab(tab) {
  document.querySelectorAll('#cqeq-tabs .quiz-tab').forEach(b => b.classList.toggle('active', b.dataset.cqeqtab === tab));
  ['diretorio','cipa','brigada','sesmt'].forEach(t => {
    const el = document.getElementById('cqeqtab-' + t);
    if (el) el.classList.toggle('hidden', t !== tab);
  });
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

/* ── DDS Battle (colaborador) ── */

let _battleColabSessaoId = null;

async function carregarBattleColab() {
  const el = document.getElementById('battle-colab-area');
  if (!el) return;
  pararPollBattle();
  _battleColabSessaoId = null;
  el.innerHTML = `
    <div class="battle-join-card">
      <div style="font-size:48px;margin-bottom:12px">⚡</div>
      <h3>DDS Battle</h3>
      <p class="hint" style="margin-bottom:18px">Aguarde o gestor iniciar uma sessão e insira o código abaixo.</p>
      <label>Código da sessão</label>
      <input type="text" id="battle-codigo-input" placeholder="Ex.: ABC123" maxlength="8"
        style="text-align:center;font-size:22px;font-weight:800;letter-spacing:4px;text-transform:uppercase"
        oninput="this.value=this.value.toUpperCase()">
      <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="entrarBattle()">Entrar na sessão</button>
    </div>`;
}

async function entrarBattle() {
  const codigo = document.getElementById('battle-codigo-input')?.value.trim().toUpperCase();
  if (!codigo) return toast('Digite o código da sessão.', 'erro');
  try {
    const r = await api('/api/battle/entrar', { method: 'POST', body: { codigo } });
    _battleColabSessaoId = r.sessaoId;
    iniciarPollBattle(r.sessaoId, 'colab');
  } catch (err) { toast(err.message, 'erro'); }
}

function renderBattleSalaColab(s) {
  const el = document.getElementById('battle-colab-area');
  if (!el) return;
  const cores  = ['#ef4444','#3b82f6','#f59e0b','#10b981'];
  const letras = ['A','B','C','D'];
  if (s.status === 'aguardando') {
    el.innerHTML = `
      <div class="battle-play-wrap" style="text-align:center">
        <div style="font-size:13px;color:#93c5fd;margin-bottom:8px">Você está na sessão</div>
        <div style="font-size:28px;font-weight:900;color:#fbbf24;margin-bottom:6px">${esc(s.titulo||'DDS Battle')}</div>
        <div class="battle-aguardando-txt">
          <div style="font-size:48px">⏳</div>
          <p>Aguardando o gestor iniciar...</p>
        </div>
      </div>`;
  } else if (s.status === 'ativa') {
    if (!s.questaoAtualObj) return;
    const q = s.questaoAtualObj;
    if (s.mostrandoResultado) {
      const ci = q.respostaCorreta ?? 0;
      const minha = s.minhaResposta;
      const acertei = minha === ci;
      el.innerHTML = `
        <div class="battle-play-wrap">
          <div style="text-align:center;margin-bottom:16px">
            <div style="font-size:13px;color:#93c5fd">Questão ${s.questaoAtual}/${s.totalQuestoes}</div>
            <div style="font-size:18px;font-weight:700;margin:8px 0">${esc(q.pergunta)}</div>
          </div>
          <div style="text-align:center;font-size:32px;margin-bottom:10px">${acertei?'✅':'❌'}</div>
          <div style="text-align:center;font-size:15px;font-weight:600;color:${acertei?'#4ade80':'#f87171'};margin-bottom:10px">
            ${acertei?`Correto! +${s.mesPontos||0} pts nesta rodada`:'Incorreto!'}
          </div>
          <div style="text-align:center;font-size:13px;color:#93c5fd">
            Resposta correta: <strong style="color:#fff">${letras[ci]}) ${esc(q.opcoes[ci]?.texto||'')}</strong>
          </div>
          <div style="text-align:center;margin-top:14px;color:#93c5fd;font-size:13px">
            Aguardando próxima questão...
          </div>
          <div style="text-align:center;margin-top:10px;font-size:22px;font-weight:700;color:#fbbf24">
            ${s.mesPontos||0} pts
          </div>
        </div>`;
    } else {
      const jaRespondeu = s.minhaResposta !== undefined && s.minhaResposta !== null;
      const pct = Math.max(0, Math.round(((s.tempoPorQuestao-(s.tempoDecorrido||0))/s.tempoPorQuestao)*100));
      el.innerHTML = `
        <div class="battle-play-wrap">
          <div style="text-align:center;margin-bottom:12px">
            <div style="font-size:13px;color:#93c5fd">Questão ${s.questaoAtual}/${s.totalQuestoes}</div>
            <div style="font-size:19px;font-weight:700;margin-top:8px">${esc(q.pergunta)}</div>
          </div>
          <div class="battle-timer-bar-wrap"><div class="battle-timer-bar" style="width:${pct}%"></div></div>
          <div style="margin-top:14px">
            ${(q.opcoes||[]).map((op, i) => `
              <button class="battle-opcao-btn-colab${s.minhaResposta===i?' selecionada':''}"
                style="background:${cores[i]}"
                onclick="responderBattle(${s.id},${i})"
                ${jaRespondeu?'disabled':''}>
                <span style="font-weight:800;font-size:17px">${letras[i]}</span>
                ${esc(op.texto)}
              </button>`).join('')}
          </div>
          ${jaRespondeu?'<div style="text-align:center;color:#93c5fd;font-size:13px;margin-top:10px">Resposta enviada. Aguardando...</div>':''}
        </div>`;
    }
  } else {
    pararPollBattle();
    el.innerHTML = `
      <div class="battle-play-wrap" style="text-align:center">
        <div style="font-size:48px;margin-bottom:12px">🏆</div>
        <h3>Battle encerrada!</h3>
        <div style="margin-bottom:16px">
          ${_renderRankingHtml(s.ranking||[])}
        </div>
        <button class="btn btn-primary" onclick="carregarBattleColab()">Nova sessão</button>
      </div>`;
  }
}

async function responderBattle(sessaoId, opcao) {
  try {
    await api(`/api/battle/sessoes/${sessaoId}/responder`, { method: 'POST', body: { opcao } });
  } catch (err) { toast(err.message, 'erro'); }
}

/* ── Flashcards (colaborador) ── */

let _flashcardsHoje = [];
let _fcAtual = 0;
let _fcVirada = false;

async function carregarFlashcardsColab() {
  const el = document.getElementById('flashcards-colab-area');
  if (!el) return;
  el.innerHTML = '<p class="hint" style="text-align:center;padding:24px">Carregando...</p>';
  try {
    const list = await api('/api/flashcards/hoje');
    _flashcardsHoje = list;
    _fcAtual = 0;
    if (!list.length) {
      el.innerHTML = `
        <div class="fc-done-msg">
          <span class="big-emoji">🎉</span>
          <h3>Parabéns!</h3>
          <p class="hint">Você revisou todos os flashcards de hoje. Volte amanhã!</p>
        </div>`;
      return;
    }
    renderFlashcardAtual();
  } catch (err) {
    el.innerHTML = '<p class="hint" style="text-align:center;padding:24px">Erro ao carregar flashcards.</p>';
  }
}

function renderFlashcardAtual() {
  const el = document.getElementById('flashcards-colab-area');
  if (!el) return;
  if (_fcAtual >= _flashcardsHoje.length) {
    el.innerHTML = `
      <div class="fc-done-msg">
        <span class="big-emoji">🎉</span>
        <h3>Sessão concluída!</h3>
        <p class="hint">Você revisou ${_flashcardsHoje.length} flashcard${_flashcardsHoje.length!==1?'s':''} hoje. +${_flashcardsHoje.length*5} pontos ganhos!</p>
        <button class="btn btn-primary" style="margin-top:14px" onclick="carregarFlashcardsColab()">Revisar novamente</button>
      </div>`;
    return;
  }
  _fcVirada = false;
  const f = _flashcardsHoje[_fcAtual];
  el.innerHTML = `
    <div class="fc-progress">Flashcard <strong>${_fcAtual+1}</strong> de <strong>${_flashcardsHoje.length}</strong></div>
    <div class="fc-flip-wrap" id="fc-flip" onclick="virarFlashcard()" title="Clique para ver a resposta">
      <div class="fc-flip-inner">
        <div class="fc-face fc-frente">
          <div class="fc-label">PERGUNTA</div>
          <div class="fc-text">${esc(f.frente)}</div>
          <div class="fc-hint">Clique para ver a resposta</div>
        </div>
        <div class="fc-face fc-verso">
          <div class="fc-label">RESPOSTA</div>
          <div class="fc-text">${esc(f.verso)}</div>
          ${f.categoria?`<div class="fc-hint">${esc(f.categoria)}</div>`:''}
        </div>
      </div>
    </div>
    <div id="fc-btns" class="fc-btns" style="display:none">
      <button class="fc-btn fc-btn-dificil" onclick="avaliarFlashcard(${f.id},'dificil')">😓 Difícil</button>
      <button class="fc-btn fc-btn-medio"   onclick="avaliarFlashcard(${f.id},'medio')">🤔 Médio</button>
      <button class="fc-btn fc-btn-facil"   onclick="avaliarFlashcard(${f.id},'facil')">😊 Fácil</button>
    </div>`;
}

function virarFlashcard() {
  _fcVirada = !_fcVirada;
  const flip = document.getElementById('fc-flip');
  const btns = document.getElementById('fc-btns');
  if (flip) flip.classList.toggle('flipped', _fcVirada);
  if (btns) btns.style.display = _fcVirada ? 'flex' : 'none';
}

async function avaliarFlashcard(id, avaliacao) {
  try {
    await api(`/api/flashcards/${id}/responder`, { method: 'POST', body: { avaliacao } });
    _fcAtual++;
    renderFlashcardAtual();
  } catch (err) { toast(err.message, 'erro'); }
}

/* ── SafePoint 2.4 — Estrutura SST (gestor) ── */

let _estruturaData = null;
let _etabAtiva = 'organograma';
let _acessosAll = [];

async function carregarEstrutura() {
  _etabAtiva = 'organograma';
  document.querySelectorAll('#estrutura-tabs .quiz-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.etab === 'organograma'));
  document.querySelectorAll('[id^="etab-"]').forEach(p =>
    p.classList.toggle('hidden', p.id !== 'etab-organograma'));
  await carregarEstruturaOrganograma();
}

function estruturaTab(tab) {
  _etabAtiva = tab;
  document.querySelectorAll('#estrutura-tabs .quiz-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.etab === tab));
  document.querySelectorAll('[id^="etab-"]').forEach(p =>
    p.classList.toggle('hidden', p.id !== 'etab-' + tab));
  if (tab === 'organograma')  carregarEstruturaOrganograma();
  if (tab === 'cipa')         carregarCipaCargos();
  if (tab === 'brigada')      carregarBrigadaCargos();
  if (tab === 'acessos')      carregarAcessos();
  if (tab === 'auditoria')    carregarAuditoria();
  if (tab === 'moedas')       carregarMoedasRanking();
}

async function carregarEstruturaOrganograma() {
  const el = document.getElementById('estrutura-organograma');
  if (!el) return;
  try {
    _estruturaData = await api('/api/estrutura');
    const d = _estruturaData;
    const secaoHtml = (titulo, emoji, lista) => {
      if (!lista || !lista.length) return '';
      return `<div class="org-grupo">
        <div class="org-grupo-header">${emoji} ${titulo} (${lista.length})</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;padding:10px">
          ${lista.map(e => {
            const mandato = e.mandato || {};
            const mandatoTxt = mandato.inicioMandato ? ` <span class="hint">${mandato.inicioMandato}${mandato.fimMandato ? ' → ' + mandato.fimMandato : ''}</span>` : '';
            return `<div class="org-membro" style="cursor:pointer" onclick="abrirCarteirinha(${e.id})">
              <div style="font-weight:600;font-size:13px">${esc(e.nome)}</div>
              <div class="hint" style="font-size:11px">${esc(e.funcao || '')}${e.setor ? ' — ' + esc(e.setor) : ''}</div>
              ${mandatoTxt}
            </div>`;
          }).join('')}
        </div>
      </div>`;
    };
    el.innerHTML = `
      ${secaoHtml('SESMT', '🦺', d.sesmt)}
      <div class="panel" style="margin-bottom:12px">
        <h4 style="margin:0 0 8px">⚠️ CIPA — ${(d.cipa?.todos || []).length} membros</h4>
        ${secaoHtml('Presidente', '📋', d.cipa?.presidente)}
        ${secaoHtml('Vice-Presidente', '🤝', d.cipa?.vice)}
        ${secaoHtml('Secretário', '📝', d.cipa?.secretario)}
        ${secaoHtml('Titulares', '👥', d.cipa?.titulares)}
        ${secaoHtml('Suplentes', '📌', d.cipa?.suplentes)}
        ${!(d.cipa?.presidente?.length || d.cipa?.vice?.length || d.cipa?.secretario?.length || d.cipa?.titulares?.length || d.cipa?.suplentes?.length) && (d.cipa?.todos || []).length ? secaoHtml('Membros', '⚠️', d.cipa?.todos) : ''}
        ${!(d.cipa?.todos || []).length ? '<p class="hint" style="padding:12px">Nenhum membro da CIPA. Atribua o papel CIPA a colaboradores.</p>' : ''}
      </div>
      <div class="panel" style="margin-bottom:12px">
        <h4 style="margin:0 0 8px">🚒 Brigada — ${(d.brigada?.todos || []).length} membros</h4>
        ${secaoHtml('Coordenador', '🚨', d.brigada?.coordenador)}
        ${secaoHtml('Líderes', '🦺', d.brigada?.lideres)}
        ${secaoHtml('Brigadistas', '🔥', d.brigada?.brigadistas)}
        ${secaoHtml('Socorristas', '🚑', d.brigada?.socorristas)}
        ${!(d.brigada?.coordenador?.length || d.brigada?.lideres?.length || d.brigada?.brigadistas?.length || d.brigada?.socorristas?.length) && (d.brigada?.todos || []).length ? secaoHtml('Membros', '🚒', d.brigada?.todos) : ''}
        ${!(d.brigada?.todos || []).length ? '<p class="hint" style="padding:12px">Nenhum membro da Brigada. Atribua o papel Brigada a colaboradores.</p>' : ''}
      </div>
      ${secaoHtml('Técnico de Segurança', '🔧', d.tecnico_seguranca)}
      ${secaoHtml('Médico do Trabalho', '🩺', d.medico_trabalho)}
      ${secaoHtml('Ergonomista', '🪑', d.ergonomista)}
    `;
    carregarEstruturaCardHome(d);
  } catch (err) { if (el) el.innerHTML = '<p class="hint" style="padding:20px">Erro ao carregar estrutura.</p>'; }
}

function carregarEstruturaCardHome(d) {
  const el = document.getElementById('estrutura-card-resumo');
  if (!el) return;
  const partes = [];
  if ((d.sesmt || []).length) partes.push(`🦺 ${d.sesmt.length} SESMT`);
  if ((d.cipa?.todos || []).length) partes.push(`⚠️ ${d.cipa.todos.length} CIPA`);
  if ((d.brigada?.todos || []).length) partes.push(`🚒 ${d.brigada.todos.length} Brigada`);
  el.textContent = partes.length ? partes.join(' · ') : 'Toque para ver a equipe de segurança';
}

async function carregarCipaCargos() {
  const el = document.getElementById('cipa-cargos-lista');
  if (!el) return;
  try {
    const d = _estruturaData || await api('/api/estrutura');
    _estruturaData = d;
    const cargos = [
      { label: 'Presidente da CIPA',      emoji: '📋', lista: d.cipa?.presidente || [] },
      { label: 'Vice-Presidente da CIPA', emoji: '🤝', lista: d.cipa?.vice || [] },
      { label: 'Secretário da CIPA',      emoji: '📝', lista: d.cipa?.secretario || [] },
      { label: 'Membro Titular',          emoji: '👥', lista: d.cipa?.titulares || [] },
      { label: 'Membro Suplente',         emoji: '📌', lista: d.cipa?.suplentes || [] },
    ];
    el.innerHTML = cargos.map(c => `
      <div class="panel" style="margin-bottom:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <strong>${c.emoji} ${c.label}</strong>
          <span class="hint">${c.lista.length} ${c.lista.length === 1 ? 'membro' : 'membros'}</span>
        </div>
        ${c.lista.length ? c.lista.map(e => `
          <div class="cargo-membro-row">
            <div>
              <div style="font-weight:600;font-size:13px">${esc(e.nome)}</div>
              ${e.mandato?.inicioMandato ? `<div class="hint" style="font-size:11px">Mandato: ${e.mandato.inicioMandato}${e.mandato.fimMandato ? ' → ' + e.mandato.fimMandato : ''}</div>` : ''}
            </div>
            <button class="btn btn-sm" style="color:#dc2626" onclick="removerCargo(${e.id},'${_cargoKeyByCipaLabel(c.label)}')">✕</button>
          </div>`).join('') : '<p class="hint" style="font-size:12px;padding:4px 0">Nenhum membro atribuído.</p>'}
      </div>`).join('');
  } catch (err) { toast(err.message, 'erro'); }
}

function _cargoKeyByCipaLabel(label) {
  const map = { 'Presidente da CIPA': 'cipa_presidente', 'Vice-Presidente da CIPA': 'cipa_vice', 'Secretário da CIPA': 'cipa_secretario', 'Membro Titular': 'cipa_titular', 'Membro Suplente': 'cipa_suplente' };
  return map[label] || '';
}
function _cargoKeyByBrigadaLabel(label) {
  const map = { 'Coordenador Geral da Brigada': 'brigada_coordenador', 'Líder de Brigada': 'brigada_lider', 'Brigadista': 'brigada_brigadista', 'Socorrista': 'brigada_socorrista' };
  return map[label] || '';
}

async function carregarBrigadaCargos() {
  const el = document.getElementById('brigada-cargos-lista');
  if (!el) return;
  try {
    const d = _estruturaData || await api('/api/estrutura');
    _estruturaData = d;
    const cargos = [
      { label: 'Coordenador Geral da Brigada', emoji: '🚨', lista: d.brigada?.coordenador || [] },
      { label: 'Líder de Brigada',             emoji: '🦺', lista: d.brigada?.lideres || [] },
      { label: 'Brigadista',                   emoji: '🔥', lista: d.brigada?.brigadistas || [] },
      { label: 'Socorrista',                   emoji: '🚑', lista: d.brigada?.socorristas || [] },
    ];
    el.innerHTML = cargos.map(c => `
      <div class="panel" style="margin-bottom:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <strong>${c.emoji} ${c.label}</strong>
          <span class="hint">${c.lista.length} ${c.lista.length === 1 ? 'membro' : 'membros'}</span>
        </div>
        ${c.lista.length ? c.lista.map(e => `
          <div class="cargo-membro-row">
            <div>
              <div style="font-weight:600;font-size:13px">${esc(e.nome)}</div>
              ${e.mandato?.inicioMandato ? `<div class="hint" style="font-size:11px">Mandato: ${e.mandato.inicioMandato}${e.mandato.fimMandato ? ' → ' + e.mandato.fimMandato : ''}</div>` : ''}
            </div>
            <button class="btn btn-sm" style="color:#dc2626" onclick="removerCargo(${e.id},'${_cargoKeyByBrigadaLabel(c.label)}')">✕</button>
          </div>`).join('') : '<p class="hint" style="font-size:12px;padding:4px 0">Nenhum membro atribuído.</p>'}
      </div>`).join('');
  } catch (err) { toast(err.message, 'erro'); }
}

function abrirAtribuirCargo(tipo) {
  const cargos = tipo === 'cipa' ? [
    { value: 'cipa_presidente',  label: 'Presidente da CIPA' },
    { value: 'cipa_vice',        label: 'Vice-Presidente da CIPA' },
    { value: 'cipa_secretario',  label: 'Secretário da CIPA' },
    { value: 'cipa_titular',     label: 'Membro Titular' },
    { value: 'cipa_suplente',    label: 'Membro Suplente' },
  ] : [
    { value: 'brigada_coordenador', label: 'Coordenador Geral da Brigada' },
    { value: 'brigada_lider',       label: 'Líder de Brigada' },
    { value: 'brigada_brigadista',  label: 'Brigadista' },
    { value: 'brigada_socorrista',  label: 'Socorrista' },
  ];
  const membros = tipo === 'cipa'
    ? COLABORADORES.filter(c => (c.roles || []).includes('cipa'))
    : COLABORADORES.filter(c => (c.roles || []).includes('brigada'));
  if (!membros.length) {
    return abrirModal('Atribuir Cargo', `<p class="hint">Nenhum colaborador com papel ${tipo === 'cipa' ? 'CIPA' : 'Brigada'} encontrado. Atribua o papel primeiro na seção Papéis.</p><div class="modal-rodape"><button class="btn" onclick="fecharModal()">Fechar</button></div>`);
  }
  abrirModal(`Atribuir Cargo — ${tipo === 'cipa' ? 'CIPA' : 'Brigada'}`, `
    <label>Colaborador</label>
    <select id="cargo-emp-sel">
      ${membros.map(c => `<option value="${c.id}">${esc(c.nome)} (${esc(c.matricula)})</option>`).join('')}
    </select>
    <label style="margin-top:10px">Cargo</label>
    <select id="cargo-tipo-sel">
      ${cargos.map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
    </select>
    <label style="margin-top:10px">Início do mandato</label>
    <input type="date" id="cargo-inicio">
    <label style="margin-top:10px">Fim do mandato</label>
    <input type="date" id="cargo-fim">
    <div class="modal-rodape">
      <button class="btn" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="confirmarAtribuirCargo()">Atribuir</button>
    </div>`);
}

async function confirmarAtribuirCargo() {
  const empId = document.getElementById('cargo-emp-sel')?.value;
  const cargo = document.getElementById('cargo-tipo-sel')?.value;
  const inicioMandato = document.getElementById('cargo-inicio')?.value || '';
  const fimMandato = document.getElementById('cargo-fim')?.value || '';
  if (!empId || !cargo) return toast('Selecione colaborador e cargo.', 'erro');
  try {
    await api(`/api/colaboradores/${empId}/subroles`, { method: 'POST', body: { cargo, inicioMandato, fimMandato } });
    fecharModal();
    toast('Cargo atribuído com sucesso!', 'ok');
    _estruturaData = null;
    if (_etabAtiva === 'cipa') carregarCipaCargos();
    else if (_etabAtiva === 'brigada') carregarBrigadaCargos();
    else carregarEstruturaOrganograma();
  } catch (err) { toast(err.message, 'erro'); }
}

async function removerCargo(empId, cargo) {
  if (!confirm('Remover este cargo?')) return;
  try {
    await api(`/api/colaboradores/${empId}/subroles/${cargo}`, { method: 'DELETE' });
    toast('Cargo removido.', 'ok');
    _estruturaData = null;
    if (_etabAtiva === 'cipa') carregarCipaCargos();
    else if (_etabAtiva === 'brigada') carregarBrigadaCargos();
    else carregarEstruturaOrganograma();
  } catch (err) { toast(err.message, 'erro'); }
}

/* Acessos */
async function carregarAcessos() {
  const el = document.getElementById('acessos-lista');
  if (!el) return;
  try {
    _acessosAll = await api('/api/colaboradores');
    filtrarAcessos();
  } catch (err) { el.innerHTML = '<p class="hint" style="padding:20px">Erro ao carregar acessos.</p>'; }
}

function filtrarAcessos() {
  const el = document.getElementById('acessos-lista');
  if (!el) return;
  const busca = (document.getElementById('acessos-busca')?.value || '').toLowerCase();
  const status = document.getElementById('acessos-status')?.value || '';
  let lista = _acessosAll.filter(c => c.ativo !== false);
  if (busca) lista = lista.filter(c => c.nome.toLowerCase().includes(busca) || (c.matricula || '').toLowerCase().includes(busca));
  if (status === 'bloqueado') lista = lista.filter(c => c.bloqueado);
  else if (status === 'ativo') lista = lista.filter(c => !c.bloqueado);
  if (!lista.length) { el.innerHTML = '<p class="hint" style="padding:20px;text-align:center">Nenhum colaborador encontrado.</p>'; return; }
  el.innerHTML = `<table class="tabela">
    <thead><tr><th>Nome</th><th>Matrícula</th><th>Status</th><th>Primeiro Acesso</th><th>Ações</th></tr></thead>
    <tbody>${lista.map(c => `
      <tr>
        <td>${esc(c.nome)}</td>
        <td>${esc(c.matricula)}</td>
        <td>${c.bloqueado ? '<span style="color:#dc2626;font-weight:600">🚫 Bloqueado</span>' : '<span style="color:#1a8a4c">✅ Ativo</span>'}</td>
        <td>${c.primeiroAcesso ? '<span class="hint">⚠️ Não trocou senha</span>' : '<span style="color:#1a8a4c">✓ OK</span>'}</td>
        <td style="white-space:nowrap">
          ${c.bloqueado
            ? `<button class="btn btn-sm btn-primary" onclick="desbloquearColab(${c.id},'${esc(c.nome)}')">Desbloquear</button>`
            : `<button class="btn btn-sm btn-perigo" onclick="bloquearColab(${c.id},'${esc(c.nome)}')">Bloquear</button>`}
          <button class="btn btn-sm" style="margin-left:4px" onclick="resetarSenhaColab(${c.id},'${esc(c.nome)}')">🔑 Resetar Senha</button>
          <button class="btn btn-sm" style="margin-left:4px" onclick="abrirCarteirinha(${c.id})">🪪 Carteirinha</button>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

async function bloquearColab(id, nome) {
  const motivo = prompt(`Motivo do bloqueio de ${nome}:`);
  if (motivo === null) return;
  try {
    await api(`/api/colaboradores/${id}/bloquear`, { method: 'POST', body: { motivo } });
    toast(`${nome} bloqueado.`, 'ok');
    _acessosAll = await api('/api/colaboradores').catch(() => _acessosAll);
    filtrarAcessos();
  } catch (err) { toast(err.message, 'erro'); }
}

async function desbloquearColab(id, nome) {
  if (!confirm(`Desbloquear ${nome}?`)) return;
  try {
    await api(`/api/colaboradores/${id}/desbloquear`, { method: 'POST', body: {} });
    toast(`${nome} desbloqueado.`, 'ok');
    _acessosAll = await api('/api/colaboradores').catch(() => _acessosAll);
    filtrarAcessos();
  } catch (err) { toast(err.message, 'erro'); }
}

async function resetarSenhaColab(id, nome) {
  if (!confirm(`Resetar a senha de ${nome} para a senha provisória SafePoint@2026?`)) return;
  try {
    const r = await api(`/api/colaboradores/${id}/resetar-senha`, { method: 'POST', body: {} });
    toast(`Senha de ${nome} resetada. Senha provisória: ${r.senhaProvisoria}`, 'ok');
  } catch (err) { toast(err.message, 'erro'); }
}

async function abrirCarteirinha(id) {
  try {
    const e = await api(`/api/carteirinha/${id}`);
    const rolesHtml = (e.roles || []).map(r => `<span class="role-badge role-${r}">${r.toUpperCase()}</span>`).join(' ');
    const subRolesHtml = (e.subRoles || []).map(sr => `<div class="hint" style="font-size:11px">• ${esc(sr.cargo?.replace(/_/g, ' ') || '')}${sr.inicioMandato ? ' (' + sr.inicioMandato + ')' : ''}</div>`).join('');
    abrirModal('🪪 Carteirinha SafePoint', `
      <div style="background:linear-gradient(135deg,var(--azul-escuro),var(--azul));border-radius:12px;padding:24px;color:#fff;text-align:center;margin-bottom:14px">
        <div style="font-size:48px;margin-bottom:8px">👤</div>
        <div style="font-size:20px;font-weight:700;margin-bottom:4px">${esc(e.nome)}</div>
        <div style="font-size:13px;opacity:.85">${esc(e.funcao || '')}${e.setor ? ' — ' + esc(e.setor) : ''}</div>
        ${e.unidade ? `<div style="font-size:12px;opacity:.75;margin-top:4px">${esc(e.unidade)}</div>` : ''}
        <div style="margin-top:10px;font-size:12px;opacity:.8">Matrícula: <strong>${esc(e.matricula || '')}</strong></div>
        ${e.empresaNome ? `<div style="font-size:11px;opacity:.7;margin-top:4px">${esc(e.empresaNome)}</div>` : ''}
      </div>
      ${rolesHtml ? `<div style="margin-bottom:8px">${rolesHtml}</div>` : ''}
      ${subRolesHtml}
      ${e.telefone ? `<div class="hint" style="margin-top:8px">📞 ${esc(e.telefone)}</div>` : ''}
      ${e.emailCorp ? `<div class="hint">✉️ ${esc(e.emailCorp)}</div>` : ''}
      <div class="modal-rodape"><button class="btn" onclick="fecharModal()">Fechar</button></div>`);
  } catch (err) { toast(err.message, 'erro'); }
}

/* Auditoria */
async function carregarAuditoria() {
  const el = document.getElementById('auditoria-lista');
  if (!el) return;
  el.innerHTML = '<p class="hint" style="padding:12px">Carregando...</p>';
  try {
    const logs = await api('/api/auditlog');
    if (!logs.length) { el.innerHTML = '<p class="hint" style="padding:12px">Nenhum registro de auditoria.</p>'; return; }
    el.innerHTML = `<table class="tabela">
      <thead><tr><th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Detalhes</th></tr></thead>
      <tbody>${logs.map(l => `
        <tr>
          <td style="white-space:nowrap;font-size:12px">${tsDataHora(l.timestamp)}</td>
          <td>${esc(l.autorNome || '')} <span class="hint" style="font-size:11px">[${l.role || ''}]</span></td>
          <td><code style="font-size:12px">${esc(l.acao || '')}</code></td>
          <td style="font-size:12px;color:#637080">${esc(l.detalhes || '')}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  } catch (err) { el.innerHTML = `<p class="hint" style="padding:12px">Erro: ${esc(err.message)}</p>`; }
}

/* Moedas */
async function carregarMoedasRanking() {
  const el = document.getElementById('moedas-ranking');
  if (!el) return;
  el.innerHTML = '<p class="hint" style="padding:12px">Carregando...</p>';
  try {
    const lista = await api('/api/colaboradores');
    const ativos = lista.filter(c => c.ativo !== false).sort((a, b) => (b.moedas || 0) - (a.moedas || 0));
    if (!ativos.length) { el.innerHTML = '<p class="hint" style="padding:12px">Nenhum colaborador encontrado.</p>'; return; }
    el.innerHTML = `<table class="tabela">
      <thead><tr><th>#</th><th>Nome</th><th>Matrícula</th><th>Setor</th><th>🪙 Moedas</th><th>Pontos Equivalentes</th></tr></thead>
      <tbody>${ativos.map((c, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${esc(c.nome)}</td>
          <td>${esc(c.matricula)}</td>
          <td>${esc(c.setor || '—')}</td>
          <td style="font-weight:700;color:var(--laranja)">${c.moedas || 0}</td>
          <td class="hint">${(c.moedas || 0) * 5} pts</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  } catch (err) { el.innerHTML = `<p class="hint" style="padding:12px">Erro: ${esc(err.message)}</p>`; }
}

function abrirDistribuirMoedas() {
  const lista = COLABORADORES.filter(c => c.ativo !== false);
  abrirModal('🪙 Distribuir Moedas SafePoint', `
    <p class="hint">1 moeda = 5 pontos. Use para reconhecer atitudes exemplares de segurança.</p>
    <label>Colaborador</label>
    <select id="moeda-emp-sel">
      ${lista.map(c => `<option value="${c.id}">${esc(c.nome)} (${esc(c.matricula)})</option>`).join('')}
    </select>
    <label style="margin-top:10px">Quantidade de moedas</label>
    <input type="number" id="moeda-qtd" value="1" min="1" max="100">
    <label style="margin-top:10px">Motivo</label>
    <input type="text" id="moeda-motivo" placeholder="Ex.: Identificou risco crítico e reportou imediatamente...">
    <div class="modal-rodape">
      <button class="btn" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="confirmarDistribuirMoedas()">🪙 Distribuir</button>
    </div>`);
}

async function confirmarDistribuirMoedas() {
  const empId = document.getElementById('moeda-emp-sel')?.value;
  const quantidade = Number(document.getElementById('moeda-qtd')?.value) || 1;
  const motivo = (document.getElementById('moeda-motivo')?.value || '').trim();
  if (!empId) return toast('Selecione um colaborador.', 'erro');
  if (!motivo) return toast('Informe o motivo.', 'erro');
  try {
    const r = await api(`/api/colaboradores/${empId}/moedas`, { method: 'POST', body: { quantidade, motivo } });
    fecharModal();
    toast(`${quantidade} moeda(s) distribuída(s)! Total: ${r.moedasTotal}`, 'ok');
    carregarMoedasRanking();
  } catch (err) { toast(err.message, 'erro'); }
}

/* Estrutura colab */
let _estruturaColabData = null;

async function carregarEstruturaColab() {
  const el = document.getElementById('cview-estrutura-conteudo');
  if (!el) return;
  el.innerHTML = '<p class="hint" style="padding:20px;text-align:center">Carregando...</p>';
  try {
    _estruturaColabData = await api('/api/estrutura');
    filtrarEstruturaColab();
    carregarEstruturaCardHome(_estruturaColabData);
  } catch (err) { el.innerHTML = '<p class="hint" style="padding:20px">Erro ao carregar estrutura.</p>'; }
}

function filtrarEstruturaColab() {
  const el = document.getElementById('cview-estrutura-conteudo');
  if (!el || !_estruturaColabData) return;
  const busca = (document.getElementById('cestr-busca')?.value || '').toLowerCase();
  const d = _estruturaColabData;

  const renderGrupo = (titulo, emoji, lista) => {
    if (!lista || !lista.length) return '';
    const filtrada = busca ? lista.filter(e => e.nome.toLowerCase().includes(busca) || (e.funcao || '').toLowerCase().includes(busca)) : lista;
    if (!filtrada.length) return '';
    return `<div style="margin-bottom:16px">
      <h4 style="margin:0 0 8px;color:var(--azul)">${emoji} ${titulo}</h4>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px">
        ${filtrada.map(e => `
          <div class="qeq-card" style="cursor:pointer" onclick="abrirCarteirinha(${e.id})">
            <div class="qeq-avatar">${(e.nome || '?')[0].toUpperCase()}</div>
            <div class="qeq-info">
              <div class="qeq-nome">${esc(e.nome)}</div>
              <div class="qeq-funcao">${esc(e.funcao || '')}${e.setor ? ' — ' + esc(e.setor) : ''}</div>
              ${e.telefone ? `<div class="hint" style="font-size:11px">📞 ${esc(e.telefone)}</div>` : ''}
            </div>
          </div>`).join('')}
      </div>
    </div>`;
  };

  const allMembros = [
    ...(d.sesmt || []).map(e => ({ ...e, grupo: 'SESMT' })),
    ...(d.cipa?.todos || []).map(e => ({ ...e, grupo: 'CIPA' })),
    ...(d.brigada?.todos || []).map(e => ({ ...e, grupo: 'Brigada' })),
    ...(d.tecnico_seguranca || []).map(e => ({ ...e, grupo: 'Técnico de Segurança' })),
    ...(d.medico_trabalho || []).map(e => ({ ...e, grupo: 'Médico do Trabalho' })),
    ...(d.ergonomista || []).map(e => ({ ...e, grupo: 'Ergonomista' })),
  ];

  if (!allMembros.length) {
    el.innerHTML = '<p class="hint" style="padding:24px;text-align:center">A estrutura de segurança ainda não foi configurada.</p>';
    return;
  }

  el.innerHTML = `
    ${renderGrupo('SESMT', '🦺', d.sesmt)}
    ${renderGrupo('CIPA', '⚠️', d.cipa?.todos)}
    ${renderGrupo('Brigada de Emergência', '🚒', d.brigada?.todos)}
    ${renderGrupo('Técnico de Segurança', '🔧', d.tecnico_seguranca)}
    ${renderGrupo('Médico do Trabalho', '🩺', d.medico_trabalho)}
    ${renderGrupo('Ergonomista', '🪑', d.ergonomista)}
  `;
}

/* ── SafePoint 3.0 — Insights (gestor) ── */

async function carregarInsights() {
  const el = document.getElementById('insights-conteudo');
  if (!el) return;
  el.innerHTML = '<p class="hint" style="padding:24px;text-align:center">Carregando insights...</p>';
  try {
    const d = await api('/api/insights');
    const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    const maxHeat = Math.max(...d.heatMapDiaSemana, 1);
    el.innerHTML = `
      <div class="cards" style="margin-bottom:18px">
        <div class="card-stat" style="border-top:3px solid var(--azul)">
          <div class="card-stat-n">${d.ics?.ics ?? 0}<span style="font-size:16px">%</span></div>
          <div class="card-stat-l">ICS — Cultura de Segurança <span style="font-weight:700;color:var(--verde)">${d.ics?.nota ?? 'E'}</span></div>
        </div>
        <div class="card-stat" style="border-top:3px solid #7b5ea7">
          <div class="card-stat-n">${d.knowledgeScore?.score ?? 0}<span style="font-size:16px">%</span></div>
          <div class="card-stat-l">Score de Conhecimento</div>
        </div>
        <div class="card-stat" style="border-top:3px solid var(--laranja)">
          <div class="card-stat-n">${d.txParticipacao30d ?? 0}<span style="font-size:16px">%</span></div>
          <div class="card-stat-l">Participação (30 dias)</div>
        </div>
        <div class="card-stat" style="border-top:3px solid #10b981">
          <div class="card-stat-n">${d.txObsResolvidas ?? 0}<span style="font-size:16px">%</span></div>
          <div class="card-stat-l">Observações Resolvidas</div>
        </div>
        <div class="card-stat" style="border-top:3px solid #f59e0b">
          <div class="card-stat-n">${d.streakMedio ?? 0}</div>
          <div class="card-stat-l">Streak Médio (dias)</div>
        </div>
      </div>

      <div class="grid-2" style="margin-bottom:18px">
        <div class="panel">
          <h3>📅 Engajamento por Dia da Semana</h3>
          <p class="hint" style="margin-bottom:10px">Check-ins dos últimos 60 dias</p>
          <div style="display:flex;gap:6px;align-items:flex-end;height:80px">
            ${d.heatMapDiaSemana.map((v, i) => `
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
                <div style="width:100%;background:var(--azul);opacity:${0.2 + 0.8 * (v / maxHeat)};border-radius:4px;height:${Math.max(4, Math.round((v / maxHeat) * 60))}px" title="${v} check-ins"></div>
                <div style="font-size:10px;color:#637080">${DIAS[i]}</div>
              </div>`).join('')}
          </div>
        </div>
        <div class="panel">
          <h3>🏆 Top 5 Engajamento</h3>
          <table class="tabela">
            <thead><tr><th>#</th><th>Nome</th><th>IES</th><th>Pontos</th></tr></thead>
            <tbody>${(d.top5Engajamento || []).map((e, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${esc(e.nome)}<div class="hint" style="font-size:11px">${esc(e.setor || '')}</div></td>
                <td style="font-weight:700;color:var(--azul)">${e.ies}</td>
                <td>${(e.pontos || 0).toLocaleString('pt-BR')}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="grid-2" style="margin-bottom:18px">
        <div class="panel">
          <h3>📊 Dimensões do ICS</h3>
          ${Object.entries(d.ics?.dimensoes || {}).map(([k, v]) => `
            <div style="margin-bottom:8px">
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px">
                <span>${k.charAt(0).toUpperCase() + k.slice(1)}</span>
                <span style="font-weight:600">${v}%</span>
              </div>
              <div style="background:#e5e7eb;border-radius:4px;height:8px">
                <div style="background:${v >= 80 ? 'var(--verde)' : v >= 60 ? '#f59e0b' : '#ef4444'};width:${v}%;height:8px;border-radius:4px"></div>
              </div>
            </div>`).join('')}
        </div>
        <div class="panel">
          <h3>📈 Totais Gerais</h3>
          <table class="tabela">
            ${Object.entries(d.totais || {}).map(([k, v]) => `
              <tr>
                <td>${k.charAt(0).toUpperCase() + k.slice(1)}</td>
                <td style="font-weight:700">${v.toLocaleString('pt-BR')}</td>
              </tr>`).join('')}
          </table>
          ${d.setorCritico ? `<p style="margin-top:12px;padding:10px;background:#fef2f2;border-radius:6px;font-size:13px">⚠️ Setor com mais obs. críticas: <strong>${esc(d.setorCritico[0])}</strong> (${d.setorCritico[1]})</p>` : ''}
        </div>
      </div>`;
  } catch (err) { el.innerHTML = `<p class="hint" style="padding:24px">Erro ao carregar insights: ${esc(err.message)}</p>`; }
}

/* ── SafePoint 3.0 — IA SST (gestor) ── */

let _iaHistory = [];

function carregarIAView() {
  const el = document.getElementById('ia-chat-area');
  if (!el) return;
  if (_iaHistory.length) return; // already loaded
  _iaHistory = [];
  el.innerHTML = `
    <div class="ia-welcome" style="text-align:center;padding:32px 16px">
      <div style="font-size:48px;margin-bottom:12px">🤖</div>
      <h3>Assistente IA de SST</h3>
      <p class="hint" style="margin-bottom:18px">Tire dúvidas sobre NRs, CIPA, Brigada, APR, PCMSO, PGR e muito mais.</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">
        ${['O que é a NR-5?','Como formar a CIPA?','Quais são as funções da Brigada?','O que deve conter um PCMSO?'].map(s => `<button class="btn btn-sm" onclick="iaEnviarSugestao('${s}')">${s}</button>`).join('')}
      </div>
    </div>
    <div id="ia-msgs" style="min-height:200px;padding:0 0 80px"></div>`;
}

function iaEnviarSugestao(msg) {
  const input = document.getElementById('ia-input');
  if (input) { input.value = msg; iaEnviar(); }
}

async function iaEnviar() {
  const input = document.getElementById('ia-input');
  const msg = (input?.value || '').trim();
  if (!msg) return;
  if (input) input.value = '';
  const msgsEl = document.getElementById('ia-msgs');
  if (!msgsEl) return;

  // Hide welcome
  const welcome = document.querySelector('.ia-welcome');
  if (welcome) welcome.style.display = 'none';

  _iaHistory.push({ role: 'user', content: msg });
  msgsEl.innerHTML += `<div class="ia-msg ia-user"><div class="ia-bubble">${esc(msg)}</div></div>`;
  msgsEl.innerHTML += `<div class="ia-msg ia-bot ia-loading"><div class="ia-bubble">💭 Pensando...</div></div>`;
  msgsEl.scrollTop = msgsEl.scrollHeight;

  try {
    const r = await api('/api/ia/chat', { method: 'POST', body: { message: msg, history: _iaHistory.slice(-8) } });
    _iaHistory.push({ role: 'assistant', content: r.resposta });
    const loading = msgsEl.querySelector('.ia-loading');
    if (loading) loading.outerHTML = `<div class="ia-msg ia-bot"><div class="ia-bubble">${r.resposta.replace(/\n/g, '<br>')}</div></div>`;
  } catch (err) {
    const loading = msgsEl.querySelector('.ia-loading');
    if (loading) loading.outerHTML = `<div class="ia-msg ia-bot"><div class="ia-bubble" style="color:#dc2626">Erro: ${esc(err.message)}</div></div>`;
  }
  msgsEl.scrollTop = msgsEl.scrollHeight;
}

/* ── SafePoint 3.0 — Academia SST (gestor) ── */

let _academiaGestorList = [];

async function carregarAcademiaGestor() {
  const el = document.getElementById('academia-gestor-lista');
  if (!el) return;
  try {
    _academiaGestorList = await api('/api/academia');
    renderAcademiaGestor();
  } catch (err) { el.innerHTML = '<p class="hint" style="padding:20px">Erro ao carregar.</p>'; }
}

function renderAcademiaGestor() {
  const el = document.getElementById('academia-gestor-lista');
  if (!el) return;
  const busca = (document.getElementById('academia-busca-g')?.value || '').toLowerCase();
  const cat = document.getElementById('academia-cat-g')?.value || '';
  let lista = _academiaGestorList;
  if (busca) lista = lista.filter(a => a.titulo.toLowerCase().includes(busca) || (a.conteudo || '').toLowerCase().includes(busca));
  if (cat) lista = lista.filter(a => a.categoria === cat);
  if (!lista.length) { el.innerHTML = '<p class="hint" style="padding:20px;text-align:center">Nenhum conteúdo publicado ainda. Clique em "+ Novo Conteúdo" para adicionar.</p>'; return; }
  const tipoEmoji = { artigo: '📄', video: '🎬', pdf: '📋', infografico: '📊' };
  el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
    ${lista.map(a => `
      <div class="panel">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:20px">${tipoEmoji[a.tipo] || '📄'}</span>
          <button class="btn btn-sm btn-perigo" onclick="excluirAcademia(${a.id})">✕</button>
        </div>
        <div style="font-weight:700;margin-bottom:4px">${esc(a.titulo)}</div>
        <div class="hint" style="font-size:11px;margin-bottom:6px">${esc(a.categoria)} • ${esc(a.autor || 'SESMT')}</div>
        <div style="font-size:13px;color:#637080;line-height:1.5">${esc((a.conteudo || '').slice(0, 120))}${a.conteudo && a.conteudo.length > 120 ? '...' : ''}</div>
        ${a.url ? `<a href="${esc(a.url)}" target="_blank" class="btn btn-sm" style="margin-top:8px;display:inline-block">Abrir link</a>` : ''}
      </div>`).join('')}
  </div>`;
}

function abrirNovoConteudoAcademia() {
  const CATS = ['NR Geral','EPI','Ergonomia','Primeiros Socorros','Incêndio','Procedimentos','CIPA','Brigada','Legislação','Outros'];
  abrirModal('+ Novo Conteúdo da Academia', `
    <label>Título *</label>
    <input type="text" id="acad-titulo" placeholder="Título do conteúdo">
    <label style="margin-top:10px">Tipo</label>
    <select id="acad-tipo">
      <option value="artigo">📄 Artigo / Texto</option>
      <option value="video">🎬 Vídeo</option>
      <option value="pdf">📋 PDF / Documento</option>
      <option value="infografico">📊 Infográfico</option>
    </select>
    <label style="margin-top:10px">Categoria</label>
    <select id="acad-cat">
      ${CATS.map(c => `<option>${esc(c)}</option>`).join('')}
    </select>
    <label style="margin-top:10px">Autor</label>
    <input type="text" id="acad-autor" placeholder="Ex.: Técnico de Segurança">
    <label style="margin-top:10px">URL (link externo)</label>
    <input type="url" id="acad-url" placeholder="https://...">
    <label style="margin-top:10px">Conteúdo / Descrição *</label>
    <textarea id="acad-conteudo" style="min-height:100px" placeholder="Descreva o conteúdo..."></textarea>
    <div class="modal-rodape">
      <button class="btn" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarConteudoAcademia()">Publicar</button>
    </div>`);
}

async function salvarConteudoAcademia() {
  const titulo = (document.getElementById('acad-titulo')?.value || '').trim();
  const conteudo = (document.getElementById('acad-conteudo')?.value || '').trim();
  if (!titulo || !conteudo) return toast('Título e conteúdo são obrigatórios.', 'erro');
  try {
    await api('/api/academia', { method: 'POST', body: {
      titulo, conteudo,
      tipo: document.getElementById('acad-tipo')?.value || 'artigo',
      categoria: document.getElementById('acad-cat')?.value || 'Outros',
      autor: document.getElementById('acad-autor')?.value || '',
      url: document.getElementById('acad-url')?.value || ''
    }});
    fecharModal();
    toast('Conteúdo publicado!', 'ok');
    await carregarAcademiaGestor();
  } catch (err) { toast(err.message, 'erro'); }
}

async function excluirAcademia(id) {
  if (!confirm('Excluir este conteúdo?')) return;
  try {
    await api(`/api/academia/${id}`, { method: 'DELETE' });
    toast('Conteúdo excluído.', 'ok');
    await carregarAcademiaGestor();
  } catch (err) { toast(err.message, 'erro'); }
}

/* ── SafePoint 3.0 — Academia SST (colaborador) ── */

async function carregarAcademiaColab() {
  const el = document.getElementById('academia-colab-lista');
  if (!el) return;
  el.innerHTML = '<p class="hint" style="padding:20px;text-align:center">Carregando...</p>';
  try {
    const lista = await api('/api/academia');
    if (!lista.length) { el.innerHTML = '<p class="hint" style="padding:24px;text-align:center">Nenhum conteúdo disponível ainda.</p>'; return; }
    const tipoEmoji = { artigo: '📄', video: '🎬', pdf: '📋', infografico: '📊' };
    el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
      ${lista.map(a => `
        <div class="panel" style="cursor:default">
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
            <span style="font-size:24px">${tipoEmoji[a.tipo] || '📄'}</span>
            <div>
              <div style="font-weight:700;font-size:14px">${esc(a.titulo)}</div>
              <div class="hint" style="font-size:11px">${esc(a.categoria)} • ${esc(a.autor || 'SESMT')}</div>
            </div>
          </div>
          <div style="font-size:13px;color:#374151;line-height:1.6;margin-bottom:8px">${esc((a.conteudo || '').slice(0, 200))}${a.conteudo && a.conteudo.length > 200 ? '...' : ''}</div>
          ${a.url ? `<a href="${esc(a.url)}" target="_blank" class="btn btn-sm btn-primary">Acessar conteúdo →</a>` : ''}
        </div>`).join('')}
    </div>`;
  } catch (err) { el.innerHTML = '<p class="hint" style="padding:20px">Erro ao carregar academia.</p>'; }
}

/* ── SafePoint 3.0 — Eleição CIPA (colaborador) ── */

async function carregarEleicaoColab() {
  const el = document.getElementById('eleicao-colab-conteudo');
  if (!el) return;
  el.innerHTML = '<p class="hint" style="padding:20px;text-align:center">Carregando...</p>';
  try {
    const { eleicao } = await api('/api/cipa/eleicao');
    if (!eleicao) {
      el.innerHTML = `<div class="panel" style="text-align:center;padding:32px">
        <div style="font-size:48px;margin-bottom:12px">🗳</div>
        <h3>Nenhuma eleição ativa</h3>
        <p class="hint">Quando o SESMT criar uma eleição da CIPA, ela aparecerá aqui.</p>
      </div>`;
      return;
    }
    if (eleicao.jaVotou) {
      el.innerHTML = `<div class="panel" style="text-align:center;padding:32px">
        <div style="font-size:48px;margin-bottom:12px">✅</div>
        <h3>Você já votou!</h3>
        <p class="hint">Obrigado pela participação. Você ganhou +10 pontos.</p>
        <p style="margin-top:10px;font-size:13px">${esc(eleicao.titulo)}</p>
      </div>`;
      return;
    }
    el.innerHTML = `<div class="panel">
      <h3 style="margin-bottom:4px">🗳 ${esc(eleicao.titulo)}</h3>
      <p class="hint" style="margin-bottom:16px">${esc(eleicao.descricao || 'Eleja o representante da CIPA.')}</p>
      <p class="hint" style="margin-bottom:14px">Vagas disponíveis: <strong>${eleicao.vagas}</strong> • Sua participação vale <strong>+10 pontos</strong>!</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
        ${(eleicao.candidatos || []).map(c => `
          <button class="panel" style="cursor:pointer;text-align:center;padding:18px;border:2px solid var(--cinza-borda);background:#fff;transition:border-color .2s"
            onmouseover="this.style.borderColor='var(--azul)'" onmouseout="this.style.borderColor='var(--cinza-borda)'"
            onclick="votar(${c.id})">
            <div style="font-size:36px;margin-bottom:8px">👤</div>
            <div style="font-weight:700;font-size:15px">${esc(c.nome)}</div>
            <div class="hint" style="font-size:12px">${esc(c.funcao || '')}</div>
            <div class="btn btn-primary" style="margin-top:12px;display:inline-block;pointer-events:none">Votar</div>
          </button>`).join('')}
      </div>
    </div>`;
  } catch (err) { el.innerHTML = '<p class="hint" style="padding:20px">Erro ao carregar eleição.</p>'; }
}

async function votar(candidatoId) {
  if (!confirm('Confirmar voto? Esta ação não pode ser desfeita.')) return;
  try {
    const r = await api('/api/cipa/eleicao/votar', { method: 'POST', body: { candidatoId } });
    toast(`Voto registrado! +${r.pontos} pontos`, 'ok');
    await carregarEleicaoColab();
  } catch (err) { toast(err.message, 'erro'); }
}

/* ── SafePoint 3.2 – Submódulos ── */

const SUBMODULO_LABELS = {
  dashboard:    { visao_geral:'Visão Geral', indicadores:'Indicadores', alertas:'Alertas', score:'Score da Empresa', insights_ia:'Insights IA', safety_score_corp:'Safety Score Corporativo', radar_atencao:'Radar de Atenção', tendencias_seg:'Tendências de Segurança' },
  pessoas:      { cadastro:'Cadastro Individual', importacao:'Importação em Massa', estrutura:'Estrutura Org.', setores:'Setores', equipes:'Equipes', senhas:'Gestão de Senhas', acesso:'Controle de Acesso', safety_score_ind:'Safety Score Individual', historico_evolucao:'Histórico de Evolução', evidencias_colab:'Evidências do Colaborador' },
  aprendizagem: { dds:'DDS', dds_battle:'DDS Battle', treinamentos:'Treinamentos', flashcards:'Flashcards', certificados:'Certificados', simulador:'Simulador de Cenários', academia:'Academia SST', trilhas:'Trilhas Inteligentes', biblioteca_inteligente:'Biblioteca Inteligente', microlearning:'Microlearning' },
  cultura:      { feed:'Feed Social', reconhecimentos:'Reconhecimentos', ranking:'Ranking', loja:'Loja', missoes:'Missões', campanhas:'Campanhas', moedas:'Moedas', comunidades:'Comunidades', desafios_seg:'Desafios de Segurança', reconhec_pares:'Reconhecimento entre Pares', hall_seguranca:'Hall de Destaque' },
  seguranca_op: { observacoes:'Observações', ato_inseguro:'Ato Inseguro', condicao_insegura:'Condição Insegura', quase_acidente:'Quase Acidente', boa_pratica:'Boa Prática', melhoria:'Oportunidade de Melhoria', plano_acao:'Plano de Ação', workflow:'Workflow', heatmap_seg:'Heatmap de Segurança', tendencias_desvios:'Tendências de Desvios', evidencias_op:'Evidências Operacionais' },
  comunicacao:  { comunicados:'Comunicados', pesquisas:'Pesquisas', podcast:'Podcast', mensagens:'Mensagens Diretas', canal_sesmt:'Canal Pergunte ao SESMT', comunicados_intel:'Comunicados Inteligentes', tv_corporativa:'TV Corporativa' },
  cipa:         { estrutura:'Estrutura', integrantes:'Integrantes', mandatos:'Mandatos', reunioes:'Reuniões', eleicao:'Eleição Digital', inspecoes:'Inspeções', portal_cipa:'Portal da CIPA', indicadores_cipa:'Indicadores da CIPA', banco_ideias:'Banco de Ideias' },
  brigada:      { estrutura:'Estrutura', brigadistas:'Brigadistas', simulados:'Simulados', certificacoes:'Certificações', plano_emergencia:'Plano de Emergência', mapa:'Mapa de Emergência', gestao_simulados:'Gestão de Simulados', cert_reciclagens:'Certificações e Reciclagens', prontidao_op:'Prontidão Operacional' },
  relatorios:   { dds:'Relatório DDS', treinamentos:'Relatório Treinamentos', quiz:'Relatório Quiz', engajamento:'Relatório Engajamento', exportacoes:'Exportações', relat_exec:'Relatórios Executivos', relat_comp:'Relatórios Comparativos', relat_cultura:'Relatórios de Cultura', central_evidencias:'Central de Evidências' },
  ia_insights:  { assistente:'Assistente IA', insights:'SafePoint Insights', mapa_calor:'Mapa de Calor', predicoes:'Predições e Recomendações', risk_engine:'Risk Engine', safety_score_ia:'Safety Score IA', recomendacoes:'Recomendações Automáticas', assistente_exec:'Assistente Executivo', predicao_tend:'Predição de Tendências', indice_maturidade:'Índice de Maturidade' },
  config:       { geral:'Geral', modulos:'Módulos / Submódulos', permissoes:'Permissões', governanca:'Governança', auditoria:'Auditoria', biblioteca_global:'Biblioteca Global', marketplace:'Marketplace', gov_digital:'Governança Digital', gestao_conteudo:'Gestão de Conteúdo' },
};

const MODULO_NOMES = {
  dashboard:'Dashboard', pessoas:'Gestão de Pessoas', aprendizagem:'Aprendizagem',
  cultura:'Cultura e Engajamento', seguranca_op:'Segurança Operacional',
  comunicacao:'Comunicação', cipa:'CIPA', brigada:'Brigada de Emergência',
  relatorios:'Relatórios', ia_insights:'IA e Insights', config:'Configurações',
};

const PERMISSION_LABELS = {
  criar_dds:'Criar DDS', editar_dds:'Editar DDS', excluir_dds:'Excluir DDS',
  criar_quiz:'Criar Quiz', gerenciar_pontos:'Gerenciar Pontos',
  gerenciar_reconhecimentos:'Gerenciar Reconhecimentos', criar_campanhas:'Criar Campanhas',
  gerenciar_usuarios:'Gerenciar Usuários', alterar_senhas:'Alterar Senhas',
  gerenciar_cipa:'Gerenciar CIPA', gerenciar_brigada:'Gerenciar Brigada',
  visualizar_auditoria:'Visualizar Auditoria', exportar_relatorios:'Exportar Relatórios',
  gerenciar_modulos:'Gerenciar Módulos',
};

const PERFIL_NOMES = {
  sesmt:'SESMT', cipa:'CIPA', brigada:'Brigada', lideranca:'Liderança', colaborador:'Colaborador',
};

let _submodulosData = null;

async function carregarSubmodulos() {
  const el = document.getElementById('submodulos-conteudo');
  if (!el) return;
  try {
    const resp = await api('/api/empresa/submodulos');
    const data = resp.submodulos || resp;
    const labels = resp.labels || SUBMODULO_LABELS;
    const names  = resp.moduleNames || {};
    _submodulosData = data;
    let html = '';
    for (const [mod, subs] of Object.entries(labels)) {
      const modSubs = data[mod] || {};
      const isActive = modSubs._modulo !== false;
      const defaultName = MODULO_NOMES[mod] || mod;
      const customName  = names[mod] || '';
      html += `<div class="submod-section panel" style="margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
          <span style="font-weight:700;flex:1;min-width:100px">${defaultName}</span>
          <label class="modulo-toggle-label" title="Exibir módulo na sidebar">
            <input type="checkbox" data-mod="${mod}" data-sub="_modulo" ${isActive ? 'checked' : ''}>
            <span class="toggle-slider"></span>
            <span style="font-size:12px;color:#6b7280;margin-left:6px">Módulo ativo</span>
          </label>
          <input type="text" class="input" data-modname="${mod}"
            value="${esc(customName)}" placeholder="Nome customizado (ex: ${esc(defaultName)})"
            style="width:200px;font-size:13px">
        </div>
        <div class="submod-grid">`;
      for (const [key, label] of Object.entries(subs)) {
        const checked = modSubs[key] ? 'checked' : '';
        html += `<label class="submod-item">
          <input type="checkbox" data-mod="${mod}" data-sub="${key}" ${checked}>
          <span>${label}</span>
        </label>`;
      }
      html += `</div></div>`;
    }
    el.innerHTML = html;
  } catch (err) { el.innerHTML = `<p class="hint">Erro ao carregar submódulos: ${esc(err.message)}</p>`; }
}

async function salvarSubmodulos() {
  const checks = document.querySelectorAll('#submodulos-conteudo input[type=checkbox]');
  const submodulos = {};
  checks.forEach(cb => {
    const mod = cb.dataset.mod, sub = cb.dataset.sub;
    if (!submodulos[mod]) submodulos[mod] = {};
    submodulos[mod][sub] = cb.checked;
  });
  const moduleNames = {};
  document.querySelectorAll('#submodulos-conteudo [data-modname]').forEach(inp => {
    moduleNames[inp.dataset.modname] = inp.value.trim();
  });
  try {
    const resp = await api('/api/empresa/submodulos', { method: 'POST', body: { submodulos, moduleNames } });
    aplicarConfigModulos(resp.submodulos || submodulos, resp.moduleNames || moduleNames);
    toast('Módulos salvos! Sidebar atualizada.', 'ok');
  } catch (err) { toast(err.message, 'erro'); }
}

function aplicarConfigModulos(submodulos, moduleNames) {
  if (!submodulos) return;
  for (const mod of Object.keys(MODULO_NOMES)) {
    const sbKey = mod.replace(/_/g, '-');
    const sbEl  = document.getElementById('sbmod-' + sbKey) ||
                  (mod === 'dashboard' ? document.getElementById('sb-g-dashboard') : null);
    if (!sbEl) continue;
    const modData = submodulos[mod] || {};
    // Master toggle: _modulo controls sidebar visibility
    const isActive = modData._modulo !== false;
    sbEl.style.display = isActive ? '' : 'none';
    // Custom name
    const nome = moduleNames && moduleNames[mod];
    const labelEl = sbEl.querySelector('.sm-label') || sbEl.querySelector('span:last-child');
    if (labelEl) labelEl.textContent = nome || MODULO_NOMES[mod];
  }
}

/* ── SafePoint 3.2 – Permissões ── */

let _permissoesData = null;

async function carregarPermissoes() {
  const el = document.getElementById('permissoes-conteudo');
  if (!el) return;
  try {
    const resp = await api('/api/empresa/permissoes');
    const data = resp.permissoes || resp;
    _permissoesData = data;
    const perfis = Object.keys(PERFIL_NOMES);
    const perms  = Object.keys(PERMISSION_LABELS);
    let html = `<div style="overflow-x:auto"><table class="perm-matrix tabela">
      <thead><tr><th>Permissão</th>${perfis.map(p => `<th>${PERFIL_NOMES[p]}</th>`).join('')}</tr></thead>
      <tbody>`;
    for (const perm of perms) {
      html += `<tr><td>${PERMISSION_LABELS[perm]}</td>`;
      for (const perfil of perfis) {
        const checked = (data[perfil] && data[perfil][perm]) ? 'checked' : '';
        html += `<td style="text-align:center"><input type="checkbox" data-perfil="${perfil}" data-perm="${perm}" ${checked}></td>`;
      }
      html += `</tr>`;
    }
    html += `</tbody></table></div>`;
    el.innerHTML = html;
  } catch (err) { el.innerHTML = `<p class="hint">Erro ao carregar permissões: ${esc(err.message)}</p>`; }
}

async function salvarPermissoes() {
  const checks = document.querySelectorAll('#permissoes-conteudo input[type=checkbox]');
  const permissoes = {};
  checks.forEach(cb => {
    const perfil = cb.dataset.perfil, perm = cb.dataset.perm;
    if (!permissoes[perfil]) permissoes[perfil] = {};
    permissoes[perfil][perm] = cb.checked;
  });
  try {
    await api('/api/empresa/permissoes', { method: 'POST', body: { permissoes } });
    toast('Matriz de permissões salva!', 'ok');
  } catch (err) { toast(err.message, 'erro'); }
}

/* ── SafePoint 3.2 – Governance ── */

async function carregarGovernance() {
  const el = document.getElementById('governance-conteudo');
  if (!el) return;
  try {
    const g = await api('/api/governance');
    const barColor = g.score >= 80 ? '#1a8a4c' : g.score >= 60 ? '#e8801a' : '#d32f2f';
    const comps = g.components || {};
    const compRows = [
      { label: 'Permissões configuradas', key: 'permissoes', icon: '🔐' },
      { label: 'Dados da empresa',        key: 'configuracao', icon: '🏢' },
      { label: 'Eventos críticos (48h)',  key: 'eventos_criticos', icon: '🚨' },
      { label: 'Engajamento (30 dias)',   key: 'engajamento', icon: '📊' },
    ].map(c => {
      const v = comps[c.key] ?? 0;
      const col = v >= 80 ? '#1a8a4c' : v >= 60 ? '#e8801a' : '#d32f2f';
      return `<div class="gov-comp-row">
        <span class="gov-comp-label">${c.icon} ${c.label}</span>
        <div class="gov-comp-bar-wrap">
          <div class="gov-comp-bar" style="width:${v}%;background:${col}"></div>
        </div>
        <span class="gov-comp-val">${v}</span>
      </div>`;
    }).join('');
    el.innerHTML = `
      <div class="gov-score-card panel" style="text-align:center;padding:32px 24px;margin-bottom:20px">
        <div style="font-size:64px;line-height:1">${g.gradeEmoji}</div>
        <div style="font-size:52px;font-weight:900;color:${barColor};margin:8px 0">${g.score}</div>
        <div style="font-size:18px;font-weight:600;color:#374151">${g.grade}</div>
        <div class="hint" style="margin-top:6px">Score de Governança SafePoint</div>
      </div>
      <div class="panel">
        <h3 style="margin-bottom:14px">Componentes do Score</h3>
        <div class="gov-comps">${compRows}</div>
        <div class="hint" style="margin-top:14px">
          Colaboradores ativos (30d): <strong>${g.totalAtivos || 0}</strong> / ${g.totalEmps || 0} &nbsp;|&nbsp;
          Eventos críticos (48h): <strong>${g.totalCriticos || 0}</strong>
        </div>
      </div>`;
  } catch (err) { el.innerHTML = `<p class="hint">Erro ao carregar governança: ${esc(err.message)}</p>`; }
}

/* ── SafePoint 3.2 – Auditoria Avançada ── */

let _auditAvancadaData = [];

async function carregarAuditAvancada() {
  const el = document.getElementById('audit-avancada-lista');
  if (!el) return;
  const de  = (document.getElementById('audit-f-de')  || {}).value || '';
  const ate = (document.getElementById('audit-f-ate') || {}).value || '';
  const params = new URLSearchParams();
  if (de)  params.set('de',  de);
  if (ate) params.set('ate', ate);
  try {
    el.innerHTML = '<p class="hint">Carregando...</p>';
    const data = await api('/api/auditlog/avancado?' + params.toString());
    _auditAvancadaData = Array.isArray(data) ? data : (data.logs || []);
    filtrarAuditAvancada();
  } catch (err) { el.innerHTML = `<p class="hint">Erro: ${esc(err.message)}</p>`; }
}

function filtrarAuditAvancada() {
  const el = document.getElementById('audit-avancada-lista');
  if (!el) return;
  const busca  = ((document.getElementById('audit-f-usuario') || {}).value || '').toLowerCase();
  const acao   = ((document.getElementById('audit-f-acao')    || {}).value || '').toLowerCase();
  const critico= (document.getElementById('audit-so-critico') || {}).checked;
  let logs = _auditAvancadaData;
  if (busca)  logs = logs.filter(l => (l.userName || l.userId || '').toLowerCase().includes(busca));
  if (acao)   logs = logs.filter(l => (l.acao || '').toLowerCase().includes(acao));
  if (critico) logs = logs.filter(l => l.critico);
  if (!logs.length) { el.innerHTML = '<p class="hint" style="padding:20px">Nenhum registro encontrado.</p>'; return; }
  el.innerHTML = `<div class="audit-timeline">${logs.map(l => {
    const dt = new Date(l.timestamp).toLocaleString('pt-BR');
    const badge = l.critico ? '<span class="badge badge-perigo" style="font-size:10px">CRÍTICO 🚨</span>' : '';
    const before = l.valorAntes !== null && l.valorAntes !== undefined
      ? `<div class="audit-diff"><span class="audit-antes">${esc(String(l.valorAntes))}</span> → <span class="audit-depois">${esc(String(l.valorDepois))}</span></div>` : '';
    const meta = [l.modulo, l.submodulo].filter(Boolean).join(' › ');
    return `<div class="audit-entry${l.critico ? ' audit-critico' : ''}">
      <div class="audit-dot"></div>
      <div class="audit-body">
        <div class="audit-head-row">
          <strong>${esc(l.acao)}</strong> ${badge}
          <span class="audit-time">${dt}</span>
        </div>
        ${meta ? `<div class="hint" style="font-size:11px;margin-top:2px">📂 ${esc(meta)}</div>` : ''}
        <div style="font-size:12px;color:#6b7280;margin-top:3px">
          ${l.nomeUsuario || l.userName || `ID ${l.userId}`} · ${esc(l.role || '')}
          ${l.ip ? ` · 🌐 ${esc(l.ip)}` : ''}
          ${l.dispositivo ? ` · 📱 ${esc(l.dispositivo)}` : ''}
        </div>
        ${l.detalhes ? `<div style="font-size:12px;margin-top:4px;color:#374151">${esc(l.detalhes)}</div>` : ''}
        ${before}
      </div>
    </div>`;
  }).join('')}</div>`;
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

/* ══════════════════════════════════════════════════════════════
   SafePoint 3.3 — Novas funções de view
══════════════════════════════════════════════════════════════ */

// ── Safety Score Corporativo ────────────────────────────────
async function carregarSafetyScoreCorp() {
  try {
    const resp = await api('/api/dashboard');
    const totalColab = Math.max(1, resp.colaboradoresAtivos || 1);
    const porTipo = resp.porTipo || {};
    const totalQuizCheckins = Object.values(porTipo).reduce((s, t) => s + (t.checkins || 0), 0);
    const pillars = [
      { nome: 'Engajamento',  val: Math.min(100, Math.round((resp.totalCheckins || 0) / totalColab * 100)) },
      { nome: 'Conhecimento', val: Math.min(100, Math.round(totalQuizCheckins / totalColab * 80)) },
      { nome: 'Participação', val: Math.min(100, Math.round((resp.totalEventos || 0) / totalColab * 90)) },
      { nome: 'Cultura',      val: Math.min(100, Math.round((resp.totalObs || 0) / totalColab * 120)) },
      { nome: 'Governança',   val: 60 },
      { nome: 'Comunicação',  val: Math.min(100, Math.round((resp.totalSugs || 0) / totalColab * 150)) },
    ];
    const score = Math.round(pillars.reduce((s, p) => s + p.val, 0) / pillars.length);
    const elVal = document.getElementById('safety-score-corp-val');
    if (elVal) elVal.textContent = score;
    const circle = document.querySelector('#view-safety-score-corp .score-ring circle:last-child');
    if (circle) {
      const circumference = 2 * Math.PI * 50;
      circle.setAttribute('stroke-dasharray', circumference.toFixed(2));
      circle.setAttribute('stroke-dashoffset', (circumference * (1 - score / 100)).toFixed(2));
      circle.setAttribute('stroke', score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444');
    }
    const elPillars = document.getElementById('safety-score-pillars');
    if (elPillars) elPillars.innerHTML = pillars.map(p => `
      <div class="pillar-bar-wrap">
        <div class="pillar-bar-label">${p.nome}</div>
        <div class="pillar-bar-track"><div class="pillar-bar-fill" style="width:${p.val}%;background:${p.val>=70?'#22c55e':p.val>=40?'#f59e0b':'#ef4444'}"></div></div>
        <div class="pillar-bar-val">${p.val}</div>
      </div>`).join('');
  } catch(e) { console.error('carregarSafetyScoreCorp', e); }
}

// ── Risk Engine ────────────────────────────────────────────
async function carregarRiskEngine() {
  try {
    const resp = await api('/api/colaboradores');
    const emps = Array.isArray(resp) ? resp : (resp.colaboradores || []);
    const setores = {};
    emps.forEach(e => {
      const s = e.setor || 'Sem Setor';
      if (!setores[s]) setores[s] = { total: 0, ativos: 0 };
      setores[s].total++;
      if (e.status !== 'desligado') setores[s].ativos++;
    });
    const grid = document.getElementById('risk-engine-grid');
    if (!grid) return;
    const entries = Object.entries(setores).sort((a, b) => b[1].total - a[1].total);
    if (!entries.length) { grid.innerHTML = '<p class="hint">Sem dados suficientes.</p>'; return; }
    grid.innerHTML = entries.map(([nome, d]) => {
      const risk = Math.max(0, Math.min(100, 100 - Math.round(d.ativos / Math.max(1, d.total) * 80)));
      const cls = risk >= 60 ? 'risk-high' : risk >= 30 ? 'risk-med' : 'risk-low';
      const label = risk >= 60 ? '🔴 Alto' : risk >= 30 ? '🟡 Médio' : '🟢 Baixo';
      return `<div class="risk-card ${cls}">
        <div class="risk-card-nome">${esc(nome)}</div>
        <div class="risk-card-score">${risk}<small>/100</small></div>
        <div class="risk-card-label">${label}</div>
        <div class="risk-card-total">${d.total} colaborador${d.total !== 1 ? 'es' : ''}</div>
      </div>`;
    }).join('');
  } catch(e) { console.error('carregarRiskEngine', e); }
}

// ── Assistente Executivo ───────────────────────────────────
async function perguntarExec(pergunta) {
  const inp = document.getElementById('exec-chat-input');
  const q = pergunta || (inp && inp.value.trim());
  if (!q) return;
  if (inp) inp.value = '';
  const el = document.getElementById('exec-chat-resposta');
  if (!el) return;
  el.innerHTML = '<div class="exec-chat-pensando">🤔 Analisando dados da empresa...</div>';
  await new Promise(r => setTimeout(r, 800));
  try {
    const [dash, empsResp] = await Promise.all([
      api('/api/dashboard'),
      api('/api/colaboradores')
    ]);
    const empsList = Array.isArray(empsResp) ? empsResp : (empsResp.colaboradores || []);
    const resposta = gerarRespostaExec(q, dash, empsList);
    el.innerHTML = `<div class="exec-chat-answer"><div class="exec-chat-q">❓ ${esc(q)}</div><div class="exec-chat-r">${resposta}</div></div>`;
  } catch(e) {
    el.innerHTML = '<div class="hint">Erro ao analisar dados.</div>';
  }
}

function gerarRespostaExec(q, dash, emps) {
  const ql = q.toLowerCase();
  if (ql.includes('risco') || ql.includes('área')) {
    const setores = {};
    emps.forEach(e => { const s = e.setor || 'Geral'; setores[s] = (setores[s] || 0) + 1; });
    const top = Object.entries(setores).sort((a, b) => b[1] - a[1])[0];
    return top ? `📍 A área <strong>${esc(top[0])}</strong> concentra o maior número de colaboradores (${top[1]}), representando maior exposição. Recomendo priorizar DDS e treinamentos específicos para este setor.` : 'Dados insuficientes para análise de risco.';
  }
  if (ql.includes('treinamento') || ql.includes('aplicar')) {
    return '📚 Com base nos dados atuais, recomendo aplicar treinamentos de <strong>NR-06 (EPI)</strong> e <strong>Ergonomia</strong>, que apresentam menor índice de participação. Acesse a Academia SST para criar a trilha.';
  }
  if (ql.includes('engajamento') || ql.includes('baixo')) {
    const ativos = emps.filter(e => e.status !== 'desligado');
    const semPontos = ativos.filter(e => !e.pontos || e.pontos < 10);
    return `⚠️ <strong>${semPontos.length}</strong> colaboradores (de ${ativos.length}) ainda não acumularam pontos significativos. Recomendo iniciar uma campanha de engajamento com missões e reconhecimentos.`;
  }
  if (ql.includes('score') || ql.includes('maturidade')) {
    const total = emps.filter(e => e.status !== 'desligado').length;
    return `🏆 A empresa possui <strong>${total}</strong> colaboradores ativos. O Safety Score é calculado com base em Engajamento, Conhecimento, Participação, Cultura, Governança e Comunicação. Acesse a aba Safety Score Corporativo para o índice detalhado.`;
  }
  return `🤖 Analisei os dados da empresa com <strong>${emps.length}</strong> colaboradores cadastrados. Para análises mais específicas, tente perguntas como: "Qual área possui maior risco?", "Qual equipe está com baixo engajamento?" ou "Qual é o Safety Score da empresa?".`;
}

// ── Safety Score Individual ───────────────────────────────
async function carregarSafetyScoreInd() {
  try {
    const resp = await api('/api/colaboradores');
    const emps = Array.isArray(resp) ? resp : (resp.colaboradores || []);
    const ativos = emps.filter(e => e.status !== 'desligado').sort((a, b) => (b.pontos || 0) - (a.pontos || 0));
    const el = document.getElementById('safety-score-ind-lista');
    if (!el) return;
    if (!ativos.length) { el.innerHTML = '<p class="hint">Nenhum colaborador ativo.</p>'; return; }
    const maxPts = Math.max(...ativos.map(e => e.pontos || 0), 1);
    el.innerHTML = ativos.slice(0, 30).map(e => {
      const score = Math.min(100, Math.round((e.pontos || 0) / maxPts * 100));
      const cls = score >= 70 ? '🟢' : score >= 40 ? '🟡' : '🔴';
      const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';
      return `<div class="score-ind-row">
        <div class="score-ind-nome">${esc(e.nome)}</div>
        <div class="score-ind-setor">${esc(e.setor || '–')}</div>
        <div class="score-ind-bar-wrap"><div class="score-ind-bar" style="width:${score}%;background:${color}"></div></div>
        <div class="score-ind-val">${cls} ${score}</div>
      </div>`;
    }).join('');
  } catch(e) { console.error('carregarSafetyScoreInd', e); }
}

// ── CIPA Estrutura ─────────────────────────────────────────
async function carregarCipaEstrutura() {
  try {
    const resp = await api('/api/colaboradores');
    const emps = Array.isArray(resp) ? resp : (resp.colaboradores || []);
    const cipeiros = emps.filter(e => (e.roles || []).includes('cipa') && e.status !== 'desligado');
    const el = document.getElementById('cipa-estrutura-lista');
    if (!el) return;
    if (!cipeiros.length) { el.innerHTML = '<p class="hint">Nenhum integrante da CIPA cadastrado. Atribua o papel <strong>CIPA</strong> no cadastro de colaboradores.</p>'; return; }
    const CARGO_LABELS = { cipa_presidente: 'Presidente', cipa_vice: 'Vice-Presidente', cipa_secretario: 'Secretário', cipa_titular: 'Titular', cipa_suplente: 'Suplente' };
    el.innerHTML = `<div class="qeq-grid">${cipeiros.map(e => {
      const cargo = (e.subRoles || []).find(r => r.startsWith('cipa_'));
      const cargoLabel = cargo ? (CARGO_LABELS[cargo] || cargo) : 'Integrante';
      const ini = (e.nome || '?').slice(0, 2).toUpperCase();
      return `<div class="qeq-card"><div class="qeq-avatar" style="background:#0ea5e9">${ini}</div><div class="qeq-nome">${esc(e.nome)}</div><div class="qeq-funcao">${cargoLabel}</div><div class="qeq-setor">${esc(e.setor || '')}</div></div>`;
    }).join('')}</div>`;
  } catch(e) { console.error('carregarCipaEstrutura', e); }
}

// ── Brigada Estrutura ──────────────────────────────────────
async function carregarBrigadaEstrutura() {
  try {
    const resp = await api('/api/colaboradores');
    const emps = Array.isArray(resp) ? resp : (resp.colaboradores || []);
    const brigadistas = emps.filter(e => (e.roles || []).includes('brigada') && e.status !== 'desligado');
    const el = document.getElementById('brigada-estrutura-lista');
    if (!el) return;
    if (!brigadistas.length) { el.innerHTML = '<p class="hint">Nenhum brigadista cadastrado. Atribua o papel <strong>Brigada</strong> no cadastro de colaboradores.</p>'; return; }
    const CARGO_LABELS = { brigada_coordenador: 'Coordenador', brigada_lider: 'Líder', brigada_brigadista: 'Brigadista', brigada_socorrista: 'Socorrista' };
    el.innerHTML = `<div class="qeq-grid">${brigadistas.map(e => {
      const cargo = (e.subRoles || []).find(r => r.startsWith('brigada_'));
      const cargoLabel = cargo ? (CARGO_LABELS[cargo] || cargo) : 'Brigadista';
      const ini = (e.nome || '?').slice(0, 2).toUpperCase();
      return `<div class="qeq-card"><div class="qeq-avatar" style="background:#dc2626">${ini}</div><div class="qeq-nome">${esc(e.nome)}</div><div class="qeq-funcao">${cargoLabel}</div><div class="qeq-setor">${esc(e.setor || '')}</div></div>`;
    }).join('')}</div>`;
  } catch(e) { console.error('carregarBrigadaEstrutura', e); }
}

// ── Banco de Ideias ────────────────────────────────────────
function enviarIdeia() {
  const titulo = document.getElementById('ideia-titulo')?.value.trim();
  const cat = document.getElementById('ideia-categoria')?.value;
  const desc = document.getElementById('ideia-descricao')?.value.trim();
  if (!titulo || !desc) { alert('Preencha o título e a descrição.'); return; }
  const lista = document.getElementById('banco-ideias-lista');
  if (lista) {
    const card = document.createElement('div');
    card.className = 'ideia-card';
    card.innerHTML = `<div class="ideia-titulo">${esc(titulo)} <span class="badge badge-azul">${esc(cat)}</span></div><div class="ideia-desc">${esc(desc)}</div><div class="hint" style="margin-top:4px">Enviado agora</div>`;
    if (lista.querySelector('.hint')) lista.innerHTML = '';
    lista.prepend(card);
  }
  document.getElementById('ideia-titulo').value = '';
  document.getElementById('ideia-descricao').value = '';
  toast('Ideia enviada com sucesso!');
}

// ── Canal SESMT ────────────────────────────────────────────
function enviarPerguntaSesmt() {
  const pergunta = document.getElementById('sesmt-pergunta')?.value.trim();
  const cat = document.getElementById('sesmt-pergunta-cat')?.value;
  const urg = document.getElementById('sesmt-urgencia')?.value;
  if (!pergunta) { alert('Digite sua pergunta.'); return; }
  const lista = document.getElementById('canal-sesmt-lista');
  if (lista) {
    const card = document.createElement('div');
    card.className = 'sesmt-pergunta-card';
    const urgColor = urg === 'Urgente' ? '#dc2626' : urg === 'Alta' ? '#f59e0b' : '#6b7280';
    card.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:flex-start"><div class="sesmt-perg-texto">${esc(pergunta)}</div><span class="badge" style="background:${urgColor}20;color:${urgColor}">${esc(urg)}</span></div><div class="hint">${esc(cat)} · Aguardando resposta...</div>`;
    if (lista.querySelector('.hint')) lista.innerHTML = '';
    lista.prepend(card);
  }
  document.getElementById('sesmt-pergunta').value = '';
  toast('Pergunta enviada ao SESMT!');
}

/* ── Reconhecimentos 360° ──────────────────────────────── */
async function carregarReconhec360() {
  try {
    const data = await api('/api/reconhecimentos/meus');
    renderR360Lista('r360-recebidos-lista', data.recebidos || [], 'recebido');
    renderR360Lista('r360-enviados-lista',  data.enviados  || [], 'enviado');
  } catch(e) { console.error(e); }
}

function renderR360Lista(elId, list, tipo) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!list.length) { el.innerHTML = `<p class="hint">Nenhum reconhecimento ${tipo} ainda.</p>`; return; }
  const BADGE_LABELS = {
    lider:'🦁 Líder de Segurança', colaborador:'🤝 Colaborador Exemplar', cipa:'🛡 Destaque CIPA',
    brigada:'🚒 Destaque Brigada', inovacao:'💡 Inovação em Segurança', comunicacao:'📣 Comunicação'
  };
  el.innerHTML = list.map(r => `
    <div class="r360-card">
      <div class="r360-badge">${BADGE_LABELS[r.tipoBadge] || r.badgeLabel || r.tipoBadge || '🏅'}</div>
      <div class="r360-nome">${esc(tipo === 'recebido' ? (r.gestorNome || r.autorNome || 'SESMT') : (r.homenageadoNome || '–'))}</div>
      <div class="r360-msg">${esc(r.mensagem || '')}</div>
      <div class="r360-data hint">${tsDataHora(r.timestamp)}</div>
    </div>`).join('');
}

function r360Tab(tab) {
  document.querySelectorAll('[data-r360tab]').forEach(b => b.classList.toggle('active', b.dataset.r360tab === tab));
  document.getElementById('r360-recebidos')?.classList.toggle('hidden', tab !== 'recebidos');
  document.getElementById('r360-enviados')?.classList.toggle('hidden', tab !== 'enviados');
}

/* ── Central de Missões ───────────────────────────────── */
function carregarMissoesCentral() {
  const MISSOES_SEMANAIS = [
    { desc: 'Participar de 3 DDS esta semana',     pontos: 50,  xp: 30, feita: false },
    { desc: 'Realizar um treinamento completo',     pontos: 80,  xp: 60, feita: false },
    { desc: 'Reconhecer um colega',                 pontos: 30,  xp: 20, feita: false },
    { desc: 'Publicar uma boa prática no mural',    pontos: 40,  xp: 25, feita: false },
  ];
  const MISSOES_MENSAIS = [
    { desc: 'Participar de uma campanha de segurança', pontos: 150, xp: 100, feita: false },
    { desc: 'Completar uma trilha de aprendizagem',    pontos: 200, xp: 150, feita: false },
    { desc: 'Participar de ação da CIPA ou Brigada',   pontos: 100, xp:  80, feita: false },
    { desc: 'Obter nota máxima em um quiz',            pontos: 120, xp:  90, feita: false },
  ];
  renderMissoesCentralLista('mc-semanais-lista', MISSOES_SEMANAIS);
  renderMissoesCentralLista('mc-mensais-lista',  MISSOES_MENSAIS);
  const dailyEl = document.getElementById('mc-diarias-lista');
  if (dailyEl) dailyEl.innerHTML = '<p class="hint">Acesse o Painel para ver as missões diárias.</p>';
}

function renderMissoesCentralLista(elId, missoes) {
  const el = document.getElementById(elId);
  if (!el) return;
  const feitas = missoes.filter(m => m.feita).length;
  el.innerHTML = `
    <div class="mc-progress-bar-wrap">
      <div class="mc-progress-bar" style="width:${missoes.length ? Math.round(feitas/missoes.length*100) : 0}%"></div>
    </div>
    <p class="hint" style="margin-bottom:10px">${feitas}/${missoes.length} concluídas</p>
    ${missoes.map((m) => `
      <div class="mc-missao-card ${m.feita ? 'concluida' : ''}">
        <span class="mc-check">${m.feita ? '✅' : '⬜'}</span>
        <div class="mc-missao-info">
          <div class="mc-missao-desc">${esc(m.desc)}</div>
          <div class="mc-missao-recomp"><span class="chip chip-blue">+${m.pontos} pts</span> <span class="chip chip-green">+${m.xp} XP</span></div>
        </div>
      </div>`).join('')}`;
}

function mcTab(tab) {
  document.querySelectorAll('[data-mctab]').forEach(b => b.classList.toggle('active', b.dataset.mctab === tab));
  document.getElementById('mctab-diarias')?.classList.toggle('hidden',  tab !== 'diarias');
  document.getElementById('mctab-semanais')?.classList.toggle('hidden', tab !== 'semanais');
  document.getElementById('mctab-mensais')?.classList.toggle('hidden',  tab !== 'mensais');
}

/* ── Perfil Tabs ─────────────────────────────────────── */
function perfTab(tab) {
  document.querySelectorAll('[data-perftab]').forEach(b => b.classList.toggle('active', b.dataset.perftab === tab));
  document.getElementById('perftab-perfil')?.classList.toggle('hidden',  tab !== 'perfil');
  document.getElementById('perftab-jornada')?.classList.toggle('hidden', tab !== 'jornada');
  document.getElementById('perftab-dna')?.classList.toggle('hidden',     tab !== 'dna');
  if (tab === 'jornada') renderMinhaJornada();
  if (tab === 'dna') renderSafeDNAPage();
}

function renderMinhaJornada() {
  const el = document.getElementById('perfil-jornada');
  if (!el) return;
  el.innerHTML = `
    <div class="panel">
      <h3>🗺️ Minha Jornada</h3>
      <div id="jornada-timeline" class="jornada-timeline">
        <p class="hint">Sua jornada de conquistas aparece aqui à medida que você participa das atividades.</p>
      </div>
    </div>`;
  api('/api/meu-painel').then(p => {
    const el2 = document.getElementById('jornada-timeline');
    if (!el2 || !p.historico?.length) return;
    el2.innerHTML = p.historico.slice(0, 20).map(h => `
      <div class="jornada-item">
        <div class="jornada-dot"></div>
        <div class="jornada-content">
          <div class="jornada-acao">${esc(h.tipo || h.acao || 'Participação')}</div>
          <div class="jornada-pts">+${h.pontos || 0} pts</div>
          <div class="hint jornada-data">${tsDataHora(h.timestamp)}</div>
        </div>
      </div>`).join('');
  }).catch(() => {});
}

function renderSafeDNAPage() {
  const el = document.getElementById('perfil-dna');
  if (!el) return;
  api('/api/meu-painel').then(p => {
    const dna = p.dna || [];
    el.innerHTML = `
      <div class="panel">
        <h3>🧬 Safety DNA — Seu Perfil de Segurança</h3>
        <p class="hint" style="margin-bottom:16px">O sistema identifica automaticamente suas características predominantes com base na sua participação.</p>
        <div class="dna-page-grid">
          ${dna.map(d => `
            <div class="dna-page-card">
              <div class="dna-page-emoji">${d.emoji}</div>
              <div class="dna-page-nome">${esc(d.nome)}</div>
              <div class="dna-page-desc">${esc(d.desc)}</div>
            </div>`).join('')}
        </div>
        <div style="margin-top:24px">
          <h4>Como evoluir seu DNA:</h4>
          <ul class="dna-tips">
            <li>🦅 <strong>Guardião</strong> — Registre observações de segurança</li>
            <li>🧠 <strong>Mentor</strong> — Publique no mural e compartilhe conhecimento</li>
            <li>🔥 <strong>Engajador</strong> — Participe de DDS e atividades</li>
            <li>🎯 <strong>Executor</strong> — Complete treinamentos e acumule pontos</li>
            <li>👑 <strong>Embaixador</strong> — Receba reconhecimentos dos colegas</li>
          </ul>
        </div>
      </div>`;
  }).catch(() => { el.innerHTML = '<p class="hint">Erro ao carregar.</p>'; });
}

/* ── Feedback Anônimo (colaborador) ─────────────────── */
async function enviarFeedbackAnonimo() {
  const tipo = document.getElementById('fb-tipo')?.value;
  const mensagem = document.getElementById('fb-mensagem')?.value.trim();
  if (!mensagem) { toast('Digite sua mensagem.', 'erro'); return; }
  try {
    await api('/api/feedback-anonimo', { method: 'POST', body: { tipo, mensagem } });
    document.getElementById('fb-mensagem').value = '';
    toast('Feedback enviado anonimamente! Obrigado pela contribuição.', 'ok');
  } catch(e) { toast(e.message, 'erro'); }
}

/* ── Feedback Anônimo (gestor) ───────────────────────── */
async function carregarFeedbackAnonimo() {
  try {
    const list = await api('/api/feedback-anonimo');
    const el = document.getElementById('feedback-anonimo-lista');
    if (!el) return;
    if (!list.length) { el.innerHTML = '<p class="hint">Nenhum feedback recebido ainda.</p>'; return; }
    const TIPO_LABELS = { sugestao:'💡 Sugestão', reclamacao:'⚠️ Reclamação', duvida:'❓ Dúvida', percepcao:'💭 Percepção', melhoria:'🔧 Melhoria' };
    const TIPO_COLORS = { sugestao:'#dbeafe', reclamacao:'#fee2e2', duvida:'#fef3c7', percepcao:'#f3e8ff', melhoria:'#dcfce7' };
    el.innerHTML = list.map(f => `
      <div class="fb-anonimo-card" style="border-left-color:${TIPO_COLORS[f.tipo]||'#e5e7eb'}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span class="chip" style="background:${TIPO_COLORS[f.tipo]||'#f3f4f6'}">${TIPO_LABELS[f.tipo] || f.tipo}</span>
          <span class="hint">${tsDataHora(f.timestamp)}</span>
        </div>
        <div>${esc(f.mensagem)}</div>
      </div>`).join('');
  } catch(e) { console.error(e); }
}

/* ── Personalizar Terminologia (gestor) ─────────────────── */
async function carregarTerminologia() {
  const el = document.getElementById('terminologia-form');
  if (!el) return;
  el.innerHTML = '<p class="hint">Carregando…</p>';
  try {
    const data = await api('/api/empresa/terminologia');
    TERMINOLOGIA = data;
    el.innerHTML = Object.keys(TERMINOLOGIA_DEFAULT).map(key => `
      <div class="form-group">
        <label style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">${key}</label>
        <div style="display:flex;gap:8px;align-items:center">
          <input class="input" id="term-${key}" value="${esc(data[key] || TERMINOLOGIA_DEFAULT[key])}" placeholder="${esc(TERMINOLOGIA_DEFAULT[key])}" style="flex:1">
          <span class="hint" style="white-space:nowrap">padrão: <em>${esc(TERMINOLOGIA_DEFAULT[key])}</em></span>
        </div>
      </div>`).join('');
  } catch(e) { el.innerHTML = `<p class="hint">${esc(e.message)}</p>`; }
}

async function salvarTerminologia() {
  const payload = {};
  Object.keys(TERMINOLOGIA_DEFAULT).forEach(key => {
    const el = document.getElementById('term-' + key);
    if (el) payload[key] = el.value.trim() || TERMINOLOGIA_DEFAULT[key];
  });
  try {
    await api('/api/empresa/terminologia', { method: 'PUT', body: payload });
    TERMINOLOGIA = payload;
    toast('Terminologia salva! As alterações serão aplicadas ao recarregar as telas.', 'ok');
  } catch(e) { toast(e.message, 'erro'); }
}

function resetarTerminologia() {
  Object.keys(TERMINOLOGIA_DEFAULT).forEach(key => {
    const el = document.getElementById('term-' + key);
    if (el) el.value = TERMINOLOGIA_DEFAULT[key];
  });
  toast('Termos redefinidos para os valores padrão (ainda não salvo).', 'ok');
}

/* ── Feedback da Plataforma — Gestor ────────────────────── */
function renderOpcoesFbp() {
  const tipo = document.getElementById('fbp-tipo')?.value;
  const box = document.getElementById('fbp-opcoes-wrap');
  if (box) box.style.display = tipo === 'opcao' ? '' : 'none';
}

async function criarPerguntaFeedback() {
  const texto  = document.getElementById('fbp-texto')?.value.trim();
  const tipo   = document.getElementById('fbp-tipo')?.value;
  const opcoes = document.getElementById('fbp-opcoes')?.value.trim();
  if (!texto) { toast('Digite o texto da pergunta.', 'erro'); return; }
  if (tipo === 'opcao' && !opcoes) { toast('Informe as opções (uma por linha).', 'erro'); return; }
  const body = { texto, tipo };
  if (tipo === 'opcao') body.opcoes = opcoes.split('\n').map(s => s.trim()).filter(Boolean);
  try {
    await api('/api/feedback-plataforma/perguntas', { method: 'POST', body });
    document.getElementById('fbp-texto').value = '';
    if (document.getElementById('fbp-opcoes')) document.getElementById('fbp-opcoes').value = '';
    toast('Pergunta enviada aos colaboradores!', 'ok');
    carregarFeedbackPlataformaGestor();
  } catch(e) { toast(e.message, 'erro'); }
}

async function carregarFeedbackPlataformaGestor() {
  const el = document.getElementById('fbp-perguntas-lista');
  if (!el) return;
  el.innerHTML = '<p class="hint">Carregando…</p>';
  try {
    const list = await api('/api/feedback-plataforma/perguntas');
    if (!list.length) { el.innerHTML = '<p class="hint">Nenhuma pergunta ativa no momento.</p>'; return; }
    const TIPO_ICON = { nota:'⭐', texto:'💬', opcao:'🔘' };
    el.innerHTML = list.map(p => `
      <div class="fbp-card" style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="flex:1">
            <span class="chip" style="background:#eff6ff;color:#3b82f6;margin-bottom:8px">${TIPO_ICON[p.tipo]||'❓'} ${p.tipo}</span>
            <div style="font-weight:600;margin-bottom:4px">${esc(p.texto)}</div>
            ${p.opcoes?.length ? `<div class="hint">Opções: ${p.opcoes.map(o=>esc(o)).join(' · ')}</div>` : ''}
            <div class="hint">${tsDataHora(p.criadaEm)}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn-sm" onclick="abrirRespostasFbp(${Number(p.id)})">📊 Ver respostas</button>
            <button class="btn-sm btn-danger" onclick="excluirPerguntaFbp(${Number(p.id)})">🗑</button>
          </div>
        </div>
      </div>`).join('');
  } catch(e) { el.innerHTML = `<p class="hint">${esc(e.message)}</p>`; }
}

async function abrirRespostasFbp(id) {
  try {
    const data = await api('/api/feedback-plataforma/respostas/' + id);
    const { pergunta, total, mediaNotas, distribuicao, textos } = data;
    const TIPO_ICON = { nota:'⭐', texto:'💬', opcao:'🔘' };
    let corpo = `<h3 style="margin-bottom:12px">${TIPO_ICON[pergunta.tipo]||'❓'} ${esc(pergunta.texto)}</h3>
      <p class="hint">${total} resposta${total !== 1 ? 's' : ''} recebida${total !== 1 ? 's' : ''}</p>`;
    if (pergunta.tipo === 'nota' && total > 0) {
      corpo += `<div style="font-size:28px;font-weight:700;color:#f59e0b;margin:12px 0">⭐ ${mediaNotas.toFixed(1)} <span style="font-size:14px;color:#6b7280">/ 5 média</span></div>`;
      corpo += `<div style="display:flex;flex-direction:column;gap:4px">` +
        [5,4,3,2,1].map(n => {
          const cnt = distribuicao[n] || 0;
          const pct = total ? Math.round(cnt/total*100) : 0;
          return `<div style="display:flex;align-items:center;gap:8px">
            <span style="width:14px;text-align:right">${n}★</span>
            <div style="flex:1;background:#f3f4f6;border-radius:4px;height:10px">
              <div style="width:${pct}%;background:#f59e0b;height:10px;border-radius:4px"></div>
            </div>
            <span class="hint">${cnt}</span>
          </div>`;
        }).join('') + `</div>`;
    }
    if (pergunta.tipo === 'opcao' && distribuicao) {
      corpo += `<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">` +
        Object.entries(distribuicao).map(([opcao, cnt]) => {
          const pct = total ? Math.round(cnt/total*100) : 0;
          return `<div>
            <div style="display:flex;justify-content:space-between;margin-bottom:2px">
              <span>${esc(opcao)}</span><span class="hint">${cnt} (${pct}%)</span>
            </div>
            <div style="background:#f3f4f6;border-radius:4px;height:8px">
              <div style="width:${pct}%;background:#3b82f6;height:8px;border-radius:4px"></div>
            </div>
          </div>`;
        }).join('') + `</div>`;
    }
    if (textos?.length) {
      corpo += `<hr style="margin:16px 0"><h4 style="margin-bottom:8px">Respostas abertas</h4>` +
        textos.map(t => `<div style="background:#f9fafb;border-radius:8px;padding:10px;margin-bottom:6px;font-style:italic">"${esc(t)}"</div>`).join('');
    }
    if (total === 0) corpo += '<p class="hint">Nenhuma resposta ainda.</p>';
    abrirModal('📊 Resultados', corpo);
  } catch(e) { toast(e.message, 'erro'); }
}

async function excluirPerguntaFbp(id) {
  if (!confirm('Desativar esta pergunta?')) return;
  try {
    await api('/api/feedback-plataforma/perguntas/' + id, { method: 'DELETE' });
    toast('Pergunta desativada.', 'ok');
    carregarFeedbackPlataformaGestor();
  } catch(e) { toast(e.message, 'erro'); }
}

/* ── Feedback da Plataforma — Colaborador ───────────────── */
async function carregarFeedbackPlataformaColab() {
  const el = document.getElementById('fbp-colab-lista');
  if (!el) return;
  el.innerHTML = '<p class="hint">Carregando…</p>';
  try {
    const list = await api('/api/feedback-plataforma/perguntas');
    if (!list.length) {
      el.innerHTML = `<div style="text-align:center;padding:32px 0">
        <div style="font-size:40px;margin-bottom:12px">✅</div>
        <strong>Tudo em dia!</strong>
        <p class="hint">Não há perguntas ativas no momento.</p>
      </div>`;
      return;
    }
    const TIPO_ICON = { nota:'⭐', texto:'💬', opcao:'🔘' };
    el.innerHTML = list.map(p => {
      let inputHtml = '';
      const pid = Number(p.id);
      if (p.tipo === 'nota') {
        inputHtml = `<div class="nota-stars" style="display:flex;gap:8px;margin:12px 0">
          ${[1,2,3,4,5].map(n => `<button class="btn-star" onclick="responderFeedbackPlataforma(${pid}, ${n})" title="${n} estrela${n>1?'s':''}">☆</button>`).join('')}
        </div>`;
      } else if (p.tipo === 'texto') {
        inputHtml = `<textarea id="fbp-resp-${pid}" class="input" rows="3" placeholder="Sua resposta…" style="width:100%;margin:10px 0;resize:vertical"></textarea>
          <button class="btn btn-primary btn-sm" onclick="responderFeedbackPlataforma(${pid}, document.getElementById('fbp-resp-${pid}').value)">Enviar</button>`;
      } else if (p.tipo === 'opcao' && p.opcoes?.length) {
        inputHtml = `<div style="display:flex;flex-direction:column;gap:6px;margin:10px 0">
          ${p.opcoes.map(o => `<button class="btn btn-outline btn-sm" onclick="responderFeedbackPlataforma(${pid}, ${JSON.stringify(o)})" style="text-align:left">${esc(o)}</button>`).join('')}
        </div>`;
      }
      return `<div class="fbp-colab-card" style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:12px" id="fbp-colab-${pid}">
        <div class="chip" style="background:#eff6ff;color:#3b82f6;margin-bottom:8px">${TIPO_ICON[p.tipo]||'❓'} ${p.tipo}</div>
        <div style="font-weight:600;margin-bottom:4px">${esc(p.texto)}</div>
        ${inputHtml}
      </div>`;
    }).join('');
  } catch(e) { el.innerHTML = `<p class="hint">${esc(e.message)}</p>`; }
}

async function responderFeedbackPlataforma(pergId, resposta) {
  if (resposta === null || resposta === undefined || String(resposta).trim() === '') {
    toast('Selecione ou escreva uma resposta.', 'erro'); return;
  }
  try {
    await api('/api/feedback-plataforma/responder', { method: 'POST', body: { perguntaId: pergId, resposta } });
    const card = document.getElementById('fbp-colab-' + pergId);
    if (card) card.innerHTML = `<div style="text-align:center;padding:16px">
      <div style="font-size:28px">✅</div>
      <strong>Obrigado pelo feedback!</strong>
      <p class="hint">Sua resposta foi registrada.</p>
    </div>`;
    toast('Feedback enviado! Obrigado pela contribuição.', 'ok');
  } catch(e) { toast(e.message, 'erro'); }
}

iniciar().catch(err => {
  document.getElementById('tela-login').classList.remove('hidden');
  console.error(err);
});

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

/* ── Login ── */

function trocarAbaLogin(qual) {
  document.getElementById('tab-gestor').classList.toggle('active', qual === 'gestor');
  document.getElementById('tab-colab').classList.toggle('active', qual === 'colaborador');
  document.getElementById('tab-admin').classList.toggle('active', qual === 'admin');
  document.getElementById('form-login-gestor').classList.toggle('hidden', qual !== 'gestor');
  document.getElementById('form-login-colab').classList.toggle('hidden', qual !== 'colaborador');
  document.getElementById('form-login-admin').classList.toggle('hidden', qual !== 'admin');
  document.getElementById('login-erro').classList.add('hidden');
}

function mostrarErroLogin(msg) {
  const el = document.getElementById('login-erro');
  el.textContent = msg; el.classList.remove('hidden');
}

async function loginGestor(e) {
  e.preventDefault();
  try {
    const r = await api('/api/login', { method: 'POST', body: { perfil: 'gestor', usuario: document.getElementById('login-usuario').value, senha: document.getElementById('login-senha').value } });
    if (r.branding) aplicarBranding(r.branding);
    await iniciar();
  } catch (err) { mostrarErroLogin(err.message); }
  return false;
}

async function loginColaborador(e) {
  e.preventDefault();
  const empresaSel = document.getElementById('login-empresa');
  const companyId  = empresaSel ? (Number(empresaSel.value) || null) : null;
  try {
    const r = await api('/api/login', { method: 'POST', body: { perfil: 'colaborador', matricula: document.getElementById('login-matricula').value, companyId } });
    if (r.branding) aplicarBranding(r.branding);
    await iniciar();
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
    // carregar info da empresa (unidades etc.)
    try { EMPRESA_INFO = await api('/api/empresa/branding'); } catch {}
    navegar('dashboard');
    carregarBrandingConfig();
  } else {
    document.getElementById('colab-nome').textContent = me.nome;
    document.getElementById('app-colab').classList.remove('hidden');
    await carregarPainelColaborador();
    verificarCheckinPendente();
  }
}

/* ── Navegação ── */

async function navegar(view) {
  document.querySelectorAll('#app-gestor .nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('#app-gestor .view').forEach(v => v.classList.add('hidden'));
  document.getElementById('view-' + view).classList.remove('hidden');
  if (view === 'dashboard') await carregarDashboard();
  if (view === 'eventos') await carregarEventos();
  if (view === 'colaboradores') await carregarColaboradores();
  if (view === 'observacoes') await carregarObservacoes();
  if (view === 'sugestoes') await carregarSugestoes();
  if (view === 'ranking') await carregarRanking();
  if (view === 'config') { renderConfig(); carregarBrandingConfig(); }
}

async function navegarColab(view) {
  document.querySelectorAll('#app-colab .nav-btn').forEach(b => b.classList.toggle('active', b.dataset.cview === view));
  document.querySelectorAll('#app-colab .cview').forEach(v => v.classList.add('hidden'));
  document.getElementById('cview-' + view).classList.remove('hidden');
  if (view === 'painel') await carregarPainelColaborador();
  if (view === 'observar') await carregarMinhasObservacoes();
  if (view === 'sugerir') await carregarMinhasSugestoes();
  if (view === 'historico') await carregarHistoricoCompleto();
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
  const d = await api('/api/dashboard');
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
  const obsAbertas = OBSERVACOES.length ? OBSERVACOES.filter(o => o.status === 'aberta').slice(0, 8) : await api('/api/observacoes').then(l => l.filter(o => o.status === 'aberta').slice(0, 8));
  let obsHtml = '<tr><th>Colaborador</th><th>Tipo</th><th>Criticidade</th></tr>';
  if (!obsAbertas.length) obsHtml += '<tr><td colspan="3" class="vazio">Nenhuma observação aberta.</td></tr>';
  for (const o of obsAbertas) {
    obsHtml += `<tr><td>${esc(o.nomeColaborador)}</td><td>${tipoObsTag(o.tipo)}</td><td>${critTag(o.criticidade)}</td></tr>`;
  }
  document.getElementById('dash-obs').innerHTML = obsHtml;
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
  const c = p.colaborador;
  CHECKIN_PENDENTE = p.checkinPendente;

  const conquista = p.conquista;
  const prox = p.proxConquista;
  const banner = document.getElementById('colab-conquista-banner');
  if (conquista) {
    banner.classList.remove('hidden');
    banner.innerHTML = `
      <div class="icon">${conquista.emoji}</div>
      <div class="info">
        <h3>${conquista.nome}</h3>
        <p>${p.pontos} pontos ${prox ? `— próxima conquista: ${prox.emoji} ${prox.nome} (faltam ${prox.minPontos - p.pontos} pts)` : '— Você atingiu o nível máximo!'}</p>
      </div>`;
  } else {
    banner.classList.add('hidden');
  }

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
carregarEmpresasLogin();

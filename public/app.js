/* SESMT 2026 — lógica do frontend */
'use strict';

let CONFIG = { tipos: [], pontos: {} };
let EVENTOS = [];
let COLABORADORES = [];
let MODULOS = [];          // módulos liberados para o perfil atual (fonte única do nome)
let PERFIL = null;         // 'gestor' | 'colaborador' | 'admin'
let battleSSE = null;      // EventSource do DDS Battle

/* ---------------- util ---------------- */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function dataBr(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
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
function toast(msg, erro = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (erro ? ' erro-toast' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3500);
}

/* ---------------- modal ---------------- */

function abrirModal(titulo, corpoHtml) {
  document.getElementById('modal-titulo').textContent = titulo;
  document.getElementById('modal-corpo').innerHTML = corpoHtml;
  document.getElementById('modal-fundo').classList.remove('hidden');
}
function fecharModal() {
  document.getElementById('modal-fundo').classList.add('hidden');
}
function fecharModalFundo(e) {
  if (e.target === document.getElementById('modal-fundo')) fecharModal();
}

/* ---------------- login / sessão ---------------- */

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
  el.textContent = msg;
  el.classList.remove('hidden');
}

async function loginGestor(e) {
  e.preventDefault();
  try {
    await api('/api/login', { method: 'POST', body: {
      perfil: 'gestor',
      usuario: document.getElementById('login-usuario').value,
      senha: document.getElementById('login-senha').value
    }});
    await iniciar();
  } catch (err) { mostrarErroLogin(err.message); }
  return false;
}

async function loginColaborador(e) {
  e.preventDefault();
  try {
    await api('/api/login', { method: 'POST', body: {
      perfil: 'colaborador',
      matricula: document.getElementById('login-matricula').value
    }});
    await iniciar();
  } catch (err) { mostrarErroLogin(err.message); }
  return false;
}

async function loginAdmin(e) {
  e.preventDefault();
  try {
    await api('/api/login', { method: 'POST', body: {
      perfil: 'admin',
      usuario: document.getElementById('login-admin-usuario').value,
      senha: document.getElementById('login-admin-senha').value
    }});
    await iniciar();
  } catch (err) { mostrarErroLogin(err.message); }
  return false;
}

async function sair() {
  fecharBattleSSE();
  await api('/api/logout', { method: 'POST' });
  location.reload();
}

async function iniciar() {
  const me = await api('/api/me');
  document.getElementById('tela-login').classList.toggle('hidden', me.autenticado);
  document.getElementById('app-gestor').classList.add('hidden');
  document.getElementById('app-colab').classList.add('hidden');
  document.getElementById('app-admin').classList.add('hidden');
  fecharBattleSSE();
  if (!me.autenticado) {
    document.getElementById('tela-login').classList.remove('hidden');
    return;
  }
  PERFIL = me.perfil;
  MODULOS = me.modulos || [];
  if (me.perfil === 'admin') {
    document.getElementById('admin-nome').textContent = me.nome;
    document.getElementById('app-admin').classList.remove('hidden');
    await carregarModulosAdmin();
    return;
  }
  CONFIG = await api('/api/config');
  if (me.perfil === 'gestor') {
    document.getElementById('gestor-nome').textContent = me.nome;
    document.getElementById('app-gestor').classList.remove('hidden');
    montarMenuGestor();
    preencherFiltroTipos();
    await Promise.all([carregarColaboradores(), carregarEventos()]);
    navegar(MODULOS.length ? MODULOS[0].id : 'dashboard');
    abrirBattleSSE(); // ouve atualizações do battle mesmo fora da aba
  } else {
    document.getElementById('colab-nome').textContent = me.nome;
    document.getElementById('app-colab').classList.remove('hidden');
    await carregarPainelColaborador();
    if (moduloAtivo('ddsbattle')) { await carregarBattleColaborador(); abrirBattleSSE(); }
  }
}

function moduloAtivo(id) {
  return MODULOS.some(m => m.id === id);
}

/* ---------------- navegação gestor (menu dinâmico, nome de fonte única) ---------------- */

function montarMenuGestor() {
  const nav = document.getElementById('gestor-nav');
  nav.innerHTML = MODULOS.map(m =>
    `<button data-view="${esc(m.id)}" class="nav-btn" onclick="navegar('${esc(m.id)}')">${esc(m.nome)}</button>`
  ).join('');
}

async function navegar(view) {
  if (!moduloAtivo(view)) view = MODULOS.length ? MODULOS[0].id : 'dashboard';
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('#app-gestor .view').forEach(v => v.classList.add('hidden'));
  const sec = document.getElementById('view-' + view);
  if (sec) sec.classList.remove('hidden');
  if (view === 'dashboard') await carregarDashboard();
  if (view === 'eventos') { await carregarEventos(); }
  if (view === 'colaboradores') { await carregarColaboradores(); }
  if (view === 'ranking') await carregarRanking();
  if (view === 'config') renderConfig();
  if (view === 'ddsbattle') await carregarBattleGestor();
}

/* ---------------- dashboard ---------------- */

async function carregarDashboard() {
  const d = await api('/api/dashboard');
  document.getElementById('dash-cards').innerHTML = `
    <div class="card"><div class="num">${d.colaboradoresAtivos}</div><div class="rotulo">Colaboradores ativos</div></div>
    <div class="card"><div class="num">${d.totalEventos}</div><div class="rotulo">Atividades registradas</div></div>
    <div class="card destaque"><div class="num">${d.totalParticipacoes}</div><div class="rotulo">Participações</div></div>
  `;
  let linhas = '<tr><th>Tipo</th><th>Atividades</th><th>Participações</th><th>Pontos/ativ.</th></tr>';
  for (const t of CONFIG.tipos) {
    const info = d.porTipo[t] || { eventos: 0, participacoes: 0 };
    linhas += `<tr><td>${esc(t)}</td><td>${info.eventos}</td><td>${info.participacoes}</td><td>${CONFIG.pontos[t]}</td></tr>`;
  }
  document.getElementById('dash-tipos').innerHTML = linhas;
  document.getElementById('dash-top10').innerHTML = htmlRanking(d.top10, true);
}

function htmlRanking(lista, compacto) {
  let h = compacto
    ? '<tr><th>Pos.</th><th>Nome</th><th>Pontos</th></tr>'
    : '<tr><th>Pos.</th><th>Matrícula</th><th>Nome</th><th>Setor</th><th>Função</th><th>Pontos</th></tr>';
  if (!lista.length) return h + '<tr><td colspan="6" class="vazio">Nenhum colaborador pontuado ainda.</td></tr>';
  for (const r of lista) {
    const medalha = r.posicao === 1 ? '🥇' : r.posicao === 2 ? '🥈' : r.posicao === 3 ? '🥉' : r.posicao + 'º';
    h += compacto
      ? `<tr><td class="medalha">${medalha}</td><td>${esc(r.nome)}</td><td class="pontos-cel">${r.pontos}</td></tr>`
      : `<tr><td class="medalha">${medalha}</td><td>${esc(r.matricula)}</td><td>${esc(r.nome)}</td><td>${esc(r.setor)}</td><td>${esc(r.funcao)}</td><td class="pontos-cel">${r.pontos}</td></tr>`;
  }
  return h;
}

/* ---------------- eventos ---------------- */

function preencherFiltroTipos() {
  const sel = document.getElementById('filtro-tipo');
  sel.innerHTML = '<option value="">Todos os tipos</option>' +
    CONFIG.tipos.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
}

async function carregarEventos() {
  EVENTOS = await api('/api/eventos');
  renderEventos();
}

function renderEventos() {
  const tipo = document.getElementById('filtro-tipo').value;
  const busca = document.getElementById('filtro-busca').value.toLowerCase();
  const lista = EVENTOS.filter(ev =>
    (!tipo || ev.tipo === tipo) &&
    (!busca || (ev.tema + ' ' + ev.responsavel).toLowerCase().includes(busca))
  );
  let h = '<tr><th>Data</th><th>Tipo</th><th>Tema</th><th>Responsável</th><th>Particip.</th><th>Pontos</th><th></th></tr>';
  if (!lista.length) h += '<tr><td colspan="7" class="vazio">Nenhuma atividade registrada.</td></tr>';
  for (const ev of lista) {
    h += `<tr>
      <td>${dataBr(ev.data)}</td>
      <td><span class="tag">${esc(ev.tipo)}</span></td>
      <td>${esc(ev.tema)}</td>
      <td>${esc(ev.responsavel)}</td>
      <td>${ev.totalParticipantes}</td>
      <td class="pontos-cel">${ev.pontosAplicados}</td>
      <td class="acoes">
        <button class="btn btn-sm" onclick="abrirEditarEvento(${ev.id})">Editar</button>
        <button class="btn btn-sm btn-perigo" onclick="excluirEvento(${ev.id})">Excluir</button>
      </td>
    </tr>`;
  }
  document.getElementById('tabela-eventos').innerHTML = h;
}

function formEventoHtml(ev) {
  const hoje = new Date().toISOString().slice(0, 10);
  const selecionados = new Set(ev ? ev.participantes : []);
  const ativos = COLABORADORES.filter(c => c.ativo !== false || selecionados.has(c.id));
  return `
    <div class="linha-2">
      <div>
        <label>Tipo de atividade *</label>
        <select id="ev-tipo">${CONFIG.tipos.map(t =>
          `<option value="${esc(t)}" ${ev && ev.tipo === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
        </select>
      </div>
      <div>
        <label>Data *</label>
        <input type="date" id="ev-data" value="${ev ? ev.data : hoje}">
      </div>
    </div>
    <label>Tema / assunto</label>
    <input type="text" id="ev-tema" value="${ev ? esc(ev.tema) : ''}" placeholder="Ex.: Uso correto de EPI">
    <div class="linha-2">
      <div>
        <label>Responsável / instrutor</label>
        <input type="text" id="ev-resp" value="${ev ? esc(ev.responsavel) : ''}">
      </div>
      <div>
        <label>Pontos (vazio = padrão do tipo)</label>
        <input type="number" id="ev-pontos" min="0" step="1" value="${ev && ev.pontos !== null && ev.pontos !== undefined ? ev.pontos : ''}" placeholder="padrão">
      </div>
    </div>
    <label>Observações</label>
    <textarea id="ev-obs">${ev ? esc(ev.observacoes) : ''}</textarea>
    <label>Lista de presença (${ativos.length} colaboradores)</label>
    <input type="text" id="ev-busca-part" placeholder="Filtrar colaboradores..." oninput="filtrarParticipantes()">
    <div class="lista-participantes" id="ev-lista-part">
      ${ativos.map(c => `
        <label class="item" data-busca="${esc((c.nome + ' ' + c.matricula + ' ' + (c.setor || '')).toLowerCase())}">
          <input type="checkbox" class="chk-part" value="${c.id}" ${selecionados.has(c.id) ? 'checked' : ''} onchange="atualizarContadorSel()">
          <span>${esc(c.nome)} <small>(${esc(c.matricula)}${c.setor ? ' · ' + esc(c.setor) : ''})</small></span>
        </label>`).join('') || '<div class="item">Cadastre colaboradores primeiro.</div>'}
    </div>
    <div class="contador-sel" id="ev-contador"></div>
    <div class="modal-rodape">
      <button class="btn" onclick="marcarTodosVisiveis()">Marcar visíveis</button>
      <button class="btn" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarEvento(${ev ? ev.id : 'null'})">Salvar atividade</button>
    </div>`;
}

function filtrarParticipantes() {
  const q = document.getElementById('ev-busca-part').value.toLowerCase();
  document.querySelectorAll('#ev-lista-part .item').forEach(el => {
    el.style.display = !q || (el.dataset.busca || '').includes(q) ? '' : 'none';
  });
}

function marcarTodosVisiveis() {
  document.querySelectorAll('#ev-lista-part .item').forEach(el => {
    if (el.style.display !== 'none') {
      const chk = el.querySelector('.chk-part');
      if (chk) chk.checked = true;
    }
  });
  atualizarContadorSel();
}

function atualizarContadorSel() {
  const n = document.querySelectorAll('.chk-part:checked').length;
  document.getElementById('ev-contador').textContent = n + ' participante(s) selecionado(s)';
}

async function abrirNovoEvento() {
  await carregarColaboradores();
  abrirModal('Registrar atividade', formEventoHtml(null));
  atualizarContadorSel();
}

async function abrirEditarEvento(id) {
  await carregarColaboradores();
  const ev = EVENTOS.find(e => e.id === id);
  if (!ev) return;
  abrirModal('Editar atividade', formEventoHtml(ev));
  atualizarContadorSel();
}

async function salvarEvento(id) {
  const body = {
    tipo: document.getElementById('ev-tipo').value,
    data: document.getElementById('ev-data').value,
    tema: document.getElementById('ev-tema').value,
    responsavel: document.getElementById('ev-resp').value,
    observacoes: document.getElementById('ev-obs').value,
    pontos: document.getElementById('ev-pontos').value === '' ? null : Number(document.getElementById('ev-pontos').value),
    participantes: [...document.querySelectorAll('.chk-part:checked')].map(c => Number(c.value))
  };
  try {
    if (id) await api('/api/eventos/' + id, { method: 'PUT', body });
    else await api('/api/eventos', { method: 'POST', body });
    fecharModal();
    toast('Atividade salva. ' + body.participantes.length + ' participação(ões) registradas.');
    await carregarEventos();
  } catch (err) { toast(err.message, true); }
}

async function excluirEvento(id) {
  if (!confirm('Excluir esta atividade? Os pontos dos participantes serão removidos.')) return;
  try {
    await api('/api/eventos/' + id, { method: 'DELETE' });
    toast('Atividade excluída.');
    await carregarEventos();
  } catch (err) { toast(err.message, true); }
}

/* ---------------- colaboradores ---------------- */

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
    (!busca || (c.nome + ' ' + c.matricula + ' ' + (c.setor || '')).toLowerCase().includes(busca))
  );
  let h = '<tr><th>Matrícula</th><th>Nome</th><th>Setor</th><th>Função</th><th>Pontos</th><th>Situação</th><th></th></tr>';
  if (!lista.length) h += '<tr><td colspan="7" class="vazio">Nenhum colaborador encontrado. Use “Cadastro em massa” para importar a equipe.</td></tr>';
  for (const c of lista) {
    h += `<tr>
      <td>${esc(c.matricula)}</td>
      <td>${esc(c.nome)}</td>
      <td>${esc(c.setor)}</td>
      <td>${esc(c.funcao)}</td>
      <td class="pontos-cel">${c.pontos}</td>
      <td>${c.ativo !== false ? '<span class="tag">Ativo</span>' : '<span class="tag tag-inativo">Inativo</span>'}</td>
      <td class="acoes">
        <button class="btn btn-sm" onclick="abrirEditarColaborador(${c.id})">Editar</button>
        <button class="btn btn-sm btn-perigo" onclick="excluirColaborador(${c.id})">Excluir</button>
      </td>
    </tr>`;
  }
  tbl.innerHTML = h;
}

function formColaboradorHtml(c) {
  return `
    <div class="linha-2">
      <div>
        <label>Matrícula *</label>
        <input type="text" id="co-matricula" value="${c ? esc(c.matricula) : ''}">
      </div>
      <div>
        <label>Nome completo *</label>
        <input type="text" id="co-nome" value="${c ? esc(c.nome) : ''}">
      </div>
    </div>
    <div class="linha-2">
      <div>
        <label>Setor</label>
        <input type="text" id="co-setor" value="${c ? esc(c.setor) : ''}">
      </div>
      <div>
        <label>Função</label>
        <input type="text" id="co-funcao" value="${c ? esc(c.funcao) : ''}">
      </div>
    </div>
    ${c ? `<label class="check-inline" style="margin-top:10px"><input type="checkbox" id="co-ativo" ${c.ativo !== false ? 'checked' : ''}> colaborador ativo</label>` : ''}
    <div class="modal-rodape">
      <button class="btn" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarColaborador(${c ? c.id : 'null'})">Salvar</button>
    </div>`;
}

function abrirNovoColaborador() {
  abrirModal('Novo colaborador', formColaboradorHtml(null));
}

function abrirEditarColaborador(id) {
  const c = COLABORADORES.find(x => x.id === id);
  if (c) abrirModal('Editar colaborador', formColaboradorHtml(c));
}

async function salvarColaborador(id) {
  const body = {
    matricula: document.getElementById('co-matricula').value,
    nome: document.getElementById('co-nome').value,
    setor: document.getElementById('co-setor').value,
    funcao: document.getElementById('co-funcao').value
  };
  const chkAtivo = document.getElementById('co-ativo');
  if (chkAtivo) body.ativo = chkAtivo.checked;
  try {
    if (id) await api('/api/colaboradores/' + id, { method: 'PUT', body });
    else await api('/api/colaboradores', { method: 'POST', body });
    fecharModal();
    toast('Colaborador salvo.');
    await carregarColaboradores();
  } catch (err) { toast(err.message, true); }
}

async function excluirColaborador(id) {
  const c = COLABORADORES.find(x => x.id === id);
  if (!confirm(`Excluir ${c ? c.nome : 'colaborador'}? Se ele tiver participações, será apenas inativado para preservar o histórico.`)) return;
  try {
    const r = await api('/api/colaboradores/' + id, { method: 'DELETE' });
    toast(r.inativado ? 'Colaborador inativado (possui histórico).' : 'Colaborador removido.');
    await carregarColaboradores();
  } catch (err) { toast(err.message, true); }
}

/* ---------------- cadastro em massa ---------------- */

function abrirImportacao() {
  abrirModal('Cadastro em massa de colaboradores', `
    <p class="hint">Cole abaixo a lista de colaboradores (uma linha por pessoa) ou selecione um arquivo CSV.
    Formato: <b>matrícula;nome;setor;função</b> — setor e função são opcionais.
    Também aceita separação por vírgula ou TAB (colado direto do Excel).</p>
    <label>Arquivo CSV (opcional)</label>
    <input type="file" id="imp-arquivo" accept=".csv,.txt" onchange="lerArquivoImportacao(this)">
    <label>Lista de colaboradores</label>
    <textarea id="imp-texto" style="min-height:180px" placeholder="1001;Maria Silva;Produção;Operadora
1002;João Souza;Manutenção;Mecânico
1003;Ana Lima;Administrativo;Assistente"></textarea>
    <div class="modal-rodape">
      <button class="btn" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="enviarImportacao()">Importar colaboradores</button>
    </div>
    <div id="imp-resultado"></div>`);
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
  if (!texto.trim()) return toast('Cole a lista de colaboradores ou selecione um arquivo.', true);
  try {
    const r = await api('/api/colaboradores/importar', { method: 'POST', body: { texto } });
    let html = `<p class="contador-sel">✔ ${r.inseridos} colaborador(es) importado(s).</p>`;
    if (r.duplicados.length) html += `<p class="hint">Matrículas já existentes (ignoradas): ${r.duplicados.map(esc).join(', ')}</p>`;
    if (r.erros.length) html += `<p class="erro">Linhas com erro: ${r.erros.map(e => 'linha ' + e.linha).join(', ')} — ${esc(r.erros[0].motivo)}</p>`;
    document.getElementById('imp-resultado').innerHTML = html;
    toast(`${r.inseridos} colaborador(es) importado(s).`);
    await carregarColaboradores();
  } catch (err) { toast(err.message, true); }
}

/* ---------------- ranking ---------------- */

async function carregarRanking() {
  const ranking = await api('/api/ranking');
  document.getElementById('tabela-ranking').innerHTML = htmlRanking(ranking, false);
}

/* ---------------- configurações ---------------- */

function renderConfig() {
  const form = document.getElementById('form-pontos');
  form.innerHTML = CONFIG.tipos.map(t => `
    <div class="ponto-linha">
      <span>${esc(t)}</span>
      <input type="number" min="0" step="1" data-tipo="${esc(t)}" value="${CONFIG.pontos[t]}">
      <span style="flex:0">pts</span>
    </div>`).join('') +
    '<button class="btn btn-primary" type="submit">Salvar pontuações</button>';
}

async function salvarPontos(e) {
  e.preventDefault();
  const body = {};
  document.querySelectorAll('#form-pontos input[data-tipo]').forEach(i => { body[i.dataset.tipo] = Number(i.value); });
  try {
    const r = await api('/api/config/pontos', { method: 'PUT', body });
    CONFIG.pontos = r.pontos;
    toast('Pontuações atualizadas.');
  } catch (err) { toast(err.message, true); }
  return false;
}

async function alterarSenha(e) {
  e.preventDefault();
  try {
    await api('/api/senha', { method: 'POST', body: {
      senhaAtual: document.getElementById('senha-atual').value,
      novaSenha: document.getElementById('senha-nova').value
    }});
    document.getElementById('senha-atual').value = '';
    document.getElementById('senha-nova').value = '';
    toast('Senha alterada com sucesso.');
  } catch (err) { toast(err.message, true); }
  return false;
}

/* ---------------- painel do colaborador ---------------- */

async function carregarPainelColaborador() {
  const p = await api('/api/meu-painel');
  const c = p.colaborador;
  document.getElementById('colab-cards').innerHTML = `
    <div class="card destaque"><div class="num">${p.pontos}</div><div class="rotulo">Meus pontos</div></div>
    <div class="card"><div class="num">${p.posicao ? p.posicao + 'º' : '—'}</div><div class="rotulo">Posição no ranking (de ${p.totalColaboradores})</div></div>
    <div class="card"><div class="num">${p.historico.length}</div><div class="rotulo">Participações</div></div>
    <div class="card"><div class="num" style="font-size:17px;margin-top:8px">${esc(c.setor || '—')}</div><div class="rotulo">${esc(c.funcao || 'Setor')}</div></div>
  `;
  let tipos = '<tr><th>Tipo de atividade</th><th>Participações</th><th>Pontos</th></tr>';
  for (const [tipo, info] of Object.entries(p.porTipo)) {
    tipos += `<tr><td>${esc(tipo)}</td><td>${info.eventos}</td><td class="pontos-cel">${info.pontos}</td></tr>`;
  }
  document.getElementById('colab-tipos').innerHTML = tipos;
  document.getElementById('colab-top10').innerHTML = htmlRanking(p.top10, true);
  let hist = '<tr><th>Data</th><th>Tipo</th><th>Tema</th><th>Pontos</th></tr>';
  if (!p.historico.length) hist += '<tr><td colspan="4" class="vazio">Você ainda não tem participações registradas.</td></tr>';
  for (const h of p.historico) {
    hist += `<tr><td>${dataBr(h.data)}</td><td><span class="tag">${esc(h.tipo)}</span></td><td>${esc(h.tema)}</td><td class="pontos-cel">${h.pontos}</td></tr>`;
  }
  document.getElementById('colab-historico').innerHTML = hist;
}

/* ---------------- admin master: licenças de módulos ---------------- */

let MODULOS_ADMIN = [];

async function carregarModulosAdmin() {
  const r = await api('/api/modulos');
  MODULOS_ADMIN = r.modulos;
  renderModulosAdmin();
}

function renderModulosAdmin() {
  const cont = document.getElementById('admin-modulos');
  cont.innerHTML = MODULOS_ADMIN.map(m => `
    <label class="lic-linha ${m.core ? 'lic-core' : ''}">
      <span class="lic-nome">${esc(m.nome)} ${m.core ? '<small>(essencial)</small>' : ''}</span>
      <span class="switch">
        <input type="checkbox" data-mod="${esc(m.id)}" ${m.ativo ? 'checked' : ''} ${m.core ? 'disabled' : ''}>
        <span class="slider"></span>
      </span>
    </label>`).join('');
}

async function salvarModulos() {
  const modulos = {};
  document.querySelectorAll('#admin-modulos input[data-mod]').forEach(i => {
    if (!i.disabled) modulos[i.dataset.mod] = i.checked;
  });
  try {
    const r = await api('/api/modulos', { method: 'PUT', body: { modulos } });
    MODULOS_ADMIN = r.modulos;
    renderModulosAdmin();
    toast('Licenças atualizadas. Gestores e colaboradores já veem a mudança.');
  } catch (err) { toast(err.message, true); }
}

async function alterarSenhaAdmin(e) {
  e.preventDefault();
  try {
    await api('/api/admin/senha', { method: 'POST', body: {
      senhaAtual: document.getElementById('admin-senha-atual').value,
      novaSenha: document.getElementById('admin-senha-nova').value
    }});
    document.getElementById('admin-senha-atual').value = '';
    document.getElementById('admin-senha-nova').value = '';
    toast('Senha alterada com sucesso.');
  } catch (err) { toast(err.message, true); }
  return false;
}

/* ---------------- DDS Battle: SSE (push ao vivo, sem delay) ---------------- */

function abrirBattleSSE() {
  fecharBattleSSE();
  battleSSE = new EventSource('/api/battle/stream');
  battleSSE.addEventListener('update', () => {
    // a cada mudança no servidor, recarrega a visão do battle do perfil atual
    if (PERFIL === 'gestor') {
      const v = document.getElementById('view-ddsbattle');
      if (v && !v.classList.contains('hidden')) carregarBattleGestor();
    } else if (PERFIL === 'colaborador') {
      carregarBattleColaborador();
    }
  });
  battleSSE.onerror = () => { /* o EventSource reconecta sozinho */ };
}

function fecharBattleSSE() {
  if (battleSSE) { battleSSE.close(); battleSSE = null; }
}

/* ---------------- DDS Battle: console do gestor ---------------- */

let BATTLE_DRAFT = [];

async function carregarBattleGestor() {
  const b = await api('/api/battle');
  const badge = document.getElementById('battle-status-badge');
  badge.textContent = b.ativo ? rotuloStatus(b.status) : 'Sem battle';
  const cont = document.getElementById('battle-gestor');
  if (!b.ativo) { cont.innerHTML = htmlMontarBattle(); return; }
  if (b.status === 'lobby') { cont.innerHTML = htmlLobbyGestor(b); return; }
  cont.innerHTML = htmlBattleAoVivoGestor(b);
}

function rotuloStatus(s) {
  return { lobby: 'Sala de espera', pergunta: 'Pergunta no ar', revelacao: 'Resposta revelada', encerrado: 'Encerrado' }[s] || s;
}

function htmlMontarBattle() {
  const linhas = BATTLE_DRAFT.map((p, i) => htmlPerguntaDraft(p, i)).join('');
  return `
    <div class="panel">
      <h3>Montar novo DDS Battle</h3>
      <label>Título</label>
      <input type="text" id="battle-titulo" placeholder="Ex.: DDS Battle — Uso de EPI" value="DDS Battle">
      <div id="battle-perguntas">${linhas || '<p class="hint">Nenhuma pergunta ainda. Adicione a primeira.</p>'}</div>
      <button class="btn" style="margin-top:10px" onclick="addPerguntaDraft()">+ Adicionar pergunta</button>
      <div class="modal-rodape" style="border:0;padding-top:16px">
        <button class="btn btn-primary" onclick="criarBattle()">Criar e abrir sala</button>
      </div>
    </div>`;
}

function htmlPerguntaDraft(p, i) {
  const ops = p.opcoes.map((o, j) => `
    <div class="op-draft">
      <input type="radio" name="correta-${i}" ${p.correta === j ? 'checked' : ''} onchange="setCorreta(${i},${j})" title="Marcar como correta">
      <input type="text" value="${esc(o)}" placeholder="Alternativa ${j + 1}" oninput="setOpcao(${i},${j},this.value)">
      <button class="btn btn-sm btn-perigo" onclick="rmOpcao(${i},${j})" ${p.opcoes.length <= 2 ? 'disabled' : ''}>✕</button>
    </div>`).join('');
  return `
    <div class="pergunta-draft">
      <div class="pergunta-draft-head">
        <b>Pergunta ${i + 1}</b>
        <button class="btn btn-sm btn-perigo" onclick="rmPerguntaDraft(${i})">Remover</button>
      </div>
      <input type="text" value="${esc(p.enunciado)}" placeholder="Enunciado da pergunta" oninput="setEnunciado(${i},this.value)">
      ${ops}
      <button class="btn btn-sm" onclick="addOpcao(${i})">+ alternativa</button>
      <small class="hint"> marque o botão à esquerda da alternativa correta</small>
    </div>`;
}

function addPerguntaDraft() {
  BATTLE_DRAFT.push({ enunciado: '', opcoes: ['', ''], correta: 0 });
  document.getElementById('battle-perguntas').innerHTML = BATTLE_DRAFT.map((p, i) => htmlPerguntaDraft(p, i)).join('');
}
function rmPerguntaDraft(i) { BATTLE_DRAFT.splice(i, 1); refreshDraft(); }
function setEnunciado(i, v) { BATTLE_DRAFT[i].enunciado = v; }
function setOpcao(i, j, v) { BATTLE_DRAFT[i].opcoes[j] = v; }
function setCorreta(i, j) { BATTLE_DRAFT[i].correta = j; }
function addOpcao(i) { if (BATTLE_DRAFT[i].opcoes.length < 5) { BATTLE_DRAFT[i].opcoes.push(''); refreshDraft(); } }
function rmOpcao(i, j) {
  const p = BATTLE_DRAFT[i];
  if (p.opcoes.length <= 2) return;
  p.opcoes.splice(j, 1);
  if (p.correta >= p.opcoes.length) p.correta = 0;
  refreshDraft();
}
function refreshDraft() {
  const el = document.getElementById('battle-perguntas');
  if (el) el.innerHTML = BATTLE_DRAFT.map((p, i) => htmlPerguntaDraft(p, i)).join('') || '<p class="hint">Nenhuma pergunta ainda.</p>';
}

async function criarBattle() {
  const titulo = document.getElementById('battle-titulo').value;
  if (!BATTLE_DRAFT.length) return toast('Adicione ao menos uma pergunta.', true);
  try {
    await api('/api/battle', { method: 'POST', body: { titulo, perguntas: BATTLE_DRAFT } });
    BATTLE_DRAFT = [];
    toast('Battle criado. Compartilhe com a equipe e inicie quando quiser.');
    await carregarBattleGestor();
  } catch (err) { toast(err.message, true); }
}

function htmlLobbyGestor(b) {
  return `
    <div class="panel battle-stage">
      <h3>${esc(b.titulo)}</h3>
      <p class="hint">${b.totalPerguntas} pergunta(s). Os colaboradores entram pela tela deles em <b>DDS Battle</b>.</p>
      <div class="battle-contador">${b.totalParticipantes}</div>
      <div class="rotulo">participante(s) na sala</div>
      ${htmlPlacar(b.placar)}
      <div class="modal-rodape" style="border:0">
        <button class="btn btn-perigo" onclick="encerrarBattle(true)">Cancelar</button>
        <button class="btn btn-primary" onclick="acaoBattle('iniciar')" ${b.totalParticipantes ? '' : ''}>▶ Iniciar battle</button>
      </div>
    </div>`;
}

function htmlBattleAoVivoGestor(b) {
  const q = b.pergunta;
  let acoes = '';
  if (b.status === 'pergunta') {
    acoes = `<button class="btn btn-primary" onclick="acaoBattle('revelar')">Revelar resposta</button>`;
  } else if (b.status === 'revelacao') {
    const ultima = b.perguntaAtual + 1 >= b.totalPerguntas;
    acoes = `<button class="btn btn-primary" onclick="acaoBattle('proxima')">${ultima ? 'Finalizar e ver pódio' : 'Próxima pergunta ▶'}</button>`;
  } else if (b.status === 'encerrado') {
    acoes = `<button class="btn" onclick="novoBattle()">Montar novo battle</button>`;
  }
  let corpo;
  if (b.status === 'encerrado') {
    corpo = `<h3>🏁 Resultado final — ${esc(b.titulo)}</h3>${htmlPodio(b.placar)}`;
  } else {
    const ops = q.opcoes.map((o, j) => `
      <div class="op-ao-vivo ${j === q.correta && b.status === 'revelacao' ? 'op-correta' : ''}">
        <span class="op-letra">${String.fromCharCode(65 + j)}</span> ${esc(o)}
        ${j === q.correta && b.status === 'revelacao' ? ' ✔' : ''}
      </div>`).join('');
    corpo = `
      <div class="battle-q-head">Pergunta ${b.perguntaAtual + 1}/${b.totalPerguntas}
        <span class="badge">${b.respondidos}/${b.totalParticipantes} responderam</span></div>
      <h3 class="battle-enunciado">${esc(q.enunciado)}</h3>
      <div class="ops-ao-vivo">${ops}</div>
      ${htmlPlacar(b.placar)}`;
  }
  return `<div class="panel battle-stage">${corpo}
    <div class="modal-rodape" style="border:0">${acoes}
      ${b.status !== 'encerrado' ? `<button class="btn btn-perigo" onclick="encerrarBattle()">Encerrar</button>` : ''}
    </div></div>`;
}

function htmlPlacar(placar) {
  if (!placar || !placar.length) return '<p class="hint">Ninguém pontuou ainda.</p>';
  let h = '<table class="tabela" style="margin-top:14px"><tr><th>Pos.</th><th>Nome</th><th>Pontos</th></tr>';
  placar.forEach((p, i) => {
    const med = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + 'º';
    h += `<tr><td class="medalha">${med}</td><td>${esc(p.nome)}</td><td class="pontos-cel">${p.score}</td></tr>`;
  });
  return h + '</table>';
}

function htmlPodio(placar) {
  if (!placar || !placar.length) return '<p class="hint">Sem participantes pontuados.</p>';
  return htmlPlacar(placar);
}

async function acaoBattle(acao) {
  try { await api('/api/battle/' + acao, { method: 'POST' }); await carregarBattleGestor(); }
  catch (err) { toast(err.message, true); }
}

async function encerrarBattle(limpar) {
  if (!confirm(limpar ? 'Cancelar e descartar este battle?' : 'Encerrar o battle agora?')) return;
  try {
    if (limpar) await api('/api/battle', { method: 'DELETE' });
    else await api('/api/battle/encerrar', { method: 'POST' });
    await carregarBattleGestor();
  } catch (err) { toast(err.message, true); }
}

async function novoBattle() {
  try { await api('/api/battle', { method: 'DELETE' }); BATTLE_DRAFT = []; await carregarBattleGestor(); }
  catch (err) { toast(err.message, true); }
}

/* ---------------- DDS Battle: tela do colaborador ---------------- */

async function carregarBattleColaborador() {
  if (!moduloAtivo('ddsbattle')) return;
  const cont = document.getElementById('colab-battle');
  if (!cont) return;
  let b;
  try { b = await api('/api/battle'); } catch (e) { cont.innerHTML = ''; return; }
  if (!b.ativo || b.status === 'encerrado') {
    if (b.ativo && b.status === 'encerrado' && b.entrou) {
      cont.innerHTML = `<div class="panel battle-colab"><h3>🏁 DDS Battle encerrado</h3>
        <p>Sua pontuação: <b>${b.meuScore} pts</b></p>${htmlPlacar(b.placar)}</div>`;
    } else { cont.innerHTML = ''; }
    return;
  }
  if (!b.entrou) {
    cont.innerHTML = `<div class="panel battle-colab destaque-battle">
      <h3>⚡ ${esc(b.titulo)}</h3>
      <p>Um DDS Battle está ${b.status === 'lobby' ? 'abrindo' : 'em andamento'}! Entre para participar.</p>
      <button class="btn btn-primary btn-block" onclick="entrarBattle()">Entrar no battle</button></div>`;
    return;
  }
  if (b.status === 'lobby') {
    cont.innerHTML = `<div class="panel battle-colab"><h3>⚡ ${esc(b.titulo)}</h3>
      <p>Você está na sala. Aguarde o gestor iniciar…</p>
      <div class="battle-contador">${b.totalParticipantes}</div><div class="rotulo">na sala</div></div>`;
    return;
  }
  // pergunta ou revelacao
  const q = b.pergunta;
  const jaRespondeu = b.minhaResposta !== null && b.minhaResposta !== undefined;
  const ops = q.opcoes.map((o, j) => {
    let cls = 'op-colab';
    if (b.status === 'revelacao') {
      if (j === q.correta) cls += ' op-correta';
      else if (j === b.minhaResposta) cls += ' op-errada';
    } else if (j === b.minhaResposta) cls += ' op-escolhida';
    const dis = (jaRespondeu || b.status === 'revelacao') ? 'disabled' : '';
    return `<button class="${cls}" ${dis} onclick="responderBattle(${j})">
      <span class="op-letra">${String.fromCharCode(65 + j)}</span> ${esc(o)}</button>`;
  }).join('');
  let feedback = '';
  if (b.status === 'revelacao') {
    feedback = b.acertei ? '<p class="battle-acerto">✔ Você acertou!</p>'
      : jaRespondeu ? '<p class="battle-erro-msg">✘ Resposta incorreta.</p>'
      : '<p class="hint">Você não respondeu a tempo.</p>';
  } else if (jaRespondeu) {
    feedback = '<p class="hint">Resposta registrada! Aguarde os demais…</p>';
  }
  cont.innerHTML = `<div class="panel battle-colab">
    <div class="battle-q-head">Pergunta ${b.perguntaAtual + 1}/${b.totalPerguntas} <span class="badge">${b.meuScore} pts</span></div>
    <h3 class="battle-enunciado">${esc(q.enunciado)}</h3>
    <div class="ops-colab">${ops}</div>
    ${feedback}</div>`;
}

async function entrarBattle() {
  try { await api('/api/battle/entrar', { method: 'POST' }); await carregarBattleColaborador(); }
  catch (err) { toast(err.message, true); }
}

async function responderBattle(opcao) {
  try { await api('/api/battle/responder', { method: 'POST', body: { opcao } }); await carregarBattleColaborador(); }
  catch (err) { toast(err.message, true); }
}

/* ---------------- inicialização ---------------- */

iniciar().catch(err => {
  document.getElementById('tela-login').classList.remove('hidden');
  console.error(err);
});

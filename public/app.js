/* SESMT 2026 — lógica do frontend */
'use strict';

let CONFIG = { tipos: [], pontos: {} };
let EVENTOS = [];
let COLABORADORES = [];

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
  document.getElementById('form-login-gestor').classList.toggle('hidden', qual !== 'gestor');
  document.getElementById('form-login-colab').classList.toggle('hidden', qual !== 'colaborador');
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

async function sair() {
  await api('/api/logout', { method: 'POST' });
  location.reload();
}

async function iniciar() {
  const me = await api('/api/me');
  document.getElementById('tela-login').classList.toggle('hidden', me.autenticado);
  document.getElementById('app-gestor').classList.add('hidden');
  document.getElementById('app-colab').classList.add('hidden');
  if (!me.autenticado) {
    document.getElementById('tela-login').classList.remove('hidden');
    return;
  }
  CONFIG = await api('/api/config');
  if (me.perfil === 'gestor') {
    document.getElementById('gestor-nome').textContent = me.nome;
    document.getElementById('app-gestor').classList.remove('hidden');
    preencherFiltroTipos();
    await Promise.all([carregarColaboradores(), carregarEventos()]);
    navegar('dashboard');
  } else {
    document.getElementById('colab-nome').textContent = me.nome;
    document.getElementById('app-colab').classList.remove('hidden');
    await carregarPainelColaborador();
  }
}

/* ---------------- navegação gestor ---------------- */

async function navegar(view) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('#app-gestor .view').forEach(v => v.classList.add('hidden'));
  document.getElementById('view-' + view).classList.remove('hidden');
  if (view === 'dashboard') await carregarDashboard();
  if (view === 'eventos') { await carregarEventos(); }
  if (view === 'colaboradores') { await carregarColaboradores(); }
  if (view === 'ranking') await carregarRanking();
  if (view === 'config') renderConfig();
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

/* ---------------- inicialização ---------------- */

iniciar().catch(err => {
  document.getElementById('tela-login').classList.remove('hidden');
  console.error(err);
});

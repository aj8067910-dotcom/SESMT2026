/*
 * SESMT 2026 - Servidor de Gestão de Segurança do Trabalho
 * Node.js puro, sem dependências externas.
 *
 * Executar:  node server.js   (porta padrão 3000, configurável via PORT)
 * Login inicial do gestor:  usuário "gestor" / senha "admin123"
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const ACTIVITY_TYPES = [
  'DDS',
  'DESC',
  'Oficina de Percepção de Risco',
  'CIPA em Movimento',
  'Treinamento',
  'Sala de Orientação'
];

const DEFAULT_POINTS = {
  'DDS': 1,
  'DESC': 2,
  'Oficina de Percepção de Risco': 3,
  'CIPA em Movimento': 2,
  'Treinamento': 3,
  'Sala de Orientação': 1
};

/*
 * Registro ÚNICO de módulos do sistema. É a única fonte do nome de cada módulo:
 * usado no menu do gestor, na tela do colaborador e na tela do admin master.
 * Assim o nome NUNCA diverge entre os perfis.
 *   - core: true  => módulo não pode ser desligado (evita travar o sistema).
 *   - licenciavel  => aparece na tela de licenças do admin master.
 */
const MODULES = [
  { id: 'dashboard',     nome: 'Painel',         core: true  },
  { id: 'eventos',       nome: 'Atividades',     core: false },
  { id: 'colaboradores', nome: 'Colaboradores',  core: false },
  { id: 'ranking',       nome: 'Ranking',        core: false },
  { id: 'ddsbattle',     nome: 'DDS Battle',     core: false },
  { id: 'config',        nome: 'Configurações',  core: true  }
];
const MODULE_IDS = MODULES.map(m => m.id);

function defaultModuleState() {
  const s = {};
  for (const m of MODULES) s[m.id] = true; // tudo licenciado por padrão
  return s;
}

function isModuleActive(id) {
  const def = MODULES.find(m => m.id === id);
  if (!def) return true;            // rota sem módulo associado
  if (def.core) return true;        // core sempre ativo
  return db.settings.modules[id] !== false;
}

/* Lista de módulos visível para um perfil (nome vem sempre daqui). */
function modulesForRole(role) {
  return MODULES.map(m => ({
    id: m.id,
    nome: m.nome,
    core: m.core,
    ativo: m.core ? true : db.settings.modules[m.id] !== false
  })).filter(m => role === 'admin' ? true : m.ativo);
}

/* Mapeia um caminho de API para o módulo a que pertence (para bloqueio no servidor). */
function moduleForPath(p) {
  if (p.startsWith('/api/colaboradores')) return 'colaboradores';
  if (p.startsWith('/api/eventos')) return 'eventos';
  if (p === '/api/ranking' || p.startsWith('/api/exportar/ranking')) return 'ranking';
  if (p.startsWith('/api/battle')) return 'ddsbattle';
  if (p === '/api/dashboard') return 'dashboard';
  return null; // login, me, config, senha, modulos, meu-painel: sem bloqueio
}

/* ---------------- Persistência ---------------- */

let db = null;

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return { salt, hash };
}

function loadDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } else {
    const gestorPw = hashPassword('admin123');
    const masterPw = hashPassword('master123');
    db = {
      seq: 1,
      settings: { points: { ...DEFAULT_POINTS }, modules: defaultModuleState() },
      admins: [
        { id: nextIdRaw(), username: 'master', name: 'Administrador Master', salt: masterPw.salt, hash: masterPw.hash }
      ],
      managers: [
        { id: nextIdRaw(), username: 'gestor', name: 'Gestor SESMT', salt: gestorPw.salt, hash: gestorPw.hash }
      ],
      employees: [],
      events: [],
      battle: null
    };
    saveDb();
  }
  // garante que novos tipos tenham pontuação padrão
  for (const t of ACTIVITY_TYPES) {
    if (db.settings.points[t] === undefined) db.settings.points[t] = DEFAULT_POINTS[t] || 1;
  }
  // migração de bancos antigos: garante campos novos
  if (!db.settings.modules) db.settings.modules = defaultModuleState();
  for (const id of MODULE_IDS) {
    if (db.settings.modules[id] === undefined) db.settings.modules[id] = true;
  }
  if (!db.admins) {
    const masterPw = hashPassword('master123');
    db.admins = [{ id: nextId(), username: 'master', name: 'Administrador Master', salt: masterPw.salt, hash: masterPw.hash }];
  }
  if (db.battle === undefined) db.battle = null;
}

let seqCounter = null;
function nextIdRaw() {
  if (seqCounter === null) seqCounter = (db && db.seq) || 1;
  return seqCounter++;
}
function nextId() {
  const id = nextIdRaw();
  db.seq = seqCounter;
  return id;
}

let saveTimer = null;
function saveDb() {
  if (db) db.seq = seqCounter || db.seq;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  }, 50);
}

/* ---------------- Sessões ---------------- */

const sessions = new Map(); // token -> { role: 'gestor'|'colaborador', userId, employeeId }

function createSession(data) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { ...data, createdAt: Date.now() });
  return token;
}

function getSession(req) {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)sesmt_token=([a-f0-9]+)/);
  if (!m) return null;
  return sessions.get(m[1]) || null;
}

/* ---------------- DDS Battle (quiz ao vivo via SSE) ---------------- */

/*
 * Um único battle ativo por vez (db.battle). Estados:
 *   lobby     -> aceitando entradas, ainda não começou
 *   pergunta  -> exibindo uma pergunta, aceitando respostas
 *   revelacao -> resposta correta revelada + placar parcial
 *   encerrado -> fim, placar final
 * Os clientes SSE recebem apenas um "ping"; cada um então busca /api/battle
 * na visão do seu perfil (o colaborador nunca recebe a alternativa correta
 * antes da revelação).
 */

const sseClients = new Set(); // cada item: { res, role }

function sseBroadcast() {
  for (const c of sseClients) {
    try { c.res.write(`event: update\ndata: ${Date.now()}\n\n`); }
    catch (e) { sseClients.delete(c); }
  }
}

function battleParticipantsArray() {
  const b = db.battle;
  if (!b) return [];
  return Object.values(b.participantes)
    .sort((a, z) => z.score - a.score || a.nome.localeCompare(z.nome, 'pt-BR'));
}

function currentQuestion() {
  const b = db.battle;
  if (!b || b.perguntaAtual < 0 || b.perguntaAtual >= b.perguntas.length) return null;
  return b.perguntas[b.perguntaAtual];
}

/* Visão do battle conforme o perfil. Não vaza a alternativa correta. */
function battleView(session) {
  const b = db.battle;
  if (!b) return { ativo: false };
  const role = session ? session.role : null;
  const q = currentQuestion();
  const revelar = b.status === 'revelacao' || b.status === 'encerrado';
  const placar = battleParticipantsArray().map(p => ({ nome: p.nome, score: p.score }));

  const base = {
    ativo: true,
    id: b.id,
    titulo: b.titulo,
    status: b.status,
    perguntaAtual: b.perguntaAtual,
    totalPerguntas: b.perguntas.length,
    totalParticipantes: Object.keys(b.participantes).length,
    placar
  };

  if (q) {
    base.pergunta = {
      enunciado: q.enunciado,
      opcoes: q.opcoes,
      // só envia a correta quando revelado, ou sempre para o gestor (console)
      correta: (revelar || role === 'gestor') ? q.correta : null
    };
    base.respondidos = Object.values(b.participantes).filter(p => p.respostas[b.perguntaAtual] !== undefined).length;
  }

  if (role === 'colaborador' && session) {
    const me = b.participantes[session.employeeId];
    base.entrou = !!me;
    base.meuScore = me ? me.score : 0;
    if (me && b.perguntaAtual >= 0) {
      const r = me.respostas[b.perguntaAtual];
      base.minhaResposta = r !== undefined ? r.opcao : null;
      base.acertei = r !== undefined ? r.correta : null;
    }
  }

  if (role === 'gestor') {
    // o gestor enxerga a lista completa de perguntas para gerenciar
    base.perguntas = b.perguntas.map(p => ({ enunciado: p.enunciado, opcoes: p.opcoes, correta: p.correta }));
  }

  return base;
}

/* ---------------- Utilidades HTTP ---------------- */

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => {
      data += c;
      if (data.length > 5 * 1024 * 1024) { reject(new Error('payload muito grande')); req.destroy(); }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}

/* ---------------- Regras de negócio ---------------- */

function normalizeMatricula(m) {
  return String(m || '').trim().toUpperCase();
}

function employeePoints(employeeId) {
  let total = 0;
  const byType = {};
  for (const t of ACTIVITY_TYPES) byType[t] = { eventos: 0, pontos: 0 };
  for (const ev of db.events) {
    if (ev.participantes.includes(employeeId)) {
      const pts = ev.pontos !== undefined && ev.pontos !== null
        ? ev.pontos
        : (db.settings.points[ev.tipo] || 0);
      total += pts;
      if (!byType[ev.tipo]) byType[ev.tipo] = { eventos: 0, pontos: 0 };
      byType[ev.tipo].eventos++;
      byType[ev.tipo].pontos += pts;
    }
  }
  return { total, byType };
}

function buildRanking() {
  const ranking = db.employees
    .filter(e => e.ativo !== false)
    .map(e => {
      const p = employeePoints(e.id);
      return { id: e.id, matricula: e.matricula, nome: e.nome, setor: e.setor || '', funcao: e.funcao || '', pontos: p.total };
    })
    .sort((a, b) => b.pontos - a.pontos || a.nome.localeCompare(b.nome, 'pt-BR'));
  let pos = 0, lastPts = null;
  ranking.forEach((r, i) => {
    if (r.pontos !== lastPts) { pos = i + 1; lastPts = r.pontos; }
    r.posicao = pos;
  });
  return ranking;
}

function eventPoints(ev) {
  return ev.pontos !== undefined && ev.pontos !== null ? ev.pontos : (db.settings.points[ev.tipo] || 0);
}

/* Importação em massa: aceita texto CSV/colado.
 * Formatos aceitos por linha (separador ; , ou TAB):
 *   matricula;nome;setor;funcao   |   matricula;nome;setor   |   matricula;nome
 */
function parseBulk(text) {
  const lines = String(text || '').split(/\r?\n/);
  const rows = [];
  const errors = [];
  lines.forEach((line, idx) => {
    const raw = line.trim();
    if (!raw) return;
    const parts = raw.split(/\t|;|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(p => p.replace(/^"|"$/g, '').trim());
    // pula linha de cabeçalho
    if (idx === 0 && /matr[ií]cula/i.test(parts[0])) return;
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      errors.push({ linha: idx + 1, conteudo: raw, motivo: 'esperado: matrícula;nome;setor;função' });
      return;
    }
    rows.push({
      matricula: normalizeMatricula(parts[0]),
      nome: parts[1],
      setor: parts[2] || '',
      funcao: parts[3] || ''
    });
  });
  return { rows, errors };
}

/* ---------------- API ---------------- */

const routes = [];
function route(method, pattern, opts, handler) {
  routes.push({ method, pattern, opts, handler });
}

// --- autenticação ---
route('POST', /^\/api\/login$/, { public: true }, async (req, res, m, body) => {
  if (body.perfil === 'admin') {
    const adm = db.admins.find(u => u.username.toLowerCase() === String(body.usuario || '').toLowerCase().trim());
    if (!adm) return sendJson(res, 401, { error: 'Usuário ou senha incorretos.' });
    const check = hashPassword(String(body.senha || ''), adm.salt);
    if (check.hash !== adm.hash) return sendJson(res, 401, { error: 'Usuário ou senha incorretos.' });
    const token = createSession({ role: 'admin', userId: adm.id });
    res.setHeader('Set-Cookie', `sesmt_token=${token}; Path=/; HttpOnly; SameSite=Lax`);
    return sendJson(res, 200, { ok: true, perfil: 'admin', nome: adm.name });
  }
  if (body.perfil === 'gestor') {
    const mgr = db.managers.find(u => u.username.toLowerCase() === String(body.usuario || '').toLowerCase().trim());
    if (!mgr) return sendJson(res, 401, { error: 'Usuário ou senha incorretos.' });
    const check = hashPassword(String(body.senha || ''), mgr.salt);
    if (check.hash !== mgr.hash) return sendJson(res, 401, { error: 'Usuário ou senha incorretos.' });
    const token = createSession({ role: 'gestor', userId: mgr.id });
    res.setHeader('Set-Cookie', `sesmt_token=${token}; Path=/; HttpOnly; SameSite=Lax`);
    return sendJson(res, 200, { ok: true, perfil: 'gestor', nome: mgr.name });
  }
  if (body.perfil === 'colaborador') {
    const mat = normalizeMatricula(body.matricula);
    const emp = db.employees.find(e => e.matricula === mat && e.ativo !== false);
    if (!emp) return sendJson(res, 401, { error: 'Matrícula não encontrada. Procure o SESMT/gestor.' });
    const token = createSession({ role: 'colaborador', employeeId: emp.id });
    res.setHeader('Set-Cookie', `sesmt_token=${token}; Path=/; HttpOnly; SameSite=Lax`);
    return sendJson(res, 200, { ok: true, perfil: 'colaborador', nome: emp.nome });
  }
  return sendJson(res, 400, { error: 'Perfil inválido.' });
});

route('POST', /^\/api\/logout$/, { public: true }, async (req, res) => {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)sesmt_token=([a-f0-9]+)/);
  if (m) sessions.delete(m[1]);
  res.setHeader('Set-Cookie', 'sesmt_token=; Path=/; Max-Age=0');
  sendJson(res, 200, { ok: true });
});

route('GET', /^\/api\/me$/, { public: true }, async (req, res) => {
  const s = getSession(req);
  if (!s) return sendJson(res, 200, { autenticado: false });
  if (s.role === 'admin') {
    const adm = db.admins.find(u => u.id === s.userId);
    return sendJson(res, 200, { autenticado: true, perfil: 'admin', nome: adm ? adm.name : 'Admin', modulos: modulesForRole('admin') });
  }
  if (s.role === 'gestor') {
    const mgr = db.managers.find(u => u.id === s.userId);
    return sendJson(res, 200, { autenticado: true, perfil: 'gestor', nome: mgr ? mgr.name : 'Gestor', modulos: modulesForRole('gestor') });
  }
  const emp = db.employees.find(e => e.id === s.employeeId);
  return sendJson(res, 200, { autenticado: true, perfil: 'colaborador', nome: emp ? emp.nome : '', modulos: modulesForRole('colaborador') });
});

route('POST', /^\/api\/senha$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const mgr = db.managers.find(u => u.id === s.userId);
  if (!mgr) return sendJson(res, 404, { error: 'Gestor não encontrado.' });
  const atual = hashPassword(String(body.senhaAtual || ''), mgr.salt);
  if (atual.hash !== mgr.hash) return sendJson(res, 400, { error: 'Senha atual incorreta.' });
  if (!body.novaSenha || String(body.novaSenha).length < 6) {
    return sendJson(res, 400, { error: 'A nova senha deve ter pelo menos 6 caracteres.' });
  }
  const nova = hashPassword(String(body.novaSenha));
  mgr.salt = nova.salt; mgr.hash = nova.hash;
  saveDb();
  sendJson(res, 200, { ok: true });
});

// --- módulos / licenças (admin master) ---
// GET disponível a qualquer perfil: a UI monta o menu a partir DAQUI (fonte única do nome).
route('GET', /^\/api\/modulos$/, { role: 'any' }, async (req, res, m, body, s) => {
  sendJson(res, 200, { modulos: modulesForRole(s.role) });
});

route('PUT', /^\/api\/modulos$/, { role: 'admin' }, async (req, res, m, body) => {
  const estado = body && typeof body.modulos === 'object' ? body.modulos : null;
  if (!estado) return sendJson(res, 400, { error: 'Formato inválido.' });
  for (const def of MODULES) {
    if (def.core) continue; // core não pode ser desligado
    if (estado[def.id] !== undefined) db.settings.modules[def.id] = !!estado[def.id];
  }
  saveDb();
  sendJson(res, 200, { ok: true, modulos: modulesForRole('admin') });
});

// senha do admin master
route('POST', /^\/api\/admin\/senha$/, { role: 'admin' }, async (req, res, m, body, s) => {
  const adm = db.admins.find(u => u.id === s.userId);
  if (!adm) return sendJson(res, 404, { error: 'Administrador não encontrado.' });
  const atual = hashPassword(String(body.senhaAtual || ''), adm.salt);
  if (atual.hash !== adm.hash) return sendJson(res, 400, { error: 'Senha atual incorreta.' });
  if (!body.novaSenha || String(body.novaSenha).length < 6) {
    return sendJson(res, 400, { error: 'A nova senha deve ter pelo menos 6 caracteres.' });
  }
  const nova = hashPassword(String(body.novaSenha));
  adm.salt = nova.salt; adm.hash = nova.hash;
  saveDb();
  sendJson(res, 200, { ok: true });
});

// --- configuração de pontos ---
route('GET', /^\/api\/config$/, { role: 'any' }, async (req, res) => {
  sendJson(res, 200, { tipos: ACTIVITY_TYPES, pontos: db.settings.points });
});

route('PUT', /^\/api\/config\/pontos$/, { role: 'gestor' }, async (req, res, m, body) => {
  for (const t of ACTIVITY_TYPES) {
    if (body[t] !== undefined) {
      const v = Number(body[t]);
      if (!Number.isFinite(v) || v < 0) return sendJson(res, 400, { error: `Pontuação inválida para ${t}.` });
      db.settings.points[t] = v;
    }
  }
  saveDb();
  sendJson(res, 200, { ok: true, pontos: db.settings.points });
});

// --- colaboradores ---
route('GET', /^\/api\/colaboradores$/, { role: 'gestor', module: 'colaboradores' }, async (req, res) => {
  const list = db.employees.map(e => ({ ...e, pontos: employeePoints(e.id).total }));
  sendJson(res, 200, list);
});

route('POST', /^\/api\/colaboradores$/, { role: 'gestor' }, async (req, res, m, body) => {
  const mat = normalizeMatricula(body.matricula);
  if (!mat || !body.nome || !String(body.nome).trim()) {
    return sendJson(res, 400, { error: 'Matrícula e nome são obrigatórios.' });
  }
  if (db.employees.some(e => e.matricula === mat)) {
    return sendJson(res, 409, { error: `Matrícula ${mat} já cadastrada.` });
  }
  const emp = {
    id: nextId(),
    matricula: mat,
    nome: String(body.nome).trim(),
    setor: String(body.setor || '').trim(),
    funcao: String(body.funcao || '').trim(),
    ativo: true
  };
  db.employees.push(emp);
  saveDb();
  sendJson(res, 201, emp);
});

route('POST', /^\/api\/colaboradores\/importar$/, { role: 'gestor' }, async (req, res, m, body) => {
  const { rows, errors } = parseBulk(body.texto);
  const inseridos = [];
  const duplicados = [];
  for (const r of rows) {
    if (db.employees.some(e => e.matricula === r.matricula) || inseridos.some(e => e.matricula === r.matricula)) {
      duplicados.push(r.matricula);
      continue;
    }
    const emp = { id: nextId(), ...r, ativo: true };
    db.employees.push(emp);
    inseridos.push(emp);
  }
  saveDb();
  sendJson(res, 200, { inseridos: inseridos.length, duplicados, erros: errors });
});

route('PUT', /^\/api\/colaboradores\/(\d+)$/, { role: 'gestor' }, async (req, res, m, body) => {
  const emp = db.employees.find(e => e.id === Number(m[1]));
  if (!emp) return sendJson(res, 404, { error: 'Colaborador não encontrado.' });
  if (body.matricula !== undefined) {
    const mat = normalizeMatricula(body.matricula);
    if (!mat) return sendJson(res, 400, { error: 'Matrícula inválida.' });
    if (db.employees.some(e => e.matricula === mat && e.id !== emp.id)) {
      return sendJson(res, 409, { error: `Matrícula ${mat} já cadastrada.` });
    }
    emp.matricula = mat;
  }
  if (body.nome !== undefined) emp.nome = String(body.nome).trim();
  if (body.setor !== undefined) emp.setor = String(body.setor).trim();
  if (body.funcao !== undefined) emp.funcao = String(body.funcao).trim();
  if (body.ativo !== undefined) emp.ativo = !!body.ativo;
  saveDb();
  sendJson(res, 200, emp);
});

route('DELETE', /^\/api\/colaboradores\/(\d+)$/, { role: 'gestor' }, async (req, res, m) => {
  const id = Number(m[1]);
  const idx = db.employees.findIndex(e => e.id === id);
  if (idx === -1) return sendJson(res, 404, { error: 'Colaborador não encontrado.' });
  const participa = db.events.some(ev => ev.participantes.includes(id));
  if (participa) {
    // preserva histórico: apenas inativa
    db.employees[idx].ativo = false;
    saveDb();
    return sendJson(res, 200, { ok: true, inativado: true });
  }
  db.employees.splice(idx, 1);
  saveDb();
  sendJson(res, 200, { ok: true, removido: true });
});

// --- eventos / atividades ---
route('GET', /^\/api\/eventos$/, { role: 'gestor' }, async (req, res) => {
  const list = db.events
    .slice()
    .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)
    .map(ev => ({ ...ev, pontosAplicados: eventPoints(ev), totalParticipantes: ev.participantes.length }));
  sendJson(res, 200, list);
});

route('POST', /^\/api\/eventos$/, { role: 'gestor' }, async (req, res, m, body) => {
  if (!ACTIVITY_TYPES.includes(body.tipo)) return sendJson(res, 400, { error: 'Tipo de atividade inválido.' });
  if (!body.data || !/^\d{4}-\d{2}-\d{2}$/.test(body.data)) return sendJson(res, 400, { error: 'Data inválida (use AAAA-MM-DD).' });
  const participantes = Array.isArray(body.participantes) ? body.participantes.map(Number) : [];
  const validIds = new Set(db.employees.map(e => e.id));
  const invalid = participantes.filter(id => !validIds.has(id));
  if (invalid.length) return sendJson(res, 400, { error: 'Participantes inválidos: ' + invalid.join(', ') });
  const ev = {
    id: nextId(),
    tipo: body.tipo,
    data: body.data,
    tema: String(body.tema || '').trim(),
    responsavel: String(body.responsavel || '').trim(),
    observacoes: String(body.observacoes || '').trim(),
    pontos: body.pontos !== undefined && body.pontos !== null && body.pontos !== '' ? Number(body.pontos) : null,
    participantes: [...new Set(participantes)]
  };
  if (ev.pontos !== null && (!Number.isFinite(ev.pontos) || ev.pontos < 0)) {
    return sendJson(res, 400, { error: 'Pontuação inválida.' });
  }
  db.events.push(ev);
  saveDb();
  sendJson(res, 201, ev);
});

route('PUT', /^\/api\/eventos\/(\d+)$/, { role: 'gestor' }, async (req, res, m, body) => {
  const ev = db.events.find(e => e.id === Number(m[1]));
  if (!ev) return sendJson(res, 404, { error: 'Evento não encontrado.' });
  if (body.tipo !== undefined) {
    if (!ACTIVITY_TYPES.includes(body.tipo)) return sendJson(res, 400, { error: 'Tipo de atividade inválido.' });
    ev.tipo = body.tipo;
  }
  if (body.data !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.data)) return sendJson(res, 400, { error: 'Data inválida.' });
    ev.data = body.data;
  }
  if (body.tema !== undefined) ev.tema = String(body.tema).trim();
  if (body.responsavel !== undefined) ev.responsavel = String(body.responsavel).trim();
  if (body.observacoes !== undefined) ev.observacoes = String(body.observacoes).trim();
  if (body.pontos !== undefined) {
    ev.pontos = body.pontos === null || body.pontos === '' ? null : Number(body.pontos);
    if (ev.pontos !== null && (!Number.isFinite(ev.pontos) || ev.pontos < 0)) {
      return sendJson(res, 400, { error: 'Pontuação inválida.' });
    }
  }
  if (body.participantes !== undefined) {
    const participantes = Array.isArray(body.participantes) ? body.participantes.map(Number) : [];
    const validIds = new Set(db.employees.map(e => e.id));
    const invalid = participantes.filter(id => !validIds.has(id));
    if (invalid.length) return sendJson(res, 400, { error: 'Participantes inválidos.' });
    ev.participantes = [...new Set(participantes)];
  }
  saveDb();
  sendJson(res, 200, ev);
});

route('DELETE', /^\/api\/eventos\/(\d+)$/, { role: 'gestor' }, async (req, res, m) => {
  const idx = db.events.findIndex(e => e.id === Number(m[1]));
  if (idx === -1) return sendJson(res, 404, { error: 'Evento não encontrado.' });
  db.events.splice(idx, 1);
  saveDb();
  sendJson(res, 200, { ok: true });
});

// --- ranking e dashboard ---
route('GET', /^\/api\/ranking$/, { role: 'any' }, async (req, res) => {
  sendJson(res, 200, buildRanking());
});

route('GET', /^\/api\/dashboard$/, { role: 'gestor' }, async (req, res) => {
  const porTipo = {};
  for (const t of ACTIVITY_TYPES) porTipo[t] = { eventos: 0, participacoes: 0 };
  for (const ev of db.events) {
    if (!porTipo[ev.tipo]) porTipo[ev.tipo] = { eventos: 0, participacoes: 0 };
    porTipo[ev.tipo].eventos++;
    porTipo[ev.tipo].participacoes += ev.participantes.length;
  }
  const ranking = buildRanking();
  sendJson(res, 200, {
    colaboradoresAtivos: db.employees.filter(e => e.ativo !== false).length,
    totalEventos: db.events.length,
    totalParticipacoes: db.events.reduce((s, ev) => s + ev.participantes.length, 0),
    porTipo,
    top10: ranking.slice(0, 10)
  });
});

// --- visão do colaborador ---
route('GET', /^\/api\/meu-painel$/, { role: 'colaborador' }, async (req, res, m, body, s) => {
  const emp = db.employees.find(e => e.id === s.employeeId);
  if (!emp) return sendJson(res, 404, { error: 'Colaborador não encontrado.' });
  const pts = employeePoints(emp.id);
  const ranking = buildRanking();
  const minha = ranking.find(r => r.id === emp.id);
  const historico = db.events
    .filter(ev => ev.participantes.includes(emp.id))
    .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)
    .map(ev => ({ id: ev.id, data: ev.data, tipo: ev.tipo, tema: ev.tema, pontos: eventPoints(ev) }));
  sendJson(res, 200, {
    colaborador: { matricula: emp.matricula, nome: emp.nome, setor: emp.setor, funcao: emp.funcao },
    pontos: pts.total,
    porTipo: pts.byType,
    posicao: minha ? minha.posicao : null,
    totalColaboradores: ranking.length,
    historico,
    top10: ranking.slice(0, 10)
  });
});

// --- exportação CSV (gestor) ---
route('GET', /^\/api\/exportar\/ranking$/, { role: 'gestor' }, async (req, res) => {
  const ranking = buildRanking();
  const lines = ['posicao;matricula;nome;setor;funcao;pontos'];
  for (const r of ranking) {
    lines.push([r.posicao, r.matricula, r.nome, r.setor, r.funcao, r.pontos].join(';'));
  }
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="ranking_sesmt.csv"'
  });
  res.end('﻿' + lines.join('\n'));
});

// --- DDS Battle (quiz ao vivo) ---

// Stream SSE: empurra um "ping" a cada mudança; o cliente busca /api/battle.
route('GET', /^\/api\/battle\/stream$/, { role: 'any' }, async (req, res, m, body, s) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write('retry: 2000\n\n');
  res.write(`event: update\ndata: ${Date.now()}\n\n`); // estado inicial
  const client = { res, role: s.role };
  sseClients.add(client);
  const keep = setInterval(() => { try { res.write(': keep-alive\n\n'); } catch (e) {} }, 25000);
  req.on('close', () => { clearInterval(keep); sseClients.delete(client); });
});

// Estado atual do battle, na visão do perfil.
route('GET', /^\/api\/battle$/, { role: 'any' }, async (req, res, m, body, s) => {
  sendJson(res, 200, battleView(s));
});

// Gestor cria/configura um novo battle.
route('POST', /^\/api\/battle$/, { role: 'gestor' }, async (req, res, m, body) => {
  const titulo = String(body.titulo || 'DDS Battle').trim() || 'DDS Battle';
  const perguntasIn = Array.isArray(body.perguntas) ? body.perguntas : [];
  if (!perguntasIn.length) return sendJson(res, 400, { error: 'Adicione ao menos uma pergunta.' });
  const perguntas = [];
  for (let i = 0; i < perguntasIn.length; i++) {
    const p = perguntasIn[i] || {};
    const enunciado = String(p.enunciado || '').trim();
    const opcoes = Array.isArray(p.opcoes) ? p.opcoes.map(o => String(o || '').trim()).filter(o => o) : [];
    const correta = Number(p.correta);
    if (!enunciado) return sendJson(res, 400, { error: `Pergunta ${i + 1}: enunciado vazio.` });
    if (opcoes.length < 2) return sendJson(res, 400, { error: `Pergunta ${i + 1}: informe ao menos 2 alternativas.` });
    if (!Number.isInteger(correta) || correta < 0 || correta >= opcoes.length) {
      return sendJson(res, 400, { error: `Pergunta ${i + 1}: marque a alternativa correta.` });
    }
    perguntas.push({ enunciado, opcoes, correta, pontos: Number(p.pontos) > 0 ? Number(p.pontos) : 10 });
  }
  db.battle = {
    id: nextId(),
    titulo,
    perguntas,
    perguntaAtual: -1,
    status: 'lobby',
    participantes: {},
    criadoEm: Date.now()
  };
  saveDb();
  sseBroadcast();
  sendJson(res, 201, battleView({ role: 'gestor' }));
});

// Gestor inicia (primeira pergunta).
route('POST', /^\/api\/battle\/iniciar$/, { role: 'gestor' }, async (req, res) => {
  const b = db.battle;
  if (!b) return sendJson(res, 404, { error: 'Nenhum battle criado.' });
  if (!b.perguntas.length) return sendJson(res, 400, { error: 'Battle sem perguntas.' });
  b.status = 'pergunta';
  b.perguntaAtual = 0;
  saveDb(); sseBroadcast();
  sendJson(res, 200, battleView({ role: 'gestor' }));
});

// Gestor revela a resposta da pergunta atual.
route('POST', /^\/api\/battle\/revelar$/, { role: 'gestor' }, async (req, res) => {
  const b = db.battle;
  if (!b || b.status !== 'pergunta') return sendJson(res, 400, { error: 'Não há pergunta em andamento.' });
  b.status = 'revelacao';
  saveDb(); sseBroadcast();
  sendJson(res, 200, battleView({ role: 'gestor' }));
});

// Gestor avança para a próxima pergunta (ou encerra se for a última).
route('POST', /^\/api\/battle\/proxima$/, { role: 'gestor' }, async (req, res) => {
  const b = db.battle;
  if (!b) return sendJson(res, 404, { error: 'Nenhum battle ativo.' });
  if (b.perguntaAtual + 1 >= b.perguntas.length) {
    b.status = 'encerrado';
  } else {
    b.perguntaAtual += 1;
    b.status = 'pergunta';
  }
  saveDb(); sseBroadcast();
  sendJson(res, 200, battleView({ role: 'gestor' }));
});

// Gestor encerra a qualquer momento.
route('POST', /^\/api\/battle\/encerrar$/, { role: 'gestor' }, async (req, res) => {
  const b = db.battle;
  if (!b) return sendJson(res, 404, { error: 'Nenhum battle ativo.' });
  b.status = 'encerrado';
  saveDb(); sseBroadcast();
  sendJson(res, 200, battleView({ role: 'gestor' }));
});

// Gestor limpa o battle (volta ao estado sem battle).
route('DELETE', /^\/api\/battle$/, { role: 'gestor' }, async (req, res) => {
  db.battle = null;
  saveDb(); sseBroadcast();
  sendJson(res, 200, { ok: true });
});

// Colaborador entra no battle.
route('POST', /^\/api\/battle\/entrar$/, { role: 'colaborador' }, async (req, res, m, body, s) => {
  const b = db.battle;
  if (!b || b.status === 'encerrado') return sendJson(res, 400, { error: 'Nenhum DDS Battle disponível agora.' });
  const emp = db.employees.find(e => e.id === s.employeeId);
  if (!emp) return sendJson(res, 404, { error: 'Colaborador não encontrado.' });
  if (!b.participantes[emp.id]) {
    b.participantes[emp.id] = { id: emp.id, nome: emp.nome, score: 0, respostas: {} };
    saveDb(); sseBroadcast();
  }
  sendJson(res, 200, battleView(s));
});

// Colaborador responde a pergunta atual.
route('POST', /^\/api\/battle\/responder$/, { role: 'colaborador' }, async (req, res, m, body, s) => {
  const b = db.battle;
  if (!b || b.status !== 'pergunta') return sendJson(res, 400, { error: 'Nenhuma pergunta em andamento.' });
  const me = b.participantes[s.employeeId];
  if (!me) return sendJson(res, 400, { error: 'Você precisa entrar no battle primeiro.' });
  const qIdx = b.perguntaAtual;
  if (me.respostas[qIdx] !== undefined) return sendJson(res, 409, { error: 'Você já respondeu esta pergunta.' });
  const q = b.perguntas[qIdx];
  const opcao = Number(body.opcao);
  if (!Number.isInteger(opcao) || opcao < 0 || opcao >= q.opcoes.length) {
    return sendJson(res, 400, { error: 'Alternativa inválida.' });
  }
  const correta = opcao === q.correta;
  me.respostas[qIdx] = { opcao, correta };
  if (correta) me.score += q.pontos;
  saveDb(); sseBroadcast();
  sendJson(res, 200, battleView(s));
});

/* ---------------- Arquivos estáticos ---------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function serveStatic(req, res, urlPath) {
  let file = urlPath === '/' ? '/index.html' : urlPath;
  const full = path.normalize(path.join(PUBLIC_DIR, file));
  if (!full.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Não encontrado'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(data);
  });
}

/* ---------------- Servidor ---------------- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const urlPath = decodeURIComponent(url.pathname);

  if (!urlPath.startsWith('/api/')) return serveStatic(req, res, urlPath);

  try {
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = urlPath.match(r.pattern);
      if (!m) continue;
      const session = getSession(req);
      if (!r.opts.public) {
        if (!session) return sendJson(res, 401, { error: 'Não autenticado.' });
        if (r.opts.role === 'admin' && session.role !== 'admin') {
          return sendJson(res, 403, { error: 'Acesso restrito ao administrador master.' });
        }
        if (r.opts.role === 'gestor' && session.role !== 'gestor') {
          return sendJson(res, 403, { error: 'Acesso restrito ao gestor.' });
        }
        if (r.opts.role === 'colaborador' && session.role !== 'colaborador') {
          return sendJson(res, 403, { error: 'Acesso restrito ao colaborador.' });
        }
        // Bloqueio real de módulo no servidor (não basta esconder no front).
        const mod = r.opts.module || moduleForPath(urlPath);
        if (mod && session.role !== 'admin' && !isModuleActive(mod)) {
          return sendJson(res, 403, { error: 'Módulo indisponível. Licença desativada pelo administrador.' });
        }
      }
      const body = (req.method === 'POST' || req.method === 'PUT') ? await readBody(req) : {};
      return await r.handler(req, res, m, body, session);
    }
    sendJson(res, 404, { error: 'Rota não encontrada.' });
  } catch (err) {
    sendJson(res, 500, { error: err.message || 'Erro interno.' });
  }
});

loadDb();
server.listen(PORT, () => {
  console.log(`SESMT 2026 rodando em http://localhost:${PORT}`);
  console.log('Login inicial do gestor: usuário "gestor" / senha "admin123"');
});

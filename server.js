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
    const admin = hashPassword('admin123');
    db = {
      seq: 1,
      settings: { points: { ...DEFAULT_POINTS } },
      managers: [
        { id: nextIdRaw(), username: 'gestor', name: 'Gestor SESMT', salt: admin.salt, hash: admin.hash }
      ],
      employees: [],
      events: []
    };
    saveDb();
  }
  // garante que novos tipos tenham pontuação padrão
  for (const t of ACTIVITY_TYPES) {
    if (db.settings.points[t] === undefined) db.settings.points[t] = DEFAULT_POINTS[t] || 1;
  }
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
  if (s.role === 'gestor') {
    const mgr = db.managers.find(u => u.id === s.userId);
    return sendJson(res, 200, { autenticado: true, perfil: 'gestor', nome: mgr ? mgr.name : 'Gestor' });
  }
  const emp = db.employees.find(e => e.id === s.employeeId);
  return sendJson(res, 200, { autenticado: true, perfil: 'colaborador', nome: emp ? emp.nome : '' });
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
route('GET', /^\/api\/colaboradores$/, { role: 'gestor' }, async (req, res) => {
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
        if (r.opts.role === 'gestor' && session.role !== 'gestor') {
          return sendJson(res, 403, { error: 'Acesso restrito ao gestor.' });
        }
        if (r.opts.role === 'colaborador' && session.role !== 'colaborador') {
          return sendJson(res, 403, { error: 'Acesso restrito ao colaborador.' });
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

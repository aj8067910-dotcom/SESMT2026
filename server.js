/*
 * SafePoint — Sistema Gamificado de SST
 * Node.js puro, sem dependências externas.
 * Login admin: "admin" / "admin123"
 * Login gestor: "gestor" / "admin123"
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
  'Sala de Orientação',
  'Quiz de Segurança',
  'Participação em Campanha'
];

const DEFAULT_POINTS = {
  'DDS': 10,
  'DESC': 15,
  'Oficina de Percepção de Risco': 20,
  'CIPA em Movimento': 20,
  'Treinamento': 30,
  'Sala de Orientação': 15,
  'Quiz de Segurança': 5,
  'Participação em Campanha': 15,
  'Registro de Desvio': 25,
  'Sugestão Aprovada': 50
};

const ACHIEVEMENTS = [
  { key: 'bronze',   nome: 'Bronze',               emoji: '🥉', minPontos: 50 },
  { key: 'prata',    nome: 'Prata',                 emoji: '🥈', minPontos: 150 },
  { key: 'ouro',     nome: 'Ouro',                  emoji: '🥇', minPontos: 300 },
  { key: 'diamante', nome: 'Diamante',               emoji: '💎', minPontos: 500 },
  { key: 'guardiao', nome: 'Guardião da Segurança',  emoji: '🏆', minPontos: 1000 }
];

const DEFAULT_CORES = {
  primaria:   '#1a8a4c',
  secundaria: '#1D6013',
  destaque:   '#7DC528',
  laranja:    '#e8801a'
};

/* ── Persistência ────────────────────────────────────────────── */

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
    const adminPwd = hashPassword('admin123');
    const gestorPwd = hashPassword('admin123');
    const defaultCompanyId = nextIdRaw();
    const gestorId = nextIdRaw();
    db = {
      seq: seqCounter,
      settings: {
        points: { ...DEFAULT_POINTS },
        codigoValidade: 60,
        recompensas: []
      },
      admins: [{ id: nextIdRaw(), username: 'admin', name: 'Super Admin', salt: adminPwd.salt, hash: adminPwd.hash }],
      companies: [{
        id: defaultCompanyId,
        nome: 'Empresa Padrão',
        cnpj: '',
        logo: null,
        cores: { ...DEFAULT_CORES },
        unidades: [{ id: nextIdRaw(), nome: 'Matriz', endereco: '', cidade: '', estado: '' }],
        ativo: true,
        criadaEm: Date.now()
      }],
      managers: [{ id: gestorId, username: 'gestor', name: 'Gestor SESMT', salt: gestorPwd.salt, hash: gestorPwd.hash, companyId: defaultCompanyId }],
      employees: [],
      events: [],
      checkins: [],
      activeCodes: [],
      observations: [],
      suggestions: []
    };
    saveDb();
  }
  // garantir campos novos em DBs antigos
  if (!db.checkins)     db.checkins = [];
  if (!db.activeCodes)  db.activeCodes = [];
  if (!db.observations) db.observations = [];
  if (!db.suggestions)  db.suggestions = [];
  if (!db.admins)       db.admins = [];
  if (!db.companies)    db.companies = [];
  if (!db.settings.recompensas)    db.settings.recompensas = [];
  if (!db.settings.codigoValidade) db.settings.codigoValidade = 60;
  for (const t of ACTIVITY_TYPES) {
    if (db.settings.points[t] === undefined) db.settings.points[t] = DEFAULT_POINTS[t] || 1;
  }
  // garantir admin padrão
  if (!db.admins.length) {
    const p = hashPassword('admin123');
    db.admins.push({ id: nextId(), username: 'admin', name: 'Super Admin', salt: p.salt, hash: p.hash });
  }
  // admin exclusivo SafePoint
  if (!db.admins.find(a => a.username === 'safepoint')) {
    const p = hashPassword('SafePoint@2026');
    db.admins.push({ id: nextId(), username: 'safepoint', name: 'Administrador SafePoint', salt: p.salt, hash: p.hash });
  }
  // empresa padrão: se não há nenhuma, criar
  if (!db.companies.length) {
    const compId = nextId();
    db.companies.push({ id: compId, nome: 'Empresa Padrão', cnpj: '', logo: null, cores: { ...DEFAULT_CORES }, unidades: [{ id: nextId(), nome: 'Matriz', endereco: '', cidade: '', estado: '' }], ativo: true, criadaEm: Date.now() });
  }
  // migrar gestores sem companyId
  const defaultComp = db.companies[0];
  for (const m of db.managers) {
    if (!m.companyId) m.companyId = defaultComp.id;
  }
  // migrar employees sem companyId
  for (const e of db.employees) {
    if (!e.companyId) e.companyId = defaultComp.id;
  }
  // migrar eventos sem companyId
  for (const ev of db.events) {
    if (!ev.companyId) ev.companyId = defaultComp.id;
  }
  // migrar eventos antigos: criar checkins retroativos sem avaliação
  for (const ev of db.events) {
    if (!ev.migrado && Array.isArray(ev.participantes)) {
      for (const empId of ev.participantes) {
        const exists = db.checkins.find(c => c.eventId === ev.id && c.employeeId === empId);
        if (!exists) {
          db.checkins.push({
            id: nextIdRaw(),
            eventId: ev.id,
            employeeId: empId,
            timestamp: ev.data + 'T08:00:00.000Z',
            gps: null,
            avaliado: false,
            avaliacao: null,
            pontosAtribuidos: ev.pontos !== undefined && ev.pontos !== null ? ev.pontos : (db.settings.points[ev.tipo] || 0)
          });
        }
      }
      ev.migrado = true;
    }
  }
}

let seqCounter = 1;
function nextIdRaw() {
  if (db && db.seq && seqCounter < db.seq) seqCounter = db.seq;
  return seqCounter++;
}
function nextId() {
  const id = nextIdRaw();
  db.seq = seqCounter;
  return id;
}

let saveTimer = null;
function saveDb() {
  if (db) db.seq = seqCounter;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)), 50);
}

/* ── Sessões ─────────────────────────────────────────────────── */

const sessions = new Map();

function createSession(data) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { ...data, createdAt: Date.now() });
  return token;
}

function getSession(req) {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)sesmt_token=([a-f0-9]+)/);
  return m ? (sessions.get(m[1]) || null) : null;
}

/* ── Utilidades HTTP ─────────────────────────────────────────── */

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 10 * 1024 * 1024) { reject(new Error('payload grande')); req.destroy(); } });
    req.on('end', () => { if (!data) return resolve({}); try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('JSON inválido')); } });
    req.on('error', reject);
  });
}

/* ── Regras de negócio ───────────────────────────────────────── */

function normalizeMatricula(m) { return String(m || '').trim().toUpperCase(); }

function eventBasePoints(ev) {
  return ev.pontos !== undefined && ev.pontos !== null ? ev.pontos : (db.settings.points[ev.tipo] || 0);
}

function employeePoints(employeeId) {
  let total = 0;
  const byType = {};
  for (const t of ACTIVITY_TYPES) byType[t] = { checkins: 0, pontos: 0 };
  for (const c of db.checkins) {
    if (c.employeeId !== employeeId) continue;
    total += c.pontosAtribuidos || 0;
    const ev = db.events.find(e => e.id === c.eventId);
    if (ev) {
      if (!byType[ev.tipo]) byType[ev.tipo] = { checkins: 0, pontos: 0 };
      byType[ev.tipo].checkins++;
      byType[ev.tipo].pontos += c.pontosAtribuidos || 0;
    }
  }
  for (const obs of db.observations) {
    if (obs.employeeId === employeeId && obs.pontos) total += obs.pontos;
  }
  for (const sug of db.suggestions) {
    if (sug.employeeId === employeeId && sug.status === 'aprovada') total += db.settings.points['Sugestão Aprovada'] || 50;
  }
  return { total, byType };
}

function getAchievement(pontos) {
  let current = null;
  for (const a of ACHIEVEMENTS) {
    if (pontos >= a.minPontos) current = a;
  }
  return current;
}

function buildRanking(companyId) {
  const emps = companyId
    ? db.employees.filter(e => e.ativo !== false && e.companyId === companyId)
    : db.employees.filter(e => e.ativo !== false);
  const ranking = emps.map(e => {
    const p = employeePoints(e.id);
    const conquista = getAchievement(p.total);
    return { id: e.id, matricula: e.matricula, nome: e.nome, setor: e.setor || '', equipe: e.equipe || '', unidade: e.unidade || '', funcao: e.funcao || '', empresa: e.empresa || '', pontos: p.total, conquista };
  }).sort((a, b) => b.pontos - a.pontos || a.nome.localeCompare(b.nome, 'pt-BR'));
  let pos = 0, lastPts = null;
  ranking.forEach((r, i) => {
    if (r.pontos !== lastPts) { pos = i + 1; lastPts = r.pontos; }
    r.posicao = pos;
  });
  return ranking;
}

function calcIES(employeeId) {
  const totalEvents = db.events.length;
  const myCheckins = db.checkins.filter(c => c.employeeId === employeeId);
  const myAvaliacoes = myCheckins.filter(c => c.avaliado).length;
  const myObs = db.observations.filter(o => o.employeeId === employeeId).length;
  const mySugs = db.suggestions.filter(s => s.employeeId === employeeId).length;
  const taxaParticipacao = totalEvents > 0 ? Math.min(100, (myCheckins.length / totalEvents) * 100) : 0;
  const taxaAvaliacao = myCheckins.length > 0 ? (myAvaliacoes / myCheckins.length) * 100 : 0;
  const bonusObs = Math.min(20, myObs * 5);
  const bonusSug = Math.min(10, mySugs * 5);
  return Math.round((taxaParticipacao * 0.5 + taxaAvaliacao * 0.3 + bonusObs + bonusSug));
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function parseBulk(text) {
  const lines = String(text || '').split(/\r?\n/);
  const rows = [], errors = [];
  lines.forEach((line, idx) => {
    const raw = line.trim();
    if (!raw) return;
    const parts = raw.split(/\t|;|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(p => p.replace(/^"|"$/g, '').trim());
    if (idx === 0 && /matr[ií]cula/i.test(parts[0])) return;
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      errors.push({ linha: idx + 1, conteudo: raw, motivo: 'esperado: matrícula;nome' });
      return;
    }
    rows.push({ matricula: normalizeMatricula(parts[0]), nome: parts[1], setor: parts[2] || '', funcao: parts[3] || '', equipe: parts[4] || '', unidade: parts[5] || '', empresa: parts[6] || '' });
  });
  return { rows, errors };
}

function getCompanyBranding(companyId) {
  if (!companyId) return null;
  const c = db.companies.find(x => x.id === companyId);
  if (!c) return null;
  return { id: c.id, nome: c.nome, logo: c.logo || null, cores: c.cores || DEFAULT_CORES };
}

/* ── Roteamento ──────────────────────────────────────────────── */

const routes = [];
function route(method, pattern, opts, handler) { routes.push({ method, pattern, opts, handler }); }

/* ── Auth ───────────────────────────────────────────────────── */

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
    const token = createSession({ role: 'gestor', userId: mgr.id, companyId: mgr.companyId });
    res.setHeader('Set-Cookie', `sesmt_token=${token}; Path=/; HttpOnly; SameSite=Lax`);
    const branding = getCompanyBranding(mgr.companyId);
    return sendJson(res, 200, { ok: true, perfil: 'gestor', nome: mgr.name, branding });
  }
  if (body.perfil === 'colaborador') {
    const mat = normalizeMatricula(body.matricula);
    const emp = db.employees.find(e => e.matricula === mat && e.ativo !== false);
    if (!emp) return sendJson(res, 401, { error: 'Matrícula não encontrada. Procure o gestor SST.' });
    const token = createSession({ role: 'colaborador', employeeId: emp.id, companyId: emp.companyId });
    res.setHeader('Set-Cookie', `sesmt_token=${token}; Path=/; HttpOnly; SameSite=Lax`);
    const branding = getCompanyBranding(emp.companyId);
    return sendJson(res, 200, { ok: true, perfil: 'colaborador', nome: emp.nome, branding });
  }
  return sendJson(res, 400, { error: 'Perfil inválido.' });
});

route('POST', /^\/api\/logout$/, { public: true }, async (req, res) => {
  const cookie = req.headers.cookie || '';
  const m2 = cookie.match(/(?:^|;\s*)sesmt_token=([a-f0-9]+)/);
  if (m2) sessions.delete(m2[1]);
  res.setHeader('Set-Cookie', 'sesmt_token=; Path=/; Max-Age=0');
  sendJson(res, 200, { ok: true });
});

route('GET', /^\/api\/me$/, { public: true }, async (req, res) => {
  const s = getSession(req);
  if (!s) return sendJson(res, 200, { autenticado: false });
  if (s.role === 'admin') {
    const adm = db.admins.find(u => u.id === s.userId);
    return sendJson(res, 200, { autenticado: true, perfil: 'admin', nome: adm ? adm.name : 'Admin' });
  }
  if (s.role === 'gestor') {
    const mgr = db.managers.find(u => u.id === s.userId);
    const branding = getCompanyBranding(s.companyId);
    return sendJson(res, 200, { autenticado: true, perfil: 'gestor', nome: mgr ? mgr.name : 'Gestor', branding });
  }
  const emp = db.employees.find(e => e.id === s.employeeId);
  const branding = getCompanyBranding(s.companyId);
  return sendJson(res, 200, { autenticado: true, perfil: 'colaborador', nome: emp ? emp.nome : '', employeeId: s.employeeId, branding });
});

route('POST', /^\/api\/senha$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const mgr = db.managers.find(u => u.id === s.userId);
  if (!mgr) return sendJson(res, 404, { error: 'Gestor não encontrado.' });
  const atual = hashPassword(String(body.senhaAtual || ''), mgr.salt);
  if (atual.hash !== mgr.hash) return sendJson(res, 400, { error: 'Senha atual incorreta.' });
  if (!body.novaSenha || String(body.novaSenha).length < 6) return sendJson(res, 400, { error: 'Nova senha: mínimo 6 caracteres.' });
  const nova = hashPassword(String(body.novaSenha));
  mgr.salt = nova.salt; mgr.hash = nova.hash;
  saveDb();
  sendJson(res, 200, { ok: true });
});

/* ── Admin — Empresas ────────────────────────────────────────── */

route('GET', /^\/api\/admin\/empresas$/, { role: 'admin' }, async (req, res) => {
  const list = db.companies.map(c => ({
    ...c,
    logo: c.logo ? '[logo]' : null,
    totalGestores: db.managers.filter(m => m.companyId === c.id).length,
    totalColaboradores: db.employees.filter(e => e.companyId === c.id).length
  }));
  sendJson(res, 200, list);
});

route('POST', /^\/api\/admin\/empresas$/, { role: 'admin' }, async (req, res, m, body) => {
  if (!String(body.nome || '').trim()) return sendJson(res, 400, { error: 'Nome é obrigatório.' });
  const empresa = {
    id: nextId(),
    nome: String(body.nome).trim(),
    cnpj: String(body.cnpj || '').trim(),
    logo: null,
    cores: { ...DEFAULT_CORES, ...(body.cores || {}) },
    unidades: Array.isArray(body.unidades) ? body.unidades : [{ id: nextId(), nome: 'Matriz', endereco: '', cidade: '', estado: '' }],
    ativo: true,
    criadaEm: Date.now()
  };
  db.companies.push(empresa);
  saveDb();
  sendJson(res, 201, { ...empresa, logo: null });
});

route('PUT', /^\/api\/admin\/empresas\/(\d+)$/, { role: 'admin' }, async (req, res, m, body) => {
  const empresa = db.companies.find(c => c.id === Number(m[1]));
  if (!empresa) return sendJson(res, 404, { error: 'Empresa não encontrada.' });
  if (body.nome !== undefined) empresa.nome = String(body.nome).trim();
  if (body.cnpj !== undefined) empresa.cnpj = String(body.cnpj).trim();
  if (body.ativo !== undefined) empresa.ativo = !!body.ativo;
  if (body.cores) empresa.cores = { ...empresa.cores, ...body.cores };
  if (Array.isArray(body.unidades)) empresa.unidades = body.unidades;
  saveDb();
  sendJson(res, 200, { ...empresa, logo: empresa.logo ? '[logo]' : null });
});

route('DELETE', /^\/api\/admin\/empresas\/(\d+)$/, { role: 'admin' }, async (req, res, m) => {
  const id = Number(m[1]);
  const idx = db.companies.findIndex(c => c.id === id);
  if (idx === -1) return sendJson(res, 404, { error: 'Empresa não encontrada.' });
  if (db.managers.some(mg => mg.companyId === id) || db.employees.some(e => e.companyId === id)) {
    db.companies[idx].ativo = false;
    saveDb();
    return sendJson(res, 200, { ok: true, inativada: true });
  }
  db.companies.splice(idx, 1);
  saveDb();
  sendJson(res, 200, { ok: true, removida: true });
});

route('PUT', /^\/api\/admin\/empresas\/(\d+)\/branding$/, { role: 'admin' }, async (req, res, m, body) => {
  const empresa = db.companies.find(c => c.id === Number(m[1]));
  if (!empresa) return sendJson(res, 404, { error: 'Empresa não encontrada.' });
  if (body.logo !== undefined) empresa.logo = body.logo || null;
  if (body.cores) empresa.cores = { ...empresa.cores, ...body.cores };
  saveDb();
  sendJson(res, 200, { ok: true });
});

route('GET', /^\/api\/admin\/empresas\/(\d+)\/branding$/, { role: 'admin' }, async (req, res, m) => {
  const empresa = db.companies.find(c => c.id === Number(m[1]));
  if (!empresa) return sendJson(res, 404, { error: 'Empresa não encontrada.' });
  sendJson(res, 200, { logo: empresa.logo || null, cores: empresa.cores || DEFAULT_CORES, nome: empresa.nome });
});

route('POST', /^\/api\/admin\/empresas\/(\d+)\/gestores$/, { role: 'admin' }, async (req, res, m, body) => {
  const companyId = Number(m[1]);
  const empresa = db.companies.find(c => c.id === companyId);
  if (!empresa) return sendJson(res, 404, { error: 'Empresa não encontrada.' });
  const username = String(body.usuario || '').trim().toLowerCase();
  if (!username) return sendJson(res, 400, { error: 'Usuário obrigatório.' });
  if (db.managers.some(mg => mg.username === username)) return sendJson(res, 409, { error: `Usuário "${username}" já existe.` });
  const senha = String(body.senha || 'sesmt123');
  const pwd = hashPassword(senha);
  const mgr = { id: nextId(), username, name: String(body.nome || username).trim(), salt: pwd.salt, hash: pwd.hash, companyId };
  db.managers.push(mgr);
  saveDb();
  sendJson(res, 201, { id: mgr.id, username: mgr.username, name: mgr.name, companyId });
});

route('GET', /^\/api\/admin\/gestores$/, { role: 'admin' }, async (req, res) => {
  const list = db.managers.map(mg => ({
    id: mg.id, username: mg.username, name: mg.name, companyId: mg.companyId,
    nomeEmpresa: (db.companies.find(c => c.id === mg.companyId) || {}).nome || ''
  }));
  sendJson(res, 200, list);
});

route('DELETE', /^\/api\/admin\/gestores\/(\d+)$/, { role: 'admin' }, async (req, res, m) => {
  const id = Number(m[1]);
  const idx = db.managers.findIndex(mg => mg.id === id);
  if (idx === -1) return sendJson(res, 404, { error: 'Gestor não encontrado.' });
  db.managers.splice(idx, 1);
  saveDb();
  sendJson(res, 200, { ok: true });
});

/* ── Gestor — branding da própria empresa ─────────────────────── */

route('GET', /^\/api\/empresa\/branding$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const empresa = db.companies.find(c => c.id === s.companyId);
  if (!empresa) return sendJson(res, 404, { error: 'Empresa não encontrada.' });
  sendJson(res, 200, { logo: empresa.logo || null, cores: empresa.cores || DEFAULT_CORES, nome: empresa.nome, cnpj: empresa.cnpj, unidades: empresa.unidades || [] });
});

route('PUT', /^\/api\/empresa\/branding$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const empresa = db.companies.find(c => c.id === s.companyId);
  if (!empresa) return sendJson(res, 404, { error: 'Empresa não encontrada.' });
  if (body.logo !== undefined) empresa.logo = body.logo || null;
  if (body.cores) empresa.cores = { ...empresa.cores, ...body.cores };
  if (body.nome !== undefined && String(body.nome).trim()) empresa.nome = String(body.nome).trim();
  saveDb();
  sendJson(res, 200, { ok: true });
});

/* ── Config ─────────────────────────────────────────────────── */

route('GET', /^\/api\/config$/, { role: 'any' }, async (req, res) => {
  sendJson(res, 200, { tipos: ACTIVITY_TYPES, pontos: db.settings.points, conquistas: ACHIEVEMENTS, codigoValidade: db.settings.codigoValidade, recompensas: db.settings.recompensas });
});

route('PUT', /^\/api\/config\/pontos$/, { role: 'gestor' }, async (req, res, m, body) => {
  for (const [k, v] of Object.entries(body)) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return sendJson(res, 400, { error: `Pontuação inválida para ${k}.` });
    db.settings.points[k] = n;
  }
  saveDb();
  sendJson(res, 200, { ok: true, pontos: db.settings.points });
});

route('PUT', /^\/api\/config\/geral$/, { role: 'gestor' }, async (req, res, m, body) => {
  if (body.codigoValidade !== undefined) {
    const v = Number(body.codigoValidade);
    if (!Number.isFinite(v) || v < 5) return sendJson(res, 400, { error: 'Validade mínima: 5 minutos.' });
    db.settings.codigoValidade = v;
  }
  if (Array.isArray(body.recompensas)) db.settings.recompensas = body.recompensas;
  saveDb();
  sendJson(res, 200, { ok: true });
});

/* ── Colaboradores ───────────────────────────────────────────── */

route('GET', /^\/api\/colaboradores$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const list = db.employees
    .filter(e => e.companyId === s.companyId)
    .map(e => {
      const p = employeePoints(e.id);
      return { ...e, pontos: p.total, conquista: getAchievement(p.total), ies: calcIES(e.id) };
    });
  sendJson(res, 200, list);
});

route('POST', /^\/api\/colaboradores$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const mat = normalizeMatricula(body.matricula);
  if (!mat || !String(body.nome || '').trim()) return sendJson(res, 400, { error: 'Matrícula e nome são obrigatórios.' });
  if (db.employees.some(e => e.matricula === mat && e.companyId === s.companyId)) return sendJson(res, 409, { error: `Matrícula ${mat} já cadastrada.` });
  const emp = {
    id: nextId(), matricula: mat, nome: String(body.nome).trim(),
    cpf: String(body.cpf || '').trim(),
    setor: String(body.setor || '').trim(), funcao: String(body.funcao || '').trim(),
    equipe: String(body.equipe || '').trim(), unidade: String(body.unidade || '').trim(),
    empresa: String(body.empresa || '').trim(), ativo: true, companyId: s.companyId
  };
  db.employees.push(emp);
  saveDb();
  sendJson(res, 201, emp);
});

route('POST', /^\/api\/colaboradores\/importar$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const { rows, errors } = parseBulk(body.texto);
  const inseridos = [], duplicados = [];
  for (const r of rows) {
    if (db.employees.some(e => e.matricula === r.matricula && e.companyId === s.companyId) || inseridos.some(e => e.matricula === r.matricula)) {
      duplicados.push(r.matricula); continue;
    }
    const emp = { id: nextId(), ...r, cpf: '', ativo: true, companyId: s.companyId };
    db.employees.push(emp);
    inseridos.push(emp);
  }
  saveDb();
  sendJson(res, 200, { inseridos: inseridos.length, duplicados, erros: errors });
});

route('PUT', /^\/api\/colaboradores\/(\d+)$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const emp = db.employees.find(e => e.id === Number(m[1]) && e.companyId === s.companyId);
  if (!emp) return sendJson(res, 404, { error: 'Colaborador não encontrado.' });
  if (body.matricula !== undefined) {
    const mat = normalizeMatricula(body.matricula);
    if (!mat) return sendJson(res, 400, { error: 'Matrícula inválida.' });
    if (db.employees.some(e => e.matricula === mat && e.id !== emp.id && e.companyId === s.companyId)) return sendJson(res, 409, { error: `Matrícula ${mat} já existe.` });
    emp.matricula = mat;
  }
  ['nome', 'cpf', 'setor', 'funcao', 'equipe', 'unidade', 'empresa'].forEach(f => { if (body[f] !== undefined) emp[f] = String(body[f]).trim(); });
  if (body.ativo !== undefined) emp.ativo = !!body.ativo;
  saveDb();
  sendJson(res, 200, emp);
});

route('DELETE', /^\/api\/colaboradores\/(\d+)$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const id = Number(m[1]);
  const idx = db.employees.findIndex(e => e.id === id && e.companyId === s.companyId);
  if (idx === -1) return sendJson(res, 404, { error: 'Colaborador não encontrado.' });
  const temHistorico = db.checkins.some(c => c.employeeId === id);
  if (temHistorico) { db.employees[idx].ativo = false; saveDb(); return sendJson(res, 200, { ok: true, inativado: true }); }
  db.employees.splice(idx, 1);
  saveDb();
  sendJson(res, 200, { ok: true, removido: true });
});

/* ── Eventos ─────────────────────────────────────────────────── */

route('GET', /^\/api\/eventos$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const list = db.events
    .filter(ev => ev.companyId === s.companyId)
    .slice().sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)
    .map(ev => {
      const evCheckins = db.checkins.filter(c => c.eventId === ev.id);
      const avaliados = evCheckins.filter(c => c.avaliado);
      const mediaEstrelas = avaliados.length > 0 ? (avaliados.reduce((s, c) => s + (c.avaliacao.estrelas || 0), 0) / avaliados.length).toFixed(1) : null;
      const code = db.activeCodes.find(ac => ac.eventId === ev.id && ac.ativo && ac.expiraEm > Date.now());
      return { ...ev, pontosAplicados: eventBasePoints(ev), totalCheckins: evCheckins.length, avaliados: avaliados.length, mediaEstrelas, codigoAtivo: code ? code.code : null };
    });
  sendJson(res, 200, list);
});

route('GET', /^\/api\/eventos\/(\d+)$/, { role: 'any' }, async (req, res, m) => {
  const ev = db.events.find(e => e.id === Number(m[1]));
  if (!ev) return sendJson(res, 404, { error: 'Evento não encontrado.' });
  sendJson(res, 200, ev);
});

route('POST', /^\/api\/eventos$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  if (!ACTIVITY_TYPES.includes(body.tipo)) return sendJson(res, 400, { error: 'Tipo de atividade inválido.' });
  if (!body.data || !/^\d{4}-\d{2}-\d{2}$/.test(body.data)) return sendJson(res, 400, { error: 'Data inválida.' });
  const ev = {
    id: nextId(), tipo: body.tipo, data: body.data,
    hora: String(body.hora || '').trim(),
    tema: String(body.tema || '').trim(),
    local: String(body.local || '').trim(),
    responsavel: String(body.responsavel || '').trim(),
    observacoes: String(body.observacoes || '').trim(),
    pontos: body.pontos !== undefined && body.pontos !== '' && body.pontos !== null ? Number(body.pontos) : null,
    participantes: [],
    companyId: s.companyId
  };
  if (ev.pontos !== null && (!Number.isFinite(ev.pontos) || ev.pontos < 0)) return sendJson(res, 400, { error: 'Pontuação inválida.' });
  db.events.push(ev);
  saveDb();
  sendJson(res, 201, ev);
});

route('PUT', /^\/api\/eventos\/(\d+)$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const ev = db.events.find(e => e.id === Number(m[1]) && e.companyId === s.companyId);
  if (!ev) return sendJson(res, 404, { error: 'Evento não encontrado.' });
  if (body.tipo !== undefined && !ACTIVITY_TYPES.includes(body.tipo)) return sendJson(res, 400, { error: 'Tipo inválido.' });
  ['tipo', 'data', 'hora', 'tema', 'local', 'responsavel', 'observacoes'].forEach(f => { if (body[f] !== undefined) ev[f] = String(body[f]).trim(); });
  if (body.pontos !== undefined) {
    ev.pontos = (body.pontos === null || body.pontos === '') ? null : Number(body.pontos);
    if (ev.pontos !== null && (!Number.isFinite(ev.pontos) || ev.pontos < 0)) return sendJson(res, 400, { error: 'Pontuação inválida.' });
  }
  saveDb();
  sendJson(res, 200, ev);
});

route('DELETE', /^\/api\/eventos\/(\d+)$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const id = Number(m[1]);
  const idx = db.events.findIndex(e => e.id === id && e.companyId === s.companyId);
  if (idx === -1) return sendJson(res, 404, { error: 'Evento não encontrado.' });
  db.checkins = db.checkins.filter(c => c.eventId !== id);
  db.activeCodes = db.activeCodes.filter(ac => ac.eventId !== id);
  db.events.splice(idx, 1);
  saveDb();
  sendJson(res, 200, { ok: true });
});

/* ── Check-in codes ──────────────────────────────────────────── */

route('POST', /^\/api\/eventos\/(\d+)\/codigo$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const eventId = Number(m[1]);
  const ev = db.events.find(e => e.id === eventId && e.companyId === s.companyId);
  if (!ev) return sendJson(res, 404, { error: 'Evento não encontrado.' });
  db.activeCodes.filter(ac => ac.eventId === eventId).forEach(ac => { ac.ativo = false; });
  const code = generateCode();
  const validade = (db.settings.codigoValidade || 60) * 60 * 1000;
  db.activeCodes.push({ code, eventId, criadoEm: Date.now(), expiraEm: Date.now() + validade, ativo: true });
  saveDb();
  sendJson(res, 200, { code, expiraEm: Date.now() + validade, validade: db.settings.codigoValidade });
});

route('GET', /^\/api\/eventos\/(\d+)\/codigo$/, { role: 'gestor' }, async (req, res, m) => {
  const eventId = Number(m[1]);
  const code = db.activeCodes.find(ac => ac.eventId === eventId && ac.ativo && ac.expiraEm > Date.now());
  if (!code) return sendJson(res, 200, { ativo: false });
  sendJson(res, 200, { ativo: true, code: code.code, expiraEm: code.expiraEm });
});

/* ── Check-in do colaborador ─────────────────────────────────── */

route('POST', /^\/api\/checkin$/, { role: 'colaborador' }, async (req, res, m, body, s) => {
  const code = String(body.codigo || '').trim();
  const ac = db.activeCodes.find(ac => ac.code === code && ac.ativo && ac.expiraEm > Date.now());
  if (!ac) return sendJson(res, 400, { error: 'Código inválido ou expirado. Solicite um novo código ao responsável.' });
  const ev = db.events.find(e => e.id === ac.eventId);
  if (!ev) return sendJson(res, 400, { error: 'Evento não encontrado.' });
  const existing = db.checkins.find(c => c.eventId === ev.id && c.employeeId === s.employeeId);
  if (existing) return sendJson(res, 409, { error: 'Você já fez check-in neste evento.' });
  const checkin = {
    id: nextId(), eventId: ev.id, employeeId: s.employeeId,
    timestamp: new Date().toISOString(),
    gps: body.gps || null,
    avaliado: false, avaliacao: null,
    pontosAtribuidos: 0
  };
  db.checkins.push(checkin);
  if (!ev.participantes) ev.participantes = [];
  if (!ev.participantes.includes(s.employeeId)) ev.participantes.push(s.employeeId);
  saveDb();
  sendJson(res, 200, { ok: true, checkinId: checkin.id, evento: { tipo: ev.tipo, tema: ev.tema, data: ev.data }, mensagem: 'Check-in realizado! Agora avalie o evento para receber seus pontos.' });
});

route('GET', /^\/api\/checkin\/pendente$/, { role: 'colaborador' }, async (req, res, m, body, s) => {
  const pendente = db.checkins.find(c => c.employeeId === s.employeeId && !c.avaliado);
  if (!pendente) return sendJson(res, 200, { pendente: false });
  const ev = db.events.find(e => e.id === pendente.eventId);
  sendJson(res, 200, { pendente: true, checkinId: pendente.id, evento: ev ? { tipo: ev.tipo, tema: ev.tema, data: ev.data, hora: ev.hora } : null });
});

route('POST', /^\/api\/checkin\/(\d+)\/avaliar$/, { role: 'colaborador' }, async (req, res, m, body, s) => {
  const checkin = db.checkins.find(c => c.id === Number(m[1]) && c.employeeId === s.employeeId);
  if (!checkin) return sendJson(res, 404, { error: 'Check-in não encontrado.' });
  if (checkin.avaliado) return sendJson(res, 409, { error: 'Avaliação já registrada.' });
  const estrelas = Number(body.estrelas);
  if (!Number.isInteger(estrelas) || estrelas < 1 || estrelas > 5) return sendJson(res, 400, { error: 'Avaliação de 1 a 5 estrelas é obrigatória.' });
  checkin.avaliado = true;
  checkin.avaliacao = {
    estrelas,
    gostou: String(body.gostou || '').trim(),
    melhorar: String(body.melhorar || '').trim(),
    temas: String(body.temas || '').trim(),
    seguranca: String(body.seguranca || '').trim(),
    livre: String(body.livre || '').trim()
  };
  const ev = db.events.find(e => e.id === checkin.eventId);
  checkin.pontosAtribuidos = eventBasePoints(ev);
  saveDb();
  const totalPontos = employeePoints(s.employeeId).total;
  const conquista = getAchievement(totalPontos);
  sendJson(res, 200, { ok: true, pontosRecebidos: checkin.pontosAtribuidos, totalPontos, conquista });
});

route('GET', /^\/api\/eventos\/(\d+)\/avaliacoes$/, { role: 'gestor' }, async (req, res, m) => {
  const eventId = Number(m[1]);
  const evCheckins = db.checkins.filter(c => c.eventId === eventId && c.avaliado);
  const result = evCheckins.map(c => {
    const emp = db.employees.find(e => e.id === c.employeeId);
    return { ...c, nomeColaborador: emp ? emp.nome : 'Desconhecido', matricula: emp ? emp.matricula : '' };
  });
  sendJson(res, 200, result);
});

/* ── Lista de presença (gestor adiciona manualmente) ────────── */

route('POST', /^\/api\/eventos\/(\d+)\/presenca$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const eventId = Number(m[1]);
  const ev = db.events.find(e => e.id === eventId && e.companyId === s.companyId);
  if (!ev) return sendJson(res, 404, { error: 'Evento não encontrado.' });
  const ids = Array.isArray(body.participantes) ? body.participantes.map(Number) : [];
  const validIds = new Set(db.employees.filter(e => e.companyId === s.companyId).map(e => e.id));
  const adicionados = [];
  for (const empId of ids) {
    if (!validIds.has(empId)) continue;
    const exists = db.checkins.find(c => c.eventId === eventId && c.employeeId === empId);
    if (!exists) {
      const pts = eventBasePoints(ev);
      const ci = { id: nextId(), eventId, employeeId: empId, timestamp: new Date().toISOString(), gps: null, avaliado: true, avaliacao: { estrelas: 0, gostou: '', melhorar: '', temas: '', seguranca: '', livre: '' }, pontosAtribuidos: pts, manual: true };
      db.checkins.push(ci);
      if (!ev.participantes) ev.participantes = [];
      if (!ev.participantes.includes(empId)) ev.participantes.push(empId);
      adicionados.push(empId);
    }
  }
  saveDb();
  sendJson(res, 200, { ok: true, adicionados: adicionados.length });
});

/* ── Observações de Segurança ────────────────────────────────── */

route('GET', /^\/api\/observacoes$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const list = db.observations
    .filter(o => {
      const emp = db.employees.find(e => e.id === o.employeeId);
      return emp && emp.companyId === s.companyId;
    })
    .map(o => {
      const emp = db.employees.find(e => e.id === o.employeeId);
      return { ...o, nomeColaborador: emp ? emp.nome : 'Desconhecido', matricula: emp ? emp.matricula : '' };
    }).sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
  sendJson(res, 200, list);
});

route('GET', /^\/api\/observacoes\/minhas$/, { role: 'colaborador' }, async (req, res, m, body, s) => {
  const list = db.observations.filter(o => o.employeeId === s.employeeId).sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
  sendJson(res, 200, list);
});

route('POST', /^\/api\/observacoes$/, { role: 'any' }, async (req, res, m, body, s) => {
  if (!s) return sendJson(res, 401, { error: 'Não autenticado.' });
  const employeeId = s.role === 'colaborador' ? s.employeeId : (body.employeeId ? Number(body.employeeId) : null);
  if (!employeeId) return sendJson(res, 400, { error: 'Colaborador obrigatório.' });
  const tipos = ['ato_inseguro', 'condicao_insegura'];
  if (!tipos.includes(body.tipo)) return sendJson(res, 400, { error: 'Tipo inválido: ato_inseguro ou condicao_insegura.' });
  const criticas = ['baixa', 'media', 'alta', 'critica'];
  if (!criticas.includes(body.criticidade)) return sendJson(res, 400, { error: 'Criticidade inválida.' });
  if (!String(body.descricao || '').trim()) return sendJson(res, 400, { error: 'Descrição obrigatória.' });
  const obs = {
    id: nextId(), employeeId, tipo: body.tipo, criticidade: body.criticidade,
    descricao: String(body.descricao).trim(), local: String(body.local || '').trim(),
    status: 'aberta', acaoCorretiva: '', responsavelAcao: '', prazo: '',
    pontos: db.settings.points['Registro de Desvio'] || 25,
    criadoEm: Date.now(), atualizadoEm: Date.now()
  };
  db.observations.push(obs);
  saveDb();
  sendJson(res, 201, obs);
});

route('PUT', /^\/api\/observacoes\/(\d+)$/, { role: 'gestor' }, async (req, res, m, body) => {
  const obs = db.observations.find(o => o.id === Number(m[1]));
  if (!obs) return sendJson(res, 404, { error: 'Observação não encontrada.' });
  const statusValidos = ['aberta', 'em_analise', 'resolvida'];
  if (body.status && !statusValidos.includes(body.status)) return sendJson(res, 400, { error: 'Status inválido.' });
  ['status', 'acaoCorretiva', 'responsavelAcao', 'prazo'].forEach(f => { if (body[f] !== undefined) obs[f] = String(body[f]).trim(); });
  obs.atualizadoEm = Date.now();
  saveDb();
  sendJson(res, 200, obs);
});

/* ── Sugestões de Melhoria ───────────────────────────────────── */

route('GET', /^\/api\/sugestoes$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const list = db.suggestions
    .filter(sg => {
      const emp = db.employees.find(e => e.id === sg.employeeId);
      return emp && emp.companyId === s.companyId;
    })
    .map(sg => {
      const emp = db.employees.find(e => e.id === sg.employeeId);
      return { ...sg, nomeColaborador: emp ? emp.nome : 'Desconhecido', matricula: emp ? emp.matricula : '' };
    }).sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
  sendJson(res, 200, list);
});

route('GET', /^\/api\/sugestoes\/minhas$/, { role: 'colaborador' }, async (req, res, m, body, s) => {
  const list = db.suggestions.filter(sg => sg.employeeId === s.employeeId).sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
  sendJson(res, 200, list);
});

route('POST', /^\/api\/sugestoes$/, { role: 'any' }, async (req, res, m, body, s) => {
  if (!s) return sendJson(res, 401, { error: 'Não autenticado.' });
  const employeeId = s.role === 'colaborador' ? s.employeeId : (body.employeeId ? Number(body.employeeId) : null);
  if (!employeeId) return sendJson(res, 400, { error: 'Colaborador obrigatório.' });
  if (!String(body.descricao || '').trim()) return sendJson(res, 400, { error: 'Descrição obrigatória.' });
  const sg = {
    id: nextId(), employeeId, descricao: String(body.descricao).trim(),
    beneficio: String(body.beneficio || '').trim(),
    status: 'pendente', comentarioGestor: '',
    criadoEm: Date.now(), atualizadoEm: Date.now()
  };
  db.suggestions.push(sg);
  saveDb();
  sendJson(res, 201, sg);
});

route('PUT', /^\/api\/sugestoes\/(\d+)$/, { role: 'gestor' }, async (req, res, m, body) => {
  const sg = db.suggestions.find(s => s.id === Number(m[1]));
  if (!sg) return sendJson(res, 404, { error: 'Sugestão não encontrada.' });
  const statusValidos = ['pendente', 'aprovada', 'rejeitada'];
  if (body.status && !statusValidos.includes(body.status)) return sendJson(res, 400, { error: 'Status inválido.' });
  if (body.status) sg.status = body.status;
  if (body.comentarioGestor !== undefined) sg.comentarioGestor = String(body.comentarioGestor).trim();
  sg.atualizadoEm = Date.now();
  saveDb();
  sendJson(res, 200, sg);
});

/* ── Ranking e Dashboard ─────────────────────────────────────── */

route('GET', /^\/api\/ranking$/, { role: 'any' }, async (req, res, m, body, s) => {
  const companyId = s ? s.companyId : null;
  sendJson(res, 200, buildRanking(companyId));
});

route('GET', /^\/api\/dashboard$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const companyEvents = db.events.filter(ev => ev.companyId === s.companyId);
  const companyEmps = db.employees.filter(e => e.companyId === s.companyId);
  const companyEmpIds = new Set(companyEmps.map(e => e.id));
  const companyCheckins = db.checkins.filter(c => companyEmpIds.has(c.employeeId));
  const companyObs = db.observations.filter(o => companyEmpIds.has(o.employeeId));
  const companyMelhorias = db.suggestions.filter(sg => companyEmpIds.has(sg.employeeId));

  const porTipo = {};
  for (const t of ACTIVITY_TYPES) porTipo[t] = { eventos: 0, checkins: 0, mediaEstrelas: null, totalEstrelas: 0, avaliacoes: 0 };
  for (const ev of companyEvents) {
    const t = ev.tipo;
    if (!porTipo[t]) porTipo[t] = { eventos: 0, checkins: 0, mediaEstrelas: null, totalEstrelas: 0, avaliacoes: 0 };
    porTipo[t].eventos++;
    const evCheckins = db.checkins.filter(c => c.eventId === ev.id);
    porTipo[t].checkins += evCheckins.length;
    evCheckins.filter(c => c.avaliado && c.avaliacao && c.avaliacao.estrelas > 0).forEach(c => {
      porTipo[t].totalEstrelas += c.avaliacao.estrelas;
      porTipo[t].avaliacoes++;
    });
  }
  for (const t of ACTIVITY_TYPES) {
    if (porTipo[t].avaliacoes > 0) porTipo[t].mediaEstrelas = (porTipo[t].totalEstrelas / porTipo[t].avaliacoes).toFixed(1);
  }
  const ranking = buildRanking(s.companyId);
  const totalAvaliacoes = companyCheckins.filter(c => c.avaliado && c.avaliacao && c.avaliacao.estrelas > 0).length;
  const mediaGeralEstrelas = totalAvaliacoes > 0
    ? (companyCheckins.filter(c => c.avaliado && c.avaliacao && c.avaliacao.estrelas > 0).reduce((acc, c) => acc + c.avaliacao.estrelas, 0) / totalAvaliacoes).toFixed(1)
    : null;
  sendJson(res, 200, {
    colaboradoresAtivos: companyEmps.filter(e => e.ativo !== false).length,
    totalEventos: companyEvents.length,
    totalCheckins: companyCheckins.length,
    totalObs: companyObs.length, obsAbertas: companyObs.filter(o => o.status === 'aberta').length,
    totalSugs: companyMelhorias.length, sugsAprovadas: companyMelhorias.filter(s => s.status === 'aprovada').length,
    mediaGeralEstrelas,
    porTipo,
    top10: ranking.slice(0, 10),
    rankingCompleto: ranking
  });
});

/* ── Painel do colaborador ───────────────────────────────────── */

route('GET', /^\/api\/meu-painel$/, { role: 'colaborador' }, async (req, res, m, body, s) => {
  const emp = db.employees.find(e => e.id === s.employeeId);
  if (!emp) return sendJson(res, 404, { error: 'Colaborador não encontrado.' });
  const pts = employeePoints(emp.id);
  const ranking = buildRanking(emp.companyId);
  const minha = ranking.find(r => r.id === emp.id);
  const myCheckins = db.checkins.filter(c => c.employeeId === emp.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const historico = myCheckins.map(c => {
    const ev = db.events.find(e => e.id === c.eventId);
    return { id: c.id, timestamp: c.timestamp, tipo: ev ? ev.tipo : '?', tema: ev ? ev.tema : '', pontos: c.pontosAtribuidos, avaliado: c.avaliado };
  });
  const ies = calcIES(emp.id);
  const conquista = getAchievement(pts.total);
  const proxConquista = ACHIEVEMENTS.find(a => a.minPontos > pts.total);
  const minhaObs = db.observations.filter(o => o.employeeId === emp.id).length;
  const minhasSugs = db.suggestions.filter(s => s.employeeId === emp.id);
  const checkinPendente = db.checkins.find(c => c.employeeId === emp.id && !c.avaliado);
  sendJson(res, 200, {
    colaborador: { matricula: emp.matricula, nome: emp.nome, setor: emp.setor, funcao: emp.funcao, equipe: emp.equipe, unidade: emp.unidade, empresa: emp.empresa },
    pontos: pts.total, porTipo: pts.byType,
    posicao: minha ? minha.posicao : null,
    totalColaboradores: ranking.length,
    conquista, proxConquista, ies,
    historico,
    top10: ranking.slice(0, 10),
    totalObs: minhaObs,
    totalSugs: minhasSugs.length,
    sugsAprovadas: minhasSugs.filter(s => s.status === 'aprovada').length,
    checkinPendente: checkinPendente ? { checkinId: checkinPendente.id } : null
  });
});

/* ── Exportação ──────────────────────────────────────────────── */

route('GET', /^\/api\/exportar\/ranking$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const ranking = buildRanking(s.companyId);
  const lines = ['posicao;matricula;nome;setor;equipe;unidade;funcao;empresa;pontos;conquista'];
  for (const r of ranking) {
    lines.push([r.posicao, r.matricula, r.nome, r.setor, r.equipe || '', r.unidade || '', r.funcao, r.empresa || '', r.pontos, r.conquista ? r.conquista.nome : ''].join(';'));
  }
  res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="ranking_sesmt.csv"' });
  res.end('﻿' + lines.join('\n'));
});

route('GET', /^\/api\/exportar\/colaboradores$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const list = db.employees.filter(e => e.companyId === s.companyId).map(e => {
    const p = employeePoints(e.id);
    const ies = calcIES(e.id);
    return { ...e, pontos: p.total, ies, conquista: getAchievement(p.total) ? getAchievement(p.total).nome : '' };
  });
  const lines = ['matricula;nome;cpf;setor;equipe;unidade;funcao;empresa;ativo;pontos;ies;conquista'];
  for (const c of list) {
    lines.push([c.matricula, c.nome, c.cpf || '', c.setor, c.equipe || '', c.unidade || '', c.funcao, c.empresa || '', c.ativo ? 'S' : 'N', c.pontos, c.ies, c.conquista].join(';'));
  }
  res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="colaboradores_sesmt.csv"' });
  res.end('﻿' + lines.join('\n'));
});

/* ── Arquivos estáticos ──────────────────────────────────────── */

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function serveStatic(req, res, urlPath) {
  const file = urlPath === '/' ? '/index.html' : urlPath;
  const full = path.normalize(path.join(PUBLIC_DIR, file));
  if (!full.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Não encontrado'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(data);
  });
}

/* ── Servidor ────────────────────────────────────────────────── */

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
        if (r.opts.role === 'admin' && session.role !== 'admin') return sendJson(res, 403, { error: 'Acesso restrito ao administrador.' });
        if (r.opts.role === 'gestor' && session.role !== 'gestor') return sendJson(res, 403, { error: 'Acesso restrito.' });
        if (r.opts.role === 'colaborador' && session.role !== 'colaborador') return sendJson(res, 403, { error: 'Acesso restrito.' });
        if (r.opts.role === 'any' && !['gestor', 'colaborador', 'admin'].includes(session.role)) return sendJson(res, 403, { error: 'Acesso restrito.' });
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
  console.log(`SafePoint rodando em http://localhost:${PORT}`);
  console.log('Login admin: "admin" / "admin123"');
  console.log('Login gestor: "gestor" / "admin123"');
});

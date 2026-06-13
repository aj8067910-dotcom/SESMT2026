/*
 * SafePoint — Sistema Gamificado de SST
 * Node.js puro, sem dependências externas.
 * Login admin: "admin" / "admin123"
 * Login gestor: "gestor" / "admin123"
 */
'use strict';

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
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

const NIVEIS = [
  { nivel:1,  nome:'Iniciante da Segurança',  emoji:'🔰', minPontos:0,    bonus:0    },
  { nivel:2,  nome:'Observador de Riscos',    emoji:'👀', minPontos:700,  bonus:100  },
  { nivel:3,  nome:'Protetor da Equipe',      emoji:'🛡️', minPontos:1300, bonus:200  },
  { nivel:4,  nome:'Inspiração Segura',       emoji:'⭐', minPontos:1900, bonus:300  },
  { nivel:5,  nome:'Agente Preventivo',       emoji:'⚡', minPontos:2500, bonus:400  },
  { nivel:6,  nome:'Guardião Operacional',    emoji:'🏅', minPontos:3100, bonus:500  },
  { nivel:7,  nome:'Embaixador da Segurança', emoji:'👑', minPontos:3700, bonus:600  },
  { nivel:8,  nome:'Mestre da Prevenção',     emoji:'🔥', minPontos:4300, bonus:700  },
  { nivel:9,  nome:'Lenda da Segurança',      emoji:'💎', minPontos:4900, bonus:800  },
  { nivel:10, nome:'Guardião Supremo',        emoji:'🏆', minPontos:5500, bonus:1000 }
];

const ACHIEVEMENTS = NIVEIS.map(n => ({ key: 'n' + n.nivel, nome: n.nome, emoji: n.emoji, minPontos: n.minPontos }));

const STREAK_BONUSES = [
  { dias:7,   pontos:50,  desc:'🔥 Sequência de 7 dias!' },
  { dias:15,  pontos:100, desc:'🔥 Sequência de 15 dias!' },
  { dias:30,  pontos:150, desc:'🔥 30 dias seguidos — Engajamento Total!' },
  { dias:60,  pontos:200, desc:'🔥 60 dias — Dedicação Extrema!' },
  { dias:100, pontos:300, desc:'🔥 100 dias — Lenda do Engajamento!' },
  { dias:180, pontos:500, desc:'🔥 180 dias — Distintivo Elite!' },
  { dias:365, pontos:1000,desc:'🔥 365 dias — Lenda Absoluta!' }
];

const DEFAULT_CORES = {
  primaria:   '#1a8a4c',
  secundaria: '#1D6013',
  destaque:   '#7DC528',
  laranja:    '#e8801a'
};

const DEFAULT_MODULOS = {
  dds: true, treinamentos: true, ranking: true, loja: true,
  dashboardAvancado: false, ia: false, certificados: false,
  quiz: true, gamificacao: true, feed: true, cipa: true, brigada: true,
  pesquisas: true, observacoes: true, insights: true, academia: false,
  ia_assistant: false, cipa_eleicao: false
};

/* ── SafePoint 3.2 — Submódulos granulares ────────────────────── */

const SUBMODULO_LABELS = {
  dashboard:    { visao_geral:'Visão Geral', indicadores:'Indicadores', alertas:'Alertas', score:'Score da Empresa', insights_ia:'Insights IA' },
  pessoas:      { cadastro:'Cadastro Individual', importacao:'Importação em Massa', estrutura:'Estrutura Org.', setores:'Setores', equipes:'Equipes', senhas:'Gestão de Senhas', acesso:'Controle de Acesso' },
  aprendizagem: { dds:'DDS', dds_battle:'DDS Battle', treinamentos:'Treinamentos', flashcards:'Flashcards', certificados:'Certificados', simulador:'Simulador de Cenários', academia:'Academia SST', trilhas:'Trilhas de Aprendizagem' },
  cultura:      { feed:'Feed Social', reconhecimentos:'Reconhecimentos', ranking:'Ranking', loja:'Loja', missoes:'Missões', campanhas:'Campanhas', moedas:'Moedas SafePoint' },
  seguranca_op: { observacoes:'Observações', ato_inseguro:'Ato Inseguro', condicao_insegura:'Condição Insegura', quase_acidente:'Quase Acidente', boa_pratica:'Boa Prática', melhoria:'Oportunidade de Melhoria', plano_acao:'Plano de Ação', workflow:'Workflow' },
  comunicacao:  { comunicados:'Comunicados', pesquisas:'Pesquisas', podcast:'Podcast', mensagens:'Mensagens Diretas' },
  cipa:         { estrutura:'Estrutura', integrantes:'Integrantes', mandatos:'Mandatos', reunioes:'Reuniões', eleicao:'Eleição Digital', inspecoes:'Inspeções' },
  brigada:      { estrutura:'Estrutura', brigadistas:'Brigadistas', simulados:'Simulados', certificacoes:'Certificações', plano_emergencia:'Plano de Emergência', mapa:'Mapa de Emergência' },
  relatorios:   { dds:'Relatório DDS', treinamentos:'Relatório Treinamentos', quiz:'Relatório Quiz', engajamento:'Relatório Engajamento', exportacoes:'Exportações' },
  ia_insights:  { assistente:'Assistente SST', insights:'SafePoint Insights', mapa_calor:'Mapa de Calor', predicoes:'Predições e Recomendações' },
};

const DEFAULT_SUBMODULOS = {
  dashboard:    { visao_geral:true, indicadores:true, alertas:true, score:false, insights_ia:false },
  pessoas:      { cadastro:true, importacao:true, estrutura:true, setores:true, equipes:true, senhas:true, acesso:true },
  aprendizagem: { dds:true, dds_battle:true, treinamentos:true, flashcards:true, certificados:false, simulador:false, academia:false, trilhas:false },
  cultura:      { feed:true, reconhecimentos:true, ranking:true, loja:true, missoes:true, campanhas:true, moedas:false },
  seguranca_op: { observacoes:true, ato_inseguro:true, condicao_insegura:true, quase_acidente:false, boa_pratica:false, melhoria:false, plano_acao:false, workflow:false },
  comunicacao:  { comunicados:true, pesquisas:true, podcast:false, mensagens:false },
  cipa:         { estrutura:true, integrantes:true, mandatos:true, reunioes:false, eleicao:false, inspecoes:false },
  brigada:      { estrutura:true, brigadistas:true, simulados:false, certificacoes:false, plano_emergencia:false, mapa:false },
  relatorios:   { dds:true, treinamentos:true, quiz:true, engajamento:true, exportacoes:true },
  ia_insights:  { assistente:false, insights:true, mapa_calor:true, predicoes:false },
};

/* ── SafePoint 3.2 — Matriz de permissões ────────────────────── */

const PERMISSION_LABELS = {
  criar_dds:'Criar DDS', editar_dds:'Editar DDS', excluir_dds:'Excluir DDS',
  criar_quiz:'Criar Quiz', gerenciar_pontos:'Gerenciar Pontos',
  gerenciar_reconhecimentos:'Gerenciar Reconhecimentos', criar_campanhas:'Criar Campanhas',
  gerenciar_usuarios:'Gerenciar Usuários', alterar_senhas:'Alterar Senhas',
  gerenciar_cipa:'Gerenciar CIPA', gerenciar_brigada:'Gerenciar Brigada',
  visualizar_auditoria:'Visualizar Auditoria', exportar_relatorios:'Exportar Relatórios',
  gerenciar_modulos:'Gerenciar Módulos'
};

const DEFAULT_PERMISSIONS = {
  sesmt:       { criar_dds:true,  editar_dds:true,  excluir_dds:true,  criar_quiz:true,  gerenciar_pontos:true,  gerenciar_reconhecimentos:true,  criar_campanhas:true,  gerenciar_usuarios:true,  alterar_senhas:true,  gerenciar_cipa:true,  gerenciar_brigada:true,  visualizar_auditoria:true,  exportar_relatorios:true,  gerenciar_modulos:false },
  cipa:        { criar_dds:true,  editar_dds:false, excluir_dds:false, criar_quiz:false, gerenciar_pontos:false, gerenciar_reconhecimentos:true,  criar_campanhas:false, gerenciar_usuarios:false, alterar_senhas:false, gerenciar_cipa:true,  gerenciar_brigada:false, visualizar_auditoria:false, exportar_relatorios:false, gerenciar_modulos:false },
  brigada:     { criar_dds:true,  editar_dds:false, excluir_dds:false, criar_quiz:false, gerenciar_pontos:false, gerenciar_reconhecimentos:true,  criar_campanhas:false, gerenciar_usuarios:false, alterar_senhas:false, gerenciar_cipa:false, gerenciar_brigada:true,  visualizar_auditoria:false, exportar_relatorios:false, gerenciar_modulos:false },
  lideranca:   { criar_dds:true,  editar_dds:false, excluir_dds:false, criar_quiz:false, gerenciar_pontos:false, gerenciar_reconhecimentos:true,  criar_campanhas:false, gerenciar_usuarios:false, alterar_senhas:false, gerenciar_cipa:false, gerenciar_brigada:false, visualizar_auditoria:false, exportar_relatorios:false, gerenciar_modulos:false },
  colaborador: { criar_dds:false, editar_dds:false, excluir_dds:false, criar_quiz:false, gerenciar_pontos:false, gerenciar_reconhecimentos:false, criar_campanhas:false, gerenciar_usuarios:false, alterar_senhas:false, gerenciar_cipa:false, gerenciar_brigada:false, visualizar_auditoria:false, exportar_relatorios:false, gerenciar_modulos:false },
};

const STATUS_EMPRESA = ['ativa', 'em_implantacao', 'suspensa', 'bloqueada', 'cancelada'];
const PLANOS = ['basico', 'profissional', 'enterprise'];

/* ── SafePoint 2.3 — Aprendizagem ───────────────────────────── */

const QUIZ_CATEGORIAS = [
  'NR-01','NR-05','NR-06','NR-10','NR-12','NR-18','NR-20','NR-33','NR-35',
  'APR','EPI','Primeiros Socorros','Combate a Incêndio','Ergonomia',
  'Direção Defensiva','Trabalho em Altura','Espaço Confinado','Procedimentos Gerais'
];
const EXPERT_BADGES = [
  { key:'aprendiz',    nome:'Aprendiz',              emoji:'📚', questoes:50   },
  { key:'estudioso',   nome:'Estudioso',             emoji:'📖', questoes:200  },
  { key:'especialista',nome:'Especialista',          emoji:'🎓', questoes:500  },
  { key:'mestre',      nome:'Mestre do Conhecimento',emoji:'🏆', questoes:1000 }
];

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
  // migrar empresas sem campos novos
  for (const c of db.companies) {
    if (!c.modulos)                          c.modulos = { ...DEFAULT_MODULOS };
    if (!c.status)                           c.status = 'ativa';
    if (c.responsavel    === undefined)      c.responsavel = '';
    if (c.email          === undefined)      c.email = '';
    if (c.telefone       === undefined)      c.telefone = '';
    if (c.plano          === undefined)      c.plano = 'basico';
    if (c.nomeFantasia   === undefined)      c.nomeFantasia = '';
    if (c.limiteColaboradores === undefined) c.limiteColaboradores = 0;
    if (c.dataAtivacao   === undefined)      c.dataAtivacao = '';
    if (c.dataVencimento === undefined)      c.dataVencimento = '';
  }
  // SafePoint 3.2 — submodulos + permissoes
  for (const c of db.companies) {
    if (!c.submodulos) c.submodulos = JSON.parse(JSON.stringify(DEFAULT_SUBMODULOS));
    if (!c.permissoes) c.permissoes = JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS));
    for (const [mod, defaults] of Object.entries(DEFAULT_SUBMODULOS)) {
      if (!c.submodulos[mod]) c.submodulos[mod] = {};
      for (const [sub, val] of Object.entries(defaults)) {
        if (c.submodulos[mod][sub] === undefined) c.submodulos[mod][sub] = val;
      }
    }
    for (const [profile, defaults] of Object.entries(DEFAULT_PERMISSIONS)) {
      if (!c.permissoes[profile]) c.permissoes[profile] = {};
      for (const [perm, val] of Object.entries(defaults)) {
        if (c.permissoes[profile][perm] === undefined) c.permissoes[profile][perm] = val;
      }
    }
  }
  // SafePoint 3.2 — employee new fields
  for (const e of db.employees) {
    if (e.dataAdmissao  === undefined) e.dataAdmissao  = '';
    if (e.gestorDireto  === undefined) e.gestorDireto  = '';
    if (e.foto          === undefined) e.foto          = null;
    if (e.contrato      === undefined) e.contrato      = '';
    if (e.status        === undefined) e.status        = 'ativo';
  }
  if (!db.auditLog)           db.auditLog = [];
  if (!db.pontosExtras)       db.pontosExtras = [];
  if (!db.feed)               db.feed = [];
  if (!db.comunicados)        db.comunicados = [];
  if (!db.quizzes)            db.quizzes = [];
  if (!db.campanhas)          db.campanhas = [];
  if (!db.desafios)           db.desafios = [];
  if (!db.pesquisas)          db.pesquisas = [];
  if (!db.respostasPesquisa)  db.respostasPesquisa = [];
  if (!db.reconhecimentos)    db.reconhecimentos = [];
  // SafePoint 2.3 — aprendizagem
  if (!db.questoes)          db.questoes = [];
  if (!db.battleSessions)    db.battleSessions = [];
  if (!db.flashcards)        db.flashcards = [];
  if (!db.flashcardProgress) db.flashcardProgress = [];
  if (!db.academia)          db.academia = [];
  if (!db.cipaEleicao)       db.cipaEleicao = [];
  for (const e of db.employees) {
    if (e.totalQuestoesRespondidas === undefined) e.totalQuestoesRespondidas = 0;
    if (!e.expertBadges)   e.expertBadges = [];
  }
  // migrar colaboradores sem streak/nivel
  for (const e of db.employees) {
    if (e.streakAtual     === undefined) e.streakAtual = 0;
    if (e.maiorStreak     === undefined) e.maiorStreak = 0;
    if (e.ultimoAcessoDia === undefined) e.ultimoAcessoDia = '';
    if (e.nivelAtual      === undefined) e.nivelAtual = 1;
  }
  // SafePoint 2.1 — campos de autenticação e papéis
  for (const e of db.employees) {
    if (!e.senhaSalt || !e.senhaHash) {
      const pwd = hashPassword('SafePoint@2026');
      e.senhaSalt = pwd.salt;
      e.senhaHash = pwd.hash;
    }
    if (e.primeiroAcesso  === undefined) e.primeiroAcesso  = true;
    if (!e.roles)                        e.roles           = [];
    if (e.email           === undefined) e.email           = '';
    if (e.telefone        === undefined) e.telefone        = '';
    if (e.dataNascimento  === undefined) e.dataNascimento  = '';
    if (e.termosAceitos   === undefined) e.termosAceitos   = false;
  }
  // SafePoint 2.4 — cargos, bloqueio, moedas
  for (const e of db.employees) {
    if (!e.subRoles)               e.subRoles = [];
    if (e.bloqueado === undefined)  e.bloqueado = false;
    if (!e.bloqueadoMotivo)         e.bloqueadoMotivo = '';
    if (e.moedas === undefined)     e.moedas = 0;
    if (e.telefone === undefined)   e.telefone = '';
    if (e.emailCorp === undefined)  e.emailCorp = '';
  }
  for (const f of (db.feed || [])) {
    if (!f.comentarios) f.comentarios = [];
    if (!f.reacoes) f.reacoes = {};
    for (const r of ['like','aplausos','estrela','seguranca','inspirador']) {
      if (!f.reacoes[r]) f.reacoes[r] = [];
    }
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
  saveTimer = setTimeout(() => {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    scheduleSupabaseBackup();
  }, 50);
}

/* ── Supabase backup — persiste dados entre deploys no Render ────
 *  Configure no Render → Environment:
 *    SUPABASE_URL = https://xxxx.supabase.co
 *    SUPABASE_KEY = (anon public key do projeto)
 *  No Supabase SQL Editor rode uma vez:
 *    CREATE TABLE safepoint_backup (
 *      id TEXT PRIMARY KEY,
 *      payload TEXT NOT NULL,
 *      updated_at TIMESTAMPTZ DEFAULT NOW()
 *    );
 *    ALTER TABLE safepoint_backup ENABLE ROW LEVEL SECURITY;
 *    CREATE POLICY allow_all ON safepoint_backup FOR ALL USING (true) WITH CHECK (true);
 * ────────────────────────────────────────────────────────────── */
const SUPA_URL = process.env.SUPABASE_URL || '';
const SUPA_KEY = process.env.SUPABASE_KEY || '';
const USE_SUPA = !!(SUPA_URL && SUPA_KEY);

function supaFetch(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const u = new URL('/rest/v1/' + urlPath, SUPA_URL);
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method,
      headers: {
        'apikey':        SUPA_KEY,
        'Authorization': 'Bearer ' + SUPA_KEY,
        'Content-Type':  'application/json',
        'Prefer':        'resolution=merge-duplicates'
      }
    };
    if (payload) opts.headers['Content-Length'] = Buffer.byteLength(payload);
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

let supaTimer = null;
function scheduleSupabaseBackup() {
  if (!USE_SUPA) return;
  clearTimeout(supaTimer);
  supaTimer = setTimeout(() => {
    const snapshot = JSON.stringify(db);
    supaFetch('POST', 'safepoint_backup', {
      id: 'main',
      payload: snapshot,
      updated_at: new Date().toISOString()
    }).then(() => {
      console.log('[Supabase] backup salvo:', new Date().toLocaleTimeString());
    }).catch(e => console.error('[Supabase] erro no backup:', e.message));
  }, 3000);
}

async function restoreFromSupabase() {
  if (!USE_SUPA) return false;
  try {
    const rows = await supaFetch('GET', 'safepoint_backup?id=eq.main&select=payload');
    if (Array.isArray(rows) && rows[0] && rows[0].payload) {
      db = JSON.parse(rows[0].payload);
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
      console.log('[Supabase] dados restaurados com sucesso!');
      return true;
    }
  } catch (e) {
    console.error('[Supabase] erro ao restaurar:', e.message);
  }
  return false;
}

async function initDb() {
  if (!fs.existsSync(DB_FILE)) {
    console.log('[DB] arquivo local não encontrado, tentando restaurar do Supabase...');
    await restoreFromSupabase();
  }
  loadDb(); // carrega arquivo (restaurado ou cria banco novo)
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

function getNivel(pontos) {
  let atual = NIVEIS[0];
  for (const n of NIVEIS) { if (pontos >= n.minPontos) atual = n; }
  const proxIdx = NIVEIS.findIndex(n => n.nivel === atual.nivel) + 1;
  const prox = proxIdx < NIVEIS.length ? NIVEIS[proxIdx] : null;
  return { ...atual, proximo: prox };
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

function processarStreak(emp) {
  const hoje = todayStr();
  const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (emp.ultimoAcessoDia === hoje) return;
  if (emp.ultimoAcessoDia === ontem) {
    emp.streakAtual = (emp.streakAtual || 0) + 1;
  } else {
    emp.streakAtual = 1;
  }
  emp.ultimoAcessoDia = hoje;
  if ((emp.streakAtual || 0) > (emp.maiorStreak || 0)) emp.maiorStreak = emp.streakAtual;
  const bonus = STREAK_BONUSES.find(b => emp.streakAtual === b.dias);
  if (bonus) {
    db.pontosExtras.push({ id: nextId(), empId: emp.id, companyId: emp.companyId, tipo: 'streak', descricao: bonus.desc, pontos: bonus.pontos, timestamp: Date.now() });
    db.feed.push({ id: nextId(), companyId: emp.companyId, autorId: emp.id, autorRole: 'colaborador', autorNome: emp.nome, tipo: 'conquista', conteudo: `${bonus.desc}\n${emp.nome} completou ${emp.streakAtual} dias consecutivos de acesso ao SafePoint! 🎉`, timestamp: Date.now(), reacoes: { like: [], aplausos: [], estrela: [] }, comentarios: [] });
  }
}

function processarNivel(emp, pontos) {
  const nivel = getNivel(pontos);
  const nivelAntes = emp.nivelAtual || 1;
  if (nivel.nivel > nivelAntes) {
    emp.nivelAtual = nivel.nivel;
    if (nivel.bonus > 0) {
      db.pontosExtras.push({ id: nextId(), empId: emp.id, companyId: emp.companyId, tipo: 'nivel', descricao: `${nivel.emoji} Nível ${nivel.nivel} — ${nivel.nome}`, pontos: nivel.bonus, timestamp: Date.now() });
    }
    db.feed.push({ id: nextId(), companyId: emp.companyId, autorId: emp.id, autorRole: 'colaborador', autorNome: emp.nome, tipo: 'conquista', conteudo: `${nivel.emoji} ${emp.nome} alcançou o nível ${nivel.nivel} — ${nivel.nome}!\nParabéns por contribuir para uma cultura de segurança mais forte! 🎉`, timestamp: Date.now(), reacoes: { like: [], aplausos: [], estrela: [] }, comentarios: [] });
    return true;
  }
  return false;
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
  // pontos extras (streak, quiz, comunicados, bônus de nível)
  for (const pe of (db.pontosExtras || [])) {
    if (pe.empId === employeeId) total += pe.pontos || 0;
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

function calcICS(companyId) {
  const emps = db.employees.filter(e => e.ativo !== false && e.companyId === companyId);
  if (!emps.length) return { ics: 0, nota: 'E', dimensoes: {} };
  const empIds = new Set(emps.map(e => e.id));
  const n = emps.length;

  // Participação (30%): % de colaboradores com ao menos 1 check-in
  const events = db.events.filter(ev => ev.companyId === companyId);
  const empComCheckin = new Set(db.checkins.filter(c => empIds.has(c.employeeId)).map(c => c.employeeId)).size;
  const participacao = events.length ? Math.min(100, (empComCheckin / n) * 100) : 0;

  // Comunicação (20%): % de leituras de comunicados confirmadas
  const coms = (db.comunicados || []).filter(c => c.companyId === companyId);
  let comunicacao = 0;
  if (coms.length) {
    const totalConfirmacoes = coms.reduce((s, c) => s + (c.leituras || []).filter(l => empIds.has(l.empId)).length, 0);
    comunicacao = Math.min(100, (totalConfirmacoes / (coms.length * n)) * 100);
  }

  // Observações (15%): (obs/colab) / 2 * 100, alvo = 2 obs por colaborador
  const totalObs = db.observations.filter(o => empIds.has(o.employeeId)).length;
  const observacoes = Math.min(100, (totalObs / n) / 2 * 100);

  // Sugestões (10%): (sugs/colab) * 100, alvo = 1 por colaborador
  const totalSugs = db.suggestions.filter(sg => empIds.has(sg.employeeId)).length;
  const sugestoes = Math.min(100, (totalSugs / n) * 100);

  // Quiz (10%): respondentes únicos / colaboradores
  const quizzes = (db.quizzes || []).filter(q => q.companyId === companyId);
  let quiz = 0;
  if (quizzes.length) {
    const unicos = new Set(quizzes.flatMap(q => (q.respostas || []).filter(r => empIds.has(r.empId)).map(r => r.empId))).size;
    quiz = Math.min(100, (unicos / n) * 100);
  }

  // Engajamento (15%): posts no feed / colaboradores, alvo = 1 por colaborador
  const feedPosts = (db.feed || []).filter(f => f.companyId === companyId && empIds.has(f.autorId)).length;
  const engajamento = Math.min(100, (feedPosts / n) * 100);

  const ics = Math.min(100, Math.max(0, Math.round(
    participacao * 0.30 + comunicacao * 0.20 + observacoes * 0.15 +
    sugestoes * 0.10 + quiz * 0.10 + engajamento * 0.15
  )));
  const nota = ics >= 80 ? 'A' : ics >= 60 ? 'B' : ics >= 40 ? 'C' : ics >= 20 ? 'D' : 'E';
  return {
    ics, nota,
    dimensoes: {
      participacao: Math.round(participacao),
      comunicacao: Math.round(comunicacao),
      observacoes: Math.round(observacoes),
      sugestoes: Math.round(sugestoes),
      quiz: Math.round(quiz),
      engajamento: Math.round(engajamento)
    }
  };
}

function calcBatalhaEquipes(companyId) {
  const ranking = buildRanking(companyId);
  const map = {};
  for (const r of ranking) {
    const eq = r.equipe || 'Sem equipe';
    if (!map[eq]) map[eq] = { equipe: eq, pontos: 0, membros: [] };
    map[eq].pontos += r.pontos;
    map[eq].membros.push({ id: r.id, nome: r.nome, pontos: r.pontos, nivel: r.conquista ? r.conquista.emoji : '🔰' });
  }
  return Object.values(map).sort((a, b) => b.pontos - a.pontos).map((eq, i) => ({ ...eq, posicao: i + 1 }));
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
  return { id: c.id, nome: c.nome, logo: c.logo || null, cores: c.cores || DEFAULT_CORES, unidades: c.unidades || [] };
}

function logAudit(userId, role, acao, detalhes, companyId, opts = {}) {
  if (!db.auditLog) db.auditLog = [];
  const CRITICOS = new Set(['bloquear_usuario','excluir_usuario','alterar_modulo','alterar_submodulo','alterar_permissao','distribuir_moedas','resetar_senha','bloquear_empresa']);
  db.auditLog.push({
    id: nextId(), timestamp: Date.now(), userId, role, acao,
    detalhes: detalhes || '', companyId: companyId || null,
    modulo:    opts.modulo    || '',
    submodulo: opts.submodulo || '',
    valorAntes:  opts.valorAntes  !== undefined ? opts.valorAntes  : null,
    valorDepois: opts.valorDepois !== undefined ? opts.valorDepois : null,
    ip:          opts.ip          || '',
    dispositivo: opts.dispositivo || '',
    critico: CRITICOS.has(acao)
  });
  saveDb();
}

function getClientIP(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
         (req.socket && req.socket.remoteAddress) || '';
}

function getDeviceInfo(req) {
  const ua = req.headers['user-agent'] || '';
  if (/Mobile|Android/i.test(ua)) return 'Mobile';
  if (/Tablet|iPad/i.test(ua)) return 'Tablet';
  return 'Desktop';
}

/* ── SafePoint 2.3 helpers ──────────────────────────────────── */

function checkExpertBadges(emp) {
  const total = emp.totalQuestoesRespondidas || 0;
  for (const badge of EXPERT_BADGES) {
    if (total >= badge.questoes && !(emp.expertBadges || []).includes(badge.key)) {
      if (!emp.expertBadges) emp.expertBadges = [];
      emp.expertBadges.push(badge.key);
      db.pontosExtras.push({ id: nextId(), empId: emp.id, companyId: emp.companyId,
        tipo: 'badge_expert', descricao: `${badge.emoji} Título: ${badge.nome}`, pontos: 100, timestamp: Date.now() });
      db.feed.push({ id: nextId(), companyId: emp.companyId, autorId: emp.id, autorRole: 'colaborador',
        autorNome: emp.nome, tipo: 'conquista',
        conteudo: `${badge.emoji} ${emp.nome} conquistou o título de "${badge.nome}"! +100 pts 🎉`,
        timestamp: Date.now(), reacoes: { like: [], aplausos: [], estrela: [] }, comentarios: [] });
    }
  }
}

function battlePontos(tempoSeg, maxTempo) {
  if (tempoSeg >= maxTempo) return 40;
  return Math.max(40, Math.round(100 - (tempoSeg / maxTempo) * 60));
}

function battleRanking(session) {
  return session.participantes
    .map(p => ({ empId: p.empId, nome: p.nome, pontos: p.pontos || 0, acertos: p.acertos || 0 }))
    .sort((a, b) => b.pontos - a.pontos)
    .map((p, i) => ({ ...p, posicao: i + 1 }));
}

function battleEstado(session, empId) {
  if (session.status === 'aguardando') {
    return { status: 'aguardando', titulo: session.titulo, participantes: session.participantes.length };
  }
  if (session.status === 'finalizada') {
    const part = session.participantes.find(p => p.empId === empId);
    return { status: 'finalizada', titulo: session.titulo,
      ranking: battleRanking(session), mesPontos: part ? part.pontos : 0 };
  }
  const qi = session.questaoAtual;
  const q = (db.questoes || []).find(x => x.id === session.questoes[qi]);
  const part = session.participantes.find(p => p.empId === empId);
  const jaRespondeu = !!(part?.respostas || []).find(r => r.questaoIdx === qi);
  return {
    status: 'ativa', questaoAtual: qi + 1, totalQuestoes: session.questoes.length,
    questao: q ? { id: q.id, texto: q.texto, tipo: q.tipo,
      opcoes: q.opcoes.map(o => ({ texto: o.texto })),
      tempoPorQuestao: session.tempoPorQuestao, iniciadaEm: session.questaoIniciadaEm } : null,
    jaRespondeu,
    mostrandoResultado: !!session.mostrandoResultado,
    resultadoQuestao: session.mostrandoResultado ? session.ultimoResultado : null,
    ranking: session.mostrandoResultado ? battleRanking(session).slice(0, 10) : null,
    mesPontos: (part || {}).pontos || 0
  };
}

function calcKnowledgeScore(companyId) {
  const questoes = (db.questoes || []).filter(q => q.companyId === companyId && q.stats && q.stats.total > 0);
  if (!questoes.length) return { score: 0, nivel: 'Sem dados', txAcerto: 0 };
  const totalR = questoes.reduce((a, q) => a + q.stats.total, 0);
  const totalA = questoes.reduce((a, q) => a + q.stats.acertos, 0);
  const txAcerto = Math.round((totalA / totalR) * 100);
  const emps = db.employees.filter(e => e.companyId === companyId && e.ativo !== false);
  const participantesIds = new Set((db.battleSessions || []).filter(x => x.companyId === companyId)
    .flatMap(x => x.participantes.map(p => p.empId)));
  const txPartic = emps.length ? Math.min(100, Math.round((participantesIds.size / emps.length) * 100)) : 0;
  const score = Math.round(txAcerto * 0.7 + txPartic * 0.3);
  const nivel = score >= 80 ? 'Excelência em Segurança' : score >= 60 ? 'Satisfatório' : score >= 40 ? 'Requer Atenção' : 'Lacunas Críticas';
  return { score, nivel, txAcerto, txPartic };
}

/* ── SafePoint 3.2 — Governança ─────────────────────────────── */

function calcGovernanceScore(companyId) {
  const comp = db.companies.find(c => c.id === companyId);
  if (!comp) return { score: 0, grade: 'Risco Administrativo', gradeEmoji: '🔴', components: {} };
  // Controle de permissões (25%): customizado além do padrão?
  const permScore = comp.permissoes ? 80 : 40;
  // Configuração da empresa (25%)
  const configFields = ['cnpj', 'responsavel', 'email', 'dataVencimento'];
  const configScore = Math.round((configFields.filter(f => comp[f]).length / configFields.length) * 100);
  // Eventos críticos nas últimas 48h (25%)
  const agora = Date.now();
  const critLogs = (db.auditLog || []).filter(l =>
    l.companyId === companyId && l.critico && (agora - l.timestamp) < 48 * 3600000
  ).length;
  const eventoScore = critLogs === 0 ? 100 : critLogs <= 3 ? 70 : 40;
  // Engajamento mês (25%)
  const emps = db.employees.filter(e => e.companyId === companyId && e.ativo !== false);
  const totalEmps = emps.length || 1;
  const mesAtras = agora - 30 * 24 * 3600000;
  const empIds = new Set(emps.map(e => e.id));
  const ativos = new Set(db.checkins.filter(c => empIds.has(c.employeeId) && c.timestamp > mesAtras).map(c => c.employeeId)).size;
  const engScore = Math.min(100, Math.round((ativos / totalEmps) * 100));
  const score = Math.round(permScore * 0.25 + configScore * 0.25 + eventoScore * 0.25 + engScore * 0.25);
  const grade = score >= 80 ? 'Excelente Governança' : score >= 60 ? 'Atenção' : 'Risco Administrativo';
  const gradeEmoji = score >= 80 ? '🟢' : score >= 60 ? '🟡' : '🔴';
  return {
    score, grade, gradeEmoji,
    components: { permissoes: permScore, configuracao: configScore, eventos_criticos: eventoScore, engajamento: engScore },
    totalCriticos: critLogs, totalAtivos: ativos, totalEmps
  };
}

/* ── Roteamento ──────────────────────────────────────────────── */

const routes = [];
function route(method, pattern, opts, handler) { routes.push({ method, pattern, opts, handler }); }

/* ── Papéis de usuário (SafePoint 2.1) ──────────────────────── */

const VALID_ROLES = ['sesmt', 'cipa', 'brigada', 'tecnico_seguranca', 'medico_trabalho', 'ergonomista', 'lideranca'];
const ROLE_LABELS = {
  sesmt:              'SESMT',
  cipa:               'CIPA',
  brigada:            'Brigada de Emergência',
  tecnico_seguranca:  'Técnico de Segurança',
  medico_trabalho:    'Médico do Trabalho',
  ergonomista:        'Ergonomista'
};
const ROLE_EMOJIS = {
  sesmt: '🦺', cipa: '⚠️', brigada: '🚒',
  tecnico_seguranca: '🔧', medico_trabalho: '🩺', ergonomista: '🪑'
};

/* ── SafePoint 2.4 — Cargos CIPA / Brigada ────────────────── */

const CIPA_CARGOS = [
  { key:'cipa_presidente',  emoji:'📋', label:'Presidente da CIPA'      },
  { key:'cipa_vice',        emoji:'🤝', label:'Vice-Presidente da CIPA' },
  { key:'cipa_secretario',  emoji:'📝', label:'Secretário da CIPA'      },
  { key:'cipa_titular',     emoji:'👥', label:'Membro Titular'          },
  { key:'cipa_suplente',    emoji:'📌', label:'Membro Suplente'         },
];
const BRIGADA_CARGOS = [
  { key:'brigada_coordenador', emoji:'🚨', label:'Coordenador Geral da Brigada' },
  { key:'brigada_lider',       emoji:'🦺', label:'Líder de Brigada'             },
  { key:'brigada_brigadista',  emoji:'🔥', label:'Brigadista'                   },
  { key:'brigada_socorrista',  emoji:'🚑', label:'Socorrista'                   },
];
const ALL_CARGOS    = [...CIPA_CARGOS, ...BRIGADA_CARGOS];
const ALL_CARGO_KEYS = ALL_CARGOS.map(c => c.key);

function getGestorUser(s) {
  if (!s || s.role !== 'gestor') return null;
  if (s.isEmployee) return db.employees.find(e => e.id === s.userId) || null;
  return db.managers.find(m => m.id === s.userId) || null;
}

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
    const usuario = String(body.usuario || '').toLowerCase().trim();
    // Master Admin pode entrar pelo tab de Gestor SST
    const adm = db.admins.find(u => u.username.toLowerCase() === usuario);
    if (adm) {
      const check = hashPassword(String(body.senha || ''), adm.salt);
      if (check.hash !== adm.hash) return sendJson(res, 401, { error: 'Usuário ou senha incorretos.' });
      const token = createSession({ role: 'admin', userId: adm.id });
      res.setHeader('Set-Cookie', `sesmt_token=${token}; Path=/; HttpOnly; SameSite=Lax`);
      logAudit(adm.id, 'admin', 'login', `Admin ${adm.username} entrou`);
      return sendJson(res, 200, { ok: true, perfil: 'admin', nome: adm.name });
    }
    const mgr = db.managers.find(u => u.username.toLowerCase() === usuario);
    if (!mgr) return sendJson(res, 401, { error: 'Usuário ou senha incorretos.' });
    const check = hashPassword(String(body.senha || ''), mgr.salt);
    if (check.hash !== mgr.hash) return sendJson(res, 401, { error: 'Usuário ou senha incorretos.' });
    // Bloquear empresa suspensa/bloqueada
    const emp2 = db.companies.find(c => c.id === mgr.companyId);
    if (emp2 && ['suspensa', 'bloqueada', 'cancelada'].includes(emp2.status)) {
      return sendJson(res, 403, { error: `Acesso bloqueado. Status da empresa: ${emp2.status}.` });
    }
    const token = createSession({ role: 'gestor', userId: mgr.id, companyId: mgr.companyId });
    res.setHeader('Set-Cookie', `sesmt_token=${token}; Path=/; HttpOnly; SameSite=Lax`);
    logAudit(mgr.id, 'gestor', 'login', `Gestor ${mgr.username} entrou`, mgr.companyId);
    const branding = getCompanyBranding(mgr.companyId);
    return sendJson(res, 200, { ok: true, perfil: 'gestor', nome: mgr.name, branding });
  }
  if (body.perfil === 'colaborador') {
    const mat = normalizeMatricula(body.matricula);
    const companyId = body.companyId ? Number(body.companyId) : null;
    let emp;
    if (companyId) {
      emp = db.employees.find(e => e.matricula === mat && e.companyId === companyId && e.ativo !== false);
      if (!emp) return sendJson(res, 401, { error: 'Matrícula não encontrada nesta empresa. Consulte o gestor SST.' });
    } else {
      emp = db.employees.find(e => e.matricula === mat && e.ativo !== false);
      if (!emp) return sendJson(res, 401, { error: 'Matrícula não encontrada. Selecione a empresa ou consulte o gestor SST.' });
    }
    processarStreak(emp);
    saveDb();
    const token = createSession({ role: 'colaborador', employeeId: emp.id, companyId: emp.companyId });
    res.setHeader('Set-Cookie', `sesmt_token=${token}; Path=/; HttpOnly; SameSite=Lax`);
    const branding = getCompanyBranding(emp.companyId);
    return sendJson(res, 200, { ok: true, perfil: 'colaborador', nome: emp.nome, branding });
  }
  if (body.perfil === 'unificado') {
    const mat = normalizeMatricula(body.matricula);
    const emp = db.employees.find(e => e.matricula === mat && e.ativo !== false);
    if (!emp) return sendJson(res, 401, { error: 'Matrícula não encontrada. Consulte o setor de SST.' });
    if (emp.bloqueado) return sendJson(res, 403, { error: 'Acesso bloqueado. Entre em contato com o SESMT.' });
    const check = hashPassword(String(body.senha || ''), emp.senhaSalt);
    if (check.hash !== emp.senhaHash) return sendJson(res, 401, { error: 'Senha incorreta.' });
    const comp = db.companies.find(c => c.id === emp.companyId);
    if (comp && ['suspensa', 'bloqueada', 'cancelada'].includes(comp.status)) {
      return sendJson(res, 403, { error: `Acesso bloqueado. Status da empresa: ${comp.status}.` });
    }
    processarStreak(emp);
    saveDb();
    const branding = getCompanyBranding(emp.companyId);
    const isSesmt = (emp.roles || []).includes('sesmt');
    if (isSesmt) {
      const token = createSession({ role: 'gestor', userId: emp.id, companyId: emp.companyId, isEmployee: true });
      res.setHeader('Set-Cookie', `sesmt_token=${token}; Path=/; HttpOnly; SameSite=Lax`);
      logAudit(emp.id, 'gestor', 'login', `SESMT ${emp.nome} entrou`, emp.companyId);
      return sendJson(res, 200, { ok: true, perfil: 'gestor', nome: emp.nome, branding, primeiroAcesso: !!emp.primeiroAcesso, termosAceitos: !!emp.termosAceitos, roles: emp.roles || [] });
    }
    const isLideranca = (emp.roles || []).includes('lideranca');
    const token = createSession({ role: 'colaborador', employeeId: emp.id, companyId: emp.companyId, isLideranca });
    res.setHeader('Set-Cookie', `sesmt_token=${token}; Path=/; HttpOnly; SameSite=Lax`);
    logAudit(emp.id, 'colaborador', 'login', `Colaborador ${emp.nome} entrou`, emp.companyId);
    return sendJson(res, 200, { ok: true, perfil: 'colaborador', nome: emp.nome, branding, primeiroAcesso: !!emp.primeiroAcesso, termosAceitos: !!emp.termosAceitos, roles: emp.roles || [], isLideranca });
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
    const branding = getCompanyBranding(s.companyId);
    let nome, roles = [], primeiroAcesso = false, termosAceitos = true;
    if (s.isEmployee) {
      const emp = db.employees.find(e => e.id === s.userId);
      nome = emp ? emp.nome : 'Gestor';
      roles = emp ? (emp.roles || []) : [];
      primeiroAcesso = emp ? !!emp.primeiroAcesso : false;
      termosAceitos = emp ? !!emp.termosAceitos : true;
    } else {
      const mgr = s.userId ? db.managers.find(u => u.id === s.userId) : null;
      nome = mgr ? mgr.name : (s.adminImpersonating ? '👀 Admin visitando' : 'Gestor');
    }
    return sendJson(res, 200, { autenticado: true, perfil: 'gestor', nome, branding, adminImpersonando: !!s.adminImpersonating, roles, isEmployee: !!s.isEmployee, primeiroAcesso, termosAceitos });
  }
  const emp = db.employees.find(e => e.id === s.employeeId);
  const branding = getCompanyBranding(s.companyId);
  return sendJson(res, 200, { autenticado: true, perfil: 'colaborador', nome: emp ? emp.nome : '', employeeId: s.employeeId, branding, roles: emp ? (emp.roles || []) : [], primeiroAcesso: emp ? !!emp.primeiroAcesso : false, termosAceitos: emp ? !!emp.termosAceitos : true });
});

route('POST', /^\/api\/senha$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  if (s.isEmployee) {
    const emp = db.employees.find(e => e.id === s.userId);
    if (!emp) return sendJson(res, 404, { error: 'Usuário não encontrado.' });
    const atual = hashPassword(String(body.senhaAtual || ''), emp.senhaSalt);
    if (atual.hash !== emp.senhaHash) return sendJson(res, 400, { error: 'Senha atual incorreta.' });
    if (!body.novaSenha || String(body.novaSenha).length < 6) return sendJson(res, 400, { error: 'Nova senha: mínimo 6 caracteres.' });
    const nova = hashPassword(String(body.novaSenha));
    emp.senhaSalt = nova.salt; emp.senhaHash = nova.hash;
    emp.primeiroAcesso = false;
    saveDb();
    return sendJson(res, 200, { ok: true });
  }
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

// SafePoint 2.1 — employee password change (first-access or regular)
route('POST', /^\/api\/alterar-senha-emp$/, { role: 'any' }, async (req, res, m, body, s) => {
  let emp;
  if (s.role === 'colaborador')                    emp = db.employees.find(e => e.id === s.employeeId);
  else if (s.role === 'gestor' && s.isEmployee)    emp = db.employees.find(e => e.id === s.userId);
  if (!emp) return sendJson(res, 403, { error: 'Apenas colaboradores podem usar este endpoint.' });
  const check = hashPassword(String(body.senhaAtual || ''), emp.senhaSalt);
  if (check.hash !== emp.senhaHash) return sendJson(res, 400, { error: 'Senha atual incorreta.' });
  if (!body.novaSenha || String(body.novaSenha).length < 6) return sendJson(res, 400, { error: 'Nova senha: mínimo 6 caracteres.' });
  const nova = hashPassword(String(body.novaSenha));
  emp.senhaSalt = nova.salt; emp.senhaHash = nova.hash;
  emp.primeiroAcesso = false;
  saveDb();
  sendJson(res, 200, { ok: true });
});

// SafePoint 2.1 — accept terms
route('POST', /^\/api\/aceitar-termos$/, { role: 'any' }, async (req, res, m, body, s) => {
  let emp;
  if (s.role === 'colaborador')                    emp = db.employees.find(e => e.id === s.employeeId);
  else if (s.role === 'gestor' && s.isEmployee)    emp = db.employees.find(e => e.id === s.userId);
  if (!emp) return sendJson(res, 403, { error: 'Não autorizado.' });
  emp.termosAceitos   = true;
  emp.termosAceitosEm = Date.now();
  saveDb();
  sendJson(res, 200, { ok: true });
});

// SafePoint 2.1 — role management (somente SESMT ou gestor legado)
function checkSesmtPermission(s) {
  if (!s.isEmployee) return true; // gestor legado (tabela managers) → pode
  const requester = db.employees.find(e => e.id === s.userId);
  return requester && (requester.roles || []).includes('sesmt');
}

route('POST', /^\/api\/usuarios\/(\d+)\/roles$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  if (!checkSesmtPermission(s)) return sendJson(res, 403, { error: 'Apenas o SESMT pode gerenciar papéis de acesso.' });
  const emp = db.employees.find(e => e.id === Number(m[1]) && e.companyId === s.companyId);
  if (!emp) return sendJson(res, 404, { error: 'Colaborador não encontrado.' });
  const role = String(body.role || '');
  if (!VALID_ROLES.includes(role)) return sendJson(res, 400, { error: 'Papel inválido.' });
  if (!emp.roles) emp.roles = [];
  if (!emp.roles.includes(role)) emp.roles.push(role);
  saveDb();
  logAudit(s.userId, s.role, 'atribuir_role', `${role} → ${emp.nome}`, s.companyId);
  sendJson(res, 200, { ok: true, roles: emp.roles });
});

route('DELETE', /^\/api\/usuarios\/(\d+)\/roles\/(\w+)$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  if (!checkSesmtPermission(s)) return sendJson(res, 403, { error: 'Apenas o SESMT pode gerenciar papéis de acesso.' });
  const emp = db.employees.find(e => e.id === Number(m[1]) && e.companyId === s.companyId);
  if (!emp) return sendJson(res, 404, { error: 'Colaborador não encontrado.' });
  emp.roles = (emp.roles || []).filter(r => r !== m[2]);
  saveDb();
  logAudit(s.userId, s.role, 'remover_role', `${m[2]} → ${emp.nome}`, s.companyId);
  sendJson(res, 200, { ok: true, roles: emp.roles });
});

// SafePoint 2.1 — Quem é Quem (corporate directory)
route('GET', /^\/api\/quem-e-quem$/, { role: 'any' }, async (req, res, m, body, s) => {
  const url2 = new URL('http://x' + req.url);
  const roleFilter = url2.searchParams.get('role') || '';
  let list = db.employees.filter(e => e.companyId === s.companyId && e.ativo !== false).map(e => ({
    id: e.id, nome: e.nome, funcao: e.funcao || '', setor: e.setor || '',
    equipe: e.equipe || '', unidade: e.unidade || '', roles: e.roles || [],
    subRoles: e.subRoles || [], foto: e.foto || null,
    telefone: e.telefone || '', emailCorp: e.emailCorp || '', matricula: e.matricula || ''
  }));
  if (roleFilter) list = list.filter(e => e.roles.includes(roleFilter));
  list.sort((a, b) => a.nome.localeCompare(b.nome));
  sendJson(res, 200, list);
});

/* ── SafePoint 2.4 — Estrutura SST, Cargos, Acessos ─────────── */

route('GET', /^\/api\/estrutura$/, { role: 'any' }, async (req, res, m, body, s) => {
  const emps = db.employees.filter(e => e.companyId === s.companyId && e.ativo !== false && !e.bloqueado);
  const mapEmp = e => ({
    id: e.id, nome: e.nome, matricula: e.matricula || '',
    funcao: e.funcao || '', setor: e.setor || '', unidade: e.unidade || '',
    roles: e.roles || [], subRoles: e.subRoles || [],
    telefone: e.telefone || '', emailCorp: e.emailCorp || '', foto: e.foto || null
  });
  const byRole = role => emps.filter(e => (e.roles || []).includes(role)).map(mapEmp);
  const byCargo = cargo => emps.filter(e => (e.subRoles || []).some(s2 => s2.cargo === cargo)).map(e => ({
    ...mapEmp(e), mandato: (e.subRoles || []).find(s2 => s2.cargo === cargo) || {}
  }));
  sendJson(res, 200, {
    sesmt:   byRole('sesmt'),
    cipa: {
      presidente:  byCargo('cipa_presidente'),
      vice:        byCargo('cipa_vice'),
      secretario:  byCargo('cipa_secretario'),
      titulares:   byCargo('cipa_titular'),
      suplentes:   byCargo('cipa_suplente'),
      todos:       byRole('cipa'),
    },
    brigada: {
      coordenador: byCargo('brigada_coordenador'),
      lideres:     byCargo('brigada_lider'),
      brigadistas: byCargo('brigada_brigadista'),
      socorristas: byCargo('brigada_socorrista'),
      todos:       byRole('brigada'),
    },
    tecnico_seguranca: byRole('tecnico_seguranca'),
    medico_trabalho:   byRole('medico_trabalho'),
    ergonomista:       byRole('ergonomista'),
  });
});

route('GET', /^\/api\/colaboradores\/(\d+)\/subroles$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const emp = db.employees.find(e => e.id === Number(m[1]) && e.companyId === s.companyId);
  if (!emp) return sendJson(res, 404, { error: 'Colaborador não encontrado.' });
  sendJson(res, 200, emp.subRoles || []);
});

route('POST', /^\/api\/colaboradores\/(\d+)\/subroles$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  if (!checkSesmtPermission(s)) return sendJson(res, 403, { error: 'Apenas o SESMT pode atribuir cargos.' });
  const emp = db.employees.find(e => e.id === Number(m[1]) && e.companyId === s.companyId);
  if (!emp) return sendJson(res, 404, { error: 'Colaborador não encontrado.' });
  const cargo = String(body.cargo || '');
  if (!ALL_CARGO_KEYS.includes(cargo)) return sendJson(res, 400, { error: 'Cargo inválido.' });
  if (!emp.subRoles) emp.subRoles = [];
  const existing = emp.subRoles.find(sr => sr.cargo === cargo);
  if (existing) {
    existing.inicioMandato = body.inicioMandato || existing.inicioMandato;
    existing.fimMandato    = body.fimMandato    || existing.fimMandato;
  } else {
    emp.subRoles.push({ cargo, inicioMandato: body.inicioMandato || '', fimMandato: body.fimMandato || '', criadoEm: Date.now() });
    // ensure parent role is assigned automatically
    const parentRole = cargo.startsWith('cipa_') ? 'cipa' : 'brigada';
    if (!(emp.roles || []).includes(parentRole)) {
      if (!emp.roles) emp.roles = [];
      emp.roles.push(parentRole);
    }
  }
  saveDb();
  logAudit(s.userId, s.role, 'atribuir_cargo', `${cargo} → ${emp.nome}`, s.companyId);
  sendJson(res, 200, { ok: true, subRoles: emp.subRoles });
});

route('DELETE', /^\/api\/colaboradores\/(\d+)\/subroles\/([a-z_]+)$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  if (!checkSesmtPermission(s)) return sendJson(res, 403, { error: 'Apenas o SESMT pode remover cargos.' });
  const emp = db.employees.find(e => e.id === Number(m[1]) && e.companyId === s.companyId);
  if (!emp) return sendJson(res, 404, { error: 'Colaborador não encontrado.' });
  emp.subRoles = (emp.subRoles || []).filter(sr => sr.cargo !== m[2]);
  saveDb();
  logAudit(s.userId, s.role, 'remover_cargo', `${m[2]} → ${emp.nome}`, s.companyId);
  sendJson(res, 200, { ok: true, subRoles: emp.subRoles });
});

route('POST', /^\/api\/colaboradores\/(\d+)\/bloquear$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  if (!checkSesmtPermission(s)) return sendJson(res, 403, { error: 'Apenas o SESMT pode bloquear usuários.' });
  const emp = db.employees.find(e => e.id === Number(m[1]) && e.companyId === s.companyId);
  if (!emp) return sendJson(res, 404, { error: 'Colaborador não encontrado.' });
  emp.bloqueado = true;
  emp.bloqueadoMotivo = String(body.motivo || '');
  saveDb();
  logAudit(s.userId, s.role, 'bloquear_usuario', `Bloqueado: ${emp.nome} — ${emp.bloqueadoMotivo}`, s.companyId);
  sendJson(res, 200, { ok: true });
});

route('POST', /^\/api\/colaboradores\/(\d+)\/desbloquear$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  if (!checkSesmtPermission(s)) return sendJson(res, 403, { error: 'Apenas o SESMT pode desbloquear usuários.' });
  const emp = db.employees.find(e => e.id === Number(m[1]) && e.companyId === s.companyId);
  if (!emp) return sendJson(res, 404, { error: 'Colaborador não encontrado.' });
  emp.bloqueado = false;
  emp.bloqueadoMotivo = '';
  saveDb();
  logAudit(s.userId, s.role, 'desbloquear_usuario', `Desbloqueado: ${emp.nome}`, s.companyId);
  sendJson(res, 200, { ok: true });
});

route('POST', /^\/api\/colaboradores\/(\d+)\/resetar-senha$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  if (!checkSesmtPermission(s)) return sendJson(res, 403, { error: 'Apenas o SESMT pode resetar senhas.' });
  const emp = db.employees.find(e => e.id === Number(m[1]) && e.companyId === s.companyId);
  if (!emp) return sendJson(res, 404, { error: 'Colaborador não encontrado.' });
  const nova = hashPassword('SafePoint@2026');
  emp.senhaSalt = nova.salt; emp.senhaHash = nova.hash;
  emp.primeiroAcesso = true;
  saveDb();
  logAudit(s.userId, s.role, 'resetar_senha', `Senha resetada: ${emp.nome}`, s.companyId);
  sendJson(res, 200, { ok: true, senhaProvisoria: 'SafePoint@2026' });
});

route('POST', /^\/api\/colaboradores\/(\d+)\/moedas$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  if (!checkSesmtPermission(s)) return sendJson(res, 403, { error: 'Apenas o SESMT pode distribuir moedas.' });
  const emp = db.employees.find(e => e.id === Number(m[1]) && e.companyId === s.companyId);
  if (!emp) return sendJson(res, 404, { error: 'Colaborador não encontrado.' });
  const qtd = Math.min(1000, Math.max(1, Number(body.quantidade) || 1));
  const motivo = String(body.motivo || 'Reconhecimento').slice(0, 200);
  emp.moedas = (emp.moedas || 0) + qtd;
  // convert to points (1 moeda = 5 pontos)
  db.pontosExtras.push({ id: nextId(), empId: emp.id, companyId: emp.companyId,
    tipo: 'moedas', descricao: `🪙 ${qtd} Moedas SafePoint — ${motivo}`, pontos: qtd * 5, timestamp: Date.now() });
  saveDb();
  logAudit(s.userId, s.role, 'distribuir_moedas', `${qtd} moedas → ${emp.nome}: ${motivo}`, s.companyId);
  sendJson(res, 200, { ok: true, moedasTotal: emp.moedas });
});

route('GET', /^\/api\/auditlog$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  if (!checkSesmtPermission(s)) return sendJson(res, 403, { error: 'Apenas o SESMT pode ver o log de auditoria.' });
  const logs = (db.auditLog || [])
    .filter(l => l.companyId === s.companyId)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 200)
    .map(l => {
      const autor = db.employees.find(e => e.id === l.userId) || db.managers.find(mg => mg.id === l.userId);
      return { ...l, autorNome: autor ? (autor.nome || autor.name || '') : 'Sistema' };
    });
  sendJson(res, 200, logs);
});

route('GET', /^\/api\/carteirinha\/(\d+)$/, { role: 'any' }, async (req, res, m, body, s) => {
  const emp = db.employees.find(e => e.id === Number(m[1]) && e.companyId === s.companyId && e.ativo !== false);
  if (!emp) return sendJson(res, 404, { error: 'Colaborador não encontrado.' });
  const comp = db.companies.find(c => c.id === emp.companyId);
  const { senhaSalt, senhaHash, ...safe } = emp;
  sendJson(res, 200, { ...safe, empresaNome: comp ? (comp.nomeFantasia || comp.nome) : '' });
});

/* ── Endpoint público: lista de empresas para o login ─────── */

route('GET', /^\/api\/empresas-publicas$/, { public: true }, async (req, res) => {
  const list = db.companies
    .filter(c => c.ativo !== false && !['bloqueada', 'cancelada'].includes(c.status))
    .map(c => ({ id: c.id, nome: c.nomeFantasia || c.nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  sendJson(res, 200, list);
});

/* ── Admin — Empresas ────────────────────────────────────────── */

route('GET', /^\/api\/admin\/stats$/, { role: 'admin' }, async (req, res) => {
  sendJson(res, 200, {
    totalEmpresas:      db.companies.filter(c => c.ativo !== false).length,
    totalColaboradores: db.employees.filter(e => e.ativo !== false).length,
    totalGestores:      db.managers.length,
    totalEventos:       db.events.length,
    totalCheckins:      db.checkins.length,
    totalSugestoes:     db.suggestions.length,
    totalObservacoes:   db.observations.length,
    totalPontos:        db.checkins.reduce((s, c) => s + (c.pontosAtribuidos || 0), 0),
    empresasPorStatus:  STATUS_EMPRESA.reduce((acc, s) => {
      acc[s] = db.companies.filter(c => c.status === s).length; return acc;
    }, {})
  });
});

route('GET', /^\/api\/admin\/empresas$/, { role: 'admin' }, async (req, res) => {
  const list = db.companies.map(c => ({
    ...c,
    logo: c.logo ? '[logo]' : null,
    totalGestores: db.managers.filter(m => m.companyId === c.id).length,
    totalColaboradores: db.employees.filter(e => e.companyId === c.id).length
  }));
  sendJson(res, 200, list);
});

route('POST', /^\/api\/admin\/empresas$/, { role: 'admin' }, async (req, res, m, body, s) => {
  if (!String(body.nome || '').trim()) return sendJson(res, 400, { error: 'Razão Social é obrigatória.' });
  const empresa = {
    id: nextId(),
    nome:               String(body.nome || '').trim(),
    nomeFantasia:       String(body.nomeFantasia || '').trim(),
    cnpj:               String(body.cnpj || '').trim(),
    responsavel:        String(body.responsavel || '').trim(),
    email:              String(body.email || '').trim(),
    telefone:           String(body.telefone || '').trim(),
    limiteColaboradores: Number(body.limiteColaboradores) || 0,
    plano:              PLANOS.includes(body.plano) ? body.plano : 'basico',
    status:             STATUS_EMPRESA.includes(body.status) ? body.status : 'ativa',
    dataAtivacao:       String(body.dataAtivacao || ''),
    dataVencimento:     String(body.dataVencimento || ''),
    modulos:            { ...DEFAULT_MODULOS, ...(body.modulos || {}) },
    logo:               null,
    cores:              { ...DEFAULT_CORES, ...(body.cores || {}) },
    unidades:           Array.isArray(body.unidades) ? body.unidades : [{ id: nextId(), nome: 'Matriz', endereco: '', cidade: '', estado: '' }],
    ativo:              true,
    criadaEm:           Date.now()
  };
  db.companies.push(empresa);
  logAudit(s.userId, 'admin', 'empresa_criada', `Empresa "${empresa.nome}" criada`);
  saveDb();
  sendJson(res, 201, { ...empresa, logo: null });
});

route('PUT', /^\/api\/admin\/empresas\/(\d+)$/, { role: 'admin' }, async (req, res, m, body) => {
  const empresa = db.companies.find(c => c.id === Number(m[1]));
  if (!empresa) return sendJson(res, 404, { error: 'Empresa não encontrada.' });
  if (body.nome         !== undefined) empresa.nome         = String(body.nome).trim();
  if (body.nomeFantasia !== undefined) empresa.nomeFantasia = String(body.nomeFantasia).trim();
  if (body.cnpj         !== undefined) empresa.cnpj         = String(body.cnpj).trim();
  if (body.responsavel  !== undefined) empresa.responsavel  = String(body.responsavel).trim();
  if (body.email        !== undefined) empresa.email        = String(body.email).trim();
  if (body.telefone     !== undefined) empresa.telefone     = String(body.telefone).trim();
  if (body.limiteColaboradores !== undefined) empresa.limiteColaboradores = Number(body.limiteColaboradores) || 0;
  if (body.plano        !== undefined && PLANOS.includes(body.plano))         empresa.plano        = body.plano;
  if (body.status       !== undefined && STATUS_EMPRESA.includes(body.status)) empresa.status       = body.status;
  if (body.dataAtivacao   !== undefined) empresa.dataAtivacao   = String(body.dataAtivacao);
  if (body.dataVencimento !== undefined) empresa.dataVencimento = String(body.dataVencimento);
  if (body.modulos      !== undefined) empresa.modulos = { ...empresa.modulos, ...body.modulos };
  if (body.ativo        !== undefined) empresa.ativo   = !!body.ativo;
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

route('POST', /^\/api\/admin\/empresas\/(\d+)\/entrar$/, { role: 'admin' }, async (req, res, m, body, s) => {
  const empresa = db.companies.find(c => c.id === Number(m[1]));
  if (!empresa) return sendJson(res, 404, { error: 'Empresa não encontrada.' });
  const mgr = db.managers.find(mg => mg.companyId === empresa.id);
  const token = createSession({ role: 'gestor', userId: mgr ? mgr.id : null, companyId: empresa.id, adminImpersonating: true });
  res.setHeader('Set-Cookie', `sesmt_token=${token}; Path=/; HttpOnly; SameSite=Lax`);
  logAudit(s.userId, 'admin', 'entrou_empresa', `Admin entrou na empresa "${empresa.nome}"`, empresa.id);
  const branding = getCompanyBranding(empresa.id);
  return sendJson(res, 200, { ok: true, branding });
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
      const { senhaSalt, senhaHash, ...safe } = e;
      return { ...safe, pontos: p.total, conquista: getAchievement(p.total), ies: calcIES(e.id) };
    });
  sendJson(res, 200, list);
});

route('POST', /^\/api\/colaboradores$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const mat = normalizeMatricula(body.matricula);
  if (!mat || !String(body.nome || '').trim()) return sendJson(res, 400, { error: 'Matrícula e nome são obrigatórios.' });
  if (db.employees.some(e => e.matricula === mat && e.companyId === s.companyId)) return sendJson(res, 409, { error: `Matrícula ${mat} já cadastrada.` });
  const defaultPwd = hashPassword('SafePoint@2026');
  const emp = {
    id: nextId(), matricula: mat, nome: String(body.nome).trim(),
    cpf: String(body.cpf || '').trim(),
    setor: String(body.setor || '').trim(), funcao: String(body.funcao || '').trim(),
    equipe: String(body.equipe || '').trim(), unidade: String(body.unidade || '').trim(),
    empresa: String(body.empresa || '').trim(), ativo: true, companyId: s.companyId,
    senhaSalt: defaultPwd.salt, senhaHash: defaultPwd.hash,
    primeiroAcesso: true, roles: [], termosAceitos: false,
    email: String(body.email || '').trim(), telefone: String(body.telefone || '').trim(),
    emailCorp: String(body.emailCorp || '').trim(),
    dataNascimento: String(body.dataNascimento || '').trim(),
    dataAdmissao: String(body.dataAdmissao || '').trim(),
    gestorDireto: String(body.gestorDireto || '').trim(),
    foto: null, contrato: String(body.contrato || '').trim(), status: 'ativo',
    streakAtual: 0, maiorStreak: 0, ultimoAcessoDia: '', nivelAtual: 1
  };
  if (Array.isArray(body.roles)) {
    emp.roles = body.roles.filter(r => VALID_ROLES.includes(r));
  }
  db.employees.push(emp);
  saveDb();
  const { senhaSalt, senhaHash, ...safeEmp } = emp;
  sendJson(res, 201, safeEmp);
});

route('POST', /^\/api\/colaboradores\/importar$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const { rows, errors } = parseBulk(body.texto);
  const inseridos = [], duplicados = [];
  for (const r of rows) {
    if (db.employees.some(e => e.matricula === r.matricula && e.companyId === s.companyId) || inseridos.some(e => e.matricula === r.matricula)) {
      duplicados.push(r.matricula); continue;
    }
    const bpwd = hashPassword('SafePoint@2026');
    const emp = { id: nextId(), ...r, cpf: '', ativo: true, companyId: s.companyId,
      senhaSalt: bpwd.salt, senhaHash: bpwd.hash, primeiroAcesso: true, roles: [],
      termosAceitos: false, email: '', telefone: '', dataNascimento: '',
      streakAtual: 0, maiorStreak: 0, ultimoAcessoDia: '', nivelAtual: 1 };
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
  ['nome','cpf','setor','funcao','equipe','unidade','empresa','email','telefone','emailCorp','dataNascimento','dataAdmissao','gestorDireto','contrato'].forEach(f => {
    if (body[f] !== undefined) emp[f] = String(body[f]).trim();
  });
  if (body.ativo !== undefined) emp.ativo = !!body.ativo;
  if (Array.isArray(body.roles)) emp.roles = body.roles.filter(r => VALID_ROLES.includes(r));
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

/* ── Dashboard avançado ──────────────────────────────────────── */

route('GET', /^\/api\/dashboard\/hoje$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const hoje = todayStr();
  const emps = db.employees.filter(e => e.ativo !== false && e.companyId === s.companyId);
  const empIds = new Set(emps.map(e => e.id));
  const evHoje = db.events.filter(ev => ev.companyId === s.companyId && ev.data === hoje);
  const checkinsHoje = db.checkins.filter(c => empIds.has(c.employeeId) && c.timestamp && c.timestamp.startsWith(hoje));
  const obsHoje = db.observations.filter(o => empIds.has(o.employeeId) && o.criadoEm && new Date(o.criadoEm).toISOString().startsWith(hoje));
  const sugsHoje = db.suggestions.filter(sg => empIds.has(sg.employeeId) && sg.criadaEm && new Date(sg.criadaEm).toISOString().startsWith(hoje));
  const comunsPendentes = (db.comunicados || []).filter(c => c.companyId === s.companyId && (c.leituras || []).filter(l => empIds.has(l.empId)).length < emps.length).length;
  const pesquisasAtivas = (db.pesquisas || []).filter(p => p.companyId === s.companyId && p.ativo).length;
  const empComCheckinHoje = new Set(checkinsHoje.map(c => c.employeeId)).size;
  sendJson(res, 200, {
    ddsHoje: evHoje.length,
    ddsRealizados: evHoje.filter(ev => db.checkins.some(c => c.eventId === ev.id)).length,
    treinamentosAgendados: db.events.filter(ev => ev.companyId === s.companyId && ev.tipo === 'Treinamento' && ev.data >= hoje).length,
    comunicadosPendentes: comunsPendentes,
    participacaoHoje: empComCheckinHoje,
    participacaoHojePct: emps.length ? Math.round((empComCheckinHoje / emps.length) * 100) : 0,
    obsHoje: obsHoje.length,
    sugsHoje: sugsHoje.length,
    pesquisasAtivas
  });
});

route('GET', /^\/api\/dashboard\/mes$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const agora = new Date();
  const inicioMes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-01`;
  const fimMes = agora.toISOString().slice(0, 10);
  const emps = db.employees.filter(e => e.ativo !== false && e.companyId === s.companyId);
  const empIds = new Set(emps.map(e => e.id));
  const evMes = db.events.filter(ev => ev.companyId === s.companyId && ev.data >= inicioMes && ev.data <= fimMes);
  const checkinsMes = db.checkins.filter(c => empIds.has(c.employeeId) && c.timestamp >= inicioMes);
  const obsMes = db.observations.filter(o => empIds.has(o.employeeId) && o.criadoEm && new Date(o.criadoEm).toISOString() >= inicioMes);
  const sugsMes = db.suggestions.filter(sg => empIds.has(sg.employeeId) && sg.criadaEm && new Date(sg.criadaEm).toISOString() >= inicioMes);
  const participantesUnicos = new Set(checkinsMes.map(c => c.employeeId)).size;
  const taxaAdesao = emps.length ? Math.round((participantesUnicos / emps.length) * 100) : 0;
  const totalHorasTreinamento = evMes.filter(ev => ev.tipo === 'Treinamento').length; // estimativa: 1h por evento
  const totalLeituras = (db.comunicados || []).filter(c => c.companyId === s.companyId).reduce((s, c) => s + (c.leituras || []).filter(l => empIds.has(l.empId)).length, 0);
  const totalEsperadoLeituras = (db.comunicados || []).filter(c => c.companyId === s.companyId).length * emps.length;
  const pctLeituras = totalEsperadoLeituras ? Math.round((totalLeituras / totalEsperadoLeituras) * 100) : 0;
  const iesTotal = emps.reduce((s, e) => s + calcIES(e.id), 0);
  const ieiMedio = emps.length ? Math.round(iesTotal / emps.length) : 0;
  const ics = calcICS(s.companyId);
  sendJson(res, 200, {
    totalDDS: evMes.filter(ev => ev.tipo === 'DDS').length,
    totalTreinamentos: evMes.filter(ev => ev.tipo === 'Treinamento').length,
    totalParticipantes: participantesUnicos,
    horasTreinamento: totalHorasTreinamento,
    taxaAdesao,
    ieiMedio,
    ics: ics.ics,
    icsNota: ics.nota,
    sugsAprovadas: sugsMes.filter(sg => sg.status === 'aprovada').length,
    obsRegistradas: obsMes.length,
    pctLeituras
  });
});

route('GET', /^\/api\/ics$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  sendJson(res, 200, calcICS(s.companyId));
});

/* ── Perfil completo e pontos (gestor) ───────────────────────── */

route('GET', /^\/api\/colaboradores\/(\d+)\/perfil$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const emp = db.employees.find(e => e.id === Number(m[1]) && e.companyId === s.companyId);
  if (!emp) return sendJson(res, 404, { error: 'Colaborador não encontrado.' });
  const pts = employeePoints(emp.id);
  const nivel = getNivel(pts.total);
  const checkins = db.checkins.filter(c => c.employeeId === emp.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 20).map(c => {
    const ev = db.events.find(e => e.id === c.eventId);
    return { id: c.id, eventTema: ev ? ev.tema : '—', eventTipo: ev ? ev.tipo : '—', timestamp: c.timestamp, pontos: c.pontosAtribuidos };
  });
  const obs = db.observations.filter(o => o.employeeId === emp.id).length;
  const sugs = db.suggestions.filter(sg => sg.employeeId === emp.id);
  const extrasLog = (db.pontosExtras || []).filter(pe => pe.empId === emp.id).sort((a, b) => b.timestamp - a.timestamp).slice(0, 30);
  const reconhecidos = (db.reconhecimentos || []).filter(r => r.homenageadoId === emp.id);
  const { senhaSalt, senhaHash, ...empSafe } = emp;
  sendJson(res, 200, {
    colaborador: empSafe,
    pontos: pts.total, porTipo: pts.byType,
    nivel, streakAtual: emp.streakAtual || 0, maiorStreak: emp.maiorStreak || 0,
    checkins, totalObs: obs,
    totalSugs: sugs.length, sugsAprovadas: sugs.filter(sg => sg.status === 'aprovada').length,
    extrasLog, reconhecimentos: reconhecidos
  });
});

route('POST', /^\/api\/colaboradores\/(\d+)\/pontos$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const emp = db.employees.find(e => e.id === Number(m[1]) && e.companyId === s.companyId);
  if (!emp) return sendJson(res, 404, { error: 'Colaborador não encontrado.' });
  const pontos = Number(body.pontos);
  if (!pontos || isNaN(pontos)) return sendJson(res, 400, { error: 'Valor de pontos inválido.' });
  const motivo = String(body.motivo || '').trim() || (pontos > 0 ? 'Pontos adicionados pelo gestor' : 'Pontos removidos pelo gestor');
  const mgr = db.managers.find(mg => mg.id === s.userId);
  db.pontosExtras.push({ id: nextId(), empId: emp.id, companyId: s.companyId, tipo: 'gestor', descricao: `${pontos > 0 ? '➕' : '➖'} ${motivo}`, pontos, timestamp: Date.now() });
  logAudit(s.userId, 'gestor', pontos > 0 ? 'adicionar_pontos' : 'remover_pontos', `${motivo} (${pontos > 0 ? '+' : ''}${pontos} pts) → ${emp.nome}`, s.companyId);
  saveDb();
  const novoTotal = employeePoints(emp.id).total;
  sendJson(res, 200, { ok: true, novoTotal });
});

/* ── Campanhas ───────────────────────────────────────────────── */

route('GET', /^\/api\/campanhas$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  sendJson(res, 200, (db.campanhas || []).filter(c => c.companyId === s.companyId).sort((a, b) => b.criadoEm - a.criadoEm));
});

route('POST', /^\/api\/campanhas$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const nome = String(body.nome || '').trim();
  if (!nome) return sendJson(res, 400, { error: 'Nome obrigatório.' });
  const campanha = { id: nextId(), companyId: s.companyId, nome, tipo: body.tipo || 'participacao', inicio: body.inicio || todayStr(), fim: body.fim || '', meta: Number(body.meta) || 0, pontosBonus: Number(body.pontosBonus) || 0, descricao: String(body.descricao || ''), ativo: true, criadoEm: Date.now() };
  db.campanhas.push(campanha);
  saveDb();
  sendJson(res, 201, campanha);
});

route('PUT', /^\/api\/campanhas\/(\d+)$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const c = (db.campanhas || []).find(x => x.id === Number(m[1]) && x.companyId === s.companyId);
  if (!c) return sendJson(res, 404, { error: 'Campanha não encontrada.' });
  Object.assign(c, { nome: body.nome || c.nome, tipo: body.tipo || c.tipo, inicio: body.inicio || c.inicio, fim: body.fim !== undefined ? body.fim : c.fim, meta: body.meta !== undefined ? Number(body.meta) : c.meta, pontosBonus: body.pontosBonus !== undefined ? Number(body.pontosBonus) : c.pontosBonus, descricao: body.descricao !== undefined ? body.descricao : c.descricao, ativo: body.ativo !== undefined ? !!body.ativo : c.ativo });
  saveDb();
  sendJson(res, 200, c);
});

route('DELETE', /^\/api\/campanhas\/(\d+)$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const idx = (db.campanhas || []).findIndex(x => x.id === Number(m[1]) && x.companyId === s.companyId);
  if (idx < 0) return sendJson(res, 404, { error: 'Campanha não encontrada.' });
  db.campanhas.splice(idx, 1);
  saveDb();
  sendJson(res, 200, { ok: true });
});

/* ── Desafios da Semana ──────────────────────────────────────── */

route('GET', /^\/api\/desafios$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const lista = (db.desafios || []).filter(d => d.companyId === s.companyId).sort((a, b) => b.criadoEm - a.criadoEm);
  sendJson(res, 200, lista);
});

route('POST', /^\/api\/desafios$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const nome = String(body.nome || '').trim();
  if (!nome) return sendJson(res, 400, { error: 'Nome obrigatório.' });
  const hoje = todayStr();
  const d = { id: nextId(), companyId: s.companyId, nome, descricao: String(body.descricao || ''), tipo: body.tipo || 'checkin', metaValor: Number(body.metaValor) || 1, pontosRecompensa: Number(body.pontosRecompensa) || 50, semanaInicio: body.semanaInicio || hoje, semanaFim: body.semanaFim || hoje, criadoEm: Date.now() };
  db.desafios.push(d);
  saveDb();
  sendJson(res, 201, d);
});

route('GET', /^\/api\/desafios\/(\d+)\/progresso$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const desafio = (db.desafios || []).find(d => d.id === Number(m[1]) && d.companyId === s.companyId);
  if (!desafio) return sendJson(res, 404, { error: 'Desafio não encontrado.' });
  const emps = db.employees.filter(e => e.ativo !== false && e.companyId === s.companyId);
  const empIds = new Set(emps.map(e => e.id));
  const { semanaInicio, semanaFim, tipo, metaValor } = desafio;
  const progresso = emps.map(emp => {
    let valor = 0;
    if (tipo === 'checkin') {
      valor = db.checkins.filter(c => c.employeeId === emp.id && c.timestamp >= semanaInicio && c.timestamp <= semanaFim + 'T23:59:59').length;
    } else if (tipo === 'observacoes') {
      valor = db.observations.filter(o => o.employeeId === emp.id && o.criadoEm && new Date(o.criadoEm).toISOString() >= semanaInicio).length;
    } else if (tipo === 'sugestoes') {
      valor = db.suggestions.filter(sg => sg.employeeId === emp.id && sg.criadaEm && new Date(sg.criadaEm).toISOString() >= semanaInicio).length;
    } else if (tipo === 'quiz') {
      valor = (db.quizzes || []).filter(q => q.companyId === s.companyId && q.data >= semanaInicio && (q.respostas || []).some(r => r.empId === emp.id)).length;
    } else if (tipo === 'feed') {
      valor = (db.feed || []).filter(f => f.autorId === emp.id && f.companyId === s.companyId && new Date(f.timestamp).toISOString() >= semanaInicio).length;
    }
    return { id: emp.id, nome: emp.nome, equipe: emp.equipe || '', valor, meta: metaValor, concluido: valor >= metaValor };
  });
  sendJson(res, 200, { desafio, progresso, concluidos: progresso.filter(p => p.concluido).length });
});

/* ── Reconhecimentos Públicos ────────────────────────────────── */

route('GET', /^\/api\/reconhecimentos$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  sendJson(res, 200, (db.reconhecimentos || []).filter(r => r.companyId === s.companyId).sort((a, b) => b.timestamp - a.timestamp).slice(0, 50));
});

route('POST', /^\/api\/reconhecimentos$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const emp = db.employees.find(e => e.id === Number(body.homenageadoId) && e.companyId === s.companyId);
  if (!emp) return sendJson(res, 400, { error: 'Colaborador não encontrado.' });
  const mgr = db.managers.find(mg => mg.id === s.userId);
  const BADGES = { destaque_mes: '🏆 Destaque do Mês', heroi_seguranca: '🛡 Herói da Segurança', inovador: '💡 Inovador', persistencia: '💪 Persistência' };
  const badgeLabel = BADGES[body.tipoBadge] || '🌟 Reconhecimento';
  const rec = { id: nextId(), companyId: s.companyId, gestorId: s.userId, gestorNome: mgr ? mgr.name : 'Gestor SST', homenageadoId: emp.id, homenageadoNome: emp.nome, tipoBadge: body.tipoBadge || 'destaque_mes', badgeLabel, mensagem: String(body.mensagem || '').trim(), timestamp: Date.now() };
  db.reconhecimentos.push(rec);
  db.feed.push({ id: nextId(), companyId: s.companyId, autorId: s.userId, autorRole: 'gestor', autorNome: mgr ? mgr.name : 'Gestor SST', autorFuncao: 'Gestor SST', tipo: 'reconhecimento', conteudo: `${badgeLabel}\n\n🎉 ${emp.nome} recebe este reconhecimento!\n\n${rec.mensagem}`, timestamp: Date.now(), reacoes: { like: [], aplausos: [], estrela: [] }, comentarios: [] });
  saveDb();
  sendJson(res, 201, rec);
});

/* ── Batalha de Equipes ──────────────────────────────────────── */

route('GET', /^\/api\/batalha-equipes$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  sendJson(res, 200, calcBatalhaEquipes(s.companyId));
});

/* ── Hall of Champions ───────────────────────────────────────── */

route('GET', /^\/api\/hall-of-champions$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const ranking = buildRanking(s.companyId);
  const equipes = calcBatalhaEquipes(s.companyId);
  const emps = db.employees.filter(e => e.ativo !== false && e.companyId === s.companyId);
  const nivelDist = {};
  for (let i = 1; i <= 10; i++) nivelDist[i] = 0;
  for (const emp of emps) {
    const pts = employeePoints(emp.id);
    const nivel = getNivel(pts.total);
    nivelDist[nivel.nivel] = (nivelDist[nivel.nivel] || 0) + 1;
  }
  sendJson(res, 200, { top10: ranking.slice(0, 10), top10Equipes: equipes.slice(0, 10), nivelDist });
});

/* ── Pesquisas ───────────────────────────────────────────────── */

route('GET', /^\/api\/pesquisas$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const lista = (db.pesquisas || []).filter(p => p.companyId === s.companyId).sort((a, b) => b.criadoEm - a.criadoEm).map(p => ({
    ...p, totalRespostas: (db.respostasPesquisa || []).filter(r => r.pesquisaId === p.id).length
  }));
  sendJson(res, 200, lista);
});

route('POST', /^\/api\/pesquisas$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const titulo = String(body.titulo || '').trim();
  if (!titulo) return sendJson(res, 400, { error: 'Título obrigatório.' });
  if (!Array.isArray(body.perguntas) || !body.perguntas.length) return sendJson(res, 400, { error: 'Adicione ao menos uma pergunta.' });
  const pesquisa = { id: nextId(), companyId: s.companyId, titulo, descricao: String(body.descricao || ''), perguntas: body.perguntas.map((p, i) => ({ id: i + 1, texto: String(p.texto || ''), tipo: p.tipo || 'escala' })), ativo: true, criadoEm: Date.now(), encerradaEm: null };
  db.pesquisas.push(pesquisa);
  saveDb();
  sendJson(res, 201, pesquisa);
});

route('PUT', /^\/api\/pesquisas\/(\d+)$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const p = (db.pesquisas || []).find(x => x.id === Number(m[1]) && x.companyId === s.companyId);
  if (!p) return sendJson(res, 404, { error: 'Pesquisa não encontrada.' });
  if (body.ativo === false) { p.ativo = false; p.encerradaEm = Date.now(); }
  if (body.titulo) p.titulo = body.titulo;
  saveDb();
  sendJson(res, 200, p);
});

route('GET', /^\/api\/pesquisas\/(\d+)\/resultados$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const pesquisa = (db.pesquisas || []).find(p => p.id === Number(m[1]) && p.companyId === s.companyId);
  if (!pesquisa) return sendJson(res, 404, { error: 'Pesquisa não encontrada.' });
  const respostas = (db.respostasPesquisa || []).filter(r => r.pesquisaId === pesquisa.id);
  const resultados = pesquisa.perguntas.map(perg => {
    const vals = respostas.map(r => (r.respostas || []).find(a => a.perguntaId === perg.id)?.valor).filter(v => v !== undefined && v !== null && v !== '');
    if (perg.tipo === 'escala') {
      const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      vals.forEach(v => { const n = Number(v); if (n >= 1 && n <= 5) dist[n]++; });
      const media = vals.length ? (vals.reduce((a, b) => a + Number(b), 0) / vals.length).toFixed(1) : null;
      return { ...perg, respostas: vals.length, media, distribuicao: dist };
    } else if (perg.tipo === 'sim_nao') {
      const sim = vals.filter(v => v === 'sim').length;
      const nao = vals.filter(v => v === 'nao').length;
      return { ...perg, respostas: vals.length, sim, nao };
    } else {
      return { ...perg, respostas: vals.length, textos: vals.slice(-10) };
    }
  });
  sendJson(res, 200, { pesquisa, totalRespostas: respostas.length, resultados });
});

route('GET', /^\/api\/pesquisas\/ativas$/, { role: 'colaborador' }, async (req, res, m, body, s) => {
  const ativas = (db.pesquisas || []).filter(p => p.companyId === s.companyId && p.ativo);
  const naoRespondidas = ativas.filter(p => !(db.respostasPesquisa || []).some(r => r.pesquisaId === p.id && r.empId === s.employeeId));
  sendJson(res, 200, naoRespondidas.map(p => ({ id: p.id, titulo: p.titulo, descricao: p.descricao, totalPerguntas: p.perguntas.length, perguntas: p.perguntas })));
});

route('POST', /^\/api\/pesquisas\/(\d+)\/responder$/, { role: 'colaborador' }, async (req, res, m, body, s) => {
  const pesquisa = (db.pesquisas || []).find(p => p.id === Number(m[1]) && p.companyId === s.companyId && p.ativo);
  if (!pesquisa) return sendJson(res, 404, { error: 'Pesquisa não encontrada.' });
  if ((db.respostasPesquisa || []).some(r => r.pesquisaId === pesquisa.id && r.empId === s.employeeId)) return sendJson(res, 200, { ok: true, jaRespondeu: true });
  if (!Array.isArray(body.respostas)) return sendJson(res, 400, { error: 'Respostas obrigatórias.' });
  const resp = { id: nextId(), pesquisaId: pesquisa.id, empId: s.employeeId, companyId: s.companyId, respostas: body.respostas, timestamp: Date.now() };
  db.respostasPesquisa.push(resp);
  db.pontosExtras.push({ id: nextId(), empId: s.employeeId, companyId: s.companyId, tipo: 'pesquisa', descricao: `📋 Respondeu pesquisa: ${pesquisa.titulo}`, pontos: 15, timestamp: Date.now() });
  saveDb();
  sendJson(res, 201, { ok: true, pontos: 15 });
});

/* ── Evidências ──────────────────────────────────────────────── */

route('GET', /^\/api\/evidencias\/(\d+)$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const ev = db.events.find(e => e.id === Number(m[1]) && e.companyId === s.companyId);
  if (!ev) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Evento não encontrado.'); }
  const evCheckins = db.checkins.filter(c => c.eventId === ev.id);
  const linhas = evCheckins.map(c => {
    const emp = db.employees.find(e => e.id === c.employeeId);
    if (!emp) return '';
    const hora = c.timestamp ? new Date(c.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
    return `<tr><td>${emp.nome || ''}</td><td>${emp.cpf || ''}</td><td>${emp.matricula || ''}</td><td>${emp.funcao || ''}</td><td>${emp.equipe || ''}</td><td>${hora}</td><td style="width:160px;border-bottom:1px solid #000">&nbsp;</td></tr>`;
  }).join('');
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Lista de Presença — ${ev.tema || ''}</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;padding:24px;color:#000} h1{font-size:16px;margin-bottom:4px} .info{margin-bottom:16px;line-height:1.6} table{width:100%;border-collapse:collapse;margin-top:8px} th{background:#f0f0f0;border:1px solid #999;padding:6px 8px;text-align:left} td{border:1px solid #ccc;padding:6px 8px} .rodape{margin-top:32px;display:flex;gap:60px} .assinatura{flex:1;text-align:center;padding-top:40px;border-top:1px solid #000;font-size:11px} @media print{button{display:none!important}}</style>
</head><body>
<h1>Lista de Presença — ${ev.tema || ''}</h1>
<div class="info"><strong>Tipo:</strong> ${ev.tipo || ''} &nbsp;&nbsp; <strong>Data:</strong> ${ev.data || ''} &nbsp;&nbsp; <strong>Local:</strong> ${ev.local || '—'} &nbsp;&nbsp; <strong>Responsável:</strong> ${ev.responsavel || '—'}<br><strong>Total de participantes:</strong> ${evCheckins.length}</div>
<button onclick="window.print()" style="margin-bottom:12px;padding:8px 18px;background:#1e5aa8;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">🖨 Imprimir / Salvar PDF</button>
<table><thead><tr><th>Nome</th><th>CPF</th><th>Matrícula</th><th>Função</th><th>Equipe</th><th>Check-in</th><th>Assinatura</th></tr></thead><tbody>${linhas || '<tr><td colspan="7" style="text-align:center;color:#999">Nenhum check-in registrado.</td></tr>'}</tbody></table>
<div class="rodape"><div class="assinatura">Responsável pelo evento</div><div class="assinatura">Gestor SST</div></div>
</body></html>`;
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

/* ── Painel do colaborador ───────────────────────────────────── */

route('GET', /^\/api\/meu-painel$/, { role: 'colaborador' }, async (req, res, m, body, s) => {
  const emp = db.employees.find(e => e.id === s.employeeId);
  if (!emp) return sendJson(res, 404, { error: 'Colaborador não encontrado.' });
  const pts = employeePoints(emp.id);
  // verificar subida de nível (ANTES de usar pts.total, pois processarNivel pode adicionar bônus)
  const subiu = processarNivel(emp, pts.total);
  if (subiu) { pts.total = employeePoints(emp.id).total; saveDb(); }
  const nivel = getNivel(pts.total);
  const ranking = buildRanking(emp.companyId);
  const minha = ranking.find(r => r.id === emp.id);
  const myCheckins = db.checkins.filter(c => c.employeeId === emp.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const historico = myCheckins.slice(0, 30).map(c => {
    const ev = db.events.find(e => e.id === c.eventId);
    return { id: c.id, timestamp: c.timestamp, tipo: ev ? ev.tipo : '?', tema: ev ? ev.tema : '', pontos: c.pontosAtribuidos, avaliado: c.avaliado };
  });
  const ies = calcIES(emp.id);
  const conquista = getAchievement(pts.total);
  const minhaObs = db.observations.filter(o => o.employeeId === emp.id).length;
  const minhasSugs = db.suggestions.filter(s => s.employeeId === emp.id);
  const checkinPendente = db.checkins.find(c => c.employeeId === emp.id && !c.avaliado);
  // missões do dia
  const hoje = todayStr();
  const fezCheckinHoje = db.checkins.some(c => c.employeeId === emp.id && c.timestamp && c.timestamp.startsWith(hoje));
  const leuComunicadoHoje = (db.comunicados || []).some(cm => cm.leituras && cm.leituras.some(l => l.empId === emp.id && l.data === hoje));
  const respondeuQuizHoje = (db.quizzes || []).some(q => q.data === hoje && q.respostas && q.respostas.some(r => r.empId === emp.id));
  const postouFeedHoje = (db.feed || []).some(f => f.autorId === emp.id && f.timestamp && new Date(f.timestamp).toISOString().startsWith(hoje));
  const registrouObsHoje = db.observations.some(o => o.employeeId === emp.id && o.criadoEm && new Date(o.criadoEm).toISOString().startsWith(hoje));
  const missoes = [
    { id:'checkin',     desc:'Participar de uma atividade SST',     pontos:50,  feita: fezCheckinHoje },
    { id:'comunicado',  desc:'Ler um comunicado oficial',            pontos:10,  feita: leuComunicadoHoje },
    { id:'quiz',        desc:'Responder o quiz diário de segurança', pontos:20,  feita: respondeuQuizHoje },
    { id:'feed',        desc:'Publicar no Mural de Segurança',       pontos:10,  feita: postouFeedHoje },
    { id:'observacao',  desc:'Registrar uma observação de campo',    pontos:25,  feita: registrouObsHoje }
  ];
  sendJson(res, 200, {
    colaborador: { matricula: emp.matricula, nome: emp.nome, setor: emp.setor, funcao: emp.funcao, equipe: emp.equipe, unidade: emp.unidade, empresa: emp.empresa, roles: emp.roles || [] },
    pontos: pts.total, porTipo: pts.byType,
    posicao: minha ? minha.posicao : null,
    totalColaboradores: ranking.length,
    conquista, nivel, ies,
    streakAtual: emp.streakAtual || 0,
    maiorStreak: emp.maiorStreak || 0,
    historico,
    top10: ranking.slice(0, 10),
    totalObs: minhaObs, totalDDS: myCheckins.length,
    totalSugs: minhasSugs.length,
    sugsAprovadas: minhasSugs.filter(s => s.status === 'aprovada').length,
    checkinPendente: checkinPendente ? { checkinId: checkinPendente.id } : null,
    missoes, subiu: subiu ? nivel : null
  });
});

/* ── Feed / Mural Social ─────────────────────────────────────── */

route('GET', /^\/api\/feed$/, { role: 'any' }, async (req, res, m, body, s) => {
  const uid = s.employeeId || s.userId;
  const posts = (db.feed || [])
    .filter(f => f.companyId === s.companyId)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 50)
    .map(f => {
      const r = f.reacoes || {};
      return {
        ...f,
        reacoes: undefined, // strip raw arrays
        comentarios: undefined, // strip raw comments
        minhasReacoes: {
          like:       (r.like       || []).includes(uid),
          aplausos:   (r.aplausos   || []).includes(uid),
          estrela:    (r.estrela    || []).includes(uid),
          seguranca:  (r.seguranca  || []).includes(uid),
          inspirador: (r.inspirador || []).includes(uid),
        },
        totalLikes:      (r.like       || []).length,
        totalAplausos:   (r.aplausos   || []).length,
        totalEstrelas:   (r.estrela    || []).length,
        totalSeguranca:  (r.seguranca  || []).length,
        totalInspirador: (r.inspirador || []).length,
        totalComentarios: (f.comentarios || []).length,
        ultimosComentarios: (f.comentarios || []).slice(-2).map(c => ({
          autorNome: c.autorNome, texto: c.texto, timestamp: c.timestamp
        })),
      };
    });
  sendJson(res, 200, posts);
});

route('POST', /^\/api\/feed$/, { role: 'any' }, async (req, res, m, body, s) => {
  const conteudo = String(body.conteudo || '').trim();
  if (!conteudo) return sendJson(res, 400, { error: 'Conteúdo obrigatório.' });
  const emp = s.role === 'colaborador' ? db.employees.find(e => e.id === s.employeeId) : null;
  const mgr = s.role === 'gestor' ? db.managers.find(mg => mg.id === s.userId) : null;
  const post = {
    id: nextId(), companyId: s.companyId,
    autorId: s.employeeId || s.userId,
    autorRole: s.role,
    autorNome: emp ? emp.nome : (mgr ? mgr.name : 'Gestor SST'),
    autorFuncao: emp ? (emp.funcao || '') : 'Gestor SST',
    tipo: body.tipo || 'post',
    conteudo, timestamp: Date.now(),
    reacoes: { like: [], aplausos: [], estrela: [] }, comentarios: []
  };
  db.feed.push(post);
  // pontos por publicar no feed (1x por dia)
  if (s.role === 'colaborador' && emp) {
    const hoje = todayStr();
    const jaPostouHoje = db.feed.filter(f => f.autorId === emp.id && f.tipo === 'post' && f.id !== post.id && new Date(f.timestamp).toISOString().startsWith(hoje)).length > 0;
    if (!jaPostouHoje) {
      db.pontosExtras.push({ id: nextId(), empId: emp.id, companyId: emp.companyId, tipo: 'feed', descricao: '📣 Publicou no Mural', pontos: 10, timestamp: Date.now() });
    }
  }
  saveDb();
  sendJson(res, 201, post);
});

route('POST', /^\/api\/feed\/(\d+)\/reagir$/, { role: 'any' }, async (req, res, m, body, s) => {
  const post = (db.feed || []).find(f => f.id === Number(m[1]) && f.companyId === s.companyId);
  if (!post) return sendJson(res, 404, { error: 'Post não encontrado.' });
  if (!post.reacoes) post.reacoes = { like: [], aplausos: [], estrela: [] };
  const tipo = body.tipo || 'like';
  if (!post.reacoes[tipo]) post.reacoes[tipo] = [];
  const uid = s.employeeId || s.userId;
  const idx = post.reacoes[tipo].indexOf(uid);
  if (idx >= 0) post.reacoes[tipo].splice(idx, 1); // toggle off
  else post.reacoes[tipo].push(uid);
  saveDb();
  sendJson(res, 200, { ok: true, total: post.reacoes[tipo].length });
});

route('POST', /^\/api\/feed\/(\d+)\/comentar$/, { role: 'any' }, async (req, res, m, body, s) => {
  const post = (db.feed || []).find(f => f.id === Number(m[1]) && f.companyId === s.companyId);
  if (!post) return sendJson(res, 404, { error: 'Post não encontrado.' });
  const texto = String(body.texto || '').trim();
  if (!texto) return sendJson(res, 400, { error: 'Comentário não pode ser vazio.' });
  const uid = s.employeeId || s.userId;
  const emp = db.employees.find(e => e.id === uid);
  const mgr = db.managers.find(m2 => m2.id === uid);
  const autorNome = emp ? emp.nome : (mgr ? mgr.name : 'Usuário');
  if (!post.comentarios) post.comentarios = [];
  const comentario = { id: nextId(), autorId: uid, autorNome, texto, timestamp: Date.now() };
  post.comentarios.push(comentario);
  saveDb();
  sendJson(res, 201, comentario);
});

route('GET', /^\/api\/feed\/(\d+)\/comentarios$/, { role: 'any' }, async (req, res, m, body, s) => {
  const post = (db.feed || []).find(f => f.id === Number(m[1]) && f.companyId === s.companyId);
  if (!post) return sendJson(res, 404, { error: 'Post não encontrado.' });
  sendJson(res, 200, post.comentarios || []);
});

route('DELETE', /^\/api\/feed\/(\d+)$/, { role: 'any' }, async (req, res, m, body, s) => {
  const idx = (db.feed || []).findIndex(f => f.id === Number(m[1]) && f.companyId === s.companyId);
  if (idx < 0) return sendJson(res, 404, { error: 'Post não encontrado.' });
  const post = db.feed[idx];
  if (post.autorId !== (s.employeeId || s.userId) && s.role !== 'gestor') return sendJson(res, 403, { error: 'Sem permissão.' });
  db.feed.splice(idx, 1);
  saveDb();
  sendJson(res, 200, { ok: true });
});

/* ── Comunicados Oficiais ────────────────────────────────────── */

route('GET', /^\/api\/comunicados$/, { role: 'any' }, async (req, res, m, body, s) => {
  const list = (db.comunicados || [])
    .filter(c => c.companyId === s.companyId)
    .sort((a, b) => b.criadoEm - a.criadoEm)
    .map(c => ({
      ...c,
      lido: s.role === 'colaborador' && (c.leituras || []).some(l => l.empId === s.employeeId),
      totalLeituras: (c.leituras || []).length
    }));
  sendJson(res, 200, list);
});

route('POST', /^\/api\/comunicados$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const titulo  = String(body.titulo || '').trim();
  const conteudo = String(body.conteudo || '').trim();
  if (!titulo || !conteudo) return sendJson(res, 400, { error: 'Título e conteúdo obrigatórios.' });
  const mgr = db.managers.find(mg => mg.id === s.userId);
  const com = {
    id: nextId(), companyId: s.companyId,
    gestorNome: mgr ? mgr.name : 'Gestor SST',
    titulo, conteudo,
    pontosPorLeitura: Number(body.pontosPorLeitura) || 10,
    criadoEm: Date.now(), leituras: []
  };
  db.comunicados.push(com);
  // Post automático no feed
  db.feed.push({ id: nextId(), companyId: s.companyId, autorId: s.userId, autorRole: 'gestor', autorNome: mgr ? mgr.name : 'Gestor SST', autorFuncao: 'Gestor SST', tipo: 'comunicado', conteudo: `📢 COMUNICADO: ${titulo}\n\nAcesse a aba Comunicados para ler e confirmar sua leitura.`, comunicadoId: com.id, timestamp: Date.now(), reacoes: { like: [], aplausos: [], estrela: [] }, comentarios: [] });
  saveDb();
  sendJson(res, 201, com);
});

route('POST', /^\/api\/comunicados\/(\d+)\/confirmar$/, { role: 'colaborador' }, async (req, res, m, body, s) => {
  const com = (db.comunicados || []).find(c => c.id === Number(m[1]) && c.companyId === s.companyId);
  if (!com) return sendJson(res, 404, { error: 'Comunicado não encontrado.' });
  if ((com.leituras || []).some(l => l.empId === s.employeeId)) return sendJson(res, 200, { ok: true, jaLido: true });
  if (!com.leituras) com.leituras = [];
  com.leituras.push({ empId: s.employeeId, data: todayStr(), timestamp: Date.now() });
  if (com.pontosPorLeitura > 0) {
    db.pontosExtras.push({ id: nextId(), empId: s.employeeId, companyId: s.companyId, tipo: 'comunicado', descricao: `📢 Leu comunicado: ${com.titulo}`, pontos: com.pontosPorLeitura, timestamp: Date.now() });
  }
  saveDb();
  sendJson(res, 200, { ok: true, pontos: com.pontosPorLeitura });
});

/* ── Quiz Diário ─────────────────────────────────────────────── */

route('GET', /^\/api\/quiz\/hoje$/, { role: 'any' }, async (req, res, m, body, s) => {
  const hoje = todayStr();
  const quiz = (db.quizzes || []).find(q => q.companyId === s.companyId && q.data === hoje);
  if (!quiz) return sendJson(res, 200, { quiz: null });
  const jaNovRes = s.role === 'colaborador' && (quiz.respostas || []).some(r => r.empId === s.employeeId);
  sendJson(res, 200, { quiz: { ...quiz, jaRespondeu: jaNovRes, respostas: undefined } });
});

route('POST', /^\/api\/quiz\/(\d+)\/responder$/, { role: 'colaborador' }, async (req, res, m, body, s) => {
  const quiz = (db.quizzes || []).find(q => q.id === Number(m[1]) && q.companyId === s.companyId);
  if (!quiz) return sendJson(res, 404, { error: 'Quiz não encontrado.' });
  if ((quiz.respostas || []).some(r => r.empId === s.employeeId)) return sendJson(res, 200, { ok: true, jaRespondeu: true });
  if (!quiz.respostas) quiz.respostas = [];
  const opcaoIdx = Number(body.opcao);
  const correta = quiz.opcoes[opcaoIdx]?.correta === true;
  quiz.respostas.push({ empId: s.employeeId, opcao: opcaoIdx, correta, timestamp: Date.now() });
  const pontos = correta ? (quiz.pontosPorAcerto || 20) : (quiz.pontosPorTentativa || 5);
  db.pontosExtras.push({ id: nextId(), empId: s.employeeId, companyId: s.companyId, tipo: 'quiz', descricao: correta ? '✅ Quiz diário — acerto!' : '📝 Quiz diário — participação', pontos, timestamp: Date.now() });
  saveDb();
  sendJson(res, 200, { ok: true, correta, pontos, respostaCorreta: quiz.opcoes.findIndex(o => o.correta) });
});

route('POST', /^\/api\/quiz$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const pergunta = String(body.pergunta || '').trim();
  if (!pergunta) return sendJson(res, 400, { error: 'Pergunta obrigatória.' });
  if (!Array.isArray(body.opcoes) || body.opcoes.length < 2) return sendJson(res, 400, { error: 'Mínimo 2 opções.' });
  const hoje = todayStr();
  const existente = (db.quizzes || []).find(q => q.companyId === s.companyId && q.data === hoje);
  if (existente) return sendJson(res, 409, { error: 'Já existe um quiz para hoje.' });
  const quiz = {
    id: nextId(), companyId: s.companyId,
    pergunta, opcoes: body.opcoes,
    pontosPorAcerto: Number(body.pontosPorAcerto) || 20,
    pontosPorTentativa: Number(body.pontosPorTentativa) || 5,
    data: hoje, respostas: []
  };
  db.quizzes.push(quiz);
  saveDb();
  sendJson(res, 201, quiz);
});

route('GET', /^\/api\/quiz$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const list = (db.quizzes || []).filter(q => q.companyId === s.companyId).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 30).map(q => ({ ...q, totalRespostas: (q.respostas || []).length, acertos: (q.respostas || []).filter(r => r.correta).length }));
  sendJson(res, 200, list);
});

/* ── SafePoint 2.3 — Banco de Questões ─────────────────────── */

route('GET', /^\/api\/questoes$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const url2 = new URL('http://x' + req.url);
  const cat = url2.searchParams.get('categoria') || '';
  const dif = url2.searchParams.get('dificuldade') || '';
  let list = (db.questoes || []).filter(q => q.companyId === s.companyId);
  if (cat) list = list.filter(q => q.categoria === cat);
  if (dif) list = list.filter(q => q.dificuldade === dif);
  sendJson(res, 200, list.sort((a, b) => b.criadoEm - a.criadoEm));
});

route('POST', /^\/api\/questoes$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  if (!String(body.texto || '').trim()) return sendJson(res, 400, { error: 'Texto da questão é obrigatório.' });
  if (!Array.isArray(body.opcoes) || body.opcoes.length < 2) return sendJson(res, 400, { error: 'Mínimo 2 opções.' });
  if (!body.opcoes.some(o => o.correta)) return sendJson(res, 400, { error: 'Marque a resposta correta.' });
  const q = {
    id: nextId(), companyId: s.companyId,
    texto: String(body.texto).trim(),
    tipo: body.tipo === 'verdadeiro_falso' ? 'verdadeiro_falso' : 'multipla_escolha',
    opcoes: body.opcoes.map((o, i) => ({ id: i, texto: String(o.texto || '').trim(), correta: !!o.correta })),
    categoria: QUIZ_CATEGORIAS.includes(body.categoria) ? body.categoria : 'Procedimentos Gerais',
    tema: String(body.tema || '').trim(),
    dificuldade: ['facil','medio','dificil'].includes(body.dificuldade) ? body.dificuldade : 'medio',
    stats: { total: 0, acertos: 0 }, criadoEm: Date.now()
  };
  if (!db.questoes) db.questoes = [];
  db.questoes.push(q);
  saveDb();
  sendJson(res, 201, q);
});

route('PUT', /^\/api\/questoes\/(\d+)$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const q = (db.questoes || []).find(x => x.id === Number(m[1]) && x.companyId === s.companyId);
  if (!q) return sendJson(res, 404, { error: 'Questão não encontrada.' });
  if (body.texto) q.texto = String(body.texto).trim();
  if (body.opcoes) q.opcoes = body.opcoes.map((o, i) => ({ id: i, texto: String(o.texto||'').trim(), correta: !!o.correta }));
  if (body.categoria && QUIZ_CATEGORIAS.includes(body.categoria)) q.categoria = body.categoria;
  if (body.dificuldade && ['facil','medio','dificil'].includes(body.dificuldade)) q.dificuldade = body.dificuldade;
  if (body.tema !== undefined) q.tema = String(body.tema).trim();
  saveDb();
  sendJson(res, 200, q);
});

route('DELETE', /^\/api\/questoes\/(\d+)$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const idx = (db.questoes || []).findIndex(x => x.id === Number(m[1]) && x.companyId === s.companyId);
  if (idx === -1) return sendJson(res, 404, { error: 'Questão não encontrada.' });
  db.questoes.splice(idx, 1);
  saveDb();
  sendJson(res, 200, { ok: true });
});

/* ── SafePoint 2.3 — DDS Battle (Quiz Ao Vivo) ──────────────── */

route('POST', /^\/api\/battle\/sessoes$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  if (!String(body.titulo || '').trim()) return sendJson(res, 400, { error: 'Título obrigatório.' });
  if (!Array.isArray(body.questoesIds) || !body.questoesIds.length) return sendJson(res, 400, { error: 'Selecione ao menos 1 questão.' });
  const questoesIds = body.questoesIds.map(Number).filter(id => (db.questoes || []).some(q => q.id === id && q.companyId === s.companyId));
  if (!questoesIds.length) return sendJson(res, 400, { error: 'Questões inválidas.' });
  const session = {
    id: nextId(), companyId: s.companyId,
    titulo: String(body.titulo).trim(), codigo: generateCode(),
    questoes: questoesIds, tempoPorQuestao: Number(body.tempoPorQuestao) || 30,
    status: 'aguardando', participantes: [], questaoAtual: 0,
    questaoIniciadaEm: null, mostrandoResultado: false, ultimoResultado: null,
    criadoEm: Date.now(), criadoPor: s.userId
  };
  if (!db.battleSessions) db.battleSessions = [];
  db.battleSessions.push(session);
  saveDb();
  sendJson(res, 201, { id: session.id, codigo: session.codigo, titulo: session.titulo });
});

route('GET', /^\/api\/battle\/sessoes$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const list = (db.battleSessions || []).filter(x => x.companyId === s.companyId)
    .sort((a, b) => b.criadoEm - a.criadoEm).slice(0, 30)
    .map(x => ({ id: x.id, titulo: x.titulo, codigo: x.codigo, status: x.status,
      participantes: x.participantes.length, questoes: x.questoes.length, criadoEm: x.criadoEm }));
  sendJson(res, 200, list);
});

route('GET', /^\/api\/battle\/sessoes\/(\d+)$/, { role: 'any' }, async (req, res, m, body, s) => {
  const session = (db.battleSessions || []).find(x => x.id === Number(m[1]) && x.companyId === s.companyId);
  if (!session) return sendJson(res, 404, { error: 'Sessão não encontrada.' });
  if (s.role === 'gestor') {
    const qi = session.questaoAtual;
    const q = (db.questoes || []).find(x => x.id === session.questoes[qi]);
    const respostasQ = session.participantes.map(p => {
      const r = (p.respostas || []).find(r => r.questaoIdx === qi);
      return r ? { empId: p.empId, nome: p.nome, correta: r.correta, tempo: r.tempo } : null;
    }).filter(Boolean);
    return sendJson(res, 200, { ...session, questaoAtualObj: q || null, respostasQuestaoAtual: respostasQ,
      ranking: battleRanking(session),
      taxaAcerto: respostasQ.length ? Math.round((respostasQ.filter(r => r.correta).length / respostasQ.length) * 100) : null });
  }
  sendJson(res, 200, battleEstado(session, s.employeeId));
});

route('POST', /^\/api\/battle\/entrar$/, { role: 'colaborador' }, async (req, res, m, body, s) => {
  const codigo = String(body.codigo || '').trim().toUpperCase();
  const session = (db.battleSessions || []).find(x => x.codigo === codigo && x.companyId === s.companyId && ['aguardando','ativa'].includes(x.status));
  if (!session) return sendJson(res, 404, { error: 'Código inválido ou sessão encerrada.' });
  const emp = db.employees.find(e => e.id === s.employeeId);
  if (!emp) return sendJson(res, 404, { error: 'Colaborador não encontrado.' });
  if (!session.participantes.find(p => p.empId === emp.id)) {
    session.participantes.push({ empId: emp.id, nome: emp.nome, pontos: 0, acertos: 0, respostas: [] });
    saveDb();
  }
  sendJson(res, 200, { ok: true, sessaoId: session.id, titulo: session.titulo, status: session.status });
});

route('POST', /^\/api\/battle\/sessoes\/(\d+)\/iniciar$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const session = (db.battleSessions || []).find(x => x.id === Number(m[1]) && x.companyId === s.companyId);
  if (!session) return sendJson(res, 404, { error: 'Sessão não encontrada.' });
  if (session.status !== 'aguardando') return sendJson(res, 400, { error: 'Sessão já iniciada.' });
  session.status = 'ativa'; session.questaoAtual = 0;
  session.questaoIniciadaEm = Date.now(); session.mostrandoResultado = false;
  saveDb();
  sendJson(res, 200, { ok: true });
});

route('POST', /^\/api\/battle\/sessoes\/(\d+)\/avancar$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const session = (db.battleSessions || []).find(x => x.id === Number(m[1]) && x.companyId === s.companyId);
  if (!session || session.status !== 'ativa') return sendJson(res, 400, { error: 'Sessão não está ativa.' });
  if (!session.mostrandoResultado) {
    // Calcular resultado da questão atual
    const qi = session.questaoAtual;
    const q = (db.questoes || []).find(x => x.id === session.questoes[qi]);
    const respostas = session.participantes.flatMap(p => (p.respostas || []).filter(r => r.questaoIdx === qi));
    const acertos = respostas.filter(r => r.correta).length;
    session.mostrandoResultado = true;
    session.ultimoResultado = {
      questaoTexto: q ? q.texto : '', opcoes: q ? q.opcoes.map(o => o.texto) : [],
      respostaCorreta: q ? q.opcoes.findIndex(o => o.correta) : 0,
      total: session.participantes.length, acertos, erros: respostas.length - acertos,
      semResposta: session.participantes.length - respostas.length,
      txAcerto: respostas.length ? Math.round((acertos / respostas.length) * 100) : 0
    };
    saveDb();
    return sendJson(res, 200, { ok: true, mostrandoResultado: true, resultado: session.ultimoResultado });
  }
  // Avançar para próxima questão
  session.mostrandoResultado = false; session.questaoAtual++;
  if (session.questaoAtual >= session.questoes.length) {
    session.status = 'finalizada'; session.finalizadaEm = Date.now();
    for (const p of session.participantes) {
      if (p.pontos > 0) {
        const ptsPlat = Math.max(10, Math.round(p.pontos / 10));
        db.pontosExtras.push({ id: nextId(), empId: p.empId, companyId: s.companyId,
          tipo: 'battle', descricao: `⚡ DDS Battle: ${session.titulo}`, pontos: ptsPlat, timestamp: Date.now() });
      }
      const emp = db.employees.find(e => e.id === p.empId);
      if (emp) {
        emp.totalQuestoesRespondidas = (emp.totalQuestoesRespondidas || 0) + (p.acertos || 0);
        checkExpertBadges(emp);
      }
    }
    saveDb();
    return sendJson(res, 200, { ok: true, finalizado: true, ranking: battleRanking(session) });
  }
  session.questaoIniciadaEm = Date.now();
  saveDb();
  sendJson(res, 200, { ok: true, questaoAtual: session.questaoAtual });
});

route('POST', /^\/api\/battle\/sessoes\/(\d+)\/responder$/, { role: 'colaborador' }, async (req, res, m, body, s) => {
  const session = (db.battleSessions || []).find(x => x.id === Number(m[1]) && x.companyId === s.companyId);
  if (!session || session.status !== 'ativa') return sendJson(res, 400, { error: 'Sessão não está ativa.' });
  if (session.mostrandoResultado) return sendJson(res, 400, { error: 'Aguarde a próxima questão.' });
  const part = session.participantes.find(p => p.empId === s.employeeId);
  if (!part) return sendJson(res, 403, { error: 'Você não está nesta sessão.' });
  const qi = session.questaoAtual;
  if ((part.respostas || []).find(r => r.questaoIdx === qi)) return sendJson(res, 409, { error: 'Já respondeu.' });
  const q = (db.questoes || []).find(x => x.id === session.questoes[qi]);
  if (!q) return sendJson(res, 404, { error: 'Questão não encontrada.' });
  const opcaoIdx = Number(body.opcao);
  const correta = !!(q.opcoes[opcaoIdx] && q.opcoes[opcaoIdx].correta);
  const tempo = session.questaoIniciadaEm ? Math.round((Date.now() - session.questaoIniciadaEm) / 1000) : session.tempoPorQuestao;
  const pts = correta ? battlePontos(tempo, session.tempoPorQuestao) : 0;
  if (!part.respostas) part.respostas = [];
  part.respostas.push({ questaoIdx: qi, opcao: opcaoIdx, correta, tempo, pontos: pts });
  part.pontos = (part.pontos || 0) + pts;
  if (correta) part.acertos = (part.acertos || 0) + 1;
  q.stats = q.stats || { total: 0, acertos: 0 };
  q.stats.total++; if (correta) q.stats.acertos++;
  saveDb();
  sendJson(res, 200, { ok: true, correta, pontos: pts, pontosTotal: part.pontos });
});

/* ── SafePoint 2.3 — Flashcards ─────────────────────────────── */

route('GET', /^\/api\/flashcards$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const url2 = new URL('http://x' + req.url);
  const cat = url2.searchParams.get('categoria') || '';
  let list = (db.flashcards || []).filter(f => f.companyId === s.companyId);
  if (cat) list = list.filter(f => f.categoria === cat);
  sendJson(res, 200, list.sort((a, b) => b.criadoEm - a.criadoEm));
});

route('POST', /^\/api\/flashcards$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  if (!String(body.frente || '').trim() || !String(body.verso || '').trim())
    return sendJson(res, 400, { error: 'Frente e verso são obrigatórios.' });
  const card = {
    id: nextId(), companyId: s.companyId,
    frente: String(body.frente).trim(), verso: String(body.verso).trim(),
    categoria: QUIZ_CATEGORIAS.includes(body.categoria) ? body.categoria : 'Procedimentos Gerais',
    ativo: true, criadoEm: Date.now()
  };
  if (!db.flashcards) db.flashcards = [];
  db.flashcards.push(card);
  saveDb();
  sendJson(res, 201, card);
});

route('DELETE', /^\/api\/flashcards\/(\d+)$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const idx = (db.flashcards || []).findIndex(f => f.id === Number(m[1]) && f.companyId === s.companyId);
  if (idx === -1) return sendJson(res, 404, { error: 'Flashcard não encontrado.' });
  db.flashcards.splice(idx, 1);
  saveDb();
  sendJson(res, 200, { ok: true });
});

route('GET', /^\/api\/flashcards\/hoje$/, { role: 'colaborador' }, async (req, res, m, body, s) => {
  const agora = Date.now();
  const todos = (db.flashcards || []).filter(f => f.companyId === s.companyId && f.ativo !== false);
  const progressos = (db.flashcardProgress || []).filter(p => p.empId === s.employeeId);
  const cartoes = todos.map(f => {
    const prog = progressos.find(p => p.cardId === f.id);
    return { ...f, proximaRevisao: prog ? prog.proxima : 0, nivel: prog ? prog.nivel : 0 };
  }).filter(f => f.proximaRevisao <= agora)
    .sort((a, b) => a.proximaRevisao - b.proximaRevisao).slice(0, 10);
  sendJson(res, 200, cartoes);
});

route('POST', /^\/api\/flashcards\/(\d+)\/responder$/, { role: 'colaborador' }, async (req, res, m, body, s) => {
  const card = (db.flashcards || []).find(f => f.id === Number(m[1]) && f.companyId === s.companyId);
  if (!card) return sendJson(res, 404, { error: 'Flashcard não encontrado.' });
  if (!db.flashcardProgress) db.flashcardProgress = [];
  let prog = db.flashcardProgress.find(p => p.empId === s.employeeId && p.cardId === card.id);
  if (!prog) {
    prog = { id: nextId(), empId: s.employeeId, cardId: card.id, nivel: 0, proxima: 0, acertos: 0, erros: 0 };
    db.flashcardProgress.push(prog);
  }
  const INTERVALOS = [1, 2, 4, 7, 14, 30]; // dias por nível
  const dif = body.dificuldade;
  if (dif === 'facil')  prog.nivel = Math.min(5, (prog.nivel || 0) + 2);
  else if (dif === 'medio') prog.nivel = Math.min(5, (prog.nivel || 0) + 1);
  else prog.nivel = Math.max(0, (prog.nivel || 0) - 1);
  prog.proxima = Date.now() + INTERVALOS[prog.nivel] * 86400000;
  dif === 'facil' ? prog.acertos++ : prog.erros++;
  const emp = db.employees.find(e => e.id === s.employeeId);
  if (emp) db.pontosExtras.push({ id: nextId(), empId: emp.id, companyId: s.companyId,
    tipo: 'flashcard', descricao: `🃏 Flashcard: ${card.frente.slice(0, 40)}`, pontos: 5, timestamp: Date.now() });
  saveDb();
  sendJson(res, 200, { ok: true, nivel: prog.nivel, proxima: prog.proxima });
});

/* ── SafePoint 2.3 — Analytics de Aprendizagem ──────────────── */

route('GET', /^\/api\/analytics\/fragilidades$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const questoes = (db.questoes || []).filter(q => q.companyId === s.companyId && q.stats && q.stats.total > 0);
  const list = questoes.map(q => {
    const txErro = Math.round(((q.stats.total - q.stats.acertos) / q.stats.total) * 100);
    return { id: q.id, texto: q.texto, categoria: q.categoria, dificuldade: q.dificuldade,
      total: q.stats.total, acertos: q.stats.acertos, txErro,
      status: txErro >= 70 ? 'critico' : txErro >= 40 ? 'atencao' : 'ok' };
  }).filter(q => q.txErro >= 30).sort((a, b) => b.txErro - a.txErro);
  sendJson(res, 200, list);
});

route('GET', /^\/api\/analytics\/score$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  sendJson(res, 200, calcKnowledgeScore(s.companyId));
});

route('GET', /^\/api\/analytics\/comparativo$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const sessions = (db.battleSessions || []).filter(x => x.companyId === s.companyId && x.status === 'finalizada');
  const mapa = {};
  for (const sess of sessions) {
    for (const p of sess.participantes) {
      const emp = db.employees.find(e => e.id === p.empId);
      const equipe = emp?.equipe || 'Sem equipe';
      if (!mapa[equipe]) mapa[equipe] = { equipe, acertos: 0, total: 0, participantes: new Set() };
      mapa[equipe].acertos += p.acertos || 0;
      mapa[equipe].total   += sess.questoes.length;
      mapa[equipe].participantes.add(p.empId);
    }
  }
  const lista = Object.values(mapa).map(e => ({
    equipe: e.equipe, participantes: e.participantes.size,
    mediaAcerto: e.total ? Math.round((e.acertos / e.total) * 100) : 0,
    status: !e.total ? 'sem_dados' : (e.acertos / e.total >= 0.8 ? 'verde' : e.acertos / e.total >= 0.6 ? 'amarelo' : 'vermelho')
  })).sort((a, b) => b.mediaAcerto - a.mediaAcerto);
  sendJson(res, 200, lista);
});

/* ── SafePoint 3.0 — Insights ───────────────────────────────── */

route('GET', /^\/api\/insights$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const cid = s.companyId;
  const emps = db.employees.filter(e => e.companyId === cid && e.ativo !== false);
  const n = emps.length;
  const empIds = new Set(emps.map(e => e.id));

  // ICS
  const ics = calcICS(cid);

  // Knowledge Score
  const ks = calcKnowledgeScore(cid);

  // Taxa de participação geral (eventos últimos 30 dias)
  const agora = Date.now();
  const d30 = agora - 30 * 86400000;
  const eventosRecentes = db.events.filter(ev => ev.companyId === cid && new Date(ev.data + 'T00:00:00').getTime() >= d30);
  const checkins30 = db.checkins.filter(c => empIds.has(c.employeeId) && c.timestamp && new Date(c.timestamp).getTime() >= d30);
  const txParticipacao = eventosRecentes.length > 0 ? Math.min(100, Math.round((new Set(checkins30.map(c => c.employeeId)).size / n) * 100)) : 0;

  // Observações abertas
  const obsAbertas = db.observations.filter(o => o.companyId === cid && o.status === 'aberta').length;
  const obsTotais = db.observations.filter(o => o.companyId === cid).length;
  const txObsResolvidas = obsTotais > 0 ? Math.round(((obsTotais - obsAbertas) / obsTotais) * 100) : 100;

  // Streak médio
  const streakMedio = n > 0 ? Math.round(emps.reduce((s2, e) => s2 + (e.streakAtual || 0), 0) / n) : 0;

  // Heat map: participação por dia da semana (últimos 60 dias)
  const d60 = agora - 60 * 86400000;
  const checkins60 = db.checkins.filter(c => empIds.has(c.employeeId) && c.timestamp && new Date(c.timestamp).getTime() >= d60);
  const heatDia = [0, 0, 0, 0, 0, 0, 0]; // dom=0..sab=6
  for (const c of checkins60) {
    const d = new Date(c.timestamp).getDay();
    heatDia[d]++;
  }

  // Setor com mais observações críticas
  const obsCrit = db.observations.filter(o => o.companyId === cid && o.criticidade === 'critica');
  const setorMap = {};
  for (const o of obsCrit) {
    const emp = db.employees.find(e => e.id === o.employeeId);
    const setor = emp?.setor || o.setor || 'Desconhecido';
    setorMap[setor] = (setorMap[setor] || 0) + 1;
  }
  const setorCritico = Object.entries(setorMap).sort((a, b) => b[1] - a[1])[0] || null;

  // Top 5 colaboradores por engajamento
  const top5 = emps.map(e => {
    const pts = employeePoints(e.id);
    return { id: e.id, nome: e.nome, setor: e.setor || '', pontos: pts.total, ies: calcIES(e.id) };
  }).sort((a, b) => b.ies - a.ies || b.pontos - a.pontos).slice(0, 5);

  sendJson(res, 200, {
    ics,
    knowledgeScore: ks,
    txParticipacao30d: txParticipacao,
    txObsResolvidas,
    streakMedio,
    heatMapDiaSemana: heatDia,
    setorCritico,
    top5Engajamento: top5,
    totais: {
      colaboradores: n,
      eventos: db.events.filter(ev => ev.companyId === cid).length,
      observacoes: obsTotais,
      sugestoes: db.suggestions.filter(sg => sg.companyId === cid).length,
      moedas: emps.reduce((s2, e) => s2 + (e.moedas || 0), 0)
    }
  });
});

/* ── SafePoint 3.0 — IA SST ─────────────────────────────────── */

route('POST', /^\/api\/ia\/chat$/, { role: 'any' }, async (req, res, m, body, s) => {
  const comp = db.companies.find(c => c.id === s.companyId);
  const iaKey = (comp && comp.iaApiKey) || process.env.ANTHROPIC_API_KEY || '';
  if (!iaKey) return sendJson(res, 503, { error: 'IA não configurada. Adicione a chave da API nas configurações da empresa.' });

  const msg = String(body.message || '').trim().slice(0, 2000);
  if (!msg) return sendJson(res, 400, { error: 'Mensagem obrigatória.' });

  const history = Array.isArray(body.history) ? body.history.slice(-8) : [];

  const systemPrompt = `Você é o assistente de SST (Saúde e Segurança do Trabalho) do SafePoint. Responda sempre em português brasileiro. Você é especialista em normas regulamentadoras brasileiras (NRs), prevenção de acidentes, CIPA, Brigada de Emergência, PPR, PCMSO, PGR, APR, LTCAT e gestão de segurança do trabalho. Seja objetivo, prático e cite normas quando relevante. Limite respostas a 400 palavras. Nunca forneça aconselhamento jurídico ou médico específico — apenas orientações gerais de SST.`;

  const messages = [
    ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: String(h.content || '').slice(0, 1000) })),
    { role: 'user', content: msg }
  ];

  const payload = JSON.stringify({
    model: 'claude-3-haiku-20240307',
    max_tokens: 1024,
    system: systemPrompt,
    messages
  });

  const opts = {
    hostname: 'api.anthropic.com',
    port: 443,
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': iaKey,
      'anthropic-version': '2023-06-01',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  try {
    const respText = await new Promise((resolve, reject) => {
      const req2 = https.request(opts, r => {
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => resolve(d));
      });
      req2.on('error', reject);
      req2.setTimeout(30000, () => { req2.destroy(); reject(new Error('Timeout')); });
      req2.write(payload);
      req2.end();
    });
    const data = JSON.parse(respText);
    if (data.error) return sendJson(res, 502, { error: data.error.message || 'Erro na IA.' });
    const text = data.content && data.content[0] ? data.content[0].text : '';
    sendJson(res, 200, { resposta: text, model: data.model || '' });
  } catch (e) {
    sendJson(res, 502, { error: 'Erro ao chamar IA: ' + e.message });
  }
});

/* ── SafePoint 3.0 — Academia SST ──────────────────────────── */

route('GET', /^\/api\/academia$/, { role: 'any' }, async (req, res, m, body, s) => {
  const url2 = new URL('http://x' + req.url);
  const cat = url2.searchParams.get('categoria') || '';
  let list = (db.academia || []).filter(a => a.companyId === s.companyId && a.ativo !== false);
  if (cat) list = list.filter(a => a.categoria === cat);
  list = list.sort((a, b) => b.criadoEm - a.criadoEm);
  sendJson(res, 200, list);
});

route('POST', /^\/api\/academia$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const titulo = String(body.titulo || '').trim();
  const conteudo = String(body.conteudo || '').trim();
  if (!titulo || !conteudo) return sendJson(res, 400, { error: 'Título e conteúdo são obrigatórios.' });
  const CATEGORIAS_ACADEMIA = ['NR Geral','EPI','Ergonomia','Primeiros Socorros','Incêndio','Procedimentos','CIPA','Brigada','Legislação','Outros'];
  const cat = CATEGORIAS_ACADEMIA.includes(body.categoria) ? body.categoria : 'Outros';
  const item = {
    id: nextId(), companyId: s.companyId,
    titulo, conteudo,
    categoria: cat,
    tipo: ['artigo','video','pdf','infografico'].includes(body.tipo) ? body.tipo : 'artigo',
    url: String(body.url || '').trim(),
    autor: String(body.autor || '').trim(),
    ativo: true, criadoEm: Date.now()
  };
  if (!db.academia) db.academia = [];
  db.academia.push(item);
  saveDb();
  sendJson(res, 201, item);
});

route('DELETE', /^\/api\/academia\/(\d+)$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const idx = (db.academia || []).findIndex(a => a.id === Number(m[1]) && a.companyId === s.companyId);
  if (idx === -1) return sendJson(res, 404, { error: 'Conteúdo não encontrado.' });
  db.academia.splice(idx, 1);
  saveDb();
  sendJson(res, 200, { ok: true });
});

/* ── SafePoint 3.0 — Eleição CIPA ───────────────────────────── */

route('GET', /^\/api\/cipa\/eleicao$/, { role: 'any' }, async (req, res, m, body, s) => {
  const eleicao = (db.cipaEleicao || []).find(e => e.companyId === s.companyId && e.status !== 'encerrada');
  if (!eleicao) return sendJson(res, 200, { eleicao: null });
  const uid = s.employeeId || s.userId;
  const jaVotou = (eleicao.votos || []).some(v => v.votanteId === uid);
  const resultados = eleicao.status === 'encerrada' ? contarVotos(eleicao) : null;
  sendJson(res, 200, { eleicao: { ...eleicao, jaVotou, resultados, votos: undefined } });
});

route('POST', /^\/api\/cipa\/eleicao$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const titulo = String(body.titulo || '').trim();
  if (!titulo) return sendJson(res, 400, { error: 'Título obrigatório.' });
  if (!Array.isArray(body.candidatos) || body.candidatos.length < 2) return sendJson(res, 400, { error: 'Mínimo 2 candidatos.' });
  const existente = (db.cipaEleicao || []).find(e => e.companyId === s.companyId && e.status !== 'encerrada');
  if (existente) return sendJson(res, 409, { error: 'Já existe uma eleição ativa.' });
  const eleicao = {
    id: nextId(), companyId: s.companyId, titulo,
    descricao: String(body.descricao || ''),
    candidatos: body.candidatos.map((c, i) => {
      const emp = db.employees.find(e => e.id === Number(c.empId) && e.companyId === s.companyId);
      return { id: i + 1, empId: Number(c.empId), nome: emp ? emp.nome : String(c.nome || ''), funcao: emp ? (emp.funcao || '') : '' };
    }),
    vagas: Number(body.vagas) || 1,
    dataInicio: body.dataInicio || todayStr(),
    dataFim: body.dataFim || '',
    status: 'ativa', votos: [], criadaEm: Date.now()
  };
  if (!db.cipaEleicao) db.cipaEleicao = [];
  db.cipaEleicao.push(eleicao);
  saveDb();
  sendJson(res, 201, eleicao);
});

route('POST', /^\/api\/cipa\/eleicao\/votar$/, { role: 'colaborador' }, async (req, res, m, body, s) => {
  const eleicao = (db.cipaEleicao || []).find(e => e.companyId === s.companyId && e.status === 'ativa');
  if (!eleicao) return sendJson(res, 404, { error: 'Nenhuma eleição ativa.' });
  if ((eleicao.votos || []).some(v => v.votanteId === s.employeeId)) {
    return sendJson(res, 409, { error: 'Você já votou nesta eleição.' });
  }
  const candidatoId = Number(body.candidatoId);
  const candidato = eleicao.candidatos.find(c => c.id === candidatoId);
  if (!candidato) return sendJson(res, 400, { error: 'Candidato inválido.' });
  if (!eleicao.votos) eleicao.votos = [];
  eleicao.votos.push({ votanteId: s.employeeId, candidatoId, timestamp: Date.now() });
  db.pontosExtras.push({ id: nextId(), empId: s.employeeId, companyId: s.companyId,
    tipo: 'eleicao_cipa', descricao: '🗳 Participou da Eleição CIPA', pontos: 10, timestamp: Date.now() });
  saveDb();
  sendJson(res, 200, { ok: true, pontos: 10 });
});

route('POST', /^\/api\/cipa\/eleicao\/encerrar$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const eleicao = (db.cipaEleicao || []).find(e => e.companyId === s.companyId && e.status === 'ativa');
  if (!eleicao) return sendJson(res, 404, { error: 'Nenhuma eleição ativa.' });
  eleicao.status = 'encerrada';
  eleicao.encerradaEm = Date.now();
  const resultado = contarVotos(eleicao);
  saveDb();
  logAudit(s.userId, s.role, 'encerrar_eleicao_cipa', `Eleição encerrada: ${eleicao.titulo}`, s.companyId);
  sendJson(res, 200, { ok: true, resultado });
});

function contarVotos(eleicao) {
  const map = {};
  for (const c of eleicao.candidatos) map[c.id] = { ...c, votos: 0 };
  for (const v of (eleicao.votos || [])) {
    if (map[v.candidatoId]) map[v.candidatoId].votos++;
  }
  return Object.values(map).sort((a, b) => b.votos - a.votos);
}

/* ── SafePoint 3.2 — Submódulos ─────────────────────────────── */

route('GET', /^\/api\/empresa\/submodulos$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const comp = db.companies.find(c => c.id === s.companyId);
  if (!comp) return sendJson(res, 404, { error: 'Empresa não encontrada.' });
  sendJson(res, 200, { submodulos: comp.submodulos || DEFAULT_SUBMODULOS, labels: SUBMODULO_LABELS });
});

route('POST', /^\/api\/empresa\/submodulos$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  if (!checkSesmtPermission(s)) return sendJson(res, 403, { error: 'Apenas o SESMT pode gerenciar submódulos.' });
  const comp = db.companies.find(c => c.id === s.companyId);
  if (!comp) return sendJson(res, 404, { error: 'Empresa não encontrada.' });
  const antes = JSON.stringify(comp.submodulos || {});
  if (!comp.submodulos) comp.submodulos = JSON.parse(JSON.stringify(DEFAULT_SUBMODULOS));
  for (const [mod, subs] of Object.entries(body.submodulos || {})) {
    if (!comp.submodulos[mod]) comp.submodulos[mod] = {};
    for (const [sub, val] of Object.entries(subs)) comp.submodulos[mod][sub] = !!val;
  }
  saveDb();
  logAudit(s.userId, s.role, 'alterar_submodulo', 'Submódulos atualizados', s.companyId,
    { modulo: 'configuracoes', valorAntes: antes, valorDepois: JSON.stringify(comp.submodulos),
      ip: getClientIP(req), dispositivo: getDeviceInfo(req) });
  sendJson(res, 200, { ok: true, submodulos: comp.submodulos });
});

/* ── SafePoint 3.2 — Permissões ─────────────────────────────── */

route('GET', /^\/api\/empresa\/permissoes$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  const comp = db.companies.find(c => c.id === s.companyId);
  if (!comp) return sendJson(res, 404, { error: 'Empresa não encontrada.' });
  sendJson(res, 200, { permissoes: comp.permissoes || DEFAULT_PERMISSIONS, labels: PERMISSION_LABELS });
});

route('POST', /^\/api\/empresa\/permissoes$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  if (!checkSesmtPermission(s)) return sendJson(res, 403, { error: 'Apenas o SESMT pode gerenciar permissões.' });
  const comp = db.companies.find(c => c.id === s.companyId);
  if (!comp) return sendJson(res, 404, { error: 'Empresa não encontrada.' });
  const antes = JSON.stringify(comp.permissoes || {});
  if (!comp.permissoes) comp.permissoes = JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS));
  for (const [profile, perms] of Object.entries(body.permissoes || {})) {
    if (!comp.permissoes[profile]) comp.permissoes[profile] = {};
    for (const [perm, val] of Object.entries(perms)) comp.permissoes[profile][perm] = !!val;
  }
  saveDb();
  logAudit(s.userId, s.role, 'alterar_permissao', 'Matriz de permissões atualizada', s.companyId,
    { modulo: 'permissoes', valorAntes: antes, valorDepois: JSON.stringify(comp.permissoes),
      ip: getClientIP(req), dispositivo: getDeviceInfo(req) });
  sendJson(res, 200, { ok: true, permissoes: comp.permissoes });
});

/* ── SafePoint 3.2 — Governança ─────────────────────────────── */

route('GET', /^\/api\/governance$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  sendJson(res, 200, calcGovernanceScore(s.companyId));
});

/* ── SafePoint 3.2 — Auditoria Avançada ─────────────────────── */

route('GET', /^\/api\/auditlog\/avancado$/, { role: 'gestor' }, async (req, res, m, body, s) => {
  if (!checkSesmtPermission(s)) return sendJson(res, 403, { error: 'Apenas o SESMT pode visualizar a auditoria.' });
  const url2 = new URL('http://x' + req.url);
  const acao    = url2.searchParams.get('acao')    || '';
  const userId  = url2.searchParams.get('userId')  || '';
  const modulo  = url2.searchParams.get('modulo')  || '';
  const critico = url2.searchParams.get('critico') || '';
  const de  = url2.searchParams.get('de')  || '';
  const ate = url2.searchParams.get('ate') || '';
  let logs = (db.auditLog || []).filter(l => l.companyId === s.companyId);
  if (acao)   logs = logs.filter(l => l.acao.includes(acao));
  if (userId) logs = logs.filter(l => String(l.userId) === userId);
  if (modulo) logs = logs.filter(l => (l.modulo || '').includes(modulo) || l.acao.includes(modulo));
  if (critico === '1') logs = logs.filter(l => l.critico);
  if (de)  { const ts = new Date(de).getTime(); if (!isNaN(ts)) logs = logs.filter(l => l.timestamp >= ts); }
  if (ate) { const ts = new Date(ate).getTime() + 86399999; if (!isNaN(ts)) logs = logs.filter(l => l.timestamp <= ts); }
  const sorted = logs.sort((a, b) => b.timestamp - a.timestamp).slice(0, 500);
  const enriched = sorted.map(log => {
    const emp = db.employees.find(e => e.id === log.userId);
    const mgr = db.managers.find(mg => mg.id === log.userId);
    return { ...log, nomeUsuario: emp ? emp.nome : (mgr ? mgr.name : 'Sistema') };
  });
  sendJson(res, 200, enriched);
});

/* ── SafePoint 3.2 — Admin: submodulos por empresa ──────────── */

route('POST', /^\/api\/admin\/empresas\/(\d+)\/submodulos$/, { role: 'admin' }, async (req, res, m, body, s) => {
  const comp = db.companies.find(c => c.id === Number(m[1]));
  if (!comp) return sendJson(res, 404, { error: 'Empresa não encontrada.' });
  if (!comp.submodulos) comp.submodulos = JSON.parse(JSON.stringify(DEFAULT_SUBMODULOS));
  for (const [mod, subs] of Object.entries(body.submodulos || {})) {
    if (!comp.submodulos[mod]) comp.submodulos[mod] = {};
    for (const [sub, val] of Object.entries(subs)) comp.submodulos[mod][sub] = !!val;
  }
  saveDb();
  logAudit(s.userId, 'admin', 'alterar_submodulo', `Submódulos empresa "${comp.nome}" atualizados`);
  sendJson(res, 200, { ok: true, submodulos: comp.submodulos });
});

route('GET', /^\/api\/admin\/empresas\/(\d+)\/submodulos$/, { role: 'admin' }, async (req, res, m) => {
  const comp = db.companies.find(c => c.id === Number(m[1]));
  if (!comp) return sendJson(res, 404, { error: 'Empresa não encontrada.' });
  sendJson(res, 200, { submodulos: comp.submodulos || DEFAULT_SUBMODULOS, labels: SUBMODULO_LABELS });
});

route('GET', /^\/api\/admin\/auditlog$/, { role: 'admin' }, async (req, res, m, body, s) => {
  const url2 = new URL('http://x' + req.url);
  const companyId = url2.searchParams.get('companyId') ? Number(url2.searchParams.get('companyId')) : null;
  const critico   = url2.searchParams.get('critico')   || '';
  let logs = db.auditLog || [];
  if (companyId) logs = logs.filter(l => l.companyId === companyId);
  if (critico === '1') logs = logs.filter(l => l.critico);
  const sorted = logs.sort((a, b) => b.timestamp - a.timestamp).slice(0, 1000);
  const enriched = sorted.map(log => {
    const emp = db.employees.find(e => e.id === log.userId);
    const mgr = db.managers.find(mg => mg.id === log.userId);
    const adm = db.admins.find(a => a.id === log.userId);
    const comp = db.companies.find(c => c.id === log.companyId);
    return { ...log, nomeUsuario: emp ? emp.nome : (mgr ? mgr.name : (adm ? adm.name : 'Sistema')), nomeEmpresa: comp ? (comp.nomeFantasia || comp.nome) : '' };
  });
  sendJson(res, 200, enriched);
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

initDb().then(() => {
  server.listen(PORT, () => {
    console.log(`SafePoint rodando em http://localhost:${PORT}`);
    console.log(`Supabase backup: ${USE_SUPA ? 'ATIVO' : 'inativo (configure SUPABASE_URL e SUPABASE_KEY)'}`);
  });
});

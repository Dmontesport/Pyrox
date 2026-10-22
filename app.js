'use strict';

/* =========================================================
   PYROX — datos guardados en localStorage del móvil
   ========================================================= */

const STORE_KEY = 'hyrox.v1';
const CATS = { hombre: 'Hombre', mujer: 'Mujer', mixto: 'Mixto' };

// Estaciones oficiales HYROX (Open). Peso en kg; los trineos incluyen el trineo.
const STATIONS = [
  { id: 'skierg', name: 'SkiErg', unit: 'm', amount: 1000 },
  { id: 'sledpush', name: 'Sled Push', unit: 'm', amount: 50, weight: { hombre: 152, mujer: 102, mixto: 152 } },
  { id: 'sledpull', name: 'Sled Pull', unit: 'm', amount: 50, weight: { hombre: 103, mujer: 78, mixto: 103 } },
  { id: 'burpees', name: 'Burpee Broad Jumps', unit: 'm', amount: 80 },
  { id: 'row', name: 'Remo', unit: 'm', amount: 1000 },
  { id: 'farmers', name: 'Farmers Carry', unit: 'm', amount: 200, weight: { hombre: 24, mujer: 16, mixto: 24 }, weightPrefix: '2 ×' },
  { id: 'lunges', name: 'Sandbag Lunges', unit: 'm', amount: 100, weight: { hombre: 20, mujer: 10, mixto: 20 } },
  { id: 'wallballs', name: 'Wall Balls', unit: 'reps', amount: 100, weight: { hombre: 6, mujer: 4, mixto: 6 } },
];

// Orden de la prueba: carrera 1 km + estación, ocho veces.
// En mixto (dobles) las estaciones van a la mitad; las carreras no.
function defaultPlan(cat) {
  const out = [];
  STATIONS.forEach((st, i) => {
    out.push({ id: 'run' + (i + 1), type: 'run', name: 'Carrera ' + (i + 1), num: i + 1, unit: 'km', amount: 1, weight: null, weightPrefix: '' });
    out.push({
      id: st.id, type: 'station', name: st.name, num: i + 1, unit: st.unit,
      amount: cat === 'mixto' ? st.amount / 2 : st.amount,
      weight: st.weight ? st.weight[cat] : null,
      weightPrefix: st.weightPrefix || '',
    });
  });
  return out;
}

function currentPlan(cat) {
  const ov = db.overrides[cat] || {};
  return defaultPlan(cat).map(p => {
    const o = ov[p.id];
    if (!o) return p;
    return Object.assign({}, p, {
      amount: isNum(o.amount) ? o.amount : p.amount,
      weight: p.weight != null && isNum(o.weight) ? o.weight : p.weight,
    });
  });
}

/* ---------- Almacenamiento ---------- */

function normalize(d) {
  d = d && typeof d === 'object' ? d : {};
  const overrides = { hombre: {}, mujer: {}, mixto: {} };
  if (d.overrides && typeof d.overrides === 'object') {
    Object.keys(overrides).forEach(c => { if (d.overrides[c] && typeof d.overrides[c] === 'object') overrides[c] = d.overrides[c]; });
  }
  const settings = Object.assign({ category: 'hombre', autoStartFirst: true, autoNext: true, keepAwake: true }, d.settings || {});
  if (!CATS[settings.category]) settings.category = 'hombre';
  return {
    version: 1,
    settings,
    overrides,
    session: d.session && Array.isArray(d.session.items) ? d.session : null,
    records: Array.isArray(d.records) ? d.records.filter(r => r && Array.isArray(r.items)) : [],
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) { /* datos corruptos: empezar de cero */ }
  return normalize({});
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); }
  catch (e) { toast('No se pudieron guardar los datos'); }
}

let db = load();
const ui = { tab: 'train', sheet: null, recId: null, undo: null };

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* ---------- Utilidades ---------- */

const $ = sel => document.querySelector(sel);
const now = () => Date.now();
const isNum = v => typeof v === 'number' && isFinite(v);
const uid = () => now().toString(36) + Math.random().toString(36).slice(2, 7);
const clone = o => JSON.parse(JSON.stringify(o));

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmt(ms) {
  const t = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const p = n => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

const fmtNum = n => Number(n).toLocaleString('es-ES', { maximumFractionDigits: 2 });
const fmtAmount = it => `${fmtNum(it.amount)} ${it.unit}`;
const fmtWeight = it => `${it.weightPrefix ? it.weightPrefix + ' ' : ''}${fmtNum(it.weight)} kg`;

function fmtDate(ts) {
  return new Date(ts).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/* ---------- Iconos ---------- */

const ICON_PATHS = {
  run: '<circle cx="14" cy="4.5" r="2"/><path d="M7 21l3.5-6.5 3 2.5v5"/><path d="M5 11.5 8.5 8h5l2.5 3.5 3 1"/><path d="M10.5 14.5 12 8"/>',
  skierg: '<path d="M8 3v11M16 3v11"/><path d="M5.5 11.5 8 14l2.5-2.5M13.5 11.5 16 14l2.5-2.5"/><path d="M5 20h14"/>',
  sledpush: '<rect x="3" y="11" width="11" height="7" rx="1.5"/><path d="M2 21h14l3-3"/><path d="M8 5h11M16 2.5 19 5l-3 2.5"/>',
  sledpull: '<rect x="10" y="11" width="11" height="7" rx="1.5"/><path d="M8 21h14"/><path d="M10 14.5H3"/><path d="M5 5h14M8 2.5 5 5l3 2.5"/>',
  burpees: '<path d="M3 19c3-11 10-11 13-2"/><path d="M13.5 15.5 16 17.5l1.5-2.8"/><path d="M3 21.5h18"/>',
  row: '<path d="M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M2 20c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M5 10 19 3"/>',
  farmers: '<circle cx="7" cy="15" r="4"/><path d="M4.5 12c0-4 5-4 5 0"/><circle cx="17" cy="15" r="4"/><path d="M14.5 12c0-4 5-4 5 0"/>',
  lunges: '<rect x="3" y="9" width="18" height="9" rx="4.5"/><path d="M8 9V6.5h3V9M13 9V6.5h3V9"/>',
  wallballs: '<circle cx="12" cy="14" r="6"/><path d="M6 14h12M12 8c-2.5 3-2.5 9 0 12M12 8c2.5 3 2.5 9 0 12"/><path d="M8 3h8"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
};

function icon(name, size = 22) {
  const p = ICON_PATHS[name] || ICON_PATHS.run;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}

const itemIcon = (it, size) => icon(it.type === 'run' ? 'run' : it.id, size);
// Llama del logo (misma forma que el icono de la app)
const FLAME = `<svg class="flame" viewBox="0 0 100 100" width="26" height="26" aria-hidden="true">
  <defs><linearGradient id="flameGrad" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffae00"/><stop offset=".55" stop-color="#ff6a00"/><stop offset="1" stop-color="#ff3000"/></linearGradient></defs>
  <path fill="url(#flameGrad)" d="M50 6C60 24 80 36 80 62C80 80 66 94 50 94C34 94 20 80 20 62C20 48 27 39 34 31C35 41 39 47 45 50C41 35 43 20 50 6Z"/>
  <path fill="#ffe100" d="M50 52C56 60 64 66 64 77C64 86 57 92 50 92C43 92 36 86 36 77C36 68 44 62 50 52Z"/>
</svg>`;
const PLAY = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M7 4.5v15l12-7.5z"/></svg>';

// Ancho del campo numérico ajustado al valor, para que la unidad quede pegada
const inputWidth = v => (Math.max(1, String(v).length) + 0.2) + 'ch';
function sizeInput(el) { el.style.width = inputWidth(el.value); }

/* ---------- Cronómetros ---------- */
// Todo se basa en marcas de tiempo absolutas: si el móvil cierra la app,
// al volver el cronómetro sigue siendo correcto.

function totalMs(s) {
  const end = s.state === 'paused' ? s.pausedAt : now();
  return end - s.startedAt - s.pausedTotal;
}

function itemMs(it) {
  return it.elapsed + (it.since ? now() - it.since : 0);
}

function fold(it, at) {
  if (it.since) { it.elapsed += at - it.since; it.since = null; }
}

const activeIndex = s => s.items.findIndex(i => i.status === 'active');

function activate(s, idx, at) {
  s.items.forEach((it, i) => {
    if (i !== idx && it.status === 'active') { fold(it, at); it.status = 'pending'; }
  });
  const it = s.items[idx];
  it.status = 'active';
  it.since = s.state === 'running' ? at : null;
}

function nextPending(s, from) {
  const n = s.items.length;
  for (let k = 1; k <= n; k++) {
    const j = (from + k) % n;
    if (s.items[j].status === 'pending') return j;
  }
  return -1;
}

/* ---------- Acciones del circuito ---------- */

function startCircuit() {
  const cat = db.settings.category;
  const at = now();
  db.session = {
    id: uid(),
    category: cat,
    startedAt: at,
    pausedTotal: 0,
    pausedAt: null,
    state: 'running',
    items: currentPlan(cat).map(p => Object.assign({}, p, { status: 'pending', elapsed: 0, since: null })),
  };
  if (db.settings.autoStartFirst) activate(db.session, 0, at);
  ui.tab = 'train';
  save();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function pauseCircuit() {
  const s = db.session, at = now();
  if (!s || s.state !== 'running') return;
  s.state = 'paused';
  s.pausedAt = at;
  s.items.forEach(it => fold(it, at));
  save();
  render();
}

function resumeCircuit(at = now()) {
  const s = db.session;
  if (!s || s.state !== 'paused') return;
  s.pausedTotal += at - s.pausedAt;
  s.pausedAt = null;
  s.state = 'running';
  const ai = activeIndex(s);
  if (ai >= 0) s.items[ai].since = at;
  save();
  render();
}

function startItem(idx) {
  const s = db.session, at = now();
  if (!s || s.items[idx].status === 'done') return;
  if (s.state === 'paused') resumeCircuit(at);
  activate(s, idx, at);
  save();
  render();
  scrollToItem(idx);
}

function completeItem(idx) {
  const s = db.session, at = now();
  if (!s) return;
  const snapshot = clone(s);
  const it = s.items[idx];
  fold(it, at);
  it.status = 'done';
  vibrate(80);

  if (s.items.every(i => i.status === 'done')) {
    finishCircuit(at);
    return;
  }
  let next = -1;
  if (db.settings.autoNext) {
    next = nextPending(s, idx);
    if (next >= 0) activate(s, next, at);
  }
  save();
  render();
  if (next >= 0) scrollToItem(next);
  ui.undo = snapshot;
  toast(`${it.name} completado`, 'Deshacer', () => {
    if (!ui.undo || !db.session || db.session.id !== ui.undo.id) return;
    db.session = ui.undo;
    ui.undo = null;
    save();
    render();
  });
}

async function stopCircuit() {
  const at = now();
  const ok = await choose('Detener circuito', 'El circuito se guardará en Registros.', [
    { label: 'Cancelar', value: false, cls: 'ghost' },
    { label: 'Detener', value: true, cls: 'danger' },
  ]);
  if (ok && db.session) finishCircuit(at);
}

function finishCircuit(at) {
  const s = db.session;
  const end = s.state === 'paused' ? s.pausedAt : at;
  s.items.forEach(it => fold(it, end));

  const items = s.items.map(it => ({
    id: it.id, type: it.type, name: it.name, num: it.num, unit: it.unit,
    amount: it.amount, weight: it.weight, weightPrefix: it.weightPrefix,
    ms: it.elapsed,
    status: it.status === 'done' ? 'done' : (it.elapsed > 0 ? 'partial' : 'skipped'),
  }));

  db.session = null;
  ui.undo = null;

  if (items.every(i => i.status === 'skipped')) {
    save();
    render();
    toast('Circuito descartado: no se hizo ningún ejercicio');
    return;
  }

  const rec = { id: s.id, date: s.startedAt, endedAt: end, category: s.category, totalMs: end - s.startedAt - s.pausedTotal, items };
  computePRs(rec);
  db.records.unshift(rec);
  save();
  ui.tab = 'records';
  render();
  openSheet('rec', rec.id);
  vibrate([60, 60, 120]);
  if (rec.pr.any) toast('¡Nuevo récord personal!', '', null, 'pr');
  else toast('Circuito guardado');
}

/* ---------- Récords ----------
   Se compara con los registros anteriores de la misma categoría:
   - Tiempo total: solo si se completó todo el circuito.
   - Tiempo de un ejercicio: más rápido que cualquier vez anterior con igual o menos distancia y peso.
   - Distancia / reps o peso: mayor que el máximo anterior. */

const isFull = r => r.items.every(i => i.status === 'done');

function computePRs(rec) {
  const prev = db.records.filter(r => r.category === rec.category);
  rec.pr = { total: false, any: false };

  if (isFull(rec)) {
    const full = prev.filter(isFull);
    if (full.length && rec.totalMs < Math.min(...full.map(r => r.totalMs))) rec.pr.total = true;
  }

  rec.items.forEach(it => {
    it.pr = {};
    if (it.status !== 'done') return;
    const hist = [];
    prev.forEach(r => r.items.forEach(x => { if (x.id === it.id && x.status === 'done') hist.push(x); }));
    if (!hist.length) return;
    const comparable = hist.filter(h => h.amount <= it.amount && (h.weight || 0) <= (it.weight || 0));
    if (comparable.length && it.ms < Math.min(...comparable.map(h => h.ms))) it.pr.time = true;
    if (it.amount > Math.max(...hist.map(h => h.amount))) it.pr.amount = true;
    if (it.weight != null && it.weight > Math.max(...hist.map(h => h.weight || 0))) it.pr.weight = true;
  });

  rec.pr.any = rec.pr.total || rec.items.some(hasPR);
}

const hasPR = it => !!(it.pr && (it.pr.time || it.pr.amount || it.pr.weight));
const prCount = r => (r.pr && r.pr.total ? 1 : 0) + r.items.filter(hasPR).length;

/* ---------- Render: barra superior ---------- */

function renderTop() {
  const s = db.session;
  let html = `
    <div class="tb-row">
      <div class="brand">${FLAME}<b>PYROX</b></div>
      <button class="icon-btn" data-act="settings" aria-label="Configuración">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </button>
    </div>`;

  if (!s) {
    html += `<button class="btn primary btn-start" data-act="start">▶&nbsp; Iniciar</button>`;
  } else {
    const ai = activeIndex(s);
    const paused = s.state === 'paused';
    html += `
      <div class="clock ${paused ? 'paused' : ''}">
        <div class="clock-total">
          <small>${paused ? '<span class="paused-tag">❚❚ En pausa</span>' : 'Total'}</small>
          <span data-t="total">${fmt(totalMs(s))}</span>
        </div>
        <div class="clock-cur" data-act="scrollActive">
          <small>${ai >= 0 ? esc(s.items[ai].name) : 'Sin ejercicio'}</small>
          <span data-t="cur">${ai >= 0 ? fmt(itemMs(s.items[ai])) : '--:--'}</span>
        </div>
      </div>
      <div class="tb-actions">
        ${paused
          ? `<button class="btn primary" data-act="resume">▶&nbsp; Reanudar</button>`
          : `<button class="btn ghost" data-act="pause">❚❚&nbsp; Pausar</button>`}
        <button class="btn outline-danger" data-act="stop">■&nbsp; Detener</button>
      </div>`;
  }
  $('#topbar').innerHTML = html;
}

/* ---------- Render: entrenamiento ---------- */

function renderTrain() {
  const s = db.session;
  const cat = s ? s.category : db.settings.category;
  const items = s ? s.items : currentPlan(cat);
  const defs = defaultPlan(cat);
  const done = s ? s.items.filter(i => i.status === 'done').length : 0;

  let html = `
    <div class="view-head">
      <div>
        <div class="eyebrow">${s ? `Circuito en curso · ${done}/${items.length}` : 'Circuito'}</div>
        <h1>${CATS[cat]}</h1>
      </div>
      ${s ? '' : '<button class="chip" data-act="settings">Cambiar</button>'}
    </div>
    ${s ? `<div class="progress"><div style="width:${(done / items.length) * 100}%"></div></div>` : ''}
    ${cat === 'mixto' ? '<p class="note">Mixto: estaciones a la mitad, carreras completas.</p>' : ''}
    ${s ? '' : '<p class="note">Toca un valor para cambiarlo; se guarda para los próximos circuitos.</p>'}
    <div class="track">`;

  items.forEach((it, i) => {
    const st = s ? it.status : 'idle';
    const locked = st === 'done' ? 'disabled' : '';
    const pausedCls = st === 'active' && s.state === 'paused' ? 'paused-item' : '';
    const field = (name, mod) => `<input type="number" inputmode="decimal" step="any" min="0" class="${mod ? 'mod' : ''}" value="${it[name]}" style="width:${inputWidth(it[name])}" data-idx="${i}" data-field="${name}" ${locked}>`;
    const amountIn = field('amount', it.amount !== defs[i].amount);

    const showTime = s && (st !== 'pending' || it.elapsed > 0);
    const time = s ? `<span class="t" data-item-t="${i}">${showTime ? fmt(itemMs(it)) : ''}</span>` : '';
    const startBtn = st === 'pending'
      ? `<button class="pill" data-act="startItem" data-idx="${i}">${PLAY} ${it.elapsed > 0 ? 'Seguir' : 'Comenzar'}</button>` : '';

    if (it.type === 'run') {
      const finishBtn = st === 'active' ? `<button class="pill finish" data-act="complete" data-idx="${i}">Completar</button>` : '';
      html += `
        <div class="run-row ${st} ${pausedCls}" id="ex-${i}">
          <div class="node"><span class="dot">${st === 'done' ? icon('check', 16) : icon('run', 16)}</span></div>
          <div class="run-main">
            <span class="run-name">${esc(it.name)}</span>
            <label class="mini-in">${amountIn}<span>km</span></label>
          </div>
          <div class="run-side">${time}${startBtn}${finishBtn}</div>
        </div>`;
      return;
    }

    const weightIn = it.weight != null ? `
      <label class="stat-in">
        <small>Peso${it.weightPrefix ? ' · por mano' : ''}</small>
        <div>${it.weightPrefix ? `<span>${esc(it.weightPrefix)}</span>` : ''}${field('weight', it.weight !== defs[i].weight)}<span>kg</span></div>
      </label>` : '';

    html += `
      <div class="st-card ${st} ${pausedCls}" id="ex-${i}">
        <div class="st-head">
          <div class="st-icon">${st === 'done' ? icon('check', 24) : itemIcon(it, 24)}</div>
          <div class="st-title"><small>Estación ${it.num}</small><h3>${esc(it.name)}</h3></div>
          <div class="st-side">${time}${startBtn}</div>
        </div>
        <div class="st-stats">
          <label class="stat-in">
            <small>${it.unit === 'reps' ? 'Repeticiones' : 'Distancia'}</small>
            <div>${amountIn}<span>${it.unit}</span></div>
          </label>
          ${weightIn}
        </div>
        ${st === 'active' ? `<button class="btn primary block st-finish" data-act="complete" data-idx="${i}">${icon('check', 20)} Completar</button>` : ''}
      </div>`;
  });

  html += '</div>';
  return html;
}

/* ---------- Render: registros ---------- */

function renderRecords() {
  if (!db.records.length) {
    return `<div class="empty"><b>Aún no hay registros</b>Pulsa <b style="display:inline;color:var(--accent)">Iniciar</b> arriba y, al detener el circuito, aparecerá aquí con el desglose de cada ejercicio.</div>`;
  }
  const cat = db.settings.category;
  const full = db.records.filter(r => r.category === cat && isFull(r));
  const best = full.length ? Math.min(...full.map(r => r.totalMs)) : null;

  let html = `
    <div class="view-head"><div><div class="eyebrow">Historial</div><h1>Registros</h1></div></div>
    <div class="stats">
      <div class="stat"><small>Circuitos</small><b>${db.records.length}</b></div>
      <div class="stat"><small>Mejor completo · ${CATS[cat]}</small><b>${best != null ? fmt(best) : '—'}</b></div>
    </div>
    <div class="list">`;

  db.records.forEach(r => {
    const done = r.items.filter(i => i.status === 'done').length;
    const n = prCount(r);
    html += `
      <button class="rec ${n ? 'glow' : ''}" data-act="openRec" data-id="${esc(r.id)}">
        <div>
          <div class="rec-date">${fmtDate(r.date)}</div>
          <div class="rec-meta"><span class="tag cat">${CATS[r.category] || esc(r.category)}</span> ${done}/${r.items.length} ejercicios</div>
        </div>
        <div class="rec-right">
          <div class="rec-time ${r.pr && r.pr.total ? 'pr-val' : ''}">${fmt(r.totalMs)}</div>
          ${n ? `<span class="pr-badge">${n} PR</span>` : ''}
        </div>
      </button>`;
  });
  return html + '</div>';
}

function renderRecordDetail(r) {
  const done = r.items.filter(i => i.status === 'done').length;
  const sum = type => r.items.filter(i => i.type === type).reduce((a, i) => a + i.ms, 0);

  let html = `
    <div class="sheet-head">
      <button class="icon-btn" data-act="closeSheet" aria-label="Volver">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <h2>${fmtDate(r.date)}</h2>
      <span class="tag cat">${CATS[r.category] || esc(r.category)}</span>
    </div>
    <div class="summary">
      <div class="big ${r.pr && r.pr.total ? 'pr-val' : ''}">${fmt(r.totalMs)}</div>
      <div class="sub">${isFull(r) ? 'Circuito completo' : `Incompleto · ${done}/${r.items.length} ejercicios`}</div>
      ${r.pr && r.pr.total ? '<span class="pr-badge">MEJOR TIEMPO TOTAL</span>' : ''}
    </div>
    <div class="stats" style="padding:0 0 16px">
      <div class="stat"><small>Carreras</small><b>${fmt(sum('run'))}</b></div>
      <div class="stat"><small>Estaciones</small><b>${fmt(sum('station'))}</b></div>
    </div>
    <div class="rows">`;

  r.items.forEach(it => {
    const pr = it.pr || {};
    const status = it.status === 'partial' ? '<span class="tag">Parcial</span>' : it.status === 'skipped' ? '<span class="tag">No hecho</span>' : '';
    const pace = it.type === 'run' && it.status === 'done' && it.amount > 0 ? `<div class="row-pace">${fmt(it.ms / it.amount)} /km</div>` : '';
    html += `
      <div class="row ${it.type} ${it.status} ${hasPR(it) ? 'glow' : ''}">
        <div class="row-icon">${itemIcon(it, 18)}</div>
        <div class="row-main">
          <div class="row-name">${esc(it.name)} ${status} ${hasPR(it) ? '<span class="pr-badge">PR</span>' : ''}</div>
          <div class="row-sub">
            <span class="${pr.amount ? 'pr-val' : ''}">${fmtAmount(it)}</span>
            ${it.weight != null ? ` · <span class="${pr.weight ? 'pr-val' : ''}">${fmtWeight(it)}</span>` : ''}
          </div>
        </div>
        <div class="row-right">
          <div class="row-time ${pr.time ? 'pr-val' : ''}">${it.status === 'skipped' ? '—' : fmt(it.ms)}</div>
          ${pace}
        </div>
      </div>`;
  });

  html += `</div>
    <div style="margin-top:24px"><button class="btn outline-danger block" data-act="delRec" data-id="${esc(r.id)}">Eliminar registro</button></div>`;
  return html;
}

/* ---------- Render: configuración ---------- */

function renderSettings() {
  const st = db.settings;
  const locked = !!db.session;
  const canShare = !!(navigator.canShare && window.File && navigator.canShare({ files: [new File(['{}'], 'a.json', { type: 'application/json' })] }));
  const sw = (key, label) => `
    <label class="switch-row"><span>${label}</span><input type="checkbox" class="switch" data-setting="${key}" ${st[key] ? 'checked' : ''}></label>`;

  return `
    <div class="sheet-head">
      <h2>Configuración</h2>
      <button class="icon-btn" data-act="closeSheet" aria-label="Cerrar">✕</button>
    </div>

    <div class="sec">
      <h4>Categoría</h4>
      <div class="seg ${locked ? 'disabled' : ''}">
        ${Object.keys(CATS).map(c => `<button class="${st.category === c ? 'on' : ''}" data-act="setCat" data-cat="${c}">${CATS[c]}</button>`).join('')}
      </div>
      <p class="note">${locked ? 'No se puede cambiar con un circuito en curso.' : 'Mixto: estaciones a la mitad (dobles), carreras completas. Cada categoría guarda sus propios valores.'}</p>
    </div>

    <div class="sec">
      <h4>Cronómetro</h4>
      ${sw('autoStartFirst', 'Empezar ejercicio al comenzar')}
      ${sw('autoNext', 'Al completar un ejercicio, empezar el siguiente')}
      ${sw('keepAwake', 'Mantener pantalla encendida')}
    </div>

    <div class="sec">
      <h4>Valores de ${CATS[st.category]}</h4>
      <button class="btn ghost block" data-act="resetPlan" ${locked ? 'disabled' : ''}>Restaurar distancias y pesos oficiales</button>
    </div>

    <div class="sec">
      <h4>Datos</h4>
      <button class="btn ghost block" data-act="export">Exportar copia (.json)</button>
      ${canShare ? '<button class="btn ghost block" data-act="share">Compartir copia…</button>' : ''}
      <button class="btn ghost block" data-act="import" ${locked ? 'disabled' : ''}>Importar copia</button>
      <p class="note">Los datos se guardan solo en este móvil. Exporta una copia de vez en cuando para no perderlos. ${db.records.length} registros guardados.</p>
    </div>`;
}

/* ---------- Render general ---------- */

function renderView() {
  $('#view').innerHTML = ui.tab === 'train' ? renderTrain() : renderRecords();
}

function renderTabs() {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === ui.tab));
}

function renderSheet() {
  const el = $('#sheet');
  if (ui.sheet === 'settings') el.innerHTML = renderSettings();
  else if (ui.sheet === 'rec') {
    const r = db.records.find(x => x.id === ui.recId);
    if (r) el.innerHTML = renderRecordDetail(r);
    else hideSheet();
  }
}

function render() {
  renderTop();
  renderView();
  renderTabs();
  if (ui.sheet) renderSheet();
  syncWake();
}

function tick() {
  const s = db.session;
  if (!s) return;
  const set = (sel, txt) => { const el = document.querySelector(sel); if (el && el.textContent !== txt) el.textContent = txt; };
  set('[data-t="total"]', fmt(totalMs(s)));
  const ai = activeIndex(s);
  if (ai >= 0) {
    const t = fmt(itemMs(s.items[ai]));
    set('[data-t="cur"]', t);
    set(`[data-item-t="${ai}"]`, t);
  }
}
setInterval(tick, 250);

function scrollToItem(idx) {
  requestAnimationFrame(() => {
    const el = document.getElementById('ex-' + idx);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

/* ---------- Hoja, diálogo y avisos ---------- */

function openSheet(kind, id) {
  const wasOpen = !!ui.sheet;
  ui.sheet = kind;
  ui.recId = id || null;
  renderSheet();
  const el = $('#sheet');
  el.scrollTop = 0;
  el.classList.add('open');
  if (!wasOpen) history.pushState({ sheet: true }, '');
}

function hideSheet() {
  ui.sheet = null;
  ui.recId = null;
  $('#sheet').classList.remove('open');
}

function closeSheet() {
  if (!ui.sheet) return;
  if (history.state && history.state.sheet) history.back();
  else hideSheet();
}

// Botón "atrás" de Android cierra la hoja en lugar de salir de la app
window.addEventListener('popstate', () => { if (ui.sheet) hideSheet(); });

function choose(title, msg, buttons) {
  return new Promise(resolve => {
    const d = $('#dialog');
    d.innerHTML = `
      <div class="dlg">
        <h3>${esc(title)}</h3>
        <p>${esc(msg)}</p>
        <div class="dlg-actions">${buttons.map((b, i) => `<button class="btn ${b.cls || 'ghost'}" data-r="${i}">${esc(b.label)}</button>`).join('')}</div>
      </div>`;
    d.classList.add('open');
    d.onclick = ev => {
      const b = ev.target.closest('[data-r]');
      if (!b && ev.target !== d) return;
      d.classList.remove('open');
      d.onclick = null;
      resolve(b ? buttons[+b.dataset.r].value : buttons[0].value);
    };
  });
}

let toastTimer = null;
function toast(msg, actionLabel = '', action = null, kind = '') {
  const t = $('#toast');
  t.querySelector('span').textContent = msg;
  const btn = t.querySelector('button');
  btn.textContent = actionLabel;
  btn.onclick = () => { t.classList.remove('show'); if (action) action(); };
  t.className = 'show ' + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), actionLabel ? 5000 : 2600);
}

function vibrate(p) {
  try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* no soportado */ }
}

/* ---------- Pantalla encendida ---------- */

let wakeLock = null;
async function syncWake() {
  const want = !!(db.session && db.session.state === 'running' && db.settings.keepAwake && document.visibilityState === 'visible');
  if (want && !wakeLock && 'wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (e) { wakeLock = null; }
  } else if (!want && wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') render();
  else syncWake();
});

/* ---------- Importar / exportar ---------- */

function backupData() {
  return {
    app: 'pyrox',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: db.settings,
    overrides: db.overrides,
    records: db.records,
  };
}

function backupFile() {
  const name = `pyrox-${new Date().toISOString().slice(0, 10)}.json`;
  return new File([JSON.stringify(backupData(), null, 2)], name, { type: 'application/json' });
}

function exportData() {
  const file = backupFile();
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Copia exportada');
}

async function shareData() {
  try { await navigator.share({ files: [backupFile()], title: 'Copia PYROX' }); }
  catch (e) { if (e.name !== 'AbortError') exportData(); }
}

async function importData(file) {
  let data;
  try { data = JSON.parse(await file.text()); }
  catch (e) { toast('El archivo no es un JSON válido'); return; }
  if (!data || typeof data !== 'object' || !(Array.isArray(data.records) || data.settings || data.overrides)) {
    toast('El archivo no es una copia de PYROX');
    return;
  }
  const incoming = normalize(data);
  const mode = await choose('Importar copia',
    `El archivo tiene ${incoming.records.length} registros. "Combinar" añade los registros que no tengas; "Reemplazar" sustituye todos tus datos y valores.`,
    [
      { label: 'Cancelar', value: null, cls: 'ghost' },
      { label: 'Combinar', value: 'merge', cls: 'ghost' },
      { label: 'Reemplazar', value: 'replace', cls: 'danger' },
    ]);
  if (!mode) return;

  if (mode === 'replace') {
    incoming.session = db.session;
    db = incoming;
  } else {
    const ids = new Set(db.records.map(r => r.id));
    incoming.records.forEach(r => { if (!ids.has(r.id)) db.records.push(r); });
    db.records.sort((a, b) => b.date - a.date);
  }
  save();
  render();
  toast('Datos importados');
}

/* ---------- Eventos ---------- */

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const idx = el.dataset.idx != null ? +el.dataset.idx : null;
  // "Deshacer" solo vale justo después de completar, sin otros cambios en medio
  if (['pause', 'resume', 'stop', 'startItem'].includes(act)) ui.undo = null;

  switch (act) {
    case 'start': startCircuit(); break;
    case 'pause': pauseCircuit(); break;
    case 'resume': resumeCircuit(); break;
    case 'stop': stopCircuit(); break;
    case 'startItem': startItem(idx); break;
    case 'complete': completeItem(idx); break;

    case 'tab':
      ui.tab = el.dataset.tab;
      render();
      window.scrollTo(0, 0);
      break;

    case 'scrollActive': {
      if (!db.session) break;
      const ai = activeIndex(db.session);
      if (ai < 0) break;
      if (ui.tab !== 'train') { ui.tab = 'train'; render(); }
      scrollToItem(ai);
      break;
    }

    case 'settings': openSheet('settings'); break;
    case 'closeSheet': closeSheet(); break;
    case 'openRec': openSheet('rec', el.dataset.id); break;

    case 'delRec': {
      const ok = await choose('Eliminar registro', 'Esta acción no se puede deshacer.', [
        { label: 'Cancelar', value: false, cls: 'ghost' },
        { label: 'Eliminar', value: true, cls: 'danger' },
      ]);
      if (!ok) break;
      db.records = db.records.filter(r => r.id !== el.dataset.id);
      save();
      closeSheet();
      render();
      break;
    }

    case 'setCat':
      if (db.session) break;
      db.settings.category = el.dataset.cat;
      save();
      render();
      break;

    case 'resetPlan': {
      const cat = db.settings.category;
      const ok = await choose('Restaurar valores', `Se volverá a las distancias y pesos oficiales de ${CATS[cat]}.`, [
        { label: 'Cancelar', value: false, cls: 'ghost' },
        { label: 'Restaurar', value: true, cls: 'primary' },
      ]);
      if (!ok) break;
      db.overrides[cat] = {};
      save();
      render();
      toast('Valores restaurados');
      break;
    }

    case 'export': exportData(); break;
    case 'share': shareData(); break;
    case 'import': $('#importFile').click(); break;
  }
});

document.addEventListener('change', e => {
  const t = e.target;

  if (t.matches('input[data-field]')) {
    const s = db.session;
    const cat = s ? s.category : db.settings.category;
    const idx = +t.dataset.idx, field = t.dataset.field;
    const it = s ? s.items[idx] : currentPlan(cat)[idx];
    const v = parseFloat(String(t.value).replace(',', '.'));
    if (!isNum(v) || v < 0) { t.value = it[field]; sizeInput(t); return; }

    // El valor cambiado se queda guardado para los próximos circuitos
    const ov = db.overrides[cat] || (db.overrides[cat] = {});
    ov[it.id] = Object.assign({}, ov[it.id], { [field]: v });
    if (s && it.status !== 'done') it[field] = v;
    t.classList.toggle('mod', v !== defaultPlan(cat)[idx][field]);
    save();
    return;
  }

  if (t.matches('input[data-setting]')) {
    db.settings[t.dataset.setting] = t.checked;
    save();
    syncWake();
    return;
  }

  if (t.id === 'importFile' && t.files && t.files[0]) {
    importData(t.files[0]);
    t.value = '';
  }
});

document.addEventListener('input', e => {
  if (e.target.matches('input[data-field]')) sizeInput(e.target);
});

// Enter en un campo numérico cierra el teclado
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches('input[data-field]')) e.target.blur();
});

/* ---------- Arranque ---------- */

render();
if (db.session) {
  const ai = activeIndex(db.session);
  if (ai >= 0) scrollToItem(ai);
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

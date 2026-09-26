/* ======================================================================
   PANEL DE CREADORES — Materiales y Aceros
   Acceso con cuenta (Firebase Auth). Los datos viven en Firestore:
     students/{id}   participantes (lectura pública, escritura creadores)
     questions/{id}  banco de preguntas y retos
     progress/{id}   progreso de cada alumno (lo escribe la página de alumnos)
     creators/{uid}  perfiles de creadores (pendiente / aprobado)
     settings/forms  enlaces de Google Forms
   ====================================================================== */
import { FB_READY, firestore, authMod } from './fb.js';
import { DEFAULT_ROSTER, DEFAULT_QUESTIONS, TEMAS, CLASES } from './data.js';
import { FORMS_DEFAULT } from './config.js';

const $ = s => document.querySelector(s);
const app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const pct = (a,b) => b ? Math.round(100*a/b) : null;
const byName = (a,b) => a.nombre.localeCompare(b.nombre, 'es');

let F = null, A = null;
const D = { me:null, students:[], questions:[], progress:[], creators:[], forms:{}, loaded:{} };
let TAB = 'resumen';
let UNSUB = [];
let pendingName = null;                // nombre escrito al registrarse
let studentEdit = null;                // null | {} (nuevo) | {id,...}
let questionEdit = null;
let detailId = null;
let qFilter = { clase:'', tema:'' };
let progSort = 'nombre';
let dbError = '';

let toastT;
function toast(t){ const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2400); }

function fmtAgo(ms){
  if (!ms) return '—';
  const s = Math.round((Date.now() - ms)/1000);
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.round(s/60)} min`;
  if (s < 86400) return `hace ${Math.round(s/3600)} h`;
  return new Date(ms).toLocaleDateString('es-HN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
}

/* ======================================================================
   ARRANQUE Y AUTENTICACIÓN
   ====================================================================== */
if (!FB_READY) {
  app.innerHTML = `<div class="authwrap"><div class="authcard"><h1>Falta configurar Firebase</h1>
    <p class="sub">Pega el bloque <b>firebaseConfig</b> de tu proyecto en <code>config.js</code> y vuelve a publicar la página.</p></div></div>`;
} else {
  boot().catch(e => { app.innerHTML = `<div class="empty">No se pudo conectar con Firebase: ${esc(e.message)}</div>`; });
}

async function boot(){
  F = await firestore();
  A = await authMod();
  A.onAuthStateChanged(A.auth, async user => {
    UNSUB.forEach(u => u()); UNSUB = [];
    if (!user) { D.me = null; header(); showAuth('login'); return; }
    try {
      const ref = F.doc(F.db, 'creators', user.uid);
      let snap = await F.getDoc(ref);
      if (!snap.exists()) {
        await createCreatorDoc(user, pendingName || user.email.split('@')[0]);
        snap = await F.getDoc(ref);
      }
      pendingName = null;
      D.me = { uid: user.uid, ...snap.data() };
      header();
      if (D.me.estado !== 'aprobado') { showPending(); return; }
      startPanel();
    } catch (e) {
      console.error(e);
      app.innerHTML = `<div class="authwrap"><div class="authcard"><h1>No se pudo abrir tu perfil</h1>
        <p class="sub">${esc(e.code === 'permission-denied' ? 'Las reglas de seguridad de Firestore todavía no están publicadas o no permiten este acceso.' : e.message)}</p>
        <button class="btn ghost" data-act="logout">Salir</button></div></div>`;
    }
  });
}

/* El primer creador que se registra queda como administrador aprobado;
   los siguientes quedan pendientes hasta que un creador los apruebe. */
async function createCreatorDoc(user, nombre){
  const base = { nombre: nombre.trim(), email: user.email, createdAt: Date.now() };
  const bRef = F.doc(F.db, 'meta', 'bootstrap');
  const cRef = F.doc(F.db, 'creators', user.uid);
  const b = await F.getDoc(bRef);
  if (!b.exists()) {
    try {
      const batch = F.writeBatch(F.db);
      batch.set(bRef, { uid: user.uid, at: Date.now() });
      batch.set(cRef, { ...base, rol:'admin', estado:'aprobado' });
      await batch.commit();
      return;
    } catch (e) { console.warn('Otro creador se registró primero como administrador.', e); }
  }
  await F.setDoc(cRef, { ...base, rol:'creador', estado:'pendiente' });
}

function header(){
  const me = D.me;
  $('#me').innerHTML = me ? `<b>${esc(me.nombre)}</b>${me.estado === 'aprobado' ? `<span class="role">${me.rol === 'admin' ? 'Admin' : 'Creador'}</span>` : ''}` : '';
  $('#logout').style.display = me ? '' : 'none';
  $('#tabs').style.display = me && me.estado === 'aprobado' ? 'flex' : 'none';
}
$('#logout').addEventListener('click', () => A.signOut(A.auth));

const AUTH_ERR = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/user-not-found': 'No hay ninguna cuenta con ese correo.',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Inicia sesión.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/too-many-requests': 'Demasiados intentos. Espera un momento.',
  'auth/operation-not-allowed': 'Activa "Correo electrónico/contraseña" en Firebase → Authentication.',
  'auth/unauthorized-domain': 'Añade este dominio en Firebase → Authentication → Configuración → Dominios autorizados.'
};
const authMsg = e => AUTH_ERR[e.code] || e.message;

function showAuth(mode){
  const reg = mode === 'register';
  app.innerHTML = `<div class="authwrap"><div class="authcard">
    <h1>${reg ? 'Registrarme como creador' : 'Acceso para creadores'}</h1>
    <p class="sub">${reg ? 'Tu cuenta quedará pendiente hasta que otro creador la apruebe. La primera cuenta que se registra es la del administrador.' : 'Solo para organizadores. Los alumnos entran desde la página principal.'}</p>
    <form id="authform">
      ${reg ? '<label class="f">Nombre completo<input name="nombre" required autocomplete="name"></label>' : ''}
      <label class="f">Correo<input name="email" type="email" required autocomplete="email"></label>
      <label class="f">Contraseña<input name="pass" type="password" required minlength="6" autocomplete="${reg ? 'new-password' : 'current-password'}"></label>
      <button class="btn" type="submit">${reg ? 'Crear cuenta' : 'Entrar'}</button>
    </form>
    <div class="msg" id="authmsg"></div>
    <div class="switch">${reg
      ? '¿Ya tienes cuenta? <button data-act="auth-login">Inicia sesión</button>'
      : '¿Eres nuevo? <button data-act="auth-register">Regístrate</button> · <button data-act="auth-reset">Olvidé mi contraseña</button>'}</div>
  </div></div>`;
  $('#authform').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target), msg = $('#authmsg');
    msg.className = 'msg'; msg.textContent = 'Un momento…';
    try {
      if (reg) {
        pendingName = fd.get('nombre');
        await A.createUserWithEmailAndPassword(A.auth, fd.get('email').trim(), fd.get('pass'));
      } else {
        await A.signInWithEmailAndPassword(A.auth, fd.get('email').trim(), fd.get('pass'));
      }
    } catch (err) { pendingName = null; msg.className = 'msg err'; msg.textContent = authMsg(err); }
  });
}

function showPending(){
  const rech = D.me.estado === 'rechazado';
  app.innerHTML = `<div class="authwrap"><div class="authcard">
    <h1>${rech ? 'Solicitud rechazada' : 'Solicitud enviada'}</h1>
    <p class="sub">${rech
      ? 'Un creador rechazó esta cuenta. Si crees que es un error, habla con el administrador.'
      : `Hola, ${esc(D.me.nombre)}. Tu cuenta de creador está <b>pendiente de aprobación</b>. En cuanto un creador la apruebe, recarga esta página.`}</p>
    <div class="row"><button class="btn" data-act="reload">Volver a comprobar</button><button class="btn ghost" data-act="logout">Salir</button></div>
  </div></div>`;
}

/* ======================================================================
   DATOS EN VIVO
   ====================================================================== */
function startPanel(){
  const live = (name, key, map = d => ({ id: d.id, ...d.data() })) =>
    F.onSnapshot(F.collection(F.db, name), snap => { D[key] = snap.docs.map(map); D.loaded[key] = true; safeDraw(); },
      e => { dbError = e.code === 'permission-denied' ? 'Las reglas de seguridad no permiten leer los datos. Revisa que estén publicadas.' : e.message; safeDraw(); });
  UNSUB.push(
    live('students', 'students'),
    live('questions', 'questions'),
    live('progress', 'progress'),
    live('creators', 'creators'),
    F.onSnapshot(F.doc(F.db, 'settings', 'forms'), s => { D.forms = s.exists() ? s.data() : {}; D.loaded.forms = true; safeDraw(); }),
    F.onSnapshot(F.doc(F.db, 'creators', D.me.uid), s => {
      if (!s.exists()) return;
      D.me = { uid: D.me.uid, ...s.data() }; header();
      if (D.me.estado !== 'aprobado') { UNSUB.forEach(u => u()); UNSUB = []; showPending(); }
    })
  );
  draw();
}

/* No redibujar mientras alguien escribe en un formulario del panel. */
let drawPending = false;
function safeDraw(){
  const a = document.activeElement;
  if (a && app.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { drawPending = true; return; }
  draw();
}
app.addEventListener('focusout', () => setTimeout(() => {
  const a = document.activeElement;
  if (drawPending && !(a && app.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) { drawPending = false; draw(); }
}, 0));

/* ======================================================================
   DERIVADOS
   ====================================================================== */
const activeStudents = () => D.students.filter(s => s.activo !== false).sort(byName);
const progOf = id => D.progress.find(p => p.studentId === id || p.id === id);
const activeQuestions = () => D.questions.filter(q => q.activo !== false);
const CARD_KEYS = ['OBJETIVO','SECRETO','CHARLA','DESAFIO'];
const cardsOf = perfil => CARD_KEYS.filter(k => norm(perfil || '').toUpperCase().includes(k));
const perfilFrom = keys => keys.length === 0 ? '' : keys.length === 1 ? keys[0] : 'Mixto: ' + keys.join(' + ');
const FORM_KEYS = ['f1','f2_std','f3_std','f2_game','f3_game'];

/* Estadísticas por pregunta a partir de todas las respuestas registradas */
function questionStats(){
  const st = {};
  D.progress.forEach(p => Object.entries(p.answers || {}).forEach(([qid, a]) => {
    const s = st[qid] || (st[qid] = { n:0, ok:0, picks:{} });
    s.n++; if (a.ok) s.ok++; s.picks[a.c] = (s.picks[a.c] || 0) + 1;
  }));
  return st;
}
function temaStats(){
  const out = {};
  Object.keys(TEMAS).forEach(t => out[t] = { std:{n:0,ok:0}, game:{n:0,ok:0} });
  D.progress.forEach(p => Object.values(p.answers || {}).forEach(a => {
    if (out[a.tema] && out[a.tema][a.clase]) { out[a.tema][a.clase].n++; if (a.ok) out[a.tema][a.clase].ok++; }
  }));
  return out;
}
const accOf = c => c && c.n ? Math.round(100 * c.ok / c.n) : null;
const duelOk = p => Object.values(p?.duel || {}).filter(v => v === 'ok').length;
const formsDone = p => FORM_KEYS.filter(k => p?.forms?.[k]).length;

/* ======================================================================
   DIBUJO
   ====================================================================== */
const TABS = [
  ['resumen','Resumen y análisis'], ['progreso','Progreso por alumno'], ['alumnos','Participantes'],
  ['preguntas','Preguntas y retos'], ['formularios','Formularios'], ['creadores','Creadores']
];
function drawTabs(){
  const pend = D.creators.filter(c => c.estado === 'pendiente').length;
  $('#tabs').innerHTML = TABS.map(([k,l]) =>
    `<button class="${k === TAB ? 'on' : ''}" data-act="tab" data-k="${k}">${l}${k === 'creadores' && pend ? ` <span class="pill warn">${pend}</span>` : ''}</button>`).join('');
}

function draw(){
  if (!D.me || D.me.estado !== 'aprobado') return;
  drawTabs();
  const seed = D.loaded.students && D.loaded.questions && (!D.students.length || !D.questions.length)
    ? `<div class="notice"><b>La base de datos está vacía.</b> Carga los 18 participantes originales, el banco de preguntas y los enlaces de formularios por defecto para empezar.
       <div style="margin-top:10px"><button class="btn" data-act="seed">Cargar datos iniciales</button></div></div>` : '';
  const err = dbError ? `<div class="notice">${esc(dbError)}</div>` : '';
  const body = { resumen: viewResumen, progreso: viewProgreso, alumnos: viewAlumnos, preguntas: viewPreguntas,
                 formularios: viewFormularios, creadores: viewCreadores }[TAB]();
  app.innerHTML = err + seed + body;
  if (TAB === 'preguntas') bindQuestionEditor();
}

/* ---------- Resumen ---------- */
function viewResumen(){
  const act = activeStudents();
  const ids = new Set(act.map(s => s.id));
  const prog = D.progress.filter(p => ids.has(p.studentId));
  const started = prog.length, finished = prog.filter(p => p.finished).length;
  const avg = key => {
    const v = prog.filter(p => p[key] && p[key].n).map(p => p[key].ok / p[key].n);
    return v.length ? Math.round(100 * v.reduce((a,b) => a+b, 0) / v.length) : null;
  };
  const xps = prog.filter(p => p.xp).map(p => p.xp);
  const kpi = (l, v, d) => `<div class="kpi"><div class="l">${l}</div><div class="v num">${v}</div><div class="d">${d}</div></div>`;

  const ts = temaStats();
  const rows = Object.entries(TEMAS).map(([t, T]) => {
    const bar = (cls, c, lbl) => {
      const a = accOf(c);
      const tip = `${T.nombre} · ${lbl}: ${a === null ? 'sin respuestas' : `${a} % de aciertos (${c.ok} de ${c.n})`}`;
      return `<div class="b ${a === null ? 'none' : ''}" data-tip="${esc(tip)}"><div class="track">${a === null ? '' : `<div class="fill" style="width:${a}%;background:var(--${cls})"></div>`}</div>
        <span class="val num">${a === null ? 'sin datos' : a + ' %'}</span></div>`;
    };
    return `<div class="grp"><div class="t">${esc(T.nombre)}</div><div class="bars">${bar('std', ts[t].std, 'Clase estándar')}${bar('game', ts[t].game, 'Clase personalizada')}</div></div>`;
  }).join('');

  const qs = questionStats();
  const hard = D.questions.filter(q => qs[q.id] && qs[q.id].n)
    .map(q => ({ q, s: qs[q.id], a: Math.round(100 * qs[q.id].ok / qs[q.id].n) }))
    .sort((x,y) => x.a - y.a || y.s.n - x.s.n).slice(0, 8);
  const wrong = (q, s) => {
    const e = Object.entries(s.picks).filter(([c]) => +c !== +q.correcta).sort((a,b) => b[1] - a[1])[0];
    return e ? `${esc(q.opciones?.[e[0]] ?? '?')} <span class="muted">(${e[1]})</span>` : '—';
  };

  return `<h1>Resumen y análisis</h1><p class="sub">Se actualiza solo, en tiempo real, mientras los alumnos avanzan.</p>
    <div class="kpis">
      ${kpi('Participantes', act.length, 'activos en la lista')}
      ${kpi('Empezaron', started, act.length ? `${pct(started, act.length)} % del grupo` : '—')}
      ${kpi('Terminaron', finished, started ? `${pct(finished, started)} % de los que empezaron` : '—')}
      ${kpi('Clase estándar', avg('std') === null ? '—' : avg('std') + ' %', 'aciertos medios en el repaso')}
      ${kpi('Clase personalizada', avg('game') === null ? '—' : avg('game') + ' %', 'aciertos medios en los retos')}
      ${kpi('XP medio', xps.length ? Math.round(xps.reduce((a,b) => a+b, 0) / xps.length) : '—', 'de 500 posibles')}
    </div>
    <div class="card"><h2>Aciertos por tema: clase estándar frente a personalizada</h2>
      <div class="legend"><span><i style="background:var(--std)"></i>Clase estándar</span><span><i style="background:var(--game)"></i>Clase personalizada</span></div>
      <div class="hbars">${rows}</div>
      <div class="axis"><div></div><div><span>0 %</span><span>50 %</span><span>100 %</span></div><div></div></div>
    </div>
    <div class="card"><h2>Preguntas con más fallos</h2>
      ${hard.length ? `<div class="tblwrap"><table><thead><tr><th>Pregunta</th><th>Clase</th><th>Tema</th><th>Respuestas</th><th>Aciertos</th><th>Error más común</th></tr></thead><tbody>
        ${hard.map(({q,s,a}) => `<tr><td>${esc(q.texto)}</td><td><span class="pill ${q.clase}">${q.clase === 'game' ? 'Reto' : 'Estándar'}</span></td>
          <td class="small">${esc(TEMAS[q.tema]?.nombre || q.tema)}</td><td class="num">${s.n}</td>
          <td class="num"><span class="pbar"><i style="width:${a}%"></i></span>${a} %</td><td class="small">${wrong(q,s)}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">Todavía no hay respuestas.</div>'}
    </div>`;
}

/* ---------- Progreso ---------- */
function viewProgreso(){
  const list = activeStudents().map(s => ({ s, p: progOf(s.id) }));
  const score = c => c && c.total ? c.ok / c.total : -1;
  const sorters = {
    nombre: (a,b) => byName(a.s, b.s),
    avance: (a,b) => (b.p?.screen || 0) / (b.p?.totalScreens || 1) - (a.p?.screen || 0) / (a.p?.totalScreens || 1),
    std: (a,b) => score(b.p?.std) - score(a.p?.std),
    game: (a,b) => score(b.p?.game) - score(a.p?.game),
    reciente: (a,b) => (b.p?.updatedAt || 0) - (a.p?.updatedAt || 0)
  };
  list.sort(sorters[progSort]);
  const cls = c => c && c.total ? `<span class="num">${c.ok} / ${c.total}</span> <span class="muted small">(${c.n} resp.)</span>` : '<span class="muted">—</span>';

  const detail = detailId ? viewDetalle(detailId) : '';
  return `<h1>Progreso por alumno</h1><p class="sub">Toca un alumno para ver cada una de sus respuestas.</p>
    ${detail}
    <div class="card"><div class="row" style="justify-content:space-between;margin-bottom:12px">
      <label class="f" style="max-width:240px;flex:none">Ordenar por<select data-act="sort">
        ${[['nombre','Nombre'],['avance','Avance'],['std','Nota clase estándar'],['game','Nota retos'],['reciente','Actividad reciente']]
          .map(([k,l]) => `<option value="${k}" ${k === progSort ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <button class="btn ghost" data-act="csv">Descargar CSV</button></div>
    <div class="tblwrap"><table><thead><tr><th>Alumno</th><th>Etapa</th><th>Avance</th><th>Clase estándar</th><th>Retos</th><th>XP</th><th>Duelo</th><th>Formularios</th><th>Última actividad</th></tr></thead><tbody>
    ${list.map(({s,p}) => {
      const av = p ? Math.round(100 * p.screen / (p.totalScreens || 1)) : 0;
      return `<tr class="click" data-act="detail" data-id="${esc(s.id)}"><td><b>${esc(s.nombre)}</b>${s.grupo ? `<div class="muted small">${esc(s.grupo)}</div>` : ''}</td>
        <td class="small">${p ? (p.finished ? '<span class="pill ok">Terminó</span>' : esc(p.etapa)) : '<span class="pill">Sin empezar</span>'}</td>
        <td class="num"><span class="pbar"><i style="width:${av}%"></i></span>${av} %</td>
        <td>${cls(p?.std)}</td><td>${cls(p?.game)}</td>
        <td class="num">${p ? p.xp || 0 : '—'}</td><td class="num">${p ? duelOk(p) + ' / 5' : '—'}</td>
        <td class="num">${p ? formsDone(p) + ' / 5' : '—'}</td><td class="small muted">${fmtAgo(p?.updatedAt)}</td></tr>`;
    }).join('') || '<tr><td colspan="9" class="empty">No hay participantes.</td></tr>'}
    </tbody></table></div></div>`;
}

function viewDetalle(id){
  const s = D.students.find(x => x.id === id), p = progOf(id);
  if (!s) return '';
  const block = clase => {
    const qs = D.questions.filter(q => q.clase === clase).sort((a,b) => (a.tema > b.tema) - (a.tema < b.tema) || (a.orden||0) - (b.orden||0));
    if (!qs.length) return '<div class="muted">No hay preguntas en esta clase.</div>';
    return qs.map(q => {
      const a = p?.answers?.[q.id];
      const ic = !a ? '<span class="ic na">·</span>' : a.ok ? '<span class="ic ok">✓</span>' : '<span class="ic no">✗</span>';
      const ans = !a ? '<span class="muted">Sin responder</span>'
        : a.ok ? `<span class="opt-ok">${esc(q.opciones?.[a.c])}</span>`
        : `Respondió <b>${esc(q.opciones?.[a.c] ?? '?')}</b> · correcta: <span class="opt-ok">${esc(q.opciones?.[q.correcta])}</span>`;
      return `<div class="qline">${ic}<div><div class="small muted">${esc(TEMAS[q.tema]?.nombre || q.tema)}</div><div>${esc(q.texto)}</div><div class="small">${ans}</div></div></div>`;
    }).join('');
  };
  const cardsDone = FORM_KEYS.map(k => `<span class="pill ${p?.forms?.[k] ? 'ok' : ''}">${{f1:'Inicial',f2_std:'Evaluación 1',f3_std:'Opinión 1',f2_game:'Evaluación 2',f3_game:'Opinión 2'}[k]}</span>`).join(' ');
  return `<div class="card"><div class="row" style="justify-content:space-between;align-items:flex-start">
      <div><h2 style="margin-bottom:2px">${esc(s.nombre)}</h2><div class="muted small">${p ? `Empezó ${fmtAgo(p.startedAt)} · última actividad ${fmtAgo(p.updatedAt)}` : 'Todavía no ha empezado.'}</div></div>
      <div class="row">${p ? `<button class="btn ghost sm" data-act="resetprog" data-id="${esc(id)}">Borrar su progreso</button>` : ''}<button class="btn ghost sm" data-act="detail" data-id="">Cerrar</button></div></div>
    ${p ? `<div class="kpis" style="margin-top:16px">
      <div class="kpi"><div class="l">Clase estándar</div><div class="v num">${p.std?.ok ?? 0} / ${p.std?.total ?? 0}</div><div class="d">${p.std?.n ?? 0} respondidas</div></div>
      <div class="kpi"><div class="l">Retos</div><div class="v num">${p.game?.ok ?? 0} / ${p.game?.total ?? 0}</div><div class="d">${p.game?.n ?? 0} respondidos</div></div>
      <div class="kpi"><div class="l">XP</div><div class="v num">${p.xp || 0}</div><div class="d">de 500</div></div>
      <div class="kpi"><div class="l">Duelo final</div><div class="v num">${duelOk(p)} / 5</div><div class="d">autoevaluado</div></div></div>
      <div style="margin-bottom:14px"><span class="small muted">Formularios: </span>${cardsDone}</div>` : ''}
    <div class="grid2"><div><h2>Clase estándar</h2>${block('std')}</div><div><h2>Clase personalizada (retos)</h2>${block('game')}</div></div></div>`;
}

function downloadCSV(){
  const q = D.questions.slice().sort((a,b) => (a.clase > b.clase) - (a.clase < b.clase) || (a.tema > b.tema) - (a.tema < b.tema) || (a.orden||0) - (b.orden||0));
  const head = ['Alumno','Grupo','Etapa','Avance %','Estandar aciertos','Estandar total','Retos aciertos','Retos total','XP','Duelo','Formularios','Ultima actividad', ...q.map(x => x.id)];
  const rows = activeStudents().map(s => {
    const p = progOf(s.id);
    return [s.nombre, s.grupo || '', p ? (p.finished ? 'Terminó' : p.etapa) : 'Sin empezar',
      p ? Math.round(100 * p.screen / (p.totalScreens || 1)) : 0, p?.std?.ok ?? '', p?.std?.total ?? '', p?.game?.ok ?? '', p?.game?.total ?? '',
      p?.xp ?? '', p ? duelOk(p) : '', p ? formsDone(p) : '', p?.updatedAt ? new Date(p.updatedAt).toISOString() : '',
      ...q.map(x => { const a = p?.answers?.[x.id]; return a ? (a.ok ? 1 : 0) : ''; })];
  });
  const csv = [head, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type:'text/csv;charset=utf-8' }));
  a.download = `progreso-materiales-y-aceros-${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
}

/* ---------- Participantes ---------- */
function viewAlumnos(){
  const e = studentEdit;
  const cur = e ? cardsOf(e.perfil) : [];
  const editor = e ? `<div class="card"><h2>${e.id ? 'Editar participante' : 'Añadir participante'}</h2>
    <form id="studentform">
      <div class="row">
        <label class="f" style="flex:2">Nombre completo<input name="nombre" required value="${esc(e.nombre || '')}"></label>
        <label class="f">Grupo o sección (opcional)<input name="grupo" value="${esc(e.grupo || '')}"></label>
      </div>
      <div style="margin:14px 0 6px" class="small muted"><b>Tarjetas que se resaltan en la clase personalizada</b> (déjalas vacías si no tiene perfil)</div>
      <div class="checks">${CARD_KEYS.map(k => `<label><input type="checkbox" name="card" value="${k}" ${cur.includes(k) ? 'checked' : ''}> ${k === 'DESAFIO' ? 'DESAFÍO' : k}</label>`).join('')}</div>
      <div class="row" style="margin-top:14px"><label class="f">Notas internas (solo las ven los creadores)<input name="notas" value="${esc(e.notas || '')}"></label></div>
      ${e.id ? `<div class="checks" style="margin-top:12px"><label><input type="checkbox" name="activo" ${e.activo !== false ? 'checked' : ''}> Activo (aparece en la página de alumnos)</label></div>` : ''}
      <div class="row" style="margin-top:16px"><button class="btn" type="submit">Guardar</button><button class="btn ghost" type="button" data-act="st-cancel">Cancelar</button></div>
    </form></div>` : '';
  const list = D.students.slice().sort(byName);
  return `<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:16px">
      <div><h1>Participantes</h1><p class="sub" style="margin:0">Solo los creadores pueden añadir o cambiar participantes. Los alumnos solo eligen su nombre de esta lista.</p></div>
      ${e ? '' : '<button class="btn" data-act="st-new">+ Añadir participante</button>'}</div>
    ${editor}
    <div class="card"><div class="tblwrap"><table><thead><tr><th>Nombre</th><th>Tarjetas</th><th>Grupo</th><th>Estado</th><th>Progreso</th><th></th></tr></thead><tbody>
    ${list.map(s => { const p = progOf(s.id); return `<tr>
      <td><b>${esc(s.nombre)}</b>${s.notas ? `<div class="muted small">${esc(s.notas)}</div>` : ''}</td>
      <td>${cardsOf(s.perfil).map(k => `<span class="pill">${k}</span>`).join(' ') || '<span class="muted small">—</span>'}</td>
      <td class="small">${esc(s.grupo || '—')}</td>
      <td>${s.activo !== false ? '<span class="pill ok">Activo</span>' : '<span class="pill">Inactivo</span>'}</td>
      <td class="small">${p ? (p.finished ? 'Terminó' : `${Math.round(100 * p.screen / (p.totalScreens || 1))} %`) : '<span class="muted">Sin empezar</span>'}</td>
      <td class="acts"><button class="btn ghost sm" data-act="st-edit" data-id="${esc(s.id)}">Editar</button>
        <button class="btn ghost sm" data-act="st-toggle" data-id="${esc(s.id)}">${s.activo !== false ? 'Desactivar' : 'Activar'}</button>
        <button class="btn danger sm" data-act="st-del" data-id="${esc(s.id)}">Eliminar</button></td></tr>`; }).join('')
      || '<tr><td colspan="6" class="empty">Todavía no hay participantes.</td></tr>'}
    </tbody></table></div></div>`;
}

/* ---------- Preguntas ---------- */
function viewPreguntas(){
  const qs = questionStats();
  const e = questionEdit;
  const opts = e ? (e.opciones || []).join('\n') : '';
  const editor = e ? `<div class="card"><h2>${e.id ? 'Editar pregunta' : 'Nueva pregunta o reto'}</h2>
    <form id="questionform">
      <div class="row">
        <label class="f">Clase<select name="clase">${Object.entries(CLASES).map(([k,l]) => `<option value="${k}" ${e.clase === k ? 'selected' : ''}>${l}${k === 'game' ? ' (reto)' : ''}</option>`).join('')}</select></label>
        <label class="f">Tema<select name="tema">${Object.entries(TEMAS).map(([k,T]) => `<option value="${k}" ${e.tema === k ? 'selected' : ''}>${esc(T.nombre)}</option>`).join('')}</select></label>
        <label class="f" style="max-width:110px">Orden<input name="orden" type="number" value="${esc(e.orden ?? 1)}"></label>
        <label class="f" style="max-width:110px">Puntos<input name="puntos" type="number" min="1" value="${esc(e.puntos ?? 1)}"></label>
      </div>
      <div class="row" style="margin-top:12px"><label class="f">Pregunta<textarea name="texto" required>${esc(e.texto || '')}</textarea></label></div>
      <div class="row" style="margin-top:12px">
        <label class="f">Opciones (una por línea, de 2 a 6)<textarea name="opciones" id="q-opts" rows="6" required>${esc(opts)}</textarea></label>
        <label class="f" style="max-width:280px">Respuesta correcta<select name="correcta" id="q-correct"></select></label>
      </div>
      <div class="row" style="margin-top:12px"><label class="f">Explicación (se muestra al responder)<input name="explicacion" value="${esc(e.explicacion || '')}"></label></div>
      <div class="checks" style="margin-top:12px"><label><input type="checkbox" name="activo" ${e.activo !== false ? 'checked' : ''}> Activa (aparece en la página de alumnos)</label></div>
      <div class="row" style="margin-top:16px"><button class="btn" type="submit">Guardar</button><button class="btn ghost" type="button" data-act="q-cancel">Cancelar</button></div>
    </form></div>` : '';
  const list = D.questions.filter(q => (!qFilter.clase || q.clase === qFilter.clase) && (!qFilter.tema || q.tema === qFilter.tema))
    .sort((a,b) => (a.clase > b.clase) - (a.clase < b.clase) || (a.tema > b.tema) - (a.tema < b.tema) || (a.orden||0) - (b.orden||0));
  const missing = DEFAULT_QUESTIONS.filter(d => !D.questions.some(q => q.id === d.id)).length;
  return `<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:16px">
      <div><h1>Preguntas y retos</h1><p class="sub" style="margin:0">En la clase estándar salen como repaso tras cada tema; en la personalizada, como retos al final de cada región. Se califican al instante.</p></div>
      ${e ? '' : '<button class="btn" data-act="q-new">+ Nueva pregunta</button>'}</div>
    ${editor}
    <div class="card">
      <div class="row" style="margin-bottom:12px">
        <label class="f" style="max-width:240px">Clase<select data-act="qf" data-k="clase"><option value="">Todas</option>${Object.entries(CLASES).map(([k,l]) => `<option value="${k}" ${qFilter.clase === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="f" style="max-width:280px">Tema<select data-act="qf" data-k="tema"><option value="">Todos</option>${Object.entries(TEMAS).map(([k,T]) => `<option value="${k}" ${qFilter.tema === k ? 'selected' : ''}>${esc(T.nombre)}</option>`).join('')}</select></label>
        ${missing ? `<button class="btn ghost" data-act="q-restore">Recuperar ${missing} pregunta${missing > 1 ? 's' : ''} por defecto</button>` : ''}
      </div>
      <div class="tblwrap"><table><thead><tr><th>Clase</th><th>Tema</th><th>Pregunta y opciones</th><th>Aciertos</th><th>Estado</th><th></th></tr></thead><tbody>
      ${list.map(q => { const s = qs[q.id]; const a = s && s.n ? Math.round(100 * s.ok / s.n) : null; return `<tr>
        <td><span class="pill ${q.clase}">${q.clase === 'game' ? 'Reto' : 'Estándar'}</span></td>
        <td class="small">${esc(TEMAS[q.tema]?.nombre || q.tema)}</td>
        <td><b>${esc(q.texto)}</b><div class="small">${(q.opciones || []).map((o,j) => j === +q.correcta ? `<span class="opt-ok">✓ ${esc(o)}</span>` : `<span class="muted">${esc(o)}</span>`).join(' · ')}</div></td>
        <td class="num small">${a === null ? '<span class="muted">—</span>' : `${a} % <span class="muted">(${s.n})</span>`}</td>
        <td>${q.activo !== false ? '<span class="pill ok">Activa</span>' : '<span class="pill">Oculta</span>'}</td>
        <td class="acts"><button class="btn ghost sm" data-act="q-edit" data-id="${esc(q.id)}">Editar</button>
          <button class="btn ghost sm" data-act="q-toggle" data-id="${esc(q.id)}">${q.activo !== false ? 'Ocultar' : 'Activar'}</button>
          <button class="btn danger sm" data-act="q-del" data-id="${esc(q.id)}">Eliminar</button></td></tr>`; }).join('')
        || '<tr><td colspan="6" class="empty">No hay preguntas con ese filtro.</td></tr>'}
      </tbody></table></div></div>`;
}

function bindQuestionEditor(){
  const ta = $('#q-opts'), sel = $('#q-correct');
  if (!ta) return;
  const fill = keep => {
    const lines = ta.value.split('\n').map(s => s.trim()).filter(Boolean);
    const prev = keep ?? +sel.value;
    sel.innerHTML = lines.map((l,j) => `<option value="${j}" ${j === prev ? 'selected' : ''}>${j+1}. ${esc(l)}</option>`).join('');
  };
  fill(+(questionEdit?.correcta ?? 0));
  ta.addEventListener('input', () => fill());
}

/* ---------- Formularios ---------- */
function viewFormularios(){
  const v = k => D.forms[k] ?? FORMS_DEFAULT[k] ?? '';
  const field = (k, l, d) => `<label class="f">${l}<input name="${k}" type="url" placeholder="https://docs.google.com/forms/d/e/…/viewform" value="${esc(v(k))}"><span class="small" style="font-weight:500">${d}</span></label>`;
  return `<h1>Formularios de Google</h1><p class="sub">Los alumnos ven cada formulario dentro de la plataforma y además un botón para abrirlo en otra pestaña.</p>
    <div class="card"><form id="formsform" style="display:grid;gap:16px">
      ${field('f1','1 · Cuestionario inicial','Se muestra justo después de que el alumno elige su nombre.')}
      ${field('f2','2 · Evaluación','Al terminar cada clase (se responde dos veces).')}
      ${field('f3','3 · Opinión sobre la clase','Al terminar cada clase (se responde dos veces).')}
      <div class="notice info small" style="margin:0">Usa el enlace largo que termina en <b>/viewform</b> (en Google Forms: Enviar → pestaña del enlace, sin acortar). Con ese enlace el formulario se ve dentro de la página. Un enlace corto <b>forms.gle</b> también sirve, pero entonces solo se abre en otra pestaña.</div>
      <div><button class="btn" type="submit">Guardar enlaces</button></div>
    </form></div>`;
}

/* ---------- Creadores ---------- */
function viewCreadores(){
  const admin = D.me.rol === 'admin';
  const order = { pendiente:0, aprobado:1, rechazado:2 };
  const list = D.creators.slice().sort((a,b) => (order[a.estado] ?? 3) - (order[b.estado] ?? 3) || byName(a,b));
  const estado = s => ({ aprobado:'<span class="pill ok">Aprobado</span>', pendiente:'<span class="pill warn">Pendiente</span>', rechazado:'<span class="pill no">Rechazado</span>' }[s] || esc(s));
  return `<h1>Creadores</h1><p class="sub">Quién puede entrar al panel. Cualquier creador puede aprobar o rechazar solicitudes; solo el administrador cambia roles o elimina cuentas.</p>
    <div class="card"><h2>Tu perfil</h2><form id="meform" class="row">
      <label class="f">Nombre<input name="nombre" required value="${esc(D.me.nombre)}"></label>
      <label class="f">Correo<input value="${esc(D.me.email)}" disabled></label>
      <button class="btn" type="submit">Guardar</button></form></div>
    <div class="card"><div class="tblwrap"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Registro</th><th></th></tr></thead><tbody>
    ${list.map(c => {
      const self = c.id === D.me.uid, isAdm = c.rol === 'admin';
      const acts = [];
      if (!self && !isAdm && c.estado !== 'aprobado') acts.push(`<button class="btn sm" data-act="cr-state" data-id="${c.id}" data-v="aprobado">Aprobar</button>`);
      if (!self && !isAdm && c.estado !== 'rechazado') acts.push(`<button class="btn ghost sm" data-act="cr-state" data-id="${c.id}" data-v="rechazado">${c.estado === 'aprobado' ? 'Quitar acceso' : 'Rechazar'}</button>`);
      if (admin && !self && c.estado === 'aprobado') acts.push(`<button class="btn ghost sm" data-act="cr-role" data-id="${c.id}" data-v="${isAdm ? 'creador' : 'admin'}">${isAdm ? 'Quitar admin' : 'Hacer admin'}</button>`);
      if (admin && !self) acts.push(`<button class="btn danger sm" data-act="cr-del" data-id="${c.id}">Eliminar</button>`);
      return `<tr><td><b>${esc(c.nombre)}</b>${self ? ' <span class="muted small">(tú)</span>' : ''}</td><td class="small">${esc(c.email)}</td>
        <td>${isAdm ? '<span class="pill std">Admin</span>' : '<span class="pill">Creador</span>'}</td><td>${estado(c.estado)}</td>
        <td class="small muted">${fmtAgo(c.createdAt)}</td><td class="acts">${acts.join('')}</td></tr>`;
    }).join('')}
    </tbody></table></div></div>`;
}

/* ======================================================================
   ESCRITURAS
   ====================================================================== */
async function run(fn, ok){
  try { await fn(); if (ok) toast(ok); }
  catch (e) { console.error(e); toast(e.code === 'permission-denied' ? 'Sin permiso para hacer eso.' : 'Error: ' + e.message); }
}

async function seed(){
  const batch = F.writeBatch(F.db), now = Date.now();
  if (!D.students.length) DEFAULT_ROSTER.forEach(s => batch.set(F.doc(F.db, 'students', s.id),
    { nombre: s.nombre, perfil: s.perfil, grupo:'', notas:'', activo:true, createdAt: now, createdBy: D.me.uid }));
  if (!D.questions.length) DEFAULT_QUESTIONS.forEach(({ id, ...q }) => batch.set(F.doc(F.db, 'questions', id), q));
  if (!D.loaded.forms || !Object.keys(D.forms).length) batch.set(F.doc(F.db, 'settings', 'forms'), { ...FORMS_DEFAULT });
  await batch.commit();
}

app.addEventListener('submit', async e => {
  const f = e.target; e.preventDefault();
  const fd = new FormData(f);
  if (f.id === 'studentform') {
    const nombre = fd.get('nombre').trim().replace(/\s+/g, ' ');
    const dup = D.students.find(s => norm(s.nombre) === norm(nombre) && s.id !== studentEdit.id);
    if (dup && !confirm(`Ya existe "${dup.nombre}". ¿Guardar de todos modos?`)) return;
    const data = { nombre, grupo: fd.get('grupo').trim(), notas: fd.get('notas').trim(), perfil: perfilFrom(fd.getAll('card')) };
    const id = studentEdit.id;
    if (id) data.activo = fd.get('activo') === 'on';
    await run(async () => {
      if (id) await F.updateDoc(F.doc(F.db, 'students', id), data);
      else await F.addDoc(F.collection(F.db, 'students'), { ...data, activo:true, createdAt: Date.now(), createdBy: D.me.uid });
    }, id ? 'Participante actualizado' : 'Participante añadido');
    studentEdit = null; draw();
  }
  if (f.id === 'questionform') {
    const opciones = fd.get('opciones').split('\n').map(s => s.trim()).filter(Boolean);
    if (opciones.length < 2 || opciones.length > 6) { toast('Pon entre 2 y 6 opciones'); return; }
    const data = { clase: fd.get('clase'), tema: fd.get('tema'), orden: +fd.get('orden') || 1, puntos: Math.max(1, +fd.get('puntos') || 1),
      texto: fd.get('texto').trim(), opciones, correcta: Math.min(+fd.get('correcta') || 0, opciones.length - 1),
      explicacion: fd.get('explicacion').trim(), activo: fd.get('activo') === 'on' };
    const id = questionEdit.id;
    await run(async () => {
      if (id) await F.setDoc(F.doc(F.db, 'questions', id), data);
      else await F.addDoc(F.collection(F.db, 'questions'), data);
    }, 'Pregunta guardada');
    questionEdit = null; draw();
  }
  if (f.id === 'formsform') {
    await run(() => F.setDoc(F.doc(F.db, 'settings', 'forms'), { f1: fd.get('f1').trim(), f2: fd.get('f2').trim(), f3: fd.get('f3').trim() }), 'Enlaces guardados');
  }
  if (f.id === 'meform') {
    await run(() => F.updateDoc(F.doc(F.db, 'creators', D.me.uid), { nombre: fd.get('nombre').trim() }), 'Perfil actualizado');
  }
});

app.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.act === 'sort') { progSort = t.value; t.blur(); draw(); }
  if (t.dataset.act === 'qf') { qFilter[t.dataset.k] = t.value; t.blur(); draw(); }
});

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b || b.tagName === 'SELECT') return;
  const a = b.dataset.act, id = b.dataset.id;
  switch (a) {
    case 'tab': TAB = b.dataset.k; studentEdit = questionEdit = null; draw(); window.scrollTo(0,0); break;
    case 'logout': A.signOut(A.auth); break;
    case 'reload': location.reload(); break;
    case 'auth-login': showAuth('login'); break;
    case 'auth-register': showAuth('register'); break;
    case 'auth-reset': {
      const email = (document.querySelector('#authform [name=email]')?.value || '').trim();
      const msg = $('#authmsg');
      if (!email) { msg.className = 'msg err'; msg.textContent = 'Escribe tu correo arriba y vuelve a pulsar "Olvidé mi contraseña".'; break; }
      try { await A.sendPasswordResetEmail(A.auth, email); msg.className = 'msg ok'; msg.textContent = 'Te enviamos un correo para cambiar la contraseña.'; }
      catch (err) { msg.className = 'msg err'; msg.textContent = authMsg(err); }
      break;
    }
    case 'seed': b.disabled = true; await run(seed, 'Datos iniciales cargados'); break;

    case 'detail': detailId = id || null; draw(); if (id) window.scrollTo(0,0); break;
    case 'csv': downloadCSV(); break;
    case 'resetprog':
      if (confirm('¿Borrar el progreso guardado de este alumno? Sus respuestas desaparecerán del panel.'))
        await run(() => F.deleteDoc(F.doc(F.db, 'progress', id)), 'Progreso borrado');
      break;

    case 'st-new': studentEdit = {}; draw(); $('#studentform [name=nombre]')?.focus(); break;
    case 'st-edit': studentEdit = { ...D.students.find(s => s.id === id) }; draw(); window.scrollTo(0,0); $('#studentform [name=nombre]')?.focus(); break;
    case 'st-cancel': studentEdit = null; draw(); break;
    case 'st-toggle': { const s = D.students.find(x => x.id === id);
      await run(() => F.updateDoc(F.doc(F.db, 'students', id), { activo: s.activo === false }), s.activo === false ? 'Activado' : 'Desactivado'); break; }
    case 'st-del': { const s = D.students.find(x => x.id === id);
      if (confirm(`¿Eliminar a "${s.nombre}"? Si solo quieres ocultarlo de la lista de alumnos, usa Desactivar.`))
        await run(() => F.deleteDoc(F.doc(F.db, 'students', id)), 'Participante eliminado');
      break; }

    case 'q-new': questionEdit = { clase: qFilter.clase || 'std', tema: qFilter.tema || 't1', orden: 1, puntos: 1, opciones: [], correcta: 0, activo: true }; draw(); break;
    case 'q-edit': questionEdit = { ...D.questions.find(q => q.id === id) }; draw(); window.scrollTo(0,0); break;
    case 'q-cancel': questionEdit = null; draw(); break;
    case 'q-toggle': { const q = D.questions.find(x => x.id === id);
      await run(() => F.updateDoc(F.doc(F.db, 'questions', id), { activo: q.activo === false }), q.activo === false ? 'Pregunta activada' : 'Pregunta oculta'); break; }
    case 'q-del':
      if (confirm('¿Eliminar esta pregunta? Si ya la respondieron, esas respuestas dejarán de contar en el análisis. Para quitarla sin perder datos usa Ocultar.'))
        await run(() => F.deleteDoc(F.doc(F.db, 'questions', id)), 'Pregunta eliminada');
      break;
    case 'q-restore': {
      const batch = F.writeBatch(F.db);
      DEFAULT_QUESTIONS.filter(d => !D.questions.some(q => q.id === d.id)).forEach(({ id, ...q }) => batch.set(F.doc(F.db, 'questions', id), q));
      await run(() => batch.commit(), 'Preguntas recuperadas'); break;
    }

    case 'cr-state': await run(() => F.updateDoc(F.doc(F.db, 'creators', id), { estado: b.dataset.v }), b.dataset.v === 'aprobado' ? 'Creador aprobado' : 'Acceso retirado'); break;
    case 'cr-role': await run(() => F.updateDoc(F.doc(F.db, 'creators', id), { rol: b.dataset.v }), 'Rol actualizado'); break;
    case 'cr-del': { const c = D.creators.find(x => x.id === id);
      if (confirm(`¿Eliminar el perfil de creador de ${c.nombre}? (Su cuenta de acceso seguirá existiendo, pero sin permisos.)`))
        await run(() => F.deleteDoc(F.doc(F.db, 'creators', id)), 'Creador eliminado');
      break; }
  }
});

/* Tooltip del gráfico */
const tip = $('#tip');
document.addEventListener('mousemove', e => {
  const t = e.target.closest('[data-tip]');
  if (!t) { tip.classList.remove('on'); return; }
  tip.textContent = t.dataset.tip; tip.classList.add('on');
  tip.style.left = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8) + 'px';
  tip.style.top = (e.clientY + 16) + 'px';
});

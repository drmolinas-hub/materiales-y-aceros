/* Inicialización compartida de Firebase (alumnos y creadores). */
import { firebaseConfig } from './config.js';

const V = '10.12.2';
const BASE = `https://www.gstatic.com/firebasejs/${V}/`;

export const FB_READY = !!firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('PENDIENTE') && !!firebaseConfig.projectId;

let _app = null, _fs = null, _db = null;

/* Carga perezosa: si Firebase no está configurado, la página funciona sin él. */
export async function firestore(){
  if (!FB_READY) return null;
  if (_db) return { db: _db, ..._fs };
  const { initializeApp } = await import(BASE + 'firebase-app.js');
  _fs = await import(BASE + 'firebase-firestore.js');
  _app = _app || initializeApp(firebaseConfig);
  _db = _fs.getFirestore(_app);
  return { db: _db, ..._fs };
}

export async function authMod(){
  if (!FB_READY) return null;
  await firestore();
  const a = await import(BASE + 'firebase-auth.js');
  return { auth: a.getAuth(_app), ...a };
}

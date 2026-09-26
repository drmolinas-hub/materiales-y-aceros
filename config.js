/* ======================================================================
   CONFIGURACIÓN — pega aquí el bloque firebaseConfig de tu proyecto
   (Firebase → Configuración del proyecto → Tus apps → Web).
   Estos datos no son secretos: la protección la dan las reglas de Firestore.
   ====================================================================== */
export const firebaseConfig = {
  apiKey: "[PENDIENTE]",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

/* Enlaces de los Google Forms por defecto. Los creadores pueden cambiarlos
   desde el panel (pestaña Formularios) y ahí mandan sobre estos. */
export const FORMS_DEFAULT = {
  f1: '', // cuestionario inicial (diagnóstico)
  f2: '', // evaluación
  f3: ''  // opinión / percepción
};

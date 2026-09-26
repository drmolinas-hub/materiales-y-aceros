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
  f1: 'https://docs.google.com/forms/d/e/1FAIpQLSeVxCLQy6yfPmgwQ3E5X3uNT1OIT78TetInOVQEtuPwmRQ7_Q/viewform', // cuestionario inicial (diagnóstico)
  f2: 'https://docs.google.com/forms/d/e/1FAIpQLSfjrsIdWQVsbuERBPOh8kvz6QUxlf7SJc9Q9OoV769HPaCeXw/viewform', // evaluación
  f3: 'https://docs.google.com/forms/d/e/1FAIpQLSddPD3OPygIdk3vP-2XAhSKWQUYVZm5YaY6uk0NnkOY5OaD9g/viewform'  // opinión / percepción
};

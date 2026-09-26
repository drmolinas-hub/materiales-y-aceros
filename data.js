/* ======================================================================
   DATOS POR DEFECTO
   Se usan para sembrar Firestore desde el panel de creadores y como
   respaldo si la base de datos aún no está configurada.
   ====================================================================== */

/* Roster original (el campo "perfil" decide qué tarjeta se resalta en la clase 2) */
export const DEFAULT_ROSTER = [
  {"id": "1", "nombre": "Nadiesda Yailin Fuentes Hernandez", "perfil": ""},
  {"id": "2", "nombre": "Dayana Michell Amaya Lopez", "perfil": ""},
  {"id": "3", "nombre": "Angie Michelle Altamirano Aguilar", "perfil": ""},
  {"id": "4", "nombre": "Juan Sebastián Meléndez Cruz", "perfil": ""},
  {"id": "5", "nombre": "Carlos Miguel Cantillano Zelaya", "perfil": "Mixto: OBJETIVO + CHARLA"},
  {"id": "6", "nombre": "Marcelo Andre Sabillon Muñoz", "perfil": "CHARLA"},
  {"id": "7", "nombre": "Luis Eduardo Sosa Tello", "perfil": "OBJETIVO"},
  {"id": "8", "nombre": "André Yan Po Delcid Sú", "perfil": "CHARLA"},
  {"id": "9", "nombre": "Josue Yassir Bautista Antunez", "perfil": "OBJETIVO"},
  {"id": "10", "nombre": "Kaylee Fu", "perfil": "Mixto: OBJETIVO + SECRETO + CHARLA"},
  {"id": "11", "nombre": "Jose Andres Ortiz Rodriguez", "perfil": "CHARLA"},
  {"id": "12", "nombre": "Yiny Ramón Orellana Santos", "perfil": ""},
  {"id": "13", "nombre": "Jean Carlos Fernandez Fernandez", "perfil": "SECRETO"},
  {"id": "14", "nombre": "Kelvin Jafeth Melgar Quiroz", "perfil": "CHARLA"},
  {"id": "15", "nombre": "José Fernando Hernández Sánchez", "perfil": ""},
  {"id": "16", "nombre": "José David Velásquez Gonzales", "perfil": ""},
  {"id": "17", "nombre": "Ada Marina Ruiz Rivera", "perfil": ""},
  {"id": "18", "nombre": "Angie Cecilia Díaz Betancourth", "perfil": ""}
];

/* Temas de la unidad. "region" = índice de la región de la clase personalizada. */
export const TEMAS = {
  t1: { nombre: 'Propiedades mecánicas',      region: 0 },
  t2: { nombre: 'Estructuras cristalinas',    region: 1 },
  t3: { nombre: 'Curva esfuerzo-deformación', region: 2 },
  t4: { nombre: 'Siderurgia y carbono',       region: 3 },
  t5: { nombre: 'Nomenclatura AISI-SAE',      region: 3 },
  t6: { nombre: 'Aceros especiales',          region: 4 }
};

export const CLASES = { std: 'Clase estándar', game: 'Clase personalizada' };

/* Banco de preguntas. clase: std = preguntas de repaso, game = retos.
   correcta = índice de la opción correcta. */
const q = (id, clase, tema, orden, texto, opciones, correcta, explicacion) =>
  ({ id, clase, tema, orden, texto, opciones, correcta, explicacion, puntos: 1, activo: true });

export const DEFAULT_QUESTIONS = [
  // ---------- Clase estándar ----------
  q('std-t1-1','std','t1',1,'¿Qué propiedad permite estirar un metal para convertirlo en alambre?',
    ['Maleabilidad','Ductilidad','Elasticidad','Dureza'],1,
    'La ductilidad es estirarse en hilos; la maleabilidad es reducirse a láminas.'),
  q('std-t1-2','std','t1',2,'Un material que se fractura sin deformarse antes es…',
    ['Tenaz','Dúctil','Frágil','Elástico'],2,
    'La fragilidad es lo opuesto a la tenacidad: se rompe sin deformación previa.'),
  q('std-t1-3','std','t1',3,'Verdadero o falso: en el enlace metálico los electrones forman una nube común, y por eso los metales conducen la electricidad.',
    ['Verdadero','Falso'],0,
    'La nube de electrones compartida explica la conductividad y la ductilidad de los metales.'),

  q('std-t2-1','std','t2',1,'¿Cuántos átomos tiene una celda BCC?',
    ['1','2','4','6'],1,
    'BCC: uno por las esquinas (8 × 1/8) más uno en el centro = 2.'),
  q('std-t2-2','std','t2',2,'¿A qué temperatura el hierro pasa de BCC a FCC?',
    ['723 °C','912 °C','1 394 °C','1 538 °C'],1,
    'A 912 °C el hierro α (BCC) se transforma en hierro γ (FCC).'),
  q('std-t2-3','std','t2',3,'¿Cuál de las estructuras cúbicas es la más dúctil?',
    ['BCC','FCC','HCP'],1,
    'FCC es la más compacta de las cúbicas y la más dúctil.'),

  q('std-t3-1','std','t3',1,'En la zona elástica, la deformación…',
    ['Es permanente','Se recupera al retirar la carga','Provoca la fractura','No existe'],1,
    'Zona elástica = ley de Hooke: sin deformación permanente.'),
  q('std-t3-2','std','t3',2,'¿Cómo se llama el punto más alto de la curva esfuerzo-deformación?',
    ['Límite elástico','Resistencia última (UTS)','Fractura','Módulo de Young'],1,
    'La UTS es el esfuerzo máximo que soporta el material.'),

  q('std-t4-1','std','t4',1,'¿Qué producto sale del alto horno con cerca de un 4 % de carbono?',
    ['Acero','Arrabio','Ferrita','Acero inoxidable'],1,
    'El arrabio es el hierro de primera fusión; el convertidor luego controla su carbono.'),
  q('std-t4-2','std','t4',2,'Un material con 3 % de carbono es…',
    ['Hierro puro','Acero','Hierro colado (fundición)'],2,
    'Por encima de 2.1 % C ya es hierro colado.'),

  q('std-t5-1','std','t5',1,'¿Cuánto carbono tiene un acero AISI 1020?',
    ['2 %','0.20 %','20 %','0.02 %'],1,
    'Los dos últimos dígitos son el % de carbono × 100: 20 → 0.20 %.'),
  q('std-t5-2','std','t5',2,'En un acero de baja aleación, ¿qué aleante aporta tenacidad?',
    ['Cromo (Cr)','Manganeso (Mn)','Molibdeno (Mo)','Níquel (Ni)'],2,
    'Cr → dureza, Mn → resistencia, Mo → tenacidad, Ni → anticorrosión.'),

  q('std-t6-1','std','t6',1,'El acero inoxidable resiste la corrosión sobre todo gracias al…',
    ['Carbono','Cromo','Tungsteno','Manganeso'],1,
    'El cromo (a veces con níquel) es lo que lo hace inoxidable.'),
  q('std-t6-2','std','t6',2,'Un acero HSS tipo T contiene principalmente…',
    ['Molibdeno','Tungsteno','Níquel','Cromo'],1,
    'Tipo T: 12–18 % de tungsteno (W). Tipo M: hasta 10 % de molibdeno.'),

  // ---------- Clase personalizada (retos) ----------
  q('game-t1-1','game','t1',1,'Tienes que fabricar papel de aluminio muy delgado. ¿Qué propiedad necesitas?',
    ['Ductilidad','Maleabilidad','Fragilidad','Dureza'],1,
    'Reducir a láminas = maleabilidad.'),
  q('game-t1-2','game','t1',2,'Una regla metálica se dobla un poco y vuelve a su forma. ¿Qué propiedad lo permite?',
    ['Elasticidad','Plasticidad','Fragilidad','Conductividad'],0,
    'Recuperar la forma al quitar la fuerza es elasticidad.'),

  q('game-t2-1','game','t2',1,'Un metal cambia de estructura cristalina al calentarse. ¿Cómo se llama eso?',
    ['Alotropía','Ductilidad','Aleación','Corrosión'],0,
    'Un material alotrópico cambia de estructura con la temperatura, como el hierro a 912 °C.'),
  q('game-t2-2','game','t2',2,'Elige el metal que tiene estructura hexagonal compacta (HCP).',
    ['Hierro α','Cobre','Titanio','Hierro γ'],2,
    'Magnesio, titanio y zinc son HCP. El hierro α es BCC; el cobre y el hierro γ, FCC.'),

  q('game-t3-1','game','t3',1,'Diseñas un gancho que nunca debe quedar doblado. ¿Hasta dónde puede llegar el esfuerzo?',
    ['Por debajo del límite elástico','Hasta la UTS','Hasta la fractura','Da igual'],0,
    'Por encima del límite elástico la deformación ya es permanente.'),
  q('game-t3-2','game','t3',2,'Al pasar el límite elástico, el metal se hace más resistente mientras se deforma. ¿Cómo se llama?',
    ['Endurecimiento por deformación','Temple','Corrosión','Alotropía'],0,
    'En la zona plástica aumentan las dislocaciones y el metal se endurece.'),

  q('game-t4-1','game','t4',1,'¿En qué porcentaje de carbono está la frontera entre el acero y el hierro colado?',
    ['0.02 %','0.8 %','2.1 %','6 %'],2,
    'Acero: 0.02–2.1 % C. Hierro colado: 2.1–6 % C.'),
  q('game-t4-2','game','t4',2,'Si le subes el carbono a un acero, se vuelve…',
    ['Más blando y dúctil','Más duro y más frágil','Inoxidable','Más ligero'],1,
    'Más carbono = más duro… y más frágil.'),

  q('game-t5-1','game','t5',1,'Descifra el código 1080. ¿Para qué pieza lo usarías?',
    ['Láminas de carrocería','Un cigüeñal','Resortes y herramientas'],2,
    '1080 = 0.80 % C, acero de alto carbono: resortes y herramientas.'),
  q('game-t5-2','game','t5',2,'Necesitas un bloque de motor fabricado en molde. ¿Qué material eliges?',
    ['Acero 1020','Hierro colado','Inoxidable 304','Acero HSS'],1,
    'El hierro colado se obtiene por vaciado en molde: bloques de motor y bases de máquina.'),

  q('game-t6-1','game','t6',1,'Equipa un bisturí de hospital.',
    ['Acero inoxidable','Acero HSS','Hierro colado'],0,
    'Instrumental médico: inoxidable, porque no se corroe y se esteriliza bien.'),
  q('game-t6-2','game','t6',2,'Una fresa que corta a alta velocidad y se calienta mucho.',
    ['Inoxidable 304','Acero HSS','Acero 1020'],1,
    'HSS mantiene la dureza a alta velocidad y temperatura.')
];

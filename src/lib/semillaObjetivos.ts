// Catálogo de objetivos, traído de la lista del otro programa.
//
// Allí eran ~160 fichas métricas porque el tipo de meta iba pegado al nombre: "Rotación
// interna hombro F=", "F+", "M=", "M+". Aquí el tipo es un campo, así que la biblioteca
// guarda el ESPACIO —articulación × métrica— y el movimiento, el lado y la meta se eligen
// al asignarlo a un paciente. De 160 fichas a 20.
//
// TRES FAMILIAS, Y SOLO UNA LLEVA NÚMERO:
//
//   metrico      Fuerza o movilidad. Lo cierra una medición de un test.
//   fase         Progresión de una tanda del programa a la siguiente. La avanza el
//                entrenador, no un número.
//   cualitativo  "Aprender a hacer el puente de glúteo". Se cumple o no.
//
// Ver docs/propuestas/PROPUESTA-OBJETIVOS.md.

/**
 * Movimientos que hacen falta y NO están en el árbol de etiquetas.
 *
 * Hoy existe "Rotación" pero no rotación interna ni externa, que son media lista de VALD.
 * Se crean como hijas del movimiento raíz que les corresponde para no ensuciar el primer
 * nivel: buscar "Rotación" tiene que seguir encontrando las dos.
 */
export const MOVIMIENTOS_NUEVOS: { nombre: string, padre: string }[] = [
  { nombre: 'Rotación interna', padre: 'Rotación' },
  { nombre: 'Rotación externa', padre: 'Rotación' },
  { nombre: 'Flexión lateral', padre: 'Flexión' },
  { nombre: 'Flexión plantar', padre: 'Flexión' },
  { nombre: 'Dorsiflexión', padre: 'Flexión' },
  { nombre: 'Desviación radial', padre: 'Abducción' },
  { nombre: 'Desviación cubital', padre: 'Adducción' },
]

/**
 * Patologías que faltan en el árbol.
 *
 * El árbol entero es musculoesquelético: 21 patologías y ninguna neurológica. Sin estas
 * cinco, un paciente que ha tenido un ictus no se puede ni etiquetar, y por tanto no
 * aparece en ningún filtro, ni le propone objetivos la ficha, ni le desaconseja nada un
 * test. Van sueltas y no colgando de "Ictus" a propósito: la hemiparesia, la espasticidad
 * y el riesgo de caída también vienen de un traumatismo, de una esclerosis o de la edad, y
 * colgarlas del ictus obligaría a duplicarlas el día que entre el primer Parkinson.
 *
 * "Riesgo de caída" no es un diagnóstico, pero es la etiqueta que hace falta para que un
 * test positivo pueda desaconsejar los saltos y el equilibrio sin apoyo.
 */
export const PATOLOGIAS_NUEVAS: { nombre: string, padre?: string }[] = [
  { nombre: 'Ictus' },
  { nombre: 'Hemiparesia' },
  { nombre: 'Espasticidad' },
  { nombre: 'Riesgo de caída' },
  { nombre: 'Subluxación de hombro' },
]

export type EspacioSemilla = {
  /** Articulación o zona, tal cual está en el árbol de etiquetas. */
  articulacion: string
  metrica: 'fuerza' | 'movilidad'
  nombre: string
  descripcion: string
  /** Movimientos que ofrece al crear una meta. Por nombre de etiqueta. */
  movimientos: string[]
}

/**
 * Los movimientos de cada articulación, sacados de tu lista.
 *
 * Se definen una vez y sirven para las dos métricas: los movimientos de un hombro son los
 * mismos midas fuerza o recorrido. Escribirlos dos veces era garantizar que un día uno de
 * los dos se quedara corto.
 */
export const MOVIMIENTOS: Record<string, string[]> = {
  'Hombro': ['Flexión', 'Extensión', 'Abducción', 'Adducción', 'Rotación interna', 'Rotación externa'],
  'Escapular': ['Retracción', 'Protracción'],
  'Codo': ['Flexión', 'Extensión'],
  'Muñeca': ['Flexión', 'Extensión', 'Pronación', 'Supinación', 'Desviación radial', 'Desviación cubital'],
  'Mano': ['Flexión', 'Extensión'],
  'Cervical': ['Rotación', 'Flexión lateral', 'Flexión', 'Extensión'],
  'Columna': ['Flexión', 'Extensión', 'Flexión lateral', 'Rotación'],
  'Cadera': ['Flexión', 'Extensión', 'Abducción', 'Adducción', 'Rotación interna', 'Rotación externa'],
  'Rodilla': ['Flexión', 'Extensión'],
  'Tobillo': ['Dorsiflexión', 'Flexión plantar', 'Inversión', 'Eversión'],
}

/** El título de cada zona, para nombrar los tests que la miden: "Hombro · fuerza". */
export const ZONA_TITULO: Record<string, string> = {
  'Hombro': 'Hombro', 'Escapular': 'Escápula', 'Codo': 'Codo', 'Muñeca': 'Muñeca',
  'Mano': 'Mano y dedos', 'Cervical': 'Cervical', 'Columna': 'Tronco',
  'Cadera': 'Cadera', 'Rodilla': 'Rodilla', 'Tobillo': 'Tobillo',
}

/** Zonas que se miden por separado en cada lado. El tronco y el cuello, no. */
export const ZONA_LATERAL: Record<string, boolean> = {
  'Hombro': true, 'Escapular': true, 'Codo': true, 'Muñeca': true, 'Mano': true,
  'Cervical': false, 'Columna': false, 'Cadera': true, 'Rodilla': true, 'Tobillo': true,
}

/** Cómo se lee cada zona en el nombre del objetivo. "Fuerza de Escapular" no es castellano. */
const COMO_SE_DICE: Record<string, string> = {
  'Hombro': 'de hombro',
  'Escapular': 'escapular',
  'Codo': 'de codo',
  'Muñeca': 'de muñeca',
  'Mano': 'de mano y dedos',
  'Cervical': 'cervical',
  'Columna': 'de tronco',
  'Cadera': 'de cadera',
  'Rodilla': 'de rodilla',
  'Tobillo': 'de tobillo',
}

const PORQUE: Record<string, { f: string, m: string }> = {
  'Hombro': {
    f: 'Las rotaciones son las que más se pierden y las que menos se entrenan: la flexión y la abducción suelen estar bien mientras el manguito está flojo.',
    m: 'La rotación interna es la primera que se va y la que más molesta en el día a día: abrocharse, rascarse la espalda.',
  },
  'Escapular': {
    f: 'La retracción sostiene el hombro en todo lo demás. Un desequilibrio entre lados aquí se paga arriba, en el gesto por encima de la cabeza.',
    m: 'Sin recorrido escapular, el hombro pide prestado al cuello.',
  },
  'Codo': {
    f: 'Suele salir en epicondilitis y tras inmovilizaciones. Interesa sobre todo la diferencia entre lados.',
    m: 'Los últimos grados de extensión son los que cuesta recuperar y los que más se notan.',
  },
  'Muñeca': {
    f: 'Pronación y supinación son las que fallan tras una fractura y las que nadie entrena.',
    m: 'La extensión limitada aparece en todo lo que se apoya en el suelo con las manos.',
  },
  'Mano': {
    f: 'La fuerza de agarre es de las medidas más fiables que existen y predice bastante más que la mano.',
    m: 'Recorrido de los dedos, tras inmovilización o en artrosis.',
  },
  'Cervical': {
    f: 'Lo que sostiene la cabeza ocho horas no es fuerza máxima, es resistencia. Aun así el desequilibrio entre lados orienta.',
    m: 'La rotación es la que más limita: mirar al ángulo muerto al conducir es el ejemplo que entiende cualquiera.',
  },
  'Columna': {
    f: 'Lo habitual es lumbar fuerte y abdomen que no aguanta. Los dos números juntos dicen más que cualquiera suelto.',
    m: 'Flexión y extensión medidas con Schober y OTT, que son de los pocos números fiables que hay en columna.',
  },
  'Cadera': {
    f: 'El desequilibrio entre aductor y abductor está detrás de buena parte de las pubalgias y las trocanteritis.',
    m: 'La rotación interna es la primera que se pierde en una cadera que empieza a artrosarse.',
  },
  'Rodilla': {
    f: 'Un isquiotibial por debajo del 60% del cuádriceps es factor de riesgo conocido, aunque los dos números sean altos.',
    m: 'Los últimos grados de extensión permiten caminar sin gastar cuádriceps en cada paso, y son los primeros que se pierden.',
  },
  'Tobillo': {
    f: 'Tras un esguince la movilidad vuelve antes que la capacidad de frenar la supinación, y es esa la que evita el segundo.',
    m: 'La dorsiflexión limitada se paga arriba: la sentadilla se va hacia delante y la rodilla al valgo.',
  },
}

/** Los 20 espacios: cada articulación, en fuerza y en movilidad. */
export const ESPACIOS: EspacioSemilla[] = Object.keys(MOVIMIENTOS).flatMap(art => {
  const como = COMO_SE_DICE[art] || art.toLowerCase()
  const movs = MOVIMIENTOS[art]
  return [
    { articulacion: art, metrica: 'fuerza' as const, nombre: `Fuerza ${como}`,
      descripcion: PORQUE[art]?.f || '', movimientos: movs },
    { articulacion: art, metrica: 'movilidad' as const, nombre: `Movilidad ${como}`,
      descripcion: PORQUE[art]?.m || '', movimientos: movs },
  ]
})

export type FaseSemilla = {
  nombre: string
  descripcion: string
  articulacion?: string
  /**
   * Músculo y patología, del árbol de etiquetas.
   *
   * La articulación va en su campo porque tiene un papel —es la zona— y los métricos la
   * usan para resolver qué test los mide. Estas son las que NO tienen papel: describen de
   * qué va el objetivo. Con la patología puesta, un paciente al que se le registra una
   * trocanteritis puede ver sus objetivos sin buscarlos.
   */
  etiquetas?: string[]
  /**
   * Sesiones de la biblioteca que lo trabajan, por nombre.
   *
   * Es el enlace que hace que un objetivo abierto tenga con qué entrenarse. Los métricos
   * no lo llevan —los cubren las sesiones de la zona— pero una fase o un cualitativo sin
   * sesión asociada es un objetivo que se abre y no propone nada.
   */
  sesiones?: string[]
  /** Qué significa cada fase, en orden. El paciente avanza de una a la siguiente. */
  fases: string[]
}

/**
 * Los de progresión. Antes eran una ficha por fase —"Suelo pélvico F1", "F2"…—; aquí es una
 * sola con la fase dentro, y el progreso se ve de un vistazo en vez de repartido en cuatro
 * objetivos que hay que ir cerrando y abriendo a mano.
 */
export const FASES: FaseSemilla[] = [
  // Las dos del ictus van por separado —una para andar y otra para el brazo— porque
  // avanzan a velocidades muy distintas y casi nunca a la vez. Lo normal es alguien que
  // ya camina por la calle y sigue sin poder abrir la mano; con un solo objetivo por
  // fases habría que elegir cuál de las dos verdades se enseña.
  {
    nombre: 'Recuperar la marcha tras el ictus',
    etiquetas: ['Ictus', 'Hemiparesia', 'Riesgo de caída'],
    sesiones: ['Ictus · control de tronco y transferencias', 'Ictus · marcha y miembro superior', 'Equilibrio y marcha'],
    descripcion: 'De sostenerse sentado a andar por la calle. La fase la marca lo que hace con seguridad, no el tiempo desde el ictus. No se salta una fase porque el paciente tenga prisa: la caída es el suceso que más retrasa todo lo demás.',
    fases: [
      'Control de tronco y sedestación',
      'Bipedestación y transferencias',
      'Marcha asistida',
      'Marcha autónoma en interior',
      'Marcha en comunidad y escaleras',
    ],
  },
  {
    nombre: 'Recuperar el miembro superior tras el ictus',
    articulacion: 'Hombro',
    etiquetas: ['Ictus', 'Hemiparesia', 'Subluxación de hombro'],
    sesiones: ['Ictus · control de tronco y transferencias', 'Ictus · marcha y miembro superior'],
    descripcion: 'Del brazo que cuelga al brazo que sirve. La primera fase no entrena: protege el hombro y mantiene el recorrido, porque una vez que duele se acaba la rehabilitación del brazo.',
    fases: [
      'Movilidad pasiva y cuidado del hombro',
      'Movimiento activo asistido',
      'Movimiento activo contra gravedad',
      'Agarre y manipulación',
      'Uso en tareas cotidianas',
    ],
  },
  {
    nombre: 'Suelo pélvico',
    etiquetas: ['Suelo pélvico'],
    descripcion: 'De notar la musculatura a usarla sin pensar. Se avanza cuando la fase anterior sale sin compensar con abdomen o glúteo.',
    fases: [
      'Conciencia y activación básica',
      'Control y fortalecimiento',
      'Funcionalidad y uso dinámico',
      'Mantenimiento y prevención',
    ],
  },
  {
    nombre: 'Recuperar la funcionalidad del hombro',
    articulacion: 'Hombro',
    etiquetas: ['Hombro doloroso', 'Manguito rotador'],
    descripcion: 'Del hombro que duele al hombro que vuelve a servir para todo. La fase la marca lo que tolera, no el tiempo transcurrido.',
    fases: [
      'Alivio del dolor y movilidad básica',
      'Estabilidad escapular y fuerza inicial',
      'Fuerza funcional y rango completo',
      'Retorno funcional',
    ],
  },
  {
    nombre: 'Recuperar la escápula alada',
    articulacion: 'Escapular',
    etiquetas: ['Trapecio', 'Espalda'],
    descripcion: 'Primero que note dónde está la escápula, luego que la sostenga moviéndose, y al final que aguante bajo carga.',
    fases: [
      'Activación neuromuscular y control escapular',
      'Estabilidad escapular en movimiento',
      'Fuerza funcional y resistencia',
      'Reintegración al movimiento',
    ],
  },
  {
    nombre: 'Escápula alada con escoliosis',
    articulacion: 'Escapular',
    etiquetas: ['Escoliosis', 'Trapecio'],
    descripcion: 'El mismo recorrido que la escápula alada, pero con la asimetría de base: el objetivo no es simetría perfecta sino control de la asimetría.',
    fases: [
      'Toma de conciencia y autocorrección',
      'Activación escapular unilateral',
      'Control dinámico y reeducación funcional',
      'Funcionalidad asimétrica controlada',
    ],
  },
  {
    nombre: 'Escoliosis funcional',
    articulacion: 'Columna',
    etiquetas: ['Escoliosis', 'Erectores Espinales'],
    descripcion: 'Educación postural, trabajo unilateral y consolidación. No busca corregir la curva sino que deje de doler y de limitar.',
    fases: [
      'Educación postural',
      'Cuadrupedia y trabajo unilateral',
      'Consolidar, prevenir y equilibrar',
    ],
  },
  {
    nombre: 'Reducir la cifosis dorsal',
    articulacion: 'Columna',
    etiquetas: ['Cifosis dorsal', 'Espalda'],
    descripcion: 'La dorsal que no extiende la paga el cuello arriba y la lumbar abajo. Percepción primero, fuerza después.',
    fases: [
      'Percepción y control postural',
      'Fortalecer la musculatura posterior',
      'Trabajo funcional e integrado',
    ],
  },
  {
    nombre: 'Recuperar de trocanteritis',
    articulacion: 'Cadera',
    etiquetas: ['Trocantéritis', 'Glúteo medio', 'Abductor - TFL'],
    descripcion: 'Bajar la irritación y devolverle al glúteo medio el trabajo que estaba haciendo el tensor de la fascia lata.',
    fases: ['Calmar y descargar', 'Activar el glúteo medio', 'Carga progresiva y marcha'],
  },
  {
    nombre: 'Recuperar la función del glúteo medio',
    articulacion: 'Cadera',
    etiquetas: ['Glúteo medio'],
    descripcion: 'Que sostenga la pelvis al apoyar en una pierna. Es lo que hay detrás del valgo de rodilla y de medio dolor lateral de cadera.',
    fases: ['Activación aislada', 'Control en carga', 'Función en marcha y carrera'],
  },
  {
    nombre: 'Disociar trapecio superior y deltoides',
    articulacion: 'Hombro',
    etiquetas: ['Trapecio', 'Deltoides'],
    descripcion: 'Que levante el brazo sin subir el hombro a la oreja. Primero que lo note, luego que lo controle, después que aguante.',
    fases: ['Notar la diferencia', 'Controlarlo en movimiento lento', 'Mantenerlo bajo carga'],
  },
]

export type CualitativoSemilla = {
  nombre: string
  descripcion: string
  articulacion?: string
  /** Músculo y patología. Ver el comentario en FaseSemilla. */
  etiquetas?: string[]
  /**
   * Sesiones de la biblioteca que lo trabajan, por nombre.
   *
   * Es el enlace que hace que un objetivo abierto tenga con qué entrenarse. Los métricos
   * no lo llevan —los cubren las sesiones de la zona— pero una fase o un cualitativo sin
   * sesión asociada es un objetivo que se abre y no propone nada.
   */
  sesiones?: string[]
}

/** Los que se cumplen o no. Sin número y sin fases: aprender algo o corregir un hábito. */
export const CUALITATIVOS: CualitativoSemilla[] = [
  { nombre: 'Aprender a hacer el puente de glúteo', articulacion: 'Cadera', etiquetas: ['Glúteo mayor'],
    descripcion: 'Subir con el glúteo y no con la lumbar ni con el isquiotibial. Es la puerta a media biblioteca de ejercicios.' },
  { nombre: 'Aprender los movimientos cervicales', articulacion: 'Cervical', etiquetas: ['Cervicalgia'],
    descripcion: 'Distinguir flexión, extensión, rotación e inclinación, y hacerlos sin arrastrar el resto.' },
  { nombre: 'Aprender la anteversión y retroversión de cadera', articulacion: 'Cadera', etiquetas: ['Psoas', 'Abdomen'],
    descripcion: 'Mover la pelvis a voluntad sin mover las costillas. Sin esto no hay control lumbopélvico posible.' },
  { nombre: 'Fortalecer el core para la estabilidad lumbopélvica', etiquetas: ['Abdomen', 'Transverso', 'Lumbalgia'],
    descripcion: 'Iniciación al control lumbopélvico: sostener la posición mientras se mueven brazos y piernas.' },
  { nombre: 'Corregir la postura corporal', etiquetas: ['Cifosis dorsal', 'Espalda'],
    descripcion: 'Objetivo de acompañamiento, no de medición. Se da por cumplido cuando la corrección aparece sola sin recordárselo.' },
  { nombre: 'Mejorar el retorno venoso de las piernas',
    descripcion: 'Para quien pasa el día de pie o sentado. Se valora por síntomas al final del día, no por una medida.' },
  { nombre: 'Mejorar el equilibrio', articulacion: 'Tobillo', etiquetas: ['Glúteo medio'],
    descripcion: 'Iniciación: aguantar a una pierna sin apoyar la otra. Cuando ya se sostiene, pasa a medirse con el test de equilibrio unipodal.' },

  // ── Tras un ictus ─────────────────────────────────────────────────────────
  { nombre: 'Usar el lado afecto en el día a día', sesiones: ['Ictus · marcha y miembro superior'], etiquetas: ['Ictus', 'Hemiparesia'],
    descripcion: 'Contra el no-uso aprendido: si el brazo afecto cuesta, se deja de usar, y el que no se usa pierde más. Se da por cumplido cuando lo mete en tareas de casa sin que se le recuerde, no cuando mejora un número.' },
  { nombre: 'Aprender las transferencias con seguridad', sesiones: ['Ictus · control de tronco y transferencias'], etiquetas: ['Ictus', 'Hemiparesia', 'Riesgo de caída'],
    descripcion: 'Pasar de tumbado a sentado, de sentado a de pie, y entrar y salir de la cama y del coche sin ayuda y sin desequilibrarse. Es lo que decide si vive solo.' },
  { nombre: 'Cuidar el hombro del lado afecto', sesiones: ['Ictus · control de tronco y transferencias', 'Ictus · marcha y miembro superior'], articulacion: 'Hombro', etiquetas: ['Ictus', 'Subluxación de hombro', 'Hombro doloroso'],
    descripcion: 'Con el deltoides sin tono, el peso del brazo separa la cabeza humeral. Va de manejo, no de fuerza: cómo se coge el brazo, cómo se sienta, qué no se hace. El hombro doloroso post-ictus frena la rehabilitación entera.' },
]

// Tests de valoración: el catálogo inicial de la clínica.
//
// CÓMO ENCAJA CON EL RESTO. No hay ni hará falta un enlace test → sesión. La cadena ya
// existe y va por el medio:
//
//     test positivo  →  abre OBJETIVOS  →  las sesiones aptas son las que
//                                          trabajan esos objetivos
//
// `objetivos.test_id` engancha un objetivo al test entero; `items[].objetivos` engancha
// objetivos a un ítem suelto, para cuando lo que hay que trabajar depende de QUÉ salió
// mal y no de que el test diera positivo. Y `sesiones_objetivos` engancha las sesiones.
// Un enlace directo test → sesión sería un segundo camino para lo mismo, y en cuanto los
// dos discrepen no habría forma de saber cuál manda.
//
// LA UNIDAD VA POR ÍTEM. Un test tiene ítems cualitativos —"hay dolor en el arco medio"—
// y medidos, y no siempre en la misma unidad: el lunge de tobillo se mide en centímetros
// y el equilibrio unipodal en segundos. Ver UNIDADES en lib/tests.ts.
//
// LAS ETIQUETAS SE ESCRIBEN POR NOMBRE y las resuelve el sembrador contra el árbol real,
// avisando de las que no encuentre. Es lo que evita el fallo que ya tuvimos con los
// ejercicios: nombres en plural que no existían y se perdían en silencio.
// Comprobadas contra datos/etiquetas-arbol.txt.

export type ItemSemilla = {
  nombre: string
  /** '' = cualitativo. Si no, 'grados' | 'cm' | 'segundos' | 'repeticiones' | 'kg'. */
  unidad?: string
  /** Objetivos que abre este ítem al quedar marcado, por nombre. */
  objetivos?: string[]
}

export type TestSemilla = {
  nombre: string
  descripcion: string
  /** 'cualquiera' = con un ítem marcado ya es positivo. 'todos' = tienen que estarlo todos. */
  logica: 'cualquiera' | 'todos'
  /** 'lateral' pide izquierdo y derecho por separado; 'bilateral' se hace una vez. */
  tipo_lado: 'lateral' | 'bilateral'
  frecuencia_meses: number
  /** Nombres tal cual están en el árbol de etiquetas. */
  etiquetas: string[]
  items: ItemSemilla[]
  /** Objetivos que abre el test ENTERO al dar positivo, por nombre. */
  objetivos: string[]
}

export type ObjetivoSemilla = {
  nombre: string
  descripcion: string
  color: string
  /** Sesiones que lo trabajan, por nombre. El sembrador avisa de las que no existan. */
  sesiones: string[]
}

const C = {
  hombro: '#6B8F9A', cadera: '#9A6B8F', rodilla: '#7C9A6B',
  tobillo: '#54A0A0', core: '#9A8F6B', general: '#C17A54',
}

/**
 * Los objetivos que abren estos tests.
 *
 * Se siembran ANTES que los tests, porque el test guarda su id. Si ya existe uno con el
 * mismo nombre se reutiliza en vez de duplicarlo: dos objetivos "Ganar movilidad de
 * hombro" partirían en dos el seguimiento del mismo paciente.
 */
export const OBJETIVOS: ObjetivoSemilla[] = [
  { nombre: 'Recuperar el hombro sin dolor', color: C.hombro,
    descripcion: 'Que el gesto por encima de la cabeza deje de doler y recupere el control escapular.',
    sesiones: ['Hombro · manguito y escápula'] },
  { nombre: 'Ganar movilidad de hombro', color: C.hombro,
    descripcion: 'Recuperar rotación y recorrido, sobre todo la mano a la espalda.',
    sesiones: ['Hombro · manguito y escápula', 'Espalda y cuello · trabajo de oficina'] },
  { nombre: 'Ganar extensión de cadera', color: C.cadera,
    descripcion: 'Soltar el flexor y que la cadera llegue atrás sin compensar con la lumbar.',
    sesiones: ['Cadera · movilidad y control'] },
  { nombre: 'Ganar movilidad lateral de cadera', color: C.cadera,
    descripcion: 'Reducir la tensión del tensor de la fascia lata y ganar aducción.',
    sesiones: ['Cadera · movilidad y control'] },
  { nombre: 'Mejorar el patrón de sentadilla', color: C.rodilla,
    descripcion: 'Bajar con los talones apoyados, las rodillas alineadas y el tronco erguido.',
    sesiones: ['Tren inferior', 'Rodilla · vuelta a la carga'] },
  { nombre: 'Ganar dorsiflexión de tobillo', color: C.tobillo,
    descripcion: 'Que la rodilla pase por delante del pie sin levantar el talón.',
    sesiones: ['Tobillo y pie'] },
  { nombre: 'Mejorar el equilibrio', color: C.tobillo,
    descripcion: 'Aguantar a una pierna sin apoyar la otra ni oscilar.',
    sesiones: ['Equilibrio y marcha'] },
  { nombre: 'Ganar fuerza en el tren inferior', color: C.rodilla,
    descripcion: 'Levantarse de la silla sin ayuda de los brazos y repetirlo sin fatiga.',
    sesiones: ['Tren inferior', 'Equilibrio y marcha'] },
  { nombre: 'Ganar resistencia de core', color: C.core,
    descripcion: 'Sostener la posición sin que la cadera caiga ni aparezca dolor lumbar.',
    sesiones: ['Core'] },
  { nombre: 'Recuperar la pared abdominal', color: C.core,
    descripcion: 'Cerrar la separación y recuperar la tensión del transverso.',
    sesiones: ['Suelo pélvico y pared abdominal'] },
]

export const TESTS: TestSemilla[] = [

  // ── Hombro ────────────────────────────────────────────────────────────────
  {
    nombre: 'Pinzamiento subacromial',
    descripcion: 'Descarta el atrapamiento de los tendones del manguito bajo el acromion. Se combinan Neer y Hawkins-Kennedy con el arco doloroso, porque ninguno de los tres por separado es concluyente y juntos sí orientan.',
    logica: 'cualquiera', tipo_lado: 'lateral', frecuencia_meses: 3,
    etiquetas: ['Hombro', 'Manguito rotador', 'Hombro doloroso', 'Flexión', 'Bipedestación'],
    objetivos: ['Recuperar el hombro sin dolor'],
    items: [
      { nombre: 'Neer: duele al elevar el brazo en rotación interna' },
      { nombre: 'Hawkins-Kennedy: duele al rotar internamente a 90°' },
      { nombre: 'Arco doloroso entre 60 y 120°' },
      { nombre: 'Flexión activa que alcanza', unidad: 'grados' },
    ],
  },
  {
    nombre: 'Movilidad de hombro · mano a la espalda',
    descripcion: 'Mide en un solo gesto la rotación interna y la extensión combinadas. Es el movimiento que se pierde primero y el que más molesta en el día a día: abrocharse, rascarse la espalda.',
    logica: 'cualquiera', tipo_lado: 'lateral', frecuencia_meses: 3,
    etiquetas: ['Hombro', 'Escapular', 'Rotación', 'Extensión', 'Bipedestación'],
    objetivos: ['Ganar movilidad de hombro'],
    items: [
      { nombre: 'No consigue juntar las manos a la espalda' },
      { nombre: 'Distancia entre los dedos', unidad: 'cm' },
      { nombre: 'Aparece dolor al final del recorrido' },
    ],
  },

  // ── Cadera ────────────────────────────────────────────────────────────────
  {
    nombre: 'Thomas · flexores de cadera',
    descripcion: 'Con el paciente tumbado y una rodilla al pecho, el muslo contrario debería quedar apoyado. Si se levanta, el psoas está corto; si además la rodilla se estira, tira el recto femoral; si se abre, el tensor de la fascia lata.',
    logica: 'cualquiera', tipo_lado: 'lateral', frecuencia_meses: 3,
    etiquetas: ['Cadera', 'Psoas', 'Recto Femoral', 'Extensión', 'Supino'],
    objetivos: ['Ganar extensión de cadera'],
    items: [
      { nombre: 'El muslo no llega a apoyar en la camilla' },
      { nombre: 'Flexión de cadera que queda', unidad: 'grados' },
      { nombre: 'La rodilla no mantiene los 90°: tira el recto femoral' },
      { nombre: 'La pierna se abre hacia fuera: tira el tensor de la fascia lata',
        objetivos: ['Ganar movilidad lateral de cadera'] },
    ],
  },
  {
    nombre: 'Ober · tensor de la fascia lata',
    descripcion: 'De lado, con la pierna de arriba en abducción y extensión, se suelta y debería caer. Si se queda arriba, la banda iliotibial está tensa: es lo que hay detrás de muchas trocanteritis y del dolor lateral de rodilla al correr.',
    logica: 'cualquiera', tipo_lado: 'lateral', frecuencia_meses: 3,
    etiquetas: ['Cadera', 'Abductor - TFL', 'Adducción', 'Decúbito lateral', 'Trocantéritis'],
    objetivos: ['Ganar movilidad lateral de cadera'],
    items: [
      { nombre: 'La pierna no baja de la horizontal' },
      { nombre: 'Grados que le faltan para bajar', unidad: 'grados' },
      { nombre: 'Dolor en la cara lateral del muslo o la cadera' },
    ],
  },

  // ── Patrón global ─────────────────────────────────────────────────────────
  {
    nombre: 'Sentadilla profunda con brazos arriba',
    descripcion: 'Un solo gesto que enseña tobillo, cadera, columna y hombro a la vez. No sirve para diagnosticar nada concreto y por eso es tan útil: dice por dónde hay que seguir mirando.',
    logica: 'cualquiera', tipo_lado: 'bilateral', frecuencia_meses: 3,
    etiquetas: ['Sentadilla', 'Rodilla', 'Cadera', 'Tobillo', 'Bipedestación'],
    objetivos: ['Mejorar el patrón de sentadilla'],
    items: [
      { nombre: 'Los talones se levantan del suelo',
        objetivos: ['Ganar dorsiflexión de tobillo'] },
      { nombre: 'Las rodillas caen hacia dentro' },
      { nombre: 'El tronco se inclina en exceso hacia delante' },
      { nombre: 'Los brazos caen hacia delante',
        objetivos: ['Ganar movilidad de hombro'] },
      { nombre: 'Profundidad que alcanza la cadera respecto a la rodilla', unidad: 'cm' },
    ],
  },

  // ── Tobillo y equilibrio ──────────────────────────────────────────────────
  {
    nombre: 'Dorsiflexión de tobillo · test del lunge',
    descripcion: 'De pie frente a la pared, se adelanta el pie hasta donde la rodilla la toca sin levantar el talón. Por debajo de 10 cm hay restricción, y se paga arriba: la sentadilla se va hacia delante y la rodilla al valgo.',
    logica: 'cualquiera', tipo_lado: 'lateral', frecuencia_meses: 3,
    etiquetas: ['Tobillo', 'Sóleo', 'Flexión', 'Pared', 'Bipedestación'],
    objetivos: ['Ganar dorsiflexión de tobillo'],
    items: [
      { nombre: 'Distancia del dedo gordo a la pared', unidad: 'cm' },
      { nombre: 'El talón se levanta antes de tocar' },
      { nombre: 'La rodilla se desvía hacia dentro para llegar' },
    ],
  },
  {
    nombre: 'Equilibrio unipodal',
    descripcion: 'A una pierna, con los ojos abiertos y los brazos en la cintura. Por debajo de 30 segundos hay déficit de control, y en mayores predice caídas mejor que casi cualquier otra cosa que se pueda medir en un minuto.',
    logica: 'cualquiera', tipo_lado: 'lateral', frecuencia_meses: 3,
    etiquetas: ['Tobillo', 'Glúteo medio', 'Unipodal', 'Bipedestación'],
    objetivos: ['Mejorar el equilibrio'],
    items: [
      { nombre: 'Tiempo que aguanta con los ojos abiertos', unidad: 'segundos' },
      { nombre: 'Apoya el otro pie antes de los 30 segundos' },
      { nombre: 'Oscilación marcada del tronco o de los brazos' },
    ],
  },

  // ── Fuerza y resistencia ──────────────────────────────────────────────────
  {
    nombre: 'Sentarse y levantarse en 30 segundos',
    descripcion: 'Repeticiones completas desde una silla en medio minuto, sin ayudarse de los brazos. Mide fuerza de piernas de forma que el paciente entiende, y se repite igual dentro de tres meses sin discusión sobre la técnica.',
    logica: 'cualquiera', tipo_lado: 'bilateral', frecuencia_meses: 6,
    etiquetas: ['Sentadilla', 'Cuádriceps', 'Rodilla', 'Banco', 'Sentado'],
    objetivos: ['Ganar fuerza en el tren inferior'],
    items: [
      { nombre: 'Repeticiones completas en 30 segundos', unidad: 'repeticiones' },
      { nombre: 'Necesita ayudarse con los brazos' },
      { nombre: 'Dolor de rodilla al levantarse' },
    ],
  },
  {
    nombre: 'Plancha frontal · resistencia del core',
    descripcion: 'Tiempo sosteniendo la posición antes de que la cadera caiga o la lumbar se hunda. Lo que se mide no es cuánto aguanta sino cuándo deja de estar bien colocado: en cuanto pierde la posición, el test ha terminado.',
    logica: 'cualquiera', tipo_lado: 'bilateral', frecuencia_meses: 3,
    etiquetas: ['Abdomen', 'Transverso', 'Antiextensión', 'Prono', 'Lumbalgia'],
    objetivos: ['Ganar resistencia de core'],
    items: [
      { nombre: 'Tiempo sosteniendo la posición', unidad: 'segundos' },
      { nombre: 'La cadera cae antes de los 30 segundos' },
      { nombre: 'Aparece dolor lumbar durante el test' },
    ],
  },

  // ── Embarazo y posparto ───────────────────────────────────────────────────
  {
    nombre: 'Diástasis abdominal',
    descripcion: 'Separación entre los rectos, medida en tres alturas con el paciente tumbado y elevando la cabeza. Por encima de dos dedos —unos 2,5 cm— hay diástasis, pero importa tanto la separación como si la línea alba aguanta la tensión.',
    logica: 'cualquiera', tipo_lado: 'bilateral', frecuencia_meses: 3,
    etiquetas: ['Abdomen', 'Recto abdominal', 'Transverso', 'Supino', 'Suelo pélvico'],
    objetivos: ['Recuperar la pared abdominal'],
    items: [
      { nombre: 'Separación por encima del ombligo', unidad: 'cm' },
      { nombre: 'Separación a la altura del ombligo', unidad: 'cm' },
      { nombre: 'Separación por debajo del ombligo', unidad: 'cm' },
      { nombre: 'La línea media se abomba al elevar la cabeza' },
    ],
  },
]

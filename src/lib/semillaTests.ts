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
  // Los tests de EXPLORACIÓN —meniscos, ligamentos, provocación cervical— no abren ningún
  // objetivo, y es a propósito. Un menisco que duele en la interlínea no es un déficit que
  // se entrene: es información para decidir qué carga se puede meter, y a veces para
  // derivar. Colgarles un objetivo de entrenamiento haría que la ficha propusiera entrenar
  // una rotura. Ese dato es el que alimentará el bloqueo por etiquetas, que sigue pendiente.

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

  // ── Los que abren el catálogo traído del otro programa ────────────────────
  { nombre: 'Estabilizar el tobillo', color: C.tobillo,
    descripcion: 'Recuperar la fuerza de peroneos y tibial y la respuesta a la supinación forzada.',
    sesiones: ['Tobillo y pie', 'Equilibrio y marcha'] },
  { nombre: 'Recuperar el arco del pie', color: C.tobillo,
    descripcion: 'Que la musculatura intrínseca sostenga el arco sin depender de la fascia.',
    sesiones: ['Tobillo y pie'] },
  { nombre: 'Ganar movilidad de rodilla', color: C.rodilla,
    descripcion: 'Recuperar el recorrido completo de flexión y, sobre todo, la extensión final.',
    sesiones: ['Rodilla · vuelta a la carga'] },
  { nombre: 'Calmar la rótula', color: C.rodilla,
    descripcion: 'Bajar la irritación femoropatelar y volver a cargar sin dolor anterior.',
    sesiones: ['Rodilla · vuelta a la carga'] },
  { nombre: 'Recuperar la fuerza de la rodilla', color: C.rodilla,
    descripcion: 'Cerrar la diferencia entre lados en cuádriceps e isquiotibial.',
    sesiones: ['Tren inferior', 'Rodilla · vuelta a la carga'] },
  { nombre: 'Ganar rotación de cadera', color: C.cadera,
    descripcion: 'Recuperar rotación interna y externa, que es lo que se pierde antes en cadera.',
    sesiones: ['Cadera · movilidad y control'] },
  { nombre: 'Recuperar la fuerza de la cadera', color: C.cadera,
    descripcion: 'Glúteo, abductores, aductores y psoas, con la comparación entre lados delante.',
    sesiones: ['Cadera · movilidad y control', 'Tren inferior'] },
  { nombre: 'Ganar movilidad lumbar', color: C.core,
    descripcion: 'Recuperar el recorrido de flexión y extensión lumbar sin dolor.',
    sesiones: ['Core', 'Espalda y cuello · trabajo de oficina'] },
  { nombre: 'Ganar movilidad dorsal', color: C.core,
    descripcion: 'Devolver extensión y rotación a la dorsal, que es de donde tiran el cuello y el hombro.',
    sesiones: ['Espalda y cuello · trabajo de oficina'] },
  { nombre: 'Ganar movilidad cervical', color: C.general,
    descripcion: 'Recuperar rotación cervical sin provocación ni bloqueo.',
    sesiones: ['Espalda y cuello · trabajo de oficina'] },
  { nombre: 'Ganar fuerza y control cervical', color: C.general,
    descripcion: 'Flexores profundos y resistencia, que es lo que sostiene la cabeza el resto del día.',
    sesiones: ['Espalda y cuello · trabajo de oficina'] },
  { nombre: 'Mejorar el control a una pierna', color: C.rodilla,
    descripcion: 'Que la rodilla no caiga hacia dentro ni la cadera se descuelgue al apoyar en una.',
    sesiones: ['Tren inferior', 'Equilibrio y marcha'] },
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
    descripcion: 'De pie frente a la pared, se adelanta el pie hasta donde la rodilla la toca sin levantar el talón. Por debajo de 10 cm hay restricción, y se paga arriba: la sentadilla se va hacia delante y la rodilla al valgo. Las tres posiciones no miden lo mismo: con la rodilla en el suelo se quita el gastrocnemio y queda el sóleo solo, y con alza se distingue si el tope es de longitud o articular.',
    logica: 'cualquiera', tipo_lado: 'lateral', frecuencia_meses: 3,
    etiquetas: ['Tobillo', 'Sóleo', 'Flexión', 'Pared', 'Bipedestación'],
    objetivos: ['Ganar dorsiflexión de tobillo'],
    items: [
      { nombre: 'En bipedestación · distancia del dedo a la pared', unidad: 'cm' },
      { nombre: 'Con la rodilla en el suelo · distancia', unidad: 'cm' },
      { nombre: 'Con alza bajo el talón · distancia', unidad: 'cm' },
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

  // ══════════════════════════════════════════════════════════════════════════
  // Catálogo traído del otro programa, agrupado POR ESTRUCTURA EXPLORADA.
  //
  // Allí cada maniobra era un test suelto: solo de rodilla venían treinta y una. Aquí son
  // seis fichas con sus ítems. Agrupar por región a secas habría dado un test enorme cuyo
  // positivo no dice nada; dejarlas sueltas, ochenta fichas con ochenta fechas de revisión.
  // Se agrupa por lo que se explora, porque una rótula que roza y un menisco que duele en
  // la interlínea no abren el mismo objetivo ni se entrenan igual.
  //
  // Ver docs/propuestas/PROPUESTA-TESTS.md para el mapa completo entrada por entrada.
  // ══════════════════════════════════════════════════════════════════════════

  // ── Tobillo y pie ─────────────────────────────────────────────────────────
  {
    nombre: 'Tobillo · pronación y supinación',
    descripcion: 'Recorrido del retropié en los dos sentidos y respuesta a la supinación forzada. Es la exploración del que se ha torcido el tobillo: la movilidad suele volver antes que la capacidad de frenar el movimiento, y es esa la que evita el segundo esguince.',
    logica: 'cualquiera', tipo_lado: 'lateral', frecuencia_meses: 3,
    etiquetas: ['Tobillo', 'Peroneos', 'Inversión', 'Eversión', 'Esguince de tobillo'],
    objetivos: ['Estabilizar el tobillo'],
    items: [
      { nombre: 'Movilidad de pronación', unidad: 'grados' },
      { nombre: 'Movilidad de supinación', unidad: 'grados' },
      { nombre: 'No resiste la supinación forzada' },
    ],
  },
  {
    nombre: 'Tobillo y pie · fuerza',
    descripcion: 'Fuerza de los cuatro sentidos del tobillo y de los flexores de los dedos. Lo que interesa no es el número absoluto sino la diferencia entre lados: por debajo del 90% del lado sano hay trabajo pendiente aunque no duela nada.',
    logica: 'cualquiera', tipo_lado: 'lateral', frecuencia_meses: 3,
    etiquetas: ['Tobillo', 'Peroneos', 'Tibial Anterior', 'Pie', 'Sentado'],
    objetivos: ['Estabilizar el tobillo'],
    items: [
      { nombre: 'Pronación', unidad: 'kg' },
      { nombre: 'Supinación', unidad: 'kg' },
      { nombre: 'Flexión', unidad: 'kg' },
      { nombre: 'Dedos del pie', unidad: 'kg', objetivos: ['Recuperar el arco del pie'] },
    ],
  },
  {
    nombre: 'Pie · test de Jack',
    descripcion: 'Se extiende el dedo gordo con el paciente de pie y el arco debería elevarse solo por el mecanismo de molinete. Si no se forma, la fascia no está transmitiendo y el pie se aplana bajo carga.',
    logica: 'cualquiera', tipo_lado: 'lateral', frecuencia_meses: 3,
    etiquetas: ['Pie', 'Fascitis plantar', 'Extensión', 'Bipedestación'],
    objetivos: ['Recuperar el arco del pie'],
    items: [
      { nombre: 'El arco no se forma al extender el dedo gordo' },
      { nombre: 'Dolor en la fascia al extender' },
    ],
  },

  // ── Rodilla ───────────────────────────────────────────────────────────────
  {
    nombre: 'Rodilla · rótula',
    descripcion: 'Exploración femoropatelar completa: derrame, temperatura, roce, dolor en los polos y estabilidad. El choque rotuliano y el fondo de saco hablan de derrame; los polos, de qué tendón está irritado; la aprensión, de si la rótula se sale.',
    logica: 'cualquiera', tipo_lado: 'lateral', frecuencia_meses: 3,
    etiquetas: ['Rodilla', 'Cuádriceps', 'Condropatía rotuliana', 'Supino'],
    objetivos: ['Calmar la rótula'],
    items: [
      { nombre: 'Fondo de saco suprarrotuliano aumentado' },
      { nombre: 'Cambios de temperatura o rugosidades' },
      { nombre: 'Choque rotuliano' },
      { nombre: 'Roce rotuliano al movilizar' },
      { nombre: 'Dolor en el polo superior (cuadricipital)' },
      { nombre: 'Dolor en el polo inferior (rotuliano)' },
      { nombre: 'Zohlen: dolor al contraer con la rótula fijada' },
      { nombre: 'Signo de aprensión' },
      { nombre: 'Rótula desplazada' },
    ],
  },
  {
    nombre: 'Rodilla · meniscos',
    descripcion: 'Interlíneas y maniobras meniscales. Es exploración, no un déficit entrenable: por eso no abre ningún objetivo. Lo que cambia con un positivo aquí es qué carga se puede meter y si hay que derivar.',
    logica: 'cualquiera', tipo_lado: 'lateral', frecuencia_meses: 6,
    etiquetas: ['Rodilla', 'Menisco', 'Rotación', 'Supino'],
    objetivos: [],
    items: [
      { nombre: 'Dolor en interlínea medial' },
      { nombre: 'Dolor en interlínea intermedia' },
      { nombre: 'Dolor en interlínea lateral' },
      { nombre: 'McMurray medial positivo' },
      { nombre: 'McMurray lateral positivo' },
      { nombre: 'Apley en compresión positivo' },
      { nombre: 'Dolor en el cóndilo femoral lateral' },
    ],
  },
  {
    nombre: 'Rodilla · ligamentos',
    descripcion: 'Estabilidad en varo, valgo y cajones. Igual que los meniscos: es información para decidir la carga y, si hay bostezo franco o cajón claro, para derivar. No abre objetivo de entrenamiento.',
    logica: 'cualquiera', tipo_lado: 'lateral', frecuencia_meses: 6,
    etiquetas: ['Rodilla', 'Rotura de LCA', 'Abducción', 'Adducción', 'Supino'],
    objetivos: [],
    items: [
      { nombre: 'Valgo forzado (LLI) doloroso o inestable' },
      { nombre: 'Varo forzado (LLE) doloroso o inestable' },
      { nombre: 'Dolor a la palpación del ligamento interno' },
      { nombre: 'Cajón anterior positivo' },
      { nombre: 'Cajón posterior positivo' },
      { nombre: 'Apley en tracción positivo' },
    ],
  },
  {
    nombre: 'Rodilla · movilidad',
    descripcion: 'Recorrido en los dos sentidos. La extensión final importa más de lo que parece: los últimos grados son los que permiten caminar sin gastar cuádriceps en cada paso, y son los primeros que se pierden tras una inmovilización.',
    logica: 'cualquiera', tipo_lado: 'lateral', frecuencia_meses: 3,
    etiquetas: ['Rodilla', 'Flexión', 'Extensión', 'Supino'],
    objetivos: ['Ganar movilidad de rodilla'],
    items: [
      { nombre: 'Flexión que alcanza', unidad: 'grados' },
      { nombre: 'Extensión que alcanza', unidad: 'grados' },
      { nombre: 'Dolor al apoyar sobre la rodilla' },
    ],
  },
  {
    nombre: 'Rodilla · inserciones y sobrecarga',
    descripcion: 'Palpación de las inserciones que se irritan por uso: pata de ganso y cuerpo del cuádriceps. Suele salir positivo en quien ha subido carga o kilómetros de golpe, y se resuelve ajustando la progresión, no dejando de entrenar.',
    logica: 'cualquiera', tipo_lado: 'lateral', frecuencia_meses: 3,
    etiquetas: ['Rodilla', 'Cuádriceps', 'Isquiotibial', 'Supino'],
    objetivos: ['Calmar la rótula'],
    items: [
      { nombre: 'Dolor en la pata de ganso' },
      { nombre: 'Sobrecarga palpable del cuádriceps' },
    ],
  },
  {
    nombre: 'Rodilla · fuerza',
    descripcion: 'Cuádriceps e isquiotibial con dinamómetro. Lo que decide es la diferencia entre lados y la relación entre los dos: un isquiotibial por debajo del 60% del cuádriceps es un factor de riesgo conocido, aunque los dos números sean altos.',
    logica: 'cualquiera', tipo_lado: 'lateral', frecuencia_meses: 3,
    etiquetas: ['Rodilla', 'Cuádriceps', 'Isquiotibial', 'Sentado'],
    objetivos: ['Recuperar la fuerza de la rodilla'],
    items: [
      { nombre: 'Cuádriceps', unidad: 'kg' },
      { nombre: 'Isquiotibial', unidad: 'kg' },
    ],
  },

  // ── Cadera ────────────────────────────────────────────────────────────────
  {
    nombre: 'Cadera · movilidad',
    descripcion: 'Recorrido de la coxofemoral en los planos que se pierden antes. La rotación interna es la primera que se va en una cadera que empieza a artrosarse, y el straight leg raise mezcla isquiotibial y neural: si al bajar el pie duele igual, no era el músculo.',
    logica: 'cualquiera', tipo_lado: 'lateral', frecuencia_meses: 3,
    etiquetas: ['Cadera', 'Rotación', 'Abducción', 'Isquiotibial', 'Supino'],
    objetivos: ['Ganar rotación de cadera'],
    items: [
      { nombre: 'Straight leg raise', unidad: 'grados' },
      { nombre: 'Movilidad abductora', unidad: 'grados' },
      { nombre: 'Rotación interna', unidad: 'grados' },
      { nombre: 'Rotación externa', unidad: 'grados' },
      { nombre: 'Bloqueo de cadera: tope duro antes del final' },
    ],
  },
  {
    nombre: 'Cadera · fuerza',
    descripcion: 'Los cuatro grupos que sostienen la pelvis, con dinamómetro. Interesa la simetría y la relación aductor/abductor: el desequilibrio entre esos dos está detrás de buena parte de las pubalgias y las trocanteritis.',
    logica: 'cualquiera', tipo_lado: 'lateral', frecuencia_meses: 3,
    etiquetas: ['Cadera', 'Glúteo', 'Aductores', 'Psoas', 'Decúbito lateral'],
    objetivos: ['Recuperar la fuerza de la cadera'],
    items: [
      { nombre: 'Glúteo', unidad: 'kg' },
      { nombre: 'Abductor', unidad: 'kg' },
      { nombre: 'Aductor', unidad: 'kg' },
      { nombre: 'Psoas', unidad: 'kg' },
    ],
  },

  // ── Tronco y lumbar ───────────────────────────────────────────────────────
  {
    nombre: 'Lumbar · Schober',
    descripcion: 'Se marcan 10 cm desde S1 hacia arriba y se mide cuánto se separan al flexionar y al extender. Menos de 5 cm de incremento en flexión es restricción. Es de los pocos números fiables que hay en columna y se repite igual meses después.',
    logica: 'cualquiera', tipo_lado: 'bilateral', frecuencia_meses: 3,
    etiquetas: ['Lumbar', 'Flexión', 'Extensión', 'Lumbalgia', 'Bipedestación'],
    objetivos: ['Ganar movilidad lumbar'],
    items: [
      { nombre: 'Incremento en flexión', unidad: 'cm' },
      { nombre: 'Reducción en extensión', unidad: 'cm' },
      { nombre: 'Dolor al final del recorrido' },
    ],
  },
  {
    nombre: 'Dorsal · OTT',
    descripcion: 'El equivalente del Schober para la dorsal: 30 cm desde C7 hacia abajo. Interesa sobre todo en el que pasa el día sentado, porque una dorsal que no extiende la paga el cuello arriba y la lumbar abajo.',
    logica: 'cualquiera', tipo_lado: 'bilateral', frecuencia_meses: 3,
    etiquetas: ['Dorsal', 'Flexión', 'Extensión', 'Cifosis dorsal', 'Bipedestación'],
    objetivos: ['Ganar movilidad dorsal'],
    items: [
      { nombre: 'Incremento en flexión', unidad: 'cm' },
      { nombre: 'Incremento en extensión', unidad: 'cm' },
    ],
  },
  {
    nombre: 'Tronco · simetría y control',
    descripcion: 'Observación de la inclinación lateral y del control de la espalda en movimiento.',
    logica: 'cualquiera', tipo_lado: 'bilateral', frecuencia_meses: 6,
    etiquetas: ['Columna', 'Escoliosis', 'Erectores Espinales', 'Bipedestación'],
    objetivos: ['Ganar movilidad lumbar'],
    items: [
      { nombre: 'Asimetría del torso en inclinación lateral' },
      { nombre: 'Control motor y fascias de espalda alterado' },
    ],
  },
  {
    nombre: 'Tronco · fuerza',
    descripcion: 'Resistencia de la pared abdominal, de la lumbar y control lumbopélvico con el Sahrmann, que se anota como el nivel alcanzado del 1 al 5. Los tres juntos dicen más que cualquiera por separado: lo habitual es lumbar fuerte y abdomen que no aguanta.',
    logica: 'cualquiera', tipo_lado: 'bilateral', frecuencia_meses: 3,
    etiquetas: ['Abdomen', 'Erectores Espinales', 'Antiextensión', 'Supino'],
    objetivos: ['Ganar resistencia de core'],
    items: [
      { nombre: 'Resistencia abdominal', unidad: 'segundos' },
      { nombre: 'Resistencia lumbar', unidad: 'segundos' },
      { nombre: 'Nivel de Sahrmann alcanzado', unidad: 'repeticiones' },
    ],
  },

  // ── Cervical ──────────────────────────────────────────────────────────────
  {
    nombre: 'Cervical · movilidad y función',
    descripcion: 'Rotación medida y valoración del recorrido funcional. La rotación es el movimiento que más se usa y el que más limita cuando falla: mirar al ángulo muerto al conducir es el ejemplo que entiende cualquiera.',
    logica: 'cualquiera', tipo_lado: 'lateral', frecuencia_meses: 3,
    etiquetas: ['Cervical', 'Rotación', 'Cervicalgia', 'Sentado'],
    objetivos: ['Ganar movilidad cervical'],
    items: [
      { nombre: 'Rotación que alcanza', unidad: 'grados' },
      { nombre: 'Función cervical limitada en el día a día' },
      { nombre: 'Bloqueo: tope duro antes del final' },
    ],
  },
  {
    nombre: 'Cervical · provocación',
    descripcion: 'Maniobras que reproducen el síntoma. Es exploración pura y no abre objetivo: un positivo aquí decide si se trabaja el cuello esta semana o se espera, y con qué intensidad.',
    logica: 'cualquiera', tipo_lado: 'bilateral', frecuencia_meses: 6,
    etiquetas: ['Cervical', 'Cervicalgia', 'Hernia discal', 'Supino'],
    objetivos: [],
    items: [
      { nombre: 'Soto-Hall: dolor en la nuca' },
      { nombre: 'Soto-Hall: tirantez sin dolor' },
      { nombre: "O'Donoghue: dolor con la movilización pasiva" },
      { nombre: "O'Donoghue: dolor con la contracción resistida" },
      { nombre: 'Daño cervical evidente en la exploración' },
    ],
  },
  {
    nombre: 'Cervical · fuerza y control',
    descripcion: 'Fuerza global y control de los flexores profundos. El control importa más que el número: el que sostiene la cabeza ocho horas no lo hace con fuerza máxima sino con resistencia de la musculatura profunda.',
    logica: 'cualquiera', tipo_lado: 'bilateral', frecuencia_meses: 3,
    etiquetas: ['Cervical', 'Flexión', 'Cervicalgia', 'Supino'],
    objetivos: ['Ganar fuerza y control cervical'],
    items: [
      { nombre: 'Fuerza cervical', unidad: 'kg' },
      { nombre: 'Control motor cervical alterado' },
    ],
  },

  // ── Patrón ────────────────────────────────────────────────────────────────
  {
    nombre: 'Sentadilla unipodal',
    descripcion: 'Lo que la sentadilla bilateral esconde: con las dos piernas se compensa con la buena sin que se note. A una pierna aparecen el valgo de rodilla y el descenso de la pelvis del lado libre, que es el Trendelenburg de toda la vida bajo carga.',
    logica: 'cualquiera', tipo_lado: 'lateral', frecuencia_meses: 3,
    etiquetas: ['Sentadilla', 'Rodilla', 'Glúteo medio', 'Unipodal', 'Bipedestación'],
    objetivos: ['Mejorar el control a una pierna'],
    items: [
      { nombre: 'Profundidad que alcanza', unidad: 'cm' },
      { nombre: 'La rodilla cae hacia dentro' },
      { nombre: 'La cadera del lado libre desciende (Trendelenburg)' },
      { nombre: 'Pierde el equilibrio antes de bajar' },
    ],
  },
]

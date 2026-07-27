// Catálogo de arranque de la biblioteca, con la ficha completa de cada ejercicio.
//
// Va por bloques: primero los diez generales con los que se empezó, y luego un bloque
// por grupo muscular a medida que se vayan montando. Ahora mismo, cuádriceps.
//
// Se mantienen aquí y no en la base para que el alta sea repetible: si algún día hay
// que montar otra instalación de la app, esto es el catálogo mínimo con el que se
// empieza a trabajar.
//
// Cada ejercicio lleva su PATRÓN además del músculo: es lo que hace que el buscador
// de ejercicios parecidos funcione. Con solo músculos, una sentadilla y un curl
// comparten "Flexión" y "Extensión" y saldrían emparejados.
//
// Las etiquetas van por NOMBRE, no por id: el sembrador las busca en la tabla
// `etiquetas` y avisa de las que no encuentre, en vez de fallar. Así funciona aunque
// tu árbol de etiquetas no sea idéntico al que se pensó aquí.

export type SemillaEjercicio = {
  archivo: string
  nombre: string
  descripcion: string
  tipo_medida: 'peso_reps' | 'tiempo' | 'peso_tiempo'
  etiquetas: string[]
  items_ejecucion: string[]
  feedbacks: string[]
  /**
   * Variantes de arranque. Solo se aplican al CREAR el ejercicio: si ya existe, el
   * sembrador no las toca, porque a esas alturas las tuyas mandan sobre las de aquí.
   */
  variantes?: { nombre: string, descripcion: string }[]
}

export const SEMILLA: SemillaEjercicio[] = [
  {
    archivo: 'sentadilla-trasera.jpg',
    nombre: 'Sentadilla trasera',
    descripcion: 'Barra apoyada en la espalda alta. Se baja llevando la cadera atrás y abajo hasta que los muslos queden al menos paralelos al suelo, y se sube empujando el suelo con todo el pie.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Cuádriceps', 'Glúteo', 'Rodilla', 'Cadera', 'Barra', 'Sentadilla', 'Global'],
    items_ejecucion: [
      'Las rodillas siguen la dirección de los pies, sin caer hacia dentro',
      'El talón no se despega del suelo',
      'La espalda mantiene su curva, sin redondearse abajo',
      'Baja al menos hasta muslos paralelos',
    ],
    feedbacks: ['Rodillas hacia fuera', 'Empuja el suelo con todo el pie', 'Pecho arriba'],
  },
  {
    archivo: 'peso-muerto-rumano.jpg',
    nombre: 'Peso muerto rumano',
    descripcion: 'Bisagra de cadera con las piernas casi extendidas. La barra baja pegada a la pierna hasta notar tensión en la parte posterior del muslo, y se sube empujando la cadera adelante.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Isquiotibiales', 'Glúteo', 'Cadera', 'Barra', 'Bisagra de cadera', 'Global'],
    items_ejecucion: [
      'El movimiento nace en la cadera, no en la zona lumbar',
      'La espalda se mantiene recta durante todo el recorrido',
      'La barra baja pegada a la pierna',
      'Las rodillas quedan ligeramente flexionadas, no bloqueadas',
    ],
    feedbacks: ['Lleva la cadera atrás', 'Barra pegada a la pierna', 'Para cuando notes el tirón detrás'],
  },
  {
    archivo: 'zancada-bulgara.jpg',
    nombre: 'Zancada búlgara',
    descripcion: 'Pie trasero elevado sobre un banco. Se baja en vertical hasta que la rodilla adelantada llegue a noventa grados, manteniendo el tronco erguido.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Cuádriceps', 'Glúteo', 'Rodilla', 'Unilateral', 'Mancuernas', 'Zancada', 'Global'],
    items_ejecucion: [
      'La rodilla delantera no se desvía hacia dentro',
      'El tronco se mantiene erguido, sin caer adelante',
      'El descenso es vertical, no hacia delante',
      'La cadera queda estable, sin bascular a un lado',
    ],
    feedbacks: ['Peso en el pie de delante', 'Baja recto', 'No dejes caer la cadera'],
  },
  {
    archivo: 'puente-de-gluteo-musculos.jpg',
    nombre: 'Puente de glúteo',
    descripcion: 'Tumbado boca arriba con los pies apoyados. Se eleva la cadera hasta formar una línea recta entre hombro, cadera y rodilla, apretando el glúteo arriba.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Glúteo', 'Cadera', 'Core', 'Bisagra de cadera', 'Global'],
    items_ejecucion: [
      'Sube empujando con el talón, no con la punta del pie',
      'El glúteo aprieta antes que los isquiotibiales',
      'La zona lumbar no se arquea al llegar arriba',
      'Hombro, cadera y rodilla quedan alineados',
    ],
    feedbacks: ['Aprieta el glúteo arriba', 'No arquees la lumbar', 'Empuja con el talón'],
  },
  {
    archivo: 'press-banca.jpg',
    nombre: 'Press de banca',
    descripcion: 'Tumbado en banco horizontal. La barra baja controlada hasta el pecho con los codos a unos cuarenta y cinco grados, y se empuja hasta extender los brazos.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Pectoral', 'Tríceps', 'Hombro', 'Barra', 'Empuje horizontal', 'Global'],
    items_ejecucion: [
      'Los codos quedan a unos 45°, no abiertos del todo',
      'Las escápulas se mantienen juntas y apoyadas',
      'La barra toca el pecho de forma controlada',
      'Los pies siguen apoyados en el suelo',
    ],
    feedbacks: ['Junta las escápulas', 'Codos algo cerrados', 'Baja controlando'],
  },
  {
    archivo: 'remo-con-barra-musculos.jpg',
    nombre: 'Remo con barra',
    descripcion: 'Tronco inclinado unos cuarenta y cinco grados con la espalda recta. Se tracciona la barra hacia el abdomen llevando los codos atrás y juntando las escápulas.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Dorsal', 'Escápula', 'Bíceps', 'Barra', 'Tracción horizontal', 'Global'],
    items_ejecucion: [
      'El tirón empieza en la escápula, no en el bíceps',
      'Los codos van hacia atrás, pegados al cuerpo',
      'La espalda mantiene su curva, sin redondearse',
      'El tronco no se incorpora para ayudar al tirón',
    ],
    feedbacks: ['Junta las escápulas', 'Codos atrás', 'No subas el cuerpo'],
  },
  {
    archivo: 'press-militar.jpg',
    nombre: 'Press militar de pie',
    descripcion: 'De pie, barra a la altura de la clavícula. Se empuja sobre la cabeza hasta extender los brazos, sin arquear la zona lumbar.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Hombro', 'Tríceps', 'Core', 'Barra', 'Empuje vertical', 'Global'],
    items_ejecucion: [
      'La zona lumbar no se arquea al empujar',
      'El glúteo y el abdomen se mantienen activos',
      'La barra sube en vertical, pegada a la cara',
      'Arriba, la cabeza pasa por delante de la barra',
    ],
    feedbacks: ['Aprieta el abdomen', 'No arquees la espalda', 'Barra pegada a la cara'],
  },
  {
    archivo: 'plancha-frontal.jpg',
    nombre: 'Plancha frontal',
    descripcion: 'Apoyo en antebrazos y puntas de los pies, con el cuerpo formando una línea recta. Se mantiene la posición el tiempo indicado sin perder la alineación.',
    tipo_medida: 'tiempo',
    etiquetas: ['Core', 'Abdomen', 'Global'],
    items_ejecucion: [
      'La cadera no cae ni se eleva',
      'Los codos quedan bajo los hombros',
      'La zona lumbar no se arquea',
      'La respiración se mantiene, no se aguanta el aire',
    ],
    feedbacks: ['Mete el ombligo', 'Cadera en línea', 'Sigue respirando'],
  },
  {
    archivo: 'plancha-lateral.jpg',
    nombre: 'Plancha lateral',
    descripcion: 'Apoyo en un antebrazo y el canto del pie, con la cadera elevada y el cuerpo alineado. Se mantiene el tiempo indicado por cada lado.',
    tipo_medida: 'tiempo',
    etiquetas: ['Core', 'Abdomen', 'Cadera', 'Unilateral', 'Global'],
    items_ejecucion: [
      'La cadera se mantiene elevada, sin caer al suelo',
      'El codo queda bajo el hombro',
      'El cuerpo forma una línea recta vista de frente',
      'La cadera no rota hacia delante ni atrás',
    ],
    feedbacks: ['Sube la cadera', 'No rotes el tronco', 'Codo bajo el hombro'],
  },
  {
    archivo: 'movilidad-toracica.jpg',
    nombre: 'Movilidad torácica en cuadrupedia',
    descripcion: 'A cuatro patas, una mano tras la nuca. Se rota el tronco abriendo el pecho hacia el techo y se vuelve despacio, sin mover la cadera.',
    tipo_medida: 'tiempo',
    etiquetas: ['Dorsal', 'Movilidad', 'Columna', 'Analítico'],
    items_ejecucion: [
      'La rotación nace del tórax, no de la zona lumbar',
      'La cadera se mantiene quieta y cuadrada',
      'La mirada acompaña al codo que sube',
      'El movimiento es lento y controlado',
    ],
    feedbacks: ['Abre el pecho, no la cadera', 'Mira al codo', 'Despacio'],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CUÁDRICEPS
  //
  // Primer bloque de la biblioteca por grupo muscular. Solo material que hay en la
  // sala: sin prensa ni máquina de extensión, la progresión de rodilla se construye
  // con peso libre, cinchas y apoyos.
  //
  // Los que llevan "Vasto interno" buscan ÉNFASIS, no aislamiento: últimos grados de
  // extensión y cadera en aducción. La evidencia de activación selectiva es floja, así
  // que la etiqueta sirve para encontrarlos, no para prometer nada.
  // ─────────────────────────────────────────────────────────────────────────────

  {
    archivo: 'sentadilla-frontal.jpg',
    nombre: 'Sentadilla frontal',
    descripcion: 'Barra apoyada delante, sobre los deltoides y la clavícula, con los codos altos. Se baja con el tronco vertical hasta al menos muslos paralelos y se sube empujando el suelo.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Cuádriceps', 'Glúteo', 'Core', 'Rodilla', 'Barra', 'Rack', 'Sentadilla', 'Global'],
    items_ejecucion: [
      'Los codos se mantienen altos durante todo el recorrido',
      'El tronco queda vertical, sin caer adelante',
      'Las rodillas siguen la dirección de los pies',
      'El talón no se despega del suelo',
    ],
    feedbacks: ['Codos arriba', 'Pecho vertical', 'Empuja el suelo'],
    variantes: [
      { nombre: 'Agarre limpio', descripcion: 'Dedos bajo la barra, codos al frente. Pide muñeca y hombro.' },
      { nombre: 'Agarre cruzado', descripcion: 'Brazos cruzados sujetando la barra. Más accesible si falta movilidad.' },
    ],
  },
  {
    archivo: 'sentadilla-goblet.jpg',
    nombre: 'Sentadilla goblet',
    descripcion: 'Peso sujeto contra el pecho con las dos manos. Se baja entre las rodillas manteniendo el tronco erguido y se sube empujando el suelo.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Cuádriceps', 'Glúteo', 'Core', 'Rodilla', 'Mancuernas', 'Kettlebell', 'Sentadilla', 'Global'],
    items_ejecucion: [
      'El peso se mantiene pegado al pecho, sin separarse',
      'Los codos bajan por dentro de las rodillas',
      'La espalda mantiene su curva, sin redondearse abajo',
      'Las rodillas no caen hacia dentro al subir',
    ],
    feedbacks: ['Peso pegado al pecho', 'Codos por dentro', 'Rodillas hacia fuera'],
    variantes: [
      { nombre: 'Con mancuerna', descripcion: 'Sujeta por un extremo, en vertical.' },
      { nombre: 'Con kettlebell', descripcion: 'Por las asas, con la bola apoyada en el pecho.' },
      { nombre: 'Con disco', descripcion: 'Sujeto por los cantos. Útil cuando el salto de peso de las mancuernas es grande.' },
    ],
  },
  {
    archivo: 'sentadilla-al-banco.jpg',
    nombre: 'Sentadilla al banco',
    descripcion: 'Se baja controlando hasta rozar el banco con el glúteo, sin dejarse caer, y se sube sin impulso. El banco marca la profundidad y da referencia de hasta dónde llegar.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Cuádriceps', 'Glúteo', 'Rodilla', 'Banco', 'Sentadilla', 'Global'],
    items_ejecucion: [
      'El glúteo roza el banco, no se deja caer sobre él',
      'La subida sale sin balancear el tronco para coger impulso',
      'El peso se reparte en todo el pie, no solo en la punta',
      'Las rodillas siguen la dirección de los pies',
    ],
    feedbacks: ['Toca, no te sientes', 'Sube sin impulso', 'Reparte el peso en el pie'],
    variantes: [
      { nombre: 'Peso corporal', descripcion: 'Sin carga. Punto de partida en rodilla que empieza.' },
      { nombre: 'Con mancuerna', descripcion: 'Sujeta contra el pecho, tipo goblet.' },
      { nombre: 'A una pierna', descripcion: 'Pierna libre extendida al frente. Exige mucho control de cadera.' },
    ],
  },
  {
    archivo: 'sentadilla-suspension.jpg',
    nombre: 'Sentadilla asistida en suspensión',
    descripcion: 'De pie frente a las cinchas, sujeto con los dos brazos. Se baja llevando la cadera atrás, usando los brazos solo lo justo para descargar peso, y se sube con las piernas.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Cuádriceps', 'Glúteo', 'Rodilla', 'Cinchas de suspensión', 'Sentadilla', 'Global'],
    items_ejecucion: [
      'Los brazos asisten, no tiran: el trabajo lo hacen las piernas',
      'Las cinchas se mantienen tensas, sin dar tirones',
      'El tronco queda erguido y los talones apoyados',
      'Se llega a una profundidad mayor que sin asistencia, sin dolor',
    ],
    feedbacks: ['Los brazos solo acompañan', 'Baja más de lo que bajarías solo', 'Talones al suelo'],
    variantes: [
      { nombre: 'Bilateral', descripcion: 'Con los dos pies. La versión de entrada.' },
      { nombre: 'A una pierna', descripcion: 'Pierna libre al frente. Escalón previo a la sentadilla unipodal libre.' },
      { nombre: 'Isométrica', descripcion: 'Se mantiene la posición abajo el tiempo indicado.' },
    ],
  },
  {
    archivo: 'sentadilla-landmine.jpg',
    nombre: 'Sentadilla landmine',
    descripcion: 'Un extremo de la barra anclado al suelo y el otro sujeto a la altura del pecho. El anclaje ayuda a mantener el tronco vertical, así que perdona movilidad de tobillo y de hombro.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Cuádriceps', 'Glúteo', 'Core', 'Rodilla', 'Landmine', 'Barra', 'Sentadilla', 'Global'],
    items_ejecucion: [
      'La barra se mantiene pegada al pecho, sin alejarse',
      'El tronco queda vertical, apoyándose en el arco de la barra',
      'Las rodillas siguen la dirección de los pies',
      'La subida sale de las piernas, no de tirar con los brazos',
    ],
    feedbacks: ['Barra al pecho', 'Deja que la barra te sostenga', 'Empuja con las piernas'],
    variantes: [
      { nombre: 'Bilateral', descripcion: 'Los dos pies a la anchura de la cadera.' },
      { nombre: 'Con giro', descripcion: 'Se acompaña con una rotación de tronco al subir. Pasa a ser combinado.' },
    ],
  },
  {
    archivo: 'sentadilla-pared.jpg',
    nombre: 'Sentadilla isométrica en pared',
    descripcion: 'Espalda apoyada en la pared y rodillas a noventa grados. Se mantiene la posición el tiempo indicado sin despegar la espalda ni dejar caer la cadera.',
    tipo_medida: 'tiempo',
    etiquetas: ['Cuádriceps', 'Vasto interno', 'Rodilla', 'Pared', 'Pelota', 'Sentadilla', 'Global'],
    items_ejecucion: [
      'La espalda se mantiene pegada a la pared en todo momento',
      'Las rodillas quedan sobre los tobillos, no por delante de la punta',
      'Las rodillas no caen hacia dentro',
      'La respiración se mantiene, no se aguanta el aire',
    ],
    feedbacks: ['Espalda pegada', 'No dejes caer la cadera', 'Sigue respirando'],
    variantes: [
      { nombre: 'Bilateral', descripcion: 'Los dos pies apoyados, rodillas a 90°.' },
      { nombre: 'Con pelota entre rodillas', descripcion: 'Apretando la pelota. Busca énfasis en vasto interno.' },
      { nombre: 'Unipodal', descripcion: 'Una pierna extendida al frente. Mucho más exigente.' },
    ],
  },
  {
    archivo: 'sentadilla-sissy.jpg',
    nombre: 'Sentadilla sissy',
    descripcion: 'De pie, se lleva la rodilla adelante y el tronco atrás manteniendo la línea de rodilla a hombro, elevando los talones. Trabaja el cuádriceps en un rango que la sentadilla normal no alcanza.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Cuádriceps', 'Vasto interno', 'Rodilla', 'Stick', 'Sentadilla', 'Global'],
    items_ejecucion: [
      'La cadera no se flexiona: rodilla y hombro quedan en línea',
      'El descenso es lento y controlado, sin caídas',
      'No aparece dolor en la cara anterior de la rodilla',
      'Se vuelve arriba sin ayudarse con el tronco',
    ],
    feedbacks: ['Cadera adelante, no la dobles', 'Baja despacio', 'Para si molesta la rodilla'],
    variantes: [
      { nombre: 'Asistida con stick', descripcion: 'Apoyado en un stick o en el rack para controlar el descenso.' },
      { nombre: 'Libre', descripcion: 'Sin apoyo. Exige rodilla sana y buen control.' },
    ],
  },
  {
    archivo: 'zancada.jpg',
    nombre: 'Zancada',
    descripcion: 'Se da un paso y se baja en vertical hasta que la rodilla adelantada llegue a noventa grados, manteniendo el tronco erguido, y se vuelve empujando con el pie de delante.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Cuádriceps', 'Glúteo', 'Rodilla', 'Unilateral', 'Mancuernas', 'Zancada', 'Global'],
    items_ejecucion: [
      'El descenso es vertical, no hacia delante',
      'La rodilla de delante no se desvía hacia dentro',
      'El tronco se mantiene erguido',
      'La rodilla de atrás baja hacia el suelo sin golpearlo',
    ],
    feedbacks: ['Baja recto', 'Peso en el pie de delante', 'Tronco arriba'],
    variantes: [
      { nombre: 'Adelante', descripcion: 'Paso al frente. Más exigente para frenar.' },
      { nombre: 'Atrás', descripcion: 'Paso hacia atrás. Más amable con la rodilla, primera opción en rehabilitación.' },
      { nombre: 'Caminando', descripcion: 'Encadenando pasos. Añade equilibrio dinámico.' },
      { nombre: 'En el sitio', descripcion: 'Sin desplazarse, subiendo y bajando en la misma posición.' },
    ],
  },
  {
    archivo: 'sentadilla-split.jpg',
    nombre: 'Sentadilla split',
    descripcion: 'Posición de zancada mantenida, un pie delante y otro detrás sin moverlos. Se sube y baja en vertical repartiendo el peso principalmente en la pierna de delante.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Cuádriceps', 'Glúteo', 'Rodilla', 'Unilateral', 'Mancuernas', 'Zancada', 'Global'],
    items_ejecucion: [
      'Los pies no se mueven entre repeticiones',
      'El descenso es vertical, no adelante y atrás',
      'La mayor parte del peso queda en la pierna de delante',
      'La cadera no bascula hacia un lado',
    ],
    feedbacks: ['Pies quietos', 'Sube y baja recto', 'Peso delante'],
    variantes: [
      { nombre: 'Peso corporal', descripcion: 'Sin carga. Para aprender la posición.' },
      { nombre: 'Con mancuernas', descripcion: 'Una en cada mano, brazos colgando.' },
      { nombre: 'Pie delantero elevado', descripcion: 'Sobre un disco o plataforma. Más rango de rodilla.' },
    ],
  },
  {
    archivo: 'zancada-lateral.jpg',
    nombre: 'Zancada lateral',
    descripcion: 'Paso amplio hacia un lado. Se flexiona la rodilla de ese lado llevando la cadera atrás mientras la otra pierna queda extendida, y se vuelve empujando con el pie que se flexionó.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Cuádriceps', 'Glúteo', 'Aductores', 'Cadera', 'Unilateral', 'Mancuernas', 'Zancada', 'Global'],
    items_ejecucion: [
      'Los dos pies apuntan al frente durante todo el movimiento',
      'La cadera va hacia atrás, no solo la rodilla adelante',
      'La pierna que no trabaja queda extendida, con el pie apoyado',
      'El tronco se inclina algo, pero la espalda no se redondea',
    ],
    feedbacks: ['Pies al frente', 'Cadera atrás', 'Estira bien la otra pierna'],
    variantes: [
      { nombre: 'Peso corporal', descripcion: 'Sin carga.' },
      { nombre: 'Con mancuerna', descripcion: 'Sujeta al pecho tipo goblet, ayuda a contrapesar.' },
      { nombre: 'Con deslizador', descripcion: 'El pie que se abre sobre el deslizador. Añade control excéntrico.' },
    ],
  },
  {
    archivo: 'zancada-deslizador.jpg',
    nombre: 'Zancada con deslizador',
    descripcion: 'Un pie sobre el deslizador, que se desplaza mientras el otro sostiene el peso. El movimiento no tiene fase de impacto, así que el control lo lleva la pierna de apoyo de principio a fin.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Cuádriceps', 'Glúteo', 'Rodilla', 'Unilateral', 'Deslizador', 'Zancada', 'Global'],
    items_ejecucion: [
      'El deslizador se mueve despacio, sin escaparse',
      'El peso se queda en la pierna de apoyo',
      'La rodilla de apoyo no se desvía hacia dentro',
      'La cadera se mantiene cuadrada, sin rotar',
    ],
    feedbacks: ['Controla el deslizamiento', 'Peso en la pierna de apoyo', 'Cadera cuadrada'],
    variantes: [
      { nombre: 'Atrás', descripcion: 'El pie desliza hacia atrás. La versión de entrada.' },
      { nombre: 'Lateral', descripcion: 'El pie desliza hacia el lado. Añade trabajo de aductores.' },
    ],
  },
  {
    archivo: 'subida-al-cajon.jpg',
    nombre: 'Subida al cajón',
    descripcion: 'Se apoya un pie completo en el cajón y se sube empujando con esa pierna, sin impulsarse con la de abajo. La bajada se hace controlada, que es donde está el trabajo.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Cuádriceps', 'Glúteo', 'Rodilla', 'Unilateral', 'Cajón', 'Mancuernas', 'Zancada', 'Global'],
    items_ejecucion: [
      'La subida sale de la pierna de arriba, sin impulso del pie de abajo',
      'El pie apoya completo en el cajón, no solo la punta',
      'La rodilla no se desvía hacia dentro',
      'La bajada es controlada, sin dejarse caer',
    ],
    feedbacks: ['No te impulses abajo', 'Pie entero en el cajón', 'Baja despacio'],
    variantes: [
      { nombre: 'Frontal', descripcion: 'De frente al cajón.' },
      { nombre: 'Lateral', descripcion: 'Subiendo de lado. Más trabajo de glúteo medio.' },
      { nombre: 'Con mancuernas', descripcion: 'Una en cada mano, brazos colgando.' },
    ],
  },
  {
    archivo: 'salto-al-cajon.jpg',
    nombre: 'Salto al cajón',
    descripcion: 'Se salta al cajón cayendo con las rodillas flexionadas y los pies completos. Se baja andando, no saltando: el impacto de la caída al suelo es lo que no interesa.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Cuádriceps', 'Glúteo', 'Rodilla', 'Cajón pliométrico', 'Salto', 'Global'],
    items_ejecucion: [
      'La caída es silenciosa, amortiguando con la rodilla y la cadera',
      'Los dos pies apoyan completos sobre el cajón',
      'Las rodillas no caen hacia dentro al aterrizar',
      'Se baja del cajón andando, no saltando',
    ],
    feedbacks: ['Cae en silencio', 'Amortigua con la cadera', 'Baja andando'],
    variantes: [
      { nombre: 'A dos pies', descripcion: 'Salto y caída simétricos.' },
      { nombre: 'A una pierna', descripcion: 'Último escalón de una progresión de rodilla.' },
      { nombre: 'Con caída controlada', descripcion: 'Solo la bajada desde el cajón, aterrizando suave. Trabajo excéntrico sin el salto.' },
    ],
  },
  {
    archivo: 'extension-terminal-rodilla.jpg',
    nombre: 'Extensión terminal de rodilla',
    descripcion: 'Banda anclada al frente, pasada por detrás de la rodilla ligeramente flexionada. Se extiende la rodilla contra la resistencia en los últimos grados y se vuelve despacio.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Cuádriceps', 'Vasto interno', 'Rodilla', 'Banda elástica', 'Analítico'],
    items_ejecucion: [
      'El movimiento es solo de rodilla: la cadera no se mueve',
      'Se llega a la extensión completa en cada repetición',
      'La rótula no se fuerza: no debe aparecer dolor anterior',
      'La vuelta es lenta, sin dejar que la banda tire',
    ],
    feedbacks: ['Estira del todo', 'Solo la rodilla', 'Vuelve despacio'],
    variantes: [
      { nombre: 'Con banda de pie', descripcion: 'En carga, con el pie apoyado. Cadena cerrada.' },
      { nombre: 'En camilla', descripcion: 'Sentado o tumbado, con una toalla bajo la rodilla.' },
      { nombre: 'Isométrica', descripcion: 'Se mantiene la extensión el tiempo indicado. Primera opción cuando duele mover.' },
    ],
  },
]

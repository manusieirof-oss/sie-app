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
    etiquetas: ['Isquiotibial', 'Glúteo', 'Cadera', 'Barra', 'Bisagra de cadera', 'Global'],
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
    etiquetas: ['Cuádriceps', 'Glúteo', 'Rodilla', 'Unilateral', 'Mancuerna', 'Zancada', 'Global'],
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
    etiquetas: ['Glúteo', 'Cadera', 'Bisagra de cadera', 'Global'],
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
    etiquetas: ['Dorsal Ancho', 'Trapecio', 'Bíceps', 'Barra', 'Tracción horizontal', 'Global'],
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
    etiquetas: ['Hombro', 'Tríceps', 'Barra', 'Empuje vertical', 'Global'],
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
    etiquetas: ['Abdomen', 'Global'],
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
    etiquetas: ['Abdomen', 'Cadera', 'Unilateral', 'Global'],
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
    etiquetas: ['Dorsal Ancho', 'Columna', 'Rotación', 'Analítico'],
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
    etiquetas: ['Cuádriceps', 'Glúteo', 'Rodilla', 'Barra', 'Rack', 'Sentadilla', 'Global'],
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
    etiquetas: ['Cuádriceps', 'Glúteo', 'Rodilla', 'Mancuerna', 'Kettlebell', 'Sentadilla', 'Global'],
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
    etiquetas: ['Cuádriceps', 'Glúteo', 'Rodilla', 'Landmine', 'Barra', 'Sentadilla', 'Global'],
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
    etiquetas: ['Cuádriceps', 'Vasto Medial', 'Rodilla', 'Pared', 'Pelota', 'Sentadilla', 'Global'],
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
    etiquetas: ['Cuádriceps', 'Vasto Medial', 'Rodilla', 'Stick', 'Sentadilla', 'Global'],
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
    etiquetas: ['Cuádriceps', 'Glúteo', 'Rodilla', 'Unilateral', 'Mancuerna', 'Zancada', 'Global'],
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
    etiquetas: ['Cuádriceps', 'Glúteo', 'Rodilla', 'Unilateral', 'Mancuerna', 'Zancada', 'Global'],
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
    etiquetas: ['Cuádriceps', 'Glúteo', 'Aductores', 'Cadera', 'Unilateral', 'Mancuerna', 'Zancada', 'Global'],
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
    etiquetas: ['Cuádriceps', 'Glúteo', 'Rodilla', 'Unilateral', 'Cajón', 'Mancuerna', 'Zancada', 'Global'],
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
    etiquetas: ['Cuádriceps', 'Vasto Medial', 'Rodilla', 'Banda elástica', 'Analítico'],
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

  // ─────────────────────────────────────────────────────────────────────────────
  // ISQUIOTIBIALES Y GLÚTEO
  //
  // Ya estaban peso muerto rumano y puente de glúteo, así que no se repiten.
  //
  // El bloque separa dos cosas que suelen ir juntas y no son lo mismo: la EXTENSIÓN
  // de cadera (peso muerto, hip thrust, swing) y la ESTABILIDAD lateral, que es
  // glúteo medio y necesita ejercicios propios. Sin esos últimos no hay respuesta
  // para la rodilla que cae hacia dentro, que es media consulta de rodilla.
  // ─────────────────────────────────────────────────────────────────────────────

  {
    archivo: 'peso-muerto.jpg',
    nombre: 'Peso muerto convencional',
    descripcion: 'Barra en el suelo, pies bajo ella. Se agarra con la espalda recta y se levanta extendiendo cadera y rodillas a la vez, con la barra pegada a la pierna, hasta quedar de pie.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Isquiotibial', 'Glúteo', 'Glúteo mayor', 'Cadera', 'Columna', 'Barra olímpica', 'Bisagra de cadera', 'Global'],
    items_ejecucion: [
      'La espalda mantiene su curva, sin redondearse en ningún momento',
      'La barra sube pegada a la pierna, sin alejarse del cuerpo',
      'La cadera y el pecho suben a la vez, no primero la cadera',
      'Arriba se extiende la cadera sin arquear la lumbar',
    ],
    feedbacks: ['Pecho arriba antes de tirar', 'Barra pegada a la pierna', 'Sube todo a la vez'],
    variantes: [
      { nombre: 'Convencional', descripcion: 'Pies a la anchura de la cadera, manos por fuera de las piernas.' },
      { nombre: 'Sumo', descripcion: 'Pies muy abiertos y manos por dentro. Menos exigencia de espalda, más de cadera.' },
      { nombre: 'Desde cajón', descripcion: 'La barra elevada sobre un cajón. Menos rango, para quien no llega abajo con la espalda recta.' },
    ],
  },
  {
    archivo: 'peso-muerto-una-pierna.jpg',
    nombre: 'Peso muerto a una pierna',
    descripcion: 'Sobre una pierna, se lleva la cadera atrás mientras la otra pierna sube extendida por detrás, hasta que tronco y pierna formen una línea horizontal. Se vuelve empujando la cadera adelante.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Isquiotibial', 'Glúteo', 'Cadera', 'Unilateral', 'Mancuerna', 'Kettlebell', 'Bisagra de cadera', 'Global'],
    items_ejecucion: [
      'Tronco y pierna de atrás forman una línea recta',
      'La cadera se mantiene cuadrada, sin abrirse hacia el lado',
      'La rodilla de apoyo queda algo flexionada, no bloqueada',
      'El movimiento nace en la cadera, no en la zona lumbar',
    ],
    feedbacks: ['Cadera cuadrada', 'La pierna y la espalda, en línea', 'Empuja la cadera adelante'],
    variantes: [
      { nombre: 'Con mancuerna contralateral', descripcion: 'El peso en la mano contraria a la pierna de apoyo. Exige más control de cadera.' },
      { nombre: 'Con dos mancuernas', descripcion: 'Una en cada mano. Más estable, buen punto de partida.' },
      { nombre: 'Asistida con stick', descripcion: 'Una mano en un apoyo. Para aprender el gesto sin pelearse con el equilibrio.' },
    ],
  },
  {
    archivo: 'hip-thrust.jpg',
    nombre: 'Hip thrust',
    descripcion: 'Espalda alta apoyada en un banco y pies en el suelo. Se eleva la cadera hasta formar una línea recta de rodilla a hombro, apretando el glúteo arriba, y se baja controlando.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Glúteo', 'Glúteo mayor', 'Cadera', 'Banco', 'Barra', 'Bisagra de cadera', 'Global'],
    items_ejecucion: [
      'Arriba, rodilla, cadera y hombro quedan alineados',
      'La zona lumbar no se arquea al llegar arriba',
      'La barbilla se mantiene metida, mirando al frente',
      'El empuje sale del talón, no de la punta del pie',
    ],
    feedbacks: ['Aprieta el glúteo arriba', 'No arquees la lumbar', 'Mira al frente'],
    variantes: [
      { nombre: 'Con barra', descripcion: 'Barra sobre la cadera, con almohadilla. La versión cargable.' },
      { nombre: 'Con disco', descripcion: 'Un disco sobre la cadera. Para cargas menores.' },
      { nombre: 'A una pierna', descripcion: 'Sin peso, apoyando un solo pie. Exige mucho control de cadera.' },
    ],
  },
  {
    archivo: 'buenos-dias.jpg',
    nombre: 'Buenos días',
    descripcion: 'Barra en la espalda alta. Se inclina el tronco hacia delante llevando la cadera atrás, con las piernas casi extendidas, hasta notar tensión detrás del muslo, y se sube empujando la cadera.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Isquiotibial', 'Glúteo', 'Cadera', 'Columna', 'Barra', 'Rack', 'Bisagra de cadera', 'Global'],
    items_ejecucion: [
      'El movimiento nace en la cadera, no en la zona lumbar',
      'La espalda se mantiene recta durante todo el recorrido',
      'Las rodillas quedan ligeramente flexionadas, no bloqueadas',
      'Se baja solo hasta donde la espalda aguanta recta',
    ],
    feedbacks: ['Cadera atrás', 'Espalda recta', 'Para cuando notes el tirón detrás'],
    variantes: [
      { nombre: 'Con barra', descripcion: 'Barra en la espalda alta, como una sentadilla.' },
      { nombre: 'Con banda', descripcion: 'Banda pisada y pasada por la nuca. Carga suave, buen aprendizaje.' },
      { nombre: 'Sentado', descripcion: 'Sentado en un banco. Aísla la espalda quitando la cadera del movimiento.' },
    ],
  },
  {
    archivo: 'swing-kettlebell.jpg',
    nombre: 'Swing con kettlebell',
    descripcion: 'La pesa se balancea entre las piernas y sube hasta la altura del pecho por el empuje de la cadera, no por tirar con los brazos. Los brazos solo acompañan.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Glúteo', 'Glúteo mayor', 'Isquiotibial', 'Cadera', 'Kettlebell', 'Bisagra de cadera', 'Global'],
    items_ejecucion: [
      'La pesa sube por el empuje de la cadera, no por tirar con los brazos',
      'La espalda se mantiene recta, sin redondearse abajo',
      'Arriba se extiende la cadera sin arquear la lumbar',
      'La pesa pasa por encima de la rodilla, no por debajo',
    ],
    feedbacks: ['Empuja la cadera, no tires con los brazos', 'Aprieta glúteo arriba', 'La pesa alta, no baja'],
    variantes: [
      { nombre: 'Ruso', descripcion: 'La pesa sube hasta la altura del pecho. La versión estándar.' },
      { nombre: 'A una mano', descripcion: 'Sujeta con una sola mano. Añade trabajo antirrotación de core.' },
    ],
  },
  {
    archivo: 'curl-deslizador.jpg',
    nombre: 'Curl femoral con deslizador',
    descripcion: 'Tumbado boca arriba con la cadera elevada y los talones sobre deslizadores. Los pies se alejan extendiendo la rodilla y vuelven arrastrando, sin dejar caer la cadera al suelo.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Isquiotibial', 'Glúteo', 'Rodilla', 'Deslizador', 'Analítico'],
    items_ejecucion: [
      'La cadera se mantiene elevada durante todo el recorrido',
      'Los pies se alejan despacio, sin escaparse',
      'La zona lumbar no se arquea al extender',
      'Las dos piernas trabajan por igual, sin quedarse una atrás',
    ],
    feedbacks: ['No dejes caer la cadera', 'Controla la salida', 'Vuelve arrastrando'],
    variantes: [
      { nombre: 'Bilateral', descripcion: 'Los dos pies a la vez. La versión de entrada.' },
      { nombre: 'A una pierna', descripcion: 'Una pierna trabaja y la otra queda en el aire.' },
      { nombre: 'Isométrico', descripcion: 'Se mantiene la posición a medio recorrido el tiempo indicado.' },
    ],
  },
  {
    archivo: 'curl-fitball.jpg',
    nombre: 'Curl femoral en fitball',
    descripcion: 'Tumbado boca arriba con la cadera elevada y los talones sobre una pelota grande. Se arrastra la pelota hacia el cuerpo flexionando la rodilla y se vuelve controlando.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Isquiotibial', 'Glúteo', 'Rodilla', 'Fitball', 'Analítico'],
    items_ejecucion: [
      'La cadera se mantiene elevada, sin apoyarse en el suelo',
      'La pelota se mueve sin desviarse hacia un lado',
      'La zona lumbar no se arquea',
      'La vuelta es controlada, sin dejar que la pelota se escape',
    ],
    feedbacks: ['Cadera arriba todo el rato', 'La pelota recta', 'Vuelve despacio'],
    variantes: [
      { nombre: 'Bilateral', descripcion: 'Los dos talones sobre la pelota.' },
      { nombre: 'A una pierna', descripcion: 'Un solo talón apoyado. Bastante más exigente.' },
      { nombre: 'Solo puente', descripcion: 'Sin flexionar la rodilla, solo mantener la cadera arriba. Paso previo.' },
    ],
  },
  {
    archivo: 'curl-nordico.jpg',
    nombre: 'Curl nórdico',
    descripcion: 'De rodillas con los tobillos sujetos, el cuerpo cae hacia delante en línea recta, frenando con la parte posterior del muslo tanto como se pueda. Es un trabajo excéntrico: lo que importa es la bajada.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Isquiotibial', 'Rodilla', 'Banco', 'Analítico'],
    items_ejecucion: [
      'El cuerpo baja en línea recta: la cadera no se dobla',
      'El descenso se frena todo lo posible, no se cae de golpe',
      'Las manos solo amortiguan el final, no sostienen el peso antes',
      'No aparece dolor ni tirón brusco detrás del muslo',
    ],
    feedbacks: ['No dobles la cadera', 'Aguanta la bajada', 'Las manos solo al final'],
    variantes: [
      { nombre: 'Asistido con banda', descripcion: 'Una banda por delante descarga parte del peso. Por aquí se empieza.' },
      { nombre: 'Con rango parcial', descripcion: 'Se baja solo hasta donde se puede frenar de verdad.' },
      { nombre: 'Completo', descripcion: 'Bajada entera controlada. Muy exigente.' },
    ],
  },
  {
    archivo: 'abduccion-cadera.jpg',
    nombre: 'Abducción de cadera tumbado',
    descripcion: 'Tumbado de lado con una goma alrededor de los muslos. Se separa la pierna de arriba sin rotar la cadera ni echar el cuerpo hacia atrás, y se vuelve despacio.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Glúteo', 'Glúteo medio', 'Cadera', 'Unilateral', 'Mini band', 'Analítico'],
    items_ejecucion: [
      'La cadera no rota hacia atrás para ayudarse',
      'El tronco se mantiene quieto, sin balancearse',
      'La pierna se separa sin subir también hacia delante',
      'La vuelta es controlada, sin dejar que la goma tire',
    ],
    feedbacks: ['No gires la cadera', 'Sube de lado, no hacia delante', 'Baja despacio'],
    variantes: [
      { nombre: 'Tumbado de lado', descripcion: 'Piernas extendidas. La versión estándar.' },
      { nombre: 'De pie con banda', descripcion: 'En carga, separando la pierna de pie. Más funcional.' },
      { nombre: 'Almeja', descripcion: 'Rodillas flexionadas, se abre solo la rodilla de arriba con los pies juntos.' },
    ],
  },
  {
    archivo: 'marcha-lateral.jpg',
    nombre: 'Marcha lateral con mini band',
    descripcion: 'En media sentadilla con una goma en los tobillos, se dan pasos laterales manteniendo la tensión de la goma y sin juntar los pies del todo.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Glúteo', 'Glúteo medio', 'Cadera', 'Rodilla', 'Mini band', 'Marcha', 'Global'],
    items_ejecucion: [
      'La goma se mantiene tensa: los pies no se juntan del todo',
      'Las rodillas no caen hacia dentro al dar el paso',
      'El tronco se queda erguido, sin balancearse a los lados',
      'La cadera se mantiene baja durante todo el desplazamiento',
    ],
    feedbacks: ['No juntes los pies', 'Rodillas hacia fuera', 'No subas la cadera'],
    variantes: [
      { nombre: 'En los tobillos', descripcion: 'La goma abajo. Más exigente para el glúteo medio.' },
      { nombre: 'Por encima de la rodilla', descripcion: 'La goma más arriba. Menos palanca, buen punto de partida.' },
      { nombre: 'En sentadilla', descripcion: 'Manteniendo la posición baja todo el recorrido, sin subir entre pasos.' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CORE Y LUMBAR
  //
  // Ya estaban plancha frontal y plancha lateral, así que no se repiten.
  //
  // Cada ejercicio lleva su FUNCIÓN DE CORE además del músculo: es lo que hace útil
  // el bloque. Con "Core" a secas, una plancha y un press Pallof son la misma cosa, y
  // se eligen por motivos distintos.
  //
  // Siete de los diez no llevan material, a propósito: es el bloque que de verdad se
  // puede mandar a casa.
  // ─────────────────────────────────────────────────────────────────────────────

  {
    archivo: 'bird-dog.jpg',
    nombre: 'Bird dog',
    descripcion: 'A cuatro patas, se extienden a la vez un brazo y la pierna contraria hasta la altura del tronco, sin que la espalda se arquee ni la cadera bascule. Se mantiene y se vuelve despacio.',
    tipo_medida: 'tiempo',
    etiquetas: ['Erectores Espinales', 'Glúteo', 'Columna', 'Antirotación', 'Global'],
    items_ejecucion: [
      'La espalda se mantiene plana, sin arquearse ni hundirse',
      'La cadera no bascula hacia el lado de la pierna que sube',
      'El brazo y la pierna llegan a la altura del tronco, no más arriba',
      'El cuello sigue la línea de la espalda, sin levantar la cabeza',
    ],
    feedbacks: ['Espalda plana', 'No gires la cadera', 'No subas más de la cuenta'],
    variantes: [
      { nombre: 'Solo brazo', descripcion: 'Se extiende únicamente el brazo. Punto de partida.' },
      { nombre: 'Solo pierna', descripcion: 'Se extiende únicamente la pierna.' },
      { nombre: 'Completo', descripcion: 'Brazo y pierna contraria a la vez.' },
    ],
  },
  {
    archivo: 'dead-bug.jpg',
    nombre: 'Dead bug',
    descripcion: 'Tumbado boca arriba con brazos y rodillas arriba, se bajan a la vez un brazo y la pierna contraria hasta rozar el suelo, manteniendo la zona lumbar pegada, y se vuelve.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Abdomen', 'Antiextensión', 'Global'],
    items_ejecucion: [
      'La zona lumbar se mantiene pegada al suelo en todo momento',
      'El brazo y la pierna bajan a la vez y despacio',
      'No se aguanta la respiración',
      'Se llega solo hasta donde la lumbar no se despegue',
    ],
    feedbacks: ['Lumbar pegada al suelo', 'Baja despacio', 'Sigue respirando'],
    variantes: [
      { nombre: 'Solo piernas', descripcion: 'Los brazos se quedan quietos apuntando al techo.' },
      { nombre: 'Completo', descripcion: 'Brazo y pierna contraria a la vez.' },
      { nombre: 'Con banda', descripcion: 'Empujando una banda con las manos, que da referencia de la tensión.' },
    ],
  },
  {
    archivo: 'puente-lateral-elevacion.jpg',
    nombre: 'Puente lateral con elevación',
    descripcion: 'Desde la plancha lateral, se eleva además la pierna de arriba sin flexionarla ni rotar la cadera. Suma el trabajo de glúteo medio al del costado.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Oblicuos', 'Glúteo', 'Glúteo medio', 'Cadera', 'Unilateral', 'Antiflexión', 'Global'],
    items_ejecucion: [
      'La cadera se mantiene elevada, sin caer hacia el suelo',
      'La pierna sube de lado, no hacia delante',
      'El cuerpo forma una línea recta visto de frente',
      'El codo queda bajo el hombro',
    ],
    feedbacks: ['Sube la cadera', 'La pierna de lado', 'Codo bajo el hombro'],
    variantes: [
      { nombre: 'Con rodillas apoyadas', descripcion: 'Apoyando la rodilla de abajo. Versión de entrada.' },
      { nombre: 'Completo', descripcion: 'Apoyo en el canto del pie, pierna de arriba elevada.' },
      { nombre: 'Con banda', descripcion: 'Mini band en los muslos para más resistencia a la elevación.' },
    ],
  },
  {
    archivo: 'press-pallof.jpg',
    nombre: 'Press Pallof',
    descripcion: 'De pie y de costado a un anclaje, se empujan las manos al frente contra la tensión de la banda sin dejar que el tronco gire. Todo el trabajo es aguantar la rotación.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Oblicuos', 'Abdomen', 'Polea', 'Banda elástica', 'Antirotación', 'Global'],
    items_ejecucion: [
      'El tronco no gira hacia el anclaje al extender los brazos',
      'La cadera se mantiene cuadrada y mirando al frente',
      'Los hombros quedan bajos, sin encogerse',
      'El movimiento es lento, sin tirones',
    ],
    feedbacks: ['No dejes que te giren', 'Cadera cuadrada', 'Hombros abajo'],
    variantes: [
      { nombre: 'De pie', descripcion: 'Piernas a la anchura de la cadera. La versión estándar.' },
      { nombre: 'De rodillas', descripcion: 'Quita las piernas de la ecuación y exige más al core.' },
      { nombre: 'En zancada', descripcion: 'En posición de zancada. Añade estabilidad de cadera.' },
    ],
  },
  {
    archivo: 'antirrotacion-banda.jpg',
    nombre: 'Antirrotación con banda',
    descripcion: 'Igual que el press Pallof pero manteniendo los brazos ya extendidos el tiempo indicado. Es la versión isométrica: no hay movimiento, solo aguantar.',
    tipo_medida: 'tiempo',
    etiquetas: ['Oblicuos', 'Abdomen', 'Banda elástica', 'Antirotación', 'Global'],
    items_ejecucion: [
      'El tronco no cede hacia el anclaje',
      'Los brazos se mantienen extendidos y a la altura del pecho',
      'La cadera queda cuadrada durante todo el tiempo',
      'La respiración se mantiene, no se aguanta el aire',
    ],
    feedbacks: ['Aguanta sin girar', 'Brazos rectos', 'Sigue respirando'],
    variantes: [
      { nombre: 'De pie', descripcion: 'La versión estándar.' },
      { nombre: 'De rodillas', descripcion: 'Más exigente para el core.' },
      { nombre: 'Con paso lateral', descripcion: 'Dando pasos que alejan del anclaje, aumentando la tensión.' },
    ],
  },
  {
    archivo: 'paseo-granjero.jpg',
    nombre: 'Paseo del granjero',
    descripcion: 'Se camina erguido con un peso en cada mano, sin inclinarse a ningún lado ni encoger los hombros. Parece sencillo y es de lo que más exige al core.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Trapecio', 'Antiflexión', 'Mancuerna', 'Kettlebell', 'Acarreo', 'Global'],
    items_ejecucion: [
      'El tronco se mantiene vertical, sin inclinarse a los lados',
      'Los hombros quedan atrás y abajo, sin encogerse',
      'Los pasos son cortos y controlados',
      'La mirada al frente, no al suelo',
    ],
    feedbacks: ['No te inclines', 'Hombros atrás', 'Pasos cortos'],
    variantes: [
      { nombre: 'Bilateral', descripcion: 'Un peso en cada mano. La versión estándar.' },
      { nombre: 'A una mano', descripcion: 'Un solo peso. Todo el trabajo pasa a aguantar la inclinación.' },
      { nombre: 'En rack', descripcion: 'El peso sujeto a la altura del hombro. Añade exigencia de tronco.' },
    ],
  },
  {
    archivo: 'rueda-abdominal.jpg',
    nombre: 'Rueda abdominal',
    descripcion: 'De rodillas, se rueda hacia delante estirando el cuerpo sin que la cadera se doble ni la lumbar se arquee, y se vuelve tirando con el abdomen.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Abdomen', 'Columna', 'Rueda abdominal', 'Antiextensión', 'Global'],
    items_ejecucion: [
      'La cadera no se dobla: el cuerpo va en línea recta',
      'La zona lumbar no se arquea al estirarse',
      'Se llega solo hasta donde se puede volver sin perder la línea',
      'La vuelta sale del abdomen, no de tirar con los brazos',
    ],
    feedbacks: ['Cuerpo en línea', 'No arquees la lumbar', 'Llega solo hasta donde puedas volver'],
    variantes: [
      { nombre: 'De rodillas parcial', descripcion: 'Rango corto. Por aquí se empieza siempre.' },
      { nombre: 'De rodillas completo', descripcion: 'Extensión total desde las rodillas.' },
      { nombre: 'De pie', descripcion: 'Desde los pies. Muy exigente, solo con lumbar sana.' },
    ],
  },
  {
    archivo: 'rodillo-fitball.jpg',
    nombre: 'Rodillo de fitball',
    descripcion: 'De rodillas con los antebrazos sobre una pelota, se rueda hacia delante estirando el cuerpo y se vuelve. Es la versión amable de la rueda: se puede parar en cualquier punto.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Abdomen', 'Columna', 'Fitball', 'Antiextensión', 'Global'],
    items_ejecucion: [
      'La cadera no se dobla durante el recorrido',
      'La zona lumbar no se arquea al estirarse',
      'La pelota se mueve recta, sin desviarse a un lado',
      'La vuelta es controlada, sin dejarse caer',
    ],
    feedbacks: ['Cuerpo en línea', 'No arquees la lumbar', 'La pelota recta'],
    variantes: [
      { nombre: 'Rango corto', descripcion: 'Se rueda poco. Punto de partida.' },
      { nombre: 'Rango completo', descripcion: 'Extensión total de brazos y cuerpo.' },
      { nombre: 'Isométrico', descripcion: 'Se mantiene la posición estirada el tiempo indicado.' },
    ],
  },
  {
    archivo: 'gato-camello.jpg',
    nombre: 'Gato-camello',
    descripcion: 'A cuatro patas, la espalda se redondea hacia arriba y luego se hunde, recorriendo despacio todo el rango de la columna. Es movilidad, no fuerza: no se busca esfuerzo.',
    tipo_medida: 'tiempo',
    etiquetas: ['Columna', 'Erectores Espinales', 'Flexión', 'Extensión', 'Analítico'],
    items_ejecucion: [
      'El movimiento recorre toda la columna, no solo la zona lumbar',
      'Va despacio y acompañado de la respiración',
      'Las manos quedan bajo los hombros y las rodillas bajo la cadera',
      'No se llega a rangos que duelan',
    ],
    feedbacks: ['Despacio', 'Que se mueva toda la espalda', 'Acompaña con la respiración'],
    variantes: [
      { nombre: 'Completo', descripcion: 'Las dos fases, redondear y hundir.' },
      { nombre: 'Solo flexión', descripcion: 'Solo redondear. Cuando la extensión molesta.' },
      { nombre: 'Sentado', descripcion: 'En una silla, para quien no puede apoyarse en el suelo.' },
    ],
  },
  {
    archivo: 'extension-lumbar.jpg',
    nombre: 'Extensión lumbar en el suelo',
    descripcion: 'Tumbado boca abajo, se despega el pecho del suelo manteniendo el cuello en línea con la espalda, y se baja despacio. Rango corto: no se trata de subir mucho.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Erectores Espinales', 'Columna', 'Glúteo', 'Analítico'],
    items_ejecucion: [
      'El cuello sigue la línea de la espalda, sin levantar la cabeza',
      'El rango es corto: el pecho apenas se despega',
      'Los pies siguen apoyados en el suelo',
      'No aparece dolor durante el movimiento',
    ],
    feedbacks: ['La cabeza en línea', 'Sube poco', 'Para si molesta'],
    variantes: [
      { nombre: 'Brazos al cuerpo', descripcion: 'Manos a los lados. La versión de entrada.' },
      { nombre: 'Manos en la nuca', descripcion: 'Más palanca, más exigencia.' },
      { nombre: 'Con brazos extendidos', descripcion: 'Brazos al frente. La más difícil.' },
    ],
  },
]

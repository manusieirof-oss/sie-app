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
  variantes?: {
    nombre: string
    descripcion: string
    /**
     * Imagen propia de la variante. Solo para las que cambian de verdad lo que se ve:
     * si únicamente cambia el material o la carga, la del ejercicio padre vale y no se
     * pone nada. Con 300 variantes en la biblioteca, dibujarlas todas sería el triple
     * de trabajo que todo lo hecho hasta ahora para no aclarar casi nada.
     */
    archivo?: string
  }[]
}

export const SEMILLA: SemillaEjercicio[] = [
  {
    archivo: 'sentadilla-trasera.jpg',
    nombre: 'Sentadilla trasera',
    descripcion: 'Barra apoyada en la espalda alta. Se baja llevando la cadera atrás y abajo hasta que los muslos queden al menos paralelos al suelo, y se sube empujando el suelo con todo el pie.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Cuádriceps', 'Glúteo', 'Rodilla', 'Cadera', 'Barra', 'Sentadilla', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación'],
    items_ejecucion: [
      'Las rodillas siguen la dirección de los pies, sin caer hacia dentro',
      'El talón no se despega del suelo',
      'La espalda mantiene su curva, sin redondearse abajo',
      'Baja al menos hasta muslos paralelos',
    ],
    feedbacks: ['Rodillas hacia fuera', 'Empuja el suelo con todo el pie', 'Pecho arriba'],
    variantes: [
      { nombre: 'Talones en cuña', descripcion: 'Cuña bajo los talones. Menos exigencia de tobillo, más de cuádriceps.' },
      { nombre: 'Al cajón', descripcion: 'Tocando un cajón abajo. Da referencia constante de profundidad.' },
      { nombre: 'Con pausa', descripcion: 'Dos segundos parado abajo. Quita el rebote.' },
    ],
  },
  {
    archivo: 'peso-muerto-rumano.jpg',
    nombre: 'Peso muerto rumano',
    descripcion: 'Bisagra de cadera con las piernas casi extendidas. La barra baja pegada a la pierna hasta notar tensión en la parte posterior del muslo, y se sube empujando la cadera adelante.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Isquiotibial', 'Glúteo', 'Cadera', 'Barra', 'Bisagra de cadera', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación', 'Bipodal'],
    items_ejecucion: [
      'El movimiento nace en la cadera, no en la zona lumbar',
      'La espalda se mantiene recta durante todo el recorrido',
      'La barra baja pegada a la pierna',
      'Las rodillas quedan ligeramente flexionadas, no bloqueadas',
    ],
    feedbacks: ['Lleva la cadera atrás', 'Barra pegada a la pierna', 'Para cuando notes el tirón detrás'],
    variantes: [
      { nombre: 'Con mancuernas', descripcion: 'Una en cada mano. Más libertad para la muñeca y el hombro.' },
      { nombre: 'Desde déficit', descripcion: 'De pie sobre un disco. Más rango, solo con espalda que aguante.' },
      { nombre: 'A una pierna', descripcion: 'Suma equilibrio y corrige diferencias entre lados.' },
    ],
  },
  {
    archivo: 'zancada-bulgara.jpg',
    nombre: 'Zancada búlgara',
    descripcion: 'Pie trasero elevado sobre un banco. Se baja en vertical hasta que la rodilla adelantada llegue a noventa grados, manteniendo el tronco erguido.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Cuádriceps', 'Glúteo', 'Rodilla', 'Unilateral', 'Mancuerna', 'Zancada', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación'],
    items_ejecucion: [
      'La rodilla delantera no se desvía hacia dentro',
      'El tronco se mantiene erguido, sin caer adelante',
      'El descenso es vertical, no hacia delante',
      'La cadera queda estable, sin bascular a un lado',
    ],
    feedbacks: ['Peso en el pie de delante', 'Baja recto', 'No dejes caer la cadera'],
    variantes: [
      { nombre: 'Peso corporal', descripcion: 'Sin carga. Para aprender a mantener la cadera estable.' },
      { nombre: 'Con mancuernas', descripcion: 'Una en cada mano, brazos colgando. La versión cargable.' },
      { nombre: 'Con barra', descripcion: 'Barra en la espalda alta. Más carga, menos margen de equilibrio.' },
    ],
  },
  {
    archivo: 'puente-de-gluteo-musculos.jpg',
    nombre: 'Puente de glúteo',
    descripcion: 'Tumbado boca arriba con los pies apoyados. Se eleva la cadera hasta formar una línea recta entre hombro, cadera y rodilla, apretando el glúteo arriba.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Glúteo', 'Cadera', 'Bisagra de cadera', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'posicion:Supino'],
    items_ejecucion: [
      'Sube empujando con el talón, no con la punta del pie',
      'El glúteo aprieta antes que los isquiotibiales',
      'La zona lumbar no se arquea al llegar arriba',
      'Hombro, cadera y rodilla quedan alineados',
    ],
    feedbacks: ['Aprieta el glúteo arriba', 'No arquees la lumbar', 'Empuja con el talón'],
    variantes: [
      { nombre: 'A una pierna', descripcion: 'Un solo pie apoyado. Bastante más exigente de glúteo y control.' },
      { nombre: 'Con banda en rodillas', descripcion: 'Empujando las rodillas hacia fuera. Suma glúteo medio.' },
      { nombre: 'Con pies elevados', descripcion: 'Talones sobre un cajón. Más recorrido de cadera.' },
    ],
  },
  {
    archivo: 'press-banca.jpg',
    nombre: 'Press de banca',
    descripcion: 'Tumbado en banco horizontal. La barra baja controlada hasta el pecho con los codos a unos cuarenta y cinco grados, y se empuja hasta extender los brazos.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Pectoral', 'Tríceps', 'Hombro', 'Barra', 'Empuje horizontal', 'Global', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)', 'posicion:Supino'],
    items_ejecucion: [
      'Los codos quedan a unos 45°, no abiertos del todo',
      'Las escápulas se mantienen juntas y apoyadas',
      'La barra toca el pecho de forma controlada',
      'Los pies siguen apoyados en el suelo',
    ],
    feedbacks: ['Junta las escápulas', 'Codos algo cerrados', 'Baja controlando'],
    variantes: [
      { nombre: 'Agarre cerrado', descripcion: 'Manos a la anchura de los hombros. Más tríceps, hombro más protegido.' },
      { nombre: 'Con pausa en el pecho', descripcion: 'Un segundo parado abajo. Quita el rebote.' },
      { nombre: 'Con banco inclinado', descripcion: 'Respaldo a 30°. Carga la parte alta del pecho.' },
    ],
  },
  {
    archivo: 'remo-con-barra-musculos.jpg',
    nombre: 'Remo con barra',
    descripcion: 'Tronco inclinado unos cuarenta y cinco grados con la espalda recta. Se tracciona la barra hacia el abdomen llevando los codos atrás y juntando las escápulas.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Dorsal Ancho', 'Trapecio', 'Bíceps', 'Barra', 'Tracción horizontal', 'Global', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)', 'Bipedestación', 'Bipodal', 'agarre:Prono'],
    items_ejecucion: [
      'El tirón empieza en la escápula, no en el bíceps',
      'Los codos van hacia atrás, pegados al cuerpo',
      'La espalda mantiene su curva, sin redondearse',
      'El tronco no se incorpora para ayudar al tirón',
    ],
    feedbacks: ['Junta las escápulas', 'Codos atrás', 'No subas el cuerpo'],
    variantes: [
      { nombre: 'Agarre prono', descripcion: 'Palmas hacia abajo. Más dorsal alto y trapecio medio.' },
      { nombre: 'Agarre supino', descripcion: 'Palmas hacia arriba. Suma bíceps y permite más carga.' },
      { nombre: 'Con apoyo de pecho', descripcion: 'Tumbado sobre un banco inclinado. Descarga la lumbar.' },
    ],
  },
  {
    archivo: 'press-militar.jpg',
    nombre: 'Press militar de pie',
    descripcion: 'De pie, barra a la altura de la clavícula. Se empuja sobre la cabeza hasta extender los brazos, sin arquear la zona lumbar.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Hombro', 'Tríceps', 'Barra', 'Empuje vertical', 'Global', 'plano_eje:Frontal (coronal)', 'plano_eje:Sagital (anteroposterior)', 'Bipedestación', 'Bipodal'],
    items_ejecucion: [
      'La zona lumbar no se arquea al empujar',
      'El glúteo y el abdomen se mantienen activos',
      'La barra sube en vertical, pegada a la cara',
      'Arriba, la cabeza pasa por delante de la barra',
    ],
    feedbacks: ['Aprieta el abdomen', 'No arquees la espalda', 'Barra pegada a la cara'],
    variantes: [
      { nombre: 'Con mancuernas', descripcion: 'Más libertad de hombro. Primera opción si el press con barra molesta.' },
      { nombre: 'Sentado con respaldo', descripcion: 'Quita la lumbar de la ecuación.' },
      { nombre: 'A una mano', descripcion: 'Suma trabajo antiflexión lateral de core.' },
    ],
  },
  {
    archivo: 'plancha-frontal.jpg',
    nombre: 'Plancha frontal',
    descripcion: 'Apoyo en antebrazos y puntas de los pies, con el cuerpo formando una línea recta. Se mantiene la posición el tiempo indicado sin perder la alineación.',
    tipo_medida: 'tiempo',
    etiquetas: ['Abdomen', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'posicion:Prono', 'Codos'],
    items_ejecucion: [
      'La cadera no cae ni se eleva',
      'Los codos quedan bajo los hombros',
      'La zona lumbar no se arquea',
      'La respiración se mantiene, no se aguanta el aire',
    ],
    feedbacks: ['Mete el ombligo', 'Cadera en línea', 'Sigue respirando'],
    variantes: [
      { nombre: 'Con rodillas apoyadas', descripcion: 'Reduce la palanca. El punto de partida.' },
      { nombre: 'Con pies elevados', descripcion: 'Sobre un cajón. Más carga sobre el abdomen.' },
      { nombre: 'Con toques de hombro', descripcion: 'Alternando toques al hombro contrario. Suma antirrotación.' },
    ],
  },
  {
    archivo: 'plancha-lateral.jpg',
    nombre: 'Plancha lateral',
    descripcion: 'Apoyo en un antebrazo y el canto del pie, con la cadera elevada y el cuerpo alineado. Se mantiene el tiempo indicado por cada lado.',
    tipo_medida: 'tiempo',
    etiquetas: ['Abdomen', 'Cadera', 'Unilateral', 'Global', 'plano_eje:Frontal (coronal)', 'plano_eje:Sagital (anteroposterior)', 'Decúbito lateral', 'Codos'],
    items_ejecucion: [
      'La cadera se mantiene elevada, sin caer al suelo',
      'El codo queda bajo el hombro',
      'El cuerpo forma una línea recta vista de frente',
      'La cadera no rota hacia delante ni atrás',
    ],
    feedbacks: ['Sube la cadera', 'No rotes el tronco', 'Codo bajo el hombro'],
    variantes: [
      { nombre: 'Con rodillas apoyadas', descripcion: 'Apoyo en la rodilla de abajo. Reduce la palanca.' },
      { nombre: 'Con elevación de cadera', descripcion: 'Bajando y subiendo la cadera. Deja de ser isométrico.' },
      { nombre: 'Con pierna elevada', descripcion: 'La de arriba separada. Suma glúteo medio.' },
    ],
  },
  {
    archivo: 'movilidad-toracica.jpg',
    nombre: 'Movilidad torácica en cuadrupedia',
    descripcion: 'A cuatro patas, una mano tras la nuca. Se rota el tronco abriendo el pecho hacia el techo y se vuelve despacio, sin mover la cadera.',
    tipo_medida: 'tiempo',
    etiquetas: ['Dorsal Ancho', 'Columna', 'Rotación', 'Analítico', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)', 'Cuadrupedia', 'apoyo:Rodilla'],
    items_ejecucion: [
      'La rotación nace del tórax, no de la zona lumbar',
      'La cadera se mantiene quieta y cuadrada',
      'La mirada acompaña al codo que sube',
      'El movimiento es lento y controlado',
    ],
    feedbacks: ['Abre el pecho, no la cadera', 'Mira al codo', 'Despacio'],
    variantes: [
      { nombre: 'Mano en la nuca', descripcion: 'La versión con más palanca de rotación.' },
      { nombre: 'Brazo extendido', descripcion: 'Pasando el brazo por debajo del cuerpo y abriendo. Más alcance.' },
      { nombre: 'Sentado sobre los talones', descripcion: 'Bloquea la cadera y obliga a que gire el tórax.' },
    ],
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
    etiquetas: ['Cuádriceps', 'Glúteo', 'Rodilla', 'Barra', 'Rack', 'Sentadilla', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación', 'agarre:Supino'],
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
    etiquetas: ['Cuádriceps', 'Glúteo', 'Rodilla', 'Mancuerna', 'Kettlebell', 'Sentadilla', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación', 'agarre:Neutro'],
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
    etiquetas: ['Cuádriceps', 'Glúteo', 'Rodilla', 'Banco', 'Sentadilla', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación'],
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
    etiquetas: ['Cuádriceps', 'Glúteo', 'Rodilla', 'Cinchas de suspensión', 'Sentadilla', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación'],
    items_ejecucion: [
      'Los brazos asisten, no tiran: el trabajo lo hacen las piernas',
      'Las cinchas se mantienen tensas, sin dar tirones',
      'El tronco queda erguido y los talones apoyados',
      'Se llega a una profundidad mayor que sin asistencia, sin dolor',
    ],
    feedbacks: ['Los brazos solo acompañan', 'Baja más de lo que bajarías solo', 'Talones al suelo'],
    variantes: [
      { nombre: 'A una pierna', descripcion: 'Pierna libre al frente. Escalón previo a la sentadilla unipodal libre.' },
      { nombre: 'Isométrica', descripcion: 'Se mantiene la posición abajo el tiempo indicado.' },
    ],
  },
  {
    archivo: 'sentadilla-landmine.jpg',
    nombre: 'Sentadilla landmine',
    descripcion: 'Un extremo de la barra anclado al suelo y el otro sujeto a la altura del pecho. El anclaje ayuda a mantener el tronco vertical, así que perdona movilidad de tobillo y de hombro.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Cuádriceps', 'Glúteo', 'Rodilla', 'Landmine', 'Barra', 'Sentadilla', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación', 'agarre:Neutro'],
    items_ejecucion: [
      'La barra se mantiene pegada al pecho, sin alejarse',
      'El tronco queda vertical, apoyándose en el arco de la barra',
      'Las rodillas siguen la dirección de los pies',
      'La subida sale de las piernas, no de tirar con los brazos',
    ],
    feedbacks: ['Barra al pecho', 'Deja que la barra te sostenga', 'Empuja con las piernas'],
    variantes: [
      { nombre: 'Con giro', descripcion: 'Se acompaña con una rotación de tronco al subir. Pasa a ser combinado.' },
    ],
  },
  {
    archivo: 'sentadilla-pared.jpg',
    nombre: 'Sentadilla isométrica en pared',
    descripcion: 'Espalda apoyada en la pared y rodillas a noventa grados. Se mantiene la posición el tiempo indicado sin despegar la espalda ni dejar caer la cadera.',
    tipo_medida: 'tiempo',
    etiquetas: ['Cuádriceps', 'Vasto Medial', 'Rodilla', 'Pared', 'Pelota', 'Sentadilla', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación'],
    items_ejecucion: [
      'La espalda se mantiene pegada a la pared en todo momento',
      'Las rodillas quedan sobre los tobillos, no por delante de la punta',
      'Las rodillas no caen hacia dentro',
      'La respiración se mantiene, no se aguanta el aire',
    ],
    feedbacks: ['Espalda pegada', 'No dejes caer la cadera', 'Sigue respirando'],
    variantes: [
      { nombre: 'Con pelota entre rodillas', descripcion: 'Apretando la pelota. Busca énfasis en vasto interno.' },
      { nombre: 'Unipodal', descripcion: 'Una pierna extendida al frente. Mucho más exigente.' },
    ],
  },
  {
    archivo: 'sentadilla-sissy.jpg',
    nombre: 'Sentadilla sissy',
    descripcion: 'De pie, se lleva la rodilla adelante y el tronco atrás manteniendo la línea de rodilla a hombro, elevando los talones. Trabaja el cuádriceps en un rango que la sentadilla normal no alcanza.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Cuádriceps', 'Vasto Medial', 'Rodilla', 'Stick', 'Sentadilla', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Arrodillado'],
    items_ejecucion: [
      'La cadera no se flexiona: rodilla y hombro quedan en línea',
      'El descenso es lento y controlado, sin caídas',
      'No aparece dolor en la cara anterior de la rodilla',
      'Se vuelve arriba sin ayudarse con el tronco',
    ],
    feedbacks: ['Cadera adelante, no la dobles', 'Baja despacio', 'Para si molesta la rodilla'],
    variantes: [
      { nombre: 'Asistida con stick', descripcion: 'Apoyado en un stick o en el rack para controlar el descenso.' },
    ],
  },
  {
    archivo: 'zancada.jpg',
    nombre: 'Zancada',
    descripcion: 'Se da un paso y se baja en vertical hasta que la rodilla adelantada llegue a noventa grados, manteniendo el tronco erguido, y se vuelve empujando con el pie de delante.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Cuádriceps', 'Glúteo', 'Rodilla', 'Unilateral', 'Mancuerna', 'Zancada', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación'],
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
    etiquetas: ['Cuádriceps', 'Glúteo', 'Rodilla', 'Unilateral', 'Mancuerna', 'Zancada', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación'],
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
    etiquetas: ['Cuádriceps', 'Glúteo', 'Aductores', 'Cadera', 'Unilateral', 'Mancuerna', 'Zancada', 'Global', 'plano_eje:Frontal (coronal)', 'plano_eje:Sagital (anteroposterior)', 'Bipedestación', 'Unipodal'],
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
    etiquetas: ['Cuádriceps', 'Glúteo', 'Rodilla', 'Unilateral', 'Deslizador', 'Zancada', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación'],
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
    etiquetas: ['Cuádriceps', 'Glúteo', 'Rodilla', 'Unilateral', 'Cajón', 'Mancuerna', 'Zancada', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación'],
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
    etiquetas: ['Cuádriceps', 'Glúteo', 'Rodilla', 'Cajón pliométrico', 'Salto', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación'],
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
    etiquetas: ['Cuádriceps', 'Vasto Medial', 'Rodilla', 'Banda elástica', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación'],
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
    etiquetas: ['Isquiotibial', 'Glúteo', 'Glúteo mayor', 'Cadera', 'Columna', 'Barra olímpica', 'Bisagra de cadera', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación', 'Bipodal', 'agarre:Mixto'],
    items_ejecucion: [
      'La espalda mantiene su curva, sin redondearse en ningún momento',
      'La barra sube pegada a la pierna, sin alejarse del cuerpo',
      'La cadera y el pecho suben a la vez, no primero la cadera',
      'Arriba se extiende la cadera sin arquear la lumbar',
    ],
    feedbacks: ['Pecho arriba antes de tirar', 'Barra pegada a la pierna', 'Sube todo a la vez'],
    variantes: [
      { nombre: 'Sumo', descripcion: 'Pies muy abiertos y manos por dentro. Menos exigencia de espalda, más de cadera.' },
      { nombre: 'Desde cajón', descripcion: 'La barra elevada sobre un cajón. Menos rango, para quien no llega abajo con la espalda recta.' },
    ],
  },
  {
    archivo: 'peso-muerto-una-pierna.jpg',
    nombre: 'Peso muerto a una pierna',
    descripcion: 'Sobre una pierna, se lleva la cadera atrás mientras la otra pierna sube extendida por detrás, hasta que tronco y pierna formen una línea horizontal. Se vuelve empujando la cadera adelante.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Isquiotibial', 'Glúteo', 'Cadera', 'Unilateral', 'Mancuerna', 'Kettlebell', 'Bisagra de cadera', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación', 'Unipodal'],
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
    etiquetas: ['Glúteo', 'Glúteo mayor', 'Cadera', 'Banco', 'Barra', 'Bisagra de cadera', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'posicion:Supino'],
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
    etiquetas: ['Isquiotibial', 'Glúteo', 'Cadera', 'Columna', 'Barra', 'Rack', 'Bisagra de cadera', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación', 'Bipodal'],
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
    etiquetas: ['Glúteo', 'Glúteo mayor', 'Isquiotibial', 'Cadera', 'Kettlebell', 'Bisagra de cadera', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación', 'Bipodal', 'agarre:Neutro'],
    items_ejecucion: [
      'La pesa sube por el empuje de la cadera, no por tirar con los brazos',
      'La espalda se mantiene recta, sin redondearse abajo',
      'Arriba se extiende la cadera sin arquear la lumbar',
      'La pesa pasa por encima de la rodilla, no por debajo',
    ],
    feedbacks: ['Empuja la cadera, no tires con los brazos', 'Aprieta glúteo arriba', 'La pesa alta, no baja'],
    variantes: [
      { nombre: 'A una mano', descripcion: 'Sujeta con una sola mano. Añade trabajo antirrotación de core.' },
    ],
  },
  {
    archivo: 'curl-deslizador.jpg',
    nombre: 'Curl femoral con deslizador',
    descripcion: 'Tumbado boca arriba con la cadera elevada y los talones sobre deslizadores. Los pies se alejan extendiendo la rodilla y vuelven arrastrando, sin dejar caer la cadera al suelo.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Isquiotibial', 'Glúteo', 'Rodilla', 'Deslizador', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'posicion:Supino'],
    items_ejecucion: [
      'La cadera se mantiene elevada durante todo el recorrido',
      'Los pies se alejan despacio, sin escaparse',
      'La zona lumbar no se arquea al extender',
      'Las dos piernas trabajan por igual, sin quedarse una atrás',
    ],
    feedbacks: ['No dejes caer la cadera', 'Controla la salida', 'Vuelve arrastrando'],
    variantes: [
      { nombre: 'A una pierna', descripcion: 'Una pierna trabaja y la otra queda en el aire.' },
      { nombre: 'Isométrico', descripcion: 'Se mantiene la posición a medio recorrido el tiempo indicado.' },
    ],
  },
  {
    archivo: 'curl-fitball.jpg',
    nombre: 'Curl femoral en fitball',
    descripcion: 'Tumbado boca arriba con la cadera elevada y los talones sobre una pelota grande. Se arrastra la pelota hacia el cuerpo flexionando la rodilla y se vuelve controlando.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Isquiotibial', 'Glúteo', 'Rodilla', 'Fitball', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'posicion:Supino'],
    items_ejecucion: [
      'La cadera se mantiene elevada, sin apoyarse en el suelo',
      'La pelota se mueve sin desviarse hacia un lado',
      'La zona lumbar no se arquea',
      'La vuelta es controlada, sin dejar que la pelota se escape',
    ],
    feedbacks: ['Cadera arriba todo el rato', 'La pelota recta', 'Vuelve despacio'],
    variantes: [
      { nombre: 'A una pierna', descripcion: 'Un solo talón apoyado. Bastante más exigente.' },
      { nombre: 'Solo puente', descripcion: 'Sin flexionar la rodilla, solo mantener la cadera arriba. Paso previo.' },
    ],
  },
  {
    archivo: 'curl-nordico.jpg',
    nombre: 'Curl nórdico',
    descripcion: 'De rodillas con los tobillos sujetos, el cuerpo cae hacia delante en línea recta, frenando con la parte posterior del muslo tanto como se pueda. Es un trabajo excéntrico: lo que importa es la bajada.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Isquiotibial', 'Rodilla', 'Banco', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Arrodillado'],
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
    etiquetas: ['Glúteo', 'Glúteo medio', 'Cadera', 'Unilateral', 'Mini band', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Decúbito lateral'],
    items_ejecucion: [
      'La cadera no rota hacia atrás para ayudarse',
      'El tronco se mantiene quieto, sin balancearse',
      'La pierna se separa sin subir también hacia delante',
      'La vuelta es controlada, sin dejar que la goma tire',
    ],
    feedbacks: ['No gires la cadera', 'Sube de lado, no hacia delante', 'Baja despacio'],
    variantes: [
      { nombre: 'De pie con banda', descripcion: 'En carga, separando la pierna de pie. Más funcional.', archivo: 'abduccion-cadera-de-pie.jpg' },
      { nombre: 'Almeja', descripcion: 'Rodillas flexionadas, se abre solo la rodilla de arriba con los pies juntos.', archivo: 'abduccion-cadera-almeja.jpg' },
    ],
  },
  {
    archivo: 'marcha-lateral.jpg',
    nombre: 'Marcha lateral con mini band',
    descripcion: 'En media sentadilla con una goma en los tobillos, se dan pasos laterales manteniendo la tensión de la goma y sin juntar los pies del todo.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Glúteo', 'Glúteo medio', 'Cadera', 'Rodilla', 'Mini band', 'Marcha', 'Global', 'plano_eje:Frontal (coronal)', 'plano_eje:Sagital (anteroposterior)', 'Bipedestación'],
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
    etiquetas: ['Erectores Espinales', 'Glúteo', 'Columna', 'Antirotación', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Cuadrupedia', 'apoyo:Rodilla'],
    items_ejecucion: [
      'La espalda se mantiene plana, sin arquearse ni hundirse',
      'La cadera no bascula hacia el lado de la pierna que sube',
      'El brazo y la pierna llegan a la altura del tronco, no más arriba',
      'El cuello sigue la línea de la espalda, sin levantar la cabeza',
    ],
    feedbacks: ['Espalda plana', 'No gires la cadera', 'No subas más de la cuenta'],
    variantes: [
      { nombre: 'Solo brazo', descripcion: 'Se extiende únicamente el brazo. Punto de partida.', archivo: 'bird-dog-brazo.jpg' },
      { nombre: 'Solo pierna', descripcion: 'Se extiende únicamente la pierna.', archivo: 'bird-dog-pierna.jpg' },
      { nombre: 'Completo', descripcion: 'Brazo y pierna contraria a la vez.', archivo: 'bird-dog-completo.jpg' },
    ],
  },
  {
    archivo: 'dead-bug.jpg',
    nombre: 'Dead bug',
    descripcion: 'Tumbado boca arriba con brazos y rodillas arriba, se bajan a la vez un brazo y la pierna contraria hasta rozar el suelo, manteniendo la zona lumbar pegada, y se vuelve.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Abdomen', 'Antiextensión', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'posicion:Supino'],
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
    etiquetas: ['Oblicuos', 'Glúteo', 'Glúteo medio', 'Cadera', 'Unilateral', 'Antiflexión', 'Global', 'plano_eje:Frontal (coronal)', 'plano_eje:Sagital (anteroposterior)', 'Decúbito lateral'],
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
    etiquetas: ['Oblicuos', 'Abdomen', 'Polea', 'Banda elástica', 'Antirotación', 'Global', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)', 'Bipedestación', 'Bipodal'],
    items_ejecucion: [
      'El tronco no gira hacia el anclaje al extender los brazos',
      'La cadera se mantiene cuadrada y mirando al frente',
      'Los hombros quedan bajos, sin encogerse',
      'El movimiento es lento, sin tirones',
    ],
    feedbacks: ['No dejes que te giren', 'Cadera cuadrada', 'Hombros abajo'],
    variantes: [
      { nombre: 'De rodillas', descripcion: 'Quita las piernas de la ecuación y exige más al core.' },
      { nombre: 'En zancada', descripcion: 'En posición de zancada. Añade estabilidad de cadera.' },
    ],
  },
  {
    archivo: 'antirrotacion-banda.jpg',
    nombre: 'Antirrotación con banda',
    descripcion: 'Igual que el press Pallof pero manteniendo los brazos ya extendidos el tiempo indicado. Es la versión isométrica: no hay movimiento, solo aguantar.',
    tipo_medida: 'tiempo',
    etiquetas: ['Oblicuos', 'Abdomen', 'Banda elástica', 'Antirotación', 'Global', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)', 'Bipedestación', 'Bipodal', 'agarre:Prono'],
    items_ejecucion: [
      'El tronco no cede hacia el anclaje',
      'Los brazos se mantienen extendidos y a la altura del pecho',
      'La cadera queda cuadrada durante todo el tiempo',
      'La respiración se mantiene, no se aguanta el aire',
    ],
    feedbacks: ['Aguanta sin girar', 'Brazos rectos', 'Sigue respirando'],
    variantes: [
      { nombre: 'De rodillas', descripcion: 'Más exigente para el core.', archivo: 'antirrotacion-banda-rodillas.jpg' },
      { nombre: 'Con paso lateral', descripcion: 'Dando pasos que alejan del anclaje, aumentando la tensión.' },
    ],
  },
  {
    archivo: 'paseo-granjero.jpg',
    nombre: 'Paseo del granjero',
    descripcion: 'Se camina erguido con un peso en cada mano, sin inclinarse a ningún lado ni encoger los hombros. Parece sencillo y es de lo que más exige al core.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Trapecio', 'Antiflexión', 'Mancuerna', 'Kettlebell', 'Acarreo', 'Global', 'plano_eje:Frontal (coronal)', 'plano_eje:Sagital (anteroposterior)', 'Bipedestación', 'Bipodal'],
    items_ejecucion: [
      'El tronco se mantiene vertical, sin inclinarse a los lados',
      'Los hombros quedan atrás y abajo, sin encogerse',
      'Los pasos son cortos y controlados',
      'La mirada al frente, no al suelo',
    ],
    feedbacks: ['No te inclines', 'Hombros atrás', 'Pasos cortos'],
    variantes: [
      { nombre: 'A una mano', descripcion: 'Un solo peso. Todo el trabajo pasa a aguantar la inclinación.' },
      { nombre: 'En rack', descripcion: 'El peso sujeto a la altura del hombro. Añade exigencia de tronco.' },
    ],
  },
  {
    archivo: 'rueda-abdominal.jpg',
    nombre: 'Rueda abdominal',
    descripcion: 'De rodillas, se rueda hacia delante estirando el cuerpo sin que la cadera se doble ni la lumbar se arquee, y se vuelve tirando con el abdomen.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Abdomen', 'Columna', 'Rueda abdominal', 'Antiextensión', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Arrodillado', 'apoyo:Rodilla'],
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
    etiquetas: ['Abdomen', 'Columna', 'Fitball', 'Antiextensión', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Arrodillado', 'apoyo:Rodilla'],
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
    etiquetas: ['Columna', 'Erectores Espinales', 'Flexión', 'Extensión', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Cuadrupedia', 'apoyo:Rodilla'],
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
    etiquetas: ['Erectores Espinales', 'Columna', 'Glúteo', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'posicion:Prono'],
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

  // ─────────────────────────────────────────────────────────────────────────────
  // HOMBRO Y MANGUITO ROTADOR
  //
  // Ya estaba press militar de pie, así que no se repite.
  //
  // Cinco analíticos de manguito y deltoides, dos de control escapular y tres
  // globales. Los tres globales tapan huecos que llevaban vacíos toda la biblioteca:
  // TRACCIÓN VERTICAL y EMPUJE HORIZONTAL no tenían ni un ejercicio.
  //
  // Ojo con las etiquetas de este bloque: "Manguito rotador" existe como músculo Y
  // como patología, y la búsqueda por nombre da prioridad al músculo. Para marcar la
  // patología se usa "Hombro doloroso", que es único.
  // ─────────────────────────────────────────────────────────────────────────────

  {
    archivo: 'rotacion-externa-banda.jpg',
    nombre: 'Rotación externa con banda',
    descripcion: 'De pie, con el codo pegado al costado y flexionado a noventa grados, se gira el antebrazo hacia fuera contra la banda y se vuelve despacio. El codo no se despega del cuerpo en ningún momento.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Manguito rotador', 'Infraespinoso', 'Hombro', 'Banda elástica', 'Rotación', 'Hombro doloroso', 'Analítico', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)', 'Bipedestación', 'Bipodal', 'agarre:Prono'],
    items_ejecucion: [
      'El codo se mantiene pegado al costado durante todo el recorrido',
      'El movimiento es solo de rotación: el hombro no se separa ni se eleva',
      'El tronco no gira para ayudar al brazo',
      'La vuelta es lenta, sin dejar que la banda tire',
    ],
    feedbacks: ['Codo pegado al cuerpo', 'Gira solo el antebrazo', 'Vuelve despacio'],
    variantes: [
      { nombre: 'Con toalla en la axila', descripcion: 'Una toalla enrollada bajo el brazo obliga a mantener el codo pegado.' },
      { nombre: 'A 90 grados de abducción', descripcion: 'Con el brazo separado a la altura del hombro. Más exigente y más específica del gesto de lanzar.' },
      { nombre: 'Tumbado de lado', descripcion: 'Sin banda, con una mancuerna pequeña. Quita la variabilidad de la tensión.' },
    ],
  },
  {
    archivo: 'rotacion-interna-banda.jpg',
    nombre: 'Rotación interna con banda',
    descripcion: 'Igual que la externa pero al revés: el antebrazo gira hacia dentro, cruzando hacia el ombligo, contra la resistencia de la banda. El codo sigue pegado al costado.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Manguito rotador', 'Subescapular', 'Hombro', 'Banda elástica', 'Rotación', 'Analítico', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)', 'Bipedestación', 'Bipodal', 'agarre:Prono'],
    items_ejecucion: [
      'El codo se mantiene pegado al costado',
      'El antebrazo cruza hacia el ombligo, sin llevar el hombro adelante',
      'El tronco no gira para acompañar',
      'La vuelta es controlada',
    ],
    feedbacks: ['Codo pegado', 'Lleva la mano al ombligo', 'No gires el cuerpo'],
    variantes: [
      { nombre: 'Con toalla en la axila', descripcion: 'Obliga a mantener el codo pegado.' },
      { nombre: 'A 90 grados de abducción', descripcion: 'Con el brazo a la altura del hombro.' },
      { nombre: 'Tumbado de lado', descripcion: 'Con mancuerna pequeña, tumbado sobre el lado que trabaja.' },
    ],
  },
  {
    archivo: 'elevacion-lateral.jpg',
    nombre: 'Elevación lateral',
    descripcion: 'De pie con una mancuerna en cada mano, se separan los brazos hacia los lados hasta la altura del hombro y se baja controlando. No se sube más arriba del hombro.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Deltoides', 'Hombro', 'Mancuerna', 'Abducción', 'Analítico', 'plano_eje:Frontal (coronal)', 'plano_eje:Sagital (anteroposterior)', 'Bipedestación', 'Bipodal'],
    items_ejecucion: [
      'Los brazos suben hasta la altura del hombro, no más',
      'El tronco se mantiene quieto, sin balancearse para coger impulso',
      'Los hombros no se encogen hacia las orejas',
      'La bajada es controlada, no se dejan caer',
    ],
    feedbacks: ['Hasta el hombro, no más', 'No te balancees', 'Hombros abajo'],
    variantes: [
      { nombre: 'Con banda', descripcion: 'La resistencia crece al final del recorrido.' },
      { nombre: 'Sentado', descripcion: 'Quita el impulso del tronco por completo.' },
    ],
  },
  {
    archivo: 'elevacion-frontal.jpg',
    nombre: 'Elevación frontal',
    descripcion: 'De pie con una mancuerna en cada mano, se levantan los brazos rectos hacia delante hasta la altura del hombro y se baja despacio.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Deltoides', 'Hombro', 'Mancuerna', 'Flexión', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación', 'Bipodal'],
    items_ejecucion: [
      'Los brazos suben hasta la altura del hombro, no más',
      'La zona lumbar no se arquea al subir',
      'El tronco no se balancea',
      'Los codos quedan casi extendidos, sin bloquear',
    ],
    feedbacks: ['Hasta el hombro', 'No arquees la espalda', 'Sube despacio'],
    variantes: [
      { nombre: 'Alterna', descripcion: 'Un brazo cada vez. Más control, menos carga sobre la lumbar.' },
      { nombre: 'Con disco', descripcion: 'Sujetando un disco con las dos manos.' },
      { nombre: 'Con banda', descripcion: 'Pisando la banda con los dos pies.' },
    ],
  },
  {
    archivo: 'pajaro.jpg',
    nombre: 'Pájaro',
    descripcion: 'Con el tronco inclinado casi hasta la horizontal y la espalda recta, se abren los brazos hacia los lados hasta la altura de la espalda, juntando las escápulas al final.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Deltoides', 'Trapecio', 'Romboides Mayor', 'Hombro', 'Mancuerna', 'Analítico', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)', 'Bipedestación', 'Bipodal'],
    items_ejecucion: [
      'La espalda se mantiene recta, sin redondearse',
      'Los brazos se abren hacia los lados, no hacia atrás',
      'Las escápulas se juntan al final del recorrido',
      'El tronco no se incorpora para ayudar',
    ],
    feedbacks: ['Espalda recta', 'Abre hacia los lados', 'Junta las escápulas'],
    variantes: [
      { nombre: 'De pie inclinado', descripcion: 'La versión estándar.' },
      { nombre: 'Sentado', descripcion: 'Sentado con el pecho sobre los muslos. Descarga la lumbar.' },
      { nombre: 'En banco inclinado', descripcion: 'Tumbado boca abajo sobre un banco. La más estable.' },
    ],
  },
  {
    archivo: 'face-pull.jpg',
    nombre: 'Face pull',
    descripcion: 'Se tracciona una banda anclada a la altura de la cara hacia la frente, separando las manos y llevando los codos altos y abiertos. Junta las escápulas al final.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Trapecio', 'Romboides Mayor', 'Deltoides', 'Escapular', 'Polea', 'Banda elástica', 'Retracción', 'Tracción horizontal', 'Global', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)', 'Bipedestación', 'Bipodal'],
    items_ejecucion: [
      'Los codos quedan altos, a la altura de los hombros o por encima',
      'Las manos se separan al final del recorrido',
      'Las escápulas se juntan, el tirón no sale de los brazos',
      'El tronco no se echa hacia atrás para ayudar',
    ],
    feedbacks: ['Codos altos', 'Separa las manos', 'Junta las escápulas'],
    variantes: [
      { nombre: 'Con banda', descripcion: 'Anclada a la altura de la cara. La versión de casa.' },
      { nombre: 'En polea', descripcion: 'Con cuerda, la polea alta.' },
      { nombre: 'De rodillas', descripcion: 'Quita el impulso de las piernas.' },
    ],
  },
  {
    archivo: 'deslizamiento-pared.jpg',
    nombre: 'Deslizamiento en pared',
    descripcion: 'De espaldas a la pared con los antebrazos apoyados en ella y los codos a noventa grados, se suben y bajan los brazos sin despegar antebrazos, espalda ni cabeza.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Serrato Superior', 'Trapecio', 'Escapular', 'Pared', 'Protracción', 'Hombro doloroso', 'Analítico', 'plano_eje:Frontal (coronal)', 'plano_eje:Sagital (anteroposterior)', 'Bipedestación', 'Bipodal'],
    items_ejecucion: [
      'Los antebrazos y el dorso de las manos no se despegan de la pared',
      'La zona lumbar no se separa de la pared al subir',
      'Los hombros no se encogen hacia las orejas',
      'Se sube solo hasta donde no aparezca dolor',
    ],
    feedbacks: ['No despegues los antebrazos', 'Lumbar pegada', 'Hombros abajo'],
    variantes: [
      { nombre: 'Con banda en las muñecas', descripcion: 'Obliga a separar los brazos mientras suben.' },
      { nombre: 'Tumbado en el suelo', descripcion: 'Boca arriba. Más fácil de controlar cuando falta movilidad.' },
    ],
  },
  {
    archivo: 'ytw-prono.jpg',
    nombre: 'Y-T-W en prono',
    descripcion: 'Tumbado boca abajo sobre un banco inclinado, se levantan los brazos dibujando una Y, una T y una W, manteniendo cada posición. Se trabaja la escápula, no el hombro.',
    tipo_medida: 'tiempo',
    etiquetas: ['Trapecio', 'Romboides Mayor', 'Escapular', 'Banco', 'Retracción', 'Analítico', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)', 'posicion:Prono'],
    items_ejecucion: [
      'El movimiento nace de la escápula, no de levantar el brazo por levantarlo',
      'El cuello se mantiene en línea con la espalda, sin levantar la cabeza',
      'Los hombros no se encogen hacia las orejas',
      'La zona lumbar no se arquea',
    ],
    feedbacks: ['Que se mueva la escápula', 'La cabeza en línea', 'Hombros abajo'],
    variantes: [
      { nombre: 'Solo Y', descripcion: 'Brazos arriba en diagonal. Trapecio inferior.' },
      { nombre: 'Solo T', descripcion: 'Brazos abiertos en cruz. Romboides y trapecio medio.' },
      { nombre: 'Solo W', descripcion: 'Codos flexionados pegados al cuerpo. Rotación externa.' },
    ],
  },
  {
    archivo: 'flexiones.jpg',
    nombre: 'Flexiones',
    descripcion: 'Con las manos y las puntas de los pies apoyadas y el cuerpo en línea recta, se baja el pecho hacia el suelo con los codos a unos cuarenta y cinco grados y se empuja para subir.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Pectoral', 'Tríceps', 'Hombro', 'Abdomen', 'Empuje horizontal', 'Global', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)', 'posicion:Prono', 'apoyo:Mano'],
    items_ejecucion: [
      'El cuerpo forma una línea recta: la cadera no cae ni se eleva',
      'Los codos quedan a unos 45°, no abiertos del todo',
      'El pecho baja hasta cerca del suelo',
      'El cuello sigue la línea de la espalda',
    ],
    feedbacks: ['Cadera en línea', 'Codos algo cerrados', 'Baja el pecho'],
    variantes: [
      { nombre: 'En pared', descripcion: 'De pie contra la pared. El escalón más accesible.' },
      { nombre: 'Con rodillas apoyadas', descripcion: 'Reduce el peso a levantar.' },
      { nombre: 'Completa', descripcion: 'Apoyo en manos y puntas de los pies.' },
      { nombre: 'Con pies elevados', descripcion: 'Sobre un cajón. Más carga en la parte alta del pecho.' },
    ],
  },
  {
    archivo: 'dominada-asistida.jpg',
    nombre: 'Dominada asistida',
    descripcion: 'Colgado de la barra con una banda que descarga parte del peso, se tira hasta llevar el mentón por encima de la barra, empezando el tirón desde la escápula.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Dorsal Ancho', 'Bíceps', 'Trapecio', 'Escapular', 'Barra de dominadas', 'Banda elástica', 'Tracción vertical', 'Global', 'plano_eje:Frontal (coronal)', 'plano_eje:Sagital (anteroposterior)', 'Bipedestación', 'apoyo:Cadena cerrada', 'agarre:Prono'],
    items_ejecucion: [
      'El tirón empieza bajando la escápula, no doblando el codo',
      'El cuerpo no se balancea para coger impulso',
      'Se baja controlando hasta extender casi del todo los codos',
      'Los hombros no se quedan encogidos arriba',
    ],
    feedbacks: ['Baja primero la escápula', 'Sin balanceo', 'Baja controlando'],
    variantes: [
      { nombre: 'Con banda gruesa', descripcion: 'Mucha asistencia. Por aquí se empieza.' },
      { nombre: 'Con banda fina', descripcion: 'Poca asistencia.' },
      { nombre: 'Negativa', descripcion: 'Solo la bajada, empezando arriba. Trabajo excéntrico sin subir.' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // PECTORAL Y TRÍCEPS
  //
  // Ya estaban press de banca y flexiones. Este bloque llena el empuje: hasta ahora
  // toda la biblioteca tenía dos ejercicios de empujar y catorce de sentadilla.
  // ─────────────────────────────────────────────────────────────────────────────

  {
    archivo: 'press-banca-mancuernas.jpg',
    nombre: 'Press de banca con mancuernas',
    descripcion: 'Tumbado en banco horizontal con una mancuerna en cada mano. Se baja hasta la altura del pecho con los codos a unos cuarenta y cinco grados y se empuja hasta extender los brazos.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Pectoral', 'Tríceps', 'Hombro', 'Banco', 'Mancuerna', 'Empuje horizontal', 'Global', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)', 'posicion:Supino', 'agarre:Neutro'],
    items_ejecucion: [
      'Los codos quedan a unos 45°, no abiertos del todo',
      'Las escápulas se mantienen juntas y apoyadas en el banco',
      'Las dos mancuernas bajan a la vez y a la misma altura',
      'Los pies siguen apoyados en el suelo',
    ],
    feedbacks: ['Junta las escápulas', 'Codos algo cerrados', 'Las dos a la vez'],
    variantes: [
      { nombre: 'Neutro', descripcion: 'Palmas mirándose. Más amable con el hombro doloroso.' },
      { nombre: 'Prono', descripcion: 'Palmas hacia los pies, como en la barra.' },
      { nombre: 'Alterno', descripcion: 'Un brazo cada vez. Añade trabajo antirrotación de core.' },
    ],
  },
  {
    archivo: 'press-inclinado.jpg',
    nombre: 'Press inclinado con mancuernas',
    descripcion: 'Igual que el press de banca pero con el respaldo inclinado unos treinta grados. La inclinación carga más la parte alta del pecho y el deltoides anterior.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Pectoral', 'Deltoides', 'Tríceps', 'Banco', 'Mancuerna', 'Empuje horizontal', 'Global', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)', 'posicion:Supino', 'agarre:Neutro'],
    items_ejecucion: [
      'La zona lumbar no se despega del respaldo',
      'Los codos quedan a unos 45°',
      'Las mancuernas bajan a la altura del pecho alto, no del cuello',
      'Los hombros no se adelantan al empujar',
    ],
    feedbacks: ['Espalda pegada al respaldo', 'Baja al pecho alto', 'Hombros atrás'],
    variantes: [
      { nombre: 'A 30 grados', descripcion: 'Inclinación estándar.' },
      { nombre: 'A 45 grados', descripcion: 'Más exigencia de hombro, menos de pecho.' },
      { nombre: 'Con barra', descripcion: 'Permite más carga, menos rango.' },
    ],
  },
  {
    archivo: 'aperturas.jpg',
    nombre: 'Aperturas en banco',
    descripcion: 'Tumbado en banco con los brazos casi extendidos, se abren hacia los lados hasta notar tensión en el pecho y se cierran describiendo un arco, sin doblar más el codo.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Pectoral', 'Hombro', 'Banco', 'Mancuerna', 'Adducción', 'Analítico', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)', 'posicion:Supino'],
    items_ejecucion: [
      'El codo mantiene siempre la misma flexión ligera',
      'Se baja solo hasta la altura del pecho, no más',
      'Las escápulas se mantienen juntas y apoyadas',
      'El movimiento es un arco, no un empuje',
    ],
    feedbacks: ['El codo no cambia', 'No bajes más del pecho', 'Dibuja un arco'],
    variantes: [
      { nombre: 'En banco plano', descripcion: 'La versión estándar.', archivo: 'aperturas-banco-plano.jpg' },
      { nombre: 'En banco inclinado', descripcion: 'Carga la parte alta del pecho.', archivo: 'aperturas-banco-inclinado.jpg' },
      { nombre: 'Con banda de pie', descripcion: 'Anclada detrás. Se puede hacer en casa.', archivo: 'aperturas-banda-de-pie.jpg' },
    ],
  },
  {
    archivo: 'fondos-banco.jpg',
    nombre: 'Fondos en banco',
    descripcion: 'Con las manos apoyadas atrás en el borde de un banco y las piernas al frente, se baja la cadera flexionando los codos hacia atrás y se sube empujando con los tríceps.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Tríceps', 'Hombro', 'Pectoral', 'Banco', 'Empuje horizontal', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Sentado', 'apoyo:Mano'],
    items_ejecucion: [
      'Los codos van hacia atrás, no se abren a los lados',
      'La espalda baja pegada al banco, sin alejarse',
      'Los hombros no se encogen hacia las orejas',
      'Se baja solo hasta donde el hombro no moleste',
    ],
    feedbacks: ['Codos atrás', 'Pegado al banco', 'Hombros abajo'],
    variantes: [
      { nombre: 'Rodillas flexionadas', descripcion: 'Pies cerca del cuerpo. La versión más fácil.' },
      { nombre: 'Piernas extendidas', descripcion: 'Talones lejos. Más peso sobre los brazos.' },
      { nombre: 'Pies elevados', descripcion: 'Sobre otro banco. La más exigente.' },
    ],
  },
  {
    archivo: 'press-frances.jpg',
    nombre: 'Press francés',
    descripcion: 'Tumbado en banco con una barra corta sujeta con agarre prono, se baja hacia la frente flexionando solo el codo, manteniendo los brazos verticales y quietos.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Tríceps', 'Codo', 'Banco', 'Barra corta', 'Extensión', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'posicion:Supino'],
    items_ejecucion: [
      'Los brazos se mantienen verticales: solo se mueve el antebrazo',
      'Los codos no se abren hacia los lados',
      'La barra baja hacia la frente, no hacia el pecho',
      'No aparece dolor en el codo',
    ],
    feedbacks: ['Los brazos quietos', 'Codos cerrados', 'Baja a la frente'],
    variantes: [
      { nombre: 'Con barra corta', descripcion: 'Agarre prono. La versión estándar.' },
      { nombre: 'Con mancuernas', descripcion: 'Palmas mirándose. Más amable con el codo.' },
      { nombre: 'De pie con banda', descripcion: 'Banda anclada arriba y detrás. Para hacer en casa.' },
    ],
  },
  {
    archivo: 'extension-triceps-polea.jpg',
    nombre: 'Extensión de tríceps en polea',
    descripcion: 'De pie frente a una polea alta, con los codos pegados al costado, se extienden los antebrazos hacia abajo y se vuelve controlando sin dejar que el codo se separe.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Tríceps', 'Codo', 'Polea', 'Extensión', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación', 'Bipodal', 'agarre:Prono'],
    items_ejecucion: [
      'Los codos se mantienen pegados al costado',
      'Solo se mueve el antebrazo: el hombro no empuja',
      'El tronco se queda vertical, sin echarse encima del peso',
      'La vuelta es controlada, sin que la polea tire',
    ],
    feedbacks: ['Codos pegados', 'Solo el antebrazo', 'No te eches encima'],
    variantes: [
      { nombre: 'Con barra', descripcion: 'Agarre prono.' },
      { nombre: 'Con cuerda', descripcion: 'Permite separar las manos al final del recorrido.' },
      { nombre: 'Con banda', descripcion: 'Anclada arriba. La versión de casa.' },
    ],
  },
  {
    archivo: 'extension-triceps-sobre-cabeza.jpg',
    nombre: 'Extensión de tríceps sobre la cabeza',
    descripcion: 'De pie con una mancuerna sujeta con las dos manos por detrás de la cabeza, se extienden los brazos hacia arriba manteniendo los codos pegados a las orejas.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Tríceps', 'Hombro', 'Codo', 'Mancuerna', 'Extensión', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación', 'Bipodal'],
    items_ejecucion: [
      'Los codos apuntan al techo y no se abren hacia los lados',
      'La zona lumbar no se arquea al extender',
      'El abdomen se mantiene activo',
      'Se baja solo hasta donde el hombro lo permita sin dolor',
    ],
    feedbacks: ['Codos al techo', 'No arquees la lumbar', 'Aprieta el abdomen'],
    variantes: [
      { nombre: 'De pie', descripcion: 'La versión estándar.' },
      { nombre: 'Sentado con respaldo', descripcion: 'Evita arquear la espalda.' },
      { nombre: 'A una mano', descripcion: 'Una sola mancuerna por brazo. Corrige diferencias entre lados.' },
    ],
  },
  {
    archivo: 'pullover.jpg',
    nombre: 'Pullover con mancuerna',
    descripcion: 'Tumbado en banco con una mancuerna sujeta con las dos manos, se lleva por detrás de la cabeza con los brazos casi extendidos y se vuelve describiendo un arco.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Pectoral', 'Dorsal Ancho', 'Hombro', 'Costal', 'Banco', 'Mancuerna', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'posicion:Supino', 'agarre:Neutro'],
    items_ejecucion: [
      'Los codos mantienen la misma flexión ligera todo el recorrido',
      'La zona lumbar no se despega del banco',
      'Se baja solo hasta donde el hombro llegue sin forzar',
      'Las costillas no se abren hacia arriba',
    ],
    feedbacks: ['El codo no cambia', 'Lumbar pegada', 'No fuerces el hombro'],
    variantes: [
      { nombre: 'A lo largo del banco', descripcion: 'Tumbado del todo. La versión estándar.' },
      { nombre: 'Cruzado en el banco', descripcion: 'Solo la espalda alta apoyada. Más rango de cadera.' },
      { nombre: 'Con barra corta', descripcion: 'Agarre más estable.' },
    ],
  },
  {
    archivo: 'flexiones-suspension.jpg',
    nombre: 'Flexiones en suspensión',
    descripcion: 'Boca abajo sujetando las asas de las cinchas, con el cuerpo inclinado en línea recta, se baja el pecho flexionando los codos y se empuja. La inestabilidad suma trabajo de core.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Pectoral', 'Tríceps', 'Hombro', 'Abdomen', 'Cinchas de suspensión', 'Empuje horizontal', 'Global', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)', 'posicion:Prono', 'apoyo:Mano', 'agarre:Neutro'],
    items_ejecucion: [
      'El cuerpo forma una línea recta: la cadera no cae',
      'Las asas se mantienen quietas, sin bailar',
      'Los codos van hacia atrás, no abiertos del todo',
      'Los hombros no se adelantan al bajar',
    ],
    feedbacks: ['Cadera en línea', 'Que las asas no bailen', 'Codos atrás'],
    variantes: [
      { nombre: 'Poco inclinado', descripcion: 'Casi de pie. La versión de entrada.' },
      { nombre: 'Muy inclinado', descripcion: 'Cuerpo cerca de la horizontal. Mucho más exigente.' },
      { nombre: 'A una mano', descripcion: 'Solo con control muy bueno.' },
    ],
  },
  {
    archivo: 'press-landmine.jpg',
    nombre: 'Press landmine a una mano',
    descripcion: 'Con un extremo de la barra anclado al suelo, se empuja el otro desde el hombro hacia arriba y adelante. El arco de la barra es más amable con el hombro que un press vertical puro.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Deltoides', 'Hombro', 'Tríceps', 'Abdomen', 'Unilateral', 'Landmine', 'Barra', 'Empuje vertical', 'Global', 'plano_eje:Frontal (coronal)', 'plano_eje:Sagital (anteroposterior)', 'Bipedestación', 'Bipodal', 'agarre:Neutro'],
    items_ejecucion: [
      'La zona lumbar no se arquea al empujar',
      'El tronco no gira para acompañar al brazo',
      'El hombro no se encoge hacia la oreja arriba',
      'La barra sube en diagonal, siguiendo su arco',
    ],
    feedbacks: ['No arquees la lumbar', 'El tronco quieto', 'Hombro abajo'],
    variantes: [
      { nombre: 'De pie', descripcion: 'La versión estándar.' },
      { nombre: 'En zancada', descripcion: 'Rodilla contraria adelantada. Más estabilidad de cadera.' },
      { nombre: 'De rodillas', descripcion: 'Quita las piernas: todo el trabajo pasa al core.' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // ESPALDA Y BÍCEPS
  //
  // Ya estaban remo con barra y dominada asistida. Con esto la tracción queda
  // equilibrada con el empuje, que es lo que hay que buscar en cualquier hombro que
  // duele: casi siempre falta trabajo de espalda, no sobra de pecho.
  // ─────────────────────────────────────────────────────────────────────────────

  {
    archivo: 'remo-mancuerna.jpg',
    nombre: 'Remo con mancuerna a una mano',
    descripcion: 'Con una rodilla y una mano apoyadas en un banco y la espalda horizontal, se tracciona la mancuerna hacia la cadera llevando el codo atrás y pegado al cuerpo.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Dorsal Ancho', 'Romboides Mayor', 'Bíceps', 'Escapular', 'Unilateral', 'Banco', 'Mancuerna', 'Tracción horizontal', 'Global', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)', 'Bipedestación', 'Bipodal', 'agarre:Neutro'],
    items_ejecucion: [
      'El tirón empieza en la escápula, no en el bíceps',
      'La espalda se mantiene horizontal y recta',
      'El tronco no rota para acompañar al brazo',
      'El codo va hacia la cadera, pegado al cuerpo',
    ],
    feedbacks: ['Baja primero la escápula', 'Espalda recta', 'No gires el tronco'],
    variantes: [
      { nombre: 'Apoyado en banco', descripcion: 'Rodilla y mano en el banco. La versión estándar.' },
      { nombre: 'Sin apoyo', descripcion: 'De pie inclinado. Suma trabajo de core y lumbar.' },
      { nombre: 'Con banda', descripcion: 'Pisando la banda. Versión de casa.' },
    ],
  },
  {
    archivo: 'remo-polea-baja.jpg',
    nombre: 'Remo en polea baja',
    descripcion: 'Sentado con las piernas al frente, se tracciona el cable hacia el abdomen juntando las escápulas y se vuelve sin dejar que el tronco se venga adelante.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Dorsal Ancho', 'Romboides Mayor', 'Trapecio', 'Bíceps', 'Escapular', 'Polea', 'Tracción horizontal', 'Global', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)', 'Sentado', 'agarre:Prono'],
    items_ejecucion: [
      'Las escápulas se juntan al final del tirón',
      'La espalda se mantiene recta, sin redondearse al volver',
      'El tronco no se echa atrás para ayudar',
      'Los codos van pegados al cuerpo hacia atrás',
    ],
    feedbacks: ['Junta las escápulas', 'No te eches atrás', 'Espalda recta'],
    variantes: [
      { nombre: 'Agarre neutro', descripcion: 'Palmas mirándose, con triángulo. El más cómodo.' },
      { nombre: 'Agarre ancho', descripcion: 'Con barra, manos separadas. Más trapecio medio.' },
      { nombre: 'A una mano', descripcion: 'Corrige diferencias entre lados.' },
    ],
  },
  {
    archivo: 'jalon-al-pecho.jpg',
    nombre: 'Jalón al pecho',
    descripcion: 'Sentado bajo una polea alta, se tracciona la barra hasta la clavícula llevando los codos hacia abajo y atrás, con el tronco ligeramente inclinado.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Dorsal Ancho', 'Bíceps', 'Escapular', 'Polea', 'Tracción vertical', 'Global', 'plano_eje:Frontal (coronal)', 'plano_eje:Sagital (anteroposterior)', 'Sentado', 'agarre:Prono'],
    items_ejecucion: [
      'El tirón empieza bajando la escápula',
      'La barra baja por delante, hasta la clavícula, nunca por detrás de la nuca',
      'El tronco se inclina poco y no se balancea',
      'Los hombros no se quedan encogidos arriba',
    ],
    feedbacks: ['Baja la escápula primero', 'Por delante, a la clavícula', 'Sin balanceo'],
    variantes: [
      { nombre: 'Agarre ancho prono', descripcion: 'Manos separadas, palmas al frente. Más dorsal.' },
      { nombre: 'Agarre neutro', descripcion: 'Palmas mirándose. Más amable con el hombro.' },
      { nombre: 'Agarre supino', descripcion: 'Palmas hacia la cara. Suma bíceps.' },
    ],
  },
  {
    archivo: 'remo-invertido.jpg',
    nombre: 'Remo invertido',
    descripcion: 'Colgado por debajo de una barra baja con el cuerpo en línea recta y los talones apoyados, se tracciona hasta llevar el pecho cerca de la barra.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Dorsal Ancho', 'Romboides Mayor', 'Trapecio', 'Bíceps', 'Abdomen', 'Barra de dominadas', 'Tracción horizontal', 'Global', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)', 'posicion:Supino', 'apoyo:Cadena cerrada'],
    items_ejecucion: [
      'El cuerpo forma una línea recta: la cadera no cae',
      'Las escápulas se juntan al final del tirón',
      'El pecho llega cerca de la barra, no solo la barbilla',
      'La bajada es controlada',
    ],
    feedbacks: ['Cadera en línea', 'Junta las escápulas', 'Lleva el pecho'],
    variantes: [
      { nombre: 'Rodillas flexionadas', descripcion: 'Pies apoyados en el suelo cerca. Versión de entrada.' },
      { nombre: 'Piernas extendidas', descripcion: 'Talones lejos, cuerpo horizontal.' },
      { nombre: 'Pies elevados', descripcion: 'Sobre un cajón. La más exigente.' },
    ],
  },
  {
    archivo: 'remo-suspension.jpg',
    nombre: 'Remo en suspensión',
    descripcion: 'Sujetando las asas de las cinchas con el cuerpo inclinado hacia atrás y los talones apoyados, se tracciona hasta el pecho manteniendo la línea del cuerpo.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Dorsal Ancho', 'Romboides Mayor', 'Bíceps', 'Abdomen', 'Escapular', 'Cinchas de suspensión', 'Tracción horizontal', 'Global', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)', 'Bipedestación', 'apoyo:Cadena cerrada', 'agarre:Neutro'],
    items_ejecucion: [
      'El cuerpo se mantiene en línea recta, la cadera no cae',
      'Las escápulas se juntan antes de doblar el codo',
      'Los hombros no se encogen',
      'La vuelta es controlada, sin dejarse caer',
    ],
    feedbacks: ['Cuerpo en línea', 'Escápulas primero', 'Baja despacio'],
    variantes: [
      { nombre: 'Poco inclinado', descripcion: 'Casi de pie. Fácil de graduar dando un paso.' },
      { nombre: 'Muy inclinado', descripcion: 'Cuerpo cerca de la horizontal.' },
      { nombre: 'A una mano', descripcion: 'Suma trabajo antirrotación.' },
    ],
  },
  {
    archivo: 'encogimiento-hombros.jpg',
    nombre: 'Encogimiento de hombros',
    descripcion: 'De pie con una mancuerna en cada mano y los brazos rectos, se elevan los hombros hacia las orejas y se baja controlando, sin doblar los codos.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Trapecio', 'Escapular', 'Mancuerna', 'Analítico', 'plano_eje:Frontal (coronal)', 'plano_eje:Sagital (anteroposterior)', 'Bipedestación', 'Bipodal'],
    items_ejecucion: [
      'Los codos se mantienen extendidos: no se tira con el brazo',
      'Los hombros suben en vertical, sin rodarlos hacia atrás',
      'El cuello se mantiene largo, sin meter la cabeza',
      'La bajada es controlada',
    ],
    feedbacks: ['No dobles el codo', 'Sube recto', 'Baja despacio'],
    variantes: [
      { nombre: 'Con mancuernas', descripcion: 'La versión estándar.' },
      { nombre: 'Con barra', descripcion: 'Por delante de los muslos.' },
      { nombre: 'Con kettlebell', descripcion: 'Colgando a los lados.' },
    ],
  },
  {
    archivo: 'pullover-polea.jpg',
    nombre: 'Pullover en polea',
    descripcion: 'De pie frente a una polea alta con los brazos casi extendidos, se tracciona la barra en arco hasta los muslos sin doblar los codos. Aísla el dorsal quitando el bíceps.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Dorsal Ancho', 'Escapular', 'Polea', 'Extensión', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación', 'Bipodal', 'agarre:Prono'],
    items_ejecucion: [
      'Los codos mantienen la misma flexión ligera todo el recorrido',
      'El movimiento es un arco, no un tirón hacia el abdomen',
      'El tronco se inclina poco y se mantiene firme',
      'Las escápulas bajan al final del recorrido',
    ],
    feedbacks: ['El codo no cambia', 'Dibuja un arco', 'Baja las escápulas'],
    variantes: [
      { nombre: 'Con barra recta', descripcion: 'La versión estándar.' },
      { nombre: 'Con cuerda', descripcion: 'Más rango al final.' },
      { nombre: 'Con banda', descripcion: 'Anclada arriba. Versión de casa.' },
    ],
  },
  {
    archivo: 'curl-mancuernas.jpg',
    nombre: 'Curl de bíceps con mancuernas',
    descripcion: 'De pie con los codos pegados al costado y las palmas hacia arriba, se flexionan los antebrazos y se baja controlando hasta extender casi del todo.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Bíceps', 'Codo', 'Mancuerna', 'Flexión', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación', 'Bipodal', 'agarre:Supino'],
    items_ejecucion: [
      'Los codos se mantienen pegados al costado',
      'El tronco no se balancea para coger impulso',
      'Se baja hasta extender casi del todo el codo',
      'Los hombros no se adelantan al subir',
    ],
    feedbacks: ['Codos pegados', 'Sin balanceo', 'Estira abajo'],
    variantes: [
      { nombre: 'Alterno', descripcion: 'Un brazo cada vez.' },
      { nombre: 'Simultáneo', descripcion: 'Los dos a la vez.' },
      { nombre: 'Sentado con respaldo', descripcion: 'Quita el balanceo por completo.' },
    ],
  },
  {
    archivo: 'curl-martillo.jpg',
    nombre: 'Curl martillo',
    descripcion: 'Igual que el curl pero con las palmas mirándose, la mancuerna en vertical como un martillo. Trabaja más el braquiorradial, en el antebrazo, y menos el bíceps.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Braquioradial', 'Bíceps', 'Codo', 'Mancuerna', 'Flexión', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación', 'Bipodal', 'agarre:Neutro'],
    items_ejecucion: [
      'Las palmas se mantienen mirándose todo el recorrido, sin girar',
      'Los codos quedan pegados al costado',
      'El tronco no se balancea',
      'La bajada es controlada',
    ],
    feedbacks: ['Palmas mirándose', 'Codos pegados', 'Baja despacio'],
    variantes: [
      { nombre: 'Cruzado al pecho', descripcion: 'La mancuerna cruza hacia el hombro contrario.' },
      { nombre: 'Con cuerda en polea', descripcion: 'Tensión constante en todo el recorrido.' },
    ],
  },
  {
    archivo: 'curl-barra.jpg',
    nombre: 'Curl con barra',
    descripcion: 'De pie con una barra con agarre supino a la anchura de los hombros, se flexionan los codos manteniéndolos pegados al costado y se baja controlando.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Bíceps', 'Codo', 'Barra', 'Flexión', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación', 'Bipodal', 'agarre:Supino'],
    items_ejecucion: [
      'Los codos no se adelantan ni se separan del costado',
      'La zona lumbar no se arquea al subir',
      'El tronco no se balancea',
      'Se baja hasta extender casi del todo',
    ],
    feedbacks: ['Codos quietos', 'No arquees la espalda', 'Estira abajo'],
    variantes: [
      { nombre: 'Barra recta', descripcion: 'Agarre supino clásico. Exige muñeca cómoda.' },
      { nombre: 'Barra corta', descripcion: 'Más amable con la muñeca y el codo.' },
      { nombre: 'Agarre ancho', descripcion: 'Manos por fuera de los hombros.' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // GEMELO, TOBILLO Y PIE
  //
  // El bloque que más falta hacía: esguince de tobillo, fascitis plantar y
  // tendinopatía aquílea son tres patologías del catálogo que no tenían NI UN
  // ejercicio asociado.
  //
  // La mayoría son de casa: banda, escalón y una pelota.
  // ─────────────────────────────────────────────────────────────────────────────

  {
    archivo: 'elevacion-talones.jpg',
    nombre: 'Elevación de talones de pie',
    descripcion: 'De pie con las rodillas extendidas, se elevan los talones hasta quedar sobre las puntas y se baja controlando. Con la rodilla recta manda el gemelo.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Tríceps Sural', 'Gastronécmio', 'Tobillo', 'Tendinopatía aquílea', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación', 'Bipodal'],
    items_ejecucion: [
      'Las rodillas se mantienen extendidas',
      'El peso queda repartido en toda la punta del pie, sin volcarse al borde externo',
      'Se sube hasta el tope del recorrido',
      'La bajada es lenta y controlada',
    ],
    feedbacks: ['Rodillas rectas', 'No te vuelques hacia fuera', 'Baja despacio'],
    variantes: [
      { nombre: 'Bilateral', descripcion: 'Los dos pies a la vez.' },
      { nombre: 'A una pierna', descripcion: 'Cuadruplica la carga sobre el tendón.' },
      { nombre: 'Con peso', descripcion: 'Mancuernas en las manos o barra en la espalda.' },
    ],
  },
  {
    archivo: 'elevacion-talones-sentado.jpg',
    nombre: 'Elevación de talones sentado',
    descripcion: 'Sentado con las rodillas a noventa grados y un peso sobre los muslos, se elevan los talones. Con la rodilla doblada el gemelo queda corto y trabaja el sóleo.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Sóleo', 'Tríceps Sural', 'Tobillo', 'Banco', 'Disco', 'Tendinopatía aquílea', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Sentado'],
    items_ejecucion: [
      'Las rodillas se mantienen a 90 grados',
      'Los talones suben hasta el tope',
      'El peso no resbala hacia las rodillas',
      'La bajada es controlada',
    ],
    feedbacks: ['Rodillas a 90', 'Sube del todo', 'Baja despacio'],
    variantes: [
      { nombre: 'Con disco', descripcion: 'Apoyado sobre los muslos, cerca de las rodillas.' },
      { nombre: 'Con mancuernas', descripcion: 'Una sobre cada muslo.' },
      { nombre: 'Sin peso', descripcion: 'Punto de partida en un tendón irritado.' },
    ],
  },
  {
    archivo: 'elevacion-talon-escalon.jpg',
    nombre: 'Elevación de talón en escalón',
    descripcion: 'Con la punta del pie en el borde de un escalón y el talón por fuera, se sube y se baja aprovechando todo el rango que da el desnivel.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Tríceps Sural', 'Gastronécmio', 'Tobillo', 'Unilateral', 'Plataforma', 'Tendinopatía aquílea', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación', 'Unipodal'],
    items_ejecucion: [
      'El talón baja por debajo del nivel del escalón',
      'La rodilla se mantiene extendida',
      'El tobillo no se vuelca hacia fuera',
      'Una mano apoyada solo para equilibrar, sin cargar peso en ella',
    ],
    feedbacks: ['Baja el talón del todo', 'Rodilla recta', 'La mano solo equilibra'],
    variantes: [
      { nombre: 'Bilateral', descripcion: 'Los dos pies en el escalón.' },
      { nombre: 'A una pierna', descripcion: 'La versión que de verdad carga el tendón.' },
      { nombre: 'Con peso', descripcion: 'Mochila o mancuerna en la mano libre.' },
    ],
  },
  {
    archivo: 'excentrico-aquiles.jpg',
    nombre: 'Excéntrico de Aquiles',
    descripcion: 'Se sube con las dos piernas y se baja con una sola, muy despacio, dejando el talón caer por debajo del escalón. La bajada es todo el ejercicio.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Tríceps Sural', 'Sóleo', 'Tobillo', 'Unilateral', 'Plataforma', 'Tendinopatía aquílea', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación', 'Unipodal'],
    items_ejecucion: [
      'La bajada dura al menos tres segundos',
      'El talón llega hasta el máximo rango, por debajo del escalón',
      'Se sube con las dos piernas y se baja con una',
      'Molestia leve durante el ejercicio es aceptable; dolor agudo, no',
    ],
    feedbacks: ['Baja contando tres', 'Talón hasta abajo', 'Sube con las dos'],
    variantes: [
      { nombre: 'Rodilla extendida', descripcion: 'Carga la parte alta del tendón y el gemelo.' },
      { nombre: 'Rodilla flexionada', descripcion: 'Carga el sóleo y la parte baja del tendón.' },
      { nombre: 'Con peso', descripcion: 'Cuando el peso corporal ya no supone reto.' },
    ],
  },
  {
    archivo: 'dorsiflexion-banda.jpg',
    nombre: 'Dorsiflexión con banda',
    descripcion: 'Sentado con la pierna extendida y una banda anclada por delante rodeando el antepié, se tira de la punta del pie hacia la espinilla y se vuelve despacio.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Tibial Anterior', 'Tobillo', 'Banda elástica', 'Flexión', 'Esguince de tobillo', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación', 'Bipodal', 'agarre:Prono'],
    items_ejecucion: [
      'El movimiento es solo de tobillo: la rodilla no se dobla',
      'Los dedos no se curvan para ayudar',
      'La vuelta es lenta, sin dejar que la banda tire',
      'Se llega al tope del recorrido en cada repetición',
    ],
    feedbacks: ['Solo el tobillo', 'No curves los dedos', 'Vuelve despacio'],
    variantes: [
      { nombre: 'Sin resistencia', descripcion: 'Solo el movimiento. Primeros días tras un esguince.' },
      { nombre: 'De pie en la pared', descripcion: 'Punta apoyada en la pared, cargando el peso del cuerpo.' },
    ],
  },
  {
    archivo: 'eversion-banda.jpg',
    nombre: 'Eversión con banda',
    descripcion: 'Con la banda anclada hacia el lado interno, se gira el pie hacia fuera contra la resistencia. Es el gesto que protege de volver a torcerse el tobillo.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Peroneos', 'Tobillo', 'Banda elástica', 'Eversión', 'Esguince de tobillo', 'Analítico', 'plano_eje:Frontal (coronal)', 'plano_eje:Sagital (anteroposterior)', 'Bipedestación', 'Bipodal', 'agarre:Prono'],
    items_ejecucion: [
      'La rodilla y la pierna se mantienen quietas: solo gira el pie',
      'La cadera no rota para ayudar',
      'La vuelta es controlada',
      'Se trabaja en todo el rango sin dolor',
    ],
    feedbacks: ['Solo gira el pie', 'La pierna quieta', 'Vuelve despacio'],
    variantes: [
      { nombre: 'Sentado', descripcion: 'Pierna extendida en el suelo o en camilla.' },
      { nombre: 'Isométrica', descripcion: 'Se mantiene la posición contra la banda el tiempo indicado.' },
      { nombre: 'En carga', descripcion: 'De pie, desplazando el peso al borde externo del pie.' },
    ],
  },
  {
    archivo: 'inversion-banda.jpg',
    nombre: 'Inversión con banda',
    descripcion: 'Con la banda anclada hacia el lado externo, se gira el pie hacia dentro contra la resistencia, sin mover la pierna.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Tibial Anterior', 'Tobillo', 'Banda elástica', 'Inversión', 'Esguince de tobillo', 'Analítico', 'plano_eje:Frontal (coronal)', 'plano_eje:Sagital (anteroposterior)', 'Bipedestación', 'Bipodal', 'agarre:Prono'],
    items_ejecucion: [
      'La rodilla y la pierna se mantienen quietas',
      'La cadera no rota para ayudar',
      'El movimiento es solo del tobillo',
      'La vuelta es controlada',
    ],
    feedbacks: ['Solo el tobillo', 'La pierna quieta', 'Vuelve despacio'],
    variantes: [
      { nombre: 'Sentado', descripcion: 'La versión estándar.' },
      { nombre: 'Isométrica', descripcion: 'Se mantiene contra la banda el tiempo indicado.' },
      { nombre: 'Con toalla', descripcion: 'Arrastrando una toalla hacia dentro con el pie.' },
      { nombre: 'De pie', descripcion: 'En carga, girando el pie hacia dentro con el peso encima.', archivo: 'inversion-banda-de-pie.jpg' },
    ],
  },
  {
    archivo: 'equilibrio-bosu.jpg',
    nombre: 'Equilibrio unipodal en bosu',
    descripcion: 'De pie sobre una pierna encima de una superficie inestable, se mantiene el equilibrio el tiempo indicado sin que el tobillo se venza a un lado.',
    tipo_medida: 'tiempo',
    etiquetas: ['Peroneos', 'Tobillo', 'Glúteo medio', 'Unilateral', 'Bosu', 'Esguince de tobillo', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación', 'Unipodal'],
    items_ejecucion: [
      'El tobillo no se vence hacia dentro ni hacia fuera',
      'La rodilla queda algo flexionada, no bloqueada',
      'La cadera se mantiene nivelada, sin caer al lado libre',
      'La mirada al frente, no al suelo',
    ],
    feedbacks: ['Tobillo firme', 'Rodilla algo flexionada', 'Mira al frente'],
    variantes: [
      { nombre: 'En el suelo', descripcion: 'Sin superficie inestable. El punto de partida.' },
      { nombre: 'En bosu', descripcion: 'Sobre la media esfera.' },
      { nombre: 'Con ojos cerrados', descripcion: 'Quita la vista. Mucho más exigente.' },
    ],
  },
  {
    archivo: 'rodillo-plantar.jpg',
    nombre: 'Rodillo plantar',
    descripcion: 'Sentado, se rueda una pelota pequeña bajo el arco del pie, despacio y recorriendo desde el talón hasta la base de los dedos.',
    tipo_medida: 'tiempo',
    etiquetas: ['Pie', 'Tobillo', 'Pelota', 'Fascitis plantar', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación', 'Bipodal'],
    items_ejecucion: [
      'Se recorre todo el arco, del talón a la base de los dedos',
      'La presión es firme pero no dolorosa',
      'El movimiento es lento',
      'El otro pie se mantiene apoyado en el suelo',
    ],
    feedbacks: ['Recorre todo el arco', 'Sin que duela', 'Despacio'],
    variantes: [
      { nombre: 'Sentado', descripcion: 'Poca presión. La versión de entrada.' },
      { nombre: 'De pie', descripcion: 'Cargando parte del peso. Más presión.' },
      { nombre: 'Con pelota fría', descripcion: 'Suma el efecto del frío en un pie irritado.' },
      { nombre: 'En el suelo', descripcion: 'Sentado en el suelo con la pierna flexionada. Llega mejor al talón.', archivo: 'rodillo-plantar-suelo.jpg' },
    ],
  },
  {
    archivo: 'marcha-talones.jpg',
    nombre: 'Marcha',
    descripcion: 'Caminar modificando el apoyo o la trayectoria. Cada variante cambia lo que trabaja: de talones el tibial anterior, de puntas el gemelo, en tándem el equilibrio.',
    tipo_medida: 'tiempo',
    etiquetas: ['Tibial Anterior', 'Tríceps Sural', 'Peroneos', 'Tobillo', 'Marcha', 'Esguince de tobillo', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación', 'Bipodal'],
    items_ejecucion: [
      'El apoyo elegido se mantiene durante todo el recorrido, sin alternarlo',
      'Los pasos son cortos y controlados',
      'El tronco se mantiene erguido, sin echarse atrás',
      'La mirada al frente, no al suelo',
    ],
    feedbacks: ['Mantén el apoyo todo el recorrido', 'Pasos cortos', 'Mira al frente'],
    variantes: [
      { nombre: 'De talones', descripcion: 'Puntas levantadas todo el recorrido. Tibial anterior.' },
      { nombre: 'De puntas', descripcion: 'Talones levantados. Gemelo y sóleo.', archivo: 'marcha-puntas.jpg' },
      { nombre: 'En tándem', descripcion: 'Talón tocando la punta del otro pie, sobre una línea. Equilibrio.', archivo: 'marcha-tandem.jpg' },
      { nombre: 'Lateral', descripcion: 'Pasos de lado, sin cruzar los pies.' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CERVICAL Y TORÁCICA
  //
  // Cervicalgia y cifosis dorsal tampoco tenían ejercicios. Casi todo el bloque es
  // de rango corto y sin material: son los que se mandan a casa a alguien que pasa
  // ocho horas delante de una pantalla.
  //
  // Ninguno se mide en repeticiones grandes ni con carga. Aquí más no es mejor.
  // ─────────────────────────────────────────────────────────────────────────────

  {
    archivo: 'retraccion-cervical.jpg',
    nombre: 'Retracción cervical',
    descripcion: 'Sentado y erguido, se lleva la cabeza hacia atrás en horizontal, haciendo papada, sin inclinarla ni mirar hacia arriba. Se mantiene unos segundos y se suelta.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Cervical', 'Columna', 'Sentado', 'Retracción', 'Cervicalgia', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)'],
    items_ejecucion: [
      'La cabeza se desplaza en horizontal, no se inclina hacia abajo ni hacia arriba',
      'La mirada se mantiene al frente',
      'Los hombros no se encogen',
      'No aparece mareo ni dolor irradiado al brazo',
    ],
    feedbacks: ['Mete la barbilla, no la bajes', 'Mira al frente', 'Hombros abajo'],
    variantes: [
      { nombre: 'Contra la pared', descripcion: 'La nuca busca la pared. Da referencia del recorrido.' },
      { nombre: 'Tumbado', descripcion: 'Boca arriba. Quita el peso de la cabeza.' },
    ],
  },
  {
    archivo: 'isometrico-cervical.jpg',
    nombre: 'Isométrico cervical',
    descripcion: 'Con la mano apoyada en la cabeza, se empuja y el cuello resiste sin moverse. Se mantiene el tiempo indicado en cada dirección.',
    tipo_medida: 'tiempo',
    etiquetas: ['Cervical', 'ECOM', 'Columna', 'Sentado', 'Cervicalgia', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)'],
    items_ejecucion: [
      'La cabeza no se mueve: la fuerza se contrarresta',
      'La presión es suave y sostenida, no un empujón',
      'Los hombros se mantienen bajos y relajados',
      'La respiración no se corta',
    ],
    feedbacks: ['Que no se mueva la cabeza', 'Empuja suave', 'Sigue respirando'],
    variantes: [
      { nombre: 'Frontal', descripcion: 'Mano en la frente. Flexores.' },
      { nombre: 'Lateral', descripcion: 'Mano en la sien. Inclinadores.' },
      { nombre: 'Posterior', descripcion: 'Manos en la nuca. Extensores.' },
    ],
  },
  {
    archivo: 'flexion-profunda-cuello.jpg',
    nombre: 'Flexión profunda de cuello',
    descripcion: 'Tumbado boca arriba, se asiente ligeramente llevando el mentón hacia el pecho sin despegar la nuca del suelo. Es un movimiento mínimo y muy específico.',
    tipo_medida: 'tiempo',
    etiquetas: ['Cervical', 'Columna', 'Supino', 'Flexión', 'Cervicalgia', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)'],
    items_ejecucion: [
      'La nuca no se despega del suelo',
      'El movimiento es de asentir, no de levantar la cabeza',
      'Los músculos del cuello por delante no se marcan como cuerdas',
      'Se mantiene sin aguantar la respiración',
    ],
    feedbacks: ['Asiente, no levantes', 'Nuca en el suelo', 'Sin tensar el cuello'],
    variantes: [
      { nombre: 'Sin resistencia', descripcion: 'Solo el gesto de asentir.' },
      { nombre: 'Con la cabeza elevada', descripcion: 'Despegando un dedo la cabeza. Más exigente.' },
      { nombre: 'Con toalla enrollada', descripcion: 'Bajo la nuca, da referencia y comodidad.' },
    ],
  },
  {
    archivo: 'extension-toracica-roller.jpg',
    nombre: 'Extensión torácica en roller',
    descripcion: 'Tumbado boca arriba con un cilindro cruzado bajo la espalda alta, se arquea la espalda hacia atrás sobre él manteniendo la cadera apoyada.',
    tipo_medida: 'tiempo',
    etiquetas: ['Espalda', 'Columna', 'Supino', 'Extensión', 'Roller', 'Cifosis dorsal', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)'],
    items_ejecucion: [
      'La cadera no se despega del suelo',
      'El arqueo ocurre en la espalda alta, no en la lumbar',
      'Las manos sostienen la cabeza para no forzar el cuello',
      'La respiración acompaña el movimiento',
    ],
    feedbacks: ['Cadera en el suelo', 'Que se abra el pecho, no la lumbar', 'Sujeta la cabeza'],
    variantes: [
      { nombre: 'Estático', descripcion: 'Se mantiene la posición sobre un punto.' },
      { nombre: 'Recorriendo', descripcion: 'Desplazando el cilindro por la espalda alta.' },
      { nombre: 'Con toalla enrollada', descripcion: 'Menos altura, más suave. Punto de partida.' },
    ],
  },
  {
    archivo: 'apertura-en-libro.jpg',
    nombre: 'Apertura en libro',
    descripcion: 'Tumbado de lado con las rodillas flexionadas y juntas y los brazos extendidos al frente, se abre el brazo de arriba hacia atrás girando el tronco, sin que las rodillas se separen.',
    tipo_medida: 'tiempo',
    etiquetas: ['Espalda', 'Columna', 'Decúbito lateral', 'Rotación', 'Cifosis dorsal', 'Analítico', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)'],
    items_ejecucion: [
      'Las rodillas siguen juntas y apoyadas en el suelo',
      'El giro nace del tórax, no de la cadera',
      'La mirada acompaña a la mano que se abre',
      'El movimiento es lento y acompañado de la respiración',
    ],
    feedbacks: ['Rodillas juntas', 'Gira el pecho, no la cadera', 'Mira la mano'],
    variantes: [
      { nombre: 'Rodillas apoyadas', descripcion: 'Sobre el suelo o un cojín. La versión estándar.', archivo: 'apertura-en-libro-rodillas.jpg' },
      { nombre: 'Sobre un rodillo', descripcion: 'Las rodillas sobre el cilindro. Bloquea mejor la cadera.', archivo: 'apertura-en-libro-rodillo.jpg' },
      { nombre: 'Con pausa', descripcion: 'Manteniendo el final del recorrido varias respiraciones.', archivo: 'apertura-en-libro-pausa.jpg' },
    ],
  },
  {
    archivo: 'rotacion-toracica-stick.jpg',
    nombre: 'Rotación torácica con stick',
    descripcion: 'Sentado a horcajadas con un palo apoyado por detrás de los hombros, se gira el tronco a un lado y a otro sin que la cadera se mueva.',
    tipo_medida: 'tiempo',
    etiquetas: ['Espalda', 'Columna', 'Sentado', 'Rotación', 'Stick', 'Banco', 'Cifosis dorsal', 'Analítico', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)', 'agarre:Neutro'],
    items_ejecucion: [
      'La cadera y las piernas se mantienen quietas',
      'El giro sale del tórax, no de los brazos',
      'La espalda se mantiene erguida, sin encorvarse',
      'El movimiento es lento y controlado',
    ],
    feedbacks: ['La cadera quieta', 'Gira el pecho', 'Espalda erguida'],
    variantes: [
      { nombre: 'De rodillas', descripcion: 'Sentado sobre los talones.' },
      { nombre: 'Sin palo', descripcion: 'Manos cruzadas al pecho. Para quien no tiene material.' },
    ],
  },
  {
    archivo: 'elevacion-brazos-pared.jpg',
    nombre: 'Elevación de brazos en pared',
    descripcion: 'De espaldas a la pared con el cuerpo pegado a ella, se suben los brazos por encima de la cabeza sin despegar el dorso de las manos ni la zona lumbar.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Trapecio', 'Serrato Superior', 'Escapular', 'Pared', 'Flexión', 'Cifosis dorsal', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación', 'Bipodal'],
    items_ejecucion: [
      'El dorso de las manos no se despega de la pared',
      'La zona lumbar se mantiene pegada, sin arquearse',
      'Los hombros no se encogen hacia las orejas',
      'Se sube solo hasta donde se pueda sin despegar nada',
    ],
    feedbacks: ['Manos pegadas', 'Lumbar pegada', 'Hombros abajo'],
    variantes: [
      { nombre: 'Tumbado en el suelo', descripcion: 'Boca arriba. Más fácil de controlar.' },
      { nombre: 'Con rodillas flexionadas', descripcion: 'Un paso separado de la pared. Ayuda a no arquear.' },
    ],
  },
  {
    archivo: 'estiramiento-cervical-lateral.jpg',
    nombre: 'Estiramiento cervical lateral',
    descripcion: 'Sentado y erguido, se inclina la cabeza llevando la oreja al hombro y se ayuda con la mano, manteniendo el hombro contrario bajo.',
    tipo_medida: 'tiempo',
    etiquetas: ['Cervical', 'ECOM', 'Escalenos', 'Trapecio', 'Sentado', 'Cervicalgia', 'Analítico', 'plano_eje:Frontal (coronal)', 'plano_eje:Sagital (anteroposterior)'],
    items_ejecucion: [
      'El hombro del lado que se estira se mantiene bajo, no sube',
      'La cabeza se inclina, no gira',
      'La mano acompaña, no tira con fuerza',
      'No aparece hormigueo ni dolor irradiado al brazo',
    ],
    feedbacks: ['Hombro abajo', 'Inclina, no gires', 'La mano solo acompaña'],
    variantes: [
      { nombre: 'Con rotación', descripcion: 'Mirando a la axila contraria. Elevador de la escápula.' },
      { nombre: 'Sujetando la silla', descripcion: 'La mano del lado estirado agarra el asiento y ancla el hombro.' },
    ],
  },
  {
    archivo: 'retraccion-escapular-banda.jpg',
    nombre: 'Retracción escapular con banda',
    descripcion: 'De pie con una banda sujeta con las dos manos y los brazos extendidos al frente, se separan las manos abriendo hacia los lados y juntando las escápulas.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Romboides Mayor', 'Trapecio', 'Escapular', 'Banda elástica', 'Retracción', 'Cifosis dorsal', 'Analítico', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)', 'Bipedestación', 'Bipodal', 'agarre:Prono'],
    items_ejecucion: [
      'Las escápulas se juntan: el movimiento no sale de los brazos',
      'Los brazos se mantienen a la altura del pecho',
      'Los hombros no se encogen hacia las orejas',
      'El tronco no se echa hacia atrás',
    ],
    feedbacks: ['Junta las escápulas', 'Hombros abajo', 'El tronco quieto'],
    variantes: [
      { nombre: 'Brazos extendidos', descripcion: 'La versión estándar.' },
      { nombre: 'Codos a 90 grados', descripcion: 'Suma rotación externa de hombro.' },
      { nombre: 'Por encima de la cabeza', descripcion: 'Brazos arriba. Trapecio inferior.' },
    ],
  },
  {
    archivo: 'descompresion-cuadrupedia.jpg',
    nombre: 'Descompresión en cuadrupedia',
    descripcion: 'Desde cuatro patas, se sienta la cadera sobre los talones y se estiran los brazos al frente en el suelo, dejando caer el pecho. Se mantiene respirando.',
    tipo_medida: 'tiempo',
    etiquetas: ['Espalda', 'Dorsal Ancho', 'Columna', 'Cuadrupedia', 'Lumbalgia', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'apoyo:Rodilla'],
    items_ejecucion: [
      'La cadera se sienta sobre los talones',
      'Los brazos quedan extendidos y las manos en el suelo',
      'La cabeza queda entre los brazos, el cuello relajado',
      'La respiración es lenta y llega a la espalda',
    ],
    feedbacks: ['Siéntate en los talones', 'Estira los brazos', 'Respira a la espalda'],
    variantes: [
      { nombre: 'Simétrico', descripcion: 'Brazos rectos al frente.' },
      { nombre: 'En diagonal', descripcion: 'Brazos hacia un lado. Estira más el costado.' },
      { nombre: 'Con manos elevadas', descripcion: 'Sobre un banco. Para quien no llega al suelo.' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CADERA Y ADUCTORES
  //
  // Cierra trocantéritis, ciático y prótesis de cadera. Se solapa a propósito con el
  // bloque de glúteo: allí el trabajo es de FUERZA de extensión, y aquí de rotación,
  // aductores y movilidad, que es lo que falta cuando una cadera duele al andar.
  // ─────────────────────────────────────────────────────────────────────────────

  {
    archivo: 'aduccion-isometrica.jpg',
    nombre: 'Aducción isométrica con pelota',
    descripcion: 'Tumbado boca arriba con las rodillas flexionadas, se aprieta una pelota entre las rodillas y se mantiene la presión el tiempo indicado.',
    tipo_medida: 'tiempo',
    etiquetas: ['Aductores', 'Cadera', 'Supino', 'Pelota', 'Adducción', 'Analítico', 'plano_eje:Frontal (coronal)', 'plano_eje:Sagital (anteroposterior)'],
    items_ejecucion: [
      'La presión es sostenida, sin apretones intermitentes',
      'La zona lumbar no se despega del suelo',
      'El glúteo no se aprieta para ayudar',
      'La respiración no se corta',
    ],
    feedbacks: ['Aprieta sostenido', 'Lumbar en el suelo', 'Sigue respirando'],
    variantes: [
      { nombre: 'Piernas extendidas', descripcion: 'Pelota entre los tobillos. Más exigente.', archivo: 'aduccion-isometrica-extendidas.jpg' },
      { nombre: 'Con puente', descripcion: 'Apretando la pelota con la cadera elevada.', archivo: 'aduccion-isometrica-puente.jpg' },
    ],
  },
  {
    archivo: 'copenhagen.jpg',
    nombre: 'Copenhagen',
    descripcion: 'Plancha lateral con la pierna de arriba apoyada en un banco por la cara interna del tobillo. La pierna de abajo se eleva del suelo y aguanta el aductor.',
    tipo_medida: 'tiempo',
    etiquetas: ['Aductores', 'Abdomen', 'Cadera', 'Unilateral', 'Banco', 'Antiflexión', 'Global', 'plano_eje:Frontal (coronal)', 'plano_eje:Sagital (anteroposterior)', 'Decúbito lateral', 'Codos'],
    items_ejecucion: [
      'La cadera se mantiene elevada, en línea con hombro y rodilla',
      'La pierna de abajo queda en el aire, sin tocar el suelo',
      'El codo queda bajo el hombro',
      'No aparece tirón agudo en la ingle',
    ],
    feedbacks: ['Cadera arriba', 'La pierna de abajo en el aire', 'Codo bajo el hombro'],
    variantes: [
      { nombre: 'Con rodilla apoyada', descripcion: 'La pierna de arriba apoyada por la rodilla. Versión corta y accesible.' },
      { nombre: 'Con tobillo apoyado', descripcion: 'Palanca completa. Muy exigente.' },
      { nombre: 'Con apoyo de la mano', descripcion: 'La mano libre en el suelo, descargando parte del peso.' },
    ],
  },
  {
    archivo: 'abduccion-pie-banda.jpg',
    nombre: 'Abducción de cadera de pie',
    descripcion: 'De pie con una banda en los tobillos y una mano apoyada, se separa una pierna hacia el lado manteniéndola recta y sin inclinar el tronco.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Glúteo medio', 'Abductor - TFL', 'Cadera', 'Unilateral', 'Mini band', 'Abducción', 'Trocantéritis', 'Analítico', 'plano_eje:Frontal (coronal)', 'plano_eje:Sagital (anteroposterior)', 'Bipedestación', 'Bipodal'],
    items_ejecucion: [
      'El tronco se mantiene vertical, sin inclinarse al lado contrario',
      'La pierna se separa de lado, no hacia atrás',
      'La cadera no rota: la punta del pie sigue mirando al frente',
      'La vuelta es controlada',
    ],
    feedbacks: ['No te inclines', 'De lado, no atrás', 'Punta al frente'],
    variantes: [
      { nombre: 'Con banda sobre la rodilla', descripcion: 'Menos palanca. Punto de partida.', archivo: 'abduccion-pie-banda-rodilla.jpg' },
      { nombre: 'Sin banda', descripcion: 'Solo el movimiento, con control.', archivo: 'abduccion-pie-sin-banda.jpg' },
    ],
  },
  {
    archivo: 'rotacion-externa-cadera.jpg',
    nombre: 'Rotación externa de cadera',
    descripcion: 'Sentado con una banda rodeando las dos rodillas, se separan abriendo hacia fuera contra la resistencia y se vuelve despacio.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Glúteo', 'Glúteo medio', 'Cadera', 'Sentado', 'Mini band', 'Rotación', 'Trocantéritis', 'Analítico', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)'],
    items_ejecucion: [
      'Los pies se mantienen apoyados y quietos',
      'La espalda se queda erguida, sin echarse atrás',
      'Las rodillas abren a la vez, sin que una vaya más',
      'La vuelta es lenta, sin dejar que la banda cierre',
    ],
    feedbacks: ['Pies quietos', 'Espalda erguida', 'Las dos por igual'],
    variantes: [
      { nombre: 'Tumbado', descripcion: 'Boca arriba con los pies apoyados. Es la almeja invertida.' },
      { nombre: 'Isométrica', descripcion: 'Manteniendo la apertura el tiempo indicado.' },
    ],
  },
  {
    archivo: 'elevacion-rodilla-banda.jpg',
    nombre: 'Elevación de rodilla con banda',
    descripcion: 'De pie con una banda anclada por detrás y rodeando el muslo, se eleva la rodilla hasta la altura de la cadera contra la resistencia y se baja controlando.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Psoas', 'Cadera', 'Abdomen', 'Unilateral', 'Banda elástica', 'Flexión de cadera', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación', 'Bipodal'],
    items_ejecucion: [
      'La rodilla llega a la altura de la cadera',
      'La zona lumbar no se arquea ni el tronco se echa atrás',
      'La pierna de apoyo se mantiene estable, con la rodilla algo flexionada',
      'La bajada es controlada',
    ],
    feedbacks: ['Rodilla a la cadera', 'No arquees la espalda', 'Baja despacio'],
    variantes: [
      { nombre: 'Sentado', descripcion: 'Quita el equilibrio de la ecuación.' },
      { nombre: 'Tumbado', descripcion: 'Boca arriba, con la banda anclada a los pies.' },
    ],
  },
  {
    archivo: 'estiramiento-piramidal.jpg',
    nombre: 'Estiramiento del piramidal',
    descripcion: 'Tumbado boca arriba con un tobillo cruzado sobre la rodilla contraria, se tira del muslo de abajo hacia el pecho hasta notar tensión en el glúteo.',
    tipo_medida: 'tiempo',
    etiquetas: ['Glúteo - Piramidal', 'Glúteo', 'Cadera', 'Supino', 'Ciático', 'Analítico', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)'],
    items_ejecucion: [
      'La cabeza y los hombros se mantienen apoyados en el suelo',
      'La tensión se nota en el glúteo, no en la rodilla',
      'La zona lumbar no se despega del suelo',
      'No aparece hormigueo ni corriente por la pierna',
    ],
    feedbacks: ['Cabeza en el suelo', 'Tiene que tirar en el glúteo', 'Para si hay corriente'],
    variantes: [
      { nombre: 'Sentado', descripcion: 'En una silla, cruzando el tobillo e inclinando el tronco.' },
      { nombre: 'Contra la pared', descripcion: 'Pies en la pared. Menos exigencia de cadera.' },
    ],
  },
  {
    archivo: 'sentadilla-profunda-sostenida.jpg',
    nombre: 'Sentadilla profunda sostenida',
    descripcion: 'Se baja a una sentadilla muy profunda con los pies planos y se mantiene, empujando las rodillas hacia fuera con los codos. Es movilidad de cadera y tobillo, no fuerza.',
    tipo_medida: 'tiempo',
    etiquetas: ['Aductores', 'Cadera', 'Tobillo', 'Erectores Espinales', 'Sentadilla', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación', 'Bipodal'],
    items_ejecucion: [
      'Los pies quedan planos, con los talones apoyados',
      'La espalda se mantiene lo más erguida posible',
      'Los codos empujan las rodillas hacia fuera',
      'La respiración es tranquila durante toda la posición',
    ],
    feedbacks: ['Talones al suelo', 'Pecho arriba', 'Abre las rodillas'],
    variantes: [
      { nombre: 'Con talones en cuña', descripcion: 'Para quien no llega con los talones apoyados.' },
      { nombre: 'Sujeto a un anclaje', descripcion: 'Agarrado a algo fijo delante, descargando peso.' },
    ],
  },
  {
    archivo: 'rotacion-interna-cuadrupedia.jpg',
    nombre: 'Rotación interna en cuadrupedia',
    descripcion: 'A cuatro patas, se lleva el talón de un lado hacia fuera girando la cadera hacia dentro, sin que la pelvis bascule. Es el rango que más se pierde en una cadera artrósica.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Glúteo', 'Cadera', 'Cuadrupedia', 'Rotación', 'Artrosis', 'Analítico', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)', 'apoyo:Rodilla'],
    items_ejecucion: [
      'La pelvis se mantiene cuadrada, sin bascular a un lado',
      'La rodilla no se despega del suelo',
      'El movimiento nace en la cadera, no en la rodilla',
      'Se llega solo hasta donde no haya pinzamiento en la ingle',
    ],
    feedbacks: ['Pelvis cuadrada', 'La rodilla quieta', 'Para si pincha delante'],
    variantes: [
      { nombre: 'Sentado', descripcion: 'En una silla, llevando el pie hacia fuera.' },
      { nombre: 'Con banda', descripcion: 'Resistencia añadida en el tobillo.' },
    ],
  },
  {
    archivo: 'zancada-con-rotacion.jpg',
    nombre: 'Zancada con rotación',
    descripcion: 'Desde una zancada profunda con la rodilla de atrás en el suelo, se gira el tronco hacia la pierna adelantada. Estira el psoas de un lado y moviliza el tórax.',
    tipo_medida: 'tiempo',
    etiquetas: ['Psoas', 'Cadera', 'Columna', 'Unilateral', 'Zancada', 'Rotación', 'Combinado', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)', 'Bipedestación', 'Unipodal'],
    items_ejecucion: [
      'La cadera se lleva adelante para que estire el psoas de atrás',
      'La zona lumbar no se arquea',
      'El giro nace del tórax, no de la cadera',
      'La rodilla de atrás queda apoyada y cómoda',
    ],
    feedbacks: ['Lleva la cadera adelante', 'No arquees la lumbar', 'Gira el pecho'],
    variantes: [
      { nombre: 'Con mano en el suelo', descripcion: 'Una mano apoyada dentro. La versión estándar.' },
      { nombre: 'Brazos al frente', descripcion: 'Sin apoyo. Suma equilibrio.' },
      { nombre: 'Con stick', descripcion: 'Palo en los hombros, para ver mejor la rotación.' },
    ],
  },
  {
    archivo: 'puente-banda-rodillas.jpg',
    nombre: 'Puente con banda en rodillas',
    descripcion: 'Puente de glúteo con una banda rodeando las rodillas, empujándolas hacia fuera durante todo el recorrido. Suma glúteo medio al trabajo de extensión.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Glúteo', 'Glúteo medio', 'Cadera', 'Mini band', 'Bisagra de cadera', 'Trocantéritis', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'posicion:Supino'],
    items_ejecucion: [
      'Las rodillas empujan hacia fuera durante todo el recorrido',
      'Arriba, hombro, cadera y rodilla quedan alineados',
      'La zona lumbar no se arquea al llegar arriba',
      'El empuje sale del talón',
    ],
    feedbacks: ['Abre las rodillas', 'Aprieta el glúteo arriba', 'No arquees la lumbar'],
    variantes: [
      { nombre: 'Estático', descripcion: 'Manteniendo la cadera arriba con la banda tensa.' },
      { nombre: 'Con aperturas', descripcion: 'Abriendo y cerrando las rodillas en la posición alta.' },
      { nombre: 'A una pierna', descripcion: 'Un pie apoyado. Mucha más exigencia de glúteo medio.' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CODO, ANTEBRAZO Y MUÑECA
  //
  // Cierra la EPICONDILITIS, la última patología frecuente del catálogo que no tenía
  // ningún ejercicio. Todo el bloque trabaja entre el codo y la mano.
  // ─────────────────────────────────────────────────────────────────────────────

  {
    archivo: 'extension-muneca.jpg',
    nombre: 'Extensión de muñeca',
    descripcion: 'Sentado con el antebrazo apoyado en el muslo y la mano por fuera de la rodilla, palma hacia abajo, se levanta la muñeca contra el peso y se baja despacio.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Extensor de muñecas', 'Muñeca', 'Codo', 'Mancuerna', 'Extensión', 'Epicondilitis', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Sentado'],
    items_ejecucion: [
      'El antebrazo no se despega del muslo: solo se mueve la muñeca',
      'El peso es pequeño; lo que importa es el control, no la carga',
      'La bajada es más lenta que la subida',
      'Molestia leve es aceptable; dolor agudo, no',
    ],
    feedbacks: ['El antebrazo quieto', 'Poco peso', 'Baja despacio'],
    variantes: [
      { nombre: 'Concéntrico y excéntrico', descripcion: 'Sube y baja con el mismo brazo.' },
      { nombre: 'Solo excéntrico', descripcion: 'Sube con la otra mano y baja despacio con la que trabaja. Lo primero en una epicondilitis.' },
      { nombre: 'Isométrica', descripcion: 'Se mantiene la muñeca arriba el tiempo indicado.' },
    ],
  },
  {
    archivo: 'flexion-muneca.jpg',
    nombre: 'Flexión de muñeca',
    descripcion: 'Igual que la extensión pero con la palma hacia arriba: la muñeca sube llevando la palma hacia el antebrazo. Trabaja los flexores, del lado interno del codo.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Flexor de muñeca', 'Muñeca', 'Codo', 'Mancuerna', 'Flexión', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Sentado', 'agarre:Supino'],
    items_ejecucion: [
      'El antebrazo no se despega del muslo',
      'El recorrido es completo, hasta el tope cómodo',
      'La bajada es controlada',
      'No aparece dolor en la cara interna del codo',
    ],
    feedbacks: ['El antebrazo quieto', 'Recorrido completo', 'Baja despacio'],
    variantes: [
      { nombre: 'Concéntrico y excéntrico', descripcion: 'Sube y baja con el mismo brazo.' },
      { nombre: 'Solo excéntrico', descripcion: 'Ayudándose con la otra mano para subir.' },
      { nombre: 'Isométrica', descripcion: 'Manteniendo la posición el tiempo indicado.' },
    ],
  },
  {
    archivo: 'excentrico-extensores.jpg',
    nombre: 'Excéntrico de extensores',
    descripcion: 'De pie con una barra corta sujeta en vertical por un extremo, se deja caer la muñeca despacio contra el peso. Es el trabajo con más evidencia en epicondilitis.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Extensor de muñecas', 'Braquioradial', 'Muñeca', 'Codo', 'Barra corta', 'Extensión', 'Epicondilitis', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación', 'Bipodal'],
    items_ejecucion: [
      'La bajada dura al menos tres segundos',
      'La vuelta arriba se hace con la otra mano',
      'El codo se mantiene extendido y quieto',
      'Molestia tolerable durante el ejercicio, sin dolor que persista después',
    ],
    feedbacks: ['Baja contando tres', 'Sube con la otra mano', 'El codo quieto'],
    variantes: [
      { nombre: 'Con mancuerna ligera', descripcion: 'Cuando no hay barra a mano.' },
      { nombre: 'Con banda', descripcion: 'Pisada, resistiendo la vuelta.' },
    ],
  },
  {
    archivo: 'supinacion-pronacion.jpg',
    nombre: 'Supinación y pronación',
    descripcion: 'Con el codo pegado al costado y flexionado a noventa grados, se gira el antebrazo hasta poner la palma arriba y luego abajo, sujetando un peso descompensado.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Braquioradial', 'Muñeca', 'Codo', 'Mancuerna', 'Supinación', 'Pronación', 'Epicondilitis', 'Analítico', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)', 'Sentado', 'agarre:Giratorio'],
    items_ejecucion: [
      'El codo se mantiene pegado al costado y a 90 grados',
      'El hombro no rota para acompañar al antebrazo',
      'El giro llega al tope cómodo en las dos direcciones',
      'El movimiento es lento en los dos sentidos',
    ],
    feedbacks: ['Codo pegado', 'El hombro quieto', 'Gira despacio'],
    variantes: [
      { nombre: 'Con martillo', descripcion: 'Sujeto por el mango. La palanca crece cuanto más lejos se agarre.' },
      { nombre: 'Con mancuerna por un extremo', descripcion: 'Mismo efecto que el martillo.' },
      { nombre: 'Sin peso', descripcion: 'Solo el movimiento. Punto de partida cuando duele.' },
    ],
  },
  {
    archivo: 'agarre-goma.jpg',
    nombre: 'Agarre y apertura con goma',
    descripcion: 'Con una goma rodeando los cinco dedos, se abre la mano contra ella y se cierra despacio. Trabaja los extensores de dedos, que suelen olvidarse frente al agarre.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Extensor de Dedos', 'Flexor de Dedos', 'Mano', 'Muñeca', 'Goma', 'Epicondilitis', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Sentado', 'agarre:Abierto'],
    items_ejecucion: [
      'Los cinco dedos se abren a la vez, incluido el pulgar',
      'El antebrazo queda apoyado y quieto',
      'El cierre es lento, sin dejar que la goma tire',
      'La muñeca se mantiene neutra, ni doblada ni extendida',
    ],
    feedbacks: ['Abre los cinco dedos', 'El antebrazo apoyado', 'Cierra despacio'],
    variantes: [
      { nombre: 'Cierre con pelota', descripcion: 'Apretando una pelota blanda. Trabaja los flexores.', archivo: 'agarre-goma-pelota.jpg' },
      { nombre: 'Alternando', descripcion: 'Una serie de cada. Equilibra las dos caras del antebrazo.', archivo: 'agarre-goma-alternando.jpg' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // EQUILIBRIO, RESPIRACIÓN Y SUELO PÉLVICO
  //
  // Cierra osteoporosis y suelo pélvico. Ninguno lleva material salvo una silla, así
  // que es el bloque que más se va a mandar a casa de toda la biblioteca.
  //
  // La marcha en tándem NO está aquí: es una variante de "Marcha", que reúne todas
  // las formas de caminar en un solo ejercicio.
  // ─────────────────────────────────────────────────────────────────────────────

  {
    archivo: 'sentarse-levantarse.jpg',
    nombre: 'Sentarse y levantarse de la silla',
    descripcion: 'Desde sentado, se levanta sin apoyar las manos y se vuelve a sentar controlando el descenso. Es el gesto que decide si alguien es autónomo en su casa.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Cuádriceps', 'Glúteo', 'Cadera', 'Rodilla', 'Sentado', 'Sentadilla', 'Artrosis', 'Osteoporosis', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)'],
    items_ejecucion: [
      'Se sube sin apoyar las manos en los muslos ni en la silla',
      'La bajada es controlada: no se deja caer en el asiento',
      'Las rodillas siguen la dirección de los pies',
      'Los pies quedan planos y apoyados todo el rato',
    ],
    feedbacks: ['Sin manos', 'Baja despacio, no te dejes caer', 'Rodillas hacia fuera'],
    variantes: [
      { nombre: 'Con apoyo de manos', descripcion: 'Empujando en los muslos. Punto de partida.' },
      { nombre: 'Sin manos', descripcion: 'Brazos cruzados al pecho. La versión de referencia.' },
      { nombre: 'A una pierna', descripcion: 'Con la otra extendida al frente. Muy exigente.' },
      { nombre: 'Con asiento más bajo', descripcion: 'Aumenta el rango y la dificultad.' },
    ],
  },
  {
    archivo: 'saltos-suaves.jpg',
    nombre: 'Saltos suaves en el sitio',
    descripcion: 'Pequeños saltos en el sitio con aterrizaje amortiguado. El impacto controlado es lo único que estimula al hueso; sin él, la fuerza sola no basta en osteoporosis.',
    tipo_medida: 'peso_reps',
    etiquetas: ['Tríceps Sural', 'Cuádriceps', 'Tobillo', 'Salto', 'Osteoporosis', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipedestación', 'Bipodal'],
    items_ejecucion: [
      'El aterrizaje es silencioso, amortiguando con tobillo y rodilla',
      'Los dos pies caen a la vez',
      'Las rodillas no caen hacia dentro al aterrizar',
      'No aparece dolor en la espalda al aterrizar',
    ],
    feedbacks: ['Cae en silencio', 'Amortigua', 'Rodillas hacia fuera'],
    variantes: [
      { nombre: 'Talones al suelo', descripcion: 'Solo elevar y dejar caer los talones. Sin fase de vuelo.' },
      { nombre: 'Saltos pequeños', descripcion: 'Los dos pies, poca altura.' },
      { nombre: 'A una pierna', descripcion: 'Más impacto en la cadera. Solo con buen control.' },
    ],
  },
  {
    archivo: 'respiracion-diafragmatica.jpg',
    nombre: 'Respiración diafragmática',
    descripcion: 'Tumbado boca arriba con una mano en el pecho y otra en el abdomen, se respira llevando el aire abajo: se mueve la mano del abdomen y la del pecho se queda quieta.',
    tipo_medida: 'tiempo',
    etiquetas: ['Diafragma', 'Abdomen', 'Costal', 'Supino', 'Suelo pélvico', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)'],
    items_ejecucion: [
      'La mano del abdomen sube y la del pecho se queda quieta',
      'La espiración es más larga que la inspiración',
      'Los hombros no se elevan al coger aire',
      'El ritmo es tranquilo, sin forzar',
    ],
    feedbacks: ['Que suba la mano de abajo', 'Suelta el aire despacio', 'Hombros quietos'],
    variantes: [
      { nombre: 'Sentado', descripcion: 'Espalda apoyada. El siguiente paso.' },
      { nombre: 'De pie', descripcion: 'Lo que hay que trasladar a la vida diaria.' },
    ],
  },
  {
    archivo: 'activacion-transverso.jpg',
    nombre: 'Activación abdominal profunda',
    descripcion: 'Tumbado boca arriba, se activa la capa profunda del abdomen metiendo suavemente el ombligo, acompañando la espiración. Es tensión ligera y sostenida, no un apretón.',
    tipo_medida: 'tiempo',
    etiquetas: ['Transverso', 'Abdomen', 'Diafragma', 'Supino', 'Suelo pélvico', 'Lumbalgia', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)'],
    items_ejecucion: [
      'La activación es suave: se puede seguir hablando',
      'La zona lumbar no se aplasta contra el suelo ni se arquea',
      'El glúteo y los muslos se mantienen relajados',
      'La respiración sigue, no se aguanta el aire',
    ],
    feedbacks: ['Suave, no aprietes', 'La lumbar en su sitio', 'Sigue respirando'],
    variantes: [
      { nombre: 'A cuatro patas', descripcion: 'Con la gravedad en contra.', archivo: 'activacion-transverso-cuadrupedia.jpg' },
      { nombre: 'Con movimiento de pierna', descripcion: 'Manteniendo la activación mientras se mueve una pierna.', archivo: 'activacion-transverso-pierna.jpg' },
    ],
  },

  // ── Tras un ictus ─────────────────────────────────────────────────────────
  //
  // Los 113 anteriores dan por hecho a alguien que ya se pone de pie y que puede repetir
  // el gesto que se le enseña. Tras un ictus eso no se puede dar por hecho: el trabajo
  // empieza en la camilla, se mide en si consigue hacerlo y no en cuánto peso mueve, y la
  // mitad de lo que hay que entrenar —voltearse, sentarse, trasladar el peso a la pierna
  // afecta— no aparecía en la biblioteca porque nadie sano necesita entrenarlo.
  //
  // Casi todos van en TIEMPO aunque se cuenten repeticiones: lo que se busca no es una
  // serie de diez, es que el gesto salga y se repita mientras salga bien. En cuanto
  // aparece la compensación, se para.

  {
    archivo: 'volteo-en-camilla.jpg',
    nombre: 'Volteo en la camilla',
    descripcion: 'Tumbado boca arriba, se gira hasta quedar de lado. El brazo afecto se lleva con la otra mano, entrelazando los dedos, y la rodilla del lado afecto se flexiona antes de empezar. Se hace hacia los dos lados: girar hacia el lado sano cuesta más porque hay que empujar con la mitad que no responde.',
    tipo_medida: 'tiempo',
    etiquetas: ['Abdomen', 'Oblicuos', 'Columna', 'Supino', 'Decúbito lateral', 'Rotación', 'Ictus', 'Hemiparesia', 'Global', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)'],
    items_ejecucion: [
      'Los dedos van entrelazados: el brazo afecto nunca se queda atrás ni se tira de él',
      'La cabeza inicia el giro y la mirada acompaña',
      'La rodilla flexionada del lado que gira da el impulso',
      'Se llega hasta el lado, sin quedarse a medias',
    ],
    feedbacks: ['Mira hacia donde vas', 'Lleva el brazo con la otra mano', 'Empuja con el pie'],
    variantes: [
      { nombre: 'Hacia el lado sano', descripcion: 'El difícil: hay que empujar con el lado afecto.' },
      { nombre: 'Hacia el lado afecto', descripcion: 'El fácil, y el que se usa para salir de la cama.' },
      { nombre: 'Con ayuda en la pelvis', descripcion: 'El entrenador acompaña la cadera. Se retira en cuanto salga solo.' },
    ],
  },
  {
    archivo: 'incorporarse-a-sentado.jpg',
    nombre: 'Incorporarse a sentado',
    descripcion: 'Desde tumbado, se voltea de lado, se dejan caer las piernas fuera de la camilla y se empuja con el codo y después con la mano de abajo hasta quedar sentado. Es una secuencia, no un abdominal: no se sube de frente.',
    tipo_medida: 'tiempo',
    etiquetas: ['Abdomen', 'Oblicuos', 'Tríceps', 'Columna', 'Decúbito lateral', 'Sentado', 'Ictus', 'Hemiparesia', 'Global', 'plano_eje:Transversal (axial)', 'plano_eje:Longitudinal (vertical)'],
    items_ejecucion: [
      'Primero de lado, después las piernas fuera, y solo entonces empujar',
      'Las piernas bajando hacen de contrapeso: no se quedan en la camilla',
      'Se empuja con el codo antes que con la mano',
      'Al llegar arriba se para y se comprueba que no hay mareo',
    ],
    feedbacks: ['De lado primero', 'Deja caer las piernas', 'Empuja con el codo'],
    variantes: [
      { nombre: 'Por el lado sano', descripcion: 'Empuja el brazo bueno. Es como saldrá de la cama en casa.' },
      { nombre: 'Por el lado afecto', descripcion: 'Carga el lado afecto. Solo cuando el hombro lo tolere.' },
      { nombre: 'Con barandilla', descripcion: 'Tirando de un asidero. Puente hacia el gesto completo.' },
    ],
  },
  {
    archivo: 'sedestacion-al-borde.jpg',
    nombre: 'Sedestación al borde de la camilla',
    descripcion: 'Sentado en el borde, con los dos pies apoyados en el suelo y sin respaldo. Se mantiene la posición erguida, con el peso repartido en los dos glúteos. Es el primer ejercicio que se puede hacer y la base de todos los demás.',
    tipo_medida: 'tiempo',
    etiquetas: ['Abdomen', 'Erectores Espinales', 'Multífidos', 'Columna', 'Sentado', 'Antiflexión', 'Ictus', 'Hemiparesia', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)'],
    items_ejecucion: [
      'Los dos pies planos en el suelo, a la anchura de la cadera',
      'El peso repartido: no se escora al lado sano',
      'El tronco erguido sin agarrarse con las manos',
      'La cabeza en el centro, no inclinada',
    ],
    feedbacks: ['Peso en los dos lados', 'Crece hacia arriba', 'Suelta las manos'],
    variantes: [
      { nombre: 'Con apoyo de manos', descripcion: 'Manos en la camilla. El punto de partida.' },
      { nombre: 'Sin apoyo', descripcion: 'Brazos en el regazo.' },
      { nombre: 'Con los ojos cerrados', descripcion: 'Quita la vista y obliga a usar la sensibilidad.' },
      { nombre: 'Sobre superficie inestable', descripcion: 'Cojín o disco bajo el glúteo.' },
    ],
  },
  {
    archivo: 'alcance-funcional-sentado.jpg',
    nombre: 'Alcance funcional sentado',
    descripcion: 'Sentado al borde, se estira el brazo para alcanzar un objeto que está fuera de la base de apoyo: delante, al lado y cruzando hacia el otro lado. Se trata de salir de la vertical y volver sin apoyarse.',
    tipo_medida: 'tiempo',
    etiquetas: ['Abdomen', 'Oblicuos', 'Deltoides', 'Columna', 'Hombro', 'Sentado', 'Alcance', 'Ictus', 'Hemiparesia', 'Combinado', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)'],
    items_ejecucion: [
      'Los pies no se despegan del suelo',
      'Se vuelve al centro con control, sin dejarse caer',
      'El glúteo del lado contrario no se levanta',
      'Se alcanza de verdad el objeto, no se hace el gesto en el aire',
    ],
    feedbacks: ['Pies quietos', 'Vuelve despacio', 'Toca el objeto'],
    variantes: [
      { nombre: 'Hacia delante', descripcion: 'El más seguro. Por aquí se empieza.' },
      { nombre: 'Hacia el lado afecto', descripcion: 'Carga el lado que no responde.' },
      { nombre: 'Cruzando la línea media', descripcion: 'Lo que más cuesta si hay negligencia.' },
      { nombre: 'Recogiendo del suelo', descripcion: 'El objeto en el suelo. Gesto de casa.' },
    ],
  },
  {
    archivo: 'traslado-de-peso-de-pie.jpg',
    nombre: 'Traslado de peso en bipedestación',
    descripcion: 'De pie con apoyo delante, se pasa el peso de una pierna a la otra sin levantar los pies. Es el paso previo a dar un paso: no se puede avanzar una pierna si la otra no aguanta todo el cuerpo.',
    tipo_medida: 'tiempo',
    etiquetas: ['Glúteo medio', 'Cuádriceps', 'Cadera', 'Tobillo', 'Bipedestación', 'Bipodal', 'Ictus', 'Hemiparesia', 'Riesgo de caída', 'Global', 'plano_eje:Frontal (coronal)', 'plano_eje:Sagital (anteroposterior)'],
    items_ejecucion: [
      'El peso llega de verdad al lado afecto: se nota el pie apretando el suelo',
      'La cadera no se rompe hacia el lado, el tronco se mantiene vertical',
      'Los pies no se mueven del sitio',
      'Se aguanta unos segundos en cada lado, no es un balanceo',
    ],
    feedbacks: ['Pasa el peso a esa pierna', 'Tronco recto', 'Aguanta ahí'],
    variantes: [
      { nombre: 'Con las dos manos apoyadas', descripcion: 'En la barra o el respaldo. El inicio.' },
      { nombre: 'Con una mano', descripcion: 'Menos ayuda.' },
      { nombre: 'Sin apoyo', descripcion: 'Manos libres, entrenador al lado afecto.' },
      { nombre: 'En una báscula', descripcion: 'Un pie en cada báscula. El número dice lo que la vista no.' },
    ],
  },
  {
    archivo: 'levantarse-con-apoyo.jpg',
    nombre: 'Levantarse y sentarse con apoyo',
    descripcion: 'De sentado a de pie, con las manos apoyadas en un asidero delante o en los reposabrazos. Se adelantan los pies, se lleva la nariz por delante de las rodillas y se sube. Bajar controlado cuenta tanto como subir.',
    tipo_medida: 'tiempo',
    etiquetas: ['Cuádriceps', 'Glúteo mayor', 'Cadera', 'Rodilla', 'Sentado', 'Bipedestación', 'Sentadilla', 'Cadena cerrada', 'Ictus', 'Hemiparesia', 'Riesgo de caída', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)'],
    items_ejecucion: [
      'Los pies atrasados y el pie afecto en línea con el otro, no adelantado',
      'El tronco se inclina adelante antes de subir: la nariz pasa las rodillas',
      'El peso se reparte en las dos piernas al subir',
      'Se baja despacio hasta sentarse, sin dejarse caer',
    ],
    feedbacks: ['Nariz por delante de las rodillas', 'Empuja con las dos piernas', 'Siéntate despacio'],
    variantes: [
      { nombre: 'Desde silla alta', descripcion: 'Menos recorrido. Se va bajando la altura.' },
      { nombre: 'Con una sola mano', descripcion: 'Retirando la ayuda.' },
      { nombre: 'Con los brazos cruzados', descripcion: 'Sin manos. Es ya el test de sentarse-levantarse.' },
      { nombre: 'Hacia un lado', descripcion: 'Levantarse y girar. Es lo que se hace en casa de verdad.' },
    ],
  },
  {
    archivo: 'paso-lateral-con-apoyo.jpg',
    nombre: 'Paso lateral con apoyo',
    descripcion: 'De pie frente a la barra, se dan pasos hacia un lado y hacia el otro, apoyando las manos. Es el gesto de moverse por la cocina agarrado a la encimera.',
    tipo_medida: 'tiempo',
    etiquetas: ['Glúteo medio', 'Aductores', 'Cadera', 'Bipedestación', 'Abducción', 'Ictus', 'Hemiparesia', 'Riesgo de caída', 'Global', 'plano_eje:Frontal (coronal)', 'plano_eje:Sagital (anteroposterior)', 'Bipodal'],
    items_ejecucion: [
      'El pie sale y apoya entero, no de puntillas',
      'El tronco se mantiene de frente, no gira',
      'Se va y se vuelve el mismo número de pasos',
      'No se arrastra el pie afecto',
    ],
    feedbacks: ['Pie plano', 'De frente', 'Levanta ese pie'],
    variantes: [
      { nombre: 'Con las dos manos', descripcion: 'El inicio.' },
      { nombre: 'Rozando la pared', descripcion: 'Sin agarrar, la pared solo da referencia.' },
      { nombre: 'Sin apoyo', descripcion: 'Manos libres.' },
    ],
  },
  {
    archivo: 'escalon-con-barandilla.jpg',
    nombre: 'Subir y bajar un escalón con barandilla',
    descripcion: 'Un escalón bajo, con la barandilla al alcance. Se sube con una pierna y se baja con la otra. En casa la regla es la de siempre: sube el pie bueno, baja el malo.',
    tipo_medida: 'tiempo',
    etiquetas: ['Cuádriceps', 'Glúteo mayor', 'Glúteo medio', 'Cadera', 'Rodilla', 'Cajón', 'Bipedestación', 'Unipodal', 'Cadena cerrada', 'Ictus', 'Hemiparesia', 'Riesgo de caída', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)'],
    items_ejecucion: [
      'La rodilla que sube no cae hacia dentro',
      'Se sube empujando con la pierna de arriba, no impulsándose con la de abajo',
      'Al bajar se apoya el pie entero, con control',
      'La barandilla acompaña, no tira',
    ],
    feedbacks: ['Empuja con la de arriba', 'Rodilla en línea', 'Baja despacio'],
    variantes: [
      { nombre: 'Escalón de 10 cm', descripcion: 'El de empezar.' },
      { nombre: 'Escalón de escalera normal', descripcion: 'Altura real de casa.' },
      { nombre: 'Subiendo con el lado afecto', descripcion: 'Carga la pierna que no responde.' },
      { nombre: 'Alternando pies', descripcion: 'Un pie por escalón. Marcha en escalera de verdad.' },
    ],
  },
  {
    archivo: 'marcha-con-obstaculos.jpg',
    nombre: 'Marcha con obstáculos y giros',
    descripcion: 'Recorrido con conos, un obstáculo bajo que pasar y un giro de 180° al final. Andar en línea recta por el pasillo de la clínica no se parece a andar por la calle: lo que hace caer es el giro y el bordillo.',
    tipo_medida: 'tiempo',
    etiquetas: ['Cuádriceps', 'Glúteo medio', 'Tibial Anterior', 'Cadera', 'Tobillo', 'Bipedestación', 'Marcha', 'Ictus', 'Hemiparesia', 'Riesgo de caída', 'Global', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'Bipodal'],
    items_ejecucion: [
      'El pie afecto pasa el obstáculo levantando, no rodeándolo',
      'El giro se hace con pasos, sin pivotar sobre un pie',
      'La mirada va al frente, no a los pies',
      'El paso mantiene la longitud: el lado afecto no acorta',
    ],
    feedbacks: ['Levanta el pie', 'Gira con pasitos', 'Mira al frente'],
    variantes: [
      { nombre: 'Solo conos', descripcion: 'Sin levantar el pie. El inicio.' },
      { nombre: 'Con obstáculo bajo', descripcion: 'Un listón de 5 cm.' },
      { nombre: 'Con doble tarea', descripcion: 'Contando hacia atrás mientras anda. Es lo que pasa en la calle.' },
      { nombre: 'Cambiando de superficie', descripcion: 'De suelo a colchoneta.' },
    ],
  },
  {
    archivo: 'autoasistido-hombro-con-stick.jpg',
    nombre: 'Autoasistido de hombro con bastón',
    descripcion: 'Tumbado o sentado, se coge un bastón con las dos manos y el brazo sano lleva al afecto: elevación, rotación y separación. Mantiene el recorrido del hombro mientras el brazo no tiene fuerza propia.',
    tipo_medida: 'tiempo',
    etiquetas: ['Deltoides', 'Manguito rotador', 'Hombro', 'Escapular', 'Stick', 'Supino', 'Sentado', 'Flexión', 'Rotación', 'Cadena cerrada', 'Ictus', 'Hemiparesia', 'Subluxación de hombro', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)'],
    items_ejecucion: [
      'La escápula acompaña: si el hombro se encoge hacia la oreja, se ha pasado el recorrido',
      'Se para donde aparece la resistencia, no donde aparece el dolor',
      'El movimiento es lento y sin rebotes',
      'La mano afecta va sujeta al bastón, no colgando',
    ],
    feedbacks: ['Hombro abajo', 'Hasta donde no duela', 'Despacio'],
    variantes: [
      { nombre: 'Elevación tumbado', descripcion: 'La gravedad ayuda menos. Por aquí se empieza.' },
      { nombre: 'Elevación sentado', descripcion: 'Contra gravedad, más exigente.' },
      { nombre: 'Rotación con el codo pegado', descripcion: 'Codo a 90° al costado.' },
      { nombre: 'Manos entrelazadas sin bastón', descripcion: 'Sin material. Es lo que hará en casa.' },
    ],
  },
  {
    archivo: 'deslizamiento-mano-en-mesa.jpg',
    nombre: 'Deslizamiento de la mano sobre la mesa',
    descripcion: 'Sentado ante una mesa, con la mano afecta sobre un paño o un deslizador, se empuja hacia delante y a los lados. La mesa sostiene el peso del brazo, así que se puede trabajar el alcance mucho antes de que el hombro aguante el brazo en el aire.',
    tipo_medida: 'tiempo',
    etiquetas: ['Deltoides', 'Tríceps', 'Trapecio', 'Hombro', 'Escapular', 'Codo', 'Deslizador', 'Sentado', 'Alcance', 'Extensión', 'Ictus', 'Hemiparesia', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)'],
    items_ejecucion: [
      'El tronco no se va detrás de la mano: el que alcanza es el brazo',
      'El codo se estira de verdad al final del recorrido',
      'El hombro no se encoge',
      'Se vuelve con control, sin dejar caer el brazo',
    ],
    feedbacks: ['Estira el codo', 'Tronco quieto', 'Hombro abajo'],
    variantes: [
      { nombre: 'Empujando con la otra mano encima', descripcion: 'Asistido del todo. El primer paso.' },
      { nombre: 'Activo hacia delante', descripcion: 'Solo, en línea recta.' },
      { nombre: 'Hacia los lados y en diagonal', descripcion: 'Cambia la dirección.' },
      { nombre: 'Persiguiendo un objetivo', descripcion: 'Hasta una marca en la mesa. Da meta y medida.' },
    ],
  },
  {
    archivo: 'agarrar-y-soltar-objetos.jpg',
    nombre: 'Agarrar y soltar objetos',
    descripcion: 'Pasar objetos de un lado a otro de la mesa: vasos, cubos, una botella. Abrir la mano cuesta más que cerrarla, así que lo que se entrena de verdad es soltar.',
    tipo_medida: 'tiempo',
    etiquetas: ['Flexor de Dedos', 'Extensor de Dedos', 'Dedos', 'Mano', 'Muñeca', 'Pelota', 'Sentado', 'Alcance', 'Ictus', 'Hemiparesia', 'Espasticidad', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)', 'agarre:Cerrado'],
    items_ejecucion: [
      'La muñeca se mantiene recta o algo extendida, no caída',
      'Se abre la mano del todo para soltar, sin sacudirla',
      'Se coge con los dedos, no aplastando contra la palma',
      'El hombro y el codo hacen el traslado, la mano solo agarra',
    ],
    feedbacks: ['Muñeca arriba', 'Abre la mano', 'Sin prisa'],
    variantes: [
      { nombre: 'Objetos grandes', descripcion: 'Vaso o botella. Agarre de toda la mano.' },
      { nombre: 'Objetos pequeños', descripcion: 'Cubos o fichas. Pinza.' },
      { nombre: 'Cambiando de altura', descripcion: 'De la mesa a un estante. Suma hombro.' },
      { nombre: 'Contrarreloj', descripcion: 'Cuántos en un minuto. Es el test de bloques.' },
    ],
  },
  {
    archivo: 'estiramiento-mantenido-mano.jpg',
    nombre: 'Estiramiento mantenido de muñeca y dedos',
    descripcion: 'Con la otra mano se abre la mano afecta —muñeca y dedos extendidos— y se mantiene un minuto o más. Es tensión sostenida y suave: en la espasticidad, lo que gana recorrido es el tiempo, no la fuerza.',
    tipo_medida: 'tiempo',
    etiquetas: ['Flexor de Dedos', 'Flexor de muñeca', 'Dedos', 'Mano', 'Muñeca', 'Extensión', 'Sentado', 'Ictus', 'Espasticidad', 'Analítico', 'plano_eje:Sagital', 'plano_eje:Frontal (mediolateral)'],
    items_ejecucion: [
      'Se estira despacio: si se tira de golpe el músculo responde apretando más',
      'Se mantiene un mínimo de un minuto, no unos segundos',
      'El pulgar se abre también, no se deja dentro',
      'No debe doler ni dejar la piel marcada',
    ],
    feedbacks: ['Despacio', 'Aguanta ahí', 'Saca el pulgar'],
    variantes: [
      { nombre: 'Con la otra mano', descripcion: 'Lo básico, sin material.' },
      { nombre: 'Apoyando la palma en la mesa', descripcion: 'El peso del cuerpo mantiene la apertura.' },
      { nombre: 'Con una férula o cuña', descripcion: 'Para mantenerlo más rato en casa.' },
    ],
  },
]

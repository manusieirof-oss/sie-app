// Sesiones genéricas: el catálogo de plantillas del que se parte para montar la
// sesión de un paciente concreto.
//
// Van SIN paciente (`paciente_id` a null). Una sesión con paciente es la que se
// ejecuta y se anota; estas son el molde. La diferencia importa: si las plantillas
// llevaran paciente, cada vez que alguien las tocara estaría cambiando el molde de
// todos los demás.
//
// Los ejercicios se referencian POR NOMBRE, no por id. El sembrador los busca en la
// biblioteca y avisa de los que no encuentre en vez de fallar en silencio, igual que
// con las etiquetas. Y de la biblioteca se copian imagen, variantes disponibles y cómo
// se mide, que es lo que el editor de sesión necesita tener a mano.
//
// El MODO va en la parte, no en la sesión: un entrenamiento real es calentamiento
// suelto, bloque principal en circuito y accesorios sueltos otra vez.

export type EjercicioPlantilla = {
  /** Nombre exacto tal y como está en la biblioteca. */
  ejercicio: string
  /** Nombre de una variante del propio ejercicio. Vacío = el ejercicio a secas. */
  variante?: string
  /**
   * Solo en partes en modo superserie: los ejercicios del MISMO grupo se hacen
   * seguidos y se descansa al terminarlo. Sin esto todos caen en el grupo A y la
   * superserie pasa a ser "haz los cuatro del tirón", que es otra cosa.
   */
  grupo?: string
  capacidad?: string
  regimen?: string
  series?: string
  reps?: string
  tiempo?: string
  nota?: string
}

export type PartePlantilla = {
  nombre: string
  modo?: 'ejercicio' | 'circuito' | 'superserie' | 'tiempo'
  tipo_tiempo?: 'emom' | 'amrap' | 'intervalos'
  minutos?: string
  intervalo?: string
  vueltas?: string
  descanso?: string
  ejercicios: EjercicioPlantilla[]
}

export type SesionPlantilla = {
  nombre: string
  descripcion: string
  partes: PartePlantilla[]
}

export const SESIONES: SesionPlantilla[] = [

  // ── 1 ─────────────────────────────────────────────────────────────────────
  {
    nombre: 'Empujes · cuerpo completo',
    descripcion: 'Todo lo que empuja, arriba y abajo. El bloque principal va en superseries de tren inferior con tren superior: mientras trabaja el pecho descansa la pierna, así que se aprovecha el descanso sin acortarlo.',
    partes: [
      {
        nombre: 'Calentamiento', modo: 'circuito', vueltas: '2', descanso: '60',
        ejercicios: [
          { ejercicio: 'Gato-camello', tiempo: '45', capacidad: 'Movilidad', nota: 'Sin buscar rango máximo' },
          { ejercicio: 'Deslizamiento en pared', reps: '10', capacidad: 'Movilidad' },
          { ejercicio: 'Sentadilla al banco', variante: 'Peso corporal', reps: '10', capacidad: 'Movilidad' },
        ],
      },
      {
        nombre: 'Parte principal', modo: 'superserie', descanso: '120',
        ejercicios: [
          { ejercicio: 'Sentadilla trasera', grupo: 'A', series: '4', reps: '6', capacidad: 'Fuerza' },
          { ejercicio: 'Press de banca', grupo: 'A', series: '4', reps: '6', capacidad: 'Fuerza' },
          { ejercicio: 'Zancada búlgara', variante: 'Con mancuernas', grupo: 'B', series: '3', reps: '10', capacidad: 'Hipertrofia' },
          { ejercicio: 'Press militar de pie', grupo: 'B', series: '3', reps: '10', capacidad: 'Hipertrofia' },
        ],
      },
      {
        nombre: 'Accesorios', modo: 'ejercicio', descanso: '60',
        ejercicios: [
          { ejercicio: 'Extensión de tríceps en polea', variante: 'Con cuerda', series: '3', reps: '12', capacidad: 'Hipertrofia' },
          { ejercicio: 'Plancha frontal', tiempo: '40', series: '3', capacidad: 'Fuerza-resistencia', regimen: 'Isométrico' },
        ],
      },
    ],
  },

  // ── 2 ─────────────────────────────────────────────────────────────────────
  {
    nombre: 'Tirones · cuerpo completo',
    descripcion: 'La sesión complementaria de la de empujes. Bisagra de cadera abajo y tracción arriba, con el trabajo escapular al final, que es donde se nota si has tirado con la espalda o con los brazos.',
    partes: [
      {
        nombre: 'Calentamiento', modo: 'circuito', vueltas: '2', descanso: '60',
        ejercicios: [
          { ejercicio: 'Movilidad torácica en cuadrupedia', tiempo: '45', capacidad: 'Movilidad' },
          { ejercicio: 'Retracción escapular con banda', reps: '15', capacidad: 'Movilidad' },
          { ejercicio: 'Puente de glúteo', reps: '12', capacidad: 'Movilidad' },
        ],
      },
      {
        nombre: 'Parte principal', modo: 'superserie', descanso: '120',
        ejercicios: [
          { ejercicio: 'Peso muerto rumano', grupo: 'A', series: '4', reps: '8', capacidad: 'Hipertrofia' },
          { ejercicio: 'Dominada asistida', variante: 'Con banda gruesa', grupo: 'A', series: '4', reps: '6', capacidad: 'Fuerza' },
          { ejercicio: 'Hip thrust', variante: 'Con barra', grupo: 'B', series: '3', reps: '12', capacidad: 'Hipertrofia' },
          { ejercicio: 'Remo con mancuerna a una mano', grupo: 'B', series: '3', reps: '12', capacidad: 'Hipertrofia' },
        ],
      },
      {
        nombre: 'Accesorios', modo: 'ejercicio', descanso: '60',
        ejercicios: [
          { ejercicio: 'Face pull', variante: 'Con banda', series: '3', reps: '15', capacidad: 'Fuerza-resistencia' },
          { ejercicio: 'Curl martillo', series: '3', reps: '12', capacidad: 'Hipertrofia' },
        ],
      },
    ],
  },

  // ── 3 ─────────────────────────────────────────────────────────────────────
  {
    nombre: 'Brazos',
    descripcion: 'Bíceps y tríceps en superseries, y el antebrazo al final. El antebrazo no es relleno: es lo que se descuida hasta que aparece una epicondilitis.',
    partes: [
      {
        nombre: 'Calentamiento', modo: 'ejercicio', descanso: '45',
        ejercicios: [
          { ejercicio: 'Agarre y apertura con goma', variante: 'Alternando', series: '2', reps: '15', capacidad: 'Movilidad' },
        ],
      },
      {
        nombre: 'Superseries de brazo', modo: 'superserie', descanso: '90',
        ejercicios: [
          { ejercicio: 'Curl con barra', grupo: 'A', series: '4', reps: '10', capacidad: 'Hipertrofia' },
          { ejercicio: 'Press francés', grupo: 'A', series: '4', reps: '10', capacidad: 'Hipertrofia' },
          { ejercicio: 'Curl martillo', variante: 'Cruzado al pecho', grupo: 'B', series: '3', reps: '12', capacidad: 'Hipertrofia' },
          { ejercicio: 'Fondos en banco', variante: 'Piernas extendidas', grupo: 'B', series: '3', reps: '12', capacidad: 'Hipertrofia' },
        ],
      },
      {
        nombre: 'Antebrazo', modo: 'circuito', vueltas: '3', descanso: '45',
        ejercicios: [
          { ejercicio: 'Extensión de muñeca', variante: 'Concéntrico y excéntrico', reps: '15', capacidad: 'Fuerza-resistencia' },
          { ejercicio: 'Flexión de muñeca', variante: 'Concéntrico y excéntrico', reps: '15', capacidad: 'Fuerza-resistencia' },
          { ejercicio: 'Supinación y pronación', variante: 'Con martillo', reps: '12', capacidad: 'Fuerza-resistencia' },
        ],
      },
    ],
  },

  // ── 4 ─────────────────────────────────────────────────────────────────────
  {
    nombre: 'Tren inferior',
    descripcion: 'Rodilla y cadera en la misma sesión. Empieza pesado con la sentadilla, sigue con el trabajo unilateral —que es donde salen las diferencias entre lados— y acaba con gemelo.',
    partes: [
      {
        nombre: 'Calentamiento', modo: 'circuito', vueltas: '2', descanso: '45',
        ejercicios: [
          { ejercicio: 'Sentadilla profunda sostenida', tiempo: '45', capacidad: 'Movilidad' },
          { ejercicio: 'Puente con banda en rodillas', variante: 'Con aperturas', reps: '15', capacidad: 'Movilidad' },
          { ejercicio: 'Marcha', variante: 'Lateral', tiempo: '40', capacidad: 'Movilidad' },
        ],
      },
      {
        nombre: 'Fuerza', modo: 'ejercicio', descanso: '180',
        ejercicios: [
          { ejercicio: 'Sentadilla trasera', series: '5', reps: '5', capacidad: 'Fuerza' },
          { ejercicio: 'Peso muerto convencional', series: '4', reps: '5', capacidad: 'Fuerza' },
        ],
      },
      {
        nombre: 'Unilateral y accesorios', modo: 'superserie', descanso: '90',
        ejercicios: [
          { ejercicio: 'Zancada búlgara', variante: 'Con mancuernas', grupo: 'A', series: '3', reps: '10', capacidad: 'Hipertrofia' },
          { ejercicio: 'Curl femoral en fitball', variante: 'A una pierna', grupo: 'A', series: '3', reps: '10', capacidad: 'Hipertrofia' },
          { ejercicio: 'Elevación de talón en escalón', variante: 'A una pierna', grupo: 'B', series: '3', reps: '12', capacidad: 'Hipertrofia' },
        ],
      },
    ],
  },

  // ── 5 ─────────────────────────────────────────────────────────────────────
  {
    nombre: 'Core',
    descripcion: 'Core por función, no por repeticiones de abdominal: antiextensión, antirrotación y antiflexión lateral. Todo el bloque va por tiempo, porque el core se entrena aguantando.',
    partes: [
      {
        nombre: 'Activación', modo: 'ejercicio', descanso: '45',
        ejercicios: [
          { ejercicio: 'Respiración diafragmática', tiempo: '90', capacidad: 'Movilidad' },
          { ejercicio: 'Activación abdominal profunda', tiempo: '60', series: '2', regimen: 'Isométrico' },
        ],
      },
      {
        nombre: 'Bloque por tiempo', modo: 'tiempo', tipo_tiempo: 'intervalos', minutos: '12', intervalo: '40/20', descanso: '60',
        ejercicios: [
          { ejercicio: 'Plancha frontal', tiempo: '40', regimen: 'Isométrico', nota: 'Antiextensión' },
          { ejercicio: 'Bird dog', variante: 'Completo', tiempo: '40', nota: 'Antirrotación' },
          { ejercicio: 'Plancha lateral', tiempo: '40', regimen: 'Isométrico', nota: 'Antiflexión lateral · un lado por vuelta' },
          { ejercicio: 'Dead bug', variante: 'Completo', tiempo: '40', nota: 'Antiextensión' },
        ],
      },
      {
        nombre: 'Acarreo', modo: 'ejercicio', descanso: '60',
        ejercicios: [
          { ejercicio: 'Paseo del granjero', variante: 'A una mano', tiempo: '40', series: '4', nota: 'Dos series por lado' },
        ],
      },
    ],
  },

  // ── 6 ─────────────────────────────────────────────────────────────────────
  {
    nombre: 'Full body A · fuerza',
    descripcion: 'Los seis patrones básicos en una sesión: sentadilla, bisagra, empuje y tracción. Para quien entrena dos días por semana y no puede permitirse partir el cuerpo.',
    partes: [
      {
        nombre: 'Calentamiento', modo: 'circuito', vueltas: '2', descanso: '45',
        ejercicios: [
          { ejercicio: 'Gato-camello', tiempo: '40', capacidad: 'Movilidad' },
          { ejercicio: 'Puente de glúteo', reps: '12', capacidad: 'Movilidad' },
          { ejercicio: 'Deslizamiento en pared', reps: '10', capacidad: 'Movilidad' },
        ],
      },
      {
        nombre: 'Fuerza', modo: 'superserie', descanso: '150',
        ejercicios: [
          { ejercicio: 'Sentadilla frontal', variante: 'Agarre cruzado', grupo: 'A', series: '4', reps: '6', capacidad: 'Fuerza' },
          { ejercicio: 'Remo con barra', grupo: 'A', series: '4', reps: '6', capacidad: 'Fuerza' },
          { ejercicio: 'Peso muerto rumano', grupo: 'B', series: '3', reps: '8', capacidad: 'Hipertrofia' },
          { ejercicio: 'Press de banca con mancuernas', variante: 'Neutro', grupo: 'B', series: '3', reps: '8', capacidad: 'Hipertrofia' },
        ],
      },
      {
        nombre: 'Vuelta a la calma', modo: 'ejercicio', descanso: '45',
        ejercicios: [
          { ejercicio: 'Descompresión en cuadrupedia', tiempo: '60', capacidad: 'Estiramiento' },
        ],
      },
    ],
  },

  // ── 7 ─────────────────────────────────────────────────────────────────────
  {
    nombre: 'Full body B · circuito',
    descripcion: 'La misma cobertura que la A pero en circuito y con menos carga: se entrena la capacidad de repetir, no el tope. Sirve como sesión de descarga o para quien vuelve después de un parón.',
    partes: [
      {
        nombre: 'Calentamiento', modo: 'ejercicio', descanso: '30',
        ejercicios: [
          { ejercicio: 'Marcha', variante: 'De talones', tiempo: '40' },
          { ejercicio: 'Movilidad torácica en cuadrupedia', tiempo: '45', capacidad: 'Movilidad' },
        ],
      },
      {
        nombre: 'Circuito', modo: 'circuito', vueltas: '4', descanso: '90',
        ejercicios: [
          { ejercicio: 'Sentadilla goblet', variante: 'Con kettlebell', reps: '12', capacidad: 'Fuerza-resistencia' },
          { ejercicio: 'Flexiones', variante: 'Con rodillas apoyadas', reps: '12', capacidad: 'Fuerza-resistencia' },
          { ejercicio: 'Remo en suspensión', variante: 'Poco inclinado', reps: '12', capacidad: 'Fuerza-resistencia' },
          { ejercicio: 'Peso muerto a una pierna', variante: 'Con dos mancuernas', reps: '10', capacidad: 'Fuerza-resistencia' },
          { ejercicio: 'Plancha frontal', tiempo: '30', regimen: 'Isométrico' },
        ],
      },
      {
        nombre: 'Vuelta a la calma', modo: 'ejercicio', descanso: '45',
        ejercicios: [
          { ejercicio: 'Respiración diafragmática', tiempo: '90', capacidad: 'Movilidad' },
        ],
      },
    ],
  },

  // ── 8 ─────────────────────────────────────────────────────────────────────
  {
    nombre: 'Hombro · manguito y escápula',
    descripcion: 'Sesión de hombro doloroso. Nada de peso por encima de la cabeza al principio: primero control escapular y rotadores, y el empuje solo al final y con arco amable.',
    partes: [
      {
        nombre: 'Control escapular', modo: 'circuito', vueltas: '3', descanso: '45',
        ejercicios: [
          { ejercicio: 'Deslizamiento en pared', reps: '10', capacidad: 'Movilidad' },
          { ejercicio: 'Y-T-W en prono', variante: 'Solo Y', tiempo: '30', capacidad: 'Fuerza-resistencia' },
          { ejercicio: 'Retracción escapular con banda', variante: 'Codos a 90 grados', reps: '15', capacidad: 'Fuerza-resistencia' },
        ],
      },
      {
        nombre: 'Manguito rotador', modo: 'ejercicio', descanso: '60',
        ejercicios: [
          { ejercicio: 'Rotación externa con banda', variante: 'Con toalla en la axila', series: '3', reps: '15', capacidad: 'Fuerza-resistencia', nota: 'Sin dolor en todo el recorrido' },
          { ejercicio: 'Rotación interna con banda', variante: 'Con toalla en la axila', series: '3', reps: '15', capacidad: 'Fuerza-resistencia' },
        ],
      },
      {
        nombre: 'Empuje y tracción', modo: 'superserie', descanso: '90',
        ejercicios: [
          { ejercicio: 'Press landmine a una mano', variante: 'De rodillas', grupo: 'A', series: '3', reps: '10', capacidad: 'Hipertrofia', nota: 'Arco más amable que un press vertical' },
          { ejercicio: 'Face pull', variante: 'Con banda', grupo: 'A', series: '3', reps: '15', capacidad: 'Fuerza-resistencia' },
        ],
      },
    ],
  },

  // ── 9 ─────────────────────────────────────────────────────────────────────
  {
    nombre: 'Rodilla · vuelta a la carga',
    descripcion: 'Progresión de rodilla después de una lesión. Isométrico primero, luego cadena cerrada bilateral y unilateral, y el impacto solo al final, cuando lo demás ya se aguanta.',
    partes: [
      {
        nombre: 'Isométrico y activación', modo: 'ejercicio', descanso: '60',
        ejercicios: [
          { ejercicio: 'Extensión terminal de rodilla', variante: 'Isométrica', tiempo: '45', series: '4', regimen: 'Isométrico' },
          { ejercicio: 'Sentadilla isométrica en pared', variante: 'Con pelota entre rodillas', tiempo: '45', series: '3', regimen: 'Isométrico' },
        ],
      },
      {
        nombre: 'Cadena cerrada', modo: 'ejercicio', descanso: '90',
        ejercicios: [
          { ejercicio: 'Sentadilla asistida en suspensión', series: '3', reps: '12', capacidad: 'Fuerza-resistencia' },
          { ejercicio: 'Subida al cajón', variante: 'Frontal', series: '3', reps: '10', capacidad: 'Hipertrofia', nota: 'Bajada controlada, es donde está el trabajo' },
          { ejercicio: 'Sentadilla al banco', variante: 'A una pierna', series: '3', reps: '8', capacidad: 'Hipertrofia' },
        ],
      },
      {
        nombre: 'Estabilidad', modo: 'circuito', vueltas: '3', descanso: '45',
        ejercicios: [
          { ejercicio: 'Equilibrio unipodal en bosu', variante: 'En bosu', tiempo: '30' },
          { ejercicio: 'Marcha lateral con mini band', variante: 'Por encima de la rodilla', tiempo: '40' },
          { ejercicio: 'Abducción de cadera de pie', variante: 'Con banda sobre la rodilla', reps: '15' },
        ],
      },
    ],
  },

  // ── 10 ────────────────────────────────────────────────────────────────────
  {
    nombre: 'Espalda y cuello · trabajo de oficina',
    descripcion: 'Para quien pasa el día sentado. Movilidad torácica y cervical, trabajo escapular y algo de cadera, porque la lumbar suele pagar lo que la cadera no hace. Se puede repetir en casa entera.',
    partes: [
      {
        nombre: 'Movilidad', modo: 'circuito', vueltas: '2', descanso: '45',
        ejercicios: [
          { ejercicio: 'Gato-camello', tiempo: '45', capacidad: 'Movilidad' },
          { ejercicio: 'Apertura en libro', variante: 'Con pausa', tiempo: '45', capacidad: 'Movilidad' },
          { ejercicio: 'Extensión torácica en roller', variante: 'Recorriendo', tiempo: '45', capacidad: 'Movilidad' },
          { ejercicio: 'Estiramiento del piramidal', variante: 'Sentado', tiempo: '40', capacidad: 'Estiramiento' },
        ],
      },
      {
        nombre: 'Cuello', modo: 'ejercicio', descanso: '45',
        ejercicios: [
          { ejercicio: 'Retracción cervical', variante: 'Contra la pared', series: '3', reps: '10' },
          { ejercicio: 'Flexión profunda de cuello', tiempo: '30', series: '3', regimen: 'Isométrico' },
        ],
      },
      {
        nombre: 'Fuerza postural', modo: 'ejercicio', descanso: '60',
        ejercicios: [
          { ejercicio: 'Remo en polea baja', variante: 'Agarre neutro', series: '3', reps: '12', capacidad: 'Hipertrofia' },
          { ejercicio: 'Elevación de brazos en pared', series: '3', reps: '10', capacidad: 'Movilidad' },
          { ejercicio: 'Bird dog', variante: 'Completo', tiempo: '30', series: '3' },
        ],
      },
    ],
  },
]

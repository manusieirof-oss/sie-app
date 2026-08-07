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

  // ══════════════════════════════════════════════════════════════════════════
  // Sesiones que abren los tests de valoración.
  //
  // No se inventaron por completar el catálogo: cada una es la que trabaja el objetivo
  // que abre un test concreto de `semillaTests.ts`. Sin ellas, esos tests dan positivo,
  // abren su objetivo y dejan al objetivo sin nada con que entrenarse.
  // ══════════════════════════════════════════════════════════════════════════

  // ── 11 ────────────────────────────────────────────────────────────────────
  {
    nombre: 'Cadera · movilidad y control',
    descripcion: 'La que abren Thomas y Ober. Primero se suelta lo que está corto —flexor y tensor de la fascia lata— y después se refuerza lo que no está sujetando, que casi siempre es el glúteo medio. Soltar sin reforzar dura una semana.',
    partes: [
      {
        nombre: 'Calentamiento', modo: 'circuito', vueltas: '2', descanso: '45',
        ejercicios: [
          { ejercicio: 'Gato-camello', tiempo: '45', capacidad: 'Movilidad' },
          { ejercicio: 'Rotación interna en cuadrupedia', reps: '10', capacidad: 'Movilidad' },
          { ejercicio: 'Sentadilla profunda sostenida', tiempo: '45', capacidad: 'Movilidad' },
        ],
      },
      {
        nombre: 'Soltar', modo: 'ejercicio', descanso: '45',
        ejercicios: [
          { ejercicio: 'Estiramiento del piramidal', tiempo: '40', series: '2', capacidad: 'Movilidad' },
          { ejercicio: 'Zancada con rotación', reps: '8', series: '2', capacidad: 'Movilidad',
            nota: 'Buscar la extensión de la cadera de atrás, no la profundidad' },
        ],
      },
      {
        nombre: 'Sujetar', modo: 'superserie', descanso: '90',
        ejercicios: [
          { ejercicio: 'Abducción de cadera de pie', grupo: 'A', series: '3', reps: '12', capacidad: 'Fuerza-resistencia' },
          { ejercicio: 'Copenhagen', grupo: 'A', series: '3', tiempo: '20', regimen: 'Isométrico' },
          { ejercicio: 'Puente con banda en rodillas', grupo: 'B', series: '3', reps: '12', capacidad: 'Fuerza-resistencia' },
          { ejercicio: 'Rotación externa de cadera', grupo: 'B', series: '3', reps: '12', capacidad: 'Fuerza-resistencia' },
        ],
      },
    ],
  },

  // ── 12 ────────────────────────────────────────────────────────────────────
  {
    nombre: 'Tobillo y pie',
    descripcion: 'La que abre el test del lunge. La dorsiflexión se gana empujando contra el final del recorrido, no estirando el gemelo de pie: por eso el trabajo va con la rodilla flexionada, que es donde manda el sóleo.',
    partes: [
      {
        nombre: 'Preparar el pie', modo: 'ejercicio', descanso: '30',
        ejercicios: [
          { ejercicio: 'Rodillo plantar', tiempo: '60', series: '2', capacidad: 'Movilidad' },
        ],
      },
      {
        nombre: 'Movilidad', modo: 'circuito', vueltas: '2', descanso: '45',
        ejercicios: [
          { ejercicio: 'Dorsiflexión con banda', reps: '12', capacidad: 'Movilidad',
            nota: 'La rodilla por delante del dedo gordo, sin levantar el talón' },
          { ejercicio: 'Inversión con banda', reps: '12', capacidad: 'Movilidad' },
          { ejercicio: 'Eversión con banda', reps: '12', capacidad: 'Movilidad' },
        ],
      },
      {
        nombre: 'Fuerza', modo: 'ejercicio', descanso: '60',
        ejercicios: [
          { ejercicio: 'Elevación de talones sentado', series: '4', reps: '15', capacidad: 'Fuerza-resistencia',
            nota: 'Sentado es sóleo: es el que limita la dorsiflexión' },
          { ejercicio: 'Excéntrico de Aquiles', series: '3', reps: '10', regimen: 'Excéntrico' },
          { ejercicio: 'Elevación de talones de pie', series: '3', reps: '12', capacidad: 'Fuerza-resistencia' },
        ],
      },
      {
        nombre: 'Control', modo: 'ejercicio', descanso: '45',
        ejercicios: [
          { ejercicio: 'Equilibrio unipodal en bosu', tiempo: '30', series: '3' },
        ],
      },
    ],
  },

  // ── 13 ────────────────────────────────────────────────────────────────────
  {
    nombre: 'Equilibrio y marcha',
    descripcion: 'La que abren el equilibrio unipodal y el sentarse-levantarse. En mayores el equilibrio no se entrena solo con equilibrio: se cae quien no tiene fuerza para recuperar el paso, así que la mitad de la sesión es tren inferior.',
    partes: [
      {
        nombre: 'Calentamiento', modo: 'circuito', vueltas: '2', descanso: '60',
        ejercicios: [
          { ejercicio: 'Marcha', tiempo: '60', capacidad: 'Movilidad' },
          { ejercicio: 'Gato-camello', tiempo: '45', capacidad: 'Movilidad' },
        ],
      },
      {
        nombre: 'Fuerza', modo: 'ejercicio', descanso: '90',
        ejercicios: [
          { ejercicio: 'Sentarse y levantarse de la silla', series: '3', reps: '10', capacidad: 'Fuerza',
            nota: 'Sin ayudarse con los brazos mientras pueda' },
          { ejercicio: 'Subida al cajón', series: '3', reps: '8', capacidad: 'Fuerza' },
          { ejercicio: 'Peso muerto a una pierna', series: '3', reps: '8', capacidad: 'Fuerza' },
        ],
      },
      {
        nombre: 'Equilibrio', modo: 'circuito', vueltas: '3', descanso: '60',
        ejercicios: [
          { ejercicio: 'Equilibrio unipodal en bosu', tiempo: '30' },
          { ejercicio: 'Abducción de cadera de pie', reps: '12', capacidad: 'Fuerza-resistencia' },
          { ejercicio: 'Saltos suaves en el sitio', tiempo: '20', capacidad: 'Fuerza-resistencia',
            nota: 'Quitar si hay dolor articular o poca confianza' },
        ],
      },
    ],
  },

  // ── 14 ────────────────────────────────────────────────────────────────────
  {
    nombre: 'Suelo pélvico y pared abdominal',
    descripcion: 'La que abre el test de diástasis. Va de dentro afuera: respiración, transverso y después carga. No lleva plancha ni rueda abdominal a propósito: en una pared abdominal que todavía se abomba, la antiextensión empuja justo donde no aguanta.',
    partes: [
      {
        nombre: 'Respiración', modo: 'ejercicio', descanso: '30',
        ejercicios: [
          { ejercicio: 'Respiración diafragmática', tiempo: '60', series: '3', capacidad: 'Movilidad',
            nota: 'Costillas a los lados, sin subir el pecho' },
        ],
      },
      {
        nombre: 'Activación', modo: 'ejercicio', descanso: '45',
        ejercicios: [
          { ejercicio: 'Activación abdominal profunda', reps: '10', series: '3', regimen: 'Isométrico',
            nota: 'Exhalar al activar; que la línea media no se abombe' },
          { ejercicio: 'Aducción isométrica con pelota', tiempo: '20', series: '3', regimen: 'Isométrico' },
        ],
      },
      {
        nombre: 'Control con carga', modo: 'circuito', vueltas: '3', descanso: '60',
        ejercicios: [
          { ejercicio: 'Dead bug', reps: '10', capacidad: 'Fuerza-resistencia',
            nota: 'Bajar solo hasta donde la lumbar siga pegada al suelo' },
          { ejercicio: 'Bird dog', reps: '10', capacidad: 'Fuerza-resistencia' },
          { ejercicio: 'Puente de glúteo', reps: '12', capacidad: 'Fuerza-resistencia' },
        ],
      },
    ],
  },

  // ── Tras un ictus ─────────────────────────────────────────────────────────
  //
  // Dos sesiones y no una porque la distancia entre ellas es enorme: la primera se hace
  // en la camilla y en una silla, la segunda de pie. Meterlas juntas obligaría a tachar
  // media sesión cada día.
  //
  // Ninguna de las dos lleva carga externa ni series de diez. En la fase en la que se
  // usan, la dosis no la pone el peso: la pone cuánto rato sale el gesto antes de que
  // empiece a salir compensado.
  {
    nombre: 'Ictus · control de tronco y transferencias',
    descripcion: 'La primera. Va de recuperar el tronco y de moverse: voltearse, sentarse, ponerse de pie. Empieza y acaba cuidando el hombro afecto, que es lo que más rehabilitaciones frena. Se para cuando el gesto deja de salir limpio, no cuando se acaban las repeticiones.',
    partes: [
      {
        nombre: 'Cuidado del hombro', modo: 'ejercicio', descanso: '30',
        ejercicios: [
          { ejercicio: 'Autoasistido de hombro con bastón', variante: 'Elevación tumbado', series: '2', tiempo: '90', capacidad: 'Movilidad',
            nota: 'Hasta donde no duela. Si duele, se para y se avisa' },
          { ejercicio: 'Estiramiento mantenido de muñeca y dedos', variante: 'Con la otra mano', series: '2', tiempo: '90', capacidad: 'Movilidad' },
          { ejercicio: 'Respiración diafragmática', tiempo: '60', capacidad: 'Movilidad' },
        ],
      },
      {
        nombre: 'Tronco en la camilla', modo: 'circuito', vueltas: '3', descanso: '60',
        ejercicios: [
          { ejercicio: 'Volteo en la camilla', variante: 'Hacia el lado afecto', tiempo: '60' },
          { ejercicio: 'Puente de glúteo', reps: '8', capacidad: 'Fuerza',
            nota: 'Con los dos pies. Que la cadera suba recta, sin caer al lado afecto' },
          { ejercicio: 'Incorporarse a sentado', variante: 'Por el lado sano', tiempo: '90' },
        ],
      },
      {
        nombre: 'Sentado', modo: 'circuito', vueltas: '3', descanso: '60',
        ejercicios: [
          { ejercicio: 'Sedestación al borde de la camilla', variante: 'Sin apoyo', tiempo: '45' },
          { ejercicio: 'Alcance funcional sentado', variante: 'Hacia delante', reps: '8' },
          { ejercicio: 'Deslizamiento de la mano sobre la mesa', variante: 'Activo hacia delante', tiempo: '60' },
        ],
      },
      {
        nombre: 'De pie', modo: 'ejercicio', descanso: '90',
        ejercicios: [
          { ejercicio: 'Levantarse y sentarse con apoyo', variante: 'Desde silla alta', series: '3', reps: '6', capacidad: 'Fuerza',
            nota: 'Bajar despacio cuenta tanto como subir' },
          { ejercicio: 'Traslado de peso en bipedestación', variante: 'Con las dos manos apoyadas', series: '3', tiempo: '60',
            nota: 'Con el entrenador en el lado afecto' },
        ],
      },
    ],
  },

  {
    nombre: 'Ictus · marcha y miembro superior',
    descripcion: 'La segunda, para quien ya se pone de pie solo. La pierna se entrena andando y subiendo, no en máquina, porque lo que falla no es la fuerza sino el control. El bloque de brazo va al final a propósito: es el que más se abandona y el primero que se cae de la sesión cuando falta tiempo.',
    partes: [
      {
        nombre: 'Preparación', modo: 'circuito', vueltas: '2', descanso: '45',
        ejercicios: [
          { ejercicio: 'Autoasistido de hombro con bastón', variante: 'Elevación sentado', tiempo: '60', capacidad: 'Movilidad' },
          { ejercicio: 'Dorsiflexión con banda', reps: '12', capacidad: 'Fuerza-resistencia',
            nota: 'El pie que se arrastra al andar sale de aquí' },
          { ejercicio: 'Gato-camello', tiempo: '45', capacidad: 'Movilidad' },
        ],
      },
      {
        nombre: 'Fuerza de pierna', modo: 'ejercicio', descanso: '90',
        ejercicios: [
          { ejercicio: 'Levantarse y sentarse con apoyo', variante: 'Con los brazos cruzados', series: '3', reps: '8', capacidad: 'Fuerza' },
          { ejercicio: 'Subir y bajar un escalón con barandilla', variante: 'Subiendo con el lado afecto', series: '3', reps: '8', capacidad: 'Fuerza' },
          { ejercicio: 'Puente de glúteo', series: '3', reps: '12', capacidad: 'Fuerza' },
        ],
      },
      {
        nombre: 'Equilibrio y marcha', modo: 'circuito', vueltas: '3', descanso: '60',
        ejercicios: [
          { ejercicio: 'Traslado de peso en bipedestación', variante: 'Sin apoyo', tiempo: '45' },
          { ejercicio: 'Paso lateral con apoyo', variante: 'Rozando la pared', tiempo: '60' },
          { ejercicio: 'Marcha con obstáculos y giros', variante: 'Con obstáculo bajo', tiempo: '90',
            nota: 'Sin doble tarea hasta que el recorrido salga solo' },
        ],
      },
      {
        nombre: 'Brazo y mano', modo: 'circuito', vueltas: '3', descanso: '45',
        ejercicios: [
          { ejercicio: 'Deslizamiento de la mano sobre la mesa', variante: 'Persiguiendo un objetivo', tiempo: '60' },
          { ejercicio: 'Agarrar y soltar objetos', variante: 'Objetos grandes', tiempo: '90',
            nota: 'Lo que cuesta es soltar, no coger' },
          { ejercicio: 'Agarre y apertura con goma', reps: '15', capacidad: 'Fuerza-resistencia' },
        ],
      },
    ],
  },
]

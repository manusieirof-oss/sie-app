// Cambios acordados sobre el árbol de etiquetas existente.
//
// NO es el árbol completo: el que hay ya está bien y es más preciso de lo que yo
// habría propuesto, sobre todo en músculos. Aquí solo va lo que hay que corregir o
// añadir, para no tocar nada que ya funcione.

/** Etiquetas que están en la categoría equivocada. Se mueven, no se recrean. */
export const MOVER: { nombre: string, de: string, a: string, motivo: string }[] = [
  { nombre: 'Rack', de: 'musculo', a: 'material',
    motivo: 'Un rack es material, no un músculo.' },
  { nombre: 'Unilateral', de: 'movimiento', a: 'apoyo',
    motivo: 'Es lateralidad, no un movimiento. En Apoyo convive con Bipodal y Unipodal.' },
  { nombre: 'Flexión de cadera', de: 'posicion', a: 'movimiento',
    motivo: 'Es un movimiento articular, no una posición de partida.' },
  { nombre: 'Lunge', de: 'apoyo', a: 'movimiento',
    motivo: 'Es un patrón de movimiento. Queda bajo la rama Patrón.' },
]

/**
 * Renombres. Abierto y Cerrado existen en Apoyo y en Agarre con significados
 * distintos —cadena cinética contra tipo de agarre— y al etiquetar no se distinguían.
 */
export const RENOMBRAR: { de: string, a: string, categoria: string, padre?: string }[] = [
  // "Menor" a secas, colgando de Glúteo, se lee bien en el árbol pero fatal en la
  // pastilla de un ejercicio, donde aparece suelta y no dice de qué es. Además hay tres
  // etiquetas llamadas "Mayor" (glúteo, aductor y pectoral) y dos "Menor".
  { de: 'Menor', a: 'Glúteo menor', categoria: 'musculo', padre: 'Glúteo' },

  { de: 'Abierto', a: 'Cadena abierta', categoria: 'apoyo' },
  { de: 'Cerrado', a: 'Cadena cerrada', categoria: 'apoyo' },
  // Las listas se ordenan alfabéticamente y la minúscula la mandaba al final.
  { de: 'polea', a: 'Polea', categoria: 'material' },
  // Es la barra de dominadas, que está fija y no suspendida de nada. Con las cinchas
  // en la lista habría dos etiquetas con "suspensión" que son cosas opuestas: una
  // sujeta al paciente y la otra le cuelga.
  { de: 'Barra en suspensión', a: 'Barra de dominadas', categoria: 'material' },
]

/**
 * Etiquetas duplicadas que se unifican.
 *
 * Los ejercicios que usaran la que sobra pasan a la que se queda antes de borrarla,
 * para no dejarlos con una referencia a nada. Hoy no hay ninguno, pero el día que se
 * fusione algo con la biblioteca llena, importa.
 *
 * Roller y Rodillo eran dos modelos distintos, pero se distinguen bien en la imagen
 * del ejercicio, así que no compensa tener dos etiquetas para lo mismo.
 */
export const FUSIONAR: { sobra: string, queda: string, categoria: string, padre?: string }[] = [
  { sobra: 'Rodillo', queda: 'Roller', categoria: 'material' },

  // Duplicados que creé yo por no haber mirado el árbol antes. Los vastos ya estaban
  // con su nombre anatómico —Medial y Lateral— y añadí los sinónimos interno y externo.
  // Se queda el nombre anatómico.
  //
  // El `padre` NO es decoración: hay tres etiquetas llamadas "Mayor" (glúteo, aductor y
  // pectoral) y dos llamadas "Menor". Fusionar por nombre a secas podría meter el
  // pectoral mayor dentro del glúteo.
  { sobra: 'Vasto interno', queda: 'Vasto Medial', categoria: 'musculo', padre: 'Cuádriceps' },
  { sobra: 'Vasto externo', queda: 'Vasto Lateral', categoria: 'musculo', padre: 'Cuádriceps' },
  // Aquí al revés: se queda el nombre largo. "Mayor" y "Medio" sueltos, en la pastilla
  // de un ejercicio, no dicen de qué músculo hablan.
  { sobra: 'Mayor', queda: 'Glúteo mayor', categoria: 'musculo', padre: 'Glúteo' },
  { sobra: 'Medio', queda: 'Glúteo medio', categoria: 'musculo', padre: 'Glúteo' },
]

/**
 * Etiquetas nuevas. `padre` es el nombre de la etiqueta madre dentro de la misma
 * categoría; si se deja vacío, va a la raíz.
 */
export const NUEVAS: { categoria: string, nombre: string, padre?: string }[] = [
  // PATRONES DE MOVIMIENTO
  //
  // Lo que faltaba, y es lo que hace funcionar el buscador de ejercicios parecidos.
  // La categoría Movimiento tiene los movimientos anatómicos —flexión, extensión,
  // rotación—, que describen qué hace la articulación. Con solo eso, una sentadilla y
  // un curl de bíceps comparten "Flexión" y "Extensión" y saldrían emparejados.
  // El patrón dice qué gesto es, que es lo que de verdad los distingue.
  { categoria: 'movimiento', nombre: 'Patrón' },
  { categoria: 'movimiento', nombre: 'Sentadilla', padre: 'Patrón' },
  { categoria: 'movimiento', nombre: 'Bisagra de cadera', padre: 'Patrón' },
  { categoria: 'movimiento', nombre: 'Zancada', padre: 'Patrón' },
  { categoria: 'movimiento', nombre: 'Empuje horizontal', padre: 'Patrón' },
  { categoria: 'movimiento', nombre: 'Empuje vertical', padre: 'Patrón' },
  { categoria: 'movimiento', nombre: 'Tracción horizontal', padre: 'Patrón' },
  { categoria: 'movimiento', nombre: 'Tracción vertical', padre: 'Patrón' },
  { categoria: 'movimiento', nombre: 'Acarreo', padre: 'Patrón' },
  { categoria: 'movimiento', nombre: 'Salto', padre: 'Patrón' },
  { categoria: 'movimiento', nombre: 'Marcha', padre: 'Patrón' },

  // ALCANCE DEL EJERCICIO
  //
  // Rama aparte de Patrón, porque son dos preguntas distintas y un ejercicio contesta
  // a las dos: una sentadilla es "Global" y además es patrón de "Sentadilla"; una
  // extensión de rodilla es "Analítico" y no tiene patrón. Si fueran hermanas habría
  // que elegir una y se perdería la otra.
  { categoria: 'movimiento', nombre: 'Alcance' },
  { categoria: 'movimiento', nombre: 'Analítico', padre: 'Alcance' },
  { categoria: 'movimiento', nombre: 'Global', padre: 'Alcance' },
  // Dos gestos encadenados en un mismo ejercicio: sentadilla con curl, zancada con
  // press. No es un global cualquiera: hay dos patrones dentro y conviene poder
  // encontrarlos.
  { categoria: 'movimiento', nombre: 'Combinado', padre: 'Alcance' },

  // MATERIAL
  //
  // "Barra" a secas no distingue una olímpica de 20 kg de una corta de cinco o seis, y
  // eso cambia el peso real de la serie: 40 kg anotados son 60 con una y 46 con la
  // otra. Como hijas de Barra, quien filtre por "Barra" las sigue viendo las dos.
  { categoria: 'material', nombre: 'Barra olímpica', padre: 'Barra' },
  { categoria: 'material', nombre: 'Barra corta', padre: 'Barra' },
  // TRX es una marca, así que va el nombre genérico. Es el material que más se usa
  // para ASISTIR: descarga peso en la sentadilla y permite trabajar rangos que sin él
  // no se alcanzan, que es justo lo que hace falta al empezar una rodilla.
  { categoria: 'material', nombre: 'Cinchas de suspensión' },

  // MÚSCULOS
  //
  // Los vastos, como hijos de Cuádriceps: quien filtre por Cuádriceps los sigue viendo,
  // y quien necesite potenciar un vasto interno concreto puede llegar a los cuatro o
  // cinco ejercicios que lo buscan sin repasar la lista entera. Es ÉNFASIS, no
  // aislamiento: no hay ejercicio que trabaje un vasto y no el resto.
  // Los vastos NO se crean: ya existen como Vasto Medial y Vasto Lateral. Tampoco
  // Aductores. Se dejan aquí anotados para que nadie los vuelva a añadir.
  // Mismo criterio con el glúteo. El MEDIO es el que importa de verdad tenerlo aparte:
  // es el de la estabilidad lateral, el que se busca cuando la rodilla cae hacia dentro
  // o la cadera duele al andar, y lo trabajan cuatro ejercicios muy concretos que sin
  // etiqueta no hay forma de encontrar entre todos los de "Glúteo".
  { categoria: 'musculo', nombre: 'Glúteo mayor', padre: 'Glúteo' },
  { categoria: 'musculo', nombre: 'Glúteo medio', padre: 'Glúteo' },

  // NO se crea nada de "función de core": Antiextensión, Antiflexión y Antirotación ya
  // existen en Movimiento, y los ejercicios las usan tal cual están escritas ahí
  // —Antirotación con una sola erre—. Iba a crear tres duplicados por no haber mirado
  // el árbol antes.

  // "Lumbar" ya existe como ARTICULACIÓN, hija de Columna, y es la región. El músculo
  // que trabaja una extensión lumbar son los paravertebrales, así que va con su nombre:
  // dos etiquetas iguales en categorías distintas se confundirían al buscar por nombre.
  
  

  // PATOLOGÍAS
  //
  // La etiqueta significa "va bien para", no "cuidado con". Es una de las cuatro
  // categorías que deciden qué ejercicios se parecen, y con cuatro entradas no daba
  // para nada.
  { categoria: 'patologia', nombre: 'Lumbalgia' },
  { categoria: 'patologia', nombre: 'Hernia discal' },
  { categoria: 'patologia', nombre: 'Cervicalgia' },
  { categoria: 'patologia', nombre: 'Hombro doloroso' },
  { categoria: 'patologia', nombre: 'Manguito rotador' },
  { categoria: 'patologia', nombre: 'Epicondilitis' },
  { categoria: 'patologia', nombre: 'Condropatía rotuliana' },
  { categoria: 'patologia', nombre: 'Rotura de LCA' },
  { categoria: 'patologia', nombre: 'Menisco' },
  { categoria: 'patologia', nombre: 'Esguince de tobillo' },
  { categoria: 'patologia', nombre: 'Tendinopatía aquílea' },
  { categoria: 'patologia', nombre: 'Fascitis plantar' },
  { categoria: 'patologia', nombre: 'Prótesis de cadera' },
  { categoria: 'patologia', nombre: 'Prótesis de rodilla' },
  { categoria: 'patologia', nombre: 'Suelo pélvico' },
  { categoria: 'patologia', nombre: 'Osteoporosis' },
  { categoria: 'patologia', nombre: 'Artrosis' },
]

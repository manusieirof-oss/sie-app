import { normalizar } from './texto'
import { categoriaDe } from './etiquetas'

// ---------------------------------------------------------------------------
// LA FIGURA DE LOS MÚSCULOS: imagen automática de un ejercicio por sus etiquetas.
//
// Para los ejercicios sin foto. Una figura base (de frente, de espalda o de perfil)
// y encima, en amarillo, las capas de los músculos que lleva el ejercicio. Las capas
// salen de hojas hechas en Canva, separadas por color y encajadas a la figura de su
// vista; viven en /public/cuerpo como `vista_musculo.svg`, todas del mismo tamaño
// (360 x 640) para apilarlas sin colocar nada.
//
// No dibuja el gesto (codo doblado o estirado): enseña QUÉ trabaja. Es la imagen de
// mientras no haya foto o ilustración propia.
// ---------------------------------------------------------------------------

export type Vista = 'frente' | 'espalda' | 'perfil'

/**
 * De qué capa sale cada etiqueta de músculo. La clave es el camino normalizado
 * "raíz>hija" (la raíz sola para las de primer nivel), porque hay nombres repetidos
 * ("Mayor" en Pectoral, Aductores y Glúteo). Lo que no está aquí no pinta nada.
 * Las marcadas ≈ van a la capa más cercana hasta que tengan la suya.
 */
const CAPA: Record<string, [Vista, string]> = {
  'abdomen': ['frente', 'abdominales'],
  'abdomen>recto abdominal': ['frente', 'abdominales'],
  'abdomen>transverso': ['frente', 'abdominales'],                 // ≈
  'abdomen>oblicuos': ['frente', 'oblicuos'],
  'abductor - tfl': ['perfil', 'tensor_fascia_lata'],
  'aductores': ['frente', 'aductores'],
  'aductores>corto': ['frente', 'aductores'], 'aductores>gracil': ['frente', 'aductores'],
  'aductores>largo': ['frente', 'aductores'], 'aductores>mayor': ['frente', 'aductores'],
  'biceps': ['frente', 'biceps'],
  'biceps>braquial': ['frente', 'biceps'], 'biceps>braquial anterior': ['frente', 'biceps'],
  'biceps>coracobraquial': ['frente', 'biceps'],
  'braquioradial': ['frente', 'flexores_antebrazo'],                // ≈
  'cervical': ['frente', 'esternocleidomastoideo'],                 // ≈
  'cervical>ecom': ['frente', 'esternocleidomastoideo'],
  'cervical>escalenos': ['frente', 'esternocleidomastoideo'],       // ≈
  'cuadriceps': ['perfil', 'cuadriceps'],
  'cuadriceps>recto femoral': ['perfil', 'recto_femoral'],
  'cuadriceps>vasto intermedio': ['perfil', 'cuadriceps'],
  'cuadriceps>vasto lateral': ['perfil', 'cuadriceps'],
  'cuadriceps>vasto medial': ['frente', 'vasto_medial'],
  'espalda': ['espalda', 'erectores_espinales'],                    // ≈
  'espalda>cuadrado lumbar': ['perfil', 'cuadrado_lumbar'],
  'espalda>dorsal ancho': ['espalda', 'dorsal_ancho'],
  'espalda>elevador de la escapula': ['espalda', 'elevador_escapula'],
  'espalda>erectores espinales': ['espalda', 'erectores_espinales'],
  'espalda>multifidos': ['espalda', 'erectores_espinales'],         // ≈
  'espalda>semiespinoso': ['espalda', 'erectores_espinales'],       // ≈
  'espalda>romboides mayor': ['espalda', 'romboides'],
  'espalda>romboides menor': ['espalda', 'romboides'],
  'espalda>serrato superior': ['frente', 'serrato_anterior'],       // ≈
  'espalda>serrato inferior': ['frente', 'serrato_anterior'],       // ≈
  'extensor de dedos': ['espalda', 'extensores_antebrazo'],
  'extensor de munecas': ['espalda', 'extensores_antebrazo'],
  'flexor de dedos': ['frente', 'flexores_antebrazo'],
  'flexor de muneca': ['frente', 'flexores_antebrazo'],
  'gluteo': ['espalda', 'gluteo_mayor'],
  'gluteo>gluteo mayor': ['espalda', 'gluteo_mayor'],
  'gluteo>gluteo medio': ['espalda', 'gluteo_medio'],
  'gluteo>gluteo menor': ['espalda', 'gluteo_medio'],              // ≈
  'gluteo - piramidal': ['espalda', 'piramidal'],
  'hombro': ['frente', 'deltoides'],
  'hombro>deltoides': ['frente', 'deltoides'],
  'hombro>anterior': ['frente', 'deltoides'],
  'hombro>medio': ['frente', 'deltoides'],
  'hombro>posterior': ['perfil', 'deltoides_posterior'],
  'hombro>manguito rotador': ['espalda', 'infraespinoso'],          // ≈
  'hombro>infraespinoso': ['espalda', 'infraespinoso'],
  'hombro>redondo menor': ['espalda', 'infraespinoso'],             // ≈
  'hombro>supraespinoso': ['espalda', 'supraespinoso'],
  'hombro>subescapular': ['espalda', 'infraespinoso'],              // ≈
  'isquiotibial': ['espalda', 'isquiotibiales'],
  'isquiotibial>biceps femoral': ['espalda', 'isquiotibiales'],
  'isquiotibial>semimembranoso': ['espalda', 'isquiotibiales'],
  'isquiotibial>semitendinoso': ['espalda', 'isquiotibiales'],
  'pectoral': ['frente', 'pectoral'],
  'pectoral>mayor': ['frente', 'pectoral'], 'pectoral>menor': ['frente', 'pectoral'],
  'psoas': ['frente', 'psoas_iliaco'],
  'tibial': ['frente', 'tibial_anterior'],
  'tibial>tibial anterior': ['frente', 'tibial_anterior'],
  'tibial>tibial posterior': ['espalda', 'tibial_posterior'],
  'peroneos': ['espalda', 'peroneos'],
  'sartorio': ['frente', 'sartorio'],
  'diafragma': ['frente', 'diafragma'],
  'intercostales': ['frente', 'intercostales'],
  'dedos': ['frente', 'dedos'],
  'dedos>extrinseca': ['frente', 'dedos'],
  'dedos>intrinseca': ['frente', 'mano'],
  'dedos>1º metacarpiano': ['frente', 'mano'],
  'trapecio': ['espalda', 'trapecio'],
  'trapecio>inferior': ['espalda', 'trapecio'], 'trapecio>medio': ['espalda', 'trapecio'],
  'trapecio>superior': ['espalda', 'trapecio'],
  'triceps': ['espalda', 'triceps'],
  'triceps>corto': ['espalda', 'triceps'], 'triceps>largo': ['espalda', 'triceps'], 'triceps>medio': ['espalda', 'triceps'],
  'triceps sural': ['espalda', 'gemelos'],
  'triceps sural>gastronecmio': ['espalda', 'gemelos'],
  'triceps sural>soleo': ['espalda', 'gemelos'],                    // ≈ hasta tener su capa
}

const n = (s: string) => normalizar(s || '').trim()

/** "raíz>hija" de una etiqueta (la raíz sola si no tiene madre). Nietas: raíz>nieta. */
function camino(etiquetas: any[], et: any): string {
  let raiz = et
  const vistos = new Set<string>()
  while (raiz?.padre_id && !vistos.has(raiz.id)) {
    vistos.add(raiz.id)
    const p = etiquetas.find(e => e.id === raiz.padre_id)
    if (!p) break
    raiz = p
  }
  return raiz.id === et.id ? n(et.nombre) : `${n(raiz.nombre)}>${n(et.nombre)}`
}

/**
 * La figura de un ejercicio: la vista que más músculos suyos enseña y sus capas.
 * null si ninguna etiqueta suya tiene capa (entonces se queda el icono de siempre).
 */
export function figuraDe(etiquetasEj: string[] = [], etiquetas: any[] = []): { vista: Vista, capas: string[] } | null {
  const porVista: Record<Vista, Set<string>> = { frente: new Set(), espalda: new Set(), perfil: new Set() }
  for (const id of etiquetasEj || []) {
    const et = etiquetas.find(e => e.id === id)
    // Solo músculos: un nombre repetido en otra categoría no debe pintar nada.
    if (!et || categoriaDe(etiquetas, et) !== 'musculo') continue
    const c = CAPA[camino(etiquetas, et)]
    if (c) porVista[c[0]].add(c[1])
  }
  const orden: Vista[] = ['frente', 'espalda', 'perfil']
  const vista = orden.reduce((a, b) => porVista[b].size > porVista[a].size ? b : a, 'frente' as Vista)
  if (porVista[vista].size === 0) return null
  return { vista, capas: Array.from(porVista[vista]) }
}

// SVG: las capas se redibujaron como vector desde las webp (potrace). Se ven nítidas a
// cualquier tamaño; las webp de 360x640 se veían borrosas al ampliarlas en el rosco.
export const urlCapa = (vista: Vista, capa: string) => `/cuerpo/${vista}_${capa}.svg`

/**
 * Altura de cada capa dentro de la figura (de 0, la cabeza, a 1, los pies), para
 * encuadrar la imagen en lo que trabaja: en una tarjeta cuadrada la figura entera
 * deja dos franjas vacías a los lados, y un curl no necesita enseñar los pies.
 * Medido de las capas al generarlas.
 */
const ALTURA: Record<string, [number, number]> = {
  espalda_dorsal_ancho:[0.297,0.442], espalda_elevador_escapula:[0.142,0.220], espalda_erectores_espinales:[0.258,0.456], espalda_extensores_antebrazo:[0.373,0.527],
  espalda_gemelos:[0.720,0.856], espalda_gluteo_mayor:[0.453,0.555], espalda_gluteo_medio:[0.481,0.566], espalda_infraespinoso:[0.206,0.258],
  espalda_isquiotibiales:[0.558,0.723], espalda_peroneos:[0.719,0.923], espalda_piramidal:[0.533,0.567], espalda_romboides:[0.209,0.311],
  espalda_supraespinoso:[0.211,0.234], espalda_tibial_posterior:[0.789,0.936], espalda_trapecio:[0.134,0.334], espalda_triceps:[0.281,0.388],
  frente_abdominales:[0.333,0.492], frente_aductores:[0.522,0.655], frente_biceps:[0.275,0.380], frente_dedos:[0.541,0.577],
  frente_deltoides:[0.197,0.281], frente_diafragma:[0.292,0.352], frente_esternocleidomastoideo:[0.150,0.212], frente_flexores_antebrazo:[0.347,0.473],
  frente_intercostales:[0.242,0.375], frente_mano:[0.487,0.548], frente_oblicuos:[0.312,0.455], frente_pectoral:[0.234,0.333],
  frente_psoas_iliaco:[0.403,0.506], frente_sartorio:[0.469,0.709], frente_serrato_anterior:[0.305,0.380], frente_tibial_anterior:[0.736,0.870],
  frente_vasto_medial:[0.548,0.670], perfil_cuadrado_lumbar:[0.352,0.441], perfil_cuadriceps:[0.527,0.689], perfil_deltoides_posterior:[0.191,0.294],
  perfil_gemelos:[0.706,0.869], perfil_gluteo_mayor:[0.438,0.527], perfil_isquiotibiales:[0.559,0.691], perfil_recto_femoral:[0.461,0.692],
  perfil_tensor_fascia_lata:[0.427,0.558],
}

/** Proporción alto/ancho de las capas (360 x 640). */
export const PROPORCION = 640 / 360

/**
 * Encuadre en un hueco CUADRADO: qué ancho darle a la figura (en % del hueco) y a qué
 * altura ponerla para que lo que trabaja quede centrado. Si los músculos caben en el
 * cuadrado con la figura a todo lo ancho, se amplía; si van de los hombros a los
 * pies, se aleja lo justo para que entren.
 */
export function encuadre(vista: Vista, capas: string[]): { ancho: number, arriba: number } {
  const hs = capas.map(c => ALTURA[`${vista}_${c}`]).filter(Boolean)
  const y0 = hs.length ? Math.min(...hs.map(h => h[0])) : .03
  const y1 = hs.length ? Math.max(...hs.map(h => h[1])) : .97
  const ventana = Math.max(y1 - y0 + .14, 1 / PROPORCION)   // lo que se ve, en fracción del alto de la figura
  const k = Math.min(1, 1 / (ventana * PROPORCION))         // ancho de la figura / lado del cuadrado
  const alto = k * PROPORCION                                // alto de la figura / lado del cuadrado
  let arriba = .5 - ((y0 + y1) / 2) * alto                   // posición vertical, en fracción del lado
  if (alto >= 1) arriba = Math.min(0, Math.max(1 - alto, arriba)) // sin dejar huecos arriba ni abajo
  return { ancho: k * 100, arriba: arriba * 100 }
}

// ---------------------------------------------------------------------------
// POSTURA Y MATERIAL: otras dos piezas de la imagen automática.
//
// Si el ejercicio tiene una etiqueta de Posición con dibujo (tumbado, sentado,
// cuadrupedia…), la imagen es esa postura: dice más del ejercicio que los músculos
// sobre un cuerpo de pie. Las variantes son etiquetas hijas ("Supino > Rodillas
// flexionadas"); si solo tiene la raíz, sale la postura básica. Bipedestación y
// Cambiante no tienen dibujo: ahí siguen los músculos.
//
// El material va como insignia en una esquina (hasta dos). Dibujarlo en la mano de
// cada postura serían cientos de dibujos; en la esquina se reconoce igual.
// Todo son SVG redibujados desde hojas de Canva (public/postura, public/material).
// ---------------------------------------------------------------------------
const POSTURA: Record<string, string> = {
  'sentado': 'sentado', 'sentado>en el suelo': 'sentado_en_el_suelo',
  'supino': 'supino', 'supino>rodillas flexionadas': 'supino_rodillas_flexionadas',
  'supino>piernas a 90': 'supino_piernas_a_90', 'supino>en banco': 'supino_en_banco',
  'supino>rodillas al pecho': 'supino_rodillas_al_pecho', 'supino>puente': 'supino_puente',
  'prono>esfinge': 'prono_esfinge', 'cuadrupedia>rodillas elevadas': 'cuadrupedia_rodillas_elevadas',
  'prono': 'prono', 'prono>sobre antebrazos': 'prono_sobre_antebrazos', 'prono>brazos estirados': 'prono_brazos_estirados',
  'decubito lateral': 'decubito_lateral', 'decubito lateral>rodillas flexionadas': 'decubito_lateral_rodillas_flexionadas',
  'decubito lateral>plancha lateral': 'decubito_lateral_plancha_lateral',
  'cuadrupedia': 'cuadrupedia', 'arrodillado': 'arrodillado', 'caballero': 'caballero',
}
// Los parecidos comparten dibujo (Goma = Banda elástica, Cajón pliométrico = Cajón).
const MATERIAL: Record<string, string> = {
  'aro': 'aro', 'balon medicinal': 'balon_medicinal', 'banco': 'banco',
  'banda elastica': 'banda_elastica', 'goma': 'banda_elastica', 'mini band': 'mini_band',
  'barra': 'barra_olimpica', 'barra>barra olimpica': 'barra_olimpica', 'barra>barra corta': 'barra_corta',
  'barra de dominadas': 'barra_de_dominadas', 'bosu': 'bosu',
  'cajon': 'cajon', 'cajon pliometrico': 'cajon', 'plataforma': 'plataforma',
  'cinchas de suspension': 'cinchas_de_suspension', 'cuerda': 'cuerda', 'cuna': 'cuna',
  'deslizador': 'deslizador', 'disco': 'disco', 'fitball': 'fitball', 'kettlebell': 'kettlebell',
  'landmine': 'landmine', 'mancuerna': 'mancuerna', 'pared': 'pared', 'pelota': 'pelota',
  'polea': 'polea', 'rack': 'rack',
  'roller': 'roller', 'rueda abdominal': 'rueda_abdominal', 'saco': 'saco', 'stick': 'stick', 'valla': 'valla',
}
/* Solo las de SU categoría: "Prono" es una posición y también un agarre, y un
   ejercicio con agarre prono salía dibujado tumbado boca abajo. */
const caminosDe = (etiquetasEj: string[], etiquetas: any[], categoria: string) =>
  (etiquetasEj || []).map(id => etiquetas.find(e => e.id === id))
    .filter(et => et && categoriaDe(etiquetas, et) === categoria).map(et => camino(etiquetas, et))

/** La postura que dibujar, o null. Una hija ("supino>en banco") gana a su raíz. */
export function posturaDe(etiquetasEj: string[] = [], etiquetas: any[] = []): string | null {
  const cs = caminosDe(etiquetasEj, etiquetas, 'posicion').filter(c => POSTURA[c])
  const c = cs.find(x => x.includes('>')) || cs[0]
  return c ? POSTURA[c] : null
}

/** Los materiales con dibujo, sin repetir; si está la hija, la raíz sobra. */
export function materialesDe(etiquetasEj: string[] = [], etiquetas: any[] = [], max = 2): string[] {
  const cs = caminosDe(etiquetasEj, etiquetas, 'material').filter(c => MATERIAL[c])
  const sin = cs.filter(c => c.includes('>') || !cs.some(x => x.startsWith(c + '>')))
  return Array.from(new Set(sin.map(c => MATERIAL[c]))).slice(0, max)
}

/* COMBINACIONES: una postura con un material puede ser otro dibujo (supino con los
   pies en el fitball no es "supino" con una pelota en la esquina). Clave
   "postura+material" con los nombres de archivo de arriba; el dibujo vive en
   public/postura. Si la combinación no tiene dibujo, se queda la postura y el
   material en la insignia, como hasta ahora. Se van añadiendo según haya imágenes. */
// Las de rodillas flexionadas valen también para la raíz: "supino + mini band" casi
// siempre es con las rodillas dobladas, y si no, mejor eso que una pelota en la esquina.
const COMBINADA: Record<string, string> = {
  'supino+fitball': 'supino_con_fitball', 'sentado+fitball': 'sentado_con_fitball', 'prono+fitball': 'prono_con_fitball',
  'supino_rodillas_flexionadas+mini_band': 'supino_rodillas_flexionadas_con_mini_band',
  'supino+mini_band': 'supino_rodillas_flexionadas_con_mini_band',
  'decubito_lateral_rodillas_flexionadas+mini_band': 'decubito_lateral_rodillas_flexionadas_con_mini_band',
  'decubito_lateral+mini_band': 'decubito_lateral_rodillas_flexionadas_con_mini_band',
  'caballero+banda_elastica': 'caballero_con_banda', 'caballero+polea': 'caballero_con_polea',
  'supino_rodillas_flexionadas+roller': 'supino_rodillas_flexionadas_con_roller',
  'supino+roller': 'supino_rodillas_flexionadas_con_roller',
  'decubito_lateral+roller': 'decubito_lateral_con_roller',
  'sentado_en_el_suelo+roller': 'sentado_en_el_suelo_con_roller',
  'prono+banco': 'prono_con_banco', 'cuadrupedia+bosu': 'cuadrupedia_con_bosu',
}

/** La imagen completa: la postura (o su combinación con un material) y las insignias que sobran. */
export function figuraCompleta(etiquetasEj: string[] = [], etiquetas: any[] = []): { postura: string | null, materiales: string[] } {
  const postura = posturaDe(etiquetasEj, etiquetas)
  const materiales = materialesDe(etiquetasEj, etiquetas, 3)
  if (postura) for (const m of materiales) {
    const c = COMBINADA[`${postura}+${m}`]
    // El material ya sale dibujado en la postura: no se repite en la esquina.
    if (c) return { postura: c, materiales: materiales.filter(x => x !== m).slice(0, 2) }
  }
  return { postura, materiales: materiales.slice(0, 2) }
}

export const urlPostura = (p: string) => `/postura/${p}.svg`
export const urlMaterial = (m: string) => `/material/${m}.svg`

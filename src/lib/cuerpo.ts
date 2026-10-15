import { normalizar } from './texto'

// ---------------------------------------------------------------------------
// LA FIGURA DE LOS MÚSCULOS: imagen automática de un ejercicio por sus etiquetas.
//
// Para los ejercicios sin foto. Una figura base (de frente, de espalda o de perfil)
// y encima, en amarillo, las capas de los músculos que lleva el ejercicio. Las capas
// salen de hojas hechas en Canva, separadas por color y encajadas a la figura de su
// vista; viven en /public/cuerpo como `vista_musculo.webp`, todas del mismo tamaño
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
  'cuadriceps>vasto medial': ['perfil', 'cuadriceps'],
  'espalda': ['espalda', 'erectores_espinales'],                    // ≈
  'espalda>cuadrado lumbar': ['perfil', 'cuadrado_lumbar'],
  'espalda>dorsal ancho': ['espalda', 'dorsal_ancho'],
  'espalda>elevador de la escapula': ['espalda', 'trapecio'],       // ≈
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
  'gluteo - piramidal': ['espalda', 'gluteo_mayor'],                // ≈
  'hombro': ['frente', 'deltoides'],
  'hombro>deltoides': ['frente', 'deltoides'],
  'hombro>anterior': ['frente', 'deltoides'],
  'hombro>medio': ['frente', 'deltoides'],
  'hombro>posterior': ['perfil', 'deltoides_posterior'],
  'hombro>manguito rotador': ['espalda', 'infraespinoso'],          // ≈
  'hombro>infraespinoso': ['espalda', 'infraespinoso'],
  'hombro>redondo menor': ['espalda', 'infraespinoso'],             // ≈
  'hombro>supraespinoso': ['espalda', 'infraespinoso'],             // ≈
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
    if (!et) continue
    const c = CAPA[camino(etiquetas, et)]
    if (c) porVista[c[0]].add(c[1])
  }
  const orden: Vista[] = ['frente', 'espalda', 'perfil']
  const vista = orden.reduce((a, b) => porVista[b].size > porVista[a].size ? b : a, 'frente' as Vista)
  if (porVista[vista].size === 0) return null
  return { vista, capas: Array.from(porVista[vista]) }
}

export const urlCapa = (vista: Vista, capa: string) => `/cuerpo/${vista}_${capa}.webp`

/**
 * Altura de cada capa dentro de la figura (de 0, la cabeza, a 1, los pies), para
 * encuadrar la imagen en lo que trabaja: en una tarjeta cuadrada la figura entera
 * deja dos franjas vacías a los lados, y un curl no necesita enseñar los pies.
 * Medido de las capas al generarlas.
 */
const ALTURA: Record<string, [number, number]> = {
  espalda_dorsal_ancho:[.297,.442], espalda_erectores_espinales:[.258,.456], espalda_extensores_antebrazo:[.373,.527],
  espalda_gemelos:[.72,.856], espalda_gluteo_mayor:[.453,.555], espalda_gluteo_medio:[.481,.566], espalda_infraespinoso:[.206,.258],
  espalda_isquiotibiales:[.558,.723], espalda_romboides:[.209,.311], espalda_trapecio:[.134,.334], espalda_triceps:[.281,.388],
  frente_abdominales:[.333,.492], frente_aductores:[.522,.655], frente_biceps:[.275,.38], frente_deltoides:[.197,.281],
  frente_esternocleidomastoideo:[.15,.212], frente_flexores_antebrazo:[.347,.473], frente_oblicuos:[.312,.455], frente_pectoral:[.234,.333],
  frente_psoas_iliaco:[.403,.506], frente_serrato_anterior:[.305,.38], frente_tibial_anterior:[.736,.87],
  perfil_cuadrado_lumbar:[.352,.441], perfil_cuadriceps:[.527,.689], perfil_deltoides_posterior:[.191,.294], perfil_gemelos:[.706,.869],
  perfil_gluteo_mayor:[.438,.527], perfil_isquiotibiales:[.559,.691], perfil_recto_femoral:[.461,.692], perfil_tensor_fascia_lata:[.427,.558],
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

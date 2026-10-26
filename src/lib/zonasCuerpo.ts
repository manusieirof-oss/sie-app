// ---------------------------------------------------------------------------
// ZONAS DEL CUERPO sobre la figura (/cuerpo/{frente,espalda}_base.svg, 360x640).
// Las usan el filtro de la biblioteca (musculos y articulaciones de cada zona) y los
// tests (que zonas testear en la valoracion, y el mapa de calor de la ficha).
// Cada rectangulo va en % del ancho y alto de la figura.
// ---------------------------------------------------------------------------

export type ZonaCuerpo = {
  id: string, nombre: string
  /** Musculos y articulaciones de la zona, por nombre (filtro de la biblioteca). */
  mus: RegExp, art: RegExp
  /** Para los tests: mas estricto. "Columna" a secas no es de ninguna zona concreta. */
  test: RegExp
  frente?: number[][], espalda?: number[][]
}

export const ZONAS_CUERPO: ZonaCuerpo[] = [
  { id: 'cuello', nombre: 'Cuello', mus: /cervical|ecom|escalen|trapecio|elevador/, art: /cervical|columna/, test: /cervical|cuello|ecom|escalen/, frente: [[44, 13, 12, 7]], espalda: [[44, 13, 12, 7]] },
  { id: 'hombro', nombre: 'Hombro', mus: /hombro|deltoid|manguito|supraesp|infraesp|redondo|subescap|trapecio/, art: /hombro|escapul/, test: /hombro|glenohumeral|manguito|deltoid|supraesp|infraesp|subescap|acromi/, frente: [[25, 20, 16, 9], [59, 20, 16, 9]], espalda: [[25, 20, 16, 9], [59, 20, 16, 9]] },
  { id: 'pecho', nombre: 'Pecho', mus: /pectoral|serrato|intercostal|diafragma/, art: /hombro|torac|costal|columna/, test: /pectoral|costal|esternon|diafragma/, frente: [[40, 21, 20, 12]] },
  { id: 'espalda', nombre: 'Espalda', mus: /espalda|dorsal|romboid|trapecio|erector|multif|semiesp|serrato/, art: /columna|dorsal|toracic|hombro|escapul/, test: /dorsal|toracic|escapul|romboid|serrato/, espalda: [[38, 20, 24, 15]] },
  { id: 'brazo', nombre: 'Brazo', mus: /bicep(?!s femoral)|braquial|tricep(?!s sural)|coraco/, art: /codo|hombro/, test: /codo|bicep(?!s femoral)|tricep(?!s sural)|epicond|epitroc/, frente: [[19, 28, 13, 13], [68, 28, 13, 13]], espalda: [[19, 28, 13, 13], [68, 28, 13, 13]] },
  { id: 'antebrazo', nombre: 'Antebrazo y mano', mus: /antebrazo|flexor|extensor|braquiorad|braquioradial|dedos|mano|muneca|pronador|supinador/, art: /muneca|mano|codo|dedo/, test: /muneca|mano|dedo|antebrazo|carp|prension|agarre/, frente: [[10, 41, 17, 21], [73, 41, 17, 21]], espalda: [[10, 41, 17, 21], [73, 41, 17, 21]] },
  { id: 'abdomen', nombre: 'Abdomen', mus: /abdom|oblicu|transvers|psoas|diafragma/, art: /columna|lumbar|pelvis/, test: /abdom|oblicu|transvers|core|suelo pelvico/, frente: [[38, 33, 24, 12]] },
  { id: 'lumbar', nombre: 'Zona lumbar', mus: /lumbar|cuadrado|erector|multif/, art: /columna|lumbar|pelvis|sacro/, test: /lumbar|sacro|cuadrado lumbar|lumbo/, espalda: [[38, 35, 24, 10]] },
  { id: 'cadera', nombre: 'Cadera y glúteo', mus: /gluteo|piramidal|tfl|tensor|abductor|aductor|gracil|psoas|sartorio/, art: /cadera|pelvis|sacro/, test: /cadera|pelvi|gluteo|piramidal|psoas|aductor|abductor|tfl|tensor/, frente: [[31, 45, 38, 9]], espalda: [[31, 45, 38, 10]] },
  { id: 'muslo', nombre: 'Muslo', mus: /cuadricep|vasto|recto femoral|isquio|femoral|semiten|semimem|aductor|sartorio|gracil/, art: /cadera|rodilla/, test: /cuadricep|vasto|recto femoral|isquio|muslo/, frente: [[32, 54, 37, 18]], espalda: [[32, 55, 37, 17]] },
  { id: 'rodilla', nombre: 'Rodilla', mus: /cuadricep|vasto|isquio|popliteo|gemel/, art: /rodilla/, test: /rodilla|rotul|menisc|cruzado|colateral|popliteo/, frente: [[31, 72, 38, 6]], espalda: [[31, 72, 38, 6]] },
  { id: 'pierna', nombre: 'Pierna', mus: /tibial|perone|gemel|soleo|sural|gastro/, art: /tobillo|rodilla/, test: /gemel|soleo|sural|tibial|perone|pierna|gastro/, frente: [[30, 78, 40, 14]], espalda: [[30, 78, 40, 14]] },
  { id: 'pie', nombre: 'Tobillo y pie', mus: /pie|plantar|tibial posterior|dedos del pie|halux/, art: /tobillo|pie|halux|dedo/, test: /tobillo|pie|plantar|halux|aquiles|astragal|calcane/, frente: [[26, 92, 48, 7]], espalda: [[26, 92, 48, 7]] },
]

export const nrmZona = (t: string) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** El nombre de la etiqueta y los de todas sus madres ("Rodilla > Rotula"). */
function nombresConMadres(etiquetas: any[], id: string): string[] {
  const out: string[] = []
  let et = etiquetas.find(e => e.id === id), n = 0
  while (et && n++ < 8) { out.push(nrmZona(et.nombre)); et = et.padre_id ? etiquetas.find(e => e.id === et.padre_id) : null }
  return out
}

/** En que zonas cae un test, por sus etiquetas (y su nombre, si no lleva ninguna que case). */
export function zonasDeTest(test: any, etiquetas: any[]): string[] {
  const nombres = (test?.etiquetas_relacionadas || []).flatMap((id: string) => nombresConMadres(etiquetas, id))
  let zs = ZONAS_CUERPO.filter(z => nombres.some((n: string) => z.test.test(n))).map(z => z.id)
  if (!zs.length) { const n = nrmZona(test?.nombre || ''); zs = ZONAS_CUERPO.filter(z => z.test.test(n)).map(z => z.id) }
  return zs
}

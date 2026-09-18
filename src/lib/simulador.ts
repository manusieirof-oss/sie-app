// ---------------------------------------------------------------------------
// PROBAR ANTES DE DECIDIR
//
// No guarda nada ni toca la base de datos: coge tus cifras reales y responde
// "¿y si...?". Contratar, comprar una máquina, subir precios.
//
// Las cuentas viven aquí y no en la pantalla por lo de siempre: si mañana
// cambia el tipo de la Seguridad Social, se cambia en un sitio.
// ---------------------------------------------------------------------------

/**
 * Lo que cuesta de verdad un trabajador.
 *
 * El bruto no es el coste: encima va la Seguridad Social de empresa, que ronda
 * un tercio más. Contratar a alguien por 1.200 € cuesta unos 1.600 €.
 *
 * El tipo es aproximado —depende del contrato, del grupo de cotización y de las
 * bonificaciones— así que se deja tocar. El 32% es el orden de magnitud normal.
 */
export const SS_EMPRESA_PCT = 32

export function costeTrabajador(brutoMensual: number, ssPct = SS_EMPRESA_PCT, pagas = 12) {
  const brutoAnual = brutoMensual * pagas
  const brutoMes = brutoAnual / 12          // prorrateado, que es como pesa en el mes
  const ss = brutoMes * (ssPct / 100)
  return { brutoMes, ss, coste: brutoMes + ss, costeAnual: (brutoMes + ss) * 12 }
}

export type ModoCompra = 'contado' | 'financiado' | 'renting' | 'leasing'

/**
 * Lo que cuesta una máquina según cómo la pagues.
 *
 *   contado / financiado → la compras: el IVA te lo deduces de una vez y el
 *                          bien se amortiza en varios años.
 *   renting              → es un alquiler: la cuota entera es gasto y el IVA
 *                          se deduce mes a mes. No es tuya al acabar.
 *   leasing              → alquiler con opción de compra: cuota deducible, y al
 *                          final decides si la compras por el valor residual.
 *
 * La diferencia importa: en compra descuentas 5.000 € de golpe del bolsillo
 * pero solo una parte es gasto del año; en renting no sale nada de golpe pero
 * todo es gasto.
 */
export function costeCompra(args: {
  precioSinIva: number
  ivaPct?: number
  modo: ModoCompra
  meses?: number
  interesPct?: number
  anosAmortizacion?: number
  valorResidual?: number
}) {
  const { precioSinIva, ivaPct = 21, modo, meses = 48, interesPct = 0,
          anosAmortizacion = 5, valorResidual = 0 } = args
  const iva = precioSinIva * (ivaPct / 100)
  const total = precioSinIva + iva

  if (modo === 'contado') {
    return {
      desembolsoInicial: total,
      cuotaMes: 0,
      ivaRecuperable: iva,
      gastoDeducibleMes: precioSinIva / (anosAmortizacion * 12),
      nota: `Se amortiza en ${anosAmortizacion} años: cada mes te deduces solo una parte.`,
    }
  }
  if (modo === 'financiado') {
    const i = interesPct / 100 / 12
    const cuota = i > 0
      ? (total * i) / (1 - Math.pow(1 + i, -meses))
      : total / meses
    const intereses = cuota * meses - total
    return {
      desembolsoInicial: 0,
      cuotaMes: cuota,
      ivaRecuperable: iva,
      gastoDeducibleMes: precioSinIva / (anosAmortizacion * 12) + intereses / meses,
      nota: `La cuota no es gasto: lo son la amortización y los intereses (${intereses.toFixed(0)} € en total).`,
    }
  }
  const base = (precioSinIva - valorResidual) / meses
  return {
    desembolsoInicial: 0,
    cuotaMes: base * (1 + ivaPct / 100),
    ivaRecuperable: base * (ivaPct / 100) * meses,
    gastoDeducibleMes: base,
    nota: modo === 'renting'
      ? 'Cuota entera deducible. Al acabar no es tuya.'
      : `Cuota deducible. Al acabar puedes comprarla por ${valorResidual.toFixed(0)} €.`,
  }
}

/**
 * Qué pasa si subes los precios.
 *
 * Subir un 5% no da un 5% más: alguien se va. La pregunta útil no es cuánto
 * ganarías, es cuántas bajas aguantas antes de estar peor que ahora.
 */
export function simularSubida(args: {
  ingresoActual: number
  nClientes: number
  subidaPct: number
  bajasEsperadas: number
}) {
  const { ingresoActual, nClientes, subidaPct, bajasEsperadas } = args
  if (nClientes <= 0) return { nuevo: 0, diferencia: 0, bajasLimite: 0, quedan: 0, nuevoPrecio: 0, porCliente: 0 }
  const porCliente = ingresoActual / nClientes
  const nuevoPrecio = porCliente * (1 + subidaPct / 100)
  const quedan = Math.max(0, nClientes - bajasEsperadas)
  const nuevo = quedan * nuevoPrecio
  const bajasLimite = nuevoPrecio > 0
    ? Math.floor(nClientes - ingresoActual / nuevoPrecio)
    : 0
  return { nuevo, diferencia: nuevo - ingresoActual, bajasLimite, quedan, nuevoPrecio, porCliente }
}


/**
 * QUÉ PASA CON EL BENEFICIO SI TOCAS ALGO.
 *
 * El coste de una decisión se entiende comparándolo con lo que dejas ahora, no
 * suelto. Y a varios plazos: 300 € al mes suenan a poco hasta que ves que son
 * 3.600 € al año.
 *
 * Se parte de un MES TIPO —la media de los meses ya cerrados— y no del mes en
 * curso: el actual va a medias, con gastos sin confirmar, y compararse contra
 * él daría una mejora que no existe.
 */
export const HORIZONTES = [
  { id: 'mes', nombre: 'Un mes', meses: 1 },
  { id: 'trimestre', nombre: 'Un trimestre', meses: 3 },
  { id: 'semestre', nombre: 'Medio año', meses: 6 },
  { id: 'anio', nombre: 'Un año', meses: 12 },
] as const

export function compararBeneficio(args: {
  ingresoMes: number
  gastoMes: number
  costeExtraMes?: number
  ingresoExtraMes?: number
  /** Lo que sale de golpe una sola vez: una compra al contado. */
  desembolsoUnico?: number
}) {
  const { ingresoMes, gastoMes, costeExtraMes = 0, ingresoExtraMes = 0, desembolsoUnico = 0 } = args
  const antesMes = ingresoMes - gastoMes
  const despuesMes = (ingresoMes + ingresoExtraMes) - (gastoMes + costeExtraMes)
  return HORIZONTES.map(h => {
    const antes = antesMes * h.meses
    // El desembolso único pesa una vez, no cada mes.
    const despues = despuesMes * h.meses - desembolsoUnico
    return { ...h, antes, despues, diferencia: despues - antes }
  })
}


// ---------------------------------------------------------------------------
// REPARTIR: DE DÓNDE SALEN LAS PORCIONES
//
// Ingresos, gastos fijos y gastos variables son tres preguntas distintas y no
// se mezclan en el mismo rosco: bajar el alquiler y bajar el material no son
// la misma decisión.
//
// Cada porción es una CATEGORÍA y dentro lleva sus CONCEPTOS, que es donde de
// verdad se decide. "Suministros 400 €" no dice nada; "luz 280, agua 60,
// internet 60" sí.
//
// Siempre sobre la media de los meses YA CERRADOS: el mes en curso va a medias
// y promediarlo hundiría todas las categorías a la vez.
// ---------------------------------------------------------------------------

export type Concepto = { nombre: string; valor: number }
export type CatReparto = { nombre: string; valor: number; conceptos: Concepto[] }

function agrupar(
  filas: any[], mesActual: string,
  mes: (f: any) => string, cat: (f: any) => string,
  con: (f: any) => string, val: (f: any) => number,
): CatReparto[] {
  const todos = Array.from(new Set(filas.map(mes).filter(Boolean)))
  const cerrados = todos.filter(m => m < mesActual)
  // Sin meses cerrados todavía, mejor el mes en curso que un rosco vacío.
  const ks = new Set(cerrados.length ? cerrados : todos)
  const n = ks.size || 1
  const acc: Record<string, Record<string, number>> = {}
  filas.forEach(f => {
    if (!ks.has(mes(f))) return
    const c = cat(f), k = con(f)
    acc[c] = acc[c] || {}
    acc[c][k] = (acc[c][k] || 0) + val(f)
  })
  return Object.entries(acc)
    .map(([nombre, conceptos]) => ({
      nombre,
      valor: Object.values(conceptos).reduce((a, b) => a + b, 0) / n,
      conceptos: Object.entries(conceptos)
        .map(([nombre, v]) => ({ nombre, valor: v / n }))
        .sort((a, b) => b.valor - a.valor),
    }))
    .filter(c => c.valor > 0)
    .sort((a, b) => b.valor - a.valor)
}

/** Los gastos de un tipo, por categoría y con sus conceptos dentro. */
export function agruparGastos(gastos: any[] = [], mesActual: string, tipo: 'fijo' | 'variable'): CatReparto[] {
  return agrupar(
    gastos.filter(g => g.fecha && (g.tipo || 'variable') === tipo),
    mesActual,
    g => String(g.fecha).slice(0, 7),
    g => g.categoria || 'Sin categoría',
    g => g.concepto || 'Sin concepto',
    g => Number(g.importe) || 0,
  )
}

/**
 * Los ingresos, que vienen de dos sitios distintos.
 *
 * Las cuotas van todas en una porción con un concepto por plan —lo interesante
 * es cuánto aporta cada plan, no cada paciente—; lo demás (formación, alquiler
 * de sala) por su categoría.
 *
 * El precio y el nombre del plan se piden de fuera para no arrastrar aquí la
 * tabla de bonos ni Supabase: esto son cuentas, no acceso a datos.
 */
export function agruparIngresos(args: {
  bonosHist?: any[]
  ingresos?: any[]
  mesActual: string
  precioBono: (b: any) => number
  nombrePlan: (b: any) => string
}): CatReparto[] {
  const { bonosHist = [], ingresos = [], mesActual, precioBono, nombrePlan } = args
  const filas = [
    ...bonosHist.filter(b => b.mes && b.anio).map(b => ({
      m: `${b.anio}-${String(b.mes).padStart(2, '0')}`,
      c: 'Cuotas', k: nombrePlan(b) || 'Sin plan', v: precioBono(b),
    })),
    ...ingresos.filter(i => i.fecha).map(i => ({
      m: String(i.fecha).slice(0, 7),
      c: i.categoria || 'Otros ingresos', k: i.concepto || 'Sin concepto',
      v: Number(i.importe) || 0,
    })),
  ]
  return agrupar(filas, mesActual, f => f.m, f => f.c, f => f.k, f => f.v)
}


// ---------------------------------------------------------------------------
// LOS DOS MODOS DE MOVER UNA PORCIÓN
//
//   repartir → el total no se mueve. Lo que le das a una, sale de las demás.
//              Es la pregunta de "dónde pongo el dinero que ya gasto".
//   total    → cada categoría va a su aire y el total cambia con ella.
//              Es la pregunta de "y si gasto más en esto".
//
// Y una regla que vale para los dos: LA CATEGORÍA ES LA SUMA DE SUS CONCEPTOS.
// Si tocas un concepto, la categoría sube o baja con él; si tocas la categoría,
// sus conceptos se escalan guardando el peso que tenían. Cualquier otra cosa
// deja el desplegable diciendo algo distinto del rosco.
// ---------------------------------------------------------------------------

export type ModoReparto = 'repartir' | 'total'

export const totalReparto = (cats: CatReparto[]) => cats.reduce((a, c) => a + c.valor, 0)

/** Recoloca los conceptos para que sumen `nuevo` sin cambiar lo que pesa cada uno. */
function escalar(cat: CatReparto, nuevo: number): CatReparto {
  const v = Math.max(0, nuevo)
  const n = cat.conceptos.length
  if (!n) return { ...cat, valor: v, conceptos: [] }
  const suma = cat.conceptos.reduce((a, c) => a + c.valor, 0)
  // A cero no hay proporciones que respetar: se reparte a partes iguales.
  const conceptos = suma > 0
    ? cat.conceptos.map(c => ({ ...c, valor: c.valor * (v / suma) }))
    : cat.conceptos.map(c => ({ ...c, valor: v / n }))
  return { ...cat, valor: v, conceptos }
}

/** Lo que sube en una categoría lo pagan las demás, según lo que pese cada una. */
function compensar(cats: CatReparto[], excepto: string, delta: number): CatReparto[] {
  const suma = cats.filter(c => c.nombre !== excepto).reduce((a, c) => a + c.valor, 0)
  if (suma <= 0) return cats
  return cats.map(c => c.nombre === excepto ? c : escalar(c, c.valor - delta * (c.valor / suma)))
}

export function moverCategoria(cats: CatReparto[], nombre: string, nuevo: number, modo: ModoReparto): CatReparto[] {
  const cat = cats.find(c => c.nombre === nombre)
  if (!cat) return cats
  // Repartiendo nadie puede llevarse más de lo que hay; con el total suelto, sí.
  const tope = totalReparto(cats)
  const v = modo === 'repartir' ? Math.min(Math.max(0, nuevo), tope) : Math.max(0, nuevo)
  const base = cats.map(c => c.nombre === nombre ? escalar(c, v) : c)
  return modo === 'repartir' ? compensar(base, nombre, v - cat.valor) : base
}

export function moverConcepto(cats: CatReparto[], nombreCat: string, nombreCon: string, nuevo: number, modo: ModoReparto): CatReparto[] {
  const cat = cats.find(c => c.nombre === nombreCat)
  const con = cat?.conceptos.find(c => c.nombre === nombreCon)
  if (!cat || !con) return cats
  const resto = totalReparto(cats) - cat.valor
  const v = modo === 'repartir' ? Math.min(Math.max(0, nuevo), con.valor + resto) : Math.max(0, nuevo)
  const delta = v - con.valor
  // La categoría no se escala: se recalcula como suma, que es lo que es.
  const nueva: CatReparto = {
    ...cat,
    valor: cat.valor + delta,
    conceptos: cat.conceptos.map(c => c.nombre === nombreCon ? { ...c, valor: v } : c),
  }
  const base = cats.map(c => c.nombre === nombreCat ? nueva : c)
  return modo === 'repartir' ? compensar(base, nombreCat, delta) : base
}

// ---------------------------------------------------------------------------
// LAS OCHO CASILLAS DEL MES
//
// Cobros mezclaba dos preguntas en una lista: quien viene a la clinica y quien
// paga. Son independientes, y cruzarlas es justo lo que hace falta: quien viene
// y no paga es una conversacion, y quien paga y no viene es otra muy distinta.
//
//                  pagado   pendiente   impago   sin cuota
//   vino             .          .          .         .
//   no vino          .          .          .         .
//
// Cada persona cae en UNA casilla y las ocho suman el total. Si no suman, algo
// se esta contando dos veces o alguien se esta cayendo de la pantalla, que es
// como estaba antes.
//
// IMPAGO ES UN JUICIO, no un hecho: lo marcas tu sobre algo que sigue sin
// cobrarse. Por eso pagado manda sobre impago —si hay cobro, esta pagado, diga
// lo que diga la marca vieja.
// ---------------------------------------------------------------------------

export type EstadoCobro = 'pagado' | 'pendiente' | 'impago' | 'sinCuota'

export type EntradaMes = {
  pacienteId: string
  /** Vino de verdad: al menos una clase realizada. Ni programada ni falta. */
  vino: boolean
  /** null cuando no tiene bono del mes. */
  bono: { pagado: boolean, impago: boolean, importe: number, cobrado: number } | null
  /**
   * Le has cobrado algo este mes sin que hubiera bono detras: una valoracion,
   * una sesion suelta.
   *
   * Sin esto, quien venia a una valoracion y la pagaba se quedaba en "sin
   * cuota" para siempre, que se lee como que no ha pagado. Y no tenia arreglo
   * mirando solo `bonos`: un suelto no crea ninguno, a proposito.
   */
  cobroSuelto?: boolean
}

export type Casilla = { personas: number, importe: number, cobrado: number }
export type ResumenMes = {
  vino: Record<EstadoCobro, Casilla>
  noVino: Record<EstadoCobro, Casilla>
  personas: number
  pendiente: number
  cobrado: number
}

export function estadoDe(e: EntradaMes): EstadoCobro {
  if (e.bono) return e.bono.pagado ? 'pagado' : (e.bono.impago ? 'impago' : 'pendiente')
  // Sin bono pero con cobro: pago lo que consumio. Que no sea una cuota no lo
  // deja a deber nada.
  return e.cobroSuelto ? 'pagado' : 'sinCuota'
}

const vacia = (): Record<EstadoCobro, Casilla> => ({
  pagado:   { personas: 0, importe: 0, cobrado: 0 },
  pendiente:{ personas: 0, importe: 0, cobrado: 0 },
  impago:   { personas: 0, importe: 0, cobrado: 0 },
  sinCuota: { personas: 0, importe: 0, cobrado: 0 },
})

export function resumirMes(entradas: EntradaMes[]): ResumenMes {
  const r: ResumenMes = { vino: vacia(), noVino: vacia(), personas: 0, pendiente: 0, cobrado: 0 }
  entradas.forEach(e => {
    const casilla = (e.vino ? r.vino : r.noVino)[estadoDe(e)]
    casilla.personas += 1
    casilla.importe += e.bono?.importe || 0
    casilla.cobrado += e.bono?.cobrado || 0
    r.personas += 1
    r.cobrado += e.bono?.cobrado || 0
    // Lo pendiente es lo de quien tiene cuota y no la ha pagado, venga o no.
    if (e.bono && !e.bono.pagado) r.pendiente += e.bono.importe
  })
  return r
}

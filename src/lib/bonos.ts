import { supabase } from './supabase'

export type BonoTipo = {
  id: string
  nombre: string
  dias_semana: number
  descripcion: string | null
  orden: number
  activo: boolean
  // Modalidad y sesiones: ver lib/bonoSesiones.ts. Opcionales porque las filas
  // creadas antes del cambio no las traen; ahí `modalidad` se lee como mensual.
  modalidad?: string | null
  sesiones?: number | null
  caduca_meses?: number | null
}

export async function cargarBonosTipos(soloActivos = true): Promise<BonoTipo[]> {
  let q = supabase.from('bonos_tipos').select('*').order('orden')
  if (soloActivos) q = q.eq('activo', true)
  const { data, error } = await q
  if (error) { console.error('Error cargando bonos_tipos:', error.message); return [] }
  return data || []
}

// Cambia el estado de pago de un bono Y registra el evento en el historial del paciente.
// Usar SIEMPRE esta función en vez de update directo, para que quede traza.
export async function cambiarEstadoPago(bono: { id: string, paciente_id: string, estado_pago?: string }, nuevoEstado: string) {
  const anterior = bono.estado_pago || 'pendiente'
  if (anterior === nuevoEstado) return { ok: true }

  const { error } = await supabase.from('bonos').update({ estado_pago: nuevoEstado }).eq('id', bono.id)
  if (error) return { ok: false, error: error.message }

  const LBL: Record<string,string> = { pagado: 'Pagado', pendiente: 'Pendiente', impago: 'Impago' }
  await supabase.from('eventos_paciente').insert({
    paciente_id: bono.paciente_id,
    tipo: 'pago_bono',
    titulo: `Estado de pago: ${LBL[nuevoEstado] || nuevoEstado}`,
    descripcion: `Cambiado de "${LBL[anterior] || anterior}" a "${LBL[nuevoEstado] || nuevoEstado}".`,
    fecha: new Date().toISOString().split('T')[0],
  })
  return { ok: true }
}

// ---------------------------------------------------------------------------
// PRECIO. Único sitio donde se decide qué vale un plan y qué vale un bono.
// Estaba escrito seis veces (ResumenTab, PlanesTab x2, ImpuestosTab x2,
// RentabilidadTab) y ya divergía en los redondeos.
// ---------------------------------------------------------------------------

export const redondear = (n: number) => Math.round(n * 100) / 100

export type Plan = {
  bono_tipo: string
  nombre?: string | null
  precio_base: number
  precio_final?: number | null
  iva: number
}

// Precio final (con IVA) de un plan. `precio_final` es un derivado guardado:
// mientras exista en la tabla manda él, y si falta se recalcula desde la base.
export function precioFinalPlan(plan?: Plan | null): number {
  if (!plan) return 0
  if (plan.precio_final != null) return Number(plan.precio_final)
  return redondear(Number(plan.precio_base) * (1 + Number(plan.iva) / 100))
}

// Desglose fiscal de un plan: qué parte es base y qué parte es IVA repercutido.
export function desglosePlan(plan?: Plan | null): { base: number, iva: number, final: number } {
  const final = precioFinalPlan(plan)
  const pct = Number(plan?.iva || 0)
  const base = pct > 0 ? redondear(final / (1 + pct / 100)) : final
  return { base, iva: redondear(final - base), final }
}

// Índice tipo de bono -> plan. Lo usan las cuatro pestañas.
export function indicePlanes(planes: Plan[] = []): Record<string, Plan> {
  const idx: Record<string, Plan> = {}
  planes.forEach(p => { idx[p.bono_tipo] = p })
  return idx
}

// Lo que ingresa un bono concreto: precio de su plan menos su descuento.
export function precioBono(bono: any, idx: Record<string, Plan>): number {
  return precioConDescuento(precioFinalPlan(idx[bono?.tipo]), bono)
}

export const TIPOS_DESCUENTO = [
  { id: 'porcentaje', label: '% Porcentaje',   ayuda: 'Ej. 10 → un 10% menos' },
  { id: 'fijo',       label: '€ Importe fijo', ayuda: 'Ej. 8 → ocho euros menos' },
  { id: 'precio',     label: '€ Precio pactado', ayuda: 'Ej. 55 → paga 55 € y punto' },
] as const

export const LBL_DESCUENTO: Record<string, string> = {
  porcentaje: 'Porcentaje', fijo: 'Importe fijo', precio: 'Precio pactado',
}

/**
 * Lo que paga un bono, aplicando su descuento. precioBase = precio del plan.
 *
 * Tres formas de decir lo mismo, y la tercera existe por los céntimos: un
 * porcentaje sobre 63 € deja cosas como 55,44 €, que nadie cobra. Con
 * `precio` guardas directamente lo acordado —"a ella la cuota le queda en
 * 55 €"— y el descuento se calcula al revés solo para enseñarlo.
 *
 * Es también lo más fiel a la conversación real: con un cliente se pacta un
 * precio, no un coeficiente.
 */
export function precioConDescuento(precioBase: number, bono: { descuento_tipo?: string|null, descuento_valor?: number|null }): number {
  const valor = bono?.descuento_valor
  if (!bono?.descuento_tipo || valor == null) return precioBase
  // Ojo: el precio pactado SÍ admite 0 (una cuota regalada), así que no vale
  // descartar por falsy como hacen los otros dos.
  if (bono.descuento_tipo === 'precio') return Math.max(0, redondear(Number(valor)))
  if (!valor) return precioBase
  if (bono.descuento_tipo === 'porcentaje') return Math.max(0, redondear(precioBase * (1 - Number(valor)/100)))
  if (bono.descuento_tipo === 'fijo')       return Math.max(0, redondear(precioBase - Number(valor)))
  return precioBase
}

/** Cuánto se le está descontando, en euros, sea cual sea la forma de decirlo. */
export function importeDescuento(precioBase: number, bono: any): number {
  return redondear(precioBase - precioConDescuento(precioBase, bono))
}

/** Cómo se le explica el descuento a alguien que mira la ficha. */
export function textoDescuento(precioBase: number, bono: any): string | null {
  if (!bono?.descuento_tipo || bono?.descuento_valor == null) return null
  const final = precioConDescuento(precioBase, bono)
  const ahorro = redondear(precioBase - final)
  const motivo = bono.descuento_motivo ? ` (${bono.descuento_motivo})` : ''
  if (bono.descuento_tipo === 'precio')     return `Precio pactado ${final.toFixed(2)} € · ${ahorro.toFixed(2)} € menos${motivo}`
  if (bono.descuento_tipo === 'porcentaje') return `${bono.descuento_valor}% · ${ahorro.toFixed(2)} € menos${motivo}`
  return `${Number(bono.descuento_valor).toFixed(2)} € menos${motivo}`
}

// ---------------------------------------------------------------------------
// QUÉ CUENTA COMO INGRESO DE UN MES
//
// Hay dos cosas distintas metidas en la misma tabla y no se cobran igual:
//
//   CUOTA MENSUAL   → se repite todos los meses. Vale como ingreso recurrente.
//   BONO DE SESIONES → se vende una vez. Vale como ingreso UNA vez, el mes que
//                      se vendió, y luego se gasta a lo largo de dos o tres.
//
// Contar los de sesiones por `activo`, que es lo que hacía Finanzas, los suma
// otra vez cada mes mientras al paciente le queden sesiones. Y como
// `renovarCuotas` ya no los toca, nadie los desactiva nunca: seguirían sumando
// para siempre. Ocho sesiones vendidas en septiembre aparecerían como ingreso
// en septiembre, octubre y noviembre.
// ---------------------------------------------------------------------------

/** true si el bono es una venta puntual (sesiones) y no una cuota que se repite. */
export const esVentaPuntual = (b: any) => b?.sesiones_totales != null

/** Las cuotas que se repiten cada mes. Lo único que sirve para prever. */
export function cuotasRecurrentes(bonos: any[] = []): any[] {
  return bonos.filter(b => b.activo && !esVentaPuntual(b))
}

/**
 * Lo que se ingresa en un mes: las cuotas vigentes más las ventas de ese mes.
 *
 * Un bono de sesiones de agosto no cuenta en septiembre aunque siga vivo: ya se
 * cobró. Lo que le queda son sesiones, no dinero por cobrar.
 */
export function ingresoDelMes(bonos: any[] = [], mes: number, anio: number): any[] {
  return bonos.filter(b => esVentaPuntual(b)
    ? (b.mes === mes && b.anio === anio)
    : b.activo)
}

// Renueva las cuotas al entrar en un mes nuevo: por cada bono activo del mes anterior,
// crea uno nuevo del mes actual (mismo tipo y descuento, estado 'pendiente') y desactiva el viejo.
// Se ejecuta como mucho una vez por mes (marca en ajustes: ultima_renovacion = 'YYYY-MM').
// modoPrueba=true -> no toca nada, solo devuelve qué haría.
export async function renovarCuotas(modoPrueba = false) {
  const hoy = new Date()
  const mes = hoy.getMonth() + 1
  const anio = hoy.getFullYear()
  const claveMes = `${anio}-${String(mes).padStart(2,'0')}`

  // ¿Ya se renovó este mes?
  const { data: marca } = await supabase.from('ajustes').select('valor').eq('clave','ultima_renovacion').maybeSingle()
  if (marca?.valor === claveMes) return { ejecutado: false, motivo: 'ya_renovado', renovados: 0 }

  // Bonos activos que NO son ya del mes actual (los de meses anteriores)
  const { data: activos, error } = await supabase.from('bonos').select('*').eq('activo', true)
  if (error) return { ejecutado: false, motivo: 'error_lectura', error: error.message, renovados: 0 }

  // Se renueva la cuota de quien sigue siendo cliente: ACTIVO y PAUSA.
  //
  // Antes esto solo miraba `bonos.activo` y no el estado del paciente, así que a
  // los de BAJA se les seguía generando cuota cada mes, inflando el "pendiente"
  // de Finanzas con gente que ya no viene.
  //
  // La pausa SÍ se renueva, y es deliberado: pausa significa vacaciones o
  // descanso, no se ha ido. Sigue pagando el mes y vuelve cuando termina el
  // periodo. Dejar de renovarle la cuota le quitaría la plaza sin que nadie lo
  // haya decidido.
  const { data: pacientes, error: errPac } = await supabase.from('pacientes').select('id,estado')
  if (errPac) return { ejecutado: false, motivo: 'error_lectura', error: errPac.message, renovados: 0 }
  const estadoPaciente = new Map((pacientes || []).map((p: any) => [p.id, p.estado]))
  const SIGUE_SIENDO_CLIENTE = ['activo', 'pausa']

  // Los bonos POR SESIONES no se renuevan: se compran, se gastan y se acaban.
  // Sin esto, el día 1 de cada mes se le regalaría al paciente otro bono de 8
  // sesiones, y otro al mes siguiente. Se reconocen porque tienen sesiones.
  // A QUIEN YA TIENE CUOTA DE ESTE MES NO SE LE CREA OTRA.
  //
  // Desde que se puede elegir cuándo empieza un bono, se puede dejar la cuota de
  // septiembre puesta en agosto. Si esa persona conservaba además su bono de
  // agosto, el día 1 esto veía un bono viejo sin renovar y le creaba una SEGUNDA
  // cuota de septiembre: dos filas, dos cobros y, si alguien no se fija, dos
  // facturas por el mismo mes.
  //
  // Se mira contra todos los bonos activos, no solo contra los que se van a
  // renovar, porque el que ya existe es justamente el que no está en esa lista.
  const yaTieneDelMes = new Set(
    (activos || [])
      .filter((b: any) => b.sesiones_totales == null && b.mes === mes && b.anio === anio)
      .map((b: any) => b.paciente_id))

  const pendientesDeMes = (activos || [])
    .filter((b: any) => b.sesiones_totales == null)
    .filter((b: any) => !(b.mes === mes && b.anio === anio))
    .filter((b: any) => !yaTieneDelMes.has(b.paciente_id))
  const aRenovar = pendientesDeMes.filter((b: any) => SIGUE_SIENDO_CLIENTE.includes(estadoPaciente.get(b.paciente_id)))
  // Se cuentan aparte para poder decirlo, no para esconderlo.
  const omitidos = {
    baja:  pendientesDeMes.filter((b: any) => estadoPaciente.get(b.paciente_id) === 'baja').length,
    sinPaciente: pendientesDeMes.filter((b: any) => !estadoPaciente.has(b.paciente_id)).length,
    yaTenian: yaTieneDelMes.size,
  }

  if (modoPrueba) {
    return { ejecutado: false, modoPrueba: true, renovados: aRenovar.length, omitidos, detalle: aRenovar.map((b:any)=>({ paciente_id:b.paciente_id, tipo:b.tipo, desde:`${b.mes}/${b.anio}` })) }
  }

  // Retirar los bonos de meses pasados de quien ya tiene el de este mes puesto
  // a mano. Si se dejaran activos, quedarían dos cuotas vigentes por persona y
  // Finanzas sumaría las dos: el previsto del mes saldría al doble.
  const superados = (activos || []).filter((b: any) =>
    b.sesiones_totales == null
    && yaTieneDelMes.has(b.paciente_id)
    && (b.anio < anio || (b.anio === anio && b.mes < mes)))
  for (const b of superados) {
    await supabase.from('bonos').update({ activo: false }).eq('id', b.id)
  }

  let ok = 0
  const fallidos: string[] = []
  for (const b of aRenovar) {
    // Crear el bono nuevo del mes actual. SIEMPRE pendiente: renovar la cuota no
    // es cobrarla. La factura solo sale de un cobro, y esto no crea ninguno.
    const { error: errIns } = await supabase.from('bonos').insert({
      paciente_id: b.paciente_id, tipo: b.tipo, dias_semana: b.dias_semana,
      estado_pago: 'pendiente', mes, anio,
      fecha_inicio: new Date(anio, mes-1, 1).toISOString().split('T')[0], activo: true,
      descuento_tipo: b.descuento_tipo, descuento_valor: b.descuento_valor, descuento_motivo: b.descuento_motivo,
    })
    // Si falla (p.ej. duplicado), se salta ese sin romper el resto, pero se
    // apunta: una renovación que se come tres bonos en silencio deja a tres
    // pacientes sin cuota y nadie se entera hasta que alguien la echa en falta.
    if (errIns) { fallidos.push(`${b.paciente_id}: ${errIns.message}`); continue }
    // Desactivar el viejo
    await supabase.from('bonos').update({ activo: false }).eq('id', b.id)
    // Registrar en el historial del paciente
    await supabase.from('eventos_paciente').insert({
      paciente_id: b.paciente_id, tipo: 'cambio_bono',
      titulo: `Cuota renovada (${mes}/${anio})`,
      descripcion: `Nueva cuota mensual pendiente de pago.${b.descuento_tipo?' Descuento mantenido.':''}`,
      fecha: new Date().toISOString().split('T')[0],
    })
    ok++
  }

  // Marcar que este mes ya se renovó
  await supabase.from('ajustes').upsert({ clave: 'ultima_renovacion', valor: claveMes }, { onConflict: 'clave' })
  return { ejecutado: true, renovados: ok, omitidos, fallidos, retirados: superados.length }
}

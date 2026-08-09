import { supabase } from './supabase'

export type BonoTipo = {
  id: string
  nombre: string
  dias_semana: number
  descripcion: string | null
  orden: number
  activo: boolean
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

export const redondear = (n: number) => Math.round(n * 100) / 100

// Precio final de un bono aplicando su descuento (si tiene). precioBase = precio del plan.
export function precioConDescuento(precioBase: number, bono: { descuento_tipo?: string|null, descuento_valor?: number|null }): number {
  if (!bono?.descuento_tipo || !bono?.descuento_valor) return precioBase
  if (bono.descuento_tipo === 'porcentaje') {
    return Math.max(0, Math.round(precioBase * (1 - bono.descuento_valor/100) * 100) / 100)
  }
  if (bono.descuento_tipo === 'fijo') {
    return Math.max(0, Math.round((precioBase - bono.descuento_valor) * 100) / 100)
  }
  return precioBase
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

  const aRenovar = (activos || []).filter((b: any) => !(b.mes === mes && b.anio === anio))

  if (modoPrueba) {
    return { ejecutado: false, modoPrueba: true, renovados: aRenovar.length, detalle: aRenovar.map((b:any)=>({ paciente_id:b.paciente_id, tipo:b.tipo, desde:`${b.mes}/${b.anio}` })) }
  }

  let ok = 0
  for (const b of aRenovar) {
    // Crear el bono nuevo del mes actual
    const { error: errIns } = await supabase.from('bonos').insert({
      paciente_id: b.paciente_id, tipo: b.tipo, dias_semana: b.dias_semana,
      estado_pago: 'pendiente', mes, anio,
      fecha_inicio: new Date(anio, mes-1, 1).toISOString().split('T')[0], activo: true,
      descuento_tipo: b.descuento_tipo, descuento_valor: b.descuento_valor, descuento_motivo: b.descuento_motivo,
    })
    if (errIns) continue // si falla (p.ej. duplicado), saltamos ese sin romper el resto
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
  return { ejecutado: true, renovados: ok }
}

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

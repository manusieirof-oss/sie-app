'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { traerTodo } from '@/lib/paginar'
import { textoSegundos } from '@/lib/trabajo'
import { useConfigTrabajo } from '@/components/TrabajoEjercicio'
import { ZONAS, indices, calcularMapa } from '@/lib/mapaTrabajo'
import { colorCalor } from '@/lib/rampaCalor'
import type { MapaCalor3D } from '@/lib/anim3d/mapaCalor'

/**
 * EL MAPA DE CALOR EN PEQUEÑO: el cuerpo girando con lo que ha trabajado el paciente
 * en los últimos 3 meses y sus zonas más trabajadas. Solo para mirar (va dentro del
 * botón del torno): no se toca, el toque es del botón.
 */
export default function MapaCalorMini({ pacienteId }: { pacienteId: string }) {
  const cfg = useConfigTrabajo()
  const [regs, setRegs] = useState<any[] | null>(null)
  const [ejs, setEjs] = useState<Record<string, any>>({})
  const [ets, setEts] = useState<any[]>([])
  useEffect(() => {
    let vivo = true
    ;(async () => {
      const desde = new Date(Date.now() - 91 * 864e5).toISOString().slice(0, 10)
      const [{ filas }, et] = await Promise.all([
        traerTodo((d, h) => supabase.from('registros_ejercicio').select('fecha,ejercicio_id,series,regimen,sesion_id').eq('paciente_id', pacienteId).gte('fecha', desde).order('id').range(d, h)),
        supabase.from('etiquetas').select('id,nombre,categoria,padre_id'),
      ])
      const ids = Array.from(new Set((filas || []).map((r: any) => r.ejercicio_id).filter(Boolean)))
      const mapa: Record<string, any> = {}
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await supabase.from('ejercicios').select('id,nombre,trabajo,anatomia,tipo_medida').in('id', ids.slice(i, i + 200))
        ;(data || []).forEach((e: any) => { mapa[e.id] = e })
      }
      if (!vivo) return
      setEts(et.data || []); setEjs(mapa); setRegs(filas || [])
    })()
    return () => { vivo = false }
  }, [pacienteId])

  const idx = useMemo(() => indices(ets), [ets])
  const m = useMemo(() => calcularMapa(regs || [], ejs, idx, cfg, { int: [], eje: [], combinada: false }), [regs, ejs, idx, cfg])
  const enZonas = Object.values(m.zonas).reduce((n, z) => n + z.seg, 0)
  const top = ZONAS.map(z => ({ z, seg: m.zonas[z.k]?.seg || 0 })).filter(x => x.seg > 0).sort((a, b) => b.seg - a.seg).slice(0, 4)

  const caja = useRef<HTMLDivElement>(null)
  const visor = useRef<MapaCalor3D | null>(null)
  const [listo, setListo] = useState(false)
  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const { crearMapaCalor } = await import('@/lib/anim3d/mapaCalor')
        if (!caja.current) return
        const v = await crearMapaCalor(caja.current)
        if (!vivo) { v.destruir(); return }
        visor.current = v; setListo(true)
      } catch { /* sin WebGL: se quedan solo los datos */ }
    })()
    return () => { vivo = false; visor.current?.destruir(); visor.current = null }
  }, [])
  useEffect(() => {
    if (!visor.current) return
    const maxZ = Math.max(0, ...Object.values(m.zonas).map(z => z.seg))
    const maxM = Math.max(0, ...Object.values(m.musculos))
    const zonas: Record<string, any> = {}
    ZONAS.forEach(z => { const s = m.zonas[z.k]?.seg || 0; if (s > 0) zonas[z.k] = { v: s / maxZ, huesos: z.huesos, off: z.off } })
    visor.current.poner({ zonas, musculos: Object.fromEntries(Object.entries(m.musculos).map(([k, s]) => [k, maxM ? s / maxM : 0])) })
  }, [m, listo])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* El cuerpo no recibe toques: el botón que lo contiene es quien manda. */}
      <div ref={caja} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}/>
      <div style={{ position: 'absolute', right: 0, top: 0, minWidth: 150, fontSize: 12, pointerEvents: 'none' }}>
        {regs === null ? <span style={{ color: 'var(--grl)' }}>Cargando…</span>
          : m.total === 0 ? <span style={{ color: 'var(--grl)' }}>Sin nada anotado en 3 meses</span>
          : <>
            <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--n)' }}>{textoSegundos(m.total)}</div>
            <div style={{ fontSize: 11, color: 'var(--grl)', marginBottom: 8 }}>de trabajo · 3 meses</div>
            {top.map(({ z, seg }) => (
              <div key={z.k} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 9, background: colorCalor(0.25 + 0.75 * seg / (top[0]?.seg || 1)) }}/>
                <span style={{ flex: 1, color: 'var(--n)' }}>{z.n}</span>
                <b style={{ color: 'var(--n)' }}>{enZonas ? Math.round(seg / enZonas * 100) : 0}%</b>
              </div>
            ))}
          </>}
      </div>
    </div>
  )
}

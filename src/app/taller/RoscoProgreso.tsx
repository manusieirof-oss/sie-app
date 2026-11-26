'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useConfigTrabajo } from '@/lib/usarTrabajo'
import { segundosSerie, type ConfigTrabajo } from '@/lib/trabajo'

// ---------------------------------------------------------------------------
// CÓMO LE SUELE IR ESTA SESIÓN (cabecera del taller, al abrir a una persona).
//
// El tiempo de la sesión sale de sumar sus series: reps × segundos por repetición (o los
// segundos de la serie) más el descanso entre series (lib/trabajo, Ajustes › Entrenador).
// Con las veces que ya la hizo se calcula lo mismo con lo que apuntó, y el rosco dice:
//   - en cuántas de esas veces llegó al tiempo entero de la sesión (el %),
//   - y el tiempo medio que le duró.
// ---------------------------------------------------------------------------

const n = (v: any) => { const x = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : 0 }

/** Segundos de una lista de series de un ejercicio: trabajo + descanso entre series. */
function segundosDe(cfg: ConfigTrabajo, series: any[], regimen: string | null | undefined, descanso: number) {
  const ejec = regimen ? [regimen] : []
  const trabajo = (series || []).reduce((t, s) => t + segundosSerie(cfg, { reps: s?.reps, segundos: s?.segundos ?? s?.tiempo, ejecuciones: ejec }).seg, 0)
  const pausas = Math.max(0, (series || []).length - 1) * descanso
  return trabajo > 0 ? trabajo + pausas : 0
}

export default function RoscoProgreso({ pacienteId, sesionId, datos, fecha }: {
  pacienteId: string, sesionId: string, datos: any[], fecha: string
}) {
  const cfg = useConfigTrabajo()
  const [veces, setVeces] = useState<number[] | null>(null)

  // Lo que dura la sesión tal como está planificada.
  const descansoDe = (e: any) => n(e?.plan?.descanso ?? e?.descanso)
  const previsto = datos.reduce((t, e) => t + segundosDe(cfg, e.series || [], e.regimen || e.plan?.regimen, descansoDe(e)), 0)

  useEffect(() => {
    let vivo = true
    supabase.from('registros_ejercicio').select('fecha,ejercicio_id,series,regimen')
      .eq('paciente_id', pacienteId).eq('sesion_id', sesionId).eq('finalizado', true).lt('fecha', fecha)
      .order('fecha', { ascending: false }).limit(600)
      .then(({ data }) => {
        if (!vivo) return
        const porDia: Record<string, number> = {}
        ;(data || []).forEach((r: any) => {
          const e = datos.find(x => x.ejercicio_id && x.ejercicio_id === r.ejercicio_id)
          porDia[r.fecha] = (porDia[r.fecha] || 0) + segundosDe(cfg, r.series || [], r.regimen || e?.regimen || e?.plan?.regimen, descansoDe(e))
        })
        setVeces(Object.values(porDia).filter(s => s > 0))
      })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId, sesionId, fecha, cfg])

  if (!previsto) return null
  const min = (s: number) => Math.round(s / 60)
  const total = veces?.length || 0
  // Llega al tiempo con un margen pequeño (95 %): un descanso más corto no es no llegar.
  const llega = (veces || []).filter(s => s >= previsto * 0.95).length
  const pct = total ? Math.round(llega / total * 100) : 0
  const media = total ? (veces || []).reduce((a, b) => a + b, 0) / total : 0
  const R = 22, C = 2 * Math.PI * R

  return (
    <div title={total ? `De ${total} veces con esta sesión, ${llega} llegó a los ${min(previsto)} min. Media: ${min(media)} min.` : 'Aún no ha hecho esta sesión'}
      style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
      <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
        <circle cx="28" cy="28" r={R} fill="none" stroke="var(--bl)" strokeWidth="6"/>
        {total > 0 && <circle cx="28" cy="28" r={R} fill="none" stroke="var(--g)" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${C * pct / 100} ${C}`} transform="rotate(-90 28 28)"/>}
        <text x="28" y="32" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--n)">{total ? `${pct}%` : '—'}</text>
      </svg>
      <div style={{ lineHeight: 1.3 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--n)' }}>Sesión de {min(previsto)} min</div>
        <div style={{ fontSize: 12, color: 'var(--gr)' }}>
          {veces === null ? '…' : total ? `llega ${llega} de ${total} veces · media ${min(media)} min` : 'primera vez con esta sesión'}
        </div>
      </div>
    </div>
  )
}

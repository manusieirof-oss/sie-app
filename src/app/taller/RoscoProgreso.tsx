'use client'
import { useEffect, useState } from 'react'
import { useConfigTrabajo } from '@/lib/usarTrabajo'
import { segundosPrevistosTaller, segundosHechosHoy, vecesHechas, minutos } from '@/lib/tiempoSesion'

// ---------------------------------------------------------------------------
// CUÁNTO DE SU SESIÓN HACE (cabecera del taller y editor de la sesión).
//
// Lo previsto: el tiempo que se tardaría en hacer TODOS los ejercicios de la sesión,
// con sus series tal como salen hoy (lo de la última vez si ya lo hizo, si no lo
// planificado). lib/tiempoSesion.
// El rosco:
//   - en claro, hasta su MEDIA de las veces anteriores (si hace un 80 %, ahí queda);
//   - encima, en color, lo que lleva HOY, que se va llenando al apuntar series;
//   - una rayita marca dónde está su media, para ver si hoy la alcanza.
// ---------------------------------------------------------------------------

export function RoscoTiempo({ previsto, veces, hoy }: { previsto: number, veces: number[] | null, hoy?: number | null }) {
  if (!previsto) return null
  const total = veces?.length || 0
  const media = total ? veces!.reduce((a, b) => a + b, 0) / total : 0
  const pctMedia = total ? Math.min(100, Math.round(media / previsto * 100)) : 0
  const conHoy = hoy != null
  const pctHoy = conHoy ? Math.min(100, Math.round(hoy! / previsto * 100)) : 0
  const R = 22, C = 2 * Math.PI * R
  const color = (p: number) => p >= 90 ? 'var(--g)' : p >= 70 ? 'var(--amb)' : 'var(--red)'
  const ang = (p: number) => (p / 100) * 2 * Math.PI - Math.PI / 2
  const centro = conHoy ? pctHoy : pctMedia
  return (
    <div title={`Sesión: ${minutos(previsto)} min de trabajo.${total ? ` Media de ${total} ${total === 1 ? 'vez' : 'veces'}: ${minutos(media)} min (${pctMedia} %).` : ''}${conHoy ? ` Hoy: ${minutos(hoy!)} min (${pctHoy} %).` : ''}`}
      style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
      <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
        <circle cx="28" cy="28" r={R} fill="none" stroke="var(--bl)" strokeWidth="6"/>
        {/* Su media, en claro. */}
        {total > 0 && <circle cx="28" cy="28" r={R} fill="none" stroke={conHoy ? 'var(--gm)' : color(pctMedia)} strokeOpacity={conHoy ? .55 : 1} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${C * pctMedia / 100} ${C}`} transform="rotate(-90 28 28)"/>}
        {/* Lo de hoy, encima. */}
        {conHoy && pctHoy > 0 && <circle cx="28" cy="28" r={R} fill="none" stroke={pctHoy >= pctMedia && total ? 'var(--g)' : 'var(--gd)'} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${C * pctHoy / 100} ${C}`} transform="rotate(-90 28 28)" style={{ transition: 'stroke-dasharray .4s ease' }}/>}
        {/* Dónde está su media. */}
        {conHoy && total > 0 && <line x1={28 + (R - 5) * Math.cos(ang(pctMedia))} y1={28 + (R - 5) * Math.sin(ang(pctMedia))}
          x2={28 + (R + 5) * Math.cos(ang(pctMedia))} y2={28 + (R + 5) * Math.sin(ang(pctMedia))} stroke="var(--n)" strokeWidth="2"/>}
        <text x="28" y="32" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--n)">{conHoy || total ? `${centro}%` : '—'}</text>
      </svg>
      <div style={{ lineHeight: 1.35, fontSize: 12 }}>
        <div style={{ fontWeight: 600, color: 'var(--n)', fontSize: 12.5 }}>Sesión: {minutos(previsto)} min de trabajo</div>
        {conHoy && <div style={{ color: 'var(--gd)' }}>Hoy: {minutos(hoy!)} min · {pctHoy} %</div>}
        <div style={{ color: 'var(--gr)' }}>
          {veces === null ? '…' : total ? `Media: ${minutos(media)} min · ${pctMedia} % (${total} ${total === 1 ? 'vez' : 'veces'})` : 'Aún no se ha hecho'}
        </div>
      </div>
    </div>
  )
}

/** En el taller: lo previsto con sus series de hoy, su media (solo esta persona) y lo de hoy. */
export default function RoscoProgreso({ pacienteId, sesionId, datos, fecha, noHechos = [] }: {
  pacienteId: string, sesionId: string, datos: any[], fecha: string, noHechos?: number[]
}) {
  const cfg = useConfigTrabajo()
  const [veces, setVeces] = useState<number[] | null>(null)
  useEffect(() => {
    let vivo = true
    vecesHechas(cfg, sesionId, datos.map(e => ({ ejercicios: [{ ejercicio_id: e.ejercicio_id, descanso: e.plan?.descanso }] })), fecha, pacienteId)
      .then(v => { if (vivo) setVeces(v) })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId, sesionId, fecha, cfg])
  return <RoscoTiempo previsto={segundosPrevistosTaller(cfg, datos)} veces={veces} hoy={segundosHechosHoy(cfg, datos, noHechos)}/>
}

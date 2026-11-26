'use client'
import { useEffect, useState } from 'react'
import { useConfigTrabajo } from '@/lib/usarTrabajo'
import { previstoPorEjercicioTaller, descansos, sumar, segundosHechosHoy, historialSesion, minutos, type DiaSesion } from '@/lib/tiempoSesion'

// ---------------------------------------------------------------------------
// CUÁNTO DE SU SESIÓN HACE (cabecera del taller y editor de la sesión).
// El rosco: en claro su MEDIA (la media del % de cada día, cada uno frente a lo que le
// tocaba ese día: ver lib/tiempoSesion), con una rayita; encima, en color, lo que lleva
// HOY. Tocándolo se abre la gráfica día a día, para ver si va a más o a menos.
// ---------------------------------------------------------------------------

export function RoscoTiempo({ previsto, dias, hoy }: { previsto: number, dias: DiaSesion[] | null, hoy?: number | null }) {
  const [grafica, setGrafica] = useState(false)
  if (!previsto) return null
  const total = dias?.length || 0
  const pctMedia = total ? Math.round(dias!.reduce((a, d) => a + d.pct, 0) / total) : 0
  const conHoy = hoy != null
  const pctHoy = conHoy ? Math.min(100, Math.round(hoy! / previsto * 100)) : 0
  const R = 22, C = 2 * Math.PI * R
  const color = (p: number) => p >= 90 ? 'var(--g)' : p >= 70 ? 'var(--amb)' : 'var(--red)'
  const ang = (p: number) => (p / 100) * 2 * Math.PI - Math.PI / 2
  const centro = conHoy ? pctHoy : pctMedia
  const fmt = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button type="button" onClick={() => total && setGrafica(g => !g)} title={total ? 'Ver la gráfica día a día' : undefined}
        style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'none', border: 0, padding: 0, fontFamily: 'inherit', textAlign: 'left', cursor: total ? 'pointer' : 'default' }}>
        <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
          <circle cx="28" cy="28" r={R} fill="none" stroke="var(--bl)" strokeWidth="6"/>
          {total > 0 && <circle cx="28" cy="28" r={R} fill="none" stroke={conHoy ? 'var(--gm)' : color(pctMedia)} strokeOpacity={conHoy ? .55 : 1} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={`${C * pctMedia / 100} ${C}`} transform="rotate(-90 28 28)"/>}
          {conHoy && pctHoy > 0 && <circle cx="28" cy="28" r={R} fill="none" stroke={total && pctHoy >= pctMedia ? 'var(--g)' : 'var(--gd)'} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={`${C * pctHoy / 100} ${C}`} transform="rotate(-90 28 28)" style={{ transition: 'stroke-dasharray .4s ease' }}/>}
          {conHoy && total > 0 && <line x1={28 + (R - 5) * Math.cos(ang(pctMedia))} y1={28 + (R - 5) * Math.sin(ang(pctMedia))}
            x2={28 + (R + 5) * Math.cos(ang(pctMedia))} y2={28 + (R + 5) * Math.sin(ang(pctMedia))} stroke="var(--n)" strokeWidth="2"/>}
          <text x="28" y="32" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--n)">{conHoy || total ? `${centro}%` : '—'}</text>
        </svg>
        <span style={{ lineHeight: 1.35, fontSize: 12 }}>
          <span style={{ display: 'block', fontWeight: 600, color: 'var(--n)', fontSize: 12.5 }}>Sesión: {minutos(previsto)} min de trabajo</span>
          {conHoy && <span style={{ display: 'block', color: 'var(--gd)' }}>Hoy: {minutos(hoy!)} min · {pctHoy} %</span>}
          <span style={{ display: 'block', color: 'var(--gr)' }}>
            {dias === null ? '…' : total ? `Suele hacer el ${pctMedia} % (${total} ${total === 1 ? 'vez' : 'veces'}) ▸` : 'Aún no se ha hecho'}
          </span>
        </span>
      </button>
      {grafica && total > 0 && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 30, background: '#fff', border: '1px solid var(--bd)', borderRadius: 14,
          boxShadow: '0 12px 30px rgba(38,40,37,.16)', padding: '12px 14px', width: Math.min(560, 90 + dias!.length * 44) }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
            <b style={{ fontSize: 13, flex: 1 }}>Cuánto hizo de la sesión, cada vez</b>
            <button type="button" onClick={() => setGrafica(false)} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--gr)' }}>✕</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 130, borderBottom: '1px solid var(--bd)', position: 'relative', paddingTop: 16 }}>
            {/* La media, como una raya. */}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: pctMedia * 1.1, borderTop: '1.5px dashed var(--gr)' }} title={`Media ${pctMedia} %`}/>
            {dias!.slice(-12).map(d => (
              <div key={d.fecha} title={`${fmt(d.fecha)}: ${minutos(d.hecho)} de ${minutos(d.previsto)} min`} style={{ flex: '0 0 36px', textAlign: 'center' }}>
                <div style={{ fontSize: 10.5, color: 'var(--gr)', marginBottom: 2 }}>{d.pct}%</div>
                <div style={{ height: d.pct * 1.1, background: color(d.pct), borderRadius: '6px 6px 0 0' }}/>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {dias!.slice(-12).map(d => <div key={d.fecha} style={{ flex: '0 0 36px', textAlign: 'center', fontSize: 10, color: 'var(--grl)' }}>{fmt(d.fecha)}<br/>{minutos(d.hecho)}′</div>)}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--gr)', marginTop: 8, lineHeight: 1.4 }}>Cada día frente a lo que le tocaba ese día. La raya es su media.</div>
        </div>
      )}
    </div>
  )
}

/** En el taller: lo previsto hoy, su historial (solo esta persona) y lo de hoy. */
export default function RoscoProgreso({ pacienteId, sesionId, datos, fecha, noHechos = [] }: {
  pacienteId: string, sesionId: string, datos: any[], fecha: string, noHechos?: number[]
}) {
  const cfg = useConfigTrabajo()
  const [dias, setDias] = useState<DiaSesion[] | null>(null)
  const previstoEj = previstoPorEjercicioTaller(cfg, datos)
  useEffect(() => {
    let vivo = true
    historialSesion(cfg, sesionId, previstoEj, descansos(datos, true), fecha, pacienteId).then(d => { if (vivo) setDias(d) })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId, sesionId, fecha, cfg])
  return <RoscoTiempo previsto={sumar(previstoEj)} dias={dias} hoy={segundosHechosHoy(cfg, datos, noHechos)}/>
}

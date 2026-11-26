'use client'
import { useEffect, useState } from 'react'

// ---------------------------------------------------------------------------
// CÓMO VA SU SESIÓN, de un vistazo (cabecera del taller, al abrir a una persona).
//   - El rosco: qué parte de sus ejercicios lleva hecha (todas sus series apuntadas).
//     Los de «No lo hizo» no cuentan, ni para hecho ni para el total.
//   - Debajo, el tiempo: minutos desde que empezó su cita de los que dura.
// ---------------------------------------------------------------------------

const serieHecha = (e: any, si: number) => Object.keys(e?.hoy || {}).some(k => k.startsWith(si + '.'))

export default function RoscoProgreso({ datos, noHechos = [], hora, duracion = 50, fecha }: {
  datos: any[], noHechos?: number[], hora?: string, duracion?: number, fecha: string
}) {
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setAhora(new Date()), 30000); return () => clearInterval(t) }, [])

  const cuentan = datos.map((e, i) => ({ e, i })).filter(o => !noHechos.includes(o.i) && (o.e.series || []).length > 0)
  const hechos = cuentan.filter(o => (o.e.series || []).every((_: any, si: number) => serieHecha(o.e, si))).length
  const total = cuentan.length
  const pct = total ? Math.round(hechos / total * 100) : 0

  // El tiempo: solo el día de hoy y desde su hora.
  const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`
  let tiempo = ''
  let pctT = 0
  if (hora && fecha === hoy) {
    const [h, m] = hora.split(':').map(Number)
    const min = Math.floor((ahora.getHours() * 60 + ahora.getMinutes()) - (h * 60 + m))
    if (min < 0) tiempo = `empieza a las ${hora.slice(0, 5)}`
    else { tiempo = `${Math.min(min, 999)} de ${duracion} min`; pctT = Math.min(1, min / duracion) }
  }

  const R = 22, C = 2 * Math.PI * R, r = 15, c = 2 * Math.PI * r
  return (
    <div title={`${hechos} de ${total} ejercicios hechos${tiempo ? ' · ' + tiempo : ''}`}
      style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
      <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
        <circle cx="28" cy="28" r={R} fill="none" stroke="var(--bl)" strokeWidth="6"/>
        <circle cx="28" cy="28" r={R} fill="none" stroke="var(--g)" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${C * pct / 100} ${C}`} transform="rotate(-90 28 28)" style={{ transition: 'stroke-dasharray .4s ease' }}/>
        {/* Por dentro, fino, el tiempo que lleva de su clase. */}
        {pctT > 0 && <>
          <circle cx="28" cy="28" r={r} fill="none" stroke="var(--bl)" strokeWidth="2.5"/>
          <circle cx="28" cy="28" r={r} fill="none" stroke={pctT >= 1 ? 'var(--amb)' : 'var(--gm)'} strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray={`${c * pctT} ${c}`} transform="rotate(-90 28 28)"/>
        </>}
        <text x="28" y="32" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--n)">{pct}%</text>
      </svg>
      <div style={{ lineHeight: 1.3 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--n)' }}>{hechos}/{total} ejercicios</div>
        {tiempo && <div style={{ fontSize: 12, color: pctT >= 1 ? '#8A6410' : 'var(--gr)' }}>⏱ {tiempo}</div>}
      </div>
    </div>
  )
}

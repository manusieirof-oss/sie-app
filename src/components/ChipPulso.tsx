'use client'
import { usePulso, useAbierto, abrirPulso, hayPulso } from '@/lib/pulsoVivo'
import { ZONAS, colorZona, trimpDe, mmss } from '@/lib/pulso'

/**
 * ❤ 132 · Z3, sin caja: el corazón y el número van del color de su zona y el fondo es
 * el de donde esté. No pinta nada si no lleva banda. Tocarlo abre su velo.
 */
export default function ChipPulso({ pid, grande }: { pid?: string | null, grande?: boolean }) {
  const p = usePulso(pid)
  if (!p) return null
  const col = p.zona >= 1 ? p.color : 'var(--gr)'
  return (
    // <span> y no <button>: va dentro de los botones de paciente de «Uno a uno».
    <span role="button" onClick={e => { e.stopPropagation(); abrirPulso(pid!) }} title={`${p.banda} · zona ${p.zona}${p.pct != null ? ` · ${p.pct}% de su FC máx.` : ''}`}
      style={{ display: 'inline-flex', alignItems: 'baseline', gap: 3, border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
        color: col, fontSize: grande ? 15 : 12, fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
      ❤ {p.bpm}{p.zona ? <span style={{ fontWeight: 500, fontSize: '.85em' }}>Z{p.zona}</span> : null}
    </span>
  )
}

/** El nombre del paciente: si lleva banda, tocarlo abre su velo de pulso; si no, es texto. */
export function NombrePulso({ pid, children }: { pid?: string | null, children: React.ReactNode }) {
  usePulso(pid)
  if (!hayPulso(pid)) return <>{children}</>
  return <span onClick={e => { e.stopPropagation(); abrirPulso(pid!) }} style={{ cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>{children}</span>
}

// ---------------------------------------------------------------------------
// EL VELO: lo de la tarjeta del panel, en grande, con la gráfica de la clase.
// ---------------------------------------------------------------------------
export function VeloPulso() {
  const pid = useAbierto()
  const p = usePulso(pid)
  if (!pid) return null
  const cerrar = () => abrirPulso(null)
  return (
    <div onClick={cerrar} style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(38,40,37,.35)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 640, padding: 18, boxShadow: '0 8px 40px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <b style={{ fontSize: 17, flex: 1 }}>{p?.nombre || 'Pulso'}</b>
          {p && <span style={{ fontSize: 12, color: 'var(--gr)' }}>{p.banda}{p.bateria != null ? ` · batería ${p.bateria}%` : ''}</span>}
          <button onClick={cerrar} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--bd)', background: '#fff', cursor: 'pointer' }}>✕</button>
        </div>
        {!p ? <div style={{ color: 'var(--gr)', fontSize: 14 }}>Sin señal de su banda ahora mismo.</div> : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 48, fontWeight: 800, color: p.zona >= 1 ? p.color : 'var(--n)', lineHeight: 1 }}>{p.bpm}</span>
              <span style={{ fontSize: 15, color: 'var(--gr)' }}>ppm{p.pct != null ? ` · ${p.pct}% de su FC máx.` : ''}{p.zona ? ` · zona ${p.zona} (${ZONAS.find(z => z.z === p.zona)?.nombre.toLowerCase()})` : ''}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, margin: '14px 0' }}>
              {[['Tiempo', mmss(p.seg)], ['Media', p.media != null ? `${p.media}` : '—'], ['Máxima', p.max ? `${p.max}` : '—'], ['Carga', `${trimpDe(p.zonas)}`]].map(([k, val]) => (
                <div key={k} style={{ background: 'var(--bl)', borderRadius: 10, padding: '8px 10px' }}>
                  <div style={{ fontSize: 11, color: 'var(--gr)' }}>{k}</div><div style={{ fontSize: 19, fontWeight: 700 }}>{val}</div>
                </div>
              ))}
            </div>
            <Grafica p={p}/>
            <TiempoZonas p={p}/>
            <div style={{ fontSize: 11.5, color: 'var(--gr)', marginTop: 10 }}>
              FC máx. {p.fcMax ?? '?'} {p.fcMedida ? '(medida)' : '(Tanaka: 208 − 0,7 × edad; Polar usa 220 − edad, por eso sus % no coinciden)'} · carga = minutos en cada zona × nº de zona
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** La FC de la clase, con las franjas de zona de fondo (como el informe de Polar). */
function Grafica({ p }: { p: { muestras: [number, number][], fcMax: number | null, media: number | null } }) {
  const m = p.muestras
  if (m.length < 2) return <div style={{ fontSize: 12.5, color: 'var(--gr)', margin: '8px 0' }}>La gráfica aparece en cuanto haya unos segundos de datos.</div>
  const W = 600, H = 170, pad = 28
  const fc = p.fcMax || Math.max(...m.map(x => x[1])) / 0.9
  const lo = Math.min(fc * 0.45, ...m.map(x => x[1])) - 3, hi = Math.max(fc, ...m.map(x => x[1])) + 3
  const t0 = m[0][0], t1 = m[m.length - 1][0] || 1
  const X = (t: number) => pad + (t - t0) / ((t1 - t0) || 1) * (W - pad - 6)
  const Y = (b: number) => 6 + (hi - b) / (hi - lo) * (H - 24)
  const d = m.map(([t, b], i) => `${i ? 'L' : 'M'}${X(t).toFixed(1)} ${Y(b).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {ZONAS.map((z, i) => {
        const de = fc * z.desde / 100, a = i < ZONAS.length - 1 ? fc * ZONAS[i + 1].desde / 100 : hi
        if (a < lo || de > hi) return null
        return <rect key={z.z} x={pad} width={W - pad - 6} y={Y(Math.min(a, hi))} height={Math.max(0, Y(Math.max(de, lo)) - Y(Math.min(a, hi)))} fill={z.color} opacity={.22}/>
      })}
      {[Math.round(lo + 3), Math.round((lo + hi) / 2), Math.round(hi - 3)].map(b => <text key={b} x={pad - 4} y={Y(b) + 4} fontSize="10" textAnchor="end" fill="#888">{b}</text>)}
      {p.media && <line x1={pad} x2={W - 6} y1={Y(p.media)} y2={Y(p.media)} stroke="#888" strokeDasharray="4 4" strokeWidth="1"/>}
      <path d={d} fill="none" stroke="#B05A5A" strokeWidth="2.2" strokeLinejoin="round"/>
      <text x={W - 6} y={H - 4} fontSize="10" textAnchor="end" fill="#888">{mmss(t1 - t0)}</text>
      <text x={pad} y={H - 4} fontSize="10" fill="#888">0:00</text>
    </svg>
  )
}

function TiempoZonas({ p }: { p: { zonas: number[], seg: number } }) {
  if (!p.seg) return null
  return (
    <div style={{ display: 'grid', gap: 4, marginTop: 10 }}>
      {[5, 4, 3, 2, 1].map(z => {
        const s = p.zonas[z] || 0, pct = Math.round(s / p.seg * 100)
        return (
          <div key={z} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ width: 22, fontWeight: 700, color: colorZona(z) }}>Z{z}</span>
            <div style={{ flex: 1, height: 12, background: 'var(--bl)', borderRadius: 6, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: colorZona(z) }}/></div>
            <span style={{ width: 80, textAlign: 'right', color: 'var(--gr)' }}>{mmss(s)} · {pct}%</span>
          </div>
        )
      })}
    </div>
  )
}

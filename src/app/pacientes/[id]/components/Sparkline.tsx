'use client'

// Minigráfica de tendencia. No sustituye a la gráfica de Resultados: aquí solo
// interesa la dirección, no leer valores concretos.
export default function Sparkline({ valores, color, ancho = 92, alto = 34, max = 10 }: {
  valores: number[]
  color: string
  ancho?: number
  alto?: number
  max?: number
}) {
  const v = (valores || []).filter(n => typeof n === 'number')
  if (v.length < 2) return <div style={{ width: ancho, fontSize: 12, color: 'var(--gr)' }}>—</div>

  const pad = 4
  const w = ancho - pad * 2
  const h = alto - pad * 2
  const paso = w / (v.length - 1)
  const puntos = v.map((n, i) => [pad + i * paso, pad + h - (Math.min(Math.max(n, 0), max) / max) * h])
  const d = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const ultimo = puntos[puntos.length - 1]

  return (
    <svg width={ancho} height={alto} style={{ display: 'block', flexShrink: 0 }} aria-hidden="true">
      <path d={`${d} L${pad + w} ${pad + h} L${pad} ${pad + h} Z`} fill={color} opacity=".10"/>
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx={ultimo[0]} cy={ultimo[1]} r="3" fill={color} stroke="var(--w)" strokeWidth="1.5"/>
    </svg>
  )
}

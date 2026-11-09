'use client'
import { COLOR_MOMENTO, progresoMomento, esEmbarazo } from '@/lib/momento'

/**
 * LA CUENTA ATRÁS DEL MOMENTO, en una barra. En el embarazo, tres tramos (los trimestres)
 * con la semana marcada; en lo demás, una barra de semana X de Y. Sin fecha de fin, nada.
 */
export default function BarraMomento({ p, ancho = 260 }: { p: any, ancho?: number }) {
  const pr = progresoMomento(p)
  if (!pr || !pr.total) return null
  const emb = esEmbarazo(p.momento)
  const pct = Math.min(100, pr.semana / pr.total * 100)
  return (
    <div style={{ maxWidth: ancho }}>
      <div style={{ position: 'relative', display: 'flex', gap: 3, height: 6 }}>
        {emb
          ? [[1, 13], [14, 27], [28, 40]].map(([a, b], i) => (
              <span key={i} style={{ flex: b - a + 1, borderRadius: 3, background: pr.trimestre === i + 1 ? COLOR_MOMENTO.raya : pr.semana > b ? '#E8D29A' : '#F1E8D0' }}/>))
          : <span style={{ flex: 1, borderRadius: 3, background: '#F1E8D0' }}><span style={{ display: 'block', height: '100%', width: `${pct}%`, borderRadius: 3, background: COLOR_MOMENTO.raya }}/></span>}
        {/* La semana de hoy, una marca fina. */}
        <span style={{ position: 'absolute', left: `calc(${pct}% - 1px)`, top: -3, width: 2, height: 12, borderRadius: 1, background: COLOR_MOMENTO.texto }}/>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: COLOR_MOMENTO.texto, marginTop: 3 }}>
        {emb ? <><span>1º</span><span>2º</span><span>3º</span></> : <><span>semana {pr.semana} de {pr.total}</span><span>{pr.pasado ? 'terminado' : `quedan ${pr.quedan}`}</span></>}
      </div>
      {emb && <div style={{ fontSize: 10.5, color: COLOR_MOMENTO.texto }}>{pr.pasado ? 'FPP pasada' : `Semana ${pr.semana} · quedan ${pr.quedan} para la FPP`}</div>}
    </div>
  )
}

'use client'
import { usePulso } from '@/lib/pulsoVivo'

/** ❤ 132 · Z3 · 74%, del color de su zona. No pinta nada si no lleva banda. */
export default function ChipPulso({ pid, grande }: { pid?: string | null, grande?: boolean }) {
  const p = usePulso(pid)
  if (!p) return null
  return (
    <span title={`${p.banda} · zona ${p.zona}${p.pct != null ? ` · ${p.pct}% de su FC máx.` : ''}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: grande ? '3px 10px' : '1px 7px', borderRadius: 99,
        background: p.color, color: p.zona >= 2 ? '#fff' : 'var(--n)', fontSize: grande ? 14 : 11.5, fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
      ❤ {p.bpm}{p.zona ? <span style={{ fontWeight: 400, opacity: .9 }}>· Z{p.zona}</span> : null}
    </span>
  )
}

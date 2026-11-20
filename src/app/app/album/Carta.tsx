'use client'
import { Cromo, nivelDe } from './cromos'

// UN CROMO del álbum: hueco vacío si no lo tiene; si lo tiene, el marco de su color y
// el brillo si su técnica está comprobada.
export default function Carta({ c, onAbrir, grande = false }: { c: Cromo, onAbrir?: () => void, grande?: boolean }) {
  const n = nivelDe(c.veces)
  if (!n) return (
    <div className={`cromo vacio${grande ? ' grande' : ''}`} aria-label={`Cromo ${c.numero}, ${c.nombre}, sin conseguir`}>
      <span className="num">{c.numero}</span>
      <span className="silueta" aria-hidden/>
      <span className="nom">{c.nombre}</span>
    </div>
  )
  return (
    <button type="button" className={`cromo ${n.clase}${c.brilla ? ' brilla' : ''}${grande ? ' grande' : ''}`} onClick={onAbrir}
      aria-label={`${c.nombre}, ${n.nombre}${c.brilla ? ', técnica comprobada' : ''}`}>
      <span className="num">{c.numero}</span>
      {c.favorito && <span className="fav" aria-hidden>♥</span>}
      <span className="foto">{c.imagen ? <img src={c.imagen} alt="" loading="lazy"/> : <span className="sin"/>}</span>
      <span className="nom">{c.nombre}</span>
      <span className="pie">{n.nombre}{c.brilla && <b> · Técnica ✓</b>}</span>
    </button>
  )
}


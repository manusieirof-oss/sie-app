'use client'
import { Cromo, nivelDe } from './cromos'

// UN CROMO del álbum: oscuro si aún no lo ha hecho bien; si lo tiene, el marco de su
// color (según las veces bien hecho) y el brillo si el centro lo tiene verificado.
export default function Carta({ c, onAbrir, grande = false }: { c: Cromo, onAbrir?: () => void, grande?: boolean }) {
  const n = nivelDe(c.veces)
  // Lo ha hecho pero nunca bien: se ve, oscuro, como un cromo que aún no le ha tocado.
  if (!n) return (
    <button type="button" className={`cromo oscuro${grande ? ' grande' : ''}`} onClick={onAbrir} aria-label={`${c.nombre}, aún no conseguido`}>
      <span className="num">{c.numero}</span>
      <span className="foto">{c.imagen ? <img src={c.imagen} alt="" loading="lazy"/> : <span className="sin"/>}</span>
      <span className="nom">{c.nombre}</span>
      <span className="pie">Por conseguir</span>
    </button>
  )
  return (
    <button type="button" className={`cromo ${n.clase}${c.brilla ? ' brilla' : ''}${grande ? ' grande' : ''}`} onClick={onAbrir}
      aria-label={`${c.nombre}, ${n.nombre}${c.brilla ? ', verificado por el centro' : ''}`}>
      <span className="num">{c.numero}</span>
      {c.favorito && <span className="fav" aria-hidden>♥</span>}
      <span className="foto">{c.imagen ? <img src={c.imagen} alt="" loading="lazy"/> : <span className="sin"/>}</span>
      <span className="nom">{c.nombre}</span>
      <span className="pie">{n.nombre}{c.veces > 1 && ` · ×${c.veces}`}</span>
    </button>
  )
}


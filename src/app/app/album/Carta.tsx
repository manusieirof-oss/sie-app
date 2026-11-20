'use client'
import { useEffect, useRef } from 'react'
import { Cromo, Sello, nivelDe } from './cromos'

// UN CROMO del álbum: oscuro si aún no lo ha hecho bien; si lo tiene, el marco de su
// color (según las veces bien hecho), el brillo si ha mejorado y el SELLO del centro:
// una marca translúcida con su logo que se ve al mover el cromo (como el holograma de
// un carné). En grande se inclina con el dedo o al mover el móvil.

function Sello_({ sello }: { sello?: Sello }) {
  if (!sello?.logo && !sello?.nombre) return null
  return (
    <span className="sello" aria-hidden>
      {sello.logo ? <img src={sello.logo} alt=""/> : <b>{(sello.nombre || '').split(' ').map(p => p[0]).join('').slice(0, 3)}</b>}
    </span>
  )
}

export default function Carta({ c, onAbrir, grande = false, sello }: { c: Cromo, onAbrir?: () => void, grande?: boolean, sello?: Sello }) {
  const ref = useRef<HTMLButtonElement>(null)

  // INCLINAR: con el dedo (o el ratón) y, si el móvil lo permite, al moverlo.
  useEffect(() => {
    const el = ref.current
    if (!grande || !el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const poner = (x: number, y: number) => {   // x, y entre -1 y 1
      el.style.setProperty('--rx', `${(-y * 12).toFixed(1)}deg`)
      el.style.setProperty('--ry', `${(x * 14).toFixed(1)}deg`)
      el.style.setProperty('--luz', `${(50 + x * 40).toFixed(0)}%`)
      el.style.setProperty('--sello', Math.min(0.85, 0.12 + Math.hypot(x, y) * 0.9).toFixed(2))
    }
    const mover = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      poner(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1)
    }
    const soltar = () => poner(0, 0)
    const girar = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return
      poner(Math.max(-1, Math.min(1, e.gamma / 30)), Math.max(-1, Math.min(1, (e.beta - 45) / 30)))
    }
    el.addEventListener('pointermove', mover); el.addEventListener('pointerleave', soltar)
    window.addEventListener('deviceorientation', girar)
    return () => { el.removeEventListener('pointermove', mover); el.removeEventListener('pointerleave', soltar); window.removeEventListener('deviceorientation', girar) }
  }, [grande])

  // En iPhone, mover el móvil pide permiso: se pide al tocar el cromo grande.
  const pedirMovimiento = () => {
    const D = (window as any).DeviceOrientationEvent
    if (grande && D?.requestPermission) D.requestPermission().catch(() => {})
  }

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
    <button ref={ref} type="button" className={`cromo ${n.clase}${c.brilla ? ' brilla' : ''}${grande ? ' grande' : ''}`}
      onClick={() => { pedirMovimiento(); onAbrir?.() }}
      aria-label={`${c.nombre}, ${n.nombre}${c.brilla ? ', ha mejorado' : ''}${sello?.nombre ? `, sello de ${sello.nombre}` : ''}`}>
      <span className="num">{c.numero}</span>
      {c.favorito && <span className="fav" aria-hidden>♥</span>}
      <span className="foto">{c.imagen ? <img src={c.imagen} alt="" loading="lazy"/> : <span className="sin"/>}<Sello_ sello={sello}/></span>
      <span className="nom">{c.nombre}</span>
      <span className="pie">{n.nombre}{c.veces > 1 && ` · ×${c.veces}`}</span>
    </button>
  )
}

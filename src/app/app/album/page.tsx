'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Navegacion from '../Navegacion'
import { Cromo, nivelDe, siguienteDe, tiempo, fecha } from './cromos'

// EL ÁLBUM DE CROMOS. Una página por zona del cuerpo. Cada hueco es un ejercicio
// verificado del centro; el cromo aparece cuando lo hace en clase, cambia de color con
// las veces (sin color, bronce, plata, oro, diamante) y brilla cuando el centro ha comprobado su
// técnica. Datos: app_album() (sql/app-4-album.sql).

type Filtro = 'todos' | 'favoritos' | 'brillan'

function Carta({ c, onAbrir, grande = false }: { c: Cromo, onAbrir?: () => void, grande?: boolean }) {
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

export default function Album() {
  const [cromos, setCromos] = useState<Cromo[] | null>(null)
  const [fuera, setFuera] = useState(false)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [abierto, setAbierto] = useState<Cromo | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { setFuera(true); return }
      const { data: a } = await supabase.rpc('app_album')
      setCromos(((a?.cromos || []) as Cromo[]).map((c, i) => ({ ...c, numero: i + 1 })))
    })
  }, [])

  async function favorito(c: Cromo) {
    const { data } = await supabase.rpc('app_favorito', { ej: c.id })
    const f = data === true
    setCromos(cs => (cs || []).map(x => x.id === c.id ? { ...x, favorito: f } : x))
    setAbierto(a => a && a.id === c.id ? { ...a, favorito: f } : a)
  }

  const zonas = useMemo(() => {
    const g: Record<string, Cromo[]> = {}
    ;(cromos || []).filter(c => filtro === 'todos' || (filtro === 'favoritos' ? c.favorito : c.brilla))
      .forEach(c => { (g[c.zona] ||= []).push(c) })
    return Object.entries(g)
  }, [cromos, filtro])

  if (fuera) return <div className="capp-centro"><h1>Tu álbum</h1><p>Entra con el enlace que te mandamos desde el centro.</p></div>
  if (!cromos) return <div className="capp-centro"><h1>Abriendo el álbum…</h1></div>

  const tiene = cromos.filter(c => c.veces > 0).length
  const brillan = cromos.filter(c => c.brilla).length

  return (
    <>
      <main className="capp-col capp-con-nav">
        <header className="capp-hola">
          <small>{tiene} de {cromos.length} cromos{brillan ? `, ${brillan} con técnica comprobada` : ''}</small>
          <h1>Tu álbum</h1>
        </header>
        <div className="capp-progreso" aria-hidden><span style={{ width: `${cromos.length ? tiene / cromos.length * 100 : 0}%` }}/></div>

        <div className="capp-filtros" role="group" aria-label="Ver">
          {([['todos', 'Todos'], ['favoritos', 'Favoritos'], ['brillan', 'Técnica comprobada']] as [Filtro, string][]).map(([k, t]) => (
            <button key={k} type="button" className={filtro === k ? 'on' : ''} aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{t}</button>
          ))}
        </div>

        {cromos.length === 0 && <div className="capp-vacio">El centro todavía está preparando los cromos. ¡Pronto podrás empezar tu colección!</div>}
        {cromos.length > 0 && zonas.length === 0 && <div className="capp-vacio">
          {filtro === 'favoritos' ? 'Aún no tienes favoritos. Abre un cromo y toca el corazón.' : 'Todavía ningún cromo tiene la técnica comprobada. Pide en clase que revisen cómo lo haces.'}
        </div>}

        {zonas.map(([zona, lista]) => (
          <section key={zona} className="capp-pagina">
            <h2>{zona}<span>{lista.filter(c => c.veces > 0).length}/{lista.length}</span></h2>
            <div className="capp-rejilla">
              {lista.map(c => <Carta key={c.id} c={c} onAbrir={() => setAbierto(c)}/>)}
            </div>
          </section>
        ))}
      </main>

      {abierto && (() => {
        const sig = siguienteDe(abierto.veces)
        const marcas = [
          abierto.peso_max != null && ['Carga máxima', `${abierto.peso_max} kg`],
          abierto.reps_max != null && ['Más repeticiones', `${abierto.reps_max}`],
          abierto.seg_max != null && ['Tiempo máximo', tiempo(abierto.seg_max)],
          abierto.metros_max != null && ['Distancia máxima', `${abierto.metros_max} m`],
        ].filter(Boolean) as [string, string][]
        return (
          <div className="capp-velo" onClick={e => { if (e.target === e.currentTarget) setAbierto(null) }}>
            <div className="capp-hoja" role="dialog" aria-label={abierto.nombre}>
              <button type="button" className="cerrar" onClick={() => setAbierto(null)} aria-label="Cerrar">✕</button>
              <Carta c={abierto} grande/>
              <h2>{abierto.nombre}</h2>
              <p className="sub">
                {abierto.brilla ? 'Técnica comprobada por el centro. ' : 'Cuando el centro compruebe tu técnica, brillará. '}
                {sig ? `Hazlo ${sig.desde - abierto.veces} ${sig.desde - abierto.veces === 1 ? 'vez' : 'veces'} más para llegar a ${sig.nombre}.` : '¡Nivel máximo!'}
              </p>
              <div className="capp-marcas">
                <div><b>{abierto.veces}</b><span>{abierto.veces === 1 ? 'vez' : 'veces'}</span></div>
                {marcas.map(([l, v]) => <div key={l}><b>{v}</b><span>{l}</span></div>)}
              </div>
              {abierto.primera && <p className="sub">Lo conseguiste el {fecha(abierto.primera)}.</p>}
              <button type="button" className={`capp-boton${abierto.favorito ? ' on' : ''}`} onClick={() => favorito(abierto)}>
                {abierto.favorito ? '♥ En tus favoritos' : '♡ Añadir a favoritos'}
              </button>
            </div>
          </div>
        )
      })()}
      <Navegacion/>
    </>
  )
}

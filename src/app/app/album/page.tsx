'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Navegacion from '../Navegacion'
import { Cromo, siguienteDe, tiempo, fecha } from './cromos'
import Carta from './Carta'
import SobreAnimado from './SobreAnimado'

// EL ÁLBUM DE CROMOS. Una página por zona del cuerpo con los ejercicios que ha hecho en
// clase. Oscuro si nunca lo ha hecho bien; cromo cuando sí, con el color según las veces
// bien hecho (sin color, bronce, plata, oro, diamante); brilla si está verificado por el
// centro. Llega con el sobre de los miércoles. Datos: app_album() (sql/app-7-…).

type Filtro = 'todos' | 'favoritos' | 'brillan'

export default function Album() {
  const [cromos, setCromos] = useState<Cromo[] | null>(null)
  const [fuera, setFuera] = useState(false)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [abierto, setAbierto] = useState<Cromo | null>(null)
  // El sobre de la semana: si hay uno esperando, y cuándo llega el siguiente.
  const [sobre, setSobre] = useState(false)
  const [proximo, setProximo] = useState('')
  const [abriendo, setAbriendo] = useState(false)

  async function cargar() {
    const { data: a } = await supabase.rpc('app_album')
    if (!a) { setFuera(true); return }   // sin la parte 'album' (aún en pruebas)
    setCromos(((a?.cromos || []) as Cromo[]).map((c, i) => ({ ...c, numero: i + 1 })))
    setSobre(a?.sobre === true); setProximo(a?.proximo || '')
  }
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (!data.session) setFuera(true); else cargar() })
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

  if (fuera) return <div className="capp-centro"><h1>Tu álbum</h1><p>Muy pronto podrás coleccionar tus ejercicios aquí.</p><p><a href="/app" style={{ color: 'var(--tinta)', fontWeight: 700 }}>Volver al inicio</a></p></div>
  if (!cromos) return <div className="capp-centro"><h1>Abriendo el álbum…</h1></div>

  const tiene = cromos.filter(c => c.veces > 0).length

  return (
    <>
      <main className="capp-col capp-con-nav">
        <header className="capp-hola">
          <small>{tiene} {tiene === 1 ? 'cromo conseguido' : 'cromos conseguidos'}{cromos.length - tiene ? `, ${cromos.length - tiene} por conseguir` : ''}</small>
          <h1>Tu álbum</h1>
        </header>
        <div className="capp-progreso" aria-hidden><span style={{ width: `${cromos.length ? tiene / cromos.length * 100 : 0}%` }}/></div>

        {sobre ? (
          <button type="button" className="capp-hay-sobre" onClick={() => setAbriendo(true)}>
            <span className="mini-sobre" aria-hidden/>
            <span><b>¡Tienes un sobre nuevo!</b>Ábrelo para ver los cromos de esta semana.</span>
          </button>
        ) : proximo && (
          <p className="capp-proximo">Próximo sobre: {new Date(proximo).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} a las 12:00</p>
        )}

        <div className="capp-filtros" role="group" aria-label="Ver">
          {([['todos', 'Todos'], ['favoritos', 'Favoritos'], ['brillan', 'Brillan']] as [Filtro, string][]).map(([k, t]) => (
            <button key={k} type="button" className={filtro === k ? 'on' : ''} aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{t}</button>
          ))}
        </div>

        {cromos.length === 0 && <div className="capp-vacio">{sobre ? 'Abre tu sobre para empezar la colección.' : 'Tu colección empieza con los ejercicios que hagas en clase. Llegan en el sobre de cada miércoles.'}</div>}
        {cromos.length > 0 && zonas.length === 0 && <div className="capp-vacio">
          {filtro === 'favoritos' ? 'Aún no tienes favoritos. Abre un cromo y toca el corazón.' : 'Todavía no tienes cromos que brillen. Brillan los ejercicios verificados por el centro.'}
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
                {abierto.veces === 0
                  ? `Lo has hecho ${abierto.vistas} ${abierto.vistas === 1 ? 'vez' : 'veces'}, pero aún no te ha tocado: hazlo bien en clase para ganar el cromo.`
                  : <>{abierto.brilla ? 'Ejercicio verificado por el centro. ' : ''}
                    {sig ? `Hazlo bien ${sig.desde - abierto.veces} ${sig.desde - abierto.veces === 1 ? 'vez' : 'veces'} más para llegar a ${sig.nombre}.` : '¡Nivel máximo!'}</>}
              </p>
              <div className="capp-marcas">
                <div><b>{abierto.veces}</b><span>{abierto.veces === 1 ? 'vez bien hecho' : 'veces bien hecho'}</span></div>
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
      {abriendo && <SobreAnimado onFin={() => { setAbriendo(false); cargar() }}/>}
      <Navegacion/>
    </>
  )
}

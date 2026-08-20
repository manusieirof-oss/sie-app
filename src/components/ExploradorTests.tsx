'use client'
import { useState } from 'react'
import { Ic } from '@/lib/icons'
import { unidadDe } from '@/lib/tests'
import { ordenAnatomico } from '@/lib/anatomia'

/**
 * Explorador del catálogo de tests: buscador, filtro por zona y rejilla de tarjetas.
 * Misma idea que `ExploradorEjercicios`: UNA vista, distintas acciones.
 *
 *   Biblioteca  -> `onAbrir`, para ver y editar el test.
 *   Valoración  -> `seleccion` + `onAlternar`, para marcar varios y añadirlos de golpe.
 *
 * Era la tercera copia del mismo buscador y la peor de las tres. La valoración tenía la
 * suya, metida en una caja de 220 px de alto con scroll, y filtraba por TODAS las
 * etiquetas del test mezcladas —músculos, patologías, articulaciones— así que con 49
 * tests el filtro estorbaba más que ayudaba. La biblioteca ya filtraba por zona en orden
 * anatómico y buscaba dentro de los ítems; ese es el comportamiento bueno y ahora es el
 * único.
 */

export default function ExploradorTests({
  tests, etiquetas = [], seleccion, onAlternar, onAbrir, yaAnadidos = [], acciones, autoFocus,
}: {
  tests: any[]
  etiquetas?: any[]
  /** Ids marcados. Si se pasa, las tarjetas se comportan como casillas. */
  seleccion?: string[]
  onAlternar?: (t: any) => void
  onAbrir?: (t: any) => void
  /** Ids que el paciente ya tiene en esta valoración: salen apagados y no se pueden pulsar. */
  yaAnadidos?: string[]
  acciones?: React.ReactNode
  autoFocus?: boolean
}) {
  const [buscar, setBuscar] = useState('')
  const [zona, setZona] = useState('')

  const nombreEt = (id: string) => (etiquetas || []).find((e: any) => e.id === id)?.nombre || ''
  const idsArticulacion = new Set((etiquetas || []).filter((e: any) => e.categoria === 'articulacion').map((e: any) => e.id))

  /**
   * Las zonas que algún test usa, de la cabeza a los pies.
   *
   * Solo las de categoría ARTICULACIÓN. Ofrecer el resto de etiquetas —músculo,
   * patología, movimiento— es lo que tenía la valoración y por eso no servía: con
   * cuarenta pastillas mezcladas, encontrar "Rodilla" costaba más que leer la lista.
   */
  const zonas = (() => {
    const ids = Array.from(new Set(
      tests.flatMap((t: any) => (t.etiquetas_relacionadas || []).filter((id: string) => idsArticulacion.has(id)))
    )) as string[]
    return ids.map(id => ({ id, nombre: nombreEt(id) })).filter(z => z.nombre)
      .sort((a, b) => ordenAnatomico(a.nombre, b.nombre))
  })()

  // Un test sin etiqueta de articulación no aparecería bajo ninguna zona y quedaría
  // invisible en cuanto se filtre. Tiene su propio chip para que se vea que existe —y
  // para que se note que le falta etiquetar.
  const sinZona = tests.filter((t: any) => !(t.etiquetas_relacionadas || []).some((id: string) => idsArticulacion.has(id)))

  const filtrados = tests.filter((t: any) => {
    const q = buscar.trim().toLowerCase()
    // Se busca también dentro de los ítems: "McMurray" vive dentro de "Rodilla ·
    // meniscos", y buscar por el nombre de la maniobra es lo natural en la camilla.
    const enItems = (t.items || []).some((i: any) => (i.nombre || '').toLowerCase().includes(q))
    const matchQ = !q || (t.nombre || '').toLowerCase().includes(q) || (t.descripcion || '').toLowerCase().includes(q) || enItems
    const matchZ = !zona
      || (zona === '_sin' ? !(t.etiquetas_relacionadas || []).some((id: string) => idsArticulacion.has(id))
        : (t.etiquetas_relacionadas || []).includes(zona))
    return matchQ && matchZ
  })

  function Tarjeta({ t }: { t: any }) {
    const yaEsta = yaAnadidos.includes(t.id)
    const sel = !!seleccion?.includes(t.id)
    const zonasDelTest = (t.etiquetas_relacionadas || []).filter((id: string) => idsArticulacion.has(id)).map(nombreEt).filter(Boolean)
    return (
      <div
        onClick={() => { if (yaEsta) return; onAlternar ? onAlternar(t) : onAbrir?.(t) }}
        style={{
          background: 'var(--w)', borderRadius: 'var(--rl)', overflow: 'hidden', position: 'relative',
          border: `${sel ? 2 : 1}px solid ${sel ? 'var(--g)' : 'var(--bd)'}`,
          cursor: yaEsta ? 'default' : 'pointer', opacity: yaEsta ? .5 : 1,
        }}
        onMouseOver={e => { if (!yaEsta && !sel) (e.currentTarget as HTMLElement).style.borderColor = 'var(--g)' }}
        onMouseOut={e => { if (!sel) (e.currentTarget as HTMLElement).style.borderColor = 'var(--bd)' }}>
        {/* Misma caja que la tarjeta de ejercicio: cuadrada y `cover`. Antes era de alto
            fijo con `contain`, así que la ilustración —que ya viene cuadrada— dejaba dos
            franjas de fondo a los lados y se veía más pequeña que las de al lado. */}
        <div className="tarj-img">
          {t.imagen_url
            ? <img src={t.imagen_url} alt={t.nombre} />
            : <span className="sin"><Ic name="test" size={28} /></span>}
        </div>
        {(sel || yaEsta) && (
          <span style={{ position: 'absolute', top: 6, right: 6, background: yaEsta ? 'var(--gr)' : 'var(--g)', color: '#fff', borderRadius: 99, padding: yaEsta ? '2px 8px' : 4, fontSize: 9, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            {yaEsta ? 'Ya añadido' : <Ic name="check" size={13} />}
          </span>
        )}
        <div style={{ padding: '9px 11px' }}>
          <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--n)', marginBottom: 3 }}>{t.nombre}</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
            {zonasDelTest.slice(0, 2).map((z: string) => (
              <span key={z} style={{ fontSize: 9, padding: '1px 7px', borderRadius: 99, background: 'var(--bl)', border: '1px solid var(--bd)', color: 'var(--gr)' }}>{z}</span>
            ))}
            {t.tipo_lado === 'lateral' && <span style={{ fontSize: 9, color: 'var(--grl)', alignSelf: 'center' }}>I/D</span>}
          </div>
          {t.descripcion && <div style={{ fontSize: 9, color: 'var(--grl)', fontWeight: 300, lineHeight: 1.4, marginBottom: 5 }}>{t.descripcion.slice(0, 80)}{t.descripcion.length > 80 ? '...' : ''}</div>}
          {(t.items || []).length > 0 && (
            <div style={{ marginBottom: 5 }}>
              <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--grl)', letterSpacing: .4, textTransform: 'uppercase', marginBottom: 3 }}>
                Ítems · {t.logica === 'suma' ? 'Suma · manda el total' : t.logica === 'todos' ? 'Todos = +' : 'Cualquiera = +'}
              </div>
              {(t.items || []).slice(0, 3).map((item: any, i: number) => (
                <div key={i} style={{ fontSize: 9, color: 'var(--n)', fontWeight: 300 }}>{t.logica === 'suma' ? '▤' : '☐'} {item.nombre}{unidadDe(item).simbolo ? ` (${unidadDe(item).nombre.toLowerCase()})` : ''}</div>
              ))}
              {(t.items || []).length > 3 && <div style={{ fontSize: 8, color: 'var(--grl)' }}>+{(t.items || []).length - 3} más</div>}
            </div>
          )}
          {t.frecuencia_meses ? <div style={{ fontSize: 9, color: 'var(--g)' }}>Revisión cada {t.frecuencia_meses} meses</div> : null}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap', marginBottom: 9 }}>
        <input className="input" placeholder="Buscar por test, descripción o maniobra…" value={buscar} autoFocus={autoFocus}
          onChange={e => setBuscar(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <span style={{ fontSize: 11, color: 'var(--grl)', whiteSpace: 'nowrap' }}>
          {filtrados.length === tests.length ? `${tests.length} tests` : `${filtrados.length} de ${tests.length}`}
        </span>
        {acciones}
      </div>

      {/* Por zona y en orden anatómico, como en etiquetas y objetivos: un solo criterio
          para recorrer la app. Solo salen las zonas que algún test usa de verdad. */}
      {zonas.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
          <button className={`chip-sel ${!zona ? 'on' : ''}`} onClick={() => setZona('')}>Todas</button>
          {zonas.map(z => (
            <button key={z.id} className={`chip-sel ${zona === z.id ? 'on' : ''}`}
              onClick={() => setZona(zona === z.id ? '' : z.id)}>{z.nombre}</button>
          ))}
          {sinZona.length > 0 && (
            <button className={`chip-sel ${zona === '_sin' ? 'on' : ''}`} title="Tests sin etiqueta de articulación"
              onClick={() => setZona(zona === '_sin' ? '' : '_sin')}>Sin zona · {sinZona.length}</button>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 9 }}>
        {filtrados.length === 0 && (
          <div style={{ gridColumn: '1/-1', padding: 30, textAlign: 'center', fontSize: 11, color: 'var(--grl)' }}>
            {tests.length === 0 ? 'Sin tests en la biblioteca.' : 'Ninguno coincide.'}
          </div>
        )}
        {filtrados.map((t: any) => <Tarjeta key={t.id} t={t} />)}
      </div>
    </div>
  )
}

'use client'
import { useState } from 'react'
import { Ic } from '@/lib/icons'
import { unidadDe } from '@/lib/tests'
import { zonasDe, casaZona } from '@/lib/etiquetas'
import FiltroZonas from '@/components/FiltroZonas'

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

  /**
   * La zona de cada test: las raíces de articulación de sus etiquetas.
   *
   * Solo cuentan las de ARTICULACIÓN. Ofrecer el resto —músculo, patología, movimiento—
   * es lo que tenía la valoración y por eso no servía: con cuarenta pastillas mezcladas,
   * encontrar "Rodilla" costaba más que leer la lista entera.
   *
   * La resuelve `zonasDe` y no un filtro escrito aquí, porque escrito aquí estaba MAL:
   * comparaba `etiqueta.categoria` sobre la fila puesta en el test, y las etiquetas hijas
   * no repiten la categoría de su raíz. Un test etiquetado con una subetiqueta de Hombro
   * no contaba como de hombro y desaparecía en "Sin zona".
   */
  const zonasPorTest = new Map<string, any[]>(
    tests.map((t: any) => [t.id, zonasDe(etiquetas || [], t.etiquetas_relacionadas || [])]),
  )
  const zonasDeTest = (t: any): any[] => zonasPorTest.get(t.id) || []

  /** Las etiquetas de articulación que los tests llevan puestas, tal cual, sin resolver a
   *  raíz: el filtro las necesita así para poder ofrecer las subzonas. */
  const articularesEnUso = Array.from(new Set(
    tests.flatMap((t: any) => (t.etiquetas_relacionadas || []) as string[])
  )).filter(id => zonasDe(etiquetas || [], [id]).length > 0)

  // Un test sin zona no aparecería bajo ningún filtro y quedaría invisible en cuanto se
  // filtre. Tiene su propio chip para que se vea que existe —y para que se note que le
  // falta etiquetar.
  const sinZona = tests.filter((t: any) => zonasDeTest(t).length === 0)

  const filtrados = tests.filter((t: any) => {
    const q = buscar.trim().toLowerCase()
    // Se busca también dentro de los ítems: "McMurray" vive dentro de "Rodilla ·
    // meniscos", y buscar por el nombre de la maniobra es lo natural en la camilla.
    const enItems = (t.items || []).some((i: any) => (i.nombre || '').toLowerCase().includes(q))
    const matchQ = !q || (t.nombre || '').toLowerCase().includes(q) || (t.descripcion || '').toLowerCase().includes(q) || enItems
    // `casaZona`: elegir una raíz trae también lo etiquetado en sus subzonas.
    const matchZ = casaZona(etiquetas || [], t.etiquetas_relacionadas || [], zona)
    return matchQ && matchZ
  })

  function Tarjeta({ t }: { t: any }) {
    const yaEsta = yaAnadidos.includes(t.id)
    const sel = !!seleccion?.includes(t.id)
    const zonasDelTest = zonasDeTest(t).map((z: any) => z.nombre).filter(Boolean)
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

      {/* La MISMA fila de zonas que la biblioteca de objetivos y que el buscador de
          objetivos de dentro de un test: un solo componente, un solo vocabulario. */}
      <div style={{ marginBottom: 10 }}>
        <FiltroZonas etiquetas={etiquetas || []} usadas={articularesEnUso}
          valor={zona} onChange={setZona} nSinZona={sinZona.length}
          etiquetaSinZona="Sin zona" />
      </div>

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

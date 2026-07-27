'use client'
import { useState } from 'react'
import { Ic } from '@/lib/icons'
import { CATEGORIAS_ETIQUETA, conDescendientes, categoriaDe, nivelDe, agrupaPorRaiz } from '@/lib/etiquetas'

// Explorador del catálogo de ejercicios: buscador, filtro por etiquetas y rejilla de
// tarjetas con foto. Es LA MISMA vista que el Pilar Entrenamiento → Biblioteca; lo que
// cambia es qué pasa al pulsar una tarjeta. Igual que hicimos con DetalleSesion: una
// vista, distintas acciones.
//
//   Biblioteca  -> `onAbrir`, para ver y editar el ejercicio.
//   Sesión      -> `seleccion` + `onAlternar`, para marcar varios y añadirlos de golpe.
//
// Pendiente: migrar BibliotecaTab a este componente cuando se toque ese pilar. Hoy
// mantiene su propia copia de la rejilla.

const MEDIDA: Record<string, string> = {
  peso_reps: 'Peso y reps',
  tiempo: 'Tiempo',
  peso_tiempo: 'Peso y tiempo',
}

export default function ExploradorEjercicios({
  ejercicios, etiquetas = [], seleccion, onAlternar, onAbrir, sugeridos, acciones,
}: {
  ejercicios: any[]
  etiquetas?: any[]
  /** Ids marcados. Si se pasa, las tarjetas se comportan como casillas. */
  seleccion?: string[]
  onAlternar?: (ej: any) => void
  onAbrir?: (ej: any) => void
  /** Bloque destacado antes del catálogo, p. ej. "Parecidos a Sentadilla". */
  sugeridos?: { titulo: string, items: any[] }
  /** Botones de la barra superior, a la derecha del contador. */
  acciones?: React.ReactNode
}) {
  const [buscar, setBuscar] = useState('')
  const [filtroEt, setFiltroEt] = useState<string[]>([])

  // Solo las etiquetas que algún ejercicio tiene de verdad —o que son madre de una
  // usada— y agrupadas por categoría. Ofrecer el árbol entero llenaría la barra de
  // filtros que no devuelven nada.
  const grupos = (() => {
    const enUso = new Set<string>()
    ejercicios.forEach(e => (e.etiquetas || []).forEach((id: string) => enUso.add(id)))
    // Una madre se muestra si alguna de sus hijas está en uso: si no, "Cuádriceps"
    // desaparecería y solo verías "Recto femoral" suelto, sin su columna.
    const visibles = etiquetas.filter((et: any) =>
      conDescendientes(etiquetas, et.id).some(id => enUso.has(id)))

    const porCat: Record<string, any[]> = {}
    visibles.forEach((et: any) => {
      const cat = categoriaDe(etiquetas, et)
      ;(porCat[cat] = porCat[cat] || []).push(et)
    })

    // Dentro de cada categoría: cada raíz seguida de su descendencia, para que las
    // hijas salgan pegadas a su madre y no ordenadas alfabéticamente entre extrañas.
    return CATEGORIAS_ETIQUETA
      .filter(c => (porCat[c.key] || []).length > 0)
      .map(c => {
        const lista = porCat[c.key]
        const ordenada: any[] = []
        lista.filter((e: any) => nivelDe(etiquetas, e) === 0).forEach((raiz: any) => {
          conDescendientes(etiquetas, raiz.id).forEach(id => {
            const et = lista.find((x: any) => x.id === id)
            if (et && !ordenada.includes(et)) ordenada.push(et)
          })
        })
        lista.forEach((et: any) => { if (!ordenada.includes(et)) ordenada.push(et) })
        return { key: c.key, label: c.label, etiquetas: ordenada }
      })
  })()

  const filtrados = ejercicios.filter(e => {
    const q = buscar.toLowerCase()
    const coincide = !buscar
      || (e.nombre || '').toLowerCase().includes(q)
      || (e.descripcion || '').toLowerCase().includes(q)
    // Varias etiquetas se acumulan: piden los que las tengan TODAS. Y cada una vale
    // por su rama entera, así que filtrar por "Cuádriceps" trae lo etiquetado solo
    // como "Recto femoral" — si no, habría que acordarse del nivel exacto.
    const etiquetado = filtroEt.length === 0 || filtroEt.every(id => {
      const rama = conDescendientes(etiquetas, id)
      return (e.etiquetas || []).some((x: string) => rama.includes(x))
    })
    return coincide && etiquetado
  })

  const hayFiltro = !!buscar || filtroEt.length > 0
  const marcado = (e: any) => !!seleccion?.includes(e.id)

  function Tarjeta({ e }: { e: any }) {
    const sel = marcado(e)
    // Se agrupan bajo su raíz, así que las tres que caben son tres MADRES y no tres
    // etiquetas sueltas: antes una tarjeta podía enseñar "Cuádriceps, Vasto Medial,
    // Rodilla" y gastar dos huecos en decir lo mismo.
    const grupos = agrupaPorRaiz(etiquetas, e.etiquetas || [])
    return (
      <div className={`tarj-ej ${sel ? 'on' : ''}`}
        onClick={() => (onAlternar ? onAlternar(e) : onAbrir?.(e))}>
        <div className="tarj-img">
          {e.imagen_url
            ? <img src={e.imagen_url} alt={e.nombre} />
            : <span className="sin"><Ic name="fuerza" size={30} /></span>}
          {seleccion && sel && <span className="marca"><Ic name="check" size={13} /></span>}
        </div>
        <div style={{ padding: '8px 10px' }}>
          <div style={{ fontSize: 13, color: 'var(--n)', lineHeight: 1.3 }}>{e.nombre}</div>
          {/* Cómo se mide decide qué campos pedirá la sesión: conviene saberlo antes. */}
          <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 2 }}>
            {MEDIDA[e.tipo_medida] || MEDIDA.peso_reps}
          </div>
          {grupos.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
              {grupos.slice(0, 3).map(g => {
                // La madre se marca también cuando quien casa con el filtro es una hija:
                // si filtras por "Vasto Medial", la tarjeta sigue diciendo "Cuádriceps"
                // pero resaltado, y así se entiende por qué ha entrado en el resultado.
                const marcada = filtroEt.includes(g.raiz.id) || g.hijas.some((h: any) => filtroEt.includes(h.id))
                const detalle = g.hijas.map((h: any) => h.nombre).join(' · ')
                return (
                  <span key={g.raiz.id} className="badge badge-g" title={detalle || undefined}
                    style={marcada ? { background: 'var(--g)', color: '#fff' } : undefined}>
                    {g.raiz.nombre}{g.hijas.length > 0 && <span style={{ opacity: .7, marginLeft: 4 }}>{g.hijas.length}</span>}
                  </span>
                )
              })}
              {grupos.length > 3 && <span style={{ fontSize: 11, color: 'var(--gr)' }}>+{grupos.length - 3}</span>}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <input className="input" placeholder="Buscar ejercicio…" value={buscar}
          onChange={e => setBuscar(e.target.value)} style={{ flex: 1, minWidth: 190 }} />
        <span style={{ fontSize: 12, color: 'var(--gr)', whiteSpace: 'nowrap' }}>
          {filtrados.length} {filtrados.length === 1 ? 'ejercicio' : 'ejercicios'}
        </span>
        {acciones}
      </div>

      {grupos.length > 0 && (
        <div className="filtros-et">
          {grupos.map(g => (
            <div key={g.key} className="fil-fila">
              <span className="fil-cat">{g.label}</span>
              <div className="fil-chips">
                {g.etiquetas.map((et: any) => {
                  const n = Math.min(nivelDe(etiquetas, et), 2)
                  return (
                    <button key={et.id} type="button"
                      className={`chip-sel niv-${n} ${filtroEt.includes(et.id) ? 'on' : ''}`}
                      title={n > 0 ? 'Subetiqueta' : 'Incluye sus subetiquetas'}
                      onClick={() => setFiltroEt(prev => prev.includes(et.id) ? prev.filter(x => x !== et.id) : [...prev, et.id])}>
                      {et.nombre}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          {filtroEt.length > 0 && (
            <button type="button" className="btn btn-t btn-sm" style={{ marginTop: 6 }}
              onClick={() => setFiltroEt([])}>Quitar los {filtroEt.length} filtros</button>
          )}
        </div>
      )}

      {/* Los sugeridos se esconden en cuanto buscas o filtras: ahí ya sabes qué quieres. */}
      {sugeridos && sugeridos.items.length > 0 && !hayFiltro && (
        <div style={{ marginBottom: 16 }}>
          <div className="et-mini" style={{ marginBottom: 7, color: 'var(--gd)' }}>{sugeridos.titulo}</div>
          <div className="rej-ej">
            {sugeridos.items.map(e => <Tarjeta key={'s' + e.id} e={e} />)}
          </div>
        </div>
      )}

      {filtrados.length === 0
        ? <div className="muted">{ejercicios.length === 0 ? 'No hay ejercicios en la biblioteca.' : 'Ningún ejercicio coincide.'}</div>
        : <div className="rej-ej">{filtrados.map(e => <Tarjeta key={e.id} e={e} />)}</div>}
    </div>
  )
}

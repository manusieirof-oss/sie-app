'use client'
import { useState } from 'react'
import { Ic } from '@/lib/icons'
import { CATEGORIAS_ETIQUETA, conDescendientes, categoriaDe, nivelDe, agrupaPorRaiz } from '@/lib/etiquetas'
import { TIPOS_MEDIDA, problemasDeEjercicio } from '@/lib/ejercicios'

// Explorador del catálogo de ejercicios: buscador, filtro por etiquetas y rejilla de
// tarjetas con foto. Es LA MISMA vista que el Pilar Entrenamiento → Biblioteca; lo que
// cambia es qué pasa al pulsar una tarjeta. Igual que hicimos con DetalleSesion: una
// vista, distintas acciones.
//
//   Biblioteca  -> `onAbrir`, para ver y editar el ejercicio.
//   Sesión      -> `seleccion` + `onAlternar`, para marcar varios y añadirlos de golpe.
//
// Lo usan los dos: la Biblioteca y el editor de sesión. Antes eran dos copias de la
// misma rejilla y ya habían empezado a divergir en qué campos buscaban.

/** Cómo se lee cada hueco en la pastilla de la tarjeta, cuando solo falta uno. */
const FALTA: Record<string, string> = {
  etiquetas: 'etiquetar',
  imagen: 'la foto',
  descripcion: 'la descripción',
  ejecucion: 'la ejecución',
}

const MEDIDA: Record<string, string> = {
  peso_reps: 'Peso y reps',
  tiempo: 'Tiempo',
  peso_tiempo: 'Peso y tiempo',
}

export default function ExploradorEjercicios({
  ejercicios, etiquetas = [], seleccion, onAlternar, onAbrir, sugeridos, acciones, onCrear,
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
  /**
   * Crear un ejercicio que no está en el catálogo, con lo mínimo. Si no se pasa, la
   * tira de crear no aparece: hay pantallas donde esto no tiene sentido.
   */
  onCrear?: (nombre: string, tipoMedida: string) => Promise<void> | void
}) {
  const [buscar, setBuscar] = useState('')
  const [filtroEt, setFiltroEt] = useState<string[]>([])
  /** Categorías con las subetiquetas a la vista. Se recuerda por categoría, no global. */
  const [desplegadas, setDesplegadas] = useState<string[]>([])
  /** Ver solo los que tienen huecos. Ver `problemasDeEjercicio` en lib/ejercicios. */
  const [soloPendientes, setSoloPendientes] = useState(false)
  const [creando, setCreando] = useState(false)

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

  /**
   * La variante que casa con lo buscado, si la hay.
   *
   * Buscar "en tándem" tiene que encontrar "Marcha" —que es donde vive esa variante—,
   * pero enseñar la tarjeta con la foto de la marcha de talones sería engañoso: el
   * paciente vería un ejercicio distinto del que se le prescribió. Así que la tarjeta
   * pasa a mostrar la variante que casó, con su nombre y su imagen si la tiene.
   *
   * Solo aplica a la BÚSQUEDA por texto. Filtrar por etiqueta no sirve para esto: las
   * etiquetas son del ejercicio entero, no de cada variante, así que no hay forma de
   * saber cuál de ellas hizo casar el filtro.
   */
  function varianteQueCasa(e: any): any {
    const q = buscar.trim().toLowerCase()
    if (!q) return null
    // Si el nombre del ejercicio ya casa, manda él: buscar "marcha" enseña la marcha.
    if ((e.nombre || '').toLowerCase().includes(q)) return null
    return (e.variantes || []).find((v: any) => (v?.nombre || '').toLowerCase().includes(q)) || null
  }

  const filtrados = ejercicios.filter(e => {
    const q = buscar.toLowerCase()
    const coincide = !buscar
      || (e.nombre || '').toLowerCase().includes(q)
      || (e.descripcion || '').toLowerCase().includes(q)
      || (e.variantes || []).some((v: any) => (v?.nombre || '').toLowerCase().includes(q))
    // Varias etiquetas se acumulan: piden los que las tengan TODAS. Y cada una vale
    // por su rama entera, así que filtrar por "Cuádriceps" trae lo etiquetado solo
    // como "Recto femoral" — si no, habría que acordarse del nivel exacto.
    const etiquetado = filtroEt.length === 0 || filtroEt.every(id => {
      const rama = conDescendientes(etiquetas, id)
      return (e.etiquetas || []).some((x: string) => rama.includes(x))
    })
    return coincide && etiquetado && (!soloPendientes || problemasDeEjercicio(e).length > 0)
  })

  const nPendientes = ejercicios.filter(e => problemasDeEjercicio(e).length > 0).length

  /**
   * Ofrecer crear lo buscado solo cuando NO existe ya con ese nombre exacto.
   *
   * Se ofrece aunque haya resultados parecidos: buscando "press Pallof de rodillas"
   * aparece "press Pallof", que no es el mismo ejercicio. Lo que no se puede es ofrecer
   * crear algo que ya está, porque duplicarlo parte en dos la progresión del paciente.
   */
  const aCrear = buscar.trim()
  const yaExiste = ejercicios.some(e => (e.nombre || '').trim().toLowerCase() === aCrear.toLowerCase())
  const ofreceCrear = !!onCrear && aCrear.length >= 3 && !yaExiste

  const hayFiltro = !!buscar || filtroEt.length > 0 || soloPendientes
  const marcado = (e: any) => !!seleccion?.includes(e.id)

  function Tarjeta({ e }: { e: any }) {
    const sel = marcado(e)
    // Se agrupan bajo su raíz, así que las tres que caben son tres MADRES y no tres
    // etiquetas sueltas: antes una tarjeta podía enseñar "Cuádriceps, Vasto Medial,
    // Rodilla" y gastar dos huecos en decir lo mismo.
    const grupos = agrupaPorRaiz(etiquetas, e.etiquetas || [])
    const vc = varianteQueCasa(e)
    const img = (vc?.imagen_url) || e.imagen_url
    return (
      <div className={`tarj-ej ${sel ? 'on' : ''}`}
        onClick={() => (onAlternar ? onAlternar(e) : onAbrir?.(e))}>
        <div className="tarj-img">
          {img
            ? <img src={img} alt={vc ? `${e.nombre} · ${vc.nombre}` : e.nombre} />
            : <span className="sin"><Ic name="fuerza" size={30} /></span>}
          {seleccion && sel && <span className="marca"><Ic name="check" size={13} /></span>}
        </div>
        <div style={{ padding: '8px 10px' }}>
          {/* Cuando lo que casó fue una variante, ella manda en el título y el nombre
              del ejercicio queda debajo, en pequeño: hay que saber de dónde sale. */}
          <div style={{ fontSize: 13, color: 'var(--n)', lineHeight: 1.3 }}>{vc ? vc.nombre : e.nombre}</div>
          {vc && <div style={{ fontSize: 11, color: 'var(--g)', marginTop: 1 }}>{e.nombre}</div>}
          {/* Cómo se mide decide qué campos pedirá la sesión: conviene saberlo antes. */}
          <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 2 }}>
            {MEDIDA[e.tipo_medida] || MEDIDA.peso_reps}
          </div>
          {/* Lo que le falta se ve AQUÍ y no solo en la lista de pendientes: es al
              montar la sesión cuando te topas con el ejercicio a medias, y es el
              momento en el que puedes decidir completarlo o usar otro. */}
          {(() => {
            const faltan = problemasDeEjercicio(e)
            if (faltan.length === 0) return null
            return (
              <div style={{ marginTop: 5 }}>
                <span className="badge badge-pen" title={faltan.map(f => f.texto).join('\n')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Ic name="alerta" size={9} /> Falta{faltan.length > 1 ? `n ${faltan.length} cosas` : ` ${FALTA[faltan[0].campo]}`}
                </span>
              </div>
            )
          })()}
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
        {nPendientes > 0 && (
          <button type="button" className={`chip-sel ${soloPendientes ? 'on' : ''}`}
            onClick={() => setSoloPendientes(v => !v)}
            title="Los que se crearon a medias o les falta algo por rellenar">
            Por completar · {nPendientes}
          </button>
        )}
        {acciones}
      </div>

      {/* CREAR LO QUE NO ESTÁ. Aparece donde surge la necesidad —buscando algo que no
          existe— y pide lo mínimo: el nombre ya está escrito, y cómo se mide, que no se
          puede adivinar porque decide si la sesión pide kilos o segundos. Lo demás se
          rellena luego desde "Por completar". */}
      {ofreceCrear && (
        <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10,
          padding: '8px 11px', borderRadius: 'var(--r)', background: 'var(--bl)', border: '1px dashed var(--gm)' }}>
          <span style={{ fontSize: 12, color: 'var(--gr)' }}>
            Crear &laquo;<b style={{ color: 'var(--n)' }}>{aCrear}</b>&raquo; y a&ntilde;adirlo. &iquest;C&oacute;mo se mide?
          </span>
          {TIPOS_MEDIDA.map(m => (
            <button key={m.id} type="button" className="chip-sel" title={m.ayuda} disabled={creando}
              onClick={async () => {
                setCreando(true)
                try { await onCrear!(aCrear, m.id) } finally { setCreando(false) }
                setBuscar('')
              }}>
              {m.nombre}
            </button>
          ))}
          {creando && <span style={{ fontSize: 12, color: 'var(--gr)' }}>Creando…</span>}
        </div>
      )}

      {grupos.length > 0 && (
        <div className="filtros-et">
          {grupos.map(g => {
            // Por defecto solo las raíces. Con todos los niveles a la vez, Músculo
            // sacaba ochenta pastillas y encontrar "Vasto Medial" era peor que no
            // tener filtro. La cabecera dice cuántas hay dentro y las abre de golpe.
            const hijas = g.etiquetas.filter((et: any) => nivelDe(etiquetas, et) > 0)
            // Si hay una hija filtrada, la categoría se abre sola: si no, verías el
            // contador de filtros activos sin ver cuál está puesto.
            const abierta = desplegadas.includes(g.key) || hijas.some((h: any) => filtroEt.includes(h.id))
            const lista = abierta ? g.etiquetas : g.etiquetas.filter((et: any) => nivelDe(etiquetas, et) === 0)

            return (
              <div key={g.key} className="fil-fila">
                <span className="fil-cat">
                  {g.label}
                  {hijas.length > 0 && (
                    <button type="button" title={abierta ? 'Ocultar subetiquetas' : `Ver las ${hijas.length} subetiquetas`}
                      onClick={() => setDesplegadas(p => p.includes(g.key) ? p.filter(x => x !== g.key) : [...p, g.key])}
                      style={{ marginLeft: 5, border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'var(--g)', display: 'inline-flex', alignItems: 'center', gap: 2, font: 'inherit' }}>
                      {!abierta && <span style={{ fontSize: 10 }}>{hijas.length}</span>}
                      <Ic name={abierta ? 'arriba' : 'abajo'} size={11} />
                    </button>
                  )}
                </span>
                <div className="fil-chips">
                  {lista.map((et: any) => {
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
            )
          })}
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
        ? <div className="muted">{ejercicios.length === 0 ? 'No hay ejercicios en la biblioteca.'
            : soloPendientes && !buscar && filtroEt.length === 0 ? 'No queda ningún ejercicio por completar.'
            : 'Ningún ejercicio coincide.'}</div>
        : <div className="rej-ej">{filtrados.map(e => <Tarjeta key={e.id} e={e} />)}</div>}
    </div>
  )
}

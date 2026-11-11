'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { ordenAnatomico, zonaEstaMapeada } from '@/lib/anatomia'
import ModalItemClinico from '@/components/ModalItemClinico'
import ImagenEjercicio from '@/components/ImagenEjercicio'
import { categoriaDe, normNombre, nombreConRama } from '@/lib/etiquetas'
import { etiquetasQueCasan } from '@/lib/reglasClinicas'

/**
 * Las seis listas del Pilar Clínico, en un solo componente.
 *
 * Antes eran tres: patologías y molestias cada una por su lado y sin poder añadir nada
 * —había que meter filas a mano en Supabase—, y un catálogo genérico para las otras
 * cuatro. Tres sitios haciendo casi lo mismo es la receta para que un día uno gane un
 * buscador y los otros no.
 *
 * LAS ETIQUETAS SON LAS MISMAS QUE TODO LO DEMÁS. No una lista aparte: el árbol que ya
 * usan ejercicios, tests y objetivos. Una patología de hombro y un ejercicio de hombro
 * comparten vocabulario, y el día que quieras cruzarlos no hay nada que traducir.
 */

export type ConfigClinica = {
  tabla: string
  /** Cómo se llama en singular, para los textos. */
  tipo: string
  /** Columna por la que se agrupa: 'zona' o 'categoria'. */
  campoGrupo: 'zona' | 'categoria'
  tema?: 'neutro' | 'rojo' | 'ambar'
  /** Campos propios de esa tabla que se enseñan en el detalle. */
  extras?: { campo: string, etiqueta: string }[]
}

const TEMAS: any = {
  neutro: { bg: 'var(--bl)', border: '1px solid var(--bd)', color: 'var(--n)' },
  rojo: { bg: 'var(--redl)', border: '1px solid #F5C8C8', color: 'var(--red)' },
  ambar: { bg: 'var(--ambl)', border: '1px solid var(--amb)', color: '#7A5800' },
}

export default function BibliotecaClinica({ items, config, etiquetas = [], ejercicios = [], cargar }: {
  items: any[]
  config: ConfigClinica
  etiquetas: any[]
  ejercicios?: any[]
  cargar: () => void
}) {
  const [buscar, setBuscar] = useState('')
  const [detalle, setDetalle] = useState<any>(null)
  const [editando, setEditando] = useState<any>(null)
  const [guardando, setGuardando] = useState(false)

  const chip = TEMAS[config.tema || 'neutro']
  const nombreEt = (id: string) => etiquetas.find((e: any) => e.id === id)?.nombre || ''
  const g = config.campoGrupo

  const q = buscar.trim().toLowerCase()
  const filtrados = (items || []).filter((i: any) =>
    !q || (i.nombre || '').toLowerCase().includes(q) || (i[g] || '').toLowerCase().includes(q)
    || (i.descripcion || '').toLowerCase().includes(q))

  // Las zonas van en orden anatómico; las categorías, alfabético. Una lista de partes del
  // cuerpo ordenada por la eme no se recorre igual que un cuerpo.
  const grupos = Array.from(new Set(filtrados.map((i: any) => i[g] || 'Otros')))
    .sort((a: any, b: any) => g === 'zona' ? ordenAnatomico(a, b) : String(a).localeCompare(String(b)))

  /** Zonas usadas que la silueta no sabe dónde pintar. Ver lib/anatomia.ts. */
  const sinMapear = g === 'zona'
    ? Array.from(new Set((items || []).map((i: any) => i[g]).filter(Boolean)))
        .filter((z: any) => !zonaEstaMapeada(z))
        .sort((a: any, b: any) => String(a).localeCompare(String(b)))
    : []

  function abrirNuevo() {
    setEditando({ nombre: '', [g]: '', descripcion: '', etiquetas: [] })
  }

  async function borrar(i: any) {
    if (!confirm(`Eliminar "${i.nombre}" del catálogo.\n\nLo que ya esté asignado a un paciente no se toca.`)) return
    await supabase.from(config.tabla).delete().eq('id', i.id)
    setDetalle(null); cargar()
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <input className="input" placeholder={`Buscar ${config.tipo}…`} value={buscar}
          onChange={e => setBuscar(e.target.value)} style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--grl)', whiteSpace: 'nowrap' }}>{filtrados.length}</span>
        <button className="btn btn-p btn-sm" onClick={abrirNuevo}>+ Añadir</button>
      </div>

      {/* LAS ZONAS QUE EL MAPA NO SABE COLOCAR.
          En la ficha del paciente, lo que no encuentra coordenada cae en "Sin localizar"
          y ahí no se puede hacer nada. El sitio para arreglarlo es este, que es donde se
          escriben las zonas: se avisa aquí y se corrige aquí. */}
      {g === 'zona' && sinMapear.length > 0 && (
        <div className="fila-p" style={{ borderLeftColor: 'var(--amb)', marginBottom: 10 }}>
          <div style={{ fontSize: 13, color: 'var(--n)', lineHeight: 1.6 }}>
            <b>{sinMapear.length} zona{sinMapear.length > 1 ? 's' : ''} que el mapa corporal no sabe colocar:</b>{' '}
            {sinMapear.join(', ')}.
            <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 3 }}>
              Lo que use esa zona saldrá en "Sin localizar" al ver el cuerpo del paciente.
              Renómbrala a una de las que el mapa conoce o dímelo para añadirla.
            </div>
          </div>
        </div>
      )}

      {grupos.length === 0 && <div className="muted">Sin elementos.</div>}

      {grupos.map((grupo: any) => {
        const its = filtrados.filter((i: any) => (i[g] || 'Otros') === grupo)
        return (
          <div key={grupo} className="sec">
            <div className="sec-h">
              <span className="sh-l">
                <span className="ct-l"><Ic name="ubicacion" size={13} /> {grupo}</span>
                {g === 'zona' && !zonaEstaMapeada(grupo) && (
                  <span className="pill pill-soft" title="El mapa corporal no sabe dónde pintar esta zona">
                    sin sitio en el mapa
                  </span>
                )}
              </span>
              <span className="sh-r">{its.length}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {its.map((i: any) => (
                <button key={i.id} onClick={() => setDetalle(i)}
                  title="Ver detalle"
                  style={{ fontSize: 13, padding: '4px 11px', borderRadius: 99, background: chip.bg, border: chip.border, color: chip.color, cursor: 'pointer' }}>
                  {i.nombre}
                </button>
              ))}
            </div>
          </div>
        )
      })}

      {/* DETALLE · lo que se ve al pulsar una píldora */}
      {detalle && !editando && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setDetalle(null) }}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-title">
              {detalle.nombre}
              <button className="modal-close" onClick={() => setDetalle(null)}><Ic name="cerrar" size={15} /></button>
            </div>

            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
              <span className="pill pill-soft">{detalle[g] || 'Otros'}</span>
              {(config.extras || []).map(x => detalle[x.campo] && (
                <span key={x.campo} className="pill pill-soft">{detalle[x.campo]}</span>
              ))}
            </div>

            {detalle.descripcion
              ? <p style={{ fontSize: 13, color: 'var(--n)', lineHeight: 1.6, margin: '0 0 10px' }}>{detalle.descripcion}</p>
              : <p style={{ fontSize: 13, color: 'var(--grl)', margin: '0 0 10px' }}>Sin descripción todavía.</p>}

            {/* Las precauciones no son una descripción más: es lo que hay que tener
                delante antes de prescribir, así que va destacado y no en el párrafo. */}
            {detalle.precauciones && (
              <div className="fila-p" style={{ borderLeftColor: 'var(--amb)', marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--n)', lineHeight: 1.5 }}>
                  <b>Precauciones:</b> {detalle.precauciones}
                </span>
              </div>
            )}

            {(detalle.etiquetas || []).length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                {(detalle.etiquetas || []).map((id: string) => (
                  <span key={id} className="pill pill-o on">{nombreEt(id)}</span>
                ))}
              </div>
            )}

            {/* QUÉ EVITAR Y QUÉ CONVIENE, y con ellos qué ejercicios avisan y cuáles le van. */}
            {(() => {
              const ev: string[] = detalle.evitar || [], co: string[] = detalle.conviene || []
              const nm = (id: string) => { const e = etiquetas.find((x: any) => x.id === id); return e ? nombreConRama(etiquetas, e) : '' }
              // Indicados: los que llevan su etiqueta de patología (mismo nombre) o algo de «conviene»,
              // y nada de «evitar».
              const etPat = etiquetas.filter((e: any) => categoriaDe(etiquetas, e) === 'patologia' && normNombre(e.nombre) === normNombre(detalle.nombre)).map((e: any) => e.id)
              const aEvitar = (ejercicios || []).filter((x: any) => etiquetasQueCasan(etiquetas, ev, x.etiquetas || []).length > 0)
              const indicados = (ejercicios || []).filter((x: any) => !aEvitar.includes(x) &&
                ((x.etiquetas || []).some((t: string) => etPat.includes(t)) || etiquetasQueCasan(etiquetas, co, x.etiquetas || []).length > 0))
              if (!ev.length && !co.length && !indicados.length) return null
              return (
                <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
                  {ev.length > 0 && <div><span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 500 }}>Evitar: </span>
                    <span style={{ fontSize: 12.5 }}>{ev.map(nm).filter(Boolean).join(', ')}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--grl)' }}> · avisa en {aEvitar.length} ejercicio{aEvitar.length === 1 ? '' : 's'}</span></div>}
                  {co.length > 0 && <div><span style={{ fontSize: 12, color: 'var(--gd)', fontWeight: 500 }}>Conviene: </span>
                    <span style={{ fontSize: 12.5 }}>{co.map(nm).filter(Boolean).join(', ')}</span></div>}
                  {indicados.length > 0 && <div>
                    <div className="et-mini" style={{ marginBottom: 5 }}>{indicados.length} ejercicio{indicados.length === 1 ? '' : 's'} indicado{indicados.length === 1 ? '' : 's'}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(78px,1fr))', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                      {indicados.slice(0, 60).map((x: any) => (
                        <a key={x.id} href={`/torno/amasar/${x.id}`} title={x.nombre} style={{ textDecoration: 'none', color: 'var(--n)' }}>
                          <div style={{ borderRadius: 8, overflow: 'hidden' }}><ImagenEjercicio src={x.imagen_url} etiquetasEj={x.etiquetas} ejercicioId={x.id} radio={0} fondo="var(--bl)" icono={14} insignias={false}/></div>
                          <div style={{ fontSize: 10, lineHeight: 1.2, marginTop: 2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{x.nombre}</div>
                        </a>
                      ))}
                    </div>
                  </div>}
                </div>
              )
            })()}

            <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
              <button className="btn btn-t btn-sm" style={{ color: 'var(--red)' }} onClick={() => borrar(detalle)}>
                <Ic name="papelera" size={12} /> Borrar
              </button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-s btn-sm" onClick={() => setEditando({ ...detalle })}>
                <Ic name="editar" size={12} /> Editar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ALTA Y EDICIÓN */}
      {/* El alta y la edición viven en `ModalItemClinico`, compartido con la ficha del
          paciente y la valoración: antes cada sitio se inventaba su propio formulario. */}
      {editando && (
        <ModalItemClinico
          config={{ tabla: config.tabla, tipo: config.tipo, campoGrupo: g }}
          valor={editando} etiquetas={etiquetas}
          onGuardado={() => { setEditando(null); setDetalle(null); cargar() }}
          onCerrar={() => setEditando(null)}/>
      )}
    </>
  )
}

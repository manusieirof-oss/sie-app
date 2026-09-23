'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { categoriaDe, zonasDe, casaZona } from '@/lib/etiquetas'
import FiltroZonas from '@/components/FiltroZonas'
import { contiene } from '@/lib/texto'
import { especificosDeObjetivo, alcanceObjetivo, archivarObjetivo, borrarObjetivo } from '@/lib/objetivos'
import { conteoPorObjetivo, type Conteo } from '@/lib/objetivosTests'
import ModalObjetivo from './ModalObjetivo'

/**
 * La biblioteca de objetivos.
 *
 * Aqui solo se listan, se filtran por zona y se borran. Crear y editar vive en
 * `ModalObjetivo`, que tambien se abre desde los sistemas: el mismo formulario
 * en un solo sitio.
 */

export default function ObjetivosTab({ objetivos, testsLib, etiquetas = [], cargar }: any) {
  const [zona, setZona] = useState<string>('')
  const [busca, setBusca] = useState('')
  const [soloPendientes, setSoloPendientes] = useState(false)
  const [editando, setEditando] = useState<any>(undefined)
  const [evalua, setEvalua] = useState<Record<string, Conteo>>({})
  const [enUso, setEnUso] = useState<Record<string, number>>({})
  // Los archivados no vienen con el resto: se piden aparte y solo cuando se miran.
  const [verArchivados, setVerArchivados] = useState(false)
  const [archivados, setArchivados] = useState<any[]>([])
  const [nArchivados, setNArchivados] = useState(0)

  useEffect(() => {
    supabase.from('objetivos').select('*').eq('activo', true).not('archivado_el', 'is', null)
      .order('nombre').then(({ data }) => { setArchivados(data || []); setNArchivados((data || []).length) })
  }, [objetivos])

  // Cuántos pacientes tienen cada objetivo abierto. Es lo que dice si una ficha se usa o
  // sobra, y hasta ahora no se sabía: la biblioteca crecía sin que nadie la podase.
  useEffect(() => {
    supabase.from('pacientes_objetivos').select('objetivo_id,logrado').then(({ data }) => {
      const m: Record<string, number> = {}
      ;(data || []).forEach((p: any) => { if (!p.logrado) m[p.objetivo_id] = (m[p.objetivo_id] || 0) + 1 })
      setEnUso(m)
    })
  }, [objetivos])

  // Con que se evalua cada uno. Un objetivo sin nada no entra en ninguna evaluacion.
  useEffect(() => { conteoPorObjetivo().then(setEvalua) }, [objetivos])

  const nombreEt = (id: string) => etiquetas.find((e: any) => e.id === id)?.nombre || ''
  const nombreTest = (id: string) => (testsLib || []).find((t: any) => t.id === id)?.nombre || ''

  /** Las etiquetas de zona de un objetivo: su articulación y las que lleve entre las
   *  libres. Sin resolver a raíz — de eso ya se encarga `FiltroZonas` y `casaZona`. */
  const zonaIdsDe = (o: any) => [o?.articulacion_id, ...(o?.etiquetas || [])].filter(Boolean) as string[]

  /**
   * Las etiquetas de articulación que los objetivos usan de verdad.
   *
   * SOLO ARTICULACIONES. Antes entraban también las `etiquetas` libres —que son
   * patologías— y la fila salía con decenas de pastillas donde la mitad no eran zonas.
   */
  const zonasUsadas = useMemo(() => {
    const ids = Array.from(new Set((objetivos || []).flatMap(zonaIdsDe))) as string[]
    return ids.filter(id => {
      const et = etiquetas.find((e: any) => e.id === id)
      return !!et && categoriaDe(etiquetas, et) === 'articulacion'
    })
  }, [objetivos, etiquetas])

  /** Los que no tienen ninguna zona. Sin este cajón no habría forma de dar con ellos. */
  const sinZona = (objetivos || []).filter((o: any) => zonasDe(etiquetas, zonaIdsDe(o)).length === 0).length

  /** Sin nada con que medirlo no entra en ninguna evaluacion: esta a medias. */
  const porCompletar = (o: any) => {
    const ev = evalua[o.id]
    return (ev?.tests || 0) + (ev?.cuestionarios || 0) === 0
  }
  const nPendientes = (objetivos || []).filter(porCompletar).length

  // Los archivados se traen aparte; del listado normal se caen aqui, y no en la
  // consulta de la pagina, para que el resto de pestanas puedan seguir escribiendo
  // el nombre de uno archivado que ya estuviera puesto en una sesion.
  const base = (verArchivados ? archivados : (objetivos || []).filter((o: any) => o.archivado_el == null)) as any[]
  const filtrados = base.filter((o: any) =>
    casaZona(etiquetas, zonaIdsDe(o), zona) &&
    (soloPendientes === false || porCompletar(o)) &&
    (contiene(o.nombre || '', busca) || contiene(o.descripcion || '', busca)))


  const abrirNuevo = () => setEditando(null)
  const abrirEditar = (o: any) => setEditando(o)

  /**
   * ARCHIVAR, y borrar de verdad solo lo que no ha tocado nadie.
   *
   * Un objetivo que lleva alguien encima no se puede borrar sin reescribir el
   * pasado: se va en cascada de su ficha, de las sesiones ya dadas y de las
   * fases de los ciclos. Ver `alcanceObjetivo`.
   */
  async function retirar(o: any) {
    const a = await alcanceObjetivo(o.id)
    if (a.limpio) {
      if (!confirm(`Eliminar "${o.nombre}".\n\nNo lo lleva ningún paciente ni ninguna sesión, así que no se pierde nada.\n\nNo se puede deshacer.`)) return
      const r = await borrarObjetivo(o.id)
      if (r.ok === false) { alert('No se ha eliminado: ' + r.error); return }
      cargar(); return
    }
    const lineas = [`Archivar "${o.nombre}".`, '']
    if (a.pacientes > 0) lineas.push(`\u00b7 ${a.pacientes} paciente${a.pacientes === 1 ? ' lo lleva' : 's lo llevan'}${a.logrados > 0 ? `, y ${a.logrados} ya lo ${a.logrados === 1 ? 'tiene' : 'tienen'} logrado` : ''}.`)
    if (a.sesiones > 0) lineas.push(`\u00b7 ${a.sesiones} sesi\u00f3n${a.sesiones === 1 ? '' : 'es'} lo trabaja${a.sesiones === 1 ? '' : 'n'}.`)
    if (a.fases > 0) lineas.push(`\u00b7 ${a.fases} fase${a.fases === 1 ? '' : 's'} de ciclo lo usa${a.fases === 1 ? '' : 'n'} para cerrarse.`)
    lineas.push('', 'Todo eso se queda como está. El objetivo desaparece de la biblioteca y no se le podrá poner a nadie más.')
    if (!confirm(lineas.join('\n'))) return
    const r = await archivarObjetivo(o.id, true)
    if (r.ok === false) { alert('No se ha archivado: ' + r.error); return }
    cargar()
  }

  async function desarchivar(o: any) {
    const r = await archivarObjetivo(o.id, false)
    if (r.ok === false) { alert('No se ha podido: ' + r.error); return }
    cargar()
  }

  return (
    <div className="panel">
      <div className="sec">
        <div className="sec-h">
          <span className="sh-l">
            <span className="ct-l"><Ic name="objetivo" size={13} /> Objetivos</span>
            <button className="btn btn-p btn-sm" onClick={abrirNuevo}>+ Nuevo</button>
          </span>
          <span className="sh-r">
            {busca.trim() === '' && zona === ''
              ? `${base.length} en total`
              : `${filtrados.length} de ${base.length}`}
          </span>
        </div>

        <div style={{ marginBottom: 12 }}>
          {/* Con 36 fichas el filtro de zona no basta: si sabes como se llama,
            escribirlo es mas rapido que acordarte de que zona era. */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <input className="input" style={{ maxWidth: 330 }}
            value={busca} onChange={ev => setBusca(ev.target.value)}
            placeholder="Buscar objetivo por nombre…"/>
          {/* Como los ejercicios a medias: se ven aparte, no se buscan uno a uno. */}
          {nPendientes > 0 && verArchivados === false && (
            <button className={`pill ${soloPendientes ? 'pill-o on' : 'pill-soft'}`}
              style={{ border: 'none', cursor: 'pointer' }}
              onClick={() => setSoloPendientes(v => v === false)}>
              {nPendientes} por completar
            </button>
          )}
          {/* Los archivados existen pero no estorban: solo se ven si los pides. */}
          {nArchivados > 0 && (
            <button className={`pill ${verArchivados ? 'pill-o on' : 'pill-soft'}`}
              style={{ border: 'none', cursor: 'pointer' }}
              onClick={() => { setVerArchivados(v => v === false); setSoloPendientes(false) }}>
              {nArchivados} archivado{nArchivados === 1 ? '' : 's'}
            </button>
          )}
        </div>

        <FiltroZonas etiquetas={etiquetas} usadas={zonasUsadas}
            valor={zona} onChange={setZona} nSinZona={sinZona} todas="Todas las zonas" />
        </div>

        {filtrados.length === 0 ? (
          <div className="muted">
            {(objetivos || []).length === 0 ? 'Sin objetivos todavía.' : 'Ninguno coincide.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(232px,1fr))', gap: 12 }}>
            {filtrados
              .map((o: any) => {
                const movs = especificosDeObjetivo(etiquetas, o.movimientos).map((e: any) => e.nombre)
                const n = enUso[o.id] || 0
                const ev = evalua[o.id] || { tests: 0, cuestionarios: 0 }
                return (
                  <div key={o.id} className="obj-card">
                    {/* La imagen manda: es lo primero que se reconoce. Sin ella, la inicial
                        sobre el color del objetivo — veinte huecos grises iguales se leen
                        como que algo ha fallado, y el color ya separa fuerza de movilidad. */}
                    {/* El tinte se hace pegando alfa al hex, así que solo vale si HAY hex:
                        con `var(--g)` saldría `var(--g)14`, que el navegador tira. */}
                    <div className="obj-card-img">
                      {o.imagen_url
                        ? <img src={o.imagen_url} alt="" />
                        : <span style={{ color: 'var(--g)' }}>{(o.nombre || '?').trim().charAt(0).toUpperCase()}</span>}
                    </div>
                    <div className="obj-card-b">
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--n)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', lineHeight: 1.3 }}>
                        {o.nombre}
                        {o.articulacion_id && <span style={{ fontSize: 12, color: 'var(--gr)' }}>{nombreEt(o.articulacion_id)}</span>}
                      </div>
                      {o.descripcion && (
                        // Cortada a cuatro líneas: una descripción larga estiraba su
                        // tarjeta y descolocaba toda la fila de la rejilla. Entera se lee
                        // al abrir el objetivo.
                        <div title={o.descripcion} style={{ fontSize: 12, color: 'var(--gr)', lineHeight: 1.5, marginTop: 4, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{o.descripcion}</div>
                      )}
                      {/* LOS MOVIMIENTOS SON LOS OBJETIVOS ESPECÍFICOS, y se pintan como
                          tales: colgando del general, uno por línea. Antes iban en una
                          sola línea gris separados por puntos, y no se leían como lo que
                          son —"mejorar la dorsiflexión de tobillo" vive dentro de
                          "Movilidad de tobillo"—, así que parecía que faltaban fichas. */}
                      {/* Los específicos salen en TODOS los objetivos: son sus partes, y da
                          igual cómo se cierre cada una. */}
                      {movs.length > 0 && (
                        <div style={{ marginTop: 5, borderLeft: '2px solid var(--gm)', paddingLeft: 9 }}>
                          {movs.map((m: string) => (
                            <div key={m} style={{ fontSize: 12, color: 'var(--gr)', padding: '1px 0', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--g)', flexShrink: 0 }} />
                              {m}
                            </div>
                          ))}
                        </div>
                      )}
                      {(o.etiquetas || []).length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                          {(o.etiquetas || []).map((id: string) => (
                            <span key={id} className="pill pill-soft">{nombreEt(id)}</span>
                          ))}
                        </div>
                      )}
                      {/* CON QUE SE MIRA SI ESTA CONSEGUIDO. Un objetivo sin nada no
                          entra en ninguna evaluacion, y eso hay que verlo desde fuera. */}
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                        {ev.tests > 0 && (
                          <span className="pill pill-o on" title="Tests que lo evalúan">
                            ◎ {ev.tests} test{ev.tests === 1 ? '' : 's'}
                          </span>
                        )}
                        {ev.cuestionarios > 0 && (
                          <span className="pill pill-o on" title="Cuestionarios que lo evalúan">
                            ✎ {ev.cuestionarios} cuestionario{ev.cuestionarios === 1 ? '' : 's'}
                          </span>
                        )}
                        {ev.tests === 0 && ev.cuestionarios === 0 && (
                          <span className="pill" title="Sin forma de medirlo: no entra en ninguna evaluación"
                            style={{ background:'var(--ambl)', border:'1px solid var(--amb)', color:'#7A5800' }}>
                            por completar
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="obj-card-f">
                      {/* Sin nadie que lo tenga abierto no se escribe nada: un guión suelto
                          no informa de más que el hueco vacío y ensucia el pie de veinte
                          tarjetas. El `flex:1` se queda para empujar los botones a la derecha. */}
                      <span style={{ flex: 1, fontSize: 12, color: 'var(--gd)', whiteSpace: 'nowrap' }}
                        title={n > 0 ? `${n} pacientes lo tienen abierto` : undefined}>
                        {n > 0 ? `${n} abiertos` : ''}
                      </span>
                      {verArchivados ? (
                        <button className="btn btn-s btn-sm" onClick={() => desarchivar(o)}>
                          <Ic name="recuperar" size={12} /> Recuperar
                        </button>
                      ) : (
                        <>
                          <button className="et-b" title="Editar" onClick={() => abrirEditar(o)}><Ic name="editar" size={13} /></button>
                          <button className="et-b et-b-r" title="Archivar o eliminar" onClick={() => retirar(o)}><Ic name="papelera" size={13} /></button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      {editando !== undefined && (
        <ModalObjetivo objetivo={editando} tests={testsLib} etiquetas={etiquetas}
          onCerrar={() => setEditando(undefined)} onGuardado={() => cargar()}/>
      )}
    </div>
  )
}

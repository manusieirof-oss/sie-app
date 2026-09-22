'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { categoriaDe, zonasDe, casaZona } from '@/lib/etiquetas'
import FiltroZonas from '@/components/FiltroZonas'
import { contiene } from '@/lib/texto'
import { especificosDeObjetivo } from '@/lib/objetivos'
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
  const [editando, setEditando] = useState<any>(undefined)
  const [evalua, setEvalua] = useState<Record<string, Conteo>>({})
  const [enUso, setEnUso] = useState<Record<string, number>>({})

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

  const filtrados = (objetivos || []).filter((o: any) =>
    casaZona(etiquetas, zonaIdsDe(o), zona) &&
    (contiene(o.nombre || '', busca) || contiene(o.descripcion || '', busca)))


  const abrirNuevo = () => setEditando(null)
  const abrirEditar = (o: any) => setEditando(o)

  async function eliminar(o: any) {
    const n = enUso[o.id] || 0
    if (!confirm(
      `Eliminar "${o.nombre}".\n\n` +
      (n > 0 ? `${n} paciente${n > 1 ? 's lo tienen' : ' lo tiene'} abierto ahora mismo y lo perderá${n > 1 ? 'n' : ''}.\n` : 'No lo tiene nadie abierto.\n') +
      `\nNo se puede deshacer.`)) return
    await supabase.from('objetivos').delete().eq('id', o.id)
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
              ? `${(objetivos || []).length} en total`
              : `${filtrados.length} de ${(objetivos || []).length}`}
          </span>
        </div>

        <div style={{ marginBottom: 12 }}>
          {/* Con 36 fichas el filtro de zona no basta: si sabes como se llama,
            escribirlo es mas rapido que acordarte de que zona era. */}
        <input className="input" style={{ maxWidth: 330, marginBottom: 10 }}
          value={busca} onChange={ev => setBusca(ev.target.value)}
          placeholder="Buscar objetivo por nombre…"/>

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
                          <span className="pill pill-soft" title="No entra en ninguna evaluación">
                            sin evaluación
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
                      <button className="et-b" title="Editar" onClick={() => abrirEditar(o)}><Ic name="editar" size={13} /></button>
                      <button className="et-b et-b-r" title="Borrar" onClick={() => eliminar(o)}><Ic name="papelera" size={13} /></button>
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

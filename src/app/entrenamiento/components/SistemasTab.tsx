'use client'
import { useEffect, useState } from 'react'
import { Ic } from '@/lib/icons'
import { esPlantilla } from '@/lib/sesiones'
import { cargarSistemas, borrarSistema, PROGRESIONES, Sistema } from '@/lib/sistemas'
import ModalSistema from './ModalSistema'

// ---------------------------------------------------------------------------
// SISTEMAS Y MÉTODOS · el nivel de arriba de la biblioteca
//
// Ejercicios → sesiones → sistemas. Aquí solo se define el molde: qué fases tiene,
// cómo se pasa de una a otra y qué sesiones propone cada una. A quién se le pone
// y desde cuándo es cosa de la ficha del paciente, no de la biblioteca.
// ---------------------------------------------------------------------------

export default function SistemasTab({ objetivos = [], sesiones = [], ejercicios = [], etiquetas = [], testsLib = [], cargar: recargarBiblio, objetivoInicial }: any) {
  const [lista, setLista] = useState<Sistema[]>([])
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState<any>(undefined)
  /**
   * FILTRAR POR OBJETIVO.
   *
   * No lo había: con una docena de sistemas no hacía falta. Hace falta al llegar aquí
   * desde la ficha de un paciente preguntando «¿qué ciclo sirve para esto?», que es
   * una pregunta que no se responde leyendo doce nombres.
   *
   * Los objetivos de un sistema son los de las sesiones de sus fases, como en todo lo
   * demás: no se guardan, se deducen.
   */
  const [filtroObj, setFiltroObj] = useState<string>('')
  useEffect(() => { if (objetivoInicial) setFiltroObj(objetivoInicial) }, [objetivoInicial])

  const objetivosDe = (s: any) => {
    const ids: string[] = []
    ;(s.fases || []).forEach((f: any) => (f.objetivos || []).forEach((oid: string) => {
      if (ids.includes(oid) === false) ids.push(oid)
    }))
    return ids
  }

  useEffect(() => { cargar() }, [])
  async function cargar() {
    setCargando(true)
    setLista(await cargarSistemas(false))
    setCargando(false)
  }

  // Solo plantillas: una sesión que ya es de un paciente no es material de molde.
  const plantillas = (sesiones || []).filter(esPlantilla)

  async function eliminar(s: Sistema) {
    if (!confirm(`¿Borrar «${s.nombre}»? Lo que ya se copió a cada paciente se queda como está.`)) return
    const r = await borrarSistema(s.id)
    if (!r.ok) { alert(r.error); return }
    cargar()
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, fontSize: 12, color: 'var(--gr)' }}>
          {cargando ? 'Cargando…' : `${lista.length} sistema${lista.length === 1 ? '' : 's'}`}
        </div>
        {filtroObj !== '' && (
          <button className="pill pill-o on" style={{ border:'none', cursor:'pointer' }}
            onClick={() => setFiltroObj('')}>
            {objetivos.find((o:any)=>o.id===filtroObj)?.nombre || 'Objetivo'} ✕
          </button>
        )}
        <select className="input" style={{ width: 210, fontSize: 12, padding: '5px 8px' }}
          value={filtroObj} onChange={e => setFiltroObj(e.target.value)}>
          <option value="">Todos los objetivos</option>
          {objetivos.map((o:any)=><option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
        <button className="btn btn-p btn-sm" onClick={() => setEditando(null)}>+ Nuevo sistema</button>
      </div>

      {!cargando && lista.length === 0 && (
        <div className="muted">
          Todavía no hay ninguno. Un sistema agrupa sesiones en fases para llegar a algo:
          un embarazo por trimestres, una vuelta de lesión por objetivos, unas oposiciones
          con fecha de examen.
        </div>
      )}

      {/* Agrupados por como avanzan, que es lo que de verdad los diferencia: un
          sistema por tiempo y uno por objetivos se preparan y se usan distinto.
          Agrupar y no filtrar: con una docena de sistemas, un filtro es un control
          que hay que operar para no ahorrar nada. */}
      {PROGRESIONES.map(pr => {
        const suyos = lista
          .filter(x => filtroObj === '' || objetivosDe(x).includes(filtroObj))
          .filter(x => x.progresion === pr.valor)
        if (suyos.length === 0) return null
        return (
        <div key={pr.valor} style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--gr)', letterSpacing: '.5px',
              textTransform: 'uppercase' }}>{pr.nombre}</span>
            <span style={{ fontSize: 11, color: 'var(--grl)' }}>{pr.ayuda}</span>
          </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(215px,1fr))', gap: 11 }}>
        {suyos.map(s => {
          const nSes = (s.fases || []).reduce((a, f) => a + (f.sesiones?.length || 0), 0)
          return (
            <div key={s.id} className="test-clic" onClick={() => setEditando(s)}
              style={{ border: '1px solid var(--bd)', borderRadius: 7, overflow: 'hidden',
                background: 'var(--w)', opacity: s.activo ? 1 : .55 }}>
              <div style={{ height: 4, background: s.color }}/>
              <div style={{ padding: '10px 12px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: s.color, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {s.icono ? <Ic name={s.icono} size={11}/> : null}
                  </span>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--n)' }}>{s.nombre}</div>
                  <button className="btn btn-s btn-sm" title="Borrar"
                    onClick={e => { e.stopPropagation(); eliminar(s) }}>✕</button>
                </div>
                {s.descripcion && (
                  <div style={{ fontSize: 11, color: 'var(--gr)', marginTop: 4, lineHeight: 1.4 }}>
                    {s.descripcion.slice(0, 70)}{s.descripcion.length > 70 ? '…' : ''}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--gr)', marginTop: 6 }}>
                  {(s.fases || []).length} fase{(s.fases || []).length === 1 ? '' : 's'} · {nSes} sesion{nSes === 1 ? '' : 'es'}
                </div>
                {!s.activo && (
                  <div style={{ marginTop: 7 }}><span className="pill pill-soft">Inactivo</span></div>
                )}
              </div>
            </div>
          )
        })}
      </div>
        </div>
        )
      })}

      {editando !== undefined && (
        <ModalSistema sistema={editando} objetivos={objetivos} sesiones={plantillas}
          ejercicios={ejercicios} etiquetas={etiquetas} tests={testsLib} onRecargarBiblio={recargarBiblio}
          onCerrar={() => setEditando(undefined)} onGuardado={cargar}/>
      )}
    </>
  )
}

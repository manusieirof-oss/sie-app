'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { CATEGORIAS_ETIQUETA, nombreConRama } from '@/lib/etiquetas'
import { contiene } from '@/lib/texto'
import { cargarReglas, nombreRegla } from '@/lib/reglasClinicas'
import { zonaEstaMapeada, ZONAS_DISPONIBLES } from '@/lib/anatomia'

/**
 * Dar de alta —o editar— una entrada de las seis listas clínicas: patologías, molestias,
 * medicamentos, alergias, intolerancias y operaciones. UN SOLO SITIO.
 *
 * Vivía dentro de `BibliotecaClinica`, que es la pestaña Clínico, así que en el resto de
 * la app "añadir uno nuevo" era otra cosa cada vez: en la ficha se creaba la entrada
 * pelada —sin zona, sin descripción y sin etiquetas, o directamente sin llegar a la
 * biblioteca—, y en la valoración se pedía la frecuencia con un `prompt()` del navegador,
 * esa caja negra que sale pegada a la barra de direcciones.
 *
 * La consecuencia no era estética: una alergia dada de alta desde la ficha no aparecía
 * luego en el buscador, porque nunca llegó al catálogo.
 */

export type ConfigItemClinico = {
  tabla: string
  /** Cómo se llama en singular, para los textos: "patología", "medicamento"… */
  tipo: string
  /** Columna por la que se agrupa la lista: 'zona' o 'categoria'. */
  campoGrupo: 'zona' | 'categoria'
}

export default function ModalItemClinico({ config, valor, etiquetas = [], onGuardado, onCerrar }: {
  config: ConfigItemClinico
  /** Lo que se edita. Con `id` es edición; sin él, alta. `nombre` puede venir escrito. */
  valor: any
  etiquetas?: any[]
  /** Recibe la fila guardada: quien abre decide qué hacer con ella. */
  onGuardado: (fila: any) => void
  onCerrar: () => void
}) {
  const g = config.campoGrupo
  const [item, setItem] = useState<any>({ nombre: '', [g]: '', descripcion: '', etiquetas: [], ...valor })
  const [guardando, setGuardando] = useState(false)
  const [grupos, setGrupos] = useState<string[]>([])
  /* QUÉ EVITAR Y QUÉ CONVIENE: solo en patologías, operaciones y molestias. Son etiquetas
     del mismo árbol que los ejercicios: un ejercicio que lleve una de «evitar» avisa en
     las sesiones y el taller de quien la tenga. */
  const conReglas = ['patologias_biblioteca', 'operaciones_biblioteca', 'molestias_biblioteca'].includes(config.tabla)
  const [buscaR, setBuscaR] = useState<Record<string, string>>({})
  const selectorReglas = (campo: 'evitar' | 'conviene', titulo: string, ayuda: string, color: string) => {
    const puestas: string[] = item[campo] || []
    const q = buscaR[campo] || ''
    const lista = q.trim() ? etiquetas.filter((e: any) => !puestas.includes(e.id) && contiene(nombreConRama(etiquetas, e), q)).slice(0, 30) : []
    const tog = (id: string) => setItem((p: any) => ({ ...p, [campo]: (p[campo] || []).includes(id) ? (p[campo] || []).filter((x: string) => x !== id) : [...(p[campo] || []), id] }))
    return (
      <div className="field"><label style={{ color }}>{titulo}</label>
        <div style={{ fontSize: 12, color: 'var(--gr)', marginBottom: 6 }}>{ayuda}</div>
        {puestas.length > 0 && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          {puestas.map(id => { const e = etiquetas.find((x: any) => x.id === id); const t = id.includes('+') ? nombreRegla(etiquetas, id) : e ? nombreConRama(etiquetas, e) : ''; return t ? <button key={id} type="button" className="chip-sel on" style={{ textTransform: 'none', letterSpacing: 0 }} onClick={() => tog(id)}>{t} ✕</button> : null })}
        </div>}
        <input className="input" placeholder="Buscar movimiento, posición, material…" value={q} disabled={guardando}
          onChange={e => setBuscaR(p => ({ ...p, [campo]: e.target.value }))}/>
        {lista.length > 0 && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6, maxHeight: 120, overflowY: 'auto' }}>
          {lista.map((e: any) => <button key={e.id} type="button" className="chip-sel" style={{ textTransform: 'none', letterSpacing: 0 }} onClick={() => { tog(e.id); setBuscaR(p => ({ ...p, [campo]: '' })) }}>{nombreConRama(etiquetas, e)}</button>)}
        </div>}
      </div>
    )
  }

  // Las zonas o categorías que ya se usan, para ofrecerlas sin obligar a elegir de una
  // lista cerrada: si no, no se podría dar de alta la primera de una zona nueva.
  useEffect(() => {
    supabase.from(config.tabla).select(g).then(({ data }) => {
      setGrupos(Array.from(new Set((data || []).map((x: any) => x[g]).filter(Boolean))))
    })
  }, [config.tabla, g])

  async function guardar() {
    if (!item.nombre?.trim()) { alert('El nombre es obligatorio'); return }
    setGuardando(true)
    const campos: any = {
      nombre: item.nombre.trim(),
      [g]: (item[g] || '').trim() || 'Otros',
      descripcion: item.descripcion || null,
      etiquetas: item.etiquetas || [],
      ...(conReglas ? { evitar: item.evitar || [], conviene: item.conviene || [] } : {}),
    }
    const r = item.id
      ? await supabase.from(config.tabla).update(campos).eq('id', item.id).select().single()
      : await supabase.from(config.tabla).insert({ ...campos, activo: true }).select().single()
    setGuardando(false)
    if (r.error) { alert(/evitar|conviene/.test(r.error.message) ? 'Falta el SQL de «qué evitar / qué conviene» (sql/clinico-reglas.sql).' : r.error.message); return }
    if (conReglas) cargarReglas(true)
    onGuardado(r.data)
  }

  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget && !guardando) onCerrar() }}>
      <div className="modal">
        <div className="modal-title">
          {item.id ? `Editar ${config.tipo}` : `Añadir ${config.tipo}`}
          <button className="modal-close" onClick={onCerrar}><Ic name="cerrar" size={15} /></button>
        </div>

        <div className="field"><label>Nombre *</label>
          <input className="input" value={item.nombre} autoFocus disabled={guardando}
            onChange={e => setItem((p: any) => ({ ...p, nombre: e.target.value }))} />
        </div>

        <div className="field"><label>{g === 'zona' ? 'Zona' : 'Categoría'}</label>
          <input className="input" list={`grupos-${config.tabla}`} value={item[g] || ''} disabled={guardando}
            onChange={e => setItem((p: any) => ({ ...p, [g]: e.target.value }))} placeholder="Otros" />
          {/* Se ofrecen también las zonas que el mapa corporal conoce, aunque no las use
              nadie todavía: es lo que evita escribir una que luego no se pueda pintar. */}
          <datalist id={`grupos-${config.tabla}`}>
            {Array.from(new Set([...grupos, ...(g === 'zona' ? ZONAS_DISPONIBLES : [])]))
              .map((v: any) => <option key={v} value={v} />)}
          </datalist>
          {g === 'zona' && item[g] && !zonaEstaMapeada(item[g]) && (
            <div style={{ fontSize: 12, color: '#8A6410', marginTop: 4 }}>
              El mapa corporal no conoce esta zona: lo que la use saldrá en "Sin localizar".
            </div>
          )}
        </div>

        <div className="field"><label>Descripción</label>
          <textarea className="input" value={item.descripcion || ''} disabled={guardando}
            onChange={e => setItem((p: any) => ({ ...p, descripcion: e.target.value }))}
            placeholder="Qué es, en una o dos frases. Es lo que se lee al pulsar la píldora." />
        </div>

        <div className="field"><label>Etiquetas</label>
          <input className="input" placeholder="Filtrar etiquetas…" disabled={guardando}
            onChange={e => setItem((p: any) => ({ ...p, filtroEt: e.target.value }))}
            value={item.filtroEt || ''} style={{ marginBottom: 6 }} />
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxHeight: 140, overflowY: 'auto' }}>
            {etiquetas
              .filter((e: any) => {
                const f = (item.filtroEt || '').toLowerCase()
                return !f || (e.nombre || '').toLowerCase().includes(f)
              })
              .slice(0, 120)
              .map((e: any) => {
                const sel = (item.etiquetas || []).includes(e.id)
                return (
                  <button key={e.id} className={`chip-sel ${sel ? 'on' : ''}`}
                    onClick={() => setItem((p: any) => ({
                      ...p, etiquetas: sel
                        ? (p.etiquetas || []).filter((x: string) => x !== e.id)
                        : [...(p.etiquetas || []), e.id],
                    }))}>{e.nombre}</button>
                )
              })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 4 }}>
            Las mismas que los ejercicios y los tests: {CATEGORIAS_ETIQUETA.map(c => c.label.toLowerCase()).join(', ')}.
          </div>
        </div>

        {conReglas && selectorReglas('evitar', 'Qué evitar', 'Los ejercicios con alguna de estas etiquetas avisan en sus sesiones y en el taller.', 'var(--red)')}
        {conReglas && selectorReglas('conviene', 'Qué conviene', 'Lo que le viene bien: sirve para sugerir ejercicios.', 'var(--gd)')}

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="btn btn-t btn-sm" onClick={onCerrar} disabled={guardando}>Cancelar</button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-p" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

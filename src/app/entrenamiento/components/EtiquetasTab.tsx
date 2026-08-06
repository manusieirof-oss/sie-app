'use client'
import { useMemo, useState } from 'react'
import { Ic } from '@/lib/icons'
import { CATEGORIAS_ETIQUETA, conDescendientes } from '@/lib/etiquetas'
import {
  contarUsos, renombrar, moverEtiqueta, fusionar, eliminarEtiqueta,
  crearEtiqueta, impactoDeBorrar, mismasConNombre, type Usos,
} from '@/lib/etiquetasEditar'

/**
 * El árbol de etiquetas, editable.
 *
 * Antes era un póster: nueve columnas de 160px con scroll horizontal, solo se podían
 * crear, y no decía a cuántos ejercicios afectaba ninguna. Renombrar o fusionar un
 * duplicado había que hacerlo escribiendo `semillaEtiquetas.ts` y desplegando.
 *
 * EL NÚMERO DE USOS ES EL DATO QUE DECIDE. Antes de fusionar "Vasto interno" con "Vasto
 * Medial" lo primero que se quiere saber es cuántos ejercicios se van a mover; y una
 * etiqueta con cero usos es basura acumulada que sin el contador no se ve.
 *
 * Una categoría abierta cada vez, en vez de las nueve en fila. Las columnas no se
 * comparaban entre sí —no era una tabla, eran nueve listas puestas en paralelo— y el
 * ancho mínimo de 1250px dejaba seis fuera de pantalla.
 */

type Modo = null | { tipo: 'nueva' } | { tipo: 'editar', et: any } | { tipo: 'fusionar', et: any }

export default function EtiquetasTab({ etiquetas, ejercicios = [], testsLib = [], cargar }: any) {
  const [cat, setCat] = useState('musculo')
  const [buscar, setBuscar] = useState('')
  const [modo, setModo] = useState<Modo>(null)
  const [form, setForm] = useState<any>({ nombre: '', categoria: 'musculo', padre_id: '', destino: '' })
  const [guardando, setGuardando] = useState(false)
  const [abiertas, setAbiertas] = useState<string[]>([])

  const usos: Record<string, Usos> = useMemo(() => contarUsos(ejercicios, testsLib), [ejercicios, testsLib])
  const hijasDe = (id: string) => etiquetas.filter((e: any) => e.padre_id === id)

  // Buscar recorre TODAS las categorías: con trescientas etiquetas, tener que acertar
  // primero la categoría para poder buscar dentro es la mitad del problema.
  const q = buscar.trim().toLowerCase()
  const resultados = q
    ? etiquetas.filter((e: any) => (e.nombre || '').toLowerCase().includes(q))
    : []

  const raices = etiquetas.filter((e: any) => e.categoria === cat && !e.padre_id)
    .sort((a: any, b: any) => a.nombre.localeCompare(b.nombre))

  const totalCat = (c: string) =>
    etiquetas.filter((e: any) => {
      let x = e, n = 0
      while (x?.padre_id && n++ < 20) x = etiquetas.find((y: any) => y.id === x.padre_id)
      return x?.categoria === c
    }).length

  const sinUsar = etiquetas.filter((e: any) => !(usos[e.id]?.total)).length

  function abrirNueva(padre?: any) {
    setForm({ nombre: '', categoria: padre ? (padre.categoria || cat) : cat, padre_id: padre?.id || '', destino: '' })
    setModo({ tipo: 'nueva' })
  }
  function abrirEditar(et: any) {
    setForm({ nombre: et.nombre, categoria: cat, padre_id: et.padre_id || '', destino: '' })
    setModo({ tipo: 'editar', et })
  }
  function abrirFusionar(et: any) {
    setForm({ nombre: et.nombre, categoria: cat, padre_id: et.padre_id || '', destino: '' })
    setModo({ tipo: 'fusionar', et })
  }

  async function guardar() {
    setGuardando(true)
    let r: any = { ok: true }
    if (modo?.tipo === 'nueva') {
      r = await crearEtiqueta(form.categoria, form.nombre, form.padre_id)
    } else if (modo?.tipo === 'editar') {
      r = await renombrar(modo.et.id, form.nombre)
      if (r.ok && (form.padre_id || '') !== (modo.et.padre_id || '')) {
        r = await moverEtiqueta(etiquetas, modo.et.id, form.padre_id || null)
      }
    } else if (modo?.tipo === 'fusionar') {
      const destino = etiquetas.find((e: any) => e.id === form.destino)
      if (!destino) { setGuardando(false); alert('Elige la etiqueta que se queda'); return }
      const u = usos[modo.et.id]?.total || 0
      const ok = confirm(
        `Fusionar "${modo.et.nombre}" en "${destino.nombre}".\n\n` +
        `${u} ${u === 1 ? 'referencia pasa' : 'referencias pasan'} a "${destino.nombre}". ` +
        `Sus ${hijasDe(modo.et.id).length} subetiquetas se cuelgan de ella.\n\n` +
        `"${modo.et.nombre}" se borra. No se puede deshacer.`)
      if (!ok) { setGuardando(false); return }
      r = await fusionar(etiquetas, modo.et.id, form.destino)
    }
    setGuardando(false)
    if (!r.ok) { alert(r.error); return }
    setModo(null); cargar()
  }

  async function borrar(et: any) {
    const imp = impactoDeBorrar(etiquetas, et.id, usos)
    const ok = confirm(
      `Borrar "${et.nombre}".\n\n` +
      (imp.hijas > 0 ? `Se lleva ${imp.hijas} ${imp.hijas === 1 ? 'subetiqueta' : 'subetiquetas'}.\n` : '') +
      (imp.afectados > 0
        ? `Se quitará de ${imp.afectados} ${imp.afectados === 1 ? 'ejercicio o test' : 'ejercicios y tests'}.\n`
        : 'No la usa nadie.\n') +
      `\nNo se puede deshacer.`)
    if (!ok) return
    const r = await eliminarEtiqueta(etiquetas, et.id)
    if (!r.ok) { alert(r.error); return }
    cargar()
  }

  function Fila({ et, nivel }: { et: any, nivel: number }) {
    const hijas = hijasDe(et.id).sort((a: any, b: any) => a.nombre.localeCompare(b.nombre))
    const u = usos[et.id]?.total || 0
    const abierta = abiertas.includes(et.id)
    return (
      <div>
        <div className="fila-p" style={{
          borderLeftColor: u === 0 ? 'var(--bd)' : 'var(--g)',
          marginLeft: nivel * 18, display: 'flex', alignItems: 'center', gap: 7, padding: '5px 9px', marginBottom: 2,
        }}>
          {hijas.length > 0 ? (
            <button onClick={() => setAbiertas(v => abierta ? v.filter(x => x !== et.id) : [...v, et.id])}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gr)', display: 'inline-flex', flexShrink: 0 }}
              aria-label={abierta ? 'Plegar' : 'Desplegar'}>
              <Ic name={abierta ? 'arriba' : 'abajo'} size={12} />
            </button>
          ) : <span style={{ width: 12, flexShrink: 0 }} />}

          <span style={{ flex: 1, fontSize: 13, color: 'var(--n)', minWidth: 0 }}>
            {et.nombre}
            {hijas.length > 0 && <span style={{ fontSize: 12, color: 'var(--gr)' }}> · {hijas.length}</span>}
          </span>

          {/* El contador es lo que convierte esto en una herramienta: sin él no se sabe
              qué se rompe al tocar nada, ni qué sobra. */}
          <span className={`pill ${u === 0 ? 'pill-soft' : 'pill-o on'}`} style={{ flexShrink: 0 }}
            title={u === 0 ? 'No la usa ningún ejercicio ni test' : `${usos[et.id]?.ejercicios || 0} ejercicios · ${usos[et.id]?.tests || 0} tests`}>
            {u}
          </span>

          <span style={{ display: 'inline-flex', gap: 3, flexShrink: 0 }}>
            <button className="chip-ed" title="Añadir subetiqueta" onClick={() => abrirNueva(et)}><Ic name="mas" size={12} /></button>
            <button className="chip-ed" title="Renombrar o cambiar de sitio" onClick={() => abrirEditar(et)}><Ic name="editar" size={12} /></button>
            <button className="chip-ed" title="Fusionar con otra" onClick={() => abrirFusionar(et)}><Ic name="cambio" size={12} /></button>
            <button className="chip-ed chip-ed-r" title="Borrar" onClick={() => borrar(et)}><Ic name="papelera" size={12} /></button>
          </span>
        </div>
        {abierta && hijas.map((h: any) => <Fila key={h.id} et={h} nivel={nivel + 1} />)}
      </div>
    )
  }

  const repetidas = modo?.tipo === 'nueva' ? mismasConNombre(etiquetas, form.nombre) : []

  return (
    <div className="panel">
      <div className="sec">
        <div className="sec-h">
          <span className="sh-l">
            <span className="ct-l"><Ic name="etiqueta" size={13} /> Etiquetas</span>
            <button className="btn btn-p btn-sm" onClick={() => abrirNueva()}>+ Nueva</button>
          </span>
          <span className="sh-r">
            {etiquetas.length} en total{sinUsar > 0 && <> · {sinUsar} sin usar</>}
          </span>
        </div>

        <input className="input" value={buscar} onChange={e => setBuscar(e.target.value)}
          placeholder="Buscar en todas las categorías…" style={{ marginBottom: 10 }} />

        {q ? (
          resultados.length === 0
            ? <div className="muted">Ninguna etiqueta se llama así.</div>
            : (
              <div>
                <div className="et-mini" style={{ marginBottom: 6 }}>{resultados.length} coincidencias</div>
                {resultados.map((e: any) => <Fila key={e.id} et={e} nivel={0} />)}
              </div>
            )
        ) : (
          <>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
              {CATEGORIAS_ETIQUETA.map(c => (
                <button key={c.key} className={`chip-sel ${cat === c.key ? 'on' : ''}`} onClick={() => setCat(c.key)}>
                  {c.label} · {totalCat(c.key)}
                </button>
              ))}
            </div>
            {raices.length === 0
              ? <div className="muted">No hay etiquetas en esta categoría.</div>
              : raices.map((e: any) => <Fila key={e.id} et={e} nivel={0} />)}
          </>
        )}
      </div>

      {modo && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setModo(null) }}>
          <div className="modal">
            <div className="modal-title">
              {modo.tipo === 'nueva' ? 'Nueva etiqueta' : modo.tipo === 'editar' ? 'Editar etiqueta' : 'Fusionar etiqueta'}
              <button className="modal-close" onClick={() => setModo(null)}><Ic name="cerrar" size={15} /></button>
            </div>

            {modo.tipo === 'fusionar' ? (
              <>
                <p style={{ fontSize: 13, color: 'var(--gr)', lineHeight: 1.6, marginBottom: 10 }}>
                  Todo lo etiquetado como <b>{modo.et.nombre}</b> pasará a la etiqueta que elijas,
                  y <b>{modo.et.nombre}</b> se borrará. Sus subetiquetas se cuelgan de la que se queda.
                </p>
                <div className="field"><label>Se queda</label>
                  <select className="input" value={form.destino} onChange={e => setForm((p: any) => ({ ...p, destino: e.target.value }))}>
                    <option value="">— Elige la etiqueta buena —</option>
                    {etiquetas
                      .filter((e: any) => !conDescendientes(etiquetas, modo.et.id).includes(e.id))
                      .sort((a: any, b: any) => a.nombre.localeCompare(b.nombre))
                      .map((e: any) => {
                        const padre = etiquetas.find((p: any) => p.id === e.padre_id)
                        return <option key={e.id} value={e.id}>{padre ? padre.nombre + ' › ' : ''}{e.nombre} ({usos[e.id]?.total || 0})</option>
                      })}
                  </select>
                </div>
              </>
            ) : (
              <>
                {modo.tipo === 'nueva' && (
                  <div className="field"><label>Categoría</label>
                    <select className="input" value={form.categoria} disabled={!!form.padre_id}
                      onChange={e => setForm((p: any) => ({ ...p, categoria: e.target.value, padre_id: '' }))}>
                      {CATEGORIAS_ETIQUETA.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                    {form.padre_id && <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 3 }}>La hereda de su etiqueta madre.</div>}
                  </div>
                )}
                <div className="field"><label>Nombre</label>
                  <input className="input" value={form.nombre} autoFocus
                    onChange={e => setForm((p: any) => ({ ...p, nombre: e.target.value }))}
                    placeholder="ej. Bíceps Femoral" />
                </div>
                {/* Así nacieron las tres "Mayor" y las dos "Menor" del árbol. No se impide
                    —bajo Glúteo y bajo Pectoral son legítimas— pero hay que verlo antes. */}
                {repetidas.length > 0 && (
                  <div className="fila-p" style={{ borderLeftColor: 'var(--amb)', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, color: 'var(--n)' }}>
                      Ya existe{repetidas.length > 1 ? 'n' : ''} con ese nombre:{' '}
                      {repetidas.map((e: any) => {
                        const padre = etiquetas.find((p: any) => p.id === e.padre_id)
                        return padre ? `${padre.nombre} › ${e.nombre}` : e.nombre
                      }).join(', ')}.
                    </span>
                  </div>
                )}
                <div className="field"><label>Cuelga de</label>
                  <select className="input" value={form.padre_id}
                    onChange={e => setForm((p: any) => ({ ...p, padre_id: e.target.value }))}>
                    <option value="">— Es etiqueta principal —</option>
                    {etiquetas
                      .filter((e: any) => modo.tipo !== 'editar' || !conDescendientes(etiquetas, modo.et.id).includes(e.id))
                      .filter((e: any) => modo.tipo === 'editar' || e.categoria === form.categoria || etiquetas.find((p: any) => p.id === e.padre_id))
                      .sort((a: any, b: any) => a.nombre.localeCompare(b.nombre))
                      .map((e: any) => {
                        const padre = etiquetas.find((p: any) => p.id === e.padre_id)
                        return <option key={e.id} value={e.id}>{padre ? padre.nombre + ' › ' : ''}{e.nombre}</option>
                      })}
                  </select>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn btn-t btn-sm" onClick={() => setModo(null)}>Cancelar</button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-p" onClick={guardar} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

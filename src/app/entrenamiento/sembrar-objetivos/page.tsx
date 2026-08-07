'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { ESPACIOS, FASES, CUALITATIVOS, MOVIMIENTOS_NUEVOS, PATOLOGIAS_NUEVAS } from '@/lib/semillaObjetivos'

/**
 * Alta del catálogo de objetivos.
 *
 * Orden obligado: primero las ETIQUETAS de movimiento que faltan, después los objetivos.
 * Los espacios guardan los ids de los movimientos que ofrecen, así que si la etiqueta no
 * existe todavía el espacio se crea sin ella y al ir a poner una meta no habría dónde
 * elegir "rotación interna".
 *
 * Idempotente por nombre: lo que ya existe se actualiza. Los objetivos que los pacientes ya
 * tengan asignados no se tocan, porque eso vive en `pacientes_objetivos`.
 */

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

type Linea = { texto: string, estado: 'ok' | 'aviso' | 'error' | 'info' }

export default function SembrarObjetivosPage() {
  const [log, setLog] = useState<Linea[]>([])
  const [corriendo, setCorriendo] = useState(false)
  const [faltan, setFaltan] = useState<string[] | null>(null)
  const [viejos, setViejos] = useState<number | null>(null)
  const [sinSql, setSinSql] = useState<string | null>(null)

  const anota = (texto: string, estado: Linea['estado'] = 'info') => setLog(l => [...l, { texto, estado }])

  useEffect(() => { comprobar() }, [])

  /**
   * Comprobación previa. Lo que se mira no son los objetivos sino las ARTICULACIONES: si
   * "Escapular" o "Muñeca" no están en el árbol, el espacio se crea sin zona y la pestaña
   * no lo podrá filtrar ni contar.
   */
  async function comprobar() {
    // Antes que nada: ¿existen las columnas? Si no, TODOS los objetivos fallan con el
    // mismo error y la pantalla se llena de líneas rojas idénticas que no dicen qué hacer.
    // Una frase antes vale más que treinta y seis mensajes después.
    const { error: errCol } = await supabase.from('objetivos')
      .select('tipo,metrica,articulacion_id,movimientos,fases,etiquetas').limit(1)
    setSinSql(errCol ? errCol.message : null)

    const { data: ets } = await supabase.from('etiquetas').select('nombre,categoria')
    const arts = new Set((ets || []).filter((e: any) => e.categoria === 'articulacion').map((e: any) => norm(e.nombre)))
    const pedidas = new Set<string>()
    ESPACIOS.forEach(e => { if (!arts.has(norm(e.articulacion))) pedidas.add(e.articulacion) })
    setFaltan(Array.from(pedidas))

    // Los diez objetivos que sembré con los tests son de la familia métrica mal hechos:
    // sin métrica, sin movimiento y sin lado. Conviene saber cuántos hay antes de añadir.
    const { count } = await supabase.from('objetivos')
      .select('id', { count: 'exact', head: true }).is('tipo', null)
    setViejos(count || 0)
  }

  async function sembrar() {
    setCorriendo(true); setLog([])

    // ── 1. Etiquetas de movimiento que faltan ───────────────────────────────
    const { data: ets } = await supabase.from('etiquetas').select('id,nombre,categoria,padre_id')
    const idEt: Record<string, string> = {}
    ;(ets || []).forEach((e: any) => { idEt[norm(e.nombre)] = e.id })

    let etsCreadas = 0
    for (const m of MOVIMIENTOS_NUEVOS) {
      if (idEt[norm(m.nombre)]) continue
      const padre = idEt[norm(m.padre)]
      if (!padre) { anota(`No existe el movimiento "${m.padre}", así que "${m.nombre}" se queda sin crear.`, 'aviso'); continue }
      const { data, error } = await supabase.from('etiquetas')
        .insert({ nombre: m.nombre, categoria: 'movimiento', padre_id: padre }).select('id').single()
      if (error || !data) { anota(`Etiqueta "${m.nombre}" — error: ${error?.message}`, 'error'); continue }
      idEt[norm(m.nombre)] = data.id
      etsCreadas++
    }
    anota(`Etiquetas de movimiento creadas: ${etsCreadas}.`, 'ok')

    // Patologías que faltan. Mismo trato que los movimientos: si no existen, los objetivos
    // y los tests que las nombran se crean sin ellas y el aviso se pierde entre líneas.
    let patsCreadas = 0
    for (const p of PATOLOGIAS_NUEVAS) {
      if (idEt[norm(p.nombre)]) continue
      const padre = p.padre ? idEt[norm(p.padre)] : null
      if (p.padre && !padre) { anota(`No existe "${p.padre}", así que "${p.nombre}" se queda sin crear.`, 'aviso'); continue }
      const { data, error } = await supabase.from('etiquetas')
        .insert({ nombre: p.nombre, categoria: 'patologia', padre_id: padre }).select('id').single()
      if (error || !data) { anota(`Etiqueta "${p.nombre}" — error: ${error?.message}`, 'error'); continue }
      idEt[norm(p.nombre)] = data.id
      patsCreadas++
    }
    anota(`Patologías creadas: ${patsCreadas}.`, 'ok')

    // ── 2. Objetivos ────────────────────────────────────────────────────────
    const { data: objs } = await supabase.from('objetivos').select('id,nombre')
    const idObj: Record<string, string> = {}
    ;(objs || []).forEach((o: any) => { idObj[norm(o.nombre)] = o.id })

    let creados = 0, actualizados = 0
    const sinMovimiento = new Set<string>()

    /** Etiquetas libres por nombre, avisando de las que no existan en el árbol. */
    const sinEtiqueta = new Set<string>()
    const resolver = (nombres?: string[]) => (nombres || []).map(n => {
      const id = idEt[norm(n)]
      if (!id) sinEtiqueta.add(n)
      return id
    }).filter(Boolean)

    /** Lo que ya hay en cada objetivo, para no pisarlo al actualizar. */
    const { data: objCompletos } = await supabase.from('objetivos')
      .select('id,descripcion,color,etiquetas,articulacion_id,tipo,metrica,fases')
    const actual: Record<string, any> = {}
    ;(objCompletos || []).forEach((o: any) => { actual[o.id] = o })

    /**
     * Al ACTUALIZAR solo se rellena lo que esté vacío.
     *
     * El sembrador está para dar de alta el catálogo, no para deshacer lo que hayas
     * cambiado después en la pestaña. Si una descripción, un color o unas etiquetas ya
     * tienen contenido, se respetan; si están vacías, se completan. Así se puede
     * relanzar sin miedo cuando la semilla añade un campo nuevo.
     */
    const soloHuecos = (campos: any, ya: string) => {
      const hay = actual[ya] || {}
      const vacio = (v: any) => v == null || v === '' || (Array.isArray(v) && v.length === 0)
      const salida: any = {}
      for (const [k, v] of Object.entries(campos)) {
        if (k === 'nombre' || k === 'activo') continue
        if (vacio(hay[k])) salida[k] = v
      }
      return salida
    }

    const guardar = async (campos: any, etiqueta: string) => {
      const ya = idObj[norm(campos.nombre)]
      if (ya) {
        const cambios = soloHuecos(campos, ya)
        if (Object.keys(cambios).length === 0) { anota(`${campos.nombre} — ya estaba completo`, 'info'); return }
        const { error } = await supabase.from('objetivos').update(cambios).eq('id', ya)
        if (error) { anota(`${campos.nombre} — error: ${error.message}`, 'error'); return }
        actualizados++
      } else {
        const { error } = await supabase.from('objetivos').insert({ ...campos, activo: true })
        if (error) { anota(`${campos.nombre} — error: ${error.message}`, 'error'); return }
        creados++
      }
      anota(`${campos.nombre} — ${ya ? 'actualizado' : 'creado'} · ${etiqueta}`, 'ok')
    }

    const COLOR = { fuerza: '#9A6B8F', movilidad: '#6B8F9A', fase: '#C17A54', cualitativo: '#7C9A6B' }

    for (const e of ESPACIOS) {
      const movIds = e.movimientos.map(n => {
        const id = idEt[norm(n)]
        if (!id) sinMovimiento.add(n)
        return id
      }).filter(Boolean)
      await guardar({
        nombre: e.nombre, descripcion: e.descripcion,
        tipo: 'metrico', metrica: e.metrica,
        articulacion_id: idEt[norm(e.articulacion)] || null,
        movimientos: movIds, fases: null,
        // Los métricos no llevan etiquetas libres: su articulación y sus movimientos ya
        // los describen, y repetirlos aquí serían dos verdades para lo mismo.
        etiquetas: [],
        color: COLOR[e.metrica],
      }, `${movIds.length} movimientos`)
    }

    for (const f of FASES) {
      await guardar({
        nombre: f.nombre, descripcion: f.descripcion,
        tipo: 'fase', metrica: null,
        articulacion_id: f.articulacion ? (idEt[norm(f.articulacion)] || null) : null,
        movimientos: [], fases: f.fases.length,
        etiquetas: resolver(f.etiquetas),
        color: COLOR.fase,
      }, `${f.fases.length} fases`)
    }

    for (const c of CUALITATIVOS) {
      await guardar({
        nombre: c.nombre, descripcion: c.descripcion,
        tipo: 'cualitativo', metrica: null,
        articulacion_id: c.articulacion ? (idEt[norm(c.articulacion)] || null) : null,
        movimientos: [], fases: null,
        etiquetas: resolver(c.etiquetas),
        color: COLOR.cualitativo,
      }, 'cualitativo')
    }

    if (sinEtiqueta.size > 0) {
      anota(`Etiquetas de músculo o patología que no existen y se han omitido: ${Array.from(sinEtiqueta).join(', ')}.`, 'aviso')
    }
    if (sinMovimiento.size > 0) {
      anota(`Movimientos que no existen en el árbol y se han omitido: ${Array.from(sinMovimiento).join(', ')}.`, 'aviso')
    }
    anota(`Resumen: ${creados} objetivos creados, ${actualizados} actualizados.`, 'info')
    setCorriendo(false)
    comprobar()
  }

  const nMov = new Set(ESPACIOS.flatMap(e => e.movimientos)).size

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 0' }}>
      <div className="panel">
        <div className="sec">
          <div className="sec-h">
            <span className="sh-l"><span className="ct-l"><Ic name="objetivo" size={13} /> Sembrar objetivos</span></span>
            <span className="sh-r">{ESPACIOS.length} métricos · {FASES.length} por fases · {CUALITATIVOS.length} cualitativos</span>
          </div>

          <p style={{ fontSize: 13, color: 'var(--gr)', lineHeight: 1.6, marginBottom: 14 }}>
            Crea el catálogo traído de tu otra aplicación. Los <b>{ESPACIOS.length} métricos</b> son
            el espacio —articulación y métrica— con sus {nMov} movimientos dentro; el movimiento, el
            lado y la meta se eligen al asignárselo a un paciente. Antes crea las etiquetas de
            movimiento que faltan, como rotación interna y externa.
          </p>

          {sinSql && (
            <div className="fila-p" style={{ borderLeftColor: 'var(--red)', marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: 'var(--n)', lineHeight: 1.6 }}>
                <b>Falta ejecutar el SQL.</b> La tabla <code>objetivos</code> todavía no tiene las
                columnas nuevas, así que ningún objetivo se puede guardar. Ejecuta
                <code> sql/objetivos_medibles.sql</code> en Supabase y recarga.
                <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 4 }}>Dice: {sinSql}</div>
              </div>
            </div>
          )}

          {viejos !== null && viejos > 0 && (
            <div className="fila-p" style={{ borderLeftColor: 'var(--amb)', marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--n)', lineHeight: 1.6 }}>
                Tienes <b>{viejos} objetivos antiguos</b> sin familia, los que sembré con los tests.
                No se tocan, pero conviene repasarlos: son métricos mal hechos, sin movimiento ni
                lado, y ahora tienen sustituto.
              </span>
            </div>
          )}

          {faltan !== null && (
            faltan.length === 0 ? (
              <div className="fila-p" style={{ borderLeftColor: 'var(--g)', marginBottom: 14 }}>
                <span style={{ fontSize: 13, color: 'var(--n)' }}>
                  Todas las articulaciones existen en el árbol de etiquetas.
                </span>
              </div>
            ) : (
              <div className="fila-p" style={{ borderLeftColor: 'var(--amb)', marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: 'var(--n)', lineHeight: 1.6 }}>
                  <b>Faltan estas articulaciones</b> en el árbol: {faltan.join(', ')}. Los objetivos
                  se crearán igual, pero sin zona no se podrán filtrar ni contar por área. Créalas en
                  Biblioteca → Etiquetas, categoría Articulación.
                </div>
              </div>
            )
          )}

          <button className="btn btn-p" onClick={sembrar} disabled={corriendo || !!sinSql}>
            {corriendo ? 'Sembrando…' : sinSql ? 'Falta el SQL' : 'Sembrar objetivos'}
          </button>

          {log.length > 0 && (
            <div style={{ marginTop: 14, display: 'grid', gap: 3 }}>
              {log.map((l, i) => (
                <div key={i} style={{
                  fontSize: 12, lineHeight: 1.6, padding: '3px 9px', borderRadius: 4,
                  background: l.estado === 'error' ? 'var(--redl)' : l.estado === 'aviso' ? 'var(--ambl)' : 'var(--bl)',
                  color: l.estado === 'error' ? 'var(--red)' : l.estado === 'aviso' ? '#7A5800' : 'var(--n)',
                }}>{l.texto}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { subirImagenTest } from '@/lib/ejercicios'
import { Ic } from '@/lib/icons'
import { TESTS, OBJETIVOS } from '@/lib/semillaTests'

/**
 * Alta de los tests de valoración y de los objetivos que abren.
 *
 * Orden obligado: OBJETIVOS primero, TESTS después. El test guarda el id del objetivo,
 * así que si no existe todavía el enlace se pierde en silencio y el test queda inerte:
 * daría positivo sin abrir nada, que es exactamente el fallo que acabamos de arreglar en
 * la valoración.
 *
 * Idempotente: si ya existe un test o un objetivo con el mismo nombre se ACTUALIZA en vez
 * de crear otro. Dos objetivos "Ganar movilidad de hombro" partirían en dos el
 * seguimiento del mismo paciente sin que se notara.
 */

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

type Linea = { texto: string, estado: 'ok' | 'aviso' | 'error' | 'info' }

/**
 * REGLA DE TODOS LOS SEMBRADORES: no se pisa nada que ya tenga contenido.
 *
 * Un sembrador está para dar de alta lo que falta, no para deshacer lo que se haya hecho
 * después a mano. Si un campo ya tiene valor, se respeta; si está vacío, se rellena. Así
 * se puede relanzar sin miedo cuando la semilla añade algo nuevo.
 */
const vacio = (v: any) => v == null || v === '' || (Array.isArray(v) && v.length === 0)
function soloHuecos(campos: any, actual: any, nuncaTocar: string[] = []) {
  const salida: any = {}
  for (const [k, v] of Object.entries(campos)) {
    if (nuncaTocar.includes(k)) continue
    if (vacio((actual || {})[k])) salida[k] = v
  }
  return salida
}


export default function SembrarTestsPage() {
  const [log, setLog] = useState<Linea[]>([])
  const [corriendo, setCorriendo] = useState(false)
  // Igual que en el sembrador de ejercicios: los ficheros los da el navegador, no salen
  // del repositorio, así que hay que seleccionarlos aquí.
  const [ficheros, setFicheros] = useState<File[]>([])
  const [faltanEt, setFaltanEt] = useState<string[] | null>(null)
  const [faltanSes, setFaltanSes] = useState<string[] | null>(null)

  const anota = (texto: string, estado: Linea['estado'] = 'info') => setLog(l => [...l, { texto, estado }])

  useEffect(() => { comprobar() }, [])

  /**
   * Comprobación PREVIA. Dos cosas distintas y con distinta gravedad:
   *
   *  - Etiquetas que no existen: el test se crea igual pero sin ellas, así que no se
   *    podrá filtrar por zona. Recuperable editando el test.
   *  - Sesiones que no existen: el objetivo se crea sin sesiones que lo trabajen, y
   *    entonces el test dice "hay que trabajar esto" sin decir con qué. Eso hay que
   *    verlo ANTES, no después.
   */
  async function comprobar() {
    const [{ data: ets }, { data: ses }] = await Promise.all([
      supabase.from('etiquetas').select('nombre'),
      supabase.from('sesiones').select('nombre').is('paciente_id', null),
    ])
    const hayEt = new Set((ets || []).map((e: any) => norm(e.nombre)))
    const haySes = new Set((ses || []).map((s: any) => norm(s.nombre)))

    const pedidasEt = new Set<string>()
    TESTS.forEach(t => t.etiquetas.forEach(e => { if (!hayEt.has(norm(e))) pedidasEt.add(e) }))
    const pedidasSes = new Set<string>()
    OBJETIVOS.forEach(o => o.sesiones.forEach(s => { if (!haySes.has(norm(s))) pedidasSes.add(s) }))

    setFaltanEt(Array.from(pedidasEt))
    setFaltanSes(Array.from(pedidasSes))
  }

  async function sembrar() {
    setCorriendo(true); setLog([])

    // ── 1. Objetivos ────────────────────────────────────────────────────────
    const { data: objExist } = await supabase.from('objetivos')
      .select('id,nombre,descripcion,color,etiquetas,articulacion_id,tipo,metrica,fases')
    const idObjetivo: Record<string, string> = {}
    const actualObj: Record<string, any> = {}
    ;(objExist || []).forEach((o: any) => { idObjetivo[norm(o.nombre)] = o.id; actualObj[o.id] = o })

    // Las etiquetas hacen falta antes que los objetivos: los objetivos guardan sus ids.
    const { data: etsPrev } = await supabase.from('etiquetas').select('id,nombre')
    const idEtPrev: Record<string, string> = {}
    ;(etsPrev || []).forEach((e: any) => { idEtPrev[norm(e.nombre)] = e.id })
    const sinEtiqueta = new Set<string>()
    const resolverEts = (nombres?: string[]) => (nombres || []).map(n => {
      const id = idEtPrev[norm(n)]
      if (!id) sinEtiqueta.add(n)
      return id
    }).filter(Boolean)

    let objCreados = 0, objActualizados = 0
    for (const o of OBJETIVOS) {
      // CUALITATIVOS, no métricos. Son el resultado que se busca —"que el hombro deje de
      // doler"— y los abre un test al dar positivo. Los métricos son otra cosa: el espacio
      // donde se ponen metas con número. Sin esta familia salían "sin clasificar" y no se
      // podían filtrar con el resto.
      const campos = {
        nombre: o.nombre, descripcion: o.descripcion, color: o.color, activo: true,
        tipo: 'cualitativo', metrica: null, movimientos: [], fases: null,
        articulacion_id: o.zona ? (idEtPrev[norm(o.zona)] || null) : null,
        etiquetas: resolverEts(o.etiquetas),
      }
      const ya = idObjetivo[norm(o.nombre)]
      if (ya) {
        // Solo se rellena lo que esté vacío: lo que hayas editado en la pestaña se
        // respeta. Un sembrador está para dar de alta, no para deshacer.
        const cambios = soloHuecos(campos, actualObj[ya], ['nombre', 'activo'])
        if (Object.keys(cambios).length === 0) { objActualizados++; continue }
        const { error } = await supabase.from('objetivos').update(cambios).eq('id', ya)
        if (error) { anota(`Objetivo "${o.nombre}" — error: ${error.message}`, 'error'); continue }
        objActualizados++
      } else {
        const { data, error } = await supabase.from('objetivos').insert(campos).select('id').single()
        if (error || !data) { anota(`Objetivo "${o.nombre}" — error: ${error?.message}`, 'error'); continue }
        idObjetivo[norm(o.nombre)] = data.id
        objCreados++
      }
    }
    anota(`Objetivos: ${objCreados} creados, ${objActualizados} actualizados.`, 'ok')
    if (sinEtiqueta.size > 0) {
      anota(`Etiquetas de objetivo que no existen y se han omitido: ${Array.from(sinEtiqueta).join(', ')}.`, 'aviso')
    }

    // ── 2. Objetivos ↔ sesiones ─────────────────────────────────────────────
    const { data: sesiones } = await supabase.from('sesiones').select('id,nombre').is('paciente_id', null)
    const idSesion: Record<string, string> = {}
    ;(sesiones || []).forEach((s: any) => { idSesion[norm(s.nombre)] = s.id })

    let enlaces = 0
    const sesionesQueFaltan = new Set<string>()
    for (const o of OBJETIVOS) {
      const oid = idObjetivo[norm(o.nombre)]
      if (!oid) continue
      for (const nombreSes of o.sesiones) {
        const sid = idSesion[norm(nombreSes)]
        if (!sid) { sesionesQueFaltan.add(nombreSes); continue }
        // Se comprueba antes de insertar: la tabla puede no tener clave única y un
        // segundo sembrado duplicaría la fila.
        const { data: yaHay } = await supabase.from('sesiones_objetivos')
          .select('sesion_id').eq('sesion_id', sid).eq('objetivo_id', oid).maybeSingle()
        if (yaHay) continue
        const { error } = await supabase.from('sesiones_objetivos').insert({ sesion_id: sid, objetivo_id: oid })
        if (!error) enlaces++
      }
    }
    anota(`Sesiones enlazadas a objetivos: ${enlaces}.`, 'ok')
    if (sesionesQueFaltan.size > 0) {
      anota(`Estos objetivos se han quedado SIN sesión que los trabaje: ${Array.from(sesionesQueFaltan).join(', ')}. Los tests darán positivo y abrirán el objetivo, pero no habrá con qué entrenarlo.`, 'aviso')
    }

    // ── 3. Tests ────────────────────────────────────────────────────────────
    const { data: etiquetas } = await supabase.from('etiquetas').select('id,nombre')
    const idEtiqueta: Record<string, string> = {}
    ;(etiquetas || []).forEach((e: any) => { idEtiqueta[norm(e.nombre)] = e.id })

    const { data: testsExist } = await supabase.from('tests')
      .select('id,nombre,descripcion,logica,tipo_lado,frecuencia_meses,etiquetas_relacionadas,items')
    const idTest: Record<string, string> = {}
    const actualTest: Record<string, any> = {}
    ;(testsExist || []).forEach((t: any) => { idTest[norm(t.nombre)] = t.id; actualTest[t.id] = t })

    let creados = 0, actualizados = 0, itemsTocados = 0, imagenes = 0
    const porNombre: Record<string, File> = {}
    ficheros.forEach(f => { porNombre[f.name] = f })
    const etQueFaltan = new Set<string>()
    const objQueFaltan = new Set<string>()

    for (const t of TESTS) {
      const etIds = t.etiquetas.map(n => {
        const id = idEtiqueta[norm(n)]
        if (!id) etQueFaltan.add(n)
        return id
      }).filter(Boolean)

      // Los campos de la BARRA viajan con el ítem. Se quedaban fuera de este `map` y por
      // eso los tests se creaban con la medida pero sin la regla que la interpreta: la
      // pantalla los pintaba como una casilla más, sin barra y sin umbral.
      const items = t.items.map((i: any) => {
        // Qué movimiento mide el ítem de cada objetivo. Se guarda como
        // `{ idObjetivo: idEtiqueta }`, que es lo que lee la ficha del paciente para que
        // la meta nazca ya concretada. Si el objetivo o la etiqueta no existen todavía se
        // omite el par: media pareja no dice nada y ensuciaría el ítem.
        const movs: Record<string, string> = {}
        for (const [nObj, nMov] of Object.entries(i.objetivos_mov || {})) {
          const oid = idObjetivo[norm(nObj)]
          const mid = idEtiqueta[norm(String(nMov))]
          if (!mid) etQueFaltan.add(String(nMov))
          if (oid && mid) movs[oid] = mid
        }
        return {
          nombre: i.nombre,
          unidad: i.unidad || '',
          objetivos: (i.objetivos || []).map((n: string) => idObjetivo[norm(n)]).filter(Boolean),
          ...(Object.keys(movs).length ? { objetivos_mov: movs } : {}),
          ...(i.regla ? { regla: i.regla, umbral: i.umbral, umbral2: i.umbral2, min: i.min, max: i.max } : {}),
        }
      })

      const campos = {
        nombre: t.nombre, descripcion: t.descripcion,
        logica: t.logica, tipo_lado: t.tipo_lado,
        frecuencia_meses: t.frecuencia_meses,
        etiquetas_relacionadas: etIds,
        // Lo que el test DESACONSEJA si sale positivo. Iba vacío en el alta y había que
        // marcarlo test por test a mano, así que en la práctica el aviso no saltaba nunca.
        // Al actualizar lo protege `soloHuecos`: lo que ya hayas marcado no se toca.
        etiquetas_bloquea: (t.bloquea || []).map(n => {
          const id = idEtiqueta[norm(n)]
          if (!id) etQueFaltan.add(n)
          return id
        }).filter(Boolean),
        items,
      }

      const ya = idTest[norm(t.nombre)]
      let testId = ya
      if (ya) {
        const cambios = soloHuecos(campos, actualTest[ya], ['nombre'])
        // Sin cambios de campos NO se sale: más abajo puede haber una imagen que subir y
        // objetivos que enlazar. Aquí había un `continue` que se saltaba las dos cosas —el
        // mismo fallo que ya tuvimos en el sembrador de ejercicios— y el registro decía
        // "actualizado" igualmente, así que no había forma de notarlo.
        if (Object.keys(cambios).length > 0) {
          const { error } = await supabase.from('tests').update(cambios).eq('id', ya)
          if (error) { anota(`${t.nombre} — error: ${error.message}`, 'error'); continue }
        }
        actualizados++
      } else {
        const { data, error } = await supabase.from('tests').insert({ ...campos, video_url: '', imagen_url: '' }).select('id').single()
        if (error || !data) { anota(`${t.nombre} — error: ${error?.message}`, 'error'); continue }
        testId = data.id
        creados++
      }

      // El enlace test → objetivo vive en `objetivos.test_id`, no en el test. Se escribe
      // aquí porque hasta ahora no existía el id del test.
      for (const nombreObj of t.objetivos) {
        const oid = idObjetivo[norm(nombreObj)]
        if (!oid) { objQueFaltan.add(nombreObj); continue }
        if (testId) await supabase.from('objetivos').update({ test_id: testId }).eq('id', oid)
      }

      // IMAGEN. Solo si se ha seleccionado el fichero con ese nombre. La que ya tuviera el
      // test no se toca cuando no se da ninguno.
      let conImagen = false
      const file = t.archivo ? porNombre[t.archivo] : undefined
      if (file && testId) {
        const r = await subirImagenTest(testId, file)
        if (!r.ok) anota(`${t.nombre} — imagen falló: ${r.error}`, 'aviso')
        else { await supabase.from('tests').update({ imagen_url: r.url }).eq('id', testId); conImagen = true; imagenes++ }
      }

      const medidos = items.filter(i => i.unidad).length
      const conBarra = items.filter((i: any) => i.regla).length
      anota(`${t.nombre} — ${ya ? 'actualizado' : 'creado'} · ${items.length} ítems (${medidos} medidos`
        + (conBarra ? `, ${conBarra} con barra` : '') + `) · ${etIds.length} etiquetas · ${t.tipo_lado}`
        + (conImagen ? ' · con imagen' : ''), 'ok')
    }

    if (objQueFaltan.size > 0) {
      anota(`Estos objetivos todavía no existen, así que su test no los abrirá: ${Array.from(objQueFaltan).join(', ')}. Los crea el sembrador de objetivos; pásalo y vuelve a lanzar este.`, 'aviso')
    }
    if (etQueFaltan.size > 0) {
      anota(`Etiquetas que no existen y se han omitido: ${Array.from(etQueFaltan).join(', ')}.`, 'aviso')
    }
    anota(`Resumen: ${creados} tests creados, ${actualizados} actualizados`
      + (imagenes > 0 ? `, ${imagenes} con imagen` : '') + '.', 'info')
    setCorriendo(false)
    comprobar()
  }

  const nItems = TESTS.reduce((a, t) => a + t.items.length, 0)
  const nMedidos = TESTS.reduce((a, t) => a + t.items.filter(i => i.unidad).length, 0)

  const conImagen = TESTS.filter(t => t.archivo && ficheros.some(f => f.name === t.archivo)).length

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 0' }}>
      <div className="panel">
        <div className="sec">
          <div className="sec-h">
            <span className="sh-l"><span className="ct-l"><Ic name="test" size={13} /> Sembrar tests de valoración</span></span>
            <span className="sh-r">{TESTS.length} tests · {nItems} ítems ({nMedidos} medidos) · {OBJETIVOS.length} objetivos</span>
          </div>

          <p style={{ fontSize: 13, color: 'var(--gr)', lineHeight: 1.6, marginBottom: 14 }}>
            Crea los tests y los objetivos que abren, y enlaza cada objetivo con las sesiones
            que lo trabajan. Si algo ya existe con el mismo nombre <b>se actualiza</b> en vez de
            duplicarse. Los resultados ya registrados de tus pacientes no se tocan.
          </p>

          {faltanSes !== null && faltanSes.length > 0 && (
            <div className="fila-p" style={{ borderLeftColor: 'var(--amb)', marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: 'var(--n)', lineHeight: 1.6 }}>
                <b>Faltan {faltanSes.length} sesiones</b> que estos objetivos necesitan:{' '}
                {faltanSes.join(', ')}.
                <br />Los tests funcionarán igual, pero el objetivo que abran no tendrá con qué
                entrenarse. Se pueden crear después y volver a sembrar.
              </div>
            </div>
          )}

          {faltanEt !== null && (
            faltanEt.length === 0 ? (
              <div className="fila-p" style={{ borderLeftColor: 'var(--g)', marginBottom: 14 }}>
                <span style={{ fontSize: 13, color: 'var(--n)' }}>
                  Todas las etiquetas de los tests existen en el árbol.
                </span>
              </div>
            ) : (
              <div className="fila-p" style={{ borderLeftColor: 'var(--amb)', marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: 'var(--n)', lineHeight: 1.6 }}>
                  <b>{faltanEt.length} etiquetas no existen</b> y se omitirán: {faltanEt.join(', ')}.
                  <br />Créalas en Biblioteca → Etiquetas y vuelve a sembrar, o el test no se
                  podrá filtrar por esa zona.
                </div>
              </div>
            )
          )}

          <label className="btn btn-s" style={{ cursor: 'pointer', marginBottom: 10 }}>
            <Ic name="imagen" size={13} /> Seleccionar las imágenes
            <input type="file" accept="image/*" multiple style={{ display: 'none' }}
              onChange={e => setFicheros(Array.from(e.target.files || []))} />
          </label>

          {ficheros.length > 0 && (
            <div style={{ fontSize: 13, color: conImagen > 0 ? 'var(--gd)' : '#7A5800', marginBottom: 12 }}>
              {ficheros.length} archivo{ficheros.length === 1 ? '' : 's'} seleccionado{ficheros.length === 1 ? '' : 's'} ·
              {' '}{conImagen} de {TESTS.filter(t => t.archivo).length} tests emparejan por nombre.
              {' '}Los que no, se quedan con la imagen que ya tuvieran.
            </div>
          )}

          <button className="btn btn-p" onClick={sembrar} disabled={corriendo}>
            {corriendo ? 'Sembrando…' : 'Sembrar tests y objetivos'}
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

'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { traerTodo } from '@/lib/paginar'

// ---------------------------------------------------------------------------
// DE VARIANTES A FAMILIAS. Migración de una sola vez.
//
// Hasta ahora una variante era una línea dentro del ejercicio (nombre, descripción y
// foto), sin criterios de ejecución, ni feedbacks, ni objetivos propios. Ahora cada
// variante es un EJERCICIO COMPLETO que pertenece a una familia, y la familia tiene
// un ejercicio de PORTADA (`portada_id` apunta a él).
//
// Por cada variante se decide aquí:
//   - Ejercicio de la familia: se crea con lo del padre (etiquetas, cómo se mide,
//     criterios, feedbacks) y lo suyo (nombre, descripción, foto, vídeo).
//   - Es la portada: no es nada distinto del ejercicio principal ("Completo",
//     "Bilateral"…). Lo que la usaba pasa a usar la portada.
//
// Y lo que ya la usaba se mueve al ejercicio nuevo sin perder nada: las sesiones (y
// plantillas), los registros del taller —con ellos su progresión— y los ajustes de
// citas. Nada se escribe hasta pulsar Aplicar. Se puede volver a abrir: lo que ya
// está migrado no sale, y si se cortó a medias reutiliza lo ya creado.
// ---------------------------------------------------------------------------

/** Nombres que casi siempre son "el ejercicio tal cual": salen marcados como portada. */
const COMO_PORTADA = ['completo', 'completa', 'bilateral', 'convencional', 'simultaneo', 'libre', 'rango completo', 'barra recta', 'bipodal']
const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

type Var = { idx: number, nombre: string, v: any, accion: 'familia' | 'portada', nuevoNombre: string, usosSes: number, usosReg: number }
type Fam = { padre: any, vars: Var[] }

export default function FamiliasPage() {
  const [fams, setFams] = useState<Fam[]>([])
  const [cargando, setCargando] = useState(true)
  const [aplicando, setAplicando] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [error, setError] = useState('')
  const apunta = (t: string) => setLog(l => [...l, t])

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true); setError('')
    const { filas: ejs, error: e1 } = await traerTodo((d, h) => supabase.from('ejercicios').select('*').order('nombre').range(d, h))
    if (e1) { setError('No se han podido leer los ejercicios: ' + e1); setCargando(false); return }
    const conVar = ejs.filter((e: any) => Array.isArray(e.variantes) && e.variantes.length > 0)
    // Cuánto se usa cada variante: en sesiones y en registros del taller.
    const usosSes: Record<string, number> = {}
    const { filas: ses } = await traerTodo((d, h) => supabase.from('sesiones').select('id,partes').order('id').range(d, h))
    ses.forEach((s: any) => (s.partes || []).forEach((p: any) => (p.ejercicios || []).forEach((e: any) => {
      if (e?.ejercicio_id && e.variante) { const k = e.ejercicio_id + '|' + e.variante; usosSes[k] = (usosSes[k] || 0) + 1 }
    })))
    const usosReg: Record<string, number> = {}
    const { filas: regs } = await traerTodo((d, h) => supabase.from('registros_ejercicio').select('ejercicio_id,variante')
      .not('variante', 'is', null).neq('variante', '').order('id').range(d, h))
    regs.forEach((r: any) => { const k = r.ejercicio_id + '|' + r.variante; usosReg[k] = (usosReg[k] || 0) + 1 })

    setFams(conVar.map((p: any) => ({
      padre: p,
      vars: p.variantes.map((v: any, idx: number) => {
        const nombre = String(v?.nombre || '').trim()
        const k = p.id + '|' + nombre
        return { idx, nombre, v, usosSes: usosSes[k] || 0, usosReg: usosReg[k] || 0,
          accion: COMO_PORTADA.includes(norm(nombre)) ? 'portada' : 'familia',
          nuevoNombre: `${p.nombre} · ${nombre}` }
      }).filter((x: Var) => x.nombre),
    })))
    setCargando(false)
  }

  const cambiar = (fi: number, vi: number, k: keyof Var, val: any) =>
    setFams(l => l.map((f, i) => i !== fi ? f : { ...f, vars: f.vars.map((v, j) => j !== vi ? v : { ...v, [k]: val }) }))

  const nFamilia = fams.reduce((n, f) => n + f.vars.filter(v => v.accion === 'familia').length, 0)
  const nPortada = fams.reduce((n, f) => n + f.vars.filter(v => v.accion === 'portada').length, 0)

  async function aplicar() {
    if (!confirm(`Se crean ${nFamilia} ejercicios nuevos y ${nPortada} variantes se funden con su portada.\n\nLas sesiones, registros y ajustes que las usan pasan al ejercicio que toca. ¿Aplicar?`)) return
    setAplicando(true); setLog([]); setError('')
    try {
      // 1. Los ejercicios nuevos. Clave del mapa: "padreId|nombreVariante".
      const mapa: Record<string, { id: string, nombre: string, imagen_url: string }> = {}
      for (const f of fams) {
        const p = f.padre
        const { data: yaHijos } = await supabase.from('ejercicios').select('id,nombre,imagen_url').eq('portada_id', p.id)
        for (const v of f.vars) {
          const k = p.id + '|' + v.nombre
          if (v.accion === 'portada') { mapa[k] = { id: p.id, nombre: p.nombre, imagen_url: p.imagen_url || '' }; continue }
          const nombre = v.nuevoNombre.trim() || `${p.nombre} · ${v.nombre}`
          const ya = (yaHijos || []).find((x: any) => norm(x.nombre) === norm(nombre))
          if (ya) { mapa[k] = ya; continue }
          const { data, error } = await supabase.from('ejercicios').insert({
            nombre, portada_id: p.id,
            descripcion: v.v.descripcion || p.descripcion || '',
            video_url: v.v.video_url || p.video_url || '',
            imagen_url: v.v.imagen_url || p.imagen_url || '',
            etiquetas: p.etiquetas || [], tipo_medida: p.tipo_medida || 'peso_reps',
            items_ejecucion: p.items_ejecucion || [], feedbacks: p.feedbacks || [], variantes: [],
          }).select('id,nombre,imagen_url').single()
          if (error || !data) throw new Error(`Al crear «${nombre}»: ${error?.message || 'sin respuesta'}`)
          mapa[k] = data
        }
      }
      apunta(`✓ ${nFamilia} ejercicios de familia listos`)

      // 2. Sesiones y plantillas: el ejercicio de cada hueco pasa al nuevo, sin variante.
      const { filas: ses, error: e2 } = await traerTodo((d, h) => supabase.from('sesiones').select('id,partes').order('id').range(d, h))
      if (e2) throw new Error('Al leer las sesiones: ' + e2)
      let nSes = 0
      for (const s of ses) {
        let toca = false
        const partes = (s.partes || []).map((pt: any) => ({ ...pt, ejercicios: (pt.ejercicios || []).map((e: any) => {
          const m = e?.ejercicio_id && e.variante ? mapa[e.ejercicio_id + '|' + e.variante] : null
          if (!m) return e
          toca = true
          return { ...e, ejercicio_id: m.id, nombre: m.nombre, imagen_url: m.imagen_url || e.imagen_url || '', variante: '' }
        }) }))
        if (!toca) continue
        const { error } = await supabase.from('sesiones').update({ partes }).eq('id', s.id)
        if (error) throw new Error('Al mover una sesión: ' + error.message)
        nSes++
      }
      apunta(`✓ ${nSes} sesiones movidas`)

      // 3. Registros del taller: con ellos va su progresión.
      let nReg = 0
      for (const [k, m] of Object.entries(mapa)) {
        const [padreId, ...resto] = k.split('|'); const variante = resto.join('|')
        const { data, error } = await supabase.from('registros_ejercicio')
          .update({ ejercicio_id: m.id, ejercicio_nombre: m.nombre, variante: null })
          .eq('ejercicio_id', padreId).eq('variante', variante).select('id')
        if (error) throw new Error(`Al mover registros de «${m.nombre}»: ${error.message}`)
        nReg += (data || []).length
      }
      apunta(`✓ ${nReg} registros movidos`)

      // 4. Ajustes de citas: una variante ajustada para un día ya no tiene sentido.
      const { filas: cs } = await traerTodo((d, h) => supabase.from('citas').select('id,ajustes').not('ajustes', 'is', null).order('id').range(d, h))
      let nCit = 0
      for (const c of cs) {
        const ej = c.ajustes?.ejercicios
        if (!ej || !Object.values(ej).some((a: any) => a && 'variante' in a)) continue
        const limpio = Object.fromEntries(Object.entries(ej).map(([pos, a]: any) => { const { variante, ...r } = a || {}; return [pos, r] }))
        const { error } = await supabase.from('citas').update({ ajustes: { ...c.ajustes, ejercicios: limpio } }).eq('id', c.id)
        if (error) throw new Error('Al limpiar ajustes de cita: ' + error.message)
        nCit++
      }
      apunta(`✓ ${nCit} citas con ajuste limpiadas`)

      // 5. Lo último: el padre ya no tiene variantes en su lista (ahora son su familia).
      for (const f of fams) {
        const { error } = await supabase.from('ejercicios').update({ variantes: [] }).eq('id', f.padre.id)
        if (error) throw new Error(`Al vaciar las variantes de «${f.padre.nombre}»: ${error.message}`)
      }
      apunta(`✓ ${fams.length} portadas listas`)
    } catch (e: any) {
      setError(String(e?.message || e) + ' — Lo hecho hasta aquí se queda; vuelve a abrir la página y aplica otra vez para terminar.')
    }
    setAplicando(false)
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 0' }}>
      <div className="panel">
        <div className="sec">
          <div className="sec-h">
            <span className="sh-l"><span className="ct-l"><Ic name="fuerza" size={13}/> De variantes a familias</span></span>
            {!cargando && <span className="sh-r">{fams.length} familias · {nFamilia} ejercicios nuevos · {nPortada} a la portada</span>}
          </div>
          {cargando && <div className="muted">Contando variantes y sus usos…</div>}
          {error && <div style={{ color: 'var(--red)', fontSize: 13, margin: '8px 0' }}>{error}</div>}
          {log.map((t, i) => <div key={i} style={{ fontSize: 13, color: 'var(--gd)' }}>{t}</div>)}
          {!cargando && fams.length === 0 && <div style={{ fontSize: 13, color: 'var(--gd)' }}>No queda ninguna variante por pasar a familia.</div>}

          {!cargando && fams.map((f, fi) => (
            <div key={f.padre.id} style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--n)', marginBottom: 4 }}>{f.padre.nombre}</div>
              {f.vars.map((v, vi) => (
                <div key={vi} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', flexWrap: 'wrap' }}>
                  <select className="input" value={v.accion} disabled={aplicando} style={{ width: 170, fontSize: 12.5 }}
                    onChange={e => cambiar(fi, vi, 'accion', e.target.value)}>
                    <option value="familia">Ejercicio de la familia</option>
                    <option value="portada">Es la portada</option>
                  </select>
                  {v.accion === 'familia'
                    ? <input className="input" value={v.nuevoNombre} disabled={aplicando} style={{ flex: 1, minWidth: 220, fontSize: 13 }}
                        onChange={e => cambiar(fi, vi, 'nuevoNombre', e.target.value)}/>
                    : <span style={{ flex: 1, minWidth: 220, fontSize: 13, color: 'var(--grl)' }}>{v.nombre} → se usa {f.padre.nombre}</span>}
                  {(v.usosSes > 0 || v.usosReg > 0) && (
                    <span style={{ fontSize: 11, color: 'var(--gd)' }}>{v.usosSes} ses · {v.usosReg} reg</span>
                  )}
                </div>
              ))}
            </div>
          ))}

          {!cargando && fams.length > 0 && (
            <div style={{ position: 'sticky', bottom: 12, marginTop: 18, display: 'flex', gap: 8 }}>
              <button className="btn btn-p" onClick={aplicar} disabled={aplicando}>{aplicando ? 'Aplicando…' : 'Aplicar'}</button>
              <button className="btn btn-s" onClick={cargar} disabled={aplicando}>Recargar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

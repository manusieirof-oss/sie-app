'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { traerTodo } from '@/lib/paginar'
import { normalizar, contiene } from '@/lib/texto'
import { CATEGORIAS_ETIQUETA, categoriaDe, nivelDe } from '@/lib/etiquetas'
import { TIPOS_MEDIDA, subirImagenEjercicio, moverAFamilia, sacarDeFamilia, crearVariante, hacerPortada, similaresA, leerCola } from '@/lib/ejercicios'
import ImagenEjercicio from '@/components/ImagenEjercicio'
import { EditorLista } from '@/app/entrenamiento/components/BibliotecaTab'

// ---------------------------------------------------------------------------
// AMASAR · EL ROSCO
//
// La pella en el centro —su foto o, mientras no tenga, la figura de sus músculos, que
// se va formando según le pones etiquetas— y alrededor, como un rosco, todo lo que se
// le puede dar: nombre, descripción, etiquetas, cómo se mide, ejecución, feedbacks,
// foto y familia. Cada quesito se rellena de color cuando ya tiene lo suyo, así se ve
// de un vistazo qué le falta. Tocar uno lo abre al lado; el rosco se aparta sin irse.
//
// Nada se escribe hasta "Guardar". Lo nuevo se crea entonces; lo existente se actualiza.
// ---------------------------------------------------------------------------

type Clave = 'nombre' | 'descripcion' | 'etiquetas' | 'medida' | 'ejecucion' | 'feedbacks' | 'foto' | 'familia'
type Datos = { nombre: string, descripcion: string, video_url: string, imagen_url: string, etiquetas: string[],
  tipo_medida: string, items_ejecucion: any[], feedbacks: any[], portada_id: string | null,
  /** Quesitos que vienen copiados al crear una variante y hay que confirmar ('ejecucion', 'feedbacks'). */
  por_revisar: string[] }

const VACIO: Datos = { nombre: '', descripcion: '', video_url: '', imagen_url: '', etiquetas: [], tipo_medida: '',
  items_ejecucion: [], feedbacks: [], portada_id: null, por_revisar: [] }

// Geometría del rosco (viewBox 600 x 600).
const C = 300, R0 = 168, R1 = 286, HUECO = 1.6

const polar = (r: number, a: number) => [C + r * Math.cos(a * Math.PI / 180), C + r * Math.sin(a * Math.PI / 180)]
function quesito(a0: number, a1: number) {
  const [x0, y0] = polar(R1, a0), [x1, y1] = polar(R1, a1), [x2, y2] = polar(R0, a1), [x3, y3] = polar(R0, a0)
  const g = a1 - a0 > 180 ? 1 : 0
  return `M${x0},${y0} A${R1},${R1} 0 ${g} 1 ${x1},${y1} L${x2},${y2} A${R0},${R0} 0 ${g} 0 ${x3},${y3} Z`
}

export default function AmasarRosco({ params }: { params: { id: string } }) {
  const router = useRouter()
  const nuevo = params.id === 'nuevo'
  // Recién creado: se dice, y la pella late. Antes se quedaba igual y solo cambiaba
  // el botón de abajo, que no decía nada.
  const sp = useSearchParams()
  const recien = sp.get('creado') === '1'
  const [d, setD] = useState<Datos>(VACIO)
  const [orig, setOrig] = useState<Datos>(VACIO)
  const [ets, setEts] = useState<any[]>([])
  const [ejs, setEjs] = useState<any[]>([])
  const [objetivos, setObjetivos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto] = useState<Clave | null>(null)
  const [encima, setEncima] = useState<Clave | null>(null)
  const [foto, setFoto] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [buscaEt, setBuscaEt] = useState('')
  const [raizAbierta, setRaizAbierta] = useState<string | null>(null)
  const [modoFam, setModoFam] = useState<'suelto' | 'variante' | 'portada' | null>(null)
  // Nombre de la variante que se está creando desde la ficha (null = no se está creando).
  const [nombreVar, setNombreVar] = useState<string | null>(null)
  // La ficha sale para revisar lo hecho: al crear y al guardar. En cuanto se abre un
  // quesito o se cierra, se va, y no vuelve hasta el siguiente guardado (o "Ver ficha").
  const [fichaOn, setFichaOn] = useState(recien)
  // La cola de ejercicios a completar seguidos (elegidos en el torno).
  const [cola, setCola] = useState<string[]>([])
  useEffect(() => { if (sp.get('cola')) setCola(leerCola()) }, [sp])

  useEffect(() => { cargar() }, [params.id]) // eslint-disable-line react-hooks/exhaustive-deps
  async function cargar() {
    const [a, b, o] = await Promise.all([
      traerTodo((dd, h) => supabase.from('etiquetas').select('*').order('id').range(dd, h)),
      traerTodo((dd, h) => supabase.from('ejercicios').select('id,nombre,portada_id,etiquetas,imagen_url').order('nombre').order('id').range(dd, h)),
      supabase.from('objetivos').select('id,nombre,imagen_url,articulacion_id,etiquetas,movimientos').eq('activo', true).order('nombre'),
    ])
    setEts(a.filas); setEjs(b.filas); setObjetivos(o.data || [])
    if (!nuevo) {
      const { data: e } = await supabase.from('ejercicios').select('*').eq('id', params.id).maybeSingle()
      if (e) {
        const x: Datos = { nombre: e.nombre || '', descripcion: e.descripcion || '', video_url: e.video_url || '', imagen_url: e.imagen_url || '',
          etiquetas: e.etiquetas || [], tipo_medida: e.tipo_medida || '', items_ejecucion: e.items_ejecucion || [],
          feedbacks: e.feedbacks || [], portada_id: e.portada_id || null, por_revisar: e.por_revisar || [] }
        setD(x); setOrig(x)
      }
    }
    setCargando(false)
    if (recien) { setAviso('✓ Creado. Ya está en la biblioteca'); setTimeout(() => setAviso(''), 4000) }
  }
  const set = (k: keyof Datos, v: any) => setD(p => ({ ...p, [k]: v }))
  // Tocar una lista copiada ya es revisarla: deja de estar en amarillo.
  const setRev = (k: 'items_ejecucion' | 'feedbacks', clave: Clave, v: any) =>
    setD(p => ({ ...p, [k]: v, por_revisar: p.por_revisar.filter(x => x !== clave) }))
  const rev = (k: Clave) => d.por_revisar.includes(k)
  async function pasarAPrincipal() {
    setGuardando(true)
    const r = await hacerPortada({ id: params.id, portada_id: orig.portada_id })
    setGuardando(false)
    if (r.ok === false) { setAviso('No se pudo: ' + r.error); return }
    await cargar(); setFichaOn(true); setAviso('✓ Ahora es el principal de la familia')
  }

  // ---- Los quesitos -----------------------------------------------------------
  const nEt = d.etiquetas.length
  const variantes = ejs.filter(x => !nuevo && x.portada_id === params.id)
  const QUESITOS: { k: Clave, t: string, ic: string, lleno: boolean, sub: string, opcional?: boolean, rev?: boolean }[] = [
    { k: 'nombre', t: 'Nombre', ic: 'editar', lleno: !!d.nombre.trim(), sub: d.nombre || 'Sin nombre' },
    { k: 'descripcion', t: 'Descripción', ic: 'nota', lleno: !!d.descripcion.trim(), sub: d.descripcion ? 'Escrita' : 'Vacía' },
    { k: 'etiquetas', t: 'Etiquetas', ic: 'etiqueta', lleno: nEt > 0, sub: nEt ? `${nEt} puesta${nEt === 1 ? '' : 's'}` : 'Ninguna' },
    { k: 'medida', t: 'Cómo se mide', ic: 'regla', lleno: !!d.tipo_medida, sub: TIPOS_MEDIDA.find(m => m.id === d.tipo_medida)?.nombre || 'Sin decidir' },
    // En amarillo y sin contar como lleno mientras sea lo copiado sin confirmar.
    { k: 'ejecucion', t: 'Ejecución', ic: 'ok', rev: rev('ejecucion'), lleno: !rev('ejecucion') && d.items_ejecucion.some(i => i.texto?.trim()),
      sub: rev('ejecucion') ? 'Por revisar' : `${d.items_ejecucion.filter(i => i.texto?.trim()).length} criterios` },
    { k: 'feedbacks', t: 'Feedbacks', ic: 'mensaje', rev: rev('feedbacks'), lleno: !rev('feedbacks') && d.feedbacks.some(i => i.texto?.trim()),
      sub: rev('feedbacks') ? 'Por revisar' : `${d.feedbacks.filter(i => i.texto?.trim()).length} frases` },
    // OPCIONALES: no cuentan para "listo". Sin foto ya sale la figura, y suelto es un
    // estado válido; si contaran, el rosco nunca se completaría.
    { k: 'foto', t: 'Foto y vídeo', ic: 'camara', opcional: true, lleno: !!(preview || d.imagen_url), sub: preview || d.imagen_url ? 'Con foto' : 'Figura automática' },
    { k: 'familia', t: 'Familia', ic: 'plantillas', opcional: true, lleno: !!d.portada_id || variantes.length > 0,
      sub: d.portada_id ? `De ${ejs.find(x => x.id === d.portada_id)?.nombre || 'otra'}` : variantes.length ? `Portada · ${variantes.length}` : 'Suelto' },
  ]
  const paso = 360 / QUESITOS.length
  const necesarios = QUESITOS.filter(q => !q.opcional)
  const llenos = necesarios.filter(q => q.lleno).length

  const cambiado = JSON.stringify(d) !== JSON.stringify(orig) || !!foto
  const repetido = useMemo(() => ejs.some(x => x.id !== params.id && normalizar(x.nombre).trim() === normalizar(d.nombre).trim()), [ejs, d.nombre, params.id])
  const puedeGuardar = !!d.nombre.trim() && !!d.tipo_medida && !repetido && cambiado && !guardando

  async function guardar() {
    setGuardando(true); setAviso('')
    const fila: any = { nombre: d.nombre.trim(), descripcion: d.descripcion, video_url: d.video_url, etiquetas: d.etiquetas,
      tipo_medida: d.tipo_medida, items_ejecucion: d.items_ejecucion.filter(i => i.texto?.trim()),
      feedbacks: d.feedbacks.filter(i => i.texto?.trim()) }
    // Solo si ha cambiado: así guardar no depende de la columna si nunca se usó.
    if (JSON.stringify(d.por_revisar) !== JSON.stringify(orig.por_revisar)) fila.por_revisar = d.por_revisar
    let id = params.id
    if (nuevo) {
      const { data, error } = await supabase.from('ejercicios')
        .insert({ ...fila, imagen_url: '', variantes: [], portada_id: d.portada_id }).select('id').single()
      if (error || !data) { setGuardando(false); setAviso('No se ha guardado: ' + (error?.message || '')); return }
      id = data.id
    } else {
      const { error } = await supabase.from('ejercicios').update(fila).eq('id', id)
      if (error) { setGuardando(false); setAviso('No se ha guardado: ' + error.message); return }
      // La familia, por sus funciones: si tenía variantes, se mueven con él.
      if (d.portada_id !== orig.portada_id) {
        const r = d.portada_id ? await moverAFamilia(id, { id: d.portada_id }) : await sacarDeFamilia(id)
        if (r.ok === false) setAviso('Guardado, pero la familia no: ' + r.error)
      }
    }
    if (foto) {
      const r = await subirImagenEjercicio(id, foto)
      if (r.ok === false) setAviso('Guardado, pero la foto no: ' + r.error)
      else await supabase.from('ejercicios').update({ imagen_url: r.url }).eq('id', id)
    }
    setGuardando(false); setFoto(null)
    if (nuevo) { router.replace(`/torno/amasar/${id}?creado=1`); return }
    cargar(); setFichaOn(true); setAviso('✓ Amasado')
    setTimeout(() => setAviso(a => a === '✓ Amasado' ? '' : a), 2500)
  }

  // ---- Etiquetas: raíces por categoría, sus hijas al abrir ----------------------
  const porCat = useMemo(() => {
    const m: Record<string, any[]> = {}
    ets.filter(e => !e.padre_id).forEach(e => { const c = categoriaDe(ets, e); (m[c] = m[c] || []).push(e) })
    Object.values(m).forEach(l => l.sort((a, b) => a.nombre.localeCompare(b.nombre)))
    return m
  }, [ets])
  /** Etiquetas que usan los objetivos para sugerirse (articulación, etiquetas, específicos). */
  const usadasObj = useMemo(() => {
    const s = new Set<string>()
    objetivos.forEach((o: any) => [o.articulacion_id, ...(o.etiquetas || []), ...(o.movimientos || [])].forEach((id: any) => { if (id) s.add(String(id)) }))
    // La raíz también, para que se vea desde fuera que dentro hay algo que importa.
    Array.from(s).forEach(id => { let e = ets.find(x => x.id === id); while (e?.padre_id) { s.add(e.padre_id); e = ets.find(x => x.id === e.padre_id) } })
    return s
  }, [objetivos, ets])
  const IMPORTA: Record<string, string> = { musculo: 'Dibuja la figura · sugiere objetivos', articulacion: 'Sugiere objetivos', movimiento: 'Sugiere objetivos' }
  const hijas = (id: string) => ets.filter(e => e.padre_id === id).sort((a, b) => a.nombre.localeCompare(b.nombre))
  const togEt = (id: string) => set('etiquetas', d.etiquetas.includes(id) ? d.etiquetas.filter(x => x !== id) : [...d.etiquetas, id])
  const chipEt = (e: any) => {
    const on = d.etiquetas.includes(e.id)
    return (
      <button key={e.id} type="button" className={`chip-sel ${on ? 'on' : ''}`} onClick={() => togEt(e.id)}
        title={usadasObj.has(e.id) ? 'La usan los objetivos para sugerirse' : undefined}
        style={{ fontSize: 12.5, padding: '5px 11px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        {usadasObj.has(e.id) && <span style={{ width: 6, height: 6, borderRadius: 99, background: on ? '#fff' : '#D4A24E', flexShrink: 0 }}/>}
        {e.nombre}
      </button>
    )
  }

  function editor(k: Clave) {
    switch (k) {
      case 'nombre': return (<>
        <input className="input" autoFocus value={d.nombre} onChange={e => set('nombre', e.target.value)}
          placeholder="Ej. Sentadilla búlgara con mancuernas" style={{ fontSize: 16, padding: '12px 14px' }}/>
        {repetido && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 6 }}>Ya hay un ejercicio con ese nombre.</div>}
      </>)
      case 'descripcion': return (
        <textarea className="input" autoFocus value={d.descripcion} onChange={e => set('descripcion', e.target.value)}
          placeholder="Cómo se hace, paso a paso" style={{ minHeight: 180, fontSize: 13.5, lineHeight: 1.5 }}/>
      )
      case 'etiquetas': {
        const q = buscaEt.trim()
        const encontradas = q ? ets.filter(e => contiene(e.nombre, q)).slice(0, 30) : []
        return (<>
          {/* LO PUESTO, por categoría: así se ve si falta el músculo o la posición. */}
          {d.etiquetas.length > 0 && (
            <div style={{ display: 'grid', gap: 6, marginBottom: 12, padding: '10px 12px', borderRadius: 14, background: 'var(--gl)' }}>
              {CATEGORIAS_ETIQUETA.map(c => {
                const suyas = d.etiquetas.map(id => ets.find(e => e.id === id)).filter((e: any) => e && categoriaDe(ets, e) === c.key)
                if (!suyas.length) return null
                return (
                  <div key={c.key} style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span className="et-mini" style={{ minWidth: 86 }}>{c.label}</span>
                    {suyas.map((e: any) => <span key={e.id} className="chip-sel on" style={{ fontSize: 12.5 }} onClick={() => togEt(e.id)}>{e.nombre} ✕</span>)}
                  </div>
                )
              })}
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--grl)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: '#D4A24E' }}/> la usan los objetivos
          </div>
          <input className="input" value={buscaEt} onChange={e => setBuscaEt(e.target.value)} placeholder="Buscar etiqueta…" style={{ marginBottom: 10 }}/>
          {q
            ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{encontradas.map(chipEt)}</div>
            : CATEGORIAS_ETIQUETA.filter(c => (porCat[c.key] || []).length).map(c => (
              <div key={c.key} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                  <span className="et-mini">{c.label}</span>
                  {IMPORTA[c.key] && <span style={{ fontSize: 10.5, color: '#A87E2C' }}>{IMPORTA[c.key]}</span>}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {porCat[c.key].map(r => (
                    <span key={r.id} style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
                      {chipEt(r)}
                      {hijas(r.id).length > 0 && (
                        <button type="button" onClick={() => setRaizAbierta(raizAbierta === r.id ? null : r.id)}
                          style={{ border: 'none', background: 'none', color: 'var(--g)', cursor: 'pointer', fontSize: 11, padding: '0 3px' }}>
                          {raizAbierta === r.id ? '▴' : `${hijas(r.id).length}▾`}
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                {porCat[c.key].some(r => r.id === raizAbierta) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, margin: '6px 0 0 12px' }}>
                    {ets.filter(e => e.padre_id === raizAbierta || ets.find(p => p.id === e.padre_id)?.padre_id === raizAbierta)
                      .sort((a, b) => nivelDe(ets, a) - nivelDe(ets, b) || a.nombre.localeCompare(b.nombre)).map(chipEt)}
                  </div>
                )}
              </div>
            ))}
        </>)
      }
      case 'medida': return (
        <div style={{ display: 'grid', gap: 10 }}>
          {TIPOS_MEDIDA.map(m => (
            <button key={m.id} type="button" onClick={() => set('tipo_medida', m.id)}
              style={{ textAlign: 'left', padding: '14px 16px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
                border: 'none', background: d.tipo_medida === m.id ? 'var(--g)' : '#fff', color: d.tipo_medida === m.id ? '#fff' : 'var(--n)',
                boxShadow: '0 3px 12px rgba(38,40,37,.10)' }}>
              <div style={{ fontSize: 14 }}>{m.nombre}</div>
              <div style={{ fontSize: 11.5, opacity: .8, marginTop: 2 }}>{m.ayuda}</div>
            </button>
          ))}
        </div>
      )
      // Solo los criterios, sin objetivos por criterio (de momento): era demasiado aquí.
      // Los que ya tenían objetivos los conservan (EditorLista solo toca el texto).
      case 'ejecucion': return <EditorLista items={d.items_ejecucion} onChange={(v: any[]) => setRev('items_ejecucion', 'ejecucion', v)} label="Qué tiene que cumplir" placeholder="Ej. Rodilla alineada con el pie" icono="ok"/>
      case 'feedbacks': return <EditorLista items={d.feedbacks} onChange={(v: any[]) => setRev('feedbacks', 'feedbacks', v)} label="Lo que se le dice en la sala" placeholder="Ej. Rodilla hacia fuera" icono="mensaje"/>
      case 'foto': return (<>
        <label style={{ display: 'block', cursor: 'pointer' }}>
          <div className="btn btn-s" style={{ justifyContent: 'center', width: '100%' }}><Ic name="camara" size={13}/> {preview || d.imagen_url ? 'Cambiar foto' : 'Subir foto'}</div>
          <input type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) { setFoto(f); setPreview(URL.createObjectURL(f)) } }}/>
        </label>
        {(preview || d.imagen_url) && (
          <button className="btn btn-t btn-sm" style={{ marginTop: 8 }} onClick={() => { setFoto(null); setPreview(''); set('imagen_url', '') }}>
            Quitar la foto (vuelve la figura automática)
          </button>
        )}
        <div className="field" style={{ marginTop: 14 }}><label>Enlace de vídeo</label>
          <input className="input" value={d.video_url} onChange={e => set('video_url', e.target.value)} placeholder="https://…"/></div>
      </>)
      case 'familia': {
        const modo = modoFam || (d.portada_id ? 'variante' : variantes.length ? 'portada' : 'suelto')
        const tarjeta = (m: 'suelto' | 'variante' | 'portada', t: string, a: string) => (
          <button key={m} type="button" onClick={() => { setModoFam(m); if (m !== 'variante') set('portada_id', null) }}
            style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
              background: modo === m ? 'var(--g)' : '#fff', color: modo === m ? '#fff' : 'var(--n)', boxShadow: '0 3px 12px rgba(38,40,37,.10)' }}>
            <div style={{ fontSize: 14 }}>{t}</div><div style={{ fontSize: 11.5, opacity: .8, marginTop: 2 }}>{a}</div>
          </button>
        )
        return (<>
          <div style={{ display: 'grid', gap: 8 }}>
            {tarjeta('suelto', 'Suelto', 'Sin familia: un ejercicio por su cuenta')}
            {tarjeta('variante', 'Variante de otro', 'Pertenece a la familia de una portada')}
            {tarjeta('portada', 'Principal de una familia', 'De él salen las variantes')}
          </div>
          {modo === 'variante' && (
            <div className="field" style={{ marginTop: 12 }}><label>¿De qué ejercicio?</label>
              <select className="input" value={d.portada_id || ''} onChange={e => set('portada_id', e.target.value || null)}>
                <option value="" disabled>Elige la portada…</option>
                {ejs.filter(x => !x.portada_id && x.id !== params.id).map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
              </select>
            </div>
          )}
          {modo === 'portada' && (
            <div style={{ marginTop: 12 }}>
              {variantes.length > 0 && (<>
                <div className="et-mini" style={{ marginBottom: 6 }}>Sus variantes</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                  {variantes.map(x => <span key={x.id} className="chip-sel" style={{ fontSize: 12 }} onClick={() => router.push(`/torno/amasar/${x.id}`)}>{x.nombre}</span>)}
                </div>
              </>)}
              {nuevo
                ? <div style={{ fontSize: 12, color: 'var(--grl)' }}>Créalo primero y luego podrás sacarle variantes.</div>
                : <button className="btn btn-s btn-sm" onClick={() => { setAbierto(null); setFichaOn(true); setNombreVar(`${d.nombre} · `) }}>+ Amasar una variante de este</button>}
            </div>
          )}
          {orig.portada_id && d.portada_id === orig.portada_id && modo === 'variante' && (
            <button className="btn btn-s btn-sm" style={{ marginTop: 12 }} disabled={cambiado || guardando} title={cambiado ? 'Guarda antes los cambios' : ''}
              onClick={pasarAPrincipal}>Hacer principal de la familia</button>
          )}
          {d.portada_id && modo === 'variante' && (() => {
            const her = ejs.filter(x => x.portada_id === d.portada_id && x.id !== params.id)
            return her.length ? (<>
              <div className="et-mini" style={{ margin: '12px 0 6px' }}>Su familia</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {her.map(x => <span key={x.id} className="chip-sel" style={{ fontSize: 12 }} onClick={() => router.push(`/torno/amasar/${x.id}`)}>{x.nombre}</span>)}
              </div>
            </>) : null
          })()}
        </>)
      }
    }
  }

  const q = QUESITOS.find(x => x.k === abierto)

  // ---- La ficha -------------------------------------------------------------------
  // Con el rosco cerrado se ve TODO el ejercicio a la derecha, ya hecho, y desde ahí se
  // sigue amasando: otro nuevo o una variante. Una variante copia todo (etiquetas,
  // medida, ejecución, feedbacks) y este pasa a ser la portada de la familia; si este ya
  // es variante, la nueva va a la misma familia (no hay variantes de variantes).
  const verFicha = fichaOn && !abierto && !nuevo

  // ---- La cola: anterior / siguiente ---------------------------------------------
  const iCola = cola.indexOf(params.id)
  const enCola = cola.length > 1 && iCola >= 0
  /** Pasa a otro de la cola guardando antes lo hecho; si no se puede guardar, pregunta. */
  async function irCola(paso: number) {
    const id = cola[iCola + paso]
    if (!id) return
    if (cambiado) {
      if (puedeGuardar) await guardar()
      else if (!confirm('Hay cambios que aún no se pueden guardar (falta nombre o cómo se mide). ¿Pasar sin guardarlos?')) return
    }
    router.push(`/torno/amasar/${id}?cola=1`)
  }
  // Los parecidos por etiquetas (fuera de su familia, que ya sale aparte).
  const parecidos = useMemo(() => nuevo ? [] : similaresA(ejs, { ...d, id: params.id }, 8, ets), [ejs, d.etiquetas, ets]) // eslint-disable-line react-hooks/exhaustive-deps
  async function nuevaVariante() {
    if (!nombreVar?.trim()) return
    if (ejs.some(x => normalizar(x.nombre).trim() === normalizar(nombreVar).trim())) { setAviso('Ese nombre ya existe'); return }
    setGuardando(true)
    const r = await crearVariante({ ...orig, id: params.id }, nombreVar)
    setGuardando(false)
    if (r.ok === false) { setAviso('No se pudo crear: ' + r.error); return }
    // Ejecución y feedbacks llegan copiados: se marcan para confirmarlos en la variante.
    const copiado = [orig.items_ejecucion.length ? 'ejecucion' : '', orig.feedbacks.length ? 'feedbacks' : ''].filter(Boolean)
    if (copiado.length) await supabase.from('ejercicios').update({ por_revisar: copiado }).eq('id', r.ejercicio.id)
    setNombreVar(null)
    router.push(`/torno/amasar/${r.ejercicio.id}?creado=1`)
  }
  function ficha() {
    const sec = (k: Clave, titulo: string, hijos: any, vacio: boolean) => (
      <div className="am-sec" onClick={() => { setFichaOn(false); setAbierto(k) }} title="Tocar para cambiar" style={rev(k) ? { background: '#FBF1D3' } : undefined}>
        <div className="et-mini" style={{ marginBottom: 5 }}>{titulo}{rev(k) && <span style={{ color: '#8A6410', textTransform: 'none', letterSpacing: 0 }}>· copiado, por revisar</span>}</div>
        {vacio ? <div style={{ fontSize: 12.5, color: 'var(--grl)' }}>Nada todavía</div> : hijos}
      </div>
    )
    const medida = TIPOS_MEDIDA.find(m => m.id === d.tipo_medida)?.nombre
    const portada = d.portada_id ? ejs.find(x => x.id === d.portada_id) : null
    const ejec = d.items_ejecucion.filter(i => i.texto?.trim())
    const fbs = d.feedbacks.filter(i => i.texto?.trim())
    return (
      <div className="am-panel am-ficha">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, fontSize: 20, lineHeight: 1.2 }}>{d.nombre}</div>
          <button className="btn btn-t btn-sm" onClick={() => { setFichaOn(false); setNombreVar(null) }}>Cerrar</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--gd)', margin: '4px 0 14px', cursor: 'pointer' }} onClick={() => { setFichaOn(false); setAbierto('familia') }}>
          {medida || 'Sin medida'} · {portada ? `Variante de ${portada.nombre}` : variantes.length ? `Principal · ${variantes.length} variante${variantes.length === 1 ? '' : 's'}` : 'Suelto'}
          {portada && !cambiado && <button className="btn btn-t btn-sm" style={{ marginLeft: 8, padding: '2px 9px', fontSize: 11.5 }}
            disabled={guardando} onClick={ev => { ev.stopPropagation(); pasarAPrincipal() }}>Hacer principal</button>}
        </div>
        {sec('descripcion', 'Descripción', <div style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', color: 'var(--n)' }}>{d.descripcion}</div>, !d.descripcion.trim())}
        {sec('etiquetas', 'Etiquetas', (
          <div style={{ display: 'grid', gap: 5 }}>
            {CATEGORIAS_ETIQUETA.map(c => {
              const suyas = d.etiquetas.map(id => ets.find(e => e.id === id)).filter((e: any) => e && categoriaDe(ets, e) === c.key)
              if (!suyas.length) return null
              return (
                <div key={c.key} style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--grl)', minWidth: 78 }}>{c.label}</span>
                  {suyas.map((e: any) => <span key={e.id} className="chip-sel on" style={{ fontSize: 12 }}>{e.nombre}</span>)}
                </div>
              )
            })}
          </div>
        ), !d.etiquetas.length)}
        {sec('ejecucion', 'Ejecución', (
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.55 }}>{ejec.map((i, n) => <li key={n}>{i.texto}</li>)}</ol>
        ), !ejec.length)}
        {sec('feedbacks', 'Feedbacks', (
          <div style={{ display: 'grid', gap: 4 }}>{fbs.map((i, n) => <div key={n} style={{ fontSize: 13.5, fontStyle: 'italic', color: 'var(--gd)' }}>«{i.texto}»</div>)}</div>
        ), !fbs.length)}
        {(variantes.length > 0 || portada) && sec('familia', 'Familia', (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {(portada ? [portada, ...ejs.filter(x => x.portada_id === portada.id && x.id !== params.id)] : variantes).map(x =>
              <span key={x.id} className="chip-sel" style={{ fontSize: 12 }} onClick={ev => { ev.stopPropagation(); router.push(`/torno/amasar/${x.id}`) }}>{x.nombre}</span>)}
          </div>
        ), false)}

        {parecidos.length > 0 && (
          <div className="am-sec" style={{ cursor: 'default' }}>
            <div className="et-mini" style={{ marginBottom: 7 }}>Con sus mismas etiquetas</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(88px,1fr))', gap: 8 }}>
              {parecidos.map((x: any) => (
                <div key={x.id} onClick={() => router.push(`/torno/amasar/${x.id}`)} title="Abrir su rosco"
                  style={{ cursor: 'pointer', borderRadius: 12, overflow: 'hidden', background: '#fff', boxShadow: '0 2px 9px rgba(38,40,37,.10)' }}>
                  <ImagenEjercicio src={x.imagen_url} etiquetasEj={x.etiquetas} radio={0} fondo="var(--bl)" icono={20}/>
                  <div style={{ fontSize: 11, padding: '5px 7px', lineHeight: 1.2 }}>{x.nombre}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SEGUIR AMASANDO */}
        <div style={{ borderTop: '1px solid var(--bd)', marginTop: 14, paddingTop: 14 }}>
          {nombreVar === null ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-s btn-sm" disabled={cambiado} title={cambiado ? 'Guarda antes los cambios' : ''}
                onClick={() => setNombreVar(`${d.nombre} · `)}>+ {portada ? 'Otra variante de su familia' : 'Variante de este'}</button>
              <button className="btn btn-t btn-sm" onClick={() => router.push('/torno/amasar/nuevo')}>+ Otro ejercicio</button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 12, color: 'var(--gr)', marginBottom: 6 }}>
                Nombre de la variante. Sale con todo lo de este; luego cambias lo que la hace distinta.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input" autoFocus value={nombreVar} onChange={e => setNombreVar(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') nuevaVariante(); if (e.key === 'Escape') setNombreVar(null) }} style={{ flex: 1 }}/>
                <button className="btn btn-p btn-sm" disabled={guardando || !nombreVar.trim()} onClick={nuevaVariante}>Crear</button>
                <button className="btn btn-t btn-sm" onClick={() => setNombreVar(null)}>✕</button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="am">
      <style>{`
        .am { background:#fff; margin:-16px -18px; padding:18px 22px 120px; min-height:calc(100vh - 32px); overflow:hidden }
        .am-zona { display:flex; align-items:center; justify-content:center; gap:28px; min-height:calc(100vh - 160px) }
        .am-rosco { position:relative; width:min(600px, 90vw); aspect-ratio:1; flex-shrink:0;
                    transition: transform .5s cubic-bezier(.3,.8,.3,1), width .5s ease }
        .am-abierto .am-rosco { width:min(460px, 50vw) }
        .am-ficha { width:min(460px, 44vw) }
        .am-sec { padding:9px 10px; margin:0 -10px 4px; border-radius:12px; cursor:pointer; transition:background .15s }
        .am-sec:hover { background:var(--gl) }
        .am-q { cursor:pointer; transform-box:view-box; transform-origin:300px 300px;
                transition: transform .22s ease, fill .2s ease; animation: am-sale .55s cubic-bezier(.2,.9,.3,1.25) backwards }
        @keyframes am-sale { from { transform: scale(.55) rotate(-25deg); opacity:0 } to { transform:none; opacity:1 } }
        .am-et { position:absolute; transform:translate(-50%,-50%); text-align:center; pointer-events:none; width:96px;
                 transition: transform .22s ease; animation: am-et .5s ease backwards }
        @keyframes am-et { from { opacity:0 } to { opacity:1 } }
.am-late { animation: am-late 1.1s ease 2 }
        @keyframes am-late { 50% { box-shadow:0 0 0 14px rgba(90,150,158,.18), 0 10px 34px rgba(38,40,37,.16) } }
        .am-centro { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:52%; height:52%; border-radius:50%;
                     overflow:hidden; background:#fff; box-shadow:0 10px 34px rgba(38,40,37,.16); animation: am-pella .7s cubic-bezier(.2,.9,.3,1.2) backwards }
        @keyframes am-pella { from { transform:translate(-50%,-50%) scale(.3,.15) } 60% { transform:translate(-50%,-50%) scale(1.06,.95) } to { transform:translate(-50%,-50%) } }
        .am-panel { width:min(440px, 42vw); max-height:calc(100vh - 170px); overflow:auto; background:#fff; border-radius:20px; padding:18px 20px;
                    box-shadow:0 18px 44px rgba(38,40,37,.16); animation: am-panel .4s cubic-bezier(.2,.9,.3,1.1) backwards }
        @keyframes am-panel { from { opacity:0; transform: translateX(40px) scale(.96) } to { opacity:1; transform:none } }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.push('/torno')} title="Volver al torno"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: '#fff', color: 'var(--gd)', borderRadius: 99, padding: '9px 15px 9px 11px', fontSize: 13,
            boxShadow: '0 3px 14px rgba(38,40,37,.14)' }}><Ic name="atras" size={15}/> Torno</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 17 }}>{d.nombre || (nuevo ? 'Pella nueva' : '…')}</div>
          <div style={{ fontSize: 11.5, color: 'var(--gd)' }}>Amasar · {llenos} de {necesarios.length}{llenos === necesarios.length ? ' · lista' : ''}</div>
        </div>
        <div style={{ width: 90 }}/>
      </div>

      {cargando ? <div className="muted" style={{ textAlign: 'center', padding: 60 }}>Preparando el barro…</div> : (
        <div className={`am-zona ${abierto || verFicha ? 'am-abierto' : ''}`}>
          <div className="am-rosco">
            <svg viewBox="0 0 600 600" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              {QUESITOS.map((x, i) => {
                const a0 = -90 + i * paso + HUECO, a1 = -90 + (i + 1) * paso - HUECO
                const mid = (a0 + a1) / 2 * Math.PI / 180
                const fuera = encima === x.k || abierto === x.k ? 10 : 0
                return (
                  <path key={x.k} className="am-q" d={quesito(a0, a1)}
                    style={{ animationDelay: `${i * 55}ms`, transform: `translate(${Math.cos(mid) * fuera}px, ${Math.sin(mid) * fuera}px)` }}
                    fill={abierto === x.k ? 'var(--g)' : x.rev ? '#FBF1D3' : x.lleno ? 'var(--gl)' : '#fff'} fillOpacity={x.opcional && !x.lleno && abierto !== x.k ? .6 : 1}
                    stroke={x.rev ? '#E3BF5C' : x.lleno ? 'var(--gm)' : 'var(--bd)'} strokeWidth={1.2}
                    onMouseEnter={() => setEncima(x.k)} onMouseLeave={() => setEncima(null)}
                    onClick={() => { setFichaOn(false); setAbierto(abierto === x.k ? null : x.k) }}/>
                )
              })}
            </svg>
            {/* Las etiquetas de cada quesito, en HTML encima del SVG: se maquetan mejor. */}
            {QUESITOS.map((x, i) => {
              const mid = (-90 + (i + .5) * paso) * Math.PI / 180
              const r = (R0 + R1) / 2 / 600 * 100
              const on = abierto === x.k
              const fuera = encima === x.k || on ? 1.6 : 0
              return (
                <div key={x.k} className="am-et" style={{ left: `${50 + Math.cos(mid) * (r + fuera)}%`, top: `${50 + Math.sin(mid) * (r + fuera)}%`,
                  color: on ? '#fff' : x.rev ? '#8A6410' : x.lleno ? 'var(--gd)' : 'var(--gr)', animationDelay: `${300 + i * 55}ms` }}>
                  <Ic name={x.ic} size={18}/>
                  <div style={{ fontSize: 12, marginTop: 2, lineHeight: 1.15 }}>{x.t}</div>
                  <div style={{ fontSize: 9.5, opacity: .75, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.sub}</div>
                </div>
              )
            })}
            {/* LA PELLA: su foto o la figura de sus músculos, que cambia con las etiquetas. */}
            <div className={`am-centro ${recien ? 'am-late' : ''}`}>
              <ImagenEjercicio src={preview || d.imagen_url} etiquetasEj={d.etiquetas} relleno radio={0} fondo="#fff" icono={60}/>
            </div>
          </div>

          {q && (
            <div key={q.k} className="am-panel" style={q.k === 'etiquetas' ? { width: 'min(600px, 50vw)' } : undefined}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ color: 'var(--g)', lineHeight: 0 }}><Ic name={q.ic} size={18}/></span>
                <span style={{ flex: 1, fontSize: 15 }}>{q.t}</span>
                <button className="btn btn-p btn-sm" onClick={() => setAbierto(null)}>Hecho</button>
              </div>
              {rev(q.k) && (
                <div style={{ background: '#FBF1D3', borderRadius: 14, padding: '10px 12px', marginBottom: 12, fontSize: 12.5, color: '#6E5010' }}>
                  Viene copiado del ejercicio del que salió. Cambia lo que no valga para esta variante, o:
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="btn btn-p btn-sm" onClick={() => set('por_revisar', d.por_revisar.filter(x => x !== q.k))}>Sí, vale todo</button>
                    <button className="btn btn-t btn-sm" onClick={() => setRev(q.k === 'ejecucion' ? 'items_ejecucion' : 'feedbacks', q.k, [])}>Empezar de cero</button>
                  </div>
                </div>
              )}
              {editor(q.k)}
            </div>
          )}
          {verFicha && ficha()}
        </div>
      )}

      {/* GUARDAR, abajo y fijo, como en el resto del torno. */}
      {!cargando && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 22, display: 'flex', justifyContent: 'center', zIndex: 20, pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 99,
            padding: '8px 10px 8px 18px', boxShadow: '0 12px 30px rgba(38,40,37,.18)' }}>
            <span style={{ fontSize: 12.5, color: aviso.startsWith('✓') ? 'var(--gd)' : aviso ? 'var(--red)' : 'var(--gr)' }}>
              {aviso || (!d.nombre.trim() ? 'Falta el nombre' : !d.tipo_medida ? 'Falta cómo se mide' : repetido ? 'Ese nombre ya existe' : cambiado ? 'Sin guardar' : 'Todo guardado')}
            </span>
            {enCola && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <button className="btn btn-t btn-sm" disabled={iCola === 0 || guardando} onClick={() => irCola(-1)} title="Anterior">‹</button>
                <span style={{ fontSize: 12, color: 'var(--gd)', whiteSpace: 'nowrap' }}>{iCola + 1} de {cola.length}</span>
                <button className="btn btn-s btn-sm" disabled={iCola === cola.length - 1 || guardando} onClick={() => irCola(1)}>Siguiente ›</button>
              </span>
            )}
            {!nuevo && !verFicha && !abierto && (
              <button className="btn btn-t btn-sm" onClick={() => setFichaOn(true)}>Ver ficha</button>
            )}
            <button className="btn btn-p" disabled={!puedeGuardar} onClick={guardar}>
              <Ic name="guardar" size={13}/> {guardando ? 'Guardando…' : nuevo ? 'Crear' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { UNIDADES, unidadDe, problemasDelTest, planDeItems, alcanceItemsBorrados, aplicarCambioDeItems, esSuma, esBaremo } from '@/lib/tests'
import SelectorEtiquetasCompacto from '@/components/SelectorEtiquetasCompacto'
import { ConfigBarra, EditorBandas, SelectorZona, EditorBaremos } from '@/app/entrenamiento/components/EditoresTest'

// ---------------------------------------------------------------------------
// EL TEST, EN QUESITOS (torno → mapa → tocar el test del centro).
//
// Mismo rosco que el objetivo (RoscoObjetivo) y que al amasar un ejercicio: el test en
// el centro y un quesito por cosa que tiene. Los editores son los de la biblioteca
// (EditoresTest: barras, bandas, baremos, zona), solo que cada uno en su quesito.
//
// Se guarda como en la biblioteca (TestsTab.guardarEditTest): primero se comprueba que
// el test tiene sentido (problemasDelTest); si se quitan ítems de los que cuelgan
// objetivos, se avisa y se arrastra el cambio (planDeItems / aplicarCambioDeItems).
// ---------------------------------------------------------------------------

const C = 300, R0 = 168, R1 = 286, HUECO = 1.6
const polar = (r: number, a: number) => [C + r * Math.cos(a * Math.PI / 180), C + r * Math.sin(a * Math.PI / 180)]
function quesito(a0: number, a1: number) {
  const [x0, y0] = polar(R1, a0), [x1, y1] = polar(R1, a1), [x2, y2] = polar(R0, a1), [x3, y3] = polar(R0, a0)
  const g = a1 - a0 > 180 ? 1 : 0
  return `M${x0},${y0} A${R1},${R1} 0 ${g} 1 ${x1},${y1} L${x2},${y2} A${R0},${R0} 0 ${g} 0 ${x3},${y3} Z`
}

type Clave = 'nombre' | 'descripcion' | 'items' | 'resolucion' | 'lados' | 'zona' | 'imagen' | 'desaconseja'
const LOGICAS = [
  { id: 'cualquiera', t: 'Algún ítem', ayuda: 'Positivo si algún ítem está marcado' },
  { id: 'todos', t: 'Todos los ítems', ayuda: 'Positivo si todos los ítems están marcados' },
  { id: 'suma', t: 'Puntuación', ayuda: 'Manda el total, que cae en una banda' },
  { id: 'baremo', t: 'Baremo', ayuda: 'Cada ítem contra su norma por sexo y edad' },
]

export default function RoscoTest({ test, etiquetas, objetivos, onGuardado, onCerrar, onCambiado, onPanel, tam = 520 }: {
  test: any | null, etiquetas: any[], objetivos: any[],
  onGuardado: (id: string) => void,
  /** Solo si se puede salir sin más (uno nuevo): en el mapa no hay "salir", se viaja a otro. */
  onCerrar?: () => void,
  /** Avisa de si hay cambios sin guardar: el mapa pregunta antes de viajar a otro. */
  onCambiado?: (v: boolean) => void,
  /** Avisa de si el panel lateral está abierto: el mapa se aparta para que no lo tape. */
  onPanel?: (v: boolean) => void,
  /** Diámetro del rosco, en px: lo decide el mapa según la pantalla. */
  tam?: number,
}) {
  const [d, setD] = useState<any>(() => ({
    id: test?.id || '', nombre: test?.nombre || '', descripcion: test?.descripcion || '', video_url: test?.video_url || '',
    frecuencia_meses: test?.frecuencia_meses || 3, logica: test?.logica || 'cualquiera', items: test?.items || [],
    bandas: test?.bandas || [], baremos: test?.baremos || [], etiquetas_relacionadas: test?.etiquetas_relacionadas || [],
    etiquetas_bloquea: test?.etiquetas_bloquea || [], tipo_lado: test?.tipo_lado || 'bilateral',
    imagen_url: test?.imagen_url || '', imagen_file: null as File | null,
  }))
  const [abierto, setAbierto] = useState<Clave | null>(test ? null : 'nombre')
  const [encima, setEncima] = useState<Clave | null>(null)
  const [cambiado, setCambiado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState('')
  const set = (k: string, v: any) => { setD((p: any) => ({ ...p, [k]: v })); setCambiado(true); setAviso('') }
  const setItem = (i: number, campos: any) => { const its = [...d.items]; its[i] = { ...its[i], ...campos }; set('items', its) }

  const items = (d.items || []) as any[]
  const nItems = items.filter(i => String(i.nombre || '').trim()).length
  const nBloq = (d.etiquetas_bloquea || []).length
  const nZona = (d.etiquetas_relacionadas || []).length
  const conBandas = esSuma(d) || esBaremo(d)

  const QUESITOS: { k: Clave, t: string, ic: string, lleno: boolean, sub: string, opcional?: boolean }[] = [
    { k: 'nombre', t: 'Nombre', ic: 'editar', lleno: !!d.nombre.trim(), sub: d.nombre || 'Sin nombre' },
    { k: 'descripcion', t: 'Descripción', ic: 'nota', lleno: !!d.descripcion.trim(), sub: d.descripcion ? 'Escrita' : 'Vacía' },
    { k: 'items', t: 'Ítems', ic: 'lista', lleno: nItems > 0 && nItems === items.length, sub: items.length ? `${items.length} ítem${items.length === 1 ? '' : 's'}` : 'Ninguno' },
    { k: 'resolucion', t: 'Cómo se resuelve', ic: 'regla', lleno: !conBandas || (d.bandas || []).length > 0,
      sub: LOGICAS.find(l => l.id === d.logica)?.t + (conBandas && !(d.bandas || []).length ? ' · sin bandas' : '') },
    { k: 'lados', t: 'Lados', ic: 'cambio', lleno: true, sub: d.tipo_lado === 'lateral' ? 'Izq. / Der.' : 'Único' },
    { k: 'zona', t: 'Zona', ic: 'ubicacion', lleno: nZona > 0, sub: nZona ? `${nZona} puesta${nZona === 1 ? '' : 's'}` : 'Sin zona' },
    { k: 'imagen', t: 'Imagen y vídeo', ic: 'camara', opcional: true, lleno: !!(d.imagen_url || d.video_url), sub: d.imagen_url ? 'Con imagen' : d.video_url ? 'Con vídeo' : 'Nada' },
    { k: 'desaconseja', t: 'Desaconseja', ic: 'alerta', opcional: true, lleno: nBloq > 0, sub: nBloq ? `${nBloq} etiqueta${nBloq === 1 ? '' : 's'}` : 'Nada' },
  ]
  const paso = 360 / QUESITOS.length
  const necesarios = QUESITOS.filter(q => !q.opcional)
  const llenos = necesarios.filter(q => q.lleno).length

  async function subirImagen(id: string, file: File): Promise<string | null> {
    const ext = file.name.split('.').pop()
    const path = `tests/${id}/foto.${ext}`
    const { error } = await supabase.storage.from('fotos').upload(path, file, { upsert: true })
    if (error) { setAviso('Guardado, pero la imagen no: ' + error.message); return null }
    return supabase.storage.from('fotos').getPublicUrl(path).data.publicUrl + '?t=' + Date.now()
  }

  async function guardar() {
    if (!d.nombre.trim()) { setAviso('Falta el nombre'); setAbierto('nombre'); return }
    const problemas = problemasDelTest(d)
    if (problemas.length) { alert('El test no se ha guardado:\n\n' + problemas.map((x: string) => '· ' + x).join('\n')); return }
    setGuardando(true)
    const campos: any = {
      nombre: d.nombre.trim(), descripcion: d.descripcion, video_url: d.video_url, frecuencia_meses: d.frecuencia_meses, logica: d.logica,
      items: d.items || [], bandas: conBandas ? (d.bandas || []) : [], baremos: esBaremo(d) ? (d.baremos || []) : [],
      etiquetas_relacionadas: d.etiquetas_relacionadas || [], etiquetas_bloquea: d.etiquetas_bloquea || [], tipo_lado: d.tipo_lado || 'bilateral',
    }
    let id = d.id
    if (!id) {
      const { data, error } = await supabase.from('tests').insert({ ...campos, imagen_url: '' }).select('id').single()
      if (error || !data) { setGuardando(false); setAviso(error?.message || 'No se pudo crear'); return }
      id = data.id
    } else {
      // Si se quitan ítems de los que cuelgan objetivos, se avisa (como en la biblioteca).
      const { data: previo } = await supabase.from('tests').select('items,nombre').eq('id', id).maybeSingle()
      const plan = planDeItems(previo?.items || [], d.items || [])
      if (plan.borrados.length > 0) {
        const a = await alcanceItemsBorrados(id, plan)
        if ((a.objetivos.length > 0 || a.vias > 0) && !confirm(
          `Quitas ${plan.borrados.map((b: any) => `«${b.nombre}»`).join(', ')}.\n\n`
          + (a.objetivos.length ? `· Se comprobaban con él: ${a.objetivos.join(', ')}.\n` : '')
          + (a.vias ? `· ${a.vias} parte(s) de objetivo abiertas en ${a.pacientes} paciente(s) dependen de él y se quitan.\n` : '')
          + '\n¿Seguir?')) { setGuardando(false); return }
      }
      const { error } = await supabase.from('tests').update(campos).eq('id', id)
      if (error) { setGuardando(false); setAviso(error.message); return }
      const rp = await aplicarCambioDeItems(id, plan, d.nombre || previo?.nombre || '')
      if (rp.ok === false) setAviso('Guardado, pero no se han ajustado los objetivos de sus ítems: ' + rp.error)
    }
    if (d.imagen_file) {
      const url = await subirImagen(id, d.imagen_file)
      if (url) await supabase.from('tests').update({ imagen_url: url }).eq('id', id)
    } else if (d.id && !d.imagen_url && test?.imagen_url) {
      await supabase.from('tests').update({ imagen_url: '' }).eq('id', id)
    }
    setGuardando(false); setCambiado(false)
    setAviso(a => a || '✓ Guardado')
    setD((p: any) => ({ ...p, id, imagen_file: null }))
    onGuardado(id)
  }

  const editor = (k: Clave) => {
    if (k === 'nombre') return <input className="input" autoFocus value={d.nombre} onChange={e => set('nombre', e.target.value)} placeholder="ej. Lunge test, Thomas, FPI-6" style={{ fontSize: 15 }}/>
    if (k === 'descripcion') return (
      <textarea className="input" autoFocus value={d.descripcion} onChange={e => set('descripcion', e.target.value)}
        placeholder="Cómo se hace y qué se mira" style={{ minHeight: 180, lineHeight: 1.6, resize: 'vertical' }}/>
    )
    if (k === 'items') return (
      <>
        {esSuma(d) && <div style={{ fontSize: 11.5, color: 'var(--gr)', marginBottom: 8, lineHeight: 1.5 }}>Cada ítem aporta su puntuación y el total cae en una banda.</div>}
        {esBaremo(d) && <div style={{ fontSize: 11.5, color: 'var(--gr)', marginBottom: 8, lineHeight: 1.5 }}>Cada ítem se compara con su norma según sexo y edad.</div>}
        {items.map((item, i) => (
          <div key={i} style={{ marginBottom: 8, background: 'var(--bl)', borderRadius: 12, padding: '8px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <input className="input" value={item.nombre || ''} onChange={e => setItem(i, { nombre: e.target.value })} placeholder="ej. La rodilla no llega a 90°" style={{ flex: 1, fontSize: 12 }}/>
              <select className="input" value={unidadDe(item).id} style={{ width: 112, fontSize: 11.5, flexShrink: 0 }} onChange={e => setItem(i, { unidad: e.target.value })}>
                {UNIDADES.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
              <button onClick={() => set('items', items.filter((_, j) => j !== i))} style={{ fontSize: 12, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
            {!esBaremo(d) && <ConfigBarra item={item} soloRango={esSuma(d)} lateral={d.tipo_lado === 'lateral'} onCambia={(c: any) => setItem(i, c)}/>}
          </div>
        ))}
        <button className="btn btn-t btn-sm" onClick={() => set('items', [...items, { nombre: '', unidad: esSuma(d) ? 'puntos' : '' }])}>+ Añadir ítem</button>
      </>
    )
    if (k === 'resolucion') return (
      <>
        <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
          {LOGICAS.map(l => {
            const on = d.logica === l.id
            return (
              <div key={l.id} onClick={() => set('logica', l.id)} style={{ cursor: 'pointer', padding: '9px 12px', borderRadius: 12,
                background: on ? 'var(--gl)' : 'var(--bl)', border: `1.5px solid ${on ? 'var(--g)' : 'transparent'}` }}>
                <div style={{ fontSize: 13, color: on ? 'var(--gd)' : 'var(--n)' }}>{l.t}</div>
                <div style={{ fontSize: 11.5, color: 'var(--grl)' }}>{l.ayuda}</div>
              </div>
            )
          })}
        </div>
        {esBaremo(d) && <EditorBaremos baremos={d.baremos} items={items} onCambia={(b: any[]) => set('baremos', b)}/>}
        {conBandas && <EditorBandas bandas={d.bandas} items={items} porRecuento={esBaremo(d)} objetivos={objetivos} etiquetas={etiquetas} onCambia={(b: any[]) => set('bandas', b)}/>}
        <div className="field" style={{ marginTop: 10 }}>
          <label>Revisión cada (meses)</label>
          <input className="input" type="number" value={d.frecuencia_meses || 3} style={{ maxWidth: 120 }}
            onChange={e => set('frecuencia_meses', parseInt(e.target.value) || 3)}/>
        </div>
      </>
    )
    if (k === 'lados') return (
      <div style={{ display: 'grid', gap: 6 }}>
        {([['bilateral', 'Bilateral / único', 'Una sola medida'], ['lateral', 'Izquierdo / Derecho', 'Se mide cada lado y se comparan']] as const).map(([v, t, a]) => {
          const on = (d.tipo_lado || 'bilateral') === v
          return (
            <div key={v} onClick={() => set('tipo_lado', v)} style={{ cursor: 'pointer', padding: '10px 12px', borderRadius: 12,
              background: on ? 'var(--gl)' : 'var(--bl)', border: `1.5px solid ${on ? 'var(--g)' : 'transparent'}` }}>
              <div style={{ fontSize: 13, color: on ? 'var(--gd)' : 'var(--n)' }}>{t}</div>
              <div style={{ fontSize: 11.5, color: 'var(--grl)' }}>{a}</div>
            </div>
          )
        })}
      </div>
    )
    if (k === 'zona') return (
      <>
        <div style={{ fontSize: 12, color: 'var(--gr)', marginBottom: 8 }}>Por dónde se encuentra en la biblioteca.</div>
        <SelectorZona etiquetas={etiquetas} seleccionadas={d.etiquetas_relacionadas || []} onChange={(ids: string[]) => set('etiquetas_relacionadas', ids)}/>
      </>
    )
    if (k === 'imagen') return (
      <div>
        <div style={{ width: '100%', aspectRatio: '1', borderRadius: 16, overflow: 'hidden', background: 'var(--bl)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
          {d.imagen_url ? <img src={d.imagen_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <span style={{ color: 'var(--grl)' }}><Ic name="test" size={56}/></span>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <label className="btn btn-s btn-sm" style={{ cursor: 'pointer' }}>
            <Ic name="camara" size={12}/> {d.imagen_url ? 'Cambiar' : 'Subir'}
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) { set('imagen_file', f); set('imagen_url', URL.createObjectURL(f)) } }}/>
          </label>
          {d.imagen_url && <button className="btn btn-t btn-sm" onClick={() => { set('imagen_url', ''); set('imagen_file', null) }}>Quitar</button>}
        </div>
        <div className="field"><label>Enlace del vídeo</label>
          <input className="input" value={d.video_url} onChange={e => set('video_url', e.target.value)} placeholder="https://…"/>
        </div>
      </div>
    )
    return (
      <>
        <SelectorEtiquetasCompacto etiquetas={etiquetas} seleccionadas={d.etiquetas_bloquea || []} onChange={(ids: string[]) => set('etiquetas_bloquea', ids)}/>
        <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 8, lineHeight: 1.5 }}>
          Si sale positivo, los ejercicios con estas etiquetas saldrán avisados en el editor de sesión de ese paciente. No impide nada.
        </div>
      </>
    )
  }

  const q = QUESITOS.find(x => x.k === abierto)
  useEffect(() => { onCambiado?.(cambiado) }, [cambiado]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { onPanel?.(!!q) }, [!!q]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`rt ${q ? 'rt-abierto' : ''}`}>
      <style>{`
        .rt { position:relative }
        .rt-rosco { position:relative; aspect-ratio:1; flex-shrink:0; transition: width .5s ease }
        .rt-q { cursor:pointer; transform-box:view-box; transform-origin:300px 300px;
                transition: transform .22s ease, fill .2s ease; animation: rt-sale .55s cubic-bezier(.2,.9,.3,1.25) backwards }
        @keyframes rt-sale { from { transform: scale(.55) rotate(-25deg); opacity:0 } to { transform:none; opacity:1 } }
        .rt-et { position:absolute; transform:translate(-50%,-50%); text-align:center; pointer-events:none; width:92px; animation: rt-et .5s ease backwards }
        @keyframes rt-et { from { opacity:0 } to { opacity:1 } }
        .rt-panel { position:fixed; right:24px; top:110px; z-index:30; width:min(520px, 40vw); max-height:calc(100vh - 200px); overflow:auto; background:#fff; border-radius:20px; padding:18px 20px;
                    box-shadow:0 18px 44px rgba(38,40,37,.16); animation: rt-panel .4s cubic-bezier(.2,.9,.3,1.1) backwards }
        @keyframes rt-panel { from { opacity:0; transform: translateX(40px) scale(.96) } to { opacity:1; transform:none } }
      `}</style>

      <div className="rt-rosco" style={{ width: tam }}>
        <svg viewBox="0 0 600 600" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          {QUESITOS.map((x, i) => {
            const a0 = -90 + i * paso + HUECO, a1 = -90 + (i + 1) * paso - HUECO
            const mid = (a0 + a1) / 2 * Math.PI / 180
            const fuera = encima === x.k || abierto === x.k ? 10 : 0
            return (
              <path key={x.k} className="rt-q" d={quesito(a0, a1)}
                style={{ animationDelay: `${i * 50}ms`, transform: `translate(${Math.cos(mid) * fuera}px, ${Math.sin(mid) * fuera}px)` }}
                fill={abierto === x.k ? 'var(--g)' : x.lleno ? 'var(--gl)' : '#fff'} fillOpacity={x.opcional && !x.lleno && abierto !== x.k ? .6 : 1}
                stroke={x.lleno ? 'var(--gm)' : 'var(--bd)'} strokeWidth={1.2}
                onMouseEnter={() => setEncima(x.k)} onMouseLeave={() => setEncima(null)}
                onClick={() => setAbierto(abierto === x.k ? null : x.k)}/>
            )
          })}
        </svg>
        {QUESITOS.map((x, i) => {
          const mid = (-90 + (i + .5) * paso) * Math.PI / 180
          const r = (R0 + R1) / 2 / 600 * 100
          const on = abierto === x.k
          const fuera = encima === x.k || on ? 1.6 : 0
          return (
            <div key={x.k} className="rt-et" style={{ left: `${50 + Math.cos(mid) * (r + fuera)}%`, top: `${50 + Math.sin(mid) * (r + fuera)}%`,
              color: on ? '#fff' : x.lleno ? 'var(--gd)' : 'var(--gr)', animationDelay: `${300 + i * 50}ms` }}>
              <Ic name={x.ic} size={17}/>
              <div style={{ fontSize: 11.5, marginTop: 2, lineHeight: 1.15 }}>{x.t}</div>
              <div style={{ fontSize: 9.5, opacity: .75, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.sub}</div>
            </div>
          )
        })}
        {/* EL TEST: su imagen, o el disco arena del mapa. */}
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '50%', height: '50%', borderRadius: '50%', overflow: 'hidden',
          boxShadow: '0 10px 34px rgba(38,40,37,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7A5800',
          background: d.imagen_url ? 'var(--bl)' : 'radial-gradient(circle at 33% 28%, #fff 0%, #FBF1DC 35%, #E6CF8E 100%)' }}>
          {d.imagen_url ? <img src={d.imagen_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <Ic name="test" size={70}/>}
        </div>
      </div>

      {q && (
        <div key={q.k} className="rt-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'sticky', top: -18, zIndex: 3,
            background: '#fff', margin: '-18px -20px 12px', padding: '14px 20px 10px', borderRadius: '20px 20px 0 0', boxShadow: '0 6px 10px -8px rgba(38,40,37,.18)' }}>
            <span style={{ color: 'var(--g)', lineHeight: 0 }}><Ic name={q.ic} size={18}/></span>
            <span style={{ flex: 1, fontSize: 15 }}>{q.t}</span>
            <button className="btn btn-p btn-sm" onClick={() => setAbierto(null)}>Hecho</button>
          </div>
          {editor(q.k)}
        </div>
      )}

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 22, display: 'flex', justifyContent: 'center', zIndex: 20, pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 99,
          padding: '8px 10px 8px 18px', boxShadow: '0 12px 30px rgba(38,40,37,.18)' }}>
          <span style={{ fontSize: 12.5, color: aviso.startsWith('✓') ? 'var(--gd)' : aviso ? 'var(--red)' : 'var(--gr)' }}>
            {aviso || (!d.nombre.trim() ? 'Falta el nombre' : cambiado ? 'Sin guardar' : `${llenos} de ${necesarios.length} · todo guardado`)}
          </span>
          {onCerrar && <button className="btn btn-t btn-sm" onClick={() => { if (cambiado && !confirm('Hay cambios sin guardar. ¿Salir igualmente?')) return; onCerrar() }}>Cancelar</button>}
          <button className="btn btn-p btn-sm" disabled={guardando || !cambiado} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

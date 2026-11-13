'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { categoriaDe, zonasDe, casaZona } from '@/lib/etiquetas'
import FiltroCuerpo from '@/components/FiltroCuerpo'
import { conDescendientes } from '@/lib/etiquetas'
import BotonVista from '@/components/BotonVista'
import MonedaObjetivo from '@/components/MonedaObjetivo'
import { contiene } from '@/lib/texto'
import { especificosDeObjetivo, alcanceObjetivo, archivarObjetivo, borrarObjetivo } from '@/lib/objetivos'
import { conteoPorObjetivo, type Conteo } from '@/lib/objetivosTests'

/**
 * LA BIBLIOTECA DE OBJETIVOS: para MIRAR. Se ven en esferas, como en la ficha del
 * paciente, y al tocar una se abre abajo su panel con la información y cómo le va con
 * la gente. Crearlos y cambiarlos se hace en el torno (su rosco), que es donde se trabaja
 * el barro; aquí solo queda archivar, que el rosco no tiene.
 *
 * Antes eran tarjetas grandes («cromos») con editar y borrar en cada una.
 */

type Stats = { activos: number, logros: number, pct: number | null, dias: number | null }

const ORDENES = [
  { k: 'nombre', t: 'Nombre' },
  { k: 'activos', t: 'Personas activas' },
  { k: 'logros', t: 'Logros' },
  { k: 'pct', t: '% de éxito' },
  { k: 'dias', t: 'Tiempo hasta lograrlo' },
]

const dia = (s: any) => { const t = s ? Date.parse(String(s).slice(0, 10)) : NaN; return isNaN(t) ? null : t }

export default function ObjetivosTab({ objetivos, etiquetas = [], cargar }: any) {
  const router = useRouter()
  const [zona, setZona] = useState<string>('')
  const [busca, setBusca] = useState('')
  const [ver, setVer] = useState<'todos' | 'pendientes' | 'archivados'>('todos')
  const [orden, setOrden] = useState('nombre')
  const [sel, setSel] = useState<any>(null)
  const [evalua, setEvalua] = useState<Record<string, Conteo>>({})
  const [stats, setStats] = useState<Record<string, Stats>>({})
  const [archivados, setArchivados] = useState<any[]>([])
  // Lo que más se trabaja en el objetivo abierto: los ejercicios de sus sesiones.
  const [trabajo, setTrabajo] = useState<{ nombre: string, n: number }[] | null>(null)

  useEffect(() => {
    supabase.from('objetivos').select('*').eq('activo', true).not('archivado_el', 'is', null)
      .order('nombre').then(({ data }) => setArchivados(data || []))
  }, [objetivos])

  /* CÓMO LE VA CON LA GENTE, de pacientes_objetivos: abiertos ahora, logrados, % de éxito
     (logrados entre todos los que lo han tenido) y los días que se tarda de media en
     lograrlo (desde que se le puso hasta la fecha del logro). */
  useEffect(() => {
    supabase.from('pacientes_objetivos').select('*').then(({ data }) => {
      const acc: Record<string, { a: number, l: number, d: number[] }> = {}
      ;(data || []).forEach((p: any) => {
        const x = acc[p.objetivo_id] || (acc[p.objetivo_id] = { a: 0, l: 0, d: [] })
        if (p.logrado) {
          x.l++
          const ini = dia(p.created_at || p.fecha_inicio), fin = dia(p.fecha_logrado)
          if (ini != null && fin != null && fin >= ini) x.d.push((fin - ini) / 86400000)
        } else x.a++
      })
      const m: Record<string, Stats> = {}
      Object.entries(acc).forEach(([id, x]) => {
        m[id] = { activos: x.a, logros: x.l, pct: x.a + x.l > 0 ? Math.round(100 * x.l / (x.a + x.l)) : null,
          dias: x.d.length ? Math.round(x.d.reduce((s, v) => s + v, 0) / x.d.length) : null }
      })
      setStats(m)
    })
  }, [objetivos])

  useEffect(() => { conteoPorObjetivo().then(setEvalua) }, [objetivos])

  // Al abrir uno: sus sesiones y, de ellas, los ejercicios que más salen.
  useEffect(() => {
    setTrabajo(null)
    if (!sel) return
    ;(async () => {
      const { data: so } = await supabase.from('sesiones_objetivos').select('sesion_id').eq('objetivo_id', sel.id).limit(300)
      const ids = Array.from(new Set((so || []).map((r: any) => r.sesion_id)))
      if (!ids.length) { setTrabajo([]); return }
      const { data: ses } = await supabase.from('sesiones').select('id,partes').in('id', ids)
      const c: Record<string, number> = {}
      ;(ses || []).forEach((s: any) => (s.partes || []).forEach((p: any) => (p.ejercicios || []).forEach((e: any) => {
        if (e?.nombre) c[e.nombre] = (c[e.nombre] || 0) + 1
      })))
      setTrabajo(Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([nombre, n]) => ({ nombre, n })))
    })()
  }, [sel])

  const nombreEt = (id: string) => etiquetas.find((e: any) => e.id === id)?.nombre || ''
  /** Sus etiquetas de zona (articulación y libres), sin resolver a raíz. */
  const zonaIdsDe = (o: any) => [o?.articulacion_id, ...(o?.etiquetas || [])].filter(Boolean) as string[]
  const zonasUsadas = useMemo(() => {
    const ids = Array.from(new Set((objetivos || []).flatMap(zonaIdsDe))) as string[]
    return ids.filter(id => {
      const et = etiquetas.find((e: any) => e.id === id)
      return !!et && categoriaDe(etiquetas, et) === 'articulacion'
    })
  }, [objetivos, etiquetas]) // eslint-disable-line react-hooks/exhaustive-deps
  const sinZona = (objetivos || []).filter((o: any) => zonasDe(etiquetas, zonaIdsDe(o)).length === 0).length

  /** Sin nada con que medirlo no entra en ninguna evaluación: está a medias. */
  const porCompletar = (o: any) => { const ev = evalua[o.id]; return (ev?.tests || 0) + (ev?.cuestionarios || 0) === 0 }
  const vivos = (objetivos || []).filter((o: any) => o.archivado_el == null)
  const nPendientes = vivos.filter(porCompletar).length

  const [filtroEtO, setFiltroEtO] = useState<string[]>([])
  const [verFiltroO, setVerFiltroO] = useState(false)
  const base = (ver === 'archivados' ? archivados : vivos) as any[]
  /* EL FILTRO DEL CUERPO, el de Ejercicios, sobre su articulación, etiquetas y movimientos. */
  const etsDe = (o: any): string[] => [o.articulacion_id, ...(o.etiquetas || []), ...(o.movimientos || [])].filter(Boolean).map(String)
  const casaEtO = (o: any) => filtroEtO.length === 0 || filtroEtO.every(id => { const rama = conDescendientes(etiquetas, id); return etsDe(o).some(x => rama.includes(x)) })
  const st = (o: any): Stats => stats[o.id] || { activos: 0, logros: 0, pct: null, dias: null }
  const filtrados = base.filter((o: any) =>
    casaZona(etiquetas, zonaIdsDe(o), zona) && casaEtO(o) &&
    (ver !== 'pendientes' || porCompletar(o)) &&
    (contiene(o.nombre || '', busca) || contiene(o.descripcion || '', busca)))
    .sort((a: any, b: any) => {
      const A = st(a), B = st(b)
      if (orden === 'activos') return B.activos - A.activos
      if (orden === 'logros') return B.logros - A.logros
      if (orden === 'pct') return (B.pct ?? -1) - (A.pct ?? -1)
      // Lo que se logra antes, primero; los que no tienen dato, al final.
      if (orden === 'dias') return (A.dias ?? 1e9) - (B.dias ?? 1e9)
      return (a.nombre || '').localeCompare(b.nombre || '', 'es')
    })

  /** El dato que se pinta bajo cada esfera: el del orden elegido. */
  const datoBajo = (o: any) => {
    const s = st(o)
    if (orden === 'activos') return s.activos ? `${s.activos} activos` : ''
    if (orden === 'logros') return s.logros ? `${s.logros} logros` : ''
    if (orden === 'pct') return s.pct != null ? `${s.pct}% éxito` : ''
    if (orden === 'dias') return s.dias != null ? `${s.dias} días` : ''
    return ''
  }

  /** ARCHIVAR, y borrar de verdad solo lo que no ha tocado nadie (ver `alcanceObjetivo`). */
  async function retirar(o: any) {
    const a = await alcanceObjetivo(o.id)
    if (a.limpio) {
      if (!confirm(`Eliminar "${o.nombre}".\n\nNo lo lleva ningún paciente ni ninguna sesión, así que no se pierde nada.\n\nNo se puede deshacer.`)) return
      const r = await borrarObjetivo(o.id)
      if (r.ok === false) { alert('No se ha eliminado: ' + r.error); return }
      setSel(null); cargar(); return
    }
    const lineas = [`Archivar "${o.nombre}".`, '']
    if (a.pacientes > 0) lineas.push(`· ${a.pacientes} paciente${a.pacientes === 1 ? ' lo lleva' : 's lo llevan'}.`)
    if (a.sesiones > 0) lineas.push(`· ${a.sesiones} sesión${a.sesiones === 1 ? '' : 'es'} lo trabaja${a.sesiones === 1 ? '' : 'n'}.`)
    if (a.fases > 0) lineas.push(`· ${a.fases} fase${a.fases === 1 ? '' : 's'} de ciclo lo usa${a.fases === 1 ? '' : 'n'}.`)
    lineas.push('', 'Todo eso se queda como está. El objetivo desaparece de la biblioteca y no se le podrá poner a nadie más.')
    if (!confirm(lineas.join('\n'))) return
    const r = await archivarObjetivo(o.id, true)
    if (r.ok === false) { alert('No se ha archivado: ' + r.error); return }
    setSel(null); cargar()
  }
  async function desarchivar(o: any) {
    const r = await archivarObjetivo(o.id, false)
    if (r.ok === false) { alert('No se ha podido: ' + r.error); return }
    setSel(null); cargar()
  }

  /** EL PANEL DEL OBJETIVO, debajo de las esferas (como en la ficha). */
  function panel(o: any) {
    const movs = especificosDeObjetivo(etiquetas, o.movimientos).map((e: any) => e.nombre)
    const ev = evalua[o.id] || { tests: 0, cuestionarios: 0 }
    const s = st(o)
    const Kpi = ({ v, t }: { v: string, t: string }) => (
      <div style={{ minWidth: 92 }}>
        <div style={{ fontSize: 20, color: 'var(--n)', lineHeight: 1.1 }}>{v}</div>
        <div style={{ fontSize: 11, color: 'var(--grl)' }}>{t}</div>
      </div>
    )
    return (
      <div className="card" style={{ marginTop: 14, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
          <MonedaObjetivo objetivo={o} tam="g"/>
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <div style={{ fontSize: 17, color: 'var(--n)' }}>
              {o.nombre}{o.articulacion_id && <span style={{ fontSize: 12.5, color: 'var(--gr)', marginLeft: 8 }}>{nombreEt(o.articulacion_id)}</span>}
            </div>
            {o.descripcion && <div style={{ fontSize: 12.5, color: 'var(--gr)', lineHeight: 1.5, marginTop: 4, whiteSpace: 'pre-wrap' }}>{o.descripcion}</div>}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ver === 'archivados'
              ? <button className="btn-vista" onClick={() => desarchivar(o)}><Ic name="recuperar" size={14}/> Recuperar</button>
              : <>
                  <button className="btn-vista" onClick={() => router.push(`/torno/mapa/objetivo/${o.id}`)} title="Se cambia en el torno"><Ic name="editar" size={14}/> Editar en el torno</button>
                  <button className="btn-vista" style={{ color: 'var(--red)' }} onClick={() => retirar(o)} title="Archivar o eliminar"><Ic name="papelera" size={14}/></button>
                </>}
            <button className="btn-vista" onClick={() => setSel(null)} title="Cerrar"><Ic name="cerrar" size={14}/></button>
          </div>
        </div>

        {/* CÓMO LE VA CON LA GENTE */}
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', margin: '14px 0 4px', padding: '10px 0', borderTop: '1px solid var(--bl)', borderBottom: '1px solid var(--bl)' }}>
          <Kpi v={String(s.activos)} t="personas activas"/>
          <Kpi v={String(s.logros)} t="logros"/>
          <Kpi v={s.pct != null ? `${s.pct}%` : '—'} t="de éxito"/>
          <Kpi v={s.dias != null ? `${s.dias} días` : '—'} t="hasta lograrlo (media)"/>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16, marginTop: 10 }}>
          <div>
            {movs.length > 0 && <>
              <div className="et-mini" style={{ marginBottom: 5 }}>Objetivos específicos</div>
              <div style={{ borderLeft: '2px solid var(--gm)', paddingLeft: 9, marginBottom: 10 }}>
                {movs.map((m: string) => <div key={m} style={{ fontSize: 12.5, color: 'var(--gr)', padding: '1px 0' }}>{m}</div>)}
              </div>
            </>}
            {(o.etiquetas || []).length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                {(o.etiquetas || []).map((id: string) => <span key={id} className="pill pill-soft">{nombreEt(id)}</span>)}
              </div>
            )}
            <div className="et-mini" style={{ marginBottom: 5 }}>Con qué se comprueba</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {ev.tests > 0 && <span className="pill pill-o on">◎ {ev.tests} test{ev.tests === 1 ? '' : 's'}</span>}
              {ev.cuestionarios > 0 && <span className="pill pill-o on">✎ {ev.cuestionarios} cuestionario{ev.cuestionarios === 1 ? '' : 's'}</span>}
              {ev.tests === 0 && ev.cuestionarios === 0 && <span className="pill" style={{ background: 'var(--ambl)', border: '1px solid var(--amb)', color: '#7A5800' }}>por completar</span>}
            </div>
          </div>
          <div>
            <div className="et-mini" style={{ marginBottom: 5 }}>Lo que más se trabaja</div>
            {trabajo === null ? <div className="muted">Cargando…</div>
              : trabajo.length === 0 ? <div className="muted">Ninguna sesión lo trabaja todavía.</div>
              : trabajo.map(t => (
                <div key={t.nombre} style={{ display: 'flex', gap: 8, fontSize: 12.5, padding: '2px 0' }}>
                  <span style={{ flex: 1, color: 'var(--n)' }}>{t.nombre}</span>
                  <span style={{ color: 'var(--grl)' }}>{t.n} sesión{t.n === 1 ? '' : 'es'}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="panel">
      <div className="sec">
        <div className="sec-h">
          <span className="sh-l"><span className="ct-l"><Ic name="objetivo" size={13} /> Objetivos</span></span>
          <span className="sh-r">{filtrados.length === base.length ? `${base.length} en total` : `${filtrados.length} de ${base.length}`} · se crean y cambian en el torno</span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <input className="input" style={{ maxWidth: 300 }} value={busca} onChange={ev => setBusca(ev.target.value)} placeholder="Buscar objetivo…"/>
          {/* El orden, como en Ejercicios: un toque, el siguiente. */}
          <BotonVista icono="reloj" ciclo valor={orden} onChange={setOrden} opciones={ORDENES} titulo="Ordenar los objetivos"/>
          <button type="button" className={`chip-sel ${filtroEtO.length ? 'on' : ''}`} onClick={() => setVerFiltroO(true)}>
            Filtros{filtroEtO.length ? ` · ${filtroEtO.length}` : ''}</button>
          {verFiltroO && <FiltroCuerpo etiquetas={etiquetas} valor={filtroEtO} onChange={setFiltroEtO} textoCerrar="Ver objetivos"
            nResultado={filtrados.length} unidad={['objetivo', 'objetivos']} onCerrar={() => setVerFiltroO(false)}/>}
          <BotonVista valor={ver} onChange={k => { setVer(k as any); setSel(null) }} titulo="Todos, por completar o archivados"
            opciones={[{ k: 'todos', t: 'Todos' }, { k: 'pendientes', t: 'Por completar', n: nPendientes }, { k: 'archivados', t: 'Archivados', n: archivados.length }]}/>
        </div>

        {filtrados.length === 0 ? (
          <div className="muted">{base.length === 0 ? 'Sin objetivos todavía.' : 'Ninguno coincide.'}</div>
        ) : (
          /* EN ESFERAS, como en la ficha: la foto (o la inicial) y el nombre debajo. */
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px 10px' }}>
            {filtrados.map((o: any) => {
              const d = datoBajo(o)
              return (
                <button key={o.id} type="button" onClick={() => setSel(sel?.id === o.id ? null : o)}
                  style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 92, border: 'none', background: 'none', cursor: 'pointer', padding: 4, borderRadius: 12,
                    outline: sel?.id === o.id ? '2px solid var(--g)' : 'none', fontFamily: 'inherit' }}>
                  <MonedaObjetivo objetivo={o}/>
                  <span className="obj-mon-g" style={{ fontSize: 11, color: 'var(--n)' }}>{o.nombre}</span>
                  {d && <span style={{ fontSize: 10.5, color: 'var(--gd)' }}>{d}</span>}
                </button>
              )
            })}
          </div>
        )}

        {sel && panel(sel)}
      </div>
    </div>
  )
}

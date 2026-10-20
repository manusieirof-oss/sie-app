'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { traerTodo } from '@/lib/paginar'
import { textoSegundos } from '@/lib/trabajo'
import { useConfigTrabajo } from '@/components/TrabajoEjercicio'
import { ZONAS, indices, calcularMapa, cargaSemanal, type Registro } from '@/lib/mapaTrabajo'
import { RAMPA, colorCalor } from '@/lib/rampaCalor'
import type { MapaCalor3D } from '@/lib/anim3d/mapaCalor'

/**
 * MAPA DE TRABAJO del paciente (Resultados › Mapa).
 *
 * El cuerpo girando con cada zona teñida por su parte del trabajo hecho en la sala.
 * Arriba se filtra por periodo, intensidad y ejecución; tocar una zona la acerca y
 * enseña su reparto por movimiento, intención y ejercicios. La capa "combinada" suma
 * también lo que el ejercicio mueve de forma secundaria (a medio peso).
 * El icono de la carga abre minutos por semana, tonelaje y aviso de pico.
 */

const PERIODOS: [string, string, number | null][] = [['4s', '4 semanas', 28], ['3m', '3 meses', 91], ['6m', '6 meses', 182], ['todo', 'Todo', null]]

export default function MapaTrabajo({ pacienteId }: { pacienteId: string }) {
  const cfg = useConfigTrabajo()
  const [periodo, setPeriodo] = useState('3m')
  const [regs, setRegs] = useState<Registro[] | null>(null)
  const [ejs, setEjs] = useState<Record<string, any>>({})
  const [ets, setEts] = useState<any[]>([])
  const [fInt, setFInt] = useState<string[]>([])
  const [fEje, setFEje] = useState<string[]>([])
  const [combinada, setCombinada] = useState(false)
  const [zona, setZona] = useState<string | null>(null)
  const [encima, setEncima] = useState<string | null>(null)
  const [verCarga, setVerCarga] = useState(false)
  const [fallo, setFallo] = useState('')

  // Todo lo anotado del paciente (paginado) y los ejercicios que salen en ello.
  useEffect(() => {
    let vivo = true
    ;(async () => {
      const [{ filas }, et] = await Promise.all([
        traerTodo((d, h) => supabase.from('registros_ejercicio').select('fecha,ejercicio_id,series,regimen,sesion_id').eq('paciente_id', pacienteId).order('id').range(d, h)),
        supabase.from('etiquetas').select('id,nombre,categoria,padre_id'),
      ])
      const ids = Array.from(new Set((filas || []).map((r: any) => r.ejercicio_id).filter(Boolean)))
      const mapa: Record<string, any> = {}
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await supabase.from('ejercicios').select('id,nombre,trabajo,anatomia,tipo_medida').in('id', ids.slice(i, i + 200))
        ;(data || []).forEach((e: any) => { mapa[e.id] = e })
      }
      if (!vivo) return
      setEts(et.data || []); setEjs(mapa); setRegs(filas || [])
    })()
    return () => { vivo = false }
  }, [pacienteId])

  const idx = useMemo(() => indices(ets), [ets])
  const enPeriodo = useMemo(() => {
    const dias = PERIODOS.find(p => p[0] === periodo)?.[2]
    if (!regs) return []
    if (!dias) return regs
    const desde = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10)
    return regs.filter(r => r.fecha >= desde)
  }, [regs, periodo])
  const m = useMemo(() => calcularMapa(enPeriodo, ejs, idx, cfg, { int: fInt, eje: fEje, combinada }), [enPeriodo, ejs, idx, cfg, fInt, fEje, combinada])
  const carga = useMemo(() => cargaSemanal(regs || [], ejs, cfg), [regs, ejs, cfg])

  const enZonas = Object.values(m.zonas).reduce((n, z) => n + z.seg, 0)
  const ranking = ZONAS.map(z => ({ z, seg: m.zonas[z.k]?.seg || 0 })).filter(x => x.seg > 0).sort((a, b) => b.seg - a.seg)
  const pct = (s: number, de = enZonas) => (de ? Math.round(s / de * 100) : 0)

  // ── El cuerpo ──
  const caja = useRef<HTMLDivElement>(null)
  const visor = useRef<MapaCalor3D | null>(null)
  const [listo, setListo] = useState(false)
  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const { crearMapaCalor } = await import('@/lib/anim3d/mapaCalor')
        if (!caja.current) return
        const v = await crearMapaCalor(caja.current, { zona: k => setZona(k), encima: k => setEncima(k) })
        if (!vivo) { v.destruir(); return }
        visor.current = v; setListo(true)
      } catch (e: any) { setFallo(e?.message || 'No se pudo abrir el cuerpo 3D') }
    })()
    return () => { vivo = false; visor.current?.destruir(); visor.current = null }
  }, [])
  useEffect(() => {
    if (!visor.current) return
    const maxZ = Math.max(0, ...Object.values(m.zonas).map(z => z.seg))
    const maxM = Math.max(0, ...Object.values(m.musculos))
    const zonas: Record<string, any> = {}
    ZONAS.forEach(z => { const s = m.zonas[z.k]?.seg || 0; if (s > 0) zonas[z.k] = { v: s / maxZ, huesos: z.huesos, off: z.off } })
    visor.current.poner({ zonas, musculos: Object.fromEntries(Object.entries(m.musculos).map(([k, s]) => [k, maxM ? s / maxM : 0])) })
  }, [m, listo])
  useEffect(() => { visor.current?.enfocar(zona) }, [zona, listo])

  // ── Piezas ──
  const nombreEt = (id: string) => id === 'sin' ? 'Sin movimiento' : (idx.porId[id]?.nombre || '—')
  const int = (id: string) => cfg.intensidades.find(i => i.id === id)
  const eje = (id: string) => cfg.ejecuciones.find(i => i.id === id)
  const chip = (on: boolean, color?: string): React.CSSProperties => ({
    fontSize: 11.5, padding: '3px 10px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
    border: `1.5px solid ${on ? (color || 'var(--n)') : 'var(--bd)'}`, background: on ? (color || 'var(--n)') : '#fff', color: on ? '#fff' : 'var(--gr)',
  })
  const barras = (o: Record<string, number>, nombre: (k: string) => string, color: (k: string) => string, total: number, max = 8) => {
    const l = Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, max)
    if (!l.length) return <div style={{ fontSize: 12, color: 'var(--grl)' }}>—</div>
    return l.map(([k, s]) => (
      <div key={k} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 38px', gap: 8, alignItems: 'center', fontSize: 12, marginBottom: 4 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre(k)}</span>
        <span style={{ height: 7, borderRadius: 9, background: 'var(--bl)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${pct(s, total)}%`, background: color(k) }}/></span>
        <span style={{ textAlign: 'right', color: 'var(--gr)' }}>{pct(s, total)}%</span>
      </div>
    ))
  }
  // Ejecución y movimiento en gris: el verde ya es el cuerpo y los cálidos son el calor y
  // las intensidades; con otro color de barra se confundían.
  const titulo = (t: string) => <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--grl)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '14px 0 6px' }}>{t}</div>

  const Z = zona ? m.zonas[zona] : null
  const zDef = ZONAS.find(z => z.k === zona)

  return (
    <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(38,40,37,.07)', padding: 16 }}>
      {/* Periodo, capa y carga */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        {PERIODOS.map(([k, t]) => <button key={k} type="button" style={chip(periodo === k)} onClick={() => setPeriodo(k)}>{t}</button>)}
        <span style={{ width: 10 }}/>
        <button type="button" style={chip(!combinada)} onClick={() => setCombinada(false)} title="Solo lo principal (★) de cada ejercicio">Principal</button>
        <button type="button" style={chip(combinada)} onClick={() => setCombinada(true)} title="También lo secundario, a medio peso">Combinada</button>
        <span style={{ flex: 1 }}/>
        <div style={{ position: 'relative' }}>
          <button type="button" onClick={() => setVerCarga(!verCarga)} title="Carga de trabajo"
            style={{ border: '1px solid var(--bd)', background: carga.pico ? '#FDEDE8' : '#fff', borderRadius: 99, width: 30, height: 30, cursor: 'pointer', display: 'grid', placeItems: 'center', color: carga.pico ? '#C0392B' : 'var(--gr)' }}>
            <Ic name="progreso" size={14}/>
          </button>
          {verCarga && <PanelCarga carga={carga} onCerrar={() => setVerCarga(false)}/>}
        </div>
      </div>
      {/* Filtros de intención */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        {cfg.intensidades.map(i => <button key={i.id} type="button" style={chip(fInt.includes(i.id), i.color)} onClick={() => setFInt(fInt.includes(i.id) ? fInt.filter(x => x !== i.id) : [...fInt, i.id])}>{i.nombre}</button>)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10, alignItems: 'center' }}>
        {cfg.ejecuciones.map(e => <button key={e.id} type="button" style={chip(fEje.includes(e.id))} onClick={() => setFEje(fEje.includes(e.id) ? fEje.filter(x => x !== e.id) : [...fEje, e.id])}>{e.nombre}</button>)}
        {(fInt.length > 0 || fEje.length > 0) && <button type="button" className="btn btn-t btn-sm" onClick={() => { setFInt([]); setFEje([]) }}>Quitar filtros</button>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16, alignItems: 'start' }}>
        {/* El cuerpo */}
        <div>
          <div ref={caja} style={{ position: 'relative', height: 500, borderRadius: 14, background: '#fff', overflow: 'hidden' }}>
            {(!listo || regs === null) && !fallo && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 12, color: 'var(--grl)' }}>Cargando…</div>}
            {fallo && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 12, color: 'var(--grl)' }}>{fallo}</div>}
            {encima && !zona && <div style={{ position: 'absolute', top: 10, left: 10, fontSize: 12, background: 'var(--n)', color: '#fff', padding: '3px 9px', borderRadius: 99 }}>
              {ZONAS.find(z => z.k === encima)?.n} · {pct(m.zonas[encima]?.seg || 0)}%</div>}
            {zona && <button type="button" className="btn btn-s btn-sm" style={{ position: 'absolute', top: 10, left: 10 }} onClick={() => setZona(null)}>← Todo el cuerpo</button>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--grl)', marginTop: 6 }}>
            Menos <span style={{ flex: 1, height: 6, borderRadius: 9, background: `linear-gradient(90deg,${RAMPA.join(',')})` }}/> Más
          </div>
        </div>

        {/* El reparto */}
        <div>
          {regs !== null && m.total === 0 && <div style={{ fontSize: 13, color: 'var(--grl)', padding: '20px 0' }}>Nada anotado en la sala en este periodo{fInt.length || fEje.length ? ' con estos filtros' : ''}.</div>}
          {!Z && m.total > 0 && <>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              <Dato n={textoSegundos(m.total)} t="de trabajo"/>
              <Dato n={String(m.sesiones)} t="sesiones"/>
              {m.liberacion > 0 && <Dato n={textoSegundos(m.liberacion)} t="liberación"/>}
            </div>
            {m.estimado > 0 && <div style={{ fontSize: 11.5, color: 'var(--grl)', marginTop: 4 }}>{pct(m.estimado, m.total)}% estimado ("aguanta lo que puedas" sin tiempo apuntado)</div>}
            {m.sinAnatomia > 0 && <div style={{ fontSize: 11.5, color: '#8A6410', marginTop: 4 }}>{textoSegundos(m.sinAnatomia)} de ejercicios sin anatomía: no salen en el cuerpo</div>}
            {titulo('Por zona · toca una para verla')}
            {ranking.map(({ z, seg }) => (
              <button key={z.k} type="button" onClick={() => setZona(z.k)}
                style={{ display: 'grid', gridTemplateColumns: '1fr 140px 38px', gap: 8, alignItems: 'center', width: '100%', border: 'none', background: encima === z.k ? 'var(--bl)' : 'transparent', borderRadius: 8, padding: '4px 6px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, textAlign: 'left' }}>
                <span>{z.n}</span>
                <span style={{ height: 8, borderRadius: 9, background: 'var(--bl)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${pct(seg)}%`, background: colorCalor(0.25 + 0.75 * seg / (ranking[0]?.seg || 1)) }}/></span>
                <span style={{ textAlign: 'right', fontWeight: 600 }}>{pct(seg)}%</span>
              </button>
            ))}
            {titulo('Intención')}
            {barras(m.porInt, k => int(k)?.nombre || 'Sin intensidad', k => int(k)?.color || '#bbb', m.total)}
            {titulo('Ejecución')}
            {barras(m.porEje, k => eje(k)?.nombre || k, () => '#9A9C97', m.total)}
          </>}
          {Z && zDef && <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{zDef.n}</div>
              <div style={{ fontSize: 22, color: colorCalor(0.8) }}>{pct(Z.seg)}%</div>
              <div style={{ fontSize: 12, color: 'var(--grl)' }}>{textoSegundos(Z.seg)}</div>
            </div>
            {Object.keys(Z.porArt).length > 1 && <>{titulo('Articulación')}{barras(Z.porArt, nombreEt, () => 'var(--gd)', Z.seg)}</>}
            {titulo('Movimiento')}
            {barras(Z.porMov, nombreEt, () => '#6E716C', Z.seg)}
            {titulo('Intención')}
            {barras(Z.porInt, k => int(k)?.nombre || 'Sin intensidad', k => int(k)?.color || '#bbb', Z.seg)}
            {titulo('Ejecución')}
            {barras(Z.porEje, k => eje(k)?.nombre || k, () => '#9A9C97', Z.seg)}
            {titulo('Ejercicios que más aportan')}
            {barras(Z.porEj, k => ejs[k]?.nombre || '—', () => 'var(--gl)', Z.seg, 6)}
          </>}
        </div>
      </div>
    </div>
  )
}

function Dato({ n, t }: { n: string, t: string }) {
  return <div><div style={{ fontSize: 20, fontWeight: 600, color: 'var(--n)' }}>{n}</div><div style={{ fontSize: 11, color: 'var(--grl)' }}>{t}</div></div>
}

/** La carga, discreta: minutos por semana, tonelaje y aviso si la última sube mucho. */
function PanelCarga({ carga, onCerrar }: { carga: ReturnType<typeof cargaSemanal>, onCerrar: () => void }) {
  const max = Math.max(1, ...carga.min)
  const sem = carga.min.map((v, i) => ({ v, kg: carga.kg[i], t: i === 0 ? 'Esta' : `-${i}` })).reverse()
  return (
    <div style={{ position: 'absolute', right: 0, top: 36, zIndex: 20, width: 280, background: '#fff', borderRadius: 14, boxShadow: '0 8px 30px rgba(0,0,0,.15)', padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <b style={{ fontSize: 13 }}>Carga semanal</b>
        <button type="button" className="btn btn-t btn-sm" onClick={onCerrar} style={{ padding: '1px 6px' }}><Ic name="cerrar" size={10}/></button>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
        {sem.map((s, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }} title={`${s.v} min · ${s.kg} kg`}>
            <div style={{ height: Math.max(2, s.v / max * 64), background: i === sem.length - 1 ? (carga.pico ? '#E4572E' : 'var(--g)') : 'var(--gl)', borderRadius: 4 }}/>
            <div style={{ fontSize: 10, color: 'var(--grl)', marginTop: 3 }}>{s.t}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, marginTop: 8, lineHeight: 1.6 }}>
        Esta semana: <b>{carga.min[0]} min</b>{carga.kg[0] ? ` · ${carga.kg[0].toLocaleString('es-ES')} kg movidos` : ''}<br/>
        Media de las 4 anteriores: {carga.media} min
      </div>
      {carga.pico && <div style={{ fontSize: 12, color: '#C0392B', marginTop: 6 }}>Sube un {Math.round((carga.ratio! - 1) * 100)}% sobre su media: ojo con el pico de carga.</div>}
    </div>
  )
}

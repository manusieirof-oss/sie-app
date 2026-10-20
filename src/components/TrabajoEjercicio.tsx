'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { categoriaDe } from '@/lib/etiquetas'
import { CLAVE_AJUSTE, leerConfigTrabajo, type ConfigTrabajo } from '@/lib/trabajo'

/**
 * LO QUE TRABAJA UN EJERCICIO, en su ficha.
 *
 *  · `trabajo` = { int: [ids], eje: [ids] }: las intensidades que ADMITE y cómo se
 *    ejecuta (de Ajustes › Entrenador). No es "su" intensidad: en fuerza la pone la
 *    dosis del día (3 reps = fuerza máxima, 15 = fuerza-resistencia). Esto solo dice
 *    cuáles se le pueden asignar, para que el generador no pida fuerza máxima a un
 *    estiramiento: primero elige zonas, luego ejercicios y luego reparte intensidades.
 *  · `anatomia` = { acc: [{a, m, p}], mus: [{u, p}] }: parejas articulación + movimiento
 *    y músculos, cada uno principal (p) o secundario. Con etiquetas sueltas no se sabía
 *    qué movimiento era de qué articulación; el mapa de calor lo necesita.
 */

export interface TrabajoEj { int: string[], eje: string[] }
export interface Accion { a: string, m: string | null, p: boolean }
export interface MusculoEj { u: string, p: boolean }
export interface AnatomiaEj { acc: Accion[], mus: MusculoEj[] }

export const trabajoVacio = (): TrabajoEj => ({ int: [], eje: [] })
export const anatomiaVacia = (): AnatomiaEj => ({ acc: [], mus: [] })
export function trabajoDe(ej: any): TrabajoEj {
  const t = ej?.trabajo || {}
  return { int: Array.isArray(t.int) ? t.int : [], eje: Array.isArray(t.eje) ? t.eje : [] }
}
export function anatomiaDe(ej: any): AnatomiaEj {
  const a = ej?.anatomia || {}
  return { acc: Array.isArray(a.acc) ? a.acc : [], mus: Array.isArray(a.mus) ? a.mus : [] }
}
/** Ids de etiqueta que salen de la anatomía (para tenerlas también en `etiquetas`). */
export function idsAnatomia(a: AnatomiaEj): string[] {
  return Array.from(new Set([...a.acc.map(x => x.a), ...a.acc.map(x => x.m).filter(Boolean) as string[], ...a.mus.map(x => x.u)]))
}

/** La configuración del entrenador, leída una vez de ajustes. */
export function useConfigTrabajo(): ConfigTrabajo {
  const [cfg, setCfg] = useState<ConfigTrabajo>(() => leerConfigTrabajo(null))
  useEffect(() => {
    supabase.from('ajustes').select('clave,valor').eq('clave', CLAVE_AJUSTE).maybeSingle()
      .then(({ data }) => { if (data) setCfg(leerConfigTrabajo({ [CLAVE_AJUSTE]: data.valor || '' })) })
  }, [])
  return cfg
}

/** Etiquetas de una categoría con su ruta ("Hombro › Glenohumeral"), ordenadas. */
function opcionesDe(etiquetas: any[], cat: string) {
  const porId: Record<string, any> = {}
  etiquetas.forEach(e => { porId[e.id] = e })
  const ruta = (e: any) => { const r: string[] = []; let x = e; const v = new Set(); while (x && !v.has(x.id)) { v.add(x.id); r.unshift(x.nombre); x = porId[x.padre_id] } return r.join(' › ') }
  return etiquetas.filter(e => categoriaDe(etiquetas, e) === cat).map(e => ({ id: e.id, txt: ruta(e) })).sort((a, b) => a.txt.localeCompare(b.txt, 'es'))
}

const chip = (on: boolean, color?: string): React.CSSProperties => ({
  fontSize: 12, padding: '3px 10px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit',
  border: `1.5px solid ${on ? (color || 'var(--g)') : 'var(--bd)'}`, background: on ? (color || 'var(--g)') : 'var(--w)', color: on ? '#fff' : 'var(--gr)',
})

/* ---------------------------------------------------------------- editores */

export function EditorTrabajo({ valor, onChange, cfg, disabled }: { valor: TrabajoEj, onChange: (v: TrabajoEj) => void, cfg: ConfigTrabajo, disabled?: boolean }) {
  const tog = (k: 'int' | 'eje', id: string) => onChange({ ...valor, [k]: valor[k].includes(id) ? valor[k].filter(x => x !== id) : [...valor[k], id] })
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div>
        <div style={{ fontSize: 11, color: 'var(--grl)', marginBottom: 4 }}>Admite (intensidades que se le pueden asignar; el día lo decide la dosis)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {cfg.intensidades.map(i => <button type="button" key={i.id} disabled={disabled} style={chip(valor.int.includes(i.id), i.color)} onClick={() => tog('int', i.id)}>{i.nombre}</button>)}
          {/* Atajo: un ejercicio con carga admite todos los tramos de fuerza. */}
          <button type="button" disabled={disabled} className="btn btn-t btn-sm" style={{ fontSize: 11 }}
            onClick={() => onChange({ ...valor, int: Array.from(new Set([...valor.int, ...cfg.intensidades.filter(i => i.familia === 'fuerza').map(i => i.id)])) })}>+ toda la fuerza</button>
        </div>
      </div>
      {(['fuerza', 'estiramiento'] as const).map(g => (
        <div key={g}>
          <div style={{ fontSize: 11, color: 'var(--grl)', marginBottom: 4 }}>Ejecución{g === 'estiramiento' ? ' · estiramiento' : ''} (se pueden combinar)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {cfg.ejecuciones.filter(e => e.grupo === g).map(e => <button type="button" key={e.id} disabled={disabled} style={chip(valor.eje.includes(e.id))} onClick={() => tog('eje', e.id)}>{e.nombre}</button>)}
          </div>
        </div>
      ))}
    </div>
  )
}

export function EditorAnatomia({ valor, onChange, etiquetas, disabled }: { valor: AnatomiaEj, onChange: (v: AnatomiaEj) => void, etiquetas: any[], disabled?: boolean }) {
  const arts = useMemo(() => opcionesDe(etiquetas, 'articulacion'), [etiquetas])
  const movs = useMemo(() => opcionesDe(etiquetas, 'movimiento'), [etiquetas])
  const muss = useMemo(() => opcionesDe(etiquetas, 'musculo'), [etiquetas])
  const sel: React.CSSProperties = { fontSize: 12.5, padding: '4px 6px', minWidth: 0 }
  const estrella = (on: boolean, fn: () => void) => (
    <button type="button" disabled={disabled} onClick={fn} title={on ? 'Principal (toca para secundario)' : 'Secundario (toca para principal)'}
      style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: on ? '#d9a21b' : 'var(--bd)', padding: '0 2px', lineHeight: 1 }}>★</button>
  )
  const quitar = (fn: () => void) => <button type="button" className="btn btn-t btn-sm" disabled={disabled} onClick={fn} style={{ padding: '2px 6px' }} title="Quitar"><Ic name="cerrar" size={10}/></button>
  const updA = (i: number, p: Partial<Accion>) => onChange({ ...valor, acc: valor.acc.map((x, j) => j === i ? { ...x, ...p } : x) })
  const updU = (i: number, p: Partial<MusculoEj>) => onChange({ ...valor, mus: valor.mus.map((x, j) => j === i ? { ...x, ...p } : x) })
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div>
        <div style={{ fontSize: 11, color: 'var(--grl)', marginBottom: 4 }}>Articulación + movimiento · ★ principal</div>
        <div style={{ display: 'grid', gap: 4 }}>
          {valor.acc.map((x, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr auto', gap: 4, alignItems: 'center' }}>
              {estrella(x.p, () => updA(i, { p: !x.p }))}
              <select className="input" style={sel} value={x.a} disabled={disabled} onChange={e => updA(i, { a: e.target.value })}>
                {arts.map(o => <option key={o.id} value={o.id}>{o.txt}</option>)}
              </select>
              <select className="input" style={sel} value={x.m || ''} disabled={disabled} onChange={e => updA(i, { m: e.target.value || null })}>
                <option value="">Sin movimiento</option>
                {movs.map(o => <option key={o.id} value={o.id}>{o.txt}</option>)}
              </select>
              {quitar(() => onChange({ ...valor, acc: valor.acc.filter((_, j) => j !== i) }))}
            </div>
          ))}
          <button type="button" className="btn btn-s btn-sm" disabled={disabled || !arts.length} style={{ justifySelf: 'start' }}
            onClick={() => onChange({ ...valor, acc: [...valor.acc, { a: valor.acc[valor.acc.length - 1]?.a || arts[0].id, m: null, p: false }] })}>+ Articulación</button>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--grl)', marginBottom: 4 }}>Músculos · ★ principal</div>
        <div style={{ display: 'grid', gap: 4 }}>
          {valor.mus.map((x, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 4, alignItems: 'center' }}>
              {estrella(x.p, () => updU(i, { p: !x.p }))}
              <select className="input" style={sel} value={x.u} disabled={disabled} onChange={e => updU(i, { u: e.target.value })}>
                {muss.map(o => <option key={o.id} value={o.id}>{o.txt}</option>)}
              </select>
              {quitar(() => onChange({ ...valor, mus: valor.mus.filter((_, j) => j !== i) }))}
            </div>
          ))}
          <button type="button" className="btn btn-s btn-sm" disabled={disabled || !muss.length} style={{ justifySelf: 'start' }}
            onClick={() => onChange({ ...valor, mus: [...valor.mus, { u: muss[0].id, p: false }] })}>+ Músculo</button>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- vista */

/** Resumen en la ficha: intensidades, ejecución y qué trabaja, lo principal en negrita. */
export function ResumenTrabajo({ ej, etiquetas, cfg }: { ej: any, etiquetas: any[], cfg: ConfigTrabajo }) {
  const t = trabajoDe(ej), a = anatomiaDe(ej)
  const nom = (id: string | null) => etiquetas.find(e => e.id === id)?.nombre || ''
  const ints = t.int.map(id => cfg.intensidades.find(i => i.id === id)).filter(Boolean) as any[]
  const ejes = t.eje.map(id => cfg.ejecuciones.find(i => i.id === id)).filter(Boolean) as any[]
  // Agrupado por articulación: "Rodilla: Flexión, **Extensión**".
  const grupos: { a: string, p: boolean, movs: { m: string | null, p: boolean }[] }[] = []
  a.acc.forEach(x => {
    let g = grupos.find(y => y.a === x.a)
    if (!g) { g = { a: x.a, p: false, movs: [] }; grupos.push(g) }
    g.p = g.p || x.p; if (x.m) g.movs.push({ m: x.m, p: x.p })
  })
  grupos.sort((x, y) => Number(y.p) - Number(x.p))
  const mus = [...a.mus].sort((x, y) => Number(y.p) - Number(x.p))
  if (!ints.length && !ejes.length && !grupos.length && !mus.length) return null
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="et-mini" style={{ marginBottom: 6 }}>Qué trabaja</div>
      {(ints.length > 0 || ejes.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {ints.length > 0 && <span style={{ fontSize: 11, color: 'var(--grl)', alignSelf: 'center' }}>Admite</span>}
          {ints.map(i => <span key={i.id} style={{ fontSize: 11.5, padding: '2px 9px', borderRadius: 99, background: i.color, color: '#fff' }}>{i.nombre}</span>)}
          {ejes.map(e => <span key={e.id} style={{ fontSize: 11.5, padding: '2px 9px', borderRadius: 99, border: '1px solid var(--bd)', color: 'var(--gr)' }}>{e.nombre}</span>)}
        </div>
      )}
      {grupos.map(g => (
        <div key={g.a} style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--n)' }}>
          <span style={{ fontWeight: g.p ? 600 : 400 }}>{nom(g.a)}</span>
          <span style={{ color: 'var(--gr)' }}>: </span>
          {g.movs.length ? g.movs.map((m, k) => <span key={k} style={{ fontWeight: m.p ? 600 : 300 }}>{k ? ', ' : ''}{nom(m.m)}</span>) : <span style={{ color: 'var(--grl)', fontWeight: 300 }}>sin movimiento</span>}
        </div>
      ))}
      {mus.length > 0 && (
        <div style={{ fontSize: 12, marginTop: 4, color: 'var(--gr)' }}>
          Músculos: {mus.map((m, k) => <span key={k} style={{ fontWeight: m.p ? 600 : 300, color: m.p ? 'var(--n)' : undefined }}>{k ? ', ' : ''}{nom(m.u)}</span>)}
        </div>
      )}
    </div>
  )
}

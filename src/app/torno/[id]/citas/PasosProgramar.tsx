'use client'
import { DIAS_LARGOS, type ModoReparto } from '@/lib/repartir'
import { Ic } from '@/lib/icons'
import type { EstadoReparto } from './RepartirPanel'

// ---------------------------------------------------------------------------
// PROGRAMAR EN TRES PASOS (maqueta «Programar sesiones · maqueta», nov 2026).
//
//   1. Elige sus sesiones, en orden: cada una con su letra (A, B…) y su color; con las
//      flechas se cambia cuál va primero. Un ciclo entra con todas sus sesiones.
//   2. Cómo se turnan: alternando, por día o por bloques; desde cuándo y hasta cuándo.
//   3. Así quedaría: una franja fina con sus próximas citas, cada casilla del color de
//      su sesión. Se ve al momento, sin pulsar nada; tocar una casilla la cambia a mano.
//
// Nada se guarda hasta «Ponerlo en sus citas». La cuenta del reparto es lib/repartir.
// ---------------------------------------------------------------------------

type Ses = { id: string, nombre: string, color: string, ciclo?: string, fase?: string, partes?: any[] }
type Ciclo = { id: string, nombre: string, color: string, fases: any[] }
type Cita = { id: string, fecha: string, hora: string | null }

export const LETRAS = 'ABCDEFGHIJKL'

export default function PasosProgramar(p: {
  sesiones: Ses[], ciclos: Ciclo[], citas: Cita[]
  rot: string[], setRot: (f: (r: string[]) => string[]) => void
  rep: EstadoReparto, setRep: (f: (r: EstadoReparto) => EstadoReparto) => void
  plan: Record<string, string | null>, original: Record<string, string | null>, aMano: Record<string, string | null>
  esFija: (c: Cita) => boolean
  ultimaVez: (sesId: string) => string | null
  diasConCitas: number[], hoy: string
  onCita: (c: Cita) => void
  onLimpiar: () => void, onPoner: () => void, guardando: boolean, hayCambios: boolean
  planTexto: React.ReactNode
}) {
  const { sesiones, rot, rep } = p
  const letra = (id: string) => rot.includes(id) ? LETRAS[rot.indexOf(id)] : ''
  const color = (id: string | null) => sesiones.find(s => s.id === id)?.color
  const mover = (id: string, d: number) => p.setRot(r => { const a = [...r], i = a.indexOf(id), j = i + d; if (i < 0 || j < 0 || j >= a.length) return r; [a[i], a[j]] = [a[j], a[i]]; return a })
  const chip = (on: boolean) => `pp-chip ${on ? 'on' : ''}`
  const nom = (id: string) => sesiones.find(s => s.id === id)?.nombre || '—'
  const cambian = p.citas.filter(c => (p.plan[c.id] || null) !== (p.original[c.id] || null)).length

  // La frase de lo que va a hacer, en palabras.
  const desdeTxt = rep.desde ? `Desde el ${new Date(rep.desde + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}: ` : ''
  const frase = !rot.length ? 'Elige al menos una sesión.'
    : rep.modo === 'dias' ? p.diasConCitas.map((d, i) => `los ${DIAS_LARGOS[d].toLowerCase()}, ${nom(rot[i % rot.length])}`).join(' y ') + '.'
    : rep.modo === 'bloques' ? rot.map(nom).join(', luego ') + `: ${rep.semanas} semanas cada una, y vuelta a empezar.`
    : rot.length === 1 ? `${nom(rot[0])} en todas las citas.`
    : rot.map(id => `${letra(id)} ${nom(id)}`).join(' → ') + ' → y vuelta a empezar' + (rep.cada > 1 ? `, cambiando cada ${rep.cada} citas.` : '.')

  const grupos = [...p.ciclos.map(c => ({ ciclo: c as Ciclo | null, ses: sesiones.filter(s => s.ciclo === c.id) })),
    ...(sesiones.some(s => !s.ciclo) ? [{ ciclo: null as Ciclo | null, ses: sesiones.filter(s => !s.ciclo) }] : [])]

  return (
    <div className="pp">
      <div className="pp-dos">
        {/* 1 · SUS SESIONES */}
        <section className="pp-card">
          <div className="pp-paso"><i>1</i><h2>Elige sus sesiones, en orden</h2></div>
          <p className="pp-ayuda">Tócalas en el orden en que quieres que vayan. Con las flechas cambias cuál va primero.</p>
          {grupos.map((g, gi) => (
            <div key={gi}>
              {g.ciclo && (() => {
                const c = g.ciclo!, suyas = g.ses.map(s => s.id), todas = suyas.length > 0 && suyas.every(id => rot.includes(id))
                return (
                  <button type="button" className="pp-ses" onClick={() => p.setRot(r => todas ? r.filter(x => !suyas.includes(x)) : [...r.filter(x => !suyas.includes(x)), ...suyas])}
                    style={{ border: `2px solid ${c.color}`, background: todas ? c.color : c.color + '12', color: todas ? '#fff' : 'var(--n)', width: '100%' }}>
                    <span className="pp-chapa" style={{ background: todas ? '#fff' : c.color, color: todas ? c.color : '#fff' }}>C</span>
                    <span className="pp-txt"><b>Ciclo · {c.nombre}</b><small style={{ color: todas ? 'rgba(255,255,255,.85)' : undefined }}>{c.fases.length} fase{c.fases.length === 1 ? '' : 's'} · entran todas sus sesiones; cada una solo en las fechas de su fase</small></span>
                  </button>
                )
              })()}
              {g.ses.map(s => {
                const on = rot.includes(s.id)
                const n = (s.partes || []).reduce((t: number, x: any) => t + (x.ejercicios || []).length, 0)
                const ult = p.ultimaVez(s.id)
                return (
                  <div key={s.id} className="pp-ses" style={on ? { border: `2px solid ${s.color}`, background: s.color + '12' } : undefined}>
                    <button type="button" className="pp-toca" onClick={() => p.setRot(r => on ? r.filter(x => x !== s.id) : [...r, s.id])} aria-pressed={on}>
                      <span className="pp-chapa" style={on ? { background: s.color, color: '#fff' } : undefined}>{on ? letra(s.id) : '+'}</span>
                      <span className="pp-txt"><b>{s.nombre}</b>
                        <small>{n} ejercicio{n === 1 ? '' : 's'}{s.fase ? ` · ${s.fase}` : ''}{ult ? ` · hecha el ${ult}` : ' · sin estrenar'}</small></span>
                    </button>
                    {on && <>
                      <span className="pp-puesto">{rot.indexOf(s.id) + 1}º</span>
                      <button type="button" className="pp-fl" aria-label="Subir" onClick={() => mover(s.id, -1)}><Ic name="arriba" size={14}/></button>
                      <button type="button" className="pp-fl" aria-label="Bajar" onClick={() => mover(s.id, 1)}><Ic name="abajo" size={14}/></button>
                    </>}
                  </div>
                )
              })}
            </div>
          ))}
          {sesiones.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No tiene sesiones. Créalas en el torno.</div>}
        </section>

        {/* 2 · CÓMO SE TURNAN */}
        <section className="pp-card">
          <div className="pp-paso" style={{ marginBottom: 12 }}><i>2</i><h2>Cómo se turnan</h2></div>
          <div className="pp-modos">
            {([['alternar', 'Alternando', 'una tras otra'], ['dias', 'Por día', 'cada día la suya'], ['bloques', 'Por bloques', 'unas semanas cada una']] as [ModoReparto, string, string][]).map(([k, t, sub]) => (
              <button key={k} type="button" className={chip(rep.modo === k)} onClick={() => p.setRep(r => ({ ...r, modo: k }))}><b>{t}</b><small>{sub}</small></button>
            ))}
          </div>
          {/* SIEMPRE UNA FILA AQUÍ, sea cual sea el modo: así la página no salta al cambiarlo. */}
          {rep.modo === 'dias' && <div className="pp-fila pp-fija"><span>Cada día de la semana, su sesión (en el orden de arriba).</span></div>}
          {rep.modo === 'alternar' && <div className="pp-fila pp-fija"><span>Cambia de sesión</span>
            {[[1, 'en cada cita'], [2, 'cada 2 citas'], [3, 'cada 3']].map(([v, t]) => <button key={v} type="button" className={chip(rep.cada === v)} onClick={() => p.setRep(r => ({ ...r, cada: Number(v) }))}>{t}</button>)}</div>}
          {rep.modo === 'bloques' && <div className="pp-fila pp-fija"><span>Cada sesión durante</span>
            {[2, 4, 6].map(v => <button key={v} type="button" className={chip(rep.semanas === v)} onClick={() => p.setRep(r => ({ ...r, semanas: v }))}>{v} semanas</button>)}</div>}
          <div className="pp-fila"><span>Desde</span>
            <button type="button" className={chip(!rep.desde)} onClick={() => p.setRep(r => ({ ...r, desde: '' }))}>su próxima cita</button>
            <label className={chip(!!rep.desde)}>una fecha <input type="date" min={p.hoy} value={rep.desde || ''} onChange={e => p.setRep(r => ({ ...r, desde: e.target.value }))}/></label>
          </div>
          <div className="pp-fila pp-fija"><span>Hasta</span>
            {([['todas', 'todas sus citas'], ['semanas', 'unas semanas'], ['fecha', 'una fecha']] as const).map(([k, t]) => (
              <button key={k} type="button" className={chip(rep.hasta.tipo === k)} onClick={() => p.setRep(r => ({ ...r, hasta: { ...r.hasta, tipo: k } }))}>{t}</button>))}
            {rep.hasta.tipo === 'semanas' && <input type="number" min={1} value={rep.hasta.semanas || 4} style={{ width: 64 }} onChange={e => p.setRep(r => ({ ...r, hasta: { ...r.hasta, semanas: Math.max(1, Number(e.target.value) || 1) } }))}/>}
            {rep.hasta.tipo === 'fecha' && <input type="date" min={p.hoy} value={rep.hasta.fecha || ''} onChange={e => p.setRep(r => ({ ...r, hasta: { ...r.hasta, fecha: e.target.value } }))}/>}
          </div>
          <label className="pp-pisar"><input type="checkbox" checked={rep.pisar} onChange={e => p.setRep(r => ({ ...r, pisar: e.target.checked }))}/> Cambiar también las que ya tienen otra sesión (nunca las de candado)</label>
          <div className="pp-frase">{desdeTxt}{frase}</div>
          <div className="pp-plan">{p.planTexto}</div>
        </section>
      </div>

      {/* 3 · ASÍ QUEDARÍA: la franja fina */}
      <section className="pp-card pp-tira-c">
        <div className="pp-tira-cab">
          <div className="pp-paso" style={{ margin: 0 }}><i>3</i><h2 style={{ fontSize: 15 }}>Así quedaría</h2></div>
          <span className="pp-cuenta">
            {rot.map(id => <span key={id}><b style={{ color: color(id) }}>{letra(id)}</b> {p.citas.filter(c => p.plan[c.id] === id).length} · </span>)}
            {cambian ? `${cambian} cambian` : 'nada cambia'} · toca una para cambiarla
          </span>
          <button type="button" className="btn btn-s btn-sm" onClick={p.onLimpiar}>Limpiar</button>
          <button type="button" className="btn btn-p btn-sm" disabled={p.guardando || !p.hayCambios} onClick={p.onPoner}>{p.guardando ? 'Guardando…' : 'Ponerlo en sus citas'}</button>
        </div>
        <div className="pp-tira">
          {p.citas.map(c => {
            const sid = p.plan[c.id] || null, col = color(sid), fija = p.esFija(c), antes = !!rep.desde && c.fecha < rep.desde
            const l = sid ? (letra(sid) || (sesiones.find(s => s.id === sid)?.nombre || '?')[0]) : '·'
            return (
              <button key={c.id} type="button" className="pp-cita" onClick={() => { if (!antes) p.onCita(c) }}
                title={`${new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}${c.hora ? ' · ' + String(c.hora).slice(0, 5) : ''}${sid ? ' · ' + nom(sid) : ' · sin sesión'}${fija ? ' · con candado' : ''}`}
                style={{ background: col || (sid ? 'var(--gm)' : '#fff'), borderColor: col || 'var(--bd)', opacity: antes ? .35 : 1,
                  boxShadow: c.id in p.aMano ? 'inset 0 0 0 2px var(--n)' : undefined }}>
                <b style={{ color: col || sid ? '#fff' : 'var(--grl)' }}>{l}</b>
                <span style={{ color: col || sid ? 'rgba(255,255,255,.9)' : 'var(--grl)' }}>{Number(c.fecha.slice(8))}</span>
                {(p.plan[c.id] || null) !== (p.original[c.id] || null) && <i className="pp-pt"/>}
                {fija && <i className="pp-cand"><Ic name="candado" size={8}/></i>}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}

export const CSS_PASOS = `
  .pp { max-width:1500px; margin:0 auto 18px; display:flex; flex-direction:column; gap:14px }
  .pp-dos { display:flex; flex-wrap:wrap; gap:14px; align-items:stretch }
  .pp-dos > .pp-card { flex:1 1 400px; min-width:0 }
  .pp-card { background:#fff; border:1px solid var(--bd); border-radius:16px; padding:16px 18px }
  .pp-paso { display:flex; align-items:center; gap:10px; margin-bottom:4px }
  .pp-paso i { font-style:normal; width:24px; height:24px; border-radius:99px; background:var(--n); color:#fff; display:inline-flex; align-items:center; justify-content:center; font-size:12px; font-weight:600; flex-shrink:0 }
  .pp-paso h2 { margin:0; font-size:16px; font-weight:600; color:var(--n) }
  .pp-ayuda { margin:0 0 12px 34px; font-size:12.5px; color:var(--gr) }
  .pp-ses { display:flex; align-items:center; gap:8px; border:1px dashed var(--bd); background:var(--bl); border-radius:12px; padding:8px 10px; margin-bottom:7px; text-align:left; font-family:inherit; cursor:pointer }
  .pp-toca { flex:1; min-width:0; display:flex; align-items:center; gap:11px; border:0; background:none; padding:0; text-align:left; cursor:pointer; font-family:inherit; color:var(--n) }
  .pp-chapa { flex-shrink:0; width:32px; height:32px; border-radius:99px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700; background:#EDEAE3; color:var(--grl) }
  .pp-txt { display:flex; flex-direction:column; min-width:0 }
  .pp-txt b { font-size:14px; font-weight:600 }
  .pp-txt small { font-size:12px; color:var(--gr) }
  .pp-puesto { font-size:12.5px; font-weight:600; color:var(--gr) }
  .pp-fl { width:30px; height:30px; border-radius:8px; border:1px solid var(--bd); background:#fff; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; color:var(--n) }
  .pp-modos { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px }
  .pp-modos .pp-chip { border-radius:12px; padding:10px; text-align:left; display:flex; flex-direction:column; gap:1px }
  .pp-modos .pp-chip b { font-size:13.5px } .pp-modos .pp-chip small { font-size:11.5px; opacity:.8 }
  .pp-chip { border:1px solid var(--bd); background:#fff; color:var(--n); border-radius:99px; padding:6px 12px; font-size:12.5px; cursor:pointer; font-family:inherit; display:inline-flex; align-items:center; gap:6px }
  .pp-chip.on { background:var(--n); border-color:var(--n); color:#fff }
  .pp-chip input { border:0; background:transparent; color:inherit; font:inherit; font-size:12.5px }
  .pp-fila { display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin-top:10px; font-size:12.5px; color:var(--gr) }
  .pp-fila input[type=number], .pp-fila > input[type=date] { border:1px solid var(--bd); border-radius:8px; padding:5px 8px; font-family:inherit }
  .pp-pisar { display:flex; gap:6px; align-items:flex-start; margin-top:10px; font-size:12px; color:var(--gr) }
  .pp-fija { min-height:32px }
  .pp-plan { min-height:118px }
  .pp-frase { min-height:56px; margin-top:12px; background:var(--gl); color:var(--gd); border-radius:10px; padding:9px 12px; font-size:13px }
  .pp-tira-c { padding:12px 18px }
  .pp-tira-cab { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:8px }
  .pp-cuenta { flex:1; font-size:12.5px; color:var(--gr) }
  .pp-tira { display:grid; grid-template-columns:repeat(auto-fill,minmax(40px,1fr)); gap:3px }
  .pp-cita { position:relative; border:1px solid var(--bd); border-radius:6px; padding:3px 0 2px; display:flex; flex-direction:column; align-items:center; cursor:pointer; font-family:inherit }
  .pp-cita b { font-size:13px; line-height:1.2 } .pp-cita span { font-size:10px }
  .pp-pt { position:absolute; top:2px; right:2px; width:6px; height:6px; border-radius:99px; background:#fff; box-shadow:0 0 0 1.5px var(--n) }
  .pp-cand { position:absolute; bottom:1px; left:2px; color:#fff; line-height:0 }
`

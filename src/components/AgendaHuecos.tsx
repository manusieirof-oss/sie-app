'use client'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { horasDeAgenda } from '@/lib/generarHoras'
import { parseTiposClase } from '@/lib/tipos'
import { festivoDe } from '@/lib/festivos'
import { crearCitasPlan } from '@/lib/citas'
import { hoyISO } from '@/lib/fechas'

// ---------------------------------------------------------------------------
// AGENDA DE HUECOS. Lo que hace falta al dar citas a alguien (tras la valoracion, o
// desde el torno): ver de un vistazo donde hay sitio y marcarlo. Nada mas.
//
// Una semana: dias en columnas, horas en filas. Cada casilla dice cuantas plazas
// quedan en cada sala. Se tocan las que se quieren (se marcan), se elige si se repite
// cada semana, y "Poner N citas". Usa lo mismo que la agenda (bono, sin repetir cita a
// la misma hora). Las clases llenas en semanas siguientes se saltan y se dice.
// ---------------------------------------------------------------------------

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const lunesDe = (f: string) => { const d = new Date(f + 'T12:00:00'); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return d.toISOString().slice(0, 10) }
const masDias = (f: string, n: number) => { const d = new Date(f + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const corta = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

/** Un hueco preferido: dia de la semana (0 = lunes), hora y sala. `espera` = estaba lleno: "si queda sitio". */
export type HuecoPref = { dia: number, hora: string, sala: string, espera?: boolean }

/** Dia cerrado (festivo o cierre de Ajustes): devuelve el motivo, o '' si se abre. */
export function cerradoEn(f: string, eventos: any[]) {
  if (festivoDe(f)) return festivoDe(f)!.nombre
  const ev = (eventos || []).find((e: any) => (e.tipo === 'cierre' || e.tipo === 'festivo') && (e.anual
    ? f.slice(5) >= e.fecha_inicio.slice(5) && f.slice(5) <= (e.fecha_fin || e.fecha_inicio).slice(5)
    : f >= e.fecha_inicio && f <= (e.fecha_fin || e.fecha_inicio)))
  return ev ? (ev.titulo || 'Cerrado') : ''
}

/**
 * PONER LAS CITAS de unos huecos, repetidas N semanas. Lo usa la rejilla y la
 * valoracion al guardar. Las clases llenas o los dias cerrados se saltan y se dice;
 * lo demas (bono, no repetir hora) lo hace crearCitasPlan como en la agenda.
 */
export async function agendarHuecos(pacienteId: string, base: { fecha: string, hora: string, sala: string }[], semanas: number, tipoClase?: string) {
  const { data } = await supabase.from('ajustes').select('clave,valor').in('clave', ['clinica_max_personas_sala', 'eventos_calendario', 'tipos_clase'])
  const m: Record<string, string> = Object.fromEntries((data || []).map((x: any) => [x.clave, x.valor || '']))
  const max = parseInt(m.clinica_max_personas_sala || '6') || 6
  let eventos: any[] = []; try { const e = JSON.parse(m.eventos_calendario || '[]'); if (Array.isArray(e)) eventos = e } catch {}
  let tipoPac = tipoClase || ''
  if (!tipoPac) { const { data: p } = await supabase.from('pacientes').select('tipo_clase').eq('id', pacienteId).maybeSingle(); tipoPac = (p as any)?.tipo_clase || '' }
  const tipo = parseTiposClase(m.tipos_clase).find((t: any) => t.valor === tipoPac)

  const pedidos = base.flatMap(b => Array.from({ length: semanas }, (_, w) => ({ ...b, fecha: masDias(b.fecha, 7 * w) })))
  const fs = Array.from(new Set(pedidos.map(p => p.fecha)))
  const c2: Record<string, number> = {}
  for (let i = 0; i < fs.length; i += 100) {
    const { data: otras } = await supabase.from('citas').select('fecha,hora,sala').in('fecha', fs.slice(i, i + 100)).neq('estado', 'cancelada')
    ;(otras || []).forEach((c: any) => { const k = `${c.fecha}|${String(c.hora).slice(0, 5)}|${c.sala}`; c2[k] = (c2[k] || 0) + 1 })
  }
  const libres = pedidos.filter(p => (c2[`${p.fecha}|${p.hora}|${p.sala}`] || 0) < max && !cerradoEn(p.fecha, eventos))
  const saltadas = pedidos.length - libres.length
  const r = await crearCitasPlan(libres, { pacienteId, hora: libres[0]?.hora || '10:00', ...(tipo ? { tipo: tipo.valor, duracionMin: tipo.duracion } : {}) })
  if (r.ok === false) return { ok: false as const, creadas: r.creadas, texto: 'Error: ' + r.error + (r.creadas ? ` (se pusieron ${r.creadas})` : '') }
  const texto = `✓ ${r.creadas} cita${r.creadas === 1 ? '' : 's'} puesta${r.creadas === 1 ? '' : 's'}`
    + (saltadas ? ` · ${saltadas} saltada${saltadas === 1 ? '' : 's'} por clase llena o cerrado` : '')
    + (r.yaTenia ? ` · ${r.yaTenia} ya las tenía` : '')
    + (r.sinBono ? ` · ${r.sinBono} fuera del bono` : '')
  return { ok: true as const, creadas: r.creadas, texto }
}

/** De los huecos preferidos (dia de la semana) a la primera fecha de cada uno desde mañana. */
export function primerasFechas(huecos: HuecoPref[]) {
  const hoy = hoyISO()
  const lunes = lunesDe(hoy)
  return huecos.filter(h => !h.espera).map(h => {
    let f = masDias(lunes, h.dia)
    if (f <= hoy) f = masDias(f, 7)
    return { fecha: f, hora: h.hora, sala: h.sala }
  })
}

/** Meses → semanas de citas (un mes son 4 semanas y pico). */
export const semanasDeMeses = (m: number) => Math.round(m * 4.35)

/**
 * MODO PREFERENCIA (valoracion): aun no hay paciente o no se le dan citas todavia. Se
 * marcan las horas que le vienen bien; si una esta llena tambien se puede marcar, y
 * queda como "si queda hueco, esta". Al ponerle las citas, salen ya marcadas.
 */
export default function AgendaHuecos({ pacienteId, nombre, onCambio, preferencia, onPreferencia, preMarcadas }: {
  pacienteId?: string, nombre?: string, onCambio?: (n: number) => void,
  preferencia?: HuecoPref[], onPreferencia?: (v: HuecoPref[]) => void, preMarcadas?: HuecoPref[],
}) {
  const modoPref = !!onPreferencia
  const hoy = hoyISO()
  const [lunes, setLunes] = useState(lunesDe(hoy))
  const [cfg, setCfg] = useState<{ horas: string[], salas: string[], max: number, eventos: any[], tipos: any[] } | null>(null)
  const [tipoPac, setTipoPac] = useState<string>('')
  const [citas, setCitas] = useState<any[]>([])
  const [sala, setSala] = useState('')
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [semanas, setSemanas] = useState(1)
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.from('ajustes').select('clave,valor').then(({ data }) => {
      const m: Record<string, string> = Object.fromEntries((data || []).map((x: any) => [x.clave, x.valor || '']))
      let salas = ['A', 'B']; try { const s = JSON.parse(m.clinica_salas || ''); if (Array.isArray(s) && s.length) salas = s } catch {}
      let eventos: any[] = []; try { const e = JSON.parse(m.eventos_calendario || '[]'); if (Array.isArray(e)) eventos = e } catch {}
      setCfg({ horas: horasDeAgenda(m), salas, max: parseInt(m.clinica_max_personas_sala || '6') || 6, eventos, tipos: parseTiposClase(m.tipos_clase) })
    })
    if (pacienteId) supabase.from('pacientes').select('tipo_clase').eq('id', pacienteId).maybeSingle().then(({ data }) => setTipoPac((data as any)?.tipo_clase || ''))
  }, [pacienteId])
  // Lo que prefirio en la valoracion sale ya marcado (en la semana que se ve, si cabe).
  useEffect(() => {
    if (!preMarcadas?.length) return
    setMarcadas(new Set(preMarcadas.map(p => `${masDias(lunes, p.dia)}|${p.hora}|${p.sala}`)))
    setSemanas(12)
  }, [lunes]) // eslint-disable-line react-hooks/exhaustive-deps

  const fechas = useMemo(() => DIAS.map((_, i) => masDias(lunes, i)), [lunes])
  async function cargar() {
    const { data } = await supabase.from('citas').select('fecha,hora,sala,paciente_id')
      .gte('fecha', fechas[0]).lte('fecha', fechas[5]).neq('estado', 'cancelada')
    setCitas(data || [])
  }
  useEffect(() => { cargar() }, [lunes]) // eslint-disable-line react-hooks/exhaustive-deps

  const cuenta = useMemo(() => {
    const m: Record<string, number> = {}
    citas.forEach(c => { const k = `${c.fecha}|${String(c.hora).slice(0, 5)}|${c.sala}`; m[k] = (m[k] || 0) + 1 })
    return m
  }, [citas])
  const suyas = useMemo(() => new Set(pacienteId ? citas.filter(c => c.paciente_id === pacienteId).map(c => `${c.fecha}|${String(c.hora).slice(0, 5)}`) : []), [citas, pacienteId])
  const prefKey = (dia: number, h: string, s: string) => (preferencia || []).find(p => p.dia === dia && p.hora === h && p.sala === s)
  function alternarPref(dia: number, h: string, s: string, llena: boolean) {
    const ya = prefKey(dia, h, s)
    onPreferencia!(ya ? (preferencia || []).filter(p => p !== ya) : [...(preferencia || []), { dia, hora: h, sala: s, ...(llena ? { espera: true } : {}) }])
  }

  const cerrado = (f: string) => cerradoEn(f, cfg?.eventos || [])

  const alternar = (k: string) => { setMsg(''); setMarcadas(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n }) }

  async function poner() {
    if (!marcadas.size || !cfg || !pacienteId) return
    setOcupado(true); setMsg('')
    const base = Array.from(marcadas).map(k => { const [fecha, hora, s] = k.split('|'); return { fecha, hora, sala: s } })
    const res = await agendarHuecos(pacienteId, base, semanas)
    setOcupado(false)
    if (res.ok === false) { setMsg(res.texto); return }
    setMarcadas(new Set())
    setMsg(res.texto)
    cargar(); onCambio?.(res.creadas)
  }

  if (!cfg) return <div className="ah-nota">Cargando la agenda…</div>
  const salasVer = sala ? [sala] : cfg.salas
  return (
    <div className="ah">
      <style>{CSS}</style>
      <div className="ah-cab">
        <button className="ah-fl" onClick={() => setLunes(masDias(lunes, -7))} disabled={lunes <= lunesDe(hoy)}>‹</button>
        <b>Semana del {corta(fechas[0])}</b>
        <button className="ah-fl" onClick={() => setLunes(masDias(lunes, 7))}>›</button>
        <span style={{ flex: 1 }}/>
        {cfg.salas.length > 1 && (
          <div className="ah-seg">
            <button className={!sala ? 'on' : ''} onClick={() => setSala('')}>Todas</button>
            {cfg.salas.map(s => <button key={s} className={sala === s ? 'on' : ''} onClick={() => setSala(s)}>Sala {s}</button>)}
          </div>
        )}
      </div>
      <div className="ah-rej" style={{ gridTemplateColumns: `52px repeat(6, minmax(0,1fr))` }}>
        <div/>
        {fechas.map((f, i) => <div key={f} className={`ah-dia ${f === hoy ? 'hoy' : ''}`}>{DIAS[i]} <span>{new Date(f + 'T12:00:00').getDate()}</span></div>)}
        {cfg.horas.map(h => (
          <Fragment key={h}>
            <div className="ah-hora">{h}</div>
            {fechas.map(f => {
              const pasado = f < hoy, cer = cerrado(f), ya = suyas.has(`${f}|${h}`)
              return (
                <div key={f + h} className="ah-cel">
                  {ya ? <span className="ah-ya">✓ Ya viene</span>
                    : pasado ? <span className="ah-off">·</span>
                    : cer ? <span className="ah-off" title={cer}>Cerrado</span>
                    : salasVer.map(s => {
                      const n = cuenta[`${f}|${h}|${s}`] || 0, lib = cfg.max - n, k = `${f}|${h}|${s}`
                      if (modoPref) {
                        const dia = fechas.indexOf(f), pr = prefKey(dia, h, s)
                        return (
                          <button key={s} className={`ah-b ${pr ? (pr.espera ? 'espera' : 'on') : lib <= 0 ? 'llena' : lib <= 2 ? 'poca' : ''}`}
                            title={lib <= 0 ? `Sala ${s} llena: tócala si le gustaría esta hora en cuanto quede sitio` : `Sala ${s}: ${n} de ${cfg.max}`}
                            onClick={() => alternarPref(dia, h, s, lib <= 0)}>
                            {pr ? (pr.espera ? '⏳ ' : '✓ ') : ''}{salasVer.length > 1 ? s + ' ' : ''}{pr?.espera ? 'si hay' : lib <= 0 ? 'llena' : lib}
                          </button>
                        )
                      }
                      const on = marcadas.has(k)
                      return (
                        <button key={s} disabled={lib <= 0 && !on} className={`ah-b ${on ? 'on' : lib <= 0 ? 'llena' : lib <= 2 ? 'poca' : ''}`}
                          title={`Sala ${s}: ${n} de ${cfg.max}`} onClick={() => alternar(k)}>
                          {on ? '✓ ' : ''}{salasVer.length > 1 ? s + ' ' : ''}{lib <= 0 ? 'llena' : lib}
                        </button>
                      )
                    })}
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
      {modoPref ? (
        <div className="ah-pie">
          <span className="ah-nota">Toca las horas que le vienen bien (se repiten cada semana). Si una está llena, tócala igual: queda como <b>⏳ si hay hueco</b>.</span>
          <span style={{ flex: 1 }}/>
          {(preferencia || []).length > 0 && <button className="btn btn-t btn-sm" onClick={() => onPreferencia!([])}>Quitar todas</button>}
        </div>
      ) : (
      <div className="ah-pie">
        <span className="ah-nota">El número es cuántas plazas quedan. Toca las clases que quieras{nombre ? ` para ${nombre}` : ''}.</span>
        <span style={{ flex: 1 }}/>
        {marcadas.size > 0 && (
          <select className="input" value={semanas} onChange={e => setSemanas(parseInt(e.target.value))} style={{ maxWidth: 210, fontSize: 13 }}>
            <option value={1}>Solo esta semana</option>
            {[4, 8, 12, 16, 24].map(n => <option key={n} value={n}>Repetir {n} semanas (~{Math.round(n / 4.3)} mes{n > 5 ? 'es' : ''})</option>)}
          </select>
        )}
        <button className="ah-poner" disabled={!marcadas.size || ocupado} onClick={poner}>
          {ocupado ? 'Poniendo…' : marcadas.size ? `Poner ${marcadas.size * semanas} cita${marcadas.size * semanas === 1 ? '' : 's'}` : 'Marca huecos'}
        </button>
      </div>
      )}
      {msg && <div className="ah-msg">{msg}</div>}
    </div>
  )
}

const CSS = `
.ah{display:flex;flex-direction:column;gap:10px}
.ah-cab{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ah-cab b{font-size:16px}
.ah-fl{width:32px;height:32px;border:0;background:#E8E7E1;border-radius:10px;font-size:17px;cursor:pointer;color:var(--gr)}
.ah-fl:disabled{opacity:.35;cursor:default}
.ah-seg{display:inline-flex;background:#E8E7E1;border-radius:99px;padding:3px}
.ah-seg button{border:0;background:transparent;border-radius:99px;padding:5px 12px;font-size:12.5px;color:var(--gr);cursor:pointer;font-family:inherit}
.ah-seg button.on{background:#fff;color:var(--n);box-shadow:0 1px 3px rgba(0,0,0,.08)}
.ah-rej{display:grid;gap:4px;overflow:auto;max-height:58vh}
.ah-dia{font-size:12px;font-weight:700;color:var(--gr);text-align:center;padding:4px 0;position:sticky;top:0;background:var(--w);z-index:1}
.ah-dia span{color:var(--n)}.ah-dia.hoy{color:var(--gd)}
.ah-hora{font-size:12px;color:var(--grl);display:flex;align-items:center}
.ah-cel{display:flex;gap:3px;min-height:34px}
.ah-b{flex:1;min-width:0;border:1.5px solid #CFE3E5;background:#EEF6F7;color:var(--gd);border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;padding:0 2px}
.ah-b:hover{border-color:var(--g)}
.ah-b.poca{background:var(--ambl);border-color:#EBD9A6;color:#8A6410}
.ah-b.llena{background:var(--bl);border-color:var(--bd);color:var(--grl);cursor:default;font-weight:500}
.ah-b.on{background:var(--gd);border-color:var(--gd);color:#fff}
.ah-b.espera{background:#fff;border:1.5px dashed var(--amb);color:#8A6410}
.ah-ya{flex:1;display:flex;align-items:center;justify-content:center;border-radius:9px;background:var(--n);color:#fff;font-size:11.5px;font-weight:600}
.ah-off{flex:1;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--grl)}
.ah-pie{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.ah-nota{font-size:12px;color:var(--grl)}
.ah-poner{border:0;background:var(--n);color:#fff;border-radius:99px;padding:9px 18px;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit}
.ah-poner:disabled{opacity:.4;cursor:default}
.ah-msg{font-size:13px;color:var(--gd);background:var(--gl);border-radius:10px;padding:8px 12px}
`

/** La misma agenda en un velo, para abrirla desde donde haga falta. */
export function VeloAgendaHuecos({ pacienteId, nombre, onCerrar, onCambio, preMarcadas }: { pacienteId: string, nombre?: string, onCerrar: () => void, onCambio?: (n: number) => void, preMarcadas?: HuecoPref[] }) {
  return (
    <div className="modal-bg" style={{ zIndex: 150 }} onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div className="modal" style={{ width: 'min(980px,97vw)', maxHeight: '94vh', overflow: 'auto' }}>
        <div className="modal-title">Citas{nombre ? ` · ${nombre}` : ''}<button className="modal-close" onClick={onCerrar}>✕</button></div>
        <AgendaHuecos pacienteId={pacienteId} nombre={nombre} onCambio={onCambio} preMarcadas={preMarcadas}/>
      </div>
    </div>
  )
}

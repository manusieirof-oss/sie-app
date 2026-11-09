'use client'
import { abrirAlerta, cerrarAlerta, LBL_ALERTA, type CuerpoAlerta } from '@/lib/alertas'
import { ZONAS } from '@/lib/mapaTrabajo'
import { avisarGuia } from '@/lib/guiaEventos'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { hoyISO } from '@/lib/fechas'
import { crearCita, ocupacionPorSala } from '@/lib/citas'
import { soltarDelBono } from '@/lib/bonoSesiones'
import { citaAntes, correrTrasEstado } from '@/lib/correrSesiones'
import { recuperacionAlCambiarEstado } from '@/lib/recuperaciones'
import { pacientesAgendables } from '@/lib/estadosPaciente'
import { parseTiposClase } from '@/lib/tipos'
import { horasDeAgenda } from '@/lib/generarHoras'

// ---------------------------------------------------------------------------
// LA CITA DESDE EL TALLER. En la sala pasa lo que pasa: uno no viene, otro avisa,
// otro se cambia a la sala de al lado o se presenta sin cita. Ir a la agenda para
// eso era salir del taller en plena clase. Aqui se hace lo mismo que en la agenda
// (mismas reglas de bono y recuperaciones) y queda escrito en la agenda.
// ---------------------------------------------------------------------------

// "Viene" no hace falta: se da por hecho si no se marca lo contrario. Tocar otra vez
// la marcada la quita (vuelve a programada).
const ESTADOS = [
  { v: 'falta', l: 'Falta' },
  { v: 'cancelada', l: 'Cancelada' },
]

async function maxPorSala() {
  const { data } = await supabase.from('ajustes').select('valor').eq('clave', 'clinica_max_personas_sala').maybeSingle()
  return parseInt((data as any)?.valor || '6') || 6
}

/** Cambia el estado igual que la agenda: cancelada suelta el bono y genera (o no) recuperacion. */
async function cambiarEstado(cita: { id: string, paciente_id: string, fecha: string, hora?: string }, estado: string) {
  const antes = await citaAntes(cita.id)
  const { error } = await supabase.from('citas').update({ estado }).eq('id', cita.id)
  if (error) return 'No se ha podido cambiar: ' + error.message
  // Su sesion pasa a la siguiente clase si las sesiones corren (Ajustes).
  if (antes) await correrTrasEstado(antes, estado)
  if (estado === 'cancelada') await soltarDelBono(cita.id)
  const rr = await recuperacionAlCambiarEstado(cita, estado)
  if (rr.ok === false) return 'La recuperación no se ha actualizado: ' + rr.error
  if (rr.motivo) return 'Cancelada sin recuperación: ' + rr.motivo + '.'
  return ''
}

/** El velo de la sala (fondo borroso y hoja blanca). Lo usa también la agenda. */
export function Velo({ titulo, sub, onCerrar, children }: { titulo: string, sub?: string, onCerrar: () => void, children: React.ReactNode }) {
  return (
    <div className="gc-fondo" onClick={onCerrar}>
      <style>{CSS}</style>
      <div className="gc-velo" onClick={e => e.stopPropagation()}>
        <div className="gc-cab"><b>{titulo}</b>{sub && <span>{sub}</span>}<button className="gc-x" onClick={onCerrar}>✕</button></div>
        {children}
      </div>
    </div>
  )
}

/**
 * ALERTAS DE UN PACIENTE: las activas (con «Cerrar») y poner una nueva. EL MISMO BLOQUE
 * en el taller (velo de la cita) y en la agenda (botón de alertas): antes eran dos
 * pantallas distintas —en la agenda un desplegable y en el taller botones— y parecían
 * cosas diferentes. Van por lib/alertas, así quedan también en el historial.
 */
export function BloqueAlertas({ pacienteId, onCambio }: { pacienteId: string, onCambio?: () => void }) {
  const [alertas, setAlertas] = useState<any[]>([])
  const [tipoA, setTipoA] = useState('dolor')
  const [afecta, setAfecta] = useState(true)
  const [desc, setDesc] = useState('')
  // Marcarlo en el cuerpo (solo dolor y lesión): zona, lado y si es molestia o patología a trabajar.
  const [enCuerpo, setEnCuerpo] = useState(true)
  const [zonaA, setZonaA] = useState('')
  const [ladoA, setLadoA] = useState<CuerpoAlerta['lado']>(null)
  const [comoA, setComoA] = useState<CuerpoAlerta['como']>('molestia')
  const conCuerpo = tipoA === 'dolor' || tipoA === 'lesion'
  const zDef = ZONAS.find(z => z.n === zonaA)
  const pares = !!zDef && zDef.huesos.some((h: string) => h.endsWith('D')) && zDef.huesos.some((h: string) => h.endsWith('I'))
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState('')
  const leerAlertas = () => supabase.from('alertas_paciente').select('*').eq('paciente_id', pacienteId).eq('activa', true)
    .order('fecha_inicio', { ascending: false }).then(({ data }) => setAlertas(data || []))
  useEffect(() => { leerAlertas() }, [pacienteId]) // eslint-disable-line react-hooks/exhaustive-deps
  async function nuevaAlerta() {
    if (!desc.trim() || ocupado) return
    setOcupado(true); setMsg('')
    const r = await abrirAlerta(pacienteId, tipoA, afecta, desc.trim(), conCuerpo && enCuerpo && zonaA ? { zona: zonaA, lado: pares ? (ladoA || 'bilateral') : null, como: comoA } : null)
    setOcupado(false)
    if (!r.ok) { setMsg('No se ha podido guardar la alerta: ' + r.error); return }
    setDesc(''); setTipoA('dolor'); setAfecta(true); setZonaA(''); setLadoA(null); setComoA('molestia'); setEnCuerpo(true)
    avisarGuia('alerta')
    await leerAlertas(); onCambio?.()
  }
  async function quitarAlerta(a: any) {
    setOcupado(true)
    const r = await cerrarAlerta(a)
    setOcupado(false)
    if (!r.ok) { setMsg('No se ha podido cerrar: ' + r.error); return }
    await leerAlertas(); onCambio?.()
  }
  /* ANOTAR: el mismo bloque sirve para una ALERTA o para la ANAMNESIS. Se elige antes
     qué es y se guarda en su sitio. La anamnesis se añade al final de la de su última
     valoración, con la fecha, sin borrar lo que había. */
  const [modo, setModo] = useState<'alerta' | 'anamnesis'>('alerta')
  const [anam, setAnam] = useState('')
  const [anamPrevia, setAnamPrevia] = useState<{ id: string, texto: string } | null | undefined>(undefined)
  useEffect(() => {
    if (modo !== 'anamnesis' || anamPrevia !== undefined) return
    supabase.from('valoraciones').select('id,anamnesis').eq('paciente_id', pacienteId).order('fecha', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setAnamPrevia(data ? { id: data.id, texto: data.anamnesis || '' } : null))
  }, [modo, pacienteId, anamPrevia])
  async function guardarAnamnesis() {
    if (!anam.trim() || ocupado || !anamPrevia) return
    setOcupado(true); setMsg('')
    const dia = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
    const nuevo = (anamPrevia.texto.trim() ? anamPrevia.texto.trimEnd() + '\n\n' : '') + `${dia}: ${anam.trim()}`
    const { error } = await supabase.from('valoraciones').update({ anamnesis: nuevo }).eq('id', anamPrevia.id)
    if (error) { setOcupado(false); setMsg('No se ha podido guardar la anamnesis: ' + error.message); return }
    await supabase.from('eventos_paciente').insert({ paciente_id: pacienteId, tipo: 'anamnesis', titulo: 'Anamnesis completada', descripcion: anam.trim(), fecha: hoyISO() })
    setOcupado(false); setAnam(''); setAnamPrevia({ ...anamPrevia, texto: nuevo }); setMsg('')
    onCambio?.()
  }
  return <>
    <div className="gc-chips" style={{ marginBottom: 8 }}>
      <button className={modo === 'alerta' ? 'on' : ''} onClick={() => setModo('alerta')}>Alerta</button>
      <button className={modo === 'anamnesis' ? 'on' : ''} onClick={() => setModo('anamnesis')}>Anamnesis</button>
    </div>
    {modo === 'anamnesis' ? <>
      <div className="gc-lbl">Anamnesis</div>
      {anamPrevia === undefined ? <div className="gc-nota">Cargando…</div>
        : anamPrevia === null ? <div className="gc-nota">Aún no tiene valoración: la anamnesis se apunta al hacérsela.</div>
        : <>
          {anamPrevia.texto && <div style={{ fontSize: 12, color: 'var(--gr)', whiteSpace: 'pre-line', maxHeight: 120, overflow: 'auto', marginBottom: 8, lineHeight: 1.5 }}>{anamPrevia.texto.length > 600 ? '…' + anamPrevia.texto.slice(-600) : anamPrevia.texto}</div>}
          <textarea className="input" value={anam} onChange={e => setAnam(e.target.value)} placeholder="Lo que te ha contado: cómo está, qué ha cambiado, algo de su historia…"
            style={{ width: '100%', minHeight: 80, fontSize: 13, boxSizing: 'border-box' }}/>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
            <button className="btn btn-p btn-sm" disabled={!anam.trim() || ocupado} onClick={guardarAnamnesis}>Añadir a su anamnesis</button>
          </div>
          <div className="gc-nota">Se añade al final de la anamnesis de su última valoración, con la fecha de hoy.</div>
        </>}
      {msg && <div className="gc-error">{msg}</div>}
    </> : <>
    <div className="gc-lbl">Alertas</div>
    {alertas.map(a => (
      <div key={a.id} className={'gc-alerta' + (a.afecta_sesion ? ' afecta' : '')}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>{LBL_ALERTA[a.tipo] || a.tipo}</b>{a.afecta_sesion && <span className="gc-afecta">afecta a la sesión</span>}
          {a.descripcion && <div>{a.descripcion}</div>}
          {a.fecha_inicio && <div style={{ fontSize: 11, color: 'var(--grl)' }}>desde {String(a.fecha_inicio).slice(0, 10).split('-').reverse().join('/')}</div>}
        </div>
        <button disabled={ocupado} onClick={() => quitarAlerta(a)}>Cerrar</button>
      </div>
    ))}
    <div className="gc-chips">{Object.entries(LBL_ALERTA).map(([k, l]) => (
      <button key={k} className={tipoA === k ? 'on' : ''} onClick={() => { setTipoA(k); setAfecta(k === 'dolor' || k === 'lesion'); setComoA(k === 'lesion' ? 'patologia' : 'molestia') }}>{l}</button>
    ))}</div>
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: afecta ? 'var(--red)' : 'var(--gr)', margin: '2px 0 8px', cursor: 'pointer' }}>
      <input type="checkbox" checked={afecta} onChange={e => setAfecta(e.target.checked)}/> Afecta a la sesión (adaptar el entreno)
    </label>
    {/* MARCARLO EN EL CUERPO: un interruptor y, si está puesto, dónde. */}
    {conCuerpo && <>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: enCuerpo ? 'var(--gd)' : 'var(--gr)', margin: '0 0 6px', cursor: 'pointer' }}>
        <input type="checkbox" checked={enCuerpo} onChange={e => setEnCuerpo(e.target.checked)}/> Marcarlo en el cuerpo
      </label>
      {enCuerpo && <>
        <div className="gc-chips">
          <button className={comoA === 'molestia' ? 'on' : ''} onClick={() => setComoA('molestia')}>Molestia (se quita con la alerta)</button>
          <button className={comoA === 'patologia' ? 'on' : ''} onClick={() => setComoA('patologia')}>Patología a trabajar</button>
        </div>
        <div className="gc-chips">{ZONAS.map(z => <button key={z.k} className={zonaA === z.n ? 'on' : ''} onClick={() => setZonaA(zonaA === z.n ? '' : z.n)}>{z.n}</button>)}</div>
        {pares && <div className="gc-chips">{([['izquierdo', 'Izquierda'], ['derecho', 'Derecha'], ['bilateral', 'Las dos']] as const).map(([k, t]) =>
          <button key={k} className={(ladoA || 'bilateral') === k ? 'on' : ''} onClick={() => setLadoA(k)}>{t}</button>)}</div>}
      </>}
    </>}
    <div style={{ display: 'flex', gap: 6 }}>
      <input className="input" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Molestia cervical, viene cargada / tiene cita médica el martes…"
        onKeyDown={e => { if (e.key === 'Enter') nuevaAlerta() }} style={{ flex: 1, fontSize: 13 }}/>
      <button className="btn btn-p btn-sm" disabled={!desc.trim() || ocupado} onClick={nuevaAlerta}>Activar</button>
    </div>
    <div className="gc-nota">Queda en su ficha y en su historial.</div>
    {msg && <div className="gc-error">{msg}</div>}
    </>}
  </>
}

/** Velo de la cita de un paciente: falta, cancelada o cambio de sala. */
export function VeloCita({ item, fecha, salas, nombre, onCerrar, onHecho, soloFalta = false, sinSala = false, arriba, onAlertas }: {
  /** Sin cambiar de sala (nivel 2: solo falta o cancelada desde el taller). */
  sinSala?: boolean
  item: any, fecha: string, salas: string[], nombre: string, onCerrar: () => void, onHecho: (aviso?: string) => void,
  /** Lo primero del velo: su sesión de hoy y sus objetivos (lo pone el taller). */
  arriba?: React.ReactNode,
  /** Tras abrir o cerrar una alerta: el taller recarga los avisos de esa persona. */
  onAlertas?: () => void,
  /** Nivel 1 (lib/permisos): no toca la cita (falta, cancelada, sala); desde el 2, sí. */
  soloFalta?: boolean
}) {
  const [ocup, setOcup] = useState<Record<string, number>>({})
  const [max, setMax] = useState(6)
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => {
    if (item.hora) ocupacionPorSala(fecha, item.hora).then(r => setOcup(r.porSala))
    maxPorSala().then(setMax)
  }, [fecha, item.hora])
  const estado = item.estado === 'realizada' ? 'programada' : (item.estado || 'programada')
  const cita = { id: item.citaId, paciente_id: item.paciente.id, fecha, hora: item.hora }

  async function ponerEstado(v0: string) {
    if (ocupado) return
    const v = v0 === estado ? 'programada' : v0
    if (v === 'cancelada' && !confirm(`¿Cancelar la clase de ${nombre}? Sale del taller y libera su plaza.`)) return
    setOcupado(true)
    const aviso = await cambiarEstado(cita, v)
    setOcupado(false)
    if (aviso && aviso.startsWith('No se ha')) { setMsg(aviso); return }
    onHecho(aviso)
  }
  async function ponerSala(s: string) {
    if (s === item.sala || ocupado) return
    if ((ocup[s] || 0) >= max && !confirm(`La sala ${s} ya tiene ${ocup[s]} a esta hora (máximo ${max}). ¿Cambiar igualmente?`)) return
    setOcupado(true)
    const { error } = await supabase.from('citas').update({ sala: s }).eq('id', item.citaId)
    setOcupado(false)
    if (error) { setMsg('No se ha podido cambiar la sala: ' + error.message); return }
    onHecho()
  }

  return (
    <Velo titulo={nombre} sub={`Cita de las ${item.hora || '—'}${item.sala ? ' · sala ' + item.sala : ''}`} onCerrar={onCerrar}>
      {arriba}
      {!item.citaId ? <div className="gc-nota">No tiene cita en la agenda.</div> : <>
        {/* El nivel 1 no toca la cita: ni falta, ni cancelada, ni sala. Si ya está marcada, se ve. */}
        {soloFalta ? (estado !== 'programada' && <div className="gc-nota">Hoy: {ESTADOS.find(e => e.v === estado)?.l || estado}.</div>) : <>
        <div className="gc-lbl">Clase de hoy</div>
        <div className="gc-chips">{ESTADOS.map(e => (
          <button key={e.v} disabled={ocupado} className={(estado === e.v ? 'on ' : '') + e.v} onClick={() => ponerEstado(e.v)}>{e.l}</button>
        ))}</div>
        </>}
        {!soloFalta && <div className="gc-nota">Igual que en la agenda: cancelada no gasta del bono y genera recuperación si toca; falta, no.</div>}
        {salas.length > 1 && !soloFalta && !sinSala && <>
          <div className="gc-lbl">Grupo</div>
          <div className="gc-chips">{salas.map(s => (
            <button key={s} disabled={ocupado} className={item.sala === s ? 'on' : ''} onClick={() => ponerSala(s)}>
              Sala {s}<small>{(ocup[s] || 0) - (item.sala === s ? 1 : 0)}/{max}</small></button>
          ))}</div>
          <div className="gc-nota">Solo esta clase. Para cambiarle todas las citas, desde su ficha.</div>
        </>}
        <BloqueAlertas pacienteId={item.paciente.id} onCambio={onAlertas}/>
      </>}
      {msg && <div className="gc-error">{msg}</div>}
      <div className="gc-pie"><button className="btn btn-p btn-sm" onClick={onCerrar}>Listo</button></div>
    </Velo>
  )
}

const norm = (t: string) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Añadir a alguien a la clase: se le crea la cita en la agenda, con su bono. */
export function VeloAnadir({ fecha, hora, horas, sala, salas, yaEstan, onCerrar, onHecho }: {
  fecha: string, hora: string, horas: string[], sala: string, salas: string[], yaEstan: string[],
  onCerrar: () => void, onHecho: (aviso?: string) => void
}) {
  const [pacs, setPacs] = useState<any[] | null>(null)
  const [tipos, setTipos] = useState<string[]>([])
  const [q, setQ] = useState('')
  const [h, setH] = useState(hora || horas[0] || '')
  const [s, setS] = useState(sala || salas[0] || 'A')
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState('')
  // Las horas de la agenda (no solo las que ya tienen gente): se puede abrir una franja.
  const [horasAg, setHorasAg] = useState<string[]>([])
  useEffect(() => {
    pacientesAgendables('id,nombre,apellidos,nombre_clinica,tipo_clase').then(setPacs)
    supabase.from('ajustes').select('clave,valor').then(({ data }) => {
      const map: Record<string, string> = Object.fromEntries((data || []).map((x: any) => [x.clave, x.valor]))
      setTipos(parseTiposClase(map.tipos_clase).map((t: any) => t.valor))
      setHorasAg(horasDeAgenda(map))
    })
  }, [])
  const opcHoras = Array.from(new Set([...horasAg, ...horas])).sort()
  const lista = useMemo(() => {
    const t = norm(q).trim()
    if (t.length < 2 || !pacs) return []
    const partes = t.split(/\s+/)
    return pacs.filter(p => { const n = norm(`${p.nombre} ${p.apellidos || ''} ${p.nombre_clinica || ''}`); return partes.every(x => n.includes(x)) }).slice(0, 12)
  }, [q, pacs])

  async function anadir(p: any) {
    if (!h) { setMsg('Elige la hora.'); return }
    setOcupado(true); setMsg('')
    const r = await crearCita(fecha, { pacienteId: p.id, hora: h, sala: s,
      ...(p.tipo_clase && tipos.includes(p.tipo_clase) ? { tipo: p.tipo_clase } : {}) })
    setOcupado(false)
    if (r.ok === false) { setMsg(r.error); return }
    onHecho(`${p.nombre} añadido a las ${h} · sala ${s}.`)
  }

  const fechaTxt = new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })
  return (
    <Velo titulo="Añadir a la clase" sub={fechaTxt} onCerrar={onCerrar}>
      <div className="gc-fila">
        <select className="input" value={h} onChange={e => setH(e.target.value)} style={{ maxWidth: 120 }}>
          {!h && <option value="">Hora…</option>}
          {opcHoras.map(x => <option key={x} value={x}>{x}{horas.includes(x) ? '' : ' · vacía'}</option>)}
        </select>
        {salas.length > 1 && <div className="gc-chips">{salas.map(x => <button key={x} className={s === x ? 'on' : ''} onClick={() => setS(x)}>Sala {x}</button>)}</div>}
      </div>
      <input className="input gc-buscar" autoFocus placeholder="Buscar paciente…" value={q} onChange={e => setQ(e.target.value)}/>
      <div className="gc-lista">
        {pacs === null ? <div className="gc-nota">Cargando pacientes…</div>
          : q.trim().length < 2 ? <div className="gc-nota">Escribe al menos dos letras del nombre.</div>
          : lista.length === 0 ? <div className="gc-nota">Nadie con ese nombre entre los activos.</div>
          : lista.map(p => {
            const ya = yaEstan.includes(p.id)
            return <button key={p.id} className="gc-pac" disabled={ocupado || ya} onClick={() => anadir(p)}>
              <span>{p.nombre} {p.apellidos || ''}{p.nombre_clinica ? <em> · «{p.nombre_clinica}»</em> : null}</span>
              <b>{ya ? 'Ya está' : '＋ Añadir'}</b>
            </button>
          })}
      </div>
      {msg && <div className="gc-error">{msg}</div>}
      <div className="gc-nota">Se crea la cita en la agenda (gasta de su bono si tiene).</div>
    </Velo>
  )
}

const CSS = `
.gc-fondo{position:fixed;inset:0;z-index:130;background:rgba(38,40,37,.28);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:16px}
.gc-velo{width:min(520px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:22px;box-shadow:0 20px 60px rgba(38,40,37,.2);padding:20px 22px;display:flex;flex-direction:column;gap:8px}
.gc-cab{display:flex;align-items:baseline;gap:10px;margin-bottom:4px}.gc-cab b{font-size:20px}.gc-cab span{color:var(--gr);font-size:14px}
.gc-x{margin-left:auto;width:34px;height:34px;border-radius:50%;border:1px solid var(--bd);background:#fff;cursor:pointer;font-size:15px}
.gc-lbl{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--grl);font-weight:700;margin-top:6px}
.gc-chips{display:flex;gap:6px;flex-wrap:wrap}
.gc-chips button{padding:9px 16px;border-radius:99px;border:1.5px solid var(--bd);background:#fff;font-size:14px;cursor:pointer;font-family:inherit;display:inline-flex;gap:6px;align-items:baseline}
.gc-chips button small{font-size:11px;color:var(--grl)}
.gc-chips button.on{background:var(--g);border-color:var(--g);color:#fff}.gc-chips button.on small{color:#e6f2f3}
.gc-alerta{display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border-radius:8px;background:var(--bl);border:1px solid var(--bd);font-size:12.5px;color:var(--gr);margin-bottom:6px;line-height:1.45}
.gc-alerta b{color:var(--n);font-weight:600}
.gc-alerta.afecta{background:var(--redl);border-color:#F5C8C8}
.gc-afecta{font-size:10.5px;color:var(--red);margin-left:6px}
.gc-alerta button{border:1px solid var(--g);color:var(--gd);background:#fff;border-radius:99px;padding:3px 10px;font-size:11.5px;cursor:pointer;flex-shrink:0;font-family:inherit}
.gc-chips button.on.falta{background:#C0504D;border-color:#C0504D}
.gc-chips button.on.cancelada{background:#6E716C;border-color:#6E716C}
.gc-nota{font-size:12px;color:var(--grl);line-height:1.45}
.gc-error{font-size:12.5px;color:#7A5800;background:var(--ambl);border-radius:10px;padding:8px 10px}
.gc-pie{display:flex;justify-content:flex-end;margin-top:6px}
.gc-fila{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.gc-buscar{font-size:15px;padding:10px 14px;border-radius:99px}
.gc-lista{display:flex;flex-direction:column;gap:2px;min-height:120px}
.gc-pac{display:flex;align-items:center;justify-content:space-between;gap:10px;border:0;background:transparent;padding:10px 8px;border-radius:10px;cursor:pointer;font-family:inherit;font-size:14px;text-align:left;color:var(--n)}
.gc-pac:hover{background:var(--bl)}.gc-pac em{color:var(--grl);font-style:normal}.gc-pac b{color:var(--gd);font-size:13px;white-space:nowrap}
.gc-pac:disabled{opacity:.5;cursor:default}
`

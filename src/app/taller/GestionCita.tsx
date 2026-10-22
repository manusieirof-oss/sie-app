'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
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

function Velo({ titulo, sub, onCerrar, children }: { titulo: string, sub?: string, onCerrar: () => void, children: React.ReactNode }) {
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

/** Velo de la cita de un paciente: falta, cancelada o cambio de sala. */
export function VeloCita({ item, fecha, salas, nombre, onCerrar, onHecho }: {
  item: any, fecha: string, salas: string[], nombre: string, onCerrar: () => void, onHecho: (aviso?: string) => void
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
    <Velo titulo={nombre} sub={`Cita de las ${item.hora || '—'}`} onCerrar={onCerrar}>
      {!item.citaId ? <div className="gc-nota">No tiene cita en la agenda.</div> : <>
        <div className="gc-lbl">Clase de hoy</div>
        <div className="gc-chips">{ESTADOS.map(e => (
          <button key={e.v} disabled={ocupado} className={(estado === e.v ? 'on ' : '') + e.v} onClick={() => ponerEstado(e.v)}>{e.l}</button>
        ))}</div>
        <div className="gc-nota">Igual que en la agenda: cancelada no gasta del bono y genera recuperación si toca; falta, no.</div>
        {salas.length > 1 && <>
          <div className="gc-lbl">Grupo</div>
          <div className="gc-chips">{salas.map(s => (
            <button key={s} disabled={ocupado} className={item.sala === s ? 'on' : ''} onClick={() => ponerSala(s)}>
              Sala {s}<small>{(ocup[s] || 0) - (item.sala === s ? 1 : 0)}/{max}</small></button>
          ))}</div>
          <div className="gc-nota">Solo esta clase. Para cambiarle todas las citas, desde su ficha.</div>
        </>}
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

'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { crearCita } from '@/lib/citas'
import { pacientesAgendables } from '@/lib/estadosPaciente'
import { contiene } from '@/lib/texto'
import { hoyISO } from '@/lib/fechas'
import { configMovil, ConfigMovil, masDias, DIAS_CORTOS, iniciales, nombreDe, hhmm, aMin } from '@/lib/movil'

/**
 * NUEVA CITA EN EL MÓVIL · una hoja que sube desde abajo.
 *
 * Todo con botones, sin teclear salvo para buscar al paciente: el día en una tira y
 * las horas con sus plazas libres por sala. Solo crea UNA cita; los planes que se
 * repiten (lunes y miércoles durante tres meses) siguen en el ordenador, que es donde
 * se revisan con calma.
 *
 * Se puede abrir con cosas ya puestas: desde una clase llega con día, hora y sala;
 * desde una ficha, con el paciente.
 */
export default function HojaCita({ pacienteId, fecha: fecha0, hora: hora0, sala: sala0, onCerrar, onCreada }: {
  pacienteId?: string, fecha?: string, hora?: string, sala?: string
  onCerrar: () => void, onCreada?: () => void
}) {
  const [cfg, setCfg] = useState<ConfigMovil | null>(null)
  const [pacientes, setPacientes] = useState<any[]>([])
  const [pac, setPac] = useState<any>(null)
  const [buscar, setBuscar] = useState('')
  const [fecha, setFecha] = useState(fecha0 || hoyISO())
  const [hora, setHora] = useState(hora0 ? hhmm(hora0) : '')
  const [sala, setSala] = useState(sala0 || '')
  const [ocupacion, setOcupacion] = useState<Record<string, number>>({})
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    configMovil().then(setCfg)
    pacientesAgendables('id,nombre,apellidos,nombre_clinica,tipo_clase').then(ps => {
      setPacientes(ps)
      if (pacienteId) setPac(ps.find((p: any) => p.id === pacienteId) || null)
    })
  }, [pacienteId])

  // Plazas ocupadas por hora y sala ese día, en una sola consulta.
  useEffect(() => {
    supabase.from('citas').select('hora,sala').eq('fecha', fecha).neq('estado', 'cancelada')
      .then(({ data }) => {
        const m: Record<string, number> = {}
        ;(data || []).forEach((c: any) => { const k = hhmm(c.hora) + '|' + c.sala; m[k] = (m[k] || 0) + 1 })
        setOcupacion(m)
      })
  }, [fecha])

  const encontrados = useMemo(() => buscar.trim().length < 2 ? [] : pacientes
    .filter(p => contiene(nombreDe(p), buscar) || contiene(p.nombre_clinica, buscar)).slice(0, 6), [buscar, pacientes])

  // Hoy no se ofrecen las horas que ya pasaron.
  const ahoraMin = fecha === hoyISO() ? new Date().getHours() * 60 + new Date().getMinutes() : -1
  const dias = Array.from({ length: 10 }, (_, i) => masDias(hoyISO(), i)).filter(f => new Date(f + 'T12:00:00').getDay() !== 0)

  async function guardar() {
    if (!pac || !hora || !sala) return
    setGuardando(true); setError('')
    const r = await crearCita(fecha, { pacienteId: pac.id, hora, sala, tipo: pac.tipo_clase || 'entrenamiento' })
    setGuardando(false)
    if (r.ok === false) { setError(r.error); return }
    onCreada?.(); onCerrar()
  }

  return (
    <>
      <div className="m-velo" onClick={onCerrar}/>
      <div className="m-hoja">
        <div className="m-asa"/>
        <div className="m-hoja-tit">Nueva cita</div>

        {/* PACIENTE */}
        {pac ? (
          <div className="m-campo" onClick={() => !pacienteId && setPac(null)}>
            <span className="m-av sm">{iniciales(pac)}</span>
            <div style={{ flex: 1 }}><small>Paciente</small>{nombreDe(pac)}</div>
            {!pacienteId && <Ic name="cerrar" size={15}/>}
          </div>
        ) : (
          <>
            <div className="m-campo">
              <Ic name="buscar" size={16}/>
              <input autoFocus placeholder="Buscar paciente…" value={buscar} onChange={e => setBuscar(e.target.value)}/>
            </div>
            {encontrados.map(p => (
              <div key={p.id} className="m-fila-sel" onClick={() => { setPac(p); setBuscar('') }}>
                <span className="m-av sm">{iniciales(p)}</span>{nombreDe(p)}
              </div>
            ))}
          </>
        )}

        {/* DÍA */}
        <div className="m-lbl">Día</div>
        <div className="m-tira">
          {dias.map(f => {
            const d = new Date(f + 'T12:00:00')
            return (
              <button key={f} className={`m-dia ${fecha === f ? 'on' : ''}`} onClick={() => { setFecha(f); setHora(''); setSala('') }}>
                {f === hoyISO() ? 'HOY' : DIAS_CORTOS[d.getDay()]}<b>{d.getDate()}</b>
              </button>
            )
          })}
        </div>

        {/* HORA Y SALA: cada botón es una clase concreta con sus plazas libres. */}
        <div className="m-lbl">Hora · plazas libres</div>
        <div className="m-chips">
          {cfg?.horas.filter(h => aMin(h) > ahoraMin - 10).flatMap(h => cfg.salas.map(s => {
            const libres = cfg.max - (ocupacion[h + '|' + s] || 0)
            const on = hora === h && sala === s
            return (
              <button key={h + s} className={`m-chip ${on ? 'on' : ''} ${libres <= 0 ? 'llena' : ''}`}
                onClick={() => { setHora(h); setSala(s) }}>
                {h} <small>{cfg.salas.length > 1 ? s + '·' : ''}{libres <= 0 ? 'llena' : libres}</small>
              </button>
            )
          }))}
        </div>

        {error && <div className="m-error">{error}</div>}
        <button className="m-boton verde" disabled={!pac || !hora || !sala || guardando} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar cita'}
        </button>
      </div>
    </>
  )
}

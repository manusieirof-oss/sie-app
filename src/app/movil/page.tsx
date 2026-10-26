'use client'
import { useEffect, useState } from 'react'
import CaraPaciente from '@/components/CaraPaciente'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { hoyISO } from '@/lib/fechas'
import { cargarTurnos, nombresDe, Turno } from '@/lib/turnos'
import { configMovil, ConfigMovil, semanaDe, masDias, DIAS_CORTOS, textoFecha, hhmm, iniciales, franjaActual, aMin } from '@/lib/movil'

/**
 * HOY · la pantalla de entrada en el móvil.
 *
 * Las clases del día por orden de reloj: la que está en marcha arriba y destacada,
 * luego las que vienen, y las ya pasadas al final y apagadas. Tocando una se entra a
 * pasar lista. Arriba, una tira con la semana para mirar otro día.
 */
export default function MovilHoy() {
  const [fecha, setFecha] = useState(hoyISO())
  const [cfg, setCfg] = useState<ConfigMovil | null>(null)
  const [citas, setCitas] = useState<any[]>([])
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [alertas, setAlertas] = useState(0)
  const [cargando, setCargando] = useState(true)

  useEffect(() => { configMovil().then(setCfg); cargarTurnos().then(setTurnos) }, [])
  // La cita nueva del botón + de la barra avisa con un evento para recargar el día.
  const [vuelta, setVuelta] = useState(0)
  useEffect(() => {
    const f = () => setVuelta(v => v + 1)
    window.addEventListener('sie-cita', f); return () => window.removeEventListener('sie-cita', f)
  }, [])
  useEffect(() => {
    setCargando(true)
    ;(async () => {
      const { data } = await supabase.from('citas')
        .select('id,hora,sala,tipo,estado,paciente_id,pacientes(nombre,apellidos,foto_url)')
        .eq('fecha', fecha).neq('estado', 'cancelada').order('hora')
      setCitas(data || [])
      const ids = Array.from(new Set((data || []).map((c: any) => c.paciente_id)))
      if (ids.length) {
        const { count } = await supabase.from('alertas_paciente').select('id', { count: 'exact', head: true })
          .eq('activa', true).in('paciente_id', ids)
        setAlertas(count || 0)
      } else setAlertas(0)
      setCargando(false)
    })()
  }, [fecha, vuelta])

  // Agrupar en clases (hora + sala).
  const clases = Object.values(citas.reduce((acc: Record<string, any>, c: any) => {
    const k = hhmm(c.hora) + '|' + c.sala
    ;(acc[k] ||= { hora: hhmm(c.hora), sala: c.sala, tipo: c.tipo, citas: [] as any[] }).citas.push(c)
    return acc
  }, {})).sort((a: any, b: any) => a.hora.localeCompare(b.hora) || String(a.sala).localeCompare(String(b.sala))) as any[]

  const enMarcha = cfg ? franjaActual(cfg.horas, fecha) : null
  const ahoraMin = new Date().getHours() * 60 + new Date().getMinutes()
  const pasada = (h: string) => fecha < hoyISO() || (fecha === hoyISO() && aMin(h) + 60 <= ahoraMin && h !== enMarcha)
  const ahora = clases.filter(c => c.hora === enMarcha)
  const despues = clases.filter(c => c.hora !== enMarcha && !pasada(c.hora))
  const antes = clases.filter(c => c.hora !== enMarcha && pasada(c.hora))
  const nombreTipo = (t: string) => cfg?.tiposClase.find((x: any) => x.valor === t)?.nombre || 'Clase'

  const Clase = ({ c, destacada }: { c: any, destacada?: boolean }) => {
    const n = c.citas.length, max = cfg?.max || 6
    const quien = nombresDe(turnos, fecha, c.hora, c.sala).join(' · ')
    return (
      <Link href={`/movil/clase?f=${fecha}&h=${c.hora}&s=${encodeURIComponent(c.sala)}`}
        className={`m-clase ${destacada ? 'ahora' : ''} ${pasada(c.hora) && !destacada ? 'pasada' : ''}`}>
        <div className="m-clase-h">{c.hora}<small>Sala {c.sala}</small></div>
        <div className="m-clase-m">
          <b>{nombreTipo(c.tipo)}</b>
          <span>{quien ? quien + ' · ' : ''}{n} de {max}</span>
          <div className="m-barra"><i style={{ width: Math.min(100, n / max * 100) + '%', background: n >= max && !destacada ? 'var(--amb)' : undefined }}/></div>
        </div>
        <div className="m-avs">{c.citas.slice(0, 3).map((x: any) => <i key={x.id}><CaraPaciente p={x.pacientes}/></i>)}</div>
      </Link>
    )
  }

  const semana = semanaDe(fecha)
  return (
    <div className="m-pag">
      <div className="m-cab">
        <div>
          <h1 style={{ textTransform: 'capitalize' }}>{fecha === hoyISO() ? 'Hoy' : new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long' })}</h1>
          <small>{textoFecha(fecha)}</small>
        </div>
        {fecha !== hoyISO() && <button className="m-pildora" onClick={() => setFecha(hoyISO())}>Hoy</button>}
      </div>

      <div className="m-semana">
        <button className="m-ic" onClick={() => setFecha(masDias(semana[0], -7))}><Ic name="izq" size={16}/></button>
        {semana.map(f => {
          const d = new Date(f + 'T12:00:00')
          return (
            <button key={f} className={`m-dia ${f === fecha ? 'on' : ''} ${f === hoyISO() ? 'hoy' : ''}`} onClick={() => setFecha(f)}>
              {DIAS_CORTOS[d.getDay()]}<b>{d.getDate()}</b>
            </button>
          )
        })}
        <button className="m-ic" onClick={() => setFecha(masDias(semana[0], 7))}><Ic name="der" size={16}/></button>
      </div>

      {alertas > 0 && (
        <Link href="/movil/avisos" className="m-aviso">
          <span className="m-aviso-ic rojo"><Ic name="alerta" size={16}/></span>
          <span><b>{alertas} {alertas === 1 ? 'alerta' : 'alertas'}</b> en pacientes de este día</span>
          <Ic name="der" size={15} style={{ marginLeft: 'auto', color: 'var(--grl)' }}/>
        </Link>
      )}

      {cargando ? <div className="m-vacio">Cargando…</div> : clases.length === 0 ? (
        <div className="m-vacio">No hay clases este día.</div>
      ) : (
        <>
          {ahora.length > 0 && <><div className="m-sec">Ahora</div>{ahora.map(c => <Clase key={c.hora + c.sala} c={c} destacada/>)}</>}
          {despues.length > 0 && <><div className="m-sec">{fecha === hoyISO() ? 'Después' : 'Clases'}</div>{despues.map(c => <Clase key={c.hora + c.sala} c={c}/>)}</>}
          {antes.length > 0 && <><div className="m-sec">Ya pasadas</div>{antes.map(c => <Clase key={c.hora + c.sala} c={c}/>)}</>}
        </>
      )}
    </div>
  )
}

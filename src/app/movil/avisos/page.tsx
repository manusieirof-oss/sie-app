'use client'
import { useEffect, useState } from 'react'
import CaraPaciente from '@/components/CaraPaciente'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { hoyISO } from '@/lib/fechas'
import { porAgotar } from '@/lib/bonoSesiones'
import { iniciales, nombreDe, hhmm } from '@/lib/movil'

/**
 * AVISOS · lo que hay que tener en la cabeza hoy, en un solo sitio:
 * alertas de los pacientes que vienen hoy, tareas pendientes y bonos que se acaban.
 */
export default function MovilAvisos() {
  const [alertas, setAlertas] = useState<any[]>([])
  const [tareas, setTareas] = useState<any[]>([])
  const [bonos, setBonos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)

  async function cargar() {
    const hoy = hoyISO()
    const { data: citas } = await supabase.from('citas').select('paciente_id,hora').eq('fecha', hoy).neq('estado', 'cancelada')
    const horaDe: Record<string, string> = {}
    ;(citas || []).forEach((c: any) => { const h = hhmm(c.hora); if (!horaDe[c.paciente_id] || h < horaDe[c.paciente_id]) horaDe[c.paciente_id] = h })
    const ids = Object.keys(horaDe)
    const [al, ta, bo] = await Promise.all([
      ids.length ? supabase.from('alertas_paciente').select('id,paciente_id,descripcion,afecta_sesion,pacientes(nombre,apellidos)').eq('activa', true).in('paciente_id', ids) : Promise.resolve({ data: [] }),
      supabase.from('tareas').select('*').eq('completada', false).order('fecha_limite', { ascending: true, nullsFirst: false }),
      porAgotar(),
    ])
    setAlertas(((al as any).data || []).map((a: any) => ({ ...a, hora: horaDe[a.paciente_id] })).sort((a: any, b: any) => a.hora.localeCompare(b.hora)))
    setTareas(ta.data || [])
    setBonos(bo.filas || [])
    setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  async function hecha(t: any) {
    setTareas(ts => ts.filter(x => x.id !== t.id))
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('tareas').update({ completada: true, fecha_completada: new Date().toISOString(), completada_por: user?.id || null }).eq('id', t.id)
  }

  const hoy = hoyISO()
  return (
    <div className="m-pag">
      <div className="m-cab"><div><h1>Avisos</h1><small>Lo que hay que tener presente hoy</small></div></div>
      {cargando ? <div className="m-vacio">Cargando…</div> : (
        <>
          <div className="m-sec">Alertas de hoy · {alertas.length}</div>
          {alertas.length === 0 && <div className="m-nada tarj">Ningún paciente de hoy tiene alertas.</div>}
          {alertas.map(a => (
            <Link key={a.id} href={`/movil/pacientes/${a.paciente_id}`} className="m-aviso">
              <span className="m-aviso-ic rojo"><Ic name="alerta" size={16}/></span>
              <span style={{ minWidth: 0 }}><b>{a.hora} · {nombreDe(a.pacientes)}</b><small>{a.descripcion}{a.afecta_sesion ? ' · afecta a la sesión' : ''}</small></span>
            </Link>
          ))}

          <div className="m-sec">Tareas · {tareas.length}</div>
          {tareas.length === 0 && <div className="m-nada tarj">Sin tareas pendientes.</div>}
          {tareas.map(t => {
            const venc = t.fecha_limite && t.fecha_limite < hoy
            return (
              <div key={t.id} className="m-aviso">
                <button className="m-check" onClick={() => hecha(t)} aria-label="Hecha"/>
                <span style={{ minWidth: 0 }}><b style={{ fontWeight: 500 }}>{t.titulo}</b>
                  {t.fecha_limite && <small style={{ color: venc ? 'var(--red)' : undefined }}>{venc ? 'Vencida · ' : ''}{new Date(t.fecha_limite + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</small>}</span>
              </div>
            )
          })}

          <div className="m-sec">Bonos que se acaban · {bonos.length}</div>
          {bonos.length === 0 && <div className="m-nada tarj">Ninguno.</div>}
          {bonos.map(b => (
            <Link key={b.bono_id} href={`/movil/pacientes/${b.paciente_id}`} className="m-aviso">
              <span className="m-av sm"><CaraPaciente p={b}/></span>
              <span style={{ minWidth: 0 }}><b>{nombreDe(b)}</b><small>{b.caducado ? 'Caducado' : b.restantes <= 0 ? 'Sin sesiones' : `Le quedan ${b.restantes}`}{b.bono_nombre ? ' · ' + b.bono_nombre : ''}</small></span>
            </Link>
          ))}
        </>
      )}
    </div>
  )
}

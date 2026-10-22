'use client'
import { useEffect, useState } from 'react'
import { citaAntes, correrTrasEstado } from '@/lib/correrSesiones'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { ultimasDeBono, consumoDe } from '@/lib/bonoSesiones'
import { recuperacionAlCambiarEstado } from '@/lib/recuperaciones'
import { cargarTurnos, nombresDe } from '@/lib/turnos'
import { configMovil, ConfigMovil, iniciales, nombreDe, textoFecha } from '@/lib/movil'
import HojaCita from '../components/HojaCita'

/**
 * PASAR LISTA desde el móvil.
 *
 * Dos botones por persona: ✓ vino (realizada) y ✗ faltó (falta). Pulsar el que ya
 * está marcado lo deshace y la cita vuelve a programada. Al lado del nombre, solo lo
 * que hay que saber HOY: una alerta, una molestia activa o que gasta la última sesión
 * del bono. El cambio de estado pasa por la misma regla de recuperaciones que la
 * agenda de escritorio, para que una falta cuente igual la marque quien la marque.
 */
export default function MovilClase() {
  const [p, setP] = useState<{ f: string, h: string, s: string } | null>(null)
  const [cfg, setCfg] = useState<ConfigMovil | null>(null)
  const [citas, setCitas] = useState<any[]>([])
  const [info, setInfo] = useState<Record<string, { alerta?: string, molestia?: string, bono?: string }>>({})
  const [quien, setQuien] = useState('')
  const [cargando, setCargando] = useState(true)
  const [hoja, setHoja] = useState(false)
  const [error, setError] = useState('')

  // Los parámetros se leen de la URL a mano para no arrastrar el Suspense de useSearchParams.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    setP({ f: q.get('f') || '', h: q.get('h') || '', s: q.get('s') || '' })
    configMovil().then(setCfg)
  }, [])

  async function cargar() {
    if (!p) return
    setCargando(true)
    const { data } = await supabase.from('citas')
      .select('id,fecha,hora,sala,tipo,estado,paciente_id,bono_id,pacientes(id,nombre,apellidos)')
      .eq('fecha', p.f).eq('hora', p.h + ':00').eq('sala', p.s).order('id')
    const cs = data || []
    setCitas(cs)
    const ids = cs.map((c: any) => c.paciente_id)
    const [al, mo, ultimas, cons, turnos] = await Promise.all([
      ids.length ? supabase.from('alertas_paciente').select('paciente_id,descripcion').eq('activa', true).in('paciente_id', ids) : Promise.resolve({ data: [] }),
      ids.length ? supabase.from('molestias').select('paciente_id,zona,eva').eq('activa', true).in('paciente_id', ids) : Promise.resolve({ data: [] }),
      ultimasDeBono(cs),
      consumoDe(Array.from(new Set(cs.map((c: any) => c.bono_id).filter(Boolean)))),
      cargarTurnos(),
    ])
    const m: Record<string, any> = {}
    cs.forEach((c: any) => {
      const a = (al as any).data?.find((x: any) => x.paciente_id === c.paciente_id)
      const mol = (mo as any).data?.find((x: any) => x.paciente_id === c.paciente_id)
      const b = c.bono_id ? cons.mapa.get(c.bono_id) : null
      m[c.id] = {
        alerta: a?.descripcion || undefined,
        molestia: mol ? `${mol.zona}${mol.eva != null ? ' · EVA ' + mol.eva : ''}` : undefined,
        bono: ultimas.has(c.id) ? 'última' : b ? `Bono: ${Math.max(0, b.restantes)} de ${b.sesiones_totales}` : undefined,
      }
    })
    setInfo(m)
    setQuien(nombresDe(turnos, p.f, p.h, p.s).join(' · '))
    setCargando(false)
  }
  useEffect(() => { cargar() }, [p])

  async function marcar(c: any, estado: 'realizada' | 'falta') {
    const nuevo = c.estado === estado ? 'programada' : estado
    setError('')
    // Se pinta ya; si la base falla, se vuelve atrás y se dice.
    setCitas(cs => cs.map(x => x.id === c.id ? { ...x, estado: nuevo } : x))
    const antes = await citaAntes(c.id)
    const { error } = await supabase.from('citas').update({ estado: nuevo }).eq('id', c.id)
    if (error) { setError('No se ha guardado: ' + error.message); setCitas(cs => cs.map(x => x.id === c.id ? { ...x, estado: c.estado } : x)); return }
    if (antes) await correrTrasEstado(antes, nuevo)
    const r = await recuperacionAlCambiarEstado(c, nuevo)
    if (r.ok === false) setError('La recuperación no se ha actualizado: ' + r.error)
  }

  if (!p) return null
  const activas = citas.filter(c => c.estado !== 'cancelada')
  const bajas = citas.filter(c => c.estado === 'cancelada')
  const max = cfg?.max || 6
  const nombreTipo = cfg?.tiposClase.find((x: any) => x.valor === activas[0]?.tipo)?.nombre || 'Clase'

  return (
    <div className="m-pag">
      <Link href="/movil" className="m-volver"><Ic name="izq" size={18}/> Hoy</Link>
      <h1 className="m-tit">{p.h} · Sala {p.s}</h1>
      <div className="m-subtit">{nombreTipo}{quien ? ' · ' + quien : ''} · {activas.length} de {max} · <span style={{ textTransform: 'capitalize' }}>{textoFecha(p.f)}</span></div>

      {error && <div className="m-error">{error}</div>}
      {cargando ? <div className="m-vacio">Cargando…</div> : (
        <>
          {activas.map(c => {
            const i = info[c.id] || {}
            const aviso = i.alerta || i.molestia
            return (
              <div key={c.id} className="m-pac">
                <Link href={`/movil/pacientes/${c.paciente_id}`} className={`m-av ${aviso ? 'rojo' : ''}`}>{iniciales(c.pacientes)}</Link>
                <Link href={`/movil/pacientes/${c.paciente_id}`} className="m-pac-m">
                  <b>{nombreDe(c.pacientes)}</b>
                  {aviso ? <span className="rojo">⚠ {aviso}</span>
                    : i.bono === 'última' ? <span className="ambar">Última sesión del bono</span>
                    : i.bono ? <span>{i.bono}</span> : null}
                </Link>
                <div className="m-marca">
                  <button className={c.estado === 'realizada' ? 'si' : ''} onClick={() => marcar(c, 'realizada')} aria-label="Vino"><Ic name="check" size={18}/></button>
                  <button className={c.estado === 'falta' ? 'no' : ''} onClick={() => marcar(c, 'falta')} aria-label="Faltó"><Ic name="cerrar" size={18}/></button>
                </div>
              </div>
            )
          })}
          {activas.length === 0 && <div className="m-vacio">Nadie en esta clase.</div>}
          {bajas.length > 0 && <div className="m-bajas">{bajas.length === 1 ? 'Baja' : 'Bajas'}: {bajas.map(c => nombreDe(c.pacientes)).join(', ')}</div>}
          <button className="m-boton punteado" onClick={() => setHoja(true)}>
            <Ic name="mas" size={16}/> Añadir a esta clase{activas.length < max ? ` · ${max - activas.length} libres` : ''}
          </button>
        </>
      )}
      {hoja && <HojaCita fecha={p.f} hora={p.h} sala={p.s} onCerrar={() => setHoja(false)} onCreada={cargar}/>}
    </div>
  )
}

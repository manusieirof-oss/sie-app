'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { hoyISO } from '@/lib/fechas'
import { bonosDe, BonoSesiones } from '@/lib/bonoSesiones'
import { cuotaVigenteDe, cargarBonosTipos } from '@/lib/bonos'
import { iniciales, nombreDe, hhmm } from '@/lib/movil'
import HojaCita from '../../components/HojaCita'

/**
 * FICHA DE BOLSILLO.
 *
 * Lo que se mira con el paciente delante o al teléfono: llamarle, escribirle, darle
 * cita, cuántas sesiones le quedan, con qué tener cuidado hoy y cuándo vuelve.
 * La ficha completa (historial, tests, sesiones…) sigue en el ordenador; abajo hay un
 * enlace por si hace falta.
 */
export default function MovilFicha() {
  const { id } = useParams() as { id: string }
  const [pac, setPac] = useState<any>(null)
  const [bonos, setBonos] = useState<BonoSesiones[]>([])
  const [cuota, setCuota] = useState<any>(null)
  const [cuidado, setCuidado] = useState<{ color: string, texto: string }[]>([])
  const [proximas, setProximas] = useState<any[]>([])
  const [hoja, setHoja] = useState(false)

  async function cargar() {
    const hoy = hoyISO()
    const [p, b, cu, al, mo, pa, ci] = await Promise.all([
      supabase.from('pacientes').select('id,nombre,apellidos,nombre_clinica,telefono,tipo_clase,estado').eq('id', id).maybeSingle(),
      bonosDe(id),
      supabase.from('bonos').select('*').eq('paciente_id', id).eq('activo', true),
      supabase.from('alertas_paciente').select('descripcion,afecta_sesion').eq('paciente_id', id).eq('activa', true),
      supabase.from('molestias').select('zona,eva').eq('paciente_id', id).eq('activa', true),
      supabase.from('patologias').select('nombre,estado').eq('paciente_id', id).neq('estado', 'resuelta'),
      supabase.from('citas').select('id,fecha,hora,sala').eq('paciente_id', id).gte('fecha', hoy).neq('estado', 'cancelada').order('fecha').order('hora').limit(4),
    ])
    setPac(p.data)
    // El bono de sesiones que está en uso: el más antiguo que no ha caducado y aún tiene
    // sesiones; si no, el último (para ver que se agotó).
    const vivos = (b.bonos || []).filter(x => !x.caducado)
    setBonos([vivos.find(x => x.restantes > 0) || vivos[vivos.length - 1]].filter(Boolean) as BonoSesiones[])
    const c = cuotaVigenteDe(cu.data || [], id)
    if (c) { const tipos = await cargarBonosTipos(false); c._nombre = tipos.find(t => t.id === c.tipo)?.nombre }
    setCuota(c)
    setCuidado([
      ...(al.data || []).map((a: any) => ({ color: 'var(--red)', texto: a.descripcion + (a.afecta_sesion ? ' · afecta a la sesión' : '') })),
      ...(mo.data || []).map((m: any) => ({ color: 'var(--red)', texto: `Molestia ${String(m.zona || '').toLowerCase()}${m.eva != null ? ' · EVA ' + m.eva : ''}` })),
      ...(pa.data || []).map((x: any) => ({ color: 'var(--amb)', texto: x.nombre + (x.estado === 'cronica' ? ' · crónica' : '') })),
    ])
    setProximas(ci.data || [])
  }
  useEffect(() => { cargar() }, [id])

  if (!pac) return <div className="m-pag"><div className="m-vacio">Cargando…</div></div>
  const tel = (pac.telefono || '').replace(/\D/g, '')
  const wa = tel ? (tel.length === 9 ? '34' + tel : tel) : ''
  const b = bonos[0]

  return (
    <div className="m-pag">
      <Link href="/movil/pacientes" className="m-volver"><Ic name="izq" size={18}/> Pacientes</Link>
      <div className="m-fcab">
        <span className={`m-av xl ${cuidado.some(c => c.color === 'var(--red)') ? 'rojo' : ''}`}>{iniciales(pac)}</span>
        <b>{nombreDe(pac)}</b>
        <small>{pac.nombre_clinica ? `"${pac.nombre_clinica}" · ` : ''}{pac.estado === 'activo' ? 'Activo' : pac.estado}</small>
      </div>

      <div className="m-acciones">
        <a href={tel ? `tel:${tel}` : undefined} className={tel ? '' : 'off'}><Ic name="telefono" size={19}/>Llamar</a>
        <a href={wa ? `https://wa.me/${wa}` : undefined} target="_blank" rel="noreferrer" className={wa ? '' : 'off'}><Ic name="mensaje" size={19}/>WhatsApp</a>
        <button onClick={() => setHoja(true)}><Ic name="calendario" size={19}/>Cita</button>
        <Link href={`/pacientes/${id}`}><Ic name="ficha" size={19}/>Ficha</Link>
      </div>

      {(b || cuota) && (
        <div className="m-tarj">
          <h4>Bono</h4>
          {b ? (
            <>
              <div className="m-bono"><b>{Math.max(0, b.restantes)} <small>de {b.sesiones_totales} sesiones</small></b>
                {b.restantes <= 2 && <span className="m-tag ambar">{b.restantes <= 0 ? 'agotado' : 'quedan pocas'}</span>}</div>
              <div className="m-puntos">{Array.from({ length: Math.min(b.sesiones_totales, 24) }, (_, i) => <i key={i} className={i < b.sesiones_totales - Math.max(0, b.restantes) ? 'v' : ''}/>)}</div>
            </>
          ) : (
            <div className="m-bono"><span>{cuota._nombre || 'Cuota mensual'}</span>
              <span className={`m-tag ${cuota.estado_pago === 'pagado' ? 'verde' : 'ambar'}`}>{cuota.estado_pago === 'pagado' ? 'Pagado' : cuota.estado_pago || 'pendiente'}</span></div>
          )}
        </div>
      )}

      <div className="m-tarj">
        <h4>Ojo con</h4>
        {cuidado.length === 0 ? <div className="m-nada">Nada que vigilar.</div>
          : cuidado.map((c, i) => <div key={i} className="m-mol"><span style={{ background: c.color }}/>{c.texto}</div>)}
      </div>

      <div className="m-tarj">
        <h4>Próximas citas</h4>
        {proximas.length === 0 ? <div className="m-nada">Sin citas.</div> : proximas.map(c => (
          <div key={c.id} className="m-prox">
            <span style={{ textTransform: 'capitalize' }}>{new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })} · {hhmm(c.hora)}</span>
            <span>Sala {c.sala}</span>
          </div>
        ))}
      </div>

      {hoja && <HojaCita pacienteId={id} onCerrar={() => setHoja(false)} onCreada={cargar}/>}
    </div>
  )
}

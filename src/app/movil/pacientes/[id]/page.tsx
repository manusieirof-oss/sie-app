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
import Cuerpo3D, { Foco3D } from '@/app/pacientes/[id]/components/Cuerpo3D'
import { puntos3DDeZona } from '@/lib/anatomia3d'
import PiezaCitas, { type FilaPieza } from '@/components/PiezaCitas'

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
  const [vista, setVista] = useState<'resumen' | 'cuerpo' | 'plan' | 'entrenos'>('resumen')
  const [marcas, setMarcas] = useState<any[]>([])
  const [plan, setPlan] = useState<FilaPieza[] | null>(null)
  const [entrenos, setEntrenos] = useState<any[] | null>(null)

  async function cargar() {
    const hoy = hoyISO()
    const [p, b, cu, al, mo, pa, ci] = await Promise.all([
      supabase.from('pacientes').select('id,nombre,apellidos,nombre_clinica,telefono,tipo_clase,estado').eq('id', id).maybeSingle(),
      bonosDe(id),
      supabase.from('bonos').select('*').eq('paciente_id', id).eq('activo', true),
      supabase.from('alertas_paciente').select('descripcion,afecta_sesion').eq('paciente_id', id).eq('activa', true),
      supabase.from('molestias').select('id,zona,eva,lado,activa').eq('paciente_id', id),
      supabase.from('patologias').select('id,nombre,zona,lado,estado').eq('paciente_id', id),
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
      ...(mo.data || []).filter((m: any) => m.activa).map((m: any) => ({ color: 'var(--red)', texto: `Molestia ${String(m.zona || '').toLowerCase()}${m.eva != null ? ' · EVA ' + m.eva : ''}` })),
      ...(pa.data || []).filter((x: any) => x.estado !== 'resuelta').map((x: any) => ({ color: 'var(--amb)', texto: x.nombre + (x.estado === 'cronica' ? ' · crónica' : '') })),
    ])
    // Para el cuerpo: todas, también las resueltas (salen en verde y apagadas).
    setMarcas([
      ...(mo.data || []).map((m: any) => ({ id: 'mol_' + m.id, zona: m.zona, lado: m.lado, titulo: m.zona, detalle: m.eva == null ? '' : `EVA ${m.eva}/10`, estado: m.activa ? 'activo' : 'resuelto', origen: 'molestia' })),
      ...(pa.data || []).map((x: any) => ({ id: 'pat_' + x.id, zona: x.zona || x.nombre, lado: x.lado, titulo: x.nombre, detalle: '', estado: x.estado === 'resuelta' ? 'resuelto' : x.estado === 'cronica' ? 'cronico' : 'activo', origen: 'patologia' })),
    ])
    setProximas(ci.data || [])
  }
  useEffect(() => { cargar() }, [id])

  // PROGRAMACIÓN: sus próximas citas con sesión, como al acabar en el torno. Se carga
  // al abrir la pestaña: las sesiones traen todos sus ejercicios y pesan.
  useEffect(() => {
    if (vista !== 'plan' || plan) return
    supabase.from('citas').select('id,fecha,hora,sesion_id,sesiones:sesion_id(nombre,partes)')
      .eq('paciente_id', id).gte('fecha', hoyISO()).neq('estado', 'cancelada').order('fecha').order('hora').limit(40)
      .then(({ data }) => {
        const PALETA = ['#5A969E', '#C9A84C', '#B0708C', '#6E8FC7', '#7C9A6B', '#C77F5A', '#8A7CC7', '#4F9C8A']
        const col: Record<string, string> = {}
        ;(data || []).forEach((c: any) => { if (c.sesion_id && !col[c.sesion_id]) col[c.sesion_id] = PALETA[Object.keys(col).length % PALETA.length] })
        setPlan((data || []).filter((c: any) => c.sesiones).map((c: any) => ({
          id: c.id, fecha: c.fecha, hora: c.hora, nueva: false, evs: [],
          ses: { nombre: c.sesiones.nombre, color: col[c.sesion_id], partes: c.sesiones.partes || [] },
        })))
      })
  }, [vista, plan, id])

  // ENTRENOS: lo que hizo, por días, en corto. Los últimos 12 días con registros.
  useEffect(() => {
    if (vista !== 'entrenos' || entrenos) return
    supabase.from('registros_ejercicio').select('id,fecha,ejercicio_nombre,series,comentario')
      .eq('paciente_id', id).order('fecha', { ascending: false }).order('id').limit(300)
      .then(({ data }) => {
        const dias: Record<string, any[]> = {}
        ;(data || []).forEach((r: any) => { if (r.fecha) (dias[r.fecha] ||= []).push(r) })
        setEntrenos(Object.entries(dias).slice(0, 12).map(([fecha, regs]) => ({ fecha, regs })))
      })
  }, [vista, entrenos, id])

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

      <div className="m-seg">
        {([['resumen', 'Resumen'], ['cuerpo', 'Cuerpo'], ['plan', 'Programación'], ['entrenos', 'Entrenos']] as const).map(([k, l]) => (
          <button key={k} className={vista === k ? 'on' : ''} onClick={() => setVista(k)}>{l}</button>
        ))}
      </div>

      {vista === 'cuerpo' && (
        <div className="m-tarj" style={{ padding: '6px 6px 12px' }}>
          <Cuerpo3D focos={focos(marcas)} alto={400}/>
          <div className="m-nada" style={{ textAlign: 'center' }}>Desliza para girarlo · toca una marca para ver qué es</div>
          {marcas.length === 0 && <div className="m-nada" style={{ textAlign: 'center', marginTop: 6 }}>Sin molestias ni patologías apuntadas.</div>}
        </div>
      )}

      {vista === 'plan' && (plan === null ? <div className="m-vacio">Cargando…</div>
        : plan.length === 0 ? <div className="m-vacio">Ninguna cita por delante tiene sesión.</div>
        : <div style={{ padding: '4px 0 10px' }}><PiezaCitas filas={plan}/></div>)}

      {vista === 'entrenos' && (entrenos === null ? <div className="m-vacio">Cargando…</div>
        : entrenos.length === 0 ? <div className="m-vacio">Todavía no hay entrenos registrados.</div>
        : entrenos.map(d => (
          <div key={d.fecha} className="m-tarj">
            <h4 style={{ textTransform: 'capitalize' }}>{new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })} · {d.regs.length} ejercicios</h4>
            {d.regs.map((r: any) => (
              <div key={r.id} className="m-ent">
                <span>{r.ejercicio_nombre || 'Ejercicio'}</span>
                <small>{resumenSeries(r.series)}</small>
                {r.comentario && <em>{r.comentario}</em>}
              </div>
            ))}
          </div>
        )))}

      {vista === 'resumen' && (b || cuota) && (
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

      {vista === 'resumen' && <div className="m-tarj">
        <h4>Ojo con</h4>
        {cuidado.length === 0 ? <div className="m-nada">Nada que vigilar.</div>
          : cuidado.map((c, i) => <div key={i} className="m-mol"><span style={{ background: c.color }}/>{c.texto}</div>)}
      </div>}

      {vista === 'resumen' && <div className="m-tarj">
        <h4>Próximas citas</h4>
        {proximas.length === 0 ? <div className="m-nada">Sin citas.</div> : proximas.map(c => (
          <div key={c.id} className="m-prox">
            <span style={{ textTransform: 'capitalize' }}>{new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })} · {hhmm(c.hora)}</span>
            <span>Sala {c.sala}</span>
          </div>
        ))}
      </div>}

      {hoja && <HojaCita pacienteId={id} onCerrar={() => setHoja(false)} onCreada={cargar}/>}
    </div>
  )
}

const COLOR: Record<string, string> = { activo: '#B05A5A', cronico: '#C9A84C', resuelto: '#5A969E' }
const RANGO: Record<string, number> = { activo: 3, cronico: 2, resuelto: 1 }

/** Molestias y patologías llevadas al cuerpo 3D: mismo criterio que la Silueta de escritorio. */
function focos(marcas: any[]): Foco3D[] {
  const fs: Foco3D[] = []
  marcas.forEach(m => puntos3DDeZona(m.zona, m.lado).forEach(pt => {
    const clave = pt.p.map(v => v.toFixed(2)).join('_')
    const ya = fs.find(f => f.clave === clave)
    if (ya) ya.marcas.push(m)
    else fs.push({ clave, p: pt.p, n: pt.n, color: '', marcas: [m] })
  }))
  fs.forEach(f => {
    const peor = [...f.marcas].sort((a, b) => RANGO[b.estado] - RANGO[a.estado])[0]
    f.color = COLOR[peor.estado]; f.apagado = peor.estado === 'resuelto'
  })
  return fs
}

/** Las series de un registro en una línea: "3 series · 10 reps · 20 kg". */
function resumenSeries(series: any): string {
  const ss = (Array.isArray(series) ? series : []).filter((x: any) => x && Object.values(x).some(v => v !== null && v !== '' && v !== undefined))
  if (!ss.length) return 'sin datos'
  const max = (k: string) => Math.max(...ss.map((x: any) => parseFloat(x[k]) || 0))
  const partes = [`${ss.length} ${ss.length === 1 ? 'serie' : 'series'}`]
  if (max('reps')) partes.push(`${max('reps')} reps`)
  if (max('segundos')) partes.push(`${max('segundos')} s`)
  if (max('metros')) partes.push(`${max('metros')} m`)
  if (max('peso')) partes.push(`${max('peso')} kg`)
  else if (ss.some((x: any) => x.banda)) partes.push('banda ' + ss.find((x: any) => x.banda).banda)
  return partes.join(' · ')
}

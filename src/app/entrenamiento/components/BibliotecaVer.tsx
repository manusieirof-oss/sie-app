'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import FichaEjercicio from '@/components/FichaEjercicio'
import ExploradorEjercicios from '@/components/ExploradorEjercicios'
import { supabase } from '@/lib/supabase'
import { traerTodo } from '@/lib/paginar'
import { contiene } from '@/lib/texto'
import { Ic } from '@/lib/icons'

// ---------------------------------------------------------------------------
// LA BIBLIOTECA, SOLO PARA MIRAR (todos los niveles; editar se hace en el torno).
//
// El entrenador tiene que poder consultar los ejercicios —cómo se hacen, en qué fijarse,
// qué variantes hay— sin poder tocarlos: cambiar uno lo cambia para todas las sesiones
// que lo usan. Es la misma rejilla de siempre; al tocar un ejercicio se abre su cromo
// (FichaEjercicio: la animación 3D y todo lo que hay que saber), sin campos que editar.
//
// LA BIBLIOTECA DE UN CLIENTE. Arriba hay un buscador de clientes: al elegir uno, la
// rejilla se queda con SUS ejercicios (los que tiene en sus sesiones y los que ya se le
// han apuntado en el taller) y todas las cifras pasan a ser las suyas, no las de la
// clínica. Es la pregunta de verdad en la sala: «¿qué ha hecho este y cuánto?».
// ---------------------------------------------------------------------------

type Pac = { id: string, nombre: string, apellidos?: string, nombre_clinica?: string }
const nombrePac = (p: Pac) => [p.nombre, p.apellidos].filter(Boolean).join(' ')

/** Los ejercicios de las sesiones del cliente, con los objetivos a los que se engancharon. */
function itemsDeSesiones(sesiones: any[]) {
  const out: { sesion: string, ej: string, objetivos: string[] }[] = []
  sesiones.forEach(s => {
    const partes = Array.isArray(s.partes) ? s.partes : []
    partes.forEach((p: any) => (Array.isArray(p?.ejercicios) ? p.ejercicios : []).forEach((it: any) => {
      if (it?.ejercicio_id) out.push({ sesion: s.id, ej: it.ejercicio_id, objetivos: Array.isArray(it.objetivos) ? it.objetivos : [] })
    }))
  })
  return out
}

export default function BibliotecaVer({ ejercicios, etiquetas, pacientes = [], amasar = false }: { ejercicios: any[], etiquetas: any[],
  /** Clientes para el buscador (los activos, los mismos que en el resto de Entrenamiento). */
  pacientes?: Pac[],
  /** Nivel 3+: atajos al torno para editar o crear. La edición vive allí, no aquí, para que
      la biblioteca sea solo un sitio de consulta y no haya dos editores distintos. */
  amasar?: boolean }) {
  const router = useRouter()
  const [viendo, setViendo] = useState<any>(null)
  // useCallback: el cromo escucha Esc con esta función y no debe re-engancharse en cada render.
  const cerrar = useCallback(() => setViendo(null), [])

  // ---- El buscador de clientes ----
  const [q, setQ] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [pac, setPac] = useState<Pac | null>(null)
  const caja = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const fuera = (e: MouseEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false) }
    document.addEventListener('mousedown', fuera); return () => document.removeEventListener('mousedown', fuera)
  }, [])
  const encontrados = useMemo(() => !q.trim() ? [] : pacientes
    .filter(p => contiene(nombrePac(p), q) || contiene(p.nombre_clinica, q)).slice(0, 8), [q, pacientes])

  // ---- Lo del cliente: sus ejercicios y sus cifras ----
  const [resumenPac, setResumenPac] = useState<Record<string, any> | null>(null)
  const [cargando, setCargando] = useState(false)
  useEffect(() => {
    if (!pac) { setResumenPac(null); return }
    let vivo = true
    setCargando(true)
    Promise.all([
      traerTodo((d, h) => supabase.from('registros_ejercicio').select('ejercicio_id,fecha').eq('paciente_id', pac.id).order('id').range(d, h)),
      supabase.from('sesiones').select('id,partes').eq('paciente_id', pac.id),
      supabase.from('objetivos').select('id,nombre'),
    ]).then(([reg, ses, objs]) => {
      if (!vivo) return
      const nomObj = Object.fromEntries((objs.data || []).map((o: any) => [o.id, o.nombre]))
      const r: Record<string, any> = {}
      const de = (id: string) => (r[id] ||= { veces: 0, sesiones: 0, ultima: null, pacientes: 1, _ses: new Set<string>(), _obj: {} as Record<string, Set<string>> })
      reg.filas.forEach((f: any) => {
        if (!f.ejercicio_id) return
        const x = de(f.ejercicio_id); x.veces++
        if (f.fecha && (!x.ultima || f.fecha > x.ultima)) x.ultima = f.fecha
      })
      itemsDeSesiones(ses.data || []).forEach(it => {
        const x = de(it.ej); x._ses.add(it.sesion)
        it.objetivos.forEach(o => { const n = nomObj[o]; if (n) (x._obj[n] ||= new Set()).add(it.sesion) })
      })
      // Mismo formato que la vista ejercicio_resumen, para que la rejilla y el cromo lo lean igual.
      Object.values(r).forEach((x: any) => {
        x.sesiones = x._ses.size
        x.objetivos = Object.entries(x._obj).map(([nombre, s]: any) => ({ nombre, n: s.size })).sort((a: any, b: any) => b.n - a.n)
        delete x._ses; delete x._obj
      })
      setResumenPac(r); setCargando(false)
    })
    return () => { vivo = false }
  }, [pac])

  const lista = pac && resumenPac ? ejercicios.filter(e => resumenPac[e.id]) : ejercicios

  return (
    <div>
      {!amasar && <div style={{ fontSize: 12.5, color: 'var(--gr)', background: 'var(--bl)', borderRadius: 10, padding: '8px 12px', marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 8 }}>
        <Ic name="ojo" size={14}/> Para consultar: toca un ejercicio para ver cómo se hace. Cambiarlo es cosa del encargado/a.
      </div>}

      {/* EL CLIENTE. Sin elegir, la biblioteca es la de la clínica; elegido, la suya. */}
      <div ref={caja} style={{ position: 'relative', marginBottom: 12 }}>
        {pac ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--gl)', border: '1px solid var(--gm)', borderRadius: 12, padding: '8px 10px 8px 14px' }}>
            <Ic name="pacientes" size={16}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: 'var(--n)' }}>Biblioteca de <b style={{ fontWeight: 600 }}>{nombrePac(pac)}</b></div>
              <div style={{ fontSize: 12, color: 'var(--gd)' }}>{cargando ? 'Cargando sus ejercicios…' : `${lista.length} ejercicios: los de sus sesiones y los que ya ha hecho. Las cifras son las suyas.`}</div>
            </div>
            <button className="btn btn-s btn-sm" onClick={() => { setPac(null); setQ('') }}><Ic name="cerrar" size={12}/> Ver toda la clínica</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--bd)', borderRadius: 12, padding: '0 12px', background: 'var(--w)' }}>
            <Ic name="pacientes" size={15}/>
            <input className="input" value={q} onChange={e => { setQ(e.target.value); setAbierto(true) }} onFocus={() => setAbierto(true)}
              placeholder="Buscar cliente para ver su biblioteca…" style={{ border: 'none', boxShadow: 'none', padding: '10px 0', background: 'transparent' }}/>
          </div>
        )}
        {!pac && abierto && encontrados.length > 0 && (
          <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)', zIndex: 20, background: 'var(--w)', border: '1px solid var(--bd)',
            borderRadius: 12, boxShadow: '0 8px 24px rgba(38,40,37,.14)', overflow: 'hidden' }}>
            {encontrados.map(p => (
              <div key={p.id} className="pop-it" style={{ padding: '9px 14px', cursor: 'pointer' }}
                onClick={() => { setPac(p); setAbierto(false) }}>{nombrePac(p)}</div>
            ))}
          </div>
        )}
      </div>

      {pac && !cargando && lista.length === 0
        ? <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--gr)', fontSize: 14 }}>
            {nombrePac(pac)} todavía no tiene ejercicios: ni en sesiones ni apuntados.</div>
        : <ExploradorEjercicios ejercicios={lista} etiquetas={etiquetas} botonCrear={false} onAbrir={setViendo} paneles
            resumenFijo={pac ? resumenPac : null}
            acciones={amasar ? <button className="btn btn-p btn-sm" onClick={() => router.push('/torno/amasar/nuevo')}>+ Nuevo ejercicio</button> : undefined}/>}

      {viendo && <FichaEjercicio ejercicio={viendo} ejercicios={ejercicios} etiquetas={etiquetas} amasar={amasar}
        paciente={pac ? { id: pac.id, nombre: pac.nombre } : null} usoPaciente={resumenPac?.[viendo.id]}
        onCambiar={setViendo} onCerrar={cerrar}/>}
    </div>
  )
}

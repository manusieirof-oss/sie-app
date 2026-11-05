'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import FichaEjercicio from '@/components/FichaEjercicio'
import ExploradorEjercicios from '@/components/ExploradorEjercicios'
import { supabase } from '@/lib/supabase'
import { traerTodo } from '@/lib/paginar'
import { Ic } from '@/lib/icons'
import BuscadorPacientes from '@/components/BuscadorPacientes'
import { useConfigTrabajo } from '@/components/TrabajoEjercicio'
import { intensidadesPorEjercicio } from '@/lib/mapaTrabajo'
import { sumarDias, hoyISO } from '@/lib/fechas'

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
  const [pac, setPac] = useState<Pac | null>(null)

  // ---- Lo del cliente: sus ejercicios y sus cifras ----
  const [resumenPac, setResumenPac] = useState<Record<string, any> | null>(null)
  const [cargando, setCargando] = useState(false)
  useEffect(() => {
    if (!pac) { setResumenPac(null); return }
    let vivo = true
    setCargando(true)
    Promise.all([
      traerTodo((d, h) => supabase.from('registros_ejercicio').select('ejercicio_id,fecha,capacidad').eq('paciente_id', pac.id).order('id').range(d, h)),
      supabase.from('sesiones').select('id,partes').eq('paciente_id', pac.id),
      supabase.from('objetivos').select('id,nombre'),
    ]).then(([reg, ses, objs]) => {
      if (!vivo) return
      const nomObj = Object.fromEntries((objs.data || []).map((o: any) => [o.id, o.nombre]))
      const r: Record<string, any> = {}
      const de = (id: string) => (r[id] ||= { veces: 0, sesiones: 0, ultima: null, pacientes: 1, _ses: new Set<string>(), _obj: {} as Record<string, Set<string>>, _cap: {} as Record<string, number> })
      reg.filas.forEach((f: any) => {
        if (!f.ejercicio_id) return
        const x = de(f.ejercicio_id); x.veces++
        if (f.fecha && (!x.ultima || f.fecha > x.ultima)) x.ultima = f.fecha
        const c = String(f.capacidad || '').trim(); if (c) x._cap[c] = (x._cap[c] || 0) + 1
      })
      itemsDeSesiones(ses.data || []).forEach(it => {
        const x = de(it.ej); x._ses.add(it.sesion)
        it.objetivos.forEach(o => { const n = nomObj[o]; if (n) (x._obj[n] ||= new Set()).add(it.sesion) })
      })
      // Mismo formato que la vista ejercicio_resumen, para que la rejilla y el cromo lo lean igual.
      Object.values(r).forEach((x: any) => {
        x.sesiones = x._ses.size
        x.objetivos = Object.entries(x._obj).map(([nombre, s]: any) => ({ nombre, n: s.size })).sort((a: any, b: any) => b.n - a.n)
        x.capacidades = Object.entries(x._cap).map(([nombre, n]) => ({ nombre, n })).sort((a: any, b: any) => b.n - a.n)
        delete x._ses; delete x._obj; delete x._cap
      })
      setResumenPac(r); setCargando(false)
    })
    return () => { vivo = false }
  }, [pac])

  const lista = pac && resumenPac ? ejercicios.filter(e => resumenPac[e.id]) : ejercicios

  /* LA INTENSIDAD DE CADA EJERCICIO, de las series apuntadas el último año
     (lib/mapaTrabajo: intensidadesPorEjercicio). Se trae una vez, en segundo plano, y de
     ahí sale tanto la de la clínica como la del cliente elegido. */
  const cfg = useConfigTrabajo()
  const [regs, setRegs] = useState<any[] | null>(null)
  useEffect(() => {
    traerTodo((d, h) => supabase.from('registros_ejercicio').select('ejercicio_id,series,regimen,paciente_id')
      .gte('fecha', sumarDias(hoyISO(), -365)).order('id').range(d, h)).then(r => setRegs(r.filas))
  }, [])
  const porId = useMemo(() => Object.fromEntries(ejercicios.map(e => [e.id, e])), [ejercicios])
  const intensidades = useMemo(() => !regs ? null
    : intensidadesPorEjercicio(pac ? regs.filter(r => r.paciente_id === pac.id) : regs, porId, cfg), [regs, pac, porId, cfg])

  return (
    <div>
      {!amasar && <div style={{ fontSize: 12.5, color: 'var(--gr)', background: 'var(--bl)', borderRadius: 10, padding: '8px 12px', marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 8 }}>
        <Ic name="ojo" size={14}/> Para consultar: toca un ejercicio para ver cómo se hace. Cambiarlo es cosa del encargado/a.
      </div>}

      {/* Sin ejercicios suyos se avisa, pero la barra sigue: desde ella se cambia de cliente. */}
      {pac && !cargando && lista.length === 0 && <div style={{ textAlign: 'center', padding: '10px 0 14px', color: 'var(--gr)', fontSize: 14 }}>
        {nombrePac(pac)} todavía no tiene ejercicios: ni en sesiones ni apuntados.</div>}
      <ExploradorEjercicios ejercicios={lista} etiquetas={etiquetas} botonCrear={false} onAbrir={setViendo} paneles
            resumenFijo={pac ? resumenPac : null} intensidades={intensidades}
            // EL CLIENTE, con el buscador de pacientes de toda la app y en la misma línea
            // que el de ejercicios. Sin elegir, la biblioteca es la de la clínica; elegido, la suya.
            antesDelBuscador={<div data-guia="bib-cliente" title={pac ? (cargando ? 'Cargando sus ejercicios…' : `${lista.length} ejercicios suyos: los de sus sesiones y los que ya ha hecho. Las cifras son las suyas.`) : undefined}>
              <BuscadorPacientes flotante pacientes={pacientes} valor={pac?.id || ''} max={10}
                placeholder="Buscar cliente para ver su biblioteca…"
                onElegir={(p: any) => setPac(p)} onLimpiar={() => setPac(null)}/></div>}
            acciones={amasar ? <button type="button" onClick={() => router.push('/torno/amasar/nuevo')} title="Nuevo ejercicio (se crea en el torno)" aria-label="Nuevo ejercicio"
              style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--bd)', background: 'var(--w)', color: 'var(--g)', fontSize: 18, lineHeight: 1, cursor: 'pointer' }}>+</button> : undefined}/>

      {viendo && <FichaEjercicio ejercicio={viendo} ejercicios={ejercicios} etiquetas={etiquetas} amasar={amasar}
        paciente={pac ? { id: pac.id, nombre: pac.nombre } : null} usoPaciente={resumenPac?.[viendo.id]} intensidades={intensidades ? (intensidades[viendo.id] || []) : undefined}
        onCambiar={setViendo} onCerrar={cerrar}/>}
    </div>
  )
}

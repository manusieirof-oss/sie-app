'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { traerTodo } from '@/lib/paginar'
import ImagenEjercicio from '@/components/ImagenEjercicio'

// ---------------------------------------------------------------------------
// MASAJES: dos familias de una vez. Página de un solo uso (como familias/sembrar).
//
// La función es la misma y lo que cambia es la zona, así que cada masaje es una
// FAMILIA: un principal con lo común (descripción, ejecución, feedbacks, material) y
// una variante por músculo, que lleva su músculo como etiqueta. Así la figura marca
// la zona, los avisos de molestias tocan la variante justa y en la biblioteca se ve
// una sola tarjeta con sus variantes.
//
// Ejecución y feedbacks llegan EN AMARILLO (por revisar): son un punto de partida
// para que el fisio los confirme o cambie. Se mide por tiempo, sin carga.
// Se puede abrir varias veces: lo que ya existe (por nombre) no se repite.
// ---------------------------------------------------------------------------

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

type Var = { zona: string, musculos: string[], posicion: string }
type Familia = { nombre: string, material: string, descripcion: string, ejecucion: string[], feedbacks: string[], vars: Var[] }

const FAMILIAS: Familia[] = [
  {
    nombre: 'Masaje con roller', material: 'roller',
    descripcion: 'Rodar la zona sobre el roller despacio, buscando los puntos de más tensión y parando en ellos. El peso del cuerpo regula la presión.',
    ejecucion: ['Movimiento lento y controlado, de un extremo al otro del músculo', 'Parar 20-30 s en los puntos de más tensión',
      'Respiración tranquila, sin bloquear', 'Sin rodar sobre articulaciones ni zonas óseas'],
    feedbacks: ['Más despacio', 'Quédate en ese punto y respira', 'Suelta la zona, no la aprietes', 'Apoya más o menos peso según moleste'],
    vars: [
      { zona: 'Cuádriceps', musculos: ['cuadriceps'], posicion: 'prono' },
      { zona: 'Isquiotibiales', musculos: ['isquiotibial'], posicion: 'sentado>en el suelo' },
      { zona: 'Gemelos', musculos: ['triceps sural'], posicion: 'sentado>en el suelo' },
      { zona: 'Glúteo', musculos: ['gluteo'], posicion: 'sentado>en el suelo' },
      { zona: 'Aductores', musculos: ['aductores'], posicion: 'prono' },
      { zona: 'TFL y cintilla', musculos: ['abductor - tfl'], posicion: 'decubito lateral' },
      { zona: 'Dorsal ancho', musculos: ['espalda>dorsal ancho'], posicion: 'decubito lateral' },
      { zona: 'Columna torácica', musculos: ['espalda>erectores espinales'], posicion: 'supino>rodillas flexionadas' },
      { zona: 'Tibial anterior', musculos: ['tibial>tibial anterior'], posicion: 'cuadrupedia' },
    ],
  },
  {
    nombre: 'Masaje con pelota', material: 'pelota',
    descripcion: 'Presión localizada con la pelota sobre un punto de tensión, contra el suelo o la pared. Se busca el punto, se mantiene y se suelta.',
    ejecucion: ['Buscar el punto con movimientos pequeños', 'Mantener la presión 30-60 s hasta que ceda',
      'Molestia tolerable, nunca dolor agudo', 'Respiración lenta durante la presión'],
    feedbacks: ['Busca el punto que más tira', 'Mantén ahí y respira', 'Menos presión si duele', 'Suelta poco a poco'],
    vars: [
      { zona: 'Glúteo y piramidal', musculos: ['gluteo - piramidal'], posicion: 'sentado>en el suelo' },
      { zona: 'Trapecio', musculos: ['trapecio>superior'], posicion: 'supino' },
      { zona: 'Pectoral', musculos: ['pectoral'], posicion: 'bipedestacion' },
      { zona: 'Planta del pie', musculos: [], posicion: 'bipedestacion' },
      { zona: 'Romboides', musculos: ['espalda>romboides mayor'], posicion: 'supino' },
    ],
  },
]

export default function SembrarMasajes() {
  const router = useRouter()
  const [ets, setEts] = useState<any[]>([])
  const [ejs, setEjs] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [log, setLog] = useState<string[]>([])
  const [haciendo, setHaciendo] = useState(false)
  const [hecho, setHecho] = useState(false)

  async function cargar() {
    const [a, b] = await Promise.all([
      traerTodo((d, h) => supabase.from('etiquetas').select('id,nombre,padre_id,categoria').order('id').range(d, h)),
      traerTodo((d, h) => supabase.from('ejercicios').select('id,nombre,portada_id').order('id').range(d, h)),
    ])
    setEts(a.filas); setEjs(b.filas); setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  /** Etiqueta por su camino "raíz>hija" (sin tildes), dentro de su categoría. */
  const porCamino = useMemo(() => {
    const raizDe = (e: any) => { let r = e; const v = new Set(); while (r?.padre_id && !v.has(r.id)) { v.add(r.id); r = ets.find(x => x.id === r.padre_id) || r; if (!r.padre_id) break } return r }
    const m: Record<string, any> = {}
    ets.forEach(e => {
      const r = raizDe(e); const cat = r?.categoria || e.categoria
      const c = r && r.id !== e.id ? `${norm(r.nombre)}>${norm(e.nombre)}` : norm(e.nombre)
      m[`${cat}:${c}`] = e
    })
    return m
  }, [ets])
  const et = (cat: string, camino: string) => porCamino[`${cat}:${camino}`]
  const existe = (nombre: string) => ejs.find(e => norm(e.nombre) === norm(nombre))

  async function crear() {
    setHaciendo(true); setLog([])
    const apunta = (t: string) => setLog(l => [...l, t])
    for (const f of FAMILIAS) {
      const mat = et('material', f.material)
      const comun = {
        descripcion: f.descripcion, tipo_medida: 'tiempo', video_url: '', imagen_url: '', variantes: [],
        items_ejecucion: f.ejecucion.map(texto => ({ texto })), feedbacks: f.feedbacks.map(texto => ({ texto })),
        por_revisar: ['ejecucion', 'feedbacks'],
      }
      let principal = existe(f.nombre)
      if (!principal) {
        const { data, error } = await supabase.from('ejercicios')
          .insert({ ...comun, nombre: f.nombre, etiquetas: mat ? [mat.id] : [], portada_id: null }).select('id,nombre,portada_id').single()
        if (error || !data) { apunta(`✗ ${f.nombre}: ${error?.message}`); continue }
        principal = data; apunta(`✓ ${f.nombre} (principal)`)
      } else apunta(`· ${f.nombre} ya existía`)
      for (const v of f.vars) {
        const nombre = `${f.nombre} · ${v.zona}`
        if (existe(nombre)) { apunta(`· ${nombre} ya existía`); continue }
        const etiquetas = [mat?.id, et('posicion', v.posicion)?.id, ...v.musculos.map(m => et('musculo', m)?.id)].filter(Boolean)
        const { error } = await supabase.from('ejercicios').insert({ ...comun, nombre, etiquetas, portada_id: principal.id })
        apunta(error ? `✗ ${nombre}: ${error.message}` : `✓ ${nombre}`)
      }
    }
    await cargar()
    setHaciendo(false); setHecho(true)
  }

  if (cargando) return <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Cargando…</div>

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '10px 4px 60px' }}>
      <div style={{ fontSize: 20, marginBottom: 4 }}>Masajes en familias</div>
      <div style={{ fontSize: 12.5, color: 'var(--gr)', marginBottom: 18 }}>
        Dos familias: un principal con lo común y una variante por zona. Ejecución y feedbacks llegan en amarillo para que los revises.
        Lo que ya existe no se repite.
      </div>
      {FAMILIAS.map(f => (
        <div key={f.nombre} style={{ background: '#fff', borderRadius: 18, padding: '14px 16px', marginBottom: 14, boxShadow: '0 4px 16px rgba(38,40,37,.08)' }}>
          <div style={{ fontSize: 15, marginBottom: 2 }}>{f.nombre} {existe(f.nombre) && <span style={{ fontSize: 11, color: 'var(--gd)' }}>· ya existe</span>}</div>
          <div style={{ fontSize: 11.5, color: et('material', f.material) ? 'var(--gr)' : 'var(--red)', marginBottom: 10 }}>
            Material: {et('material', f.material)?.nombre || `no encuentro "${f.material}"`} · se mide por tiempo
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 10 }}>
            {f.vars.map(v => {
              const nombre = `${f.nombre} · ${v.zona}`
              const ids = [et('material', f.material)?.id, et('posicion', v.posicion)?.id, ...v.musculos.map(m => et('musculo', m)?.id)].filter(Boolean)
              const faltan = [...v.musculos.filter(m => !et('musculo', m)), ...(et('posicion', v.posicion) ? [] : [v.posicion])]
              const ya = existe(nombre)
              return (
                <div key={v.zona} onClick={() => ya && router.push(`/torno/amasar/${ya.id}`)}
                  style={{ borderRadius: 12, overflow: 'hidden', background: '#fff', boxShadow: '0 2px 9px rgba(38,40,37,.10)', cursor: ya ? 'pointer' : 'default', opacity: ya ? .75 : 1 }}>
                  <ImagenEjercicio etiquetasEj={ids} radio={0} fondo="var(--bl)" icono={20}/>
                  <div style={{ padding: '6px 8px', fontSize: 12 }}>
                    {v.zona}
                    {ya && <div style={{ fontSize: 10.5, color: 'var(--gd)' }}>✓ creado</div>}
                    {!ya && faltan.length > 0 && <div style={{ fontSize: 10.5, color: '#A87E2C' }}>Sin etiqueta: {faltan.join(', ')}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn btn-p" disabled={haciendo} onClick={crear}><Ic name="mas" size={13}/> {haciendo ? 'Creando…' : hecho ? 'Volver a pasar' : 'Crear los masajes'}</button>
        {hecho && <button className="btn btn-t" onClick={() => router.push('/torno?que=ejercicios')}>Ir al torno</button>}
      </div>
      {log.length > 0 && (
        <div style={{ marginTop: 14, fontSize: 12, lineHeight: 1.7, color: 'var(--gd)' }}>{log.map((l, i) => <div key={i}>{l}</div>)}</div>
      )}
    </div>
  )
}

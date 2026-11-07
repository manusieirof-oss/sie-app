'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ZONAS } from '@/lib/mapaTrabajo'
import { RAMPA } from '@/lib/rampaCalor'
import { zonasDeTest } from '@/lib/zonasCuerpo'
import { hoyISO } from '@/lib/fechas'
import type { MapaCalor3D } from '@/lib/anim3d/mapaCalor'

// ---------------------------------------------------------------------------
// EL CUERPO DE SU SALUD (ficha): el mismo muñeco del mapa de calor, pero pintado con lo
// que le pasa, no con lo que entrena. Vistas:
//   · Dolor ahora   — molestias ACTIVAS, más intenso cuanto más EVA. Es lo que más
//                     importa en el momento en que está y antes no se veía en la ficha.
//   · Operaciones   — sus operaciones (la zona sale de la biblioteca de operaciones).
//   · Patologías    — las que no están resueltas (crónicas, un poco más suaves).
//   · Toda su salud — todo junto, cada cosa con su color (y los tests), más lo que no
//                     tiene zona (alergias, medicación, deportes) y bienestar y estrés.
// Las zonas se guardan como texto ("Rodilla", "Columna lumbar"…): se buscan en las zonas
// del cuerpo por su nombre y sus articulaciones.
// ---------------------------------------------------------------------------

export type VistaSalud = 'dolor' | 'operaciones' | 'patologias' | 'todo'
const nrm = (t: string) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
/** Texto de zona → zonas del muñeco (puede tocar más de una, p. ej. «columna»). */
function zonasDe(texto: string): string[] {
  const t = nrm(texto)
  if (!t) return []
  const ks = ZONAS.filter(z => [z.n, ...z.art].some(a => t.includes(nrm(a)))).map(z => z.k)
  if (ks.length) return ks
  if (/espalda baja|lumbo/.test(t)) return ['lumbar']
  if (/espalda|torac/.test(t)) return ['dorsal']
  if (/cuello/.test(t)) return ['cervical']
  if (/tobill|aquil/.test(t)) return ['tobillo']
  if (/menisco|ligamento cruzado|rotul/.test(t)) return ['rodilla']
  if (/manguito|supraesp/.test(t)) return ['hombro']
  return []
}

/* Los tests tienen sus propias zonas (las del mapa de tests de Salud, lib/zonasCuerpo):
   aquí se pasan a las del muñeco 3D. */
const ZONA_TEST: Record<string, string[]> = {
  cuello: ['cervical'], hombro: ['hombro'], pecho: ['dorsal'], espalda: ['dorsal'], brazo: ['codo'],
  antebrazo: ['muneca'], abdomen: ['lumbar'], lumbar: ['lumbar'], cadera: ['cadera'], muslo: ['cadera', 'rodilla'],
  rodilla: ['rodilla'], pierna: ['tobillo'], pie: ['tobillo'],
}

type Tipo = 'molestia' | 'operacion' | 'patologia' | 'test'
const TIPOS: Record<Tipo, { t: string, uno: string, c: string }> = {
  molestia: { t: 'Molestias', uno: 'Molestia', c: '#C0392B' },
  operacion: { t: 'Operaciones', uno: 'Operación', c: '#8E6FB5' },
  patologia: { t: 'Patologías', uno: 'Patología', c: '#D4A017' },
  test: { t: 'Tests', uno: 'Test', c: '#7C9A6B' },
}
// Un test se pinta por su RESULTADO: verde si salió bien, naranja si hay hallazgo.
const TEST_BIEN = '#7C9A6B', TEST_HALLAZGO = '#E07B39'
// La huella de una molestia ya quitada: 3 semanas por punto de EVA (igual que la nebulosa).
const HUELLA_DIAS_POR_EVA = 21
const DIA = 864e5
const diasEntre = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / DIA)
const fCorta = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' }).replace('.', '')

type Item = { titulo: string, detalle: string, zonas: string[], v: number, lado?: string, tipo?: Tipo, color?: string, tend?: 'mejora' | 'empeora' | 'igual' | null }
type Extra = { pills: { t: string, ojo?: boolean }[], escalas: { t: string, v: number, antes: number | null, mejorSiSube: boolean }[] }

/* EL LADO. Las zonas que van por pares (hombro, rodilla…) tienen un hueso por lado en el
   muñeco (…D derecho, …I izquierdo). Si algo es de un lado, se pinta SOLO en ese: si no,
   una rodilla bien y la otra mal salían mezcladas en las dos. Bilateral o sin lado, en
   las dos. Las del centro (cervical, lumbar…) no tienen lado.
   La clave de cada esfera es «zona|I», «zona|D» o «zona|C» (centro). */
const ladoDe = (l?: string) => l === 'izquierdo' ? 'I' : l === 'derecho' ? 'D' : ''
const tienePares = (z: any) => z.huesos.some((h: string) => h.endsWith('D')) && z.huesos.some((h: string) => h.endsWith('I'))
/** En qué claves (zona|lado) cae una cosa. */
function clavesDe(it: Item): string[] {
  const l = ladoDe(it.lado)
  return it.zonas.flatMap(k => { const z = ZONAS.find(x => x.k === k); if (!z) return []
    if (!tienePares(z)) return [`${k}|C`]
    return l ? [`${k}|${l}`] : [`${k}|I`, `${k}|D`] })
}
const nombreClave = (c: string) => { const [k, l] = c.split('|'); const n = ZONAS.find(z => z.k === k)?.n || k; return l === 'I' ? `${n} izquierdo` : l === 'D' ? `${n} derecho` : n }

/** Mezcla de colores de una zona, pesando cada cosa por lo fuerte que es. */
function mezcla(lista: Item[]) {
  let r = 0, g = 0, b = 0, w = 0
  lista.forEach(it => { const c = it.color || '#888888', f = it.v || 0.01
    r += parseInt(c.slice(1, 3), 16) * f; g += parseInt(c.slice(3, 5), 16) * f; b += parseInt(c.slice(5, 7), 16) * f; w += f })
  const h = (x: number) => Math.round(x / w).toString(16).padStart(2, '0')
  return '#' + h(r) + h(g) + h(b)
}

export default function CuerpoSalud({ pacienteId, vista }: { pacienteId: string, vista: VistaSalud }) {
  const [items, setItems] = useState<Item[] | null>(null)
  const [extra, setExtra] = useState<Extra | null>(null)
  const [activos, setActivos] = useState<Set<Tipo>>(new Set(Object.keys(TIPOS) as Tipo[]))
  const [zonaSel, setZonaSel] = useState<string | null>(null)
  useEffect(() => {
    setItems(null); setExtra(null); setZonaSel(null)
    ;(async () => {
      if (vista === 'dolor') {
        const { data } = await supabase.from('molestias').select('zona,eva,lado,tipo').eq('paciente_id', pacienteId).eq('activa', true)
        setItems((data || []).map((m: any) => ({ titulo: m.zona, detalle: [m.eva != null ? `EVA ${m.eva}/10` : 'sin EVA', m.lado && m.lado !== 'no_aplica' ? m.lado : ''].filter(Boolean).join(' · '),
          zonas: zonasDe(m.zona), lado: m.lado, v: m.eva != null ? Math.max(0.25, m.eva / 10) : 0.5 })))
      } else if (vista === 'operaciones') {
        const { data } = await supabase.from('operaciones').select('nombre,anio,lado,biblioteca_id').eq('paciente_id', pacienteId)
        const ids = (data || []).map((o: any) => o.biblioteca_id).filter(Boolean)
        const { data: bib } = ids.length ? await supabase.from('operaciones_biblioteca').select('id,zona').in('id', ids) : { data: [] as any[] }
        const zDe = Object.fromEntries((bib || []).map((b: any) => [b.id, b.zona || '']))
        setItems((data || []).map((o: any) => ({ titulo: o.nombre, detalle: [o.anio, o.lado && o.lado !== 'no_aplica' ? o.lado : ''].filter(Boolean).join(' · '),
          zonas: zonasDe(`${zDe[o.biblioteca_id] || ''} ${o.nombre}`), lado: o.lado, v: 0.8 })))
      } else if (vista === 'patologias') {
        const { data } = await supabase.from('patologias').select('nombre,zona,estado,lado').eq('paciente_id', pacienteId).neq('estado', 'resuelta')
        setItems((data || []).map((p: any) => ({ titulo: p.nombre, detalle: p.estado === 'cronica' ? 'crónica' : 'activa',
          zonas: zonasDe(`${p.zona || ''} ${p.nombre}`), lado: p.lado, v: p.estado === 'cronica' ? 0.55 : 0.85 })))
      } else {
        await cargarTodo()
      }
    })()
  }, [pacienteId, vista]) // eslint-disable-line react-hooks/exhaustive-deps

  /** TODA SU SALUD: cada cosa con su tipo y su color; lo que no tiene zona, aparte. */
  async function cargarTodo() {
    const hoy = hoyISO()
    // Molestias con el día en que se quitaron (si falta la columna, sin él).
    let mol: any = await supabase.from('molestias').select('zona,eva,lado,activa,created_at,resuelta_el').eq('paciente_id', pacienteId)
    if (mol.error) mol = await supabase.from('molestias').select('zona,eva,lado,activa,created_at').eq('paciente_id', pacienteId)
    const [{ data: ops }, { data: pats }, { data: res }, { data: etq }, { data: alg }, { data: intol }, { data: med }, { data: dep }, { data: esc }] = await Promise.all([
      supabase.from('operaciones').select('nombre,anio,lado,biblioteca_id').eq('paciente_id', pacienteId),
      supabase.from('patologias').select('nombre,zona,estado,lado').eq('paciente_id', pacienteId).neq('estado', 'resuelta'),
      supabase.from('resultados_tests').select('test_id,lado,fecha,resultado,created_at,tests(nombre,etiquetas_relacionadas)').eq('paciente_id', pacienteId)
        .order('fecha', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('etiquetas').select('id,nombre,padre_id'),
      supabase.from('alergias_paciente').select('nombre').eq('paciente_id', pacienteId),
      supabase.from('intolerancias_paciente').select('nombre').eq('paciente_id', pacienteId),
      supabase.from('medicamentos').select('nombre,frecuencia').eq('paciente_id', pacienteId),
      supabase.from('deportes_paciente').select('nombre').eq('paciente_id', pacienteId),
      supabase.from('escalas').select('fecha,borg,estres').eq('paciente_id', pacienteId).order('fecha', { ascending: false }).limit(2),
    ])
    const ids = (ops || []).map((o: any) => o.biblioteca_id).filter(Boolean)
    const { data: bib } = ids.length ? await supabase.from('operaciones_biblioteca').select('id,zona').in('id', ids) : { data: [] as any[] }
    const zDe = Object.fromEntries((bib || []).map((b: any) => [b.id, b.zona || '']))
    const lado = (l: string) => l && l !== 'no_aplica' ? l : ''
    const out: Item[] = []

    // MOLESTIAS: las activas, más fuertes cuanto más EVA; las ya quitadas, la huella mientras dure.
    ;(mol.data || []).forEach((m: any) => {
      const eva = m.eva ?? 5
      if (m.activa) out.push({ tipo: 'molestia', color: TIPOS.molestia.c, titulo: m.zona, zonas: zonasDe(m.zona), lado: m.lado, v: 0.4 + 0.6 * eva / 10,
        detalle: [m.eva != null ? `EVA ${m.eva}/10` : 'sin EVA', lado(m.lado), 'activa'].filter(Boolean).join(' · ') })
      else if (m.resuelta_el) {
        const dura = Math.max(1, eva) * HUELLA_DIAS_POR_EVA, pasa = diasEntre(m.resuelta_el, hoy)
        if (pasa < dura) out.push({ tipo: 'molestia', color: TIPOS.molestia.c, titulo: m.zona, zonas: zonasDe(m.zona), lado: m.lado, v: Math.max(0.12, 0.35 * (1 - pasa / dura)),
          detalle: [m.eva != null ? `EVA ${m.eva}/10` : '', lado(m.lado), `se quitó el ${fCorta(m.resuelta_el)}`].filter(Boolean).join(' · ') })
      }
    })
    ;(ops || []).forEach((o: any) => out.push({ tipo: 'operacion', color: TIPOS.operacion.c, titulo: o.nombre, lado: o.lado, v: 0.8,
      zonas: zonasDe(`${zDe[o.biblioteca_id] || ''} ${o.nombre}`), detalle: [o.anio, lado(o.lado)].filter(Boolean).join(' · ') }))
    ;(pats || []).forEach((p: any) => out.push({ tipo: 'patologia', color: TIPOS.patologia.c, titulo: p.nombre, lado: p.lado, v: p.estado === 'cronica' ? 0.55 : 0.85,
      zonas: zonasDe(`${p.zona || ''} ${p.nombre}`), detalle: [p.estado === 'cronica' ? 'crónica' : 'activa', lado(p.lado)].filter(Boolean).join(' · ') }))

    // TESTS: el último de cada test y lado. El color, por su resultado; lo vivo, por lo
    // reciente (hace un año casi no se ve: puede haber cambiado); y si mejora o empeora
    // respecto al anterior del mismo test.
    const grupos: Record<string, any[]> = {}
    ;(res || []).filter((r: any) => r.resultado === 'positivo' || r.resultado === 'negativo')
      .forEach((r: any) => { const k = `${r.test_id}|${r.lado || ''}`; (grupos[k] = grupos[k] || []).push(r) })
    Object.values(grupos).forEach(([u, ant]) => {
      const test = Array.isArray(u.tests) ? u.tests[0] : u.tests
      const meses = diasEntre(u.fecha, hoy) / 30.4, viveza = Math.max(0.2, 1 - meses / 12)
      const mal = u.resultado === 'positivo'
      const zs = Array.from(new Set(zonasDeTest(test || {}, etq || []).flatMap(z => ZONA_TEST[z] || [])))
      out.push({ tipo: 'test', color: mal ? TEST_HALLAZGO : TEST_BIEN, titulo: [test?.nombre || 'Test', lado(u.lado)].filter(Boolean).join(' · '),
        zonas: zs, lado: u.lado, v: (mal ? 0.7 : 0.45) * viveza,
        tend: !ant ? null : ant.resultado === u.resultado ? 'igual' : mal ? 'empeora' : 'mejora',
        detalle: `${fCorta(u.fecha)} · ${mal ? 'hallazgo' : 'bien'}` })
    })
    setItems(out)

    // Lo que NO tiene zona: precauciones con aviso, deportes normales.
    const pills = [
      ...(alg || []).map((a: any) => ({ t: `Alergia: ${a.nombre}`, ojo: true })),
      ...(intol || []).map((a: any) => ({ t: `Intolerancia: ${a.nombre}`, ojo: true })),
      ...(med || []).map((m: any) => ({ t: `Medicación: ${m.nombre}${m.frecuencia ? ` · ${m.frecuencia}` : ''}`, ojo: true })),
      ...(dep || []).map((d: any) => ({ t: d.nombre })),
    ]
    const [e0, e1] = esc || []
    const escalas = e0 ? [
      { t: 'Bienestar', v: e0.borg, antes: e1?.borg ?? null, mejorSiSube: true },
      { t: 'Estrés', v: e0.estres, antes: e1?.estres ?? null, mejorSiSube: false },
    ].filter(x => x.v != null) : []
    setExtra({ pills, escalas })
  }

  // El muñeco (igual que MapaTrabajo). Tocar una zona la elige (solo en «Toda su salud»).
  const caja = useRef<HTMLDivElement>(null)
  const visor = useRef<MapaCalor3D | null>(null)
  const alZona = useRef<(k: string | null) => void>(() => {})
  alZona.current = k => { if (vista === 'todo') setZonaSel(z => z === k ? null : k) }
  const [listo, setListo] = useState(false)
  const [fallo, setFallo] = useState('')
  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const { crearMapaCalor } = await import('@/lib/anim3d/mapaCalor')
        if (!caja.current) return
        const v = await crearMapaCalor(caja.current, { zona: k => alZona.current(k) })
        if (!vivo) { v.destruir(); return }
        visor.current = v; setListo(true)
      } catch (e: any) { setFallo(e?.message || 'No se pudo abrir el cuerpo 3D') }
    })()
    return () => { vivo = false; visor.current?.destruir(); visor.current = null }
  }, [])
  const visibles = (items || []).filter(it => vista !== 'todo' || (it.tipo && activos.has(it.tipo)))
  useEffect(() => {
    if (!visor.current || !items) return
    const zonas: Record<string, any> = {}
    const por: Record<string, Item[]> = {}
    visibles.forEach(it => clavesDe(it).forEach(c => { (por[c] = por[c] || []).push(it) }))
    Object.entries(por).forEach(([c, aqui]) => {
      const [k, l] = c.split('|'), z = ZONAS.find(x => x.k === k)!
      const huesos = l === 'C' ? z.huesos : z.huesos.filter((h: string) => h.endsWith(l))
      // En «Toda su salud» cada esfera lleva el color mezclado de lo que tiene; en las otras, la rampa de calor.
      zonas[c] = { v: Math.max(...aqui.map(it => it.v)), huesos, off: z.off, color: vista === 'todo' ? mezcla(aqui) : undefined }
    })
    visor.current.poner({ zonas, musculos: {} })
  }, [items, listo, activos]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { visor.current?.enfocar(zonaSel) }, [zonaSel, listo])

  const vacio = vista === 'dolor' ? 'Ahora no tiene ninguna molestia activa.' : vista === 'operaciones' ? 'Sin operaciones apuntadas.' : vista === 'patologias' ? 'Sin patologías activas.' : 'Nada con estos filtros.'
  const lista = vista === 'todo' && zonaSel ? visibles.filter(it => clavesDe(it).includes(zonaSel)) : visibles
  const sub: React.CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--gr)', margin: '14px 0 6px' }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16, alignItems: 'start' }}>
      <div>
        <div ref={caja} style={{ position: 'relative', height: 420, borderRadius: 14, background: '#fff', overflow: 'hidden' }}>
          {(!listo || !items) && !fallo && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 12, color: 'var(--grl)' }}>Cargando…</div>}
          {fallo && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 12, color: 'var(--grl)' }}>{fallo}</div>}
        </div>
        {vista === 'todo'
          ? <div style={{ fontSize: 11, color: 'var(--grl)', marginTop: 6, textAlign: 'center' }}>Toca una zona para ver qué hay ahí</div>
          : <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--grl)', marginTop: 6 }}>
              {vista === 'dolor' ? 'Poco' : 'Leve'} <span style={{ flex: 1, height: 6, borderRadius: 9, background: `linear-gradient(90deg,${RAMPA.join(',')})` }}/> {vista === 'dolor' ? 'EVA alta' : 'Activa'}
            </div>}
      </div>
      <div>
        {/* Filtros por tipo: encender o apagar cada uno. */}
        {vista === 'todo' && items && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {(Object.keys(TIPOS) as Tipo[]).map(k => (
            <button key={k} type="button" className="chip-sel" onClick={() => setActivos(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textTransform: 'none', letterSpacing: 0, opacity: activos.has(k) ? 1 : 0.4 }}>
              {k === 'test'
                ? <span style={{ display: 'inline-flex' }}><i style={{ width: 9, height: 9, borderRadius: '50%', background: TEST_BIEN }}/><i style={{ width: 9, height: 9, borderRadius: '50%', background: TEST_HALLAZGO, marginLeft: -3 }}/></span>
                : <i style={{ width: 9, height: 9, borderRadius: '50%', background: TIPOS[k].c }}/>}
              {TIPOS[k].t} {items.filter(it => it.tipo === k).length}
            </button>))}
        </div>}
        {vista === 'todo' && zonaSel && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginBottom: 4 }}>
          <b style={{ fontWeight: 600 }}>{nombreClave(zonaSel)}</b>
          <button type="button" className="chip-sel" onClick={() => setZonaSel(null)} style={{ textTransform: 'none', letterSpacing: 0 }}>Ver todo</button></div>}
        {items && lista.length === 0 && <div style={{ fontSize: 13, color: 'var(--grl)', padding: '20px 0' }}>{vacio}</div>}
        {lista.map((it, i) => (
          <div key={i} style={{ padding: '8px 0', borderTop: i ? '1px solid var(--bl)' : 'none', display: 'flex', gap: 10 }}>
            {it.tipo && <span style={{ width: 10, height: 10, borderRadius: '50%', marginTop: 5, flex: 'none', background: it.color, opacity: it.tipo === 'test' || it.v < 0.35 ? 0.4 + 0.6 * Math.min(1, it.v / 0.7) : 1 }}/>}
            <div>
              <div style={{ fontSize: 14, color: 'var(--n)', fontWeight: 500 }}>{it.titulo}
                {it.tend && <span style={{ fontSize: 11.5, fontWeight: 600, marginLeft: 6, color: it.tend === 'mejora' ? 'var(--gd)' : it.tend === 'empeora' ? '#B5562B' : 'var(--grl)' }}>
                  {it.tend === 'mejora' ? '↑ mejora' : it.tend === 'empeora' ? '↓ empeora' : '= igual'}</span>}</div>
              <div style={{ fontSize: 12, color: 'var(--gr)' }}>{it.tipo ? `${TIPOS[it.tipo].uno}${it.zonas.length ? ' · ' + it.zonas.map(k => ZONAS.find(z => z.k === k)?.n).join(', ') : ''} · ` : ''}{it.detalle}{!it.zonas.length && <span style={{ color: '#8A6410' }}> · sin zona en el cuerpo</span>}</div>
            </div>
          </div>
        ))}
        {vista === 'todo' && extra && <>
          <div style={sub}>Sin zona en el cuerpo</div>
          {extra.pills.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{extra.pills.map((p, i) => (
            <span key={i} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 99, background: p.ojo ? '#FBEAEA' : '#F1EEE8', border: `1px solid ${p.ojo ? '#E9C2C2' : 'var(--bl)'}`, color: p.ojo ? '#8A3A3A' : 'var(--n)' }}>{p.ojo ? '⚠ ' : ''}{p.t}</span>))}</div>
            : <div style={{ fontSize: 12.5, color: 'var(--grl)' }}>Sin alergias, intolerancias, medicación ni deportes apuntados.</div>}
          <div style={sub}>Bienestar y estrés</div>
          {extra.escalas.length ? <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>{extra.escalas.map(e => {
            const d = e.antes == null ? 0 : e.v - e.antes, bueno = d === 0 ? null : (d > 0) === e.mejorSiSube
            return <span key={e.t}>{e.t} <b style={{ fontWeight: 600 }}>{e.v}/10</b> {e.antes != null && <span style={{ color: bueno === null ? 'var(--grl)' : bueno ? 'var(--gd)' : '#B5562B' }}>{d === 0 ? '=' : d > 0 ? '↑' : '↓'}</span>}</span>
          })}</div> : <div style={{ fontSize: 12.5, color: 'var(--grl)' }}>Sin registros todavía.</div>}
        </>}
      </div>
    </div>
  )
}

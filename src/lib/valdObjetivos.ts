import { supabase } from '@/lib/supabase'
import { traerTodo } from '@/lib/paginar'
import { buscaDe } from '@/lib/ejercicioObjetivos'
import { reevaluarObjetivos } from '@/lib/tests'
import { traducirNombresDynamo } from '@/lib/valdTests'

// QUÉ OBJETIVOS SE EVALÚAN CON LOS TESTS DEL DYNAMO.
//
// Un test solo abre o cierra un objetivo si el objetivo dice que se evalúa con él
// (`objetivos_tests`). Los tests "Fuerza de rodilla (DynaMo)", "Rango de cadera
// (DynaMo)"... son nuevos y nadie los mira, así que aquí se proponen los enlaces
// cruzando la ARTICULACIÓN del objetivo con la del test y lo que BUSCA (fuerza →
// tests de fuerza; movilidad/estiramiento → tests de rango). Si el objetivo concreta
// movimientos (flexión, rotación interna...), se engancha solo a esos ítems del test:
// una asimetría en la extensión no tiene por qué abrir un objetivo de flexores.

const n = (t: string) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export interface Propuesta {
  objetivo: { id: string, nombre: string }
  test: { id: string, nombre: string }
  items: string[] | null         // null = el test entero
  seguro: boolean                // articulación + capacidad + (movimientos o sin concretar)
  marcado: boolean
}

export async function proponerEnlacesObjetivos(): Promise<Propuesta[]> {
  // Antes de cruzar, que los tests estén en castellano: si no, «Protraction» no casa con «Protracción».
  await traducirNombresDynamo()
  const [{ data: objs }, { data: ets }, { data: tests }, { data: ya }] = await Promise.all([
    supabase.from('objetivos').select('*'),
    supabase.from('etiquetas').select('id,nombre'),
    supabase.from('tests').select('id,nombre,items').ilike('nombre', '%(DynaMo)').is('archivado_el', null),
    supabase.from('objetivos_tests').select('objetivo_id,test_id'),
  ])
  const nombreEt = new Map<string, string>((ets || []).map((e: any) => [e.id, e.nombre]))
  const hay = new Set((ya || []).map((r: any) => `${r.objetivo_id}|${r.test_id}`))
  const dyn = (tests || []).map((t: any) => {
    const m = String(t.nombre).match(/^(Fuerza|Rango) de (.+) \(DynaMo\)$/i)
    return m ? { ...t, tipo: n(m[1]), zona: n(m[2]) } : null
  }).filter(Boolean) as any[]

  const out: Propuesta[] = []
  for (const o of objs || []) {
    if (o.archivado_el || o.activo === false) continue
    const art = n(nombreEt.get(o.articulacion_id) || '')
    if (!art) continue
    const busca = buscaDe(o)
    const quiere = new Set<string>()
    if (busca.includes('fuerza') || busca.includes('potencia')) quiere.add('fuerza')
    if (busca.includes('movilidad') || busca.includes('estiramiento')) quiere.add('rango')
    if (!quiere.size) continue
    const movs = (o.movimientos || []).map((id: string) => n(nombreEt.get(id) || '')).filter(Boolean)
    for (const t of dyn) {
      if (!quiere.has(t.tipo)) continue
      if (!(art === t.zona || art.includes(t.zona) || t.zona.includes(art))) continue
      if (hay.has(`${o.id}|${t.id}`)) continue
      let items: string[] | null = null, seguro = true
      if (movs.length) {
        const sus = (t.items || []).map((i: any) => i.nombre).filter((nom: string) => {
          const mv = n(nom.split(' · ')[0])
          return movs.some((m: string) => m.includes(mv) || mv.includes(m))
        })
        if (sus.length) items = sus
        else seguro = false   // concreta movimientos que el DynaMo no mide: que lo mires tú
      }
      out.push({ objetivo: { id: o.id, nombre: o.nombre }, test: { id: t.id, nombre: t.nombre }, items, seguro, marcado: seguro })
    }
  }
  return out.sort((a, b) => a.objetivo.nombre.localeCompare(b.objetivo.nombre))
}

/**
 * Guarda los enlaces y aplica a cada paciente el ÚLTIMO resultado de esos tests (por
 * lado): si es positivo abre el objetivo, si es negativo cierra lo que abriera. No
 * apunta resultados nuevos: solo hace con los ya guardados lo que habrían hecho si el
 * enlace hubiera existido entonces.
 */
export async function enlazarYAplicar(props: Propuesta[]): Promise<{ enlaces: number, abiertos: number, logrados: number, errores: number }> {
  const filas = props.flatMap(p => p.items
    ? p.items.map(item => ({ objetivo_id: p.objetivo.id, test_id: p.test.id, item }))
    : [{ objetivo_id: p.objetivo.id, test_id: p.test.id }])
  for (let i = 0; i < filas.length; i += 200) {
    const { error } = await supabase.from('objetivos_tests').insert(filas.slice(i, i + 200))
    if (error) throw new Error(error.message)
  }
  const tids = Array.from(new Set(props.map(p => p.test.id)))
  const { data: tests } = await supabase.from('tests').select('*').in('id', tids)
  const porId = new Map<string, any>((tests || []).map((t: any) => [t.id, t]))
  const { filas: res } = await traerTodo<any>((d, h) => supabase.from('resultados_tests')
    .select('id,paciente_id,test_id,lado,fecha,created_at,resultado,items_resultado').in('test_id', tids).order('id').range(d, h))
  // El último de cada paciente, test y lado.
  const ult = new Map<string, any>()
  for (const r of res) {
    const k = `${r.paciente_id}|${r.test_id}|${r.lado || 'bilateral'}`
    const p = ult.get(k)
    if (!p || `${r.fecha}${r.created_at}` > `${p.fecha}${p.created_at}`) ult.set(k, r)
  }
  let abiertos = 0, logrados = 0, errores = 0
  for (const r of Array.from(ult.values())) {
    try {
      const x = await reevaluarObjetivos(r.paciente_id, porId.get(r.test_id), r.items_resultado || [], r.resultado, r.lado || 'bilateral', 'DynaMo')
      abiertos += x.abiertos; logrados += x.logrados
    } catch { errores++ }
  }
  return { enlaces: filas.length, abiertos, logrados, errores }
}

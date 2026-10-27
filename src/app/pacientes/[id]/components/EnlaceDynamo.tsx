'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Mapeo } from '@/lib/valdTests'

// ENLACE DE UN TIPO DE TEST DE DYNAMO CON UN ÍTEM DE UN TEST DE SIE.
//
// Es para TODOS los pacientes: se enlaza una vez "Rodilla · Flexión · Sentado a 30°" con
// el ítem "Flexión · Sentado a 30°" del test "Fuerza de rodilla (DynaMo)", y desde ahí
// cada DynaMo de ese tipo se apunta solo como resultado de SIE. Varios ángulos de la
// misma articulación pueden ir como ítems de UN test (la batería) o en tests separados.

export default function EnlaceDynamo({ clave, titulo, rango, lateral, mapeo, tests, onHecho }: {
  clave: string, titulo: string, rango: boolean, lateral: boolean
  mapeo: Mapeo | null, tests: any[], onHecho: (aplicar: boolean) => void
}) {
  const [zona, ...resto] = titulo.split(' · ')
  const nombreTestPropuesto = `${rango ? 'Rango' : 'Fuerza'} de ${zona.toLowerCase()} (DynaMo)`
  const nombreItemPropuesto = resto.join(' · ') || titulo
  const existente = tests.find(t => t.nombre === nombreTestPropuesto)

  const [abierto, setAbierto] = useState(false)
  const [testId, setTestId] = useState<string>(existente?.id || '+')
  const [nombreTest, setNombreTest] = useState(nombreTestPropuesto)
  const [item, setItem] = useState<string>('+')
  const [nombreItem, setNombreItem] = useState(nombreItemPropuesto)
  const [asim, setAsim] = useState('15')
  const [importar, setImportar] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const test = tests.find(t => t.id === testId)
  const enlazadoA = mapeo ? tests.find(t => t.id === mapeo.test_id) : null

  async function guardar() {
    setGuardando(true); setError('')
    try {
      // El ítem nuevo MIDE (kg o grados) y compara lados. El % de asimetría es lo que
      // lo convierte en positivo/negativo; vacío = solo se mide, no abre objetivos.
      const nuevo = {
        nombre: nombreItem.trim(), unidad: rango ? 'grados' : 'kg', regla: 'medir', mejor: 'mas',
        ...(parseFloat(asim) > 0 ? { asimetria: parseFloat(asim) } : {}),
      }
      let tid = testId, it = item
      if (testId === '+') {
        if (!nombreTest.trim() || !nuevo.nombre) throw new Error('Pon nombre al test y al ítem.')
        const { data, error } = await supabase.from('tests').insert({
          nombre: nombreTest.trim(), descripcion: 'Resultados del DynaMo (VALD), apuntados solos al traer de VALD.',
          frecuencia_meses: 3, items: [nuevo], logica: 'cualquiera', tipo_lado: lateral ? 'lateral' : 'bilateral',
          bandas: [], baremos: [], etiquetas_relacionadas: [], etiquetas_bloquea: [], video_url: '', imagen_url: '',
        }).select('id').single()
        if (error) throw new Error(error.message)
        tid = data.id; it = nuevo.nombre
      } else if (item === '+') {
        if (!nuevo.nombre) throw new Error('Pon nombre al ítem.')
        if ((test?.items || []).some((i: any) => i.nombre === nuevo.nombre)) throw new Error('Ese test ya tiene un ítem con ese nombre: elígelo de la lista.')
        const { error } = await supabase.from('tests').update({ items: [...(test?.items || []), nuevo] }).eq('id', testId)
        if (error) throw new Error(error.message)
        it = nuevo.nombre
      }
      const { error } = await supabase.from('vald_mapeo').upsert({ clave, test_id: tid, item: it, desde: importar ? null : new Date().toISOString() }, { onConflict: 'clave' })
      if (error) throw new Error(error.message)
      setAbierto(false)
      onHecho(true)
    } catch (e: any) { setError(e.message) }
    setGuardando(false)
  }
  async function quitar() {
    if (!confirm('¿Quitar el enlace? Los resultados ya apuntados en SIE se quedan.')) return
    await supabase.from('vald_mapeo').delete().eq('clave', clave)
    onHecho(false)
  }

  if (!abierto) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12, flexWrap: 'wrap' }}>
      {mapeo ? (
        <>
          <span style={{ padding: '2px 9px', borderRadius: 99, background: 'var(--gl)', color: 'var(--gd)', border: '1px solid var(--gm)' }}>
            → Test SIE: {enlazadoA?.nombre || 'test borrado'} · {mapeo.item}
          </span>
          <button className="btn btn-sm" style={{ fontSize: 11 }} onClick={() => setAbierto(true)}>Cambiar</button>
          <button className="btn btn-sm" style={{ fontSize: 11 }} onClick={quitar}>Quitar</button>
        </>
      ) : (
        <button className="btn btn-sm" style={{ fontSize: 11.5 }} onClick={() => setAbierto(true)}>Enlazar con test de SIE</button>
      )}
    </div>
  )

  const lab: React.CSSProperties = { fontSize: 11, color: 'var(--gr)', display: 'block', marginBottom: 3 }
  return (
    <div style={{ marginTop: 10, padding: 12, borderRadius: 8, background: 'var(--bl)', fontSize: 12.5, display: 'grid', gap: 10 }}>
      <div style={{ color: 'var(--gr)' }}>Para <b>todos los pacientes</b>: cada DynaMo de este tipo se apuntará como resultado de este test de SIE.</div>
      <div>
        <label style={lab}>Test de SIE</label>
        <select className="input" value={testId} onChange={e => { setTestId(e.target.value); setItem('+') }}>
          <option value="+">＋ Crear test nuevo</option>
          {tests.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
      </div>
      {testId === '+' && (
        <div>
          <label style={lab}>Nombre del test nuevo (agrupa los ángulos de la misma articulación)</label>
          <input className="input" value={nombreTest} onChange={e => setNombreTest(e.target.value)}/>
        </div>
      )}
      {testId !== '+' && (
        <div>
          <label style={lab}>Ítem que recibe el valor</label>
          <select className="input" value={item} onChange={e => setItem(e.target.value)}>
            <option value="+">＋ Añadir ítem nuevo a este test</option>
            {(test?.items || []).map((i: any) => <option key={i.nombre} value={i.nombre}>{i.nombre}{i.unidad ? ` (${i.unidad})` : ''}</option>)}
          </select>
          {test && lateral && test.tipo_lado !== 'lateral' && (
            <div style={{ fontSize: 11.5, color: '#8a6d1f', marginTop: 4 }}>Este test no va por lados (izq./der.): el DynaMo sí. Cámbialo a «Izq. / Der.» en la biblioteca o elige otro.</div>
          )}
        </div>
      )}
      {item === '+' && (
        <>
          <div>
            <label style={lab}>Nombre del ítem</label>
            <input className="input" value={nombreItem} onChange={e => setNombreItem(e.target.value)}/>
          </div>
          {lateral && (
            <div>
              <label style={lab}>Positivo si un lado rinde más de este % peor que el otro (vacío = solo medir, no abre objetivos)</label>
              <input className="input" type="number" value={asim} onChange={e => setAsim(e.target.value)} style={{ width: 90 }}/> %
            </div>
          )}
        </>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
        <input type="checkbox" checked={importar} onChange={e => setImportar(e.target.checked)}/>
        Apuntar también los resultados que ya había (de todos los pacientes enlazados)
      </label>
      {error && <div style={{ color: 'var(--red)' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-p btn-sm" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar enlace'}</button>
        <button className="btn btn-sm" onClick={() => setAbierto(false)}>Cancelar</button>
      </div>
    </div>
  )
}

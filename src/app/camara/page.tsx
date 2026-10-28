'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { registrarResultadoTest } from '@/lib/tests'
import { PROTOCOLOS, Protocolo } from '@/lib/camara'
import CamaraTest, { PorLado, edadDe } from '@/components/CamaraTest'

// TESTS CON LA CÁMARA, SUELTOS: paciente → test → grabar → se guarda en su ficha.
// Desde la ficha y la valoración se entra por el botón «Con cámara» del propio test,
// que rellena el test en vez de guardar (ver CamaraTest).

const nombrePac = (p: any) => (p?.nombre_clinica || `${p?.nombre || ''} ${p?.apellidos || ''}`).trim()

// useSearchParams pide un Suspense alrededor; si no, `next build` falla al prerenderizar.
export default function Pagina() { return <Suspense><CamaraTests/></Suspense> }

function CamaraTests() {
  const qs = useSearchParams()
  const [busca, setBusca] = useState('')
  const [pacs, setPacs] = useState<any[]>([])
  const [pac, setPac] = useState<any>(null)
  const [tests, setTests] = useState<any[]>([])
  const [prot, setProt] = useState<Protocolo | null>(null)
  const [aviso, setAviso] = useState('')

  useEffect(() => { supabase.from('tests').select('*').is('archivado_el', null).then(({ data }) => setTests(data || [])) }, [])
  // ?pac=<id> entra con el paciente ya puesto.
  useEffect(() => {
    const id = qs.get('pac'); if (!id) return
    supabase.from('pacientes').select('id,nombre,apellidos,nombre_clinica,fecha_nacimiento').eq('id', id).maybeSingle().then(({ data }) => data && setPac(data))
  }, [qs])
  useEffect(() => {
    if (busca.trim().length < 2) { setPacs([]); return }
    const t = setTimeout(() => {
      const q = `%${busca.trim()}%`
      supabase.from('pacientes').select('id,nombre,apellidos,nombre_clinica,fecha_nacimiento')
        .or(`nombre.ilike.${q},apellidos.ilike.${q},nombre_clinica.ilike.${q}`).limit(8).then(({ data }) => setPacs(data || []))
    }, 250)
    return () => clearTimeout(t)
  }, [busca])

  const disponibles = PROTOCOLOS.filter(p => tests.some(t => t.nombre === p.test))
  const test = prot ? tests.find(t => t.nombre === prot.test) : null

  async function guardar(r: PorLado) {
    const lados = Object.keys(r)
    for (const l of lados) {
      const otro = lados.find(x => x !== l)
      const g = await registrarResultadoTest(pac.id, test, { items: r[l].items, otrosItems: otro ? r[otro].items : null, lado: l, observaciones: r[l].obs, contexto: 'la cámara' })
      if (!g.ok) throw new Error('No se ha podido guardar: ' + g.error)
    }
    setAviso(`Guardado en la ficha de ${nombrePac(pac)}.`)
  }

  const btn = (on = false): React.CSSProperties => ({ border: 0, borderRadius: 99, padding: '9px 15px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', background: on ? '#3E7179' : '#E8E7E1', color: on ? '#fff' : '#333' })
  const caja: React.CSSProperties = { background: '#fff', border: '1px solid #E4E0D6', borderRadius: 12, padding: 14, marginBottom: 12 }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 21, margin: '4px 0 12px' }}>Tests con la cámara</h1>
      <div style={caja}>
        <b style={{ fontSize: 14 }}>1 · Paciente</b>
        {pac ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <span style={{ fontSize: 15 }}>{nombrePac(pac)}{edadDe(pac.fecha_nacimiento) != null ? ` · ${edadDe(pac.fecha_nacimiento)} años` : ''}</span>
            <button style={btn()} onClick={() => { setPac(null); setAviso('') }}>Cambiar</button>
          </div>
        ) : (
          <>
            <input className="input" placeholder="Nombre…" value={busca} onChange={e => setBusca(e.target.value)} style={{ marginTop: 8, width: '100%', fontSize: 16, padding: 10 }}/>
            {pacs.map(p => <button key={p.id} style={{ ...btn(), display: 'block', width: '100%', textAlign: 'left', marginTop: 6, borderRadius: 8 }} onClick={() => { setPac(p); setBusca('') }}>{nombrePac(p)}</button>)}
          </>
        )}
      </div>
      {pac && (
        <div style={caja}>
          <b style={{ fontSize: 14 }}>2 · Test</b>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {disponibles.map(p => <button key={p.test} style={btn(prot?.test === p.test)} onClick={() => { setProt(p); setAviso('') }}>{p.test}</button>)}
          </div>
        </div>
      )}
      {pac && prot && test && (
        <div style={caja}>
          <b style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>3 · Medidas</b>
          <CamaraTest key={prot.test + pac.id} prot={prot} test={test} paciente={pac} accion={{ texto: 'Guardar en su ficha', hacer: guardar }}/>
          {aviso && <div style={{ marginTop: 10, fontSize: 14, color: '#3E7179' }}>{aviso}</div>}
        </div>
      )}
    </div>
  )
}

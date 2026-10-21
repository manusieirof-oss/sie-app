'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { PROGRESIONES } from '@/lib/sistemas'
import dynamic from 'next/dynamic'
// El cuerpo 3D (three.js) se carga aparte, para no frenar la entrada.
const MapaCalorMini = dynamic(() => import('@/components/MapaCalorMini'), { ssr: false })

// ---------------------------------------------------------------------------
// ¿CON QUÉ LO MONTAMOS?
//
// Paso entre "qué le preparamos" (ciclo o sesión, en el torno) y el montaje: dos
// botones gigantes, uno a cada lado. Tocar uno ya lleva a su montaje, sin "Seguir".
//   · Izquierda, de la biblioteca: el banco de siempre (objetivos y lo que los trabaja).
//   · Derecha, con el mapa de calor: el reparto por zona e intención (en preparación).
// Lo que llegó en la URL (modo, progresión, fecha fin) se pasa tal cual al siguiente.
// ---------------------------------------------------------------------------

const CALOR_LISTO = false   // se enciende cuando esté el montaje con el mapa de calor

export default function OrigenPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const sp = useSearchParams()
  const pid = params.id
  const [nombre, setNombre] = useState('')
  const [yendo, setYendo] = useState<'bib' | 'calor' | null>(null)
  const modo = sp.get('modo') || 'sesion'
  const prog = sp.get('prog') || ''
  const fin = sp.get('fin') || ''

  useEffect(() => {
    supabase.from('pacientes').select('nombre,apellidos,nombre_clinica').eq('id', pid).maybeSingle()
      .then(({ data: p }) => setNombre((p?.nombre_clinica || `${p?.nombre || ''} ${p?.apellidos || ''}`).trim()))
  }, [pid])

  const que = modo === 'ciclo'
    ? `Un ciclo · ${PROGRESIONES.find(p => p.valor === prog)?.nombre || ''}${fin ? ` hasta el ${new Date(fin + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ''}`
    : 'Una sesión'

  function ir(via: 'bib' | 'calor') {
    if (via === 'calor' && !CALOR_LISTO) return
    setYendo(via)
    const destino = via === 'bib' ? `/torno/${pid}?${sp.toString()}` : `/torno/${pid}/calor?${sp.toString()}`
    setTimeout(() => router.push(destino), 300)
  }

  const boton = (via: 'bib' | 'calor', ic: string, titulo: string, texto: string, dibujo: React.ReactNode, listo = true) => (
    <button type="button" onClick={() => ir(via)} disabled={!listo}
      className="origen-b"
      style={{ fontFamily: 'inherit', textAlign: 'left', cursor: listo ? 'pointer' : 'default', padding: 26, borderRadius: 24,
        background: '#fff', border: '1.5px solid var(--bd)', minHeight: 'min(62vh, 520px)', display: 'flex', flexDirection: 'column',
        opacity: yendo && yendo !== via ? .35 : 1, transform: yendo === via ? 'scale(1.02)' : 'none', transition: 'all .25s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 46, height: 46, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'var(--gl)', color: 'var(--gd)' }}><Ic name={ic} size={22}/></span>
        <span style={{ fontSize: 22, fontWeight: 600, color: 'var(--n)' }}>{titulo}</span>
        {!listo && <span style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 10px', borderRadius: 99, background: 'var(--bl)', color: 'var(--gr)' }}>En preparación</span>}
      </div>
      <div style={{ fontSize: 14, color: 'var(--gr)', marginTop: 10, lineHeight: 1.5, maxWidth: 420 }}>{texto}</div>
      <div style={{ flex: 1, position: 'relative', marginTop: 16, minHeight: 220 }}>{dibujo}</div>
    </button>
  )

  return (
    <div>
      <style>{`.origen-b:not(:disabled):hover{border-color:var(--g)!important;box-shadow:0 10px 30px rgba(90,150,158,.2)}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn btn-t btn-sm" onClick={() => router.push('/torno')}>← Torno</button>
        <div style={{ flex: 1 }}/>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{nombre}</span>
        <span style={{ fontSize: 11.5, padding: '3px 10px', borderRadius: 99, background: 'var(--gl)', color: 'var(--gd)' }}>{que}</span>
      </div>
      <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--grl)', marginBottom: 14, letterSpacing: '.04em', textTransform: 'uppercase' }}>¿Con qué lo montamos?</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20 }}>
        {boton('bib', 'objetivo', 'De la biblioteca', 'Eliges sus objetivos y salen los ciclos, sesiones y ejercicios que ya los trabajan. Como hasta ahora.', <Esferas/>)}
        {boton('calor', 'progreso', 'Con el mapa de calor', 'Ves lo que ha trabajado, pones el % por zona e intención y se monta solo. Luego lo retocas.', <MapaCalorMini pacienteId={pid}/>, CALOR_LISTO)}
      </div>
    </div>
  )
}

/** Dibujo del banco: esferas como las del torno. */
function Esferas() {
  const E: [string, number, number, number][] = [['Objetivo', 88, 4, 4], ['Objetivo', 78, 36, 0], ['Objetivo', 70, 66, 8],
    ['Ciclo', 66, 16, 40], ['Sesión', 56, 48, 44], ['Ejercicio', 44, 76, 52], ['Ejercicio', 40, 6, 72], ['Ejercicio', 38, 58, 74]]
  return <>{E.map(([t, s, x, y], i) => (
    <div key={i} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: s * 1.25, height: s * 1.25, borderRadius: '50%',
      display: 'grid', placeItems: 'center', fontSize: 11, color: 'var(--gd)', border: '1.5px solid #cfe2e4',
      background: 'radial-gradient(circle at 35% 30%, #fff, var(--gl))', opacity: i < 3 ? 1 : .75 }}>{t}</div>
  ))}</>
}

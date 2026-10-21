'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { PROGRESIONES } from '@/lib/sistemas'

// El mapa lleva el cuerpo 3D (three.js): solo se carga si se elige esa opción.
const MapaTrabajo = dynamic(() => import('@/components/MapaTrabajo'), { ssr: false })

// ---------------------------------------------------------------------------
// ¿CON QUÉ LO MONTAMOS?
//
// Paso entre "qué le preparamos" (ciclo o sesión, en el torno) y el montaje.
// A la izquierda se elige el camino; a la derecha se ve cómo es:
//   · De la biblioteca: el banco de siempre (sus objetivos y lo que los trabaja).
//   · Con el mapa de calor: lo que ha trabajado, para pedir el reparto por zona e
//     intención y que se monte solo.
// Lo que llegó en la URL (modo, progresión, fecha fin) se pasa tal cual al siguiente.
// ---------------------------------------------------------------------------

export default function OrigenPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const sp = useSearchParams()
  const pid = params.id
  const [nombre, setNombre] = useState('')
  const [via, setVia] = useState<'bib' | 'calor'>('bib')
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

  function seguir() {
    if (via === 'bib') router.push(`/torno/${pid}?${sp.toString()}`)
  }

  const opcion = (k: 'bib' | 'calor', ic: string, t: string, d: string) => (
    <button type="button" onClick={() => setVia(k)}
      style={{ textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', padding: 16, borderRadius: 16, transition: '.2s',
        background: via === k ? 'var(--gl)' : 'var(--w)', border: `1.5px solid ${via === k ? 'var(--g)' : 'var(--bd)'}`,
        boxShadow: via === k ? '0 6px 20px rgba(90,150,158,.18)' : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 15.5, fontWeight: 600, color: 'var(--n)' }}>
        <span style={{ width: 30, height: 30, borderRadius: 10, display: 'grid', placeItems: 'center', background: via === k ? 'var(--w)' : 'var(--bl)', color: 'var(--gd)' }}><Ic name={ic} size={15}/></span>
        {t}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--gr)', marginTop: 6, lineHeight: 1.45 }}>{d}</div>
    </button>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <button className="btn btn-t btn-sm" onClick={() => router.push('/torno')}>← Torno</button>
        <div style={{ flex: 1 }}/>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{nombre}</span>
        <span style={{ fontSize: 11.5, padding: '3px 10px', borderRadius: 99, background: 'var(--gl)', color: 'var(--gd)' }}>{que}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 320 }}>
          <div style={{ fontSize: 11.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--grl)', fontWeight: 600, margin: '4px 2px 0' }}>¿Con qué lo montamos?</div>
          {opcion('bib', 'objetivo', 'De la biblioteca', 'Eliges sus objetivos y salen los ciclos, sesiones y ejercicios que ya los trabajan. Como hasta ahora.')}
          {opcion('calor', 'progreso', 'Con el mapa de calor', 'Ves lo que ha trabajado, pones el % por zona e intención y se monta solo. Luego lo retocas.')}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="btn btn-s" onClick={() => router.push('/torno')}>Volver</button>
            <button className="btn btn-p" onClick={seguir} disabled={via === 'calor'}>Seguir</button>
          </div>
          {via === 'calor' && <div style={{ fontSize: 11.5, color: 'var(--grl)' }}>El montaje con el mapa de calor es el siguiente paso; de momento se ve lo que ha trabajado.</div>}
        </div>

        <div style={{ gridColumn: 'span 2', minWidth: 0 }}>
          {via === 'bib' && (
            <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 2px 12px rgba(38,40,37,.07)', padding: 22, minHeight: 420 }}>
              <div style={{ fontSize: 18, fontWeight: 600 }}>De la biblioteca</div>
              <div style={{ fontSize: 13, color: 'var(--gr)', marginTop: 4 }}>Lo de siempre: sus objetivos arriba y lo que los trabaja flotando —ciclos delante, sesiones detrás, ejercicios al fondo—.</div>
              <Esferas/>
            </div>
          )}
          {via === 'calor' && <MapaTrabajo pacienteId={pid}/>}
        </div>
      </div>
    </div>
  )
}

/** Dibujo de muestra del banco: esferas como las del torno. */
function Esferas() {
  const E: [string, number, number, number][] = [['Objetivo', 92, 6, 6], ['Objetivo', 84, 34, 2], ['Objetivo', 76, 62, 10],
    ['Ciclo', 70, 18, 40], ['Sesión', 60, 46, 46], ['Ejercicio', 48, 74, 52], ['Ejercicio', 44, 8, 70], ['Ejercicio', 42, 58, 74]]
  return (
    <div style={{ position: 'relative', height: 340, marginTop: 18 }}>
      {E.map(([t, s, x, y], i) => (
        <div key={i} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: s * 1.3, height: s * 1.3, borderRadius: '50%',
          display: 'grid', placeItems: 'center', fontSize: 11, color: 'var(--gd)', border: '1.5px solid #cfe2e4',
          background: 'radial-gradient(circle at 35% 30%, #fff, var(--gl))', opacity: i < 3 ? 1 : .75 }}>{t}</div>
      ))}
    </div>
  )
}

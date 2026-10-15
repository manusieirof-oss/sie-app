'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { traerTodo } from '@/lib/paginar'
import ExploradorEjercicios from '@/components/ExploradorEjercicios'

// ---------------------------------------------------------------------------
// AMASAR · ELEGIR LA PELLA
//
// "Amasar un ejercicio existente": la biblioteca de siempre (con sus familias) y al
// tocar uno se va a su rosco. Lo nuevo empieza directamente en /torno/amasar/nuevo.
// ---------------------------------------------------------------------------

export default function AmasarElegir() {
  const router = useRouter()
  const [ejs, setEjs] = useState<any[]>([])
  const [ets, setEts] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    Promise.all([
      traerTodo((d, h) => supabase.from('ejercicios').select('*').order('nombre').order('id').range(d, h)),
      traerTodo((d, h) => supabase.from('etiquetas').select('*').order('id').range(d, h)),
    ]).then(([a, b]) => { setEjs(a.filas); setEts(b.filas); setCargando(false) })
  }, [])

  return (
    <div style={{ background: '#fff', margin: '-16px -18px', padding: '18px 22px 60px', minHeight: 'calc(100vh - 32px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <button className="btn btn-t btn-sm" onClick={() => router.push('/torno')}><Ic name="atras" size={13}/> Torno</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 17 }}>¿Qué pella amasamos?</div>
          <div style={{ fontSize: 11.5, color: 'var(--gd)' }}>Elige el ejercicio que quieres moldear</div>
        </div>
        <button className="btn btn-p btn-sm" onClick={() => router.push('/torno/amasar/nuevo')}>+ Nuevo</button>
      </div>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {cargando
          ? <div className="muted" style={{ textAlign: 'center', padding: 40 }}>Trayendo la biblioteca…</div>
          : <ExploradorEjercicios ejercicios={ejs} etiquetas={ets} botonCrear={false}
              onAbrir={(e: any) => router.push(`/torno/amasar/${e.id}`)}/>}
      </div>
    </div>
  )
}

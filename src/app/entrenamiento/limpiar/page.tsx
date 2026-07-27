'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { SEMILLA } from '@/lib/semillaEjercicios'
import { eliminarEjercicio, usosDeEjercicio } from '@/lib/ejercicios'

/**
 * Borra del catálogo los ejercicios que NO están en la semilla.
 *
 * Sirve para dejar la biblioteca limpia después de las pruebas. Va como página y no
 * como script por lo de siempre: en `.env.local` solo hay la clave anónima y las
 * políticas RLS exigen sesión iniciada.
 *
 * Dos salvaguardas, porque esto borra de verdad:
 *
 * 1. Antes de nada ENSEÑA la lista y no borra hasta que se pulsa. Cuenta además en
 *    cuántos registros de ejecución aparece cada uno, que es lo único que se pierde de
 *    forma irreversible: las sesiones congelan nombre e imagen en su JSON y siguen
 *    viéndose igual aunque el ejercicio desaparezca.
 * 2. Los que tienen histórico salen DESMARCADOS. Borrar el catálogo es reversible
 *    —se vuelve a sembrar—; borrar el rastro de lo que un paciente hizo, no.
 */

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

type Fila = { id: string, nombre: string, usos: number, marcado: boolean, estado?: string }

export default function LimpiarPage() {
  const [filas, setFilas] = useState<Fila[]>([])
  const [enSemilla, setEnSemilla] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [borrando, setBorrando] = useState(false)
  const [hecho, setHecho] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true); setHecho(false)
    const { data } = await supabase.from('ejercicios').select('id,nombre').order('nombre')
    const nombresSemilla = new Set(SEMILLA.map(s => norm(s.nombre)))
    const dentro = (data || []).filter((e: any) => nombresSemilla.has(norm(e.nombre)))
    const fuera = (data || []).filter((e: any) => !nombresSemilla.has(norm(e.nombre)))

    const conUsos: Fila[] = []
    for (const e of fuera) {
      const usos = await usosDeEjercicio(e.id)
      conUsos.push({ id: e.id, nombre: e.nombre, usos, marcado: usos === 0 })
    }
    setEnSemilla(dentro.length)
    setFilas(conUsos)
    setCargando(false)
  }

  const marcados = filas.filter(f => f.marcado).length

  async function borrar() {
    setBorrando(true)
    for (const f of filas) {
      if (!f.marcado) continue
      const r = await eliminarEjercicio(f.id)
      setFilas(prev => prev.map(x => x.id === f.id
        ? { ...x, estado: r.ok ? 'borrado' : `error: ${r.error}`, marcado: false } : x))
    }
    setBorrando(false); setHecho(true)
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 0' }}>
      <div className="panel">
        <div className="sec">
          <div className="sec-h">
            <span className="sh-l"><span className="ct-l"><Ic name="papelera" size={13} /> Limpiar la biblioteca</span></span>
            <span className="sh-r">{enSemilla} de la semilla se conservan</span>
          </div>

          <p style={{ fontSize: 13, color: 'var(--gr)', lineHeight: 1.6, marginBottom: 14 }}>
            Borra los ejercicios que no están en la semilla. Los que aparecen en algún
            registro de ejecución salen desmarcados: el catálogo se puede volver a
            sembrar, pero el histórico de lo que hizo un paciente no se recupera. Las
            sesiones ya montadas no se rompen — guardan el nombre y la imagen por dentro.
          </p>

          {cargando && <div style={{ fontSize: 13, color: 'var(--gr)' }}>Contando usos…</div>}

          {!cargando && filas.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--gd)' }}>
              No hay nada que borrar: todos los ejercicios están en la semilla.
            </div>
          )}

          {!cargando && filas.length > 0 && (
            <>
              {filas.map(f => (
                <div key={f.id} className="fila-p" style={{
                  marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10,
                  borderLeftColor: f.estado === 'borrado' ? 'var(--bd)' : f.usos > 0 ? 'var(--amb)' : 'var(--red)',
                  opacity: f.estado === 'borrado' ? 0.5 : 1,
                }}>
                  <input type="checkbox" checked={f.marcado} disabled={borrando || !!f.estado}
                    onChange={e => setFilas(prev => prev.map(x =>
                      x.id === f.id ? { ...x, marcado: e.target.checked } : x))} />
                  <span style={{ fontSize: 13, color: 'var(--n)', flex: 1 }}>
                    {f.nombre}
                    {f.estado && <span style={{ color: 'var(--gr)' }}> — {f.estado}</span>}
                  </span>
                  {f.usos > 0 && !f.estado && (
                    <span className="badge" style={{ color: '#7A5800' }}>
                      {f.usos} registro{f.usos === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              ))}

              <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                <button className="btn btn-p" onClick={borrar} disabled={borrando || marcados === 0}>
                  {borrando ? 'Borrando…' : <><Ic name="papelera" size={13} /> Borrar {marcados} ejercicio{marcados === 1 ? '' : 's'}</>}
                </button>
                <button className="btn btn-s" onClick={cargar} disabled={borrando}>Recargar</button>
              </div>
            </>
          )}

          {hecho && (
            <a href="/entrenamiento" className="btn btn-s btn-sm" style={{ marginTop: 10 }}>
              Ir a la biblioteca
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

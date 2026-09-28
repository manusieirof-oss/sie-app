'use client'
import { useEffect, useState } from 'react'
import { dosisDeObjetivo, type Ventana, type EjercicioEnVentana } from '@/lib/dosis'
import { hace } from '@/lib/antiguedad'

// ---------------------------------------------------------------------------
// LO QUE SE HA HECHO POR ESTE OBJETIVO
//
// La ventana entre dos mediciones, las clases que hubo dentro y los ejercicios
// que se hicieron en ellas. Nada de esto esta etiquetado a mano: ver `lib/dosis`.
// ---------------------------------------------------------------------------

const corto = (iso?: string | null) => iso
  ? new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  : ''

export default function DosisObjetivo({ pacienteId, objetivo, tests = [] }: {
  pacienteId: string
  objetivo: any
  tests?: any[]
}) {
  const [d, setD] = useState<any>(null)
  const [cargando, setCargando] = useState(true)
  const [todas, setTodas] = useState(false)

  useEffect(() => {
    let vivo = true
    setCargando(true)
    dosisDeObjetivo(pacienteId, objetivo, tests)
      .then(r => { if (vivo) { setD(r); setCargando(false) } })
      .catch(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [pacienteId, objetivo?.id, tests.length])

  if (cargando || d == null) return null

  /* LA ANTIGUEDAD, EN UNA LINEA. Un objetivo abierto hace ocho meses, sin
     medir y sin clases, se veia igual que uno de ayer. */
  const enCurso: Ventana | null = (d.ventanas || []).find((v: Ventana) => v.enCurso) || null
  const resumen = [
    objetivo?.created_at ? `abierto ${hace(String(objetivo.created_at).slice(0, 10))}` : '',
    enCurso?.desde ? `medido ${hace(enCurso.desde)}` : '',
    enCurso ? `${enCurso.clases} clase${enCurso.clases === 1 ? '' : 's'} desde entonces` : '',
  ].filter(Boolean).join(' · ')
  const parado = enCurso != null && enCurso.clases === 0

  const cerrada: Ventana | null = d.cerrada
  const ejercicios: EjercicioEnVentana[] = d.ejercicios || []
  const otras: Ventana[] = (d.ventanas || []).filter((v: Ventana) => v !== cerrada)
  const maxClases = ejercicios.reduce((m, e) => Math.max(m, e.clases), 0) || 1

  /* SIN VENTANA. No se mide con un numero, asi que no hay dos mediciones entre
     las que contar. Lo unico honesto es decir cuantas clases lleva. */
  if (cerrada == null && (d.ventanas || []).length === 0) {
    return (
      <div style={{ marginTop: 8 }}>
        <div className="et-mini">Trabajo hecho</div>
        {objetivo?.created_at && (
          <div style={{ fontSize: 11, color: 'var(--grl)', marginBottom: 6 }}>
            abierto {hace(String(objetivo.created_at).slice(0, 10))}
          </div>
        )}
        <div style={{ fontSize: 12, color: 'var(--gr)', background: 'var(--bl)',
          border: '1px dashed var(--bm)', borderRadius: 7, padding: '9px 11px', lineHeight: 1.6 }}>
          <b>{d.clasesTotales} clases dadas</b> en total. Este objetivo no se mide con un número,
          así que no se puede decir cuánto se ha trabajado por él en concreto.
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div className="et-mini">Trabajo hecho</div>
      {resumen && (
        <div style={{ fontSize: 11, marginBottom: 6,
          color: parado ? 'var(--ambt, #7A5800)' : 'var(--grl)' }}>{resumen}</div>
      )}

      {cerrada && (
        <div style={{ border: '1px solid var(--bd)', borderRadius: 9, padding: '13px 15px 11px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ textAlign: 'center', minWidth: 54 }}>
              <span style={{ display: 'block', fontSize: 15 }}>{cerrada.valorDesde ?? '—'}</span>
              <span style={{ display: 'block', fontSize: 10, color: 'var(--grl)' }}>{corto(cerrada.desde) || 'inicio'}</span>
            </span>
            <span style={{ flex: 1, textAlign: 'center' }}>
              <span style={{ display: 'block', height: 3, borderRadius: 99, marginBottom: 5,
                background: 'linear-gradient(90deg,var(--gm),var(--gd))' }}/>
              <span style={{ fontSize: 12, color: 'var(--gd)' }}>
                {cerrada.clases} clase{cerrada.clases === 1 ? '' : 's'} dada{cerrada.clases === 1 ? '' : 's'}
              </span>
              {cerrada.valorDesde != null && cerrada.valorHasta != null && (
                <span style={{ marginLeft: 6, fontSize: 11, padding: '1px 7px', borderRadius: 99,
                  background: 'var(--gl)', border: '1px solid var(--gm)', color: 'var(--gd)' }}>
                  {cerrada.valorHasta - cerrada.valorDesde > 0 ? '+' : ''}
                  {Math.round((cerrada.valorHasta - cerrada.valorDesde) * 100) / 100}
                </span>
              )}
            </span>
            <span style={{ textAlign: 'center', minWidth: 54 }}>
              <span style={{ display: 'block', fontSize: 15 }}>{cerrada.valorHasta ?? '—'}</span>
              <span style={{ display: 'block', fontSize: 10, color: 'var(--grl)' }}>{corto(cerrada.hasta)}</span>
            </span>
          </div>

          {ejercicios.length > 0 && (
            <>
              <div className="et-mini" style={{ margin: '13px 0 5px' }}>
                Qué se hizo en esas {cerrada.clases} clases
              </div>
              {ejercicios.slice(0, todas ? 99 : 5).map(e => (
                <div key={(e.id || e.nombre)} style={{ display: 'flex', alignItems: 'center', gap: 9,
                  padding: '5px 0', borderBottom: '1px solid var(--bd2, var(--bl))' }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}>{e.nombre}</span>
                  <span style={{ width: 84, height: 6, borderRadius: 99, background: 'var(--bm)',
                    overflow: 'hidden', flexShrink: 0 }}>
                    <span style={{ display: 'block', height: '100%', borderRadius: 99,
                      background: 'var(--gd)', width: `${Math.round(e.clases / maxClases * 100)}%` }}/>
                  </span>
                  <span style={{ width: 72, textAlign: 'right', fontSize: 11, color: 'var(--gr)',
                    flexShrink: 0 }}>{e.clases} de {cerrada.clases}</span>
                </div>
              ))}
              {ejercicios.length > 5 && (
                <button className="btn btn-t btn-sm" style={{ fontSize: 11, padding: '4px 0' }}
                  onClick={() => setTodas(v => !v)}>
                  {todas ? 'ver menos' : `…y ${ejercicios.length - 5} más`}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {otras.length > 0 && (
        <>
          <div className="et-mini" style={{ margin: '13px 0 3px' }}>Las demás ventanas</div>
          {otras.map((v, k) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12,
              padding: '6px 0', borderBottom: '1px solid var(--bd2, var(--bl))' }}>
              <span style={{ flex: 1, minWidth: 0, color: 'var(--gr)' }}>
                {v.desde ? corto(v.desde) : 'inicio'} → {v.hasta ? corto(v.hasta) : 'hoy'}
              </span>
              <span>{v.clases} clase{v.clases === 1 ? '' : 's'}</span>
              {v.enCurso
                ? <span style={{ fontSize: 10.5, color: 'var(--grl)', fontStyle: 'italic' }}>sin medir todavía</span>
                : (v.valorDesde != null && v.valorHasta != null
                    ? <span style={{ color: v.valorHasta >= v.valorDesde ? 'var(--gd)' : '#B4544F' }}>
                        {v.valorDesde} → {v.valorHasta} {v.valorHasta >= v.valorDesde ? '▲' : '▼'}
                      </span>
                    : <span style={{ fontSize: 10.5, color: 'var(--grl)' }}>primera medición</span>)}
            </div>
          ))}
        </>
      )}

      <div style={{ fontSize: 10.5, color: 'var(--grl)', marginTop: 8, lineHeight: 1.55 }}>
        Cuenta lo que pasó, no lo que funcionó: en esas clases se hicieron más ejercicios y no
        se puede saber cuál movió el número.
      </div>
    </div>
  )
}

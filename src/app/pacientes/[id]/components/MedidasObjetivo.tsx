'use client'
import { useEffect, useState } from 'react'
import { Ic } from '@/lib/icons'
import { tieneBarra, unidadDe } from '@/lib/tests'
import { testsDeObjetivo } from '@/lib/objetivosTests'
import { esMeta, avanceDe, direccionDe, ultimoValor, ponerMeta, quitarMeta } from '@/lib/metasVia'

/**
 * CON QUÉ SE MIDE, Y HASTA CUÁNTO.
 *
 * Una fila por medida: el test que evalúa el objetivo y el ítem concreto que da el
 * número. A la derecha, «y hasta cuánto», que es la meta de ESTE paciente.
 *
 * La meta cuelga de la MEDIDA y no del objetivo: si un objetivo se comprueba con
 * tres cosas, puedes ponerle número a una y dejar las otras como están. Decir «la
 * meta del objetivo» sería ambiguo en cuanto hay más de un evaluador, que es el
 * caso normal.
 *
 * Un test lateral saca una fila por lado. Es el mismo fallo que ya costó caro en
 * las vías: con la rodilla derecha en 20 y la izquierda en 8, una sola meta daría
 * el objetivo por bueno.
 *
 * Solo salen los ítems que dan NÚMERO. En una casilla —«el talón se levanta antes
 * de tocar»— no hay meta posible, y forzarla sería inventar una escala.
 */

const norm = (x: any) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

type Fila = {
  clave: string
  test: any
  item: any
  ref: string
  lado: string | null
  unidad: string
  meta: any | null
  hoy: number | null
  fechaHoy: string | null
}

export default function MedidasObjetivo({ pacienteId, objetivo, tests = [], onCambio, onAbrirTest }: {
  pacienteId: string
  /** La fila del paciente: hace falta `vias`, que es donde vive la meta. */
  objetivo: any
  tests?: any[]
  onCambio?: () => void
  /** Volver a pasar el test. Lo que mueve una meta es medir otra vez. */
  onAbrirTest?: (testId: string, lado: string) => void
}) {
  const [filas, setFilas] = useState<Fila[]>([])
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState<string>('')
  const [valor, setValor] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { montar() }, [objetivo?.id, JSON.stringify(objetivo?.vias || [])])

  async function montar() {
    setCargando(true)
    const vias: any[] = Array.isArray(objetivo.vias) ? objetivo.vias : []

    /* DE DÓNDE SALEN LAS MEDIDAS: de las dos relaciones, no de una.
       `objetivos_tests` dice qué test lo EVALÚA —lo que se engancha desde la
       biblioteca—, pero la mayoría de los objetivos vienen de la relación vieja: un
       ítem del test los ABRIÓ y dejó una vía. Ese ítem mide exactamente igual, así
       que también admite meta. Mirando solo la primera, un objetivo con su vía
       delante salía sin ninguna medida. */
    const evs = await testsDeObjetivo(objetivo.id)
    const candidatas: { testId: string, item: string | null, lado?: string | null }[] =
      evs.map((e: any) => ({ testId: e.test_id, item: e.item || null }))

    vias.forEach((v: any) => {
      if (v?.tipo !== 'test' && v?.tipo !== 'test_item') return
      const ref = String(v.ref || '')
      const testId = ref.split(':')[0].split('|')[0]
      if (testId === '') return
      // En una vía de ítem el índice va en la referencia; el nombre se resuelve abajo.
      const idx = v.tipo === 'test_item' ? Number(ref.split(':')[1]) : null
      candidatas.push({ testId, item: idx != null && Number.isFinite(idx) ? '#' + idx : null, lado: v.lado || null })
    })

    const out: Fila[] = []
    const puestas = new Set<string>()

    for (const c of candidatas) {
      const t = (tests || []).find((x: any) => x.id === c.testId)
      if (t == null || t.archivado_el != null) continue
      const items = Array.isArray(t.items) ? t.items : []

      // El ítem puede venir por nombre (evaluador), por índice (vía) o no venir: entonces
      // valen todos los que den número.
      let cuales: any[]
      if (c.item && c.item.startsWith('#')) {
        const it = items[Number(c.item.slice(1))]
        cuales = it ? [it] : []
      } else if (c.item) {
        cuales = items.filter((i: any) => norm(i?.nombre) === norm(c.item))
      } else {
        cuales = items
      }

      for (const it of cuales) {
        if (tieneBarra(it) === false) continue
        const idx = items.indexOf(it)
        const ref = t.id + ':' + idx
        const lados: (string | null)[] = c.lado
          ? [c.lado]
          : (t.tipo_lado === 'lateral' ? ['izquierdo', 'derecho'] : ['bilateral'])
        for (const lado of lados) {
          const clave = ref + '|' + lado
          if (puestas.has(clave)) continue
          puestas.add(clave)
          const meta = vias.find((v: any) => esMeta(v) && v.ref === ref && (v.lado || null) === lado) || null
          const u = await ultimoValor(pacienteId, t.id, it.nombre, lado)
          out.push({
            clave, test: t, item: it, ref, lado,
            unidad: (unidadDe(it)?.simbolo || '').trim() || unidadDe(it)?.id || '',
            meta, hoy: u.valor, fechaHoy: u.fecha,
          })
        }
      }
    }
    setFilas(out)
    setCargando(false)
  }

  async function guardar(f: Fila) {
    const n = Number(String(valor).replace(',', '.'))
    setGuardando(true)
    if (String(valor).trim() === '' || Number.isFinite(n) === false) {
      // Vaciar la casilla quita la meta: el objetivo vuelve a cerrarse por el test.
      const r: any = await quitarMeta(pacienteId, objetivo.id, f.ref, f.lado, f.meta?.fase_id || null)
      setGuardando(false); setEditando('')
      if (r.ok === false) { alert(r.error); return }
      onCambio?.(); return
    }
    const r: any = await ponerMeta(pacienteId, objetivo.id, {
      ref: f.ref,
      etiqueta: 'Meta: ' + (f.test.nombre || 'test') + ' · ' + (f.item?.nombre || ''),
      item: f.item?.nombre || '',
      unidad: f.unidad || null,
      lado: f.lado,
      // La PARTIDA se congela hoy: de dónde salía cuando se puso el listón. Sin ella
      // no hay porcentaje de avance, solo un sí o un no.
      partida: f.meta?.partida ?? f.hoy,
      partida_fecha: f.meta?.partida_fecha ?? f.fechaHoy,
      hasta: n,
      dir: f.meta?.dir || direccionDe(f.item),
      fase_id: f.meta?.fase_id || null,
      fecha_resuelto: null,
    } as any)
    setGuardando(false); setEditando('')
    if (r.ok === false) { alert(r.error); return }
    onCambio?.()
  }

  if (cargando) return null
  if (filas.length === 0) return null

  return (
    <div style={{ display: 'grid', gap: 7, marginTop: 8 }}>
      <div className="et-mini">Con qué se mide, y hasta cuánto</div>
      {filas.map(f => {
        const m = f.meta
        const avance = m ? avanceDe(m, f.hoy) : null
        const abierto = editando === f.clave
        return (
          <div key={f.clave} style={{ border: '1px solid var(--bd)', borderRadius: 9, padding: '9px 11px' }}>
            {/* La ficha entera lleva al test: lo que mueve una meta es volver a medir,
                y antes había que ir a buscarlo a la lista de «de dónde sale». */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9,
              cursor: onAbrirTest ? 'pointer' : 'default' }}
              onClick={() => onAbrirTest?.(f.test.id, f.lado || 'bilateral')}>
              {f.test.imagen_url
                ? <img src={f.test.imagen_url} alt="" style={{ width: 46, height: 38, objectFit: 'cover',
                    borderRadius: 6, background: 'var(--bm)', flexShrink: 0, display: 'block' }}/>
                : <span style={{ width: 46, height: 38, borderRadius: 6, background: 'var(--bm)',
                    color: 'var(--grl)', flexShrink: 0, display: 'flex', alignItems: 'center',
                    justifyContent: 'center' }}><Ic name="test" size={16}/></span>}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, lineHeight: 1.3 }}>{f.test.nombre}</div>
                <div style={{ fontSize: 11, color: 'var(--gd)', lineHeight: 1.3 }}>
                  {f.item?.nombre}
                  {f.lado && f.lado !== 'bilateral' ? ' · ' + f.lado : ''}
                </div>
              </div>

              {/* Y HASTA CUÁNTO. Vacío = se cierra cuando el test salga limpio. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                onClick={e => e.stopPropagation()}>
                <span style={{ fontSize: 11.5, color: 'var(--gr)' }}>y hasta</span>
                <input className="input" type="text" inputMode="decimal" disabled={guardando}
                  style={{ width: 54, padding: '3px 5px', fontSize: 12.5, textAlign: 'center' }}
                  value={abierto ? valor : (m ? String(m.hasta) : '')}
                  placeholder="—"
                  onFocus={() => { setEditando(f.clave); setValor(m ? String(m.hasta) : '') }}
                  onChange={e => setValor(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  onBlur={() => { if (abierto) guardar(f) }}/>
                {f.unidad && <span style={{ fontSize: 10.5, color: 'var(--grl)' }}>{f.unidad}</span>}
              </div>
            </div>

            {m ? (
              <div style={{ marginTop: 9 }}>
                <div style={{ height: 7, borderRadius: 99, background: 'var(--bm)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 99,
                    width: `${Math.round((avance ?? 0) * 100)}%`,
                    background: 'linear-gradient(90deg, var(--gm), var(--gd))' }}/>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5,
                  color: 'var(--grl)', marginTop: 4 }}>
                  <span>empezó en <b style={{ color: 'var(--gd)', fontWeight: 500 }}>{m.partida ?? '—'}</b>
                    {m.partida_fecha ? ' · ' + new Date(m.partida_fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : ''}</span>
                  <span>hoy <b style={{ color: 'var(--gd)', fontWeight: 500 }}>{f.hoy ?? 'sin medir'}</b></span>
                  <span>meta <b style={{ color: 'var(--gd)', fontWeight: 500 }}>{m.hasta}</b></span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 11.5, color: 'var(--grl)', fontStyle: 'italic', marginTop: 6 }}>
                Sin meta: se cierra cuando el test salga limpio.
                {f.hoy != null && ` Hoy está en ${f.hoy}${f.unidad ? ' ' + f.unidad : ''}.`}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

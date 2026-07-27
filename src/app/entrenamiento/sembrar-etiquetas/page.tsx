'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { MOVER, RENOMBRAR, FUSIONAR, NUEVAS } from '@/lib/semillaEtiquetas'
import { labelCategoria } from '@/lib/etiquetas'

/**
 * Aplica los cambios acordados sobre el árbol de etiquetas.
 *
 * Solo toca lo que hay que corregir: mueve las cuatro descolocadas, renombra las dos
 * que chocaban, y crea las que faltan. Todo lo demás se queda como está.
 *
 * Es repetible: si algo ya está hecho, lo salta y lo dice.
 */

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

type Linea = { texto: string, estado: 'ok' | 'aviso' | 'error' }

export default function SembrarEtiquetasPage() {
  const [log, setLog] = useState<Linea[]>([])
  const [corriendo, setCorriendo] = useState(false)

  const anota = (texto: string, estado: Linea['estado'] = 'ok') => setLog(l => [...l, { texto, estado }])

  async function aplicar() {
    setCorriendo(true); setLog([])

    const { data: todas } = await supabase.from('etiquetas').select('id,nombre,categoria,padre_id')
    const lista = todas || []
    const buscar = (nombre: string, categoria?: string) => lista.find((e: any) =>
      norm(e.nombre) === norm(nombre) && (!categoria || e.categoria === categoria))

    // 1. MOVER de categoría
    for (const m of MOVER) {
      const et = buscar(m.nombre, m.de)
      if (!et) {
        const yaMovida = buscar(m.nombre, m.a)
        anota(yaMovida
          ? `"${m.nombre}" ya está en ${labelCategoria(m.a)}`
          : `"${m.nombre}" no se encuentra en ${labelCategoria(m.de)}, se salta`, 'aviso')
        continue
      }
      // Al cambiar de categoría se suelta del padre: su madre vivía en la otra columna.
      const { error } = await supabase.from('etiquetas')
        .update({ categoria: m.a, padre_id: null }).eq('id', et.id)
      if (error) anota(`"${m.nombre}": ${error.message}`, 'error')
      else anota(`"${m.nombre}" — de ${labelCategoria(m.de)} a ${labelCategoria(m.a)}. ${m.motivo}`)
    }

    // 2. RENOMBRAR
    for (const r of RENOMBRAR) {
      const et = buscar(r.de, r.categoria)
      if (!et) {
        anota(buscar(r.a, r.categoria)
          ? `"${r.a}" ya estaba renombrada`
          : `"${r.de}" no se encuentra en ${labelCategoria(r.categoria)}, se salta`, 'aviso')
        continue
      }
      const { error } = await supabase.from('etiquetas').update({ nombre: r.a }).eq('id', et.id)
      if (error) anota(`"${r.de}": ${error.message}`, 'error')
      else anota(`"${r.de}" pasa a llamarse "${r.a}"`)
    }

    // 3. FUSIONAR duplicadas. Los ejercicios que usen la que sobra pasan a la que se
    //    queda ANTES de borrarla, para no dejarlos apuntando a nada.
    for (const f of FUSIONAR) {
      const sobra = buscar(f.sobra, f.categoria)
      const queda = buscar(f.queda, f.categoria)
      if (!sobra) { anota(`"${f.sobra}" ya no existe`, 'aviso'); continue }
      if (!queda) { anota(`No se encuentra "${f.queda}", no se fusiona`, 'error'); continue }

      const { data: usan } = await supabase.from('ejercicios')
        .select('id,etiquetas').contains('etiquetas', [sobra.id])
      for (const ej of (usan || [])) {
        const nuevas = Array.from(new Set(
          (ej.etiquetas || []).map((id: string) => id === sobra.id ? queda.id : id)))
        await supabase.from('ejercicios').update({ etiquetas: nuevas }).eq('id', ej.id)
      }

      const { error } = await supabase.from('etiquetas').delete().eq('id', sobra.id)
      if (error) anota(`"${f.sobra}": ${error.message}`, 'error')
      else anota(`"${f.sobra}" fusionada en "${f.queda}"${(usan || []).length > 0 ? ` · ${usan!.length} ejercicio(s) reasignados` : ''}`)
    }

    // 4. CREAR las nuevas. En dos vueltas: primero las raíces, porque las hijas
    //    necesitan el id de su madre y puede acabar de crearse.
    const creadas: Record<string, string> = {}
    for (const vuelta of [0, 1]) {
      for (const n of NUEVAS) {
        if ((vuelta === 0) !== !n.padre) continue

        const refrescar = await supabase.from('etiquetas').select('id').eq('categoria', n.categoria)
          .ilike('nombre', n.nombre).maybeSingle()
        if (refrescar.data) { if (vuelta === 0) anota(`"${n.nombre}" ya existe`, 'aviso'); continue }

        let padre_id: string | null = null
        if (n.padre) {
          padre_id = creadas[norm(n.padre)] || buscar(n.padre, n.categoria)?.id || null
          if (!padre_id) { anota(`"${n.nombre}": no se encuentra su madre "${n.padre}"`, 'error'); continue }
        }

        const { data, error } = await supabase.from('etiquetas')
          .insert({ categoria: n.categoria, nombre: n.nombre, padre_id }).select().single()
        if (error || !data) { anota(`"${n.nombre}": ${error?.message}`, 'error'); continue }
        creadas[norm(n.nombre)] = data.id
        anota(`"${n.nombre}" creada en ${labelCategoria(n.categoria)}${n.padre ? ` bajo ${n.padre}` : ''}`)
      }
    }

    setCorriendo(false)
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 0' }}>
      <div className="panel">
        <div className="sec">
          <div className="sec-h">
            <span className="sh-l"><span className="ct-l"><Ic name="etiqueta" size={13} /> Ajustar etiquetas</span></span>
            <span className="sh-r">{MOVER.length + RENOMBRAR.length + FUSIONAR.length + NUEVAS.length} cambios</span>
          </div>

          <p style={{ fontSize: 13, color: 'var(--gr)', lineHeight: 1.6, marginBottom: 6 }}>
            Mueve {MOVER.length} etiquetas que están en la categoría equivocada, renombra
            {RENOMBRAR.length} —las de Apoyo que chocaban con las de Agarre, y "polea" en
            minúscula—, fusiona {FUSIONAR.length} duplicada y crea las {NUEVAS.length} que
            faltan: la rama <b>Patrón</b> dentro de Movimiento y las patologías.
          </p>
          <p style={{ fontSize: 13, color: 'var(--gr)', lineHeight: 1.6, marginBottom: 14 }}>
            No toca nada más. Se puede relanzar: lo que ya esté hecho lo salta.
          </p>

          <button className="btn btn-p" onClick={aplicar} disabled={corriendo}>
            {corriendo ? 'Aplicando…' : <><Ic name="guardar" size={13} /> Aplicar los cambios</>}
          </button>
        </div>

        {log.length > 0 && (
          <div className="sec">
            <div className="sec-h"><span className="sh-l"><span className="ct-l">Resultado</span></span></div>
            {log.map((l, i) => (
              <div key={i} className="fila-p" style={{
                borderLeftColor: l.estado === 'ok' ? 'var(--g)' : l.estado === 'error' ? 'var(--red)' : 'var(--amb)',
                marginBottom: 4,
              }}>
                <span style={{ fontSize: 13, color: 'var(--n)' }}>{l.texto}</span>
              </div>
            ))}
            {!corriendo && (
              <a href="/entrenamiento" className="btn btn-s btn-sm" style={{ marginTop: 10 }}>
                Ver las etiquetas
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

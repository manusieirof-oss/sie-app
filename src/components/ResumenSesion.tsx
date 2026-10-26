'use client'
import { useMemo } from 'react'
import { categoriaDe } from '@/lib/etiquetas'
import { ZONAS_CUERPO, zonasDeTest } from '@/lib/zonasCuerpo'

/**
 * RESUMEN DE UNA SESION, en una franja: cuanto dura, cuantas partes y ejercicios, que
 * material hace falta y que zonas trabaja. Es lo que se quiere saber antes de mirarla
 * ejercicio a ejercicio (maqueta-vista-sesion).
 *
 * La duracion es una ESTIMACION: trabajo (segundos, o ~3 s por repeticion) por series
 * o vueltas, mas descansos y ~15 s de cambio entre ejercicios. Sirve para saber si cabe
 * en la clase, no para cronometrar.
 */
export function minutosDe(partes: any[]): number {
  let s = 0
  for (const p of partes || []) {
    const ejs = p.ejercicios || []
    if (!ejs.length) continue
    const desc = parseInt(String(p.descanso || '')) || 0
    const trabajo = (e: any) => (parseInt(String(e.tiempo || '')) || (parseInt(String(e.reps || '')) || 10) * 3)
    if (p.modo === 'circuito') {
      const v = parseInt(String(p.vueltas || '')) || 1
      s += v * ejs.reduce((a: number, e: any) => a + trabajo(e) + 15, 0) + Math.max(0, v - 1) * desc
    } else if (p.modo === 'superserie') {
      const grupos: Record<string, any[]> = {}
      ejs.forEach((e: any) => { (grupos[e.grupo || 'A'] ||= []).push(e) })
      for (const g of Object.values(grupos)) {
        const v = parseInt(String(g[0]?.series || '')) || 1
        s += v * (g.reduce((a, e) => a + trabajo(e) + 15, 0) + desc)
      }
    } else if (p.modo === 'tiempo') {
      s += (parseInt(String(p.duracion || p.minutos || '')) || 10) * 60
    } else {
      s += ejs.reduce((a: number, e: any) => { const n = parseInt(String(e.series || '')) || 1; return a + n * (trabajo(e) + desc) + 15 }, 0)
    }
  }
  return Math.max(5, Math.round(s / 60 / 5) * 5)
}

export default function ResumenSesion({ partes, ejercicios = [], etiquetas = [] }: { partes: any[], ejercicios?: any[], etiquetas?: any[] }) {
  const { nEj, material, zonas } = useMemo(() => {
    const items = (partes || []).flatMap((p: any) => p.ejercicios || [])
    const lib = items.map((e: any) => ejercicios.find((x: any) => x.id === e.ejercicio_id)).filter(Boolean)
    const mat = new Map<string, string>()
    const cuenta: Record<string, number> = {}
    for (const e of lib) {
      for (const id of (e.etiquetas || [])) {
        const et = etiquetas.find((x: any) => x.id === id)
        if (et && categoriaDe(etiquetas, et) === 'material') mat.set(et.id, et.nombre)
      }
      zonasDeTest({ etiquetas_relacionadas: e.etiquetas || [], nombre: e.nombre }, etiquetas).forEach(z => { cuenta[z] = (cuenta[z] || 0) + 1 })
    }
    const max = Math.max(1, ...Object.values(cuenta))
    return { nEj: items.length, material: Array.from(mat.values()).sort(), zonas: Object.entries(cuenta).map(([id, n]) => ({ id, peso: n / max })).sort((a, b) => b.peso - a.peso) }
  }, [partes, ejercicios, etiquetas])
  const conEj = (partes || []).filter((p: any) => (p.ejercicios || []).length).length
  const top = zonas.slice(0, 3).map(z => ZONAS_CUERPO.find(x => x.id === z.id)?.nombre?.toLowerCase()).filter(Boolean)
  // La vista con mas zonas trabajadas.
  const pesa = (v: 'frente' | 'espalda') => zonas.reduce((a, z) => a + ((ZONAS_CUERPO.find(x => x.id === z.id) as any)?.[v] ? z.peso : 0), 0)
  const vista = pesa('espalda') > pesa('frente') ? 'espalda' : 'frente'
  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'center', background: 'var(--bl)', padding: '12px 18px', borderBottom: '1px solid var(--bd)', flexWrap: 'wrap' }}>
      <Kpi v={`~${minutosDe(partes)} min`} t="duración estimada"/>
      <Sep/>
      <Kpi v={String(conEj)} t={conEj === 1 ? 'parte' : 'partes'}/>
      <Kpi v={String(nEj)} t={nEj === 1 ? 'ejercicio' : 'ejercicios'}/>
      <Sep/>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 11.5, color: 'var(--grl)', marginBottom: 4 }}>Material</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {material.length ? material.map(m => <span key={m} style={{ fontSize: 12, background: '#fff', border: '1px solid var(--bd)', borderRadius: 99, padding: '2px 10px', color: 'var(--gr)' }}>{m}</span>)
            : <span style={{ fontSize: 12, color: 'var(--grl)' }}>Sin material</span>}
        </div>
      </div>
      {zonas.length > 0 && <>
        <Sep/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative', width: 44, aspectRatio: '360/640' }}>
            <img src={`/cuerpo/${vista}_base.svg`} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', filter: 'grayscale(1)', opacity: .35 }}/>
            {zonas.flatMap(z => (((ZONAS_CUERPO.find(x => x.id === z.id) as any)?.[vista] || []) as number[][]).map((r, k) => (
              <div key={z.id + k} style={{ position: 'absolute', left: r[0] + '%', top: r[1] + '%', width: r[2] + '%', height: r[3] + '%', borderRadius: 5, background: 'var(--g)', opacity: .25 + .5 * z.peso }}/>
            )))}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--grl)', maxWidth: 120, lineHeight: 1.35 }}>Trabaja sobre todo <b style={{ color: 'var(--n)' }}>{top.join(', ')}</b></div>
        </div>
      </>}
    </div>
  )
}
const Kpi = ({ v, t }: { v: string, t: string }) => <div><b style={{ fontSize: 19, fontWeight: 600, display: 'block', lineHeight: 1.1 }}>{v}</b><small style={{ fontSize: 11.5, color: 'var(--grl)' }}>{t}</small></div>
const Sep = () => <div style={{ width: 1, height: 32, background: 'var(--bd)' }}/>

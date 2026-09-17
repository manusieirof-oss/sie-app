'use client'
import { useState } from 'react'
import { darDeBajaSerie } from '@/lib/gastos'

/**
 * DAR DE BAJA UN SERVICIO.
 *
 * Dejaste la limpieza en junio y tienes previsiones hasta diciembre. Esas seis
 * no van a existir nunca, y mientras estén ahí inflan el gasto de cada mes y
 * ensucian la media del concepto para siempre.
 *
 * Lo ya confirmado no se toca: son facturas que pagaste y siguen siendo gasto
 * deducible aunque el servicio se haya acabado.
 */
export default function ModalBajaSerie({ gasto, onCerrar, onHecho, onError }: {
  gasto: any
  onCerrar: () => void
  onHecho: () => void
  onError: (m: string) => void
}) {
  const [desde, setDesde] = useState(gasto?.fecha || '')
  const [guardando, setGuardando] = useState(false)

  async function darDeBaja() {
    if (!desde) return
    setGuardando(true)
    const r = await darDeBajaSerie(gasto.serie_id, desde)
    setGuardando(false)
    if (!r.ok) { onError(`No se ha podido dar de baja: ${r.error}`); return }
    if (r.borrados === 0) onError('No había ninguna previsión a partir de esa fecha.')
    onCerrar()
    onHecho()
  }

  return (
    <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)onCerrar()}}>
      <div className="modal" style={{maxWidth:400}}>
        <div className="modal-title">Dar de baja el servicio<button className="modal-close" onClick={onCerrar}>✕</button></div>
        <div style={{fontSize:11,color:'var(--n)',fontWeight:500,marginBottom:10}}>{gasto.concepto}</div>
        <div className="field">
          <label>¿Desde qué día ya no lo tienes?</label>
          <input className="input" type="date" value={desde} autoFocus onChange={e=>setDesde(e.target.value)}/>
        </div>
        <div style={{fontSize:10,color:'var(--grl)',lineHeight:1.6,marginBottom:10}}>
          Se quitarán las previsiones de esa fecha en adelante.
          {' '}<strong style={{color:'var(--n)'}}>Las facturas ya confirmadas no se tocan</strong>:
          {' '}son gasto deducible aunque el servicio se haya acabado.
        </div>
        <div style={{display:'flex',gap:8,marginTop:8}}>
          <button className="btn btn-d btn-sm" onClick={onCerrar}>Cancelar</button>
          <div style={{flex:1}}/>
          <button className="btn btn-p" onClick={darDeBaja} disabled={guardando || !desde}>
            {guardando?'…':'Dar de baja'}
          </button>
        </div>
      </div>
    </div>
  )
}

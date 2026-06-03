'use client'

export default function RecuperacionesTab({ ajustes, set }: any) {
  return (
    <div className="card">
      <div className="card-title">🔄 Política de recuperaciones</div>
      <div style={{marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',background:'var(--bl)',borderRadius:'var(--rl)',border:'1px solid var(--bd)'}}>
          <div>
            <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>Permitir recuperaciones</div>
            <div style={{fontSize:9,color:'var(--grl)',fontWeight:300}}>Los pacientes pueden recuperar clases perdidas</div>
          </div>
          <button onClick={()=>set('recuperaciones_activas',ajustes.recuperaciones_activas==='true'?'false':'true')}
            style={{width:40,height:22,borderRadius:99,background:ajustes.recuperaciones_activas==='true'?'var(--g)':'var(--bm)',border:'none',cursor:'pointer',transition:'background .2s',position:'relative'}}>
            <div style={{width:16,height:16,borderRadius:'50%',background:'#fff',position:'absolute',top:3,transition:'left .2s',left:ajustes.recuperaciones_activas==='true'?'21px':'3px',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}}/>
          </button>
        </div>
      </div>
      {ajustes.recuperaciones_activas==='true'&&(
        <div className="g2">
          <div className="field">
            <label>Plazo máximo para recuperar (días)</label>
            <input className="input" type="number" value={ajustes.recuperaciones_plazo_dias||'30'} onChange={e=>set('recuperaciones_plazo_dias',e.target.value)}/>
            <div style={{fontSize:9,color:'var(--grl)',marginTop:3}}>Si el paciente se da de baja, pierde las recuperaciones pendientes</div>
          </div>
          <div className="field">
            <label>Máximo recuperaciones por mes</label>
            <input className="input" type="number" value={ajustes.recuperaciones_max_mes||'0'} onChange={e=>set('recuperaciones_max_mes',e.target.value)}/>
            <div style={{fontSize:9,color:'var(--grl)',marginTop:3}}>0 = sin límite</div>
          </div>
          <div className="field" style={{gridColumn:'1/-1'}}>
            <label>Aviso mínimo para que la falta sea recuperable (horas)</label>
            <input className="input" type="number" value={ajustes.recuperaciones_aviso_horas||'0'} onChange={e=>set('recuperaciones_aviso_horas',e.target.value)}/>
            <div style={{fontSize:9,color:'var(--grl)',marginTop:3}}>0 = siempre recuperable independientemente del aviso</div>
          </div>
        </div>
      )}
    </div>
  )
}

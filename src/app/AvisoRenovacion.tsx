'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'

// Aviso informativo que aparece a partir del día 27 de cada mes,
// recordando que las cuotas se renovarán al empezar el mes siguiente.
// Se muestra una sola vez por mes (se guarda en ajustes: aviso_renov_visto = 'YYYY-MM').
export default function AvisoRenovacion({ visible }: { visible: boolean }) {
  const [mostrar, setMostrar] = useState(false)
  const [clave, setClave] = useState('')

  useEffect(() => {
    if (!visible) return
    const hoy = new Date()
    const dia = hoy.getDate()
    if (dia < 27) return
    const claveMes = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`
    setClave(claveMes)
    supabase.from('ajustes').select('valor').eq('clave','aviso_renov_visto').maybeSingle().then(({ data }) => {
      if (data?.valor !== claveMes) setMostrar(true)
    })
  }, [visible])

  async function cerrar() {
    await supabase.from('ajustes').upsert({ clave: 'aviso_renov_visto', valor: clave }, { onConflict: 'clave' })
    setMostrar(false)
  }

  if (!mostrar) return null

  const finMes = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0)
  const finMesStr = finMes.toLocaleDateString('es-ES', { day:'numeric', month:'long' })

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:20}}>
      <div style={{background:'var(--w)',borderRadius:14,maxWidth:440,width:'100%',padding:'26px 26px 20px',boxShadow:'0 10px 40px rgba(0,0,0,.25)'}}>
        <div style={{textAlign:'center',marginBottom:10,color:'var(--g)',display:'flex',justifyContent:'center'}}><Ic name="recuperar" size={34} strokeWidth={1.5}/></div>
        <div style={{fontSize:16,fontWeight:600,color:'var(--n)',textAlign:'center',marginBottom:12}}>Renovación de cuotas próxima</div>
        <div style={{fontSize:12,color:'var(--gr)',lineHeight:1.7,marginBottom:18}}>
          El <strong>{finMesStr}</strong>, al terminar el mes, las cuotas de todos los bonos activos se renovarán automáticamente para el mes siguiente y volverán a quedar como <strong>pendientes de pago</strong>.
          <br/><br/>
          Es un buen momento para dejar todo listo:
          <ul style={{margin:'8px 0 0',paddingLeft:20}}>
            <li style={{marginBottom:4}}>Dar de <strong>baja</strong> a quien no continúe.</li>
            <li style={{marginBottom:4}}>Ajustar <strong>tipos de bono</strong> que cambien.</li>
            <li>Revisar los <strong>descuentos</strong> (se mantienen al renovar).</li>
          </ul>
        </div>
        <button onClick={cerrar} style={{width:'100%',padding:'11px',borderRadius:8,border:'none',background:'var(--g)',color:'#fff',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'system-ui'}}>
          Entendido
        </button>
      </div>
    </div>
  )
}

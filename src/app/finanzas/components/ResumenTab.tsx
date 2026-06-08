'use client'

export default function ResumenTab({ planes, gastos, bonos }: any) {
  // Mapa de precios finales por tipo de bono
  const precioPorTipo: Record<string, number> = {}
  planes.forEach((p: any) => {
    precioPorTipo[p.bono_tipo] = p.precio_final != null ? Number(p.precio_final) : Math.round(p.precio_base * (1 + p.iva/100) * 100) / 100
  })

  // Bonos activos
  const bonosActivos = bonos.filter((b: any) => b.activo)

  // Ingresos previstos = todos los bonos activos
  const ingresosPrevistos = bonosActivos.reduce((acc: number, b: any) => acc + (precioPorTipo[b.tipo] || 0), 0)

  // Ingresos cobrados = bonos activos con estado pagado
  const ingresosCobrados = bonosActivos.filter((b: any) => b.estado_pago === 'pagado').reduce((acc: number, b: any) => acc + (precioPorTipo[b.tipo] || 0), 0)

  // Pendiente de cobro
  const pendienteCobro = bonosActivos.filter((b: any) => b.estado_pago === 'pendiente' || b.estado_pago === 'impago').reduce((acc: number, b: any) => acc + (precioPorTipo[b.tipo] || 0), 0)

  // Gastos del mes actual
  const mesActual = new Date().toISOString().slice(0, 7)
  const gastosMes = gastos.filter((g: any) => g.fecha?.slice(0, 7) === mesActual).reduce((acc: number, g: any) => acc + Number(g.importe), 0)

  // Gastos fijos (se cuentan siempre)
  const gastosFijos = gastos.filter((g: any) => g.tipo === 'fijo').reduce((acc: number, g: any) => acc + Number(g.importe), 0)

  const beneficioPrevisto = ingresosPrevistos - gastosMes
  const beneficioReal = ingresosCobrados - gastosMes

  // Desglose por tipo de bono
  const desglose: Record<string, { count: number, total: number }> = {}
  bonosActivos.forEach((b: any) => {
    if (!desglose[b.tipo]) desglose[b.tipo] = { count: 0, total: 0 }
    desglose[b.tipo].count++
    desglose[b.tipo].total += precioPorTipo[b.tipo] || 0
  })

  return (
    <div>
      {/* TARJETAS PRINCIPALES */}
      <div className="g2" style={{marginBottom:14}}>
        <div className="card" style={{textAlign:'center'}}>
          <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Ingresos previstos / mes</div>
          <div style={{fontSize:30,fontWeight:300,color:'var(--g)'}}>{ingresosPrevistos.toFixed(0)}€</div>
          <div style={{fontSize:9,color:'var(--grl)',marginTop:4}}>{bonosActivos.length} bonos activos</div>
        </div>
        <div className="card" style={{textAlign:'center'}}>
          <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Beneficio previsto / mes</div>
          <div style={{fontSize:30,fontWeight:300,color:beneficioPrevisto>=0?'var(--g)':'var(--red)'}}>{beneficioPrevisto.toFixed(0)}€</div>
          <div style={{fontSize:9,color:'var(--grl)',marginTop:4}}>tras {gastosMes.toFixed(0)}€ de gastos</div>
        </div>
      </div>

      {/* DESGLOSE COBRADO / PENDIENTE */}
      <div className="card" style={{marginBottom:14}}>
        <div className="card-title">Estado de cobros</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
          <div style={{background:'var(--gl)',borderRadius:6,padding:'10px',textAlign:'center'}}>
            <div style={{fontSize:18,fontWeight:400,color:'var(--gd)'}}>{ingresosCobrados.toFixed(0)}€</div>
            <div style={{fontSize:8,color:'var(--grl)',marginTop:2}}>✓ Cobrado</div>
          </div>
          <div style={{background:'var(--ambl)',borderRadius:6,padding:'10px',textAlign:'center'}}>
            <div style={{fontSize:18,fontWeight:400,color:'#7A5800'}}>{pendienteCobro.toFixed(0)}€</div>
            <div style={{fontSize:8,color:'var(--grl)',marginTop:2}}>⏳ Pendiente</div>
          </div>
          <div style={{background:'var(--redl)',borderRadius:6,padding:'10px',textAlign:'center'}}>
            <div style={{fontSize:18,fontWeight:400,color:'var(--red)'}}>{gastosMes.toFixed(0)}€</div>
            <div style={{fontSize:8,color:'var(--grl)',marginTop:2}}>🧾 Gastos mes</div>
          </div>
        </div>
      </div>

      {/* DESGLOSE POR BONO */}
      <div className="card">
        <div className="card-title">Desglose por tipo de bono</div>
        {Object.keys(desglose).length===0 ? (
          <div style={{fontSize:11,color:'var(--grl)',padding:10}}>Sin bonos activos</div>
        ) : (
          Object.entries(desglose).map(([tipo, d]: any) => {
            const plan = planes.find((p:any)=>p.bono_tipo===tipo)
            return (
              <div key={tipo} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:6,background:'var(--bl)',marginBottom:5}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,fontWeight:500,color:'var(--n)'}}>{plan?.nombre || tipo}</div>
                  <div style={{fontSize:9,color:'var(--grl)'}}>{d.count} {d.count===1?'paciente':'pacientes'}</div>
                </div>
                <div style={{fontSize:13,fontWeight:600,color:'var(--g)'}}>{d.total.toFixed(0)}€</div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

(function(){
  function render(ctx){
    ctx.setTitle('Informes');

    const db = ctx.db;
    const inv = db.data.invoices;
    const exp = db.data.expenses;

    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    const inMonth = (iso, yy, mm)=>{
      const d = new Date(iso);
      return d.getFullYear()===yy && d.getMonth()===mm;
    };

    const invMonth = inv.filter(i=>inMonth(i.issued_at,y,m));
    const expMonth = exp.filter(e=>inMonth(e.date,y,m));

    const ingresos = invMonth.reduce((a,x)=>a+Number(x.total||0),0);
    const gastos = expMonth.reduce((a,x)=>a+Number(x.amount||0),0);
    const beneficio = ingresos - gastos;

    // Ventas por método
    const byMethod = {};
    invMonth.forEach(i=>{
      const k = i.payment_method || '—';
      byMethod[k] = (byMethod[k]||0) + Number(i.total||0);
    });

    // Gastos por categoría
    const byCat = {};
    expMonth.forEach(e=>{
      const k = e.category || '—';
      byCat[k] = (byCat[k]||0) + Number(e.amount||0);
    });

    ctx.appEl.innerHTML = `
      <div class="kpis">
        <div class="kpi">
          <div class="kpi__label">Ingresos (mes)</div>
          <div class="kpi__value">${Utils.formatEUR(ingresos, db.settings.locale)}</div>
          <div class="kpi__sub">${invMonth.length} facturas</div>
        </div>
        <div class="kpi">
          <div class="kpi__label">Gastos (mes)</div>
          <div class="kpi__value">${Utils.formatEUR(gastos, db.settings.locale)}</div>
          <div class="kpi__sub">${expMonth.length} apuntes</div>
        </div>
        <div class="kpi">
          <div class="kpi__label">Beneficio aprox. (mes)</div>
          <div class="kpi__value">${Utils.formatEUR(beneficio, db.settings.locale)}</div>
          <div class="kpi__sub">Ingresos − gastos</div>
        </div>
        <div class="kpi">
          <div class="kpi__label">Pendientes de cobro</div>
          <div class="kpi__value">${inv.filter(i=>i.payment_status!=='pagada').length}</div>
          <div class="kpi__sub">Facturas no pagadas</div>
        </div>
      </div>

      <hr class="sep"/>

      <div class="row">
        <div class="col">
          <h3 style="margin:0 0 10px">Ingresos por método (mes)</h3>
          <div class="tableWrap">
            <table>
              <thead><tr><th>Método</th><th class="right">Total</th></tr></thead>
              <tbody>
                ${Object.keys(byMethod).sort().map(k=>`<tr><td>${Utils.escapeHtml(k)}</td><td class="right nowrap">${Utils.formatEUR(byMethod[k], db.settings.locale)}</td></tr>`).join('') || `<tr><td colspan="2" class="small">Sin datos.</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
        <div class="col">
          <h3 style="margin:0 0 10px">Gastos por categoría (mes)</h3>
          <div class="tableWrap">
            <table>
              <thead><tr><th>Categoría</th><th class="right">Total</th></tr></thead>
              <tbody>
                ${Object.keys(byCat).sort().map(k=>`<tr><td>${Utils.escapeHtml(k)}</td><td class="right nowrap">${Utils.formatEUR(byCat[k], db.settings.locale)}</td></tr>`).join('') || `<tr><td colspan="2" class="small">Sin datos.</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="small" style="margin-top:10px">Estos informes son básicos por diseño (sencillez). Si quieres, en una siguiente versión añadimos gráficos y comparativas por meses.</div>
    `;
  }

  window.ModReports = { render };
})();

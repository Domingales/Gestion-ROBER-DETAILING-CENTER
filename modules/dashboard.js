(function(){
  function render(ctx){
    ctx.setTitle('Panel');

    const db = ctx.db;
    const today = Utils.todayYMD();
    const day = db.data.cashDays.find(d=>d.date===today);
    const cashOpen = !!day?.opened_at && !day?.closed_at;

    const pendingInvoices = db.data.invoices.filter(i=>i.payment_status!=='pagada').length;
    const lowStock = db.data.products.filter(p=>Number(p.stock||0) <= Number(p.min_stock||0)).length;

    // KPIs mes actual
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const inMonth = (iso)=>{
      const d = new Date(iso);
      return d.getFullYear()===y && d.getMonth()===m;
    };
    const invMonth = db.data.invoices.filter(i=>inMonth(i.issued_at));
    const expMonth = db.data.expenses.filter(e=>inMonth(e.date));
    const ingresos = invMonth.reduce((a,x)=>a+Number(x.total||0),0);
    const gastos = expMonth.reduce((a,x)=>a+Number(x.amount||0),0);

    ctx.appEl.innerHTML = `
      <div class="kpis">
        <div class="kpi">
          <div class="kpi__label">Caja hoy</div>
          <div class="kpi__value">${cashOpen ? 'ABIERTA' : 'CERRADA'}</div>
          <div class="kpi__sub">${today}</div>
        </div>
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
          <div class="kpi__label">Pendientes / Stock bajo</div>
          <div class="kpi__value">${pendingInvoices} · ${lowStock}</div>
          <div class="kpi__sub">Facturas / productos</div>
        </div>
      </div>

      <hr class="sep"/>

      <div class="row">
        <div class="col">
          <h3 style="margin:0 0 10px">Accesos rápidos</h3>
          <div class="row" style="gap:10px">
            <button class="btn btn--primary" id="goNewInvoice">Nueva factura</button>
            <button class="btn btn--primary" id="goNewDelivery">Nuevo albarán</button>
            <button class="btn" id="goCash">${cashOpen ? 'Ir a caja (abierta)' : 'Abrir caja hoy'}</button>
            <button class="btn" id="goExport">Importar / Exportar</button>
          </div>
          <div class="small" style="margin-top:10px">
            Recomendación operativa: usa albarán para el trabajo del día y factura cuando cobres o cierres el servicio.
          </div>
        </div>

        <div class="col">
          <h3 style="margin:0 0 10px">Avisos</h3>
          <div class="row">
            <div class="col">
              <div class="badge ${pendingInvoices? 'badge--warn':'badge--ok'}">
                Facturas pendientes: <b>${pendingInvoices}</b>
              </div>
            </div>
            <div class="col">
              <div class="badge ${lowStock? 'badge--warn':'badge--ok'}">
                Stock bajo: <b>${lowStock}</b>
              </div>
            </div>
          </div>
          <div class="small" style="margin-top:10px">
            Consejo: haz backup JSON (barra superior) semanalmente.
          </div>
        </div>
      </div>
    `;

    ctx.appEl.querySelector('#goNewInvoice').onclick = ()=> location.hash = '#/invoices?new=1';
    ctx.appEl.querySelector('#goNewDelivery').onclick = ()=> location.hash = '#/deliverynotes?new=1';
    ctx.appEl.querySelector('#goCash').onclick = ()=> location.hash = '#/cash';
    ctx.appEl.querySelector('#goExport').onclick = ()=> location.hash = '#/importexport';
  }

  window.ModDashboard = { render };
})();

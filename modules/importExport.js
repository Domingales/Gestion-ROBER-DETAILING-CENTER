(function(){
  const SCHEMAS = {
    invoices: {
      filename: 'facturas.csv',
      columns: ['id','number','issued_at','client_id','client_name','payment_status','payment_method','paid_amount','base','vat','total','notes','related_delivery_numbers','lines_json'],
      getRows: (db)=> db.data.invoices.map(i=>({
        id:i.id,
        number:i.number,
        issued_at:i.issued_at,
        client_id:i.client_id,
        client_name:i.client_name||'',
        payment_status:i.payment_status||'pendiente',
        payment_method:i.payment_method||'',
        paid_amount:i.paid_amount||0,
        base:i.base||0,
        vat:i.vat||0,
        total:i.total||0,
        notes:i.notes||'',
        related_delivery_numbers:(i.related_delivery_numbers||[]).join(', '),
        lines_json: JSON.stringify(i.lines||[])
      })),
      apply: (db, rows)=> {
        db.data.invoices = rows.map(r=>({
          id: r.id || Utils.uid('fac'),
          number: r.number,
          issued_at: r.issued_at,
          client_id: r.client_id || '',
          client_name: r.client_name || '',
          payment_status: r.payment_status || 'pendiente',
          payment_method: r.payment_method || '',
          paid_amount: Utils.parseNumber(r.paid_amount),
          base: Utils.parseNumber(r.base),
          vat: Utils.parseNumber(r.vat),
          total: Utils.parseNumber(r.total),
          notes: r.notes || '',
          related_delivery_numbers: (r.related_delivery_numbers||'').split(',').map(s=>s.trim()).filter(Boolean),
          related_delivery_ids: [],
          lines: safeJSON(r.lines_json, [])
        }));
      }
    },
    deliverynotes: {
      filename: 'albaranes.csv',
      columns: ['id','number','created_at','client_id','client_name','status','payment_method','base','vat','total','notes','invoice_number','lines_json'],
      getRows: (db)=> db.data.deliveryNotes.map(d=>({
        id:d.id,
        number:d.number,
        created_at:d.created_at,
        client_id:d.client_id,
        client_name:d.client_name||'',
        status:d.status||'pendiente',
        payment_method:d.payment_method||'',
        base:d.base||0,
        vat:d.vat||0,
        total:d.total||0,
        notes:d.notes||'',
        invoice_number:d.invoice_number||'',
        lines_json: JSON.stringify(d.lines||[])
      })),
      apply: (db, rows)=>{
        db.data.deliveryNotes = rows.map(r=>({
          id: r.id || Utils.uid('alb'),
          number: r.number,
          created_at: r.created_at,
          client_id: r.client_id || '',
          client_name: r.client_name || '',
          status: r.status || 'pendiente',
          payment_method: r.payment_method || '',
          base: Utils.parseNumber(r.base),
          vat: Utils.parseNumber(r.vat),
          total: Utils.parseNumber(r.total),
          notes: r.notes || '',
          invoice_number: r.invoice_number || '',
          invoice_id: null,
          lines: safeJSON(r.lines_json, [])
        }));
      }
    },
    products: {
      filename: 'stock_productos.csv',
      columns: ['id','name','category','unit','vendor','stock','min_stock','cost_unit','location','notes'],
      getRows: (db)=> db.data.products.map(p=>({
        id:p.id, name:p.name, category:p.category||'', unit:p.unit||'',
        vendor:p.vendor||'', stock:p.stock||0, min_stock:p.min_stock||0,
        cost_unit:p.cost_unit||0, location:p.location||'', notes:p.notes||''
      })),
      apply: (db, rows)=>{
        db.data.products = rows.map(r=>({
          id: r.id || Utils.uid('prd'),
          name: r.name,
          category: r.category||'',
          unit: r.unit||'uds',
          vendor: r.vendor||'',
          stock: Utils.parseNumber(r.stock),
          min_stock: Utils.parseNumber(r.min_stock),
          cost_unit: Utils.parseNumber(r.cost_unit),
          location: r.location||'',
          notes: r.notes||''
        }));
      }
    },
    clients: {
      filename: 'clientes.csv',
      columns: ['id','created_at','name','tax_id','phone','email','address','notes'],
      getRows: (db)=> db.data.clients.map(c=>({
        id:c.id, created_at:c.created_at, name:c.name, tax_id:c.tax_id||'',
        phone:c.phone||'', email:c.email||'', address:c.address||'', notes:c.notes||''
      })),
      apply: (db, rows)=>{
        db.data.clients = rows.map(r=>({
          id: r.id || Utils.uid('cli'),
          created_at: r.created_at || new Date().toISOString(),
          name: r.name,
          tax_id: r.tax_id||'',
          phone: r.phone||'',
          email: r.email||'',
          address: r.address||'',
          notes: r.notes||''
        }));
      }
    },
    expenses: {
      filename: 'gastos.csv',
      columns: ['id','date','vendor','category','concept','method','amount','notes'],
      getRows: (db)=> db.data.expenses.map(e=>({
        id:e.id, date:e.date, vendor:e.vendor||'', category:e.category||'',
        concept:e.concept||'', method:e.method||'', amount:e.amount||0, notes:e.notes||''
      })),
      apply: (db, rows)=>{
        db.data.expenses = rows.map(r=>({
          id: r.id || Utils.uid('gas'),
          date: r.date || new Date().toISOString(),
          vendor: r.vendor||'',
          category: r.category||'Otros',
          concept: r.concept||'',
          method: r.method||'transferencia',
          amount: Utils.parseNumber(r.amount),
          notes: r.notes||''
        }));
      }
    }
  };

  function safeJSON(s, fallback){
    try{ return JSON.parse(s||''); }catch(e){ return fallback; }
  }

  function render(ctx){
    ctx.setTitle('Importar / Exportar (Excel)');

    const db = ctx.db;

    ctx.appEl.innerHTML = `
      <div class="badge badge--info">Exporta en CSV (separado por <b>;</b>). Excel lo abre directamente.</div>

      <hr class="sep"/>

      <div class="row">
        <div class="col">
          <h3 style="margin:0 0 10px">Exportar</h3>
          <div class="row" style="gap:10px">
            ${Object.keys(SCHEMAS).map(k=>`<button class="btn btn--primary" data-exp="${k}">Exportar ${label(k)}</button>`).join('')}
          </div>
          <div class="small" style="margin-top:8px">También puedes hacer backup JSON desde arriba (barra superior).</div>
        </div>
      </div>

      <hr class="sep"/>

      <div class="row">
        <div class="col">
          <h3 style="margin:0 0 10px">Importar</h3>
          <div class="field">
            <div class="label">Selecciona módulo</div>
            <select class="select" id="impKind">
              ${Object.keys(SCHEMAS).map(k=>`<option value="${k}">${label(k)}</option>`).join('')}
            </select>
          </div>
          <button class="btn" id="btnPickCsv">Elegir CSV…</button>
          <input type="file" id="fileCsv" accept=".csv,text/csv" hidden />

          <div class="small" style="margin-top:10px">
            Importación recomendada: usa un CSV exportado por esta misma app. El import sustituye el módulo completo.
          </div>
        </div>

        <div class="col">
          <h3 style="margin:0 0 10px">Plantillas de cabeceras</h3>
          <div class="small">Si necesitas crear CSV a mano, respeta estas cabeceras:</div>
          <div class="tableWrap" style="margin-top:8px; min-width:300px">
            <table>
              <thead><tr><th>Módulo</th><th>Cabeceras</th></tr></thead>
              <tbody>
                ${Object.keys(SCHEMAS).map(k=>`
                  <tr>
                    <td>${label(k)}</td>
                    <td class="mono">${SCHEMAS[k].columns.join(';')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    ctx.appEl.querySelectorAll('[data-exp]').forEach(btn=>{
      btn.onclick = ()=>{
        const kind = btn.getAttribute('data-exp');
        exportKind(db, kind);
      };
    });

    const fileInput = ctx.appEl.querySelector('#fileCsv');
    ctx.appEl.querySelector('#btnPickCsv').onclick = ()=>Utils.openFilePicker(fileInput);

    fileInput.addEventListener('change', (e)=>{
      const file = e.target.files && e.target.files[0];
      if(!file) return;
      const kind = ctx.appEl.querySelector('#impKind').value;
      importKind(ctx, kind, file);
    });
  }

  function exportKind(db, kind){
    const schema = SCHEMAS[kind];
    const rows = schema.getRows(db);
    const csv = CSV.toCSV(rows, schema.columns);
    CSV.downloadText(schema.filename, csv, 'text/csv;charset=utf-8');
    Utils.toast(`Exportado: ${schema.filename}`);
  }

  function importKind(ctx, kind, file){
    const schema = SCHEMAS[kind];
    const reader = new FileReader();
    reader.onload = ()=>{
      const text = reader.result;
      const parsed = CSV.parseCSV(text);
      // Validar cabecera
      const missing = schema.columns.filter(c=>!parsed.header.includes(c));
      if(missing.length){
        alert('CSV inválido. Faltan columnas: ' + missing.join(', '));
        return;
      }
      if(!confirm(`Importar ${label(kind)} reemplazará los datos actuales de ese módulo. ¿Continuar?`)) return;

      const rows = parsed.rows.map(r=>{
        const o = {};
        schema.columns.forEach(c=>o[c]=r[c] ?? '');
        return o;
      });

      const db = ctx.db;
      schema.apply(db, rows);
      ctx.setDB(db);
      Utils.toast(`Importado: ${label(kind)}`);
      location.hash = '#/dashboard';
    };
    reader.readAsText(file, 'utf-8');
  }

  function label(kind){
    return ({
      invoices:'Facturas',
      deliverynotes:'Albaranes',
      products:'Stock (productos)',
      clients:'Clientes',
      expenses:'Gastos'
    })[kind] || kind;
  }

  window.ModImportExport = { render };
})();

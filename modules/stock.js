(function(){
  function render(ctx){
    ctx.setTitle('Stock');

    const db = ctx.db;
    const products = db.data.products.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||''));

    const btnNew = document.createElement('button');
    btnNew.className = 'btn btn--primary';
    btnNew.textContent = 'Nuevo producto';
    btnNew.onclick = ()=>openProductForm(ctx, null);

    const btnMove = document.createElement('button');
    btnMove.className = 'btn';
    btnMove.textContent = 'Movimiento de stock';
    btnMove.onclick = ()=>openMoveForm(ctx);

    ctx.setActions([btnNew, btnMove]);

    ctx.appEl.innerHTML = `
      <div class="row">
        <div class="col">
          <div class="field">
            <div class="label">Buscar</div>
            <input class="input" id="q" placeholder="Producto, categoría, proveedor..." />
          </div>
        </div>
      </div>

      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Unidad</th>
              <th class="right">Stock</th>
              <th class="right">Mínimo</th>
              <th>Proveedor</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
      </div>

      <hr class="sep"/>

      <h3 style="margin:0 0 10px">Últimos movimientos</h3>
      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Producto</th>
              <th>Tipo</th>
              <th class="right">Cantidad</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody id="mrows"></tbody>
        </table>
      </div>
    `;

    const rowsEl = ctx.appEl.querySelector('#rows');
    const qEl = ctx.appEl.querySelector('#q');
    const mrowsEl = ctx.appEl.querySelector('#mrows');

    const renderRows = ()=>{
      const q = (qEl.value||'').toLowerCase().trim();
      const filtered = !q ? products : products.filter(p=>{
        return [p.name,p.category,p.vendor,p.unit,p.location].some(v=>String(v||'').toLowerCase().includes(q));
      });

      rowsEl.innerHTML = filtered.map(p=>{
        const low = Number(p.stock||0) <= Number(p.min_stock||0);
        const badge = low ? 'badge--warn' : 'badge--ok';
        return `
          <tr>
            <td><b>${Utils.escapeHtml(p.name||'')}</b> ${low?`<span class="badge ${badge}">Bajo</span>`:''}</td>
            <td>${Utils.escapeHtml(p.category||'')}</td>
            <td>${Utils.escapeHtml(p.unit||'uds')}</td>
            <td class="right mono">${Utils.formatNumber(p.stock||0,'es-ES',2)}</td>
            <td class="right mono">${Utils.formatNumber(p.min_stock||0,'es-ES',2)}</td>
            <td>${Utils.escapeHtml(p.vendor||'')}</td>
            <td class="nowrap">
              <button class="btn btn--ghost" data-edit="${p.id}">Editar</button>
              <button class="btn btn--danger" data-del="${p.id}">Eliminar</button>
            </td>
          </tr>
        `;
      }).join('') || `<tr><td colspan="7" class="small">Sin productos.</td></tr>`;

      rowsEl.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{
        const id = b.getAttribute('data-edit');
        const p = db.data.products.find(x=>x.id===id);
        openProductForm(ctx, p);
      });

      rowsEl.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{
        const id = b.getAttribute('data-del');
        const p = db.data.products.find(x=>x.id===id);
        if(!p) return;
        const hasMoves = db.data.stockMoves.some(m=>m.product_id===id);
        if(hasMoves){
          alert('No se puede eliminar un producto con movimientos. Si no se usa, pon stock mínimo=0 y añade nota/ubicación.');
          return;
        }
        if(!Utils.confirmDanger('¿Eliminar producto?')) return;
        db.data.products = db.data.products.filter(x=>x.id!==id);
        ctx.setDB(db);
        Utils.toast('Producto eliminado.');
        render(ctx);
      });
    };

    const moves = db.data.stockMoves.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,12);
    mrowsEl.innerHTML = moves.map(m=>{
      const p = db.data.products.find(x=>x.id===m.product_id);
      const badge = m.type==='in' ? 'badge--ok' : (m.type==='out'?'badge--warn':'badge--info');
      const t = m.type==='in' ? 'Entrada' : (m.type==='out'?'Salida':'Ajuste');
      return `
        <tr>
          <td class="nowrap">${new Date(m.date).toLocaleString('es-ES')}</td>
          <td>${Utils.escapeHtml(p?.name || m.product_name || '')}</td>
          <td><span class="badge ${badge}">${t}</span></td>
          <td class="right mono">${Utils.formatNumber(m.qty||0,'es-ES',2)}</td>
          <td>${Utils.escapeHtml(m.reason||'')}</td>
        </tr>
      `;
    }).join('') || `<tr><td colspan="5" class="small">Sin movimientos.</td></tr>`;

    qEl.addEventListener('input', renderRows);
    renderRows();
  }

  function openProductForm(ctx, product){
    const db = ctx.db;
    const isNew = !product;
    const p = product ? JSON.parse(JSON.stringify(product)) : {
      id: Utils.uid('prd'),
      name: '',
      category: 'Químicos',
      unit: 'uds',
      vendor: '',
      stock: 0,
      min_stock: 0,
      cost_unit: 0,
      location: '',
      notes: ''
    };

    Modal.open({
      title: isNew ? 'Nuevo producto' : 'Editar producto',
      bodyHTML: `
        <div class="row">
          <div class="col">
            <div class="field">
              <div class="label">Nombre *</div>
              <input class="input" id="pName" value="${Utils.escapeHtml(p.name||'')}" />
            </div>
          </div>
          <div class="col">
            <div class="field">
              <div class="label">Categoría</div>
              <input class="input" id="pCat" value="${Utils.escapeHtml(p.category||'')}" />
            </div>
          </div>
          <div class="col">
            <div class="field">
              <div class="label">Unidad (uds/L/ml...)</div>
              <input class="input" id="pUnit" value="${Utils.escapeHtml(p.unit||'uds')}" />
            </div>
          </div>
        </div>

        <div class="row">
          <div class="col">
            <div class="field">
              <div class="label">Stock actual</div>
              <input class="input" id="pStock" value="${Utils.formatNumber(p.stock||0,'es-ES',2).replace('.',',')}" />
            </div>
          </div>
          <div class="col">
            <div class="field">
              <div class="label">Stock mínimo</div>
              <input class="input" id="pMin" value="${Utils.formatNumber(p.min_stock||0,'es-ES',2).replace('.',',')}" />
            </div>
          </div>
          <div class="col">
            <div class="field">
              <div class="label">Coste unitario (opcional)</div>
              <input class="input" id="pCost" value="${Utils.formatNumber(p.cost_unit||0,'es-ES',2).replace('.',',')}" />
            </div>
          </div>
        </div>

        <div class="row">
          <div class="col">
            <div class="field">
              <div class="label">Proveedor</div>
              <input class="input" id="pVendor" value="${Utils.escapeHtml(p.vendor||'')}" />
            </div>
          </div>
          <div class="col">
            <div class="field">
              <div class="label">Ubicación</div>
              <input class="input" id="pLoc" value="${Utils.escapeHtml(p.location||'')}" />
            </div>
          </div>
        </div>

        <div class="field">
          <div class="label">Notas</div>
          <textarea class="textarea" id="pNotes">${Utils.escapeHtml(p.notes||'')}</textarea>
        </div>
      `,
      footerButtons: [
        mkBtn('Cancelar','btn', ()=>Modal.close()),
        mkBtn('Guardar','btn btn--primary', ()=>{
          p.name = document.getElementById('pName').value.trim();
          if(!p.name){ Utils.toast('El nombre es obligatorio.'); return; }
          p.category = document.getElementById('pCat').value.trim();
          p.unit = document.getElementById('pUnit').value.trim() || 'uds';
          p.stock = Utils.parseNumber(document.getElementById('pStock').value);
          p.min_stock = Utils.parseNumber(document.getElementById('pMin').value);
          p.cost_unit = Utils.parseNumber(document.getElementById('pCost').value);
          p.vendor = document.getElementById('pVendor').value.trim();
          p.location = document.getElementById('pLoc').value.trim();
          p.notes = document.getElementById('pNotes').value.trim();

          if(isNew){
            db.data.products.push(p);
          }else{
            const idx = db.data.products.findIndex(x=>x.id===p.id);
            if(idx>=0) db.data.products[idx] = p;
          }
          ctx.setDB(db);
          Modal.close();
          Utils.toast('Producto guardado.');
          render(ctx);
        })
      ]
    });
  }

  function openMoveForm(ctx){
    const db = ctx.db;
    const products = db.data.products.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    if(products.length===0){
      alert('Primero crea al menos un producto.');
      return;
    }
    const options = products.map(p=>`<option value="${p.id}">${Utils.escapeHtml(p.name)}</option>`).join('');
    Modal.open({
      title:'Movimiento de stock',
      bodyHTML: `
        <div class="row">
          <div class="col">
            <div class="field">
              <div class="label">Producto</div>
              <select class="select" id="mProd">${options}</select>
            </div>
          </div>
          <div class="col">
            <div class="field">
              <div class="label">Tipo</div>
              <select class="select" id="mType">
                <option value="in">Entrada</option>
                <option value="out">Salida</option>
                <option value="adjust">Ajuste</option>
              </select>
            </div>
          </div>
          <div class="col">
            <div class="field">
              <div class="label">Cantidad *</div>
              <input class="input" id="mQty" placeholder="0,00" />
            </div>
          </div>
        </div>
        <div class="field">
          <div class="label">Motivo</div>
          <input class="input" id="mReason" placeholder="Compra, consumo, inventario..." />
        </div>
      `,
      footerButtons: [
        mkBtn('Cancelar','btn', ()=>Modal.close()),
        mkBtn('Guardar','btn btn--primary', ()=>{
          const productId = document.getElementById('mProd').value;
          const type = document.getElementById('mType').value;
          const qty = Utils.parseNumber(document.getElementById('mQty').value);
          const reason = document.getElementById('mReason').value.trim();
          if(qty<=0){ Utils.toast('Cantidad (>0) obligatoria.'); return; }
          const p = db.data.products.find(x=>x.id===productId);
          if(!p){ Utils.toast('Producto inválido.'); return; }

          let newStock = Number(p.stock||0);
          if(type==='in') newStock += qty;
          else if(type==='out') newStock -= qty;
          else if(type==='adjust') newStock = qty; // ajuste: la cantidad es el stock real
          p.stock = newStock;

          db.data.stockMoves.push({
            id: Utils.uid('mov'),
            date: new Date().toISOString(),
            product_id: p.id,
            product_name: p.name,
            type,
            qty,
            reason
          });

          ctx.setDB(db);
          Modal.close();
          Utils.toast('Movimiento guardado.');
          render(ctx);
        })
      ]
    });
  }

  function mkBtn(text, className, onClick){
    const b = document.createElement('button');
    b.className = className;
    b.textContent = text;
    b.onclick = onClick;
    return b;
  }

  window.ModStock = { render };
})();

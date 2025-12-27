(function(){
  const routes={
    dashboard:ModDashboard,
    cash:ModCash,
    clients:ModClients,
    deliverynotes:ModDeliveryNotes,
    invoices:ModInvoices,
    expenses:ModExpenses,
    stock:ModStock,
    reports:ModReports,
    importexport:ModImportExport,
    settings:ModSettings
  };

  function route(){
    const h=location.hash||'#/dashboard';
    return h.replace('#/','').split('?')[0];
  }

  function render(){
    const r=route();
    document.querySelectorAll('.nav__item')
      .forEach(a=>a.classList.toggle('active',a.dataset.route===r));
    const ctx={
      db:DB.load(),
      setDB:DB.save,
      appEl:document.getElementById('app'),
      setTitle:t=>document.getElementById('viewTitle').textContent=t,
      setActions:arr=>{
        const el=document.getElementById('viewActions');
        el.innerHTML='';
        arr.forEach(b=>el.appendChild(b));
      }
    };
    (routes[r]||routes.dashboard).render(ctx);
  }

  document.getElementById('btnBackupJson').onclick=()=>{
    CSV.downloadText('backup_rdc.json',JSON.stringify(DB.load(),null,2),'application/json');
    Utils.toast('Backup exportado');
  };

  const file=document.getElementById('fileRestoreJson');
  document.getElementById('btnRestoreJson').onclick=()=>Utils.openFilePicker(file);
  file.onchange=e=>{
    const f=e.target.files[0];
    const r=new FileReader();
    r.onload=()=>{
      if(confirm('¿Restaurar backup? Esto sobrescribe todo.')){
        DB.reset(JSON.parse(r.result));
        location.reload();
      }
    };
    r.readAsText(f);
  };

  window.addEventListener('hashchange',render);
  window.addEventListener('load',render);
})();

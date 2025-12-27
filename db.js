(function(){
  const KEY = 'rober_detailing_center_db_v1';

  function nowISO(){ return new Date().toISOString(); }

  function defaultDB(){
    const y = new Date().getFullYear();
    return {
      meta:{ app:'RDC', version:'1.0', created_at:nowISO(), updated_at:nowISO() },
      settings:{
        business:{
          comercial:'ROBER DETAILING CENTER',
          cif:'05.713.081 L',
          address:'',
          phone:'',
          email:'',
          vat_percent:21
        },
        numbering:{
          invoice_prefix:'F',
          delivery_prefix:'A',
          pad:6
        },
        counters_by_year:{ [y]:{invoice:1,delivery:1} },
        locale:'es-ES'
      },
      data:{
        clients:[],
        deliveryNotes:[],
        invoices:[],
        expenses:[],
        products:[],
        stockMoves:[],
        cashDays:[]
      }
    };
  }

  // tamaño aproximado (bytes) del JSON
  function sizeOf(db){
    try{
      const s = JSON.stringify(db);
      // UTF-16 ~ 2 bytes por char en JS
      return s.length * 2;
    }catch(e){
      return -1;
    }
  }

  function load(){
    const raw = localStorage.getItem(KEY);
    if(!raw){
      const db = defaultDB();
      try{ save(db); }catch(e){ /* si no puede, al menos devolvemos db */ }
      return db;
    }
    try{
      return JSON.parse(raw);
    }catch{
      const db = defaultDB();
      try{ save(db); }catch(e){ /* ignore */ }
      return db;
    }
  }

  function save(db){
    db.meta.updated_at = nowISO();

    // Control preventivo: si se acerca a 5MB, avisar
    const bytes = sizeOf(db);
    // umbral conservador: 4.5MB
    const LIMIT = 4.5 * 1024 * 1024;

    if(bytes > LIMIT){
      // No intentamos guardar para no romper la app
      console.error('DB demasiado grande para localStorage:', bytes, 'bytes');
      alert(
        'ATENCIÓN: La base de datos es demasiado grande para guardarse en este navegador.\n\n' +
        'Causa habitual: importaciones masivas o datos duplicados.\n\n' +
        'Solución recomendada: exporta backup y reinicia (o migrar a IndexedDB).\n\n' +
        'Tamaño aproximado: ' + Math.round(bytes/1024/1024*100)/100 + ' MB'
      );
      throw new DOMException('Quota preventiva: DB excede umbral seguro', 'QuotaExceededError');
    }

    // Guardar
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  function reset(db){
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  function wipe(){
    localStorage.removeItem(KEY);
  }

  window.DB = { load, save, reset, defaultDB, sizeOf, wipe };
})();

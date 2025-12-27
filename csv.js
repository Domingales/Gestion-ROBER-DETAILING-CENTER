(function(){
  function toCSV(rows,cols){
    const esc=v=>{
      const s=String(v??'');
      return /[;"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
    };
    const head=cols.map(esc).join(';');
    const body=rows.map(r=>cols.map(c=>esc(r[c])).join(';'));
    return [head,...body].join('\n');
  }

  function parseCSV(text){
    const [h,...lines]=text.split(/\r?\n/);
    const head=h.split(';');
    const rows=lines.filter(l=>l.trim()).map(l=>{
      const o={};
      l.split(';').forEach((v,i)=>o[head[i]]=v.replace(/^"|"$/g,''));
      return o;
    });
    return {header:head,rows};
  }

  function downloadText(name,text,type='text/plain'){
    const b=new Blob([text],{type});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(b);
    a.download=name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  window.CSV={toCSV,parseCSV,downloadText};
})();

(function(){
  function openPrintWindow(title,html){
    const w=window.open('','_blank');
    w.document.write(`
      <html><head><title>${title}</title></head>
      <body>${html}<script>window.print();<\/script></body></html>
    `);
    w.document.close();
  }

  window.Printing={openPrintWindow};
})();

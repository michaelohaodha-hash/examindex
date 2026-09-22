
(function(){
  const menu=document.getElementById('menu-toggle');
  const nav=document.getElementById('mobile-nav');
  if(menu && nav){
    menu.addEventListener('click',()=>{
      const open=nav.classList.toggle('is-open');
      menu.setAttribute('aria-expanded',open?'true':'false');
    });
    document.addEventListener('click',e=>{
      if(!nav.contains(e.target) && !menu.contains(e.target)) nav.classList.remove('is-open');
    });
  }

  document.querySelectorAll('.level-tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      const level=tab.dataset.level;
      document.querySelectorAll('.level-tab').forEach(t=>t.setAttribute('aria-selected',t.dataset.level===level?'true':'false'));
      document.querySelectorAll('.topic-panel').forEach(p=>p.hidden=p.dataset.level!==level);
      history.replaceState(null,'','#'+level);
    });
  });
  const hash=location.hash.slice(1);
  if(hash && document.querySelector('.level-tab[data-level="'+hash+'"]')) {
    document.querySelector('.level-tab[data-level="'+hash+'"]').click();
  }

  window.showPastPapers=function(subject){
    const year=document.getElementById('pp-year')?.value;
    const level=document.getElementById('pp-level')?.value;
    const type=document.getElementById('pp-type')?.value;
    const results=document.getElementById('pp-results');
    if(!year||!level||!type||!results)return;
    const labelLevel=level==='higher'?'Higher':'Ordinary';
    const labelType=type==='marking-scheme'?'Marking scheme':'Exam paper';
    const base='papers/'+subject+'/'+level+'/'+year+'-'+type;
    results.hidden=false;
    results.innerHTML='<p class="results-title">'+year+' · '+labelLevel+' · '+labelType+'</p>'+
      '<ul class="paper-links">'+
      '<li><a href="'+base+'-paper-1.pdf"><span>Paper 1</span><small>PDF →</small></a></li>'+
      '<li><a href="'+base+'-paper-2.pdf"><span>Paper 2</span><small>PDF →</small></a></li>'+
      '</ul><p class="note">A file will open when that paper is present in the archive.</p>';
  };

  document.querySelectorAll('[data-paper-filter]').forEach(el=>{
    el.addEventListener('change',()=>window.showPastPapers(el.dataset.paperFilter));
  });
})();

// Question image gallery lightbox — shared across any page with .q-thumb tiles.
(function(){
  let overlay=null, img=null, caption=null;

  function build(){
    overlay=document.createElement('div');
    overlay.className='lightbox-overlay';
    overlay.hidden=true;
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.innerHTML='<div class="lightbox-inner"><button type="button" class="lightbox-close" aria-label="Close">✕</button><img alt=""><p class="lightbox-caption"></p></div>';
    document.body.appendChild(overlay);
    img=overlay.querySelector('img');
    caption=overlay.querySelector('.lightbox-caption');
    overlay.addEventListener('click',e=>{
      if(e.target===overlay || e.target.closest('.lightbox-close')) close();
    });
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape' && overlay && !overlay.hidden) close();
    });
  }

  function open(src,label){
    if(!overlay) build();
    img.src=src;
    img.alt=label||'';
    caption.textContent=label||'';
    overlay.hidden=false;
  }

  function close(){
    if(overlay) overlay.hidden=true;
  }

  document.addEventListener('click',e=>{
    const thumb=e.target.closest('.q-thumb');
    if(!thumb) return;
    e.preventDefault();
    open(thumb.getAttribute('data-src'), thumb.getAttribute('data-caption'));
  });
})();

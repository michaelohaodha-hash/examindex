
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

  const searchInputs=document.querySelectorAll('[data-site-search]');
  searchInputs.forEach(input=>{
    input.addEventListener('keydown',e=>{
      if(e.key==='Enter'){
        const q=input.value.trim();
        if(q) window.location.href='index.html?q='+encodeURIComponent(q);
      }
    });
  });

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

  const searchResults=document.getElementById('search-results');
  const searchResultsWrap=searchResults?searchResults.querySelector('.wrap'):null;
  if(searchResults && searchResultsWrap){
    Promise.all([fetch('data/topics.json').then(r=>r.json()),fetch('data/topic-paths.json').then(r=>r.json())]).then(([data,pathMap])=>{
      const q=new URLSearchParams(location.search).get('q')?.trim().toLowerCase()||'';
      const input=document.querySelector('[data-site-search]');
      if(input) input.value=q;
      if(!q){searchResults.hidden=true;return;}
      const out=[];
      Object.entries(data).forEach(([subject,levels])=>{
        Object.entries(levels).forEach(([level,papers])=>{
          Object.entries(papers).forEach(([paper,items])=>{
            items.forEach(item=>{
              if((item.label+' '+subject+' '+level+' '+paper).toLowerCase().includes(q)){
                out.push({subject,level,paper,item});
              }
            });
          });
        });
      });
      if(!out.length){
        searchResults.hidden=false;
        searchResultsWrap.innerHTML='<div class="topic-empty"><div class="topic-empty-icon">⌕</div><h2>No topic matches</h2><p>Try a broader search such as “algebra”, “poetry”, or “comprehension”.</p></div>';
        return;
      }
      searchResults.hidden=false;
      searchResultsWrap.innerHTML='<div class="search-results-head"><strong>'+out.length+' topic'+(out.length===1?'':'s')+' found</strong><span>Search results</span></div>'+
        '<div class="topic-grid">'+out.map(x=>{
          const path=pathMap[x.subject+'|'+x.level+'|'+x.paper+'|'+x.item.topic] || ('topics/'+x.subject+'/'+x.level+'/'+x.paper+'/'+x.item.topic+'.html');
          return '<a class="topic-card" href="'+path+'"><span><span class="topic-name">'+x.item.label+'</span><span class="topic-detail">'+cap(x.subject)+' · '+cap(x.level)+' · '+cap(x.paper.replace('paper-','Paper '))+'</span></span><span class="topic-arrow">→</span></a>';
        }).join('')+'</div>';
    }).catch(()=>{});
  }
  function cap(s){return s.charAt(0).toUpperCase()+s.slice(1)}
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

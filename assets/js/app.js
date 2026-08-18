(function(){
  'use strict';
  const CATALOG = window.KINOSIS_CATALOG || {mode:'demo',updatedAt:'missing',movies:[],sections:{trending:[],theatres:[],streaming:[],rated:[]},featured:null};
  const movieMap = new Map((CATALOG.movies || []).map(m => [String(m.id), m]));
  const STORAGE_KEY = 'kinosis.mvp.v2.state';
  const LEGACY_STORAGE_KEY = 'film.mvp.v2.state';
  const PROVIDERS = [
    {key:'Netflix', label:'Netflix', aliases:['Netflix','Netflix Standard with Ads'], url:'https://www.netflix.com/kr/'},
    {key:'TVING', label:'TVING', aliases:['TVING'], url:'https://www.tving.com/'},
    {key:'Coupang Play', label:'Coupang Play', aliases:['Coupang Play'], url:'https://www.coupangplay.com/'},
    {key:'Disney+', label:'Disney+', aliases:['Disney Plus','Disney+'], url:'https://www.disneyplus.com/ko-kr'},
    {key:'WATCHA', label:'WATCHA', aliases:['Watcha','WATCHA'], url:'https://watcha.com/'},
    {key:'Wavve', label:'Wavve', aliases:['wavve','Wavve'], url:'https://www.wavve.com/'},
    {key:'Apple TV Plus', label:'Apple TV+', aliases:['Apple TV Plus','Apple TV+'], url:'https://tv.apple.com/kr'},
    {key:'Collectio', label:'콜렉티오', aliases:['Collectio','COLLECTIO','콜렉티오'], url:'https://collectio.co.kr/', manualOnly:true}
  ];
  let activeView = 'discover';
  let discoverMode = 'home';
  let libraryMode = 'home';
  let myMode = 'profile';
  let libraryFilter = {q:'', sort:'recent'};
  let calendarCursor = new Date();
  let toastTimer;

  function isoDate(date){ return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10); }
  function daysAgo(n){ const d=new Date(); d.setDate(d.getDate()-n); return isoDate(d); }
  function initialState(){
    const ids = (CATALOG.movies || []).map(m=>String(m.id));
    const pick = i => ids[i % Math.max(ids.length,1)];
    const library = {};
    if(ids.length){
      library[pick(0)]={savedAt:daysAgo(40),watched:true,watchlist:false,favorite:true,rating:5,review:'공연의 에너지와 영화의 리듬이 완전히 붙어 있다.'};
      library[pick(1)]={savedAt:daysAgo(33),watched:true,watchlist:false,favorite:true,rating:5,review:'규모가 커져도 마지막에는 관계와 선택으로 돌아온다.'};
      library[pick(2)]={savedAt:daysAgo(18),watched:false,watchlist:true,favorite:false,rating:null,review:''};
      library[pick(3)]={savedAt:daysAgo(65),watched:true,watchlist:false,favorite:false,rating:4,review:'장르 영화의 추진력 자체가 재미다.'};
      library[pick(4)]={savedAt:daysAgo(9),watched:false,watchlist:true,favorite:false,rating:null,review:''};
      library[pick(5)]={savedAt:daysAgo(7),watched:false,watchlist:true,favorite:false,rating:null,review:''};
    }
    const logs = ids.length ? [
      {id:'log-a',movieId:pick(0),watchedAt:daysAgo(1),rating:5,review:library[pick(0)].review},
      {id:'log-b',movieId:pick(1),watchedAt:daysAgo(6),rating:5,review:library[pick(1)].review},
      {id:'log-c',movieId:pick(3),watchedAt:daysAgo(12),rating:4,review:library[pick(3)].review}
    ] : [];
    return {
      profile:{name:'Local User',handle:'@local',bio:'영화를 발견하고 기록하는 로컬 프로필'},
      subscriptions:['Netflix','WATCHA'],
      settings:{lastExportAt:null,backupNudgeDismissedAt:null},
      library, logs,
      collections:[
        {id:'col-favorites',name:'다시 보고 싶은 영화',type:'manual',movieIds:ids.slice(0,2)},
        {id:'col-weekend',name:'주말에 볼 영화',type:'manual',movieIds:ids.slice(2,5)}
      ]
    };
  }
  function loadState(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if(!raw) return initialState();
      const parsed=JSON.parse(raw);
      return Object.assign(initialState(),parsed,{profile:Object.assign(initialState().profile,parsed.profile||{}),settings:Object.assign(initialState().settings,parsed.settings||{})});
    }catch(e){ console.warn(e); return initialState(); }
  }
  let state = loadState();
  function saveState(){ localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); }
  function icon(name){ return `<svg class="ui-icon" aria-hidden="true"><use href="#i-${name}"/></svg>`; }
  function formatDateTime(value){ if(!value)return '아직 백업하지 않음'; try{return new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}catch{return value;} }
  function needsBackup(){ return Object.keys(state.library).length>=3 && !state.settings?.lastExportAt && !state.settings?.backupNudgeDismissedAt; }
  function movie(id){ return movieMap.get(String(id)); }
  function lib(id){ return state.library[String(id)] || null; }
  function ensureLib(id){ const key=String(id); if(!state.library[key]) state.library[key]={savedAt:isoDate(new Date()),watched:false,watchlist:false,favorite:false,rating:null,review:''}; return state.library[key]; }
  function escapeHtml(s){ return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function poster(m){ return m?.posterUrl || './icons/icon.svg'; }
  function backdrop(m){ return m?.heroBackdropUrl || m?.backdropUrl || m?.posterUrl || './icons/icon.svg'; }
  function fmtRuntime(n){ if(!n) return ''; const h=Math.floor(n/60),min=n%60; return h ? `${h}h ${min}m` : `${min}m`; }
  function fmtRating(v){ return v ? `★ ${Number(v).toFixed(1)}` : '평점 없음'; }
  function stars(v){ if(!v) return '—'; return `★ ${Number(v).toFixed(1)}`; }
  function normalizeProviderName(value){ return String(value||'').toLowerCase().replace(/[^a-z0-9가-힣]+/g,''); }
  function providerConfigForName(name){ const n=normalizeProviderName(name); return PROVIDERS.find(p=>[p.key,p.label,...(p.aliases||[])].some(v=>normalizeProviderName(v)===n)) || null; }
  function isSubscriptionEnabled(key){ const n=normalizeProviderName(key); return (state.subscriptions||[]).some(v=>normalizeProviderName(v)===n); }
  function isSubscribedProvider(name){ const cfg=providerConfigForName(name); return cfg ? isSubscriptionEnabled(cfg.key) : isSubscriptionEnabled(name); }
  function subscriptionProviders(m){ return (m?.providers||[]).filter(p=>p.type==='subscription'); }
  function availableOnMine(m){ return subscriptionProviders(m).some(p=>isSubscribedProvider(p.name)); }
  function providersText(m){ const names=subscriptionProviders(m).map(p=>providerConfigForName(p.name)?.label||p.name); return names.slice(0,2).join(' · '); }
  function providerTypeLabel(type){ return ({subscription:'구독',free:'무료',ads:'광고 포함',rent:'대여',buy:'구매'})[type] || type; }
  function heroProviders(m){
    const rank={subscription:0,free:1,ads:2,rent:3,buy:4}; const seen=new Set();
    return [...(m?.providers||[])].sort((a,b)=>(rank[a.type]??9)-(rank[b.type]??9)).filter(p=>{const cfg=providerConfigForName(p.name); const k=normalizeProviderName(cfg?.key||p.name||p.id); if(seen.has(k)) return false; seen.add(k); return true;}).slice(0,5);
  }
  function heroTitleClass(title){ const n=[...String(title||'').replace(/\s/g,'')].length; return n>24?'hero-title is-xlong':n>15?'hero-title is-long':'hero-title'; }
  function uniqueById(list){ const seen=new Set(); return list.filter(x=>x&&!seen.has(String(x.id))&&seen.add(String(x.id))); }
  function allSavedMovies(){ return Object.keys(state.library).map(movie).filter(Boolean); }
  function latestLogs(){ return [...state.logs].sort((a,b)=>String(b.watchedAt).localeCompare(String(a.watchedAt))); }
  function latestUniqueMovies(){ const seen=new Set(); return latestLogs().map(l=>movie(l.movieId)).filter(m=>m&&!seen.has(String(m.id))&&seen.add(String(m.id))); }
  function toast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2200); }
  function showDialog(id){ const d=document.getElementById(id); if(d && !d.open) d.showModal(); }
  function closeDialog(id){ const d=document.getElementById(id); if(d?.open) d.close(); }

  function card(m){
    if(!m) return '';
    const l=lib(m.id); const saved=!!l; const mine=availableOnMine(m);
    return `<article class="movie-card" data-movie="${escapeHtml(m.id)}" tabindex="0" aria-label="${escapeHtml(m.title)} 상세보기">
      <div class="poster-wrap"><img src="${escapeHtml(poster(m))}" alt="${escapeHtml(m.title)} 포스터" loading="lazy" onerror="this.style.display='none'"/><div class="poster-fallback">${escapeHtml(m.title)}</div>
        <div class="card-overlay"><div class="quick-actions"><button class="tiny-button ${saved?'':'accent'}" data-action="save" data-id="${escapeHtml(m.id)}">${saved?'✓':'＋'}</button><button class="tiny-button" data-action="log" data-id="${escapeHtml(m.id)}">LOG</button></div></div>
      </div>
      <div class="card-info"><p class="card-title">${escapeHtml(m.title)}</p><div class="card-meta"><span>${m.year||'—'}</span>${mine?'<span class="provider-dot"></span><span>내 구독</span>':providersText(m)?`<span>${escapeHtml(providersText(m))}</span>`:''}</div></div>
    </article>`;
  }
  function rowSection(title,subtitle,movies,limit=12){
    const list=uniqueById(movies||[]).slice(0,limit);
    return `<section class="content-section"><div class="section-head"><div><h2>${escapeHtml(title)}</h2>${subtitle?`<p>${escapeHtml(subtitle)}</p>`:''}</div></div>${list.length?`<div class="poster-row">${list.map(card).join('')}</div>`:`<div class="empty-state"><div class="empty-icon">${icon('search')}</div><b>아직 표시할 영화가 없습니다.</b><span>검색에서 영화를 저장하거나 감상 기록을 추가해보세요.</span><button class="secondary-button" data-open-search>영화 찾기</button></div>`}</section>`;
  }
  function renderHero(m){
    const el=document.getElementById('hero'); if(!m){el.innerHTML='<div class="empty-state">카탈로그를 불러오지 못했습니다.</div>';return;}
    const providers=heroProviders(m); const mine=availableOnMine(m);
    const titleVisual=m.logoUrl
      ? `<div class="hero-title-wrap"><img class="hero-title-logo" src="${escapeHtml(m.logoUrl)}" alt="${escapeHtml(m.title)}" onerror="this.style.display='none';this.nextElementSibling.hidden=false"/><h2 class="${heroTitleClass(m.title)} hero-title-fallback" hidden>${escapeHtml(m.title)}</h2></div>`
      : `<h2 class="${heroTitleClass(m.title)}">${escapeHtml(m.title)}</h2>`;
    const providerHtml=providers.length?`<div class="hero-watch"><div class="hero-watch-copy"><span>WHERE TO WATCH</span><small>KR · JustWatch via TMDB</small></div><div class="hero-provider-list">${providers.map(p=>{const owned=p.type==='subscription'&&isSubscribedProvider(p.name);const cfg=providerConfigForName(p.name);const label=cfg?.label||p.name;const inner=p.logoUrl?`<img src="${escapeHtml(p.logoUrl)}" alt="${escapeHtml(label)}"/>`:`<span class="provider-monogram">${escapeHtml(label.slice(0,1))}</span>`;return m.watchLink?`<a class="hero-provider ${owned?'is-mine':''}" href="${escapeHtml(m.watchLink)}" target="_blank" rel="noopener" title="${escapeHtml(label)} · ${escapeHtml(providerTypeLabel(p.type))}">${inner}</a>`:`<span class="hero-provider ${owned?'is-mine':''}" title="${escapeHtml(label)} · ${escapeHtml(providerTypeLabel(p.type))}">${inner}</span>`;}).join('')}</div></div>`:'';
    const copy=m.tagline||m.overview||'';
    el.innerHTML=`<img class="hero-bg" src="${escapeHtml(backdrop(m))}" alt="" onerror="this.style.display='none'"/><div class="hero-content">
      <div class="hero-badges"><span class="mini-badge accent">FEATURED</span>${mine?'<span class="mini-badge">✓ MY STREAMING</span>':''}${CATALOG.mode==='demo'?'<span class="mini-badge">DEMO DATA</span>':''}</div>
      ${titleVisual}<div class="hero-meta"><span>${m.director?escapeHtml(m.director):'Director —'}</span><span>·</span><span>${m.year||'—'}</span>${m.runtime?`<span>·</span><span>${fmtRuntime(m.runtime)}</span>`:''}<span>·</span><span>TMDB ${fmtRating(m.voteAverage)}</span></div>
      ${copy?`<p class="hero-copy">${escapeHtml(copy)}</p>`:''}${providerHtml}
    </div>`;
  }
  function myStreamingMovies(){ return (CATALOG.movies||[]).filter(availableOnMine); }
  function watchlistAvailable(){ return allSavedMovies().filter(m=>lib(m.id)?.watchlist && availableOnMine(m)); }
  function renderDiscover(){
    let hero=CATALOG.featured;
    let html='';
    if(discoverMode==='home'){
      html += rowSection('지금 주목할 영화','트렌드와 극장·스트리밍 데이터를 한곳에서 봅니다.',CATALOG.sections?.trending||[]);
      html += rowSection('IN THEATRES','대한민국 지역 현재 상영 목록.',CATALOG.sections?.theatres||[]);
      html += rowSection('MY STREAMING','내가 구독 중인 서비스에서 바로 볼 수 있는 영화.',myStreamingMovies());
      html += rowSection('TOP RATED','충분한 평가 표본을 가진 높은 평점의 작품.',CATALOG.sections?.rated||[]);
    }else if(discoverMode==='theatres'){
      hero=(CATALOG.sections?.theatres||[])[0]||hero; html=rowSection('IN THEATRES','대한민국 지역의 현재 상영 영화. 실제 상영관 편성은 극장별로 다를 수 있습니다.',CATALOG.sections?.theatres||[],30);
    }else if(discoverMode==='mystreaming'){
      hero=myStreamingMovies()[0]||hero; html=rowSection('MY STREAMING','내 구독 서비스와 flatrate 제공 정보를 교차한 결과입니다.',myStreamingMovies(),30)+rowSection('WATCHLIST · AVAILABLE NOW','보고 싶다고 저장한 영화 중 지금 내 구독으로 볼 수 있습니다.',watchlistAvailable(),20);
    }else if(discoverMode==='streaming'){
      hero=(CATALOG.sections?.streaming||[])[0]||hero; html=rowSection('STREAMING','대한민국 지역 구독형 스트리밍 제공 영화.',CATALOG.sections?.streaming||[],30);
    }else{
      hero=(CATALOG.sections?.rated||[])[0]||hero; html=rowSection('TOP RATED','TMDB 사용자 평점 기반. 개인 평점과는 분리해 표시합니다.',CATALOG.sections?.rated||[],30);
    }
    renderHero(hero); document.getElementById('discoverContent').innerHTML=html;
  }

  function renderCollectionsSide(){
    document.getElementById('collectionSideLinks').innerHTML=state.collections.map(c=>`<button class="side-link" data-collection="${escapeHtml(c.id)}">${icon('folder')}${escapeHtml(c.name)}</button>`).join('');
  }
  function collectionCards(){
    const dynamicCount=watchlistAvailable().length;
    const dynamic=`<article class="collection-card" data-dynamic="my-streaming"><p class="eyebrow">DYNAMIC</p><h3>Watchlist · 내 구독</h3><p>${dynamicCount} films · 자동 갱신</p></article>`;
    return dynamic+state.collections.map(c=>`<article class="collection-card" data-collection-card="${escapeHtml(c.id)}"><p class="eyebrow">COLLECTION</p><h3>${escapeHtml(c.name)}</h3><p>${c.movieIds.filter(id=>movie(id)).length} films</p></article>`).join('');
  }
  function renderLibraryHome(){
    const recent=latestUniqueMovies(); const fav=allSavedMovies().filter(m=>lib(m.id)?.favorite); const watch=watchlistAvailable();
    return `<div class="library-head"><div><p class="eyebrow">LIBRARY HOME</p><h1>내 영화 라이브러리</h1><p class="library-summary">최근 감상, 지금 볼 수 있는 Watchlist, 컬렉션을 다시 꺼내보는 공간입니다.</p></div><button class="secondary-button" id="librarySearchButton">＋ 영화 찾기</button></div>
    <section class="shelf">${rowSection('RECENTLY WATCHED','최근 감상 기록 순.',recent,8)}</section>
    <section class="shelf">${rowSection('WATCHLIST · AVAILABLE NOW','내 구독 서비스에서 현재 제공되는 Watchlist.',watch,8)}</section>
    <section class="shelf">${rowSection('FAVORITES','Favorite로 표시한 영화.',fav,8)}</section>
    <section class="shelf"><div class="section-head"><div><h2>COLLECTIONS</h2><p>수동 컬렉션과 조건 기반 동적 컬렉션.</p></div></div><div class="collection-grid">${collectionCards()}</div></section>`;
  }
  function filterLibrary(list){
    let out=[...list]; const q=libraryFilter.q.trim().toLowerCase(); if(q) out=out.filter(m=>(m.title+' '+(m.director||'')).toLowerCase().includes(q));
    if(libraryFilter.sort==='title') out.sort((a,b)=>a.title.localeCompare(b.title));
    else if(libraryFilter.sort==='rating') out.sort((a,b)=>(lib(b.id)?.rating||0)-(lib(a.id)?.rating||0));
    else if(libraryFilter.sort==='year') out.sort((a,b)=>(b.year||0)-(a.year||0));
    else out.sort((a,b)=>String(lib(b.id)?.savedAt||'').localeCompare(String(lib(a.id)?.savedAt||'')));
    return out;
  }
  function listPage(title,subtitle,list){
    const filtered=filterLibrary(list);
    return `<div class="library-head"><div><p class="eyebrow">LIBRARY</p><h1>${escapeHtml(title)}</h1><p class="library-summary">${escapeHtml(subtitle)}</p></div><button class="secondary-button" id="librarySearchButton">＋ 영화 찾기</button></div>
      <div class="filterbar"><input id="libraryQuery" value="${escapeHtml(libraryFilter.q)}" placeholder="내 라이브러리 검색"/><select id="librarySort"><option value="recent" ${libraryFilter.sort==='recent'?'selected':''}>최근 추가</option><option value="title" ${libraryFilter.sort==='title'?'selected':''}>제목</option><option value="rating" ${libraryFilter.sort==='rating'?'selected':''}>내 평점</option><option value="year" ${libraryFilter.sort==='year'?'selected':''}>개봉연도</option></select></div>
      ${filtered.length?`<div class="all-grid">${filtered.map(card).join('')}</div>`:`<div class="empty-state"><div class="empty-icon">${icon('search')}</div><b>조건에 맞는 영화가 없습니다.</b><span>필터를 지우거나 새 영화를 빠르게 추가해보세요.</span><button class="secondary-button" data-open-search>영화 찾기</button></div>`}`;
  }
  function renderCollectionsPage(){ return `<div class="library-head"><div><p class="eyebrow">COLLECTIONS</p><h1>컬렉션</h1><p class="library-summary">수동 컬렉션과 자동으로 바뀌는 Dynamic Collection을 함께 관리합니다.</p></div><button class="secondary-button" id="newCollectionInline">＋ New Collection</button></div><div class="collection-grid">${collectionCards()}</div>`; }
  function renderCollectionDetail(c){ const list=c.movieIds.map(movie).filter(Boolean); return listPage(c.name,'직접 만든 컬렉션.',list); }
  function bindLibraryControls(){
    const q=document.getElementById('libraryQuery'); if(q) q.addEventListener('input',e=>{libraryFilter.q=e.target.value; renderLibrary();});
    const s=document.getElementById('librarySort'); if(s) s.addEventListener('change',e=>{libraryFilter.sort=e.target.value; renderLibrary();});
  }
  function renderLibrary(){
    renderCollectionsSide(); document.getElementById('libraryCount').textContent=allSavedMovies().length;
    let html='';
    if(libraryMode==='home') html=renderLibraryHome();
    else if(libraryMode==='all') html=listPage('All Films','내가 보관한 모든 영화를 정렬하고 찾습니다.',allSavedMovies());
    else if(libraryMode==='watchlist') html=listPage('Watchlist','앞으로 보고 싶은 영화.',allSavedMovies().filter(m=>lib(m.id)?.watchlist));
    else if(libraryMode==='favorites') html=listPage('Favorites','Favorite로 표시한 영화.',allSavedMovies().filter(m=>lib(m.id)?.favorite));
    else if(libraryMode==='collections') html=renderCollectionsPage();
    else if(libraryMode.startsWith('collection:')){ const c=state.collections.find(x=>x.id===libraryMode.split(':')[1]); html=c?renderCollectionDetail(c):renderCollectionsPage(); }
    else if(libraryMode==='dynamic:my-streaming') html=listPage('Watchlist · 내 구독','Watchlist와 현재 구독형 제공 여부를 자동으로 교차합니다.',watchlistAvailable());
    document.getElementById('libraryContent').innerHTML=html; bindLibraryControls(); updateLibraryNav();
  }
  function updateLibraryNav(){
    document.querySelectorAll('[data-library]').forEach(b=>b.classList.toggle('is-active',b.dataset.library===libraryMode));
    document.querySelectorAll('[data-collection]').forEach(b=>b.classList.toggle('is-active',libraryMode===`collection:${b.dataset.collection}`));
  }

  function reviewCount(){ return Object.values(state.library).filter(x=>x.review?.trim()).length; }
  function watchedCount(){ return Object.values(state.library).filter(x=>x.watched).length; }
  function renderProfileCard(){
    const p=state.profile; const initial=(p.name||'U').trim()[0]?.toUpperCase()||'U'; document.getElementById('topAvatar').textContent=initial;
    document.getElementById('profileCard').innerHTML=`<div class="profile-inner"><div class="profile-avatar">${escapeHtml(initial)}</div><div class="profile-main"><p class="eyebrow">MY PROFILE</p><h1>${escapeHtml(p.name)}</h1><p>${escapeHtml(p.handle)} · ${escapeHtml(p.bio)}</p><button class="text-button" id="editProfile">프로필 수정</button></div><div class="profile-stats"><div class="profile-stat"><b>${watchedCount()}</b><span>FILMS</span></div><div class="profile-stat"><b>${reviewCount()}</b><span>REVIEWS</span></div><div class="profile-stat"><b>${state.collections.length}</b><span>COLLECTIONS</span></div></div></div>`;
  }
  function diaryHtml(limit){
    const logs=latestLogs().slice(0,limit||999); if(!logs.length) return '<div class="empty-state">아직 감상 기록이 없습니다.</div>';
    return `<div class="diary-list">${logs.map(l=>{const m=movie(l.movieId); if(!m)return''; return `<article class="diary-item" data-movie="${escapeHtml(m.id)}"><img src="${escapeHtml(poster(m))}" alt=""/><div><div class="diary-title">${escapeHtml(m.title)}</div><div class="diary-meta">${escapeHtml(l.watchedAt)} · ${escapeHtml(m.director||'')}</div></div><div class="rating">${l.rating?`★ ${l.rating}`:'—'}</div>${l.review?`<div class="review-copy">${escapeHtml(l.review)}</div>`:''}</article>`}).join('')}</div>`;
  }
  function reviewsHtml(limit){
    const rows=latestLogs().filter(l=>l.review?.trim()).slice(0,limit||999); if(!rows.length) return '<div class="empty-state">아직 리뷰가 없습니다.</div>';
    return `<div class="review-list">${rows.map(l=>{const m=movie(l.movieId); if(!m)return'';return `<article class="review-item" data-movie="${escapeHtml(m.id)}"><img src="${escapeHtml(poster(m))}" alt=""/><div><div class="diary-title">${escapeHtml(m.title)}</div><div class="diary-meta">${escapeHtml(l.watchedAt)}</div></div><div class="rating">${l.rating?`★ ${l.rating}`:'—'}</div><div class="review-copy">${escapeHtml(l.review)}</div></article>`}).join('')}</div>`;
  }
  function calendarHtml(cursor,compact=false){
    const y=cursor.getFullYear(), mo=cursor.getMonth(); const first=new Date(y,mo,1), last=new Date(y,mo+1,0); const start=first.getDay(); const logsBy={};
    state.logs.forEach(l=>{ if(!logsBy[l.watchedAt])logsBy[l.watchedAt]=[]; logsBy[l.watchedAt].push(l); });
    let cells=['일','월','화','수','목','금','토'].map(d=>`<div class="cal-week">${d}</div>`).join('');
    for(let i=0;i<start;i++) cells+='<div class="cal-day"></div>';
    for(let d=1;d<=last.getDate();d++){
      const date=isoDate(new Date(y,mo,d)); const logs=logsBy[date]||[]; const m=logs[0]?movie(logs[0].movieId):null; const today=date===isoDate(new Date());
      cells+=`<div class="cal-day ${logs.length?'has-log':''} ${today?'today':''}"><span class="cal-num">${d}</span>${logs.length>1?`<span class="cal-count">${logs.length}</span>`:''}${m?`<div class="cal-poster" data-movie="${escapeHtml(m.id)}"><img src="${escapeHtml(poster(m))}" alt="${escapeHtml(m.title)}"/></div>`:''}</div>`;
    }
    return `<div class="calendar-wrap"><div class="calendar-head"><button class="text-button" data-cal="prev">‹ 이전</button><h2>${y}. ${String(mo+1).padStart(2,'0')}</h2><button class="text-button" data-cal="next">다음 ›</button></div><div class="calendar-grid">${cells}</div></div>`;
  }
  function statsHtml(){
    const watchedIds=Object.keys(state.library).filter(id=>state.library[id].watched); const watchedMovies=watchedIds.map(movie).filter(Boolean); const totalMinutes=watchedMovies.reduce((s,m)=>s+(m.runtime||0),0); const ratings=Object.values(state.library).map(x=>Number(x.rating)).filter(Boolean); const avg=ratings.length?(ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1):'—'; const genres={}; watchedMovies.forEach(m=>(m.genres||[]).forEach(g=>genres[g]=(genres[g]||0)+1)); const entries=Object.entries(genres).sort((a,b)=>b[1]-a[1]).slice(0,6); const max=entries[0]?.[1]||1;
    return `<div class="stats-grid"><div class="stat-card"><strong>${watchedCount()}</strong><span>Watched films</span></div><div class="stat-card"><strong>${Math.round(totalMinutes/60)}h</strong><span>Approx. runtime</span></div><div class="stat-card"><strong>${avg}</strong><span>Average rating</span></div><div class="stat-card"><strong>${state.logs.length}</strong><span>Diary logs</span></div></div><div class="panel" style="margin-top:16px"><h2>장르 분포</h2><div class="bar-list">${entries.map(([g,n])=>`<div class="bar-row"><span>${escapeHtml(g)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(n/max*100)}%"></div></div><b>${n}</b></div>`).join('')||'<span class="library-summary">감상 기록이 필요합니다.</span>'}</div></div>`;
  }
  function subscriptionsHtml(){ return `<div class="library-head"><div><p class="eyebrow">MY STREAMING</p><h1>구독 중인 서비스</h1><p class="library-summary">여기서 켠 서비스가 Discover의 MY STREAMING과 Library의 Available Watchlist에 반영됩니다. 실제 결제 여부를 확인하지는 않습니다.</p></div></div><div class="subscription-grid">${PROVIDERS.map(p=>{const on=isSubscriptionEnabled(p.key);return `<div class="subscription"><div><b>${escapeHtml(p.label)}</b><small>${p.manualOnly?'구독 표시 지원 · 자동 작품 매칭은 아직 미지원':on?'내 구독으로 사용':'구독 안 함'}</small></div><button class="toggle ${on?'is-on':''}" data-subscription="${escapeHtml(p.key)}" aria-label="${escapeHtml(p.label)} 구독 토글"></button></div>`}).join('')}</div><p class="source-note">콜렉티오는 예술영화 전문 OTT로 구독 서비스 목록에 포함했습니다. 현재 TMDB/JustWatch의 KR 제공처 데이터에서 자동 availability를 확인할 수 없어, 구독 상태만 수동 관리합니다.</p>`; }
  function backupNudgeHtml(){
    if(!needsBackup()) return '';
    return `<div class="backup-nudge"><div class="backup-nudge-icon">${icon('download')}</div><div><b>이 브라우저에만 저장되고 있습니다.</b><p>현재는 계정 동기화가 없으므로 브라우저 데이터 삭제 전에 JSON 백업을 권장합니다.</p></div><div class="backup-nudge-actions"><button class="primary-button" id="backupNowButton">지금 백업</button><button class="text-button" id="dismissBackupNudge">나중에</button></div></div>`;
  }
  function accountHtml(){
    const count=allSavedMovies().length;
    return `<div class="library-head"><div><p class="eyebrow">ACCOUNT & DATA</p><h1>계정과 데이터</h1><p class="library-summary">0.3 MVP는 로그인 서버를 흉내 내지 않습니다. 현재 데이터는 이 브라우저에 저장되며, Cloud Sync는 실제 Auth가 준비된 뒤 활성화합니다.</p></div></div>
      ${backupNudgeHtml()}
      <div class="account-grid">
        <section class="account-card"><div class="account-icon">${icon('user')}</div><div><p class="eyebrow">CURRENT MODE</p><h2>Local profile</h2><p>이 기기의 브라우저에 Library, Diary, Reviews, Collections, Subscriptions를 저장합니다.</p></div><span class="account-status good">ACTIVE</span></section>
        <section class="account-card"><div class="account-icon">${icon('cloud')}</div><div><p class="eyebrow">CLOUD SYNC</p><h2>계정 동기화</h2><p>Supabase Auth + RLS 전환 스키마는 준비되어 있지만, 실제 인증을 검증하기 전에는 켜지 않습니다.</p></div><span class="account-status">PHASE 2</span></section>
      </div>
      <section class="panel data-safety"><div class="section-head"><div><h2>내 데이터 백업</h2><p>마지막 백업: ${escapeHtml(formatDateTime(state.settings?.lastExportAt))}</p></div></div><div class="data-actions"><button class="secondary-button" id="accountExportButton">${icon('download')} JSON 내보내기</button><label class="secondary-button file-label">${icon('upload')} JSON 가져오기<input type="file" id="accountImportInput" accept="application/json" hidden></label></div><p class="source-note">현재 웹사이트가 없어지더라도 JSON 파일은 사용자가 직접 보관할 수 있습니다. 계정 전환 시에도 이 포맷을 마이그레이션 입력으로 유지합니다.</p></section>`;
  }
  function renderMy(){
    renderProfileCard(); let html='';
    if(myMode==='profile') html=`${backupNudgeHtml()}<div class="dashboard-grid"><section class="panel"><h2>최근 감상</h2>${diaryHtml(5)}</section><section class="panel"><h2>최근 리뷰</h2>${reviewsHtml(4)}</section></div><div style="margin-top:18px">${calendarHtml(calendarCursor,true)}</div>`;
    else if(myMode==='diary') html=`<div class="library-head"><div><p class="eyebrow">DIARY</p><h1>감상 기록</h1><p class="library-summary">같은 영화를 여러 번 봐도 각각의 감상일을 별도 기록합니다.</p></div><button class="secondary-button" id="myLogButton">＋ Log Film</button></div>${diaryHtml()}`;
    else if(myMode==='reviews') html=`<div class="library-head"><div><p class="eyebrow">REVIEWS</p><h1>내 리뷰</h1><p class="library-summary">작성한 한줄평을 한곳에서 다시 봅니다.</p></div></div>${reviewsHtml()}`;
    else if(myMode==='calendar') html=`<div class="library-head"><div><p class="eyebrow">CALENDAR</p><h1>감상 캘린더</h1><p class="library-summary">Viewing Log의 감상일을 달력에 투영합니다.</p></div></div>${calendarHtml(calendarCursor)}`;
    else if(myMode==='stats') html=`<div class="library-head"><div><p class="eyebrow">STATS</p><h1>내 영화 기록</h1><p class="library-summary">경쟁이나 streak가 아니라 회고를 위한 통계입니다.</p></div></div>${statsHtml()}`;
    else if(myMode==='subscriptions') html=subscriptionsHtml();
    else if(myMode==='account') html=accountHtml();
    document.getElementById('myContent').innerHTML=html;
    const accountImport=document.getElementById('accountImportInput'); if(accountImport) accountImport.addEventListener('change',handleImport);
    document.querySelectorAll('[data-my]').forEach(b=>b.classList.toggle('is-active',b.dataset.my===myMode));
  }

  function renderSearch(q=''){
    const query=q.trim().toLowerCase(); let list=query?(CATALOG.movies||[]).filter(m=>(m.title+' '+(m.originalTitle||'')+' '+(m.director||'')).toLowerCase().includes(query)):(CATALOG.sections?.trending||[]);
    const resultHtml=list.slice(0,30).map(m=>`<article class="search-result" data-movie="${escapeHtml(m.id)}"><img src="${escapeHtml(poster(m))}" alt=""/><div><h3>${escapeHtml(m.title)}</h3><p>${m.year||'—'} · ${escapeHtml(m.director||'')} ${availableOnMine(m)?'· ✓ 내 구독':''}</p></div><div class="result-actions"><button class="tiny-button ${lib(m.id)?'':'accent'}" data-action="save" data-id="${escapeHtml(m.id)}">${lib(m.id)?'✓':'＋'}</button><button class="tiny-button" data-action="log" data-id="${escapeHtml(m.id)}">LOG</button></div></article>`).join(''); document.getElementById('searchResults').innerHTML=`<div class="search-summary">${query?`<b>${escapeHtml(q.trim())}</b> · ${list.length}개 결과`:'추천 영화 · 입력하면 즉시 검색됩니다.'}</div>${resultHtml||`<div class="empty-state"><div class="empty-icon">${icon('search')}</div><b>동기화된 카탈로그에서 찾지 못했습니다.</b><span>현재 GitHub Pages 빌드는 로컬 카탈로그 검색입니다. Netlify/API 프록시를 붙이면 전체 TMDB 실시간 검색으로 확장할 수 있습니다.</span></div>`}`;
  }
  function openSearch(){ showDialog('searchDialog'); const input=document.getElementById('searchInput'); renderSearch(input.value); setTimeout(()=>input.focus(),60); }
  function openMovie(id){
    const m=movie(id); if(!m)return; const l=lib(id); const groups={subscription:[],free:[],ads:[],rent:[],buy:[]}; (m.providers||[]).forEach(p=>(groups[p.type]||(groups[p.type]=[])).push(p));
    const group=(key,label)=>groups[key]?.length?`<div class="provider-group"><h4>${label}</h4><div class="providers">${groups[key].map(p=>{const owned=isSubscribedProvider(p.name)&&key==='subscription';return `<span class="provider-pill ${owned?'owned':''}">${owned?'✓ ':''}${escapeHtml(providerConfigForName(p.name)?.label||p.name)}</span>`}).join('')}</div></div>`:'';
    document.getElementById('movieDialogContent').innerHTML=`<div class="movie-sheet"><img class="movie-sheet-bg" src="${escapeHtml(backdrop(m))}" alt=""/><button class="movie-close" data-close="movieDialog">×</button><div class="movie-sheet-content"><img class="detail-poster" src="${escapeHtml(poster(m))}" alt="${escapeHtml(m.title)} 포스터"/><div class="detail-main"><p class="eyebrow">${l?.watched?'WATCHED':l?'IN LIBRARY':'FILM'}</p><h2>${escapeHtml(m.title)}</h2><div class="detail-meta">${escapeHtml(m.director||'')} · ${m.year||'—'} ${m.runtime?`· ${fmtRuntime(m.runtime)}`:''} · TMDB ${fmtRating(m.voteAverage)}</div><p class="detail-overview">${escapeHtml(m.overview||'')}</p><div class="provider-groups">${group('subscription','SUBSCRIPTION / FLATRATE')}${group('free','FREE')}${group('ads','WITH ADS')}${group('rent','RENT')}${group('buy','BUY')}</div><p class="source-note">스트리밍 제공 정보: JustWatch via TMDB · 지역 KR · 실제 제공 여부와 요금은 각 서비스에서 최종 확인하세요.</p><div class="detail-actions"><button class="primary-button" data-action="save" data-id="${escapeHtml(m.id)}">${l?'✓ IN LIBRARY':'＋ LIBRARY'}</button><button class="secondary-button" data-action="log" data-id="${escapeHtml(m.id)}">LOG FILM</button><button class="secondary-button" data-action="watchlist" data-id="${escapeHtml(m.id)}">${l?.watchlist?'✓ WATCHLIST':'＋ WATCHLIST'}</button><button class="secondary-button" data-action="favorite" data-id="${escapeHtml(m.id)}">${l?.favorite?'♥ FAVORITE':'♡ FAVORITE'}</button><button class="secondary-button" data-action="collection-add" data-id="${escapeHtml(m.id)}">＋ COLLECTION</button>${m.watchLink?`<a class="secondary-button" href="${escapeHtml(m.watchLink)}" target="_blank" rel="noopener">WHERE TO WATCH ↗</a>`:''}</div></div></div></div>`;
    showDialog('movieDialog');
  }
  function openLog(id){ const m=movie(id); if(!m)return; document.getElementById('logMovieId').value=String(id); document.getElementById('logMovieTitle').textContent=m.title; document.getElementById('logDate').value=isoDate(new Date()); const l=lib(id); document.getElementById('logRating').value=l?.rating||''; document.getElementById('logReview').value=l?.review||''; document.getElementById('logFavorite').checked=!!l?.favorite; showDialog('logDialog'); }
  function saveMovie(id){ const existed=!!lib(id); ensureLib(id); saveState(); renderAll(); toast(existed?'이미 Library에 있습니다.':'Library에 추가했습니다.'); }
  function toggleWatchlist(id){ const l=ensureLib(id); l.watchlist=!l.watchlist; saveState(); renderAll(); openMovie(id); toast(l.watchlist?'Watchlist에 추가했습니다.':'Watchlist에서 제거했습니다.'); }
  function toggleFavorite(id){ const l=ensureLib(id); l.favorite=!l.favorite; saveState(); renderAll(); openMovie(id); toast(l.favorite?'Favorite로 표시했습니다.':'Favorite를 해제했습니다.'); }
  function addToCollection(id){
    if(!state.collections.length){ newCollection(); return; }
    const names=state.collections.map((c,i)=>`${i+1}. ${c.name}`).join('\n');
    const raw=prompt(`추가할 컬렉션 번호를 입력하세요.\n${names}`); const idx=Number(raw)-1;
    const c=state.collections[idx]; if(!c)return; if(!c.movieIds.includes(String(id)))c.movieIds.push(String(id)); ensureLib(id); saveState(); renderAll(); toast(`${c.name}에 추가했습니다.`);
  }
  function newCollection(){ const name=prompt('새 컬렉션 이름'); if(!name?.trim())return; state.collections.push({id:'col-'+Date.now(),name:name.trim(),type:'manual',movieIds:[]}); saveState(); libraryMode='collections'; renderAll(); }
  function editProfile(){ const name=prompt('표시 이름',state.profile.name); if(name?.trim()) state.profile.name=name.trim(); const bio=prompt('한줄 소개',state.profile.bio); if(bio!==null) state.profile.bio=bio.trim(); saveState(); renderAll(); }

  function setView(view){ activeView=view; document.querySelectorAll('.view').forEach(v=>v.classList.toggle('is-active',v.dataset.view===view)); document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('is-active',b.dataset.nav===view)); document.querySelectorAll('.mobile-nav-item[data-nav]').forEach(b=>b.classList.toggle('is-active',b.dataset.nav===view)); window.scrollTo({top:0,behavior:'smooth'}); }
  function renderStatus(){ const live=CATALOG.mode==='live'; document.getElementById('dataStatusText').textContent=live?'SYNCED':'LOCAL DEMO'; document.getElementById('sourceStatus').innerHTML=`현재 모드: <b>${live?'LIVE API SYNC':'LOCAL DEMO'}</b><br>마지막 카탈로그 갱신: ${escapeHtml(CATALOG.updatedAt||'unknown')}<br>지역: ${escapeHtml(CATALOG.region||'KR')}`; }
  function renderAll(){ renderDiscover(); renderLibrary(); renderMy(); renderStatus(); }

  document.addEventListener('click',e=>{
    const close=e.target.closest('[data-close]'); if(close){ closeDialog(close.dataset.close); return; }
    const nav=e.target.closest('[data-nav]'); if(nav){ setView(nav.dataset.nav); return; }
    const dt=e.target.closest('[data-discover]'); if(dt){ discoverMode=dt.dataset.discover; document.querySelectorAll('[data-discover]').forEach(b=>b.classList.toggle('is-active',b.dataset.discover===discoverMode)); renderDiscover(); return; }
    const lt=e.target.closest('[data-library]'); if(lt){ libraryMode=lt.dataset.library; renderLibrary(); return; }
    const mt=e.target.closest('[data-my]'); if(mt){ myMode=mt.dataset.my; renderMy(); return; }
    const action=e.target.closest('[data-action]'); if(action){ e.stopPropagation(); const id=action.dataset.id; const a=action.dataset.action; if(a==='save')saveMovie(id); else if(a==='log')openLog(id); else if(a==='detail')openMovie(id); else if(a==='watchlist')toggleWatchlist(id); else if(a==='favorite')toggleFavorite(id); else if(a==='collection-add')addToCollection(id); return; }
    const collection=e.target.closest('[data-collection],[data-collection-card]'); if(collection){ const id=collection.dataset.collection||collection.dataset.collectionCard; libraryMode=`collection:${id}`; setView('library'); renderLibrary(); return; }
    const dyn=e.target.closest('[data-dynamic]'); if(dyn){ libraryMode='dynamic:my-streaming'; setView('library'); renderLibrary(); return; }
    const mov=e.target.closest('[data-movie]'); if(mov){ openMovie(mov.dataset.movie); return; }
    const sub=e.target.closest('[data-subscription]'); if(sub){ const p=sub.dataset.subscription; const on=isSubscriptionEnabled(p); state.subscriptions=on?state.subscriptions.filter(x=>normalizeProviderName(x)!==normalizeProviderName(p)):[...(state.subscriptions||[]),p]; saveState(); renderAll(); toast(`${providerConfigForName(p)?.label||p}: ${isSubscriptionEnabled(p)?'구독 중':'구독 안 함'}`); return; }
    const cal=e.target.closest('[data-cal]'); if(cal){ calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+(cal.dataset.cal==='next'?1:-1),1); renderMy(); return; }
    if(e.target.closest('#searchTrigger')||e.target.closest('#mobileSearch')||e.target.closest('#librarySearchButton')||e.target.closest('#myLogButton')||e.target.closest('[data-open-search]')){ openSearch(); return; }
    if(e.target.closest('#backupNowButton')||e.target.closest('#accountExportButton')){ exportData(); return; }
    if(e.target.closest('#dismissBackupNudge')){ state.settings.backupNudgeDismissedAt=new Date().toISOString(); saveState(); renderMy(); return; }
    if(e.target.closest('#newCollectionButton')||e.target.closest('#newCollectionInline')){ newCollection(); return; }
    if(e.target.closest('#editProfile')){ editProfile(); return; }
    if(e.target.closest('#aboutButton')||e.target.closest('#dataStatusButton')){ showDialog('aboutDialog'); return; }
    if(e.target.closest('#exportButton')){ exportData(); return; }
  });
  document.getElementById('searchInput').addEventListener('input',e=>renderSearch(e.target.value));
  document.getElementById('logForm').addEventListener('submit',e=>{
    e.preventDefault(); const id=document.getElementById('logMovieId').value; const watchedAt=document.getElementById('logDate').value; if(!id||!watchedAt)return; const rating=document.getElementById('logRating').value; const review=document.getElementById('logReview').value.trim(); const favorite=document.getElementById('logFavorite').checked; const l=ensureLib(id); l.watched=true; l.watchlist=false; l.favorite=favorite; if(rating)l.rating=Number(rating); if(review||l.review)l.review=review; state.logs.push({id:'log-'+Date.now(),movieId:String(id),watchedAt,rating:rating?Number(rating):null,review}); saveState(); closeDialog('logDialog'); closeDialog('movieDialog'); renderAll(); toast('감상 기록을 저장했습니다.');
  });
  document.addEventListener('keydown',e=>{ if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();openSearch();} if(e.key==='Escape'){/* native dialog handles */} if((e.key==='Enter'||e.key===' ')&&document.activeElement?.matches('.movie-card')){e.preventDefault();openMovie(document.activeElement.dataset.movie);} });
  document.getElementById('mobileSearch').addEventListener('click',openSearch);

  function exportData(){ state.settings=state.settings||{}; state.settings.lastExportAt=new Date().toISOString(); saveState(); const blob=new Blob([JSON.stringify({version:2,exportedAt:new Date().toISOString(),state},null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`kinosis-library-${isoDate(new Date())}.json`; a.click(); URL.revokeObjectURL(a.href); renderMy(); toast('내 데이터를 내보냈습니다.'); }
  async function handleImport(e){ const file=e.target.files?.[0]; if(!file)return; try{const parsed=JSON.parse(await file.text()); if(!parsed.state?.library)throw new Error('invalid'); state=Object.assign(initialState(),parsed.state,{profile:Object.assign(initialState().profile,parsed.state.profile||{}),settings:Object.assign(initialState().settings,parsed.state.settings||{})}); saveState(); renderAll(); closeDialog('aboutDialog'); toast('데이터를 가져왔습니다.');}catch(err){alert('KINOSIS 내보내기 파일을 읽지 못했습니다.');} e.target.value=''; }
  document.getElementById('importInput').addEventListener('change',handleImport);

  renderAll(); setView('discover');
  if(location.protocol==='http:'||location.protocol==='https:'){ if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{}); }
})();

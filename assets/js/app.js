(function(){
  'use strict';
  const CATALOG = window.KINOSIS_CATALOG || {mode:'demo',updatedAt:'missing',movies:[],sections:{trending:[],theatres:[],streaming:[],rated:[],art:[]},featured:null};
  const CLOUD = window.KINOSIS_CLOUD || null;
  const ART = window.KINOSIS_ART || {classify:()=>({isArt:false,score:0,reasons:[]})};
  const movieMap = new Map((CATALOG.movies || []).map(m => [String(m.id), m]));
  const STORAGE_KEY = 'kinosis.mvp.v2.state'; // 0.4.0 and earlier import source
  const LEGACY_STORAGE_KEY = 'film.mvp.v2.state';
  const GUEST_PREF_KEY = 'kinosis.guest.preferences.v1';
  const MIGRATION_PREFIX = 'kinosis.legacy.migrated.';
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
  let authReady = false;
  let currentUser = null;
  let syncTimer = null;
  let syncState = {status:'guest',lastSyncedAt:null,message:''};
  let suppressCloudSync = true;
  let discoverMode = 'home';
  let libraryMode = 'home';
  let myMode = 'profile';
  let libraryFilter = {q:'', sort:'recent', status:'all', rating:'all', availability:'all', genre:'all', decade:'all', art:'all'};
  let calendarCursor = new Date();
  let toastTimer;
  let searchTimer = null;
  let searchAbort = null;
  let searchSerial = 0;
  let searchComposing = false;
  let liveSearchState = { query:'', status:'idle', results:[], message:'' };
  const LIVE_SEARCH_MIN_CHARS = 2;
  const LIVE_SEARCH_DEBOUNCE = 320;

  function isoDate(date){ return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10); }
  function daysAgo(n){ const d=new Date(); d.setDate(d.getDate()-n); return isoDate(d); }
  function initialState(){
    return {
      profile:{name:'Local User',handle:'@local',bio:'영화를 발견하고 기록하는 로컬 프로필'},
      subscriptions:[],
      settings:{lastExportAt:null,backupNudgeDismissedAt:null},
      preferences:{artMode:false},
      meta:{modifiedAt:null,lastSyncedAt:null,dirtySince:null},
      movieCache:{},
      library:{},
      logs:[],
      collections:[]
    };
  }
  function readJson(key){ try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):null;}catch{return null;} }
  function normalizeState(parsed){
    const base=initialState(); parsed=parsed||{};
    return Object.assign(base,parsed,{
      profile:Object.assign(base.profile,parsed.profile||{}),
      settings:Object.assign(base.settings,parsed.settings||{}),
      preferences:Object.assign(base.preferences,parsed.preferences||{}),
      meta:Object.assign(base.meta,parsed.meta||{}),
      movieCache:Object.assign({},parsed.movieCache||{}),
      library:Object.assign({},parsed.library||{}),
      logs:Array.isArray(parsed.logs)?parsed.logs:[],
      collections:Array.isArray(parsed.collections)?parsed.collections:[],
      subscriptions:Array.isArray(parsed.subscriptions)?parsed.subscriptions:[]
    });
  }
  function legacyState(){ return normalizeState(readJson(STORAGE_KEY)||readJson(LEGACY_STORAGE_KEY)); }
  function guestPreferences(){ return Object.assign({artMode:false},readJson(GUEST_PREF_KEY)||{}); }
  function userCacheKey(){ return currentUser?.id?`kinosis.user.${currentUser.id}.state.v1`:null; }
  function hasPersonalData(value){ return !!(Object.keys(value?.library||{}).length || value?.logs?.length || value?.collections?.length || value?.subscriptions?.length || Object.keys(value?.movieCache||{}).length); }
  function mergeImport(base,incoming){
    const out=normalizeState(base); const src=normalizeState(incoming);
    out.profile=Object.assign({},out.profile,src.profile);
    out.library=Object.assign({},out.library,src.library);
    out.movieCache=Object.assign({},out.movieCache,src.movieCache);
    const logMap=new Map([...(out.logs||[]),...(src.logs||[])].map(x=>[String(x.id),x])); out.logs=[...logMap.values()];
    const colMap=new Map([...(out.collections||[]),...(src.collections||[])].map(x=>[String(x.id),x])); out.collections=[...colMap.values()];
    out.subscriptions=[...new Set([...(out.subscriptions||[]),...(src.subscriptions||[])])];
    out.preferences=Object.assign({},out.preferences,src.preferences);
    out.meta.modifiedAt=new Date().toISOString(); out.meta.dirtySince=out.meta.modifiedAt;
    return out;
  }
  let state=initialState(); state.preferences=guestPreferences();
  function isSignedIn(){ return !!currentUser; }
  function persistLocalCache(){
    if(isSignedIn()){ const key=userCacheKey(); if(key)localStorage.setItem(key,JSON.stringify(state)); }
    else localStorage.setItem(GUEST_PREF_KEY,JSON.stringify({artMode:!!state.preferences?.artMode}));
  }
  function saveState({sync=true,mark=true}={}){
    if(mark){ state.meta=state.meta||{}; state.meta.modifiedAt=new Date().toISOString(); if(isSignedIn())state.meta.dirtySince=state.meta.dirtySince||state.meta.modifiedAt; }
    persistLocalCache();
    if(sync && isSignedIn() && !suppressCloudSync) scheduleCloudSync();
  }
  function rememberCachedMovies(){ Object.values(state.movieCache||{}).forEach(m=>{if(m?.id!=null)movieMap.set(String(m.id),m);}); }
  function scheduleCloudSync(delay=500){ clearTimeout(syncTimer); syncState.status='pending'; renderAccountChrome(); syncTimer=setTimeout(pushCloudState,delay); }
  async function pushCloudState(){
    if(!isSignedIn()||!CLOUD)return; clearTimeout(syncTimer);
    syncState.status=navigator.onLine?'syncing':'offline'; renderAccountChrome();
    if(!navigator.onLine)return;
    try{
      const payload=JSON.parse(JSON.stringify(state));
      const row=await CLOUD.writeUserState(payload);
      const stamp=row?.updated_at||new Date().toISOString(); state.meta.lastSyncedAt=stamp; state.meta.dirtySince=null; persistLocalCache();
      syncState={status:'online',lastSyncedAt:stamp,message:''};
    }catch(error){ console.warn('KINOSIS cloud sync:',error); syncState={status:'offline',lastSyncedAt:state.meta?.lastSyncedAt||null,message:error.message||'Sync failed'}; }
    renderAccountChrome(); if(activeView==='my'&&myMode==='account')renderMy();
  }
  async function hydrateSignedInUser(){
    if(!isSignedIn()||!CLOUD)return; suppressCloudSync=true; syncState.status='syncing'; renderAccountChrome();
    try{
      const cloud=await CLOUD.readUserState();
      const cached=normalizeState(readJson(userCacheKey()));
      let next=cloud?.payload?normalizeState(cloud.payload):(hasPersonalData(cached)?cached:initialState());
      const cloudTime=Date.parse(cloud?.updated_at||0)||0, cacheTime=Date.parse(cached.meta?.modifiedAt||0)||0;
      if(hasPersonalData(cached)&&cacheTime>cloudTime) next=mergeImport(next,cached);
      const old=legacyState(); const migrationKey=MIGRATION_PREFIX+currentUser.id;
      if(hasPersonalData(old)&&!localStorage.getItem(migrationKey)){
        const count=Object.keys(old.library||{}).length;
        if(confirm(`이 브라우저에서 이전 KINOSIS 기록 ${count}편을 찾았습니다. 현재 계정으로 가져올까요?`)){ next=mergeImport(next,old); }
        localStorage.setItem(migrationKey,new Date().toISOString());
      }
      state=normalizeState(next); rememberCachedMovies(); state.meta.lastSyncedAt=cloud?.updated_at||state.meta.lastSyncedAt||null;
      persistLocalCache(); suppressCloudSync=false;
      if(!cloud || state.meta.dirtySince) await pushCloudState(); else syncState={status:'online',lastSyncedAt:state.meta.lastSyncedAt,message:''};
    }catch(error){
      console.warn('KINOSIS cloud hydrate:',error); const cached=readJson(userCacheKey()); state=normalizeState(cached||initialState()); rememberCachedMovies(); suppressCloudSync=false; syncState={status:'offline',lastSyncedAt:state.meta?.lastSyncedAt||null,message:error.message||'Cloud unavailable'};
    }
    renderAll(); renderAccountChrome();
  }
  function gateHtml(area){ return `<div class="gate-card"><div class="gate-card-inner"><div class="gate-icon">${icon('cloud')}</div><p class="eyebrow">ACCOUNT REQUIRED</p><h1>${escapeHtml(area)}</h1><p>개인 영화 기록은 계정과 연결됩니다. 로그인하면 Library, Diary, Reviews, Calendar, Collections와 OTT 설정을 여러 기기에서 이어서 사용할 수 있습니다.</p><button class="primary-button" data-open-auth>로그인하고 시작하기</button></div></div>`; }
  function requireAuth(message='이 기능은 로그인 후 사용할 수 있습니다.'){ if(isSignedIn())return true; toast(message); showDialog('authDialog'); return false; }
  function renderAccountChrome(){
    const avatar=document.getElementById('topAvatar'); if(!avatar)return;
    if(isSignedIn()){ const label=currentUser?.user_metadata?.full_name||currentUser?.user_metadata?.name||currentUser?.email||'U'; avatar.textContent=String(label).trim()[0]?.toUpperCase()||'U'; avatar.classList.add('auth-avatar'); }
    else{ avatar.textContent='K'; avatar.classList.remove('auth-avatar'); }
    document.querySelectorAll('[data-nav="library"],[data-nav="my"]').forEach(el=>el.classList.toggle('nav-locked',!isSignedIn()));
  }

  function icon(name){ return `<svg class="ui-icon" aria-hidden="true"><use href="#i-${name}"/></svg>`; }
  function formatDateTime(value){ if(!value)return '아직 백업하지 않음'; try{return new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}catch{return value;} }
  function needsBackup(){ return Object.keys(state.library).length>=3 && !state.settings?.lastExportAt && !state.settings?.backupNudgeDismissedAt; }
  function movie(id){ return movieMap.get(String(id)) || state.movieCache?.[String(id)] || null; }
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
  function isSubscriptionEnabled(key){ if(!isSignedIn())return false; const n=normalizeProviderName(key); return (state.subscriptions||[]).some(v=>normalizeProviderName(v)===n); }
  function isSubscribedProvider(name){ const cfg=providerConfigForName(name); return cfg ? isSubscriptionEnabled(cfg.key) : isSubscriptionEnabled(name); }
  function subscriptionProviders(m){ return (m?.providers||[]).filter(p=>p.type==='subscription'); }
  function availableOnMine(m){ return subscriptionProviders(m).some(p=>isSubscribedProvider(p.name)); }
  function providersText(m){ const names=subscriptionProviders(m).map(p=>providerConfigForName(p.name)?.label||p.name); return names.slice(0,2).join(' · '); }
  function genreNames(m){ return (m?.genres||[]).map(g=>typeof g==='string'?g:g?.name).filter(Boolean); }
  function artInfo(m){ return ART.classify(m,{threshold:window.KINOSIS_CONFIG?.artMode?.threshold||36}); }
  function isArtMovie(m){ return !!artInfo(m).isArt; }
  function artReasons(m){ return artInfo(m).reasons||[]; }
  function artPool(){ return uniqueById([...(CATALOG.sections?.art||[]),...(CATALOG.movies||[])]).filter(isArtMovie); }
  function providerTypeLabel(type){ return ({subscription:'구독',free:'무료',ads:'광고 포함',rent:'대여',buy:'구매'})[type] || type; }
  function heroProviders(m){
    const rank={subscription:0,free:1,ads:2,rent:3,buy:4}; const seen=new Set();
    return [...(m?.providers||[])].sort((a,b)=>(rank[a.type]??9)-(rank[b.type]??9)).filter(p=>{const cfg=providerConfigForName(p.name); const k=normalizeProviderName(cfg?.key||p.name||p.id); if(seen.has(k)) return false; seen.add(k); return true;}).slice(0,5);
  }
  function heroTitleClass(title){ const n=[...String(title||'').replace(/\s/g,'')].length; return n>24?'hero-title is-xlong':n>15?'hero-title is-long':'hero-title'; }
  function uniqueById(list){ const seen=new Set(); return list.filter(x=>x&&!seen.has(String(x.id))&&seen.add(String(x.id))); }
  function normalizeMovieRecord(m){
    if(!m || m.id==null) return null;
    return {
      ...m,
      id:String(m.id),
      title:m.title||m.originalTitle||'Untitled',
      originalTitle:m.originalTitle||'',
      year:m.year||((m.releaseDate||'').slice(0,4)||null),
      providers:Array.isArray(m.providers)?m.providers:[],
      source:m.source||'tmdb'
    };
  }
  function rememberMovie(m,{persist=false}={}){
    const normalized=normalizeMovieRecord(m); if(!normalized)return null;
    movieMap.set(String(normalized.id),normalized);
    if(persist){
      state.movieCache=state.movieCache||{};
      state.movieCache[String(normalized.id)]=normalized;
    }
    return normalized;
  }
  function canUseLiveApi(){ return location.protocol==='http:' || location.protocol==='https:'; }
  async function apiJson(path,{signal}={}){
    const response=await fetch(path,{headers:{Accept:'application/json'},signal,cache:'no-store'});
    let data=null; try{data=await response.json();}catch{}
    if(!response.ok) throw new Error(data?.error||`API ${response.status}`);
    return data;
  }
  async function fetchLiveSearch(query,{signal}={}){
    const data=await apiJson(`/api/movie-search?q=${encodeURIComponent(query)}`,{signal});
    return (data.results||[]).map(m=>rememberMovie({...m,source:'tmdb-live',detailLoaded:false})).filter(Boolean);
  }
  async function fetchMovieDetail(id,{persist=false}={}){
    const data=await apiJson(`/api/movie-detail?id=${encodeURIComponent(id)}`);
    const detailed=rememberMovie({...data,source:'tmdb-live',detailLoaded:true},{persist});
    if(persist) saveState();
    return detailed;
  }
  async function ensureMovieDetail(id,{persist=false}={}){
    let current=movie(id);
    const needsDetail=current && current.source==='tmdb-live' && !current.detailLoaded;
    if(needsDetail && canUseLiveApi()){
      try{ current=await fetchMovieDetail(id,{persist}); }
      catch(error){ console.warn('KINOSIS detail fallback:',error); if(persist && current){ rememberMovie(current,{persist:true}); saveState(); } }
    }else if(persist && current && !CATALOG.movies?.some(m=>String(m.id)===String(id))){
      rememberMovie(current,{persist:true}); saveState();
    }
    return current;
  }
  function allSavedMovies(){ return Object.keys(state.library).map(movie).filter(Boolean); }
  function latestLogs(){ return [...state.logs].sort((a,b)=>String(b.watchedAt).localeCompare(String(a.watchedAt))); }
  function latestUniqueMovies(){ const seen=new Set(); return latestLogs().map(l=>movie(l.movieId)).filter(m=>m&&!seen.has(String(m.id))&&seen.add(String(m.id))); }
  function toast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2200); }
  function showDialog(id){ const d=document.getElementById(id); if(d && !d.open) d.showModal(); }
  function closeDialog(id){ const d=document.getElementById(id); if(d?.open) d.close(); }

  function card(m,variant='discover'){
    if(!m) return '';
    const l=lib(m.id); const saved=!!l; const mine=availableOnMine(m);
    const compact=variant==='library';
    return `<article class="movie-card ${compact?'library-movie-card':''}" data-movie="${escapeHtml(m.id)}" tabindex="0" aria-label="${escapeHtml(m.title)} 상세보기">
      <div class="poster-wrap"><img src="${escapeHtml(poster(m))}" alt="${escapeHtml(m.title)} 포스터" loading="lazy" onerror="this.style.display='none'"/><div class="poster-fallback">${escapeHtml(m.title)}</div>
        <div class="card-overlay"><div class="quick-actions"><button class="tiny-button ${saved?'':'accent'}" data-action="save" data-id="${escapeHtml(m.id)}" aria-label="${saved?'라이브러리에 저장됨':'라이브러리에 저장'}">${saved?'✓':'＋'}</button><button class="tiny-button" data-action="log" data-id="${escapeHtml(m.id)}">LOG</button></div></div>
      </div>
      <div class="card-info"><p class="card-title">${escapeHtml(m.title)}</p><div class="card-meta"><span>${m.year||'—'}</span>${mine?'<span class="provider-dot"></span><span>내 구독</span>':providersText(m)?`<span>${escapeHtml(providersText(m))}</span>`:''}</div></div>
    </article>`;
  }
  function rowSection(title,subtitle,movies,limit=12,variant='discover'){
    const list=uniqueById(movies||[]).slice(0,limit);
    const rowClass=variant==='library'?'poster-row library-poster-row':'poster-row';
    return `<section class="content-section"><div class="section-head"><div><h2>${escapeHtml(title)}</h2>${subtitle?`<p>${escapeHtml(subtitle)}</p>`:''}</div></div>${list.length?`<div class="${rowClass}">${list.map(m=>card(m,variant)).join('')}</div>`:`<div class="empty-state"><div class="empty-icon">${icon('search')}</div><b>아직 표시할 영화가 없습니다.</b><span>검색에서 영화를 저장하거나 감상 기록을 추가해보세요.</span><button class="secondary-button" data-open-search>영화 찾기</button></div>`}</section>`;
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
  function myStreamingSection(title='MY STREAMING',subtitle='내가 구독 중인 서비스에서 바로 볼 수 있는 영화.',limit=12,sourceList=null){
    if(!isSignedIn()) return `<section class="content-section"><div class="section-head"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div></div><div class="empty-state"><div class="empty-icon">${icon('cloud')}</div><b>로그인하면 내 OTT 기준으로 볼 수 있습니다.</b><span>구독 서비스 설정은 계정과 함께 여러 기기에 동기화됩니다.</span><button class="secondary-button" data-open-auth>로그인</button></div></section>`;
    if(!(state.subscriptions||[]).length){
      return `<section class="content-section"><div class="section-head"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div></div><div class="empty-state"><div class="empty-icon">${icon('grid')}</div><b>먼저 구독 중인 OTT를 선택하세요.</b><span>Netflix, TVING, WATCHA, Wavve, Disney+, Coupang Play, Apple TV+, 콜렉티오를 MY에서 관리할 수 있습니다.</span><button class="secondary-button" data-open-subscriptions>구독 서비스 설정</button></div></section>`;
    }
    const list=(sourceList||myStreamingMovies()).filter(availableOnMine);
    return rowSection(title,subtitle,list,limit);
  }
  function renderDiscover(){
    const artMode=!!state.preferences?.artMode;
    const artMovies=artPool();
    let hero=artMode?(artMovies[0]||CATALOG.featured):CATALOG.featured;
    let html='';
    if(artMode){
      const artTheatres=(CATALOG.sections?.theatres||[]).filter(isArtMovie);
      const modern=artMovies.filter(m=>Number(m.year||0)>=1990);
      const archive=artMovies.filter(m=>Number(m.year||0)>0&&Number(m.year)<1990);
      const artStreaming=artMovies.filter(m=>subscriptionProviders(m).length);
      html += rowSection('SELECTED FOR ART MODE','시네필 캐논을 시드로 감독·키워드·제작/배급 메타데이터를 계산한 작품 중심 큐레이션.',artMovies,18);
      html += artTheatres.length?rowSection('NOW IN ART THEATRES','현재 상영 목록 중 ART MODE 분류를 통과한 작품.',artTheatres,14):`<section class="content-section"><div class="section-head"><div><h2>NOW IN ART THEATRES</h2><p>현재 동기화 목록에서는 확실한 후보가 없습니다.</p></div></div></section>`;
      html += rowSection('MODERN MASTERS','1990년 이후 작가·독립·영화제 신호가 강한 작품.',modern,18);
      html += rowSection('FROM THE ARCHIVE','영화사적 캐논과 고전 후보.',archive,18);
      html += myStreamingSection('ART · AVAILABLE ON YOUR SERVICES','ART MODE 작품 중 내가 구독 중인 서비스에서 볼 수 있는 영화.',18,artStreaming);
    }else if(discoverMode==='home'){
      html += rowSection('지금 주목할 영화','트렌드와 극장·스트리밍 데이터를 한곳에서 봅니다.',CATALOG.sections?.trending||[]);
      html += rowSection('IN THEATRES','대한민국 지역 현재 상영 목록.',CATALOG.sections?.theatres||[]);
      html += myStreamingSection();
      html += rowSection('TOP RATED','충분한 평가 표본을 가진 높은 평점의 작품.',CATALOG.sections?.rated||[]);
    }else if(discoverMode==='theatres'){
      hero=(CATALOG.sections?.theatres||[])[0]||hero; html=rowSection('IN THEATRES','대한민국 지역의 현재 상영 영화. 실제 상영관 편성은 극장별로 다를 수 있습니다.',CATALOG.sections?.theatres||[],30);
    }else if(discoverMode==='mystreaming'){
      hero=myStreamingMovies()[0]||hero; html=myStreamingSection('MY STREAMING','내 구독 서비스와 flatrate 제공 정보를 교차한 결과입니다.',30)+ (isSignedIn()?rowSection('WATCHLIST · AVAILABLE NOW','보고 싶다고 저장한 영화 중 지금 내 구독으로 볼 수 있습니다.',watchlistAvailable(),20,'library'):'');
    }else if(discoverMode==='streaming'){
      hero=(CATALOG.sections?.streaming||[])[0]||hero; html=rowSection('STREAMING','대한민국 지역 구독형 스트리밍 제공 영화.',CATALOG.sections?.streaming||[],30);
    }else{
      hero=(CATALOG.sections?.rated||[])[0]||hero; html=rowSection('TOP RATED','TMDB 사용자 평점 기반. 개인 평점과는 분리해 표시합니다.',CATALOG.sections?.rated||[],30);
    }
    const toggle=document.getElementById('artModeToggle'); if(toggle){toggle.classList.toggle('is-on',artMode);toggle.setAttribute('aria-pressed',String(artMode));}
    document.querySelectorAll('[data-discover]').forEach(b=>{b.disabled=artMode;b.style.opacity=artMode?'.46':'';});
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
    <section class="shelf">${rowSection('RECENTLY WATCHED','최근 감상 기록 순.',recent,8,'library')}</section>
    <section class="shelf">${rowSection('WATCHLIST · AVAILABLE NOW','내 구독 서비스에서 현재 제공되는 Watchlist.',watch,8,'library')}</section>
    <section class="shelf">${rowSection('FAVORITES','Favorite로 표시한 영화.',fav,8,'library')}</section>
    <section class="shelf"><div class="section-head"><div><h2>COLLECTIONS</h2><p>수동 컬렉션과 조건 기반 동적 컬렉션.</p></div></div><div class="collection-grid">${collectionCards()}</div></section>`;
  }
  function filterLibrary(list){
    let out=[...list]; const q=libraryFilter.q.trim().toLocaleLowerCase('ko-KR');
    if(q) out=out.filter(m=>[m.title,m.originalTitle,m.director,...genreNames(m)].filter(Boolean).join(' ').toLocaleLowerCase('ko-KR').includes(q));
    if(libraryFilter.status==='watched') out=out.filter(m=>lib(m.id)?.watched);
    else if(libraryFilter.status==='unwatched') out=out.filter(m=>!lib(m.id)?.watched);
    else if(libraryFilter.status==='watchlist') out=out.filter(m=>lib(m.id)?.watchlist);
    else if(libraryFilter.status==='favorite') out=out.filter(m=>lib(m.id)?.favorite);
    if(libraryFilter.rating!=='all') out=out.filter(m=>(lib(m.id)?.rating||0)>=Number(libraryFilter.rating));
    if(libraryFilter.availability==='mine') out=out.filter(availableOnMine);
    if(libraryFilter.genre!=='all') out=out.filter(m=>genreNames(m).includes(libraryFilter.genre));
    if(libraryFilter.art==='art') out=out.filter(isArtMovie);
    if(libraryFilter.decade!=='all'){
      const start=Number(libraryFilter.decade); out=out.filter(m=>Number(m.year)>=start&&Number(m.year)<start+10);
    }
    if(libraryFilter.sort==='title') out.sort((a,b)=>a.title.localeCompare(b.title,'ko'));
    else if(libraryFilter.sort==='rating') out.sort((a,b)=>(lib(b.id)?.rating||0)-(lib(a.id)?.rating||0));
    else if(libraryFilter.sort==='year') out.sort((a,b)=>(b.year||0)-(a.year||0));
    else out.sort((a,b)=>String(lib(b.id)?.savedAt||'').localeCompare(String(lib(a.id)?.savedAt||'')));
    return out;
  }
  function listPage(title,subtitle,list){
    const filtered=filterLibrary(list);
    const genres=[...new Set(list.flatMap(genreNames))].sort((a,b)=>a.localeCompare(b,'ko'));
    const decades=[...new Set(list.map(m=>Math.floor(Number(m.year||0)/10)*10).filter(Boolean))].sort((a,b)=>b-a);
    return `<div class="library-head"><div><p class="eyebrow">LIBRARY</p><h1>${escapeHtml(title)}</h1><p class="library-summary">${escapeHtml(subtitle)} · ${filtered.length}/${list.length}</p></div><button class="secondary-button" id="librarySearchButton">＋ 영화 찾기</button></div>
      <div class="filterbar library-filterbar">
        <input id="libraryQuery" value="${escapeHtml(libraryFilter.q)}" placeholder="제목 · 감독 · 장르 검색"/>
        <select id="libraryStatus"><option value="all">상태 전체</option><option value="watched" ${libraryFilter.status==='watched'?'selected':''}>본 영화</option><option value="unwatched" ${libraryFilter.status==='unwatched'?'selected':''}>안 본 영화</option><option value="watchlist" ${libraryFilter.status==='watchlist'?'selected':''}>Watchlist</option><option value="favorite" ${libraryFilter.status==='favorite'?'selected':''}>Favorites</option></select>
        <select id="libraryRating"><option value="all">평점 전체</option><option value="4.5" ${libraryFilter.rating==='4.5'?'selected':''}>★ 4.5+</option><option value="4" ${libraryFilter.rating==='4'?'selected':''}>★ 4.0+</option><option value="3" ${libraryFilter.rating==='3'?'selected':''}>★ 3.0+</option></select>
        <select id="libraryAvailability"><option value="all">감상처 전체</option><option value="mine" ${libraryFilter.availability==='mine'?'selected':''}>내 구독에서 가능</option></select>
        <select id="libraryGenre"><option value="all">장르 전체</option>${genres.map(g=>`<option value="${escapeHtml(g)}" ${libraryFilter.genre===g?'selected':''}>${escapeHtml(g)}</option>`).join('')}</select>
        <select id="libraryDecade"><option value="all">연대 전체</option>${decades.map(d=>`<option value="${d}" ${String(libraryFilter.decade)===String(d)?'selected':''}>${d}s</option>`).join('')}</select>
        <select id="libraryArt"><option value="all">분류 전체</option><option value="art" ${libraryFilter.art==='art'?'selected':''}>Art Cinema</option></select>
        <select id="librarySort"><option value="recent" ${libraryFilter.sort==='recent'?'selected':''}>최근 추가</option><option value="title" ${libraryFilter.sort==='title'?'selected':''}>제목</option><option value="rating" ${libraryFilter.sort==='rating'?'selected':''}>내 평점</option><option value="year" ${libraryFilter.sort==='year'?'selected':''}>개봉연도</option></select>
        <button class="text-button filter-reset" data-library-filter-reset>필터 초기화</button>
      </div>
      ${filtered.length?`<div class="all-grid library-grid">${filtered.map(m=>card(m,'library')).join('')}</div>`:`<div class="empty-state"><div class="empty-icon">${icon('search')}</div><b>조건에 맞는 영화가 없습니다.</b><span>필터를 초기화하거나 새 영화를 검색해보세요.</span><button class="secondary-button" data-library-filter-reset>필터 초기화</button></div>`}`;
  }
  function renderCollectionsPage(){ return `<div class="library-head"><div><p class="eyebrow">COLLECTIONS</p><h1>컬렉션</h1><p class="library-summary">수동 컬렉션과 자동으로 바뀌는 Dynamic Collection을 함께 관리합니다.</p></div><button class="secondary-button" id="newCollectionInline">＋ New Collection</button></div><div class="collection-grid">${collectionCards()}</div>`; }
  function renderCollectionDetail(c){ const list=c.movieIds.map(movie).filter(Boolean); return listPage(c.name,'직접 만든 컬렉션.',list); }
  function bindLibraryControls(){
    const q=document.getElementById('libraryQuery'); if(q) q.addEventListener('input',e=>{libraryFilter.q=e.target.value; renderLibrary();});
    const binds={librarySort:'sort',libraryStatus:'status',libraryRating:'rating',libraryAvailability:'availability',libraryGenre:'genre',libraryDecade:'decade',libraryArt:'art'};
    Object.entries(binds).forEach(([id,key])=>{const el=document.getElementById(id);if(el)el.addEventListener('change',e=>{libraryFilter[key]=e.target.value;renderLibrary();});});
  }
  function renderLibrary(){
    if(!isSignedIn()){ document.getElementById('libraryContent').innerHTML=gateHtml('Library는 로그인 후 사용할 수 있습니다.'); document.getElementById('libraryCount').textContent='—'; return; }
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

  function reviewCount(){ return state.logs.filter(x=>x.review?.trim()).length; }
  function watchedCount(){ return Object.values(state.library).filter(x=>x.watched).length; }
  function renderProfileCard(){
    const p=state.profile; const authName=currentUser?.user_metadata?.full_name||currentUser?.user_metadata?.name||''; if(authName&&(!p.name||p.name==='Local User')) p.name=authName; if((!p.handle||p.handle==='@local')&&currentUser?.email)p.handle=currentUser.email; const initial=(p.name||currentUser?.email||'U').trim()[0]?.toUpperCase()||'U'; document.getElementById('topAvatar').textContent=initial;
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
  function ratingsHtml(){
    const rated=allSavedMovies().filter(m=>lib(m.id)?.rating).sort((a,b)=>(lib(b.id)?.rating||0)-(lib(a.id)?.rating||0)||a.title.localeCompare(b.title,'ko'));
    if(!rated.length) return '<div class="empty-state">아직 평점을 남긴 영화가 없습니다.</div>';
    const buckets=[5,4.5,4,3.5,3,2.5,2,1.5,1,.5].map(value=>({value,movies:rated.filter(m=>Number(lib(m.id)?.rating)===value)})).filter(x=>x.movies.length);
    return `<div class="rating-groups">${buckets.map(group=>`<section class="rating-group"><div class="rating-group-head"><strong>★ ${group.value}</strong><span>${group.movies.length} films</span></div><div class="poster-row library-poster-row">${group.movies.map(m=>card(m,'library')).join('')}</div></section>`).join('')}</div>`;
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
    const watchedIds=Object.keys(state.library).filter(id=>state.library[id].watched); const watchedMovies=watchedIds.map(movie).filter(Boolean); const totalMinutes=state.logs.reduce((s,l)=>s+(movie(l.movieId)?.runtime||0),0); const ratings=Object.values(state.library).map(x=>Number(x.rating)).filter(Boolean); const avg=ratings.length?(ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1):'—'; const genres={}; watchedMovies.forEach(m=>genreNames(m).forEach(g=>genres[g]=(genres[g]||0)+1)); const entries=Object.entries(genres).sort((a,b)=>b[1]-a[1]).slice(0,6); const max=entries[0]?.[1]||1;
    return `<div class="stats-grid"><div class="stat-card"><strong>${watchedCount()}</strong><span>Watched films</span></div><div class="stat-card"><strong>${Math.round(totalMinutes/60)}h</strong><span>Approx. runtime</span></div><div class="stat-card"><strong>${avg}</strong><span>Average rating</span></div><div class="stat-card"><strong>${state.logs.length}</strong><span>Diary logs</span></div></div><div class="panel" style="margin-top:16px"><h2>장르 분포</h2><div class="bar-list">${entries.map(([g,n])=>`<div class="bar-row"><span>${escapeHtml(g)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(n/max*100)}%"></div></div><b>${n}</b></div>`).join('')||'<span class="library-summary">감상 기록이 필요합니다.</span>'}</div></div>`;
  }
  function subscriptionsHtml(){ return `<div class="library-head"><div><p class="eyebrow">MY STREAMING</p><h1>구독 중인 서비스</h1><p class="library-summary">여기서 켠 서비스가 Discover의 MY STREAMING과 Library의 Available Watchlist에 반영됩니다. 실제 결제 여부를 확인하지는 않습니다.</p></div></div><div class="subscription-grid">${PROVIDERS.map(p=>{const on=isSubscriptionEnabled(p.key);return `<div class="subscription"><div><b>${escapeHtml(p.label)}</b><small>${p.manualOnly?'구독 표시 지원 · 자동 작품 매칭은 아직 미지원':on?'내 구독으로 사용':'구독 안 함'}</small></div><button class="toggle ${on?'is-on':''}" data-subscription="${escapeHtml(p.key)}" aria-label="${escapeHtml(p.label)} 구독 토글"></button></div>`}).join('')}</div><p class="source-note">콜렉티오는 예술영화 전문 OTT로 구독 서비스 목록에 포함했습니다. 현재 TMDB/JustWatch의 KR 제공처 데이터에서 자동 availability를 확인할 수 없어, 구독 상태만 수동 관리합니다.</p>`; }
  function backupNudgeHtml(){
    if(!needsBackup()) return '';
    return `<div class="backup-nudge"><div class="backup-nudge-icon">${icon('download')}</div><div><b>클라우드 동기화와 별개로 내보내기를 권장합니다.</b><p>무료 인프라 장애나 계정 문제에 대비해 사용자가 직접 보관할 수 있는 JSON 백업을 유지합니다.</p></div><div class="backup-nudge-actions"><button class="primary-button" id="backupNowButton">지금 백업</button><button class="text-button" id="dismissBackupNudge">나중에</button></div></div>`;
  }
  function accountHtml(){
    const user=currentUser; const label=user?.user_metadata?.full_name||user?.user_metadata?.name||user?.email||'KINOSIS User';
    const statusLabel=syncState.status==='online'?'SYNCED':syncState.status==='syncing'?'SYNCING':syncState.status==='pending'?'PENDING':'OFFLINE';
    const statusClass=syncState.status==='online'?'good':syncState.status==='offline'?'bad':'pending';
    return `<div class="library-head"><div><p class="eyebrow">ACCOUNT & DATA</p><h1>계정과 동기화</h1><p class="library-summary">Library와 MY 데이터는 Supabase 계정에 연결되고, 현재 기기에는 오프라인 캐시를 남깁니다.</p></div></div>
      <div class="cloud-account-grid">
        <section class="account-card"><div class="account-icon">${icon('user')}</div><div><p class="eyebrow">SIGNED IN</p><h2>${escapeHtml(label)}</h2><p class="account-email">${escapeHtml(user?.email||'소셜 로그인 계정')}</p></div><span class="account-status good">ACTIVE</span></section>
        <section class="account-card"><div class="account-icon">${icon('cloud')}</div><div><p class="eyebrow">CLOUD SYNC</p><h2 class="sync-pill"><span class="sync-dot ${syncState.status}"></span>${statusLabel}</h2><p>마지막 동기화: ${escapeHtml(formatDateTime(syncState.lastSyncedAt||state.meta?.lastSyncedAt))}${syncState.message?` · ${escapeHtml(syncState.message)}`:''}</p></div><span class="account-status ${statusClass}">${statusLabel}</span></section>
      </div>
      <section class="panel data-safety" style="margin-top:16px"><div class="section-head"><div><h2>내 데이터</h2><p>클라우드 동기화와 별개로 JSON 내보내기를 계속 지원합니다.</p></div></div><div class="data-actions"><button class="secondary-button" id="accountExportButton">${icon('download')} JSON 내보내기</button><label class="secondary-button file-label">${icon('upload')} JSON 가져오기<input type="file" id="accountImportInput" accept="application/json" hidden></label><button class="secondary-button" id="syncNowButton">${icon('cloud')} 지금 동기화</button><button class="secondary-button danger-button" id="signOutButton">로그아웃</button></div></section>`;
  }

  function renderMy(){
    if(!isSignedIn()){ document.getElementById('profileCard').innerHTML=''; document.getElementById('myContent').innerHTML=gateHtml('MY는 로그인 후 사용할 수 있습니다.'); return; }
    renderProfileCard(); let html='';
    if(myMode==='profile') html=`${backupNudgeHtml()}<div class="dashboard-grid"><section class="panel"><h2>최근 감상</h2>${diaryHtml(5)}</section><section class="panel"><h2>최근 리뷰</h2>${reviewsHtml(4)}</section></div><div style="margin-top:18px">${calendarHtml(calendarCursor,true)}</div>`;
    else if(myMode==='diary') html=`<div class="library-head"><div><p class="eyebrow">DIARY</p><h1>감상 기록</h1><p class="library-summary">같은 영화를 여러 번 봐도 각각의 감상일을 별도 기록합니다.</p></div><button class="secondary-button" id="myLogButton">＋ Log Film</button></div>${diaryHtml()}`;
    else if(myMode==='reviews') html=`<div class="library-head"><div><p class="eyebrow">REVIEWS</p><h1>내 리뷰</h1><p class="library-summary">작성한 한줄평을 한곳에서 다시 봅니다.</p></div></div>${reviewsHtml()}`;
    else if(myMode==='ratings') html=`<div class="library-head"><div><p class="eyebrow">RATINGS</p><h1>내 평점</h1><p class="library-summary">내가 매긴 점수대로 영화를 다시 봅니다.</p></div></div>${ratingsHtml()}`;
    else if(myMode==='calendar') html=`<div class="library-head"><div><p class="eyebrow">CALENDAR</p><h1>감상 캘린더</h1><p class="library-summary">Viewing Log의 감상일을 달력에 투영합니다.</p></div></div>${calendarHtml(calendarCursor)}`;
    else if(myMode==='stats') html=`<div class="library-head"><div><p class="eyebrow">STATS</p><h1>내 영화 기록</h1><p class="library-summary">경쟁이나 streak가 아니라 회고를 위한 통계입니다.</p></div></div>${statsHtml()}`;
    else if(myMode==='subscriptions') html=subscriptionsHtml();
    else if(myMode==='account') html=accountHtml();
    document.getElementById('myContent').innerHTML=html;
    const accountImport=document.getElementById('accountImportInput'); if(accountImport) accountImport.addEventListener('change',handleImport);
    document.querySelectorAll('[data-my]').forEach(b=>b.classList.toggle('is-active',b.dataset.my===myMode));
  }

  function localSearch(query){
    const normalized=query.trim().toLocaleLowerCase('ko-KR');
    if(!normalized) return (CATALOG.sections?.trending||[]).slice(0,12);
    return [...movieMap.values()].filter(m=>{
      const haystack=[m.title,m.originalTitle,m.director,m.year].filter(Boolean).join(' ').toLocaleLowerCase('ko-KR');
      return haystack.includes(normalized);
    }).slice(0,30);
  }
  function searchResultCard(m){
    const sourceLive=m.source==='tmdb-live';
    const subtitle=[m.year||'—',m.director||'',sourceLive?(m.originalTitle&&m.originalTitle!==m.title?m.originalTitle:'TMDB LIVE'):''].filter(Boolean).join(' · ');
    return `<article class="search-result" data-movie="${escapeHtml(m.id)}" tabindex="0">
      <img src="${escapeHtml(poster(m))}" alt="${escapeHtml(m.title)} 포스터" loading="lazy" onerror="this.style.opacity='.18'"/>
      <div><div class="search-title-row"><h3>${escapeHtml(m.title)}</h3>${sourceLive?'<span class="live-badge">LIVE</span>':''}</div><p>${escapeHtml(subtitle)} ${availableOnMine(m)?'· ✓ 내 구독':''}</p></div>
      <div class="result-actions"><button class="tiny-button ${lib(m.id)?'':'accent'}" data-action="save" data-id="${escapeHtml(m.id)}" aria-label="${lib(m.id)?'저장됨':'라이브러리에 저장'}">${lib(m.id)?'✓':'＋'}</button><button class="tiny-button" data-action="log" data-id="${escapeHtml(m.id)}">LOG</button></div>
    </article>`;
  }
  function renderSearch(q=''){
    const query=q.trim();
    const local=localSearch(query);
    const remote=liveSearchState.query===query?liveSearchState.results:[];
    const combined=uniqueById([...local,...remote]).slice(0,40);
    let status='';
    if(!query) status='추천 영화 · 제목을 입력하면 KINOSIS 카탈로그와 TMDB를 함께 검색합니다.';
    else if(query.length<LIVE_SEARCH_MIN_CHARS) status=`<b>${escapeHtml(query)}</b> · ${LIVE_SEARCH_MIN_CHARS}글자부터 전체 TMDB 검색`;
    else if(liveSearchState.query===query && liveSearchState.status==='loading') status=`<b>${escapeHtml(query)}</b> · 로컬 ${local.length}개 · <span class="search-live-status">TMDB 검색 중…</span>`;
    else if(liveSearchState.query===query && liveSearchState.status==='error') status=`<b>${escapeHtml(query)}</b> · 로컬 결과 ${local.length}개 · <span class="search-error">TMDB 연결 실패 — 로컬 검색은 계속 사용 가능</span>`;
    else status=`<b>${escapeHtml(query)}</b> · ${combined.length}개 결과${remote.length?` · TMDB ${remote.length}개 포함`:''}`;
    const resultHtml=combined.map(searchResultCard).join('');
    document.getElementById('searchResults').innerHTML=`<div class="search-summary">${status}</div>${resultHtml||`<div class="empty-state"><div class="empty-icon">${icon('search')}</div><b>영화를 찾지 못했습니다.</b><span>${canUseLiveApi()?'TMDB 전체 검색에서도 결과가 없거나 일시적으로 연결할 수 없습니다.':'로컬 파일 실행에서는 동기화된 카탈로그만 검색합니다. Netlify 배포 주소에서 전체 TMDB 검색을 사용할 수 있습니다.'}</span></div>`}`;
  }
  async function runLiveSearch(query,serial){
    if(!canUseLiveApi() || query.length<LIVE_SEARCH_MIN_CHARS) return;
    if(searchAbort) searchAbort.abort();
    searchAbort=new AbortController();
    liveSearchState={query,status:'loading',results:[],message:''}; renderSearch(query);
    try{
      const results=await fetchLiveSearch(query,{signal:searchAbort.signal});
      if(serial!==searchSerial) return;
      liveSearchState={query,status:'done',results,message:''};
    }catch(error){
      if(error?.name==='AbortError') return;
      if(serial!==searchSerial) return;
      console.warn('KINOSIS live search:',error);
      liveSearchState={query,status:'error',results:[],message:error.message||'Live search failed'};
    }
    renderSearch(query);
  }
  function queueSearch(q){
    const query=q.trim();
    clearTimeout(searchTimer);
    const serial=++searchSerial;
    liveSearchState=query===liveSearchState.query?liveSearchState:{query,status:'idle',results:[],message:''};
    renderSearch(query);
    if(searchComposing || query.length<LIVE_SEARCH_MIN_CHARS || !canUseLiveApi()) return;
    searchTimer=setTimeout(()=>runLiveSearch(query,serial),LIVE_SEARCH_DEBOUNCE);
  }
  function openSearch(){ showDialog('searchDialog'); const input=document.getElementById('searchInput'); queueSearch(input.value); setTimeout(()=>input.focus(),60); }
  function renderMovieDialog(m){
    if(!m)return;
    const l=lib(m.id); const groups={subscription:[],free:[],ads:[],rent:[],buy:[]}; (m.providers||[]).forEach(p=>(groups[p.type]||(groups[p.type]=[])).push(p));
    const group=(key,label)=>groups[key]?.length?`<div class="provider-group"><h4>${label}</h4><div class="providers">${groups[key].map(p=>{const owned=isSubscribedProvider(p.name)&&key==='subscription';const cfg=providerConfigForName(p.name);const labelText=cfg?.label||p.name;const logo=p.logoUrl?`<img class="provider-inline-logo" src="${escapeHtml(p.logoUrl)}" alt=""/>`:'';return `<span class="provider-pill ${owned?'owned':''}">${logo}${owned?'✓ ':''}${escapeHtml(labelText)}</span>`}).join('')}</div></div>`:'';
    const original=m.originalTitle&&m.originalTitle!==m.title?`<div class="detail-original">${escapeHtml(m.originalTitle)}</div>`:''; const art=artInfo(m); const artNote=art.isArt?`<div class="art-note"><b>ART MODE</b>${art.reasons.map(r=>`<span class="art-reason">${escapeHtml(r)}</span>`).join('')}</div>`:'';
    document.getElementById('movieDialogContent').innerHTML=`<div class="movie-sheet"><img class="movie-sheet-bg" src="${escapeHtml(backdrop(m))}" alt=""/><button class="movie-close" data-close="movieDialog" aria-label="닫기">×</button><div class="movie-sheet-content"><img class="detail-poster" src="${escapeHtml(poster(m))}" alt="${escapeHtml(m.title)} 포스터"/><div class="detail-main"><p class="eyebrow">${l?.watched?'WATCHED':l?'IN LIBRARY':'FILM'}</p><h2>${escapeHtml(m.title)}</h2>${original}<div class="detail-meta">${escapeHtml(m.director||'Director —')} · ${m.year||'—'} ${m.runtime?`· ${fmtRuntime(m.runtime)}`:''} · TMDB ${fmtRating(m.voteAverage??m.rating)}</div>${artNote}<p class="detail-overview">${escapeHtml(m.overview||'줄거리 정보가 없습니다.')}</p><div class="provider-groups">${group('subscription','SUBSCRIPTION / FLATRATE')}${group('free','FREE')}${group('ads','WITH ADS')}${group('rent','RENT')}${group('buy','BUY')}</div><p class="source-note">스트리밍 제공 정보: JustWatch via TMDB · 지역 KR · 실제 제공 여부와 요금은 각 서비스에서 최종 확인하세요.</p><div class="detail-actions"><button class="primary-button" data-action="save" data-id="${escapeHtml(m.id)}">${l?'✓ IN LIBRARY':'＋ LIBRARY'}</button><button class="secondary-button" data-action="log" data-id="${escapeHtml(m.id)}">LOG FILM</button><button class="secondary-button" data-action="watchlist" data-id="${escapeHtml(m.id)}">${l?.watchlist?'✓ WATCHLIST':'＋ WATCHLIST'}</button><button class="secondary-button" data-action="favorite" data-id="${escapeHtml(m.id)}">${l?.favorite?'♥ FAVORITE':'♡ FAVORITE'}</button><button class="secondary-button" data-action="collection-add" data-id="${escapeHtml(m.id)}">＋ COLLECTION</button>${m.watchLink?`<a class="secondary-button" href="${escapeHtml(m.watchLink)}" target="_blank" rel="noopener">WHERE TO WATCH ↗</a>`:''}${m.imdbId?`<a class="secondary-button" href="https://www.imdb.com/title/${escapeHtml(m.imdbId)}/" target="_blank" rel="noopener">IMDb ↗</a>`:''}</div></div></div></div>`;
  }
  async function openMovie(id){
    let m=movie(id); if(!m)return;
    showDialog('movieDialog');
    if(m.source==='tmdb-live'&&!m.detailLoaded&&canUseLiveApi()){
      document.getElementById('movieDialogContent').innerHTML=`<div class="detail-loading"><div class="loading-ring"></div><b>${escapeHtml(m.title)}</b><span>TMDB에서 상세정보와 한국 제공처를 확인하는 중…</span></div>`;
      m=await ensureMovieDetail(id,{persist:!!lib(id)})||m;
    }
    renderMovieDialog(m);
  }
  async function openLog(id){ if(!requireAuth())return;
    let m=movie(id); if(!m)return;
    m=await ensureMovieDetail(id,{persist:true})||m;
    rememberMovie(m,{persist:true}); saveState();
    document.getElementById('logMovieId').value=String(id); document.getElementById('logMovieTitle').textContent=m.title; document.getElementById('logDate').value=isoDate(new Date()); const l=lib(id); document.getElementById('logRating').value=l?.rating||''; document.getElementById('logReview').value=l?.review||''; document.getElementById('logFavorite').checked=!!l?.favorite; showDialog('logDialog');
  }
  async function saveMovie(id){ if(!requireAuth())return;
    const existed=!!lib(id); let m=movie(id); if(!m)return;
    m=await ensureMovieDetail(id,{persist:true})||m; rememberMovie(m,{persist:true});
    ensureLib(id); saveState(); renderAll(); if(document.getElementById('searchDialog')?.open) renderSearch(document.getElementById('searchInput').value);
    toast(existed?'이미 Library에 있습니다.':'Library에 추가했습니다.');
  }
  function toggleWatchlist(id){ if(!requireAuth())return; const m=movie(id); if(m)rememberMovie(m,{persist:true}); const l=ensureLib(id); l.watchlist=!l.watchlist; saveState(); renderAll(); openMovie(id); toast(l.watchlist?'Watchlist에 추가했습니다.':'Watchlist에서 제거했습니다.'); }
  function toggleFavorite(id){ if(!requireAuth())return; const m=movie(id); if(m)rememberMovie(m,{persist:true}); const l=ensureLib(id); l.favorite=!l.favorite; saveState(); renderAll(); openMovie(id); toast(l.favorite?'Favorite로 표시했습니다.':'Favorite를 해제했습니다.'); }
  function addToCollection(id){ if(!requireAuth())return;
    if(!state.collections.length){ newCollection(); return; }
    const names=state.collections.map((c,i)=>`${i+1}. ${c.name}`).join('\n');
    const raw=prompt(`추가할 컬렉션 번호를 입력하세요.\n${names}`); const idx=Number(raw)-1;
    const c=state.collections[idx]; if(!c)return; if(!c.movieIds.includes(String(id)))c.movieIds.push(String(id)); const m=movie(id); if(m)rememberMovie(m,{persist:true}); ensureLib(id); saveState(); renderAll(); toast(`${c.name}에 추가했습니다.`);
  }
  function newCollection(){ if(!requireAuth())return; const name=prompt('새 컬렉션 이름'); if(!name?.trim())return; state.collections.push({id:'col-'+Date.now(),name:name.trim(),type:'manual',movieIds:[]}); saveState(); libraryMode='collections'; renderAll(); }
  function editProfile(){ if(!requireAuth())return; const name=prompt('표시 이름',state.profile.name); if(name?.trim()) state.profile.name=name.trim(); const bio=prompt('한줄 소개',state.profile.bio); if(bio!==null) state.profile.bio=bio.trim(); saveState(); renderAll(); }

  function setView(view){ if((view==='library'||view==='my')&&!requireAuth('Library와 MY는 로그인 후 사용할 수 있습니다.'))return; activeView=view; document.querySelectorAll('.view').forEach(v=>v.classList.toggle('is-active',v.dataset.view===view)); document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('is-active',b.dataset.nav===view)); document.querySelectorAll('.mobile-nav-item[data-nav]').forEach(b=>b.classList.toggle('is-active',b.dataset.nav===view)); window.scrollTo({top:0,behavior:'smooth'}); }
  function renderStatus(){ const live=CATALOG.mode==='live'; document.getElementById('dataStatusText').textContent=live?'SYNCED':'LOCAL DEMO'; document.getElementById('sourceStatus').innerHTML=`현재 모드: <b>${live?'LIVE API SYNC':'LOCAL DEMO'}</b><br>마지막 카탈로그 갱신: ${escapeHtml(CATALOG.updatedAt||'unknown')}<br>지역: ${escapeHtml(CATALOG.region||'KR')}<br>계정: ${isSignedIn()?'SIGNED IN · '+escapeHtml(syncState.status.toUpperCase()):'SIGNED OUT'}`; }
  function renderAll(){ renderDiscover(); renderLibrary(); renderMy(); renderStatus(); renderAccountChrome(); }

  document.addEventListener('click',e=>{
    const close=e.target.closest('[data-close]'); if(close){ closeDialog(close.dataset.close); return; }
    const nav=e.target.closest('[data-nav]'); if(nav){ setView(nav.dataset.nav); return; }
    const dt=e.target.closest('[data-discover]'); if(dt){ discoverMode=dt.dataset.discover; document.querySelectorAll('[data-discover]').forEach(b=>b.classList.toggle('is-active',b.dataset.discover===discoverMode)); renderDiscover(); return; }
    const lt=e.target.closest('[data-library]'); if(lt){ libraryMode=lt.dataset.library; renderLibrary(); return; }
    const mt=e.target.closest('[data-my]'); if(mt){ myMode=mt.dataset.my; renderMy(); return; }
    const action=e.target.closest('[data-action]'); if(action){ e.stopPropagation(); const id=action.dataset.id; const a=action.dataset.action; if(a==='save')saveMovie(id); else if(a==='log')openLog(id); else if(a==='detail')openMovie(id); else if(a==='watchlist')toggleWatchlist(id); else if(a==='favorite')toggleFavorite(id); else if(a==='collection-add')addToCollection(id); return; }
    if(e.target.closest('[data-library-filter-reset]')){ libraryFilter={q:'',sort:'recent',status:'all',rating:'all',availability:'all',genre:'all',decade:'all',art:'all'}; renderLibrary(); return; }
    const collection=e.target.closest('[data-collection],[data-collection-card]'); if(collection){ const id=collection.dataset.collection||collection.dataset.collectionCard; libraryMode=`collection:${id}`; setView('library'); renderLibrary(); return; }
    const dyn=e.target.closest('[data-dynamic]'); if(dyn){ libraryMode='dynamic:my-streaming'; setView('library'); renderLibrary(); return; }
    const mov=e.target.closest('[data-movie]'); if(mov){ openMovie(mov.dataset.movie); return; }
    const sub=e.target.closest('[data-subscription]'); if(sub){ const p=sub.dataset.subscription; const on=isSubscriptionEnabled(p); state.subscriptions=on?state.subscriptions.filter(x=>normalizeProviderName(x)!==normalizeProviderName(p)):[...(state.subscriptions||[]),p]; saveState(); renderAll(); toast(`${providerConfigForName(p)?.label||p}: ${isSubscriptionEnabled(p)?'구독 중':'구독 안 함'}`); return; }
    const cal=e.target.closest('[data-cal]'); if(cal){ calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+(cal.dataset.cal==='next'?1:-1),1); renderMy(); return; }
    if(e.target.closest('#searchTrigger')||e.target.closest('#mobileSearch')||e.target.closest('#librarySearchButton')||e.target.closest('#myLogButton')||e.target.closest('[data-open-search]')){ openSearch(); return; }
    if(e.target.closest('[data-open-subscriptions]')){ if(!requireAuth())return; myMode='subscriptions'; setView('my'); renderMy(); return; }
    if(e.target.closest('[data-open-auth]')){ showDialog('authDialog'); return; }
    const authProvider=e.target.closest('[data-auth-provider]'); if(authProvider){ const provider=authProvider.dataset.authProvider; const msg=document.getElementById('authMessage'); msg.textContent='로그인 페이지로 이동합니다…'; msg.classList.remove('is-error'); CLOUD?.signInOAuth(provider).catch(err=>{msg.textContent=err.message||'로그인 설정을 확인하세요.';msg.classList.add('is-error');}); return; }
    if(e.target.closest('#topAccountButton')){ if(isSignedIn()){myMode='account';setView('my');renderMy();}else showDialog('authDialog'); return; }
    if(e.target.closest('#artModeToggle')){ state.preferences=state.preferences||{}; state.preferences.artMode=!state.preferences.artMode; saveState({sync:isSignedIn(),mark:isSignedIn()}); renderDiscover(); toast(state.preferences.artMode?'ART MODE ON':'ART MODE OFF'); return; }
    if(e.target.closest('#syncNowButton')){ pushCloudState(); return; }
    if(e.target.closest('#signOutButton')){ CLOUD?.signOut().catch(err=>toast(err.message||'로그아웃 실패')); return; }
    if(e.target.closest('#backupNowButton')||e.target.closest('#accountExportButton')){ exportData(); return; }
    if(e.target.closest('#dismissBackupNudge')){ state.settings.backupNudgeDismissedAt=new Date().toISOString(); saveState(); renderMy(); return; }
    if(e.target.closest('#newCollectionButton')||e.target.closest('#newCollectionInline')){ newCollection(); return; }
    if(e.target.closest('#editProfile')){ editProfile(); return; }
    if(e.target.closest('#aboutButton')||e.target.closest('#dataStatusButton')){ showDialog('aboutDialog'); return; }
    if(e.target.closest('#exportButton')){ exportData(); return; }
  });
  const searchInput=document.getElementById('searchInput');
  searchInput.addEventListener('compositionstart',()=>{ searchComposing=true; });
  searchInput.addEventListener('compositionend',e=>{ searchComposing=false; queueSearch(e.target.value); });
  searchInput.addEventListener('input',e=>{ if(!searchComposing) queueSearch(e.target.value); });
  document.getElementById('logForm').addEventListener('submit',e=>{
    e.preventDefault(); if(!requireAuth())return; const id=document.getElementById('logMovieId').value; const watchedAt=document.getElementById('logDate').value; if(!id||!watchedAt)return; const rating=document.getElementById('logRating').value; const review=document.getElementById('logReview').value.trim(); const favorite=document.getElementById('logFavorite').checked; const m=movie(id); if(m)rememberMovie(m,{persist:true}); const l=ensureLib(id); l.watched=true; l.watchlist=false; l.favorite=favorite; if(rating)l.rating=Number(rating); if(review||l.review)l.review=review; state.logs.push({id:'log-'+Date.now(),movieId:String(id),watchedAt,rating:rating?Number(rating):null,review}); saveState(); closeDialog('logDialog'); closeDialog('movieDialog'); renderAll(); toast('감상 기록을 저장했습니다.');
  });
  document.addEventListener('keydown',e=>{ if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();openSearch();} if(e.key==='Escape'){/* native dialog handles */} if((e.key==='Enter'||e.key===' ')&&document.activeElement?.matches('.movie-card,.search-result')){e.preventDefault();openMovie(document.activeElement.dataset.movie);} });
  document.getElementById('mobileSearch').addEventListener('click',openSearch);
  document.getElementById('emailAuthForm').addEventListener('submit',async e=>{ e.preventDefault(); const email=document.getElementById('authEmail').value.trim(); const msg=document.getElementById('authMessage'); if(!email)return; msg.textContent='로그인 링크를 보내는 중…'; msg.classList.remove('is-error'); try{await CLOUD.sendMagicLink(email);msg.textContent='이메일을 확인하세요. 로그인 링크를 보냈습니다.';}catch(error){msg.textContent=error.message||'이메일 로그인 요청에 실패했습니다.';msg.classList.add('is-error');} });

  function exportData(){ if(!requireAuth())return; state.settings=state.settings||{}; state.settings.lastExportAt=new Date().toISOString(); saveState(); const blob=new Blob([JSON.stringify({version:2,exportedAt:new Date().toISOString(),state},null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`kinosis-library-${isoDate(new Date())}.json`; a.click(); URL.revokeObjectURL(a.href); renderMy(); toast('내 데이터를 내보냈습니다.'); }
  async function handleImport(e){ if(!requireAuth())return; const file=e.target.files?.[0]; if(!file)return; try{const parsed=JSON.parse(await file.text()); if(!parsed.state?.library)throw new Error('invalid'); const base=initialState(); state=Object.assign(base,parsed.state,{profile:Object.assign(base.profile,parsed.state.profile||{}),settings:Object.assign(base.settings,parsed.state.settings||{}),movieCache:Object.assign({},parsed.state.movieCache||{})}); Object.values(state.movieCache||{}).forEach(m=>rememberMovie(m)); saveState(); renderAll(); closeDialog('aboutDialog'); toast('데이터를 가져왔습니다.');}catch(err){alert('KINOSIS 내보내기 파일을 읽지 못했습니다.');} e.target.value=''; }
  document.getElementById('importInput').addEventListener('change',handleImport);

  let hydratedUserId=null;
  if(CLOUD){
    CLOUD.onChange(async ({event,user,error})=>{
      authReady=true; currentUser=user||null;
      if(error){syncState={status:'offline',lastSyncedAt:null,message:error.message||'Auth unavailable'};}
      if(currentUser){
        closeDialog('authDialog');
        if(hydratedUserId!==currentUser.id || event==='SIGNED_IN'){ hydratedUserId=currentUser.id; await hydrateSignedInUser(); }
        else { renderAll(); }
      }else{
        hydratedUserId=null; suppressCloudSync=true; state=initialState(); state.preferences=guestPreferences(); syncState={status:'guest',lastSyncedAt:null,message:''}; renderAll(); setView('discover');
      }
    });
    CLOUD.init().catch(error=>{authReady=true;syncState={status:'offline',lastSyncedAt:null,message:error.message||'Auth init failed'};renderAll();});
  }else{authReady=true;}
  window.addEventListener('online',()=>{ if(isSignedIn()&&state.meta?.dirtySince)pushCloudState(); });
  window.addEventListener('offline',()=>{ if(isSignedIn()){syncState.status='offline';renderAccountChrome();} });
  renderAll(); activeView='discover'; document.querySelectorAll('.view').forEach(v=>v.classList.toggle('is-active',v.dataset.view==='discover'));
  if(location.protocol==='http:'||location.protocol==='https:'){
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{});
    }
  }
})();

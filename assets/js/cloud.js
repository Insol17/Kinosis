(function(){
  'use strict';
  const cfg=window.KINOSIS_CONFIG||{};
  const listeners=new Set();
  let client=null,session=null,readyPromise=null,lastError=null;
  function emit(event){for(const fn of listeners){try{fn({event,session,user:session?.user||null,error:lastError});}catch{}}}
  function redirectUrl(){
    if(location.hostname==='localhost'||location.hostname==='127.0.0.1')return `${location.origin}${location.pathname}`;
    return cfg.authRedirectUrl||`${location.origin}${location.pathname}`;
  }
  function create(){
    if(client)return client;
    if(!window.supabase?.createClient)throw new Error('Supabase client library failed to load.');
    if(!cfg.supabaseUrl||!cfg.supabasePublishableKey)throw new Error('Supabase public configuration is missing.');
    client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'},
      global:{headers:{'X-Client-Info':`kinosis/${cfg.version||'dev'}`}}
    });
    client.auth.onAuthStateChange((event,next)=>{session=next||null;lastError=null;emit(event);});
    return client;
  }
  async function init(){
    if(readyPromise)return readyPromise;
    readyPromise=(async()=>{
      try{const c=create();const {data,error}=await c.auth.getSession();if(error)throw error;session=data.session||null;emit('INITIAL_SESSION');}
      catch(error){lastError=error;emit('ERROR');}
      return {session,user:session?.user||null,error:lastError};
    })();
    return readyPromise;
  }
  function onChange(fn){listeners.add(fn);return()=>listeners.delete(fn);}
  function isAuthenticated(){return!!session?.user;}
  function user(){return session?.user||null;}
  async function signInOAuth(provider){const c=create();const {error}=await c.auth.signInWithOAuth({provider,options:{redirectTo:redirectUrl()}});if(error)throw error;}
  async function sendMagicLink(email){const c=create();const {error}=await c.auth.signInWithOtp({email,options:{emailRedirectTo:redirectUrl(),shouldCreateUser:true}});if(error)throw error;}
  async function signOut(){const c=create();const {error}=await c.auth.signOut();if(error)throw error;}
  async function readUserState(){if(!isAuthenticated())return null;const c=create();const {data,error}=await c.from('user_state').select('payload,updated_at').eq('user_id',user().id).maybeSingle();if(error)throw error;return data||null;}
  async function writeUserState(payload){if(!isAuthenticated())throw new Error('Sign in required.');const c=create();const row={user_id:user().id,payload,updated_at:new Date().toISOString()};const {data,error}=await c.from('user_state').upsert(row,{onConflict:'user_id'}).select('updated_at').single();if(error)throw error;return data;}
  async function health(){const c=create();const {data,error}=await c.from('app_health').select('id').limit(1);if(error)throw error;return data;}
  async function readMyRole(){
    if(!isAuthenticated())return 'guest';
    const c=create();const {data,error}=await c.from('user_roles').select('role').eq('user_id',user().id).maybeSingle();
    if(error){if(String(error.message||'').includes('user_roles'))return 'user';throw error;}return data?.role||'user';
  }
  function normalizeCuration(row){
    const items=[...(row.curation_movies||[])].sort((a,b)=>(a.position||0)-(b.position||0)).map(x=>({position:x.position||0,tmdbId:String(x.tmdb_id),movie:x.movie_snapshot||{id:String(x.tmdb_id)}}));
    return {...row,items};
  }
  async function listCurations({includeDrafts=false}={}){
    const c=create();
    let q=c.from('curations').select('id,slug,title,subtitle,description,surface,type,status,starts_at,ends_at,sort_order,created_at,updated_at,curation_movies(position,tmdb_id,movie_snapshot)').order('sort_order',{ascending:true}).order('created_at',{ascending:false});
    if(!includeDrafts)q=q.eq('status','published');
    const {data,error}=await q;if(error)throw error;return (data||[]).map(normalizeCuration);
  }
  async function saveCuration(meta,items=[]){
    if(!isAuthenticated())throw new Error('Sign in required.');
    const c=create();
    const payload={slug:meta.slug,title:meta.title,subtitle:meta.subtitle||'',description:meta.description||'',surface:meta.surface||'arthouse',type:meta.type||'selection',status:meta.status||'draft',starts_at:meta.starts_at||null,ends_at:meta.ends_at||null,sort_order:Number(meta.sort_order||0),updated_at:new Date().toISOString()};
    let id=meta.id;
    if(id){const {error}=await c.from('curations').update(payload).eq('id',id);if(error)throw error;}
    else{const {data,error}=await c.from('curations').insert(payload).select('id').single();if(error)throw error;id=data.id;}
    const {error:deleteError}=await c.from('curation_movies').delete().eq('curation_id',id);if(deleteError)throw deleteError;
    if(items.length){const rows=items.map((x,i)=>({curation_id:id,tmdb_id:Number(x.tmdbId||x.movie?.id),position:i,movie_snapshot:x.movie||x.movie_snapshot||{id:String(x.tmdbId)}}));const {error}=await c.from('curation_movies').insert(rows);if(error)throw error;}
    return id;
  }
  async function deleteCuration(id){if(!isAuthenticated())throw new Error('Sign in required.');const c=create();const {error}=await c.from('curations').delete().eq('id',id);if(error)throw error;}
  window.KINOSIS_CLOUD=Object.freeze({init,onChange,isAuthenticated,user,signInOAuth,sendMagicLink,signOut,readUserState,writeUserState,health,readMyRole,listCurations,saveCuration,deleteCuration,redirectUrl});
})();

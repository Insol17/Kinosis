(function(){
  'use strict';
  const cfg=window.KINOSIS_CONFIG||{};
  const listeners=new Set();
  let client=null, session=null, readyPromise=null, lastError=null;
  function emit(event){ for(const fn of listeners){ try{ fn({event,session,user:session?.user||null,error:lastError}); }catch{} } }
  function redirectUrl(){
    const configured=cfg.authRedirectUrl;
    if(location.hostname==='localhost' || location.hostname==='127.0.0.1') return `${location.origin}${location.pathname}`;
    return configured || `${location.origin}${location.pathname}`;
  }
  function create(){
    if(client) return client;
    if(!window.supabase?.createClient) throw new Error('Supabase client library failed to load.');
    if(!cfg.supabaseUrl || !cfg.supabasePublishableKey) throw new Error('Supabase public configuration is missing.');
    client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit'},
      global:{headers:{'X-Client-Info':`kinosis/${cfg.version||'dev'}`}}
    });
    client.auth.onAuthStateChange((event,next)=>{ session=next||null; lastError=null; emit(event); });
    return client;
  }
  async function init(){
    if(readyPromise) return readyPromise;
    readyPromise=(async()=>{
      try{
        const c=create();
        const {data,error}=await c.auth.getSession();
        if(error) throw error;
        session=data.session||null; emit('INITIAL_SESSION');
      }catch(error){ lastError=error; emit('ERROR'); }
      return {session,user:session?.user||null,error:lastError};
    })();
    return readyPromise;
  }
  function onChange(fn){ listeners.add(fn); return ()=>listeners.delete(fn); }
  function isAuthenticated(){ return !!session?.user; }
  function user(){ return session?.user||null; }
  async function signInOAuth(provider){
    const c=create();
    const {error}=await c.auth.signInWithOAuth({provider,options:{redirectTo:redirectUrl()}});
    if(error) throw error;
  }
  async function sendMagicLink(email){
    const c=create();
    const {error}=await c.auth.signInWithOtp({email,options:{emailRedirectTo:redirectUrl(),shouldCreateUser:true}});
    if(error) throw error;
  }
  async function signOut(){ const c=create(); const {error}=await c.auth.signOut(); if(error) throw error; }
  async function readUserState(){
    if(!isAuthenticated()) return null;
    const c=create();
    const {data,error}=await c.from('user_state').select('payload,updated_at').eq('user_id',user().id).maybeSingle();
    if(error) throw error;
    return data||null;
  }
  async function writeUserState(payload){
    if(!isAuthenticated()) throw new Error('Sign in required.');
    const c=create();
    const row={user_id:user().id,payload,updated_at:new Date().toISOString()};
    const {data,error}=await c.from('user_state').upsert(row,{onConflict:'user_id'}).select('updated_at').single();
    if(error) throw error;
    return data;
  }
  async function health(){
    const c=create();
    const {data,error}=await c.from('app_health').select('id').limit(1);
    if(error) throw error;
    return data;
  }
  window.KINOSIS_CLOUD=Object.freeze({init,onChange,isAuthenticated,user,signInOAuth,sendMagicLink,signOut,readUserState,writeUserState,health,redirectUrl});
})();

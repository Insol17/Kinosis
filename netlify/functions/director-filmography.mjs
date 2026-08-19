import { imageUrl, json, tmdb } from '../lib/tmdb.mjs';

const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9가-힣]+/g,'');
const identity=m=>`${norm(m.original_title||m.title)}|${String(m.release_date||'').slice(0,4)}`;
const parseIds=value=>[...new Set(String(value||'').split(',').map(v=>v.trim()).filter(v=>/^\d+$/.test(v)))];
function movie(m){return{id:String(m.id),title:m.title||m.original_title||'Untitled',originalTitle:m.original_title||'',releaseDate:m.release_date||null,year:m.release_date?.slice(0,4)||null,overview:m.overview||'',voteAverage:m.vote_average??null,voteCount:m.vote_count??0,popularity:m.popularity??0,runtime:m.runtime??null,posterUrl:imageUrl(m.poster_path,'w500'),backdropUrl:imageUrl(m.backdrop_path,'w1280'),source:'tmdb-live'};}
function uniqueMovies(rows){const ids=new Set(),keys=new Set(),out=[];for(const row of rows||[]){if(!row?.id)continue;const id=String(row.id),key=identity(row);if(ids.has(id)||(key!=='|'&&keys.has(key)))continue;ids.add(id);if(key!=='|')keys.add(key);out.push(row);}return out;}
async function pool(items,size,fn){const out=new Array(items.length);let cursor=0;await Promise.all(Array.from({length:Math.min(size,Math.max(1,items.length))},async()=>{while(cursor<items.length){const i=cursor++;try{out[i]=await fn(items[i]);}catch{out[i]=null;}}}));return out.filter(Boolean);}

export default async request=>{
  if(request.method!=='GET')return json({error:'Method not allowed.'},405);
  const u=new URL(request.url);
  const name=(u.searchParams.get('name')||'').trim();
  const id=(u.searchParams.get('id')||'').trim();
  const sort=u.searchParams.get('sort')==='release_desc'?'release_desc':'release_asc';
  const mode=u.searchParams.get('mode')==='solo-features'?'solo-features':'all-directed';
  const include=parseIds(u.searchParams.get('include'));
  const exclude=new Set(parseIds(u.searchParams.get('exclude')));
  if(!name&&!/^\d+$/.test(id))return json({error:'Director name or id required.'},400);
  try{
    let person;
    if(id){person=await tmdb(`/person/${id}`,{language:'ko-KR'});}
    else{
      const search=await tmdb('/search/person',{query:name,language:'ko-KR',include_adult:false,page:1});
      const rows=search.results||[];
      person=rows.sort((a,b)=>{const ae=norm(a.name)===norm(name)?1000:0,be=norm(b.name)===norm(name)?1000:0;const ad=a.known_for_department==='Directing'?200:0,bd=b.known_for_department==='Directing'?200:0;return (be+bd+Number(b.popularity||0))-(ae+ad+Number(a.popularity||0));})[0];
      if(!person)return json({error:'Director not found.'},404);
    }

    const credits=await tmdb(`/person/${person.id}/movie_credits`,{language:'ko-KR'});
    const byId=new Map();
    for(const r of credits.crew||[]){
      if(r.job!=='Director'||!r.id||exclude.has(String(r.id)))continue;
      const key=String(r.id),old=byId.get(key);
      if(!old||Number(r.vote_count||0)>Number(old.vote_count||0))byId.set(key,r);
    }

    let directed=[...byId.values()];
    if(mode==='solo-features'){
      const checked=await pool(directed,4,async candidate=>{
        const [detail,crewPayload]=await Promise.all([
          tmdb(`/movie/${candidate.id}`,{language:'ko-KR'}),
          tmdb(`/movie/${candidate.id}/credits`,{language:'ko-KR'}).catch(()=>({crew:[]})),
        ]);
        const directors=[...new Set((crewPayload.crew||[]).filter(row=>row.job==='Director'&&row.id).map(row=>String(row.id)))];
        if(Number(detail.runtime||0)<60)return null;
        if(directors.length!==1||directors[0]!==String(person.id))return null;
        return detail;
      });
      directed=checked;
    }

    if(include.length){
      const existing=new Set(directed.map(row=>String(row.id)));
      const extra=await pool(include.filter(movieId=>!existing.has(movieId)&&!exclude.has(movieId)),4,async movieId=>tmdb(`/movie/${movieId}`,{language:'ko-KR'}));
      directed.push(...extra);
    }

    let results=uniqueMovies(directed).map(movie);
    results.sort((a,b)=>{const ad=a.releaseDate||'9999-99-99',bd=b.releaseDate||'9999-99-99';return sort==='release_desc'?bd.localeCompare(ad):ad.localeCompare(bd)});
    return json({person:{id:String(person.id),name:person.name,knownForDepartment:person.known_for_department||''},mode,results},200,'public, max-age=0, s-maxage=21600, stale-while-revalidate=86400');
  }catch(e){console.error('director-filmography:',e.message);return json({error:e.message||'Director filmography failed.'},e.status||500)}
};
export const config={path:'/api/director-filmography',method:'GET',rateLimit:{action:'rate_limit',aggregateBy:['ip'],windowSize:60,windowLimit:30}};

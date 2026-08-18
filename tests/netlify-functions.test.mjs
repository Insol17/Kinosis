import assert from 'node:assert/strict';
process.env.TMDB_READ_ACCESS_TOKEN='test-token-not-real';
process.env.KOBIS_API_KEY='kobis-test-not-real';

const searchModule=await import('../netlify/functions/movie-search.mjs');
const detailModule=await import('../netlify/functions/movie-detail.mjs');
const boxOfficeModule=await import('../netlify/functions/box-office.mjs');
const recommendationModule=await import('../netlify/functions/movie-recommendations.mjs');
const personModule=await import('../netlify/functions/person-films.mjs');
const directorModule=await import('../netlify/functions/director-filmography.mjs');
const availabilityModule=await import('../netlify/functions/watchlist-availability.mjs');

const movieFixture={id:15,title:'시민 케인',original_title:'Citizen Kane',release_date:'1941-04-17',overview:'x',vote_average:8,vote_count:999,popularity:20,poster_path:'/poster.jpg',backdrop_path:'/backdrop.jpg'};
const realFetch=globalThis.fetch;
try{
  globalThis.fetch=async(url,options={})=>{
    const value=String(url);
    if(value.includes('kobis.or.kr')){
      assert.ok(value.includes('key=kobis-test-not-real'));
      return Response.json({boxOfficeResult:{dailyBoxOfficeList:Array.from({length:10},(_,i)=>({rank:String(i+1),movieNm:`영화 ${i+1}`,openDt:'20260801',audiAcc:String(100000-i*1000)}))}});
    }
    assert.equal(options.headers.Authorization,'Bearer test-token-not-real');
    if(value.includes('/search/person')) return Response.json({results:[{id:2,name:'Orson Welles',known_for_department:'Directing',popularity:20,profile_path:'/person.jpg',known_for:[]}]});
    if(value.includes('/search/movie')) return Response.json({page:1,total_results:1,results:[{...movieFixture,release_date:value.includes('query=%EC%98%81%ED%99%94')?'2026-08-01':'1941-04-17'}]});
    if(value.includes('/discover/movie')) return Response.json({results:[]});
    if(value.includes('/movie/15/recommendations')) return Response.json({results:[{id:16,title:'추천 영화',original_title:'Recommended',release_date:'1942-01-01',vote_average:7.8,vote_count:500,popularity:12,poster_path:'/p2.jpg',backdrop_path:'/b2.jpg'}]});
    if(value.includes('/movie/15/similar')) return Response.json({results:[{id:17,title:'유사 영화',original_title:'Similar',release_date:'1943-01-01',vote_average:7.2,vote_count:300,popularity:9,poster_path:'/p3.jpg',backdrop_path:'/b3.jpg'}]});
    if(value.includes('/person/2/movie_credits')) return Response.json({cast:[],crew:[{...movieFixture,job:'Director'}]});
    if(value.includes('/person/2')) return Response.json({id:2,name:'Orson Welles',known_for_department:'Directing',biography:'bio',profile_path:'/person.jpg'});
    if(value.includes('/movie/15/release_dates')) return Response.json({results:[{iso_3166_1:'KR',release_dates:[{type:3,release_date:new Date().toISOString()}]}]});
    if(value.includes('/movie/15/credits')) return Response.json({crew:[{id:2,job:'Director',name:'Orson Welles'}],cast:[{id:2,name:'Orson Welles',character:'Kane'}]});
    if(value.includes('/movie/15/external_ids')) return Response.json({imdb_id:'tt0033467'});
    if(value.includes('/movie/15/watch/providers')) return Response.json({results:{KR:{link:'https://example.test/watch',flatrate:[{provider_id:8,provider_name:'Netflix',logo_path:'/netflix.jpg',display_priority:1}],ads:[{provider_id:8,provider_name:'Netflix Standard with Ads',logo_path:'/netflix.jpg',display_priority:2}]}}});
    if(value.includes('/movie/15/keywords')) return Response.json({keywords:[{name:'newspaper'}]});
    if(value.includes('/movie/15')) return Response.json({...movieFixture,runtime:119,tagline:'',genres:[{id:18,name:'드라마'}],production_companies:[],production_countries:[{name:'미국'}],original_language:'en'});
    throw new Error(`unexpected URL ${value}`);
  };

  const searchResponse=await searchModule.default(new Request('https://kinosis.test/api/movie-search?q=%EC%8B%9C%EB%AF%BC%20%EC%BC%80%EC%9D%B8'));
  assert.equal(searchResponse.status,200); const searchData=await searchResponse.json();
  assert.equal(searchData.results[0].id,'15'); assert.equal(searchData.people[0].id,'2');

  const detailResponse=await detailModule.default(new Request('https://kinosis.test/api/movie-detail?id=15'));
  assert.equal(detailResponse.status,200); const detailData=await detailResponse.json();
  assert.equal(detailData.director,'Orson Welles'); assert.equal(detailData.directorId,2); assert.equal(detailData.imdbId,'tt0033467'); assert.equal(detailData.providers[0].type,'subscription'); assert.equal(detailData.cast[0].id,2); assert.equal(detailData.theatricalStatus,'now'); assert.equal(detailData.productionCountries[0],'미국');
  assert.ok(detailData.heroBackdropUrl?.includes('/w1280/'),'detail hero should be capped at w1280');

  const boxOfficeResponse=await boxOfficeModule.default(new Request('https://kinosis.test/api/box-office'));
  assert.equal(boxOfficeResponse.status,200); const boxOfficeData=await boxOfficeResponse.json();
  assert.equal(boxOfficeData.mode,'kobis'); assert.equal(boxOfficeData.results[0].boxOfficeRank,1); assert.ok(boxOfficeData.results.length>=5);

  const recommendationResponse=await recommendationModule.default(new Request('https://kinosis.test/api/movie-recommendations?id=15'));
  assert.equal(recommendationResponse.status,200); const recommendationData=await recommendationResponse.json();
  assert.ok(recommendationData.results.some(row=>row.id==='16'));

  const personResponse=await personModule.default(new Request('https://kinosis.test/api/person-films?id=2'));
  assert.equal(personResponse.status,200); const personData=await personResponse.json();
  assert.equal(personData.person.name,'Orson Welles'); assert.equal(personData.results[0].personRole,'Director');

  const directorResponse=await directorModule.default(new Request('https://kinosis.test/api/director-filmography?name=Orson%20Welles'));
  assert.equal(directorResponse.status,200); const directorData=await directorResponse.json();
  assert.equal(directorData.person.name,'Orson Welles'); assert.equal(directorData.results[0].id,'15');

  const availabilityResponse=await availabilityModule.default(new Request('https://kinosis.test/api/watchlist-availability?ids=15'));
  assert.equal(availabilityResponse.status,200); const availabilityData=await availabilityResponse.json();
  assert.equal(availabilityData.results[0].providers[0].name,'Netflix');

  for(const payload of [searchData,detailData,boxOfficeData,recommendationData,personData,directorData,availabilityData]) {
    assert.ok(!JSON.stringify(payload).includes('test-token-not-real'),'TMDB secret leaked in API response');
    assert.ok(!JSON.stringify(payload).includes('kobis-test-not-real'),'KOBIS secret leaked in API response');
  }
  console.log('netlify-functions.test: search/detail/KOBIS/recommendations/person/director/availability contracts OK');
}finally{globalThis.fetch=realFetch;}

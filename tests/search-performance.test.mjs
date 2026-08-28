import assert from 'node:assert/strict';
import { createMovieSearchIndex } from '../assets/js/features/movie-search-index.js';
import { createMovieRepository } from '../assets/js/infrastructure/movie-repository.js';

const records=[
 {id:'1',title:'택시 드라이버',originalTitle:'Taxi Driver',director:'Martin Scorsese',genres:['드라마'],cast:[{name:'Robert De Niro'}],voteCount:1000,popularity:40},
 {id:'2',title:'드라이브',originalTitle:'Drive',director:'Nicolas Winding Refn',genres:['범죄'],cast:[],voteCount:900,popularity:30},
];
let normalizeCalls=0;
const normalizeText=(value)=>{normalizeCalls++;return String(value||'').normalize('NFKC').toLowerCase().trim();};
const index=createMovieSearchIndex(records,{normalizeText,genreNames:(record)=>record.genres||[]});
const buildCalls=normalizeCalls;
assert.equal(index.search('택시')[0].id,'1');
const afterFirst=normalizeCalls;
index.search('택시');
assert.equal(normalizeCalls-afterFirst,1,'repeated local search should normalize the query only, not every movie field');
assert.ok(buildCalls>2,'index construction should pre-normalize source fields');

let requests=0;
const repository=createMovieRepository({
 apiClient:{json:async()=>{requests++;return {results:[records[0]],people:[]};},prefetch:async()=>null},
 rememberMovie:(row)=>row,
});
const first=await repository.search('택시 드라이버');
const second=await repository.search('  택시 드라이버  ');
assert.equal(requests,1,'identical normalized searches should reuse the five-minute repository cache');
assert.equal(first.cached,false);
assert.equal(second.cached,true);
console.log('search-performance.test: pre-indexed local lookup + normalized query cache OK');

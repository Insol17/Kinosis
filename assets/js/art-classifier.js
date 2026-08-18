(function(){
  'use strict';
  // KINOSIS ART MODE v1 is deliberately deterministic and explainable.
  // It treats canon lists as seed signals, not as a definitive definition of "art film".
  const TITLE_SEEDS = [
    ['The Rules of the Game',1939],['Citizen Kane',1941],['Breathless',1960],['Tokyo Story',1953],
    ['Journey to Italy',1954],['Night and Fog',1956],['Sherlock Jr.',1924],['Greed',1924],
    ['Battleship Potemkin',1925],['Mulholland Drive',2001],['10',2002]
  ];
  const DIRECTOR_SEEDS = [
    'Jean Renoir','Orson Welles','Jean-Luc Godard','Yasujirō Ozu','Yasujiro Ozu','Roberto Rossellini',
    'Alain Resnais','Buster Keaton','Erich von Stroheim','Sergei Eisenstein','David Lynch','Abbas Kiarostami',
    'Ingmar Bergman','Andrei Tarkovsky','Robert Bresson','Michelangelo Antonioni','Federico Fellini','Agnès Varda','Agnes Varda',
    'Éric Rohmer','Eric Rohmer','Jacques Rivette','Chantal Akerman','Hou Hsiao-hsien','Edward Yang','Wong Kar-wai',
    'Tsai Ming-liang','Apichatpong Weerasethakul','Hong Sang-soo','Lee Chang-dong','Park Chan-wook','Bong Joon-ho',
    'Hirokazu Kore-eda','Ryusuke Hamaguchi','Víctor Erice','Victor Erice','Pedro Costa','Jia Zhangke','Claire Denis',
    'Kelly Reichardt','Jim Jarmusch','Todd Haynes','Paul Thomas Anderson','Jonathan Glazer','Céline Sciamma','Celine Sciamma',
    'Joanna Hogg','Nuri Bilge Ceylan','Cristian Mungiu','Asghar Farhadi','Alice Rohrwacher','Luca Guadagnino','Yorgos Lanthimos',
    '봉준호','박찬욱','홍상수','이창동','미야자키 하야오','베르나르도 베르톨루치','프란시스 포드 코폴라','시드니 루멧','제인 숀브런','클레베르 멘돈사 필류','레베카 즐로토브스키','데이비드 로버트 미첼'
  ];
  const KEYWORD_SIGNALS = [
    'independent film','experimental film','avant-garde','arthouse','art house','slow cinema','new wave','surrealism',
    'existentialism','film within a film','nonlinear timeline','minimalism','social realism','poetic','essay film','cinéma vérité','cinema verite'
  ];
  const COMPANY_SIGNALS = ['MUBI','Janus Films','NEON','A24','The Match Factory','mk2 films','Artificial Eye','Curzon','Les Films du Losange'];
  const FESTIVAL_WORDS = ['cannes','venice','berlin','locarno','sundance','rotterdam','busan','jeonju'];
  const normalize = value => String(value||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9가-힣]+/g,' ').trim();
  const set = values => new Set(values.map(normalize));
  const titleSeeds = new Set(TITLE_SEEDS.map(([title,year])=>`${normalize(title)}|${year}`));
  const directorSeeds = set(DIRECTOR_SEEDS);
  const keywordSignals = set(KEYWORD_SIGNALS);
  const companySignals = set(COMPANY_SIGNALS);
  function names(value){ return (Array.isArray(value)?value:[]).map(v=>normalize(typeof v==='string'?v:(v?.name||''))).filter(Boolean); }
  function classify(movie, opts={}){
    if(!movie) return {isArt:false,score:0,reasons:[]};
    if(movie.artOverride===true) return {isArt:true,score:100,reasons:['KINOSIS 수동 큐레이션']};
    if(movie.artOverride===false) return {isArt:false,score:0,reasons:['KINOSIS 수동 제외']};
    let score=0; const reasons=[];
    const year=Number(movie.year||String(movie.releaseDate||'').slice(0,4)||0);
    const titleKeys=[movie.originalTitle,movie.title].filter(Boolean).map(t=>`${normalize(t)}|${year}`);
    if(titleKeys.some(key=>titleSeeds.has(key))){ score+=100; reasons.push('시네필 캐논 시드'); }
    const director=normalize(movie.director);
    if(director && directorSeeds.has(director)){ score+=46; reasons.push('작가 중심 감독 시드'); }
    const kws=names(movie.keywords);
    const matchedKeywords=kws.filter(k=>keywordSignals.has(k) || FESTIVAL_WORDS.some(f=>k.includes(f)));
    if(matchedKeywords.length){ score+=Math.min(28,matchedKeywords.length*9); reasons.push('독립·실험·영화제 메타데이터'); }
    const companies=names(movie.productionCompanies);
    if(companies.some(c=>[...companySignals].some(sig=>c.includes(sig)))){ score+=18; reasons.push('아트하우스 제작·배급 신호'); }
    const genres=names(movie.genres);
    if(genres.includes('documentary')){ score+=6; reasons.push('다큐멘터리'); }
    if(year && year<1970 && Number(movie.voteCount||0)>=100){ score+=9; reasons.push('영화사적 고전 후보'); }
    if(movie.artSeed===true){ score=Math.max(score,70); if(!reasons.includes('KINOSIS 큐레이션 시드')) reasons.push('KINOSIS 큐레이션 시드'); }
    const threshold=Number(opts.threshold||window.KINOSIS_CONFIG?.artMode?.threshold||36);
    return {isArt:score>=threshold,score,reasons:[...new Set(reasons)].slice(0,3)};
  }
  window.KINOSIS_ART = Object.freeze({ classify, titleSeeds:TITLE_SEEDS, directorSeeds:DIRECTOR_SEEDS });
})();

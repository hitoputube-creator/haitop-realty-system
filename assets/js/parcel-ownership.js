(function(){
  'use strict';
  const labels={person:'개인',corporation:'법인',other:'기타',unknown:'미확인'};
  function check(row){const c=row?.data?.ownershipCheck;return c&&String(c.address||'').trim()===String(row?.data?.address||'').trim()?c:null;}
  function state(row){const c=check(row);return Object.hasOwn(labels,c?.category)?c.category:'unknown';}
  function label(row){return labels[state(row)];}
  function date(value){if(!value||!Number.isFinite(Date.parse(value)))return '';return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)).replace(/-/g,'.');}
  function savedSummary(rows){
    const snapshots=rows.map(r=>r.data?.ownershipSnapshot).filter(s=>date(s?.completedAt)).sort((a,b)=>Date.parse(b.completedAt)-Date.parse(a.completedAt));
    const s=snapshots[0];
    if(!s)return '소유 구분 현황 · 전체 업데이트 기록 없음'+(rows.some(r=>check(r))?' · 일부 저장 자료 있음':'');
    const partial=rows.some(r=>Date.parse(r.data?.ownershipCheck?.checkedAt)>Date.parse(s.completedAt));
    return '소유 구분 현황 · '+date(s.completedAt)+' 업데이트 · 조회 '+s.found+'건'+(s.skipped?' · 주소 미확인/변경 '+s.skipped+'건':'')+(partial?' · 이후 일부 결과 저장됨':'');
  }
  function detail(row){
    const c=check(row),d=row?.data||{};
    if(!c)return '소유 구분: 미확인'+(d.ownershipCheck?' · 주소가 변경되어 다시 조회가 필요합니다.':'');
    return '소유 구분: '+label(row)+(c.rawLabel&&c.rawLabel!==label(row)?' ('+c.rawLabel+')':'')+' · 자료 기준일 '+(c.sourceDate||'미제공')+' · 조회일 '+(date(c.checkedAt)||'미확인')+' · '+(c.source||'국토교통부 / 브이월드')+(d.ownershipCheckAttempt?.address===c.address?' · 최근 조회 실패, 기존 자료 표시':'');
  }
  window.HitopParcelOwnership={state,label,date,savedSummary,detail};
})();

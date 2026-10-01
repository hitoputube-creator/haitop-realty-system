(function(root){
  'use strict';
  function fromRegister(info,address) {
    const rawItems=info?.raw?.response?.body?.items?.item;
    const items=Array.isArray(rawItems)?rawItems:rawItems?[rawItems]:[];
    if(!items.length)throw Error('건축물대장 정보가 확인되지 않았습니다.');
    const count=Number(info.raw.response.body.totalCount)||items.length;
    const result={building:'building',buildingCheck:{status:'found',address,checkedAt:new Date().toISOString(),source:'건축물대장',multiple:count>1}};
    // Several title registers can belong to one lot. Never fill one arbitrary building's figures.
    if(count>1)return result;
    const mapping={buildingName:'building_name',buildingPurpose:'main_purpose',buildingFloors:'floor_info',buildingFootprint:'footprint_area_m2',buildingTotalArea:'total_area_m2',buildingStructure:'structure'};
    Object.entries(mapping).forEach(([field,key])=>{
      const value=info[key];
      if(value!==null&&value!==undefined&&value!=='')result[field]=value;
    });
    const date=String(info.use_apr_day||'');
    if(/^\d{8}$/.test(date))result.buildingApproval=date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6);
    return result;
  }
  function savedSummary(rows) {
    const valid=value=>value&&Number.isFinite(Date.parse(value));
    const snapshots=rows.map(row=>row.data?.buildingSnapshot).filter(item=>valid(item?.completedAt));
    snapshots.sort((a,b)=>Date.parse(b.completedAt)-Date.parse(a.completedAt));
    const snapshot=snapshots[0];
    const checks=rows.map(row=>row.data?.buildingCheck).filter(item=>valid(item?.checkedAt));
    checks.sort((a,b)=>Date.parse(b.checkedAt)-Date.parse(a.checkedAt));
    const last=snapshot?.completedAt||checks[0]?.checkedAt;
    if(!last)return '건물 업데이트 현황 · 저장된 업데이트 기록 없음';
    const date=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(last)).replace(/\s/g,'').replace(/\.$/,'');
    let text='건물 업데이트 현황 · '+date;
    if(!snapshot)text+=' · 필지별 저장 기록';
    else {
      text+=' · 건물 확인 '+snapshot.found+'건';
      if(snapshot.review)text+=' · 추가 확인 '+snapshot.review+'건';
      if(snapshot.skipped)text+=' · 주소 미확인/변경 '+snapshot.skipped+'건';
    }
    const pending=rows.some(row=>{
      const check=row.data?.buildingCheck,attempt=row.data?.buildingCheckAttempt;
      return [check,attempt].some(item=>item?.batchId&&valid(item.checkedAt)&&(!snapshot||Date.parse(item.checkedAt)>Date.parse(snapshot.completedAt)));
    });
    if(pending)text+=' · 최근 업데이트 일부 저장 (전체 완료 전)';
    return text;
  }
  root.HitopParcelBuilding={fromRegister,savedSummary};
})(typeof window==='undefined'?globalThis:window);

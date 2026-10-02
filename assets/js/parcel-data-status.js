(function(){
  'use strict';
  const labels={present:'자료 있음',missing:'자료 없음',unknown:'확인 불가'};
  function hasManagedData(row){
    const d=row?.data||{};
    // Automatic addresses and owner/transaction records do not establish supply data.
    if(['area','supplyPrice'].some(k=>Number.isFinite(Number(d[k]))&&Number(d[k])>0))return true;
    return ['area','supplyPriceWon'].some(k=>Number.isFinite(Number(row?.source?.[k]))&&Number(row.source[k])>0);
  }
  function state(row,info={}){
    if(hasManagedData(row))return 'present';
    if(!info.recordsLoaded||info.sourcesLoaded===false)return 'unknown';
    return 'missing';
  }
  window.HitopParcelDataStatus={labels,hasManagedData,state};
})();

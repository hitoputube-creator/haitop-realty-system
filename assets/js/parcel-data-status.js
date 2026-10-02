(function(){
  'use strict';
  const labels={present:'자료 있음',missing:'자료 없음',unknown:'확인 불가'};
  function hasManagedData(row){
    const d=row?.data||{};
    // Basic parcel information includes original source data, independently of owner/contact records.
    if(typeof d.address==='string' && d.address.trim() && !['미기재','원본 미기재','미확인'].includes(d.address.trim()))return true;
    if(['area','supplyPrice','auctionPrice','salePrice'].some(k=>Number.isFinite(Number(d[k]))&&Number(d[k])>0))return true;
    return ['area','supplyPriceWon','unitPriceWon'].some(k=>Number.isFinite(Number(row?.source?.[k]))&&Number(row.source[k])>0);
  }
  function state(row,info={}){
    if(hasManagedData(row))return 'present';
    if(!info.recordsLoaded||info.sourcesLoaded===false)return 'unknown';
    return 'missing';
  }
  window.HitopParcelDataStatus={labels,hasManagedData,state};
})();

(function(){
  'use strict';
  const labels={present:'자료 있음',missing:'자료 없음',unknown:'확인 불가'};
  function hasManagedData(row){
    const d=row?.data||{};
    if(d.managementSavedAt)return true;
    if(['owner','contact','note'].some(k=>typeof d[k]==='string'&&d[k].trim()))return true;
    if(['salePrice','auctionPrice','buildingDeposit','buildingRent'].some(k=>d[k]!=null&&d[k]!==''&&Number(d[k])>0))return true;
    // Legacy rows created before automated updates were manually registered.
    return Boolean(row?.id&&!d.buildingCheck&&!d.buildingCheckAttempt&&!d.ownershipCheck&&!d.ownershipCheckAttempt&&!d.buildingSnapshot&&!d.ownershipSnapshot);
  }
  function state(row,info){
    if(hasManagedData(row)||info.hasNotes)return 'present';
    if(!info.recordsLoaded||(!info.notesLoaded&&!info.notesKnown))return 'unknown';
    return 'missing';
  }
  window.HitopParcelDataStatus={labels,hasManagedData,state};
})();

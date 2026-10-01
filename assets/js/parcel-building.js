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
  root.HitopParcelBuilding={fromRegister};
})(typeof window==='undefined'?globalThis:window);

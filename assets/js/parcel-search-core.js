(function(){
  'use strict';
  function normalize(value){return String(value??'').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[\s,\-‐‑–—()]/g,'');}
  function key(row){return [row.block_id,row.subblock,row.parcel].map(v=>String(v??'')).join('/');}
  function label(row,block){return [block?.name||row.block_id,row.subblock,row.parcel].filter(v=>v!==''&&v!=null).join('-');}
  function values(value){
    if(value==null)return [];
    if(Array.isArray(value))return value.flatMap(values);
    if(typeof value==='object')return Object.values(value).flatMap(values);
    return [String(value)];
  }
  function matches(row,block,query,noteText=''){
    const terms=String(query||'').trim().split(/\s+/).map(normalize).filter(Boolean);if(!terms.length)return true;
    const d=row.data||{};
    const fields=[label(row,block),block?.district,block?.name,row.block_id,row.subblock,row.parcel,...values(d),...values(row.source),noteText];
    const types={single:'주거전용 단독택지 단독주택',shop:'상가점포 점포택지',unknown:'미확인',building:'건물있음',vacant:'건물없음',person:'개인 개인소유',corporation:'법인 법인소유',other:'기타'};
    [d.landType,d.building,d.ownershipCheck?.category].forEach(v=>{if(types[v])fields.push(types[v]);});
    // Stored price inputs use 만원; also match the displayed 원 amounts and comma-separated values.
    ['supplyPrice','auctionPrice','salePrice','buildingDeposit','buildingRent'].forEach(k=>{if(Number(d[k])>0)fields.push(String(Math.round(Number(d[k])*10000)));});
    ['area','buildingFootprint','buildingTotalArea'].forEach(k=>{if(Number(d[k])>0){const p=Number(d[k])/3.305785;fields.push(Number(d[k])+'㎡',p.toFixed(1)+'평',p.toFixed(2)+'평');}});
    if((d.unsold!=null?d.unsold:row.source?.unsold)===true&&!(Number(d.area)>0&&Number(d.supplyPrice)>0))fields.push('미분양 공급전');
    const haystack=fields.map(normalize).join(' ');return terms.every(term=>haystack.includes(term));
  }
  function merge(saved,sources){
    const result=new Map();
    sources.forEach(row=>result.set(key(row),{...row,data:{...row.data}}));
    saved.forEach(row=>{const base=result.get(key(row));result.set(key(row),{...base,...row,data:{...base?.data,...row.data}});});
    return [...result.values()];
  }
  window.HitopParcelSearch={normalize,key,label,matches,merge};
})();

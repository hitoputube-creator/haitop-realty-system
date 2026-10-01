(function(){
  'use strict';
  function normalize(value){return String(value??'').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[\s\-‐‑–—()]/g,'');}
  function key(row){return [row.block_id,row.subblock,row.parcel].map(v=>String(v??'')).join('/');}
  function label(row,block){return [block?.name||row.block_id,row.subblock,row.parcel].filter(v=>v!==''&&v!=null).join('-');}
  function matches(row,block,query,noteText=''){
    const terms=String(query||'').trim().split(/\s+/).map(normalize).filter(Boolean);if(!terms.length)return true;
    const d=row.data||{};
    const fields=[label(row,block),block?.district,block?.name,row.block_id,row.subblock,row.parcel,d.address,d.owner,d.contact,d.note,d.area,d.salePrice,d.auctionPrice,d.buildingName,d.buildingPurpose,row.source?.status,noteText];
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

(function(root){
 'use strict';
 const number=v=>{if(v===null||v===undefined||String(v).trim()==='')return null;const s=String(v).replace(/,/g,'').trim();return /^\d+(\.\d+)?$/.test(s)?Number(s):null;};
 const positive=(...vs)=>vs.map(number).find(v=>v!==null&&v>0)??null;
 const first=(...vs)=>vs.map(number).find(v=>v!==null)??null;
 const commercial=item=>item?.category1==='상가사무실'||['shop','office','bizcenter'].includes(item?.type);
 function status(item,unit=false){const explicit=unit?item.분양상태:item.presaleStatus;if(['분양중','분양완료'].includes(explicit))return explicit;return positive(unit?item.현_매매가격:item.salePrice,unit?item.매매가격:null)!==null?'분양완료':positive(unit?item.분양금액:item.presalePrice)!==null?'분양중':'분양완료';}
 // 상가 구분: 직접 고른 값(shopKind)이 우선, 없으면 분양 자료가 있는지로 추정한다.
 function shopKind(item){const k=item&&item.shopKind;if(k==='기존상가'||k==='분양상가')return k;if(!item)return '기존상가';const snap=item.import_unit_snapshot;const hasSnap=!!snap&&typeof snap==='object'&&Object.keys(snap).length>0;const hasPresale=positive(item.presalePrice,item.originalDeposit,item.originalMonthlyRent)!==null;return (hasSnap||hasPresale||item.presaleStatus==='분양중')?'분양상가':'기존상가';}
 function price(item,unit=false){const phase=status(item,unit),original=positive(unit?item.분양금액:item.presalePrice),sale=positive(unit?item.현_매매가격:item.salePrice,unit?item.매매가격:null);return {status:phase,amount:phase==='분양중'?original:sale,label:phase==='분양중'?'분양':'매매',original,sale};}
 function economics(item,unit=false){const p=price(item,unit),deposit=unit?first(item.현_보증금,item.보증금):number(item.deposit),rent=unit?first(item.현_월세,item.월차임):number(item.monthlyRent);return {...p,deposit,rent,annual:rent===null?null:rent*12,yield:p.amount!==null&&deposit!==null&&rent!==null&&p.amount>deposit?rent*12/(p.amount-deposit)*100:null};}
 function recommendation(item){const tags=item.stickers||[];return commercial(item)&&tags.includes('추천매물')&&tags.includes('수익형');}
 root.CommercialPriceCore={number,positive,first,commercial,status,shopKind,price,economics,recommendation};
})(typeof window==='undefined'?globalThis:window);

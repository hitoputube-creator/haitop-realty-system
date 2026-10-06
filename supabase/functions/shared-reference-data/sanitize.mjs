export const tables = ['drive_resource_categories','drive_resources','buildings','building_floors','building_files','land_parcels','land_block_sources'];
const memoKeys = new Set(['주소','지번주소','행정구역','주차대수','사용승인일','구조','토지면적','건축면적','연면적','동수','세대수','주택종류','분양구분','규모','자료기준일','자료출처','블럭','대상 블럭','필지·번지','건물 유무','면적(㎡/평)','공급금액','택지구분','분양면적(공급면적)','1층전체 전용면적','2~8층전체 전용면적']);
const unitKeys = ['층','호수','분양_m2','분양_평','전용_m2','전용_평','전용률','주용도','층고'];
const parcelKeys = ['address','area','landType','building','households','supplyPrice','buildingName','buildingPurpose','buildingFloors','buildingStructure','buildingApproval','buildingFootprint','buildingTotalArea','mapPositionUnavailable'];
function scalar(value) { return typeof value === 'number' || typeof value === 'boolean' || value === null || (typeof value === 'string' && !/@|(?:01[016789][ -]?\d{3,4}[ -]?\d{4})|소유주\s*[:：]|연락처\s*[:：]/.test(value)); }
function pick(row, keys) { return Object.fromEntries(keys.filter(k => Object.hasOwn(row || {},k) && scalar(row[k])).map(k => [k,row[k]])); }
function position(value, depth=0) { if(depth>6)return null; if(typeof value==='number')return Number.isFinite(value)?value:null; if(Array.isArray(value))return value.map(v=>position(v,depth+1)); if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>/^[\w.-]+$/.test(k)&&!['__proto__','constructor','prototype'].includes(k)).map(([k,v])=>[k,position(v,depth+1)]));return null; }
export function safeMemo(raw) { return String(raw||'').split('---추가메모---')[0].split('\n').flatMap(line=>{const i=line.indexOf(':');const key=line.slice(0,i).trim(), value=line.slice(i+1).trim();return i>=0&&memoKeys.has(key)&&scalar(value)?[key+': '+value]:[];}).join('\n'); }
function safeSvg(raw) { const value=String(raw||''); if(!value.startsWith('<svg') && !value.startsWith('<?xml'))return ''; if(/<\s*(?:script|foreignObject|iframe)|\bon\w+\s*=|javascript:|01[016789][ -]?\d{3,4}[ -]?\d{4}|소유주|연락처/i.test(value))return ''; return value.replace(/(?:xlink:)?href\s*=\s*(["'])(?!#|data:image\/)[\s\S]*?\1/gi,''); }
export function sanitize(table, row) {
 let out;
 switch(table) {
 case 'drive_resource_categories': out=pick(row,['id','name','room','sort_order','created_at']);break;
 case 'drive_resources': out={...pick(row,['id','category','name','created_at']),url:'',memo:safeMemo(row.memo)};break;
 case 'buildings': out={...pick(row,['id','local_id','name','created_at','updated_at']),units:(Array.isArray(row.units)?row.units:[]).map(u=>({...pick(u,unitKeys),...(u.plan_positions?{plan_positions:position(u.plan_positions)}:{})}))};break;
 case 'building_floors':out=pick(row,['id','building_id','floor_number','file_name','cloudinary_url','created_at','sort_order','supply_area_m2','exclusive_area_m2','source_pdf_url']);break;
 case 'building_files': if(!/평면도|배치도|동호수|구획도|단지안내도/.test(row.file_name||''))return null;out=pick(row,['id','building_id','file_name','cloudinary_url','drive_link','created_at']);break;
 case 'land_parcels':out={...pick(row,['id','block_id','subblock','parcel','x','y','created_at','updated_at']),data:pick(row.data,parcelKeys)};break;
 case 'land_block_sources':out={...pick(row,['block_id','updated_at']),diagram_svg:safeSvg(row.diagram_svg),source_data:{...pick(row.source_data,['width','height','sourceTitle','sourceDate','diagramRevision']),subblocks:(row.source_data?.subblocks||[]).map(g=>pick(g,['number','x','y'])),parcels:(row.source_data?.parcels||[]).map(p=>({...pick(p,['subblock','parcel','serial','sourceCell','sourcePage','x','y']),data:pick(p.data,parcelKeys),source:pick(p.source,['coverage','floorRatio','floors','households','supplyPriceWon','unitPriceWon','unsold','originalIdentifier','date','status'])}))}};break;
 default:throw new Error('Unsupported table');
 }
 return {...out,_shared_reference:true};
}

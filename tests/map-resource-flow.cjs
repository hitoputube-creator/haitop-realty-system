const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'assets/js/resources.js'),'utf8'),html=fs.readFileSync(path.join(root,'residential-resources.html'),'utf8');
(async()=>{
for(const office of ['hitop','ktop']){
 const nodes=new Map(),get=id=>{assert.ok(html.includes('id="'+id+'"'),id+' must exist on the registration page');if(!nodes.has(id))nodes.set(id,{value:'',style:{},addEventListener(type,fn){this[type]=fn;}});return nodes.get(id);};
 const params=new URLSearchParams({office,fromMap:'1',apartmentName:'운정아이파크포레스트아파트 (2028년12월예정)',jibunAddress:'경기 파주시 동패동 1529',mapLat:'37.71',mapLng:'126.74'});
 let rows=[],saved=[],c=vm.createContext({URL,URLSearchParams,crypto:require('node:crypto').webcrypto,location:{search:'?'+params,href:''},document:{getElementById:get},driveResourceScope:'residential',MEMO_TEMPLATE:'주소: \n주차대수: ',OfficeConfig:{urlFor:url=>{const u=new URL(url,'https://example.com/');u.searchParams.set('office',office);return u.href;}},HitopResourceRooms:{isResidential:r=>r.category==='아파트',detailUrl:(page,id,scope)=>page+'?'+new URLSearchParams({id,resourceScope:scope})},ensureCategoryInRoom:async()=>{},getDriveResources:async()=>rows,addDriveResource:async r=>saved.push(r),joinMemo:(a,b)=>a+(b?'\n---추가메모---\n'+b:''),showToast(){},loadDriveResources:async()=>{}});
 vm.runInContext(source.slice(source.indexOf('function prefillMapComplex()'),source.indexOf('prefillMapComplex();')),c);vm.runInContext('prefillMapComplex()',c);
 assert.equal(get('drive_name').value,'운정아이파크포레스트아파트 (2028년12월예정)');assert.equal(get('drive_movein_reg').value,'2028-12');assert.ok(get('drive_memo_basic_reg').value.includes('지도위도: 37.71'));
 const start=source.indexOf('document.getElementById("driveSaveBtn").addEventListener'),end=source.indexOf('\n});',start)+4;vm.runInContext(source.slice(start,end),c);
 await get('driveSaveBtn').click();assert.equal(saved.length,1);assert.ok(saved[0].id);assert.ok(saved[0].memo.includes('입주예정월: 2028-12'));assert.ok(c.location.href.includes('building-overview.html'));assert.ok(c.location.href.includes('office='+office));assert.ok(c.location.href.includes('edit=1'));
 rows=[saved[0]];get('drive_after_save').value='plans';await get('driveSaveBtn').click();assert.equal(saved.length,1,'Existing complex must be reused instead of creating a duplicate');assert.ok(c.location.href.includes('building-detail.html'));assert.ok(c.location.href.includes(saved[0].id));
}
console.log('Map-selected new complex save, overview/edit and plans routing, duplicate reuse, and both offices passed');
})().catch(e=>{console.error(e);process.exitCode=1;});

const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const {File}=require('node:buffer'),root=path.resolve(__dirname,'..');
(async()=>{
const source=fs.readFileSync(path.join(root,'supabase/functions/upload-building-material/index.ts'),'utf8');
let handler,mode='ok',writes=0;
const id='a072dff4-cdca-4382-b863-0b5504a3c2df';
const c=vm.createContext({Response,Request,File,FormData,AbortSignal,crypto:require('node:crypto').webcrypto,console,Deno:{env:{get:key=>({SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'anon-test',SUPABASE_SERVICE_ROLE_KEY:'server-only-test'})[key]},serve:fn=>handler=fn},fetch:async(url,options)=>{
 if(url.endsWith('/auth/v1/user'))return Response.json(mode==='unauthorized'?{}:{email:'staff@example.test',email_confirmed_at:'2026-01-01'},{status:mode==='unauthorized'?401:200});
 if(url.includes('/office_members?'))return Response.json(mode==='nonmember'?[]:[{email:'staff@example.test',active:true}]);
 if(url.includes('/drive_resources?'))return Response.json(mode==='missing'?[]:[{id}]);
 if(url.includes('/storage/v1/object/')){writes++;assert.equal(options.headers.Authorization,'Bearer server-only-test');assert.ok(url.includes('/building-materials/'+id+'/floors/'));return Response.json({Key:'test'});}
 throw Error(url);
}});vm.runInContext(source,c);
function request(type='image/jpeg',size=3){const body=new FormData();body.set('file',new File([new Uint8Array(size)],'84A.jpeg',{type}));body.set('buildingId',id);body.set('kind','floors');return new Request('https://test/upload',{method:'POST',headers:{Authorization:'Bearer test-user'},body});}
assert.equal((await handler(new Request('https://test/upload',{method:'OPTIONS'}))).status,204);
for(const [m,status] of [['unauthorized',401],['nonmember',403],['missing',403]]){mode=m;assert.equal((await handler(request())).status,status);}
assert.equal(writes,0);mode='ok';assert.equal((await handler(request('text/html'))).status,400);assert.equal((await handler(request('image/jpeg',20*1024*1024+1))).status,413);
const response=await handler(request());assert.equal(response.status,200);const data=await response.json();assert.ok(data.url.includes('/object/authenticated/'));assert.ok(!JSON.stringify(data).includes('server-only-test'));assert.equal(writes,1);
// Temporary view URLs are refreshed on every read; persistent database references stay unchanged.
const storage=fs.readFileSync(path.join(root,'assets/js/storage.js'),'utf8');let signerCalls=0;
Object.assign(c,{OfficeConfig:{id:'ktop'},SUPABASE_URL:'https://test.supabase.co',hitopAuthClient:{storage:{from:bucket=>{assert.equal(bucket,'building-materials');return {createSignedUrls:async paths=>{signerCalls++;return {data:paths.map(path=>({path,signedUrl:'https://test/view?token='+signerCalls}))};}};}}}});
vm.runInContext(storage.slice(storage.indexOf('async function resolveBuildingMaterialUrls'),storage.indexOf('async function getBuildingFloors')),c);
c.rows=[{id:'doc',cloudinary_url:data.url},{id:'old',cloudinary_url:'https://cloudinary.example/old.jpg'}];
const view1=await vm.runInContext('resolveBuildingMaterialUrls(rows)',c),view2=await vm.runInContext('resolveBuildingMaterialUrls(rows)',c);assert.notEqual(view1[0].cloudinary_url,view2[0].cloudinary_url);assert.equal(c.rows[0].cloudinary_url,data.url);assert.equal(view1[1].cloudinary_url,'https://cloudinary.example/old.jpg');
c.OfficeConfig.id='hitop';await vm.runInContext('resolveBuildingMaterialUrls(rows)',c);assert.equal(signerCalls,2);
if(process.env.MATERIAL_LIVE==='1'){
 const url='https://enefadyhmhfphtochlku.supabase.co/functions/v1/upload-building-material';
 const preflight=await fetch(url,{method:'OPTIONS',headers:{Origin:'https://hitoputube-creator.github.io','Access-Control-Request-Method':'POST'},signal:AbortSignal.timeout(15000)});
 assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'https://hitoputube-creator.github.io');
 const anonymous=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});assert.equal(anonymous.status,401);
 console.log('Live KTOP endpoint CORS and anonymous-request rejection passed');
}
console.log('Upload authorization, private storage references, type/size checks, and signed-view reopening passed');
})().catch(e=>{console.error(e);process.exitCode=1;});

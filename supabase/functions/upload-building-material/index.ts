// KTOP building documents. Authentication and resource access are checked before
// the server-only service key is used to write to Storage. No credentials returned.
const cors = {'Access-Control-Allow-Origin':'https://hitoputube-creator.github.io','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Vary':'Origin'};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','application/pdf':'pdf'};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply({error:'POST 요청만 지원합니다.'},405);
 try{
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url || !key || !service)return reply({error:'업로드 서버 설정이 필요합니다.'},500);
  const authHeaders={apikey:key,Authorization:req.headers.get('Authorization') || ''};
  const auth=await fetch(url+'/auth/v1/user',{headers:authHeaders,signal:AbortSignal.timeout(10000)});
  if(!auth.ok)return reply({error:'로그인 후 다시 업로드해주세요.'},401);
  const user=await auth.json();
  if(!user.email || !user.email_confirmed_at)return reply({error:'인증된 계정이 필요합니다.'},403);
  const email=user.email.toLowerCase();
  const memberResponse=await fetch(url+'/rest/v1/office_members?email=eq.'+encodeURIComponent(email)+'&active=eq.true&select=email,active',{headers:authHeaders,signal:AbortSignal.timeout(10000)});
  if(!memberResponse.ok || !(await memberResponse.json()).some(m=>m.email===email && m.active===true))return reply({error:'사무실 업로드 권한이 없습니다.'},403);
  if(Number(req.headers.get('content-length'))>21*1024*1024)return reply({error:'파일은 20MB 이하로 올려주세요.'},413);
  let form;try{form=await req.formData();}catch{return reply({error:'파일 요청이 올바르지 않습니다.'},400);}
  const file=form.get('file'),buildingId=form.get('buildingId'),kind=form.get('kind');
  if(typeof buildingId!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(buildingId))return reply({error:'단지를 먼저 저장해주세요.'},400);
  if(!['floors','files'].includes(kind))return reply({error:'지원하지 않는 자료 구분입니다.'},400);
  if(!(file instanceof File) || !file.size)return reply({error:'파일을 선택해주세요.'},400);
  if(file.size>20*1024*1024)return reply({error:'파일은 20MB 이하로 올려주세요.'},413);
  const ext=types[file.type];
  if(!ext)return reply({error:'JPG·PNG·WEBP·GIF 이미지 또는 PDF를 선택해주세요.'},400);
  const resourceResponse=await fetch(url+'/rest/v1/drive_resources?id=eq.'+buildingId+'&select=id',{headers:authHeaders,signal:AbortSignal.timeout(10000)});
  if(!resourceResponse.ok || !(await resourceResponse.json()).some(r=>r.id===buildingId))return reply({error:'저장된 단지 자료를 찾을 수 없습니다.'},403);
  const path=buildingId+'/'+kind+'/'+crypto.randomUUID()+'.'+ext;
  const stored=await fetch(url+'/storage/v1/object/building-materials/'+path,{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':file.type,'x-upsert':'false','cache-control':'3600'},body:file,signal:AbortSignal.timeout(60000)});
  if(!stored.ok){console.error('Building material storage upload failed',stored.status);return reply({error:'파일 저장에 실패했습니다. 잠시 후 다시 올려주세요.'},502);}
  return reply({url:url+'/storage/v1/object/authenticated/building-materials/'+path});
 }catch(error){console.error('Building material upload failed',error instanceof Error?error.name:'Error');return reply({error:'업로드 서버 연결에 실패했습니다. 잠시 후 다시 올려주세요.'},502);}
});

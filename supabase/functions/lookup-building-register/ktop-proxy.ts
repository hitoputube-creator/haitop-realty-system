const cors = {'Access-Control-Allow-Origin':'https://hitoputube-creator.github.io','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Vary':'Origin'};
const source = 'https://xaxbkdnrzsghsabkdvzj.supabase.co';
const sourceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhheGJrZG5yenNnaHNhYmtkdnpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNjc5NTIsImV4cCI6MjA4OTY0Mzk1Mn0.l27ZYQHLt48p7EQrZ8gbAOmJHvCfIur84CtgoWlA8Wg';
const reply = (data, status=200) => new Response(JSON.stringify(data), {status,headers:cors});
Deno.serve(async req => {
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply({error:'POST 요청만 지원합니다.'},405);
 try {
  const token=req.headers.get('Authorization')||'';
  const authHeaders={apikey:Deno.env.get('SUPABASE_ANON_KEY')||'',Authorization:token};
  const url=Deno.env.get('SUPABASE_URL');
  const auth=await fetch(url+'/auth/v1/user',{headers:authHeaders,signal:AbortSignal.timeout(10000)});
  if(!auth.ok)return reply({error:'로그인 후 다시 조회해주세요.'},401);
  const user=await auth.json();
  if(!user.email||!user.email_confirmed_at)return reply({error:'인증된 계정이 필요합니다.'},403);
  const membership=await fetch(url+'/rest/v1/office_members?email=eq.'+encodeURIComponent(user.email.toLowerCase())+'&active=eq.true&select=email,active',{headers:authHeaders,signal:AbortSignal.timeout(10000)});
  if(!membership.ok)return reply({error:'사무실 접근 권한이 없습니다.'},403);
  const members=await membership.json();
  if(!members.some(m=>m.email===user.email.toLowerCase()&&m.active===true))return reply({error:'사무실 접근 권한이 없습니다.'},403);
  let body;
  try{body=await req.json();}catch{return reply({error:'올바른 조회 요청이 아닙니다.'},400);}
  if(typeof body?.address!=='string'||!body.address.trim()||body.address.length>500)return reply({error:'조회할 지번주소를 입력해주세요.'},400);
  const upstream=await fetch(source+'/functions/v1/lookup-building-register',{method:'POST',headers:{apikey:sourceKey,Authorization:'Bearer '+sourceKey,'Content-Type':'application/json'},body:JSON.stringify({address:body.address.trim(),hoNm:typeof body.hoNm==='string'?body.hoNm.slice(0,50):'',dongNm:typeof body.dongNm==='string'?body.dongNm.slice(0,50):'',apartment:body.apartment===true,scope:body.scope==='complex'?'complex':'',buildingName:typeof body.buildingName==='string'?body.buildingName.slice(0,200):''}),signal:AbortSignal.timeout(95000)});
  const data=await upstream.json();
  return reply(data,upstream.status);
 }catch(error){console.error('Building register proxy failed',error instanceof Error?error.name:'Error');return reply({error:'건축물대장 조회 서버가 응답하지 않습니다. 잠시 후 다시 조회해주세요.'},502);}
});


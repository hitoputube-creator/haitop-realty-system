// Only ownership category and source dates are returned; names/IDs are never collected.
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const vworldKey=Deno.env.get('VWORLD_API_KEY')||Deno.env.get('VWORLD_KEY');
const dongKey=Deno.env.get('LEGAL_DONG_CODE_API_KEY');
const configured=Boolean(vworldKey&&dongKey);
const dongCache=new Map<string,string>();
async function readJson(url:string,init:RequestInit={}){
  const response=await fetch(url,{...init,signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('공공데이터 연결 실패');
  try{return await response.json();}catch{throw Error('공공데이터 응답 형식을 확인하지 못했습니다.');}
}
export function parseAddress(address:string){
  const m=address.trim().match(/^(.*?)([가-힣]+(?:동|리))\s+(산\s*)?(\d{1,4})(?:-(\d{1,4}))?\s*(?:번지)?$/);
  if(!m||Number(m[4])<1)return null;
  const prefix=m[1].trim();
  if(prefix&&!/[가-힣]/.test(prefix))return null;
  return {query:prefix?prefix+' '+m[2]:'파주시 '+m[2],dong:m[2],mountain:!!m[3],bun:m[4],ji:m[5]||'0'};
}
async function pnuForAddress(address:string){
  const a=parseAddress(address);if(!a)throw Error('동/리와 지번이 포함된 주소를 입력해주세요.');
  let code=dongCache.get(a.query);
  if(!code){
    let key=dongKey!;try{key=decodeURIComponent(key);}catch{}
    const u=new URL('https://apis.data.go.kr/1741000/StanReginCd/getStanReginCdList');
    u.search=new URLSearchParams({serviceKey:key,type:'json',pageNo:'1',numOfRows:'100',locatadd_nm:a.query}).toString();
    const data=await readJson(u.toString());
    const list=data?.StanReginCd?.[1]?.row;
    if(!Array.isArray(list))throw Error('법정동코드 조회를 확인하지 못했습니다.');
    const matches=list.filter((r:Record<string,unknown>)=>typeof r.locatadd_nm==='string'&&(r.locatadd_nm as string).endsWith(' '+a.dong)&&a.query.split(/\s+/).every(token=>(r.locatadd_nm as string).split(/\s+/).includes(token))&&/^\d{10}$/.test(String(r.region_cd)));
    const codes=[...new Set(matches.map((r:Record<string,unknown>)=>String(r.region_cd)))];
    if(codes.length!==1)throw Error('주소의 법정동을 정확히 구분하지 못했습니다. 시/읍/면을 포함해 입력해주세요.');
    code=codes[0] as string;if(dongCache.size>100)dongCache.clear();dongCache.set(a.query,code);
  }
  return code+(a.mountain?'2':'1')+a.bun.padStart(4,'0')+a.ji.padStart(4,'0');
}
export function normalize(fields:Record<string,unknown>[],pnu:string){
  if(fields.some(f=>String(f.pnu)!==pnu))throw Error('조회된 필지번호가 요청 주소와 다릅니다.');
  const names=[...new Set(fields.map(f=>String(f.posesnSeCodeNm||'').trim()).filter(Boolean))];
  // Never infer LH or settlement from a corporation code.
  const category=names.length===1&&names[0]==='개인'?'person':names.length===1&&names[0]==='법인'?'corporation':names.length?'other':'unknown';
  const dates=[...new Set(fields.map(f=>String(f.lastUpdtDt||'').trim()).filter(v=>/^\d{4}-\d{2}-\d{2}$/.test(v)))].sort();
  return {category,rawLabel:names.join(' / '),source:'국토교통부 / 브이월드 토지임야정보',sourceDate:dates.length===1?dates[0]:dates.length?dates[0]+' ~ '+dates.at(-1):null,pnu};
}
Deno.serve(async(req:Request)=>{
  // No credentials or user data are exposed in the configuration response.
  if(req.method==='OPTIONS')return json({configured});
  if(req.method!=='POST')return json({error:'POST 요청만 지원합니다.'},405);
  const auth=req.headers.get('Authorization')||'';
  if(!/^Bearer\s+\S+$/.test(auth))return json({error:'로그인이 필요합니다.'},401);
  const base=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
  try{
    const user=await fetch(base+'/auth/v1/user',{headers:{Authorization:auth,apikey:anon},signal:AbortSignal.timeout(10000)});
    if(!user.ok)return json({error:'로그인 상태를 확인해주세요.'},401);
    const admin=await fetch(base+'/rest/v1/rpc/is_admin',{method:'POST',headers:{Authorization:auth,apikey:anon,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});
    if(!admin.ok||await admin.json()!==true)return json({error:'자료 조회 권한이 없습니다.'},403);
  }catch{return json({error:'로그인 권한을 확인하지 못했습니다.'},401);}
  let body;try{body=await req.json();}catch{return json({error:'요청 내용을 확인해주세요.'},400);}
  if(body?.probe===true)return json({configured});
  if(!configured)return json({code:'NOT_CONFIGURED',error:'브이월드 소유 구분 조회 인증키 연결이 필요합니다. 기존 저장 자료는 유지됩니다.'},503);
  if(typeof body?.address!=='string'||body.address.length>200||!parseAddress(body.address))return json({error:'동/리와 지번이 포함된 주소를 입력해주세요.'},400);
  try{
    const pnu=await pnuForAddress(body.address);
    const u=new URL('https://api.vworld.kr/ned/data/ladfrlList');
    u.search=new URLSearchParams({key:vworldKey!,domain:Deno.env.get('VWORLD_DOMAIN')||'https://hitoputube-creator.github.io',pnu,format:'json',numOfRows:'100',pageNo:'1'}).toString();
    const data=await readJson(u.toString());
    if(data?.response?.status==='ERROR'||data?.error){
      const code=String(data?.response?.error?.code||data?.error?.code||'');
      return json({code:/KEY|AUTH|DOMAIN/i.test(code)?'UPSTREAM_AUTH':'UPSTREAM_ERROR',error:'소유 구분 조회 서비스 오류입니다. 인증키와 서비스 이용 설정을 확인해주세요.'},502);
    }
    const fields=data?.fields;
    if(!fields||!Object.hasOwn(fields,'totalCount'))throw Error('소유 구분 응답을 확인하지 못했습니다.');
    const total=Number(fields.totalCount);
    if(!Number.isFinite(total)||total<0||total>100)throw Error('소유 구분 자료가 여러 건입니다. 추가 확인이 필요합니다.');
    const raw=fields.ladfrlVOList;
    const list=Array.isArray(raw)?raw:raw&&typeof raw==='object'?[raw]:[];
    if(total>list.length)throw Error('소유 구분 자료 일부가 누락되었습니다.');
    return json(normalize(list,pnu));
  }catch(error){return json({error:error instanceof Error?error.message:'소유 구분을 조회하지 못했습니다.'},502);}
});

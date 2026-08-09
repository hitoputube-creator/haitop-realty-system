// cloudinary-sign-upload
//
// 브라우저는 Cloudinary API Secret을 절대 갖지 않는다. 업로드 직전에 이 함수를
// 호출해 timestamp/signature/apiKey/cloudName만 받아, 그 값으로 지금과 동일하게
// Cloudinary 업로드 API를 직접 호출한다. CLOUDINARY_API_SECRET은 이 함수 실행
// 환경(Deno.env.get())에만 존재하며 응답에는 절대 포함하지 않는다.
//
// 인증 3단계:
//   1) verify_jwt = true (플랫폼 게이트 — Authorization에 유효한 로그인 JWT 없으면
//      이 코드 자체가 실행되지 않음)
//   2) createSupabaseContext(req, { auth: 'user' }) — 호출자가 실제 로그인
//      세션인지 함수 코드 안에서 다시 명시적으로 확인
//   3) ctx.supabase.rpc('is_admin') — public.admin_users 기반 기존 관리자 판별
//      함수를 그대로 재사용. "로그인됨"과 "관리자임"은 다른 것이므로, 로그인만
//      확인하고 넘어가지 않는다. (이 프로젝트 auth.users에는 admin_users에
//      없는 계정도 실제로 존재함 — 로그인 여부만으로는 관리자를 가릴 수 없다.)

import { createSupabaseContext } from 'npm:@supabase/server'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ALLOWED_FOLDERS = new Set(['haitop/floors', 'haitop/files', 'haitop/recommend'])

const CLOUDINARY_CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME')
const CLOUDINARY_API_KEY = Deno.env.get('CLOUDINARY_API_KEY')
const CLOUDINARY_API_SECRET = Deno.env.get('CLOUDINARY_API_SECRET')

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

async function sha1Hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'POST 요청만 지원합니다.' }, 405)
  }
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    console.error('[cloudinary-sign-upload] CLOUDINARY_* Secrets가 설정되지 않았습니다.')
    return jsonResponse({ error: '서버 설정 오류입니다. 관리자에게 문의하세요.' }, 500)
  }

  // 1) verify_jwt(플랫폼)를 통과했더라도 2) 함수 코드에서 다시 로그인 세션을 확인한다.
  const { data: ctx, error: authError } = await createSupabaseContext(req, { auth: 'user' })
  if (authError || !ctx) {
    return jsonResponse({ error: '로그인이 필요합니다.' }, 401)
  }

  // 3) 관리자 여부 확인 — public.admin_users를 보는 기존 is_admin()을 그대로 재사용.
  //    "로그인됨"만으로는 부족하다 — 이 프로젝트에는 admin_users에 없는 로그인
  //    가능 계정이 실제로 존재한다.
  const { data: isAdmin, error: adminCheckError } = await ctx.supabase.rpc('is_admin')
  if (adminCheckError) {
    console.error('[cloudinary-sign-upload] is_admin() 호출 실패:', adminCheckError.message)
    return jsonResponse({ error: '권한 확인 중 오류가 발생했습니다.' }, 500)
  }
  if (!isAdmin) {
    return jsonResponse({ error: '관리자 권한이 없습니다.' }, 403)
  }

  let body: { folder?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: '요청 본문이 유효한 JSON이 아닙니다.' }, 400)
  }

  const folder = (body.folder || '').trim()
  if (!ALLOWED_FOLDERS.has(folder)) {
    return jsonResponse({ error: `허용되지 않은 folder입니다: "${folder}"` }, 400)
  }

  const timestamp = Math.round(Date.now() / 1000)
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`
  const signature = await sha1Hex(paramsToSign)

  return jsonResponse({
    signature,
    timestamp,
    apiKey: CLOUDINARY_API_KEY,
    cloudName: CLOUDINARY_CLOUD_NAME,
  })
})

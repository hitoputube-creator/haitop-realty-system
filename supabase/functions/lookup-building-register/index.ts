// lookup-building-register
//
// 주소(+선택적으로 호수/동)를 받아 법정동코드를 검색(StanReginCd)한 뒤
// 국토교통부 건축HUB 건축물대장정보 서비스(BldRgstHubService)를 조회한다.
// - 표제부(getBrTitleInfo): 건물 전체 정보 — 주용도/구조/사용승인일, (호수 미지정 시) 연면적
// - 전유부 면적(getBrExposPubuseAreaInfo, hoNm 지정 시): 해당 호실의 실제 전유면적
//   집합건물(오피스텔/상가 등)은 표제부의 연면적이 건물 "전체" 면적이라 호실별
//   면적과 다르므로, hoNm이 주어지면 전유부 면적 조회 결과를 우선 사용한다.
//   전유부 조회에 실패하거나 일치하는 호실을 못 찾으면 표제부 값으로 대체하고
//   detail_note에 경고를 남긴다.
// BUILDING_REGISTER_API_KEY는 이 함수 안에서만 사용하며 프론트엔드에는 절대
// 노출하지 않는다.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUILDING_REGISTER_API_KEY_RAW = Deno.env.get("BUILDING_REGISTER_API_KEY");
const LEGAL_DONG_CODE_API_KEY_RAW = Deno.env.get("LEGAL_DONG_CODE_API_KEY");

// data.go.kr 마이페이지는 서비스키를 Encoding(이미 %인코딩됨)과 Decoding(원본,
// +  /  = 등 특수문자 포함) 두 버전으로 제공한다. 어느 버전이 시크릿에 등록되어
// 있어도 URL 쿼리스트링에 안전하게 들어가도록, 이미 인코딩된 값이면 그대로 쓰고
// 아니면 encodeURIComponent로 인코딩한다.
function normalizeServiceKey(key: string | undefined): string | undefined {
  if (!key) return key;
  return key.includes("%") ? key : encodeURIComponent(key);
}

const BUILDING_REGISTER_API_KEY = normalizeServiceKey(BUILDING_REGISTER_API_KEY_RAW);
const LEGAL_DONG_CODE_API_KEY = normalizeServiceKey(LEGAL_DONG_CODE_API_KEY_RAW);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

interface ParsedAddress {
  sigunguName: string;
  dongName: string;
  platGbCd: "0" | "1";
  bun: string;
  ji: string;
}

interface Codes {
  sigunguCd: string;
  bjdongCd: string;
}

// 자유 텍스트 주소를 최대한 파싱한다 — 실패하면 null.
// 회사가 파주시 관내에서만 영업하므로 시/군/구가 없으면 "파주시"를 기본값으로 둔다.
function parseAddress(address: string): ParsedAddress | null {
  const sigunguMatch = address.match(/([가-힣]+시|[가-힣]+군|[가-힣]+구)/);
  const sigunguName = sigunguMatch ? sigunguMatch[1] : "파주시";

  // 법정동 이름은 항상 번지 앞(콤마 이전)에 온다. "와동동 1471-2, 103동 4802호"처럼
  // 콤마 뒤에 건물 동/호수가 오면 "103동"도 "숫자+동" 패턴에 걸려 법정동으로
  // 착각할 수 있어, 콤마 이전 구간에서만 법정동을 찾는다.
  const commaIdx = address.indexOf(",");
  const dongSearchArea = commaIdx === -1 ? address : address.slice(0, commaIdx);
  const dongMatches = [...dongSearchArea.matchAll(/[가-힣0-9]+(?:읍|면|동|리)/g)];
  if (dongMatches.length === 0) return null;
  const dongName = dongMatches[dongMatches.length - 1][0];

  const afterDong = address.slice(address.lastIndexOf(dongName) + dongName.length);
  const isMountain = /^\s*산/.test(afterDong);
  const lotMatch = afterDong.match(/(\d+)(?:-(\d+))?/);
  if (!lotMatch) return null;

  return {
    sigunguName,
    dongName,
    platGbCd: isMountain ? "1" : "0",
    bun: lotMatch[1],
    ji: lotMatch[2] || "0",
  };
}

// data.go.kr 게이트웨이가 가끔 일시적으로 500을 던진다(실측 확인 — 연속 2번
// 실패한 사례도 있어 최대 2회까지 재시도한다). 5xx일 때만 짧은 대기 후
// 재시도한다. 4xx는 재시도해도 소용없으므로 바로 반환한다.
async function fetchWithRetry(url: string, init?: RequestInit, retries = 2, delayMs = 400): Promise<Response> {
  let res = await fetch(url, init);
  for (let attempt = 0; attempt < retries && res.status >= 500; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    res = await fetch(url, init);
  }
  return res;
}

// 법정동코드 검색 (행정표준코드관리시스템, StanReginCd) → 5자리 시군구코드 + 5자리 법정동코드
async function lookupDongCode(sigunguName: string, dongName: string): Promise<Codes | null> {
  if (!LEGAL_DONG_CODE_API_KEY) {
    throw new Error("LEGAL_DONG_CODE_API_KEY가 설정되지 않았습니다.");
  }
  const url = `https://apis.data.go.kr/1741000/StanReginCd/getStanReginCdList` +
    `?serviceKey=${LEGAL_DONG_CODE_API_KEY}` +
    `&type=json&pageNo=1&numOfRows=20` +
    `&locatadd_nm=${encodeURIComponent(`${sigunguName} ${dongName}`)}`;

  const res = await fetchWithRetry(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; hitop-realty-system/1.0)" },
  });
  if (!res.ok) {
    throw new Error(`법정동코드 검색 실패 (${res.status})`);
  }
  const data = await res.json();

  const rows = data?.StanReginCd?.[1]?.row ?? [];
  const match = rows.find((r: Record<string, unknown>) =>
    typeof r.locatadd_nm === "string" && r.locatadd_nm.includes(dongName) && !r.locatadd_nm.includes("산")
  ) ?? rows[0];
  if (!match?.region_cd) return null;

  const code = String(match.region_cd);
  return { sigunguCd: code.slice(0, 5), bjdongCd: code.slice(5, 10) };
}

function bldRgstHubUrl(op: string, codes: Codes, parsed: ParsedAddress): string {
  return `https://apis.data.go.kr/1613000/BldRgstHubService/${op}` +
    `?ServiceKey=${BUILDING_REGISTER_API_KEY}` +
    `&_type=json` +
    `&sigunguCd=${codes.sigunguCd}` +
    `&bjdongCd=${codes.bjdongCd}` +
    `&platGbCd=${parsed.platGbCd}` +
    `&bun=${parsed.bun.padStart(4, "0")}` +
    `&ji=${parsed.ji.padStart(4, "0")}`;
}

// 건축HUB 건축물대장정보 서비스 — 표제부(연면적/주용도/층수/구조/사용승인일)
async function lookupTitleInfo(codes: Codes, parsed: ParsedAddress) {
  const url = `${bldRgstHubUrl("getBrTitleInfo", codes, parsed)}&numOfRows=5`;

  const res = await fetchWithRetry(url);
  const rawText = await res.text();

  if (!res.ok) {
    console.error(`[lookup-building-register] getBrTitleInfo HTTP ${res.status} ${res.statusText}`);
    throw new Error(`건축물대장 조회 실패 (${res.status} ${res.statusText})`);
  }

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch (parseErr) {
    console.error(`[lookup-building-register] getBrTitleInfo 응답이 JSON이 아님: ${String(parseErr)}`);
    throw new Error("건축물대장 응답 파싱 실패 (JSON 형식이 아닙니다)");
  }

  const header = data?.response?.header;
  if (header && header.resultCode && header.resultCode !== "00") {
    console.error(`[lookup-building-register] getBrTitleInfo resultCode=${header.resultCode} resultMsg=${header.resultMsg}`);
    throw new Error(`건축물대장 조회 실패: resultCode=${header.resultCode} resultMsg=${header.resultMsg || "(메시지 없음)"}`);
  }

  const items = data?.response?.body?.items?.item;
  const item = Array.isArray(items) ? items[0] : items;
  return { raw: data, item: item ?? null };
}

// 건축HUB 건축물대장정보 서비스 — 전유공용면적(getBrExposPubuseAreaInfo)
// 집합건물의 특정 호실("전유" 구분) 실제 전유면적을 찾는다.
//
// [중요] hoNm을 요청 쿼리파라미터로 함께 보내면 국토부 서버가 실제로 필터링해준다
// (실측: 21,618건 → 60건). 클라이언트에서 전체를 페이지네이션하며 스캔하는 방식은
// 대단지(수만 건)에서는 스캔 한도를 넘어가 못 찾는 경우가 있어 폐기하고, 서버
// 필터링을 사용한다. dongNm은 등록 표기 형식이 제각각("103동"/"103" 등)일 수 있어
// 서버 파라미터로 넘기지 않고, hoNm으로 좁힌 소수의 결과 안에서 숫자만 비교해
// 클라이언트에서 매칭한다. 같은 호수가 여러 동에 걸쳐 있는데 동을 특정할 수 없으면
// (동 정보 없음 + 후보 2개 이상) 안전하게 null을 반환해 표제부 값으로 대체시킨다.
async function lookupExclusiveArea(
  codes: Codes,
  parsed: ParsedAddress,
  hoNm: string,
  dongDigits: string
): Promise<number | null> {
  const MAX_PAGES = 3; // hoNm 서버 필터링 덕분에 보통 1페이지로 충분 — 안전 마진만 확보
  const base = `${bldRgstHubUrl("getBrExposPubuseAreaInfo", codes, parsed)}&hoNm=${encodeURIComponent(hoNm)}`;

  const candidates: any[] = [];
  for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo++) {
    const url = `${base}&numOfRows=100&pageNo=${pageNo}`;
    const res = await fetchWithRetry(url);
    if (!res.ok) {
      console.error(`[lookup-building-register] getBrExposPubuseAreaInfo HTTP ${res.status}`);
      break;
    }
    const rawText = await res.text();
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error(`[lookup-building-register] getBrExposPubuseAreaInfo 응답이 JSON이 아님`);
      break;
    }

    const header = data?.response?.header;
    if (header && header.resultCode && header.resultCode !== "00") {
      console.error(`[lookup-building-register] getBrExposPubuseAreaInfo resultCode=${header.resultCode} resultMsg=${header.resultMsg}`);
      break;
    }

    const items = data?.response?.body?.items?.item;
    const arr: any[] = Array.isArray(items) ? items : items ? [items] : [];
    arr.forEach((it) => {
      if (String(it.exposPubuseGbCd) === "1" && String(it.hoNm || "").trim() === hoNm) {
        candidates.push(it);
      }
    });

    const totalCount = Number(data?.response?.body?.totalCount || 0);
    if (arr.length === 0 || pageNo * 100 >= totalCount) break;
  }

  if (candidates.length === 0) return null;

  let picked: any = null;
  if (dongDigits) {
    picked = candidates.find((it) => String(it.dongNm || "").replace(/[^0-9]/g, "") === dongDigits) || null;
  } else if (candidates.length === 1) {
    picked = candidates[0];
  } else {
    // 동 정보 없이 같은 호수가 여러 동에 걸쳐 있음 — 어느 동인지 특정 불가
    console.error(`[lookup-building-register] hoNm=${hoNm} 후보 ${candidates.length}건(동 특정 불가)`);
    return null;
  }
  if (!picked) return null;

  const area = Number(picked.area);
  return Number.isFinite(area) && area > 0 ? area : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "POST 요청만 지원합니다." }, 405);
  }
  if (!BUILDING_REGISTER_API_KEY) {
    return jsonResponse({ error: "BUILDING_REGISTER_API_KEY가 설정되지 않았습니다." }, 500);
  }

  let body: { address?: string; hoNm?: string; dongNm?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "요청 본문이 유효한 JSON이 아닙니다." }, 400);
  }

  const address = (body.address || "").trim();
  const hoNm = (body.hoNm || "").trim();
  const dongNm = (body.dongNm || "").trim();
  if (!address) {
    return jsonResponse({ error: "조회할 주소(address)가 없습니다." }, 400);
  }

  const parsed = parseAddress(address);
  if (!parsed) {
    return jsonResponse({ error: `주소("${address}")에서 지번을 인식하지 못했습니다. 동/리와 번지를 포함해 입력해주세요.` }, 400);
  }

  let raw: unknown;
  let item: Record<string, unknown> | null;
  let codes: Codes | null;
  try {
    codes = await lookupDongCode(parsed.sigunguName, parsed.dongName);
    if (!codes) throw new Error(`"${parsed.sigunguName} ${parsed.dongName}"에 대한 법정동코드를 찾지 못했습니다.`);
    const result = await lookupTitleInfo(codes, parsed);
    raw = result.raw;
    item = result.item;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[lookup-building-register] ${message}`);
    return jsonResponse({ error: message }, 502);
  }

  if (!item) {
    return jsonResponse({ error: "해당 주소의 건축물대장 정보를 찾을 수 없습니다." }, 404);
  }

  const totArea = Number(item.totArea);
  const buildingAreaM2 = Number.isFinite(totArea) && totArea > 0 ? totArea : null;

  let areaM2 = buildingAreaM2;
  let unitAreaWarning = false;

  if (hoNm) {
    try {
      const dongDigits = dongNm.replace(/[^0-9]/g, "");
      const exclusiveArea = await lookupExclusiveArea(codes, parsed, hoNm, dongDigits);
      if (exclusiveArea != null) {
        areaM2 = exclusiveArea;
      } else {
        unitAreaWarning = true;
      }
    } catch (e) {
      console.error(`[lookup-building-register] 전유부 조회 실패: ${e instanceof Error ? e.message : String(e)}`);
      unitAreaWarning = true;
    }
  }

  const grndFlrCnt = item.grndFlrCnt ? String(item.grndFlrCnt) : null;
  const ugrndFlrCnt = item.ugrndFlrCnt ? String(item.ugrndFlrCnt) : null;
  const floorInfo = grndFlrCnt
    ? (ugrndFlrCnt && ugrndFlrCnt !== "0" ? `지상 ${grndFlrCnt}층/지하 ${ugrndFlrCnt}층` : `지상 ${grndFlrCnt}층`)
    : null;

  const detailParts = [
    item.mainPurpsCdNm ? `주용도: ${item.mainPurpsCdNm}` : null,
    floorInfo ? `층수: ${floorInfo}` : null,
    item.strctCdNm ? `구조: ${item.strctCdNm}` : null,
    item.useAprDay ? `사용승인일: ${item.useAprDay}` : null,
  ].filter(Boolean);
  if (unitAreaWarning) {
    detailParts.push("⚠️ 건물 전체 면적입니다 — 호실별 면적은 직접 확인 필요");
  }

  return jsonResponse({
    area_m2: areaM2,
    floor_info: floorInfo,
    main_purpose: item.mainPurpsCdNm || null,
    structure: item.strctCdNm || null,
    use_apr_day: item.useAprDay || null,
    detail_note: detailParts.length ? `[건축물대장 조회 결과]\n${detailParts.join("\n")}` : null,
    unit_area_warning: unitAreaWarning,
    raw,
  });
});

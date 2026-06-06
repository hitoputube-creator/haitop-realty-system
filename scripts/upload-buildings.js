/**
 * upload-buildings.js
 *
 * 엑셀(건물별 소유주명단.xlsx)을 읽어 Supabase buildings 테이블에
 * 건물별 호실 데이터를 한 번에 업로드합니다.
 *
 * ▶ 실행 방법 (scripts 폴더 안에서)
 *   node upload-buildings.js "D:/작업화일/.../파일명.xlsx"
 *
 * ▶ 패키지 설치 (최초 1회)
 *   npm install
 *
 * ▶ 특징
 *   - 시트마다 다른 헤더 컬럼명을 자동 정규화하여 동일하게 파싱
 *   - 시트명 → 앱 건물명 매핑 적용
 */

"use strict";

// ── Supabase ─────────────────────────────────────
const SUPABASE_URL = "https://xaxbkdnrzsghsabkdvzj.supabase.co";
const SUPABASE_KEY = "sb_publishable_gqNFRMHb6yYKvqFnQurPKQ_7gGhURVd";

// ── 시트명 → 앱 건물명 매핑 ──────────────────────
const NAME_MAP = {
  "아름터":         "아름터타워",    // 시트명 → drive_resources.name
  "아름터타워":     "아름터타워",    // A열 건물명
  "현해":           "현해프라자",
  "트윈1":          "트윈타워 1차",
  "트윈2":          "트윈타워 2차",
  "홍원":           "홍원빌딩",
  "유은9차":        "유은 9차",
  "레이크필드":     "레이크필드위버젠",
  "엠버":           "엠버418",
};

// ── 컬럼명 정규화 규칙 ────────────────────────────
// 정규화 키: 원본 셀 값에서 공백·괄호·특수문자 제거 후 소문자
// 값: 저장할 표준 필드명
const COL_NORM = {
  // 호수
  "호수":           "호수",
  "호실":           "호수",

  // 전용(평)
  "전용평":         "전용_평",
  "전용":           "전용_평",

  // 분양(평) — 오타/이형 포함
  "분양평":         "분양_평",
  "분영평":         "분양_평",   // 오타
  "뷴양평":         "분양_평",   // 오타
  "공유평":         "분양_평",   // 남광 시트

  // 평당가
  "평당가":         "평당가",
  "평단가":         "평당가",
  "평당금액":       "평당가",   // 유은9차: "평당 금액"

  // 분양금액
  "분양금액":       "분양금액",
  "분양가격":       "분양금액",
  "분양가":         "분양금액",
  "공급가액":       "분양금액",

  // 보증금 / 월차임
  "보증금":         "보증금",
  "월차임":         "월차임",

  // 업종 / 공실
  "현업종":         "현업종",
  "업종":           "현업종",
  "공실여부":       "공실여부",

  // 현재 시세
  "현매매가격":     "현_매매가격",
  "현보증금":       "현_보증금",
  "현월세":         "현_월세",

  // 소유주 / 연락처 (소유주1, 연락처1 등 변형 포함)
  "소유주":         "소유주",
  "소유주1":        "소유주",
  "연락처":         "연락처",
  "연락처1":        "연락처",

  // 기타
  "비고":           "비고",
  "추천매물":       "추천매물",
  "수익률":         "수익률",
};

// ── 정규화 키 생성 ────────────────────────────────
// 공백, 괄호, 특수문자 제거 → 소문자
function normKey(raw) {
  return String(raw ?? "")
    .replace(/[\s\(\)\[\]（）\.,·]/g, "")
    .toLowerCase();
}

// ── 헤더 행 탐지 ─────────────────────────────────
// "호수" / "호실" 키워드가 포함된 행을 헤더로 판별
function findHeaderRow(rows) {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    for (const cell of r) {
      const k = normKey(cell);
      if (k === "호수" || k === "호실") return i;
    }
  }
  return -1;
}

// ── 헤더 → 표준 필드 인덱스 맵 생성 ─────────────
function buildColMap(headerRow) {
  const map = {};   // 표준 필드명 → 열 인덱스
  headerRow.forEach((cell, idx) => {
    const std = COL_NORM[normKey(cell)];
    if (std && !(std in map)) map[std] = idx;  // 첫 번째 매칭만 사용
  });
  return map;
}

// ── 유틸 ─────────────────────────────────────────
function toNum(val) {
  if (val === "" || val == null) return 0;
  const s = String(val).trim();
  if (s.startsWith("=")) return 0;   // 수식 문자열 그대로 읽혔을 때 무시
  const n = Number(s.replace(/,/g, ""));
  return isFinite(n) ? n : 0;
}
function isPositiveNum(val) {
  if (val === "" || val == null) return false;
  const n = Number(String(val).trim());
  return isFinite(n) && n > 0;
}
function col(row, map, field) {
  const idx = map[field];
  return idx !== undefined ? row[idx] : undefined;
}

// ── 메인 ─────────────────────────────────────────
async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('\n❌ 엑셀 파일 경로를 인자로 넘겨주세요.');
    console.error('   예: node upload-buildings.js "D:/작업화일/.../파일명.xlsx"\n');
    process.exit(1);
  }

  let XLSX;
  try { XLSX = require("xlsx"); }
  catch {
    console.error("\n❌ xlsx 패키지가 없습니다. npm install 을 먼저 실행하세요.\n");
    process.exit(1);
  }

  const fetchFn = globalThis.fetch;
  if (!fetchFn) {
    console.error("\n❌ Node.js 18 이상이 필요합니다.\n");
    process.exit(1);
  }

  console.log(`\n📂 엑셀 파일 읽는 중...\n   ${filePath}\n`);

  let workbook;
  // cellFormula:false → 수식 문자열 대신 엑셀이 캐시한 계산값을 읽음
  // (유은9차 평당가 등 ROUNDDOWN 수식 셀 대응)
  try { workbook = XLSX.readFile(filePath, { cellDates: true, cellFormula: false }); }
  catch (e) { console.error("❌ 파일을 열 수 없습니다:", e.message); process.exit(1); }

  const sheetNames = workbook.SheetNames;
  console.log(`✅ 시트 ${sheetNames.length}개 발견`);
  console.log(`   ${sheetNames.join(" | ")}\n`);
  console.log("─".repeat(60));

  const reqHeaders = {
    "Content-Type":  "application/json",
    "apikey":        SUPABASE_KEY,
    "Authorization": "Bearer " + SUPABASE_KEY,
    "Prefer":        "resolution=merge-duplicates,return=minimal",
  };

  let totalBuildings = 0;
  let totalUnits     = 0;
  const errors       = [];

  for (const sheetName of sheetNames) {
    const sheet   = workbook.Sheets[sheetName];
    const rows    = XLSX.utils.sheet_to_json(sheet, {
      header: 1, defval: "", blankrows: false,
    });

    // ── appName 결정 ──
    // 1순위: 시트명 → NAME_MAP
    // 2순위: 열A 첫 데이터값(건물명) → NAME_MAP  (아름터 시트처럼 시트명≠건물명 케이스)
    // 3순위: 시트명 그대로
    let appName = NAME_MAP[sheetName.trim()];
    if (!appName) {
      const colAData = rows.find(r => {
        const v = String(r[0] || "").trim();
        return v && v !== "건물명";   // 헤더행 제외
      });
      const colAName = colAData ? String(colAData[0]).trim() : "";
      appName = NAME_MAP[colAName] || sheetName.trim();
    }

    // ── 헤더 행 탐지 ──
    const hdrIdx = findHeaderRow(rows);
    if (hdrIdx < 0) {
      console.log(`⚠️  [${sheetName}] 헤더 행 없음 → 건너뜀`);
      continue;
    }

    // ── 컬럼 매핑 구성 ──
    const colMap = buildColMap(rows[hdrIdx]);

    if (!("호수" in colMap)) {
      console.log(`⚠️  [${sheetName}] '호수' 컬럼 없음 → 건너뜀`);
      continue;
    }

    // ── 데이터 행 파싱 (헤더 다음 행부터) ──
    const units = [];
    for (let i = hdrIdx + 1; i < rows.length; i++) {
      const row  = rows[i];
      const room = row[colMap["호수"]];

      // 호수가 숫자형이 아니면 합계행·구분행·빈 행 → 건너뜀
      if (typeof room !== "number" && !isPositiveNum(room)) continue;

      // 공실여부 결정
      const vacantRaw = String(col(row, colMap, "공실여부") ?? "").trim();
      const hasBiz    = String(col(row, colMap, "현업종")   ?? "").trim() !== "";
      const 공실여부  = vacantRaw ? "공실" : (hasBiz ? "임차중" : "공실");

      const 수익률raw = String(col(row, colMap, "수익률") ?? "").trim().replace(/%$/, "");

      units.push({
        호수:        String(room).trim(),
        공실여부,
        현업종:      String(col(row, colMap, "현업종")      ?? "").trim() || null,
        소유주:      String(col(row, colMap, "소유주")      ?? "").trim() || null,
        연락처:      String(col(row, colMap, "연락처")      ?? "").trim() || null,
        보증금:      toNum(col(row, colMap, "보증금"))      || null,
        월차임:      toNum(col(row, colMap, "월차임"))      || null,
        현_매매가격: toNum(col(row, colMap, "현_매매가격")) || null,
        현_보증금:   toNum(col(row, colMap, "현_보증금"))   || null,
        현_월세:     toNum(col(row, colMap, "현_월세"))     || null,
        수익률:      수익률raw || null,
        비고:        String(col(row, colMap, "비고")        ?? "").trim() || null,
        전용_평:     toNum(col(row, colMap, "전용_평"))     || null,
        분양_평:     toNum(col(row, colMap, "분양_평"))     || null,
        평당가:      toNum(col(row, colMap, "평당가"))      || null,
        분양금액:    toNum(col(row, colMap, "분양금액"))    || null,
        updated_at:  new Date().toISOString(),
      });
    }

    if (!units.length) {
      console.log(`⚠️  [${sheetName}] 유효한 호실 없음 → 건너뜀`);
      continue;
    }

    // ── Supabase upsert ──
    try {
      const res = await fetchFn(`${SUPABASE_URL}/rest/v1/buildings?on_conflict=local_id`, {
        method:  "POST",
        headers: reqHeaders,
        body:    JSON.stringify({ local_id: appName, name: appName, units }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} → ${await res.text()}`);

      const mapped = appName !== sheetName.trim() ? ` → [${appName}]` : "";
      // 컬럼 매핑 요약 (개발용)
      const mappedCols = Object.keys(colMap).join(", ");
      console.log(`✅ [${sheetName}]${mapped}  ${units.length}개 호실  (인식 컬럼: ${mappedCols})`);
      totalBuildings++;
      totalUnits += units.length;
    } catch (e) {
      console.error(`❌ [${sheetName}] 저장 실패: ${e.message}`);
      errors.push({ sheetName, error: e.message });
    }
  }

  // ── 결과 요약 ──
  console.log("\n" + "═".repeat(60));
  console.log("📊 업로드 결과 요약");
  console.log("═".repeat(60));
  console.log(`  총 시트 수    : ${sheetNames.length} 개`);
  console.log(`  저장 완료     : ${totalBuildings} 개 건물  /  ${totalUnits} 개 호실`);
  if (errors.length) {
    console.log(`  저장 실패     : ${errors.length} 개`);
    errors.forEach(e => console.log(`    ✗ [${e.sheetName}] ${e.error}`));
  } else {
    console.log(`  오류          : 없음 ✨`);
  }
  console.log("═".repeat(60) + "\n");
}

main().catch(e => {
  console.error("\n❌ 예상치 못한 오류:", e.message);
  process.exit(1);
});

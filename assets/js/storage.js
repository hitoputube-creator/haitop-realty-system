/* storage.js - 하이탑부동산 매물관리 Supabase 연동 모듈 */

const SUPABASE_URL = "https://xaxbkdnrzsghsabkdvzj.supabase.co";
const SUPABASE_KEY = "sb_publishable_gqNFRMHb6yYKvqFnQurPKQ_7gGhURVd";

const headers = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": "Bearer " + SUPABASE_KEY
};

/* 전체 매물 가져오기 */
async function getListings() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/listings?order=created_at.desc`, { headers });
  if (!res.ok) throw new Error("매물 목록 조회 실패");
  const rows = await res.json();
  return rows.map(r => ({ id: r.id, type: r.type, title: r.title, address: r.address, status: r.status, description: r.description, created_at: r.created_at, ...r.data }));
}

/* 매물 1개 가져오기 */
async function getListingById(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${encodeURIComponent(id)}`, { headers });
  if (!res.ok) throw new Error("매물 조회 실패");
  const rows = await res.json();
  if (!rows.length) return null;
  const r = rows[0];
  return { id: r.id, type: r.type, title: r.title, address: r.address, status: r.status, description: r.description, created_at: r.created_at, ...r.data };
}

/* 매물 추가 */
async function addListing(item) {
  const { id, type, title, address, status, description, ...rest } = item;
  const body = JSON.stringify({ id, type, title, address, status, description, data: rest });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/listings`, {
    method: "POST",
    headers: { ...headers, "Prefer": "return=minimal" },
    body
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error("저장 실패: " + err);
  }
}

/* 매물 상태 변경 */
async function updateListingStatus(id, status) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...headers, "Prefer": "return=minimal" },
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error("상태 변경 실패");
}

/* 매물 수정 */
async function updateListing(item) {
  const { id, type, title, address, status, description, created_at, ...rest } = item;
  const body = JSON.stringify({ type, title, address, status, description, data: rest });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...headers, "Prefer": "return=minimal" },
    body
  });
  if (!res.ok) throw new Error("수정 실패");
}

/* 매물 삭제 */
async function deleteListing(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers
  });
  if (!res.ok) throw new Error("삭제 실패");
}

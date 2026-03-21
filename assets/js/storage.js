const SUPABASE_URL = "https://xaxbkdnrzsghsabkdvzj.supabase.co";
const SUPABASE_KEY = "sb_publishable_gqNFRMHb6yYKvqFnQurPKQ_7gGhURVd";
const headers = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": "Bearer " + SUPABASE_KEY
};
async function getListings() {
  const res = await fetch(SUPABASE_URL + "/rest/v1/listings?order=created_at.desc", { headers });
  if (!res.ok) throw new Error("목록 조회 실패");
  const rows = await res.json();
  return rows.map(r => Object.assign({ id:r.id, type:r.type, title:r.title, address:r.address, status:r.status, description:r.description, created_at:r.created_at }, r.data));
}
async function getListingById(id) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/listings?id=eq." + encodeURIComponent(id), { headers });
  if (!res.ok) throw new Error("조회 실패");
  const rows = await res.json();
  if (!rows.length) return null;
  const r = rows[0];
  return Object.assign({ id:r.id, type:r.type, title:r.title, address:r.address, status:r.status, description:r.description, created_at:r.created_at }, r.data);
}
async function addListing(item) {
  const data = Object.assign({}, item);
  const id = data.id; const type = data.type; const title = data.title;
  const address = data.address; const status = data.status; const description = data.description;
  delete data.id; delete data.type; delete data.title;
  delete data.address; delete data.status; delete data.description;
  const res = await fetch(SUPABASE_URL + "/rest/v1/listings", {
    method: "POST",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify({ id:id, type:type, title:title, address:address, status:status, description:description, data:data })
  });
  if (!res.ok) throw new Error("저장 실패: " + await res.text());
}
async function updateListingStatus(id, status) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/listings?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify({ status: status })
  });
  if (!res.ok) throw new Error("상태 변경 실패");
}
async function deleteListing(id) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/listings?id=eq." + encodeURIComponent(id), {
    method: "DELETE",
    headers: headers
  });
  if (!res.ok) throw new Error("삭제 실패");
}

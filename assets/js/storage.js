const SUPABASE_URL = "https://xaxbkdnrzsghsabkdvzj.supabase.co";
const SUPABASE_KEY = "sb_publishable_gqNFRMHb6yYKvqFnQurPKQ_7gGhURVd";
const headers = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": "Bearer " + SUPABASE_KEY
};

async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetchWithTimeout(url, { ...options, signal: controller.signal });
    return res;
  } catch(e) {
    if (e.name === "AbortError") throw new Error("서버 응답 시간 초과 (10초). 인터넷 연결을 확인해주세요.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
async function getListings() {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/listings?order=created_at.desc", { headers });
  if (!res.ok) throw new Error("목록 조회 실패");
  const rows = await res.json();
  return rows.map(r => Object.assign({ id:r.id, type:r.type, title:r.title, address:r.address, status:r.status, description:r.description, resource_id:r.resource_id||null, created_at:r.created_at }, r.data));
}
async function getListingById(id) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/listings?id=eq." + encodeURIComponent(id), { headers });
  if (!res.ok) throw new Error("조회 실패");
  const rows = await res.json();
  if (!rows.length) return null;
  const r = rows[0];
  return Object.assign({ id:r.id, type:r.type, title:r.title, address:r.address, status:r.status, description:r.description, resource_id:r.resource_id||null, created_at:r.created_at }, r.data);
}
async function addListing(item) {
  const data = Object.assign({}, item);
  const id = data.id; const type = data.type; const title = data.title;
  const address = data.address; const status = data.status; const description = data.description;
  const resource_id = data.resource_id || null;
  delete data.id; delete data.type; delete data.title;
  delete data.address; delete data.status; delete data.description; delete data.resource_id;
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/listings", {
    method: "POST",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify({ id:id, type:type, title:title, address:address, status:status, description:description, resource_id:resource_id, data:data })
  });
  if (!res.ok) throw new Error("저장 실패: " + await res.text());
}
async function updateListingStatus(id, status) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/listings?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify({ status: status })
  });
  if (!res.ok) throw new Error("상태 변경 실패");
}
async function markListingDone(id) {
  const res1 = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/listings?id=eq." + encodeURIComponent(id), { headers });
  if (!res1.ok) throw new Error("조회 실패");
  const rows = await res1.json();
  if (!rows.length) throw new Error("매물을 찾을 수 없습니다");
  const r = rows[0];
  const data = Object.assign({}, r.data, { completed_at: new Date().toISOString() });
  const res2 = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/listings?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify({ status: "거래완료", data })
  });
  if (!res2.ok) throw new Error("거래완료 처리 실패: " + await res2.text());
}
async function deleteListing(id) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/listings?id=eq." + encodeURIComponent(id), {
    method: "DELETE",
    headers: headers
  });
  if (!res.ok) throw new Error("삭제 실패");
}
async function updateListing(id, item) {
  const data = Object.assign({}, item);
  delete data.id; delete data.created_at;
  const type = data.type; const title = data.title;
  const address = data.address; const status = data.status; const description = data.description;
  const resource_id = data.resource_id !== undefined ? (data.resource_id || null) : undefined;
  delete data.type; delete data.title; delete data.address; delete data.status; delete data.description; delete data.resource_id;
  const patch = { type, title, address, status, description, data };
  if (resource_id !== undefined) patch.resource_id = resource_id;
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/listings?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(patch)
  });
  if (!res.ok) throw new Error("수정 실패: " + await res.text());
}
async function updateListingResourceId(id, resource_id) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/listings?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify({ resource_id: resource_id || null })
  });
  if (!res.ok) throw new Error("자료연결 수정 실패: " + await res.text());
}

// ===== 추천매물장 관리 =====
async function getRecommendedProperties() {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/recommended_properties?order=received_date.desc,created_at.desc", { headers });
  if (!res.ok) throw new Error("추천매물장 목록 조회 실패");
  return await res.json();
}
async function addRecommendedProperty(item) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/recommended_properties", {
    method: "POST",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(item)
  });
  if (!res.ok) throw new Error("추천매물장 저장 실패: " + await res.text());
}
async function updateRecommendedProperty(id, item) {
  const body = Object.assign({}, item);
  delete body.id; delete body.created_at;
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/recommended_properties?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error("추천매물장 수정 실패: " + await res.text());
}
async function deleteRecommendedProperty(id) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/recommended_properties?id=eq." + encodeURIComponent(id), {
    method: "DELETE",
    headers: headers
  });
  if (!res.ok) throw new Error("추천매물장 삭제 실패");
}

// ===== 자료보기 관리 =====
async function getDriveResources() {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/drive_resources?order=created_at.asc", { headers });
  if (!res.ok) throw new Error("자료 목록 조회 실패");
  return await res.json();
}
async function addDriveResource(item) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/drive_resources", {
    method: "POST",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(item)
  });
  if (!res.ok) throw new Error("자료 저장 실패: " + await res.text());
}
async function updateDriveResource(id, item) {
  const body = Object.assign({}, item);
  delete body.id; delete body.created_at;
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/drive_resources?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error("자료 수정 실패: " + await res.text());
}
async function deleteDriveResource(id) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/drive_resources?id=eq." + encodeURIComponent(id), {
    method: "DELETE",
    headers: headers
  });
  if (!res.ok) throw new Error("자료 삭제 실패");
}

// ===== 참고매물 관리 =====
async function getReferenceProperties() {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/reference_properties?order=created_at.desc", { headers });
  if (!res.ok) throw new Error("참고매물 목록 조회 실패");
  return await res.json();
}
async function addReferenceProperty(item) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/reference_properties", {
    method: "POST",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(item)
  });
  if (!res.ok) throw new Error("참고매물 저장 실패: " + await res.text());
}
async function updateReferenceProperty(id, item) {
  const body = Object.assign({}, item);
  delete body.id; delete body.created_at;
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/reference_properties?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error("참고매물 수정 실패: " + await res.text());
}
async function deleteReferenceProperty(id) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/reference_properties?id=eq." + encodeURIComponent(id), {
    method: "DELETE",
    headers: headers
  });
  if (!res.ok) throw new Error("참고매물 삭제 실패");
}

// ===== 의뢰 관리 =====
async function getRequests() {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/requests?order=created_at.desc", { headers });
  if (!res.ok) throw new Error("의뢰 목록 조회 실패");
  return await res.json();
}
async function addRequest(request) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/requests", {
    method: "POST",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(request)
  });
  if (!res.ok) throw new Error("의뢰 저장 실패: " + await res.text());
}
async function deleteRequest(id) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/requests?id=eq." + encodeURIComponent(id), {
    method: "DELETE",
    headers: headers
  });
  if (!res.ok) throw new Error("의뢰 삭제 실패");
}
async function updateRequestStatus(id, status) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/requests?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error("의뢰 상태 변경 실패");
}
async function updateRequest(id, data) {
  const body = Object.assign({}, data);
  delete body.id; delete body.created_at;
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/requests?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error("의뢰 수정 실패: " + await res.text());
}

// ===== 메모장 관리 =====
async function getMemos() {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/memos?order=created_at.desc", { headers });
  if (!res.ok) throw new Error("메모 목록 조회 실패");
  return await res.json();
}
async function addMemo(item) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/memos", {
    method: "POST",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(item)
  });
  if (!res.ok) throw new Error("메모 저장 실패: " + await res.text());
}
async function updateMemo(id, item) {
  const body = Object.assign({}, item);
  delete body.id; delete body.created_at;
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/memos?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error("메모 수정 실패: " + await res.text());
}
async function deleteMemo(id) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/memos?id=eq." + encodeURIComponent(id), {
    method: "DELETE",
    headers: headers
  });
  if (!res.ok) throw new Error("메모 삭제 실패");
}

// ===== 고객 관리 =====
async function getCustomers() {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/customers?order=created_at.desc", { headers });
  if (!res.ok) throw new Error("고객 목록 조회 실패");
  return await res.json();
}
async function addCustomer(customer) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/customers", {
    method: "POST",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(customer)
  });
  if (!res.ok) throw new Error("고객 저장 실패: " + await res.text());
}
async function deleteCustomer(id) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/customers?id=eq." + encodeURIComponent(id), {
    method: "DELETE",
    headers: headers
  });
  if (!res.ok) throw new Error("고객 삭제 실패");
}
async function updateCustomerStatus(id, status) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/customers?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error("고객 상태 변경 실패");
}
async function updateCustomer(id, data) {
  const body = Object.assign({}, data);
  delete body.id; delete body.created_at;
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/customers?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error("고객 수정 실패: " + await res.text());
}

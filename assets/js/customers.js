// assets/js/customers.js
(function(){
  "use strict";

  const $ = (id)=>document.getElementById(id);
  const KEY = "customers";

  const elToast = $("toast");
  const elList = $("list");
  const elEmpty = $("empty");
  const elQ = $("q");

  const elDetailEmpty = $("detailEmpty");
  const elDetail = $("detail");
  const elHead = $("dHead");
  const elNotes = $("notes");
  const elNotesEmpty = $("notesEmpty");

  let currentId = "";

  $("goHome").onclick = ()=>location.href="home.html";
  $("goList").onclick = ()=>location.href="index.html";

  $("btnAddCustomer").onclick = addCustomer;
  $("btnAddNote").onclick = addNote;
  $("btnDeleteCustomer").onclick = deleteCustomer;

  elQ.addEventListener("input", render);

  $("nDate").value = today();

  render();

  function toast(msg){
    elToast.textContent = msg;
    elToast.classList.add("show");
    clearTimeout(window.__t);
    window.__t = setTimeout(()=>elToast.classList.remove("show"), 1500);
  }

  function getArr(){ return StorageUtil.getArray(KEY); }
  function setArr(a){ StorageUtil.setArray(KEY, a); }

  function addCustomer(){
    const name = ($("cName").value||"").trim();
    if(!name) return toast("이름을 입력해주세요.");

    const record = {
      id: StorageUtil.uid("c"),
      name,
      phone: ($("cPhone").value||"").trim(),
      role: $("cRole").value,
      tag: ($("cTag").value||"").trim(),
      memo: ($("cMemo").value||"").trim(),
      notes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const arr = getArr();
    arr.unshift(record);
    setArr(arr);

    $("cName").value = "";
    $("cPhone").value = "";
    $("cTag").value = "";
    $("cMemo").value = "";

    toast("저장 완료");
    render();
  }

  function select(id){
    currentId = id;
    render();
  }

  function addNote(){
    if(!currentId) return;
    const d = $("nDate").value || today();
    const t = ($("nText").value||"").trim();
    if(!t) return toast("메모를 입력해주세요.");

    const arr = getArr();
    const idx = arr.findIndex(x=>x.id===currentId);
    if(idx<0) return;

    arr[idx].notes = Array.isArray(arr[idx].notes) ? arr[idx].notes : [];
    arr[idx].notes.unshift({ id: StorageUtil.uid("n"), date:d, text:t });
    arr[idx].updatedAt = new Date().toISOString();
    setArr(arr);

    $("nText").value = "";
    toast("추가 완료");
    render();
  }

  function deleteNote(noteId){
    const arr = getArr();
    const idx = arr.findIndex(x=>x.id===currentId);
    if(idx<0) return;
    arr[idx].notes = (arr[idx].notes||[]).filter(n=>n.id!==noteId);
    arr[idx].updatedAt = new Date().toISOString();
    setArr(arr);
    toast("삭제 완료");
    render();
  }

  function deleteCustomer(){
    if(!currentId) return;
    if(!confirm("이 고객을 삭제할까요?")) return;
    const arr = getArr().filter(x=>x.id!==currentId);
    setArr(arr);
    currentId = "";
    toast("삭제 완료");
    render();
  }

  function render(){
    const q = (elQ.value||"").trim().toLowerCase();
    let arr = getArr();
    if(q){
      arr = arr.filter(x => (
        [x.name,x.phone,x.role,x.tag,x.memo].join(" ").toLowerCase().includes(q)
      ));
    }

    elList.innerHTML = "";
    elEmpty.style.display = arr.length ? "none" : "block";

    arr.forEach(c=>{
      const div = document.createElement("div");
      div.className = "c-item" + (c.id===currentId?" active":"");
      div.innerHTML = `
        <div class="c-name">${esc(c.name)} <span class="small">(${esc(c.role||"-")})</span></div>
        <div class="c-sub">${esc(c.phone||"-")} ${c.tag?" · "+esc(c.tag):""}</div>
        ${c.memo?`<div class="c-sub">${esc(c.memo)}</div>`:""}
      `;
      div.onclick = ()=>select(c.id);
      elList.appendChild(div);
    });

    const cur = currentId ? getArr().find(x=>x.id===currentId) : null;
    if(!cur){
      elDetailEmpty.style.display = "block";
      elDetail.style.display = "none";
      return;
    }

    elDetailEmpty.style.display = "none";
    elDetail.style.display = "block";

    elHead.innerHTML = `
      <b>${esc(cur.name)}</b> (${esc(cur.role||"-")})<br/>
      연락처: ${esc(cur.phone||"-")}<br/>
      키워드: ${esc(cur.tag||"-")}
    `;

    const notes = Array.isArray(cur.notes) ? cur.notes.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))) : [];
    elNotes.innerHTML = "";
    elNotesEmpty.style.display = notes.length ? "none" : "block";

    notes.forEach(n=>{
      const div = document.createElement("div");
      div.className = "n-item";
      div.innerHTML = `
        <div class="n-top">
          <div class="n-date">${esc(n.date||"")}</div>
          <button class="btn mini danger" type="button">삭제</button>
        </div>
        <div class="n-text">${esc(n.text||"")}</div>
      `;
      div.querySelector("button").onclick = ()=>deleteNote(n.id);
      elNotes.appendChild(div);
    });
  }

  function today(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const da = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${da}`;
  }

  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;");
  }
})();

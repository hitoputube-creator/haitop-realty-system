// 매물 상세: 비어 있는 경우가 많은 "추가메모 · 특별조건/홍보 · 이미지/자료"를 버튼으로 접어 두고, 눌렀을 때만 펼쳐 보여 준다.
// 각 버튼에는 들어 있는 항목 수가 표시되어, 열어 보지 않아도 비어 있는지 알 수 있다. 열림 상태는 화면을 다시 그려도(메모 저장 등) 유지된다.
(function () {
  "use strict";
  var area = document.getElementById("detailArea");
  if (!area) return;
  var id = new URLSearchParams(location.search).get("id") || "";
  var KEY = "detailPanels:" + id;
  var open = { memo: false, promo: false, img: false };
  try { var saved = JSON.parse(sessionStorage.getItem(KEY) || "null"); if (saved) open = Object.assign(open, saved); } catch (e) {}
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(open)); } catch (e) {} }

  var DEFS = [
    { k: "memo", ico: "💬", label: "추가메모" },
    { k: "promo", ico: "📌", label: "특별조건 · 홍보" },
    { k: "img", ico: "🖼", label: "이미지 · 자료" }
  ];

  if (!document.getElementById("dpStyle")) {
    var st = document.createElement("style");
    st.id = "dpStyle";
    st.textContent = ".dp-hidden{display:none!important}" +
      "#detailPanelBar{display:flex;gap:8px;margin:0 0 10px;padding:8px 14px;background:#eef3f9;border:1px solid #c9d7e6;border-radius:12px}" +
      "#listingOverviewArea>.detail-section{margin-top:0!important}" +
      "#detailPanelBar .dp-btn{flex:1 1 0;min-width:0;display:flex;align-items:center;gap:8px;height:34px;padding:0 12px;border:1px solid #b9cadd;border-left:4px solid #1f5fa8;border-radius:6px;background:#dce8f6;color:#16487f;font:inherit;font-size:13px;font-weight:800;cursor:pointer;box-sizing:border-box;transition:background .12s,color .12s}" +
      "#detailPanelBar .dp-btn:hover{background:#cddff3}" +
      "#detailPanelBar .dp-btn.on{background:#1f5fa8;border-color:#1f5fa8;border-left-color:#0f3d73;color:#fff}" +
      "#detailPanelBar .dp-ico{font-size:14px;line-height:1}" +
      "#detailPanelBar .dp-lab{flex:1;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      "#detailPanelBar .dp-cnt{min-width:24px;height:20px;line-height:20px;padding:0 7px;border-radius:4px;background:rgba(255,255,255,.7);color:#8aa0b8;font-size:12px;font-weight:800;text-align:center;box-sizing:border-box}" +
      "#detailPanelBar .dp-cnt.has{background:#fff;color:#16487f;box-shadow:inset 0 0 0 1px #9fb6cf}" +
      "#detailPanelBar .dp-btn.on .dp-cnt{background:rgba(255,255,255,.22);color:#fff;box-shadow:none}" +
      "#detailPanelBar .dp-caret{font-size:11px;opacity:.75}";
    document.head.appendChild(st);
  }

  function imgSection() {
    var secs = area.querySelectorAll(".detail-section");
    for (var i = 0; i < secs.length; i++) {
      var t = secs[i].querySelector(".detail-section-title");
      if (t && /^\s*이미지\s*·\s*자료/.test(t.textContent)) return secs[i];
    }
    return null;
  }
  function counts(memo, box, img) {
    var m = /(\d+)\s*건/.exec((memo.querySelector(".detail-section-title") || {}).textContent || "");
    return {
      memo: m ? Number(m[1]) : 0,
      promo: box.querySelectorAll(".hr-grid > *").length,
      img: img.querySelectorAll(".detail-resource-row, .detail-image-link").length
    };
  }

  function apply() {
    var memo = document.getElementById("memoSection");
    var box = document.getElementById("listingPromoBox");
    var img = imgSection();
    if (!memo || !box || !img) return;
    var wrap = document.getElementById("pbAddWrap");
    var info = area.querySelector(":scope > .listing-info-section");
    var desc = area.querySelector(":scope > .description-section");
    var bar = document.getElementById("detailPanelBar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "detailPanelBar";
      bar.innerHTML = DEFS.map(function (d) {
        return '<button type="button" class="dp-btn" data-k="' + d.k + '" aria-expanded="false"><span class="dp-ico">' + d.ico + '</span><span class="dp-lab">' + d.label + '</span><span class="dp-cnt">0</span><span class="dp-caret">▾</span></button>';
      }).join("");
      bar.addEventListener("click", function (e) {
        var b = e.target.closest(".dp-btn"); if (!b) return;
        var k = b.getAttribute("data-k"); open[k] = !open[k]; save(); apply();
      });
    }
    // 배치: 상세정보 표 → 설명·메모 → 버튼 줄 → 추가메모 → 특별조건·홍보 → 이미지·자료
    var seq = [desc, bar, memo, box, wrap, img].filter(Boolean);
    var prev = info || area.firstElementChild;
    var aptLayout = area.querySelector(".apartment-details-layout");
    if (aptLayout) { prev = aptLayout; seq = [bar, memo, box, wrap, img].filter(Boolean); }
    seq.forEach(function (node) { if (prev.nextElementSibling !== node) prev.after(node); prev = node; });
    var c = counts(memo, box, img);
    var groups = { memo: [memo], promo: [box, wrap].filter(Boolean), img: [img] };
    DEFS.forEach(function (d) {
      var b = bar.querySelector('[data-k="' + d.k + '"]');
      var cnt = b.querySelector(".dp-cnt");
      if (cnt.textContent !== String(c[d.k])) cnt.textContent = String(c[d.k]);
      cnt.classList.toggle("has", c[d.k] > 0);
      b.classList.toggle("on", !!open[d.k]);
      b.setAttribute("aria-expanded", open[d.k] ? "true" : "false");
      var caret = b.querySelector(".dp-caret"); var ct = open[d.k] ? "▴" : "▾"; if (caret.textContent !== ct) caret.textContent = ct;
      groups[d.k].forEach(function (el) { el.classList.toggle("dp-hidden", !open[d.k]); });
    });
  }

  var timer = null;
  new MutationObserver(function () { clearTimeout(timer); timer = setTimeout(apply, 60); }).observe(area, { childList: true, subtree: true });
  apply();
})();

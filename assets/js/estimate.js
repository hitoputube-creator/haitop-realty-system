// assets/js/estimate.js
(function () {
  "use strict";

  const Estimate = {};
  const VAT_RATE_DEFAULT = 10;

  Estimate.renderAndPrint = function (listing) {
    fillEstimate(listing);
    window.print();
  };

  window.EstimateUtil = Estimate;

  function fillEstimate(x) {
    const root = document.getElementById("estimatePrint");
    if (!root) return;

    const headTitle = makeTitle(x);
    const sub = makeSub(x);
    const plan = pickPlanUrl(x);
    const calc = compute(x);
    const vatNote = makeVatNote(x, calc);

    root.innerHTML = `
      <h1 class="est-title">${esc(headTitle)}</h1>
      <div class="est-sub">${esc(sub)}</div>
      <div class="est-line"></div>

      ${plan.url ? `
        <div class="est-figure">
          <img src="${escapeAttr(plan.url)}" alt="도면">
          <div class="est-caption">${esc(plan.caption)}</div>
        </div>` : ""}

      <div class="est-section">
        <h3>가격 및 비용</h3>
        <table class="est-table">
          <tbody>
            ${row("거래유형", x.dealType || "-")}
            ${row("매매/분양가", calc.basePriceText)}
            ${row("부가세", calc.vatText)}
            ${row("총액", calc.totalPriceText)}
            ${(x.dealType === "임대" || x.dealType === "월세") ? row("보증금/월세", calc.rentText) : ""}
            ${row("취득세", calc.acqTaxText)}
            ${row("기타비용", calc.otherCostText)}
            ${row("총 투자금", calc.totalCostText)}
          </tbody>
        </table>
        ${calc.payPlanText ? `<div class="vat-note">${esc(calc.payPlanText)}</div>` : ""}
      </div>

      <div class="est-section">
        <h3>대출 및 이자</h3>
        <table class="est-table">
          <tbody>
            ${row("대출비율(LTV)", calc.ltvText)}
            ${row("대출금", calc.loanText)}
            ${row("금리", calc.rateText)}
            ${row("월 이자", calc.monthlyInterestText)}
          </tbody>
        </table>
      </div>

      <div class="est-section">
        <h3>수익 분석</h3>
        <table class="est-table">
          <tbody>
            ${row("연 임대수익", calc.annualRentText)}
            ${row("연 순수익", calc.annualNetText)}
          </tbody>
        </table>
        <div class="yield-box">
          <div class="yield-row">
            <div class="k">단순 수익률</div>
            <div class="v big">${esc(calc.grossYieldText)}</div>
          </div>
          <div class="yield-row">
            <div class="k">실투자금 수익률</div>
            <div class="v big">${esc(calc.equityYieldText)}</div>
          </div>
        </div>
        <div class="vat-note">${esc(vatNote)}</div>
      </div>

      <div class="est-footer">
        <div class="est-logo"></div>
        <div class="est-footer-text">하이탑부동산 ☎ 031.949.8969</div>
      </div>
    `;
  }

  function compute(x) {
    const man = (n) => (isFiniteNumber(n) && Number(n) !== 0) ? `${Number(n).toLocaleString("ko-KR")}만원` : "-";
    const est = x.estimate || {};
    const vatMode = est.vatMode || x.vatMode || "해당없음";
    const vatRate = isFiniteNumber(est.vatRate) ? Number(est.vatRate) : VAT_RATE_DEFAULT;
    const acqTaxRate = isFiniteNumber(est.acqTaxRate) ? Number(est.acqTaxRate) : 4.6;
    const otherCost = isFiniteNumber(est.otherCostManwon) ? Number(est.otherCostManwon) : 0;
    const ltv = isFiniteNumber(est.loanLtvPct) ? Number(est.loanLtvPct) : 60;
    const rate = isFiniteNumber(est.interestRate) ? Number(est.interestRate) : 4.2;

    const basePrice = pickBasePriceManwon(x);
    const vat = (vatMode === "별도") ? round2(basePrice * (vatRate / 100)) : 0;
    const totalPrice = basePrice + vat;
    const rentText = (x.depositManwon || x.rentManwon) ? `${man(x.depositManwon)} / ${man(x.rentManwon)}` : "-";

    const acqTax = round2(totalPrice * (acqTaxRate / 100));
    const totalCost = totalPrice + acqTax + otherCost;
    const loan = round2(totalPrice * (ltv / 100));
    const monthlyInterest = round2(loan * (rate / 100) / 12);

    const annualRent = x.rentManwon ? round2(Number(x.rentManwon) * 12) : 0;
    const annualNet = annualRent;
    const grossYield = (totalPrice > 0 && annualRent > 0) ? (annualRent / totalPrice) * 100 : 0;
    const equity = totalCost - loan - (Number(x.depositManwon) || 0);
    const equityYield = (equity > 0 && annualNet > 0) ? (annualNet / equity) * 100 : 0;

    const payPlan = est.payPlan || null;
    let payPlanText = "";
    if (payPlan && (payPlan.contractPct || payPlan.interimPct || payPlan.balancePct)) {
      payPlanText = `납부비율(기본): 계약금 ${payPlan.contractPct||0}% / 중도금 ${payPlan.interimPct||0}% / 잔금 ${payPlan.balancePct||0}%`;
    }

    return {
      basePriceText: man(basePrice),
      vatText: vatMode === "별도" ? man(vat) : (vatMode === "포함" ? "포함" : "해당없음"),
      totalPriceText: man(totalPrice),
      rentText,
      acqTaxText: `${man(acqTax)} (세율 ${acqTaxRate.toFixed(1)}%)`,
      otherCostText: otherCost ? man(otherCost) : "-",
      totalCostText: man(totalCost),
      ltvText: `${ltv.toFixed(0)}%`,
      loanText: man(loan),
      rateText: `${rate.toFixed(2)}%`,
      monthlyInterestText: man(monthlyInterest),
      annualRentText: annualRent ? man(annualRent) : "-",
      annualNetText: annualNet ? man(annualNet) : "-",
      grossYieldText: fmtPct(grossYield),
      equityYieldText: fmtPct(equityYield),
      payPlanText, vatMode, vatRate
    };
  }

  function pickBasePriceManwon(x) {
    if (isFiniteNumber(x.salePriceManwon) && Number(x.salePriceManwon) > 0) return Number(x.salePriceManwon);
    if (x.dealType === "전세" && isFiniteNumber(x.jeonsePriceManwon)) return Number(x.jeonsePriceManwon);
    return 0;
  }

  function makeVatNote(x, calc) {
    if (x.type.startsWith("land")) return "※ 토지는 일반적으로 부가세 적용 대상이 아닙니다. (거래 구조에 따라 예외가 있을 수 있습니다)";
    if (calc.vatMode === "별도") return `※ 상기 금액은 부가세(${calc.vatRate}%) 별도 기준입니다.`;
    if (calc.vatMode === "포함") return "※ 상기 금액은 부가세 포함 금액입니다.";
    return "※ 부가세 적용 여부는 거래 구조에 따라 달라질 수 있습니다.";
  }

  function pickPlanUrl(x) {
    const b = x.buildingId ? DataUtil.findBuildingById(x.buildingId) : null;
    if (x.type === "shop" && b?.floorplans && x.floor) {
      const url = b.floorplans[x.floor];
      if (url) return { url, caption: `${x.floor} 평면도` };
    }
    if ((x.type === "officetel" || x.type === "apartment") && b?.layouts?.length) {
      return { url: b.layouts[0], caption: "호수 배치도" };
    }
    return { url: "", caption: "" };
  }

  function makeTitle(x) {
    if (x.type.startsWith("land")) return `${x.address || "토지"} 토지 견적서`;
    const parts = [x.buildingName, x.floor, x.unit || x.ho].filter(Boolean).join(" ");
    return (parts ? `${parts} ` : "") + "견적서";
  }

  function makeSub(x) {
    const today = new Date();
    const dateStr = `${today.getFullYear()}.${pad2(today.getMonth()+1)}.${pad2(today.getDate())}`;
    const info = [];
    if (x.address) info.push(x.address);
    if (x.areaExclusiveM2 || x.areaExclusivePy) info.push(`전용 ${fmtArea(x.areaExclusiveM2, x.areaExclusivePy)}`);
    if (x.areaSupplyM2 || x.areaSupplyPy) info.push(`분양 ${fmtArea(x.areaSupplyM2, x.areaSupplyPy)}`);
    if (x.landAreaM2 || x.landAreaPy) info.push(`면적 ${fmtArea(x.landAreaM2, x.landAreaPy)}`);
    if (x.dealType) info.push(x.dealType);
    return `${info.join(" · ")} · 출력일: ${dateStr}`;
  }

  function row(k, v) { return `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`; }
  function fmtArea(m2, py) {
    const mm = m2 ? `${fmtNum(m2)}㎡` : "";
    const pp = py ? `${fmtNum(py)}평` : "";
    return `${mm}${mm && pp ? " " : ""}(${pp})`.trim() || "—";
  }
  function fmtNum(v) {
    const n = Number(v);
    if (!isFinite(n)) return String(v ?? "");
    return String(v).includes(".") ? n.toFixed(2).replace(/\.00$/, "") : n.toLocaleString("ko-KR");
  }
  function fmtPct(v) {
    const n = Number(v);
    if (!isFinite(n) || n <= 0) return "0.00%";
    return n.toFixed(2) + "%";
  }
  function round2(n) { return Math.round(Number(n) * 100) / 100; }
  function isFiniteNumber(n) { return Number.isFinite(Number(n)); }
  function pad2(n) { return String(n).padStart(2, "0"); }
  function esc(s) {
    return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  }
  function escapeAttr(s) {
    return String(s ?? "").replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  }

})();

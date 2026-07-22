// ===== localStorage 유틸 (buildings.js 호환) =====
const StorageUtil = {
  getArray(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]') || []; } catch(e) { return []; }
  },
  setArray(key, arr) {
    try { localStorage.setItem(key, JSON.stringify(arr)); } catch(e) {}
  },
  uid(prefix) {
    return (prefix ? prefix + '_' : '') + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
};

const SUPABASE_URL = "https://xaxbkdnrzsghsabkdvzj.supabase.co";
const SUPABASE_KEY = "sb_publishable_gqNFRMHb6yYKvqFnQurPKQ_7gGhURVd";
const LISTING_IMAGES_BUCKET = "listing-images";
const MAX_LISTING_IMAGES = 5;

// ===== \ud45c\uc900 \ub9e4\ubb3c \uce74\ud14c\uace0\ub9ac (1\ub2e8\uacc4 \uac1c\ud3b8 \u2014 \ud648\ud398\uc774\uc9c0 \uce74\ud14c\uace0\ub9ac\uc640 \ud1b5\uc77c) =====
// \ud654\uba74(\ub4f1\ub85d\u00b7\uc218\uc815\u00b7\ud544\ud130)\uc5d0\ub294 \uc544\ub798 5\uac1c \ub300\ubd84\ub958\ub9cc \ub178\ucd9c\ud55c\ub2e4. DB \uc800\uc7a5 \uad6c\uc870\ub294 \ubc14\uafb8\uc9c0 \uc54a\uc73c\uba70,
// "\uc8fc\uac70\uc6a9" \uc544\ub798\uc5d0\uc11c \uace0\ub978 \uc0c1\uac00\uc8fc\ud0dd\u00b7\ub2e4\uac00\uad6c\uc8fc\ud0dd\u00b7\ub2e8\ub3c5\uc8fc\ud0dd\u00b7\uc804\uc6d0\uc8fc\ud0dd\uc740 \uc800\uc7a5 \uc2dc\uc810\uc5d0
// resolveStorageCategory1()\uc774 \uae30\uc874 \ub370\uc774\ud130\u00b7\ud648\ud398\uc774\uc9c0 \ud544\ud130\uc640 \ub3d9\uc77c\ud55c category1(\uac74\ubb3c\ube4c\ub529/\ub2e8\ub3c5\uc804\uc6d0\uc8fc\ud0dd)\ub85c \ubcc0\ud658\ud55c\ub2e4.
const PROPERTY_CATEGORY_STANDARD = {
  "\uacf5\uc7a5\ucc3d\uace0":   { label: "\uacf5\uc7a5\u00b7\ucc3d\uace0",  children: ["\uacf5\uc7a5", "\ucc3d\uace0"] },
  "\uc0c1\uac00\uc0ac\ubb34\uc2e4": { label: "\uc0c1\uac00\u00b7\uc0ac\ubb34\uc2e4", children: ["\uc0c1\uac00", "\uc0ac\ubb34\uc2e4"] },
  "\ud1a0\uc9c0":       { label: "\ud1a0\uc9c0",       children: ["\ud1a0\uc9c0", "\ub18d\uc9c0", "\ud0dd\uc9c0"] },
  "\uc8fc\uac70\uc6a9":     { label: "\uc8fc\uac70\uc6a9",     children: ["\uc544\ud30c\ud2b8", "\uc624\ud53c\uc2a4\ud154", "\ub2e8\ub3c5\uc8fc\ud0dd", "\uc804\uc6d0\uc8fc\ud0dd", "\uc0c1\uac00\uc8fc\ud0dd", "\ub2e4\uac00\uad6c\uc8fc\ud0dd"] },
  "\uac74\ubb3c\ube4c\ub529":   { label: "\uac74\ubb3c\u00b7\ube4c\ub529",  children: ["\uac74\ubb3c", "\ube4c\ub529"] }
};
const PROPERTY_CATEGORY_ORDER = ["\uacf5\uc7a5\ucc3d\uace0", "\uc0c1\uac00\uc0ac\ubb34\uc2e4", "\ud1a0\uc9c0", "\uc8fc\uac70\uc6a9", "\uac74\ubb3c\ube4c\ub529"];

// \ud654\uba74(\ub4f1\ub85d\u00b7\uc218\uc815 \ud3fc)\uc758 2\ucc28\uad6c\ubd84 \ub4dc\ub86d\ub2e4\uc6b4\uc6a9 \u2014 PROPERTY_CATEGORY_STANDARD\uacfc \ub3d9\uc77c \uc18c\uc2a4\uc5d0\uc11c \ud30c\uc0dd.
const CATEGORY_OPTIONS = {};
PROPERTY_CATEGORY_ORDER.forEach(k => { CATEGORY_OPTIONS[k] = PROPERTY_CATEGORY_STANDARD[k].children.slice(); });

// \uc0c1\uac00\uc8fc\ud0dd\u00b7\ub2e4\uac00\uad6c\uc8fc\ud0dd\u00b7\ub2e8\ub3c5\uc8fc\ud0dd\u00b7\uc804\uc6d0\uc8fc\ud0dd\uc740 \ud654\uba74(2\ucc28\uad6c\ubd84)\uc5d0\uc11c\ub294 "\uc8fc\uac70\uc6a9" \uc544\ub798\uc5d0 \ubcf4\uc774\uc9c0\ub9cc,
// \uc2e4\uc81c \uc800\uc7a5/\uc870\ud68c\ub294 \uae30\uc874 \ub370\uc774\ud130\u00b7\ud648\ud398\uc774\uc9c0 \ud544\ud130\uc640 \ub3d9\uc77c\ud558\uac8c category1="\uac74\ubb3c\ube4c\ub529"/"\ub2e8\ub3c5\uc804\uc6d0\uc8fc\ud0dd"\uc744 \uc0ac\uc6a9\ud55c\ub2e4.
function resolveStorageCategory1(category1, category2) {
  if (category1 === "\uc8fc\uac70\uc6a9" && (category2 === "\uc0c1\uac00\uc8fc\ud0dd" || category2 === "\ub2e4\uac00\uad6c\uc8fc\ud0dd")) return "\uac74\ubb3c\ube4c\ub529";
  if (category1 === "\uc8fc\uac70\uc6a9" && (category2 === "\ub2e8\ub3c5\uc8fc\ud0dd" || category2 === "\uc804\uc6d0\uc8fc\ud0dd")) return "\ub2e8\ub3c5\uc804\uc6d0\uc8fc\ud0dd";
  return category1;
}
// \uae30\uc874\uc5d0 \uc800\uc7a5\ub41c category1="\uac74\ubb3c\ube4c\ub529"+category2="\uc0c1\uac00\uc8fc\ud0dd"/"\ub2e4\uac00\uad6c\uc8fc\ud0dd", category1="\ub2e8\ub3c5\uc804\uc6d0\uc8fc\ud0dd" \ub9e4\ubb3c\uc744
// \ud654\uba74(2\ucc28\uad6c\ubd84: \uc8fc\uac70\uc6a9)\uc5d0 \ub9de\uac8c \ubcf4\uc5ec\uc8fc\uae30 \uc704\ud55c \ud45c\uc2dc\uc6a9 \uc5ed\ub9e4\ud551.
function resolveDisplayCategory1(category1, category2) {
  if (category1 === "\uac74\ubb3c\ube4c\ub529" && (category2 === "\uc0c1\uac00\uc8fc\ud0dd" || category2 === "\ub2e4\uac00\uad6c\uc8fc\ud0dd")) return "\uc8fc\uac70\uc6a9";
  if (category1 === "\ub2e8\ub3c5\uc804\uc6d0\uc8fc\ud0dd") return "\uc8fc\uac70\uc6a9";
  return category1;
}

// getCategoryFromListing()\uc758 'type'-only \ub808\uac70\uc2dc \ud589 \ud3f4\ubc31\uc6a9 \u2014 \uae30\uc874 \ub370\uc774\ud130 \ud574\uc11d \ubc29\uc2dd\uc744 \uadf8\ub300\ub85c \uc720\uc9c0\ud55c\ub2e4(\ubcc0\uacbd \uae08\uc9c0).
const LEGACY_TYPE_CATEGORY = {"shop": ["\uc0c1\uac00\uc0ac\ubb34\uc2e4", "\uc0c1\uac00"], "office": ["\uc0c1\uac00\uc0ac\ubb34\uc2e4", "\uc0ac\ubb34\uc2e4"], "officetel": ["\uc8fc\uac70\uc6a9", "\uc624\ud53c\uc2a4\ud154"], "hilsstate": ["\uc8fc\uac70\uc6a9", "\ud790\uc2a4\ud14c\uc774\ud2b8\ub354\uc6b4\uc815"], "factory": ["\uacf5\uc7a5\ucc3d\uace0", "\uacf5\uc7a5\ucc3d\uace0"], "bizcenter": ["\uc0c1\uac00\uc0ac\ubb34\uc2e4", "\uc9c0\uc2dd\uc0b0\uc5c5\uc13c\ud130"], "land_single": ["\ud1a0\uc9c0", "\ud1a0\uc9c0"], "land_dev": ["\ud1a0\uc9c0", "\ud1a0\uc9c0"], "land_other": ["\ud1a0\uc9c0", "\ud1a0\uc9c0"], "etc": ["\uac74\ubb3c\ube4c\ub529", "\uac74\ubb3c"]};
// \uc2e0\uaddc \uc800\uc7a5 \uc2dc category1/category2 \u2192 'type' \ub2e8\ucd95\ud0a4 \ud30c\uc0dd\uc6a9(\ud45c\uc900 5\ub300\ubd84\ub958 \uc870\ud569\ub9cc \ucee4\ubc84).
const CATEGORY_TO_TYPE = {
  "\uacf5\uc7a5\ucc3d\uace0|\uacf5\uc7a5": "factory", "\uacf5\uc7a5\ucc3d\uace0|\ucc3d\uace0": "warehouse",
  "\uc0c1\uac00\uc0ac\ubb34\uc2e4|\uc0c1\uac00": "shop", "\uc0c1\uac00\uc0ac\ubb34\uc2e4|\uc0ac\ubb34\uc2e4": "office",
  "\ud1a0\uc9c0|\ud1a0\uc9c0": "land_single", "\ud1a0\uc9c0|\ub18d\uc9c0": "land_other", "\ud1a0\uc9c0|\ud0dd\uc9c0": "land_dev",
  "\uc8fc\uac70\uc6a9|\uc544\ud30c\ud2b8": "apartment", "\uc8fc\uac70\uc6a9|\uc624\ud53c\uc2a4\ud154": "officetel",
  "\ub2e8\ub3c5\uc804\uc6d0\uc8fc\ud0dd|\ub2e8\ub3c5\uc8fc\ud0dd": "house", "\ub2e8\ub3c5\uc804\uc6d0\uc8fc\ud0dd|\uc804\uc6d0\uc8fc\ud0dd": "house",
  "\uac74\ubb3c\ube4c\ub529|\uac74\ubb3c": "building", "\uac74\ubb3c\ube4c\ub529|\ube4c\ub529": "building",
  "\uac74\ubb3c\ube4c\ub529|\uc0c1\uac00\uc8fc\ud0dd": "shophouse", "\uac74\ubb3c\ube4c\ub529|\ub2e4\uac00\uad6c\uc8fc\ud0dd": "multifamily"
};

function getCategoryFromListing(item = {}) {
  const legacy = LEGACY_TYPE_CATEGORY[item.type] || ['\uac74\ubb3c\ube4c\ub529', '\uac74\ubb3c'];
  let category1 = item.category1 || item.category_1 || legacy[0];
  let category2 = item.category2 || item.category_2 || legacy[1];
  if (category1 === '\uae30\ud0c0') {
    category1 = '\uac74\ubb3c\ube4c\ub529';
    category2 = '\uac74\ubb3c';
  }
  return { category1, category2 };
}

function getTypeFromCategory(category1, category2, fallback = 'etc') {
  return CATEGORY_TO_TYPE[`${category1}|${category2}`] || fallback || 'etc';
}

// ===== \uce74\ud14c\uace0\ub9ac \uc815\uaddc\ud654(\ud654\uba74 \ud45c\uc2dc\u00b7\ud544\ud130 \uc804\uc6a9, \uc77d\uae30 \uc804\uc6a9) =====
// DB\uc5d0 \uc2e4\uc81c \uc800\uc7a5\ub41c category1/category2(\uc5c6\uc73c\uba74 \ub808\uac70\uc2dc 'type')\ub97c \ud45c\uc900 5\ub300\ubd84\ub958 \uccb4\uacc4\ub85c \ubcc0\ud658\ud574
// \ud654\uba74\uc5d0 \ubcf4\uc5ec\uc8fc\uae30 \uc704\ud55c \ud568\uc218. \uc6d0\ubcf8 \ub370\uc774\ud130\ub294 \uc808\ub300 \ubcc0\uacbd\ud558\uc9c0 \uc54a\uc73c\uba70, \ud45c\uc900\uacfc \ub9de\uc9c0 \uc54a\ub294 \uac12\uc740
// \uc784\uc758\ub85c \ub2e4\ub978 \uce74\ud14c\uace0\ub9ac\uc5d0 \ub07c\uc6cc \ub9de\ucd94\uc9c0 \uc54a\uace0 "\ud655\uc778 \ud544\uc694"\ub85c \ud45c\uc2dc\ud55c\ub2e4.
// \ub300\ubd84\ub958 \ud45c\uae30\uac00 \ub2e4\ub978 \ub808\uac70\uc2dc \ubb38\uc790\uc5f4(\uc608: "\uacf5\uc7a5/\ucc3d\uace0") \u2192 \ud45c\uc900 \ub300\ubd84\ub958 key.
const LEGACY_CATEGORY1_ALIAS = {
  "\uacf5\uc7a5/\ucc3d\uace0": "\uacf5\uc7a5\ucc3d\uace0",
  "\uc0c1\uac00/\uc0ac\ubb34\uc2e4": "\uc0c1\uac00\uc0ac\ubb34\uc2e4",
  "\ub2e8\ub3c5\uc804\uc6d0\uc8fc\ud0dd": "\uc8fc\uac70\uc6a9"
};
// \ub300\ubd84\ub958\ub294 \ud655\uc815\ub410\uc9c0\ub9cc \uc138\ubd80\uad6c\ubd84 \ud45c\uae30\ub9cc \ub2e4\ub978 \ub808\uac70\uc2dc \uac12 \u2192 \ud45c\uc900 \uc138\ubd80\uad6c\ubd84.
const LEGACY_CATEGORY2_ALIAS = {
  "\ub2e8\ub3c5\ud0dd\uc9c0": "\ud0dd\uc9c0"
};
// category1/category2\uac00 \ubaa8\ub450 \ube44\uc5b4 \uc788\ub294 \uad6c\ud615 \ud589(\ub808\uac70\uc2dc 'type'\ub9cc \uc874\uc7ac)\uc744 \uc704\ud55c \ub300\ubd84\ub958/\uc138\ubd80\uad6c\ubd84 \ucd94\uc815.
// 'etc'\ub294 \ud3ec\ud568\ud558\uc9c0 \uc54a\ub294\ub2e4 \u2014 \ub300\ubd84\ub958\uc870\ucc28 \uc54c \uc218 \uc5c6\ub294 \uac12\uc744 \uc784\uc758\ub85c \ud2b9\uc815 \uce74\ud14c\uace0\ub9ac\uc5d0 \ub123\uc9c0 \uc54a\uae30 \uc704\ud568.
// \uc138\ubd80\uac12\uc774 null\uc778 \ud56d\ubaa9\uc740 \ub300\ubd84\ub958\ub294 \ud655\uc2e4\ud558\uc9c0\ub9cc \uc138\ubd80\uad6c\ubd84\uc740 \uc54c \uc218 \uc5c6\uc5b4 "\ud655\uc778 \ud544\uc694"\ub85c \ud45c\uc2dc\ub41c\ub2e4.
const LEGACY_TYPE_TO_STANDARD_CATEGORY = {
  "shop": ["\uc0c1\uac00\uc0ac\ubb34\uc2e4", "\uc0c1\uac00"], "office": ["\uc0c1\uac00\uc0ac\ubb34\uc2e4", "\uc0ac\ubb34\uc2e4"], "\uc0ac\ubb34\uc2e4": ["\uc0c1\uac00\uc0ac\ubb34\uc2e4", "\uc0ac\ubb34\uc2e4"],
  "officetel": ["\uc8fc\uac70\uc6a9", "\uc624\ud53c\uc2a4\ud154"], "\uc624\ud53c\uc2a4\ud154": ["\uc8fc\uac70\uc6a9", "\uc624\ud53c\uc2a4\ud154"],
  "land_single": ["\ud1a0\uc9c0", "\ud1a0\uc9c0"], "land_dev": ["\ud1a0\uc9c0", "\ud1a0\uc9c0"], "land_other": ["\ud1a0\uc9c0", "\ud1a0\uc9c0"],
  "hilsstate": ["\uc8fc\uac70\uc6a9", null], "factory": ["\uacf5\uc7a5\ucc3d\uace0", null], "bizcenter": ["\uc0c1\uac00\uc0ac\ubb34\uc2e4", null]
};

function normalizeListingCategory(item = {}) {
  const rawCategory1 = item.category1 || item.category_1 || "";
  const rawCategory2 = item.category2 || item.category_2 || "";
  let effCategory1 = rawCategory1;
  let effCategory2 = rawCategory2;

  if (!effCategory1 && !effCategory2) {
    const legacyPair = LEGACY_TYPE_TO_STANDARD_CATEGORY[item.type];
    if (legacyPair) { effCategory1 = legacyPair[0]; effCategory2 = legacyPair[1] || ""; }
  }

  let majorKey = resolveDisplayCategory1(effCategory1, effCategory2);
  if (LEGACY_CATEGORY1_ALIAS[majorKey]) majorKey = LEGACY_CATEGORY1_ALIAS[majorKey];

  const standard = PROPERTY_CATEGORY_STANDARD[majorKey];
  const rawLabel = rawCategory1 || rawCategory2 || item.type || "\uc5c6\uc74c";

  if (!standard) {
    return {
      majorKey: null, majorLabel: "\ubbf8\ubd84\ub958",
      subCategory: null, subLabel: null,
      rawCategory1, rawCategory2,
      normalized: false, needsReview: true,
      displayLabel: `\ud655\uc778 \ud544\uc694 \u00b7 \uae30\uc874\uac12: ${rawLabel}`
    };
  }

  const subCategory = LEGACY_CATEGORY2_ALIAS[effCategory2] || effCategory2;
  const subMatches = standard.children.includes(subCategory);

  if (!subMatches) {
    return {
      majorKey, majorLabel: standard.label,
      subCategory: null, subLabel: null,
      rawCategory1, rawCategory2,
      normalized: true, needsReview: true,
      displayLabel: `${standard.label} \u00b7 \ud655\uc778 \ud544\uc694 (\uae30\uc874\uac12: ${rawCategory2 || item.type || "\uc5c6\uc74c"})`
    };
  }

  return {
    majorKey, majorLabel: standard.label,
    subCategory, subLabel: subCategory,
    rawCategory1, rawCategory2,
    normalized: (rawCategory1 !== majorKey) || (rawCategory2 !== subCategory),
    needsReview: false,
    displayLabel: `${standard.label} / ${subCategory}`
  };
}

// \uce74\ub4dc\u00b7\ubaa9\ub85d\u00b7\uc0c1\uc138 \ub4f1 "\ub9e4\ubb3c\uc720\ud615" \ud45c\uc2dc\uac00 \ud544\uc694\ud55c \ubaa8\ub4e0 \uacf3\uc5d0\uc11c \uacf5\uc6a9\uc73c\ub85c \uc0ac\uc6a9\ud558\ub294 \ud45c\uc900 \ud45c\uc2dc \ub77c\ubca8.
function getListingCategoryLabel(item = {}) {
  return normalizeListingCategory(item).displayLabel;
}

// ===== \ub2e8\uc9c0\u00b7\ud0dc\uadf8 \ud544\ud130(\ub300\ubd84\ub958\uc640 \ubb34\uad00, DB \uc2a4\ud0a4\ub9c8 \ubcc0\uacbd \uc5c6\uc74c) =====
// \ub9e4\ubb3c \ub300\ubd84\ub958/\uc138\ubd80\uad6c\ubd84\uacfc \ubcc4\uac1c\ub85c, \ud2b9\uc815 \ub2e8\uc9c0(\uc608: \ud790\uc2a4\ud14c\uc774\ud2b8\ub354\uc6b4\uc815)\uc5d0 \uc18d\ud558\ub294 \ub9e4\ubb3c\uc744 \ucc3e\uae30 \uc704\ud55c \ub9e4\uce6d \ud568\uc218.
// \uc0c8 DB \uceec\ub7fc\uc744 \ucd94\uac00\ud558\uc9c0 \uc54a\uace0 \uae30\uc874 data JSON \uad6c\uc870 \uc548\uc758 \ud544\ub4dc\ub9cc \uc0ac\uc6a9\ud55c\ub2e4:
//  - \ub808\uac70\uc2dc type="hilsstate" (\uae30\uc874 26\uac74 \ub4f1 \u2014 \uc0ad\uc81c\u00b7\ubcc0\uacbd\ud558\uc9c0 \uc54a\uace0 \uadf8\ub300\ub85c \ub9e4\uce6d)
//  - complexName(\uc2e0\uaddc \ub4f1\ub85d/\uc218\uc815 \uc2dc \uc785\ub825\ud558\ub294 "\ub2e8\uc9c0\uba85" \ud544\ub4dc, data JSON\uc5d0 \uc800\uc7a5)
//  - stickers \ubc30\uc5f4\uc5d0 \ub2e8\uc9c0\uba85\uc774 \ud3ec\ud568\ub41c \uacbd\uc6b0
//  - category2\uc5d0 \ub2e8\uc9c0\uba85\uc774 \ub0a8\uc544\uc788\ub294 \uacbd\uc6b0(\ub808\uac70\uc2dc \ud638\ud658)
const COMPLEX_TAG_MATCHERS = {
  "\ud790\uc2a4\ud14c\uc774\ud2b8\ub354\uc6b4\uc815": (item) => {
    if (item.type === "hilsstate") return true;
    if (item.complexName === "\ud790\uc2a4\ud14c\uc774\ud2b8\ub354\uc6b4\uc815") return true;
    if (Array.isArray(item.stickers) && item.stickers.includes("\ud790\uc2a4\ud14c\uc774\ud2b8\ub354\uc6b4\uc815")) return true;
    if (item.category2 === "\ud790\uc2a4\ud14c\uc774\ud2b8\ub354\uc6b4\uc815") return true;
    return false;
  }
};
function matchesComplexTag(item, tag) {
  const matcher = COMPLEX_TAG_MATCHERS[tag];
  return matcher ? matcher(item) : false;
}

const headers = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": "Bearer " + SUPABASE_KEY
};

async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch(e) {
    if (e.name === "AbortError") throw new Error("Server response timed out. Please check your internet connection.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ===== 전화번호 자동 하이픈 포맷 (소유주 연락처1/2 등에서 공용 사용) =====
function phoneDigitsOnly(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}
function formatKoreanPhoneInput(value) {
  const digits = phoneDigitsOnly(value);
  if (!digits) return "";
  if (digits.startsWith("02")) {
    const d = digits.slice(0, 10);
    if (d.length < 3) return d;
    if (d.length < 6) return d.slice(0, 2) + "-" + d.slice(2);
    if (d.length < 10) return d.slice(0, 2) + "-" + d.slice(2, d.length - 4) + "-" + d.slice(d.length - 4);
    return d.slice(0, 2) + "-" + d.slice(2, 6) + "-" + d.slice(6, 10);
  }
  const d = digits.slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 7) return d.slice(0, 3) + "-" + d.slice(3);
  if (d.length < 11) return d.slice(0, 3) + "-" + d.slice(3, d.length - 4) + "-" + d.slice(d.length - 4);
  return d.slice(0, 3) + "-" + d.slice(3, 7) + "-" + d.slice(7, 11);
}
function setupPhoneAutoFormat(inputEl) {
  if (!inputEl || inputEl.dataset.phoneFormatBound === "1") return;
  inputEl.dataset.phoneFormatBound = "1";
  const reformat = () => {
    const caretFromEnd = inputEl.value.length - (inputEl.selectionEnd ?? inputEl.value.length);
    const formatted = formatKoreanPhoneInput(inputEl.value);
    if (inputEl.value !== formatted) inputEl.value = formatted;
    const pos = Math.max(0, inputEl.value.length - caretFromEnd);
    try { inputEl.setSelectionRange(pos, pos); } catch (e) {}
  };
  inputEl.addEventListener("input", reformat);
  inputEl.addEventListener("blur", reformat);
}

function getListingImageUrls(item = {}) {
  if (Array.isArray(item.image_urls)) return item.image_urls.filter(Boolean);
  if (Array.isArray(item.imageUrls)) return item.imageUrls.filter(Boolean);
  return [];
}

function normalizeListingRow(r) {
  const data = r.data && typeof r.data === "object" ? r.data : {};
  const dataImages = Array.isArray(data.image_urls) ? data.image_urls : (Array.isArray(data.imageUrls) ? data.imageUrls : []);
  const imageUrls = Array.isArray(r.image_urls) ? r.image_urls : dataImages;
  const isPublic = r.is_public === true || data.is_public === true;
  return Object.assign({
    id: r.id,
    type: r.type,
    title: r.title,
    address: r.address,
    status: r.status,
    description: r.description,
    resource_id: r.resource_id || null,
    created_at: r.created_at,
    category1: r.category1 || r.category_1 || data.category1 || '',
    category2: r.category2 || r.category_2 || data.category2 || ''
  }, data, {
    is_public: isPublic,
    image_urls: imageUrls,
    imageUrls: imageUrls
  });
}

function buildListingPayload(item) {
  const data = Object.assign({}, item);
  const id = data.id;
  const category = getCategoryFromListing(data);
  const category1 = category.category1;
  const category2 = category.category2;
  const type = data.type || getTypeFromCategory(category1, category2, 'etc');
  const title = data.title;
  const address = data.address;
  const status = data.status;
  const description = data.description;
  const resource_id = data.resource_id !== undefined ? (data.resource_id || null) : undefined;
  const is_public = data.is_public === true;
  const image_urls = getListingImageUrls(data).slice(0, MAX_LISTING_IMAGES);

  delete data.id;
  delete data.created_at;
  delete data.type;
  delete data.title;
  delete data.address;
  delete data.status;
  delete data.description;
  delete data.resource_id;
  delete data.category1;
  delete data.category2;
  delete data.category_1;
  delete data.category_2;
  delete data.is_public;
  delete data.image_urls;
  delete data.imageUrls;

  data.category1 = category1;
  data.category2 = category2;
  data.is_public = is_public;
  data.image_urls = image_urls;
  data.imageUrls = image_urls;

  const payload = { type, title, address, status, description, is_public, image_urls, category1, category2, data };
  if (id !== undefined) payload.id = id;
  if (resource_id !== undefined) payload.resource_id = resource_id;
  return payload;
}

async function getListings() {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/listings?order=created_at.desc", { headers });
  if (!res.ok) throw new Error("Listing lookup failed");
  const rows = await res.json();
  return rows.map(normalizeListingRow);
}

async function getListingById(id) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/listings?id=eq." + encodeURIComponent(id), { headers });
  if (!res.ok) throw new Error("Lookup failed");
  const rows = await res.json();
  if (!rows.length) return null;
  return normalizeListingRow(rows[0]);
}

async function addListing(item) {
  const payload = buildListingPayload(item);
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/listings", {
    method: "POST",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Save failed: " + await res.text());
}

// 저장 후 생성된 Supabase UUID를 반환 (건물 호실 listing_id 연동용)
async function addListingReturnId(item) {
  const payload = buildListingPayload(item);
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/listings", {
    method: "POST",
    headers: Object.assign({}, headers, { "Prefer": "return=representation" }),
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Save failed: " + await res.text());
  const rows = await res.json();
  return rows[0]?.id || null;
}

async function uploadListingImage(file, listingId) {
  if (!file) throw new Error("No image file selected.");
  if (file.type && !file.type.startsWith("image/")) throw new Error("Only image files can be uploaded.");

  const rawExt = (file.name || "").split(".").pop() || "jpg";
  const ext = rawExt.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "jpg";
  const safeListingId = String(listingId || "listing").replace(/[^a-zA-Z0-9_-]/g, "-");
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const objectPath = `${safeListingId}/${safeName}`;
  const objectUrl = `${SUPABASE_URL}/storage/v1/object/${LISTING_IMAGES_BUCKET}/${objectPath}`;

  const res = await fetchWithTimeout(objectUrl, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + SUPABASE_KEY,
      "Content-Type": file.type || "application/octet-stream",
      "Cache-Control": "3600",
      "x-upsert": "false"
    },
    body: file
  }, 30000);
  if (!res.ok) throw new Error("Image upload failed: " + await res.text());

  return `${SUPABASE_URL}/storage/v1/object/public/${LISTING_IMAGES_BUCKET}/${objectPath.split('/').map(encodeURIComponent).join('/')}`;
}

async function uploadListingImages(files, listingId, existingCount = 0) {
  const selected = Array.from(files || []).filter(Boolean);
  if (existingCount + selected.length > MAX_LISTING_IMAGES) {
    throw new Error(`Images can be uploaded up to ${MAX_LISTING_IMAGES} files.`);
  }
  const urls = [];
  for (const file of selected) {
    urls.push(await uploadListingImage(file, listingId));
  }
  return urls;
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
  const payload = buildListingPayload(Object.assign({}, item, { id }));
  delete payload.id;
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/listings?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Update failed: " + await res.text());
}

async function updateListingPublic(id, isPublic) {
  const current = await getListingById(id);
  if (!current) throw new Error("Listing was not found.");
  await updateListing(id, Object.assign({}, current, { is_public: isPublic === true }));
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

// ===== 추천매물 파일 관리 =====
async function getAllRecommendedFiles() {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/recommended_files?order=created_at.asc", { headers });
  if (!res.ok) throw new Error("추천매물 파일 목록 조회 실패");
  return await res.json();
}
async function getRecommendedFiles(recommendedId) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/recommended_files?recommended_id=eq." + encodeURIComponent(recommendedId) + "&order=created_at.asc", { headers });
  if (!res.ok) throw new Error("추천매물 파일 조회 실패");
  return await res.json();
}
async function addRecommendedFile(item) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/recommended_files", {
    method: "POST",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(item)
  });
  if (!res.ok) throw new Error("추천매물 파일 저장 실패: " + await res.text());
}
async function deleteRecommendedFile(id) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/recommended_files?id=eq." + encodeURIComponent(id), {
    method: "DELETE", headers
  });
  if (!res.ok) throw new Error("추천매물 파일 삭제 실패");
}
async function deleteRecommendedFilesByRecId(recommendedId) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/recommended_files?recommended_id=eq." + encodeURIComponent(recommendedId), {
    method: "DELETE", headers
  });
  if (!res.ok) throw new Error("추천매물 파일 일괄 삭제 실패");
}

// ===== 건물 층별 평면도 =====
async function getBuildingFloors(buildingId) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/building_floors?building_id=eq." + encodeURIComponent(buildingId) + "&order=created_at.asc", { headers });
  if (!res.ok) throw new Error("평면도 목록 조회 실패");
  return await res.json();
}
async function addBuildingFloor(item) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/building_floors", {
    method: "POST",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(item)
  });
  if (!res.ok) throw new Error("평면도 저장 실패: " + await res.text());
}
async function deleteBuildingFloor(id) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/building_floors?id=eq." + encodeURIComponent(id), {
    method: "DELETE", headers
  });
  if (!res.ok) throw new Error("평면도 삭제 실패");
}

// ===== 건물 기타 자료 =====
async function getBuildingFiles(buildingId) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/building_files?building_id=eq." + encodeURIComponent(buildingId) + "&order=created_at.asc", { headers });
  if (!res.ok) throw new Error("기타 자료 목록 조회 실패");
  return await res.json();
}
async function addBuildingFile(item) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/building_files", {
    method: "POST",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(item)
  });
  if (!res.ok) throw new Error("기타 자료 저장 실패: " + await res.text());
}
async function deleteBuildingFile(id) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/building_files?id=eq." + encodeURIComponent(id), {
    method: "DELETE", headers
  });
  if (!res.ok) throw new Error("기타 자료 삭제 실패");
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
async function getDoneCustomers() {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/customers?status=eq.계약완료&order=completed_at.desc", { headers });
  if (!res.ok) throw new Error("완료고객 목록 조회 실패");
  return await res.json();
}

// ===== 건물 호실 현황 (Supabase buildings 테이블) =====
async function getBuildingRecord(localId) {
  // 1순위: local_id 정확 매칭
  const r1 = await fetchWithTimeout(
    SUPABASE_URL + "/rest/v1/buildings?local_id=eq." + encodeURIComponent(localId) + "&select=*",
    { headers }
  );
  if (!r1.ok) throw new Error("건물 조회 실패 (local_id)");
  const rows1 = await r1.json();
  if (rows1.length) {
    console.log("[getBuildingRecord] local_id 매칭:", localId, "→", rows1[0].name);
    return rows1[0];
  }

  // 2순위: name 필드 매칭 (drive_resources.name ≠ buildings.local_id 케이스 대응)
  console.warn("[getBuildingRecord] local_id 매칭 실패:", localId, "→ name 필드로 재시도");
  const r2 = await fetchWithTimeout(
    SUPABASE_URL + "/rest/v1/buildings?name=eq." + encodeURIComponent(localId) + "&select=*",
    { headers }
  );
  if (!r2.ok) throw new Error("건물 조회 실패 (name)");
  const rows2 = await r2.json();
  if (rows2.length) {
    console.log("[getBuildingRecord] name 매칭 성공:", localId, "→", rows2[0].name);
    return rows2[0];
  }

  console.warn("[getBuildingRecord] 최종 실패 - 일치하는 건물 없음:", localId);
  return null;
}

async function saveBuildingUnits(localId, name, units) {
  const body = JSON.stringify({
    local_id: localId,
    name: name || '',
    units: Array.isArray(units) ? units : []
  });
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/buildings?on_conflict=local_id", {
    method: "POST",
    headers: Object.assign({}, headers, { "Prefer": "resolution=merge-duplicates,return=minimal" }),
    body
  });
  if (!res.ok) throw new Error("호실 저장 실패: " + await res.text());
}

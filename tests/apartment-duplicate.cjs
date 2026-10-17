const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'assets/js/storage.js'), 'utf8');
const start = source.indexOf('async function assertUniqueApartmentUnit(');
const end = source.indexOf('\nasync function getListingById(', start);
assert.ok(start > 0 && end > start, 'duplicate guard exists in storage.js');

let rows = [];
const context = {
  getListingsRaw: async () => rows,
  normalizeListingRow: row => ({ id: row.id, category2: row.category2, ...row.data }),
  apartmentSource: item => ({
    아파트명: item.complexName ?? item.apartmentUnitData?.아파트명,
    동: item.dong ?? item.apartmentUnitData?.동,
    호: item.ho ?? item.apartmentUnitData?.호
  })
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

(async () => {
  rows = [{ id: 'saved-1', category2: '아파트', data: {
    complexName: '운정하우스디(리베르니아)', dong: '1103', ho: '304'
  } }];
  const sameUnit = { category2: '아파트', complexName: ' 운정하우스디(리베르니아) ', dong: '1103동', ho: '304호' };
  await assert.rejects(context.assertUniqueApartmentUnit(sameUnit), error => error.code === 'DUPLICATE_APARTMENT_UNIT');
  await context.assertUniqueApartmentUnit(sameUnit, 'saved-1');
  await context.assertUniqueApartmentUnit({ ...sameUnit, ho: '305' });
  await context.assertUniqueApartmentUnit({ ...sameUnit, complexName: '다른 아파트' });
  await context.assertUniqueApartmentUnit({ ...sameUnit, category2: '상가' });
  rows = [{ id: 'older', category2: '아파트', data: { apartmentUnitData: {
    아파트명: '운정하우스디(리베르니아)', 동: '1103', 호: '304'
  } } }];
  await assert.rejects(context.assertUniqueApartmentUnit(sameUnit), error => error.code === 'DUPLICATE_APARTMENT_UNIT');
  console.log('apartment duplicate guard: passed');
})().catch(error => { console.error(error); process.exitCode = 1; });

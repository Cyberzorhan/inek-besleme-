import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveLP } from '../js/simplex.js';
import { ihtiyacHesapla, degerlendir } from '../js/nutrition.js';
import { enUcuzRasyon } from '../js/optimizer.js';
import { VARSAYILAN_YEMLER } from '../js/feeds.js';

const yakin = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b} (±${tol})`);

const holstein = {
  durum: 'sagmal', ca: 650, sut: 30, yag: 3.6, protein: 3.2,
  lg: 100, lsira: 3, gebelikAy: 0, mera: false, sicaklik: 15,
};

test('simpleks: bilinen küçük problem', () => {
  // min 2x + 3y,  x + y >= 4,  x <= 3  →  x=3, y=1, amaç 9
  const s = solveLP({
    maliyet: [2, 3],
    kisitlar: [
      { katsayi: [1, 1], op: '>=', sag: 4, ceza: 1e6 },
      { katsayi: [1, 0], op: '<=', sag: 3 },
    ],
  });
  assert.equal(s.durum, 'optimum');
  yakin(s.x[0], 3, 1e-9);
  yakin(s.x[1], 1, 1e-9);
  yakin(s.amac, 9, 1e-9);
  yakin(s.acik[0], 0, 1e-9);
});

test('simpleks: karşılanamayan kısıt açık olarak raporlanır', () => {
  // x + y >= 10 ama x <= 2, y <= 3
  const s = solveLP({
    maliyet: [1, 1],
    kisitlar: [
      { katsayi: [1, 1], op: '>=', sag: 10, ceza: 1e4 },
      { katsayi: [1, 0], op: '<=', sag: 2 },
      { katsayi: [0, 1], op: '<=', sag: 3 },
    ],
  });
  yakin(s.acik[0], 5, 1e-9);
});

test('NRC 2001 kuru madde ve enerji ihtiyacı', () => {
  const ih = ihtiyacHesapla(holstein);
  // 650 kg, 30 kg süt, %3,6 yağ, 100. gün → ~22,2 kg KM, ~31,3 Mcal NEL
  yakin(ih.kmt, 22.2, 0.2);
  yakin(ih.nel, 31.3, 0.3);
  yakin(ih.bakim, 0.08 * 650 ** 0.75, 1e-9);
  assert.equal(ih.hpYuzde, 16);
});

test('gebeliğin son döneminde enerji ihtiyacı artar', () => {
  const bos = ihtiyacHesapla({ ...holstein, durum: 'kuru', gebelikAy: 7 });
  const gecis = ihtiyacHesapla({ ...holstein, durum: 'gecis', gebelikAy: 9 });
  assert.ok(gecis.gebelik > bos.gebelik);
  assert.ok(gecis.kmt < bos.kmt, 'doğuma yakın yem tüketimi düşer');
});

test('sıcaklık stresi yem tüketimini düşürür', () => {
  const normal = ihtiyacHesapla(holstein);
  const sicak = ihtiyacHesapla({ ...holstein, sicaklik: 32 });
  assert.ok(sicak.kmt < normal.kmt);
  assert.ok(sicak.notlar.length > 0);
});

test('değerlendirme: toplamlar yaş kg üzerinden doğru', () => {
  const ih = ihtiyacHesapla(holstein);
  const d = degerlendir([{ id: 'msilaj', kg: 10 }, { id: 'arpa', kg: 2 }], VARSAYILAN_YEMLER, ih);
  yakin(d.toplam.km, 10 * 0.33 + 2 * 0.89, 1e-9);
  yakin(d.toplam.maliyet, 10 * 4 + 2 * 12, 1e-9);
  yakin(d.oran.kaba, 3.3 / 5.08 * 100, 1e-6);
});

test('değerlendirme: lifsiz rasyon asidoz uyarısı verir', () => {
  const ih = ihtiyacHesapla(holstein);
  const d = degerlendir([{ id: 'arpa', kg: 15 }, { id: 'soya', kg: 4 }], VARSAYILAN_YEMLER, ih);
  assert.ok(d.uyarilar.some(u => u.includes('asidoz')));
});

for (const [ad, h] of [
  ['yüksek verimli Holstein', holstein],
  ['yerli ırk, merada', { ...holstein, ca: 350, sut: 10, yag: 4.5, protein: 3.5, mera: true }],
  ['kuru inek', { ...holstein, durum: 'kuru', gebelikAy: 8 }],
  ['geçiş dönemi', { ...holstein, durum: 'gecis', gebelikAy: 9 }],
  ['ilk laktasyon düve', { ...holstein, ca: 560, sut: 24, lsira: 1, lg: 40 }],
]) {
  test(`en ucuz rasyon ihtiyacı karşılar: ${ad}`, () => {
    const ih = ihtiyacHesapla(h);
    const s = enUcuzRasyon(ih, VARSAYILAN_YEMLER);
    assert.deepEqual(s.eksikler, []);
    const d = degerlendir(s.kalemler, VARSAYILAN_YEMLER, ih);
    for (const k of d.kontroller) {
      assert.equal(k.durum, 'uygun', `${k.ad}: ${k.rasyon.toFixed(2)} / ${k.ihtiyac.toFixed(2)}`);
    }
    // Yalnızca elde olan yemler kullanılmalı ve günlük sınırlar aşılmamalı.
    for (const k of s.kalemler) {
      const y = VARSAYILAN_YEMLER.find(z => z.id === k.id);
      assert.ok(y.elde, `${y.ad} elde değil`);
      assert.ok(k.kg <= y.max + 0.05, `${y.ad} sınırı aşıldı`);
    }
  });
}

test('elde yem yoksa anlaşılır hata döner', () => {
  const ih = ihtiyacHesapla(holstein);
  const s = enUcuzRasyon(ih, VARSAYILAN_YEMLER.map(y => ({ ...y, elde: false })));
  assert.ok(s.hata);
});

test('yalnızca saman varsa enerji eksikliği bildirilir', () => {
  const ih = ihtiyacHesapla(holstein);
  const yemler = VARSAYILAN_YEMLER.map(y => ({ ...y, elde: y.id === 'bsaman' }));
  const s = enUcuzRasyon(ih, yemler);
  assert.ok(s.eksikler.some(m => m.includes('Enerji')));
});

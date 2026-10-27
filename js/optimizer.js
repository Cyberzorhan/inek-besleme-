// En düşük maliyetli rasyon: "elimde var" işaretli yemlerden, ihtiyaçları karşılayan
// en ucuz karışımı doğrusal programlama ile bulur.

import { solveLP } from './simplex.js';

const CEZA = 1e5;

const ACIK_MESAJ = {
  km: 'Kuru madde ihtiyacı karşılanamadı. Daha fazla kaba yem ekleyin veya yem sınırlarını (en çok kg) artırın.',
  nel: 'Enerji yetersiz kaldı. Arpa, mısır, kaliteli silaj gibi enerjili yemler ekleyin.',
  hp: 'Protein yetersiz kaldı. Ayçiçeği, pamuk veya soya küspesi gibi protein yemleri ekleyin.',
  ndf: 'Lif (NDF) yetersiz kaldı. Kuru ot, saman veya silaj ekleyin.',
  kaba: 'Kaba yem oranı karşılanamadı. Kuru ot veya silaj ekleyin.',
  ca: 'Kalsiyum yetersiz kaldı. Mermer tozu (kireç taşı) veya yonca ekleyin.',
  p: 'Fosfor yetersiz kaldı. DCP veya buğday kepeği ekleyin.',
  caUst: 'Kalsiyum fazlası önlenemedi. Yonca miktarını azaltmayı düşünün.',
  caP: 'Ca:P oranı dengelenemedi. Mermer tozu veya DCP ekleyin.',
};

export function enUcuzRasyon(ih, tumYemler) {
  const yemler = tumYemler.filter(y => y.elde);
  if (yemler.length === 0) {
    return { hata: 'Önce "Yemler" sekmesinden elinizdeki yemleri işaretleyin.' };
  }
  const d = yemler.map(y => y.km / 100);
  // Mineraller rumen dolgusu sayılmaz; aksi halde ucuz mermer tozu kuru madde açığını kapatmak için kullanılır.
  const dolgu = yemler.map((y, i) => (y.kat === 'mineral' ? 0 : d[i]));
  const D = ih.kmt;
  const kisitlar = [];
  const ekle = (anahtar, katsayi, op, sag, olcek, agirlik = 1) => {
    // '<=' kısıtları kesindir; '>=' kısıtları cezalı esnek kısıttır.
    const ceza = op === '>=' ? CEZA * agirlik : undefined;
    kisitlar.push({ anahtar, katsayi: katsayi.map(v => v / olcek), op, sag: sag / olcek, ceza });
  };
  const ekleEsnekUst = (anahtar, katsayi, sag, olcek, agirlik) => {
    kisitlar.push({ anahtar, katsayi: katsayi.map(v => v / olcek), op: '<=', sag: sag / olcek, ceza: CEZA * agirlik });
  };
  const her = (f) => yemler.map((y, i) => d[i] * f(y));

  ekle('km', dolgu, '>=', 0.97 * D, D, 2);
  ekle('kmUst', dolgu, '<=', 1.03 * D, D);
  ekle('nel', her(y => y.nel), '>=', ih.nel, ih.nel, 3);
  ekle('nelUst', her(y => y.nel), '<=', ih.nel * 1.06, ih.nel);
  ekle('hp', her(y => y.hp / 100), '>=', ih.hp, ih.hp, 3);
  ekle('hpUst', her(y => y.hp / 100), '<=', ih.hp + D * 0.02, ih.hp);
  // Sınırlara yuvarlama payı bırakılır (ör. NDF en az 28 yerine 28,5).
  const ndfAlt = ih.ndfMin + 0.5;
  const kabaAlt = ih.kabaMin + 1;
  ekle('ndf', her(y => (y.ndf - ndfAlt) / 100), '>=', 0, D * ndfAlt / 100, 2);
  if (ih.ndfMax < 100) ekle('ndfUst', her(y => (y.ndf - (ih.ndfMax - 1)) / 100), '<=', 0, D);
  ekle('kaba', her(y => (y.kaba ? 1 : 0) - kabaAlt / 100), '>=', 0, D * kabaAlt / 100, 2);
  ekle('ca', her(y => y.ca / 100), '>=', ih.caKg, ih.caKg, 1);
  ekle('p', her(y => y.p / 100), '>=', ih.pKg, ih.pKg, 1);
  const caUstKat = ih.durum === 'gecis' ? 1.4 : 1.9;
  ekleEsnekUst('caUst', her(y => y.ca / 100), ih.caKg * caUstKat, ih.caKg, 0.5);
  ekleEsnekUst('pUst', her(y => y.p / 100), ih.pKg * 1.4, ih.pKg, 0.3);
  ekle('caP', her(y => (y.ca - 1.5 * y.p) / 100), '>=', 0, ih.pKg, 0.5);
  ekleEsnekUst('caP', her(y => (y.ca - 3 * y.p) / 100), 0, ih.pKg, 0.5);
  ekle('yag', her(y => (y.yag - ih.yagMax) / 100), '<=', 0, D);
  yemler.forEach((y, i) => {
    const birim = yemler.map((_, j) => (j === i ? 1 : 0));
    if (y.max > 0) ekle(`max:${y.id}`, birim, '<=', y.max, 1);
    if (y.min > 0) ekle(`min:${y.id}`, birim, '>=', y.min, y.min, 1);
  });

  const sonuc = solveLP({ maliyet: yemler.map(y => y.fiyat), kisitlar });
  if (sonuc.durum !== 'optimum') {
    return { hata: 'Rasyon hesaplanamadı. Yem değerlerini kontrol edin.' };
  }

  const kalemler = [];
  sonuc.x.forEach((v, i) => {
    const y = yemler[i];
    const adim = y.kat === 'mineral' ? 0.01 : 0.1;
    const kg = Math.round(v / adim) * adim;
    if (kg > 0) kalemler.push({ id: y.id, kg: Number(kg.toFixed(2)) });
  });

  const eksikler = [];
  kisitlar.forEach((k, i) => {
    if (sonuc.acik[i] > 0.02) {
      const mesaj = ACIK_MESAJ[k.anahtar];
      if (mesaj) { if (!eksikler.includes(mesaj)) eksikler.push(mesaj); }
      else if (k.anahtar.startsWith('min:')) {
        const y = yemler.find(z => z.id === k.anahtar.slice(4));
        eksikler.push(`${y.ad} için girilen en az miktar kullanılamadı.`);
      }
    }
  });

  return { kalemler, eksikler };
}

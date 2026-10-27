// İhtiyaç hesabı ve rasyon değerlendirmesi.
// Enerji ve kuru madde tüketimi NRC (2001) Süt Sığırı denklemlerine, ham protein ve
// mineral hedefleri sahada kullanılan pratik oranlara dayanır.

export const DURUMLAR = {
  sagmal: 'Sağmal (süt veriyor)',
  kuru: 'Kuru dönem (uzak)',
  gecis: 'Geçiş dönemi (doğuma son 3 hafta)',
};

export const IRKLAR = {
  holstein: { ad: 'Holstein (Siyah Alaca)', ca: 650, yag: 3.6, protein: 3.2 },
  simental: { ad: 'Simental', ca: 700, yag: 4.0, protein: 3.4 },
  esmer: { ad: 'Esmer (Montofon / Brown Swiss)', ca: 650, yag: 4.0, protein: 3.4 },
  jersey: { ad: 'Jersey', ca: 450, yag: 4.9, protein: 3.8 },
  melez: { ad: 'Kültür melezi', ca: 500, yag: 3.9, protein: 3.3 },
  yerli: { ad: 'Yerli ırk (Boz, DAK, Yerli Kara, GAK)', ca: 350, yag: 4.5, protein: 3.5 },
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** 1 kg süt için gereken NEL (Mcal); laktoz %4,85 kabul edilir. */
export const sutNEL = (yag, protein) => 0.0929 * yag + 0.0547 * protein + 0.0395 * 4.85;

export function ihtiyacHesapla(h) {
  const ca = h.ca;
  const w75 = Math.pow(ca, 0.75);
  const sagmal = h.durum === 'sagmal';
  const sut = sagmal ? h.sut : 0;
  const notlar = [];

  let gebGun = (h.gebelikAy || 0) * 30.4;
  if (h.durum === 'kuru') gebGun = clamp(gebGun, 220, 279);
  if (h.durum === 'gecis') gebGun = clamp(gebGun, 259, 279);

  // Sıcaklık stresi: 25 °C üzerinde yem tüketimi düşer, yaşama payı artar.
  const sicakFazla = Math.max(0, (h.sicaklik ?? 15) - 25);
  const sicakTuketim = 1 - Math.min(0.25, 0.02 * sicakFazla);
  const sicakBakim = 1 + Math.min(0.2, 0.01 * sicakFazla);
  if (sicakFazla > 0) {
    notlar.push('Sıcaklık stresi: yem tüketimi azalır. Gölgelik, bol temiz su ve serin saatlerde yemleme sağlayın; rasyonun enerji yoğunluğu artırılmalıdır.');
  }

  // Kuru madde tüketimi (kg/gün)
  let kmt;
  if (sagmal) {
    const fcm = 0.4 * sut + 15 * sut * h.yag / 100; // %4 yağa düzeltilmiş süt
    const hafta = (h.lg || 0) / 7;
    kmt = (0.372 * fcm + 0.0968 * w75) * (1 - Math.exp(-0.192 * (hafta + 3.67)));
  } else {
    const yuzde = 1.97 - 0.75 * Math.exp(0.16 * (gebGun - 280));
    kmt = yuzde / 100 * ca;
  }
  kmt *= sicakTuketim;

  // Net enerji (Mcal/gün)
  let bakim = 0.08 * w75 * sicakBakim;
  if (h.mera) bakim *= 1.1;
  let buyume = 0;
  if (sagmal && h.lsira === 1) buyume = 0.2 * bakim;
  if (sagmal && h.lsira === 2) buyume = 0.1 * bakim;
  const laktasyon = sut * sutNEL(h.yag, h.protein);
  const gebelik = gebGun >= 190
    ? ((0.00318 * gebGun - 0.0352) * (0.06275 * ca / 45)) / 0.218
    : 0;
  const nel = bakim + buyume + laktasyon + gebelik;

  // Ham protein hedefi (% KM)
  let hpYuzde;
  if (sagmal) {
    hpYuzde = sut < 15 ? 14 : sut < 25 ? 15 : sut < 35 ? 16 : sut < 45 ? 17 : 18;
    if ((h.lg || 0) <= 60) hpYuzde += 0.5;
  } else {
    hpYuzde = h.durum === 'gecis' ? 14 : 12.5;
  }

  const ndfMin = sagmal ? 28 : h.durum === 'gecis' ? 32 : 35;
  // Düşük verimli ineklerde daha lifli rasyon kabul edilebilir.
  const ndfMax = sagmal ? (sut < 20 ? 45 : sut < 30 ? 42 : 40) : 100;
  const kabaMin = sagmal ? 40 : h.durum === 'gecis' ? 50 : 60;
  const yagMax = sagmal ? 6 : 5;
  const caYuzde = sagmal ? (sut >= 30 ? 0.70 : 0.62) : h.durum === 'gecis' ? 0.48 : 0.45;
  const pYuzde = sagmal ? (sut >= 30 ? 0.38 : 0.35) : h.durum === 'gecis' ? 0.28 : 0.26;

  // Su tüketimi (Murphy ve ark., 1983; sodyum alımı ortalama alındı)
  const su = 18 + 1.58 * kmt + 0.9 * sut + 1.2 * Math.max(0, h.sicaklik ?? 15);

  return {
    durum: h.durum, sut, yag: h.yag, protein: h.protein,
    kmt, nel, bakim, buyume, laktasyon, gebelik,
    nelYogunluk: nel / kmt,
    hpYuzde, hp: kmt * hpYuzde / 100,
    ndfMin, ndfMax, kabaMin, yagMax,
    caYuzde, pYuzde, caKg: kmt * caYuzde / 100, pKg: kmt * pYuzde / 100,
    su, notlar,
  };
}

// Yüzde sınırlarında tolerans (puan); 0,1 kg'lık yuvarlamaların gereksiz uyarı üretmemesi için.
const TOL = 0.5;

/** Rasyonu (yaş kg) ihtiyaca göre değerlendirir. */
export function degerlendir(rasyon, yemler, ih) {
  const harita = new Map(yemler.map(y => [y.id, y]));
  const t = { yas: 0, km: 0, nel: 0, hp: 0, ndf: 0, yag: 0, ca: 0, p: 0, kaba: 0, maliyet: 0 };
  const kalemler = [];
  for (const k of rasyon) {
    const y = harita.get(k.id);
    if (!y || !(k.kg > 0)) continue;
    const km = k.kg * y.km / 100;
    const maliyet = k.kg * y.fiyat;
    t.yas += k.kg;
    t.km += km;
    t.nel += km * y.nel;
    t.hp += km * y.hp / 100;
    t.ndf += km * y.ndf / 100;
    t.yag += km * y.yag / 100;
    t.ca += km * y.ca / 100;
    t.p += km * y.p / 100;
    if (y.kaba) t.kaba += km;
    t.maliyet += maliyet;
    kalemler.push({ yem: y, kg: k.kg, km, maliyet });
  }

  const yuz = (a) => (t.km > 0 ? a / t.km * 100 : 0);
  const oran = {
    hp: yuz(t.hp), ndf: yuz(t.ndf), yag: yuz(t.yag), ca: yuz(t.ca), p: yuz(t.p),
    kaba: yuz(t.kaba), nelYogunluk: t.km > 0 ? t.nel / t.km : 0,
  };

  const aralik = (deger, alt, ust) => (deger < alt ? 'dusuk' : deger > ust ? 'yuksek' : 'uygun');
  const kontroller = [
    { ad: 'Kuru madde', birim: 'kg', ihtiyac: ih.kmt, rasyon: t.km, durum: aralik(t.km / ih.kmt, 0.95, 1.06) },
    { ad: 'Enerji (NEL)', birim: 'Mcal', ihtiyac: ih.nel, rasyon: t.nel, durum: aralik(t.nel / ih.nel, 0.97, ih.durum === 'sagmal' ? 1.08 : 1.12) },
    { ad: 'Ham protein', birim: 'kg', ihtiyac: ih.hp, rasyon: t.hp, durum: aralik(t.hp / ih.hp, 0.96, 1.15), ek: `%${fmt1(oran.hp)} KM` },
    { ad: 'NDF (lif)', birim: '% KM', ihtiyac: ih.ndfMin, rasyon: oran.ndf, durum: aralik(oran.ndf, ih.ndfMin - TOL, ih.ndfMax + TOL), enAz: true },
    { ad: 'Kaba yem oranı', birim: '% KM', ihtiyac: ih.kabaMin, rasyon: oran.kaba, durum: oran.kaba < ih.kabaMin - TOL ? 'dusuk' : 'uygun', enAz: true },
    { ad: 'Kalsiyum', birim: 'g', ihtiyac: ih.caKg * 1000, rasyon: t.ca * 1000, durum: aralik(t.ca / ih.caKg, 0.95, ih.durum === 'gecis' ? 1.6 : 2.2) },
    { ad: 'Fosfor', birim: 'g', ihtiyac: ih.pKg * 1000, rasyon: t.p * 1000, durum: aralik(t.p / ih.pKg, 0.95, 1.5) },
    { ad: 'Ham yağ', birim: '% KM', ihtiyac: ih.yagMax, rasyon: oran.yag, durum: oran.yag > ih.yagMax + TOL ? 'yuksek' : 'uygun', enCok: true },
  ];

  const uyarilar = [];
  if (t.km > 0) {
    if (oran.kaba < ih.kabaMin - TOL || oran.ndf < ih.ndfMin - TOL) {
      uyarilar.push('Kaba yem / lif yetersiz: rumen asitlenmesi (asidoz), topallık ve süt yağında düşme riski var. Kaliteli kuru ot veya silaj artırın.');
    }
    if (ih.durum === 'sagmal' && oran.ndf > ih.ndfMax + TOL) {
      uyarilar.push('Lif (NDF) çok yüksek: rumen dolgunluğu yem tüketimini ve süt verimini kısıtlar. Samanı azaltıp daha kaliteli kaba yem kullanın.');
    }
    if (oran.yag > ih.yagMax + TOL) {
      uyarilar.push('Rasyonda yağ fazla: rumende lif sindirimi bozulur, süt yağı düşebilir. Çiğit, tam yağlı soya veya DDGS miktarını azaltın.');
    }
    if (t.hp / ih.hp > 1.2) {
      uyarilar.push('Protein fazlası hem pahalıdır hem de kan üresini yükseltip döl tutmayı olumsuz etkileyebilir.');
    }
    if (t.p > 0 && (t.ca / t.p < 1.2 || t.ca / t.p > 3.5)) {
      uyarilar.push(`Ca:P oranı ${fmt1(t.ca / t.p)} — 1,5 ile 2,5 arasında tutulması önerilir.`);
    }
    if (ih.durum === 'gecis' && oran.ca > 0.7) {
      uyarilar.push('Doğuma yakın dönemde yüksek kalsiyum süt humması (doğum felci) riskini artırır. Yoncayı sınırlayın; anyonik tuz kullanımı için veteriner hekiminize danışın.');
    }
    if (ih.durum !== 'sagmal' && t.nel / ih.nel > 1.15) {
      uyarilar.push('Kuru dönemde fazla enerji yağlanmaya, doğum sonrası ketozis ve yağlı karaciğer sendromuna yol açar.');
    }
    if (ih.durum === 'sagmal' && t.km / ih.kmt > 1.1) {
      uyarilar.push('Rasyon, ineğin tahmini yem tüketiminden fazla; hayvan hepsini yiyemeyebilir ve yemlik artığı oluşur.');
    }
    if (ih.durum === 'sagmal' && t.km / ih.kmt < 0.92) {
      uyarilar.push('Rasyon, ineğin yiyebileceğinden az. Hayvan aç kalır ve süt verimi düşer.');
    }
  }

  // Rasyonun enerjisine göre karşılanabilecek süt miktarı
  const sutBasinaNEL = sutNEL(ih.yag || 3.8, ih.protein || 3.3);
  const enerjiyeGoreSut = Math.max(0, (t.nel - ih.bakim - ih.buyume - ih.gebelik) / sutBasinaNEL);

  return { toplam: t, oran, kalemler, kontroller, uyarilar, enerjiyeGoreSut };
}

function fmt1(v) {
  return (Math.round(v * 10) / 10).toLocaleString('tr-TR');
}

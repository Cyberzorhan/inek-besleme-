// Küçük boyutlu doğrusal programlama çözücüsü (tablo simpleks yöntemi).
//
// En küçükle: maliyet · x,   x >= 0
// Kısıtlar:
//   op '<=' : katsayı · x <= sağ   (sağ >= 0; `ceza` verilirse esnek, verilmezse kesin)
//   op '>=' : katsayı · x >= sağ   (esnek: açık kalırsa birim başına `ceza` ödenir)
//
// '>=' kısıtlarının esnek olması sayesinde problem her zaman çözülebilir; karşılanamayan
// ihtiyaçlar `acik` dizisinde döner. Böylece kullanıcıya "çözüm yok" yerine en yakın rasyon
// ve eksik kalan besin maddesi gösterilebilir.

const EPS = 1e-9;

export function solveLP({ maliyet, kisitlar, maxIter = 10000 }) {
  const n = maliyet.length;
  const m = kisitlar.length;
  const c = maliyet.slice();
  const bilgi = [];
  let sutun = n;
  for (const k of kisitlar) {
    if (!(k.sag >= 0)) throw new Error('Kısıt sağ tarafı negatif olamaz');
    if (k.op === '<=') {
      if (k.ceza) {
        bilgi.push({ bol: sutun++, asim: sutun++ });
        c.push(0, k.ceza);
      } else {
        bilgi.push({ bol: sutun++ });
        c.push(0);
      }
    } else {
      bilgi.push({ fazla: sutun++, esnek: sutun++ });
      c.push(0, k.ceza ?? 1e6);
    }
  }
  const N = sutun;
  const T = kisitlar.map((k, i) => {
    const satir = new Float64Array(N + 1);
    for (let j = 0; j < n; j++) satir[j] = k.katsayi[j] || 0;
    const b = bilgi[i];
    if (k.op === '<=') {
      satir[b.bol] = 1;
      if (b.asim !== undefined) satir[b.asim] = -1;
    } else { satir[b.fazla] = -1; satir[b.esnek] = 1; }
    satir[N] = k.sag;
    return satir;
  });
  const taban = bilgi.map(b => (b.bol !== undefined ? b.bol : b.esnek));

  let iter = 0;
  for (; iter < maxIter; iter++) {
    // Giren değişken: ilk iterasyonlarda en negatif indirgenmiş maliyet (Dantzig),
    // döngüye girmemek için sonra Bland kuralı.
    const bland = iter > 2000;
    let gir = -1;
    let enIyi = -EPS;
    const tabanda = new Uint8Array(N);
    for (const b of taban) tabanda[b] = 1;
    for (let j = 0; j < N; j++) {
      if (tabanda[j]) continue;
      let z = 0;
      for (let i = 0; i < m; i++) z += c[taban[i]] * T[i][j];
      const ind = c[j] - z;
      if (ind < enIyi) {
        gir = j;
        if (bland) break;
        enIyi = ind;
      }
    }
    if (gir < 0) break;

    let cik = -1;
    let oran = Infinity;
    for (let i = 0; i < m; i++) {
      const a = T[i][gir];
      if (a > EPS) {
        const r = T[i][N] / a;
        if (r < oran - 1e-12 || (Math.abs(r - oran) <= 1e-12 && taban[i] < taban[cik])) {
          oran = r;
          cik = i;
        }
      }
    }
    if (cik < 0) return { durum: 'sinirsiz' };

    const p = T[cik];
    const pv = p[gir];
    for (let j = 0; j <= N; j++) p[j] /= pv;
    for (let i = 0; i < m; i++) {
      if (i === cik) continue;
      const f = T[i][gir];
      if (Math.abs(f) < 1e-15) continue;
      const s = T[i];
      for (let j = 0; j <= N; j++) s[j] -= f * p[j];
    }
    taban[cik] = gir;
  }

  const deger = new Float64Array(N);
  taban.forEach((b, i) => { deger[b] = T[i][N]; });
  const x = Array.from(deger.subarray(0, n));
  const acik = bilgi.map(b => (b.esnek !== undefined ? deger[b.esnek] : b.asim !== undefined ? deger[b.asim] : 0));
  const amac = x.reduce((s, v, j) => s + v * maliyet[j], 0);
  return { durum: iter >= maxIter ? 'iterasyon' : 'optimum', x, acik, amac };
}

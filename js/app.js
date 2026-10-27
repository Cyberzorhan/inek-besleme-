import { VARSAYILAN_YEMLER, KATEGORILER } from './feeds.js';
import { ihtiyacHesapla, degerlendir, DURUMLAR, IRKLAR } from './nutrition.js';
import { enUcuzRasyon } from './optimizer.js';

const ANAHTAR = 'sutrasyon.v1';

// ---------- Yardımcılar ----------
const $ = (s, el = document) => el.querySelector(s);
const sayi = (v, b = 1) => (Number.isFinite(v)
  ? v.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: b })
  : '–');
const tl = (v) => `${sayi(v, v < 100 ? 2 : 0)} ₺`;
const oku = (s) => {
  const v = parseFloat(String(s).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(v) ? v : 0;
};
const kacis = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const kopya = (o) => JSON.parse(JSON.stringify(o));
const miktar = (y, kg) => (y.kat === 'mineral' && kg < 1 ? `${sayi(kg * 1000, 0)} g` : `${sayi(kg, 1)} kg`);
const DURUM_AD = { uygun: 'uygun', dusuk: 'düşük', yuksek: 'yüksek' };

function bildir(mesaj) {
  const el = $('#bildirim');
  el.textContent = mesaj;
  el.classList.add('goster');
  clearTimeout(bildir.t);
  bildir.t = setTimeout(() => el.classList.remove('goster'), 2600);
}

// ---------- Durum ----------
function varsayilan() {
  return {
    hayvan: {
      irk: 'holstein', durum: 'sagmal', ca: 650, sut: 30, yag: 3.6, protein: 3.2,
      lg: 100, lsira: 2, gebelikAy: 0, mera: false, sicaklik: 15,
    },
    rasyon: [],
    ekonomi: { sutFiyat: 20, hayvanSayisi: 1 },
    yemler: kopya(VARSAYILAN_YEMLER),
    kayitlar: [],
  };
}

function yukle() {
  const d = varsayilan();
  try {
    const s = JSON.parse(localStorage.getItem(ANAHTAR));
    if (!s) return d;
    const yemler = Array.isArray(s.yemler) ? s.yemler : d.yemler;
    // Uygulama güncellenince eklenen yeni varsayılan yemleri listeye kat.
    for (const y of VARSAYILAN_YEMLER) {
      if (!yemler.some(z => z.id === y.id)) yemler.push(kopya(y));
    }
    return {
      hayvan: { ...d.hayvan, ...s.hayvan },
      rasyon: Array.isArray(s.rasyon) ? s.rasyon : [],
      ekonomi: { ...d.ekonomi, ...s.ekonomi },
      yemler,
      kayitlar: Array.isArray(s.kayitlar) ? s.kayitlar : [],
    };
  } catch {
    return d;
  }
}

let durum = yukle();
const kaydet = () => {
  try { localStorage.setItem(ANAHTAR, JSON.stringify(durum)); } catch { /* özel sekme vb. */ }
};
const ihtiyac = () => ihtiyacHesapla(durum.hayvan);
const yemBul = (id) => durum.yemler.find(y => y.id === id);

// ---------- Sekmeler ----------
const cizimler = { hayvan: cizHayvan, rasyon: cizRasyon, yemler: cizYemler, kayit: cizKayit, bilgi: () => {} };
let aktifSekme = 'hayvan';

function sekmeAc(ad) {
  aktifSekme = ad;
  document.querySelectorAll('.sekme').forEach(s => { s.hidden = s.id !== `sekme-${ad}`; });
  document.querySelectorAll('nav.alt button').forEach(b => b.classList.toggle('aktif', b.dataset.sekme === ad));
  $('#baslik').textContent = ad === 'hayvan' ? 'Süt Rasyon' : $(`#sekme-${ad}`).dataset.baslik;
  cizimler[ad]();
  window.scrollTo(0, 0);
}
document.querySelectorAll('nav.alt button').forEach(b => b.addEventListener('click', () => sekmeAc(b.dataset.sekme)));

// ---------- Form yardımcıları ----------
function alan(etiket, ad, deger, birim = '', ekSinif = '') {
  return `<label class="alan ${ekSinif}">${etiket}
    <span class="girdi-kutu"><input type="text" inputmode="decimal" name="${ad}" value="${kacis(String(deger).replace('.', ','))}" autocomplete="off">
    ${birim ? `<span class="birim">${birim}</span>` : ''}</span></label>`;
}
function secim(etiket, ad, secenekler, deger, ekSinif = '') {
  const opt = Object.entries(secenekler).map(([k, v]) => `<option value="${k}" ${String(k) === String(deger) ? 'selected' : ''}>${kacis(v)}</option>`).join('');
  return `<label class="alan ${ekSinif}">${etiket}<select name="${ad}">${opt}</select></label>`;
}

// ---------- Hayvan ----------
function cizHayvan() {
  const h = durum.hayvan;
  const sagmal = h.durum === 'sagmal';
  const irklar = Object.fromEntries(Object.entries(IRKLAR).map(([k, v]) => [k, v.ad]));
  $('#sekme-hayvan').innerHTML = `
    <form class="kart" id="hayvan-form" onsubmit="return false">
      <h2>İnek bilgileri</h2>
      <div class="izgara">
        ${secim('Irk', 'irk', irklar, h.irk, 'tam')}
        ${secim('Dönem', 'durum', DURUMLAR, h.durum, 'tam')}
        ${alan('Canlı ağırlık', 'ca', h.ca, 'kg')}
        ${secim('Kaçıncı doğum', 'lsira', { 1: '1. doğum (düve)', 2: '2. doğum', 3: '3 ve üzeri' }, h.lsira)}
        ${sagmal ? `
          ${alan('Günlük süt', 'sut', h.sut, 'kg')}
          ${alan('Sağımda geçen gün', 'lg', h.lg, 'gün')}
          ${alan('Süt yağı', 'yag', h.yag, '%')}
          ${alan('Süt proteini', 'protein', h.protein, '%')}` : ''}
        ${secim('Gebelik', 'gebelikAy', { 0: 'Gebe değil / bilinmiyor', 1: '1. ay', 2: '2. ay', 3: '3. ay', 4: '4. ay', 5: '5. ay', 6: '6. ay', 7: '7. ay', 8: '8. ay', 9: '9. ay' }, h.gebelikAy)}
        ${alan('Ortalama hava sıcaklığı', 'sicaklik', h.sicaklik, '°C')}
        <label class="onay tam"><input type="checkbox" name="mera" ${h.mera ? 'checked' : ''}> Hayvan merada otluyor (yürüme payı eklenir)</label>
      </div>
      <p class="kucuk">Süt yağı ve proteini bilinmiyorsa ırk ortalaması kullanılır. Bunları süt toplama merkezinin analiz fişinden öğrenebilirsiniz.</p>
    </form>
    <div id="ihtiyac-kart"></div>
    <button class="btn ana genis" id="rasyona-git">Rasyona geç →</button>`;

  const form = $('#hayvan-form');
  form.addEventListener('input', (e) => {
    const { name, value, type, checked } = e.target;
    if (!name) return;
    if (type === 'checkbox') h[name] = checked;
    else if (['irk', 'durum'].includes(name)) h[name] = value;
    else h[name] = oku(value);
    if (name === 'irk') {
      const p = IRKLAR[value];
      Object.assign(h, { ca: p.ca, yag: p.yag, protein: p.protein });
    }
    kaydet();
    if (['irk', 'durum'].includes(name)) cizHayvan();
    else cizIhtiyac();
  });
  $('#rasyona-git').addEventListener('click', () => sekmeAc('rasyon'));
  cizIhtiyac();
}

function cizIhtiyac() {
  const h = durum.hayvan;
  const kart = $('#ihtiyac-kart');
  if (!(h.ca >= 150 && h.ca <= 1200)) {
    kart.innerHTML = '<div class="kart hata-kutu">Canlı ağırlık 150 ile 1200 kg arasında olmalıdır.</div>';
    return;
  }
  const ih = ihtiyac();
  kart.innerHTML = `
    <div class="kart">
      <h2>Günlük besin ihtiyacı</h2>
      <div class="kutucuklar">
        ${kutucuk('Kuru madde tüketimi', sayi(ih.kmt), 'kg/gün')}
        ${kutucuk('Enerji (NEL)', sayi(ih.nel), 'Mcal/gün')}
        ${kutucuk('Ham protein', sayi(ih.hp, 2), `kg (%${sayi(ih.hpYuzde)} KM)`)}
        ${kutucuk('Enerji yoğunluğu', sayi(ih.nelYogunluk, 2), 'Mcal/kg KM')}
        ${kutucuk('Kalsiyum / Fosfor', `${sayi(ih.caKg * 1000, 0)} / ${sayi(ih.pKg * 1000, 0)}`, 'g/gün')}
        ${kutucuk('Su ihtiyacı', `~${sayi(ih.su, 0)}`, 'litre/gün')}
      </div>
      <h3>Rasyon kuralları</h3>
      <ul class="kucuk">
        <li>Kaba yem oranı en az <b>%${ih.kabaMin}</b> (kuru madde olarak)</li>
        <li>NDF (lif) en az <b>%${ih.ndfMin}</b>${ih.ndfMax < 100 ? `, en çok %${ih.ndfMax}` : ''}</li>
        <li>Ham yağ en çok <b>%${ih.yagMax}</b></li>
      </ul>
      <h3>Enerji dağılımı</h3>
      <p class="kucuk">Yaşama payı ${sayi(ih.bakim)} · ${ih.buyume ? `Büyüme ${sayi(ih.buyume)} · ` : ''}Süt ${sayi(ih.laktasyon)} · Gebelik ${sayi(ih.gebelik)} Mcal</p>
    </div>
    ${ih.notlar.length ? `<div class="kart uyari-kutu"><ul>${ih.notlar.map(n => `<li>${n}</li>`).join('')}</ul></div>` : ''}`;
}

const kutucuk = (etiket, deger, birim) => `<div class="kutucuk"><div class="etiket">${etiket}</div><div class="deger">${deger} <small>${birim}</small></div></div>`;

// ---------- Rasyon ----------
function yemSecenekleri(secili) {
  return Object.entries(KATEGORILER).map(([kat, kAd]) => {
    const liste = durum.yemler.filter(y => y.kat === kat);
    if (!liste.length) return '';
    return `<optgroup label="${kacis(kAd)}">${liste.map(y => `<option value="${y.id}" ${y.id === secili ? 'selected' : ''}>${y.elde ? '' : '◦ '}${kacis(y.ad)}</option>`).join('')}</optgroup>`;
  }).join('');
}

function hayvanOzeti() {
  const h = durum.hayvan;
  const irk = IRKLAR[h.irk]?.ad.split(' (')[0] ?? '';
  return h.durum === 'sagmal'
    ? `${irk}, ${sayi(h.ca, 0)} kg, günde ${sayi(h.sut)} kg süt, ${sayi(h.lg, 0)}. gün`
    : `${irk}, ${sayi(h.ca, 0)} kg, ${DURUMLAR[h.durum].toLowerCase()}`;
}

function cizRasyon() {
  const e = durum.ekonomi;
  $('#sekme-rasyon').innerHTML = `
    <div class="kart">
      <div class="kucuk">İnek: <b>${kacis(hayvanOzeti())}</b> · <a href="#" id="hayvana-don">değiştir</a></div>
      <div class="dugmeler">
        <button class="btn ana" id="optimize">⚡ En ucuz rasyonu hesapla</button>
      </div>
      <p class="kucuk">Yalnızca <b>Yemler</b> sekmesinde “elimde var” olarak işaretlediğiniz yemler kullanılır.</p>
      <div id="opt-sonuc"></div>
    </div>
    <div class="kart">
      <h2>İnek başı günlük rasyon</h2>
      <div id="satirlar"></div>
      <div class="dugmeler">
        <button class="btn" id="yem-ekle">+ Yem ekle</button>
        <button class="btn tehlike" id="temizle">Temizle</button>
      </div>
    </div>
    <div id="sonuc"></div>
    <div class="kart">
      <h2>Ekonomi ve sürü</h2>
      <form class="izgara" id="ekonomi-form" onsubmit="return false">
        ${alan('Süt satış fiyatı', 'sutFiyat', e.sutFiyat, '₺/kg')}
        ${alan('Hayvan sayısı', 'hayvanSayisi', e.hayvanSayisi, 'baş')}
      </form>
      <div id="ekonomi"></div>
    </div>`;

  $('#hayvana-don').addEventListener('click', (ev) => { ev.preventDefault(); sekmeAc('hayvan'); });
  $('#optimize').addEventListener('click', optimizeEt);
  $('#yem-ekle').addEventListener('click', () => {
    const kullanilan = new Set(durum.rasyon.map(r => r.id));
    const ilk = durum.yemler.find(y => y.elde && !kullanilan.has(y.id)) || durum.yemler[0];
    durum.rasyon.push({ id: ilk.id, kg: 0 });
    kaydet();
    cizSatirlar();
    cizSonuc();
    const girdiler = document.querySelectorAll('#satirlar input');
    girdiler[girdiler.length - 1]?.focus();
  });
  $('#temizle').addEventListener('click', () => {
    if (durum.rasyon.length && !confirm('Rasyondaki tüm yemler silinsin mi?')) return;
    durum.rasyon = [];
    $('#opt-sonuc').innerHTML = '';
    kaydet();
    cizSatirlar();
    cizSonuc();
  });
  $('#ekonomi-form').addEventListener('input', (ev) => {
    durum.ekonomi[ev.target.name] = oku(ev.target.value);
    kaydet();
    cizSonuc();
  });

  const satirlar = $('#satirlar');
  satirlar.addEventListener('input', (ev) => {
    const i = Number(ev.target.closest('.satir')?.dataset.i);
    if (!Number.isInteger(i)) return;
    if (ev.target.tagName === 'SELECT') durum.rasyon[i].id = ev.target.value;
    else durum.rasyon[i].kg = oku(ev.target.value);
    kaydet();
    satirBilgisi(i);
    cizSonuc();
  });
  satirlar.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-sil]');
    if (!btn) return;
    durum.rasyon.splice(Number(btn.dataset.sil), 1);
    kaydet();
    cizSatirlar();
    cizSonuc();
  });

  cizSatirlar();
  cizSonuc();
}

function cizSatirlar() {
  const el = $('#satirlar');
  if (!durum.rasyon.length) {
    el.innerHTML = '<p class="bos">Henüz yem eklenmedi.<br>“En ucuz rasyonu hesapla” düğmesine basın veya yem ekleyin.</p>';
    return;
  }
  el.innerHTML = durum.rasyon.map((r, i) => {
    const y = yemBul(r.id);
    const adim = y?.kat === 'mineral' ? 'kg (0,05 = 50 g)' : 'kg';
    return `<div class="satir" data-i="${i}">
      <select aria-label="Yem">${yemSecenekleri(r.id)}</select>
      <span class="girdi-kutu"><input type="text" inputmode="decimal" value="${r.kg ? String(r.kg).replace('.', ',') : ''}" placeholder="0" aria-label="Miktar ${adim}"><span class="birim">kg</span></span>
      <button class="ikon-btn" data-sil="${i}" aria-label="Sil">✕</button>
      <div class="alt-bilgi" id="bilgi-${i}"></div>
    </div>`;
  }).join('');
  durum.rasyon.forEach((_, i) => satirBilgisi(i));
}

function satirBilgisi(i) {
  const r = durum.rasyon[i];
  const y = yemBul(r.id);
  const el = $(`#bilgi-${i}`);
  if (!y || !el) return;
  el.textContent = r.kg > 0
    ? `${miktar(y, r.kg)} yaş = ${sayi(r.kg * y.km / 100, 2)} kg KM · ${tl(r.kg * y.fiyat)}`
    : `KM %${sayi(y.km)} · NEL ${sayi(y.nel, 2)} · HP %${sayi(y.hp)} · ${tl(y.fiyat)}/kg`;
}

function optimizeEt() {
  const ih = ihtiyac();
  const s = enUcuzRasyon(ih, durum.yemler);
  const el = $('#opt-sonuc');
  if (s.hata) {
    el.innerHTML = `<div class="kart hata-kutu">${kacis(s.hata)}</div>`;
    return;
  }
  durum.rasyon = s.kalemler;
  kaydet();
  cizSatirlar();
  cizSonuc();
  el.innerHTML = s.eksikler.length
    ? `<div class="kart hata-kutu"><b>Elinizdeki yemlerle ihtiyaç tam karşılanamadı:</b><ul>${s.eksikler.map(m => `<li>${kacis(m)}</li>`).join('')}</ul><span class="kucuk">En yakın rasyon aşağıda gösterildi.</span></div>`
    : '';
  bildir(s.eksikler.length ? 'En yakın rasyon hesaplandı' : 'En düşük maliyetli rasyon hesaplandı');
}

function cizSonuc() {
  const ih = ihtiyac();
  const d = degerlendir(durum.rasyon, durum.yemler, ih);
  const t = d.toplam;
  const el = $('#sonuc');
  if (t.km <= 0) {
    el.innerHTML = '';
    $('#ekonomi').innerHTML = '';
    return;
  }

  const satir = (k) => {
    const dec = k.birim === 'g' ? 0 : k.birim === 'kg' ? (k.ad === 'Ham protein' ? 2 : 1) : 1;
    const ihtiyacYazi = k.enAz ? `en az ${sayi(k.ihtiyac, dec)}` : k.enCok ? `en çok ${sayi(k.ihtiyac, dec)}` : sayi(k.ihtiyac, dec);
    return `<tr><td>${k.ad}<div class="kucuk">${k.birim}${k.ek ? ` · ${k.ek}` : ''}</div></td>
      <td>${ihtiyacYazi}</td><td><b>${sayi(k.rasyon, dec)}</b></td>
      <td><span class="rozet ${k.durum}">${DURUM_AD[k.durum]}</span></td></tr>`;
  };

  const kesif = 100 - d.oran.kaba;
  el.innerHTML = `
    <div class="kart">
      <h2>Rasyon değerlendirmesi</h2>
      <table>
        <thead><tr><th>Besin maddesi</th><th>İhtiyaç</th><th>Rasyon</th><th></th></tr></thead>
        <tbody>${d.kontroller.map(satir).join('')}</tbody>
      </table>
      <p class="kucuk">Toplam ${sayi(t.yas)} kg yaş yem · Kaba/kesif oranı %${sayi(d.oran.kaba, 0)} / %${sayi(kesif, 0)} · Enerji yoğunluğu ${sayi(d.oran.nelYogunluk, 2)} Mcal/kg KM</p>
      ${durum.hayvan.durum === 'sagmal' ? `<p class="kucuk">Bu rasyonun enerjisi yaklaşık <b>${sayi(d.enerjiyeGoreSut)} kg</b> süte yeter.</p>` : ''}
    </div>
    ${d.uyarilar.length ? `<div class="kart uyari-kutu"><ul>${d.uyarilar.map(u => `<li>${u}</li>`).join('')}</ul></div>` : ''}
    <div class="kart">
      <div class="dugmeler">
        <button class="btn" id="paylas">📤 Paylaş</button>
        <button class="btn" id="kaydet">💾 Kaydet</button>
        <button class="btn" id="yazdir">🖨️ Yazdır</button>
      </div>
      <p class="kucuk">Tuz (50–100 g) ve vitamin-mineral karması bu hesaba dahil değildir; ayrıca verilmelidir.</p>
    </div>`;
  $('#paylas').addEventListener('click', paylas);
  $('#kaydet').addEventListener('click', rasyonKaydet);
  $('#yazdir').addEventListener('click', () => window.print());

  cizEkonomi(d);
}

function cizEkonomi(d) {
  const e = durum.ekonomi;
  const h = durum.hayvan;
  const n = Math.max(1, Math.round(e.hayvanSayisi || 1));
  const maliyet = d.toplam.maliyet;
  const sagmal = h.durum === 'sagmal' && h.sut > 0;
  const gelir = sagmal ? h.sut * e.sutFiyat : 0;
  const kar = gelir - maliyet;
  const kalemler = d.kalemler.filter(k => k.kg > 0);
  $('#ekonomi').innerHTML = `
    <div class="ozet" style="margin-top:12px">
      <div><div class="etiket">Yem maliyeti / inek</div><div class="deger">${tl(maliyet)}</div></div>
      ${sagmal ? `
      <div><div class="etiket">1 kg süt yem maliyeti</div><div class="deger">${tl(maliyet / h.sut)}</div></div>
      <div><div class="etiket">Süt geliri / inek</div><div class="deger">${tl(gelir)}</div></div>
      <div><div class="etiket">Yem sonrası kalan</div><div class="deger ${kar >= 0 ? 'iyi' : 'kotu'}">${tl(kar)}</div></div>` : ''}
    </div>
    ${n > 1 ? `
    <h3>${n} baş için ihtiyaç</h3>
    <table>
      <thead><tr><th>Yem</th><th>Günlük</th><th>Aylık (30 gün)</th></tr></thead>
      <tbody>${kalemler.map(k => `<tr><td>${kacis(k.yem.ad)}</td><td>${sayi(k.kg * n, 1)} kg</td><td>${sayi(k.kg * n * 30 / 1000, 2)} ton</td></tr>`).join('')}
      <tr><td><b>Toplam maliyet</b></td><td><b>${tl(maliyet * n)}</b></td><td><b>${tl(maliyet * n * 30)}</b></td></tr></tbody>
    </table>` : ''}`;
}

function paylasMetni() {
  const ih = ihtiyac();
  const d = degerlendir(durum.rasyon, durum.yemler, ih);
  const satirlar = d.kalemler.map(k => `• ${k.yem.ad}: ${miktar(k.yem, k.kg)}`);
  return [
    '🐄 Süt Rasyon – günlük inek başı rasyon',
    hayvanOzeti(),
    '',
    ...satirlar,
    '',
    `Kuru madde: ${sayi(d.toplam.km)} kg (ihtiyaç ${sayi(ih.kmt)})`,
    `Enerji: ${sayi(d.toplam.nel)} Mcal (ihtiyaç ${sayi(ih.nel)})`,
    `Ham protein: %${sayi(d.oran.hp)} KM`,
    `Maliyet: ${tl(d.toplam.maliyet)} / inek / gün`,
    '+ tuz ve vitamin-mineral karması',
  ].join('\n');
}

async function paylas() {
  const metin = paylasMetni();
  if (navigator.share) {
    try { await navigator.share({ title: 'Süt Rasyon', text: metin }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(metin);
    bildir('Rasyon panoya kopyalandı');
  } catch {
    window.open(`https://wa.me/?text=${encodeURIComponent(metin)}`, '_blank');
  }
}

function rasyonKaydet() {
  const varsayilanAd = `${hayvanOzeti().split(',')[0]} – ${new Date().toLocaleDateString('tr-TR')}`;
  const ad = prompt('Rasyona bir ad verin:', varsayilanAd);
  if (!ad) return;
  const ih = ihtiyac();
  const d = degerlendir(durum.rasyon, durum.yemler, ih);
  durum.kayitlar.unshift({
    ad: ad.trim(),
    tarih: new Date().toISOString(),
    hayvan: kopya(durum.hayvan),
    rasyon: kopya(durum.rasyon),
    maliyet: d.toplam.maliyet,
  });
  kaydet();
  bildir('Rasyon kaydedildi');
}

// ---------- Yemler ----------
let yemArama = '';
const acikYemler = new Set();

function cizYemler() {
  $('#sekme-yemler').innerHTML = `
    <div class="kart">
      <input type="search" id="yem-ara" placeholder="Yem ara…" value="${kacis(yemArama)}" aria-label="Yem ara">
      <p class="kucuk">☑ işaretli yemler “elimde var” demektir ve otomatik rasyonda kullanılır. Fiyatı kendi bölgenize göre girin (₺/kg, yaş). Ayrıntılar için ⋯ düğmesine basın.</p>
      <div class="dugmeler">
        <button class="btn" id="yeni-yem">+ Yeni yem</button>
        <button class="btn tehlike" id="yem-sifirla">Varsayılana dön</button>
      </div>
    </div>
    <div id="yem-liste"></div>`;

  $('#yem-ara').addEventListener('input', (e) => { yemArama = e.target.value; cizYemListe(); });
  $('#yeni-yem').addEventListener('click', () => {
    const ad = prompt('Yemin adı (örn. "Köy yemi %18 HP"):');
    if (!ad) return;
    const id = `ozel-${Date.now().toString(36)}`;
    durum.yemler.push({ id, ad: ad.trim(), kat: 'hazir', km: 88, nel: 1.7, hp: 18, ndf: 25, yag: 3, ca: 0.8, p: 0.5, kaba: false, fiyat: 0, min: 0, max: 10, elde: true, ozel: true });
    kaydet();
    acikYemler.add(id);
    yemArama = '';
    cizYemler();
    document.getElementById(`yem-${id}`)?.scrollIntoView({ block: 'center' });
    bildir('Yem eklendi; besin değerlerini etiketine göre düzenleyin');
  });
  $('#yem-sifirla').addEventListener('click', () => {
    if (!confirm('Tüm yem fiyatları ve değerleri varsayılana dönsün mü? Eklediğiniz özel yemler silinir.')) return;
    durum.yemler = kopya(VARSAYILAN_YEMLER);
    durum.rasyon = durum.rasyon.filter(r => yemBul(r.id));
    kaydet();
    cizYemler();
  });

  const liste = $('#yem-liste');
  liste.addEventListener('input', (e) => {
    const kutu = e.target.closest('[data-yem]');
    if (!kutu) return;
    const y = yemBul(kutu.dataset.yem);
    const ad = e.target.name;
    if (ad === 'elde' || ad === 'kaba') y[ad] = e.target.checked;
    else if (ad === 'ad') y.ad = e.target.value;
    else if (ad === 'kat') y.kat = e.target.value;
    else y[ad] = oku(e.target.value);
    kaydet();
  });
  liste.addEventListener('change', (e) => {
    if (e.target.name === 'kat' || e.target.name === 'ad') cizYemListe();
  });
  liste.addEventListener('click', (e) => {
    const ac = e.target.closest('[data-ac]');
    if (ac) {
      const id = ac.dataset.ac;
      acikYemler.has(id) ? acikYemler.delete(id) : acikYemler.add(id);
      cizYemListe();
      return;
    }
    const sil = e.target.closest('[data-yemsil]');
    if (sil) {
      const id = sil.dataset.yemsil;
      if (!confirm('Bu yem silinsin mi?')) return;
      durum.yemler = durum.yemler.filter(y => y.id !== id);
      durum.rasyon = durum.rasyon.filter(r => r.id !== id);
      kaydet();
      cizYemListe();
    }
  });
  cizYemListe();
}

function cizYemListe() {
  const ara = yemArama.toLocaleLowerCase('tr-TR');
  const html = Object.entries(KATEGORILER).map(([kat, kAd]) => {
    const liste = durum.yemler.filter(y => y.kat === kat && y.ad.toLocaleLowerCase('tr-TR').includes(ara));
    if (!liste.length) return '';
    return `<div class="kart"><h2>${kAd}</h2>${liste.map(yemSatiri).join('')}</div>`;
  }).join('');
  $('#yem-liste').innerHTML = html || '<p class="bos">Yem bulunamadı.</p>';
}

function yemSatiri(y) {
  const acik = acikYemler.has(y.id);
  const g = (etiket, ad, birim) => alan(etiket, ad, y[ad], birim);
  return `<div class="yem" data-yem="${y.id}" id="yem-${y.id}">
    <div class="yem-ust">
      <input type="checkbox" name="elde" ${y.elde ? 'checked' : ''} aria-label="Elimde var">
      <div class="yem-ad">${kacis(y.ad)}<small>KM %${sayi(y.km)} · NEL ${sayi(y.nel, 2)} · HP %${sayi(y.hp)}</small></div>
      <span class="girdi-kutu"><input type="text" inputmode="decimal" name="fiyat" value="${String(y.fiyat).replace('.', ',')}" aria-label="Fiyat ₺/kg"><span class="birim">₺</span></span>
      <button class="ikon-btn" data-ac="${y.id}" aria-label="Ayrıntılar" aria-expanded="${acik}">⋯</button>
    </div>
    ${acik ? `<div class="yem-detay">
      ${y.ozel ? `<div class="izgara" style="grid-template-columns:1fr;margin-bottom:10px">
        <label class="alan">Yem adı<input type="text" name="ad" value="${kacis(y.ad)}"></label>
        ${secim('Grup', 'kat', KATEGORILER, y.kat)}</div>` : ''}
      <div class="izgara">
        ${g('Kuru madde', 'km', '%')}
        ${g('NEL', 'nel', 'Mcal')}
        ${g('Ham protein', 'hp', '%KM')}
        ${g('NDF', 'ndf', '%KM')}
        ${g('Ham yağ', 'yag', '%KM')}
        ${g('Kalsiyum', 'ca', '%KM')}
        ${g('Fosfor', 'p', '%KM')}
        ${g('En az', 'min', 'kg')}
        ${g('En çok', 'max', 'kg')}
      </div>
      <label class="onay"><input type="checkbox" name="kaba" ${y.kaba ? 'checked' : ''}> Kaba yem olarak say</label>
      <p class="kucuk">NEL ve yüzdeler kuru madde esasındadır. Hazır yem etiketindeki değerleri çevirmek için (KM %88 ise): HP = etiketteki HP ÷ 0,88; NEL ≈ 0,703 × (ME ÷ 1000 ÷ 0,88) − 0,19. Örnek: 2500 kcal ME → 0,703 × 2,84 − 0,19 ≈ 1,81 Mcal. “En az / en çok” inek başı günlük yaş miktardır.</p>
      ${y.ozel ? `<button class="btn tehlike ufak" data-yemsil="${y.id}">Bu yemi sil</button>` : ''}
    </div>` : ''}
  </div>`;
}

// ---------- Kayıtlar ----------
function cizKayit() {
  const k = durum.kayitlar;
  $('#sekme-kayit').innerHTML = `
    <div class="kart" id="kayit-liste">
      <h2>Kayıtlı rasyonlar</h2>
      ${k.length ? k.map((r, i) => `<div class="kayit">
        <div class="bilgi"><b>${kacis(r.ad)}</b><span class="kucuk">${new Date(r.tarih).toLocaleDateString('tr-TR')} · ${tl(r.maliyet || 0)}/gün · ${r.rasyon.length} yem</span></div>
        <button class="btn ufak" data-yukle="${i}">Aç</button>
        <button class="ikon-btn" data-kayitsil="${i}" aria-label="Sil">✕</button>
      </div>`).join('') : '<p class="bos">Henüz kayıtlı rasyon yok.<br>Rasyon sekmesinde “Kaydet” düğmesini kullanın.</p>'}
    </div>
    <div class="kart">
      <h2>Yedekleme</h2>
      <p class="kucuk">Tüm veriler yalnızca bu telefonda saklanır. Telefon değiştirirken veya tarayıcı verilerini silmeden önce yedek alın.</p>
      <div class="dugmeler">
        <button class="btn" id="yedek-al">⬇️ Yedeği indir</button>
        <label class="btn" for="yedek-dosya">⬆️ Yedeği yükle</label>
        <input type="file" id="yedek-dosya" accept="application/json,.json" hidden>
      </div>
    </div>`;

  $('#kayit-liste').addEventListener('click', kayitTikla);
  $('#yedek-al').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(durum, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sut-rasyon-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#yedek-dosya').addEventListener('change', async (e) => {
    const dosya = e.target.files[0];
    if (!dosya) return;
    try {
      const veri = JSON.parse(await dosya.text());
      if (!veri.hayvan || !Array.isArray(veri.yemler)) throw new Error();
      if (!confirm('Yedek yüklensin mi? Mevcut veriler yedektekiyle değiştirilir.')) return;
      localStorage.setItem(ANAHTAR, JSON.stringify(veri));
      durum = yukle();
      cizKayit();
      bildir('Yedek yüklendi');
    } catch {
      bildir('Geçersiz yedek dosyası');
    }
  });
}

function kayitTikla(e) {
  const yukleBtn = e.target.closest('[data-yukle]');
  const silBtn = e.target.closest('[data-kayitsil]');
  if (yukleBtn) {
    const r = durum.kayitlar[Number(yukleBtn.dataset.yukle)];
    durum.hayvan = { ...durum.hayvan, ...kopya(r.hayvan) };
    durum.rasyon = kopya(r.rasyon).filter(x => yemBul(x.id));
    kaydet();
    sekmeAc('rasyon');
    bildir(`“${r.ad}” açıldı`);
    return;
  }
  if (silBtn) {
    const i = Number(silBtn.dataset.kayitsil);
    if (confirm(`“${durum.kayitlar[i].ad}” silinsin mi?`)) {
      durum.kayitlar.splice(i, 1);
      kaydet();
    }
    cizKayit();
    return;
  }
  // Başka bir yere tıklandıysa dinleyiciyi yeniden kur.
  $('#kayit-liste').addEventListener('click', kayitTikla);
}

// ---------- Başlat ----------
sekmeAc(aktifSekme);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

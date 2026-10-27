// Türkiye'de yaygın kullanılan yem hammaddeleri.
// Besin değerleri kuru madde (KM) esasındadır; fiyat ve kg değerleri yaş (verildiği gibi) esastadır.
// Değerler NRC (2001), Feedipedia ve yurt içi yem analiz ortalamalarından derlenmiş yaklaşık değerlerdir.
// Fiyatlar örnektir; kullanıcı kendi bölgesinin fiyatını girmelidir.
//
// km   : kuru madde, %
// nel  : net enerji laktasyon, Mcal/kg KM
// hp   : ham protein, % KM
// ndf  : nötr deterjan lif, % KM
// yag  : ham yağ, % KM
// ca,p : kalsiyum, fosfor, % KM
// kaba : kaba yem mi (kaba yem oranı hesabına girer)
// fiyat: TL/kg (yaş)
// min,max: inek başına günlük sınır, kg (yaş)
// elde : başlangıçta "elimde var" olarak işaretli mi

export const KATEGORILER = {
  kaba: 'Kuru ot ve saman',
  silaj: 'Silaj ve yeşil yem',
  tane: 'Tahıllar',
  kuspe: 'Küspe ve protein yemleri',
  yan: 'Yan ürünler',
  hazir: 'Hazır (fabrika) yemler',
  mineral: 'Mineral kaynakları',
};

const y = (id, ad, kat, km, nel, hp, ndf, yag, ca, p, fiyat, max, elde = false) => ({
  id, ad, kat, km, nel, hp, ndf, yag, ca, p,
  kaba: kat === 'kaba' || kat === 'silaj',
  fiyat, min: 0, max, elde,
});

export const VARSAYILAN_YEMLER = [
  y('yonca1', 'Yonca kuru otu (1. kalite, erken biçim)', 'kaba', 89, 1.30, 19.5, 41, 2.5, 1.40, 0.26, 12, 12),
  y('yonca2', 'Yonca kuru otu (orta kalite)', 'kaba', 89, 1.20, 17, 47, 2.3, 1.30, 0.25, 10, 12, true),
  y('fig', 'Fiğ kuru otu', 'kaba', 89, 1.18, 17, 48, 2.5, 1.10, 0.30, 9, 10),
  y('korunga', 'Korunga kuru otu', 'kaba', 90, 1.15, 15, 46, 2.5, 1.30, 0.22, 9, 10),
  y('figarpa', 'Fiğ + arpa / yulaf kuru otu', 'kaba', 89, 1.12, 12, 55, 2.3, 0.70, 0.25, 8, 10),
  y('cayir', 'Çayır / mera kuru otu', 'kaba', 89, 1.05, 9.5, 62, 2.3, 0.60, 0.22, 7, 10),
  y('bsaman', 'Buğday samanı', 'kaba', 91, 0.90, 3.5, 78, 1.5, 0.30, 0.08, 6, 5, true),
  y('asaman', 'Arpa samanı', 'kaba', 91, 0.95, 4.5, 73, 1.8, 0.30, 0.07, 6, 5),
  y('msilaj', 'Mısır silajı', 'silaj', 33, 1.45, 8, 45, 3.2, 0.25, 0.22, 4, 40, true),
  y('tsilaj', 'Tritikale / fiğ-tahıl silajı', 'silaj', 35, 1.30, 11, 55, 3.0, 0.50, 0.30, 3.5, 25),
  y('ysilaj', 'Yonca silajı (haylaj)', 'silaj', 40, 1.30, 19, 44, 3.0, 1.30, 0.30, 5, 20),
  y('yyonca', 'Yeşil yonca (taze)', 'silaj', 22, 1.35, 20, 40, 3.0, 1.50, 0.30, 3, 40),
  y('arpa', 'Arpa (kırma)', 'tane', 89, 1.95, 12, 20, 2.2, 0.06, 0.39, 12, 5, true),
  y('misir', 'Mısır (kırma)', 'tane', 88, 2.00, 9, 10, 4.2, 0.03, 0.30, 13, 7, true),
  y('bugday', 'Buğday (kırma)', 'tane', 89, 2.00, 14, 12, 2.0, 0.05, 0.38, 13, 3),
  y('yulaf', 'Yulaf', 'tane', 89, 1.75, 12.5, 30, 5.0, 0.10, 0.38, 11, 4),
  y('aycicek30', 'Ayçiçeği küspesi (%28–30 HP)', 'kuspe', 90, 1.35, 33, 40, 2.5, 0.40, 1.00, 13, 4, true),
  y('aycicek36', 'Ayçiçeği küspesi (%36 HP)', 'kuspe', 90, 1.50, 40, 35, 2.0, 0.40, 1.10, 15, 4),
  y('pamuk', 'Pamuk tohumu küspesi', 'kuspe', 91, 1.55, 33, 40, 2.5, 0.20, 1.10, 15, 3, true),
  y('soya', 'Soya fasulyesi küspesi (%44–46 HP)', 'kuspe', 89, 2.00, 50, 12, 1.5, 0.35, 0.70, 26, 4, true),
  y('tysoya', 'Tam yağlı soya', 'kuspe', 90, 2.45, 40, 20, 19, 0.30, 0.60, 28, 2),
  y('kanola', 'Kanola küspesi', 'kuspe', 90, 1.70, 38, 28, 3.5, 0.70, 1.10, 17, 3),
  y('ddgs', 'Mısır DDGS', 'kuspe', 90, 2.05, 30, 38, 10, 0.10, 0.85, 13, 4),
  y('kepek', 'Buğday kepeği', 'yan', 89, 1.55, 17, 45, 4.3, 0.13, 1.15, 10, 4, true),
  y('kposa', 'Kuru şeker pancarı posası', 'yan', 90, 1.65, 9.5, 45, 1.0, 0.70, 0.09, 11, 4),
  y('yposa', 'Yaş şeker pancarı posası', 'yan', 22, 1.70, 9.5, 45, 1.0, 0.80, 0.10, 2, 20),
  y('cigit', 'Pamuk tohumu (çiğit)', 'yan', 90, 2.00, 23, 50, 19, 0.17, 0.60, 15, 2.5),
  y('melas', 'Melas (pancar)', 'yan', 75, 1.75, 5.5, 0, 0.2, 1.00, 0.10, 10, 1.5),
  y('sutyemi19', 'Süt yemi (%19 HP, ~2450 kcal ME)', 'hazir', 88, 1.75, 21.5, 25, 4.0, 1.10, 0.55, 15, 14, true),
  y('sutyemi21', 'Süt yemi (%21 HP, ~2500 kcal ME)', 'hazir', 88, 1.80, 24, 22, 4.0, 1.10, 0.60, 16.5, 14),
  y('kuruyem', 'Kuru dönem yemi (%16 HP)', 'hazir', 88, 1.60, 18, 30, 3.5, 0.60, 0.50, 13.5, 4),
  y('kirec', 'Mermer tozu (kireç taşı)', 'mineral', 99, 0, 0, 0, 0, 37, 0, 3, 0.25, true),
  y('dcp', 'DCP (dikalsiyum fosfat)', 'mineral', 97, 0, 0, 0, 0, 23, 18, 45, 0.2, true),
];

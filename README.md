# Süt Rasyon 🐄

Süt inekleri için **Türkiye şartlarına uygun**, telefonda çalışan rasyon hesaplama uygulaması.
Kurulum gerektirmez, internet olmadan da çalışır (PWA). Android ve iPhone'da "Ana ekrana ekle" ile uygulama gibi kullanılır.

## Özellikler

- **İhtiyaç hesabı** (NRC 2001): ırk, canlı ağırlık, süt verimi, süt yağı/proteini, laktasyon günü, doğum sırası, gebelik, mera ve hava sıcaklığına göre kuru madde, enerji (NEL), ham protein, Ca, P ve su ihtiyacı.
- **Dönemler:** sağmal, kuru dönem, geçiş dönemi (doğuma son 3 hafta).
- **Türkiye'de yaygın 33 yem:** yonca, fiğ, korunga, saman, mısır silajı, arpa, mısır, kepek, ayçiçeği/pamuk/soya küspesi, pancar posası, çiğit, hazır süt yemi vb. Fiyat ve besin değerleri düzenlenebilir, yeni yem eklenebilir.
- **En ucuz rasyon:** elinizdeki yemlerden, ihtiyacı karşılayan en düşük maliyetli karışımı doğrusal programlama ile bulur. Karşılanamayan ihtiyaç varsa neyin eksik olduğunu ve ne eklenmesi gerektiğini söyler.
- **Elle rasyon kontrolü:** kendi rasyonunuzu girin; her besin maddesi için uygun / düşük / yüksek göstergesi ve asidoz, süt humması, ketozis, Ca:P gibi uyarılar.
- **Ekonomi:** inek başı günlük yem maliyeti, 1 kg süt yem maliyeti, yem sonrası kalan; sürü için günlük ve aylık (ton) yem ihtiyacı.
- Rasyonu kaydetme, WhatsApp vb. ile paylaşma, yazdırma, yedek alma/yükleme.
- Tüm veriler yalnızca telefonda saklanır.

## Çalıştırma

Statik bir web uygulamasıdır; derleme adımı yoktur.

```bash
npm start            # http://localhost:8080
npm test             # hesaplama testleri (Node 18+)
```

Telefona yüklemek için klasörü herhangi bir HTTPS statik sunucuya (ör. GitHub Pages) koyun ve adresi telefonda açıp **Ana ekrana ekle**'yi seçin.

## Dosyalar

| Dosya | İçerik |
|---|---|
| `js/feeds.js` | Yem kütüphanesi (besin değerleri, örnek fiyatlar, günlük sınırlar) |
| `js/nutrition.js` | İhtiyaç hesabı ve rasyon değerlendirmesi |
| `js/optimizer.js`, `js/simplex.js` | En düşük maliyetli rasyon (simpleks yöntemi) |
| `js/app.js` | Arayüz |
| `sw.js`, `manifest.webmanifest` | Çevrimdışı çalışma ve ana ekrana ekleme |

## Uyarı

Yem besin değerleri ortalama değerlerdir ve fiyatlar örnektir. Yemlerinizi analiz ettirmeniz ve kendi fiyatlarınızı girmeniz önerilir. Bu uygulama bir yardımcı araçtır; sağlık sorunlarında veteriner hekime, rasyon için hayvan besleme uzmanına danışın.

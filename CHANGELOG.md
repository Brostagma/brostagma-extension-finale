# Release Notes — v1.0.0-rc (29.08.2025)

> **Hedef:** 29.08.2025 18:00’a kadar yayın ya da incelemeye gönderim.

## Öne Çıkanlar

* Stabilite iyileştirildi; tarama akışı görsel olarak daha kolay takip edilir hale getirildi.
* Eşleşme kuralları modülerleştirildi: `rules/` klasöründe `r1.js` … `r14.js`.
* **DS (Derin Tarama)** geçici olarak devre dışı (daha iyi bağlam için yeniden ele alınacak). checked.

## Değişiklikler

* `match.js` üzerindeki yük hafifletildi; eşleşme kuralları `rules/` altına ayrıştırıldı.
* `scan.js` ile tarama hız kontrolü iyileştirildi; daha stabil ve takip edilebilir bir deneyim.
* UI tarafında kritik bir eksik **şimdilik** bulunmuyor.

## Teknik Notlar

* Dosya/Dizin Yapısı: `rules/{r1..r14}.js`, `match.js`, `scan.js`, *(planlanan)* `endScan.js`.
* Kural Sırası (Plan): Kampanya tipleri `match.js` içinde **en son** kural olacak. 
* Negatif Anahtarlar (Plan): Taramaya etkisi olacak ve `match.js` ile entegre çalışacak. checked.

## Bilinen Konular / Riskler

* **DS** yeniden aktif edildiğinde **429 hata kodu** riski: retry/backoff, kuyruk yönetimi ve oran sınırlaması gerekli. checked.
* Tarama durdurulup tekrar başlatıldığında **eşleşmelerin sıfırlanmaması** gerekiyor (geliştirilecek). checked.

## Dışa Aktarım (XLSX)

* Daha açıklayıcı kolonlar + kampanya tipine göre **birim fiyat hesaplama** (plan).
* Export başlatıldığında tarama durmalı; DS kuyruğu/aktif süreç varsa **uyarı mesajı + progress bar** gösterilmeli (plan). checked.
* Export güvenliği: kullanıcı akışı ve iptal/geri alma adımları (plan).

## Kapanış ve Son Tarama

* `endScan.js` ile taranan tüm kartlar kullanıcıya gösterilmeden hızlıca tekrar taranacak; “kaçan” ihtimaller tespit edilecek.

## İlk Hotfix Dalgası

* *(Bu sürümle birlikte eklenecek madde listesi.)*

## UX İyileştirme Fikirleri (Backlog)

* Panel açılış animasyonu.
* Her işlev/alan için **(i)** bilgi ikonları.
* **Feedback** alanı: yorum/toplanan hataların iletilmesi.
* Panel altında **Toplam Skor** göstergesi (ör. 1920 taranan / 430 eşleşen / %37).
* Tema seçenekleri (menüden seçim) ve **“Tüm verileri sıfırla”** butonu.

## Yükseltme Notları

* Kurallar modüler yapıya taşındı; yeni `r*.js` dosyaları ile uyumluluk korunmalı.
* Olası kırıcı değişiklik: kural sırası değişimi (kampanya tipleri en sona taşınacak).

## Sürümleme

* **SemVer** önerilir: `1.0.0-rc` → final hedef: `1.0.0`.

---

### Mağaza “What’s New” (Kısa Metin)

* Stabilite ve takip edilebilirlik iyileştirildi.
* Eşleşme kuralları modüler hale getirildi (r1–r14).
* DS geçici olarak devre dışı; yeniden yapılandırılacak.
* Export ve son tarama adımları için geliştirmeler planlandı.
* Final yayın hedefi: 29.08.2025 18:00.

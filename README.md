# Brostagma – Trendyol Kampanya Tarayıcı 🕵️‍♂️⚡

> “Eşleşmeyi bulur, Excel’e koyar.” – Kısa özet, uzun mutluluk.

## Bu ne?
Trendyol’daki **flaş ürün kartlarını** okuyan, **negatif anahtar**ları dikkate alıp eleme yapan, **14+ eşleşme kuralı**yla ürünleri yakalayan ve **kampanya tipine** göre son kararı veren bir **Chrome uzantısı**.  
İster kartta görünsün, ister görünmesin: **DS (Derin Tarama)** gerektiğinde ürün sayfasına gizlice bakar ve kampanyayı/kategoriyi teyit eder. Sonuç? ⭐ ya da pas.

---

## Ne işe yarar? (Özellikler)
- 🔎 **Akıllı tarama:** Kartlardan **marka / ürün / alt başlık** bilgilerini toplar.
- 🚫 **Negatif anahtar filtresi:** Büyük–küçük–`I/İ`–Türkçe karakter uyumlu; istenmeyeni **scan** aşamasında eler (match’e bile gitmez).
- 🧠 **Eşleşme motoru (match + rules):** 14+ kural ile hızlı ve isabetli karar verir.
- 🎯 **Kampanya filtresi (campaignsMatch):**  
  - **X Al Y Öde**: 3 al 2 öde, 5 al 3 öde… tüm varyasyonlar 🤝  
  - **2. Ürün %**: %10, %50… fark etmez  
  - **2. Ürün TL**: 1 TL, 10 TL, 50 TL…  
  - **TL Kupon / Kupon Fırsatı / Yetkili Satıcı / Birlikte Al Kazan / Çok Al Az Öde** …
- 🧭 **DS (Derin Tarama):** Kartta kampanya yoksa **ürün sayfasına** girip “kampanya kutuları” ve “kategori breadcrumb/etiketleri”ni kontrol eder.
- ⭐ **Görsel geri bildirim:** Eşleşmede yıldız, pas’ta belirgin efekt. (Göz ucuyla bile fark edersin.)
- 📊 **Sayaçlar + mini mod:** Taranan/ eşleşen/ oran; mini görünümle ekranın kralı sensin.
- ⬇️ **XLSX dışa aktarım:** Şık adlandırma + 3 sayfa yapı (Eşleşmeler / Özet / Detaylar).
- 💾 **Kalıcı tercih:** Negatifler, hedef liste ve kampanya seçimleri **chrome.storage.local**’da; sayfa yenilense de **hatırlanır**.
- 🤝 **429 dostu:** DS ve tarama istekleri insanî aralıklarla; siteye sevgi, sunucuya saygı.  

---

## Nasıl çalışır? (3 adımda)
1) **Scan**: Kartı okur → negatif varsa **pas** (erken eleme).  
2) **Match**: Kuralları uygular → aday **eşleşme** çıkar.  
3) **CampaignsMatch**: Seçili kampanyaya uymuyorsa → **DS** ürün sayfasında teyit eder → **onay** ya da **pas**.

---

## Kurulum
### Chrome Web Mağazası
- **Yükle** → https://chromewebstore.google.com/detail/ohnaifhjbegbebmjdjcpjlpofjcobblk?utm_source=item-share-cb

### Geliştirici Modu (lokal)
1. Bu depoyu indir/klonla.  
2. `chrome://extensions/` → **Developer mode** → **Load unpacked** → proje klasörünü seç.  
3. Trendyol sayfasını aç → sağ üstte **Brostagma** ikonuna tıkla → panel gelir.

---

## Kullanım (kısaca)
- **Negatif Anahtarlar**: İstemediğin kelimeleri ekle (Türkçe karakter uyumlu).  
- **Hedef Liste**: Görmek istediğin marka/ürün sözcükleri.  
- **Kampanya Tipleri**: “X Al Y Öde / 2. Ürün % / 2. Ürün TL / TL Kupon / …” seç.  
- **Taramayı Başlat**: Sayaçları izle; mini moda geç → ekrana hükmet.  
- **Eşleşenleri İndir**: XLSX’i al ve payday friday coşkusunu yaşa.  

---

## XLSX Çıktısı
**Dosya adı:**

**Sayfa 1 – Eşleşmeler**  
`Marka | Ürün | Fiyat | Birim Fiyat (X Al Y Öde / 2. Ürün %) | Kampanya | Link`

**Sayfa 2 – Özet**  
`tt, te, eşleşme %, seçili kampanyalar`

**Sayfa 3 – Detaylar**  
`Ham metinler, fiyat parçaları, teknik izler vb.`

> Fiyat formatları iki tip olabilir (ör. tekli fiyat / çoklu fiyat). `parse` bu senaryoları ayıklar; `export` doğru kolona yazar.

---

## Katkı (PR = ❤️)
- Issue aç, PR gönder, meme bırak.  
- Commit emojisi önerisi: ✨ feat • 🐛 fix • ♻️ refactor • 🧪 test • 📝 docs • 🎨 style • 🚀 perf • 🔧 chore

- Kod standartları: [Airbnb JS Style Guide]
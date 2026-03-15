# Etiket Doğrulama Raporu

Bu rapor, modelin yanlış tahmin ettiği soruları listeler. 
**Manuel kontrol:** Her örnek için gerçek etiketin doğru olup olmadığını kontrol edin.

## Nasıl Düzeltilir?

1. `question_dataset.json` dosyasında ilgili `question_id` ile soruyu bulun
2. Etiket yanlışsa `topic` alanını düzeltin
3. `question_training_dataset.json` dosyasında aynı soruyu bulup `label` alanını güncelleyin
4. `./ml-service/scripts/retrain_and_evaluate.sh` çalıştırın

---

## 1. Öge → Cümlede Anlam (5 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `CIKMIS-OGE-SORULARI-VE-COZUMLERI.pdf_q20` | Aşağıdaki cümlelerin hangisinde vurgu, zaman belirten ifade üzerindedir? | 0.69 |
| 2 | `CIKMIS-OGE-SORULARI-VE-COZUMLERI.pdf_q26` | “Tatlı söz söyleyen, hiç kimseden kötü söz işitmez.” cümlesinde vurgulanan ifade... | 0.94 |
| 3 | `Cümlenin Ögeleri.pdf_q34` | "Soğuk kış günlerinde, sıcacık bir ıhlamur içmek insana iyi gelir." Bu cümlede a... | 1.00 |
| 4 | `Cümlenin Ögeleri.pdf_q10` | "Soğuk kış günlerinde, sıcacık bir ıhlamur içmek insana iyi gelir." Bu cümlede a... | 1.00 |
| 5 | `Cümlenin Ögeleri.pdf_q30` | "Baharın gelişiyle birlikte ağaçlar bembeyaz çiçekler açtı." Bu cümlede aşağıdak... | 1.00 |

**Kontrol:** Bu sorular gerçekten Öge mi? Yanlış etiket varsa düzeltin.

---

## 2. Anlatım Biçimleri → Düşünceyi Geliştirme Yolları (4 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `Anlatım Biçimleri.pdf_q50` | Yapay zeka (YZ), bilgisayarların ve makinelerin, problem çözme ve karar verme ye... | 0.77 |
| 2 | `Anlatım Biçimleri (Devam).pdf_q3` | Soru Bazı eleştirmenler, çocuk edebiyatının çocuklara ciddi veya hüzünlü konular... | 0.89 |
| 3 | `Anlatım Biçimleri (Devam).pdf_q50` | Soru İyi bir şiirin başka bir dile kusursuzca iyimserliğini bir türlü anlayamıyo... | 0.90 |
| 4 | `Anlatım Biçimleri (Devam).pdf_q20` | Soru Bir kitabın filme uyarlanması her zaman filmin kitaptan daha etkileyici old... | 0.91 |

**Kontrol:** Bu sorular gerçekten Anlatım Biçimleri mi? Yanlış etiket varsa düzeltin.

---

## 3. Fiilimsiler → Cümle Türleri (3 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `fiiller.pdf_q2` | Aşağıdaki cümlelerin hangisin- de yüklem, yapı yönüyle diğerlerin- den farklıdır... | 0.66 |
| 2 | `Fiilimsiler.pdf_q8` | "Oraya varır varmaz beni mutlaka ara." özdeşi aşağıdakilerden hangisinde vardır? | 0.88 |
| 3 | `8.-sinif-indirilebilir-testler-cumle-turleri-02-mb-.pdf_q10` | (I) Türkiye’nin küçük bir kasabasında halkın okuma alış- kanlığını artırmak amac... | 0.89 |

**Kontrol:** Bu sorular gerçekten Fiilimsiler mi? Yanlış etiket varsa düzeltin.

---

## 4. Cümlede Anlam → Anlatım Bozuklukları (3 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `Cümlede Anlam.pdf_q58` | "Sinemadaki o komedi filminde espriler o kadar karnımıza ağrılar girdi." Bu cüml... | 0.88 |
| 2 | `Cümlede Anlam.pdf_q5` | "Çiçekler daha çabuk büyüsün diye onlara özel bir gübre karışımı hazırladı." Bu ... | 0.89 |
| 3 | `Cümlede Anlam.pdf_q6` | "Toplantıya hiçbir hazırlık yapmadan katıldığı için sunum sırasında epey ter dök... | 0.89 |

**Kontrol:** Bu sorular gerçekten Cümlede Anlam mi? Yanlış etiket varsa düzeltin.

---

## 5. Anlatım Biçimleri → Paragraf Bilgisi (3 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `Anlatım Biçimleri (Devam).pdf_q37` | Soru Zekânın sadece doğuştan gelen genetik geliştirilemeyeceği fikri tamamen çür... | 0.53 |
| 2 | `Anlatım Biçimleri.pdf_q53` | Günümüzde pek çok insan seyahat etmenin sadece lüks otellerde kalıp havuz kenarı... | 0.92 |
| 3 | `Anlatım Biçimleri.pdf_q54` | Günümüzde pek çok insan seyahat etmenin kenarında güneşlenmek olduğunu sanıyor. ... | 0.88 |

**Kontrol:** Bu sorular gerçekten Anlatım Biçimleri mi? Yanlış etiket varsa düzeltin.

---

## 6. Fiilimsiler → Fiil Çatıları (2 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `fiiller.pdf_q8` | Aşağıdaki cümlelerden hangi- sinin yüklemi durum fiilidir? | 0.87 |
| 2 | `fiiller.pdf_q1` | Aşağıdaki cümlelerin hangisinde oluş anlamlı bir eylem kullanılmıştır? | 0.88 |

**Kontrol:** Bu sorular gerçekten Fiilimsiler mi? Yanlış etiket varsa düzeltin.

---

## 7. Fiil Çatıları → Cümle Türleri (2 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `Fiil Çatıları.pdf_q9` | "Çocuklar bahçedeki çamurda oynarken üstlerini başlarını kirlettiler." | 0.44 |
| 2 | `Fiil Çatıları.pdf_q14` | "İki ülke arasındaki ticaret anlaşması dün imzalandı." cümlesindeki yüklemin | 0.86 |

**Kontrol:** Bu sorular gerçekten Fiil Çatıları mi? Yanlış etiket varsa düzeltin.

---

## 8. Öge → Anlatım Bozuklukları (2 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `Cümlenin Ögeleri.pdf_q23` | "Başarılı olmanın en önemli şartı, pes etmeden sürekli çalışmaktır." Bu cümlede | 0.68 |
| 2 | `Cümlenin Ögeleri.pdf_q25` | "Bu kadar ağır bir yükün altından nasıl kalkacağını kara kara düşünüyordu." Bu | 0.85 |

**Kontrol:** Bu sorular gerçekten Öge mi? Yanlış etiket varsa düzeltin.

---

## 9. Cümlede Anlam → Görsel Okuma ve Grafik Tablo (2 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `cumledeanlam.pdf_q1` | Buna göre Toprak’ın bulduğu şifre hangisidir? | 0.38 |
| 2 | `Cümlede Anlam.pdf_q17` | [RESIM] [RESIM] [RESIM] [RESIM] [RESIM] [RESIM] [RESIM] [RESIM] "Uzun süredir be... | 0.78 |

**Kontrol:** Bu sorular gerçekten Cümlede Anlam mi? Yanlış etiket varsa düzeltin.

---

## 10. Deyimler ve Atasözleri → Anlatım Bozuklukları (2 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `Deyimler ve Atasözleri.pdf_q8` | "Bu işi başarmak istiyorsan uzaktan izlemeyi bırakmalı ve sen de .................. | 0.89 |
| 2 | `Deyimler ve Atasözleri.pdf_q20` | "Ona güvenerek işe başladım ama beni son anda yarı yolda bıraktı." Bu durumu ifa... | 0.86 |

**Kontrol:** Bu sorular gerçekten Deyimler ve Atasözleri mi? Yanlış etiket varsa düzeltin.

---

## 11. Cümle Türleri → Cümlede Anlam (1 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `CIKMIS-CUMLE-TURLERI-SORULARI-VE-CEVAPLARI-1.pdf_q6` | Bu metinde numaralanmış cümlelerin hangi­ sinde tek yargı vardır? | 0.94 |

**Kontrol:** Bu sorular gerçekten Cümle Türleri mi? Yanlış etiket varsa düzeltin.

---

## 12. Cümle Türleri → Paragraf Bilgisi (1 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `cumleturleri.pdf_q4` | Bu parça ile ilgili olarak aşağı- dakilerden hangisi söylenemez? | 0.92 |

**Kontrol:** Bu sorular gerçekten Cümle Türleri mi? Yanlış etiket varsa düzeltin.

---

## 13. Cümle Türleri → Öge (1 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `Cümle Türleri.pdf_q53` | Aşağıdaki cümlelerin hangisi öge ortaklığı | 0.97 |

**Kontrol:** Bu sorular gerçekten Cümle Türleri mi? Yanlış etiket varsa düzeltin.

---

## 14. Fiilimsiler → Sözcükte Anlam (1 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `Fiilimsiler.pdf_q18` | "Gelecek, her zaman umutla beklenmelidir." cümlesindeki altı çizili sözcüğün | 0.73 |

**Kontrol:** Bu sorular gerçekten Fiilimsiler mi? Yanlış etiket varsa düzeltin.

---

## 15. Noktalama İşaretleri → Yazım Kuralları (1 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `Noktalama İşaretleri İşaretleri.pdf_q20` | "Şiirlerde dize sonlarında seslerin (hecelerin) düştüğünü göstermek için kullanı... | 0.44 |

**Kontrol:** Bu sorular gerçekten Noktalama İşaretleri mi? Yanlış etiket varsa düzeltin.

---

## 16. Noktalama İşaretleri → Fiilimsiler (1 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `Noktalama İşaretleri İşaretleri.pdf_q37` | "Soru eki veya sözü içeren cümlelerin sonuna konur. Ancak 'mı / mi' eki cümleye ... | 0.47 |

**Kontrol:** Bu sorular gerçekten Noktalama İşaretleri mi? Yanlış etiket varsa düzeltin.

---

## 17. Fiil Çatıları → Öge (1 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `Fiil Çatıları.pdf_q15` | Aşağıdaki cümlelerin hangisinde yüklem komik hareketleri odadaki herkesi güldürd... | 0.81 |

**Kontrol:** Bu sorular gerçekten Fiil Çatıları mi? Yanlış etiket varsa düzeltin.

---

## 18. Yazım Kuralları → Fiilimsiler (1 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `Yazım Kuralları.pdf_q6` | Aşağıdakilerin hangisinde "ki" bağlacı kalıplaştığı | 0.43 |

**Kontrol:** Bu sorular gerçekten Yazım Kuralları mi? Yanlış etiket varsa düzeltin.

---

## 19. Yazım Kuralları → Cümle Türleri (1 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `Yazım Kuralları.pdf_q9` | Aşağıdaki cümlelerin hangisinde birleşik kelimelerin | 0.37 |

**Kontrol:** Bu sorular gerçekten Yazım Kuralları mi? Yanlış etiket varsa düzeltin.

---

## 20. Metin Türleri → Anlatım Biçimleri (1 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `8.-sinif-indirilebilir-test-metin-turleri-01-mb.pdf_q12` | Meteoroloji, hava durumunu tahmin etmek için atmos- ferdeki değişkenleri analiz ... | 0.88 |

**Kontrol:** Bu sorular gerçekten Metin Türleri mi? Yanlış etiket varsa düzeltin.

---

## 21. Söz Sanatları → Sözcükte Anlam (1 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `sozsanatlari.pdf_q3` | Bu parçada “atasözü” aşağıda- kilerden hangisine benzetilmiştir? | 0.80 |

**Kontrol:** Bu sorular gerçekten Söz Sanatları mi? Yanlış etiket varsa düzeltin.

---

## 22. Öge → Geçiş ve Bağlantı İfadeleri (1 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `Cümlenin Ögeleri.pdf_q26` | "Olayın gerçek yüzünü aylar sonra tesadüfen öğrendik." Bu cümlede altı çizili bö... | 0.47 |

**Kontrol:** Bu sorular gerçekten Öge mi? Yanlış etiket varsa düzeltin.

---

## 23. Sözcükte Anlam → Söz Sanatları (1 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `sozcukteanlam.pdf_q4` | Aşağıdaki atasözlerinin han- gisinde karşıt anlamlı sözcükler bir arada kullanıl... | 0.82 |

**Kontrol:** Bu sorular gerçekten Sözcükte Anlam mi? Yanlış etiket varsa düzeltin.

---

## 24. Sözcükte Anlam → Cümlede Anlam (1 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `sozcukteanlam.pdf_q1` | Bu cümlede geçen “süte su katma- mak” sözünün cümleye kattığı anlam aşağıdakiler... | 1.00 |

**Kontrol:** Bu sorular gerçekten Sözcükte Anlam mi? Yanlış etiket varsa düzeltin.

---

## 25. Cümlede Anlam → Anlatım Biçimleri (1 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `8.-sinif-indirilebilir-testler-cumlede-anlam-04.pdf_q10` | Akşam, tüm yıldızlarla kucaklaştıktan sonra uykuya daldım. Gerekli ihtiyaçları i... | 0.72 |

**Kontrol:** Bu sorular gerçekten Cümlede Anlam mi? Yanlış etiket varsa düzeltin.

---

## 26. Cümlede Anlam → Öge (1 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `Cümlede Anlam.pdf_q16` | "Gerçek bir sanatçı, halkın dertlerine ve sevinçlerine ayna tutmadıkça geleceğe ... | 0.82 |

**Kontrol:** Bu sorular gerçekten Cümlede Anlam mi? Yanlış etiket varsa düzeltin.

---

## 27. Anlatım Bozuklukları → Öge (1 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `Anlatım Bozuklukları.pdf_q3` | "İki eski dost, yıllar sonra karşılaşıp saatlerce karşılıklı mektuplaştıkları gü... | 0.88 |

**Kontrol:** Bu sorular gerçekten Anlatım Bozuklukları mi? Yanlış etiket varsa düzeltin.

---

## 28. Görsel Okuma ve Grafik Tablo → Sözel Mantık (1 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `Görsel Okuma ve Grafik : Tablo.pdf_q70` | Burak, Fen Bilimleri çalışmasına başladığında | 0.89 |

**Kontrol:** Bu sorular gerçekten Görsel Okuma ve Grafik Tablo mi? Yanlış etiket varsa düzeltin.

---

## 29. Sözel Mantık → Görsel Okuma ve Grafik Tablo (1 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `Sözel Mantık (Devam).pdf_q45` | Bir kütüphane rafında roman, şiir, anı, gezi göre en üstte (5. sıra) hangi kasa ... | 0.89 |

**Kontrol:** Bu sorular gerçekten Sözel Mantık mi? Yanlış etiket varsa düzeltin.

---

## 30. Paragraf Bilgisi → Cümlede Anlam (1 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `paragraf.pdf_q5` | [ŞEKIL] [ŞEKIL] [ŞEKIL] [ŞEKIL] [ŞEKIL] [ŞEKIL] [ŞEKIL] [ŞEKIL] [ŞEKIL] [ŞEKIL] ... | 0.97 |

**Kontrol:** Bu sorular gerçekten Paragraf Bilgisi mi? Yanlış etiket varsa düzeltin.

---

## 31. Paragraf Bilgisi → Anlatım Biçimleri (1 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `Paragraf Bilgisi (Yardımcı Fikir).pdf_q52` | Camın doğada bulunan kum, soda ve kireç üretildiği bilinen bir gerçektir. Ancak ... | 0.82 |

**Kontrol:** Bu sorular gerçekten Paragraf Bilgisi mi? Yanlış etiket varsa düzeltin.

---

## 32. Düşünceyi Geliştirme Yolları → Paragraf Bilgisi (1 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `Düşünceyi Geliştirme Yolları.pdf_q4` | Büyük şehirlerde hayat, durmaksızın işleyen ve insanı sürekli bir yere yetişmeye... | 0.89 |

**Kontrol:** Bu sorular gerçekten Düşünceyi Geliştirme Yolları mi? Yanlış etiket varsa düzeltin.

---

## 33. Düşünceyi Geliştirme Yolları → Anlatım Biçimleri (1 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `Düşünceyi Geliştirme Yolları (Devam).pdf_q24` | Soru Yürüyüş yapmak, kalp ritmini yavaş ve daha fazla oksijen almasını sağlayan ... | 0.80 |

**Kontrol:** Bu sorular gerçekten Düşünceyi Geliştirme Yolları mi? Yanlış etiket varsa düzeltin.

---

## 34. Geçiş ve Bağlantı İfadeleri → Deyimler ve Atasözleri (1 örnek)

| # | question_id | Soru (kısaltılmış) | Tahmin güveni |
|---|-------------|-------------------|---------------|
| 1 | `GEÇİŞ VE BAĞLANTI İFADELERİ.pdf_q25` | "Pikniğe gitmek için tüm hazırlıkları yaptık, planlarımızı bozdu." Bu cümlede al... | 0.60 |

**Kontrol:** Bu sorular gerçekten Geçiş ve Bağlantı İfadeleri mi? Yanlış etiket varsa düzeltin.

---

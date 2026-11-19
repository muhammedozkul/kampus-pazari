// Demo veri: site boş görünmesin diye örnek öğrenciler, ilanlar ve mesajlar ekler.
// Kullanım: npm run demo            (veritabanı boşsa ekler)
//           npm run demo -- --sifirla (önce her şeyi siler)
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { veritabaniAc, islem } from './veritabani.ts';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const veri = join(kok, 'veri');
if (process.argv.includes('--sifirla')) {
  for (const ad of ['pazar.db', 'pazar.db-wal', 'pazar.db-shm', 'fotolar']) rmSync(join(veri, ad), { recursive: true, force: true });
  console.log('Eski veriler silindi.');
}
mkdirSync(veri, { recursive: true });
const db = veritabaniAc(join(veri, 'pazar.db'));

const dolu = (db.prepare('SELECT COUNT(*) AS n FROM kullanicilar').get() as { n: number }).n > 0;
if (dolu) {
  console.log('Veritabanında zaten kullanıcı var; demo eklenmedi. Sıfırdan kurmak için: npm run demo -- --sifirla');
  process.exit(0);
}

const once = (dakika: number) => {
  const t = new Date(Date.now() - dakika * 60_000);
  return t.toISOString().slice(0, 19).replace('T', ' ');
};

const KULLANICILAR = [
  ['yonetici@ogr.dpu.edu.tr', 'Kampüs Yönetici', 'Öğrenci Temsilciliği', 'yonetici'],
  ['ayse.yilmaz@ogr.dpu.edu.tr', 'Ayşe Yılmaz', 'Bilgisayar Programcılığı', 'uye'],
  ['mehmet.kaya@ogr.dpu.edu.tr', 'Mehmet Kaya', 'Makine Mühendisliği', 'uye'],
  ['zeynep.demir@ogr.dpu.edu.tr', 'Zeynep Demir', 'Psikoloji', 'uye'],
  ['can.ozturk@ogr.dpu.edu.tr', 'Can Öztürk', 'Elektrik-Elektronik Müh.', 'uye'],
  ['elif.sahin@ogr.dpu.edu.tr', 'Elif Şahin', 'İngilizce Öğretmenliği', 'uye'],
  ['burak.arslan@ogr.dpu.edu.tr', 'Burak Arslan', 'Spor Bilimleri', 'uye'],
] as const;

type Ilan = [kim: number, tur: string, kategori: string, baslik: string, aciklama: string, fiyat: number | null, takas: string | null, kosul: string | null, dakikaOnce: number, durum?: string];
const ILANLAR: Ilan[] = [
  [1, 'satilik', 'kitap', 'C Programlama Dili ders kitabı', 'Birinci sınıf C dersinin kitabı. Birkaç sayfada kurşun kalem notu var, onun dışında temiz. Merkez kampüste elden teslim.', 120, null, 'az_kullanilmis', 25],
  [2, 'satilik_takas', 'kitap', 'Mukavemet (Beer & Johnston) 7. baskı', 'Dersi verdim, kitap rafta duruyor. Takas için dinamik ya da termodinamik kitabı olur.', 350, 'Dinamik ya da Termodinamik kitabı', 'kullanilmis', 90],
  [3, 'ariyorum', 'kitap', 'Gelişim Psikolojisi kitabı arıyorum', 'Hocanın istediği Santrock baskısı lazım. Fotokopi değil, orijinal olursa sevinirim.', 250, null, null, 140],
  [4, 'satilik', 'elektronik', 'Arduino Uno başlangıç seti', 'Kart, breadboard, 30 kadar jumper kablo, LED, direnç ve sensörler. Kutusuyla birlikte. Bir dönem kullanıldı.', 600, null, 'az_kullanilmis', 200],
  [5, 'takas', 'kitap', 'IELTS hazırlık kitapları seti', 'Cambridge IELTS 15-16-17. İçleri boş, hiç yazılmamış. TOEFL kitaplarıyla takas etmek isterim.', null, 'TOEFL hazırlık kitapları', 'yeni', 260],
  [6, 'satilik', 'spor', 'Pilates matı ve 2 kg dambıl seti', 'Yurttan çıkıyorum, taşımak istemiyorum. İkisi birlikte.', 300, null, 'kullanilmis', 320],
  [1, 'ariyorum', 'elektronik', 'Bilimsel hesap makinesi (Casio fx-991)', 'Final haftasına kadar lazım. Kiralamaya da açığım.', 400, null, null, 380],
  [2, 'satilik', 'ev', 'Yurt için mini buzdolabı', '50 litre, sorunsuz çalışıyor. Germiyan yurtlarından alınabilir, taşımada yardım ederim.', 2500, null, 'kullanilmis', 600],
  [3, 'satilik_takas', 'giyim', 'Kışlık mont, M beden', 'Bir sezon giyildi, lekesi yırtığı yok. Takas için bot ya da atkı-bere seti olur.', 800, 'Kışlık bot (38) ya da atkı-bere', 'az_kullanilmis', 720],
  [4, 'ariyorum', 'ev_arkadasi', 'Kampüse yakın eve ev arkadaşı arıyorum', '2+1 ev, Evliya Çelebi yerleşkesine 10 dk yürüme. Kira kişi başı 4.500 ₺ + faturalar. Sigara içmeyen biri tercihim.', 4500, null, null, 900],
  [5, 'satilik', 'ozel_ders', 'İngilizce özel ders (hazırlık ve YDS)', 'Öğretmenlik 4. sınıf öğrencisiyim. Hazırlık sınıfına ya da YDS\'ye birebir ya da 2-3 kişilik gruplarla çalışabiliriz. Saatlik ücret.', 300, null, null, 1100],
  [6, 'takas', 'spor', 'Basketbol topu (Molten) ↔ voleybol topu', 'Az kullanılmış basketbol topumu voleybol topuyla değiştirmek istiyorum.', null, 'Voleybol topu', 'az_kullanilmis', 1300],
  [2, 'satilik', 'elektronik', 'Logitech kablosuz mouse + klavye', 'Ofis tipi, sessiz tuşlu. Pilleri yeni.', 450, null, 'az_kullanilmis', 1500],
  [3, 'satilik', 'ev', 'Masa lambası ve kitap rafı', 'Lamba LED, 3 kademe ışık. Raf duvara monte değil, ayaklı.', 0, null, 'kullanilmis', 1700],
  [1, 'satilik', 'diger', 'Teknik çizim seti (pergel, gönye, cetvel)', 'Bir kez kullandım, sonra bölüm değiştirdim. Çantasıyla birlikte.', 150, null, 'yeni', 2000],
  [4, 'satilik', 'elektronik', 'JBL kulaküstü kulaklık', 'Bluetooth, şarjı iyi gidiyor. Kutusu yok.', 900, null, 'kullanilmis', 2600, 'tamamlandi'],
  [5, 'ariyorum', 'giyim', 'Mezuniyet için cübbe ve kep', 'Haziran törenine kadar ödünç ya da satın alabilirim.', null, null, null, 3000],
];

const GENEL: [kim: number, metin: string, dakikaOnce: number][] = [
  [2, 'Herkese selam! Makine bölümünden mukavemet kitabı arayan varsa ilanım duruyor 🙂', 300],
  [3, 'Elinde Gelişim Psikolojisi kitabı olan var mı? Arıyorum ilanı verdim.', 240],
  [5, 'Kütüphanenin 3. katında bu hafta sessiz çalışma alanı açılmış, bilginize.', 180],
  [1, 'Yemekhane bugün çok kalabalıktı, yarın 11:30 gibi gitmek mantıklı olabilir 😅', 120],
  [4, 'Arduino setim satılık. Robotik kulübüne yeni başlayanlara iyi gelir.', 75],
  [6, 'Akşam 7\'de spor salonunda basketbol oynayacağız, gelmek isteyen yazsın!', 40],
  [3, '@Burak ben gelirim 🏀', 35],
];

islem(db, () => {
  const kullaniciEkle = db.prepare('INSERT INTO kullanicilar (eposta, ad, bolum, rol, olusturma) VALUES (?, ?, ?, ?, ?)');
  KULLANICILAR.forEach(([e, ad, bolum, rol], i) => kullaniciEkle.run(e, ad, bolum, rol, once(60 * 24 * (40 - i * 4))));

  const ilanEkle = db.prepare(
    'INSERT INTO ilanlar (kullanici_id, tur, kategori, baslik, aciklama, fiyat, takas_istegi, kosul, durum, olusturma, guncelleme) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  // En eski ilan önce eklenir ki "en yeni" sıralaması doğru çıksın.
  for (const [kim, tur, kategori, baslik, aciklama, fiyat, takas, kosul, dk, durum] of [...ILANLAR].reverse()) {
    ilanEkle.run(kim + 1, tur, kategori, baslik, aciklama, fiyat, takas, kosul, durum ?? 'aktif', once(dk), once(dk));
  }

  const genelEkle = db.prepare('INSERT INTO genel_mesajlar (kullanici_id, metin, olusturma) VALUES (?, ?, ?)');
  for (const [kim, metin, dk] of GENEL) genelEkle.run(kim + 1, metin, once(dk));

  // Ayşe (2) ile Mehmet (3) arasında örnek bir sohbet.
  db.prepare('INSERT INTO sohbetler (kullanici_a, kullanici_b, olusturma) VALUES (2, 3, ?)').run(once(100));
  const mukavemet = (db.prepare("SELECT id FROM ilanlar WHERE baslik LIKE 'Mukavemet%'").get() as { id: number }).id;
  const ozelEkle = db.prepare('INSERT INTO ozel_mesajlar (sohbet_id, gonderen_id, metin, ilan_id, olusturma) VALUES (1, ?, ?, ?, ?)');
  ozelEkle.run(2, 'Merhaba, "Mukavemet" kitabı hâlâ duruyor mu? Kuzenim için soruyorum.', mukavemet, once(95));
  ozelEkle.run(3, 'Merhaba, duruyor evet. Yarın öğlen kütüphane önünde verebilirim.', null, once(80));
  ozelEkle.run(2, 'Süper, 12:30 uyar mı?', null, once(78));
  db.prepare('INSERT INTO sohbet_okuma (sohbet_id, kullanici_id, son_okunan_id) VALUES (1, 2, 3), (1, 3, 2)').run();
});

console.log(`Demo hazır: ${KULLANICILAR.length} öğrenci, ${ILANLAR.length} ilan, ${GENEL.length} genel mesaj.`);
console.log('Demo hesaplarla giriş: giriş sayfasına örn. ayse.yilmaz yaz, kodu Test posta kutusundan al.');
console.log('Yönetici hesabı: yonetici@ogr.dpu.edu.tr');
if (!existsSync(join(kok, 'dist'))) console.log('Not: arayüz için önce `npm run build` gerekir (açılış dosyası bunu kendisi yapar).');

// Giriş: öğrenci e-postasına 6 haneli kod, kodla doğrulama, çerezli oturum.
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { EPOSTA_DESENI } from '../ortak/sabitler.ts';
import type { Db } from './veritabani.ts';

export const KOD_SURESI_MS = 10 * 60_000;
export const KOD_ARALIGI_MS = 30_000;
export const SAATLIK_KOD_SINIRI = 6;
export const KOD_DENEME_SINIRI = 5;
export const OTURUM_SURESI_MS = 30 * 24 * 60 * 60_000;
export const OTURUM_CEREZI = 'kp_oturum';

export const ozet = (metin: string) => createHash('sha256').update(metin).digest('hex');

export function epostaDuzelt(ham: unknown): string | null {
  if (typeof ham !== 'string') return null;
  const eposta = ham.trim().toLocaleLowerCase('en-US');
  return EPOSTA_DESENI.test(eposta) ? eposta : null;
}

export class KimlikHatasi extends Error {
  durum: number;
  constructor(mesaj: string, durum = 400) {
    super(mesaj);
    this.durum = durum;
  }
}

/** Yeni kod üretir ve test posta kutusuna yazar. Kodu yalnız testler için döndürür. */
export function kodGonder(db: Db, eposta: string, simdi = Date.now()): string {
  const yasakli = db.prepare('SELECT yasakli FROM kullanicilar WHERE eposta = ?').get(eposta) as
    | { yasakli: number }
    | undefined;
  if (yasakli?.yasakli) throw new KimlikHatasi('Bu hesap yönetici tarafından kapatıldı.', 403);

  const son = db
    .prepare('SELECT olusturma FROM dogrulama_kodlari WHERE eposta = ? ORDER BY olusturma DESC LIMIT 1')
    .get(eposta) as { olusturma: number } | undefined;
  if (son && simdi - son.olusturma < KOD_ARALIGI_MS) {
    const kalan = Math.ceil((KOD_ARALIGI_MS - (simdi - son.olusturma)) / 1000);
    throw new KimlikHatasi(`Yeni kod için ${kalan} saniye bekle.`, 429);
  }
  const saatlik = db
    .prepare('SELECT COUNT(*) AS n FROM dogrulama_kodlari WHERE eposta = ? AND olusturma > ?')
    .get(eposta, simdi - 3_600_000) as { n: number };
  if (saatlik.n >= SAATLIK_KOD_SINIRI) throw new KimlikHatasi('Bir saatte çok fazla kod istendi. Biraz sonra dene.', 429);

  const kod = String(randomInt(0, 1_000_000)).padStart(6, '0');
  // Önceki kodlar geçersiz olur: yalnız en son gönderilen kod çalışır.
  db.prepare('UPDATE dogrulama_kodlari SET kullanildi = 1 WHERE eposta = ? AND kullanildi = 0').run(eposta);
  db.prepare(
    'INSERT INTO dogrulama_kodlari (eposta, kod_ozet, son_gecerlilik, olusturma) VALUES (?, ?, ?, ?)',
  ).run(eposta, ozet(`${eposta}:${kod}`), simdi + KOD_SURESI_MS, simdi);
  db.prepare('INSERT INTO test_posta (alici, konu, govde) VALUES (?, ?, ?)').run(
    eposta,
    `Kampüs Pazarı giriş kodun: ${kod}`,
    `Merhaba,\n\nKampüs Pazarı'na giriş kodun: ${kod}\n\nKod 10 dakika geçerli. Bu isteği sen yapmadıysan bu mektubu yok sayabilirsin.`,
  );
  console.log(`[test posta] ${eposta} → giriş kodu ${kod}`);
  return kod;
}

export type GirisSonucu = { anahtar: string; kullaniciId: number; yeni: boolean };

export function koduDogrula(db: Db, eposta: string, kod: unknown, simdi = Date.now()): GirisSonucu {
  if (typeof kod !== 'string' || !/^\d{6}$/.test(kod.trim())) throw new KimlikHatasi('Kod 6 haneli olmalı.');
  const kayit = db
    .prepare(
      'SELECT id, kod_ozet, son_gecerlilik, deneme FROM dogrulama_kodlari WHERE eposta = ? AND kullanildi = 0 ORDER BY olusturma DESC LIMIT 1',
    )
    .get(eposta) as { id: number; kod_ozet: string; son_gecerlilik: number; deneme: number } | undefined;
  if (!kayit || kayit.son_gecerlilik < simdi) throw new KimlikHatasi('Kodun süresi dolmuş ya da kod yok. Yeni kod iste.');
  if (kayit.deneme >= KOD_DENEME_SINIRI) throw new KimlikHatasi('Çok fazla yanlış deneme. Yeni kod iste.', 429);

  const beklenen = Buffer.from(kayit.kod_ozet, 'hex');
  const gelen = Buffer.from(ozet(`${eposta}:${kod.trim()}`), 'hex');
  if (!timingSafeEqual(beklenen, gelen)) {
    db.prepare('UPDATE dogrulama_kodlari SET deneme = deneme + 1 WHERE id = ?').run(kayit.id);
    const kalan = KOD_DENEME_SINIRI - kayit.deneme - 1;
    throw new KimlikHatasi(kalan > 0 ? `Kod yanlış. ${kalan} hakkın kaldı.` : 'Kod yanlış. Yeni kod iste.');
  }
  db.prepare('UPDATE dogrulama_kodlari SET kullanildi = 1 WHERE id = ?').run(kayit.id);

  let kullanici = db.prepare('SELECT id, yasakli, ad FROM kullanicilar WHERE eposta = ?').get(eposta) as
    | { id: number; yasakli: number; ad: string | null }
    | undefined;
  if (kullanici?.yasakli) throw new KimlikHatasi('Bu hesap yönetici tarafından kapatıldı.', 403);
  if (!kullanici) {
    const sonuc = db.prepare('INSERT INTO kullanicilar (eposta) VALUES (?)').run(eposta);
    kullanici = { id: Number(sonuc.lastInsertRowid), yasakli: 0, ad: null };
  }
  const anahtar = randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO oturumlar (anahtar_ozet, kullanici_id, son_gecerlilik) VALUES (?, ?, ?)').run(
    ozet(anahtar),
    kullanici.id,
    simdi + OTURUM_SURESI_MS,
  );
  db.prepare('DELETE FROM oturumlar WHERE son_gecerlilik < ?').run(simdi);
  return { anahtar, kullaniciId: kullanici.id, yeni: !kullanici.ad };
}

export type Oturum = { id: number; eposta: string; ad: string | null; bolum: string | null; rol: 'uye' | 'yonetici' };

export function oturumBul(db: Db, anahtar: string | undefined, simdi = Date.now()): Oturum | null {
  if (!anahtar) return null;
  const satir = db
    .prepare(
      `SELECT k.id, k.eposta, k.ad, k.bolum, k.rol FROM oturumlar o
       JOIN kullanicilar k ON k.id = o.kullanici_id
       WHERE o.anahtar_ozet = ? AND o.son_gecerlilik > ? AND k.yasakli = 0`,
    )
    .get(ozet(anahtar), simdi) as Oturum | undefined;
  return satir ?? null;
}

export function oturumKapat(db: Db, anahtar: string) {
  db.prepare('DELETE FROM oturumlar WHERE anahtar_ozet = ?').run(ozet(anahtar));
}

export function cerezOku(baslik: string | undefined, ad: string): string | undefined {
  if (!baslik) return undefined;
  for (const parca of baslik.split(';')) {
    const [anahtar, ...deger] = parca.trim().split('=');
    if (anahtar === ad) return decodeURIComponent(deger.join('='));
  }
  return undefined;
}

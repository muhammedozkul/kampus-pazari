// HTTP API (Express 5). Site yalnız giriş yapmış öğrencilere açık; giriş ve test posta kutusu hariç.
import express, { type NextFunction, type Request, type Response } from 'express';
import { join } from 'node:path';
import {
  ILAN_TURU_LISTESI,
  KATEGORI_LISTESI,
  KOSULLAR,
  SIKAYET_NEDENLERI,
  SINIRLAR,
  type IlanTuru,
} from '../ortak/sabitler.ts';
import { Canli } from './canli.ts';
import { FOTO_ADI, FotoHatasi, fotoKaydet, fotoSil } from './fotograf.ts';
import {
  cerezOku,
  epostaDuzelt,
  KimlikHatasi,
  kodGonder,
  koduDogrula,
  OTURUM_CEREZI,
  OTURUM_SURESI_MS,
  oturumBul,
  oturumKapat,
  type Oturum,
} from './kimlik.ts';
import { islem, type Db } from './veritabani.ts';

export class Hata extends Error {
  durum: number;
  constructor(durum: number, mesaj: string) {
    super(mesaj);
    this.durum = durum;
  }
}

type Istek = Request & { ben?: Oturum };

export type UygulamaAyari = {
  db: Db;
  fotoKlasoru: string;
  yoneticiEpostalari: string[];
};

// Türkçe büyük/küçük harf duyarsız arama için SQLite'a kendi fonksiyonumuzu ekleriz.
function trKucuk(metin: unknown): string | null {
  return typeof metin === 'string' ? metin.toLocaleLowerCase('tr-TR') : null;
}

function metinAl(deger: unknown, alan: string, enCok: number, zorunlu = true): string {
  const metin = typeof deger === 'string' ? deger.trim() : '';
  if (zorunlu && !metin) throw new Hata(400, `${alan} boş olamaz.`);
  if (metin.length > enCok) throw new Hata(400, `${alan} en çok ${enCok} karakter olabilir.`);
  return metin;
}

function sayiAl(deger: unknown): number | null {
  if (deger === undefined || deger === null || deger === '') return null;
  const n = Number(deger);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
}

function idAl(deger: unknown): number {
  const n = Number(deger);
  if (!Number.isInteger(n) || n <= 0) throw new Hata(404, 'Bulunamadı.');
  return n;
}

/** Aynı kökten gelmeyen yazma isteklerini reddeder (CSRF koruması). */
function kokenUygunMu(koken: string | undefined, host: string | undefined): boolean {
  if (!koken) return true; // Aynı sitede bazı tarayıcılar Origin göndermez; çerez SameSite=Lax ile korunur.
  try {
    return new URL(koken).host === host;
  } catch {
    return false;
  }
}

export function uygulamaKur(ayar: UygulamaAyari) {
  const { db, fotoKlasoru } = ayar;
  db.function('tr_kucuk', trKucuk);
  const yoneticiler = new Set(ayar.yoneticiEpostalari.map((e) => e.toLowerCase()));
  const canli = new Canli(db, kokenUygunMu);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);

  const api = express.Router();
  api.use(express.json({ limit: '12mb' }));

  api.use((istek: Istek, _yanit, devam) => {
    if (istek.method !== 'GET' && istek.method !== 'HEAD') {
      if (!kokenUygunMu(istek.headers.origin, istek.headers.host)) throw new Hata(403, 'İzin verilmeyen kaynak.');
      if (!istek.is('application/json')) throw new Hata(415, 'İstek JSON olmalı.');
    }
    istek.ben = oturumBul(db, cerezOku(istek.headers.cookie, OTURUM_CEREZI)) ?? undefined;
    devam();
  });

  const girisGerekli = (istek: Istek, _y: Response, devam: NextFunction) => {
    if (!istek.ben) throw new Hata(401, 'Önce giriş yapmalısın.');
    devam();
  };
  const yoneticiGerekli = (istek: Istek, _y: Response, devam: NextFunction) => {
    if (istek.ben?.rol !== 'yonetici') throw new Hata(403, 'Bu sayfa yalnız yöneticiler için.');
    devam();
  };
  const ben = (istek: Istek) => istek.ben as Oturum;

  // ---------- Yardımcı sorgular ----------
  const engelVar = (a: number, b: number) =>
    !!db
      .prepare(
        'SELECT 1 FROM engellemeler WHERE (engelleyen_id = ? AND engellenen_id = ?) OR (engelleyen_id = ? AND engellenen_id = ?)',
      )
      .get(a, b, b, a);

  // Kullanıcının engellediği ya da onu engelleyen kişiler.
  const ENGEL_ALT_SORGU = `(SELECT engellenen_id FROM engellemeler WHERE engelleyen_id = :ben
                            UNION SELECT engelleyen_id FROM engellemeler WHERE engellenen_id = :ben)`;

  const kullaniciOzet = (s: { kid: number; kad: string | null; kbolum: string | null }) => ({
    id: s.kid,
    ad: s.kad ?? 'Adsız öğrenci',
    bolum: s.kbolum,
  });

  type IlanSatiri = {
    id: number;
    tur: IlanTuru;
    kategori: string;
    baslik: string;
    aciklama: string;
    fiyat: number | null;
    takas_istegi: string | null;
    kosul: string | null;
    durum: string;
    olusturma: string;
    guncelleme: string;
    foto: string | null;
    favori: number;
    kid: number;
    kad: string | null;
    kbolum: string | null;
  };
  const ilanCikti = (s: IlanSatiri) => ({
    id: s.id,
    tur: s.tur,
    kategori: s.kategori,
    baslik: s.baslik,
    fiyat: s.fiyat,
    takasIstegi: s.takas_istegi,
    kosul: s.kosul,
    durum: s.durum,
    olusturma: s.olusturma,
    foto: s.foto,
    favori: !!s.favori,
    kullanici: kullaniciOzet(s),
  });
  const ILAN_SECIM = `
    SELECT i.*, k.id AS kid, k.ad AS kad, k.bolum AS kbolum,
      (SELECT dosya FROM ilan_fotolari f WHERE f.ilan_id = i.id ORDER BY sira LIMIT 1) AS foto,
      EXISTS (SELECT 1 FROM favoriler v WHERE v.ilan_id = i.id AND v.kullanici_id = :ben) AS favori
    FROM ilanlar i JOIN kullanicilar k ON k.id = i.kullanici_id`;

  const genelMesajCikti = (s: { id: number; metin: string; olusturma: string; kid: number; kad: string | null; kbolum: string | null }) => ({
    id: s.id,
    metin: s.metin,
    olusturma: s.olusturma,
    kullanici: kullaniciOzet(s),
  });

  const ozelMesajCikti = (s: {
    id: number;
    sohbet_id: number;
    gonderen_id: number;
    metin: string;
    olusturma: string;
    ilan_id: number | null;
    ibaslik: string | null;
    itur: string | null;
    ifiyat: number | null;
    ikategori: string | null;
    ifoto: string | null;
  }) => ({
    id: s.id,
    sohbetId: s.sohbet_id,
    gonderenId: s.gonderen_id,
    metin: s.metin,
    olusturma: s.olusturma,
    ilan: s.ilan_id ? { id: s.ilan_id, baslik: s.ibaslik, tur: s.itur, fiyat: s.ifiyat, kategori: s.ikategori, foto: s.ifoto } : null,
  });
  const OZEL_SECIM = `
    SELECT m.*, i.baslik AS ibaslik, i.tur AS itur, i.fiyat AS ifiyat, i.kategori AS ikategori,
      (SELECT dosya FROM ilan_fotolari f WHERE f.ilan_id = i.id ORDER BY sira LIMIT 1) AS ifoto
    FROM ozel_mesajlar m LEFT JOIN ilanlar i ON i.id = m.ilan_id`;

  // Basit hız sınırı: kişi başına 5 saniyede en çok 6 mesaj.
  const mesajZamanlari = new Map<number, number[]>();
  const hizSiniri = (kullaniciId: number) => {
    const simdi = Date.now();
    const liste = (mesajZamanlari.get(kullaniciId) ?? []).filter((t) => simdi - t < 5000);
    if (liste.length >= 6) throw new Hata(429, 'Çok hızlı yazıyorsun, biraz yavaşla.');
    liste.push(simdi);
    mesajZamanlari.set(kullaniciId, liste);
  };

  // ---------- Giriş ----------
  api.post('/giris/kod', (istek, yanit) => {
    const eposta = epostaDuzelt(istek.body?.eposta);
    if (!eposta) throw new Hata(400, 'Yalnız @ogr.dpu.edu.tr uzantılı öğrenci e-postasıyla girilebilir.');
    kodGonder(db, eposta);
    yanit.json({ tamam: true });
  });

  api.post('/giris/dogrula', (istek, yanit) => {
    const eposta = epostaDuzelt(istek.body?.eposta);
    if (!eposta) throw new Hata(400, 'Geçersiz e-posta.');
    const sonuc = koduDogrula(db, eposta, istek.body?.kod);
    if (yoneticiler.has(eposta)) db.prepare("UPDATE kullanicilar SET rol = 'yonetici' WHERE id = ?").run(sonuc.kullaniciId);
    yanit.cookie(OTURUM_CEREZI, sonuc.anahtar, {
      httpOnly: true,
      sameSite: 'lax',
      secure: istek.secure,
      maxAge: OTURUM_SURESI_MS,
      path: '/',
    });
    yanit.json({ yeni: sonuc.yeni });
  });

  api.post('/cikis', (istek, yanit) => {
    const anahtar = cerezOku(istek.headers.cookie, OTURUM_CEREZI);
    if (anahtar) oturumKapat(db, anahtar);
    yanit.clearCookie(OTURUM_CEREZI, { path: '/' });
    yanit.json({ tamam: true });
  });

  api.get('/ben', (istek: Istek, yanit) => {
    if (!istek.ben) return void yanit.json({ ben: null });
    const engellenenler = db
      .prepare('SELECT engellenen_id AS id FROM engellemeler WHERE engelleyen_id = ?')
      .all(istek.ben.id) as { id: number }[];
    yanit.json({ ben: istek.ben, engellenenler: engellenenler.map((e) => e.id) });
  });

  api.patch('/ben', girisGerekli, (istek: Istek, yanit) => {
    const ad = metinAl(istek.body?.ad, 'Ad', SINIRLAR.ad);
    const bolum = metinAl(istek.body?.bolum, 'Bölüm', SINIRLAR.bolum, false) || null;
    db.prepare('UPDATE kullanicilar SET ad = ?, bolum = ? WHERE id = ?').run(ad, bolum, ben(istek).id);
    yanit.json({ ben: { ...ben(istek), ad, bolum } });
  });

  // ---------- Test posta kutusu (geliştirme) ----------
  api.get('/test-posta', (istek, yanit) => {
    const alici = epostaDuzelt(istek.query.alici);
    const mektuplar = alici
      ? db.prepare('SELECT * FROM test_posta WHERE alici = ? ORDER BY id DESC LIMIT 30').all(alici)
      : db.prepare('SELECT * FROM test_posta ORDER BY id DESC LIMIT 30').all();
    yanit.json({ mektuplar });
  });

  // ---------- Özet ----------
  api.get('/ozet', girisGerekli, (_istek, yanit) => {
    const aktif = db.prepare("SELECT COUNT(*) AS n FROM ilanlar WHERE durum = 'aktif'").get() as { n: number };
    const uye = db.prepare('SELECT COUNT(*) AS n FROM kullanicilar WHERE ad IS NOT NULL AND yasakli = 0').get() as { n: number };
    yanit.json({ aktifIlan: aktif.n, uye: uye.n, cevrimici: canli.cevrimiciler().length });
  });

  // ---------- İlanlar ----------
  api.get('/ilanlar', girisGerekli, (istek: Istek, yanit) => {
    const q = istek.query;
    const kosullar: string[] = [`i.kullanici_id NOT IN ${ENGEL_ALT_SORGU}`, 'k.yasakli = 0'];
    const p: Record<string, string | number> = { ben: ben(istek).id };

    const sahip = q.kullanici ? idAl(q.kullanici) : null;
    if (sahip) {
      kosullar.push('i.kullanici_id = :sahip');
      p.sahip = sahip;
      // Kişi kendi profilinde tamamlananları da görür.
      kosullar.push(sahip === ben(istek).id ? "i.durum != 'kaldirildi'" : "i.durum = 'aktif'");
    } else if (q.favoriler === '1') {
      kosullar.push('EXISTS (SELECT 1 FROM favoriler v WHERE v.ilan_id = i.id AND v.kullanici_id = :ben)');
      kosullar.push("i.durum != 'kaldirildi'");
    } else {
      kosullar.push("i.durum = 'aktif'");
    }
    if (typeof q.tur === 'string' && q.tur) {
      // "Satılık" seçilince "satılık veya takas" ilanları da gelir; takas için de öyle.
      if (q.tur === 'satilik') kosullar.push("i.tur IN ('satilik', 'satilik_takas')");
      else if (q.tur === 'takas') kosullar.push("i.tur IN ('takas', 'satilik_takas')");
      else if (q.tur === 'ariyorum') kosullar.push("i.tur = 'ariyorum'");
    }
    if (typeof q.kategori === 'string' && (KATEGORI_LISTESI as string[]).includes(q.kategori)) {
      kosullar.push('i.kategori = :kategori');
      p.kategori = q.kategori;
    }
    if (typeof q.q === 'string' && q.q.trim()) {
      const aranan = q.q.trim().slice(0, 60).toLocaleLowerCase('tr-TR').replace(/[\\%_]/g, (h) => '\\' + h);
      kosullar.push("tr_kucuk(i.baslik || ' ' || i.aciklama || ' ' || IFNULL(i.takas_istegi, '')) LIKE :aranan ESCAPE '\\'");
      p.aranan = `%${aranan}%`;
    }
    const enAz = sayiAl(q.min);
    const enCok = sayiAl(q.max);
    if (enAz !== null && !Number.isNaN(enAz)) {
      kosullar.push('i.fiyat >= :min');
      p.min = enAz;
    }
    if (enCok !== null && !Number.isNaN(enCok)) {
      kosullar.push('i.fiyat <= :max');
      p.max = enCok;
    }
    const siralama =
      q.sirala === 'ucuz' ? 'i.fiyat IS NULL, i.fiyat ASC, i.id DESC' : q.sirala === 'pahali' ? 'i.fiyat DESC, i.id DESC' : 'i.id DESC';
    const sayfa = Math.max(0, Math.min(100, Number(q.sayfa) || 0));
    const satirlar = db
      .prepare(`${ILAN_SECIM} WHERE ${kosullar.join(' AND ')} ORDER BY ${siralama} LIMIT 25 OFFSET ${sayfa * 24}`)
      .all(p) as IlanSatiri[];
    yanit.json({ ilanlar: satirlar.slice(0, 24).map(ilanCikti), dahaVar: satirlar.length > 24 });
  });

  const ilanGetir = (id: number, benId: number) =>
    db.prepare(`${ILAN_SECIM} WHERE i.id = :id`).get({ id, ben: benId }) as IlanSatiri | undefined;

  api.get('/ilanlar/:id', girisGerekli, (istek: Istek, yanit) => {
    const s = ilanGetir(idAl(istek.params.id), ben(istek).id);
    const sahibi = s && s.kid === ben(istek).id;
    if (!s || (s.durum === 'kaldirildi' && !sahibi && ben(istek).rol !== 'yonetici') || (!sahibi && engelVar(s.kid, ben(istek).id)))
      throw new Hata(404, 'İlan bulunamadı ya da kaldırılmış.');
    const fotolar = db.prepare('SELECT dosya FROM ilan_fotolari WHERE ilan_id = ? ORDER BY sira').all(s.id) as { dosya: string }[];
    const sahip = db
      .prepare(
        `SELECT olusturma, (SELECT COUNT(*) FROM ilanlar WHERE kullanici_id = :id AND durum = 'aktif') AS aktif,
                (SELECT COUNT(*) FROM ilanlar WHERE kullanici_id = :id AND durum = 'tamamlandi') AS tamamlanan
         FROM kullanicilar WHERE id = :id`,
      )
      .get({ id: s.kid }) as { olusturma: string; aktif: number; tamamlanan: number };
    yanit.json({
      ilan: {
        ...ilanCikti(s),
        aciklama: s.aciklama,
        guncelleme: s.guncelleme,
        fotolar: fotolar.map((f) => f.dosya),
        sahip: { ...kullaniciOzet(s), uyelik: sahip.olusturma, aktifIlan: sahip.aktif, tamamlanan: sahip.tamamlanan },
      },
    });
  });

  type IlanGirdisi = {
    tur: IlanTuru;
    kategori: string;
    baslik: string;
    aciklama: string;
    fiyat: number | null;
    takasIstegi: string | null;
    kosul: string | null;
  };
  const ilanDogrula = (b: Record<string, unknown>): IlanGirdisi => {
    const tur = b.tur as IlanTuru;
    if (!ILAN_TURU_LISTESI.includes(tur)) throw new Hata(400, 'İlan türünü seç.');
    const kategori = String(b.kategori ?? '');
    if (!(KATEGORI_LISTESI as string[]).includes(kategori)) throw new Hata(400, 'Kategori seç.');
    const baslik = metinAl(b.baslik, 'Başlık', SINIRLAR.baslik);
    if (baslik.length < 3) throw new Hata(400, 'Başlık en az 3 karakter olmalı.');
    const aciklama = metinAl(b.aciklama, 'Açıklama', SINIRLAR.aciklama, false);
    let fiyat = sayiAl(b.fiyat);
    if (Number.isNaN(fiyat) || (fiyat !== null && fiyat > SINIRLAR.fiyat)) throw new Hata(400, 'Fiyat 0 ile 1.000.000 TL arasında tam sayı olmalı.');
    if (tur === 'takas') fiyat = null;
    if ((tur === 'satilik' || tur === 'satilik_takas') && fiyat === null) throw new Hata(400, 'Satılık ilan için fiyat yaz.');
    const takasIstegi =
      tur === 'takas' || tur === 'satilik_takas' ? metinAl(b.takasIstegi, 'Takas isteği', SINIRLAR.takasIstegi, false) || null : null;
    const kosul = typeof b.kosul === 'string' && b.kosul in KOSULLAR && tur !== 'ariyorum' ? b.kosul : null;
    return { tur, kategori, baslik, aciklama, fiyat, takasIstegi, kosul };
  };

  /** Fotoğraf listesini kaydeder: data URL olanlar yeni, diğerleri ilanın mevcut dosyaları. */
  const fotolariYaz = (ilanId: number, liste: unknown, yeniDosyalar: string[]) => {
    if (liste === undefined) return;
    if (!Array.isArray(liste) || liste.length > SINIRLAR.fotoSayisi) throw new Hata(400, `En çok ${SINIRLAR.fotoSayisi} fotoğraf eklenebilir.`);
    const mevcut = new Set(
      (db.prepare('SELECT dosya FROM ilan_fotolari WHERE ilan_id = ?').all(ilanId) as { dosya: string }[]).map((f) => f.dosya),
    );
    const sonuc: string[] = [];
    for (const oge of liste) {
      if (typeof oge !== 'string') throw new Hata(400, 'Fotoğraf listesi bozuk.');
      if (oge.startsWith('data:')) {
        try {
          const ad = fotoKaydet(fotoKlasoru, oge);
          yeniDosyalar.push(ad);
          sonuc.push(ad);
        } catch (h) {
          if (h instanceof FotoHatasi) throw new Hata(400, h.message);
          throw h;
        }
      } else if (mevcut.has(oge)) sonuc.push(oge);
    }
    db.prepare('DELETE FROM ilan_fotolari WHERE ilan_id = ?').run(ilanId);
    const ekle = db.prepare('INSERT INTO ilan_fotolari (ilan_id, dosya, sira) VALUES (?, ?, ?)');
    sonuc.forEach((dosya, sira) => ekle.run(ilanId, dosya, sira));
    return [...mevcut].filter((d) => !sonuc.includes(d)); // artık kullanılmayanlar
  };

  const profilTamamMi = (istek: Istek) => {
    if (!ben(istek).ad) throw new Hata(400, 'Önce profilinde adını yaz.');
  };

  api.post('/ilanlar', girisGerekli, (istek: Istek, yanit) => {
    profilTamamMi(istek);
    const g = ilanDogrula(istek.body ?? {});
    const gunluk = db
      .prepare("SELECT COUNT(*) AS n FROM ilanlar WHERE kullanici_id = ? AND olusturma > datetime('now', '-1 day')")
      .get(ben(istek).id) as { n: number };
    if (gunluk.n >= 20) throw new Hata(429, 'Bir günde en çok 20 ilan verebilirsin.');
    const yeniDosyalar: string[] = [];
    try {
      const id = islem(db, () => {
        const s = db
          .prepare(
            'INSERT INTO ilanlar (kullanici_id, tur, kategori, baslik, aciklama, fiyat, takas_istegi, kosul) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .run(ben(istek).id, g.tur, g.kategori, g.baslik, g.aciklama, g.fiyat, g.takasIstegi, g.kosul);
        const id = Number(s.lastInsertRowid);
        fotolariYaz(id, istek.body?.fotolar ?? [], yeniDosyalar);
        return id;
      });
      yanit.status(201).json({ id });
    } catch (h) {
      yeniDosyalar.forEach((d) => fotoSil(fotoKlasoru, d));
      throw h;
    }
  });

  const sahipKontrol = (istek: Istek, yoneticiOlur = false) => {
    const id = idAl(istek.params.id);
    const s = db.prepare('SELECT id, kullanici_id, durum FROM ilanlar WHERE id = ?').get(id) as
      | { id: number; kullanici_id: number; durum: string }
      | undefined;
    if (!s) throw new Hata(404, 'İlan bulunamadı.');
    if (s.kullanici_id !== ben(istek).id && !(yoneticiOlur && ben(istek).rol === 'yonetici'))
      throw new Hata(403, 'Bu ilan senin değil.');
    return s;
  };

  api.patch('/ilanlar/:id', girisGerekli, (istek: Istek, yanit) => {
    const s = sahipKontrol(istek);
    if (s.durum === 'kaldirildi') throw new Hata(400, 'Kaldırılmış ilan düzenlenemez.');
    const g = ilanDogrula(istek.body ?? {});
    const yeniDosyalar: string[] = [];
    try {
      const silinecek = islem(db, () => {
        db.prepare(
          "UPDATE ilanlar SET tur = ?, kategori = ?, baslik = ?, aciklama = ?, fiyat = ?, takas_istegi = ?, kosul = ?, guncelleme = datetime('now') WHERE id = ?",
        ).run(g.tur, g.kategori, g.baslik, g.aciklama, g.fiyat, g.takasIstegi, g.kosul, s.id);
        return fotolariYaz(s.id, istek.body?.fotolar, yeniDosyalar) ?? [];
      });
      silinecek.forEach((d) => fotoSil(fotoKlasoru, d));
      yanit.json({ id: s.id });
    } catch (h) {
      yeniDosyalar.forEach((d) => fotoSil(fotoKlasoru, d));
      throw h;
    }
  });

  api.post('/ilanlar/:id/durum', girisGerekli, (istek: Istek, yanit) => {
    const durum = istek.body?.durum;
    if (!['aktif', 'tamamlandi', 'kaldirildi'].includes(durum)) throw new Hata(400, 'Geçersiz durum.');
    // Yönetici yalnız kaldırabilir; geri almayı ilan sahibi yapar.
    const s = sahipKontrol(istek, durum === 'kaldirildi');
    if (s.durum === 'kaldirildi' && ben(istek).rol !== 'yonetici') throw new Hata(400, 'Kaldırılmış ilan geri açılamaz.');
    db.prepare("UPDATE ilanlar SET durum = ?, guncelleme = datetime('now') WHERE id = ?").run(durum, s.id);
    yanit.json({ durum });
  });

  api.post('/ilanlar/:id/favori', girisGerekli, (istek: Istek, yanit) => {
    const id = idAl(istek.params.id);
    if (!db.prepare('SELECT 1 FROM ilanlar WHERE id = ?').get(id)) throw new Hata(404, 'İlan bulunamadı.');
    if (istek.body?.favori) db.prepare('INSERT OR IGNORE INTO favoriler (kullanici_id, ilan_id) VALUES (?, ?)').run(ben(istek).id, id);
    else db.prepare('DELETE FROM favoriler WHERE kullanici_id = ? AND ilan_id = ?').run(ben(istek).id, id);
    yanit.json({ favori: !!istek.body?.favori });
  });

  // ---------- Kullanıcılar ----------
  api.get('/kullanicilar/:id', girisGerekli, (istek: Istek, yanit) => {
    const id = idAl(istek.params.id);
    const k = db
      .prepare(
        `SELECT id, ad, bolum, olusturma, son_gorulme, yasakli,
           (SELECT COUNT(*) FROM ilanlar WHERE kullanici_id = :id AND durum = 'tamamlandi') AS tamamlanan
         FROM kullanicilar WHERE id = :id`,
      )
      .get({ id }) as
      | { id: number; ad: string | null; bolum: string | null; olusturma: string; son_gorulme: string | null; yasakli: number; tamamlanan: number }
      | undefined;
    if (!k || (k.yasakli && ben(istek).rol !== 'yonetici')) throw new Hata(404, 'Kullanıcı bulunamadı.');
    const engelledim = !!db.prepare('SELECT 1 FROM engellemeler WHERE engelleyen_id = ? AND engellenen_id = ?').get(ben(istek).id, id);
    yanit.json({
      kullanici: {
        id: k.id,
        ad: k.ad ?? 'Adsız öğrenci',
        bolum: k.bolum,
        uyelik: k.olusturma,
        sonGorulme: k.son_gorulme,
        tamamlanan: k.tamamlanan,
        cevrimici: canli.cevrimiciler().includes(k.id),
        engelledim,
        yasakli: !!k.yasakli,
      },
    });
  });

  api.post('/kullanicilar/:id/engelle', girisGerekli, (istek: Istek, yanit) => {
    const id = idAl(istek.params.id);
    if (id === ben(istek).id) throw new Hata(400, 'Kendini engelleyemezsin.');
    if (!db.prepare('SELECT 1 FROM kullanicilar WHERE id = ?').get(id)) throw new Hata(404, 'Kullanıcı bulunamadı.');
    if (istek.body?.engelle) db.prepare('INSERT OR IGNORE INTO engellemeler (engelleyen_id, engellenen_id) VALUES (?, ?)').run(ben(istek).id, id);
    else db.prepare('DELETE FROM engellemeler WHERE engelleyen_id = ? AND engellenen_id = ?').run(ben(istek).id, id);
    yanit.json({ engelli: !!istek.body?.engelle });
  });

  api.get('/engellenenler', girisGerekli, (istek: Istek, yanit) => {
    const liste = db
      .prepare(
        'SELECT k.id, k.ad, k.bolum FROM engellemeler e JOIN kullanicilar k ON k.id = e.engellenen_id WHERE e.engelleyen_id = ? ORDER BY e.olusturma DESC',
      )
      .all(ben(istek).id);
    yanit.json({ kullanicilar: liste });
  });

  // ---------- Genel sohbet ----------
  api.get('/genel', girisGerekli, (istek: Istek, yanit) => {
    const once = sayiAl(istek.query.once);
    const satirlar = db
      .prepare(
        `SELECT m.id, m.metin, m.olusturma, k.id AS kid, k.ad AS kad, k.bolum AS kbolum
         FROM genel_mesajlar m JOIN kullanicilar k ON k.id = m.kullanici_id
         WHERE m.silindi = 0 AND k.yasakli = 0 AND m.kullanici_id NOT IN ${ENGEL_ALT_SORGU}
           ${once ? 'AND m.id < :once' : ''}
         ORDER BY m.id DESC LIMIT 51`,
      )
      .all(once ? { ben: ben(istek).id, once } : { ben: ben(istek).id }) as Parameters<typeof genelMesajCikti>[0][];
    yanit.json({ mesajlar: satirlar.slice(0, 50).reverse().map(genelMesajCikti), dahaVar: satirlar.length > 50 });
  });

  api.post('/genel', girisGerekli, (istek: Istek, yanit) => {
    profilTamamMi(istek);
    const metin = metinAl(istek.body?.metin, 'Mesaj', SINIRLAR.mesaj);
    hizSiniri(ben(istek).id);
    const s = db.prepare('INSERT INTO genel_mesajlar (kullanici_id, metin) VALUES (?, ?)').run(ben(istek).id, metin);
    const mesaj = genelMesajCikti({
      id: Number(s.lastInsertRowid),
      metin,
      olusturma: (db.prepare("SELECT datetime('now') AS t").get() as { t: string }).t,
      kid: ben(istek).id,
      kad: ben(istek).ad,
      kbolum: ben(istek).bolum,
    });
    // Engel ilişkisi olanlara gönderme.
    const engelliler = new Set(
      (db.prepare(`SELECT engellenen_id AS id FROM engellemeler WHERE engelleyen_id = :ben
                   UNION SELECT engelleyen_id FROM engellemeler WHERE engellenen_id = :ben`).all({ ben: ben(istek).id }) as { id: number }[]).map((e) => e.id),
    );
    for (const kid of canli.cevrimiciler()) if (!engelliler.has(kid)) canli.kullaniciya(kid, { tur: 'genel_mesaj', mesaj });
    yanit.status(201).json({ mesaj });
  });

  api.delete('/genel/:id', girisGerekli, (istek: Istek, yanit) => {
    const id = idAl(istek.params.id);
    const m = db.prepare('SELECT kullanici_id FROM genel_mesajlar WHERE id = ?').get(id) as { kullanici_id: number } | undefined;
    if (!m) throw new Hata(404, 'Mesaj bulunamadı.');
    if (m.kullanici_id !== ben(istek).id && ben(istek).rol !== 'yonetici') throw new Hata(403, 'Bu mesajı silemezsin.');
    db.prepare('UPDATE genel_mesajlar SET silindi = 1 WHERE id = ?').run(id);
    canli.herkese({ tur: 'genel_mesaj_silindi', id });
    yanit.json({ tamam: true });
  });

  // ---------- Özel sohbetler ----------
  const sohbetKontrol = (istek: Istek) => {
    const id = idAl(istek.params.id);
    const s = db.prepare('SELECT * FROM sohbetler WHERE id = ?').get(id) as
      | { id: number; kullanici_a: number; kullanici_b: number }
      | undefined;
    const benId = ben(istek).id;
    if (!s || (s.kullanici_a !== benId && s.kullanici_b !== benId)) throw new Hata(404, 'Sohbet bulunamadı.');
    return { ...s, karsi: s.kullanici_a === benId ? s.kullanici_b : s.kullanici_a };
  };

  const okunmamisSayilari = (benId: number) =>
    db
      .prepare(
        `SELECT s.id AS sohbet_id,
           (SELECT COUNT(*) FROM ozel_mesajlar m WHERE m.sohbet_id = s.id AND m.gonderen_id != :ben
              AND m.id > IFNULL((SELECT son_okunan_id FROM sohbet_okuma o WHERE o.sohbet_id = s.id AND o.kullanici_id = :ben), 0)) AS n
         FROM sohbetler s WHERE s.kullanici_a = :ben OR s.kullanici_b = :ben`,
      )
      .all({ ben: benId }) as { sohbet_id: number; n: number }[];

  api.get('/okunmamis', girisGerekli, (istek: Istek, yanit) => {
    yanit.json({ toplam: okunmamisSayilari(ben(istek).id).reduce((t, s) => t + s.n, 0) });
  });

  api.get('/sohbetler', girisGerekli, (istek: Istek, yanit) => {
    const benId = ben(istek).id;
    const satirlar = db
      .prepare(
        `SELECT s.id, k.id AS kid, k.ad AS kad, k.bolum AS kbolum, k.yasakli,
           m.metin AS son_metin, m.olusturma AS son_zaman, m.gonderen_id AS son_gonderen
         FROM sohbetler s
         JOIN kullanicilar k ON k.id = CASE WHEN s.kullanici_a = :ben THEN s.kullanici_b ELSE s.kullanici_a END
         LEFT JOIN ozel_mesajlar m ON m.id = (SELECT MAX(id) FROM ozel_mesajlar WHERE sohbet_id = s.id)
         WHERE (s.kullanici_a = :ben OR s.kullanici_b = :ben) AND m.id IS NOT NULL
         ORDER BY m.id DESC`,
      )
      .all({ ben: benId }) as {
      id: number;
      kid: number;
      kad: string | null;
      kbolum: string | null;
      yasakli: number;
      son_metin: string;
      son_zaman: string;
      son_gonderen: number;
    }[];
    const okunmamis = new Map(okunmamisSayilari(benId).map((o) => [o.sohbet_id, o.n]));
    const engelliler = new Set(
      (db.prepare('SELECT engellenen_id AS id FROM engellemeler WHERE engelleyen_id = ?').all(benId) as { id: number }[]).map((e) => e.id),
    );
    yanit.json({
      sohbetler: satirlar.map((s) => ({
        id: s.id,
        karsi: { ...kullaniciOzet(s), cevrimici: canli.cevrimiciler().includes(s.kid) },
        son: { metin: s.son_metin, zaman: s.son_zaman, benden: s.son_gonderen === benId },
        okunmamis: okunmamis.get(s.id) ?? 0,
        engelli: engelliler.has(s.kid) || !!s.yasakli,
      })),
    });
  });

  api.post('/sohbetler', girisGerekli, (istek: Istek, yanit) => {
    const karsi = idAl(istek.body?.kullaniciId);
    const benId = ben(istek).id;
    if (karsi === benId) throw new Hata(400, 'Kendinle sohbet açamazsın.');
    const k = db.prepare('SELECT yasakli FROM kullanicilar WHERE id = ?').get(karsi) as { yasakli: number } | undefined;
    if (!k || k.yasakli) throw new Hata(404, 'Kullanıcı bulunamadı.');
    if (engelVar(benId, karsi)) throw new Hata(403, 'Bu kişiyle mesajlaşamazsın (engel var).');
    const [a, b] = benId < karsi ? [benId, karsi] : [karsi, benId];
    db.prepare('INSERT OR IGNORE INTO sohbetler (kullanici_a, kullanici_b) VALUES (?, ?)').run(a, b);
    const s = db.prepare('SELECT id FROM sohbetler WHERE kullanici_a = ? AND kullanici_b = ?').get(a, b) as { id: number };
    yanit.json({ id: s.id });
  });

  api.get('/sohbetler/:id/mesajlar', girisGerekli, (istek: Istek, yanit) => {
    const s = sohbetKontrol(istek);
    const once = sayiAl(istek.query.once);
    const satirlar = db
      .prepare(`${OZEL_SECIM} WHERE m.sohbet_id = :s ${once ? 'AND m.id < :once' : ''} ORDER BY m.id DESC LIMIT 51`)
      .all(once ? { s: s.id, once } : { s: s.id }) as Parameters<typeof ozelMesajCikti>[0][];
    const karsi = db.prepare('SELECT id AS kid, ad AS kad, bolum AS kbolum, yasakli, son_gorulme FROM kullanicilar WHERE id = ?').get(s.karsi) as {
      kid: number;
      kad: string | null;
      kbolum: string | null;
      yasakli: number;
      son_gorulme: string | null;
    };
    const karsiOkuma = db.prepare('SELECT son_okunan_id FROM sohbet_okuma WHERE sohbet_id = ? AND kullanici_id = ?').get(s.id, s.karsi) as
      | { son_okunan_id: number }
      | undefined;
    yanit.json({
      sohbet: {
        id: s.id,
        karsi: { ...kullaniciOzet(karsi), cevrimici: canli.cevrimiciler().includes(karsi.kid), sonGorulme: karsi.son_gorulme },
        engel: engelVar(ben(istek).id, s.karsi) || !!karsi.yasakli,
        karsiSonOkunan: karsiOkuma?.son_okunan_id ?? 0,
      },
      mesajlar: satirlar.slice(0, 50).reverse().map(ozelMesajCikti),
      dahaVar: satirlar.length > 50,
    });
  });

  api.post('/sohbetler/:id/mesajlar', girisGerekli, (istek: Istek, yanit) => {
    profilTamamMi(istek);
    const s = sohbetKontrol(istek);
    const benId = ben(istek).id;
    if (engelVar(benId, s.karsi)) throw new Hata(403, 'Bu kişiyle mesajlaşamazsın (engel var).');
    const karsiYasakli = db.prepare('SELECT yasakli FROM kullanicilar WHERE id = ?').get(s.karsi) as { yasakli: number };
    if (karsiYasakli.yasakli) throw new Hata(403, 'Bu hesap kapatılmış.');
    const metin = metinAl(istek.body?.metin, 'Mesaj', SINIRLAR.mesaj);
    let ilanId: number | null = null;
    if (istek.body?.ilanId) {
      ilanId = idAl(istek.body.ilanId);
      if (!db.prepare("SELECT 1 FROM ilanlar WHERE id = ? AND durum != 'kaldirildi'").get(ilanId)) ilanId = null;
    }
    hizSiniri(benId);
    const r = db.prepare('INSERT INTO ozel_mesajlar (sohbet_id, gonderen_id, metin, ilan_id) VALUES (?, ?, ?, ?)').run(s.id, benId, metin, ilanId);
    const id = Number(r.lastInsertRowid);
    db.prepare(
      'INSERT INTO sohbet_okuma (sohbet_id, kullanici_id, son_okunan_id) VALUES (?, ?, ?) ON CONFLICT DO UPDATE SET son_okunan_id = excluded.son_okunan_id',
    ).run(s.id, benId, id);
    const mesaj = ozelMesajCikti(db.prepare(`${OZEL_SECIM} WHERE m.id = ?`).get(id) as Parameters<typeof ozelMesajCikti>[0]);
    canli.kullaniciya(s.karsi, { tur: 'ozel_mesaj', sohbetId: s.id, mesaj });
    canli.kullaniciya(benId, { tur: 'ozel_mesaj', sohbetId: s.id, mesaj });
    yanit.status(201).json({ mesaj });
  });

  api.post('/sohbetler/:id/okundu', girisGerekli, (istek: Istek, yanit) => {
    const s = sohbetKontrol(istek);
    const sonId = (db.prepare('SELECT IFNULL(MAX(id), 0) AS id FROM ozel_mesajlar WHERE sohbet_id = ?').get(s.id) as { id: number }).id;
    db.prepare(
      'INSERT INTO sohbet_okuma (sohbet_id, kullanici_id, son_okunan_id) VALUES (?, ?, ?) ON CONFLICT DO UPDATE SET son_okunan_id = excluded.son_okunan_id',
    ).run(s.id, ben(istek).id, sonId);
    canli.kullaniciya(s.karsi, { tur: 'okundu', sohbetId: s.id, kullaniciId: ben(istek).id, sonOkunanId: sonId });
    canli.kullaniciya(ben(istek).id, { tur: 'okundu', sohbetId: s.id, kullaniciId: ben(istek).id, sonOkunanId: sonId });
    yanit.json({ sonOkunanId: sonId });
  });

  // ---------- Şikayet ----------
  api.post('/sikayet', girisGerekli, (istek: Istek, yanit) => {
    const { hedefTur, neden } = istek.body ?? {};
    const hedefId = idAl(istek.body?.hedefId);
    const tablolar: Record<string, string> = { ilan: 'ilanlar', kullanici: 'kullanicilar', genel_mesaj: 'genel_mesajlar', ozel_mesaj: 'ozel_mesajlar' };
    if (!tablolar[hedefTur]) throw new Hata(400, 'Neyi şikayet ettiğin belli değil.');
    if (!(neden in SIKAYET_NEDENLERI)) throw new Hata(400, 'Bir neden seç.');
    if (!db.prepare(`SELECT 1 FROM ${tablolar[hedefTur]} WHERE id = ?`).get(hedefId)) throw new Hata(404, 'Şikayet edilen şey bulunamadı.');
    if (hedefTur === 'ozel_mesaj') {
      // Yalnız içinde bulunduğun sohbetteki mesajı şikayet edebilirsin.
      const uygun = db
        .prepare('SELECT 1 FROM ozel_mesajlar m JOIN sohbetler s ON s.id = m.sohbet_id WHERE m.id = ? AND (s.kullanici_a = ? OR s.kullanici_b = ?)')
        .get(hedefId, ben(istek).id, ben(istek).id);
      if (!uygun) throw new Hata(404, 'Mesaj bulunamadı.');
    }
    const notMetni = metinAl(istek.body?.not, 'Not', 500, false) || null;
    const onceki = db
      .prepare("SELECT 1 FROM sikayetler WHERE sikayet_eden_id = ? AND hedef_tur = ? AND hedef_id = ? AND durum = 'acik'")
      .get(ben(istek).id, hedefTur, hedefId);
    if (!onceki)
      db.prepare('INSERT INTO sikayetler (sikayet_eden_id, hedef_tur, hedef_id, neden, not_metni) VALUES (?, ?, ?, ?, ?)').run(
        ben(istek).id,
        hedefTur,
        hedefId,
        neden,
        notMetni,
      );
    yanit.status(201).json({ tamam: true });
  });

  // ---------- Yönetim ----------
  api.get('/yonetim/ozet', girisGerekli, yoneticiGerekli, (_istek, yanit) => {
    const say = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
    yanit.json({
      kullanici: say('SELECT COUNT(*) AS n FROM kullanicilar'),
      yasakli: say('SELECT COUNT(*) AS n FROM kullanicilar WHERE yasakli = 1'),
      aktifIlan: say("SELECT COUNT(*) AS n FROM ilanlar WHERE durum = 'aktif'"),
      tamamlanan: say("SELECT COUNT(*) AS n FROM ilanlar WHERE durum = 'tamamlandi'"),
      acikSikayet: say("SELECT COUNT(*) AS n FROM sikayetler WHERE durum = 'acik'"),
      genelMesaj: say('SELECT COUNT(*) AS n FROM genel_mesajlar WHERE silindi = 0'),
      cevrimici: canli.cevrimiciler().length,
    });
  });

  api.get('/yonetim/sikayetler', girisGerekli, yoneticiGerekli, (istek, yanit) => {
    const durum = istek.query.durum === 'kapali' ? 'kapali' : 'acik';
    const satirlar = db
      .prepare(
        `SELECT s.*, k.ad AS sikayet_eden_ad, k.eposta AS sikayet_eden_eposta FROM sikayetler s
         JOIN kullanicilar k ON k.id = s.sikayet_eden_id WHERE s.durum = ? ORDER BY s.id DESC LIMIT 100`,
      )
      .all(durum) as { id: number; hedef_tur: string; hedef_id: number; [k: string]: unknown }[];
    const hedef = (tur: string, id: number) => {
      if (tur === 'ilan') {
        const i = db.prepare('SELECT i.id, i.baslik, i.durum, i.kullanici_id, k.ad, k.yasakli FROM ilanlar i JOIN kullanicilar k ON k.id = i.kullanici_id WHERE i.id = ?').get(id) as
          | Record<string, unknown>
          | undefined;
        return i && { ozet: `İlan: ${i.baslik}`, durum: i.durum, sahipId: i.kullanici_id, sahipAd: i.ad, sahipYasakli: !!i.yasakli };
      }
      if (tur === 'kullanici') {
        const k = db.prepare('SELECT id, ad, eposta, yasakli FROM kullanicilar WHERE id = ?').get(id) as Record<string, unknown> | undefined;
        return k && { ozet: `Kullanıcı: ${k.ad ?? 'Adsız'} (${k.eposta})`, sahipId: k.id, sahipAd: k.ad, sahipYasakli: !!k.yasakli };
      }
      const tablo = tur === 'genel_mesaj' ? 'genel_mesajlar' : 'ozel_mesajlar';
      const kol = tur === 'genel_mesaj' ? 'kullanici_id' : 'gonderen_id';
      const m = db
        .prepare(`SELECT m.metin, m.${kol} AS sahip, k.ad, k.yasakli ${tur === 'genel_mesaj' ? ', m.silindi' : ''} FROM ${tablo} m JOIN kullanicilar k ON k.id = m.${kol} WHERE m.id = ?`)
        .get(id) as Record<string, unknown> | undefined;
      return (
        m && {
          ozet: `${tur === 'genel_mesaj' ? 'Genel sohbet' : 'Özel'} mesaj: "${String(m.metin).slice(0, 140)}"`,
          durum: m.silindi ? 'silindi' : undefined,
          sahipId: m.sahip,
          sahipAd: m.ad,
          sahipYasakli: !!m.yasakli,
        }
      );
    };
    yanit.json({ sikayetler: satirlar.map((s) => ({ ...s, hedef: hedef(s.hedef_tur, s.hedef_id) ?? null })) });
  });

  api.post('/yonetim/sikayetler/:id/kapat', girisGerekli, yoneticiGerekli, (istek, yanit) => {
    db.prepare("UPDATE sikayetler SET durum = 'kapali' WHERE id = ?").run(idAl(istek.params.id));
    yanit.json({ tamam: true });
  });

  api.post('/yonetim/kullanicilar/:id/yasak', girisGerekli, yoneticiGerekli, (istek: Istek, yanit) => {
    const id = idAl(istek.params.id);
    if (id === ben(istek).id) throw new Hata(400, 'Kendini yasaklayamazsın.');
    const yasakli = istek.body?.yasakli ? 1 : 0;
    db.prepare('UPDATE kullanicilar SET yasakli = ? WHERE id = ?').run(yasakli, id);
    if (yasakli) {
      db.prepare('DELETE FROM oturumlar WHERE kullanici_id = ?').run(id);
      canli.kopar(id);
    }
    yanit.json({ yasakli: !!yasakli });
  });

  api.use((_istek, _yanit) => {
    throw new Hata(404, 'Böyle bir API yok.');
  });

  app.use('/api', api);

  // Fotoğraflar yalnız giriş yapmış kişilere gösterilir.
  app.get('/foto/:ad', (istek, yanit) => {
    if (!oturumBul(db, cerezOku(istek.headers.cookie, OTURUM_CEREZI))) return void yanit.status(401).end();
    const ad = String(istek.params.ad);
    if (!FOTO_ADI.test(ad)) return void yanit.status(404).end();
    yanit.sendFile(join(fotoKlasoru, ad), { maxAge: '7d', immutable: true, headers: { 'X-Content-Type-Options': 'nosniff' } }, (h) => {
      if (h && !yanit.headersSent) yanit.status(404).end();
    });
  });

  const hataYakala = (hata: unknown, _istek: Request, yanit: Response, _devam: NextFunction) => {
    if (hata instanceof Hata || hata instanceof KimlikHatasi) return void yanit.status(hata.durum).json({ hata: hata.message });
    const h = hata as { type?: string; status?: number };
    if (h?.type === 'entity.too.large') return void yanit.status(413).json({ hata: 'Gönderilen veri çok büyük.' });
    if (h?.type === 'entity.parse.failed') return void yanit.status(400).json({ hata: 'İstek okunamadı.' });
    console.error(hata);
    yanit.status(500).json({ hata: 'Sunucuda bir sorun oldu.' });
  };

  return { app, canli, hataYakala };
}

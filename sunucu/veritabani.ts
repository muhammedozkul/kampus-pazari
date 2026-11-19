// SQLite bağlantısı ve şema. Node'un yerleşik `node:sqlite` modülü kullanılır (ek paket yok).
import { DatabaseSync } from 'node:sqlite';

export type Db = DatabaseSync;

const SEMA = `
CREATE TABLE IF NOT EXISTS kullanicilar (
  id            INTEGER PRIMARY KEY,
  eposta        TEXT    NOT NULL UNIQUE,
  ad            TEXT,
  bolum         TEXT,
  rol           TEXT    NOT NULL DEFAULT 'uye' CHECK (rol IN ('uye', 'yonetici')),
  yasakli       INTEGER NOT NULL DEFAULT 0,
  olusturma     TEXT    NOT NULL DEFAULT (datetime('now')),
  son_gorulme   TEXT
);

CREATE TABLE IF NOT EXISTS dogrulama_kodlari (
  id            INTEGER PRIMARY KEY,
  eposta        TEXT    NOT NULL,
  kod_ozet      TEXT    NOT NULL,
  son_gecerlilik INTEGER NOT NULL,
  deneme        INTEGER NOT NULL DEFAULT 0,
  kullanildi    INTEGER NOT NULL DEFAULT 0,
  olusturma     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_kod_eposta ON dogrulama_kodlari (eposta, olusturma);

-- Geliştirme için "test posta kutusu": gerçek e-posta gönderilmez, mektuplar buraya yazılır.
CREATE TABLE IF NOT EXISTS test_posta (
  id            INTEGER PRIMARY KEY,
  alici         TEXT    NOT NULL,
  konu          TEXT    NOT NULL,
  govde         TEXT    NOT NULL,
  olusturma     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS oturumlar (
  anahtar_ozet  TEXT    PRIMARY KEY,
  kullanici_id  INTEGER NOT NULL REFERENCES kullanicilar (id) ON DELETE CASCADE,
  son_gecerlilik INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ilanlar (
  id            INTEGER PRIMARY KEY,
  kullanici_id  INTEGER NOT NULL REFERENCES kullanicilar (id) ON DELETE CASCADE,
  tur           TEXT    NOT NULL CHECK (tur IN ('satilik', 'takas', 'satilik_takas', 'ariyorum')),
  kategori      TEXT    NOT NULL,
  baslik        TEXT    NOT NULL,
  aciklama      TEXT    NOT NULL DEFAULT '',
  fiyat         INTEGER,
  takas_istegi  TEXT,
  kosul         TEXT,
  durum         TEXT    NOT NULL DEFAULT 'aktif' CHECK (durum IN ('aktif', 'tamamlandi', 'kaldirildi')),
  olusturma     TEXT    NOT NULL DEFAULT (datetime('now')),
  guncelleme    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_ilan_liste ON ilanlar (durum, olusturma DESC);

CREATE TABLE IF NOT EXISTS ilan_fotolari (
  id            INTEGER PRIMARY KEY,
  ilan_id       INTEGER NOT NULL REFERENCES ilanlar (id) ON DELETE CASCADE,
  dosya         TEXT    NOT NULL,
  sira          INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS favoriler (
  kullanici_id  INTEGER NOT NULL REFERENCES kullanicilar (id) ON DELETE CASCADE,
  ilan_id       INTEGER NOT NULL REFERENCES ilanlar (id) ON DELETE CASCADE,
  PRIMARY KEY (kullanici_id, ilan_id)
);

CREATE TABLE IF NOT EXISTS genel_mesajlar (
  id            INTEGER PRIMARY KEY,
  kullanici_id  INTEGER NOT NULL REFERENCES kullanicilar (id) ON DELETE CASCADE,
  metin         TEXT    NOT NULL,
  silindi       INTEGER NOT NULL DEFAULT 0,
  olusturma     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- İki kişi arasında tek sohbet: kullanici_a < kullanici_b kuralıyla çift tekrarlanmaz.
CREATE TABLE IF NOT EXISTS sohbetler (
  id            INTEGER PRIMARY KEY,
  kullanici_a   INTEGER NOT NULL REFERENCES kullanicilar (id) ON DELETE CASCADE,
  kullanici_b   INTEGER NOT NULL REFERENCES kullanicilar (id) ON DELETE CASCADE,
  olusturma     TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK (kullanici_a < kullanici_b),
  UNIQUE (kullanici_a, kullanici_b)
);

CREATE TABLE IF NOT EXISTS ozel_mesajlar (
  id            INTEGER PRIMARY KEY,
  sohbet_id     INTEGER NOT NULL REFERENCES sohbetler (id) ON DELETE CASCADE,
  gonderen_id   INTEGER NOT NULL REFERENCES kullanicilar (id) ON DELETE CASCADE,
  metin         TEXT    NOT NULL,
  ilan_id       INTEGER REFERENCES ilanlar (id) ON DELETE SET NULL,
  olusturma     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_ozel_sohbet ON ozel_mesajlar (sohbet_id, id);

CREATE TABLE IF NOT EXISTS sohbet_okuma (
  sohbet_id     INTEGER NOT NULL REFERENCES sohbetler (id) ON DELETE CASCADE,
  kullanici_id  INTEGER NOT NULL REFERENCES kullanicilar (id) ON DELETE CASCADE,
  son_okunan_id INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (sohbet_id, kullanici_id)
);

CREATE TABLE IF NOT EXISTS engellemeler (
  engelleyen_id INTEGER NOT NULL REFERENCES kullanicilar (id) ON DELETE CASCADE,
  engellenen_id INTEGER NOT NULL REFERENCES kullanicilar (id) ON DELETE CASCADE,
  olusturma     TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (engelleyen_id, engellenen_id)
);

CREATE TABLE IF NOT EXISTS sikayetler (
  id            INTEGER PRIMARY KEY,
  sikayet_eden_id INTEGER NOT NULL REFERENCES kullanicilar (id) ON DELETE CASCADE,
  hedef_tur     TEXT    NOT NULL CHECK (hedef_tur IN ('ilan', 'kullanici', 'genel_mesaj', 'ozel_mesaj')),
  hedef_id      INTEGER NOT NULL,
  neden         TEXT    NOT NULL,
  not_metni     TEXT,
  durum         TEXT    NOT NULL DEFAULT 'acik' CHECK (durum IN ('acik', 'kapali')),
  olusturma     TEXT    NOT NULL DEFAULT (datetime('now'))
);
`;

export function veritabaniAc(yol: string): Db {
  const db = new DatabaseSync(yol);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  db.exec(SEMA);
  return db;
}

/** Birden çok yazmayı tek seferde yapar; hata olursa hepsini geri alır. */
export function islem<T>(db: Db, is: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const sonuc = is();
    db.exec('COMMIT');
    return sonuc;
  } catch (hata) {
    db.exec('ROLLBACK');
    throw hata;
  }
}

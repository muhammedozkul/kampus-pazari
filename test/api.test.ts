// API testleri: geçici veritabanıyla gerçek HTTP istekleri.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { uygulamaKur } from '../sunucu/uygulama.ts';
import { veritabaniAc, type Db } from '../sunucu/veritabani.ts';
import { epostaDuzelt } from '../sunucu/kimlik.ts';
import { aramaKelimeleri } from '../sunucu/uygulama.ts';

let sunucu: Server;
let taban = '';
let db: Db;
let klasor = '';

before(async () => {
  klasor = mkdtempSync(join(tmpdir(), 'kp-test-'));
  db = veritabaniAc(join(klasor, 'test.db'));
  const { app, canli, hataYakala } = uygulamaKur({ db, fotoKlasoru: join(klasor, 'foto'), yoneticiEpostalari: ['yonetici@ogr.dpu.edu.tr'] });
  app.use(hataYakala);
  sunucu = createServer(app);
  canli.bagla(sunucu);
  await new Promise<void>((r) => sunucu.listen(0, '127.0.0.1', r));
  const adres = sunucu.address();
  taban = `http://127.0.0.1:${typeof adres === 'object' && adres ? adres.port : 0}`;
});
after(() => {
  sunucu.close();
  sunucu.closeAllConnections();
  db.close();
  rmSync(klasor, { recursive: true, force: true });
});

async function istek(yol: string, secenek: { yontem?: string; govde?: unknown; cerez?: string; origin?: string } = {}) {
  const yanit = await fetch(taban + yol, {
    method: secenek.yontem ?? (secenek.govde ? 'POST' : 'GET'),
    headers: {
      ...(secenek.govde ? { 'content-type': 'application/json' } : {}),
      ...(secenek.cerez ? { cookie: secenek.cerez } : {}),
      ...(secenek.origin ? { origin: secenek.origin } : {}),
    },
    body: secenek.govde ? JSON.stringify(secenek.govde) : undefined,
  });
  const veri = yanit.headers.get('content-type')?.includes('json') ? await yanit.json() : null;
  return { durum: yanit.status, veri, cerez: yanit.headers.get('set-cookie')?.split(';')[0] };
}

const sonKod = (eposta: string) => {
  const m = db.prepare('SELECT konu FROM test_posta WHERE alici = ? ORDER BY id DESC LIMIT 1').get(eposta) as { konu: string };
  return m.konu.match(/(\d{6})/)![1];
};

async function girisYap(eposta: string, ad: string) {
  db.prepare('DELETE FROM dogrulama_kodlari WHERE eposta = ?').run(eposta);
  assert.equal((await istek('/api/giris/kod', { govde: { eposta } })).durum, 200);
  const g = await istek('/api/giris/dogrula', { govde: { eposta, kod: sonKod(eposta) } });
  assert.equal(g.durum, 200);
  const cerez = g.cerez!;
  await istek('/api/ben', { yontem: 'PATCH', govde: { ad, bolum: 'Bilgisayar Programcılığı' }, cerez });
  const ben = await istek('/api/ben', { cerez });
  return { cerez, id: ben.veri.ben.id as number };
}

describe('e-posta kuralı', () => {
  test('yalnız @ogr.dpu.edu.tr kabul edilir', () => {
    assert.equal(epostaDuzelt('  Ali.Veli@OGR.DPU.EDU.TR '), 'ali.veli@ogr.dpu.edu.tr');
    assert.equal(epostaDuzelt('ali@dpu.edu.tr'), null);
    assert.equal(epostaDuzelt('ali@ogr.dpu.edu.tr.kotu.com'), null);
    assert.equal(epostaDuzelt('ali@gmail.com'), null);
    assert.equal(epostaDuzelt('@ogr.dpu.edu.tr'), null);
    assert.equal(epostaDuzelt(42), null);
  });
});

describe('Türkçe arama', () => {
  test('harfleri sadeleştirir ve ünsüz yumuşamasını kapsar', () => {
    assert.deepEqual(aramaKelimeleri('Kitap'), [['kitap', 'kitab']]);
    assert.deepEqual(aramaKelimeleri('İŞLETİM  sistemi'), [['isletim'], ['sistemi']]);
    assert.deepEqual(aramaKelimeleri('ağaç'), [['agac']]);
    assert.deepEqual(aramaKelimeleri('   '), []);
  });
});

describe('giriş', () => {
  test('başka uzantıya kod gönderilmez', async () => {
    const y = await istek('/api/giris/kod', { govde: { eposta: 'biri@gmail.com' } });
    assert.equal(y.durum, 400);
  });

  test('yanlış kod hakkı azaltır, doğru kod oturum açar', async () => {
    const eposta = 'deneme1@ogr.dpu.edu.tr';
    await istek('/api/giris/kod', { govde: { eposta } });
    const kod = sonKod(eposta);
    const yanlis = kod === '000000' ? '111111' : '000000';
    const y1 = await istek('/api/giris/dogrula', { govde: { eposta, kod: yanlis } });
    assert.equal(y1.durum, 400);
    assert.match(y1.veri.hata, /4 hakkın kaldı/);
    const y2 = await istek('/api/giris/dogrula', { govde: { eposta, kod } });
    assert.equal(y2.durum, 200);
    assert.equal(y2.veri.yeni, true);
    assert.ok(y2.cerez?.startsWith('kp_oturum='));
    // Kod ikinci kez kullanılamaz.
    assert.equal((await istek('/api/giris/dogrula', { govde: { eposta, kod } })).durum, 400);
  });

  test('30 saniye dolmadan yeni kod istenemez', async () => {
    const eposta = 'deneme2@ogr.dpu.edu.tr';
    assert.equal((await istek('/api/giris/kod', { govde: { eposta } })).durum, 200);
    assert.equal((await istek('/api/giris/kod', { govde: { eposta } })).durum, 429);
  });

  test('girişsiz ilan listesi kapalı', async () => {
    assert.equal((await istek('/api/ilanlar')).durum, 401);
  });

  test('başka siteden gelen yazma isteği reddedilir', async () => {
    const y = await istek('/api/giris/kod', { govde: { eposta: 'x@ogr.dpu.edu.tr' }, origin: 'https://kotu.example' });
    assert.equal(y.durum, 403);
  });
});

describe('ilan, engel ve mesaj', () => {
  let ayse: { cerez: string; id: number };
  let mehmet: { cerez: string; id: number };
  let ilanId = 0;

  before(async () => {
    ayse = await girisYap('ayse@ogr.dpu.edu.tr', 'Ayşe');
    mehmet = await girisYap('mehmet@ogr.dpu.edu.tr', 'Mehmet');
  });

  test('satılık ilan fiyatsız verilemez', async () => {
    const y = await istek('/api/ilanlar', { govde: { tur: 'satilik', kategori: 'kitap', baslik: 'Kalkülüs kitabı' }, cerez: ayse.cerez });
    assert.equal(y.durum, 400);
  });

  test('ilan verilir, Türkçe harfle aranır, filtrelenir', async () => {
    const y = await istek('/api/ilanlar', {
      govde: { tur: 'satilik_takas', kategori: 'kitap', baslik: 'İŞLETİM Sistemleri Kitabı', aciklama: 'Temiz', fiyat: 150, takasIstegi: 'Veritabanı kitabı' },
      cerez: ayse.cerez,
    });
    assert.equal(y.durum, 201);
    ilanId = y.veri.id;
    const ara = await istek('/api/ilanlar?q=' + encodeURIComponent('işletim'), { cerez: mehmet.cerez });
    assert.equal(ara.veri.ilanlar.length, 1);
    assert.equal((await istek('/api/ilanlar?tur=takas', { cerez: mehmet.cerez })).veri.ilanlar.length, 1);
    assert.equal((await istek('/api/ilanlar?tur=ariyorum', { cerez: mehmet.cerez })).veri.ilanlar.length, 0);
    assert.equal((await istek('/api/ilanlar?max=100', { cerez: mehmet.cerez })).veri.ilanlar.length, 0);
    // "kitap" yazınca "Kitabı" da bulunur; Türkçe klavyesiz yazım da çalışır; kelimeler ayrı ayrı aranır.
    for (const sorgu of ['kitap', 'isletim', 'sistemleri işletim', 'İŞLETİM kitabı']) {
      const v = await istek('/api/ilanlar?q=' + encodeURIComponent(sorgu), { cerez: mehmet.cerez });
      assert.equal(v.veri.ilanlar.length, 1, sorgu);
    }
    assert.equal((await istek('/api/ilanlar?q=' + encodeURIComponent('kitap bisiklet'), { cerez: mehmet.cerez })).veri.ilanlar.length, 0);
  });

  test('başkasının ilanı düzenlenemez', async () => {
    const y = await istek(`/api/ilanlar/${ilanId}`, {
      yontem: 'PATCH',
      govde: { tur: 'satilik', kategori: 'kitap', baslik: 'Ele geçirildi', fiyat: 1 },
      cerez: mehmet.cerez,
    });
    assert.equal(y.durum, 403);
  });

  test('fotoğraf olmayan dosya reddedilir', async () => {
    const sahte = 'data:image/png;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64');
    const y = await istek('/api/ilanlar', {
      govde: { tur: 'ariyorum', kategori: 'diger', baslik: 'Hesap makinesi', fotolar: [sahte] },
      cerez: mehmet.cerez,
    });
    assert.equal(y.durum, 400);
  });

  test('özel mesaj gider, okunmamış sayılır', async () => {
    const s = await istek('/api/sohbetler', { govde: { kullaniciId: ayse.id }, cerez: mehmet.cerez });
    assert.equal(s.durum, 200);
    const m = await istek(`/api/sohbetler/${s.veri.id}/mesajlar`, { govde: { metin: 'Kitap duruyor mu?', ilanId }, cerez: mehmet.cerez });
    assert.equal(m.durum, 201);
    assert.equal(m.veri.mesaj.ilan.id, ilanId);
    assert.equal((await istek('/api/okunmamis', { cerez: ayse.cerez })).veri.toplam, 1);
    await istek(`/api/sohbetler/${s.veri.id}/okundu`, { govde: {}, cerez: ayse.cerez });
    assert.equal((await istek('/api/okunmamis', { cerez: ayse.cerez })).veri.toplam, 0);
  });

  test('engellenen kişi mesaj atamaz ve ilanları görünmez', async () => {
    await istek(`/api/kullanicilar/${mehmet.id}/engelle`, { govde: { engelle: true }, cerez: ayse.cerez });
    const s = await istek('/api/sohbetler', { govde: { kullaniciId: ayse.id }, cerez: mehmet.cerez });
    assert.equal(s.durum, 403);
    assert.equal((await istek('/api/ilanlar', { cerez: mehmet.cerez })).veri.ilanlar.length, 0);
    assert.equal((await istek(`/api/ilanlar/${ilanId}`, { cerez: mehmet.cerez })).durum, 404);
    await istek(`/api/kullanicilar/${mehmet.id}/engelle`, { govde: { engelle: false }, cerez: ayse.cerez });
    assert.equal((await istek('/api/ilanlar', { cerez: mehmet.cerez })).veri.ilanlar.length, 1);
  });

  test('kendi genel mesajını gövdesiz DELETE ile siler, başkasınınkini silemez', async () => {
    const m = await istek('/api/genel', { govde: { metin: 'silinecek' }, cerez: ayse.cerez });
    assert.equal(m.durum, 201);
    const yabanci = await fetch(`${taban}/api/genel/${m.veri.mesaj.id}`, { method: 'DELETE', headers: { cookie: mehmet.cerez } });
    assert.equal(yabanci.status, 403);
    const kendi = await fetch(`${taban}/api/genel/${m.veri.mesaj.id}`, { method: 'DELETE', headers: { cookie: ayse.cerez } });
    assert.equal(kendi.status, 200);
    // Gövdesi olan ama JSON olmayan istek yine reddedilir.
    const form = await fetch(`${taban}/api/genel`, { method: 'POST', headers: { cookie: ayse.cerez, 'content-type': 'text/plain' }, body: 'x' });
    assert.equal(form.status, 415);
  });

  test('nesne prototipindeki adlar (toString, constructor) seçenek sayılmaz', async () => {
    const neden = await istek('/api/sikayet', { govde: { hedefTur: 'ilan', hedefId: ilanId, neden: 'toString' }, cerez: mehmet.cerez });
    assert.equal(neden.durum, 400);
    const tur = await istek('/api/sikayet', { govde: { hedefTur: 'constructor', hedefId: 1, neden: 'spam' }, cerez: mehmet.cerez });
    assert.equal(tur.durum, 400);
    const y = await istek('/api/ilanlar', { govde: { tur: 'satilik', kategori: 'kitap', baslik: 'Kosul deneme', fiyat: 5, kosul: 'toString' }, cerez: mehmet.cerez });
    assert.equal(y.durum, 201);
    const d = await istek(`/api/ilanlar/${y.veri.id}`, { cerez: mehmet.cerez });
    assert.equal(d.veri.ilan.kosul, null);
  });

  test('test posta kutusu yalnız son ve kullanılmamış kodu geçerli gösterir', async () => {
    const eposta = 'posta.deneme@ogr.dpu.edu.tr';
    await istek('/api/giris/kod', { govde: { eposta } });
    let v = await istek(`/api/test-posta?alici=${eposta}`);
    assert.equal(v.veri.mektuplar[0].gecerli, true);
    await istek('/api/giris/dogrula', { govde: { eposta, kod: sonKod(eposta) } });
    v = await istek(`/api/test-posta?alici=${eposta}`);
    assert.equal(v.veri.mektuplar[0].gecerli, false);
  });

  test('yönetici olmayan yönetim sayfasına giremez; yönetici yasaklayınca oturum kapanır', async () => {
    assert.equal((await istek('/api/yonetim/ozet', { cerez: ayse.cerez })).durum, 403);
    const yonetici = await girisYap('yonetici@ogr.dpu.edu.tr', 'Yönetici');
    assert.equal((await istek('/api/yonetim/ozet', { cerez: yonetici.cerez })).durum, 200);
    await istek('/api/sikayet', { govde: { hedefTur: 'kullanici', hedefId: mehmet.id, neden: 'spam' }, cerez: ayse.cerez });
    const liste = await istek('/api/yonetim/sikayetler', { cerez: yonetici.cerez });
    assert.equal(liste.veri.sikayetler.length, 1);
    await istek(`/api/yonetim/kullanicilar/${mehmet.id}/yasak`, { govde: { yasakli: true }, cerez: yonetici.cerez });
    assert.equal((await istek('/api/ilanlar', { cerez: mehmet.cerez })).durum, 401);
    assert.equal((await istek('/api/giris/kod', { govde: { eposta: 'mehmet@ogr.dpu.edu.tr' } })).durum, 403);
  });
});

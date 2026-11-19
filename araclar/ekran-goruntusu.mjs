// README ekran görüntülerini (docs/ekran) yeniden çeker. Sunucu açıkken (npm run dev):
//   npm i --no-save playwright-core && node araclar/ekran-goruntusu.mjs docs/ekran
// Yerel Google Chrome kullanır; demo hesap ayse.yilmaz ile girer.
import { chromium } from 'playwright-core';

const KOK = 'http://localhost:8776';
const CIKTI = process.argv[2];
const EPOSTA = 'ayse.yilmaz@ogr.dpu.edu.tr';
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

const tarayici = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });

async function girisYap(sayfa) {
  await sayfa.goto(KOK + '/giris');
  const sonuc = await sayfa.evaluate(async (eposta) => {
    const j = (u, b) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
    await j('/api/giris/kod', { eposta });
    const posta = await (await fetch('/api/test-posta?alici=' + encodeURIComponent(eposta))).json();
    const kod = posta.mektuplar[0].govde.match(/\b\d{6}\b/)[0];
    const d = await j('/api/giris/dogrula', { eposta, kod });
    return d.status;
  }, EPOSTA);
  if (sonuc !== 200) throw new Error('Giriş olmadı: ' + sonuc);
}

async function cek(sayfa, yol, ad, hazirla) {
  await sayfa.goto(KOK + yol, { waitUntil: 'networkidle' });
  if (hazirla) await hazirla(sayfa);
  await bekle(900);
  await sayfa.screenshot({ path: `${CIKTI}/${ad}.png` });
  console.log('çekildi', ad);
}

const ilanId = async (sayfa) =>
  sayfa.evaluate(async () => (await (await fetch('/api/ilanlar?q=Mukavemet')).json()).ilanlar[0].id);
const ilkSohbet = async (s) => {
  await s.locator('.sohbet-satiri').first().click();
  await s.waitForLoadState('networkidle');
};

// Masaüstü, açık tema
{
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', locale: 'tr-TR', reducedMotion: 'reduce' });
  const s = await ctx.newPage();
  await cek(s, '/giris', 'giris');
  await girisYap(s);
  const id = await ilanId(s);
  await cek(s, '/', 'ana-sayfa');
  await cek(s, '/ilan/' + id, 'ilan-detay');
  await cek(s, '/mesajlar', 'mesajlar', ilkSohbet);
  await cek(s, '/sohbet', 'genel-sohbet');
  await cek(s, '/ilan-ver', 'ilan-ver', async (x) => {
    await x.locator('.tur-secenek').first().click();
  });
  const kurabiye = await ctx.storageState();
  await ctx.close();

  // Masaüstü, koyu tema
  const koyu = await tarayici.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', locale: 'tr-TR', reducedMotion: 'reduce', storageState: kurabiye });
  await cek(await koyu.newPage(), '/', 'ana-sayfa-koyu');
  await koyu.close();

  // Telefon (390×844, 2x)
  const tel = await tarayici.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light', locale: 'tr-TR', reducedMotion: 'reduce', storageState: kurabiye });
  const t = await tel.newPage();
  await cek(t, '/', 'telefon-ana-sayfa');
  await cek(t, '/ilan/' + id, 'telefon-ilan');
  await cek(t, '/sohbet', 'telefon-sohbet');
  await tel.close();
}
await tarayici.close();

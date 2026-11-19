// Sunucuyu başlatır. `--gelistirme`: Vite ile anında yenilenen arayüz. `--tarayici`: açılınca tarayıcıyı aç.
import express from 'express';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { uygulamaKur } from './uygulama.ts';
import { veritabaniAc } from './veritabani.ts';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const gelistirme = process.argv.includes('--gelistirme');
const tarayiciAc = process.argv.includes('--tarayici');
const PORT = Number(process.env.PORT) || 8776;
const HOST = process.env.HOST || '127.0.0.1';

mkdirSync(join(kok, 'veri'), { recursive: true });
const db = veritabaniAc(join(kok, 'veri', 'pazar.db'));
const { app, canli, hataYakala } = uygulamaKur({
  db,
  fotoKlasoru: join(kok, 'veri', 'fotolar'),
  yoneticiEpostalari: (process.env.YONETICI_EPOSTALARI || 'yonetici@ogr.dpu.edu.tr').split(',').map((e) => e.trim()),
});

const sunucu = createServer(app);
canli.bagla(sunucu);

if (gelistirme) {
  const { createServer: viteKur } = await import('vite');
  const vite = await viteKur({
    configFile: join(kok, 'vite.config.ts'),
    server: { middlewareMode: true, hmr: { server: sunucu } },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const dist = join(kok, 'dist');
  if (!existsSync(join(dist, 'index.html'))) {
    console.error('Arayüz derlenmemiş. Önce `npm run build` çalıştır.');
    process.exit(1);
  }
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  // Tek sayfa uygulama: bilinmeyen adresler index.html'e düşer, React yönlendirir.
  app.get('/{*yol}', (_istek, yanit) => yanit.sendFile(join(dist, 'index.html')));
}
app.use(hataYakala);

sunucu.listen(PORT, HOST, () => {
  const adres = `http://${HOST}:${PORT}/`;
  console.log(`Kampüs Pazarı çalışıyor: ${adres}${gelistirme ? ' (geliştirme)' : ''}`);
  console.log('Giriş kodları terminale ve sitedeki "Test posta kutusu" sayfasına düşer. Kapatmak için Ctrl+C.');
  if (tarayiciAc) execFile(process.platform === 'win32' ? 'explorer' : process.platform === 'darwin' ? 'open' : 'xdg-open', [adres]);
});

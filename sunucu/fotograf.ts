// İlan fotoğrafları: tarayıcı küçültüp data URL olarak gönderir, sunucu türü baytlardan doğrular.
import { randomBytes } from 'node:crypto';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SINIRLAR } from '../ortak/sabitler.ts';

export const FOTO_ADI = /^[a-f0-9]{24}\.(jpg|png|webp)$/;

function turBul(b: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

export class FotoHatasi extends Error {}

/** data URL'yi çözer, doğrular ve diske yazar; dosya adını döndürür. */
export function fotoKaydet(klasor: string, veri: string): string {
  const eslesme = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(veri);
  if (!eslesme) throw new FotoHatasi('Fotoğraf biçimi tanınmadı (JPG, PNG ya da WEBP olmalı).');
  const bayt = Buffer.from(eslesme[1], 'base64');
  if (bayt.length > SINIRLAR.fotoBayt) throw new FotoHatasi('Fotoğraf çok büyük.');
  const tur = turBul(bayt);
  if (!tur) throw new FotoHatasi('Dosya bir fotoğraf değil.');
  mkdirSync(klasor, { recursive: true });
  const ad = `${randomBytes(12).toString('hex')}.${tur}`;
  writeFileSync(join(klasor, ad), bayt);
  return ad;
}

export function fotoSil(klasor: string, ad: string) {
  if (!FOTO_ADI.test(ad)) return;
  try {
    unlinkSync(join(klasor, ad));
  } catch {
    /* zaten yok */
  }
}

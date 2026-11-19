// Biçimlendirme ve fotoğraf küçültme yardımcıları.
import { AVATAR_RENKLERI } from '../../ortak/sabitler.ts';

/** SQLite "YYYY-MM-DD HH:MM:SS" (UTC) → Date */
export const tarih = (sql: string) => new Date(sql.replace(' ', 'T') + 'Z');

export function goreceZaman(sql: string): string {
  const fark = (Date.now() - tarih(sql).getTime()) / 1000;
  if (fark < 45) return 'az önce';
  if (fark < 3600) return `${Math.round(fark / 60)} dk önce`;
  if (fark < 86400) return `${Math.round(fark / 3600)} sa önce`;
  if (fark < 86400 * 7) return `${Math.round(fark / 86400)} gün önce`;
  return tarih(sql).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export const saat = (sql: string) => tarih(sql).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

export function gunEtiketi(sql: string): string {
  const t = tarih(sql);
  const bugun = new Date();
  const dun = new Date();
  dun.setDate(bugun.getDate() - 1);
  if (t.toDateString() === bugun.toDateString()) return 'Bugün';
  if (t.toDateString() === dun.toDateString()) return 'Dün';
  return t.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
}

export const fiyatYaz = (fiyat: number | null) =>
  fiyat === null ? '' : fiyat === 0 ? 'Ücretsiz' : `${fiyat.toLocaleString('tr-TR')} ₺`;

export const avatarRengi = (id: number) => AVATAR_RENKLERI[id % AVATAR_RENKLERI.length];

export const basHarfler = (ad: string) =>
  ad
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toLocaleUpperCase('tr-TR'))
    .join('') || '?';

/** Fotoğrafı en uzun kenarı 1280 px olacak şekilde küçültür, JPEG data URL döndürür. */
export async function fotoKucult(dosya: File, enUzun = 1280): Promise<string> {
  if (!dosya.type.startsWith('image/')) throw new Error('Yalnız fotoğraf yükleyebilirsin.');
  const bitmap = await createImageBitmap(dosya).catch(() => {
    throw new Error('Bu fotoğraf açılamadı. JPG ya da PNG dene.');
  });
  const oran = Math.min(1, enUzun / Math.max(bitmap.width, bitmap.height));
  const tuval = document.createElement('canvas');
  tuval.width = Math.round(bitmap.width * oran);
  tuval.height = Math.round(bitmap.height * oran);
  const ctx = tuval.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, tuval.width, tuval.height);
  ctx.drawImage(bitmap, 0, 0, tuval.width, tuval.height);
  bitmap.close();
  return tuval.toDataURL('image/jpeg', 0.82);
}

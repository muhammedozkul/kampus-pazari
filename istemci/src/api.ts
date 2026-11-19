// Sunucuyla konuşan küçük yardımcı ve veri türleri.
import type { IlanTuru, Kategori, Kosul } from '../../ortak/sabitler.ts';

export type Ben = { id: number; eposta: string; ad: string | null; bolum: string | null; rol: 'uye' | 'yonetici' };
export type KullaniciOzet = { id: number; ad: string; bolum: string | null; cevrimici?: boolean };

export type Ilan = {
  id: number;
  tur: IlanTuru;
  kategori: Kategori;
  baslik: string;
  fiyat: number | null;
  takasIstegi: string | null;
  kosul: Kosul | null;
  durum: 'aktif' | 'tamamlandi' | 'kaldirildi';
  olusturma: string;
  foto: string | null;
  favori: boolean;
  kullanici: KullaniciOzet;
};
export type IlanDetayi = Ilan & {
  aciklama: string;
  guncelleme: string;
  fotolar: string[];
  sahip: KullaniciOzet & { uyelik: string; aktifIlan: number; tamamlanan: number };
};

export type GenelMesaj = { id: number; metin: string; olusturma: string; kullanici: KullaniciOzet };
export type OzelMesaj = {
  id: number;
  sohbetId: number;
  gonderenId: number;
  metin: string;
  olusturma: string;
  ilan: { id: number; baslik: string | null; tur: IlanTuru | null; fiyat: number | null; kategori: Kategori | null; foto: string | null } | null;
};
export type SohbetOzeti = {
  id: number;
  karsi: KullaniciOzet;
  son: { metin: string; zaman: string; benden: boolean };
  okunmamis: number;
  engelli: boolean;
};

export class ApiHatasi extends Error {
  durum: number;
  constructor(durum: number, mesaj: string) {
    super(mesaj);
    this.durum = durum;
  }
}

export async function api<T = unknown>(yol: string, secenek: { yontem?: string; govde?: unknown } = {}): Promise<T> {
  const yontem = secenek.yontem ?? (secenek.govde !== undefined ? 'POST' : 'GET');
  let yanit: Response;
  try {
    yanit = await fetch('/api' + yol, {
      method: yontem,
      headers: secenek.govde !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: secenek.govde !== undefined ? JSON.stringify(secenek.govde) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiHatasi(0, 'Sunucuya ulaşılamadı. Sunucu açık mı?');
  }
  const veri = yanit.headers.get('content-type')?.includes('json') ? await yanit.json() : null;
  if (!yanit.ok) {
    if (yanit.status === 401 && !yol.startsWith('/giris')) window.dispatchEvent(new Event('kp:oturum-dustu'));
    throw new ApiHatasi(yanit.status, veri?.hata ?? 'Bir şeyler ters gitti.');
  }
  return veri as T;
}

export const fotoAdresi = (dosya: string) => `/foto/${dosya}`;

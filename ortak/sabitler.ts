// Sunucu ve arayüzün birlikte kullandığı sabitler.

export const EPOSTA_UZANTISI = '@ogr.dpu.edu.tr';
export const EPOSTA_DESENI = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?@ogr\.dpu\.edu\.tr$/;

export const ILAN_TURLERI = {
  satilik: { ad: 'Satılık', kisa: 'Satılık', aciklama: 'Bir şey satıyorum' },
  takas: { ad: 'Takas', kisa: 'Takas', aciklama: 'Başka bir şeyle değiştirmek istiyorum' },
  satilik_takas: { ad: 'Satılık veya takas', kisa: 'Satılık / Takas', aciklama: 'Satarım da, takas da ederim' },
  ariyorum: { ad: 'Arıyorum', kisa: 'Arıyorum', aciklama: 'Bir şey almak istiyorum' },
} as const;
export type IlanTuru = keyof typeof ILAN_TURLERI;
export const ILAN_TURU_LISTESI = Object.keys(ILAN_TURLERI) as IlanTuru[];

export const KATEGORILER = {
  kitap: { ad: 'Kitap ve not', simge: '📚' },
  elektronik: { ad: 'Elektronik', simge: '💻' },
  ev: { ad: 'Ev ve yurt eşyası', simge: '🛋️' },
  giyim: { ad: 'Giyim ve aksesuar', simge: '👕' },
  spor: { ad: 'Spor ve hobi', simge: '⚽' },
  ozel_ders: { ad: 'Özel ders', simge: '🧑‍🏫' },
  ev_arkadasi: { ad: 'Ev arkadaşı', simge: '🏠' },
  diger: { ad: 'Diğer', simge: '📦' },
} as const;
export type Kategori = keyof typeof KATEGORILER;
export const KATEGORI_LISTESI = Object.keys(KATEGORILER) as Kategori[];

export const KOSULLAR = {
  yeni: 'Yeni',
  az_kullanilmis: 'Az kullanılmış',
  kullanilmis: 'Kullanılmış',
} as const;
export type Kosul = keyof typeof KOSULLAR;

export const SIKAYET_NEDENLERI = {
  dolandiricilik: 'Dolandırıcılık şüphesi',
  yasak_urun: 'Yasak ya da uygunsuz ürün',
  taciz: 'Hakaret ya da taciz',
  spam: 'Spam / tekrar eden ilan',
  diger: 'Diğer',
} as const;
export type SikayetNedeni = keyof typeof SIKAYET_NEDENLERI;

export const SINIRLAR = {
  baslik: 80,
  aciklama: 2000,
  takasIstegi: 200,
  mesaj: 1000,
  ad: 40,
  bolum: 60,
  fotoSayisi: 5,
  fotoBayt: 1_500_000,
  fiyat: 1_000_000,
} as const;

// Avatar renkleri: kullanıcı kimliğinden seçilir.
export const AVATAR_RENKLERI = ['#e8604c', '#2f9e8f', '#5b6cf0', '#d9822b', '#9b59b6', '#3a8dde', '#c0487a', '#4f9d3a'];

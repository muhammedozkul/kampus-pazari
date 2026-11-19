// Ortak arayüz parçaları.
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ILAN_TURLERI, KATEGORILER, SIKAYET_NEDENLERI, type IlanTuru, type Kategori, type SikayetNedeni } from '../../ortak/sabitler.ts';
import { api, fotoAdresi, type Ilan } from './api.ts';
import { useDurum } from './durum.tsx';
import { KategoriCizimi } from './cizimler.tsx';
import { avatarRengi, basHarfler, fiyatYaz, kisaZaman, tarih } from './yardimci.ts';

const YOLLAR: Record<string, ReactNode> = {
  ev: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  sohbet: (
    <>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z" />
      <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" />
    </>
  ),
  mesaj: <path d="M4 5h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z" />,
  arti: <path d="M12 5v14M5 12h14" />,
  kisi: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  ara: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  kalp: <path d="M12 20s-7.5-4.6-9.3-9.2C1.4 7.4 3.6 4 7 4c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8C19.5 15.4 12 20 12 20z" />,
  geri: <path d="M15 5 8 12l7 7" />,
  gonder: <path d="M4 12 20 4l-6 16-3-7z" />,
  bayrak: <path d="M5 21V4m0 0h11l-2 4 2 4H5" />,
  kapat: <path d="M6 6l12 12M18 6 6 18" />,
  foto: (
    <>
      <rect x="3" y="5" width="18" height="15" rx="2" />
      <circle cx="9" cy="11" r="2" />
      <path d="m21 17-5-5-9 8" />
    </>
  ),
  cop: <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" />,
  duzenle: <path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4" />,
  kalkan: <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />,
  cikis: <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h10" />,
  posta: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  engel: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </>
  ),
  tik: <path d="m5 12 5 5 9-10" />,
  ciftTik: <path d="m2 12 5 5 9-10M12 16l1 1 9-10" />,
  saga: <path d="m9 5 7 7-7 7" />,
  filtre: <path d="M4 5h16l-6 8v6l-4-2v-4z" />,
};

export function Simge({ ad, boyut = 20, dolu = false }: { ad: keyof typeof YOLLAR | string; boyut?: number; dolu?: boolean }) {
  return (
    <svg
      className="simge"
      width={boyut}
      height={boyut}
      viewBox="0 0 24 24"
      fill={dolu ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {YOLLAR[ad]}
    </svg>
  );
}

export function Avatar({ id, ad, boyut = 40, cevrimici }: { id: number; ad: string; boyut?: number; cevrimici?: boolean }) {
  return (
    <span className="avatar" style={{ width: boyut, height: boyut, background: avatarRengi(id), fontSize: boyut * 0.38 }}>
      {basHarfler(ad)}
      {cevrimici && <span className="avatar-nokta" aria-label="çevrimiçi" />}
    </span>
  );
}

export function TurRozeti({ tur }: { tur: IlanTuru }) {
  return (
    <span className={`rozet rozet-${tur}`}>
      <i className="rozet-nokta" />
      {ILAN_TURLERI[tur].kisa}
    </span>
  );
}

export function KategoriGorseli({ kategori }: { kategori: Kategori }) {
  return (
    <div className={`kategori-gorsel kg-${kategori}`} title={KATEGORILER[kategori]?.ad}>
      <KategoriCizimi kategori={kategori} />
    </div>
  );
}

export function FiyatEtiketi({ ilan }: { ilan: Pick<Ilan, 'tur' | 'fiyat' | 'takasIstegi'> }) {
  if (ilan.tur === 'takas') return <span className="fiyat fiyat-takas">Takaslık</span>;
  if (ilan.tur === 'ariyorum')
    return <span className="fiyat fiyat-ariyor">{ilan.fiyat !== null ? `Bütçe ${fiyatYaz(ilan.fiyat)}` : 'Bütçe belirtilmedi'}</span>;
  return <span className="fiyat">{fiyatYaz(ilan.fiyat)}</span>;
}

export function IlanKarti({ ilan, favoriDegisti, sira = 0 }: { ilan: Ilan; favoriDegisti?: (id: number, favori: boolean) => void; sira?: number }) {
  const { ben, bildir } = useDurum();
  const [favori, setFavori] = useState(ilan.favori);
  const [atis, setAtis] = useState(false);
  useEffect(() => setFavori(ilan.favori), [ilan.favori]);
  const kendi = ben?.id === ilan.kullanici.id;
  const favoriCevir = async () => {
    const yeni = !favori;
    setFavori(yeni);
    if (yeni) {
      setAtis(true);
      setTimeout(() => setAtis(false), 600);
    }
    try {
      await api(`/ilanlar/${ilan.id}/favori`, { govde: { favori: yeni } });
      favoriDegisti?.(ilan.id, yeni);
    } catch (h) {
      setFavori(!yeni);
      bildir((h as Error).message, 'hata');
    }
  };
  return (
    <article className={`ilan-karti ${ilan.durum !== 'aktif' ? 'soluk' : ''}`} style={{ '--sira': Math.min(sira, 12) } as React.CSSProperties}>
      <div className="ilan-karti-gorsel">
        {ilan.foto ? <img src={fotoAdresi(ilan.foto)} alt="" loading="lazy" /> : <KategoriGorseli kategori={ilan.kategori} />}
        <TurRozeti tur={ilan.tur} />
        {ilan.durum === 'tamamlandi' && <span className="tamam-serit">{ilan.tur === 'ariyorum' ? 'Bulundu' : 'Satıldı / takaslandı'}</span>}
      </div>
      <div className="ilan-karti-govde">
        <FiyatEtiketi ilan={ilan} />
        <h3>
          <Link to={`/ilan/${ilan.id}`} className="kart-baglanti">
            {ilan.baslik}
          </Link>
        </h3>
        {ilan.takasIstegi && <p className="takas-istegi">⇄ {ilan.takasIstegi}</p>}
        <div className="ilan-karti-alt">
          <span className="kart-kisi">
            <Avatar id={ilan.kullanici.id} ad={ilan.kullanici.ad} boyut={20} />
            <span className="kart-kisi-ad">{ilan.kullanici.ad}</span>
          </span>
          <time className="kart-zaman" dateTime={tarih(ilan.olusturma).toISOString()} title={tarih(ilan.olusturma).toLocaleString('tr-TR')}>
            {kisaZaman(ilan.olusturma)}
          </time>
        </div>
      </div>
      {!kendi && (
        <button
          className={`favori-dugme ${favori ? 'acik' : ''} ${atis ? 'atis' : ''}`}
          onClick={favoriCevir}
          aria-label={favori ? 'Favorilerden çıkar' : 'Favorilere ekle'}
          aria-pressed={favori}
        >
          <Simge ad="kalp" boyut={18} dolu={favori} />
        </button>
      )}
    </article>
  );
}

/** İlanlar yüklenirken kartların yerini tutan iskelet. */
export function IlanIskeleti({ adet = 8 }: { adet?: number }) {
  return (
    <div className="ilan-izgara" aria-hidden="true">
      {Array.from({ length: adet }, (_, i) => (
        <div key={i} className="ilan-karti iskelet">
          <div className="ilan-karti-gorsel parilti" />
          <div className="ilan-karti-govde">
            <span className="parilti cizgi kisa" />
            <span className="parilti cizgi" />
            <span className="parilti cizgi orta" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Yukleniyor({ metin = 'Yükleniyor…' }: { metin?: string }) {
  return (
    <div className="yukleniyor" role="status">
      <span className="donen" />
      {metin}
    </div>
  );
}

export function BosDurum({ simge, baslik, children }: { simge: string; baslik: string; children?: ReactNode }) {
  return (
    <div className="bos-durum">
      <div className="bos-simge">{simge}</div>
      <h3>{baslik}</h3>
      {children}
    </div>
  );
}

export function Pencere({ baslik, kapat, children }: { baslik: string; kapat: () => void; children: ReactNode }) {
  useEffect(() => {
    const tus = (e: KeyboardEvent) => e.key === 'Escape' && kapat();
    window.addEventListener('keydown', tus);
    return () => window.removeEventListener('keydown', tus);
  }, [kapat]);
  return (
    <div className="pencere-arka" onMouseDown={(e) => e.target === e.currentTarget && kapat()}>
      <div className="pencere" role="dialog" aria-modal="true" aria-label={baslik}>
        <div className="pencere-baslik">
          <h2>{baslik}</h2>
          <button className="ikon-dugme" onClick={kapat} aria-label="Kapat">
            <Simge ad="kapat" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SikayetPenceresi({
  hedefTur,
  hedefId,
  kapat,
}: {
  hedefTur: 'ilan' | 'kullanici' | 'genel_mesaj' | 'ozel_mesaj';
  hedefId: number;
  kapat: () => void;
}) {
  const { bildir } = useDurum();
  const [neden, setNeden] = useState<SikayetNedeni | ''>('');
  const [not, setNot] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!neden) return;
    setGonderiliyor(true);
    try {
      await api('/sikayet', { govde: { hedefTur, hedefId, neden, not } });
      bildir('Şikayetin yöneticiye iletildi. Teşekkürler!');
      kapat();
    } catch (h) {
      bildir((h as Error).message, 'hata');
      setGonderiliyor(false);
    }
  };
  return (
    <Pencere baslik="Şikayet et" kapat={kapat}>
      <form onSubmit={gonder} className="form">
        <p className="ince">Şikayetler yalnız yöneticiye görünür; kimin şikayet ettiği karşı tarafa söylenmez.</p>
        <div className="secim-listesi">
          {(Object.keys(SIKAYET_NEDENLERI) as SikayetNedeni[]).map((n) => (
            <label key={n} className={`secim ${neden === n ? 'secili' : ''}`}>
              <input type="radio" name="neden" value={n} checked={neden === n} onChange={() => setNeden(n)} />
              {SIKAYET_NEDENLERI[n]}
            </label>
          ))}
        </div>
        <label className="alan">
          <span>Eklemek istediğin (isteğe bağlı)</span>
          <textarea value={not} onChange={(e) => setNot(e.target.value)} maxLength={500} rows={3} />
        </label>
        <button className="dugme dugme-ana" disabled={!neden || gonderiliyor}>
          {gonderiliyor ? 'Gönderiliyor…' : 'Şikayeti gönder'}
        </button>
      </form>
    </Pencere>
  );
}

/** Mesaj metnindeki satır sonlarını korur. */
export function MesajMetni({ metin }: { metin: string }) {
  return <span className="mesaj-metni">{metin}</span>;
}

// Giriş: öğrenci e-postası → 6 haneli kod → (ilk kez) ad ve bölüm.
import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { EPOSTA_DESENI, EPOSTA_UZANTISI, SINIRLAR } from '../../../ortak/sabitler.ts';
import { api, type Ben } from '../api.ts';
import { Simge } from '../bilesenler.tsx';
import { KategoriCizimi } from '../cizimler.tsx';
import { useDurum } from '../durum.tsx';

// Kod istendikten sonra sayfadan çıkılıp geri gelinirse kod ekranı kaybolmasın diye bekleyen giriş saklanır.
const BEKLEYEN = 'kp:bekleyen-giris';
function bekleyenOku(): string | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(BEKLEYEN) ?? 'null') as { eposta: string; zaman: number } | null;
    return v && Date.now() - v.zaman < 10 * 60_000 ? v.eposta : null;
  } catch {
    return null;
  }
}
function bekleyenYaz(eposta: string | null) {
  try {
    if (eposta) sessionStorage.setItem(BEKLEYEN, JSON.stringify({ eposta, zaman: Date.now() }));
    else sessionStorage.removeItem(BEKLEYEN);
  } catch {
    /* gizli pencere vb. */
  }
}

export default function Giris() {
  const { ben, benYenile, benAyarla } = useDurum();
  const git = useNavigate();
  const konum = useLocation();
  const [p] = useSearchParams();
  const geri = (konum.state as { geri?: string } | null)?.geri ?? '/';
  // Test posta kutusundaki "Bu kodla giriş yap" bağlantısı ?eposta=…&kod=… ile gelir.
  const adresEposta = p.get('eposta');
  const adresKod = p.get('kod')?.replace(/\D/g, '').slice(0, 6) ?? '';
  const baslangicEposta = (adresEposta && EPOSTA_DESENI.test(adresEposta) ? adresEposta : null) ?? bekleyenOku();
  const [adim, setAdim] = useState<'eposta' | 'kod'>(baslangicEposta ? 'kod' : 'eposta');
  const [kullaniciAdi, setKullaniciAdi] = useState(baslangicEposta ?? '');
  const [kod, setKod] = useState(baslangicEposta ? adresKod : '');
  const [hata, setHata] = useState('');
  const [bekliyor, setBekliyor] = useState(false);
  const [geriSayim, setGeriSayim] = useState(0);
  const kodKutusu = useRef<HTMLInputElement>(null);

  // Kullanıcı tam adres yapıştırırsa yalnız baş kısmı al.
  const eposta = (kullaniciAdi.includes('@') ? kullaniciAdi.trim() : kullaniciAdi.trim() + EPOSTA_UZANTISI).toLocaleLowerCase('en-US');

  // Bağlantıyla kod geldiyse kendiliğinden doğrula (bir kez).
  const otomatik = useRef(false);
  useEffect(() => {
    if (otomatik.current || ben !== null || adim !== 'kod' || kod.length !== 6) return;
    otomatik.current = true;
    dogrula(kod);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ben]);

  useEffect(() => {
    if (geriSayim <= 0) return;
    const t = setTimeout(() => setGeriSayim((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [geriSayim]);

  if (ben === undefined) return null;
  if (ben?.ad) return <Navigate to={geri} replace />;
  if (ben && !ben.ad) return <ProfilKur ben={ben} bitti={(b) => (benAyarla(b), git(geri, { replace: true }))} />;

  const kodIste = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setHata('');
    if (!EPOSTA_DESENI.test(eposta)) {
      setHata(`Yalnız ${EPOSTA_UZANTISI} uzantılı öğrenci e-postasıyla girilebilir.`);
      return;
    }
    setBekliyor(true);
    try {
      await api('/giris/kod', { govde: { eposta } });
      bekleyenYaz(eposta);
      setAdim('kod');
      setKod('');
      setGeriSayim(30);
      setTimeout(() => kodKutusu.current?.focus(), 50);
    } catch (h) {
      setHata((h as Error).message);
    } finally {
      setBekliyor(false);
    }
  };

  const dogrula = async (deger = kod) => {
    if (deger.length !== 6 || bekliyor) return;
    setHata('');
    setBekliyor(true);
    try {
      await api('/giris/dogrula', { govde: { eposta, kod: deger } });
      bekleyenYaz(null);
      await benYenile();
    } catch (h) {
      setHata((h as Error).message);
      setKod('');
      kodKutusu.current?.focus();
    } finally {
      setBekliyor(false);
    }
  };

  return (
    <div className="giris-sayfa">
      <section className="giris-tanitim">
        <div className="logo logo-buyuk">
          <img src="/simge.svg" alt="" width={44} height={44} />
          <span>
            Kampüs<b>Pazarı</b>
          </span>
        </div>
        <span className="giris-etiket">🎓 Yalnız Dumlupınar öğrencileri</span>
        <h1>
          Kampüste ihtiyacın olan şey,
          <br />
          <em>bir öğrenci uzağında.</em>
        </h1>
        <ul className="ozellik-listesi">
          <li>
            <span>📚</span>Ders kitabını sat, yenisini takasla
          </li>
          <li>
            <span>🔎</span>Aradığını "Arıyorum" ilanıyla duyur
          </li>
          <li>
            <span>💬</span>Genel sohbette sor, özelden anlaş
          </li>
          <li>
            <span>🎓</span>Yalnız DPÜ öğrencileri: herkes doğrulanmış
          </li>
        </ul>
        <p className="ince">Ödeme site üzerinden yapılmaz. Alışverişi kampüste, yüz yüze yaparsınız.</p>
      </section>

      <div className="giris-sag">
        <div className="vitrin" aria-hidden="true">
          <div className="vitrin-kart v1">
            <div className="kategori-gorsel kg-kitap">
              <KategoriCizimi kategori="kitap" />
            </div>
            <b>120 ₺</b>
            <span>Kalkülüs ders kitabı</span>
          </div>
          <div className="vitrin-kart v2">
            <div className="kategori-gorsel kg-elektronik">
              <KategoriCizimi kategori="elektronik" />
            </div>
            <b className="mor">Takaslık</b>
            <span>Laptop standı</span>
          </div>
          <div className="vitrin-kart v3">
            <div className="kategori-gorsel kg-spor">
              <KategoriCizimi kategori="spor" />
            </div>
            <b className="sari">Arıyorum</b>
            <span>Basketbol topu</span>
          </div>
        </div>
      <section className="giris-kart">
        {adim === 'eposta' ? (
          <form onSubmit={kodIste} className="form">
            <h2>Giriş yap ya da katıl</h2>
            <p className="ince">Öğrenci e-postana 6 haneli bir kod göndereceğiz. Şifre yok.</p>
            <label className="alan">
              <span>Öğrenci e-postan</span>
              <div className="eposta-kutusu">
                <input
                  autoFocus
                  value={kullaniciAdi}
                  onChange={(e) => setKullaniciAdi(e.target.value)}
                  placeholder="ogrenci.no ya da ad.soyad"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  inputMode="email"
                />
                {!kullaniciAdi.includes('@') && <span className="uzanti">{EPOSTA_UZANTISI}</span>}
              </div>
            </label>
            {hata && <p className="form-hata">{hata}</p>}
            <button className="dugme dugme-ana dugme-genis" disabled={bekliyor || !kullaniciAdi.trim()}>
              {bekliyor ? 'Gönderiliyor…' : 'Kod gönder'}
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              dogrula();
            }}
            className="form"
          >
            <button type="button" className="geri-baglanti" onClick={() => (setAdim('eposta'), setHata(''), setKod(''), bekleyenYaz(null))}>
              <Simge ad="geri" boyut={16} /> E-postayı değiştir
            </button>
            <h2>Kodu gir</h2>
            <p className="ince">
              <b>{eposta}</b> adresine 6 haneli kod gönderdik. Kod 10 dakika geçerli.
            </p>
            <input
              ref={kodKutusu}
              className="kod-kutusu"
              value={kod}
              onChange={(e) => {
                const d = e.target.value.replace(/\D/g, '').slice(0, 6);
                setKod(d);
                if (d.length === 6) dogrula(d);
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="••••••"
              aria-label="6 haneli kod"
            />
            {hata && <p className="form-hata">{hata}</p>}
            <button className="dugme dugme-ana dugme-genis" disabled={bekliyor || kod.length !== 6}>
              {bekliyor ? 'Kontrol ediliyor…' : 'Giriş yap'}
            </button>
            <div className="test-posta-notu">
              <Simge ad="posta" boyut={18} />
              <div>
                <b>Bu bir öğrenme projesi:</b> gerçek e-posta gönderilmiyor. Kod{' '}
                <a href={`/posta?alici=${encodeURIComponent(eposta)}`} target="_blank" rel="noreferrer">
                  test posta kutusuna
                </a>{' '}
                ve sunucu terminaline düştü.
              </div>
            </div>
            <button type="button" className="dugme dugme-sade" disabled={geriSayim > 0 || bekliyor} onClick={() => kodIste()}>
              {geriSayim > 0 ? `Yeni kod (${geriSayim} sn)` : 'Yeni kod gönder'}
            </button>
          </form>
        )}
        <p className="giris-alt">
          <a href={adim === 'kod' ? `/posta?alici=${encodeURIComponent(eposta)}` : '/posta'} target="_blank" rel="noreferrer">
            Test posta kutusu
          </a>
        </p>
      </section>
      </div>
    </div>
  );
}

function ProfilKur({ ben, bitti }: { ben: Ben; bitti: (b: Ben) => void }) {
  const { benAyarla } = useDurum();
  const [ad, setAd] = useState('');
  const [bolum, setBolum] = useState('');
  const [hata, setHata] = useState('');
  const [bekliyor, setBekliyor] = useState(false);
  const kaydet = async (e: React.FormEvent) => {
    e.preventDefault();
    setBekliyor(true);
    try {
      const v = await api<{ ben: Ben }>('/ben', { yontem: 'PATCH', govde: { ad, bolum } });
      bitti(v.ben);
    } catch (h) {
      setHata((h as Error).message);
      setBekliyor(false);
    }
  };
  return (
    <div className="giris-sayfa tek">
      <section className="giris-kart">
        <form onSubmit={kaydet} className="form">
          <div className="hosgeldin">🎉</div>
          <h2>Hoş geldin!</h2>
          <p className="ince">
            <b>{ben.eposta}</b> doğrulandı. Diğer öğrenciler seni nasıl görsün?
          </p>
          <label className="alan">
            <span>Adın (ilanlarda ve sohbette görünür)</span>
            <input autoFocus value={ad} onChange={(e) => setAd(e.target.value)} maxLength={SINIRLAR.ad} placeholder="ör. Ayşe Y." required />
          </label>
          <label className="alan">
            <span>Bölümün (isteğe bağlı)</span>
            <input value={bolum} onChange={(e) => setBolum(e.target.value)} maxLength={SINIRLAR.bolum} placeholder="ör. Bilgisayar Programcılığı" />
          </label>
          <p className="ince">E-posta adresin kimseye gösterilmez.</p>
          {hata && <p className="form-hata">{hata}</p>}
          <button className="dugme dugme-ana dugme-genis" disabled={bekliyor || !ad.trim()}>
            Başla
          </button>
          <button
            type="button"
            className="dugme dugme-sade"
            onClick={async () => {
              await api('/cikis', { govde: {} }).catch(() => {});
              benAyarla(null);
            }}
          >
            Farklı hesapla gir
          </button>
        </form>
      </section>
    </div>
  );
}

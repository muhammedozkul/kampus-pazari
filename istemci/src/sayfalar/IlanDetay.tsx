// İlan detayı: fotoğraflar, bilgiler, satıcı kartı, mesaj gönder, favori, şikayet; sahibiyse düzenle/durum.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ILAN_TURLERI, KATEGORILER, KOSULLAR } from '../../../ortak/sabitler.ts';
import { api, fotoAdresi, type IlanDetayi } from '../api.ts';
import { Avatar, BosDurum, FiyatEtiketi, KategoriGorseli, SikayetPenceresi, Simge, TurRozeti, Yukleniyor } from '../bilesenler.tsx';
import { KategoriSimgesi } from '../cizimler.tsx';
import { useDurum } from '../durum.tsx';
import { goreceZaman, tarih } from '../yardimci.ts';

export default function IlanDetay() {
  const { id } = useParams();
  const { ben, bildir, cevrimici } = useDurum();
  const git = useNavigate();
  const [ilan, setIlan] = useState<IlanDetayi | null>(null);
  const [hata, setHata] = useState('');
  const [secili, setSecili] = useState(0);
  const [sikayet, setSikayet] = useState(false);
  const [mesajKutusu, setMesajKutusu] = useState(false);
  const [mesaj, setMesaj] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);

  useEffect(() => {
    setIlan(null);
    setSecili(0);
    api<{ ilan: IlanDetayi }>(`/ilanlar/${id}`)
      .then((v) => {
        setIlan(v.ilan);
        setMesaj(v.ilan.tur === 'ariyorum' ? `Merhaba, aradığın "${v.ilan.baslik}" bende var.` : `Merhaba, "${v.ilan.baslik}" hâlâ duruyor mu?`);
      })
      .catch((h) => setHata(h.message));
  }, [id]);

  if (hata)
    return (
      <BosDurum simge="🫥" baslik={hata}>
        <Link to="/" className="dugme">
          İlanlara dön
        </Link>
      </BosDurum>
    );
  if (!ilan) return <Yukleniyor />;

  const kendi = ilan.sahip.id === ben?.id;
  const yonetici = ben?.rol === 'yonetici';

  const durumDegistir = async (durum: 'aktif' | 'tamamlandi' | 'kaldirildi') => {
    const soru =
      durum === 'kaldirildi'
        ? kendi
          ? 'İlan silinsin mi? Bu geri alınamaz.'
          : 'Bu ilan yönetici olarak kaldırılsın mı?'
        : null;
    if (soru && !confirm(soru)) return;
    try {
      await api(`/ilanlar/${ilan.id}/durum`, { govde: { durum } });
      if (durum === 'kaldirildi') {
        bildir('İlan kaldırıldı.');
        git(kendi ? `/profil/${ben!.id}` : '/');
      } else {
        setIlan({ ...ilan, durum });
        bildir(durum === 'tamamlandi' ? 'Tebrikler! İlan tamamlandı olarak işaretlendi.' : 'İlan yeniden yayında.');
      }
    } catch (h) {
      bildir((h as Error).message, 'hata');
    }
  };

  const favoriCevir = async () => {
    const yeni = !ilan.favori;
    setIlan({ ...ilan, favori: yeni });
    try {
      await api(`/ilanlar/${ilan.id}/favori`, { govde: { favori: yeni } });
      bildir(yeni ? 'Favorilere eklendi.' : 'Favorilerden çıkarıldı.');
    } catch (h) {
      setIlan({ ...ilan, favori: !yeni });
      bildir((h as Error).message, 'hata');
    }
  };

  const mesajGonder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mesaj.trim()) return;
    setGonderiliyor(true);
    try {
      const s = await api<{ id: number }>('/sohbetler', { govde: { kullaniciId: ilan.sahip.id } });
      await api(`/sohbetler/${s.id}/mesajlar`, { govde: { metin: mesaj, ilanId: ilan.id } });
      git(`/mesajlar/${s.id}`);
    } catch (h) {
      bildir((h as Error).message, 'hata');
      setGonderiliyor(false);
    }
  };

  const fotolar = ilan.fotolar;
  return (
    <div className={`sayfa ilan-detay ${!kendi && ilan.durum === 'aktif' && !mesajKutusu ? 'yapiskan-var' : ''}`}>
      <button className="geri-baglanti" onClick={() => (history.length > 1 ? git(-1) : git('/'))}>
        <Simge ad="geri" boyut={16} /> Geri
      </button>
      <div className="detay-izgara">
        <div className="galeri">
          <div className="galeri-ana">
            {fotolar.length ? <img src={fotoAdresi(fotolar[secili])} alt={ilan.baslik} /> : <KategoriGorseli kategori={ilan.kategori} />}
            {fotolar.length > 1 && (
              <span className="galeri-sayac">
                {secili + 1} / {fotolar.length}
              </span>
            )}
            {ilan.durum === 'tamamlandi' && <span className="tamam-serit buyuk">{ilan.tur === 'ariyorum' ? 'Bulundu' : 'Satıldı / takaslandı'}</span>}
            {fotolar.length > 1 && (
              <>
                <button className="galeri-ok sol" onClick={() => setSecili((secili - 1 + fotolar.length) % fotolar.length)} aria-label="Önceki fotoğraf">
                  <Simge ad="geri" />
                </button>
                <button className="galeri-ok sag" onClick={() => setSecili((secili + 1) % fotolar.length)} aria-label="Sonraki fotoğraf">
                  <Simge ad="saga" />
                </button>
              </>
            )}
          </div>
          {fotolar.length > 1 && (
            <div className="galeri-kucukler">
              {fotolar.map((f, i) => (
                <button key={f} className={i === secili ? 'secili' : ''} onClick={() => setSecili(i)} aria-label={`Fotoğraf ${i + 1}`}>
                  <img src={fotoAdresi(f)} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="detay-bilgi">
          <div className="detay-ust">
            <TurRozeti tur={ilan.tur} />
            <span className="ince kategori-etiket">
              <KategoriSimgesi kategori={ilan.kategori} boyut={15} /> {KATEGORILER[ilan.kategori].ad}
            </span>
          </div>
          <h1>{ilan.baslik}</h1>
          <div className="detay-fiyat">
            <FiyatEtiketi ilan={ilan} />
          </div>
          {ilan.takasIstegi && (
            <div className="takas-kutusu">
              <span>⇄</span>
              <div>
                <b>Takas için istediği</b>
                <p>{ilan.takasIstegi}</p>
              </div>
            </div>
          )}
          <dl className="ozellikler">
            <div>
              <dt>İlan türü</dt>
              <dd>{ILAN_TURLERI[ilan.tur].ad}</dd>
            </div>
            {ilan.kosul && (
              <div>
                <dt>Durumu</dt>
                <dd>{KOSULLAR[ilan.kosul]}</dd>
              </div>
            )}
            <div>
              <dt>Yayınlandı</dt>
              <dd title={tarih(ilan.olusturma).toLocaleString('tr-TR')}>{goreceZaman(ilan.olusturma)}</dd>
            </div>
          </dl>
          {ilan.aciklama && <p className="aciklama">{ilan.aciklama}</p>}

          <Link to={`/profil/${ilan.sahip.id}`} className="satici-karti">
            <Avatar id={ilan.sahip.id} ad={ilan.sahip.ad} boyut={48} cevrimici={cevrimici.has(ilan.sahip.id)} />
            <div>
              <b>{ilan.sahip.ad}</b>
              <span>{ilan.sahip.bolum ?? 'DPÜ öğrencisi'}</span>
              <span className="ince">
                {ilan.sahip.aktifIlan} aktif ilan · {ilan.sahip.tamamlanan} tamamlanan
              </span>
            </div>
            <Simge ad="saga" />
          </Link>

          {kendi ? (
            <div className="eylemler">
              <Link to={`/ilan/${ilan.id}/duzenle`} className="dugme">
                <Simge ad="duzenle" boyut={18} /> Düzenle
              </Link>
              {ilan.durum === 'aktif' ? (
                <button className="dugme dugme-ana" onClick={() => durumDegistir('tamamlandi')}>
                  <Simge ad="tik" boyut={18} /> {ilan.tur === 'ariyorum' ? 'Buldum' : 'Satıldı / takaslandı'}
                </button>
              ) : (
                ilan.durum === 'tamamlandi' && (
                  <button className="dugme" onClick={() => durumDegistir('aktif')}>
                    Yeniden yayına al
                  </button>
                )
              )}
              <button className="dugme dugme-tehlike" onClick={() => durumDegistir('kaldirildi')}>
                <Simge ad="cop" boyut={18} /> Sil
              </button>
            </div>
          ) : (
            <>
              {ilan.durum === 'aktif' && !mesajKutusu && (
                <div className="eylemler ana-eylem">
                  <span className="yapiskan-fiyat">
                    <FiyatEtiketi ilan={ilan} />
                  </span>
                  <button className="dugme dugme-ana dugme-genis" onClick={() => setMesajKutusu(true)}>
                    <Simge ad="mesaj" boyut={18} /> {ilan.tur === 'ariyorum' ? 'Bende var, yaz' : 'Satıcıya mesaj gönder'}
                  </button>
                  <button className={`dugme ikon-dugme-kare ${ilan.favori ? 'favori-acik' : ''}`} onClick={favoriCevir} aria-label="Favori">
                    <Simge ad="kalp" boyut={20} dolu={ilan.favori} />
                  </button>
                </div>
              )}
              {mesajKutusu && (
                <form className="hizli-mesaj" onSubmit={mesajGonder}>
                  <textarea value={mesaj} onChange={(e) => setMesaj(e.target.value)} rows={3} maxLength={1000} autoFocus />
                  <div className="eylemler">
                    <button type="button" className="dugme dugme-sade" onClick={() => setMesajKutusu(false)}>
                      Vazgeç
                    </button>
                    <button className="dugme dugme-ana" disabled={gonderiliyor || !mesaj.trim()}>
                      <Simge ad="gonder" boyut={18} /> Gönder
                    </button>
                  </div>
                </form>
              )}
              <div className="guvenlik-ipucu">
                <Simge ad="kalkan" boyut={18} />
                <p>Kampüste, kalabalık bir yerde buluşun. Ürünü görmeden para göndermeyin.</p>
              </div>
              <div className="alt-eylemler">
                <button className="metin-dugme" onClick={() => setSikayet(true)}>
                  <Simge ad="bayrak" boyut={16} /> İlanı şikayet et
                </button>
                {yonetici && ilan.durum !== 'kaldirildi' && (
                  <button className="metin-dugme tehlike" onClick={() => durumDegistir('kaldirildi')}>
                    <Simge ad="kalkan" boyut={16} /> Yönetici: kaldır
                  </button>
                )}
              </div>
            </>
          )}
          {ilan.durum === 'kaldirildi' && <p className="form-hata">Bu ilan kaldırılmış; yalnız sen ve yöneticiler görüyor.</p>}
        </div>
      </div>
      {sikayet && <SikayetPenceresi hedefTur="ilan" hedefId={ilan.id} kapat={() => setSikayet(false)} />}
    </div>
  );
}

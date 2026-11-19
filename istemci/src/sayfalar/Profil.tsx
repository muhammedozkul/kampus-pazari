// Profil: kendi profilinde ilanlarım/favorilerim/engellediklerim ve düzenleme; başkasında mesaj, engelle, şikayet.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { SINIRLAR } from '../../../ortak/sabitler.ts';
import { api, type Ben, type Ilan } from '../api.ts';
import { Avatar, BosDurum, IlanKarti, SikayetPenceresi, Simge, Yukleniyor } from '../bilesenler.tsx';
import { useDurum } from '../durum.tsx';
import { goreceZaman, tarih } from '../yardimci.ts';

type Profil = {
  id: number;
  ad: string;
  bolum: string | null;
  uyelik: string;
  sonGorulme: string | null;
  tamamlanan: number;
  cevrimici: boolean;
  engelledim: boolean;
  yasakli: boolean;
};

export default function Profil() {
  const { id } = useParams();
  const kid = Number(id);
  const { ben, benAyarla, bildir, cevrimici, engelAyarla } = useDurum();
  const git = useNavigate();
  const kendi = ben?.id === kid;
  const [profil, setProfil] = useState<Profil | null>(null);
  const [hata, setHata] = useState('');
  const [sekme, setSekme] = useState<'ilanlar' | 'favoriler' | 'engellenenler'>('ilanlar');
  const [ilanlar, setIlanlar] = useState<Ilan[] | null>(null);
  const [engellenenler, setEngellenenler] = useState<{ id: number; ad: string | null; bolum: string | null }[] | null>(null);
  const [duzenle, setDuzenle] = useState(false);
  const [sikayet, setSikayet] = useState(false);

  useEffect(() => {
    setProfil(null);
    setSekme('ilanlar');
    api<{ kullanici: Profil }>(`/kullanicilar/${kid}`)
      .then((v) => setProfil(v.kullanici))
      .catch((h) => setHata(h.message));
  }, [kid]);

  useEffect(() => {
    if (sekme === 'engellenenler') {
      api<{ kullanicilar: typeof engellenenler }>('/engellenenler').then((v) => setEngellenenler(v.kullanicilar));
      return;
    }
    setIlanlar(null);
    api<{ ilanlar: Ilan[] }>(sekme === 'favoriler' ? '/ilanlar?favoriler=1' : `/ilanlar?kullanici=${kid}`).then((v) => setIlanlar(v.ilanlar));
  }, [sekme, kid]);

  if (hata) return <BosDurum simge="🫥" baslik={hata} />;
  if (!profil) return <Yukleniyor />;

  const engelCevir = async (hedef: number, engelle: boolean) => {
    if (engelle && !confirm('Bu kişi engellensin mi? Birbirinize mesaj atamaz, ilanlarınızı ve genel sohbetteki mesajlarınızı göremezsiniz.')) return;
    try {
      await api(`/kullanicilar/${hedef}/engelle`, { govde: { engelle } });
      engelAyarla(hedef, engelle);
      if (hedef === profil.id) setProfil({ ...profil, engelledim: engelle });
      setEngellenenler((l) => l?.filter((k) => k.id !== hedef) ?? l);
      bildir(engelle ? 'Kişi engellendi.' : 'Engel kaldırıldı.');
    } catch (h) {
      bildir((h as Error).message, 'hata');
    }
  };

  const mesajAt = async () => {
    try {
      const s = await api<{ id: number }>('/sohbetler', { govde: { kullaniciId: profil.id } });
      git(`/mesajlar/${s.id}`);
    } catch (h) {
      bildir((h as Error).message, 'hata');
    }
  };

  const yasakCevir = async () => {
    const yeni = !profil.yasakli;
    if (!confirm(yeni ? `${profil.ad} hesabı kapatılsın mı? Oturumu hemen sonlanır.` : 'Hesap yeniden açılsın mı?')) return;
    try {
      await api(`/yonetim/kullanicilar/${profil.id}/yasak`, { govde: { yasakli: yeni } });
      setProfil({ ...profil, yasakli: yeni });
      bildir(yeni ? 'Hesap kapatıldı.' : 'Hesap açıldı.');
    } catch (h) {
      bildir((h as Error).message, 'hata');
    }
  };

  const cikis = async () => {
    await api('/cikis', { govde: {} }).catch(() => {});
    benAyarla(null);
    git('/giris');
  };

  const acik = cevrimici.has(profil.id);
  return (
    <div className="sayfa">
      <section className="profil-kart">
        <Avatar id={profil.id} ad={kendi && ben?.ad ? ben.ad : profil.ad} boyut={84} cevrimici={acik} />
        <div className="profil-bilgi">
          {duzenle && kendi ? (
            <ProfilDuzenle
              ben={ben!}
              bitti={(b) => {
                if (b) {
                  benAyarla(b);
                  setProfil({ ...profil, ad: b.ad ?? profil.ad, bolum: b.bolum });
                  bildir('Profil güncellendi.');
                }
                setDuzenle(false);
              }}
            />
          ) : (
            <>
              <h1>{profil.ad}</h1>
              <p>{profil.bolum ?? 'DPÜ öğrencisi'}</p>
              <p className="ince">
                🎓 Doğrulanmış öğrenci · {tarih(profil.uyelik).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })} tarihinden beri üye
                {profil.tamamlanan > 0 && ` · ${profil.tamamlanan} tamamlanan alışveriş`}
              </p>
              <p className="ince">{acik ? '🟢 Şu an çevrimiçi' : profil.sonGorulme ? `Son görülme ${goreceZaman(profil.sonGorulme)}` : ''}</p>
              {profil.yasakli && <p className="form-hata">Bu hesap yönetici tarafından kapatıldı.</p>}
            </>
          )}
        </div>
        <div className="profil-eylem">
          {kendi ? (
            !duzenle && (
              <>
                <button className="dugme" onClick={() => setDuzenle(true)}>
                  <Simge ad="duzenle" boyut={18} /> Düzenle
                </button>
                <button className="dugme dugme-sade" onClick={cikis}>
                  <Simge ad="cikis" boyut={18} /> Çıkış
                </button>
              </>
            )
          ) : (
            <>
              {!profil.engelledim && !profil.yasakli && (
                <button className="dugme dugme-ana" onClick={mesajAt}>
                  <Simge ad="mesaj" boyut={18} /> Mesaj gönder
                </button>
              )}
              <button className={`dugme ${profil.engelledim ? '' : 'dugme-sade'}`} onClick={() => engelCevir(profil.id, !profil.engelledim)}>
                <Simge ad="engel" boyut={18} /> {profil.engelledim ? 'Engeli kaldır' : 'Engelle'}
              </button>
              <button className="dugme dugme-sade" onClick={() => setSikayet(true)}>
                <Simge ad="bayrak" boyut={18} /> Şikayet et
              </button>
              {ben?.rol === 'yonetici' && (
                <button className="dugme dugme-tehlike" onClick={yasakCevir}>
                  <Simge ad="kalkan" boyut={18} /> {profil.yasakli ? 'Hesabı aç' : 'Hesabı kapat'}
                </button>
              )}
            </>
          )}
        </div>
      </section>

      {kendi && (
        <div className="sekmeler" role="tablist">
          <button className={sekme === 'ilanlar' ? 'secili' : ''} onClick={() => setSekme('ilanlar')}>
            İlanlarım
          </button>
          <button className={sekme === 'favoriler' ? 'secili' : ''} onClick={() => setSekme('favoriler')}>
            Favorilerim
          </button>
          <button className={sekme === 'engellenenler' ? 'secili' : ''} onClick={() => setSekme('engellenenler')}>
            Engellediklerim
          </button>
        </div>
      )}
      {!kendi && <h2 className="bolum-baslik">{profil.ad} kişisinin ilanları</h2>}

      {sekme === 'engellenenler' ? (
        !engellenenler ? (
          <Yukleniyor />
        ) : engellenenler.length === 0 ? (
          <BosDurum simge="🕊️" baslik="Kimseyi engellemedin" />
        ) : (
          <div className="engel-listesi">
            {engellenenler.map((k) => (
              <div key={k.id} className="engel-satiri">
                <Avatar id={k.id} ad={k.ad ?? '?'} boyut={40} />
                <div>
                  <b>{k.ad ?? 'Adsız öğrenci'}</b>
                  <span className="ince">{k.bolum}</span>
                </div>
                <button className="dugme kucuk" onClick={() => engelCevir(k.id, false)}>
                  Engeli kaldır
                </button>
              </div>
            ))}
          </div>
        )
      ) : !ilanlar ? (
        <Yukleniyor />
      ) : ilanlar.length === 0 ? (
        <BosDurum simge={sekme === 'favoriler' ? '💛' : '📭'} baslik={sekme === 'favoriler' ? 'Favori ilanın yok' : kendi ? 'Henüz ilan vermedin' : 'Aktif ilanı yok'}>
          {kendi && sekme === 'ilanlar' && (
            <Link to="/ilan-ver" className="dugme dugme-ana">
              İlk ilanını ver
            </Link>
          )}
        </BosDurum>
      ) : (
        <div className="ilan-izgara">
          {ilanlar.map((i) => (
            <IlanKarti
              key={i.id}
              ilan={i}
              favoriDegisti={(iid, f) => sekme === 'favoriler' && !f && setIlanlar((l) => l?.filter((x) => x.id !== iid) ?? l)}
            />
          ))}
        </div>
      )}
      {sikayet && <SikayetPenceresi hedefTur="kullanici" hedefId={profil.id} kapat={() => setSikayet(false)} />}
    </div>
  );
}

function ProfilDuzenle({ ben, bitti }: { ben: Ben; bitti: (b: Ben | null) => void }) {
  const [ad, setAd] = useState(ben.ad ?? '');
  const [bolum, setBolum] = useState(ben.bolum ?? '');
  const [hata, setHata] = useState('');
  return (
    <form
      className="form profil-duzenle"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const v = await api<{ ben: Ben }>('/ben', { yontem: 'PATCH', govde: { ad, bolum } });
          bitti(v.ben);
        } catch (h) {
          setHata((h as Error).message);
        }
      }}
    >
      <label className="alan">
        <span>Adın</span>
        <input value={ad} onChange={(e) => setAd(e.target.value)} maxLength={SINIRLAR.ad} required autoFocus />
      </label>
      <label className="alan">
        <span>Bölümün</span>
        <input value={bolum} onChange={(e) => setBolum(e.target.value)} maxLength={SINIRLAR.bolum} />
      </label>
      <p className="ince">E-postan ({ben.eposta}) kimseye gösterilmez.</p>
      {hata && <p className="form-hata">{hata}</p>}
      <div className="eylemler">
        <button type="button" className="dugme dugme-sade" onClick={() => bitti(null)}>
          Vazgeç
        </button>
        <button className="dugme dugme-ana">Kaydet</button>
      </div>
    </form>
  );
}

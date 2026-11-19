// Özel mesajlar: solda sohbet listesi, sağda açık sohbet. Telefonda ikisi ayrı ekran.
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, fotoAdresi, type KullaniciOzet, type OzelMesaj, type SohbetOzeti } from '../api.ts';
import { Avatar, BosDurum, KategoriGorseli, MesajMetni, SikayetPenceresi, Simge, Yukleniyor } from '../bilesenler.tsx';
import { useCanli, useDurum } from '../durum.tsx';
import { GunAyraci, useSohbetKaydirma, yeniGunMu, YazmaKutusu } from '../sohbet-parcalari.tsx';
import { fiyatYaz, goreceZaman, saat } from '../yardimci.ts';

export default function Mesajlar() {
  const { id } = useParams();
  const sohbetId = id ? Number(id) : null;
  const { ben, cevrimici } = useDurum();
  const [sohbetler, setSohbetler] = useState<SohbetOzeti[] | null>(null);

  const listeYenile = useCallback(() => {
    api<{ sohbetler: SohbetOzeti[] }>('/sohbetler')
      .then((v) => setSohbetler(v.sohbetler))
      .catch(() => {});
  }, []);
  useEffect(listeYenile, [listeYenile]);

  useCanli((o) => {
    if (o.tur === 'ozel_mesaj') {
      // Listede olmayan yeni bir sohbetse listeyi sunucudan yeniden al.
      if (!sohbetler?.some((s) => s.id === o.sohbetId)) {
        listeYenile();
        return;
      }
      setSohbetler((l) => {
        if (!l) return l;
        const guncel = l.map((s) =>
          s.id === o.sohbetId
            ? {
                ...s,
                son: { metin: o.mesaj.metin, zaman: o.mesaj.olusturma, benden: o.mesaj.gonderenId === ben?.id },
                okunmamis: o.mesaj.gonderenId !== ben?.id && sohbetId !== o.sohbetId ? s.okunmamis + 1 : s.okunmamis,
              }
            : s,
        );
        return guncel.sort((a, b) => (a.id === o.sohbetId ? -1 : b.id === o.sohbetId ? 1 : 0));
      });
    }
    if (o.tur === 'okundu' && o.kullaniciId === ben?.id) setSohbetler((l) => l?.map((s) => (s.id === o.sohbetId ? { ...s, okunmamis: 0 } : s)) ?? l);
  });

  return (
    <div className={`mesajlar-sayfa ${sohbetId ? 'sohbet-secili' : ''}`}>
      <aside className="sohbet-listesi">
        <h1>Mesajlar</h1>
        {!sohbetler && <Yukleniyor />}
        {sohbetler?.length === 0 && (
          <BosDurum simge="✉️" baslik="Henüz mesajın yok">
            <p>Bir ilana girip "Mesaj gönder" dediğinde sohbet burada açılır.</p>
            <Link to="/" className="dugme">
              İlanlara göz at
            </Link>
          </BosDurum>
        )}
        {sohbetler?.map((s) => (
          <Link key={s.id} to={`/mesajlar/${s.id}`} className={`sohbet-satiri ${s.id === sohbetId ? 'secili' : ''} ${s.okunmamis ? 'okunmamis' : ''}`}>
            <Avatar id={s.karsi.id} ad={s.karsi.ad} boyut={46} cevrimici={cevrimici.has(s.karsi.id)} />
            <div className="sohbet-satiri-orta">
              <div className="sohbet-satiri-ust">
                <b>{s.karsi.ad}</b>
                <span className="ince">{goreceZaman(s.son.zaman)}</span>
              </div>
              <div className="sohbet-satiri-alt">
                <span className="son-mesaj">
                  {s.engelli ? '🚫 ' : ''}
                  {s.son.benden ? 'Sen: ' : ''}
                  {s.son.metin}
                </span>
                {s.okunmamis > 0 && <span className="sayac">{s.okunmamis}</span>}
              </div>
            </div>
          </Link>
        ))}
      </aside>
      <section className="sohbet-alani">
        {sohbetId ? (
          <AcikSohbet key={sohbetId} sohbetId={sohbetId} listeYenile={listeYenile} />
        ) : (
          <div className="sohbet-sec">
            <BosDurum simge="💬" baslik="Bir sohbet seç">
              <p>Soldan bir sohbet seç ya da bir ilandan satıcıya yaz.</p>
            </BosDurum>
          </div>
        )}
      </section>
    </div>
  );
}

type SohbetBilgisi = {
  id: number;
  karsi: KullaniciOzet & { sonGorulme: string | null };
  engel: boolean;
  karsiSonOkunan: number;
};

function AcikSohbet({ sohbetId, listeYenile }: { sohbetId: number; listeYenile: () => void }) {
  const { ben, bildir, cevrimici, aktifSohbet, okunmamisYenile } = useDurum();
  const git = useNavigate();
  const [bilgi, setBilgi] = useState<SohbetBilgisi | null>(null);
  const [mesajlar, setMesajlar] = useState<OzelMesaj[]>([]);
  const [dahaVar, setDahaVar] = useState(false);
  const [hata, setHata] = useState('');
  const [sikayet, setSikayet] = useState<number | null>(null);
  const liste = useRef<HTMLDivElement>(null);

  const okunduYap = useCallback(() => {
    if (document.visibilityState === 'visible') api(`/sohbetler/${sohbetId}/okundu`, { govde: {} }).catch(() => {});
  }, [sohbetId]);

  useEffect(() => {
    aktifSohbet.current = sohbetId;
    api<{ sohbet: SohbetBilgisi; mesajlar: OzelMesaj[]; dahaVar: boolean }>(`/sohbetler/${sohbetId}/mesajlar`)
      .then((v) => {
        setBilgi(v.sohbet);
        setMesajlar(v.mesajlar);
        setDahaVar(v.dahaVar);
        okunduYap();
      })
      .catch((h) => setHata(h.message));
    const gorunur = () => document.visibilityState === 'visible' && okunduYap();
    document.addEventListener('visibilitychange', gorunur);
    return () => {
      aktifSohbet.current = null;
      document.removeEventListener('visibilitychange', gorunur);
      okunmamisYenile();
    };
  }, [sohbetId, aktifSohbet, okunduYap, okunmamisYenile]);

  useCanli((o) => {
    if (o.tur === 'ozel_mesaj' && o.sohbetId === sohbetId) {
      setMesajlar((m) => (m.some((x) => x.id === o.mesaj.id) ? m : [...m, o.mesaj]));
      if (o.mesaj.gonderenId !== ben?.id) okunduYap();
    }
    if (o.tur === 'okundu' && o.sohbetId === sohbetId && o.kullaniciId !== ben?.id)
      setBilgi((b) => (b ? { ...b, karsiSonOkunan: o.sonOkunanId } : b));
  });

  const { yeniVar, enAlta, enAltaZorla } = useSohbetKaydirma(liste, mesajlar.at(-1)?.id, mesajlar[0]?.id);

  const gonder = async (metin: string) => {
    try {
      enAltaZorla();
      const v = await api<{ mesaj: OzelMesaj }>(`/sohbetler/${sohbetId}/mesajlar`, { govde: { metin } });
      setMesajlar((m) => (m.some((x) => x.id === v.mesaj.id) ? m : [...m, v.mesaj]));
      return true;
    } catch (h) {
      bildir((h as Error).message, 'hata');
      return false;
    }
  };

  const eskileriYukle = async () => {
    const v = await api<{ mesajlar: OzelMesaj[]; dahaVar: boolean }>(`/sohbetler/${sohbetId}/mesajlar?once=${mesajlar[0]?.id}`);
    setMesajlar((m) => [...v.mesajlar, ...m]);
    setDahaVar(v.dahaVar);
  };

  if (hata)
    return (
      <BosDurum simge="🫥" baslik={hata}>
        <button className="dugme" onClick={() => git('/mesajlar')}>
          Mesajlara dön
        </button>
      </BosDurum>
    );
  if (!bilgi) return <Yukleniyor />;

  const acik = cevrimici.has(bilgi.karsi.id);
  const sonBenimki = [...mesajlar].reverse().find((m) => m.gonderenId === ben?.id);

  return (
    <div className="acik-sohbet">
      <header className="sohbet-ust">
        <button className="ikon-dugme mobil" onClick={() => git('/mesajlar')} aria-label="Geri">
          <Simge ad="geri" />
        </button>
        <Link to={`/profil/${bilgi.karsi.id}`} className="sohbet-kisi">
          <Avatar id={bilgi.karsi.id} ad={bilgi.karsi.ad} boyut={40} cevrimici={acik} />
          <div>
            <b>{bilgi.karsi.ad}</b>
            <span className="ince">{acik ? 'çevrimiçi' : bilgi.karsi.sonGorulme ? `son görülme ${goreceZaman(bilgi.karsi.sonGorulme)}` : bilgi.karsi.bolum ?? ''}</span>
          </div>
        </Link>
      </header>
      <div className="mesaj-listesi" ref={liste}>
        {dahaVar && (
          <div className="ortala">
            <button className="dugme dugme-sade kucuk" onClick={eskileriYukle}>
              Daha eski mesajlar
            </button>
          </div>
        )}
        <div className="guvenlik-ipucu kucuk">
          <Simge ad="kalkan" boyut={16} />
          <p>Kampüste, kalabalık bir yerde buluşun. Ürünü görmeden para göndermeyin, şifre ya da kart bilgisi paylaşmayın.</p>
        </div>
        {mesajlar.map((m, i) => {
          const benim = m.gonderenId === ben?.id;
          const onceki = mesajlar[i - 1];
          return (
            <Fragment key={m.id}>
              {yeniGunMu(onceki?.olusturma, m.olusturma) && <GunAyraci zaman={m.olusturma} />}
              <div className={`ozel-mesaj ${benim ? 'benim' : ''}`}>
                <div className="balon">
                  {m.ilan && (
                    <Link to={`/ilan/${m.ilan.id}`} className="mesaj-ilan">
                      <div className="mesaj-ilan-gorsel">
                        {m.ilan.foto ? <img src={fotoAdresi(m.ilan.foto)} alt="" /> : <KategoriGorseli kategori={m.ilan.kategori ?? 'diger'} />}
                      </div>
                      <div>
                        <small>İlan hakkında</small>
                        <b>{m.ilan.baslik ?? 'Silinmiş ilan'}</b>
                        {m.ilan.fiyat !== null && m.ilan.tur !== 'takas' && <span>{fiyatYaz(m.ilan.fiyat)}</span>}
                      </div>
                    </Link>
                  )}
                  <MesajMetni metin={m.metin} />
                  <span className="mesaj-saat">
                    {saat(m.olusturma)}
                    {benim && m.id === sonBenimki?.id && (
                      <span className={`okundu ${bilgi.karsiSonOkunan >= m.id ? 'mavi' : ''}`} title={bilgi.karsiSonOkunan >= m.id ? 'Okundu' : 'Gönderildi'}>
                        <Simge ad={bilgi.karsiSonOkunan >= m.id ? 'ciftTik' : 'tik'} boyut={14} />
                      </span>
                    )}
                  </span>
                </div>
                {!benim && (
                  <button className="ikon-dugme kucuk mesaj-eylem" onClick={() => setSikayet(m.id)} aria-label="Mesajı şikayet et" title="Şikayet et">
                    <Simge ad="bayrak" boyut={14} />
                  </button>
                )}
              </div>
            </Fragment>
          );
        })}
      </div>
      {yeniVar && (
        <button className="yeni-mesaj-dugme" onClick={enAlta}>
          Yeni mesaj ↓
        </button>
      )}
      <YazmaKutusu
        gonder={async (m) => {
          const ok = await gonder(m);
          if (ok) listeYenile();
          return ok;
        }}
        pasif={bilgi.engel && 'Bu kişiyle artık mesajlaşamazsın (engel var ya da hesap kapatıldı).'}
      />
      {sikayet && <SikayetPenceresi hedefTur="ozel_mesaj" hedefId={sikayet} kapat={() => setSikayet(null)} />}
    </div>
  );
}

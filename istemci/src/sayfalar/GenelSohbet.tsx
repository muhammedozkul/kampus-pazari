// Herkese açık kampüs sohbeti: anlık mesajlar, çevrimiçi sayısı, eski mesajları yükleme, sil/şikayet.
import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, type GenelMesaj } from '../api.ts';
import { Avatar, MesajMetni, SikayetPenceresi, Simge, Yukleniyor } from '../bilesenler.tsx';
import { useCanli, useDurum } from '../durum.tsx';
import { ayniGrupMu, GunAyraci, useSohbetKaydirma, yeniGunMu, YazmaKutusu } from '../sohbet-parcalari.tsx';
import { saat } from '../yardimci.ts';

export default function GenelSohbet() {
  const { ben, bildir, cevrimici, engellenenler } = useDurum();
  const [mesajlar, setMesajlar] = useState<GenelMesaj[] | null>(null);
  const [dahaVar, setDahaVar] = useState(false);
  const [sikayet, setSikayet] = useState<number | null>(null);
  const liste = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<{ mesajlar: GenelMesaj[]; dahaVar: boolean }>('/genel')
      .then((v) => {
        setMesajlar(v.mesajlar);
        setDahaVar(v.dahaVar);
      })
      .catch((h) => bildir(h.message, 'hata'));
  }, [bildir]);

  useCanli((o) => {
    if (o.tur === 'genel_mesaj') setMesajlar((m) => (m && !m.some((x) => x.id === o.mesaj.id) ? [...m, o.mesaj] : m));
    if (o.tur === 'genel_mesaj_silindi') setMesajlar((m) => m?.filter((x) => x.id !== o.id) ?? m);
  });

  const gorunen = (mesajlar ?? []).filter((m) => !engellenenler.has(m.kullanici.id));
  const { yeniVar, enAlta, enAltaZorla } = useSohbetKaydirma(liste, gorunen.at(-1)?.id, gorunen[0]?.id);

  const eskileriYukle = async () => {
    const v = await api<{ mesajlar: GenelMesaj[]; dahaVar: boolean }>(`/genel?once=${mesajlar?.[0]?.id}`);
    setMesajlar((m) => [...v.mesajlar, ...(m ?? [])]);
    setDahaVar(v.dahaVar);
  };

  const gonder = async (metin: string) => {
    try {
      enAltaZorla();
      const v = await api<{ mesaj: GenelMesaj }>('/genel', { govde: { metin } });
      setMesajlar((m) => (m && !m.some((x) => x.id === v.mesaj.id) ? [...m, v.mesaj] : m));
      return true;
    } catch (h) {
      bildir((h as Error).message, 'hata');
      return false;
    }
  };

  const sil = async (id: number) => {
    if (!confirm('Mesaj silinsin mi?')) return;
    try {
      await api(`/genel/${id}`, { yontem: 'DELETE' });
      setMesajlar((m) => m?.filter((x) => x.id !== id) ?? m);
    } catch (h) {
      bildir((h as Error).message, 'hata');
    }
  };

  return (
    <div className="sohbet-sayfa">
      <div className="sohbet-baslik">
        <div className="oda-simge" aria-hidden="true">
          <Simge ad="sohbet" boyut={22} />
        </div>
        <div>
          <h1>Genel sohbet</h1>
          <span className="ince">
            <span className="yesil-nokta" /> {cevrimici.size} kişi çevrimiçi · Herkese açık, kibar olalım
          </span>
        </div>
      </div>
      <div className="mesaj-listesi" ref={liste}>
        {!mesajlar && <Yukleniyor />}
        {dahaVar && (
          <div className="ortala">
            <button className="dugme dugme-sade kucuk" onClick={eskileriYukle}>
              Daha eski mesajlar
            </button>
          </div>
        )}
        {mesajlar && gorunen.length === 0 && (
          <div className="bos-durum kucuk">
            <div className="bos-simge" aria-hidden="true">
              <Simge ad="sohbet" boyut={36} />
            </div>
            <h3>Sohbeti sen başlat</h3>
            <p>"Elinde X dersi notu olan var mı?" gibi bir şey sorabilirsin.</p>
          </div>
        )}
        {gorunen.map((m, i) => {
          const onceki = gorunen[i - 1];
          const benim = m.kullanici.id === ben?.id;
          const grup = !yeniGunMu(onceki?.olusturma, m.olusturma) && ayniGrupMu(onceki && { kim: onceki.kullanici.id, zaman: onceki.olusturma }, { kim: m.kullanici.id, zaman: m.olusturma });
          return (
            <Fragment key={m.id}>
              {yeniGunMu(onceki?.olusturma, m.olusturma) && <GunAyraci zaman={m.olusturma} />}
              <div className={`genel-mesaj ${benim ? 'benim' : ''} ${grup ? 'grup' : ''}`}>
                <div className="genel-avatar">
                  {!grup && (
                    <Link to={`/profil/${m.kullanici.id}`} aria-label={m.kullanici.ad}>
                      <Avatar id={m.kullanici.id} ad={m.kullanici.ad} boyut={36} cevrimici={cevrimici.has(m.kullanici.id)} />
                    </Link>
                  )}
                </div>
                <div className="genel-govde">
                  {!grup && (
                    <div className="genel-ust">
                      <Link to={`/profil/${m.kullanici.id}`}>
                        <b>{benim ? 'Sen' : m.kullanici.ad}</b>
                      </Link>
                      {m.kullanici.bolum && <span className="ince">{m.kullanici.bolum}</span>}
                      <span className="ince">{saat(m.olusturma)}</span>
                    </div>
                  )}
                  <div className="balon">
                    <MesajMetni metin={m.metin} />
                  </div>
                </div>
                <div className="mesaj-eylem">
                  {benim || ben?.rol === 'yonetici' ? (
                    <button className="ikon-dugme kucuk" onClick={() => sil(m.id)} aria-label="Mesajı sil" title="Sil">
                      <Simge ad="cop" boyut={15} />
                    </button>
                  ) : null}
                  {!benim && (
                    <button className="ikon-dugme kucuk" onClick={() => setSikayet(m.id)} aria-label="Mesajı şikayet et" title="Şikayet et">
                      <Simge ad="bayrak" boyut={15} />
                    </button>
                  )}
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>
      {yeniVar && (
        <button className="yeni-mesaj-dugme" onClick={enAlta}>
          Yeni mesajlar ↓
        </button>
      )}
      <YazmaKutusu gonder={gonder} ipucu="Herkese yaz… (Enter gönderir, Shift+Enter yeni satır)" />
      {sikayet && <SikayetPenceresi hedefTur="genel_mesaj" hedefId={sikayet} kapat={() => setSikayet(null)} />}
    </div>
  );
}

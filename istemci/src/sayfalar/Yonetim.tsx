// Yönetici paneli: özet sayılar, şikayetler; ilanı kaldırma, hesabı kapatma, mesajı silme.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { SIKAYET_NEDENLERI, type SikayetNedeni } from '../../../ortak/sabitler.ts';
import { api } from '../api.ts';
import { BosDurum, Yukleniyor } from '../bilesenler.tsx';
import { useDurum } from '../durum.tsx';
import { goreceZaman } from '../yardimci.ts';

type Ozet = { kullanici: number; yasakli: number; aktifIlan: number; tamamlanan: number; acikSikayet: number; genelMesaj: number; cevrimici: number };
type Sikayet = {
  id: number;
  hedef_tur: 'ilan' | 'kullanici' | 'genel_mesaj' | 'ozel_mesaj';
  hedef_id: number;
  neden: SikayetNedeni;
  not_metni: string | null;
  olusturma: string;
  sikayet_eden_ad: string | null;
  hedef: { ozet: string; durum?: string; sahipId: number; sahipAd: string | null; sahipYasakli: boolean } | null;
};

export default function Yonetim() {
  const { bildir } = useDurum();
  const [ozet, setOzet] = useState<Ozet | null>(null);
  const [durum, setDurum] = useState<'acik' | 'kapali'>('acik');
  const [sikayetler, setSikayetler] = useState<Sikayet[] | null>(null);

  const yenile = useCallback(() => {
    api<Ozet>('/yonetim/ozet').then(setOzet);
    api<{ sikayetler: Sikayet[] }>(`/yonetim/sikayetler?durum=${durum}`).then((v) => setSikayetler(v.sikayetler));
  }, [durum]);
  useEffect(yenile, [yenile]);

  const yap = async (is: () => Promise<unknown>, mesaj: string) => {
    try {
      await is();
      bildir(mesaj);
      yenile();
    } catch (h) {
      bildir((h as Error).message, 'hata');
    }
  };

  return (
    <div className="sayfa">
      <h1>Yönetim</h1>
      {ozet && (
        <div className="yonetim-sayilar">
          {[
            ['Açık şikayet', ozet.acikSikayet],
            ['Aktif ilan', ozet.aktifIlan],
            ['Tamamlanan', ozet.tamamlanan],
            ['Kullanıcı', ozet.kullanici],
            ['Kapatılan hesap', ozet.yasakli],
            ['Çevrimiçi', ozet.cevrimici],
          ].map(([ad, n]) => (
            <div key={ad} className={ad === 'Açık şikayet' && Number(n) > 0 ? 'vurgu' : ''}>
              <b>{n}</b>
              <span>{ad}</span>
            </div>
          ))}
        </div>
      )}
      <div className="sekmeler">
        <button className={durum === 'acik' ? 'secili' : ''} onClick={() => setDurum('acik')}>
          Açık şikayetler
        </button>
        <button className={durum === 'kapali' ? 'secili' : ''} onClick={() => setDurum('kapali')}>
          Kapatılanlar
        </button>
      </div>
      {!sikayetler && <Yukleniyor />}
      {sikayetler?.length === 0 && <BosDurum simge="tik" baslik={durum === 'acik' ? 'Bekleyen şikayet yok' : 'Kapatılan şikayet yok'} />}
      <div className="sikayet-listesi">
        {sikayetler?.map((s) => (
          <article key={s.id} className="sikayet-karti">
            <div className="sikayet-ust">
              <span className="rozet rozet-uyari">{SIKAYET_NEDENLERI[s.neden] ?? s.neden}</span>
              <span className="ince">
                {s.sikayet_eden_ad ?? 'Adsız'} · {goreceZaman(s.olusturma)}
              </span>
            </div>
            <p className="sikayet-hedef">
              {s.hedef ? s.hedef.ozet : 'Hedef silinmiş'}
              {s.hedef?.durum && <span className="ince"> ({s.hedef.durum})</span>}
            </p>
            {s.not_metni && <p className="sikayet-not">“{s.not_metni}”</p>}
            {s.hedef && (
              <p className="ince">
                Sahibi: <Link to={`/profil/${s.hedef.sahipId}`}>{s.hedef.sahipAd ?? 'Adsız'}</Link>
                {s.hedef.sahipYasakli && ' (hesap kapalı)'}
              </p>
            )}
            {durum === 'acik' && (
              <div className="eylemler">
                {s.hedef_tur === 'ilan' && s.hedef && s.hedef.durum !== 'kaldirildi' && (
                  <>
                    <Link className="dugme kucuk" to={`/ilan/${s.hedef_id}`}>
                      İlanı aç
                    </Link>
                    <button
                      className="dugme kucuk dugme-tehlike"
                      onClick={() => yap(() => api(`/ilanlar/${s.hedef_id}/durum`, { govde: { durum: 'kaldirildi' } }), 'İlan kaldırıldı.')}
                    >
                      İlanı kaldır
                    </button>
                  </>
                )}
                {s.hedef_tur === 'genel_mesaj' && s.hedef?.durum !== 'silindi' && (
                  <button className="dugme kucuk dugme-tehlike" onClick={() => yap(() => api(`/genel/${s.hedef_id}`, { yontem: 'DELETE' }), 'Mesaj silindi.')}>
                    Mesajı sil
                  </button>
                )}
                {s.hedef && !s.hedef.sahipYasakli && (
                  <button
                    className="dugme kucuk dugme-tehlike"
                    onClick={() =>
                      confirm(`${s.hedef!.sahipAd ?? 'Bu kişinin'} hesabı kapatılsın mı?`) &&
                      yap(() => api(`/yonetim/kullanicilar/${s.hedef!.sahipId}/yasak`, { govde: { yasakli: true } }), 'Hesap kapatıldı.')
                    }
                  >
                    Hesabı kapat
                  </button>
                )}
                <button className="dugme kucuk" onClick={() => yap(() => api(`/yonetim/sikayetler/${s.id}/kapat`, { govde: {} }), 'Şikayet kapatıldı.')}>
                  Şikayeti kapat
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

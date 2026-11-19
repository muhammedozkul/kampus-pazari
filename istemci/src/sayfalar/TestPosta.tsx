// Geliştirme için test posta kutusu: gerçek e-posta yerine giriş kodları burada görünür.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../api.ts';
import { Simge } from '../bilesenler.tsx';
import { goreceZaman } from '../yardimci.ts';

type Mektup = { id: number; alici: string; konu: string; govde: string; olusturma: string; gecerli: boolean };

export default function TestPosta() {
  const [p, setP] = useSearchParams();
  const alici = p.get('alici') ?? '';
  const [mektuplar, setMektuplar] = useState<Mektup[] | null>(null);
  const [kopyalanan, setKopyalanan] = useState<number | null>(null);

  useEffect(() => {
    let iptal = false;
    const getir = () =>
      api<{ mektuplar: Mektup[] }>(`/test-posta${alici ? `?alici=${encodeURIComponent(alici)}` : ''}`)
        .then((v) => !iptal && setMektuplar(v.mektuplar))
        .catch(() => {});
    getir();
    const t = setInterval(getir, 3000); // Yeni kod gelince kendiliğinden görünsün.
    return () => {
      iptal = true;
      clearInterval(t);
    };
  }, [alici]);

  const kopyala = async (m: Mektup) => {
    const kod = m.konu.match(/\d{6}/)?.[0];
    if (!kod) return;
    await navigator.clipboard?.writeText(kod).catch(() => {});
    setKopyalanan(m.id);
    setTimeout(() => setKopyalanan(null), 1500);
  };

  return (
    <div className="posta-sayfa">
      <div className="posta-ust">
        <div>
          <span className="rozet rozet-uyari">Geliştirme aracı</span>
          <h1>
            <Simge ad="posta" boyut={26} /> Test posta kutusu
          </h1>
          <p className="ince">
            Bu proje bilgisayarında çalıştığı için gerçek e-posta gönderilmez. Giriş kodları buraya (ve sunucu terminaline) düşer. Gerçek bir
            yayında bu sayfa olmaz.
          </p>
        </div>
        <Link to="/giris" className="dugme">
          Girişe dön
        </Link>
      </div>
      <label className="alan">
        <span>Alıcıya göre süz</span>
        <input
          value={alici}
          onChange={(e) => setP(e.target.value ? { alici: e.target.value } : {}, { replace: true })}
          placeholder="ad.soyad@ogr.dpu.edu.tr"
        />
      </label>
      <div className="posta-listesi">
        {mektuplar?.length === 0 && <p className="ince">Henüz mektup yok. Giriş sayfasından kod iste.</p>}
        {mektuplar?.map((m) => {
          const kod = m.konu.match(/\d{6}/)?.[0];
          return (
            <article key={m.id} className="mektup">
              <div className="mektup-ust">
                <b>{m.alici}</b>
                <span className="ince">{goreceZaman(m.olusturma)}</span>
              </div>
              <p className="mektup-konu">{m.konu}</p>
              {kod && (
                <div className="kod-satiri">
                  <button className="kod-goster" onClick={() => kopyala(m)} title="Kopyala">
                    {kod}
                    <small>{kopyalanan === m.id ? 'kopyalandı ✓' : 'kopyala'}</small>
                  </button>
                  {m.gecerli ? (
                    <Link className="dugme dugme-ana" to={`/giris?eposta=${encodeURIComponent(m.alici)}&kod=${kod}`}>
                      Bu kodla giriş yap →
                    </Link>
                  ) : (
                    <span className="ince">Kullanıldı ya da süresi doldu</span>
                  )}
                </div>
              )}
              <pre className="mektup-govde">{m.govde}</pre>
            </article>
          );
        })}
      </div>
    </div>
  );
}

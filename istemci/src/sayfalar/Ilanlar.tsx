// Ana sayfa: ilan akışı, arama ve filtreler. Filtreler adres çubuğunda tutulur (paylaşılabilir, geri tuşu çalışır).
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { KATEGORILER, KATEGORI_LISTESI } from '../../../ortak/sabitler.ts';
import { api, type Ilan } from '../api.ts';
import { BosDurum, IlanIskeleti, IlanKarti, Simge } from '../bilesenler.tsx';
import { KategoriSimgesi } from '../cizimler.tsx';
import { useDurum } from '../durum.tsx';

const SEKMELER = [
  { deger: '', ad: 'Tümü' },
  { deger: 'satilik', ad: 'Satılık' },
  { deger: 'takas', ad: 'Takas' },
  { deger: 'ariyorum', ad: 'Arıyorum' },
];

function selam() {
  const s = new Date().getHours();
  return s < 6 ? 'İyi geceler' : s < 12 ? 'Günaydın' : s < 18 ? 'İyi günler' : 'İyi akşamlar';
}

export default function Ilanlar() {
  const { ben, cevrimici } = useDurum();
  const [p, setP] = useSearchParams();
  const [ilanlar, setIlanlar] = useState<Ilan[] | null>(null);
  const [dahaVar, setDahaVar] = useState(false);
  const [sayfa, setSayfa] = useState(0);
  const [hata, setHata] = useState('');
  const [arama, setArama] = useState(p.get('q') ?? '');
  const [filtreAcik, setFiltreAcik] = useState(false);
  const [ozet, setOzet] = useState<{ aktifIlan: number; uye: number; cevrimici: number } | null>(null);

  const sorgu = p.toString();
  useEffect(() => {
    api<typeof ozet>('/ozet').then(setOzet).catch(() => {});
  }, []);

  useEffect(() => {
    let iptal = false;
    setIlanlar(null);
    setSayfa(0);
    setHata('');
    api<{ ilanlar: Ilan[]; dahaVar: boolean }>(`/ilanlar?${sorgu}`)
      .then((v) => {
        if (iptal) return;
        setIlanlar(v.ilanlar);
        setDahaVar(v.dahaVar);
      })
      .catch((h) => !iptal && setHata(h.message));
    return () => {
      iptal = true;
    };
  }, [sorgu]);

  // Adres değişince (ör. "İlanlar" menüsü ya da geri tuşu) arama kutusu da güncellensin.
  const adrestekiArama = p.get('q') ?? '';
  useEffect(() => {
    setArama((a) => (a.trim() === adrestekiArama ? a : adrestekiArama));
  }, [adrestekiArama]);

  // Yazmayı bırakınca aramayı uygula.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((p.get('q') ?? '') !== arama.trim()) degistir('q', arama.trim());
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arama]);

  const degistir = (anahtar: string, deger: string) => {
    const yeni = new URLSearchParams(p);
    if (deger) yeni.set(anahtar, deger);
    else yeni.delete(anahtar);
    setP(yeni, { replace: anahtar === 'q' });
  };

  const dahaYukle = async () => {
    const sonraki = sayfa + 1;
    const v = await api<{ ilanlar: Ilan[]; dahaVar: boolean }>(`/ilanlar?${sorgu}&sayfa=${sonraki}`);
    setIlanlar((l) => [...(l ?? []), ...v.ilanlar]);
    setDahaVar(v.dahaVar);
    setSayfa(sonraki);
  };

  const tur = p.get('tur') ?? '';
  const kategori = p.get('kategori') ?? '';
  const filtreSayisi = ['min', 'max', 'sirala'].filter((k) => p.get(k)).length;

  return (
    <div className="sayfa">
      <section className="karsilama">
        <div className="karsilama-sus" aria-hidden="true">
          <span className="sus sus-1" />
          <span className="sus sus-2" />
          <span className="sus sus-3" />
          <svg className="sus-cizgi" viewBox="0 0 120 40">
            <path d="M2 30c14-24 28-24 38 0s26 24 38 0 28-24 40 0" />
          </svg>
        </div>
        <div className="karsilama-metin">
          <span className="karsilama-ust">{selam()} 👋</span>
          <h1>
            {ben?.ad?.split(' ')[0]}, bugün kampüste <em>ne arıyorsun?</em>
          </h1>
          <p>Bulamazsan bir "Arıyorum" ilanı ver, sahibi seni bulsun.</p>
          <div className="karsilama-eylem">
            <Link to="/ilan-ver" className="dugme dugme-ana">
              <Simge ad="arti" boyut={18} /> İlan ver
            </Link>
            <Link to="/ilan-ver?tur=ariyorum" className="dugme dugme-cam">
              <Simge ad="ara" boyut={18} /> Arıyorum de
            </Link>
          </div>
        </div>
        {ozet && (
          <div className="ozet-sayilar">
            <div>
              <b>{ozet.aktifIlan}</b>
              <span>aktif ilan</span>
            </div>
            <div>
              <b>{ozet.uye}</b>
              <span>öğrenci</span>
            </div>
            <div>
              <b>
                <i className="canli-nokta" />
                {Math.max(cevrimici.size, 1)}
              </b>
              <span>çevrimiçi</span>
            </div>
          </div>
        )}
      </section>

      <div className="arama-satiri">
        <label className="arama-kutusu">
          <Simge ad="ara" boyut={18} />
          <input value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Kitap, kulaklık, bisiklet…" aria-label="İlanlarda ara" />
          {arama && (
            <button className="ikon-dugme kucuk" onClick={() => setArama('')} aria-label="Aramayı temizle">
              <Simge ad="kapat" boyut={16} />
            </button>
          )}
        </label>
        <button className={`dugme filtre-dugme ${filtreAcik || filtreSayisi ? 'aktif' : ''}`} onClick={() => setFiltreAcik((a) => !a)}>
          <Simge ad="filtre" boyut={18} /> <span className="masaustu">Filtre</span>
          {filtreSayisi > 0 && <span className="sayac">{filtreSayisi}</span>}
        </button>
      </div>

      {filtreAcik && (
        <div className="filtre-paneli">
          <label className="alan">
            <span>En az (₺)</span>
            <input
              key={p.get('min') ?? ''}
              type="number"
              min={0}
              inputMode="numeric"
              defaultValue={p.get('min') ?? ''}
              onBlur={(e) => degistir('min', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          </label>
          <label className="alan">
            <span>En çok (₺)</span>
            <input
              key={p.get('max') ?? ''}
              type="number"
              min={0}
              inputMode="numeric"
              defaultValue={p.get('max') ?? ''}
              onBlur={(e) => degistir('max', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          </label>
          <label className="alan">
            <span>Sıralama</span>
            <select value={p.get('sirala') ?? ''} onChange={(e) => degistir('sirala', e.target.value)}>
              <option value="">En yeni</option>
              <option value="ucuz">Fiyat: düşükten yükseğe</option>
              <option value="pahali">Fiyat: yüksekten düşüğe</option>
            </select>
          </label>
          {filtreSayisi > 0 && (
            <button
              className="dugme dugme-sade"
              onClick={() => {
                const yeni = new URLSearchParams(p);
                ['min', 'max', 'sirala'].forEach((k) => yeni.delete(k));
                setP(yeni);
                setFiltreAcik(false);
              }}
            >
              Temizle
            </button>
          )}
        </div>
      )}

      <div className="sekmeler" role="tablist">
        {SEKMELER.map((s) => (
          <button key={s.deger} role="tab" aria-selected={tur === s.deger} className={tur === s.deger ? 'secili' : ''} onClick={() => degistir('tur', s.deger)}>
            {s.ad}
          </button>
        ))}
      </div>

      <div className="kategori-seridi">
        <button className={`kategori-cip ${!kategori ? 'secili' : ''}`} onClick={() => degistir('kategori', '')}>
          Hepsi
        </button>
        {KATEGORI_LISTESI.map((k) => (
          <button key={k} className={`kategori-cip ${kategori === k ? 'secili' : ''}`} onClick={() => degistir('kategori', kategori === k ? '' : k)}>
            <KategoriSimgesi kategori={k} /> {KATEGORILER[k].ad}
          </button>
        ))}
      </div>

      {hata && <p className="form-hata">{hata}</p>}
      {!ilanlar && !hata && <IlanIskeleti />}
      {ilanlar && ilanlar.length === 0 && (
        <BosDurum simge={p.get('q') ? '🔍' : '🛍️'} baslik={p.get('q') ? 'Aradığın şey henüz yok' : 'Burada henüz ilan yok'}>
          <p>{tur === 'ariyorum' ? 'Kimse bir şey aramıyor gibi.' : 'İlk ilanı sen ver ya da aradığını duyur.'}</p>
          <Link to={`/ilan-ver?tur=ariyorum${p.get('q') ? `&baslik=${encodeURIComponent(p.get('q')!)}` : ''}`} className="dugme dugme-ana">
            "Arıyorum" ilanı ver
          </Link>
        </BosDurum>
      )}
      {ilanlar && ilanlar.length > 0 && (
        <>
          <div className="ilan-izgara">
            {ilanlar.map((i, sira) => (
              <IlanKarti key={i.id} ilan={i} sira={sira} />
            ))}
          </div>
          {dahaVar && (
            <div className="ortala">
              <button className="dugme" onClick={dahaYukle}>
                Daha fazla göster
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

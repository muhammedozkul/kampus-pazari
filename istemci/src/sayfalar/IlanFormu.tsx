// İlan ver / düzenle. Alanlar ilan türüne göre değişir.
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  ILAN_TURLERI,
  ILAN_TURU_LISTESI,
  KATEGORILER,
  KATEGORI_LISTESI,
  KOSULLAR,
  SINIRLAR,
  type IlanTuru,
  type Kategori,
  type Kosul,
} from '../../../ortak/sabitler.ts';
import { api, fotoAdresi, type IlanDetayi } from '../api.ts';
import { Simge, Yukleniyor } from '../bilesenler.tsx';
import { useDurum } from '../durum.tsx';
import { fotoKucult } from '../yardimci.ts';

const TUR_SIMGELERI: Record<IlanTuru, string> = { satilik: '🏷️', takas: '🔄', satilik_takas: '🤝', ariyorum: '🔎' };

export default function IlanFormu() {
  const { id } = useParams();
  const [p] = useSearchParams();
  const duzenleme = !!id;
  const git = useNavigate();
  const { bildir, ben } = useDurum();
  const [yuklendi, setYuklendi] = useState(!duzenleme);
  const [tur, setTur] = useState<IlanTuru | ''>((ILAN_TURU_LISTESI as string[]).includes(p.get('tur') ?? '') ? (p.get('tur') as IlanTuru) : '');
  const [kategori, setKategori] = useState<Kategori | ''>('');
  const [baslik, setBaslik] = useState(p.get('baslik') ?? '');
  const [aciklama, setAciklama] = useState('');
  const [fiyat, setFiyat] = useState('');
  const [takasIstegi, setTakasIstegi] = useState('');
  const [kosul, setKosul] = useState<Kosul | ''>('');
  const [fotolar, setFotolar] = useState<string[]>([]);
  const [fotoIsleniyor, setFotoIsleniyor] = useState(false);
  const [hata, setHata] = useState('');
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const dosyaSecici = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    api<{ ilan: IlanDetayi }>(`/ilanlar/${id}`)
      .then(({ ilan }) => {
        if (ilan.sahip.id !== ben?.id) {
          git(`/ilan/${id}`, { replace: true });
          return;
        }
        setTur(ilan.tur);
        setKategori(ilan.kategori);
        setBaslik(ilan.baslik);
        setAciklama(ilan.aciklama);
        setFiyat(ilan.fiyat === null ? '' : String(ilan.fiyat));
        setTakasIstegi(ilan.takasIstegi ?? '');
        setKosul(ilan.kosul ?? '');
        setFotolar(ilan.fotolar);
        setYuklendi(true);
      })
      .catch((h) => setHata(h.message));
  }, [id, ben?.id, git]);

  const fotoEkle = async (dosyalar: FileList | null) => {
    if (!dosyalar?.length) return;
    const yer = SINIRLAR.fotoSayisi - fotolar.length;
    if (yer <= 0) return bildir(`En çok ${SINIRLAR.fotoSayisi} fotoğraf ekleyebilirsin.`, 'hata');
    setFotoIsleniyor(true);
    try {
      const yeni: string[] = [];
      for (const d of [...dosyalar].slice(0, yer)) yeni.push(await fotoKucult(d));
      setFotolar((f) => [...f, ...yeni]);
      if (dosyalar.length > yer) bildir(`İlk ${yer} fotoğraf eklendi (en çok ${SINIRLAR.fotoSayisi}).`);
    } catch (h) {
      bildir((h as Error).message, 'hata');
    } finally {
      setFotoIsleniyor(false);
      if (dosyaSecici.current) dosyaSecici.current.value = '';
    }
  };

  const kaydet = async (e: React.FormEvent) => {
    e.preventDefault();
    setHata('');
    if (!tur) return setHata('İlan türünü seç.');
    if (!kategori) return setHata('Kategori seç.');
    setKaydediliyor(true);
    try {
      const govde = { tur, kategori, baslik, aciklama, fiyat: fiyat === '' ? null : Number(fiyat), takasIstegi, kosul: kosul || null, fotolar };
      const v = duzenleme
        ? await api<{ id: number }>(`/ilanlar/${id}`, { yontem: 'PATCH', govde })
        : await api<{ id: number }>('/ilanlar', { govde });
      bildir(duzenleme ? 'İlan güncellendi.' : 'İlanın yayında! 🎉');
      git(`/ilan/${v.id}`, { replace: true });
    } catch (h) {
      setHata((h as Error).message);
      setKaydediliyor(false);
    }
  };

  if (!yuklendi) return hata ? <p className="form-hata">{hata}</p> : <Yukleniyor />;

  const fiyatGerekli = tur === 'satilik' || tur === 'satilik_takas';
  const takasVar = tur === 'takas' || tur === 'satilik_takas';
  const ariyor = tur === 'ariyorum';

  return (
    <div className="sayfa dar">
      <button className="geri-baglanti" onClick={() => git(-1)}>
        <Simge ad="geri" boyut={16} /> Geri
      </button>
      <h1>{duzenleme ? 'İlanı düzenle' : 'İlan ver'}</h1>
      <form className="form ilan-formu" onSubmit={kaydet}>
        <fieldset>
          <legend>Ne yapmak istiyorsun?</legend>
          <div className="tur-secici">
            {ILAN_TURU_LISTESI.map((t) => (
              <label key={t} className={`tur-secenek ${tur === t ? 'secili' : ''}`}>
                <input type="radio" name="tur" checked={tur === t} onChange={() => setTur(t)} />
                <span className="tur-simge">{TUR_SIMGELERI[t]}</span>
                <b>{ILAN_TURLERI[t].ad}</b>
                <small>{ILAN_TURLERI[t].aciklama}</small>
              </label>
            ))}
          </div>
        </fieldset>

        {tur && (
          <>
            <fieldset>
              <legend>Kategori</legend>
              <div className="kategori-secici">
                {KATEGORI_LISTESI.map((k) => (
                  <label key={k} className={`kategori-cip ${kategori === k ? 'secili' : ''}`}>
                    <input type="radio" name="kategori" checked={kategori === k} onChange={() => setKategori(k)} />
                    <span>{KATEGORILER[k].simge}</span> {KATEGORILER[k].ad}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="alan">
              <span>{ariyor ? 'Ne arıyorsun?' : 'Başlık'}</span>
              <input
                value={baslik}
                onChange={(e) => setBaslik(e.target.value)}
                maxLength={SINIRLAR.baslik}
                placeholder={ariyor ? 'ör. İkinci el bilimsel hesap makinesi' : 'ör. Kalkülüs 1 ders kitabı (Thomas)'}
                required
              />
              <small className="sayac-metin">
                {baslik.length}/{SINIRLAR.baslik}
              </small>
            </label>

            <div className="alan-satiri">
              {tur !== 'takas' && (
                <label className="alan">
                  <span>{ariyor ? 'Bütçen (isteğe bağlı)' : 'Fiyat'}</span>
                  <div className="birimli">
                    <input
                      type="number"
                      min={0}
                      max={SINIRLAR.fiyat}
                      inputMode="numeric"
                      value={fiyat}
                      onChange={(e) => setFiyat(e.target.value)}
                      required={fiyatGerekli}
                      placeholder="0"
                    />
                    <span>₺</span>
                  </div>
                  {fiyatGerekli && <small className="ince">Bedavaya veriyorsan 0 yaz.</small>}
                </label>
              )}
              {!ariyor && (
                <label className="alan">
                  <span>Ürünün durumu</span>
                  <select value={kosul} onChange={(e) => setKosul(e.target.value as Kosul)}>
                    <option value="">Belirtme</option>
                    {(Object.keys(KOSULLAR) as Kosul[]).map((k) => (
                      <option key={k} value={k}>
                        {KOSULLAR[k]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {takasVar && (
              <label className="alan">
                <span>Karşılığında ne istersin? (isteğe bağlı)</span>
                <input
                  value={takasIstegi}
                  onChange={(e) => setTakasIstegi(e.target.value)}
                  maxLength={SINIRLAR.takasIstegi}
                  placeholder="ör. Veri yapıları kitabı ya da kulaklık"
                />
              </label>
            )}

            <label className="alan">
              <span>Açıklama</span>
              <textarea
                value={aciklama}
                onChange={(e) => setAciklama(e.target.value)}
                maxLength={SINIRLAR.aciklama}
                rows={5}
                placeholder={ariyor ? 'Hangi model, hangi durumda olsun, ne zaman lazım…' : 'Durumu, kusurları, nerede teslim edebileceğin…'}
              />
            </label>

            <fieldset>
              <legend>
                Fotoğraflar <span className="ince">({fotolar.length}/{SINIRLAR.fotoSayisi}{ariyor ? ', isteğe bağlı' : ''})</span>
              </legend>
              <div className="foto-izgara">
                {fotolar.map((f, i) => (
                  <div key={f.slice(-40) + i} className="foto-onizleme">
                    <img src={f.startsWith('data:') ? f : fotoAdresi(f)} alt={`Fotoğraf ${i + 1}`} />
                    {i === 0 && <span className="kapak">Kapak</span>}
                    <div className="foto-eylem">
                      {i > 0 && (
                        <button type="button" onClick={() => setFotolar((l) => [l[i], ...l.filter((_, j) => j !== i)])} title="Kapak yap" aria-label="Kapak yap">
                          ★
                        </button>
                      )}
                      <button type="button" onClick={() => setFotolar((l) => l.filter((_, j) => j !== i))} title="Kaldır" aria-label="Fotoğrafı kaldır">
                        <Simge ad="kapat" boyut={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {fotolar.length < SINIRLAR.fotoSayisi && (
                  <button type="button" className="foto-ekle" onClick={() => dosyaSecici.current?.click()} disabled={fotoIsleniyor}>
                    <Simge ad="foto" boyut={26} />
                    <span>{fotoIsleniyor ? 'Hazırlanıyor…' : 'Fotoğraf ekle'}</span>
                  </button>
                )}
              </div>
              <input ref={dosyaSecici} type="file" accept="image/*" multiple hidden onChange={(e) => fotoEkle(e.target.files)} />
            </fieldset>

            {hata && <p className="form-hata">{hata}</p>}
            <div className="form-alt">
              <button className="dugme dugme-ana dugme-genis" disabled={kaydediliyor || fotoIsleniyor}>
                {kaydediliyor ? 'Kaydediliyor…' : duzenleme ? 'Değişiklikleri kaydet' : 'İlanı yayınla'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

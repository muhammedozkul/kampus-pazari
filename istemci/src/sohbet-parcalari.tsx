// Genel sohbet ve özel mesajların ortak parçaları: yazma kutusu, gün ayracı, kaydırma.
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { SINIRLAR } from '../../ortak/sabitler.ts';
import { Simge } from './bilesenler.tsx';
import { gunEtiketi, tarih } from './yardimci.ts';

export function YazmaKutusu({
  gonder,
  pasif,
  ipucu = 'Bir mesaj yaz…',
}: {
  gonder: (metin: string) => Promise<boolean>;
  pasif?: string | false;
  ipucu?: string;
}) {
  const [metin, setMetin] = useState('');
  const [gidiyor, setGidiyor] = useState(false);
  const kutu = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const k = kutu.current;
    if (!k) return;
    k.style.height = 'auto';
    k.style.height = Math.min(k.scrollHeight, 140) + 'px';
  }, [metin]);

  if (pasif) return <div className="yazma-kutusu pasif">{pasif}</div>;

  const yolla = async () => {
    const m = metin.trim();
    if (!m || gidiyor) return;
    setGidiyor(true);
    const tamam = await gonder(m);
    setGidiyor(false);
    if (tamam) setMetin('');
    kutu.current?.focus();
  };

  return (
    <form
      className="yazma-kutusu"
      onSubmit={(e) => {
        e.preventDefault();
        yolla();
      }}
    >
      <textarea
        ref={kutu}
        rows={1}
        value={metin}
        maxLength={SINIRLAR.mesaj}
        placeholder={ipucu}
        onChange={(e) => setMetin(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            yolla();
          }
        }}
        aria-label="Mesaj"
      />
      <button className="gonder-dugme" disabled={!metin.trim() || gidiyor} aria-label="Gönder">
        <Simge ad="gonder" boyut={20} />
      </button>
    </form>
  );
}

/** Önceki mesajdan farklı bir günse ayraç gösterilir. */
export const yeniGunMu = (onceki: string | undefined, simdiki: string) =>
  !onceki || tarih(onceki).toDateString() !== tarih(simdiki).toDateString();

export function GunAyraci({ zaman }: { zaman: string }) {
  return (
    <div className="gun-ayraci">
      <span>{gunEtiketi(zaman)}</span>
    </div>
  );
}

/** Aynı kişinin 3 dakika içindeki ardışık mesajları tek grupta gösterilir. */
export const ayniGrupMu = (onceki: { kim: number; zaman: string } | undefined, simdiki: { kim: number; zaman: string }) =>
  !!onceki && onceki.kim === simdiki.kim && tarih(simdiki.zaman).getTime() - tarih(onceki.zaman).getTime() < 180_000;

/**
 * Mesaj listesinin kaydırmasını yönetir: kullanıcı en alttaysa yeni mesajda aşağı iner;
 * eski mesajlar yüklenince bulunduğu yer kaymaz.
 */
export function useSohbetKaydirma(ref: RefObject<HTMLDivElement | null>, sonId: number | undefined, ilkId: number | undefined) {
  const altta = useRef(true);
  const oncekiYukseklik = useRef(0);
  const oncekiIlk = useRef<number | undefined>(undefined);
  const [yeniVar, setYeniVar] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const kaydir = () => {
      altta.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      if (altta.current) setYeniVar(false);
    };
    el.addEventListener('scroll', kaydir, { passive: true });
    return () => el.removeEventListener('scroll', kaydir);
  }, [ref]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (oncekiIlk.current !== undefined && ilkId !== undefined && ilkId < oncekiIlk.current && oncekiYukseklik.current) {
      // Eski mesajlar başa eklendi: konumu koru.
      el.scrollTop += el.scrollHeight - oncekiYukseklik.current;
    } else if (altta.current) {
      el.scrollTop = el.scrollHeight;
    } else if (sonId !== undefined) {
      setYeniVar(true);
    }
    oncekiYukseklik.current = el.scrollHeight;
    oncekiIlk.current = ilkId;
  }, [ref, sonId, ilkId]);

  const enAlta = () => {
    const el = ref.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setYeniVar(false);
  };
  const enAltaZorla = () => {
    altta.current = true;
  };
  return { yeniVar, enAlta, enAltaZorla };
}

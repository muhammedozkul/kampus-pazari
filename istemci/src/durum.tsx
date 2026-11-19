// Uygulama geneli durum: oturum, anlık bağlantı, okunmamış sayısı, bildirimler.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, type Ben } from './api.ts';

export type CanliOlay =
  | { tur: 'genel_mesaj'; mesaj: import('./api.ts').GenelMesaj }
  | { tur: 'genel_mesaj_silindi'; id: number }
  | { tur: 'ozel_mesaj'; sohbetId: number; mesaj: import('./api.ts').OzelMesaj }
  | { tur: 'okundu'; sohbetId: number; kullaniciId: number; sonOkunanId: number }
  | { tur: 'cevrimici'; kullanicilar: number[] }
  | { tur: 'oturum_kapandi' };

type Bildirim = { id: number; metin: string; tur: 'bilgi' | 'hata' };

type Durum = {
  ben: Ben | null | undefined; // undefined = yükleniyor
  benYenile: () => Promise<void>;
  benAyarla: (b: Ben | null) => void;
  engellenenler: Set<number>;
  engelAyarla: (id: number, engelli: boolean) => void;
  okunmamis: number;
  okunmamisYenile: () => void;
  cevrimici: Set<number>;
  bagli: boolean;
  dinle: (fn: (o: CanliOlay) => void) => () => void;
  bildir: (metin: string, tur?: 'bilgi' | 'hata') => void;
  bildirimler: Bildirim[];
  aktifSohbet: React.MutableRefObject<number | null>;
};

const Baglam = createContext<Durum | null>(null);

export function DurumSaglayici({ children }: { children: ReactNode }) {
  const [ben, benAyarla] = useState<Ben | null | undefined>(undefined);
  const [engellenenler, setEngellenenler] = useState<Set<number>>(new Set());
  const [okunmamis, setOkunmamis] = useState(0);
  const [cevrimici, setCevrimici] = useState<Set<number>>(new Set());
  // İlk açılışta "bağlanıyor" yazısı yanıp sönmesin: yalnız bağlantı koptuğunda false olur.
  const [bagli, setBagli] = useState(true);
  const [bildirimler, setBildirimler] = useState<Bildirim[]>([]);
  const dinleyiciler = useRef(new Set<(o: CanliOlay) => void>());
  const aktifSohbet = useRef<number | null>(null);

  const benYenile = useCallback(async () => {
    try {
      const v = await api<{ ben: Ben | null; engellenenler?: number[] }>('/ben');
      benAyarla(v.ben);
      setEngellenenler(new Set(v.engellenenler ?? []));
    } catch {
      benAyarla(null);
    }
  }, []);

  const okunmamisYenile = useCallback(() => {
    api<{ toplam: number }>('/okunmamis')
      .then((v) => setOkunmamis(v.toplam))
      .catch(() => {});
  }, []);

  const bildir = useCallback((metin: string, tur: 'bilgi' | 'hata' = 'bilgi') => {
    const id = Date.now() + Math.random();
    setBildirimler((b) => [...b.slice(-2), { id, metin, tur }]);
    setTimeout(() => setBildirimler((b) => b.filter((x) => x.id !== id)), 3800);
  }, []);

  useEffect(() => {
    benYenile();
    const dustu = () => benAyarla(null);
    window.addEventListener('kp:oturum-dustu', dustu);
    return () => window.removeEventListener('kp:oturum-dustu', dustu);
  }, [benYenile]);

  // Giriş yapılınca WebSocket bağlantısı; koparsa artan aralıklarla yeniden dener.
  const benId = ben?.id;
  useEffect(() => {
    if (!benId) return;
    let ws: WebSocket | null = null;
    let kapandi = false;
    let deneme = 0;
    let zamanlayici: ReturnType<typeof setTimeout>;
    const baglan = () => {
      ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
      ws.onopen = () => {
        deneme = 0;
        setBagli(true);
        okunmamisYenile();
      };
      ws.onmessage = (e) => {
        const olay = JSON.parse(e.data) as CanliOlay;
        if (olay.tur === 'cevrimici') setCevrimici(new Set(olay.kullanicilar));
        if (olay.tur === 'oturum_kapandi') {
          kapandi = true;
          benAyarla(null);
        }
        if (olay.tur === 'ozel_mesaj' && olay.mesaj.gonderenId !== benId && aktifSohbet.current !== olay.sohbetId) {
          setOkunmamis((n) => n + 1);
        }
        if (olay.tur === 'okundu' && olay.kullaniciId === benId) okunmamisYenile();
        dinleyiciler.current.forEach((fn) => fn(olay));
      };
      ws.onclose = () => {
        setBagli(false);
        if (kapandi) return;
        deneme++;
        zamanlayici = setTimeout(baglan, Math.min(15000, 800 * 2 ** deneme));
      };
    };
    baglan();
    return () => {
      kapandi = true;
      clearTimeout(zamanlayici);
      ws?.close();
    };
  }, [benId, okunmamisYenile]);

  const dinle = useCallback((fn: (o: CanliOlay) => void) => {
    dinleyiciler.current.add(fn);
    return () => void dinleyiciler.current.delete(fn);
  }, []);

  const engelAyarla = useCallback((id: number, engelli: boolean) => {
    setEngellenenler((s) => {
      const yeni = new Set(s);
      if (engelli) yeni.add(id);
      else yeni.delete(id);
      return yeni;
    });
  }, []);

  return (
    <Baglam.Provider
      value={{
        ben,
        benYenile,
        benAyarla,
        engellenenler,
        engelAyarla,
        okunmamis,
        okunmamisYenile,
        cevrimici,
        bagli,
        dinle,
        bildir,
        bildirimler,
        aktifSohbet,
      }}
    >
      {children}
    </Baglam.Provider>
  );
}

export function useDurum() {
  const d = useContext(Baglam);
  if (!d) throw new Error('DurumSaglayici eksik');
  return d;
}

/** Anlık olayları bir bileşen içinde dinlemek için. */
export function useCanli(fn: (o: CanliOlay) => void) {
  const { dinle } = useDurum();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => dinle((o) => ref.current(o)), [dinle]);
}

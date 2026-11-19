import '@fontsource-variable/plus-jakarta-sans';
import './stil.css';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router';
import { Avatar, Simge, Yukleniyor } from './bilesenler.tsx';
import { DurumSaglayici, useDurum } from './durum.tsx';
import GenelSohbet from './sayfalar/GenelSohbet.tsx';
import Giris from './sayfalar/Giris.tsx';
import IlanDetay from './sayfalar/IlanDetay.tsx';
import IlanFormu from './sayfalar/IlanFormu.tsx';
import Ilanlar from './sayfalar/Ilanlar.tsx';
import Mesajlar from './sayfalar/Mesajlar.tsx';
import Profil from './sayfalar/Profil.tsx';
import TestPosta from './sayfalar/TestPosta.tsx';
import Yonetim from './sayfalar/Yonetim.tsx';

function Logo() {
  return (
    <Link to="/" className="logo">
      <img src="/simge.svg" alt="" width={32} height={32} />
      <span>
        Kampüs<b>Pazarı</b>
      </span>
    </Link>
  );
}

function Kabuk({ children }: { children: ReactNode }) {
  const { ben, okunmamis, bildirimler, bagli } = useDurum();
  const konum = useLocation();
  const sohbetIcinde = /^\/mesajlar\/\d+/.test(konum.pathname);
  if (!ben) return null;
  const rozet = okunmamis > 0 && <span className="sayac">{okunmamis > 99 ? '99+' : okunmamis}</span>;
  return (
    <div className={`kabuk ${sohbetIcinde ? 'sohbet-acik' : ''}`}>
      <header className="ust-cubuk">
        <div className="ust-ic">
          <Logo />
          <nav className="masaustu-nav">
            <NavLink to="/" end>
              İlanlar
            </NavLink>
            <NavLink to="/sohbet">Genel sohbet</NavLink>
            <NavLink to="/mesajlar">Mesajlar {rozet}</NavLink>
            {ben.rol === 'yonetici' && <NavLink to="/yonetim">Yönetim</NavLink>}
          </nav>
          <div className="ust-sag">
            {!bagli && <span className="baglanti-uyari" title="Anlık bağlantı yeniden kuruluyor">bağlanıyor…</span>}
            <Link to="/ilan-ver" className="dugme dugme-ana ilan-ver-dugme">
              <Simge ad="arti" boyut={18} /> İlan ver
            </Link>
            <Link to={`/profil/${ben.id}`} className="ust-avatar" aria-label="Profilim">
              <Avatar id={ben.id} ad={ben.ad ?? '?'} boyut={36} />
            </Link>
          </div>
        </div>
      </header>
      <main className="icerik">{children}</main>
      <nav className="alt-nav" aria-label="Ana menü">
        <NavLink to="/" end>
          <Simge ad="ev" />
          <span>İlanlar</span>
        </NavLink>
        <NavLink to="/sohbet">
          <Simge ad="sohbet" />
          <span>Sohbet</span>
        </NavLink>
        <NavLink to="/ilan-ver" className="alt-nav-arti" aria-label="İlan ver">
          <span className="arti-daire">
            <Simge ad="arti" boyut={24} />
          </span>
        </NavLink>
        <NavLink to="/mesajlar">
          <span className="sayac-sarici">
            <Simge ad="mesaj" />
            {rozet}
          </span>
          <span>Mesajlar</span>
        </NavLink>
        <NavLink to={`/profil/${ben.id}`}>
          <Simge ad="kisi" />
          <span>Profil</span>
        </NavLink>
      </nav>
      <div className="bildirimler" aria-live="polite">
        {bildirimler.map((b) => (
          <div key={b.id} className={`bildirim bildirim-${b.tur}`}>
            {b.metin}
          </div>
        ))}
      </div>
    </div>
  );
}

function Korumali({ children, yonetici }: { children: ReactNode; yonetici?: boolean }) {
  const { ben } = useDurum();
  const konum = useLocation();
  if (ben === undefined) return <Yukleniyor />;
  if (!ben || !ben.ad) return <Navigate to="/giris" replace state={{ geri: konum.pathname + konum.search }} />;
  if (yonetici && ben.rol !== 'yonetici') return <Navigate to="/" replace />;
  return <Kabuk>{children}</Kabuk>;
}

function Bulunamadi() {
  const git = useNavigate();
  return (
    <div className="bos-durum">
      <div className="bos-simge">🧭</div>
      <h3>Bu sayfa yok</h3>
      <button className="dugme" onClick={() => git('/')}>
        İlanlara dön
      </button>
    </div>
  );
}

function Uygulama() {
  return (
    <Routes>
      <Route path="/giris" element={<Giris />} />
      <Route path="/posta" element={<TestPosta />} />
      <Route path="/" element={<Korumali><Ilanlar /></Korumali>} />
      <Route path="/ilan/:id" element={<Korumali><IlanDetay /></Korumali>} />
      <Route path="/ilan-ver" element={<Korumali><IlanFormu /></Korumali>} />
      <Route path="/ilan/:id/duzenle" element={<Korumali><IlanFormu /></Korumali>} />
      <Route path="/sohbet" element={<Korumali><GenelSohbet /></Korumali>} />
      <Route path="/mesajlar" element={<Korumali><Mesajlar /></Korumali>} />
      <Route path="/mesajlar/:id" element={<Korumali><Mesajlar /></Korumali>} />
      <Route path="/profil/:id" element={<Korumali><Profil /></Korumali>} />
      <Route path="/yonetim" element={<Korumali yonetici><Yonetim /></Korumali>} />
      <Route path="*" element={<Korumali><Bulunamadi /></Korumali>} />
    </Routes>
  );
}

createRoot(document.getElementById('kok')!).render(
  <StrictMode>
    <BrowserRouter>
      <DurumSaglayici>
        <Uygulama />
      </DurumSaglayici>
    </BrowserRouter>
  </StrictMode>,
);

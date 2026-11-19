// Fotoğrafsız ilanlar için kategoriye özel düz (flat) çizimler. Renkler CSS değişkenlerinden gelir,
// böylece açık ve koyu temada kendiliğinden uyum sağlar.
import type { Kategori } from '../../ortak/sabitler.ts';

const ORTAK = { strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function Kitap() {
  return (
    <g {...ORTAK}>
      <ellipse cx="100" cy="128" rx="58" ry="7" fill="var(--c-golge)" />
      <rect x="52" y="104" width="96" height="20" rx="4" fill="var(--c-1)" />
      <rect x="52" y="104" width="10" height="20" rx="2" fill="var(--c-koyu)" opacity=".25" />
      <rect x="60" y="84" width="84" height="20" rx="4" fill="var(--c-2)" />
      <rect x="128" y="84" width="8" height="20" rx="2" fill="#fff" opacity=".55" />
      <rect x="48" y="64" width="90" height="20" rx="4" fill="var(--c-3)" />
      <path d="M58 74h40" stroke="#fff" strokeWidth="3" opacity=".6" />
      <path d="M118 40c8-8 22-8 30 0v24c-8-6-22-6-30 0z" fill="#fff" stroke="var(--c-koyu)" strokeWidth="2.5" />
      <path d="M118 40c-8-8-22-8-30 0v24c8-6 22-6 30 0z" fill="#fff" stroke="var(--c-koyu)" strokeWidth="2.5" />
      <path d="M96 46h14M96 53h14M126 46h14M126 53h10" stroke="var(--c-1)" strokeWidth="2.5" />
    </g>
  );
}

function Elektronik() {
  return (
    <g {...ORTAK}>
      <ellipse cx="100" cy="130" rx="62" ry="7" fill="var(--c-golge)" />
      <rect x="50" y="46" width="100" height="66" rx="8" fill="var(--c-koyu)" />
      <rect x="57" y="53" width="86" height="52" rx="4" fill="var(--c-1)" />
      <path d="M57 90l22-18 16 12 20-20 28 26v15H57z" fill="var(--c-2)" opacity=".9" />
      <circle cx="122" cy="66" r="6" fill="#fff" opacity=".85" />
      <path d="M38 112h124l-8 12H46z" fill="var(--c-3)" />
      <rect x="88" y="114" width="24" height="4" rx="2" fill="var(--c-koyu)" opacity=".3" />
      <path d="M150 54c10 0 18 8 18 18" stroke="var(--c-2)" strokeWidth="4" fill="none" opacity=".7" />
      <path d="M150 42c17 0 30 13 30 30" stroke="var(--c-2)" strokeWidth="4" fill="none" opacity=".4" />
    </g>
  );
}

function Ev() {
  return (
    <g {...ORTAK}>
      <ellipse cx="100" cy="130" rx="60" ry="7" fill="var(--c-golge)" />
      <path d="M58 44h34l10 26H48z" fill="var(--c-1)" />
      <path d="M74 70v48" stroke="var(--c-koyu)" strokeWidth="5" />
      <rect x="60" y="116" width="30" height="8" rx="4" fill="var(--c-koyu)" />
      <path d="M50 70c8 18 40 18 50 0" fill="var(--c-3)" opacity=".35" />
      <rect x="112" y="92" width="38" height="32" rx="6" fill="var(--c-2)" />
      <path d="M131 92c0-18 -14-26 -20-32 10 2 18 8 20 18 2-12 10-22 22-26-8 8-16 18-22 40z" fill="var(--c-3)" />
      <rect x="112" y="92" width="38" height="8" rx="4" fill="#fff" opacity=".35" />
    </g>
  );
}

function Giyim() {
  return (
    <g {...ORTAK}>
      <ellipse cx="100" cy="132" rx="56" ry="7" fill="var(--c-golge)" />
      <path d="M100 26a8 8 0 1 1 8 8c-4 0-8 3-8 7v4" stroke="var(--c-koyu)" strokeWidth="4" fill="none" />
      <path d="M100 45 56 66" stroke="var(--c-koyu)" strokeWidth="4" />
      <path d="M100 45l44 21" stroke="var(--c-koyu)" strokeWidth="4" />
      <path d="M78 58l-30 16 10 22 14-6v38h56V90l14 6 10-22-30-16c-4 10-12 14-22 14s-18-4-22-14z" fill="var(--c-1)" />
      <path d="M78 58c4 10 12 14 22 14s18-4 22-14" stroke="var(--c-koyu)" strokeWidth="3" fill="none" opacity=".35" />
      <rect x="86" y="96" width="28" height="18" rx="5" fill="var(--c-2)" />
      <path d="M48 74l10 22" stroke="#fff" strokeWidth="3" opacity=".4" />
    </g>
  );
}

function Spor() {
  return (
    <g {...ORTAK}>
      <ellipse cx="100" cy="132" rx="62" ry="7" fill="var(--c-golge)" />
      <circle cx="80" cy="84" r="38" fill="var(--c-1)" />
      <path d="M42 84h76M80 46v76M53 57c16 12 16 42 0 54M107 57c-16 12-16 42 0 54" stroke="var(--c-koyu)" strokeWidth="3" fill="none" opacity=".55" />
      <circle cx="68" cy="68" r="8" fill="#fff" opacity=".35" />
      <rect x="116" y="108" width="48" height="8" rx="4" fill="var(--c-koyu)" />
      <rect x="110" y="98" width="12" height="28" rx="4" fill="var(--c-2)" />
      <rect x="158" y="98" width="12" height="28" rx="4" fill="var(--c-2)" />
    </g>
  );
}

function OzelDers() {
  return (
    <g {...ORTAK}>
      <ellipse cx="100" cy="132" rx="62" ry="7" fill="var(--c-golge)" />
      <rect x="40" y="34" width="120" height="78" rx="8" fill="var(--c-koyu)" />
      <rect x="46" y="40" width="108" height="66" rx="5" fill="var(--c-1)" />
      <path d="M58 62c4-8 12-8 14 0s10 8 14 0" stroke="#fff" strokeWidth="3" fill="none" />
      <path d="M96 58h12M102 52v12" stroke="#fff" strokeWidth="3" />
      <path d="M116 60c0-6 10-6 10 0 0 4-10 8-10 12h10" stroke="#fff" strokeWidth="3" fill="none" />
      <path d="M58 86h40M58 95h26" stroke="#fff" strokeWidth="3" opacity=".6" />
      <path d="M70 112l-8 18M130 112l8 18" stroke="var(--c-koyu)" strokeWidth="5" />
      <path d="M136 82l22-22 8 8-22 22-11 3z" fill="var(--c-2)" />
      <path d="M158 60l8 8" stroke="#fff" strokeWidth="3" />
    </g>
  );
}

function EvArkadasi() {
  return (
    <g {...ORTAK}>
      <ellipse cx="100" cy="132" rx="62" ry="7" fill="var(--c-golge)" />
      <path d="M44 74 100 32l56 42" fill="var(--c-2)" />
      <path d="M54 70v56h92V70l-46-34z" fill="var(--c-1)" />
      <path d="M40 76 100 30l60 46" stroke="var(--c-koyu)" strokeWidth="7" fill="none" />
      <rect x="66" y="80" width="22" height="20" rx="3" fill="#fff" />
      <rect x="112" y="80" width="22" height="20" rx="3" fill="#fff" />
      <path d="M77 80v20M66 90h22M123 80v20M112 90h22" stroke="var(--c-1)" strokeWidth="2.5" />
      <rect x="90" y="104" width="20" height="22" rx="3" fill="var(--c-koyu)" />
      <path d="M100 18c-4-6-14-3-12 4 1 5 12 11 12 11s11-6 12-11c2-7-8-10-12-4z" fill="var(--c-3)" />
    </g>
  );
}

function Diger() {
  return (
    <g {...ORTAK}>
      <ellipse cx="100" cy="132" rx="56" ry="7" fill="var(--c-golge)" />
      <path d="M56 64 100 48l44 16v50l-44 16-44-16z" fill="var(--c-1)" />
      <path d="M56 64l44 16 44-16" fill="none" stroke="var(--c-koyu)" strokeWidth="3" opacity=".3" />
      <path d="M100 80v50" stroke="var(--c-koyu)" strokeWidth="3" opacity=".3" />
      <path d="M78 56l44 16v12" stroke="var(--c-2)" strokeWidth="8" fill="none" />
      <path d="M150 34l3 8 8 3-8 3-3 8-3-8-8-3 8-3zM46 36l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="var(--c-3)" />
    </g>
  );
}

const CIZIMLER: Record<Kategori, () => React.JSX.Element> = {
  kitap: Kitap,
  elektronik: Elektronik,
  ev: Ev,
  giyim: Giyim,
  spor: Spor,
  ozel_ders: OzelDers,
  ev_arkadasi: EvArkadasi,
  diger: Diger,
};

export function KategoriCizimi({ kategori }: { kategori: Kategori }) {
  const Cizim = CIZIMLER[kategori] ?? Diger;
  return (
    <svg className="kategori-cizim" viewBox="0 0 200 150" role="img" aria-hidden="true">
      <circle cx="100" cy="80" r="62" fill="var(--c-zemin-daire)" />
      <circle cx="36" cy="40" r="4" fill="var(--c-2)" opacity=".5" />
      <circle cx="168" cy="110" r="5" fill="var(--c-3)" opacity=".5" />
      <circle cx="170" cy="30" r="3" fill="var(--c-1)" opacity=".5" />
      <Cizim />
    </svg>
  );
}

/** Kategori çipleri için küçük, tek renkli simgeler. */
const KUCUK: Record<Kategori, React.ReactNode> = {
  kitap: <path d="M4 5a2 2 0 0 1 2-2h12v15H6a2 2 0 0 0-2 2zM4 20a2 2 0 0 0 2 1h12v-3" />,
  elektronik: (
    <>
      <rect x="4" y="5" width="16" height="11" rx="1.5" />
      <path d="M2 19h20" />
    </>
  ),
  ev: <path d="M8 3h8l2 6H6zM12 9v10M8 21h8" />,
  giyim: <path d="M8 4 3 7l2 4 2-1v10h10V10l2 1 2-4-5-3c-1 2-2 3-4 3S9 6 8 4z" />,
  spor: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3v18M6 6c3 3 3 9 0 12M18 6c-3 3-3 9 0 12" />
    </>
  ),
  ozel_ders: <path d="M3 9l9-5 9 5-9 5zM7 11v5c3 2 7 2 10 0v-5" />,
  ev_arkadasi: <path d="M3 11 12 4l9 7M5 10v10h14V10M10 20v-6h4v6" />,
  diger: <path d="M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8" />,
};

export function KategoriSimgesi({ kategori, boyut = 16 }: { kategori: Kategori; boyut?: number }) {
  return (
    <svg width={boyut} height={boyut} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {KUCUK[kategori]}
    </svg>
  );
}

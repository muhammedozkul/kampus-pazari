// Anlık olaylar (WebSocket). Mesajlar REST ile gönderilir; sunucu kaydettikten sonra buradan dağıtır.
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import { cerezOku, OTURUM_CEREZI, oturumBul } from './kimlik.ts';
import type { Db } from './veritabani.ts';

export type CanliOlay =
  | { tur: 'genel_mesaj'; mesaj: unknown }
  | { tur: 'genel_mesaj_silindi'; id: number }
  | { tur: 'ozel_mesaj'; sohbetId: number; mesaj: unknown }
  | { tur: 'okundu'; sohbetId: number; kullaniciId: number; sonOkunanId: number }
  | { tur: 'cevrimici'; kullanicilar: number[] }
  | { tur: 'oturum_kapandi' };

export class Canli {
  private wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  private baglantilar = new Map<number, Set<WebSocket>>();
  private db: Db;
  private izinliKokenler: (koken: string | undefined, host: string | undefined) => boolean;

  constructor(db: Db, izinliKokenler: (koken: string | undefined, host: string | undefined) => boolean) {
    this.db = db;
    this.izinliKokenler = izinliKokenler;
    // Ölü bağlantıları temizle.
    setInterval(() => {
      for (const istemci of this.wss.clients) {
        const i = istemci as WebSocket & { canli?: boolean };
        if (i.canli === false) {
          i.terminate();
          continue;
        }
        i.canli = false;
        i.ping();
      }
    }, 30_000).unref();
  }

  bagla(sunucu: Server) {
    sunucu.on('upgrade', (istek: IncomingMessage, soket: Duplex, bas: Buffer) => {
      if (!istek.url?.startsWith('/ws')) return; // Vite'nin kendi bağlantısına dokunma.
      if (!this.izinliKokenler(istek.headers.origin, istek.headers.host)) {
        soket.destroy();
        return;
      }
      const oturum = oturumBul(this.db, cerezOku(istek.headers.cookie, OTURUM_CEREZI));
      if (!oturum) {
        soket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        soket.destroy();
        return;
      }
      this.wss.handleUpgrade(istek, soket, bas, (ws) => this.katil(oturum.id, ws));
    });
  }

  private katil(kullaniciId: number, ws: WebSocket) {
    const k = ws as WebSocket & { canli?: boolean };
    k.canli = true;
    ws.on('pong', () => (k.canli = true));
    let kume = this.baglantilar.get(kullaniciId);
    const ilkBaglanti = !kume;
    if (!kume) this.baglantilar.set(kullaniciId, (kume = new Set()));
    kume.add(ws);
    ws.on('message', () => {}); // İstemciden komut beklenmiyor.
    ws.on('close', () => {
      kume.delete(ws);
      if (kume.size === 0) {
        this.baglantilar.delete(kullaniciId);
        this.db.prepare("UPDATE kullanicilar SET son_gorulme = datetime('now') WHERE id = ?").run(kullaniciId);
        this.cevrimiciYayinla();
      }
    });
    if (ilkBaglanti) this.cevrimiciYayinla();
    else this.gonder(ws, { tur: 'cevrimici', kullanicilar: this.cevrimiciler() });
  }

  cevrimiciler(): number[] {
    return [...this.baglantilar.keys()];
  }

  private cevrimiciYayinla() {
    this.herkese({ tur: 'cevrimici', kullanicilar: this.cevrimiciler() });
  }

  private gonder(ws: WebSocket, olay: CanliOlay) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(olay));
  }

  herkese(olay: CanliOlay) {
    for (const kume of this.baglantilar.values()) for (const ws of kume) this.gonder(ws, olay);
  }

  kullaniciya(kullaniciId: number, olay: CanliOlay) {
    for (const ws of this.baglantilar.get(kullaniciId) ?? []) this.gonder(ws, olay);
  }

  /** Yasaklanan kullanıcının açık bağlantılarını kapatır. */
  kopar(kullaniciId: number) {
    for (const ws of this.baglantilar.get(kullaniciId) ?? []) {
      this.gonder(ws, { tur: 'oturum_kapandi' });
      ws.close();
    }
  }
}

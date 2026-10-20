import { EphemeralMessage } from '../../types';

export type MessageStoreListener = (messages: EphemeralMessage[]) => void;

export class EphemeralMessageStore {
  private messages: Map<string, EphemeralMessage> = new Map();
  private listeners: Set<MessageStoreListener> = new Set();
  private timerInterval: any = null;

  constructor() {
    this.startTtlTicker();
  }

  private startTtlTicker(): void {
    if (typeof window === 'undefined') return;

    this.timerInterval = setInterval(() => {
      this.tick();
    }, 1000);
  }

  private tick(): void {
    const now = Date.now();
    let hasChanges = false;

    for (const [id, msg] of this.messages.entries()) {
      if (msg.expiresAt && msg.status !== 'burned') {
        const diffMs = msg.expiresAt - now;
        const remaining = Math.max(0, Math.ceil(diffMs / 1000));

        if (remaining <= 0) {
          hasChanges = true;
          // Vaporize payload from RAM immediately
          msg.status = 'burned';
          msg.text = undefined;
          msg.imageBase64 = undefined;
          msg.imageMimeType = undefined;
          msg.remainingSeconds = 0;
          this.messages.set(id, { ...msg });
        } else if (msg.remainingSeconds !== remaining) {
          hasChanges = true;
          msg.remainingSeconds = remaining;
          this.messages.set(id, { ...msg });
        }
      } else if (msg.status === 'burned' && msg.expiresAt && now - msg.expiresAt > 4000) {
        // Complete removal from RAM after 4-second fade out
        hasChanges = true;
        this.messages.delete(id);
      }
    }

    if (hasChanges) {
      this.notify();
    }
  }

  public addMessage(msg: EphemeralMessage): void {
    this.messages.set(msg.id, { ...msg });
    this.notify();
  }

  public updateMessageStatus(messageId: string, status: EphemeralMessage['status']): void {
    const msg = this.messages.get(messageId);
    if (msg) {
      msg.status = status;
      this.messages.set(messageId, { ...msg });
      this.notify();
    }
  }

  public burnSingleMessage(messageId: string): void {
    const msg = this.messages.get(messageId);
    if (msg) {
      // Zero memory immediately
      msg.status = 'burned';
      msg.text = undefined;
      msg.imageBase64 = undefined;
      msg.imageMimeType = undefined;
      msg.remainingSeconds = 0;
      msg.expiresAt = Date.now();
      this.messages.set(messageId, { ...msg });
      this.notify();
    }
  }

  public getMessagesForPeer(peerId: string): EphemeralMessage[] {
    return Array.from(this.messages.values())
      .filter((m) => m.peerId === peerId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  public getAllMessages(): EphemeralMessage[] {
    return Array.from(this.messages.values()).sort((a, b) => a.timestamp - b.timestamp);
  }

  public getMessageCount(): number {
    return this.messages.size;
  }

  public markMessagesRead(peerId: string): void {
    let hasChanges = false;
    for (const [id, msg] of this.messages.entries()) {
      if (msg.peerId === peerId && !msg.isMine && msg.status === 'delivered') {
        msg.status = 'read';
        this.messages.set(id, { ...msg });
        hasChanges = true;
      }
    }
    if (hasChanges) {
      this.notify();
    }
  }

  public panicBurnAll(): void {
    // Memory shredding
    for (const msg of this.messages.values()) {
      msg.text = undefined;
      msg.imageBase64 = undefined;
      msg.imageMimeType = undefined;
    }
    this.messages.clear();
    this.notify();
  }

  public subscribe(listener: MessageStoreListener): () => void {
    this.listeners.add(listener);
    listener(this.getAllMessages());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const current = this.getAllMessages();
    for (const listener of this.listeners) {
      try {
        listener(current);
      } catch (e) {
        console.error('[EphemeralMessageStore] Listener notification error:', e);
      }
    }
  }

  public destroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.panicBurnAll();
    this.listeners.clear();
  }
}

import {
  generateEphemeralKeyPair,
  importPeerPublicKey,
  deriveSessionKey,
  computeSafetyFingerprint,
  KeyPairBundle,
} from '../../crypto/e2ee';
import { SecurityFingerprint } from '../../types';

export interface PeerSessionResult {
  sessionKey: CryptoKey;
  fingerprint: SecurityFingerprint;
  isKeyChanged: boolean;
}

export class KeyVault {
  private localKeyBundle: KeyPairBundle | null = null;
  private sessionKeys: Map<string, CryptoKey> = new Map();
  private peerFingerprints: Map<string, SecurityFingerprint> = new Map();
  private knownPeerKeyHexes: Map<string, string> = new Map();
  private verifiedFingerprints: Set<string> = new Set();

  public async initialize(): Promise<KeyPairBundle> {
    this.localKeyBundle = await generateEphemeralKeyPair();
    return this.localKeyBundle;
  }

  public getLocalKeyBundle(): KeyPairBundle | null {
    return this.localKeyBundle;
  }

  public getLocalPublicKeyHex(): string {
    return this.localKeyBundle?.publicKeyHex || '';
  }

  public getLocalFingerprintSnippet(): string {
    if (!this.localKeyBundle) return '0x0000...0000';
    const hex = this.localKeyBundle.publicKeyHex;
    return `0x${hex.substring(0, 4)}...${hex.substring(hex.length - 4)}`;
  }

  public async establishPeerSession(
    peerId: string,
    peerJwk: JsonWebKey,
    peerPublicKeyHex: string
  ): Promise<PeerSessionResult> {
    if (!this.localKeyBundle) {
      throw new Error('KeyVault not initialized with local ephemeral keypair');
    }

    if (!peerId || !peerPublicKeyHex) {
      throw new Error('establishPeerSession requires valid peerId and peerPublicKeyHex');
    }

    // Check for identity key alteration (MITM or key substitution detection)
    const existingHex = this.knownPeerKeyHexes.get(peerId);
    const isKeyChanged = !!(existingHex && existingHex !== peerPublicKeyHex);

    // 1. Import peer's public ECDH key (with built-in curve validation)
    const importedPeerKey = await importPeerPublicKey(peerJwk);

    // 2. Derive symmetric AES-256-GCM session key via HKDF-SHA256
    const sessionKey = await deriveSessionKey(
      this.localKeyBundle.keyPair.privateKey,
      importedPeerKey
    );
    this.sessionKeys.set(peerId, sessionKey);
    this.knownPeerKeyHexes.set(peerId, peerPublicKeyHex);

    // 3. Compute deterministic Signal-style safety fingerprint
    const rawFp = await computeSafetyFingerprint(
      this.localKeyBundle.publicKeyHex,
      peerPublicKeyHex
    );

    // If key changed, verification is revoked
    if (isKeyChanged) {
      this.verifiedFingerprints.delete(rawFp.hexFingerprint);
    }

    const isVerified = !isKeyChanged && this.verifiedFingerprints.has(rawFp.hexFingerprint);
    const fingerprint: SecurityFingerprint = {
      ...rawFp,
      verified: isVerified,
    };

    this.peerFingerprints.set(peerId, fingerprint);
    return { sessionKey, fingerprint, isKeyChanged };
  }

  public getSessionKey(peerId: string): CryptoKey | undefined {
    return this.sessionKeys.get(peerId);
  }

  public getPeerFingerprint(peerId: string): SecurityFingerprint | undefined {
    return this.peerFingerprints.get(peerId);
  }

  public setFingerprintVerified(peerId: string, verified: boolean): void {
    const fp = this.peerFingerprints.get(peerId);
    if (fp) {
      fp.verified = verified;
      if (verified) {
        this.verifiedFingerprints.add(fp.hexFingerprint);
      } else {
        this.verifiedFingerprints.delete(fp.hexFingerprint);
      }
    }
  }

  public async rotateLocalKeys(): Promise<KeyPairBundle> {
    // Shred existing session keys
    this.sessionKeys.clear();
    this.peerFingerprints.clear();

    // Generate fresh ephemeral keypair
    this.localKeyBundle = await generateEphemeralKeyPair();
    return this.localKeyBundle;
  }

  public panicPurge(): void {
    // Immediate memory wipe: zero references and garbage-collect keys from RAM
    this.localKeyBundle = null;
    this.sessionKeys.clear();
    this.peerFingerprints.clear();
    this.knownPeerKeyHexes.clear();
    this.verifiedFingerprints.clear();
  }
}

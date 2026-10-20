import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Send,
  Image as ImageIcon,
  Flame,
  Clock,
  X,
  Lock,
  Eye,
  Trash2,
  Check,
  CheckCheck,
  AlertTriangle,
} from 'lucide-react';
import { EphemeralMessage, PeerProfile } from '../types';
import { isSafeImageDataUri, isSafeImageMimeType } from '../crypto/e2ee';

interface ChatConversationScreenProps {
  peer: PeerProfile;
  messages: EphemeralMessage[];
  onBack: () => void;
  onSendMessage: (text?: string, imageBase64?: string, imageMimeType?: string, ttlSeconds?: number) => void;
  onOpenPeerSecurity: (peer: PeerProfile) => void;
  onBurnMessage: (messageId: string) => void;
}

export const ChatConversationScreen: React.FC<ChatConversationScreenProps> = ({
  peer,
  messages,
  onBack,
  onSendMessage,
  onOpenPeerSecurity,
  onBurnMessage,
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const [ttlSeconds, setTtlSeconds] = useState<number>(0); // 0 = off, 10 = 10s, 30 = 30s, 60 = 1m
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [showTtlPicker, setShowTtlPicker] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom on new message
  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed && !selectedImage) return;

    if (trimmed.length > 5000) {
      setUiError('Message exceeds maximum allowable length (5,000 characters).');
      return;
    }

    if (selectedImage && !isSafeImageDataUri(selectedImage.base64)) {
      setUiError('Selected image format is invalid or unsupported.');
      setSelectedImage(null);
      return;
    }

    onSendMessage(
      trimmed || undefined,
      selectedImage?.base64,
      selectedImage?.mimeType,
      ttlSeconds > 0 ? ttlSeconds : undefined
    );

    setInputText('');
    setSelectedImage(null);
    setUiError(null);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input for future selections
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Enforce strict raster image MIME type check (OWASP Stored XSS defense)
    if (!isSafeImageMimeType(file.type)) {
      setUiError('Unsupported image format. Only JPEG, PNG, WebP, and GIF raster images are permitted.');
      return;
    }

    // Limit size to 5MB for fast in-RAM WebCrypto encryption
    if (file.size > 5 * 1024 * 1024) {
      setUiError('Please select an image smaller than 5MB for instantaneous P2P encryption.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (isSafeImageDataUri(result)) {
        setSelectedImage({
          base64: result,
          mimeType: file.type.toLowerCase(),
        });
        setUiError(null);
      } else {
        setUiError('Invalid image data stream detected.');
      }
    };
    reader.onerror = () => {
      setUiError('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const ttlOptions = [
    { label: 'Off', seconds: 0 },
    { label: '10s', seconds: 10 },
    { label: '30s', seconds: 30 },
    { label: '1m', seconds: 60 },
    { label: '5m', seconds: 300 },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FEF7FF] overflow-hidden select-none">
      {/* Top Header */}
      <header className="flex items-center justify-between px-3 h-16 bg-[#FEF7FF] border-b border-[#CAC4D0]/30 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center rounded-full text-[#1D1B20] hover:bg-[#1D1B20]/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div
            onClick={() => onOpenPeerSecurity(peer)}
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-85 transition-opacity"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-xs"
              style={{
                backgroundColor: peer.avatarColor || '#D0BCFF',
                color: '#21005D',
              }}
            >
              {peer.name.charAt(0).toUpperCase()}
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-semibold text-[#1D1B20] leading-none">
                  {peer.name}
                </h2>
                {peer.isVerified === false && peer.status === 'online' ? (
                  <span title="Identity key unverified or rotated">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                  </span>
                ) : (
                  <ShieldCheck className="w-4 h-4 text-[#6750A4]" />
                )}
              </div>
              <span className="text-[11px] font-mono text-[#49454F] mt-0.5">
                {peer.fingerprint || 'ECDH AES-256'}
              </span>
            </div>
          </div>
        </div>

        {/* Security / Timer Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowTtlPicker(!showTtlPicker)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-mono font-medium transition-colors ${
              ttlSeconds > 0
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-[#F3EDF7] text-[#49454F] hover:bg-[#E8DEF8]'
            }`}
            title="Configure self-destruct timer"
          >
            <Flame className={`w-3.5 h-3.5 ${ttlSeconds > 0 ? 'text-amber-600' : 'text-[#49454F]'}`} />
            <span>{ttlSeconds > 0 ? `${ttlSeconds}s TTL` : 'No TTL'}</span>
          </button>
        </div>
      </header>

      {/* Ephemeral Timer Dropdown */}
      {showTtlPicker && (
        <div className="bg-[#F3EDF7] border-b border-[#CAC4D0]/30 px-4 py-2.5 flex items-center justify-between text-xs animate-in slide-in-from-top-2">
          <span className="text-[#49454F] font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-[#6750A4]" /> Self-destruct messages:
          </span>
          <div className="flex items-center gap-1.5">
            {ttlOptions.map((opt) => (
              <button
                key={opt.seconds}
                onClick={() => {
                  setTtlSeconds(opt.seconds);
                  setShowTtlPicker(false);
                }}
                className={`px-2 py-1 rounded-md text-xs font-mono transition-colors ${
                  ttlSeconds === opt.seconds
                    ? 'bg-[#6750A4] text-white font-bold'
                    : 'bg-[#FEF7FF] text-[#1D1B20] hover:bg-[#E8DEF8]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dismissible Error / Warning Banner */}
      {uiError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-between text-xs text-red-800 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{uiError}</span>
          </div>
          <button onClick={() => setUiError(null)} className="p-1 hover:bg-red-100 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Security notice pill */}
      <div className="flex justify-center my-2">
        <div className="inline-flex items-center gap-1.5 bg-[#F3EDF7] px-3 py-1 rounded-full text-[11px] text-[#49454F] border border-[#CAC4D0]/30">
          <Lock className="w-3 h-3 text-[#6750A4]" />
          <span>RAM-only chat • Messages vanish on app reload</span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-[#49454F] py-8">
            <div className="w-12 h-12 rounded-full bg-[#E8DEF8] flex items-center justify-center mb-3">
              <ShieldCheck className="w-6 h-6 text-[#21005D]" />
            </div>
            <p className="text-sm font-medium text-[#1D1B20]">Encrypted Session Established</p>
            <p className="text-xs max-w-xs mt-1 text-[#49454F]">
              Direct peer-to-peer link open. Everything you send is encrypted with AES-256-GCM.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.isMine;
            const isBurned = msg.status === 'burned';

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} group`}
              >
                {/* Bubble Container */}
                <div
                  className={`max-w-[82%] sm:max-w-[70%] p-3 rounded-2xl relative shadow-xs transition-all ${
                    isBurned
                      ? 'bg-gray-100 text-gray-400 italic line-through'
                      : isMine
                      ? 'bg-[#E8DEF8] text-[#21005D] rounded-br-xs'
                      : 'bg-[#F3EDF7] text-[#1D1B20] rounded-bl-xs'
                  }`}
                >
                  {/* Image attachment - strictly protected with isSafeImageDataUri */}
                  {msg.imageBase64 && !isBurned && isSafeImageDataUri(msg.imageBase64) && (
                    <div className="mb-2 relative rounded-xl overflow-hidden bg-black/10">
                      <img
                        src={msg.imageBase64}
                        alt="Encrypted asset"
                        onClick={() => setFullscreenImage(msg.imageBase64 || null)}
                        className="max-h-60 w-auto rounded-xl object-cover cursor-pointer hover:opacity-95 transition-opacity"
                        loading="lazy"
                      />
                      <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-xs">
                        <Lock className="w-2.5 h-2.5" />
                        <span>Decrypted RAM</span>
                      </div>
                    </div>
                  )}

                  {/* Text content */}
                  {msg.text && (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words select-text">
                      {msg.text}
                    </p>
                  )}

                  {/* Metadata Row: Time, TTL countdown, Cipher info */}
                  <div className="flex items-center justify-between gap-3 mt-1.5 pt-1 border-t border-[#CAC4D0]/30 text-[10px]">
                    <div className="flex items-center gap-1.5 opacity-70">
                      <span>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {msg.cipherSummary && (
                        <span className="font-mono text-[9px] bg-black/5 px-1 rounded">
                          {msg.cipherSummary.algorithm}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Self-destruct countdown timer */}
                      {msg.remainingSeconds !== undefined && msg.remainingSeconds > 0 && (
                        <span className="flex items-center gap-0.5 text-amber-700 font-mono font-bold animate-pulse">
                          <Flame className="w-3 h-3" />
                          {msg.remainingSeconds}s
                        </span>
                      )}

                      {/* Delivery Status */}
                      {isMine && (
                        <span title={msg.status}>
                          {msg.status === 'delivered' || msg.status === 'read' ? (
                            <CheckCheck className="w-3.5 h-3.5 text-[#6750A4]" />
                          ) : (
                            <Check className="w-3.5 h-3.5 opacity-70" />
                          )}
                        </span>
                      )}

                      {/* Manual Burn Button */}
                      <button
                        onClick={() => onBurnMessage(msg.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-600 transition-opacity"
                        title="Burn this message immediately from RAM"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Selected Image Preview before send */}
      {selectedImage && (
        <div className="px-4 py-2 bg-[#F3EDF7] border-t border-[#CAC4D0]/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src={selectedImage.base64}
              alt="Preview"
              className="w-12 h-12 object-cover rounded-lg border border-[#CAC4D0]/60 shadow-xs"
            />
            <div className="text-xs">
              <p className="font-medium text-[#1D1B20]">Image ready to encrypt</p>
              <p className="text-[10px] text-[#49454F] font-mono">Will be sent via P2P AES-256</p>
            </div>
          </div>
          <button
            onClick={() => setSelectedImage(null)}
            className="p-1 rounded-full hover:bg-black/10 text-[#49454F]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bottom Message Input Bar */}
      <footer className="p-3 bg-[#FEF7FF] border-t border-[#CAC4D0]/30 shrink-0">
        <div className="flex items-center gap-2">
          {/* Image attach button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleImageSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 flex items-center justify-center rounded-full text-[#49454F] hover:bg-[#1D1B20]/5 active:bg-[#1D1B20]/10 transition-colors shrink-0"
            title="Attach safe image"
          >
            <ImageIcon className="w-5 h-5 text-[#21005D]" />
          </button>

          {/* Text Input */}
          <div className="flex-1 relative flex items-center">
            <input
              type="text"
              placeholder="Encrypted message..."
              value={inputText}
              maxLength={5000}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="w-full bg-[#F3EDF7] text-sm text-[#1D1B20] placeholder-[#49454F] px-4 py-2.5 rounded-full border border-transparent focus:border-[#6750A4] focus:outline-none transition-all"
            />

            {ttlSeconds > 0 && (
              <span className="absolute right-3 text-[10px] font-mono text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <Flame className="w-2.5 h-2.5" />
                {ttlSeconds}s
              </span>
            )}
          </div>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!inputText.trim() && !selectedImage}
            data-testid="send_button"
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-all shrink-0 ${
              inputText.trim() || selectedImage
                ? 'bg-[#6750A4] text-white shadow-sm hover:bg-[#523d8c] active:scale-95'
                : 'bg-[#CAC4D0]/30 text-[#49454F]/50 cursor-not-allowed'
            }`}
            title="Send encrypted message"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </div>
      </footer>

      {/* Ephemeral Image Fullscreen Lightbox Modal */}
      {fullscreenImage && isSafeImageDataUri(fullscreenImage) && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className="text-white text-xs bg-white/20 px-3 py-1 rounded-full font-mono">
              RAM Decrypted View
            </span>
            <button
              onClick={() => setFullscreenImage(null)}
              className="text-white p-2 rounded-full hover:bg-white/20"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <img
            src={fullscreenImage}
            alt="Decrypted Fullscreen"
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};

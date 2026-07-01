// Takip Sistemi - Paylaşılan Modal Bileşeni
//
// Eskiden her sayfa (Accounting.jsx, Sales.jsx, ProfileModal.jsx...) kendi
// modal işaretlemesini ve Escape/overlay-click mantığını tekrar tekrar
// yazıyordu; hiçbirinde klavye ile gezinme "modal içinde hapsedilmiyordu"
// (focus trap yok) — Tab tuşuyla arka plandaki elemanlara geçilebiliyordu.
// Bu bileşen üçünü de merkezi olarak sağlar: Escape ile kapama, overlay'e
// tıklayınca kapama ve Tab ile modal dışına çıkılamaması (focus trap).
import React, { useEffect, useRef, type ReactNode } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
  zIndex?: number;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Modal = ({ isOpen, onClose, title, children, footer, maxWidth = "600px", zIndex = 1000 }: ModalProps) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // `onClose` çoğu çağıran yerde satır içi (inline) bir fonksiyon olarak
  // geçiliyor (`onClose={() => setShowModal(false)}`), yani her render'da
  // YENİ bir referans oluşuyor. Aşağıdaki asıl efekt eskiden `[isOpen, onClose]`
  // bağımlılığıyla çalışıyordu; bu da modal açıkken formdaki her tuş
  // vuruşunda (parent yeniden render olup onClose'u yeniden yarattığında)
  // efektin baştan çalışıp odağı zorla ilk elemana geri götürmesine neden
  // oluyordu — kullanıcı bir harf yazabiliyor, sonraki harfte odak sıfırlanıp
  // imleci tekrar alana getirmesi gerekiyordu. Çözüm: `onClose`'un GÜNCEL
  // halini bir ref'te tutup asıl efekti sadece `isOpen` değiştiğinde
  // (modal açılıp kapandığında) çalıştırmak.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    previousActiveElement.current = document.activeElement as HTMLElement | null;

    // Modal açılınca içindeki ilk odaklanabilir elemana git
    const focusables = contentRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    focusables?.[0]?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }

      if (e.key === "Tab" && contentRef.current) {
        const nodes = Array.from(contentRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        if (nodes.length === 0) return;

        const first = nodes[0];
        const last = nodes[nodes.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
      // Modal kapanınca odağı, modalı tetikleyen elemana geri ver
      previousActiveElement.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick} style={{ zIndex }}>
      <div
        ref={contentRef}
        className="modal-content animate-slide-up"
        style={{ maxWidth }}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
      >
        {title && (
          <div className="modal-header">
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>{title}</h3>
            <button onClick={onClose} style={{ cursor: "pointer", fontSize: "1.25rem" }} aria-label="Kapat">
              &times;
            </button>
          </div>
        )}

        {children}

        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;

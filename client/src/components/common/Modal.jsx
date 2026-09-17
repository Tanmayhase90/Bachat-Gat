import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = '560px',
  footer = null,
  onSubmit = null,
  bodyStyle = {},
  dialogStyle = {},
  overlayStyle = {},
  className = '',
  headerAction = null,
}) => {
  const dialogRef = useRef(null);
  const bodyRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        const allModals = document.querySelectorAll('.modal-dialog');
        if (allModals.length > 0 && allModals[allModals.length - 1] === dialogRef.current) {
          e.stopPropagation();
          onCloseRef.current?.();
        }
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const elements = Array.from(dialogRef.current.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])'
      )).filter((element) => element.offsetParent !== null);
      if (elements.length === 0) return;

      const first = elements[0];
      const last = elements[elements.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    if (isOpen) {
      previousFocusRef.current = document.activeElement;
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      requestAnimationFrame(() => {
        if (!dialogRef.current?.contains(document.activeElement)) {
          const firstField = bodyRef.current?.querySelector(
            '[data-autofocus], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
          );
          firstField?.focus();
        }
      });
    } else {
      const otherModals = document.querySelectorAll('.modal-overlay');
      if (otherModals.length <= 1) {
        document.body.style.overflow = 'auto';
      }
    }
    return () => {
      const otherModals = document.querySelectorAll('.modal-overlay');
      if (otherModals.length <= 1) {
        document.body.style.overflow = 'auto';
      }
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const innerContent = (
    <>
      {/* Modal Header */}
      <div className="modal-header" style={{ position: 'relative', zIndex: 100 }}>
        <h2 className="modal-title">{title}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {headerAction}
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close Modal"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Modal Body (Scrollable Center Area) */}
      <div ref={bodyRef} className="modal-body" style={bodyStyle}>
        {children}
      </div>

      {/* Modal Footer (Pinned Action Buttons) */}
      {footer && (
        <div className="modal-footer">
          {footer}
        </div>
      )}
    </>
  );

  const modalElement = (
    <div className="modal-overlay" style={overlayStyle} onClick={onClose}>
      <div
        ref={dialogRef}
        className={`modal-dialog fade-in ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Modal Dialog'}
        style={{ maxWidth, ...dialogStyle }}
        onClick={(e) => e.stopPropagation()}
      >
        {onSubmit ? (
          <form onSubmit={onSubmit} className="modal-form-wrapper">
            {innerContent}
          </form>
        ) : (
          innerContent
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalElement, document.body)
    : modalElement;
};

export default Modal;


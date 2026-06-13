'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import styles from './ConfirmDialog.module.css';

const ConfirmContext = createContext(null);

function ConfirmDialogUI({ title, message, confirmLabel = 'Xác nhận', cancelLabel = 'Hủy', danger = false, onConfirm, onCancel }) {
  const confirmBtnRef = useRef(null);

  // Focus confirm button khi mount
  useEffect(() => {
    confirmBtnRef.current?.focus();
  }, []);

  // Esc để đóng
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div className={styles.overlay} onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        {danger && (
          <div className={styles.iconWrap}>
            <AlertTriangle size={28} className={styles.dangerIcon} />
          </div>
        )}
        {title && <h3 id="confirm-title" className={styles.title}>{title}</h3>}
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button className="btn btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialog(typeof options === 'string' ? { message: options } : options);
    });
  }, []);

  const close = useCallback((result) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setDialog(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <ConfirmDialogUI
          {...dialog}
          onConfirm={() => close(true)}
          onCancel={() => close(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}

'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import styles from './Toast.module.css';

const ToastContext = createContext(null);

let _toastId = 0;

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

function ToastItem({ id, message, type, onClose }) {
  const Icon = ICONS[type] || Info;
  return (
    <div className={`${styles.toast} ${styles[type]}`} role="alert" aria-live="assertive">
      <Icon size={18} className={styles.toastIcon} />
      <span className={styles.toastMsg}>{message}</span>
      <button className={styles.toastClose} onClick={() => onClose(id)} aria-label="Đóng">
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type) => {
    const id = ++_toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => remove(id), 3500);
  }, [remove]);

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    info: (msg) => addToast(msg, 'info'),
    warning: (msg) => addToast(msg, 'warning'),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className={styles.container} aria-label="Thông báo">
        {toasts.map((t) => (
          <ToastItem key={t.id} {...t} onClose={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

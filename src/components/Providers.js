'use client';

import { ToastProvider } from './Toast';
import { ConfirmProvider } from './ConfirmDialog';
import Onboarding from './Onboarding';

export default function Providers({ children }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        {children}
        <Onboarding />
      </ConfirmProvider>
    </ToastProvider>
  );
}

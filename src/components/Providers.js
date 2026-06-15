'use client';

import { ToastProvider } from './Toast';
import { ConfirmProvider } from './ConfirmDialog';
import Onboarding from './Onboarding';
import AutoPushSubscribe from './AutoPushSubscribe';

export default function Providers({ children }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        {children}
        <Onboarding />
        <AutoPushSubscribe />
      </ConfirmProvider>
    </ToastProvider>
  );
}

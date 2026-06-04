'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import styles from './Sidebar.module.css';

/**
 * Nút chuyển đổi giao diện Sáng / Tối (Cozy Dark Mode).
 * - Lưu lựa chọn vào localStorage('ari-theme') để giữ nguyên sau khi F5.
 * - Việc áp dụng theme khi tải trang được xử lý bởi inline-script trong layout.js
 *   (chạy trước khi paint → tránh nhấp nháy/FOUC). Component này chỉ đọc trạng
 *   thái hiện tại và bật/tắt.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const current =
      document.documentElement.getAttribute('data-theme') || 'light';
    setTheme(current);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('ari-theme', next);
    } catch {
      // localStorage có thể bị chặn (chế độ riêng tư) — bỏ qua an toàn.
    }
  };

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={styles.themeToggle}
      title={isDark ? 'Chuyển sang chế độ Sáng' : 'Chuyển sang chế độ Tối'}
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
      <span>{isDark ? 'Chế độ Sáng' : 'Chế độ Tối'}</span>
    </button>
  );
}

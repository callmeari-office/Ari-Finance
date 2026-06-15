import { describe, it, expect } from 'vitest';
import { formatTrieu, buildMorningBriefingHTML } from './morningBriefing';

describe('formatTrieu', () => {
  it('rút gọn ≥ 1 triệu thành "tr"', () => {
    expect(formatTrieu(124000000)).toBe('124tr');
    expect(formatTrieu(89500000)).toBe('89,5tr');
    expect(formatTrieu(6800000)).toBe('6,8tr');
    expect(formatTrieu(1000000)).toBe('1tr');
  });
  it('< 1 triệu hiển thị đầy đủ kèm đ', () => {
    expect(formatTrieu(500000)).toBe('500.000đ');
    expect(formatTrieu(0)).toBe('0đ');
  });
  it('giá trị rác → 0đ', () => {
    expect(formatTrieu(null)).toBe('0đ');
    expect(formatTrieu('abc')).toBe('0đ');
  });
});

const baseData = {
  ngay: new Date(2026, 5, 16),
  tien: { tongTien: 48250000, quyList: [{ tenQuy: 'Quỹ tiền mặt', soDuHienTai: 48250000 }], soNgayConTru: 12, canhBaoAm: false, ngayCoTheAm: null },
  hieuSuat: { doanhThuThang: 124000000, mucTieuThang: 200000000, pctDat: 62, chiPhiThang: 89500000, laiThang: 34500000, doanhThuHomQua: 6800000 },
  canXuLy: {
    choThanhToan: { count: 3, tong: 12400000 },
    choHoanUng: { count: 0, tong: 0 },
    quaHan: { count: 1, tong: 2000000 },
    chuaNhapDoanhThu: { soKenh: 0 },
  },
  canhBao: { nhacHan: [], vuotHanMuc: [{ tenDanhMuc: 'Marketing', tile: 95, vuot: false }], vuotKeHoach: [], tongSo: 1 },
};

describe('buildMorningBriefingHTML', () => {
  it('luôn có header + Tiền đang có hiển thị ĐẦY ĐỦ (không rút gọn)', () => {
    const html = buildMorningBriefingHTML(baseData, null);
    expect(html).toContain('Báo cáo sáng');
    expect(html).toContain('Tiền đang có');
    expect(html).toContain('48.250.000đ'); // đầy đủ, không phải "48,3tr"
    expect(html).toContain('124tr'); // doanh thu tháng rút gọn
    expect(html).toContain('16/06/2026');
  });

  it('ai = null → KHÔNG có khối nhận định / đề xuất, nhưng vẫn đủ số liệu', () => {
    const html = buildMorningBriefingHTML(baseData, null);
    expect(html).not.toContain('Nhận định sáng nay');
    expect(html).not.toContain('Đề xuất từ Ari');
    expect(html).toContain('Cần xử lý');
    expect(html).toContain('Cảnh báo rủi ro'); // có quá hạn + Marketing 95%
  });

  it('ai có dữ liệu → hiện nhận định + đề xuất', () => {
    const ai = { nhanDinh: 'Tổng thể ổn định sáng nay.', deXuat: ['Duyệt phiếu sớm', 'Đẩy doanh thu cuối tuần'] };
    const html = buildMorningBriefingHTML(baseData, ai);
    expect(html).toContain('Nhận định sáng nay');
    expect(html).toContain('Tổng thể ổn định sáng nay.');
    expect(html).toContain('Đề xuất từ Ari');
    expect(html).toContain('Duyệt phiếu sớm');
  });

  it('ngày yên ả → "không có việc gấp", không có khối cảnh báo', () => {
    const quiet = {
      ...baseData,
      tien: { ...baseData.tien, canhBaoAm: false },
      canXuLy: {
        choThanhToan: { count: 0, tong: 0 }, choHoanUng: { count: 0, tong: 0 },
        quaHan: { count: 0, tong: 0 }, chuaNhapDoanhThu: { soKenh: 0 },
      },
      canhBao: { nhacHan: [], vuotHanMuc: [], vuotKeHoach: [], tongSo: 0 },
    };
    const html = buildMorningBriefingHTML(quiet, null);
    expect(html).toContain('không có việc gấp');
    expect(html).not.toContain('Cảnh báo rủi ro');
  });

  it('escape nội dung AI / tên quỹ (chống chèn HTML)', () => {
    const ai = { nhanDinh: 'Cẩn thận <script>alert(1)</script>', deXuat: [] };
    const html = buildMorningBriefingHTML(baseData, ai);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

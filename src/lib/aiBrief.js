// src/lib/aiBrief.js
// Tạo đoạn "nhận định" + "đề xuất" bằng Claude Haiku 4.5.
// AN TOÀN: thiếu key / lỗi / parse fail → trả null (email vẫn gửi, chỉ bỏ phần AI).
// AI CHỈ diễn giải số liệu được cấp, KHÔNG bịa số.

import Anthropic from '@anthropic-ai/sdk';
import { logger } from './logger';

const MODEL = 'claude-haiku-4-5';

const SYSTEM = `Bạn là trợ lý tài chính của shop thời trang "Call Me Ari", viết bản tin tài chính buổi sáng cho chủ shop.
Yêu cầu:
- Tiếng Việt, văn phong ấm áp, NGẮN GỌN, DỄ HIỂU (chủ shop không rành tài chính, tránh thuật ngữ).
- TUYỆT ĐỐI chỉ dựa trên số liệu được cung cấp. KHÔNG bịa thêm con số nào mới.
- Trả về DUY NHẤT một JSON hợp lệ, không kèm chữ nào khác, dạng:
  {"nhanDinh":"...","deXuat":["...","...","..."]}
- "nhanDinh": 3-5 câu tóm tắt tổng quan hiện trạng (tiền, doanh thu so mục tiêu, việc cần làm, rủi ro nổi bật).
- "deXuat": 2-3 gợi ý hành động cụ thể, thực tế, ưu tiên cho hôm nay.`;

/** Rút gọn data thành object nhỏ chỉ chứa số cần cho AI (không gửi mảng lớn). */
function summarizeForAI(data) {
  const t = data.tien, h = data.hieuSuat, x = data.canXuLy, w = data.canhBao;
  return {
    tien_dang_co: t.tongTien,
    du_bao_so_ngay_du_chi: t.soNgayConTru,
    canh_bao_dong_tien_am: t.canhBaoAm,
    doanh_thu_thang: h.doanhThuThang,
    muc_tieu_thang: h.mucTieuThang,
    phan_tram_dat_muc_tieu: h.pctDat,
    chi_phi_thang: h.chiPhiThang,
    lai_tam_tinh_thang: h.laiThang,
    doanh_thu_hom_qua: h.doanhThuHomQua,
    phieu_cho_duyet: x.choThanhToan.count,
    phieu_cho_hoan_ung: x.choHoanUng.count,
    phieu_qua_han: x.quaHan.count,
    kenh_chua_nhap_doanh_thu_hom_qua: x.chuaNhapDoanhThu.soKenh,
    danh_muc_sap_vuot_han_muc: (w.vuotHanMuc || []).slice(0, 3).map((v) => ({ ten: v.tenDanhMuc, phan_tram: v.tile })),
    danh_muc_vuot_ke_hoach: (w.vuotKeHoach || []).slice(0, 3).map((v) => ({ ten: v.tenDanhMuc, phan_tram: v.tile })),
  };
}

function parseJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch { /* thử trích khối {...} */ }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
  }
  return null;
}

/**
 * @returns {Promise<{nhanDinh:string, deXuat:string[]} | null>}
 */
export async function taoNhanDinhAI(data) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: SYSTEM,
      messages: [
        { role: 'user', content: 'Số liệu tài chính hôm nay (đơn vị VND):\n' + JSON.stringify(summarizeForAI(data)) },
      ],
    });

    const text = (msg.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    const parsed = parseJson(text);
    if (!parsed || typeof parsed.nhanDinh !== 'string' || !parsed.nhanDinh.trim()) return null;

    const deXuat = Array.isArray(parsed.deXuat)
      ? parsed.deXuat.filter((s) => typeof s === 'string' && s.trim()).slice(0, 3)
      : [];

    return { nhanDinh: parsed.nhanDinh.trim(), deXuat };
  } catch (error) {
    logger.error('taoNhanDinhAI', error);
    return null;
  }
}

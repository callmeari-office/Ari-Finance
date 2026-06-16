// src/lib/aiBrief.js
// Tạo đoạn "nhận định" + "đề xuất" bằng DeepSeek (API kiểu OpenAI-compatible).
// Gọi thẳng bằng fetch — không cần SDK. Model: deepseek-chat (route tới bản mới nhất, rẻ).
// AN TOÀN: thiếu key / lỗi / timeout / parse fail → trả null (email vẫn gửi, bỏ phần AI).
// AI CHỈ diễn giải số liệu được cấp, KHÔNG bịa số.

import { logger } from './logger';

const API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-chat';
const TIMEOUT_MS = 20000;

const SYSTEM = `Bạn là trợ lý tài chính của shop thời trang "Call Me Ari", viết bản tin tài chính buổi sáng cho chủ shop.
Yêu cầu:
- Tiếng Việt, văn phong ấm áp, NGẮN GỌN, DỄ HIỂU (chủ shop không rành tài chính, tránh thuật ngữ).
- TUYỆT ĐỐI chỉ dựa trên số liệu được cung cấp. KHÔNG bịa thêm con số nào mới.
- Trả về DUY NHẤT một JSON hợp lệ, không kèm chữ nào khác, dạng:
  {"nhanDinh":"...","deXuat":["...","...","..."]}
- "nhanDinh": 3-5 câu tóm tắt tổng quan hiện trạng (tiền, doanh thu so mục tiêu, việc cần làm, rủi ro nổi bật).
- "deXuat": 2-3 gợi ý hành động cụ thể, thực tế, ưu tiên cho hôm nay.
- LƯU Ý dòng tiền theo kỳ: nếu "chi_phi_co_dinh_con_lai" > 0, ĐỪNG kết luận lời/lỗ dựa trên "lai_tam_tinh_thang"; hãy nói theo "lai_du_kien_ca_thang" và nhắc còn khoản cố định (lương/thuê...) chưa chi trong tháng.`;

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
    chi_phi_du_kien_ca_thang: h.chiPhiDuKienThang,
    chi_phi_co_dinh_con_lai: h.conLaiCoDinh,
    lai_du_kien_ca_thang: h.laiDuKienThang,
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
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 800,
        temperature: 0.5,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: 'Số liệu tài chính hôm nay (đơn vị VND):\n' + JSON.stringify(summarizeForAI(data)) },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      logger.error('taoNhanDinhAI: HTTP ' + res.status, await res.text().catch(() => ''));
      return null;
    }

    const json = await res.json();
    const text = (json?.choices?.[0]?.message?.content || '').trim();

    const parsed = parseJson(text);
    if (!parsed || typeof parsed.nhanDinh !== 'string' || !parsed.nhanDinh.trim()) return null;

    const deXuat = Array.isArray(parsed.deXuat)
      ? parsed.deXuat.filter((s) => typeof s === 'string' && s.trim()).slice(0, 3)
      : [];

    return { nhanDinh: parsed.nhanDinh.trim(), deXuat };
  } catch (error) {
    logger.error('taoNhanDinhAI', error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

import nodemailer from 'nodemailer';
import { prisma } from './prisma';
import { logger } from './logger';
import { ghiNhatKy } from './audit';
import { buildMorningBriefingHTML } from './morningBriefing';

/**
 * Gửi email qua Gmail SMTP (nodemailer).
 *
 * Cấu hình trong .env:
 *   SMTP_USER  = email Gmail dùng để gửi (vd: callmeari.office@gmail.com)
 *   SMTP_PASS  = "App Password" 16 ký tự tạo trong Google Account (KHÔNG phải mật khẩu đăng nhập)
 *   SMTP_FROM  = (tuỳ chọn) tên hiển thị người gửi, vd: "ARI Finance <callmeari.office@gmail.com>"
 *   APP_URL    = địa chỉ web app để tạo link bấm vào, vd: http://localhost:3000 hoặc https://...
 */

/**
 * Cờ tạm tắt email "phiếu chi Chờ thanh toán" (đơn lẻ + tổng hợp).
 * Hiện app đã có thông báo qua app/Web Push nên tạm ngưng gửi email loại này.
 * Bật lại sau này: đổi thành `true` (hoặc đặt env EMAIL_CHO_THANH_TOAN=on).
 * KHÔNG ảnh hưởng các email khác (đặt lại mật khẩu, Lá thư tổng kết tháng).
 */
const EMAIL_CHO_THANH_TOAN_ENABLED = process.env.EMAIL_CHO_THANH_TOAN === 'on';

let cachedTransporter = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null; // Chưa cấu hình SMTP → bỏ qua gửi mail (không làm hỏng luồng tạo phiếu)
  }

  cachedTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  return cachedTransporter;
}

// Escape HTML để chống chèn mã/HTML độc qua nội dung do người dùng nhập
// (vd: noiDung phiếu, tên NCC) khi nhúng vào email HTML.
function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatVND(n) {
  try {
    return new Intl.NumberFormat('vi-VN').format(Number(n || 0)) + ' ₫';
  } catch {
    return `${n} ₫`;
  }
}

function formatDate(d) {
  if (!d) return '—';
  try {
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return '—';
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = String(dateObj.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  } catch {
    return '—';
  }
}

const NGUON_TIEN_LABEL = {
  TIEN_SHOP: 'Tiền shop',
  TIEN_CA_NHAN: 'Tiền cá nhân (hoàn ứng)',
};

/**
 * Sinh URL ảnh VietQR động (giống logic ở trang Duyệt: src/app/de-xuat/duyet/page.js).
 * Trả về '' nếu thiếu thông tin tài khoản → không hiển thị QR.
 */
function buildVietQRUrl(vendor, amount, memo) {
  if (!vendor || !vendor.soTaiKhoan || !vendor.tenNganHang) return '';

  const nameUpper = String(vendor.tenNganHang).toUpperCase();
  const bankCode = nameUpper.includes('-')
    ? nameUpper.split('-')[0].trim()
    : nameUpper.trim();

  const bankMap = {
    vcb: 'vietcombank', tcb: 'techcombank', ctg: 'vietinbank',
    mb: 'mb', mbbank: 'mb', vpb: 'vpbank', hdb: 'hdbank',
    stb: 'sacombank', tpb: 'tpbank', msb: 'msb', shb: 'shb',
    eib: 'eximbank', ocb: 'ocb', lpb: 'lpbank', abb: 'abbank',
    nab: 'namabank', cake: 'cake',
  };
  const qrBank = bankMap[bankCode.toLowerCase()] || bankCode.toLowerCase();
  const accountName = vendor.tenTaiKhoan || vendor.tenNCC || '';

  return `https://img.vietqr.io/image/${qrBank}-${vendor.soTaiKhoan}-compact.png?amount=${amount}&addInfo=${encodeURIComponent(memo)}&accountName=${encodeURIComponent(accountName)}`;
}

/**
 * Khối HTML "Thông tin thanh toán + QR VietQR động" — chỉ dựng khi phiếu có NCC
 * kèm số tài khoản & ngân hàng. Trả về '' nếu không đủ thông tin.
 */
function buildPaymentBlock(proposal) {
  const ncc = proposal.nhaCungCap;
  if (!ncc || !ncc.soTaiKhoan || !ncc.tenNganHang) return '';

  const memo = proposal.ghiChu || proposal.maPhieu;
  const qrUrl = buildVietQRUrl(ncc, proposal.soTien, memo);
  const chuTaiKhoan = ncc.tenTaiKhoan || ncc.tenNCC || '—';

  const line = (label, value) => `
    <tr>
      <td style="padding:6px 0;color:#8a8079;font-size:13px;white-space:nowrap;vertical-align:top;">${label}</td>
      <td style="padding:6px 0 6px 14px;color:#3d3733;font-size:13px;font-weight:700;text-align:right;word-break:break-all;">${esc(value)}</td>
    </tr>`;

  const qrImg = qrUrl
    ? `
      <div style="margin-top:16px;text-align:center;">
        <div style="display:inline-block;background:#ffffff;border:1px solid #ece3da;border-radius:12px;padding:12px;">
          <img src="${qrUrl}" alt="Mã VietQR động chuyển khoản" width="180" style="display:block;width:180px;height:auto;border-radius:6px;" />
          <div style="color:#8a8079;font-size:11px;margin-top:6px;">Quét QR để tự điền số tiền &amp; nội dung</div>
        </div>
      </div>`
    : '';

  return `
        <tr>
          <td style="padding:8px 28px 4px;">
            <div style="background:#faf6f2;border:1px solid #ece3da;border-radius:14px;padding:18px;">
              <div style="color:#634d3e;font-size:13px;font-weight:800;letter-spacing:0.3px;text-transform:uppercase;margin-bottom:10px;">
                💳 Thông tin thanh toán (VietQR động)
              </div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${line('Chủ tài khoản', chuTaiKhoan)}
                ${line('Số tài khoản', ncc.soTaiKhoan)}
                ${line('Ngân hàng', ncc.tenNganHang)}
                ${line('Số tiền', formatVND(proposal.soTien))}
                ${line('Nội dung CK', memo)}
              </table>
              ${qrImg}
            </div>
          </td>
        </tr>`;
}

function buildEmailHtml(proposal, link) {
  const tenNguoiTao =
    proposal.nguoiTao?.tenNgan || proposal.nguoiTao?.hoTen || 'Không rõ';
  const tenDanhMuc = proposal.danhMuc?.tenDanhMuc || '—';
  const tenNCC = proposal.nhaCungCap?.tenNCC || '—';
  const nguonTien = NGUON_TIEN_LABEL[proposal.nguonTien] || proposal.nguonTien;

  const row = (label, value) => `
    <tr>
      <td style="padding:10px 0;color:#6b7280;font-size:14px;white-space:nowrap;vertical-align:top;">${label}</td>
      <td style="padding:10px 0 10px 16px;color:#111827;font-size:14px;font-weight:600;text-align:right;">${esc(value)}</td>
    </tr>`;

  return `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:28px 28px 24px;">
            <div style="color:rgba(255,255,255,0.85);font-size:13px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">ARI Finance</div>
            <div style="color:#ffffff;font-size:20px;font-weight:700;margin-top:6px;">🔔 Có phiếu chi cần thanh toán</div>
          </td>
        </tr>

        <!-- Số tiền nổi bật -->
        <tr>
          <td style="padding:28px 28px 8px;text-align:center;">
            <div style="color:#6b7280;font-size:13px;">Số tiền đề xuất</div>
            <div style="color:#4f46e5;font-size:32px;font-weight:800;margin-top:4px;">${formatVND(proposal.soTien)}</div>
            <div style="display:inline-block;margin-top:10px;padding:4px 12px;background:#fef3c7;color:#92400e;font-size:12px;font-weight:700;border-radius:9999px;">⏳ Chờ thanh toán</div>
          </td>
        </tr>

        <!-- Chi tiết -->
        <tr>
          <td style="padding:16px 28px 4px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f3f4f6;">
              ${row('Mã phiếu', proposal.maPhieu)}
              ${row('Nội dung', proposal.noiDung)}
              ${row('Danh mục', tenDanhMuc)}
              ${row('Nhà cung cấp', tenNCC)}
              ${row('Nguồn tiền', nguonTien)}
              ${row('Người đề xuất', tenNguoiTao)}
              ${row('Ngày phát sinh', formatDate(proposal.ngayPhatSinh))}
              ${row('Cần thanh toán trước', formatDate(proposal.ngayCanThanhToan))}
            </table>
          </td>
        </tr>

        <!-- Thông tin thanh toán + QR (nếu có NCC) -->
        ${buildPaymentBlock(proposal)}

        <!-- CTA -->
        <tr>
          <td style="padding:24px 28px 28px;text-align:center;">
            <a href="${link}" target="_blank"
               style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:10px;">
              Kiểm tra & Duyệt thanh toán →
            </a>
            <div style="color:#9ca3af;font-size:12px;margin-top:14px;">
              Hoặc mở đường dẫn:<br>
              <a href="${link}" target="_blank" style="color:#6366f1;word-break:break-all;">${link}</a>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:16px 28px;text-align:center;border-top:1px solid #f3f4f6;">
            <div style="color:#9ca3af;font-size:12px;">Email tự động từ hệ thống ARI Finance — vui lòng không trả lời email này.</div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Gửi email đặt lại mật khẩu cho nhân viên.
 * OWNER bấm nút → gọi hàm này → nhân viên nhận link, click, nhập mật khẩu mới.
 *
 * Không throw — lỗi chỉ ghi log để không ảnh hưởng luồng gọi.
 */
export async function sendPasswordResetEmail({ employee, resetLink }) {
  try {
    const transporter = getTransporter();
    if (!transporter) {
      logger.warn('sendPasswordResetEmail: chưa cấu hình SMTP → bỏ qua.');
      return;
    }

    const from = process.env.SMTP_FROM || `ARI Finance <${process.env.SMTP_USER}>`;
    const tenHienThi = esc(employee.tenNgan || employee.hoTen || employee.username || 'Bạn');

    const html = `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:28px 28px 24px;">
            <div style="color:rgba(255,255,255,0.85);font-size:13px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">ARI Finance</div>
            <div style="color:#fff;font-size:20px;font-weight:700;margin-top:6px;">🔑 Đặt lại mật khẩu</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 8px;">
            <p style="color:#374151;font-size:15px;margin:0 0 12px;">Xin chào <strong>${tenHienThi}</strong>,</p>
            <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">
              Quản lý đã yêu cầu đặt lại mật khẩu tài khoản ARI Finance của bạn.<br>
              Nhấn vào nút bên dưới để tạo mật khẩu mới. Link có hiệu lực trong <strong>1 giờ</strong>.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 28px 28px;text-align:center;">
            <a href="${resetLink}" target="_blank"
               style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:10px;">
              Đặt lại mật khẩu →
            </a>
            <div style="color:#9ca3af;font-size:12px;margin-top:16px;">
              Hoặc mở đường dẫn:<br>
              <a href="${resetLink}" target="_blank" style="color:#6366f1;word-break:break-all;font-size:11px;">${resetLink}</a>
            </div>
            <p style="color:#ef4444;font-size:12px;margin-top:16px;">
              Nếu bạn không yêu cầu đổi mật khẩu, hãy bỏ qua email này.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:16px 28px;text-align:center;border-top:1px solid #f3f4f6;">
            <div style="color:#9ca3af;font-size:12px;">Email tự động từ hệ thống ARI Finance — vui lòng không trả lời.</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await transporter.sendMail({
      from,
      to: employee.email,
      subject: `[ARI Finance] Đặt lại mật khẩu của bạn`,
      html,
    });

    logger.info(`sendPasswordResetEmail: đã gửi link đặt lại mật khẩu tới ${employee.email}`);
  } catch (error) {
    logger.error('sendPasswordResetEmail', error);
  }
}

/**
 * Lấy danh sách email OWNER + MANAGER đang ACTIVE (dùng chung cho các hàm gửi mail).
 */
async function getManagerRecipients() {
  const recipients = await prisma.nhanVien.findMany({
    where: {
      role: { in: ['OWNER', 'MANAGER'] },
      trangThai: 'ACTIVE',
      email: { not: '' },
    },
    select: { email: true },
  });
  return recipients.map((r) => r.email).filter((e) => e && e.includes('@'));
}

/**
 * Dựng HTML email TỔNG HỢP cho nhiều phiếu chi "Chờ thanh toán" tạo cùng lúc.
 * Gọn nhẹ: 1 bảng liệt kê, không nhúng QR từng phiếu (tránh email quá nặng).
 */
function buildBulkEmailHtml(proposals, link) {
  const tongTien = proposals.reduce((s, p) => s + Number(p.soTien || 0), 0);

  const rows = proposals
    .map((p, i) => {
      const tenNguoiTao = esc(p.nguoiTao?.tenNgan || p.nguoiTao?.hoTen || '—');
      const tenDanhMuc = esc(p.danhMuc?.tenDanhMuc || '—');
      return `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;text-align:center;">${i + 1}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;color:#4f46e5;font-size:13px;font-weight:700;white-space:nowrap;">${esc(p.maPhieu)}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;color:#111827;font-size:13px;">${esc(p.noiDung || '—')}<div style="color:#9ca3af;font-size:11px;margin-top:2px;">${tenDanhMuc} · ${tenNguoiTao}</div></td>
          <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;color:#111827;font-size:13px;font-weight:700;text-align:right;white-space:nowrap;">${formatVND(p.soTien)}</td>
        </tr>`;
    })
    .join('');

  return `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:28px 28px 24px;">
            <div style="color:rgba(255,255,255,0.85);font-size:13px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">ARI Finance</div>
            <div style="color:#ffffff;font-size:20px;font-weight:700;margin-top:6px;">🔔 ${proposals.length} phiếu chi cần thanh toán</div>
          </td>
        </tr>

        <!-- Tổng tiền nổi bật -->
        <tr>
          <td style="padding:28px 28px 8px;text-align:center;">
            <div style="color:#6b7280;font-size:13px;">Tổng số tiền đề xuất (${proposals.length} phiếu)</div>
            <div style="color:#4f46e5;font-size:32px;font-weight:800;margin-top:4px;">${formatVND(tongTien)}</div>
            <div style="display:inline-block;margin-top:10px;padding:4px 12px;background:#fef3c7;color:#92400e;font-size:12px;font-weight:700;border-radius:9999px;">⏳ Chờ thanh toán</div>
          </td>
        </tr>

        <!-- Bảng liệt kê -->
        <tr>
          <td style="padding:16px 20px 4px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f3f4f6;">
              <tr>
                <th style="padding:8px;color:#9ca3af;font-size:11px;text-transform:uppercase;text-align:center;border-bottom:2px solid #f3f4f6;">#</th>
                <th style="padding:8px;color:#9ca3af;font-size:11px;text-transform:uppercase;text-align:left;border-bottom:2px solid #f3f4f6;">Mã phiếu</th>
                <th style="padding:8px;color:#9ca3af;font-size:11px;text-transform:uppercase;text-align:left;border-bottom:2px solid #f3f4f6;">Nội dung</th>
                <th style="padding:8px;color:#9ca3af;font-size:11px;text-transform:uppercase;text-align:right;border-bottom:2px solid #f3f4f6;">Số tiền</th>
              </tr>
              ${rows}
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:24px 28px 28px;text-align:center;">
            <a href="${link}" target="_blank"
               style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:10px;">
              Kiểm tra & Duyệt thanh toán →
            </a>
            <div style="color:#9ca3af;font-size:12px;margin-top:14px;">
              Hoặc mở đường dẫn:<br>
              <a href="${link}" target="_blank" style="color:#6366f1;word-break:break-all;">${link}</a>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:16px 28px;text-align:center;border-top:1px solid #f3f4f6;">
            <div style="color:#9ca3af;font-size:12px;">Email tự động từ hệ thống ARI Finance — vui lòng không trả lời email này.</div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Gửi MỘT email tổng hợp cho OWNER + MANAGER khi tạo NHIỀU phiếu chi cùng lúc
 * (trạng thái "Chờ thanh toán"). Tránh spam N email và giảm tải hệ thống.
 *
 * Không throw — mọi lỗi chỉ ghi log để KHÔNG làm hỏng luồng tạo phiếu.
 */
export async function notifyManagersBulkChoThanhToan(proposalIds) {
  try {
    // Tạm tắt: đã có thông báo qua app/Web Push (xem cờ ở đầu file).
    if (!EMAIL_CHO_THANH_TOAN_ENABLED) return;

    const ids = (proposalIds || []).filter(Boolean);
    if (ids.length === 0) return;

    // Nếu chỉ có 1 phiếu → dùng email chi tiết (có QR) như bình thường.
    if (ids.length === 1) {
      return notifyManagersChoThanhToan(ids[0]);
    }

    const transporter = getTransporter();
    if (!transporter) {
      logger.warn('notifyManagersBulkChoThanhToan: chưa cấu hình SMTP → bỏ qua gửi email.');
      return;
    }

    const proposals = await prisma.deXuatChiPhi.findMany({
      where: { id: { in: ids } },
      include: {
        danhMuc: { select: { tenDanhMuc: true } },
        nguoiTao: { select: { hoTen: true, tenNgan: true } },
      },
      orderBy: { maPhieu: 'asc' },
    });
    if (proposals.length === 0) return;

    const toList = await getManagerRecipients();
    if (toList.length === 0) {
      logger.warn('notifyManagersBulkChoThanhToan: không có người nhận hợp lệ.');
      return;
    }

    const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const link = `${appUrl}/de-xuat/duyet`;
    const from = process.env.SMTP_FROM || `ARI Finance <${process.env.SMTP_USER}>`;
    const tongTien = proposals.reduce((s, p) => s + Number(p.soTien || 0), 0);

    await transporter.sendMail({
      from,
      to: toList.join(', '),
      subject: `🔔 ${proposals.length} phiếu chi cần thanh toán — tổng ${formatVND(tongTien)}`,
      html: buildBulkEmailHtml(proposals, link),
    });

    logger.info(
      `notifyManagersBulkChoThanhToan: đã gửi 1 email tổng hợp ${proposals.length} phiếu tới ${toList.length} người.`
    );
  } catch (error) {
    logger.error('notifyManagersBulkChoThanhToan', error);
  }
}

// ─── LÁ THƯ ARI — TỔNG KẾT THÁNG ────────────────────────────────────────────

/** Lấy số liệu tài chính 1 tháng (doanh thu, chi phí, lãi/lỗ). */
async function getMonthlyFinancials(thang, nam) {
  const startOfMonth = new Date(nam, thang - 1, 1);
  const endOfMonth = new Date(nam, thang, 1);

  const [doanhThuRows, chiThuChiRows, chiLichSuRows] = await Promise.all([
    prisma.keHoachDoanhThu.groupBy({
      by: ['thang'],
      where: { nam, thang },
      _sum: { thucTe: true },
    }),
    prisma.$queryRaw`
      SELECT COALESCE(SUM("soTien"), 0) AS total FROM "ThuChi"
      WHERE "ngayGiaoDich" >= ${startOfMonth} AND "ngayGiaoDich" < ${endOfMonth}
        AND "loaiGiaoDich" = 'CHI'
    `,
    prisma.$queryRaw`
      SELECT COALESCE(SUM("soTien"), 0) AS total FROM "DeXuatChiPhi"
      WHERE "ngayPhatSinh" >= ${startOfMonth}
        AND "ngayPhatSinh" < ${endOfMonth}
        AND "laLichSu" = true
        AND "thuChiId" IS NULL
    `,
  ]);

  const doanhThuThucTe = Number(doanhThuRows[0]?._sum?.thucTe || 0);
  const chiPhiThucTe =
    Number(chiThuChiRows[0]?.total || 0) + Number(chiLichSuRows[0]?.total || 0);
  const loiNhuanThucTe = doanhThuThucTe - chiPhiThucTe;
  const bienLoiNhuan =
    doanhThuThucTe > 0 ? Math.round((loiNhuanThucTe / doanhThuThucTe) * 100) : 0;

  return { doanhThuThucTe, chiPhiThucTe, loiNhuanThucTe, bienLoiNhuan };
}

/** Top 3 danh mục chi trong tháng (từ sổ ThuChi). */
async function getTop3ChiDanhMuc(thang, nam) {
  const startOfMonth = new Date(nam, thang - 1, 1);
  const endOfMonth = new Date(nam, thang, 1);

  const rows = await prisma.$queryRaw`
    SELECT d."tenDanhMuc", COALESCE(SUM(tc."soTien"), 0) AS total
    FROM "ThuChi" tc
    JOIN "DanhMuc" d ON d.id = tc."danhMucId"
    WHERE tc."ngayGiaoDich" >= ${startOfMonth}
      AND tc."ngayGiaoDich" < ${endOfMonth}
      AND tc."loaiGiaoDich" = 'CHI'
    GROUP BY d.id, d."tenDanhMuc"
    ORDER BY total DESC
    LIMIT 3
  `;

  return rows.map((r) => ({ tenDanhMuc: r.tenDanhMuc, total: Number(r.total || 0) }));
}

/**
 * Dựng HTML email "Lá thư ARI" — tông kem-hồng cameo, responsive.
 * Không dùng flexbox/grid (email client compat) — layout bằng table.
 */
function buildMonthlyReportHtml({ thang, nam, prevThang, prevNam, hienTai, truoc, top3Chi, appUrl }) {
  const logoUrl = `${appUrl}/logo-hover.png`;
  const link = `${appUrl}/bao-cao`;

  // % thay đổi so tháng trước
  const pctChange = (curr, prev) => {
    if (prev === 0) return null;
    return Math.round(((curr - prev) / Math.abs(prev)) * 100);
  };
  const dtPct = pctChange(hienTai.doanhThuThucTe, truoc.doanhThuThucTe);
  const cpPct = pctChange(hienTai.chiPhiThucTe, truoc.chiPhiThucTe);
  const lnPct = pctChange(hienTai.loiNhuanThucTe, truoc.loiNhuanThucTe);
  const bienLN = hienTai.bienLoiNhuan;

  // Lời nhắn ấm theo biên lợi nhuận
  const loiNhan =
    bienLN >= 20
      ? `Tháng vừa rồi thật rực rỡ! Shop <strong>Call Me Ari</strong> đang trên đà tăng trưởng tốt — biên lợi nhuận <strong>${bienLN}%</strong> là con số đáng tự hào. Hãy tiếp tục phát huy nhé, mọi nỗ lực đều đang được đền đáp xứng đáng. 🌸`
      : bienLN >= 0
      ? `Shop <strong>Call Me Ari</strong> vẫn đang sinh lời trong tháng này — dù chưa phải tháng bứt phá nhất, mỗi bước đi ổn định đều rất quý giá. Hãy tiếp tục duy trì và tìm cơ hội tối ưu chi phí để tăng biên lợi nhuận nhé. 💪`
      : `Tháng này có phần vất vả với shop <strong>Call Me Ari</strong>, nhưng đừng lo — mọi con số đều là bài học quý. Hãy xem lại cơ cấu chi phí và tìm cơ hội tăng doanh thu cho tháng tới. Chúng ta sẽ làm tốt hơn! 🌺`;

  // KPI card 50% width
  const kpiCard = (icon, label, value, color) => `
    <td style="padding:5px;width:50%;vertical-align:top;">
      <div style="background:#FFFFFF;border:1px solid #F0E4D7;border-radius:12px;padding:14px 10px;text-align:center;">
        <div style="font-size:20px;margin-bottom:5px;">${icon}</div>
        <div style="color:#8A7068;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:5px;">${label}</div>
        <div style="color:${color};font-size:14px;font-weight:800;word-break:break-word;">${value}</div>
      </div>
    </td>`;

  // Badge so sánh — invertColor: chi phí giảm = tốt
  const badgeCell = (pct, label, invertColor) => {
    if (pct === null) {
      return `<td style="width:33%;text-align:center;padding:5px;">
        <div style="color:#A07888;font-size:11px;margin-bottom:4px;">${label}</div>
        <span style="color:#C4A4B0;font-size:13px;font-weight:700;">—</span>
      </td>`;
    }
    const up = pct >= 0;
    const isGood = invertColor ? !up : up;
    const color = isGood ? '#10b981' : '#ef4444';
    const arrow = up ? '▲' : '▼';
    return `<td style="width:33%;text-align:center;padding:5px;">
      <div style="color:#A07888;font-size:11px;margin-bottom:4px;">${label}</div>
      <span style="color:${color};font-size:14px;font-weight:800;">${arrow} ${Math.abs(pct)}%</span>
    </td>`;
  };

  // Top 3 chi
  const medals = ['🥇', '🥈', '🥉'];
  const maxTop = top3Chi.length > 0 ? top3Chi[0].total : 1;
  const top3Section =
    top3Chi.length === 0
      ? ''
      : `
        <tr>
          <td style="padding:14px 18px 4px;">
            <div style="color:#73485E;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:12px;">🏆 Top 3 danh mục chi nhiều nhất</div>
            ${top3Chi
              .map((cat, i) => {
                const barW = Math.round((cat.total / maxTop) * 100);
                return `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                  <tr>
                    <td style="font-size:13px;padding-bottom:5px;color:#3D2B2B;">
                      ${medals[i]} <strong>${esc(cat.tenDanhMuc)}</strong>
                      <span style="float:right;color:#73485E;font-weight:800;">${formatVND(cat.total)}</span>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div style="background:#F0E4D7;border-radius:99px;height:7px;overflow:hidden;">
                        <div style="background:linear-gradient(90deg,#E6A2C5 0%,#73485E 100%);height:7px;width:${barW}%;border-radius:99px;"></div>
                      </div>
                    </td>
                  </tr>
                </table>`;
              })
              .join('')}
          </td>
        </tr>`;

  const lnColor = hienTai.loiNhuanThucTe >= 0 ? '#10b981' : '#ef4444';
  const lnSign = hienTai.loiNhuanThucTe >= 0 ? '+' : '';
  const bienColor = bienLN >= 20 ? '#10b981' : bienLN >= 0 ? '#f59e0b' : '#ef4444';

  return `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF0E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Georgia,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF0E8;padding:24px 10px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:520px;background:#FFF8F2;border-radius:20px;overflow:hidden;box-shadow:0 4px 20px rgba(115,72,94,0.13);">

        <!-- HEADER -->
        <tr>
          <td style="background:linear-gradient(135deg,#5C3347 0%,#C4778A 100%);padding:30px 24px 26px;text-align:center;">
            <div style="color:rgba(255,255,255,0.68);font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">ARI Finance · Thư tổng kết</div>
            <div style="color:#FFFFFF;font-size:26px;font-weight:800;letter-spacing:-0.5px;">🌸 Tháng ${thang} · ${nam}</div>
            <div style="color:rgba(255,255,255,0.60);font-size:13px;margin-top:6px;">Tổng kết tài chính · Call Me Ari</div>
          </td>
        </tr>

        <!-- KPI GRID 2×2 -->
        <tr>
          <td style="padding:20px 14px 6px;">
            <div style="color:#73485E;font-size:11px;font-weight:700;letter-spacing:0.9px;text-transform:uppercase;margin-bottom:10px;">📊 Kết quả tháng này</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                ${kpiCard('💰', 'Doanh thu', formatVND(hienTai.doanhThuThucTe), '#059669')}
                ${kpiCard('🧾', 'Chi phí', formatVND(hienTai.chiPhiThucTe), '#dc2626')}
              </tr>
              <tr>
                ${kpiCard('📈', 'Lãi / Lỗ', lnSign + formatVND(hienTai.loiNhuanThucTe), lnColor)}
                ${kpiCard('📊', 'Biên lợi nhuận', bienLN + '%', bienColor)}
              </tr>
            </table>
          </td>
        </tr>

        <!-- SO SÁNH THÁNG TRƯỚC -->
        <tr>
          <td style="padding:12px 14px 4px;">
            <div style="background:#F5E6EF;border-radius:14px;padding:16px 10px;">
              <div style="color:#73485E;font-size:11px;font-weight:700;letter-spacing:0.9px;text-transform:uppercase;margin-bottom:12px;">⚖️ So với T${prevThang}/${prevNam}</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  ${badgeCell(dtPct, 'Doanh thu', false)}
                  ${badgeCell(cpPct, 'Chi phí', true)}
                  ${badgeCell(lnPct, 'Lãi / Lỗ', false)}
                </tr>
              </table>
            </div>
          </td>
        </tr>

        ${top3Section}

        <!-- LỜI NHẮN ẤM -->
        <tr>
          <td style="padding:14px 14px 6px;">
            <div style="background:linear-gradient(135deg,#FFF0F6,#FAF0E8);border:1px solid #F0C8DC;border-radius:14px;padding:18px;">
              <div style="color:#73485E;font-size:11px;font-weight:700;letter-spacing:0.9px;text-transform:uppercase;margin-bottom:10px;">✉️ Lời nhắn từ ARI Finance</div>
              <p style="color:#4A3040;font-size:14px;line-height:1.8;margin:0;font-style:italic;">${loiNhan}</p>
            </div>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:18px 20px 22px;text-align:center;">
            <a href="${link}" target="_blank"
               style="display:inline-block;background:linear-gradient(135deg,#73485E 0%,#C4778A 100%);color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:700;padding:13px 30px;border-radius:10px;letter-spacing:0.2px;">
              Xem báo cáo chi tiết →
            </a>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#F5E6EF;padding:16px 24px;text-align:center;border-top:1px solid #EFCFDF;">
            <img src="${logoUrl}" alt="Call Me Ari" width="48"
                 style="display:block;margin:0 auto 8px;width:48px;height:auto;opacity:0.72;" />
            <div style="color:#8A6070;font-size:12px;font-weight:600;">ARI Finance · Call Me Ari</div>
            <div style="color:#C4A4B0;font-size:11px;margin-top:4px;">Email tự động gửi đầu tháng — vui lòng không trả lời.</div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Gửi "Lá thư ARI" — email tổng kết tài chính tháng trước cho OWNER + MANAGER.
 *
 * @param {object} opts
 * @param {number} opts.thang  - Tháng cần tổng kết (1–12)
 * @param {number} opts.nam    - Năm cần tổng kết
 * @param {object} [opts.user] - Người dùng gửi thủ công (null nếu cron tự động)
 * @param {boolean} [opts.preview] - true → trả HTML không gửi mail (xem trước)
 */
export async function sendMonthlyReport({ thang, nam, user = null, preview = false }) {
  try {
    // Tháng so sánh = tháng liền trước (tự xử lý qua đầu năm)
    const prevDate = new Date(nam, thang - 2, 1);
    const prevThang = prevDate.getMonth() + 1; // 1-12
    const prevNam = prevDate.getFullYear();

    const [hienTai, truoc, top3Chi] = await Promise.all([
      getMonthlyFinancials(thang, nam),
      getMonthlyFinancials(prevThang, prevNam),
      getTop3ChiDanhMuc(thang, nam),
    ]);

    const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const html = buildMonthlyReportHtml({ thang, nam, prevThang, prevNam, hienTai, truoc, top3Chi, appUrl });

    if (preview) {
      return { ok: true, html };
    }

    const transporter = getTransporter();
    if (!transporter) {
      logger.warn('sendMonthlyReport: chưa cấu hình SMTP → bỏ qua.');
      return { ok: false, error: 'Chưa cấu hình SMTP_USER / SMTP_PASS trong .env.' };
    }

    const toList = await getManagerRecipients();
    if (toList.length === 0) {
      return { ok: false, error: 'Không có OWNER/MANAGER nào có email hợp lệ.' };
    }

    const from = process.env.SMTP_FROM || `ARI Finance <${process.env.SMTP_USER}>`;
    const loiLai = hienTai.loiNhuanThucTe >= 0 ? 'Lãi' : 'Lỗ';
    const loiNhuanAbs = formatVND(Math.abs(hienTai.loiNhuanThucTe));

    await transporter.sendMail({
      from,
      to: toList.join(', '),
      subject: `🌸 Lá thư ARI — Tổng kết tháng ${thang}/${nam} · ${loiLai} ${loiNhuanAbs}`,
      html,
    });

    await ghiNhatKy({
      user,
      hanhDong: 'GUI_THU_THANG',
      doiTuong: 'EMAIL',
      maDoiTuong: `${nam}-${String(thang).padStart(2, '0')}`,
      moTa: `Gửi Lá thư ARI tổng kết tháng ${thang}/${nam} tới ${toList.length} người (${toList.join(', ')})`,
    });

    logger.info(`sendMonthlyReport: đã gửi tháng ${thang}/${nam} → ${toList.length} người.`);
    return { ok: true, thang, nam, recipients: toList.length };
  } catch (error) {
    logger.error('sendMonthlyReport', error);
    return { ok: false, error: error.message || 'Lỗi hệ thống.' };
  }
}

// ─── END LÁ THƯ ARI ──────────────────────────────────────────────────────────

/**
 * Gửi email thông báo cho tất cả OWNER + MANAGER (đang ACTIVE, có email)
 * khi một phiếu chi mới được tạo ở trạng thái "Chờ thanh toán".
 *
 * Không throw — mọi lỗi chỉ ghi log để KHÔNG làm hỏng luồng tạo phiếu.
 */
export async function notifyManagersChoThanhToan(proposalId) {
  try {
    // Tạm tắt: đã có thông báo qua app/Web Push (xem cờ ở đầu file).
    if (!EMAIL_CHO_THANH_TOAN_ENABLED) return;

    const transporter = getTransporter();
    if (!transporter) {
      logger.warn(
        'notifyManagersChoThanhToan: chưa cấu hình SMTP_USER/SMTP_PASS → bỏ qua gửi email.'
      );
      return;
    }

    const proposal = await prisma.deXuatChiPhi.findUnique({
      where: { id: proposalId },
      include: {
        danhMuc: true,
        nhaCungCap: true,
        nguoiTao: { select: { hoTen: true, tenNgan: true } },
      },
    });

    if (!proposal) return;

    const recipients = await prisma.nhanVien.findMany({
      where: {
        role: { in: ['OWNER', 'MANAGER'] },
        trangThai: 'ACTIVE',
        email: { not: '' },
      },
      select: { email: true },
    });

    const toList = recipients
      .map((r) => r.email)
      .filter((e) => e && e.includes('@'));

    if (toList.length === 0) {
      logger.warn('notifyManagersChoThanhToan: không có người nhận (OWNER/MANAGER) hợp lệ.');
      return;
    }

    const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const link = `${appUrl}/de-xuat/duyet`;

    const from = process.env.SMTP_FROM || `ARI Finance <${process.env.SMTP_USER}>`;

    await transporter.sendMail({
      from,
      to: toList.join(', '),
      subject: `🔔 Phiếu chi ${proposal.maPhieu} cần thanh toán — ${formatVND(proposal.soTien)}`,
      html: buildEmailHtml(proposal, link),
    });

    logger.info(
      `notifyManagersChoThanhToan: đã gửi email phiếu ${proposal.maPhieu} tới ${toList.length} người.`
    );
  } catch (error) {
    logger.error('notifyManagersChoThanhToan', error);
  }
}

/**
 * Gửi email "Báo cáo sáng" cho Owner + Manager.
 * @param {{ data: object, ai: object|null, preview?: boolean, previewEmail?: string|null }} p
 * @returns {Promise<{ sent: boolean, to?: number, reason?: string }>}
 */
export async function sendMorningBriefing({ data, ai, preview = false, previewEmail = null }) {
  try {
    const transporter = getTransporter();
    if (!transporter) {
      logger.warn('sendMorningBriefing: chưa cấu hình SMTP → bỏ qua.');
      return { sent: false, reason: 'no-smtp' };
    }

    const toList = preview
      ? (previewEmail && previewEmail.includes('@') ? [previewEmail] : [])
      : await getManagerRecipients();

    if (!toList.length) {
      logger.warn('sendMorningBriefing: không có người nhận hợp lệ.');
      return { sent: false, reason: 'no-recipients' };
    }

    const d = data?.ngay instanceof Date ? data.ngay : new Date();
    const subject = `☀️ Báo cáo sáng ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} · Call Me Ari`;
    const from = process.env.SMTP_FROM || `ARI Finance <${process.env.SMTP_USER}>`;

    await transporter.sendMail({
      from,
      to: toList.join(', '),
      subject,
      html: buildMorningBriefingHTML(data, ai),
    });

    logger.info(`sendMorningBriefing: đã gửi tới ${toList.length} người${preview ? ' (preview)' : ''}.`);
    return { sent: true, to: toList.length };
  } catch (error) {
    logger.error('sendMorningBriefing', error);
    return { sent: false, reason: 'send-error' };
  }
}

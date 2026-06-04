import nodemailer from 'nodemailer';
import { prisma } from './prisma';
import { logger } from './logger';

/**
 * Gửi email qua Gmail SMTP (nodemailer).
 *
 * Cấu hình trong .env:
 *   SMTP_USER  = email Gmail dùng để gửi (vd: callmeari.office@gmail.com)
 *   SMTP_PASS  = "App Password" 16 ký tự tạo trong Google Account (KHÔNG phải mật khẩu đăng nhập)
 *   SMTP_FROM  = (tuỳ chọn) tên hiển thị người gửi, vd: "Ari-Finance <callmeari.office@gmail.com>"
 *   APP_URL    = địa chỉ web app để tạo link bấm vào, vd: http://localhost:3000 hoặc https://...
 */

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
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(d));
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
    mb: 'mbb', mbbank: 'mbb', vpb: 'vpbank', hdb: 'hdbank',
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
      <td style="padding:6px 0 6px 14px;color:#3d3733;font-size:13px;font-weight:700;text-align:right;word-break:break-all;">${value}</td>
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
      <td style="padding:10px 0 10px 16px;color:#111827;font-size:14px;font-weight:600;text-align:right;">${value}</td>
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
            <div style="color:rgba(255,255,255,0.85);font-size:13px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">Ari-Finance</div>
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
            <div style="color:#9ca3af;font-size:12px;">Email tự động từ hệ thống Ari-Finance — vui lòng không trả lời email này.</div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Gửi email thông báo cho tất cả OWNER + MANAGER (đang ACTIVE, có email)
 * khi một phiếu chi mới được tạo ở trạng thái "Chờ thanh toán".
 *
 * Không throw — mọi lỗi chỉ ghi log để KHÔNG làm hỏng luồng tạo phiếu.
 */
export async function notifyManagersChoThanhToan(proposalId) {
  try {
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

    const from = process.env.SMTP_FROM || `Ari-Finance <${process.env.SMTP_USER}>`;

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

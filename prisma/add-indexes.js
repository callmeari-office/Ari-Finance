// Migration nhỏ: thêm INDEX cho các cột hay lọc/sắp xếp để tăng tốc truy vấn
// (danh sách đề xuất, báo cáo, cảnh báo, lợi nhuận). Idempotent — an toàn chạy lại.
// Tên index đặt theo đúng quy ước Prisma (Model_cot_idx) để khớp với @@index trong schema.
// Chạy: node prisma/add-indexes.js
require('dotenv').config();
const { Pool } = require('pg');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const statements = [
  // DeXuatChiPhi — lọc theo trạng thái, ngày, người tạo, danh mục, hạn thanh toán
  'CREATE INDEX IF NOT EXISTS "DeXuatChiPhi_trangThai_idx" ON "DeXuatChiPhi" ("trangThai");',
  'CREATE INDEX IF NOT EXISTS "DeXuatChiPhi_ngayPhatSinh_idx" ON "DeXuatChiPhi" ("ngayPhatSinh");',
  'CREATE INDEX IF NOT EXISTS "DeXuatChiPhi_nguoiTaoId_idx" ON "DeXuatChiPhi" ("nguoiTaoId");',
  'CREATE INDEX IF NOT EXISTS "DeXuatChiPhi_danhMucId_idx" ON "DeXuatChiPhi" ("danhMucId");',
  'CREATE INDEX IF NOT EXISTS "DeXuatChiPhi_ngayCanThanhToan_idx" ON "DeXuatChiPhi" ("ngayCanThanhToan");',
  // ThuChi — báo cáo & cảnh báo gom theo ngày, danh mục, quỹ, loại giao dịch
  'CREATE INDEX IF NOT EXISTS "ThuChi_ngayGiaoDich_idx" ON "ThuChi" ("ngayGiaoDich");',
  'CREATE INDEX IF NOT EXISTS "ThuChi_danhMucId_idx" ON "ThuChi" ("danhMucId");',
  'CREATE INDEX IF NOT EXISTS "ThuChi_quyId_idx" ON "ThuChi" ("quyId");',
  'CREATE INDEX IF NOT EXISTS "ThuChi_loaiGiaoDich_ngayGiaoDich_idx" ON "ThuChi" ("loaiGiaoDich", "ngayGiaoDich");',
];

async function main() {
  for (const sql of statements) {
    await pool.query(sql);
    console.log('✓ ' + sql);
  }
  console.log('\nHoàn tất: đã thêm các index (hoặc đã tồn tại sẵn).');
  await pool.end();
}

main().catch((e) => {
  console.error('Lỗi migration index:', e);
  process.exit(1);
});

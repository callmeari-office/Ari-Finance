/**
 * Script xóa phiếu chi lịch sử (laLichSu=true) theo danh sách maPhieu.
 * Chạy: node scripts/delete-lichsu-phieu.mjs
 *
 * Yêu cầu: DATABASE_URL trong .env (hoặc biến môi trường).
 * Thực hiện DRY RUN trước, hỏi xác nhận trước khi xóa thật.
 */

import 'dotenv/config';
import pg from 'pg';
import readline from 'readline';

const MA_PHIEU_XOA = [
  'CP2606-0380',
  'CP2606-0381',
  'CP2606-0383',
  'CP2606-0382',
  'CP2606-0384',
  'CP2606-0385',
  'CP2606-0285',
  'CP2606-0284',
  'CP2606-0391',
  'CP2606-0389',
  'CP2606-0390',
  'CP2606-0388',
  'CP2606-0392',
];

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function dryRun(client) {
  const placeholders = MA_PHIEU_XOA.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await client.query(
    `SELECT id, "maPhieu", "soTien", "trangThai", "laLichSu", "thuChiId", "ngayPhatSinh", "noiDung"
     FROM "DeXuatChiPhi"
     WHERE "maPhieu" IN (${placeholders})
     ORDER BY "maPhieu"`,
    MA_PHIEU_XOA
  );

  console.log('\n===== KẾT QUẢ TÌM KIẾM =====');
  console.log(`Tìm thấy: ${rows.length}/${MA_PHIEU_XOA.length} phiếu\n`);

  const notFound = MA_PHIEU_XOA.filter(m => !rows.find(r => r.maPhieu === m));
  if (notFound.length > 0) {
    console.log('⚠️  KHÔNG TÌM THẤY:', notFound.join(', '));
  }

  for (const r of rows) {
    const soTienFmt = Number(r.soTien).toLocaleString('vi-VN');
    const ngay = new Date(r.ngayPhatSinh).toLocaleDateString('vi-VN');
    const coThuChi = r.thuChiId ? `✅ có ThuChi (${r.thuChiId.slice(0, 8)}...)` : '⬜ chưa có ThuChi';
    console.log(`  ${r.maPhieu} | ${soTienFmt}đ | ${r.trangThai} | ${r.laLichSu ? 'Lịch sử' : 'Thường'} | ${ngay}`);
    console.log(`           "${r.noiDung}" — ${coThuChi}`);
  }

  const notLichSu = rows.filter(r => !r.laLichSu);
  if (notLichSu.length > 0) {
    console.log('\n🚫 CẢnh BÁO: Các phiếu sau KHÔNG phải lịch sử (laLichSu=false), sẽ bị bỏ qua:');
    notLichSu.forEach(r => console.log(`   - ${r.maPhieu}`));
  }

  return rows.filter(r => r.laLichSu);
}

async function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, ans => { rl.close(); resolve(ans.trim().toLowerCase()); });
  });
}

async function deleteRecords(client, rows) {
  console.log('\n===== BẮT ĐẦU XÓA =====');
  for (const r of rows) {
    await client.query('BEGIN');
    try {
      // Bước 1: xóa ThuChi liên kết (nếu có) — buTruLichSu=true
      if (r.thuChiId) {
        await client.query(`DELETE FROM "ThuChi" WHERE id = $1`, [r.thuChiId]);
        console.log(`  ✓ Đã xóa ThuChi ${r.thuChiId.slice(0, 8)}... của ${r.maPhieu}`);
      }

      // Bước 2: xóa DeXuatChiPhi
      await client.query(`DELETE FROM "DeXuatChiPhi" WHERE id = $1`, [r.id]);
      console.log(`  ✓ Đã xóa phiếu ${r.maPhieu} — ${Number(r.soTien).toLocaleString('vi-VN')}đ`);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  ✗ Lỗi khi xóa ${r.maPhieu}:`, err.message);
    }
  }
  console.log('\n✅ Hoàn tất. Bạn có thể tạo lại theo quy trình chuẩn.');
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ Thiếu DATABASE_URL. Tạo file .env với DATABASE_URL="postgresql://..."');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    const toDelete = await dryRun(client);

    if (toDelete.length === 0) {
      console.log('\nKhông có phiếu nào hợp lệ để xóa.');
      return;
    }

    console.log(`\n⚠️  Sắp xóa vĩnh viễn ${toDelete.length} phiếu chi lịch sử.`);
    const ans = await confirm('Xác nhận xóa? Gõ "xoa" để tiếp tục: ');
    if (ans !== 'xoa') {
      console.log('Đã hủy. Không có gì bị xóa.');
      return;
    }

    await deleteRecords(client, toDelete);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readRoute = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('approval routes guard against duplicate approval races', () => {
  it('single approval conditionally claims an approvable proposal inside the transaction', () => {
    const source = readRoute('src/app/api/de-xuat/[id]/route.js');

    expect(source).toContain('tx.deXuatChiPhi.updateMany({');
    expect(source).toContain('thuChiId: null');
    expect(source).toContain("trangThai: { in: ['CHO_THANH_TOAN', 'DA_THANH_TOAN'] }");
    expect(source).toContain('if (claimed.count !== 1)');
  });

  it('bulk approval conditionally claims each proposal inside the transaction', () => {
    const source = readRoute('src/app/api/de-xuat/duyet-nhieu/route.js');

    expect(source).toContain('tx.deXuatChiPhi.updateMany({');
    expect(source).toContain('thuChiId: null');
    expect(source).toContain("trangThai: { in: ['CHO_THANH_TOAN', 'DA_THANH_TOAN'] }");
    expect(source).toContain('if (claimed.count !== 1)');
  });
});

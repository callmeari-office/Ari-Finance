import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('finance actual expense source invariants', () => {
  it('/api/ke-hoach excludes balance-neutral history offset ThuChi rows', () => {
    const source = read('src/app/api/ke-hoach/route.js');

    expect(source).toContain('"loaiGiaoDich" = \'CHI\'');
    expect(source).toContain('"buTruLichSu" = false');
    expect(source).toContain('"laLichSu" = true');
    expect(source).toContain('"thuChiId" IS NULL');
  });

  it('/api/thu-chi includeHistory excludes balance-neutral history offset rows from report stats', () => {
    const source = read('src/app/api/thu-chi/route.js');

    expect(source).toContain('where.buTruLichSu = false');
  });
});

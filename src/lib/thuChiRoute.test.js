import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('thu-chi THU flow', () => {
  it('does not create dashboard internal notifications for direct THU receipts', () => {
    const routePath = path.resolve(process.cwd(), 'src/app/api/thu-chi/route.js');
    const source = fs.readFileSync(routePath, 'utf8');

    expect(source).not.toContain('createThuCreatedInternalNotification({');
  });
});

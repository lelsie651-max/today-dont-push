import { describe, expect, it } from 'vitest';
import { DOMAIN_PACKAGE_NAME } from './index.js';

describe('domain 包占位', () => {
  it('包可被正常导入并导出占位标识', () => {
    expect(DOMAIN_PACKAGE_NAME).toBe('@today-dont-push/domain');
  });
});

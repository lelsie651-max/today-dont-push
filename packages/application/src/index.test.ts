import { describe, expect, it } from 'vitest';
import { APPLICATION_PACKAGE_NAME, describeApplicationLayer } from './index.js';

describe('application 包占位', () => {
  it('包可被正常导入并导出占位标识', () => {
    expect(APPLICATION_PACKAGE_NAME).toBe('@today-dont-push/application');
  });

  it('依赖方向为 application → domain', () => {
    expect(describeApplicationLayer()).toContain('@today-dont-push/domain');
  });
});

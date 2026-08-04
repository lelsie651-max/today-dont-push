import { describe, expect, it } from 'vitest';
import { HealthResponseSchema } from './index.js';

describe('HealthResponseSchema', () => {
  it('解析合法的健康检查响应', () => {
    const parsed = HealthResponseSchema.parse({ status: 'ok', service: 'api' });
    expect(parsed).toEqual({ status: 'ok', service: 'api' });
  });

  it('拒绝非法的健康检查响应', () => {
    expect(() => HealthResponseSchema.parse({ status: 'down', service: 'api' })).toThrow();
    expect(() => HealthResponseSchema.parse({})).toThrow();
  });

  it('service 必须为字面量 api', () => {
    expect(() => HealthResponseSchema.parse({ status: 'ok', service: 'web' })).toThrow();
    expect(() => HealthResponseSchema.parse({ status: 'ok', service: '' })).toThrow();
  });
});

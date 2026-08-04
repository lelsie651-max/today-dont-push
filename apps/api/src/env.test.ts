import { describe, expect, it } from 'vitest';
import { parseApiEnv } from './env.js';

const validSource = {
  PORT: '4000',
  HOST: '127.0.0.1',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/today_dont_push',
};

describe('parseApiEnv', () => {
  it('解析合法环境变量并将 PORT 转为整数', () => {
    const env = parseApiEnv(validSource);
    expect(env.PORT).toBe(4000);
    expect(env.HOST).toBe('127.0.0.1');
    expect(env.DATABASE_URL).toBe(validSource.DATABASE_URL);
  });

  it('PORT/HOST 缺省时使用默认值', () => {
    const env = parseApiEnv({ DATABASE_URL: validSource.DATABASE_URL });
    expect(env.PORT).toBe(3001);
    expect(env.HOST).toBe('0.0.0.0');
  });

  it('拒绝超出 1-65535 范围的 PORT', () => {
    for (const port of ['0', '65536', '-1']) {
      expect(() => parseApiEnv({ ...validSource, PORT: port })).toThrow(/PORT/);
    }
  });

  it('拒绝非整数的 PORT', () => {
    for (const port of ['abc', '3001.5', '']) {
      expect(() => parseApiEnv({ ...validSource, PORT: port })).toThrow(/PORT/);
    }
  });

  it('拒绝缺少 DATABASE_URL', () => {
    expect(() => parseApiEnv({ PORT: '3001', HOST: '0.0.0.0' })).toThrow(/DATABASE_URL/);
  });

  it('拒绝非 postgres 协议的 DATABASE_URL', () => {
    expect(() => parseApiEnv({ ...validSource, DATABASE_URL: 'mysql://u:p@h/db' })).toThrow(
      /DATABASE_URL/,
    );
    expect(() => parseApiEnv({ ...validSource, DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
  });

  it('接受 postgres:// 与 postgresql:// 协议', () => {
    expect(
      parseApiEnv({ ...validSource, DATABASE_URL: 'postgres://u:p@localhost/db' }).DATABASE_URL,
    ).toBe('postgres://u:p@localhost/db');
    expect(parseApiEnv(validSource).DATABASE_URL).toBe(validSource.DATABASE_URL);
  });
});

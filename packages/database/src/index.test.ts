import { describe, expect, it } from 'vitest';
import { schema } from './schema.js';

describe('database schema 占位', () => {
  it('本轮未定义任何业务表', () => {
    expect(Object.keys(schema)).toHaveLength(0);
  });
});

import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/** 仓库根目录（src/ 与 dist/ 均位于 apps/api 下，距根三层）。 */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** 根目录 .env 文件路径。 */
export const ROOT_ENV_PATH = resolve(repoRoot, '.env');

const PORT_MIN = 1;
const PORT_MAX = 65535;

const ApiEnvSchema = z.object({
  PORT: z.coerce.number().int().min(PORT_MIN).max(PORT_MAX).default(3001),
  HOST: z.string().min(1).default('0.0.0.0'),
  DATABASE_URL: z
    .string()
    .min(1)
    .refine((value) => /^postgres(ql)?:\/\//.test(value), {
      message: 'DATABASE_URL 必须以 postgres:// 或 postgresql:// 开头',
    }),
});

export type ApiEnv = z.output<typeof ApiEnvSchema>;

/**
 * 纯解析函数：校验并规范化环境变量，失败时抛出带明细的错误。
 * 不读取 process.env，便于单元测试注入任意来源。
 */
export function parseApiEnv(source: Record<string, string | undefined>): ApiEnv {
  const result = ApiEnvSchema.safeParse({
    PORT: source.PORT,
    HOST: source.HOST,
    DATABASE_URL: source.DATABASE_URL,
  });
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `- ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`环境变量校验失败:\n${details}`);
  }
  return result.data;
}

/**
 * 启动时调用：加载仓库根目录 .env 后校验环境变量。
 * 校验失败直接抛错，API 拒绝启动（进程以非零码退出）。
 * 本轮不读取、不要求任何 AI Key（包括 DeepSeek Key）。
 */
export function loadApiEnv(): ApiEnv {
  config({ path: ROOT_ENV_PATH });
  return parseApiEnv(process.env);
}

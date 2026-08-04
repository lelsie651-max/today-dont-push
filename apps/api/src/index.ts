import { loadApiEnv, type ApiEnv } from './env.js';
import { buildServer } from './server.js';

/**
 * 启动入口：先加载仓库根目录 .env 并用 Zod 校验环境变量，
 * 校验失败时输出错误明细并以非零码退出，API 拒绝启动。
 * 本轮不读取、不要求任何 AI Key（包括 DeepSeek Key）。
 */
let env: ApiEnv;
try {
  env = loadApiEnv();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error('API 启动中止：请检查仓库根目录 .env（可由 .env.example 复制）。');
  process.exit(1);
}

const server = buildServer();

server
  .listen({ host: env.HOST, port: env.PORT })
  .then((address) => {
    server.log.info(`api listening on ${address}`);
  })
  .catch((error: unknown) => {
    server.log.error(error);
    process.exit(1);
  });

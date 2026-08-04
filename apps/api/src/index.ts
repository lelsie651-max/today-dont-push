import { buildServer } from './server.js';

const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 3001);

const server = buildServer();

server
  .listen({ host, port })
  .then((address) => {
    server.log.info(`api listening on ${address}`);
  })
  .catch((error: unknown) => {
    server.log.error(error);
    process.exit(1);
  });

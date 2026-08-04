import { randomUUID } from 'node:crypto';
import { promises as nodeFs } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import {
  serializeSceneLayoutDocument,
  validateSceneLayoutDocument,
} from '../src/features/space/scene-layout';

export const SCENE_LAYOUT_DEV_ENDPOINT = '/__dev/scene-layout';
export const SCENE_LAYOUT_DEV_REQUEST_LIMIT_BYTES = 256 * 1024;
export const SCENE_LAYOUT_DEV_MAX_BACKUPS = 20;
export const SCENE_LAYOUT_FILE_RELATIVE_PATH = path.join(
  'apps',
  'web',
  'src',
  'features',
  'space',
  'scene-layout.json',
);
export const SCENE_LAYOUT_BACKUP_RELATIVE_DIR = path.join(
  'apps',
  'web',
  '.scene-layout-backups',
);

export interface SceneLayoutDevFileSystem {
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, contents: string): Promise<void>;
  rename(sourcePath: string, destinationPath: string): Promise<void>;
  mkdir(directoryPath: string): Promise<void>;
  readdir(directoryPath: string): Promise<string[]>;
  unlink(filePath: string): Promise<void>;
}

export interface SceneLayoutDevPluginOptions {
  readonly projectRoot: string;
  readonly requestLimitBytes?: number;
  readonly maxBackups?: number;
  readonly now?: () => Date;
  readonly fileSystem?: SceneLayoutDevFileSystem;
  readonly uniqueIdFactory?: () => string;
  readonly saveQueue?: SceneLayoutSaveQueue;
}

export interface SceneLayoutDevHttpRequest {
  readonly method?: string;
  readonly headers?: Record<string, string | string[] | undefined>;
  readonly bodyText: string;
  readonly allowedOrigin?: string | null;
}

export interface SceneLayoutDevHttpResponse {
  readonly status: number;
  readonly body: string;
  readonly headers: Record<string, string>;
}

export interface SceneLayoutWriteSuccess {
  readonly ok: true;
  readonly backupFileName: string;
  readonly message: string;
}

export interface SceneLayoutWriteFailure {
  readonly ok: false;
  readonly status: 400 | 500;
  readonly message: string;
  readonly errors?: readonly string[];
}

export type SceneLayoutWriteResult = SceneLayoutWriteSuccess | SceneLayoutWriteFailure;

export interface SceneLayoutSaveQueue {
  enqueue<T>(task: () => Promise<T>): Promise<T>;
}

const defaultFileSystem: SceneLayoutDevFileSystem = {
  async readFile(filePath) {
    return nodeFs.readFile(filePath, 'utf8');
  },
  async writeFile(filePath, contents) {
    await nodeFs.writeFile(filePath, contents, 'utf8');
  },
  async rename(sourcePath, destinationPath) {
    await nodeFs.rename(sourcePath, destinationPath);
  },
  async mkdir(directoryPath) {
    await nodeFs.mkdir(directoryPath, { recursive: true });
  },
  async readdir(directoryPath) {
    return nodeFs.readdir(directoryPath);
  },
  async unlink(filePath) {
    await nodeFs.unlink(filePath);
  },
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getHeaderValue(
  headers: SceneLayoutDevHttpRequest['headers'],
  key: string,
) {
  const value = headers?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function jsonResponse(
  status: number,
  payload: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
): SceneLayoutDevHttpResponse {
  return {
    status,
    body: `${JSON.stringify(payload)}\n`,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  };
}

function createBackupTimestamp(now: Date) {
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    'T',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
    '_',
    String(now.getMilliseconds()).padStart(3, '0'),
  ];

  return parts.join('');
}

const SCENE_LAYOUT_BACKUP_FILE_PATTERN = /^scene-layout\.\d{8}T\d{6}_\d{3}(?:\.[A-Za-z0-9_-]+)?\.json$/;

function sanitizeUniqueId(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, '_');
}

function createUniqueId(uniqueIdFactory?: () => string) {
  return sanitizeUniqueId(uniqueIdFactory?.() ?? randomUUID());
}

function createWritePaths(projectRoot: string) {
  return {
    layoutFilePath: path.resolve(projectRoot, SCENE_LAYOUT_FILE_RELATIVE_PATH),
    backupDirPath: path.resolve(projectRoot, SCENE_LAYOUT_BACKUP_RELATIVE_DIR),
  };
}

async function safeUnlink(fileSystem: SceneLayoutDevFileSystem, filePath: string) {
  try {
    await fileSystem.unlink(filePath);
  } catch {
    // 删除临时文件失败不应覆盖主错误。
  }
}

async function trimOldBackups(
  fileSystem: SceneLayoutDevFileSystem,
  backupDirPath: string,
  maxBackups: number,
) {
  const fileNames = (await fileSystem.readdir(backupDirPath))
    .filter((fileName) => SCENE_LAYOUT_BACKUP_FILE_PATTERN.test(fileName))
    .sort()
    .reverse();

  await Promise.all(
    fileNames.slice(maxBackups).map((fileName) =>
      safeUnlink(fileSystem, path.join(backupDirPath, fileName)),
    ),
  );
}

export function createSceneLayoutSaveQueue(): SceneLayoutSaveQueue {
  let tail = Promise.resolve();

  return {
    async enqueue<T>(task: () => Promise<T>) {
      const run = tail.catch(() => undefined).then(task);
      tail = run.then(() => undefined, () => undefined);
      return run;
    },
  };
}

export async function saveSceneLayoutDocumentToProject(
  input: unknown,
  options: SceneLayoutDevPluginOptions,
): Promise<SceneLayoutWriteResult> {
  const validation = validateSceneLayoutDocument(input);
  if (!validation.ok || validation.document === null) {
    return {
      ok: false,
      status: 400,
      message: '布局校验失败，未写入工程文件。',
      errors: validation.errors,
    };
  }

  const now = options.now ?? (() => new Date());
  const fileSystem = options.fileSystem ?? defaultFileSystem;
  const { layoutFilePath, backupDirPath } = createWritePaths(options.projectRoot);
  const serialized = serializeSceneLayoutDocument(validation.document);
  const timestamp = createBackupTimestamp(now());
  const uniqueId = createUniqueId(options.uniqueIdFactory);
  const backupFileName = `scene-layout.${timestamp}.${uniqueId}.json`;
  const backupFilePath = path.join(backupDirPath, backupFileName);
  const tempFilePath = `${layoutFilePath}.${timestamp}.${uniqueId}.tmp`;
  const swapFilePath = `${layoutFilePath}.${timestamp}.${uniqueId}.swap`;

  let movedOriginal = false;

  try {
    const currentContents = await fileSystem.readFile(layoutFilePath);
    await fileSystem.mkdir(backupDirPath);
    await fileSystem.writeFile(backupFilePath, currentContents);
    await trimOldBackups(
      fileSystem,
      backupDirPath,
      options.maxBackups ?? SCENE_LAYOUT_DEV_MAX_BACKUPS,
    );

    await fileSystem.writeFile(tempFilePath, serialized);
    await fileSystem.rename(layoutFilePath, swapFilePath);
    movedOriginal = true;
    await fileSystem.rename(tempFilePath, layoutFilePath);

    const savedContents = await fileSystem.readFile(layoutFilePath);
    const savedValidation = validateSceneLayoutDocument(JSON.parse(savedContents) as unknown);
    if (!savedValidation.ok || savedValidation.document === null) {
      throw new Error('saved_layout_invalid');
    }

    if (serializeSceneLayoutDocument(savedValidation.document) !== serialized) {
      throw new Error('saved_layout_mismatch');
    }

    await safeUnlink(fileSystem, swapFilePath);

    return {
      ok: true,
      backupFileName,
      message: '已保存到scene-layout.json，Git现在可以看到修改。',
    };
  } catch {
    await safeUnlink(fileSystem, tempFilePath);

    if (movedOriginal) {
      await safeUnlink(fileSystem, layoutFilePath);
      try {
        await fileSystem.rename(swapFilePath, layoutFilePath);
      } catch {
        return {
          ok: false,
          status: 500,
          message: '写入工程文件失败，且未能自动恢复原始布局，请检查本地备份目录。',
        };
      }
    }

    return {
      ok: false,
      status: 500,
      message: '写入工程文件失败，原始布局已保持不变。',
    };
  }
}

export async function handleSceneLayoutDevRequest(
  request: SceneLayoutDevHttpRequest,
  options: SceneLayoutDevPluginOptions,
): Promise<SceneLayoutDevHttpResponse> {
  if ((request.method ?? 'GET').toUpperCase() !== 'POST') {
    return jsonResponse(
      405,
      {
        status: 'method_not_allowed',
        message: '该接口仅接受 POST 请求。',
      },
      {
        allow: 'POST',
      },
    );
  }

  const contentType = getHeaderValue(request.headers, 'content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return jsonResponse(415, {
      status: 'unsupported_media_type',
      message: '该接口仅接受 application/json 请求体。',
    });
  }

  const bodySize = Buffer.byteLength(request.bodyText, 'utf8');
  if (bodySize > (options.requestLimitBytes ?? SCENE_LAYOUT_DEV_REQUEST_LIMIT_BYTES)) {
    return jsonResponse(413, {
      status: 'payload_too_large',
      message: '请求体超过 256KB 上限。',
    });
  }

  const origin = getHeaderValue(request.headers, 'origin');
  if (origin !== undefined && request.allowedOrigin !== undefined && request.allowedOrigin !== null) {
    if (origin !== request.allowedOrigin) {
      return jsonResponse(403, {
        status: 'forbidden_origin',
        message: '请求来源无效，已拒绝写入工程文件。',
      });
    }
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(request.bodyText) as unknown;
  } catch {
    return jsonResponse(400, {
      status: 'invalid_json',
      message: '请求体不是合法 JSON。',
    });
  }

  if (!isPlainObject(parsedBody) || !('document' in parsedBody)) {
    return jsonResponse(400, {
      status: 'invalid_request',
      message: '请求体必须提供 document 字段。',
    });
  }

  const requestKeys = Object.keys(parsedBody);
  if (requestKeys.length !== 1 || requestKeys[0] !== 'document') {
    return jsonResponse(400, {
      status: 'invalid_request',
      message: '请求体只允许提供 document 字段。',
    });
  }

  const saveQueue = options.saveQueue;
  const writeResult = saveQueue === undefined
    ? await saveSceneLayoutDocumentToProject(parsedBody.document, options)
    : await saveQueue.enqueue(() => saveSceneLayoutDocumentToProject(parsedBody.document, options));
  if (!writeResult.ok) {
    return jsonResponse(writeResult.status, {
      status: writeResult.status === 400 ? 'invalid_layout' : 'write_failed',
      message: writeResult.message,
      ...(writeResult.errors ? { errors: writeResult.errors } : {}),
    });
  }

  return jsonResponse(200, {
    status: 'ok',
    message: writeResult.message,
    backupFileName: writeResult.backupFileName,
  });
}

async function readRequestBody(
  request: IncomingMessage,
  limitBytes: number,
): Promise<
  | { readonly ok: true; readonly bodyText: string }
  | { readonly ok: false; readonly response: SceneLayoutDevHttpResponse }
> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;

    if (totalBytes > limitBytes) {
      return {
        ok: false,
        response: jsonResponse(413, {
          status: 'payload_too_large',
          message: '请求体超过 256KB 上限。',
        }),
      };
    }

    chunks.push(buffer);
  }

  return {
    ok: true,
    bodyText: Buffer.concat(chunks).toString('utf8'),
  };
}

function writeHttpResponse(
  response: ServerResponse,
  payload: SceneLayoutDevHttpResponse,
) {
  response.statusCode = payload.status;
  Object.entries(payload.headers).forEach(([key, value]) => {
    response.setHeader(key, value);
  });
  response.end(payload.body);
}

function getAllowedOrigin(request: IncomingMessage, server: ViteDevServer) {
  const host = request.headers.host;
  if (host === undefined) {
    return null;
  }

  const protocol = server.config.server.https ? 'https' : 'http';
  return `${protocol}://${host}`;
}

export function createSceneLayoutDevPlugin(
  options: SceneLayoutDevPluginOptions,
): Plugin {
  const saveQueue = options.saveQueue ?? createSceneLayoutSaveQueue();

  return {
    name: 'scene-layout-dev-plugin',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = request.url === undefined
          ? ''
          : request.url.split('?')[0] ?? '';
        if (pathname !== SCENE_LAYOUT_DEV_ENDPOINT) {
          next();
          return;
        }

        const bodyResult = await readRequestBody(
          request,
          options.requestLimitBytes ?? SCENE_LAYOUT_DEV_REQUEST_LIMIT_BYTES,
        );
        if (!bodyResult.ok) {
          writeHttpResponse(response, bodyResult.response);
          return;
        }

        const payload = await handleSceneLayoutDevRequest(
          {
            method: request.method,
            headers: request.headers,
            bodyText: bodyResult.bodyText,
            allowedOrigin: getAllowedOrigin(request, server),
          },
          {
            ...options,
            saveQueue,
          },
        );
        writeHttpResponse(response, payload);
      });
    },
  };
}

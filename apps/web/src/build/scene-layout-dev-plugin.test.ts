import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  SCENE_LAYOUT_BACKUP_RELATIVE_DIR,
  SCENE_LAYOUT_DEV_MAX_BACKUPS,
  SCENE_LAYOUT_DEV_REQUEST_LIMIT_BYTES,
  SCENE_LAYOUT_FILE_RELATIVE_PATH,
  createSceneLayoutSaveQueue,
  handleSceneLayoutDevRequest,
  saveSceneLayoutDocumentToProject,
  type SceneLayoutDevFileSystem,
} from '../../build/scene-layout-dev-plugin';
import {
  defaultSceneLayoutDocument,
  serializeSceneLayoutDocument,
  validateSceneLayoutDocument,
} from '../features/space/scene-layout';

async function createTempProjectRoot() {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'scene-layout-dev-plugin-'));
  const layoutFilePath = path.join(projectRoot, SCENE_LAYOUT_FILE_RELATIVE_PATH);
  await fs.mkdir(path.dirname(layoutFilePath), { recursive: true });
  await fs.writeFile(layoutFilePath, serializeSceneLayoutDocument(defaultSceneLayoutDocument), 'utf8');
  return projectRoot;
}

async function readLayoutFile(projectRoot: string) {
  return fs.readFile(path.join(projectRoot, SCENE_LAYOUT_FILE_RELATIVE_PATH), 'utf8');
}

async function readBackupFiles(projectRoot: string) {
  const backupDirPath = path.join(projectRoot, SCENE_LAYOUT_BACKUP_RELATIVE_DIR);
  try {
    return (await fs.readdir(backupDirPath)).sort();
  } catch {
    return [];
  }
}

async function removeTempProjectRoot(projectRoot: string) {
  await fs.rm(projectRoot, { recursive: true, force: true });
}

function createSaveRequest(document: typeof defaultSceneLayoutDocument) {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    bodyText: JSON.stringify({ document }),
  } as const;
}

describe('scene-layout-dev-plugin', () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map(removeTempProjectRoot));
  });

  it('拒绝非 POST 请求', async () => {
    const projectRoot = await createTempProjectRoot();
    tempRoots.push(projectRoot);

    const response = await handleSceneLayoutDevRequest(
      {
        method: 'GET',
        headers: {
          'content-type': 'application/json',
        },
        bodyText: '{}',
      },
      {
        projectRoot,
      },
    );

    expect(response.status).toBe(405);
    expect(response.body).toContain('该接口仅接受 POST 请求');
  });

  it('拒绝超大请求', async () => {
    const projectRoot = await createTempProjectRoot();
    tempRoots.push(projectRoot);

    const response = await handleSceneLayoutDevRequest(
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        bodyText: 'a'.repeat(SCENE_LAYOUT_DEV_REQUEST_LIMIT_BYTES + 1),
      },
      {
        projectRoot,
      },
    );

    expect(response.status).toBe(413);
    expect(response.body).toContain('请求体超过 256KB 上限');
  });

  it('拒绝非法布局', async () => {
    const projectRoot = await createTempProjectRoot();
    tempRoots.push(projectRoot);

    const response = await handleSceneLayoutDevRequest(
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        bodyText: JSON.stringify({
          document: {
            ...defaultSceneLayoutDocument,
            items: {
              ...defaultSceneLayoutDocument.items,
              radio: {
                ...defaultSceneLayoutDocument.items.radio,
                zIndex: Number.MAX_SAFE_INTEGER + 1,
              },
            },
          },
        }),
      },
      {
        projectRoot,
      },
    );

    expect(response.status).toBe(400);
    expect(response.body).toContain('items.radio.zIndex 必须是安全整数');
  });

  it('请求不能指定任意路径', async () => {
    const projectRoot = await createTempProjectRoot();
    tempRoots.push(projectRoot);

    const response = await handleSceneLayoutDevRequest(
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        bodyText: JSON.stringify({
          document: defaultSceneLayoutDocument,
          path: 'C:\\temp\\oops.json',
        }),
      },
      {
        projectRoot,
      },
    );

    expect(response.status).toBe(400);
    expect(response.body).toContain('请求体只允许提供 document 字段');
  });

  it('合法保存会生成备份并更新固定 JSON', async () => {
    const projectRoot = await createTempProjectRoot();
    tempRoots.push(projectRoot);

    const nextDocument = {
      ...defaultSceneLayoutDocument,
      items: {
        ...defaultSceneLayoutDocument.items,
        radio: {
          ...defaultSceneLayoutDocument.items.radio,
          x: 320,
        },
      },
    };

    const result = await saveSceneLayoutDocumentToProject(nextDocument, {
      projectRoot,
      now: () => new Date('2026-08-04T12:34:56.789Z'),
    });

    expect(result.ok).toBe(true);

    const savedContents = await readLayoutFile(projectRoot);
    expect(savedContents).toContain('"x": 320');

    const backups = await readBackupFiles(projectRoot);
    expect(backups).toHaveLength(1);
    expect(backups[0]).toMatch(/^scene-layout\.\d{8}T\d{6}_\d{3}\.[A-Za-z0-9_-]+\.json$/);
  });

  it('写入失败时原文件保持不变', async () => {
    const projectRoot = await createTempProjectRoot();
    tempRoots.push(projectRoot);
    const originalContents = await readLayoutFile(projectRoot);
    const layoutFilePath = path.join(projectRoot, SCENE_LAYOUT_FILE_RELATIVE_PATH);

    const failingFileSystem: SceneLayoutDevFileSystem = {
      async readFile(filePath) {
        return fs.readFile(filePath, 'utf8');
      },
      async writeFile(filePath, contents) {
        await fs.writeFile(filePath, contents, 'utf8');
      },
      async rename(sourcePath, destinationPath) {
        if (sourcePath.endsWith('.tmp') && destinationPath === layoutFilePath) {
          throw new Error('rename_failed');
        }
        await fs.rename(sourcePath, destinationPath);
      },
      async mkdir(directoryPath) {
        await fs.mkdir(directoryPath, { recursive: true });
      },
      async readdir(directoryPath) {
        return fs.readdir(directoryPath);
      },
      async unlink(filePath) {
        await fs.unlink(filePath);
      },
    };

    const nextDocument = {
      ...defaultSceneLayoutDocument,
      items: {
        ...defaultSceneLayoutDocument.items,
        radio: {
          ...defaultSceneLayoutDocument.items.radio,
          x: 400,
        },
      },
    };

    const result = await saveSceneLayoutDocumentToProject(nextDocument, {
      projectRoot,
      fileSystem: failingFileSystem,
      now: () => new Date('2026-08-04T12:34:56.790Z'),
    });

    expect(result.ok).toBe(false);
    expect(result.message).not.toContain(projectRoot);
    expect(await readLayoutFile(projectRoot)).toBe(originalContents);
  });

  it('保存后的文件可被现有校验器重新读取', async () => {
    const projectRoot = await createTempProjectRoot();
    tempRoots.push(projectRoot);

    const nextDocument: typeof defaultSceneLayoutDocument = {
      ...defaultSceneLayoutDocument,
      items: {
        ...defaultSceneLayoutDocument.items,
        radio: {
          ...defaultSceneLayoutDocument.items.radio,
          x: 360,
          y: 620,
        },
      },
    };

    const result = await saveSceneLayoutDocumentToProject(nextDocument, {
      projectRoot,
      now: () => new Date('2026-08-04T12:34:56.791Z'),
    });

    expect(result.ok).toBe(true);

    const savedContents = await readLayoutFile(projectRoot);
    const validation = validateSceneLayoutDocument(JSON.parse(savedContents) as unknown);
    expect(validation.ok).toBe(true);
    expect(validation.document).toEqual(nextDocument);
  });

  it('最多只保留最近 20 份备份', async () => {
    const projectRoot = await createTempProjectRoot();
    tempRoots.push(projectRoot);

    for (let index = 0; index < SCENE_LAYOUT_DEV_MAX_BACKUPS + 2; index += 1) {
      const nextDocument = {
        ...defaultSceneLayoutDocument,
        items: {
          ...defaultSceneLayoutDocument.items,
          radio: {
            ...defaultSceneLayoutDocument.items.radio,
            x: 238 + index,
          },
        },
      };

      const result = await saveSceneLayoutDocumentToProject(nextDocument, {
        projectRoot,
        now: () => new Date(Date.UTC(2026, 7, 4, 12, 34, 56, index)),
      });

      expect(result.ok).toBe(true);
    }

    const backups = await readBackupFiles(projectRoot);
    expect(backups).toHaveLength(SCENE_LAYOUT_DEV_MAX_BACKUPS);
    expect(backups[0]).toContain('_002');
    expect(backups.at(-1)).toContain('_021');
  });

  it('两个服务端并发保存会在同一队列中串行执行', async () => {
    const projectRoot = await createTempProjectRoot();
    tempRoots.push(projectRoot);
    const saveQueue = createSceneLayoutSaveQueue();
    let activeOperations = 0;
    let maxActiveOperations = 0;

    const trackedFileSystem: SceneLayoutDevFileSystem = {
      async readFile(filePath) {
        activeOperations += 1;
        maxActiveOperations = Math.max(maxActiveOperations, activeOperations);
        try {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return await fs.readFile(filePath, 'utf8');
        } finally {
          activeOperations -= 1;
        }
      },
      async writeFile(filePath, contents) {
        activeOperations += 1;
        maxActiveOperations = Math.max(maxActiveOperations, activeOperations);
        try {
          await new Promise((resolve) => setTimeout(resolve, 5));
          await fs.writeFile(filePath, contents, 'utf8');
        } finally {
          activeOperations -= 1;
        }
      },
      async rename(sourcePath, destinationPath) {
        activeOperations += 1;
        maxActiveOperations = Math.max(maxActiveOperations, activeOperations);
        try {
          await new Promise((resolve) => setTimeout(resolve, 5));
          await fs.rename(sourcePath, destinationPath);
        } finally {
          activeOperations -= 1;
        }
      },
      async mkdir(directoryPath) {
        activeOperations += 1;
        maxActiveOperations = Math.max(maxActiveOperations, activeOperations);
        try {
          await new Promise((resolve) => setTimeout(resolve, 5));
          await fs.mkdir(directoryPath, { recursive: true });
        } finally {
          activeOperations -= 1;
        }
      },
      async readdir(directoryPath) {
        activeOperations += 1;
        maxActiveOperations = Math.max(maxActiveOperations, activeOperations);
        try {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return await fs.readdir(directoryPath);
        } finally {
          activeOperations -= 1;
        }
      },
      async unlink(filePath) {
        activeOperations += 1;
        maxActiveOperations = Math.max(maxActiveOperations, activeOperations);
        try {
          await new Promise((resolve) => setTimeout(resolve, 5));
          await fs.unlink(filePath);
        } finally {
          activeOperations -= 1;
        }
      },
    };

    const firstDocument = {
      ...defaultSceneLayoutDocument,
      items: {
        ...defaultSceneLayoutDocument.items,
        radio: {
          ...defaultSceneLayoutDocument.items.radio,
          x: 320,
        },
      },
    };
    const secondDocument = {
      ...defaultSceneLayoutDocument,
      items: {
        ...defaultSceneLayoutDocument.items,
        radio: {
          ...defaultSceneLayoutDocument.items.radio,
          x: 321,
        },
      },
    };

    const [firstResponse, secondResponse] = await Promise.all([
      handleSceneLayoutDevRequest(createSaveRequest(firstDocument), {
        projectRoot,
        fileSystem: trackedFileSystem,
        saveQueue,
      }),
      handleSceneLayoutDevRequest(createSaveRequest(secondDocument), {
        projectRoot,
        fileSystem: trackedFileSystem,
        saveQueue,
      }),
    ]);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(maxActiveOperations).toBe(1);

    const savedContents = await readLayoutFile(projectRoot);
    const validation = validateSceneLayoutDocument(JSON.parse(savedContents) as unknown);
    expect(validation.ok).toBe(true);
    expect(validation.document?.items.radio.x).toBe(321);
  });

  it('第一个保存失败后，队列中的第二个保存仍可继续执行', async () => {
    const projectRoot = await createTempProjectRoot();
    tempRoots.push(projectRoot);
    const layoutFilePath = path.join(projectRoot, SCENE_LAYOUT_FILE_RELATIVE_PATH);
    const saveQueue = createSceneLayoutSaveQueue();
    let failedOnce = false;

    const flakyFileSystem: SceneLayoutDevFileSystem = {
      async readFile(filePath) {
        return fs.readFile(filePath, 'utf8');
      },
      async writeFile(filePath, contents) {
        await fs.writeFile(filePath, contents, 'utf8');
      },
      async rename(sourcePath, destinationPath) {
        if (!failedOnce && sourcePath.endsWith('.tmp') && destinationPath === layoutFilePath) {
          failedOnce = true;
          throw new Error('rename_failed_once');
        }
        await fs.rename(sourcePath, destinationPath);
      },
      async mkdir(directoryPath) {
        await fs.mkdir(directoryPath, { recursive: true });
      },
      async readdir(directoryPath) {
        return fs.readdir(directoryPath);
      },
      async unlink(filePath) {
        await fs.unlink(filePath);
      },
    };

    const failedDocument = {
      ...defaultSceneLayoutDocument,
      items: {
        ...defaultSceneLayoutDocument.items,
        radio: {
          ...defaultSceneLayoutDocument.items.radio,
          x: 500,
        },
      },
    };
    const recoveredDocument = {
      ...defaultSceneLayoutDocument,
      items: {
        ...defaultSceneLayoutDocument.items,
        radio: {
          ...defaultSceneLayoutDocument.items.radio,
          x: 330,
        },
      },
    };

    const [firstResponse, secondResponse] = await Promise.all([
      handleSceneLayoutDevRequest(createSaveRequest(failedDocument), {
        projectRoot,
        fileSystem: flakyFileSystem,
        saveQueue,
      }),
      handleSceneLayoutDevRequest(createSaveRequest(recoveredDocument), {
        projectRoot,
        fileSystem: flakyFileSystem,
        saveQueue,
      }),
    ]);

    expect(firstResponse.status).toBe(500);
    expect(secondResponse.status).toBe(200);

    const savedContents = await readLayoutFile(projectRoot);
    const validation = validateSceneLayoutDocument(JSON.parse(savedContents) as unknown);
    expect(validation.ok).toBe(true);
    expect(validation.document?.items.radio.x).toBe(330);
  });

  it('同一毫秒的两次保存会使用不同的临时文件名', async () => {
    const projectRoot = await createTempProjectRoot();
    tempRoots.push(projectRoot);
    const tempPaths: string[] = [];
    const swapPaths: string[] = [];

    const recordingFileSystem: SceneLayoutDevFileSystem = {
      async readFile(filePath) {
        return fs.readFile(filePath, 'utf8');
      },
      async writeFile(filePath, contents) {
        if (filePath.endsWith('.tmp')) {
          tempPaths.push(filePath);
        }
        await fs.writeFile(filePath, contents, 'utf8');
      },
      async rename(sourcePath, destinationPath) {
        if (destinationPath.endsWith('.swap')) {
          swapPaths.push(destinationPath);
        }
        await fs.rename(sourcePath, destinationPath);
      },
      async mkdir(directoryPath) {
        await fs.mkdir(directoryPath, { recursive: true });
      },
      async readdir(directoryPath) {
        return fs.readdir(directoryPath);
      },
      async unlink(filePath) {
        await fs.unlink(filePath);
      },
    };

    let uniqueIdCounter = 0;
    const nextUniqueId = () => `u${uniqueIdCounter += 1}`;

    const firstResult = await saveSceneLayoutDocumentToProject(defaultSceneLayoutDocument, {
      projectRoot,
      fileSystem: recordingFileSystem,
      now: () => new Date('2026-08-04T12:34:56.999Z'),
      uniqueIdFactory: nextUniqueId,
    });
    const secondResult = await saveSceneLayoutDocumentToProject(defaultSceneLayoutDocument, {
      projectRoot,
      fileSystem: recordingFileSystem,
      now: () => new Date('2026-08-04T12:34:56.999Z'),
      uniqueIdFactory: nextUniqueId,
    });

    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);
    expect(new Set(tempPaths).size).toBe(2);
    expect(new Set(swapPaths).size).toBe(2);
  });

  it('备份清理不会删除备份目录里的无关 JSON 文件', async () => {
    const projectRoot = await createTempProjectRoot();
    tempRoots.push(projectRoot);
    const backupDirPath = path.join(projectRoot, SCENE_LAYOUT_BACKUP_RELATIVE_DIR);
    await fs.mkdir(backupDirPath, { recursive: true });
    await fs.writeFile(path.join(backupDirPath, 'notes.json'), '{}\n', 'utf8');
    await fs.writeFile(
      path.join(backupDirPath, 'scene-layout.manual.json'),
      '{}\n',
      'utf8',
    );
    await fs.writeFile(
      path.join(backupDirPath, 'scene-layout.20260804T123456_001.keep.json'),
      '{}\n',
      'utf8',
    );

    const nextDocument = {
      ...defaultSceneLayoutDocument,
      items: {
        ...defaultSceneLayoutDocument.items,
        radio: {
          ...defaultSceneLayoutDocument.items.radio,
          x: 350,
        },
      },
    };

    const result = await saveSceneLayoutDocumentToProject(nextDocument, {
      projectRoot,
      maxBackups: 1,
      now: () => new Date('2026-08-04T12:34:56.500Z'),
      uniqueIdFactory: () => 'backup-check',
    });

    expect(result.ok).toBe(true);

    const backups = await readBackupFiles(projectRoot);
    expect(backups).toContain('notes.json');
    expect(backups).toContain('scene-layout.manual.json');
    expect(backups).not.toContain('scene-layout.20260804T123456_001.keep.json');
  });
});

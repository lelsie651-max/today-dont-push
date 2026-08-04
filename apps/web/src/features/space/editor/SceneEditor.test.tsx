import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCENE_LAYOUT_DRAFT_STORAGE_KEY } from './scene-editor-storage';
import { defaultSceneLayoutDocument, serializeSceneLayoutDocument } from '../scene-layout';

const documentsEqualMock = vi.hoisted(() =>
  vi.fn((a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)),
);

vi.mock('./scene-editor-state', async () => {
  const actual = await vi.importActual<typeof import('./scene-editor-state')>('./scene-editor-state');
  return {
    ...actual,
    documentsEqual: documentsEqualMock,
  };
});

import { SceneEditor } from './SceneEditor';

function getOverlay(key: string) {
  return screen.getByTestId(`space-editor-target-${key}`);
}

describe('SceneEditor', () => {
  beforeEach(() => {
    window.localStorage.clear();
    documentsEqualMock.mockClear();
    documentsEqualMock.mockImplementation((a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('Hierarchy 会列出全部物件，并支持点击选中', async () => {
    const user = userEvent.setup();
    render(<SceneEditor />);

    expect(screen.getByRole('button', { name: '在层级中选择 radio' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '在层级中选择 window viewport' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '在层级中选择 radio' }));
    expect(screen.getByText('radio', { selector: 'code' })).toBeInTheDocument();
    expect(getOverlay('radio')).toHaveClass('is-selected');
  });

  it('locked 物件在 Inspector 中不能修改几何数值', async () => {
    const user = userEvent.setup();
    render(<SceneEditor />);

    await user.click(screen.getByRole('button', { name: '在层级中选择 room foreground' }));
    expect(screen.getByLabelText('x')).toBeDisabled();
    expect(screen.getByLabelText('width')).toBeDisabled();
  });

  it('visible 切换会影响场景显示', async () => {
    const user = userEvent.setup();
    render(<SceneEditor />);

    expect(screen.getByRole('button', { name: 'radio' })).toBeInTheDocument();
    const hierarchyItem = screen
      .getByRole('button', { name: '在层级中选择 radio' })
      .closest('.scene-editor-hierarchy-row');
    if (!(hierarchyItem instanceof HTMLElement)) {
      throw new Error('radio 层级项不存在');
    }
    await user.click(within(hierarchyItem).getByRole('button', { name: '显示' }));
    expect(screen.queryByRole('button', { name: 'radio' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '在层级中选择 radio' })).toBeInTheDocument();
  });

  it('Inspector 修改 x y width height zIndex 会生效', async () => {
    const user = userEvent.setup();
    render(<SceneEditor />);

    await user.click(screen.getByRole('button', { name: '在层级中选择 radio' }));

    fireEvent.change(screen.getByLabelText('x'), { target: { value: '300' } });
    fireEvent.change(screen.getByLabelText('y'), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText('width'), { target: { value: '520' } });
    fireEvent.change(screen.getByLabelText('zIndex'), { target: { value: '9' } });

    expect(getOverlay('radio')).toHaveStyle({
      left: `${(300 / 1440) * 100}%`,
      top: `${(500 / 900) * 100}%`,
      width: `${(520 / 1440) * 100}%`,
      zIndex: '9',
    });
    expect(getOverlay('radio')).toHaveStyle({
      height: `${(360 / 900) * 100}%`,
    });
  });

  it('Inspector 输入超界值时显示错误且不写入画布', async () => {
    const user = userEvent.setup();
    render(<SceneEditor />);

    await user.click(screen.getByRole('button', { name: '在层级中选择 radio' }));
    fireEvent.change(screen.getByLabelText('x'), { target: { value: '5000' } });

    expect(screen.getByText('x 允许范围为 0-1181px')).toBeInTheDocument();
    expect(getOverlay('radio')).toHaveStyle({
      left: `${(238 / 1440) * 100}%`,
    });
    expect(screen.getByLabelText('x')).toHaveValue('5000');
  });

  it('整数格式错误会显示错误，不写入状态', async () => {
    const user = userEvent.setup();
    render(<SceneEditor />);

    await user.click(screen.getByRole('button', { name: '在层级中选择 radio' }));
    fireEvent.change(screen.getByLabelText('width'), { target: { value: '12.5' } });

    expect(screen.getByText('请输入整数')).toBeInTheDocument();
    expect(getOverlay('radio')).toHaveStyle({
      width: `${(259 / 1440) * 100}%`,
    });
  });

  it('方向键 1px，Shift+方向键 10px', async () => {
    const user = userEvent.setup();
    render(<SceneEditor />);

    await user.click(screen.getByRole('button', { name: '在层级中选择 radio' }));

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    });
    expect(screen.getByLabelText('x')).toHaveValue('239');

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true }));
    });
    expect(screen.getByLabelText('y')).toHaveValue('641');
  });

  it('输入框聚焦时不会触发方向键微调', async () => {
    const user = userEvent.setup();
    render(<SceneEditor />);

    await user.click(screen.getByRole('button', { name: '在层级中选择 radio' }));
    const xInput = screen.getByLabelText('x');
    xInput.focus();

    await act(async () => {
      xInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(screen.getByLabelText('x')).toHaveValue('238');
  });

  it('输入框聚焦时 Ctrl+Z 不会触发场景撤销', async () => {
    const user = userEvent.setup();
    render(<SceneEditor />);

    await user.click(screen.getByRole('button', { name: '在层级中选择 radio' }));
    fireEvent.change(screen.getByLabelText('x'), { target: { value: '300' } });

    const xInput = screen.getByLabelText('x');
    xInput.focus();

    await act(async () => {
      xInput.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true,
      }));
    });

    expect(screen.getByLabelText('x')).toHaveValue('300');
  });

  it('非输入区域 Ctrl+Z 和 Ctrl+Shift+Z 继续正常撤销与重做', async () => {
    const user = userEvent.setup();
    render(<SceneEditor />);

    await user.click(screen.getByRole('button', { name: '在层级中选择 radio' }));
    fireEvent.change(screen.getByLabelText('x'), { target: { value: '300' } });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    });
    expect(screen.getByLabelText('x')).toHaveValue('238');

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        shiftKey: true,
      }));
    });
    expect(screen.getByLabelText('x')).toHaveValue('300');
  });

  it('undo 和 redo 可以正确恢复', async () => {
    const user = userEvent.setup();
    render(<SceneEditor />);

    await user.click(screen.getByRole('button', { name: '在层级中选择 radio' }));
    fireEvent.change(screen.getByLabelText('x'), { target: { value: '300' } });
    expect(screen.getByLabelText('x')).toHaveValue('300');

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByLabelText('x')).toHaveValue('238');

    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(screen.getByLabelText('x')).toHaveValue('300');
  });

  it('草稿会保存、恢复，并且清除草稿不改变当前画布', async () => {
    vi.useFakeTimers();
    const { unmount } = render(<SceneEditor />);

    fireEvent.click(screen.getByRole('button', { name: '在层级中选择 radio' }));
    fireEvent.change(screen.getByLabelText('x'), { target: { value: '320' } });

    act(() => {
      vi.advanceTimersByTime(350);
    });

    const savedDraft = window.localStorage.getItem(SCENE_LAYOUT_DRAFT_STORAGE_KEY);
    expect(savedDraft).toContain('"x": 320');

    unmount();
    render(<SceneEditor />);
    expect(screen.getByText('已恢复本地草稿。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '在层级中选择 radio' }));
    expect(screen.getByLabelText('x')).toHaveValue('320');

    fireEvent.click(screen.getByRole('button', { name: '清除本地草稿' }));
    expect(window.localStorage.getItem(SCENE_LAYOUT_DRAFT_STORAGE_KEY)).toBeNull();
    expect(screen.getByLabelText('x')).toHaveValue('320');
  });

  it('无效草稿不会使页面崩溃', () => {
    window.localStorage.setItem(SCENE_LAYOUT_DRAFT_STORAGE_KEY, '{oops');
    render(<SceneEditor />);

    expect(screen.getByText(/本地草稿已忽略/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '在层级中选择 radio' })).toBeInTheDocument();
  });

  it('读取本地草稿抛错时页面不会崩溃', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    render(<SceneEditor />);

    expect(screen.getByText('浏览器当前拒绝读取本地草稿，已跳过恢复。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '在层级中选择 radio' })).toBeInTheDocument();
  });

  it('自动保存失败时只显示一次非阻塞提示', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    render(<SceneEditor />);
    fireEvent.click(screen.getByRole('button', { name: '在层级中选择 radio' }));
    fireEvent.change(screen.getByLabelText('x'), { target: { value: '320' } });

    await waitFor(() => {
      expect(setItemSpy).toHaveBeenCalledTimes(1);
    });
    expect(
      screen.getByText('浏览器当前拒绝写入本地草稿，未能自动保存草稿。'),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('x'), { target: { value: '321' } });
    await waitFor(() => {
      expect(setItemSpy).toHaveBeenCalledTimes(2);
    });

    expect(
      screen.getAllByText('浏览器当前拒绝写入本地草稿，未能自动保存草稿。'),
    ).toHaveLength(1);
  });

  it('清除本地草稿抛错时页面不会崩溃', async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    render(<SceneEditor />);
    await user.click(screen.getByRole('button', { name: '清除本地草稿' }));

    expect(screen.getByText('浏览器当前拒绝删除本地草稿，未能清除本地草稿。')).toBeInTheDocument();
  });

  it('隐藏已选物件后重新显示，控制框会立即恢复', async () => {
    const user = userEvent.setup();
    render(<SceneEditor />);

    await user.click(screen.getByRole('button', { name: '在层级中选择 radio' }));
    expect(getOverlay('radio')).toHaveClass('is-selected');

    const hierarchyItem = screen
      .getByRole('button', { name: '在层级中选择 radio' })
      .closest('.scene-editor-hierarchy-row');
    if (!(hierarchyItem instanceof HTMLElement)) {
      throw new Error('radio 层级项不存在');
    }

    await user.click(within(hierarchyItem).getByRole('button', { name: '显示' }));
    expect(screen.queryByTestId('space-editor-target-radio')).not.toBeInTheDocument();

    await user.click(within(hierarchyItem).getByRole('button', { name: '隐藏' }));
    expect(screen.getByTestId('space-editor-target-radio')).toHaveClass('is-selected');
  });

  it('导出布局会触发下载', async () => {
    const user = userEvent.setup();
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: vi.fn(() => 'blob:scene-layout'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: vi.fn(),
    });
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    render(<SceneEditor />);
    await user.click(screen.getByRole('button', { name: '导出布局' }));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:scene-layout');
    expect(screen.getByText('布局 JSON 已导出。')).toBeInTheDocument();
  });

  it('修改后不足300ms立即保存，成功后草稿不会被旧定时器重新创建', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: 'ok',
        message: '已保存到scene-layout.json，Git现在可以看到修改。',
      }),
    }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    render(<SceneEditor />);
    fireEvent.click(screen.getByRole('button', { name: '在层级中选择 radio' }));
    fireEvent.change(screen.getByLabelText('x'), { target: { value: '320' } });
    fireEvent.click(screen.getByRole('button', { name: '保存到工程' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestInit = (
      fetchMock.mock.calls as unknown as Array<[unknown, RequestInit | undefined]>
    )[0]?.[1];
    const requestBody = requestInit?.body;
    if (typeof requestBody !== 'string') {
      throw new Error('save request body is missing');
    }
    expect(JSON.parse(requestBody).document.items.radio.x).toBe(320);
    expect(screen.getByText('已保存到scene-layout.json，Git现在可以看到修改。')).toBeInTheDocument();
    expect(window.localStorage.getItem(SCENE_LAYOUT_DRAFT_STORAGE_KEY)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(window.localStorage.getItem(SCENE_LAYOUT_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it('保存期间所有修改入口不可用', async () => {
    const pendingFetch = {
      resolve: null as ((value: Response) => void) | null,
    };
    vi.stubGlobal('fetch', vi.fn(
      () => new Promise<Response>((resolve) => {
        pendingFetch.resolve = resolve;
      }),
    ) as unknown as typeof fetch);

    render(<SceneEditor />);
    fireEvent.click(screen.getByRole('button', { name: '在层级中选择 radio' }));
    fireEvent.click(screen.getByRole('button', { name: '保存到工程' }));
    const hierarchyItem = screen
      .getByRole('button', { name: '在层级中选择 radio' })
      .closest('.scene-editor-hierarchy-row');
    if (!(hierarchyItem instanceof HTMLElement)) {
      throw new Error('radio 层级项不存在');
    }

    expect(screen.getByRole('button', { name: '正在写入工程……' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '恢复默认布局' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '清除本地草稿' })).toBeDisabled();
    expect(within(hierarchyItem).getByRole('button', { name: '显示' })).toBeDisabled();
    expect(within(hierarchyItem).getByRole('button', { name: '未锁定' })).toBeDisabled();
    expect(screen.getByLabelText('x')).toBeDisabled();
    expect(screen.getByLabelText('locked')).toBeDisabled();
    expect(screen.getByRole('button', { name: '正在写入工程……' })).toBeInTheDocument();

    if (pendingFetch.resolve !== null) {
      pendingFetch.resolve({
        ok: true,
        json: async () => ({
          status: 'ok',
          message: '已保存到scene-layout.json，Git现在可以看到修改。',
        }),
      } as Response);
    }

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '保存到工程' })).toBeEnabled();
    });
  });

  it('保存期间方向键与 Ctrl+Z 不改变场景', async () => {
    const pendingFetch = {
      resolve: null as ((value: Response) => void) | null,
    };
    vi.stubGlobal('fetch', vi.fn(
      () => new Promise<Response>((resolve) => {
        pendingFetch.resolve = resolve;
      }),
    ) as unknown as typeof fetch);

    render(<SceneEditor />);
    fireEvent.click(screen.getByRole('button', { name: '在层级中选择 radio' }));
    fireEvent.change(screen.getByLabelText('x'), { target: { value: '320' } });
    fireEvent.click(screen.getByRole('button', { name: '保存到工程' }));

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    });

    expect(screen.getByLabelText('x')).toHaveValue('320');

    if (pendingFetch.resolve !== null) {
      pendingFetch.resolve({
        ok: true,
        json: async () => ({
          status: 'ok',
          message: '已保存到scene-layout.json，Git现在可以看到修改。',
        }),
      } as Response);
    }

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '保存到工程' })).toBeEnabled();
    });
  });

  it('保存到工程时会防止重复提交', async () => {
    const pendingFetch = {
      resolve: null as ((value: Response) => void) | null,
    };
    const fetchMock = vi.fn(
      () => new Promise<Response>((resolve) => {
        pendingFetch.resolve = resolve;
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<SceneEditor />);

    const saveButton = screen.getByRole('button', { name: '保存到工程' });
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '正在写入工程……' })).toBeDisabled();

    if (pendingFetch.resolve !== null) {
      pendingFetch.resolve({
        ok: true,
        json: async () => ({
          status: 'ok',
          message: '已保存到scene-layout.json，Git现在可以看到修改。',
        }),
      } as Response);
    }

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '保存到工程' })).toBeEnabled();
    });
  });

  it('保存成功后会清除本地草稿', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: 'ok',
        message: '已保存到scene-layout.json，Git现在可以看到修改。',
      }),
    })) as unknown as typeof fetch);

    render(<SceneEditor />);
    await user.click(screen.getByRole('button', { name: '在层级中选择 radio' }));
    fireEvent.change(screen.getByLabelText('x'), { target: { value: '320' } });

    await waitFor(() => {
      expect(window.localStorage.getItem(SCENE_LAYOUT_DRAFT_STORAGE_KEY)).toContain('"x": 320');
    });

    await user.click(screen.getByRole('button', { name: '保存到工程' }));

    await waitFor(() => {
      expect(screen.getByText('已保存到scene-layout.json，Git现在可以看到修改。')).toBeInTheDocument();
    });
    expect(window.localStorage.getItem(SCENE_LAYOUT_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it('保存成功但画布异常变化时保留草稿并提示仍有未保存修改', async () => {
    const user = userEvent.setup();
    const pendingFetch = {
      resolve: null as ((value: Response) => void) | null,
    };
    vi.stubGlobal('fetch', vi.fn(
      () => new Promise<Response>((resolve) => {
        pendingFetch.resolve = resolve;
      }),
    ) as unknown as typeof fetch);

    render(<SceneEditor />);
    await user.click(screen.getByRole('button', { name: '在层级中选择 radio' }));
    fireEvent.change(screen.getByLabelText('x'), { target: { value: '320' } });

    await waitFor(() => {
      expect(window.localStorage.getItem(SCENE_LAYOUT_DRAFT_STORAGE_KEY)).toContain('"x": 320');
    });

    await user.click(screen.getByRole('button', { name: '保存到工程' }));
    documentsEqualMock.mockImplementation(() => false);

    if (pendingFetch.resolve !== null) {
      pendingFetch.resolve({
        ok: true,
        json: async () => ({
          status: 'ok',
          message: '已保存到scene-layout.json，Git现在可以看到修改。',
        }),
      } as Response);
    }

    await waitFor(() => {
      expect(screen.getByText('工程已保存，但当前画布还有新的未保存修改。')).toBeInTheDocument();
    });
    expect(window.localStorage.getItem(SCENE_LAYOUT_DRAFT_STORAGE_KEY)).toContain('"x": 320');
  });

  it('保存失败后会恢复自动草稿', async () => {
    vi.useFakeTimers();
    const pendingFetch = {
      resolve: null as ((value: Response) => void) | null,
    };
    vi.stubGlobal('fetch', vi.fn(
      () => new Promise<Response>((resolve) => {
        pendingFetch.resolve = resolve;
      }),
    ) as unknown as typeof fetch);

    render(<SceneEditor />);
    fireEvent.click(screen.getByRole('button', { name: '在层级中选择 radio' }));
    fireEvent.change(screen.getByLabelText('x'), { target: { value: '320' } });
    fireEvent.click(screen.getByRole('button', { name: '保存到工程' }));

    expect(window.localStorage.getItem(SCENE_LAYOUT_DRAFT_STORAGE_KEY)).toBeNull();

    if (pendingFetch.resolve !== null) {
      pendingFetch.resolve({
        ok: false,
        json: async () => ({
          status: 'write_failed',
          message: '写入工程文件失败，原始布局已保持不变。',
        }),
      } as Response);
    }

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('写入工程文件失败，原始布局已保持不变。')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(window.localStorage.getItem(SCENE_LAYOUT_DRAFT_STORAGE_KEY)).toContain('"x": 320');
  });

  it('保存失败时不会清除本地草稿且画布保持不变', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      json: async () => ({
        status: 'write_failed',
        message: '写入工程文件失败，原始布局已保持不变。',
      }),
    })) as unknown as typeof fetch);

    const draft = {
      ...defaultSceneLayoutDocument,
      items: {
        ...defaultSceneLayoutDocument.items,
        radio: {
          ...defaultSceneLayoutDocument.items.radio,
          x: 320,
        },
      },
    };
    window.localStorage.setItem(
      SCENE_LAYOUT_DRAFT_STORAGE_KEY,
      serializeSceneLayoutDocument(draft),
    );

    render(<SceneEditor />);
    await user.click(screen.getByRole('button', { name: '在层级中选择 radio' }));
    expect(screen.getByLabelText('x')).toHaveValue('320');

    await user.click(screen.getByRole('button', { name: '保存到工程' }));

    await waitFor(() => {
      expect(screen.getByText('写入工程文件失败，原始布局已保持不变。')).toBeInTheDocument();
    });
    expect(window.localStorage.getItem(SCENE_LAYOUT_DRAFT_STORAGE_KEY)).toContain('"x": 320');
    expect(screen.getByLabelText('x')).toHaveValue('320');
  });
});

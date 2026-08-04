import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SceneEditor } from './SceneEditor';
import { SCENE_LAYOUT_DRAFT_STORAGE_KEY } from './scene-editor-storage';

function getOverlay(key: string) {
  return screen.getByTestId(`space-editor-target-${key}`);
}

describe('SceneEditor', () => {
  beforeEach(() => {
    window.localStorage.clear();
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
});

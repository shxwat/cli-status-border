import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StatusBorder } from '../index';

function createMockStream(overrides: Partial<NodeJS.WriteStream> = {}) {
  return {
    write: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
    isTTY: true,
    columns: 40,
    rows: 20,
    ...overrides,
  } as unknown as NodeJS.WriteStream;
}

function writes(stream: NodeJS.WriteStream): string[] {
  return (stream.write as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
}

describe('StatusBorder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    // start() registers a real process.on('exit', ...) safety net; tests
    // that don't explicitly call stop() would otherwise leak listeners
    // across the suite.
    process.removeAllListeners('exit');
  });

  it('does nothing when the stream is not a TTY', () => {
    const stream = createMockStream({ isTTY: false });
    const border = new StatusBorder({ stream });
    border.start();
    expect(stream.write).not.toHaveBeenCalled();
  });

  it('reserves row 1 and clears stale content on the rows it reuses', () => {
    const stream = createMockStream();
    const border = new StatusBorder({ stream });
    border.start();

    const calls = writes(stream);
    expect(calls.some((c) => c.includes('[2;20r'))).toBe(true);
    expect(calls.some((c) => c.includes('[0J'))).toBe(true);
    expect(calls.some((c) => c.includes('[?25l'))).toBe(true);
  });

  it('draws without forcing the cursor to an absolute row', () => {
    const stream = createMockStream();
    const border = new StatusBorder({ stream });
    border.start();

    expect(writes(stream).some((c) => c.includes('[2;1H'))).toBe(false);
  });

  it('animates on an interval while active', () => {
    const stream = createMockStream();
    const border = new StatusBorder({ stream, fps: 10 });
    border.start();
    const callsBefore = writes(stream).length;

    vi.advanceTimersByTime(300); // ~3 frames at 10fps

    expect(writes(stream).length).toBeGreaterThan(callsBefore);
  });

  it('stops animating once stopped', () => {
    const stream = createMockStream();
    const border = new StatusBorder({ stream });
    border.start();
    border.stop();
    const callsAtStop = writes(stream).length;

    vi.advanceTimersByTime(1000);

    expect(writes(stream).length).toBe(callsAtStop);
  });

  it('listens for resize and redraws', () => {
    const stream = createMockStream();
    const border = new StatusBorder({ stream });
    border.start();
    expect(stream.on).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('resets the scroll region and shows the cursor on stop', () => {
    const stream = createMockStream();
    const border = new StatusBorder({ stream });
    border.start();
    border.stop();

    const calls = writes(stream);
    expect(calls.some((c) => c.includes('[r'))).toBe(true);
    expect(calls.some((c) => c.includes('[?25h'))).toBe(true);
    expect(stream.removeListener).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('clears row 1 specifically on stop, not just "the current line"', () => {
    const stream = createMockStream();
    const border = new StatusBorder({ stream });
    border.start();
    border.stop();

    const clearCall = writes(stream).find((c) => c.includes('[2K'));
    expect(clearCall).toBeDefined();
    // must move to row 1 before clearing, so the bar's leftover color
    // doesn't survive stop() regardless of where the cursor currently is
    expect(clearCall).toContain('[1;1H');
  });

  it('succeed() stops animating and holds a solid bar until stop() is called', () => {
    const stream = createMockStream();
    const border = new StatusBorder({ stream });
    border.start();
    border.succeed();

    const callsAtSucceed = writes(stream).length;
    expect(writes(stream).some((c) => c.includes('[r'))).toBe(false);

    // no more animation frames once succeeded
    vi.advanceTimersByTime(1000);
    expect(writes(stream).length).toBe(callsAtSucceed);

    border.stop();
    expect(writes(stream).some((c) => c.includes('[r'))).toBe(true);
  });

  it('registers a process exit safety net on start, and removes it on stop', () => {
    const processOnSpy = vi.spyOn(process, 'on');
    const processRemoveSpy = vi.spyOn(process, 'removeListener');
    const stream = createMockStream();
    const border = new StatusBorder({ stream });

    border.start();
    expect(processOnSpy).toHaveBeenCalledWith('exit', expect.any(Function));

    border.stop();
    expect(processRemoveSpy).toHaveBeenCalledWith('exit', expect.any(Function));

    processOnSpy.mockRestore();
    processRemoveSpy.mockRestore();
  });

  it('is safe to call stop() before start()', () => {
    const stream = createMockStream();
    const border = new StatusBorder({ stream });
    expect(() => border.stop()).not.toThrow();
    expect(stream.write).not.toHaveBeenCalled();
  });

  it('is safe to call start() twice in a row', () => {
    const stream = createMockStream();
    const border = new StatusBorder({ stream });
    border.start();
    const callsAfterFirstStart = writes(stream).length;
    border.start();
    expect(writes(stream).length).toBe(callsAfterFirstStart);
  });
});

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
    // start() registers real process listeners ('exit', 'SIGINT') as
    // safety nets; tests that don't explicitly call stop() would otherwise
    // leak them across the suite.
    process.removeAllListeners('exit');
    process.removeAllListeners('SIGINT');
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

    vi.advanceTimersByTime(300);

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
    expect(clearCall).toContain('[1;1H');
  });

  it('succeed() stops animating and holds a solid bar until stop() is called', () => {
    const stream = createMockStream();
    const border = new StatusBorder({ stream });
    border.start();
    border.succeed();

    const callsAtSucceed = writes(stream).length;
    expect(writes(stream).some((c) => c.includes('[r'))).toBe(false);

    vi.advanceTimersByTime(1000);
    expect(writes(stream).length).toBe(callsAtSucceed);

    border.stop();
    expect(writes(stream).some((c) => c.includes('[r'))).toBe(true);
  });

  it('registers exit and SIGINT safety nets on start, and removes them on stop', () => {
    const processOnSpy = vi.spyOn(process, 'on');
    const processRemoveSpy = vi.spyOn(process, 'removeListener');
    const stream = createMockStream();
    const border = new StatusBorder({ stream });

    border.start();
    expect(processOnSpy).toHaveBeenCalledWith('exit', expect.any(Function));
    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));

    border.stop();
    expect(processRemoveSpy).toHaveBeenCalledWith('exit', expect.any(Function));
    expect(processRemoveSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));

    processOnSpy.mockRestore();
    processRemoveSpy.mockRestore();
  });

  it('SIGINT handler cleans up the terminal and exits', () => {
    const stream = createMockStream();
    const border = new StatusBorder({ stream });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    border.start();
    const sigintHandler = (process.listeners('SIGINT') as Array<() => void>).at(-1)!;
    sigintHandler();

    expect(writes(stream).some((c) => c.includes('[r'))).toBe(true); // scroll region reset
    expect(exitSpy).toHaveBeenCalledWith(130);

    exitSpy.mockRestore();
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

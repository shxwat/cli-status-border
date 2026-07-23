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
  });

  it('does nothing when the stream is not a TTY', () => {
    const stream = createMockStream({ isTTY: false });
    const border = new StatusBorder({ stream });
    border.start();
    expect(stream.write).not.toHaveBeenCalled();
  });

  it('sets a scroll region and hides the cursor on start', () => {
    const stream = createMockStream();
    const border = new StatusBorder({ stream });
    border.start();

    const calls = writes(stream);
    expect(calls.some((c) => c.includes('[2;20r'))).toBe(true);
    expect(calls.some((c) => c.includes('[?25l'))).toBe(true);
  });

  it('draws a solid bar without forcing the cursor to an absolute row', () => {
    const stream = createMockStream();
    const border = new StatusBorder({ stream });
    border.start();

    const calls = writes(stream);
    expect(calls.some((c) => c.includes('[2;1H'))).toBe(false);
  });

  it('listens for resize and redraws', () => {
    const stream = createMockStream();
    const border = new StatusBorder({ stream });
    border.start();
    expect(stream.on).toHaveBeenCalledWith('resize', expect.any(Function));

    const callsBefore = writes(stream).length;
    const resizeHandler = (stream.on as ReturnType<typeof vi.fn>).mock.calls[0][1];
    resizeHandler();
    expect(writes(stream).length).toBeGreaterThan(callsBefore);
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

  it('succeed() settles to a solid bar and releases the row after the hold time', () => {
    const stream = createMockStream();
    const border = new StatusBorder({ stream });
    border.start();
    border.succeed(200);

    // still active immediately after succeed() (holding the solid color)
    expect(writes(stream).some((c) => c.includes('[r'))).toBe(false);

    vi.advanceTimersByTime(200);

    expect(writes(stream).some((c) => c.includes('[r'))).toBe(true);
  });

  it('setColor() redraws immediately while active', () => {
    const stream = createMockStream();
    const border = new StatusBorder({ stream });
    border.start();
    const callsBefore = writes(stream).length;
    border.setColor('magenta');
    expect(writes(stream).length).toBeGreaterThan(callsBefore);
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

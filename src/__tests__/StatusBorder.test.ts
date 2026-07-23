import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StatusBorder } from '../index';

function createMockStream(overrides: Partial<NodeJS.WriteStream> = {}) {
  return {
    write: vi.fn(),
    isTTY: true,
    columns: 40,
    rows: 20,
    ...overrides,
  } as unknown as NodeJS.WriteStream;
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

    const calls = (stream.write as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(calls.some((c) => c.includes('[2;20r'))).toBe(true);
    expect(calls.some((c) => c.includes('[?25l'))).toBe(true);
  });

  it('animates on an interval while active', () => {
    const stream = createMockStream();
    const border = new StatusBorder({ stream, fps: 10 });
    border.start();
    const callsBefore = (stream.write as ReturnType<typeof vi.fn>).mock.calls.length;

    vi.advanceTimersByTime(300); // ~3 frames at 10fps

    const callsAfter = (stream.write as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callsAfter).toBeGreaterThan(callsBefore);
  });

  it('resets the scroll region and shows the cursor on stop', () => {
    const stream = createMockStream();
    const border = new StatusBorder({ stream });
    border.start();
    border.stop();

    const calls = (stream.write as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(calls.some((c) => c.includes('[r'))).toBe(true);
    expect(calls.some((c) => c.includes('[?25h'))).toBe(true);
  });

  it('stops animating once stopped', () => {
    const stream = createMockStream();
    const border = new StatusBorder({ stream });
    border.start();
    border.stop();
    const callsAtStop = (stream.write as ReturnType<typeof vi.fn>).mock.calls.length;

    vi.advanceTimersByTime(1000);

    expect((stream.write as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsAtStop);
  });

  it('succeed() settles to a solid bar and releases the row after the hold time', () => {
    const stream = createMockStream();
    const border = new StatusBorder({ stream });
    border.start();
    border.succeed(200);

    // still active immediately after succeed() (holding the solid color)
    let calls = (stream.write as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(calls.some((c) => c.includes('[r'))).toBe(false);

    vi.advanceTimersByTime(200);

    calls = (stream.write as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(calls.some((c) => c.includes('[r'))).toBe(true);
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
    const callsAfterFirstStart = (stream.write as ReturnType<typeof vi.fn>).mock.calls.length;
    border.start();
    expect((stream.write as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      callsAfterFirstStart
    );
  });
});

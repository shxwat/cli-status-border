import { describe, expect, it, vi } from 'vitest';

import { StatusBorder } from '../index';

// These run under vitest, where process.stdout is never a TTY, so start()
// safely no-ops (the same path a piped/CI stdout takes in real usage).
// Actually exercising the blessed screen requires a real TTY, so that part
// is verified manually via the example scripts instead.

describe('StatusBorder (non-TTY / CI environment)', () => {
  it('start() does nothing when stdout is not a TTY', () => {
    expect(process.stdout.isTTY).toBeFalsy();
    const border = new StatusBorder();
    expect(() => border.start()).not.toThrow();
  });

  it('is safe to call stop() before start()', () => {
    const border = new StatusBorder();
    expect(() => border.stop()).not.toThrow();
  });

  it('is safe to call succeed()/fail() before start()', () => {
    const border = new StatusBorder();
    expect(() => border.succeed()).not.toThrow();
    expect(() => border.fail()).not.toThrow();
  });

  it('is safe to call setColor() before start()', () => {
    const border = new StatusBorder();
    expect(() => border.setColor('red')).not.toThrow();
  });

  it('is safe to call start() twice in a row', () => {
    const border = new StatusBorder();
    border.start();
    expect(() => border.start()).not.toThrow();
  });

  it('log() falls back to console.log when not active', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const border = new StatusBorder();
    border.log('hello');
    expect(spy).toHaveBeenCalledWith('hello');
    spy.mockRestore();
  });

  it('is safe to call stop() repeatedly', () => {
    const border = new StatusBorder();
    border.start();
    border.stop();
    expect(() => border.stop()).not.toThrow();
  });
});

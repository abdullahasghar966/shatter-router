import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import { compareScreenshots } from './seam';

// Pure image maths: no page involved, so it runs in the Chromium project only.

const SIZE = 200;

/** A dark page with light vertical bars, like text stems, offset by `shift` pixels. */
function bars(shift: number): Buffer {
  const png = new PNG({ width: SIZE, height: SIZE });
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const on = (x - shift + SIZE) % 10 < 4 && x > 20 && x < 180 && y > 20 && y < 180;
      const value = on ? 230 : 12;
      png.data[i] = value;
      png.data[i + 1] = value;
      png.data[i + 2] = value;
      png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

test.describe('seam metric', () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== 'chromium', 'engine-independent image maths');
  });

  test('identical images differ by 0 %', async ({ page: _unused }, testInfo) => {
    const result = await compareScreenshots(testInfo, 'same', bars(0), bars(0), 1);
    expect(result.percent).toBe(0);
    expect(result.rawPercent).toBe(0);
  });

  test('forgives a one-device-pixel shift at radius 1 (half a CSS pixel at 2x)', async ({
    page: _unused,
  }, testInfo) => {
    const result = await compareScreenshots(testInfo, 'shift1', bars(0), bars(1), 1);
    expect(result.rawPercent).toBeGreaterThan(5);
    expect(result.percent).toBe(0);
  });

  test('still fails a two-device-pixel shift (one CSS pixel at 2x)', async ({
    page: _unused,
  }, testInfo) => {
    const result = await compareScreenshots(testInfo, 'shift2', bars(0), bars(2), 1);
    expect(result.percent).toBeGreaterThan(5);
  });

  test('forgives nothing at radius 0 (1x)', async ({ page: _unused }, testInfo) => {
    const result = await compareScreenshots(testInfo, 'shift1-r0', bars(0), bars(1), 0);
    expect(result.percent).toBe(result.rawPercent);
    expect(result.percent).toBeGreaterThan(5);
  });
});

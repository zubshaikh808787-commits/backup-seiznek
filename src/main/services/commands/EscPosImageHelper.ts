/**
 * ESC/POS Raster Bit Image Helper (GS v 0)
 *
 * Implements the standard ESC/POS raster bit image command:
 * GS v 0 m xL xH yL yH d1...dk
 *
 * Supported across all thermal receipt printers (MPT-II, POS-58, POS-80,
 * Epson, Xprinter, Rongta, etc.) allowing direct physical image and logo printing.
 */

export class EscPosImageHelper {
  /**
   * Encapsulates raw 1-bit-per-pixel bitmap data into ESC/POS GS v 0 raster command.
   *
   * @param bitmap 1-bit-per-pixel buffer where 1 = print (black dot), 0 = white (blank), MSB first
   * @param widthDots Width in dots (e.g. 384 for 58mm printer)
   * @param heightDots Height in dots
   * @param mode 0 = Normal, 1 = Double width, 2 = Double height, 3 = Quadruple
   */
  static buildRasterBitImage(bitmap: Buffer, widthDots: number, heightDots: number, mode = 0): Buffer {
    const bytesPerRow = Math.ceil(widthDots / 8);
    const xL = bytesPerRow % 256;
    const xH = Math.floor(bytesPerRow / 256);
    const yL = heightDots % 256;
    const yH = Math.floor(heightDots / 256);

    // GS v 0 m xL xH yL yH d1...dk
    const header = Buffer.from([0x1D, 0x76, 0x30, mode & 0x03, xL, xH, yL, yH]);
    return Buffer.concat([header, bitmap]);
  }

  /**
   * Generates a high-contrast graphical banner logo as a 1-bit ESC/POS raster image.
   * Standard width for 58mm printer is 384 dots (48 bytes per row).
   */
  static generateSeznikLogoRaster(widthDots = 384, heightDots = 64): Buffer {
    const bytesPerRow = Math.ceil(widthDots / 8);
    const totalBytes = bytesPerRow * heightDots;
    const buffer = Buffer.alloc(totalBytes, 0x00);

    const setPixel = (x: number, y: number, on: boolean) => {
      if (x < 0 || x >= widthDots || y < 0 || y >= heightDots) return;
      const byteIdx = y * bytesPerRow + Math.floor(x / 8);
      const bitIdx = 7 - (x % 8);
      if (on) {
        buffer[byteIdx] |= (1 << bitIdx);
      } else {
        buffer[byteIdx] &= ~(1 << bitIdx);
      }
    };

    // Draw solid outer decorative border
    for (let x = 16; x < widthDots - 16; x++) {
      setPixel(x, 4, true);
      setPixel(x, 5, true);
      setPixel(x, heightDots - 5, true);
      setPixel(x, heightDots - 6, true);
    }
    for (let y = 4; y < heightDots - 4; y++) {
      setPixel(16, y, true);
      setPixel(17, y, true);
      setPixel(widthDots - 17, y, true);
      setPixel(widthDots - 18, y, true);
    }

    // Draw inner accent line
    for (let x = 24; x < widthDots - 24; x++) {
      setPixel(x, 8, true);
      setPixel(x, heightDots - 9, true);
    }

    // Draw a stylized geometric thermal printer / diamond logo icon in center-left (x: 36 to 68, y: 16 to 48)
    for (let dy = 0; dy < 32; dy++) {
      for (let dx = 0; dx < 32; dx++) {
        const cx = 16, cy = 16;
        const dist = Math.abs(dx - cx) + Math.abs(dy - cy);
        if (dist <= 14 && dist >= 10) {
          setPixel(36 + dx, 16 + dy, true);
        } else if (dist <= 6) {
          setPixel(36 + dx, 16 + dy, true);
        }
      }
    }

    // Draw bold pixelated "SEZNIK" text bitmap (simplified 5x7 block font scaled up 3x)
    const letters: { [char: string]: number[] } = {
      'S': [0x1E, 0x33, 0x30, 0x1C, 0x06, 0x33, 0x1E],
      'E': [0x3F, 0x30, 0x30, 0x3E, 0x30, 0x30, 0x3F],
      'Z': [0x3F, 0x03, 0x06, 0x0C, 0x18, 0x30, 0x3F],
      'N': [0x33, 0x37, 0x3B, 0x3D, 0x39, 0x33, 0x33],
      'I': [0x1F, 0x0E, 0x0E, 0x0E, 0x0E, 0x0E, 0x1F],
      'K': [0x33, 0x36, 0x3C, 0x38, 0x3C, 0x36, 0x33],
    };

    const word = ['S', 'E', 'Z', 'N', 'I', 'K'];
    let startX = 84;
    const startY = 18;
    const scale = 4;

    for (const char of word) {
      const glyph = letters[char];
      if (glyph) {
        for (let row = 0; row < 7; row++) {
          const rowBits = glyph[row];
          for (let col = 0; col < 6; col++) {
            const isBitSet = (rowBits & (1 << (5 - col))) !== 0;
            if (isBitSet) {
              for (let sy = 0; sy < scale; sy++) {
                for (let sx = 0; sx < scale; sx++) {
                  setPixel(startX + col * scale + sx, startY + row * scale + sy, true);
                }
              }
            }
          }
        }
      }
      startX += 6 * scale + 6;
    }

    return this.buildRasterBitImage(buffer, widthDots, heightDots, 0);
  }

  /**
   * Converts RGBA raw pixel data (e.g. from canvas or image buffer) into a 1-bit dithered
   * ESC/POS raster image using Floyd-Steinberg error diffusion for high image quality.
   */
  static rgbaToFloydSteinbergRaster(rgba: Uint8Array | Buffer, width: number, height: number): Buffer {
    // 1. Convert to grayscale luminance array
    const gray = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const r = rgba[i * 4];
      const g = rgba[i * 4 + 1];
      const b = rgba[i * 4 + 2];
      const a = rgba[i * 4 + 3];
      // Luminance formula with alpha blending over white background
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
      const alphaFactor = a / 255.0;
      gray[i] = luminance * alphaFactor + 255 * (1 - alphaFactor);
    }

    // 2. Floyd-Steinberg error diffusion
    const bytesPerRow = Math.ceil(width / 8);
    const bitmap = Buffer.alloc(bytesPerRow * height, 0x00);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const oldVal = gray[idx];
        const newVal = oldVal < 128 ? 0 : 255;
        const err = oldVal - newVal;

        if (newVal === 0) {
          // Black dot (print)
          const byteIdx = y * bytesPerRow + Math.floor(x / 8);
          const bitIdx = 7 - (x % 8);
          bitmap[byteIdx] |= (1 << bitIdx);
        }

        // Diffuse quantization error to neighbors
        if (x + 1 < width) gray[idx + 1] += err * (7 / 16);
        if (x - 1 >= 0 && y + 1 < height) gray[(y + 1) * width + (x - 1)] += err * (3 / 16);
        if (y + 1 < height) gray[(y + 1) * width + x] += err * (5 / 16);
        if (x + 1 < width && y + 1 < height) gray[(y + 1) * width + (x + 1)] += err * (1 / 16);
      }
    }

    return this.buildRasterBitImage(bitmap, width, height, 0);
  }
}

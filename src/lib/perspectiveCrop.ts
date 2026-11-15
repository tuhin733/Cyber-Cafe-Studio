export interface Pt {
  x: number;
  y: number;
}

export interface Quad {
  tl: Pt;
  tr: Pt;
  br: Pt;
  bl: Pt;
}

export function isValidQuad(quad: Quad): boolean {
  const points = [quad.tl, quad.tr, quad.br, quad.bl];
  let direction = 0;

  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const c = points[(i + 2) % points.length];
    const cross =
      (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-6) return false;
    if (direction !== 0 && Math.sign(cross) !== direction) return false;
    direction = Math.sign(cross);
  }

  return true;
}

function solveLinearSystem(A: number[][], B: number[]): number[] | null {
  const n = B.length;
  const aug = A.map((row, i) => [...row, B[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(aug[r][col]) > Math.abs(aug[maxRow][col])) maxRow = r;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-10) return null;

    for (let r = col + 1; r < n; r++) {
      const factor = aug[r][col] / pivot;
      for (let c = col; c <= n; c++) {
        aug[r][c] -= factor * aug[col][c];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = aug[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= aug[i][j] * x[j];
    }
    x[i] = sum / aug[i][i];
  }
  return x;
}

function computePerspectiveRectToQuad(
  dstW: number,
  dstH: number,
  quad: Quad,
): number[] | null {
  const dxs = [0, dstW, dstW, 0];
  const dys = [0, 0, dstH, dstH];
  const sxs = [quad.tl.x, quad.tr.x, quad.br.x, quad.bl.x];
  const sys = [quad.tl.y, quad.tr.y, quad.br.y, quad.bl.y];

  const A: number[][] = [];
  const B: number[] = [];
  for (let i = 0; i < 4; i++) {
    A.push([dxs[i], dys[i], 1, 0, 0, 0, -sxs[i] * dxs[i], -sxs[i] * dys[i]]);
    B.push(sxs[i]);
    A.push([0, 0, 0, dxs[i], dys[i], 1, -sys[i] * dxs[i], -sys[i] * dys[i]]);
    B.push(sys[i]);
  }
  return solveLinearSystem(A, B);
}

export function applyPerspectiveTransform(
  sourceCanvas: HTMLCanvasElement,
  srcQuad: Quad,
  outW: number,
  outH: number,
): HTMLCanvasElement {
  const sCtx = sourceCanvas.getContext("2d");
  if (!sCtx) throw new Error("Image canvas is unavailable.");
  const srcImg = sCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const sW = sourceCanvas.width;
  const sH = sourceCanvas.height;

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const oCtx = out.getContext("2d");
  if (!oCtx) throw new Error("Crop output canvas is unavailable.");
  const outImg = oCtx.createImageData(outW, outH);
  const od = outImg.data;

  const inv = computePerspectiveRectToQuad(outW, outH, srcQuad);
  if (!inv) throw new Error("The crop corners do not form a valid shape.");

  const [a, b, c, d, e, f, g, h] = inv;

  for (let dy = 0; dy < outH; dy++) {
    for (let dx = 0; dx < outW; dx++) {
      const denom = g * dx + h * dy + 1;
      if (Math.abs(denom) < 1e-10) continue;
      const sx = (a * dx + b * dy + c) / denom;
      const sy = (d * dx + e * dy + f) / denom;

      const sx0 = Math.floor(sx);
      const sy0 = Math.floor(sy);
      const fx = sx - sx0;
      const fy = sy - sy0;
      const sx1 = Math.min(sx0 + 1, sW - 1);
      const sy1 = Math.min(sy0 + 1, sH - 1);

      if (sx0 < 0 || sy0 < 0 || sx0 >= sW || sy0 >= sH) {
        const oi = (dy * outW + dx) * 4;
        od[oi] = 255;
        od[oi + 1] = 255;
        od[oi + 2] = 255;
        od[oi + 3] = 255;
        continue;
      }

      const i00 = (sy0 * sW + sx0) * 4;
      const i10 = (sy0 * sW + sx1) * 4;
      const i01 = (sy1 * sW + sx0) * 4;
      const i11 = (sy1 * sW + sx1) * 4;
      const oi = (dy * outW + dx) * 4;
      for (let ch = 0; ch < 4; ch++) {
        const top = srcImg.data[i00 + ch] * (1 - fx) + srcImg.data[i10 + ch] * fx;
        const bot = srcImg.data[i01 + ch] * (1 - fx) + srcImg.data[i11 + ch] * fx;
        od[oi + ch] = top * (1 - fy) + bot * fy;
      }
    }
  }

  oCtx.putImageData(outImg, 0, 0);
  return out;
}

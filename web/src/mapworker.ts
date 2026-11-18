/*
 * Off the main thread, for tiles:
 *
 *  - "cover": the cover mask PNG decoded here, byte for byte, and scaled
 *    down. It is data - road, path, green, water in R, G, B, A - not a
 *    picture, and browsers treat pictures' alpha their own way: Firefox
 *    turned createImageBitmap's alpha to opaque, i.e. water everywhere, and
 *    any canvas premultiplies it, wiping the other channels where there is
 *    no water. The pipeline writes plain 8-bit PNGs (raster.write_png), so
 *    decoding them takes a DecompressionStream and the row filters.
 * */

export interface CoverJob {
  kind: 'cover';
  png: ArrayBuffer;
  /** Output pixels per input pixel: 1, 1/2, 1/8 ... */
  scale: number;
}

export interface Raster { data: Uint8Array<ArrayBuffer>; w: number; h: number; channels: number }

/** An 8-bit grey or RGBA PNG as raw bytes, exactly as stored. */
async function decodePng(buf: ArrayBuffer): Promise<Raster> {
  const b = new Uint8Array(buf);
  const dv = new DataView(b.buffer);
  let w = 0, h = 0, channels = 4;
  const idat: Uint8Array<ArrayBuffer>[] = [];
  for (let p = 8; p < b.length;) {
    const len = dv.getUint32(p);
    const type = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);
    if (type === 'IHDR') {
      w = dv.getUint32(p + 8);
      h = dv.getUint32(p + 12);
      const depth = b[p + 16], ctype = b[p + 17], interlace = b[p + 20];
      if (depth !== 8 || interlace !== 0 || (ctype !== 6 && ctype !== 0 && ctype !== 2)) {
        throw new Error(`unsupported PNG: depth ${depth}, colour type ${ctype}, interlace ${interlace}`);
      }
      channels = ctype === 6 ? 4 : ctype === 2 ? 3 : 1;
    } else if (type === 'IDAT') {
      idat.push(b.subarray(p + 8, p + 8 + len));
    } else if (type === 'IEND') {
      break;
    }
    p += 12 + len;
  }
  const stream = new Blob(idat).stream().pipeThrough(new DecompressionStream('deflate'));
  const raw = new Uint8Array(await new Response(stream).arrayBuffer());
  // undo the per-row filters
  const stride = w * channels;
  const out = new Uint8Array(stride * h);
  for (let r = 0; r < h; r++) {
    const f = raw[r * (stride + 1)];
    const src = r * (stride + 1) + 1, dst = r * stride, up = dst - stride;
    for (let i = 0; i < stride; i++) {
      const x = raw[src + i];
      const a = i >= channels ? out[dst + i - channels] : 0;
      const u = r > 0 ? out[up + i] : 0;
      const c = r > 0 && i >= channels ? out[up + i - channels] : 0;
      let v: number;
      switch (f) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + u; break;
        case 3: v = x + ((a + u) >> 1); break;
        default: {
          const p = a + u - c, pa = Math.abs(p - a), pb = Math.abs(p - u), pc = Math.abs(p - c);
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? u : c);
        }
      }
      out[dst + i] = v & 255;
    }
  }
  return { data: out, w, h, channels };
}

/** Box-filtered down by an integer factor, as RGBA. */
function shrink(src: Raster, factor: number): Raster {
  const w = Math.max(1, Math.floor(src.w / factor)), h = Math.max(1, Math.floor(src.h / factor));
  const out = new Uint8Array(w * h * 4);
  const n = factor * factor, ch = src.channels;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sum = [0, 0, 0, 0];
      for (let dy = 0; dy < factor; dy++) {
        let k = ((y * factor + dy) * src.w + x * factor) * ch;
        for (let dx = 0; dx < factor; dx++, k += ch) {
          for (let c = 0; c < 4; c++) sum[c] += c < ch ? src.data[k + c] : 255;
        }
      }
      const o = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) out[o + c] = Math.round(sum[c] / n);
    }
  }
  return { data: out, w, h, channels: 4 };
}

async function cover(job: CoverJob): Promise<Raster> {
  const png = await decodePng(job.png);
  const factor = Math.max(1, Math.round(1 / job.scale));
  return shrink(png, factor);       // factor 1: a straight copy to RGBA
}

self.onmessage = async (e: MessageEvent<CoverJob>) => {
  const post = (self as unknown as Worker).postMessage.bind(self);
  try {
    const r = await cover(e.data);
    post({ ok: r }, [r.data.buffer]);
  } catch (err) {
    post({ error: String(err) });
  }
};

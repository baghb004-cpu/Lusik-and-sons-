/* Threadwell Studio — PES writer.
   Emits a truncated PES v1 file (#PES0001 header + PEC block), the same
   layout pyembroidery writes with {"pes version": 1, "truncated": True},
   which Brother/Babylock machines and every embroidery editor read.

   Input pattern:
     {
       name:    string,                 // design label (8 chars used)
       threads: [rgbInt, ...],          // one per color block, e.g. 0x1f2f6b
       stitches:[[x, y, cmd], ...]      // absolute coords in PEC units (0.1 mm)
     }
   cmd: "st" stitch · "jmp" jump/move · "col" color change · "end" end.
   Coordinate space: +x right, +y down (same as the preview canvas).

   Works as a classic browser script (window.EmbPES) and under Node for
   the test harness (module.exports). No dependencies. */
(function (root) {
  'use strict';

  /* Brother PEC 64-color thread palette (index 0 unused), RGB ints. */
  var PEC_PALETTE = [null,
    0x0e1f7c, 0x0a55a3, 0x008777, 0x4b6baf, 0xed171f, 0xd15c00, 0x913697, 0xe49acb,
    0x915fac, 0x9ed67d, 0xe8a900, 0xfeba35, 0xffff00, 0x70bc1f, 0xba9800, 0xa8a8a8,
    0x7d6f00, 0xffffb3, 0x4f5556, 0x000000, 0x0b3d91, 0x770176, 0x293133, 0x2a1301,
    0xf64a8a, 0xb27624, 0xfcbbc5, 0xfe370f, 0xf0f0f0, 0x6a1c8a, 0xa8ddc4, 0x2584bb,
    0xfeb343, 0xfff36b, 0xd0a660, 0xd15400, 0x66ba49, 0x134a46, 0x878787, 0xd8ccc6,
    0x435607, 0xfdd9de, 0xf993bc, 0x003822, 0xb2afd4, 0x686ab0, 0xefe3b9, 0xf73866,
    0xb54b64, 0x132b1a, 0xc70156, 0xfe9e32, 0xa8deeb, 0x00673e, 0x4e2990, 0x2f7e20,
    0xffcccc, 0xffd911, 0x095ba6, 0xf0f970, 0xe3f35b, 0xff9900, 0xfff08d, 0xffc8c8];

  /* 48x38 1-bit thumbnail frame the machine shows, 6 bytes per row. */
  var BLANK = [
    0, 0, 0, 0, 0, 0, 240, 255, 255, 255, 255, 15, 8, 0, 0, 0, 0, 16,
    4, 0, 0, 0, 0, 32, 2, 0, 0, 0, 0, 64, 2, 0, 0, 0, 0, 64,
    2, 0, 0, 0, 0, 64, 2, 0, 0, 0, 0, 64, 2, 0, 0, 0, 0, 64,
    2, 0, 0, 0, 0, 64, 2, 0, 0, 0, 0, 64, 2, 0, 0, 0, 0, 64,
    2, 0, 0, 0, 0, 64, 2, 0, 0, 0, 0, 64, 2, 0, 0, 0, 0, 64,
    2, 0, 0, 0, 0, 64, 2, 0, 0, 0, 0, 64, 2, 0, 0, 0, 0, 64,
    2, 0, 0, 0, 0, 64, 2, 0, 0, 0, 0, 64, 2, 0, 0, 0, 0, 64,
    2, 0, 0, 0, 0, 64, 2, 0, 0, 0, 0, 64, 2, 0, 0, 0, 0, 64,
    2, 0, 0, 0, 0, 64, 2, 0, 0, 0, 0, 64, 2, 0, 0, 0, 0, 64,
    2, 0, 0, 0, 0, 64, 2, 0, 0, 0, 0, 64, 2, 0, 0, 0, 0, 64,
    2, 0, 0, 0, 0, 64, 2, 0, 0, 0, 0, 64, 2, 0, 0, 0, 0, 64,
    2, 0, 0, 0, 0, 64, 4, 0, 0, 0, 0, 32, 8, 0, 0, 0, 0, 16,
    240, 255, 255, 255, 255, 15, 0, 0, 0, 0, 0, 0];

  var MASK7 = 0x7F, JUMP_CODE = 0x20 << 0, TRIM_CODE = 0x20; // set below
  JUMP_CODE = 0x10; TRIM_CODE = 0x20;

  function redMeanDistance(c1, c2) {
    var r1 = (c1 >> 16) & 255, g1 = (c1 >> 8) & 255, b1 = c1 & 255;
    var r2 = (c2 >> 16) & 255, g2 = (c2 >> 8) & 255, b2 = c2 & 255;
    var rm = Math.round((r1 + r2) / 2), r = r1 - r2, g = g1 - g2, b = b1 - b2;
    return (((512 + rm) * r * r) >> 8) + 4 * g * g + (((767 - rm) * b * b) >> 8);
  }
  function nearestIndex(color, palette) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < palette.length; i++) {
      if (palette[i] === null || palette[i] === undefined) continue;
      var d = redMeanDistance(color, palette[i]);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }
  /* Port of pyembroidery build_unique_palette: each distinct thread claims
     its nearest palette slot (slots are not reused), then every thread maps
     to its claimed slot. */
  function buildUniquePalette(threads) {
    var pal = PEC_PALETTE.slice();
    var chart = new Array(pal.length).fill(null);
    var uniq = [];
    threads.forEach(function (t) { if (uniq.indexOf(t) < 0) uniq.push(t); });
    uniq.forEach(function (t) {
      var idx = nearestIndex(t, pal);
      if (idx === null) return;
      pal[idx] = null;
      chart[idx] = t;
    });
    return threads.map(function (t) { return nearestIndex(t, chart); });
  }

  /* ---- byte sink ---- */
  function Sink() { this.a = []; }
  Sink.prototype.u8 = function (v) { this.a.push(v & 0xFF); };
  Sink.prototype.u16le = function (v) { this.u8(v); this.u8(v >> 8); };
  Sink.prototype.u24le = function (v) { this.u8(v); this.u8(v >> 8); this.u8(v >> 16); };
  Sink.prototype.u32le = function (v) { this.u16le(v); this.u16le(v >> 16); };
  Sink.prototype.str = function (s) { for (var i = 0; i < s.length; i++) this.u8(s.charCodeAt(i)); };
  Sink.prototype.fill = function (byte, n) { for (var i = 0; i < n; i++) this.u8(byte); };
  Sink.prototype.patch24le = function (pos, v) {
    this.a[pos] = v & 0xFF; this.a[pos + 1] = (v >> 8) & 0xFF; this.a[pos + 2] = (v >> 16) & 0xFF;
  };
  Sink.prototype.bytes = function () { return new Uint8Array(this.a); };

  /* ---- PEC stitch encoding (port of pyembroidery pec_encode) ---- */
  function writeValue(f, value, wantLong, flag) {
    if (!wantLong && value > -64 && value < 63) {
      f.u8(value & MASK7);
    } else {
      value &= 0x0FFF;
      value |= 0x8000;
      value |= (flag || 0) << 8;
      f.u8((value >> 8) & 0xFF);
      f.u8(value & 0xFF);
    }
  }
  function pecEncode(f, stitches) {
    var colorTwo = true, jumping = true, init = true;
    var xx = 0, yy = 0;
    for (var i = 0; i < stitches.length; i++) {
      var s = stitches[i];
      var dx = Math.round(s[0]) - xx, dy = Math.round(s[1]) - yy;
      xx += dx; yy += dy;
      var cmd = s[2];
      if (cmd === 'st') {
        if (jumping) {
          if (dx !== 0 && dy !== 0) { writeValue(f, 0); writeValue(f, 0); }
          jumping = false;
        }
        writeValue(f, dx); writeValue(f, dy);
      } else if (cmd === 'jmp') {
        jumping = true;
        var flag = init ? JUMP_CODE : TRIM_CODE;
        writeValue(f, dx, true, flag); writeValue(f, dy, true, flag);
      } else if (cmd === 'col') {
        if (jumping) { writeValue(f, 0); writeValue(f, 0); jumping = false; }
        f.u8(0xFE); f.u8(0xB0);
        f.u8(colorTwo ? 0x02 : 0x01);
        colorTwo = !colorTwo;
      } else if (cmd === 'end') {
        f.u8(0xFF);
        break;
      }
      init = false;
    }
  }

  /* ---- thumbnail graphics ---- */
  function markBit(g, x, y, stride) {
    if (x < 0 || y < 0 || x >= stride * 8 || y >= g.length / stride) return;
    g[Math.floor(x / 8) + y * stride] |= 1 << (x % 8);
  }
  function drawScaled(extends_, points, g, stride, buffer) {
    if (buffer === undefined) buffer = 5;
    var left = extends_[0], top = extends_[1], right = extends_[2], bottom = extends_[3];
    var dw = right - left || 1, dh = bottom - top || 1;
    var gw = stride * 8, gh = g.length / stride;
    var scale = Math.min((gw - buffer) / dw, (gh - buffer) / dh);
    var cx = (right + left) / 2, cy = (bottom + top) / 2;
    var tx = -cx * scale + gw / 2, ty = -cy * scale + gh / 2;
    for (var i = 0; i < points.length; i++) {
      markBit(g, Math.floor(points[i][0] * scale + tx), Math.floor(points[i][1] * scale + ty), stride);
    }
  }

  function bounds(stitches) {
    var l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (var i = 0; i < stitches.length; i++) {
      var s = stitches[i];
      if (s[2] !== 'st' && s[2] !== 'jmp') continue;
      if (s[0] < l) l = s[0];
      if (s[1] < t) t = s[1];
      if (s[0] > r) r = s[0];
      if (s[1] > b) b = s[1];
    }
    if (l === Infinity) { l = t = r = b = 0; }
    return [l, t, r, b];
  }

  /* ---- assembly ---- */
  function write(pattern) {
    var f = new Sink();
    var threads = pattern.threads && pattern.threads.length ? pattern.threads : [0x000000];
    var stitches = pattern.stitches || [];
    var ext = bounds(stitches);

    /* truncated PES v1 preamble: signature + fixed pointer (0x16) + 10 zeros */
    f.str('#PES0001');
    f.u8(0x16); f.fill(0x00, 13);

    /* PEC header */
    var name = String(pattern.name || 'Untitled').slice(0, 8);
    var label = 'LA:' + (name + '                ').slice(0, 16) + '\r';
    f.str(label);
    f.fill(0x20, 12); f.u8(0xFF); f.u8(0x00);
    f.u8(6);   /* icon byte stride  */
    f.u8(38);  /* icon height       */
    var colorIndexList = buildUniquePalette(threads);
    var n = colorIndexList.length;
    f.fill(0x20, 12);
    f.u8(n - 1);
    for (var i = 0; i < n; i++) f.u8(colorIndexList[i]);
    f.fill(0x20, 463 - n);

    /* PEC stitch block */
    var blockStart = f.a.length;
    f.u8(0x00); f.u8(0x00);
    f.u24le(0); /* graphics offset, patched below */
    f.u8(0x31); f.u8(0xFF); f.u8(0xF0);
    f.u16le(Math.round(ext[2] - ext[0]));
    f.u16le(Math.round(ext[3] - ext[1]));
    f.u16le(0x1E0);
    f.u16le(0x1B0);
    pecEncode(f, stitches);
    f.patch24le(blockStart + 2, f.a.length - blockStart);

    /* thumbnails: one overall + one per color block, stitch points only */
    var stitchPoints = stitches.filter(function (s) { return s[2] === 'st'; });
    var overall = BLANK.slice();
    drawScaled(ext, stitchPoints, overall, 6, 4);
    overall.forEach(function (b) { f.u8(b); });
    var blockIdx = 0;
    var perColor = [[]];
    stitches.forEach(function (s) {
      if (s[2] === 'col') { perColor.push([]); }
      else if (s[2] === 'st') { perColor[perColor.length - 1].push(s); }
    });
    perColor.forEach(function (pts) {
      var g = BLANK.slice();
      drawScaled(ext, pts, g, 6);
      g.forEach(function (b) { f.u8(b); });
    });

    return f.bytes();
  }

  var api = { write: write, PEC_PALETTE: PEC_PALETTE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EmbPES = api;
})(typeof window !== 'undefined' ? window : globalThis);

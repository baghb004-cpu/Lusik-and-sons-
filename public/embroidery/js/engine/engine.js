/* Threadwell Studio — embroidery engine (browser glue).
   Rasterizes the design text on an offscreen canvas with the same font
   stacks the 2D ghost preview uses, plans a tatami fill (stitch-planner),
   and emits a machine-ready .pes (pes-writer). Any script the browser can
   render — Latin, Spanish, Armenian — digitizes the same way.

   window.EmbEngine.generate({
     text:      "Gohar" | "Գոհար" | "G A H",
     script:    true for the cursive stack, false for serif,
     widthMm:   panel area width  (pan.area_mm[0]),
     heightMm:  panel area height (pan.area_mm[1]),
     threadHex: "#1f2f6b",
     label:     8-char design label for the machine display
   }) -> { ok:true, base64, byteLength, stats:{ stitchCount, jumps,
           widthMm, heightMm } } | { ok:false, error }

   Depends on stitch-planner.js + pes-writer.js being loaded first. */
(function (root) {
  'use strict';

  var SERIF = "700 {SIZE}px Georgia,'Times New Roman',serif";
  var SCRIPT = "700 {SIZE}px 'Segoe Script','Snell Roundhand','Brush Script MT',cursive";
  var FILL_MARGIN = 0.92;      // use 92% of the panel box
  var MAX_PIXELS = 2.2e6;      // rasterization budget
  var MAX_STITCHES = 30000;    // refuse designs beyond a sane machine run

  function u8ToBase64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }

  function generate(design) {
    try {
      var text = String(design.text || '').trim();
      if (!text) return { ok: false, error: 'empty-text' };
      var wU = Math.max(40, Math.round(design.widthMm * 10));   // PEC units
      var hU = Math.max(40, Math.round(design.heightMm * 10));
      var ppu = Math.max(1, Math.min(3, Math.floor(Math.sqrt(MAX_PIXELS / (wU * hU)))));
      var W = wU * ppu, H = hU * ppu;

      var canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      var ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return { ok: false, error: 'no-canvas' };

      var fontTpl = design.script ? SCRIPT : SERIF;
      /* Probe at 100px, then scale so the text fills the box margin. */
      ctx.font = fontTpl.replace('{SIZE}', 100);
      var m = ctx.measureText(text);
      var probeW = Math.max(1, m.width);
      var asc = m.actualBoundingBoxAscent || 75, desc = m.actualBoundingBoxDescent || 25;
      var probeH = Math.max(1, asc + desc);
      var size = Math.floor(100 * Math.min((W * FILL_MARGIN) / probeW, (H * FILL_MARGIN) / probeH));
      if (size < 8 * ppu) return { ok: false, error: 'too-small' }; // < ~0.8 mm letters: unstitchable

      ctx.clearRect(0, 0, W, H);
      ctx.font = fontTpl.replace('{SIZE}', size);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000';
      ctx.fillText(text, W / 2, H / 2);

      var img = ctx.getImageData(0, 0, W, H).data;
      var bits = new Uint8Array(W * H);
      var on = 0;
      for (var i = 0; i < W * H; i++) {
        if (img[i * 4 + 3] > 127) { bits[i] = 1; on++; }
      }
      if (!on) return { ok: false, error: 'nothing-rendered' };

      var planned = root.EmbPlanner.plan(
        { width: W, height: H, data: bits, pxPerUnit: ppu });
      if (planned.stats.stitchCount < 8) return { ok: false, error: 'too-few-stitches' };
      if (planned.stats.stitchCount > MAX_STITCHES) return { ok: false, error: 'too-many-stitches' };

      var thread = parseInt(String(design.threadHex || '#1f2f6b').replace('#', ''), 16);
      var bytes = root.EmbPES.write({
        name: design.label || 'LusikSon',
        threads: [thread],
        stitches: planned.stitches
      });

      var xs = [], ys = [];
      planned.stitches.forEach(function (s) {
        if (s[2] === 'st') { xs.push(s[0]); ys.push(s[1]); }
      });
      return {
        ok: true,
        base64: u8ToBase64(bytes),
        byteLength: bytes.length,
        stats: {
          stitchCount: planned.stats.stitchCount,
          jumps: planned.stats.jumps,
          widthMm: Math.round((Math.max.apply(null, xs) - Math.min.apply(null, xs)) / 10 * 10) / 10,
          heightMm: Math.round((Math.max.apply(null, ys) - Math.min.apply(null, ys)) / 10 * 10) / 10
        }
      };
    } catch (err) {
      return { ok: false, error: 'engine-failed: ' + (err && err.message) };
    }
  }

  root.EmbEngine = { generate: generate };
})(typeof window !== 'undefined' ? window : globalThis);

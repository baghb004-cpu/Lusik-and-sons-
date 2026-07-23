/* Threadwell Studio — stitch planner.
   Turns a 1-bit bitmap (rasterized lettering) into a machine-friendly
   tatami fill plan:

     1. label 8-connected components (each letter / letter part),
     2. split every component into vertically-monotone slabs (so a "U"
        becomes left leg / bottom / right leg instead of a jump per row),
     3. serpentine-fill each slab with scanline runs, stitches capped at
        MAX_STITCH units, rows ROW_SPACING units apart,
     4. travel-stitch between nearby slabs of the same component, jump
        (which the PES writer turns into a trim) between letters.

   All geometry is in PEC units (1 unit = 0.1 mm). The bitmap arrives with
   a pxPerUnit scale so the caller controls rendering resolution.

   Works as a classic browser script (window.EmbPlanner) and under Node
   for the test harness. No dependencies. */
(function (root) {
  'use strict';

  var DEFAULTS = {
    rowSpacing: 4,     // 0.4 mm between fill rows
    maxStitch: 25,     // 2.5 mm max stitch length inside a run
    minRunPx: 2,       // ignore scanline runs thinner than this (px)
    travelMax: 30,     // ≤ 3 mm gaps are walked with stitches, else jump
    maxJump: 2000      // split longer jumps to stay inside PEC 12-bit range
  };

  /* 8-connected component labeling via scanline flood fill. */
  function labelComponents(bmp) {
    var w = bmp.width, h = bmp.height, data = bmp.data;
    var labels = new Int32Array(w * h); // 0 = background
    var next = 0;
    var stack = [];
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = y * w + x;
        if (!data[i] || labels[i]) continue;
        next++;
        labels[i] = next;
        stack.push(i);
        while (stack.length) {
          var p = stack.pop();
          var px = p % w, py = (p / w) | 0;
          for (var dy = -1; dy <= 1; dy++) {
            for (var dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              var nx = px + dx, ny = py + dy;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              var q = ny * w + nx;
              if (data[q] && !labels[q]) { labels[q] = next; stack.push(q); }
            }
          }
        }
      }
    }
    return { labels: labels, count: next };
  }

  /* Scanline runs per fill row for one component, bitmap px space. */
  function componentRuns(bmp, labels, comp, rowStepPx, minRunPx) {
    var w = bmp.width, h = bmp.height;
    var rows = [];
    for (var y = 0; y < h; y += rowStepPx) {
      var yi = Math.min(h - 1, Math.round(y));
      var runs = [];
      var start = -1;
      for (var x = 0; x <= w; x++) {
        var on = x < w && labels[yi * w + x] === comp;
        if (on && start < 0) start = x;
        else if (!on && start >= 0) {
          if (x - start >= minRunPx) runs.push([start, x - 1]);
          start = -1;
        }
      }
      if (runs.length) rows.push({ y: yi, runs: runs });
    }
    return rows;
  }

  /* Group rows of runs into vertically-monotone slabs: a run extends the
     slab whose last run it overlaps horizontally; forks/merges start new
     slabs. Each slab serpentine-fills without internal jumps. */
  function buildSlabs(rows) {
    var slabs = [];       // { rows: [{y, x0, x1}], open: bool }
    var open = [];
    rows.forEach(function (row) {
      var claimed = open.map(function () { return []; });
      var runSlab = row.runs.map(function () { return -1; });
      row.runs.forEach(function (run, ri) {
        open.forEach(function (slab, si) {
          var last = slab.rows[slab.rows.length - 1];
          if (run[0] <= last.x1 && run[1] >= last.x0) claimed[si].push(ri);
        });
      });
      // 1:1 matches extend; everything else closes/opens.
      var nextOpen = [];
      claimed.forEach(function (ris, si) {
        if (ris.length === 1) {
          var ri = ris[0];
          var claimCount = claimed.filter(function (r) { return r.indexOf(ri) >= 0; }).length;
          if (claimCount === 1 && runSlab[ri] < 0) {
            var run = row.runs[ri];
            open[si].rows.push({ y: row.y, x0: run[0], x1: run[1] });
            runSlab[ri] = si;
            nextOpen.push(open[si]);
            return;
          }
        }
        slabs.push(open[si]); // fork/merge/end: close it
      });
      row.runs.forEach(function (run, ri) {
        if (runSlab[ri] < 0) {
          var slab = { rows: [{ y: row.y, x0: run[0], x1: run[1] }] };
          nextOpen.push(slab);
        }
      });
      open = nextOpen;
    });
    open.forEach(function (s) { slabs.push(s); });
    return slabs;
  }

  /* Serpentine stitch points for one slab, px space. Returns point list. */
  function slabPoints(slab, maxStitchPx) {
    var pts = [];
    var leftToRight = true;
    slab.rows.forEach(function (r) {
      var from = leftToRight ? r.x0 : r.x1;
      var to = leftToRight ? r.x1 : r.x0;
      var span = Math.abs(to - from);
      var steps = Math.max(1, Math.ceil(span / maxStitchPx));
      for (var s = 0; s <= steps; s++) {
        pts.push([from + (to - from) * (s / steps), r.y]);
      }
      leftToRight = !leftToRight;
    });
    return pts;
  }

  function dist(a, b) { var dx = a[0] - b[0], dy = a[1] - b[1]; return Math.sqrt(dx * dx + dy * dy); }

  /* Greedy nearest-first ordering of slabs, starting from the left. */
  function orderSlabs(slabs) {
    var remaining = slabs.slice();
    var ordered = [];
    var cur = null;
    while (remaining.length) {
      var bi = 0;
      if (cur) {
        var bd = Infinity;
        remaining.forEach(function (s, i) {
          var head = s.rows[0], tail = s.rows[s.rows.length - 1];
          var d = Math.min(dist(cur, [head.x0, head.y]), dist(cur, [tail.x0, tail.y]));
          if (d < bd) { bd = d; bi = i; }
        });
      } else {
        var bx = Infinity;
        remaining.forEach(function (s, i) { if (s.rows[0].x0 < bx) { bx = s.rows[0].x0; bi = i; } });
      }
      var slab = remaining.splice(bi, 1)[0];
      ordered.push(slab);
      var t = slab.rows[slab.rows.length - 1];
      cur = [t.x1, t.y];
    }
    return ordered;
  }

  /* Emit movement from `from` to `to`: short gaps become travel stitches,
     long ones a (split) jump. Appends to out; returns nothing. */
  function connect(out, from, to, opts) {
    if (!from) { // very first point of the design: single jump to start
      emitJump(out, [0, 0], to, opts);
      return;
    }
    var d = dist(from, to);
    if (d <= opts.travelMax) {
      var steps = Math.max(1, Math.ceil(d / opts.maxStitch));
      for (var s = 1; s <= steps; s++) {
        out.push([from[0] + (to[0] - from[0]) * (s / steps),
                  from[1] + (to[1] - from[1]) * (s / steps), 'st']);
      }
    } else {
      emitJump(out, from, to, opts);
    }
  }
  function emitJump(out, from, to, opts) {
    var d = dist(from, to);
    var hops = Math.max(1, Math.ceil(d / opts.maxJump));
    for (var hh = 1; hh <= hops; hh++) {
      out.push([from[0] + (to[0] - from[0]) * (hh / hops),
                from[1] + (to[1] - from[1]) * (hh / hops), 'jmp']);
    }
    out.push([to[0], to[1], 'st']); // tie-down stitch at landing
  }

  /* Main entry.
     bmp: { width, height, data: Uint8Array 0/1, pxPerUnit }
     opts: see DEFAULTS. Returns { stitches, stats } with stitches in
     PEC units centered on the bitmap center. */
  function plan(bmp, userOpts) {
    var opts = {};
    Object.keys(DEFAULTS).forEach(function (k) { opts[k] = DEFAULTS[k]; });
    Object.keys(userOpts || {}).forEach(function (k) { opts[k] = userOpts[k]; });

    var ppu = bmp.pxPerUnit;
    var rowStepPx = Math.max(1, opts.rowSpacing * ppu);
    var maxStitchPx = Math.max(2, opts.maxStitch * ppu);
    var comp = labelComponents(bmp);
    var out = [];
    var last = null;
    var jumps = 0;

    for (var c = 1; c <= comp.count; c++) {
      var rows = componentRuns(bmp, comp.labels, c, rowStepPx, opts.minRunPx);
      if (!rows.length) continue;
      var slabs = orderSlabs(buildSlabs(rows));
      slabs.forEach(function (slab) {
        var pts = slabPoints(slab, maxStitchPx);
        if (!pts.length) return;
        var before = out.length;
        connect(out, last, pts[0], { travelMax: opts.travelMax * ppu, maxStitch: maxStitchPx, maxJump: opts.maxJump * ppu });
        if (out.slice(before).some(function (s) { return s[2] === 'jmp'; })) jumps++;
        pts.forEach(function (p) { out.push([p[0], p[1], 'st']); });
        last = pts[pts.length - 1];
      });
    }

    /* px → PEC units, centered on the bitmap center. */
    var cx = bmp.width / 2, cy = bmp.height / 2;
    var stitches = out.map(function (s) {
      return [Math.round((s[0] - cx) / ppu), Math.round((s[1] - cy) / ppu), s[2]];
    });
    /* drop zero-length duplicates produced by rounding */
    var dedup = [];
    stitches.forEach(function (s) {
      var p = dedup[dedup.length - 1];
      if (p && p[0] === s[0] && p[1] === s[1] && p[2] === s[2] && s[2] === 'st') return;
      dedup.push(s);
    });
    dedup.push([dedup.length ? dedup[dedup.length - 1][0] : 0,
                dedup.length ? dedup[dedup.length - 1][1] : 0, 'end']);
    return {
      stitches: dedup,
      stats: { stitchCount: dedup.filter(function (s) { return s[2] === 'st'; }).length, jumps: jumps, components: comp.count }
    };
  }

  var api = { plan: plan, DEFAULTS: DEFAULTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EmbPlanner = api;
})(typeof window !== 'undefined' ? window : globalThis);

// Media Studio FFmpeg layer (§26): the argv composers are spawn-safe
// (arrays, never shell strings) and ffprobe JSON parses to our facts.
import { test } from "node:test";
import assert from "node:assert/strict";

import { probeCmd, thumbnailCmd, extractFrameCmd, waveformCmd, trimCmd, detachAudioCmd, imageExportCmd, videoExportCmd, parseProbeJson, IMAGE_PRESETS, imagePresetCmd } from "../media-studio/ffmpeg.ts";

test("image presets: crop fills+trims, fit keeps aspect, format-only has no -vf", () => {
  const crop = IMAGE_PRESETS.find((p) => p.id === "ig-square")!;
  const c = imagePresetCmd("media/a.jpg", "media/out.jpg", crop);
  assert.equal(c.bin, "ffmpeg");
  assert.ok(c.args.join(" ").includes("crop=1080:1080"), "crop preset trims to size");
  const fit = imagePresetCmd("media/a.jpg", "media/out.png", IMAGE_PRESETS.find((p) => p.id === "web-1200")!);
  assert.ok(fit.args.join(" ").includes("scale=1200"), "fit preset scales");
  const conv = imagePresetCmd("media/a.png", "media/out.webp", IMAGE_PRESETS.find((p) => p.id === "as-is")!);
  assert.ok(!conv.args.includes("-vf"), "format-only has no scale filter");
  assert.equal(conv.args[conv.args.length - 1], "media/out.webp", "output last → format from extension");
  const evil = imagePresetCmd("media/x; rm -rf ~.jpg", "o.jpg", crop);
  assert.ok(evil.args.includes("media/x; rm -rf ~.jpg"), "hostile filename stays one argv entry");
});

test("commands are argv arrays — a hostile filename stays a single argument", () => {
  const evil = "media/videos/x; rm -rf ~/.mp4";
  const t = trimCmd(evil, "out; danger.mp4", 10, 40);
  assert.equal(t.bin, "ffmpeg");
  assert.ok(Array.isArray(t.args));
  assert.ok(t.args.includes(evil)); // present as ONE element, not concatenated
  assert.ok(t.args.includes("out; danger.mp4"));
  // no element is a joined shell line
  assert.ok(!t.args.some((a) => / && | ; /.test(a) && a.includes("ffmpeg")));
});

test("trim: lossless copy by default, re-encode on request, correct duration", () => {
  const copy = trimCmd("in.mp4", "out.mp4", 10, 40);
  assert.deepEqual(copy.args, ["-y", "-ss", "10", "-i", "in.mp4", "-t", "30", "-c", "copy", "out.mp4"]);
  const re = trimCmd("in.mp4", "out.mp4", 10, 40, true);
  assert.ok(!re.args.includes("copy")); // re-encode for a frame-accurate cut
});

test("probe / thumbnail / frame / waveform / detach / exports compose sanely", () => {
  assert.equal(probeCmd("a.mp4").bin, "ffprobe");
  assert.ok(probeCmd("a.mp4").args.includes("-show_streams"));
  assert.ok(thumbnailCmd("a.mp4", "t.jpg", 2, 320).args.join(" ").includes("scale=320:-1"));
  assert.ok(extractFrameCmd("a.mp4", "f.png", 5).args.includes("5"));
  assert.ok(waveformCmd("a.m4a", "w.pcm").args.includes("pcm_s16le"));
  assert.deepEqual(detachAudioCmd("v.mp4", "a.wav").args, ["-y", "-i", "v.mp4", "-vn", "a.wav"]);
  assert.ok(imageExportCmd("a.png", "o.webp", 400, 400).args.join(" ").includes("force_original_aspect_ratio=decrease"));
  assert.ok(videoExportCmd("a.mov", "o.mp4", 1080, 1920).args.join(" ").includes("pad=1080:1920"));
});

test("parseProbeJson pulls container/codec/duration/size/fps/audio", () => {
  const json = JSON.stringify({
    format: { format_name: "mov,mp4,m4a", duration: "61.5" },
    streams: [
      { codec_type: "video", codec_name: "h264", width: 1920, height: 1080, r_frame_rate: "30000/1001" },
      { codec_type: "audio", codec_name: "aac", sample_rate: "48000", channels: 2 },
    ],
  });
  const f = parseProbeJson(json);
  assert.equal(f.container, "mov");
  assert.equal(f.codec, "h264");
  assert.equal(f.durationSec, 61.5);
  assert.equal(f.width, 1920);
  assert.equal(f.height, 1080);
  assert.equal(f.frameRate, 29.97);
  assert.equal(f.sampleRate, 48000);
  assert.equal(f.channels, 2);
  assert.deepEqual(parseProbeJson("not json"), {}); // never throws
});

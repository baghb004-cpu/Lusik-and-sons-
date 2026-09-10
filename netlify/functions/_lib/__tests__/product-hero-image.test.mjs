// ============================================================
// WHICH PHOTOGRAPH STANDS FOR A PRODUCT
// ============================================================
// The Custom Name Bib has no cover photograph — the old workshop shot was
// removed at the owner's request and nothing replaced it in the CMS. Any
// surface that reads product.coverImage for it draws an empty frame,
// which is what the home page's row of pieces did the first time it was
// built, beside four real product photos.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  NAME_BIB_EXAMPLES, productHeroImage, productHeroImages,
} from "../../../../src/lib/productHeroImage.js";

test("the name bib falls back to the past-customer photos", () => {
  const images = productHeroImages({ key: "bib-single", status: "live" });
  assert.deepEqual(images, [...NAME_BIB_EXAMPLES]);
  assert.ok(images.length > 1, "the name bib is a slideshow, not one photo");
});

test("a cover photograph wins when there is one", () => {
  assert.equal(
    productHeroImage({ key: "bib-hy-em", status: "live", coverImage: "/img/hye-em-bib/cover.jpg" }),
    "/img/hye-em-bib/cover.jpg",
  );
});

test("gallery photos stand in when there is no cover", () => {
  assert.equal(
    productHeroImage({ key: "x", status: "live", images: ["/img/a.jpg", "/img/b.jpg"] }),
    "/img/a.jpg",
  );
});

test("the alphabet blanket can fall back to its gallery", () => {
  assert.equal(
    productHeroImage({ key: "blanket-alphabet", status: "live" }, { galleryFallback: "/img/g.jpg" }),
    "/img/g.jpg",
  );
});

test("a product with nothing returns nothing, rather than a broken path", () => {
  // The caller must then draw no frame at all. Returning a placeholder
  // path from here would put a 404 in an <img> instead.
  assert.deepEqual(productHeroImages({ key: "nope", status: "placeholder" }), []);
  assert.equal(productHeroImage({ key: "nope", status: "placeholder" }), null);
  assert.deepEqual(productHeroImages(null), []);
  assert.equal(productHeroImage(undefined), null);
});

test("the name bib override only applies while it is live", () => {
  // A product taken off sale should not keep showing past orders.
  assert.deepEqual(productHeroImages({ key: "bib-single", status: "placeholder" }), []);
});

test("the returned list is a copy, so a caller cannot edit the constant", () => {
  const first = productHeroImages({ key: "bib-single", status: "live" });
  first.push("/img/nonsense.jpg");
  assert.equal(productHeroImages({ key: "bib-single", status: "live" }).length, NAME_BIB_EXAMPLES.length);
});

test("every past-customer photo the fallback names is a real file", async () => {
  const { existsSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, resolve } = await import("node:path");
  const here = dirname(fileURLToPath(import.meta.url));
  for (const rel of NAME_BIB_EXAMPLES) {
    const file = resolve(here, "../../../../public", rel.replace(/^\//, ""));
    assert.ok(existsSync(file), `${rel} is not in public/ — the card would 404`);
  }
});

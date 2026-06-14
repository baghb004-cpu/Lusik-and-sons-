// Datasets & shipping — public surface.

export {
  zipDatasetSchema,
  datasetManifestSchema,
  zipPlaceEntry,
  shippingConfigSchema,
  shippingZoneSchema,
  SHIPPING_DOC_PATH,
  DATASET_DIR,
  ZIP_RE,
  type ZipDataset,
  type ZipPlace,
  type ShippingConfig,
  type ShippingZone,
} from "./schema.ts";

export {
  normalizeZip,
  lookupZip,
  evaluateShipping,
  parseZipCsv,
  trimEntries,
  type ShippingQuote,
  type CsvImportReport,
} from "./lookup.ts";

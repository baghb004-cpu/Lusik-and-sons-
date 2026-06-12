// ============================================================
// i18n — per-project language settings (builder/i18n.json)
// ============================================================
// Which languages a site supports, its default, and the optional
// pre-entry language prompt (a gate shown BEFORE the visitor sees
// the site, asking them to pick a language). The switcher/gate
// blocks and the export both read this.
// ============================================================

import { z } from "zod";
import { DEFAULT_LOCALE, LOCALE_CODES, type LocaleCode } from "./locales.ts";

export const I18N_SETTINGS_PATH = "builder/i18n.json";

export const i18nSettingsSchema = z
  .object({
    schemaVersion: z.number().int().min(1).default(1),
    /** Languages this site offers (first is treated as the listing order). */
    locales: z.array(z.enum(LOCALE_CODES as [LocaleCode, ...LocaleCode[]])).min(1).default([DEFAULT_LOCALE]),
    /** Falls back to this when a string lacks the active locale. */
    defaultLocale: z.enum(LOCALE_CODES as [LocaleCode, ...LocaleCode[]]).default(DEFAULT_LOCALE),
    /** Remember the visitor's choice across visits (localStorage). */
    remember: z.boolean().default(true),
    /** The pre-entry language prompt. */
    gate: z
      .object({
        enabled: z.boolean().default(false),
        heading: z.string().default("Choose your language"),
        /** "blocking" = must pick before entering; "dismissible" = a suggestion. */
        mode: z.enum(["blocking", "dismissible"]).default("blocking"),
        /** Skip the gate if a remembered choice exists. */
        skipIfRemembered: z.boolean().default(true),
      })
      .strict()
      .default({ enabled: false, heading: "Choose your language", mode: "blocking", skipIfRemembered: true }),
  })
  .strict()
  .superRefine((s, ctx) => {
    if (!s.locales.includes(s.defaultLocale)) {
      ctx.addIssue({ code: "custom", path: ["defaultLocale"], message: "defaultLocale must be one of the enabled locales" });
    }
  });

export type I18nSettings = z.infer<typeof i18nSettingsSchema>;

export const DEFAULT_I18N_SETTINGS: I18nSettings = i18nSettingsSchema.parse({});

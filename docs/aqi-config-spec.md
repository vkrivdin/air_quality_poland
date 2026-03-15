# Powietrze — AQI Configuration Specification
**Version:** 1.0 | **Status:** Approved | **Last updated:** March 2026

This document is the single source of truth for every AQI level definition, activity threshold, external benchmark, and UI copy string in the Powietrze application. All values in this document map directly to `src/lib/aqi-config.ts`. If a benchmark changes (e.g. WHO revises its guidelines, EU amends a deadline), **update this document first**, then update the config file. Nothing else in the codebase should contain hardcoded threshold values or benchmark figures.

---

## 1. The Five AQI Levels

Powietrze uses the official Polish CAQI classification published by GIOŚ (Główny Inspektorat Ochrony Środowiska). There are exactly **five levels**. The previously used sixth level "Dostateczny" is not part of the official CAQI index and must be removed from `types.ts`.

| Key (TypeScript) | Polish label | English label | Score | PM2.5 range (µg/m³) |
|---|---|---|---|---|
| `bardzo_dobry` | Bardzo dobry | Very good | 1 | 0 – 10 |
| `dobry` | Dobry | Good | 2 | 10 – 20 |
| `umiarkowany` | Umiarkowany | Moderate | 3 | 20 – 35 |
| `zly` | Zły | Bad | 4 | 35 – 75 |
| `bardzo_zly` | Bardzo zły | Very bad | 5 | 75+ |

> **Note on GIOŚ mapping:** The GIOŚ API returns level names as Polish strings. The canonical mapping from API string → internal key is defined in `src/lib/aqi-config.ts` under `GIOS_LEVEL_NAME_MAP`. Do not map "Dostateczny" — treat it as `null` / no-data if encountered.

---

## 2. Colour System

Each level has one colour. This colour is used for: badge backgrounds, map markers, chart fill, warning banners, and activity state indicators. **Do not use Tailwind class names as the colour source** — derive Tailwind classes from the hex value in config, not the other way around.

| Level key | Hex (primary) | Background (10% opacity) | Border (50% opacity) | Text on white |
|---|---|---|---|---|
| `bardzo_dobry` | `#3B6D11` | `#EAF3DE` | `#97C459` | `#27500A` |
| `dobry` | `#0F6E56` | `#E1F5EE` | `#5DCAA5` | `#085041` |
| `umiarkowany` | `#854F0B` | `#FAEEDA` | `#EF9F27` | `#633806` |
| `zly` | `#993C1D` | `#FAECE7` | `#F0997B` | `#712B13` |
| `bardzo_zly` | `#A32D2D` | `#FCEBEB` | `#F09595` | `#791F1F` |
| `no_data` | `#5F5E5A` | `#F1EFE8` | `#B4B2A9` | `#444441` |

---

## 3. Headline Copy (Decision Language)

These are the exact strings rendered as the primary headline on the AQI dashboard card. They are imperative, plain Polish. Do not paraphrase in code — render these strings directly from config.

| Level key | Polish headline | English headline |
|---|---|---|
| `bardzo_dobry` | Powietrze jest czyste. Biegnij, jedź na rower, wietrz mieszkanie. | Air is clean. Run, cycle, open your windows. |
| `dobry` | Aktywność na świeżym powietrzu jest bezpieczna. | Outdoor activity is safe for most people. |
| `umiarkowany` | Ogranicz intensywną aktywność. Spacer jest OK — długi bieg już nie. | Limit intense activity. A walk is fine — a long run is not. |
| `zly` | Smog. Nie biegaj, nie jedź na rowerze. Dzieci i seniorzy zostają w domu. | Smog. No running, no cycling. Kids and elderly stay indoors. |
| `bardzo_zly` | Alarm smogowy. Zostań w domu. Zamknij wszystkie okna. | Smog alert. Stay indoors. Close all windows. |

---

## 4. Contextual Copy

Shown below the activity matrix on the dashboard card. Explains *why* the level is what it is, with seasonal and source context where relevant.

| Level key | Polish context | English context |
|---|---|---|
| `bardzo_dobry` | Takie dni w Krakowie są rzadkie zimą — to typowy poziom latem lub po deszczu. Korzystaj z tego. | Days like this are rare in Kraków in winter — typical in summer or after rain. Make the most of it. |
| `dobry` | Ten poziom przekracza roczny cel WHO (5 µg/m³) — bezpieczny dziś, ale nie bez znaczenia przy wieloletniej ekspozycji. | This level still exceeds the WHO annual guideline (5 µg/m³) — safe today, but not without long-term cost. |
| `umiarkowany` | Typowy poziom w Krakowie w łagodny dzień zimowy. Zdrowe osoby dorosłe mogą być aktywne krótko. Dzieci, seniorzy i astmatycy — zostańcie w domu lub skróćcie wyjście. | Kraków's typical level on a mild winter day. Healthy adults can be briefly active. Children, elderly, and those with asthma should limit exposure. |
| `zly` | Sezon grzewczy w Krakowie. Główne źródło: piece węglowe i kominki w okolicznych gminach — nie transport. Jeśli musisz wyjść — załóż maskę FFP2. | Heating season in Kraków. The primary source is coal boilers and fireplaces in surrounding areas — not traffic. If you must go outside — wear an FFP2 mask. |
| `bardzo_zly` | Ten poziom przekracza polski próg alarmu smogowego. PM2.5 jest 15-krotnie powyżej rocznej normy WHO. Godzina na zewnątrz przy tym poziomie to ekspozycja porównywalna z wypaleniem kilku papierosów. | This level exceeds the Polish official smog alert threshold. PM2.5 is 15× the WHO annual guideline. One hour outside at this level carries exposure equivalent to smoking several cigarettes. |

---

## 5. Activity Matrix

Five activities are displayed at every AQI level. Each has one of three states: `safe`, `caution`, or `avoid`. The state label (short, imperative Polish) is also defined here.

### Activity definitions

| Activity key | Polish name | English name |
|---|---|---|
| `running` | Bieganie | Running |
| `cycling` | Rower | Cycling |
| `walking` | Spacer | Walking |
| `kids_outside` | Dzieci na dworze | Kids outside |
| `ventilate` | Wietrzenie | Ventilate home |

### State definitions

| State key | Polish label | English label | Visual |
|---|---|---|---|
| `safe` | Bezpieczne | Safe | ✓ green circle |
| `caution` | Ostrożnie | With caution | ~ amber circle |
| `avoid` | Unikaj | Avoid | ✗ red circle |

### The matrix (activity × level → state + note)

Each cell: `[state_key, note_pl, note_en]`. Note is shown as a sub-label below the state icon. Keep notes under 5 words.

| Activity | bardzo_dobry | dobry | umiarkowany | zly | bardzo_zly |
|---|---|---|---|---|---|
| `running` | safe, —, — | safe, —, — | caution, Max 30 min, Max 30 min | avoid, Unikaj, Avoid | avoid, Unikaj, Avoid |
| `cycling` | safe, —, — | safe, —, — | caution, Unikaj ruchliwych ulic, Avoid busy roads | avoid, Unikaj, Avoid | avoid, Unikaj, Avoid |
| `walking` | safe, —, — | safe, —, — | safe, —, — | caution, Tylko w razie potrzeby, Essential only | avoid, Unikaj, Avoid |
| `kids_outside` | safe, —, — | safe, —, — | caution, Skróć czas pobytu, Shorten time outside | avoid, Zostań w domu, Stay indoors | avoid, Zostań w domu, Stay indoors |
| `ventilate` | safe, Wietrz śmiało, Ventilate freely | safe, Wietrz śmiało, Ventilate freely | caution, Wietrz krótko rano, Ventilate briefly in morning | avoid, Zamknij okna, Close windows | avoid, Zamknij wszystkie okna, Close all windows |

---

## 6. External Benchmarks

These are the values used in the compliance gap badge and modal. **Every value here has a source and a review date.** If a benchmark changes (WHO revises guidelines, EU amends a directive, Kraków publishes new annual data), update this section and the corresponding values in `src/lib/aqi-config.ts`.

```
BENCHMARKS = {
  krakow_annual_pm25: {
    value: 31,                        // µg/m³
    unit: "µg/m³ (annual average)",
    description_pl: "Średnie roczne PM2.5 w Krakowie (2019–2024)",
    description_en: "Kraków annual average PM2.5 (2019–2024)",
    source: "Applied Sciences peer-reviewed study, November 2025. 9-city Poland analysis.",
    last_reviewed: "March 2026",
    review_note: "Update when GIOŚ publishes new annual report (typically Q1 each year)."
  },

  eu_current_limit_pm25: {
    value: 25,                        // µg/m³
    unit: "µg/m³ (annual limit)",
    description_pl: "Obecny limit roczny UE — PM2.5",
    description_en: "Current EU annual PM2.5 limit",
    source: "EU Directive 2008/50/EC, Annex XIV.",
    last_reviewed: "March 2026",
    review_note: "This limit remains in force until 2030. No change expected before then."
  },

  eu_2030_target_pm25: {
    value: 10,                        // µg/m³
    unit: "µg/m³ (annual limit from 2030)",
    description_pl: "Cel UE na 2030 r. — PM2.5",
    description_en: "EU 2030 PM2.5 legal target",
    source: "EU Directive 2024/2881, Article 8 and Annex I. Entered into force 11 December 2024.",
    deadline: "1 January 2030",
    transposition_deadline: "11 December 2026",
    last_reviewed: "March 2026",
    review_note: "Monitor Polish transposition progress. If Poland fails to transpose by Dec 2026, flag in UI."
  },

  who_annual_pm25: {
    value: 5,                         // µg/m³
    unit: "µg/m³ (annual guideline)",
    description_pl: "Roczna norma WHO — PM2.5",
    description_en: "WHO annual PM2.5 guideline",
    source: "WHO Global Air Quality Guidelines, September 2021.",
    last_reviewed: "March 2026",
    review_note: "WHO reviews guidelines approximately every 10 years. Next expected revision ~2030–2031."
  },

  who_24h_pm25: {
    value: 15,                        // µg/m³
    unit: "µg/m³ (24-hour guideline)",
    description_pl: "Dobowa norma WHO — PM2.5",
    description_en: "WHO 24-hour PM2.5 guideline",
    source: "WHO Global Air Quality Guidelines, September 2021.",
    last_reviewed: "March 2026",
    review_note: "Same review cycle as annual guideline."
  },

  polish_alert_threshold_pm10: {
    value: 150,                       // µg/m³
    unit: "µg/m³ (24-hour, PM10)",
    description_pl: "Polski próg alertu smogowego — PM10",
    description_en: "Polish smog alert threshold — PM10",
    source: "Rozporządzenie Ministra Środowiska z 2019 r. (amended thresholds).",
    last_reviewed: "March 2026",
    review_note: "Monitor for further tightening under EU Directive transposition."
  },

  polish_information_threshold_pm10: {
    value: 100,                       // µg/m³
    unit: "µg/m³ (24-hour, PM10)",
    description_pl: "Polski próg informacyjny — PM10",
    description_en: "Polish information threshold — PM10",
    source: "Rozporządzenie Ministra Środowiska z 2019 r.",
    last_reviewed: "March 2026",
    review_note: "Same as alert threshold."
  }
}
```

### Compliance badge copy (driven by benchmarks)

The badge text is computed, not hardcoded. Logic: `ratio = krakow_annual_pm25 / eu_2030_target_pm25`. Display as `"X× powyżej normy UE 2030"` where X = `Math.round(ratio)`.

If `krakow_annual_pm25 <= who_annual_pm25`: badge reads `"Poniżej normy WHO"` (green).
If `krakow_annual_pm25 <= eu_current_limit_pm25`: badge reads `"Powyżej normy WHO"` (amber).
Otherwise: badge reads `"X× powyżej normy UE 2030"` (red).

---

## 7. Seasonal Context Rules

These rules determine which contextual message is shown in addition to the per-level copy. Rules are evaluated in order; first match wins.

| Rule | Condition | Polish message | English message |
|---|---|---|---|
| `heating_season` | month is 11, 12, 1, 2 AND level is `umiarkowany` or worse | Sezon grzewczy. Główne źródło smogu: piece i kominki w okolicznych gminach, nie transport. | Heating season. Primary source: boilers and fireplaces in surrounding municipalities, not traffic. |
| `boiler_ban` | month is 11, 12, 1, 2 AND level is `zly` or worse | Spalanie węgla i drewna w Krakowie jest zakazane od 2019 r. Zgłoś przypadki naruszenia: (link) | Coal and wood burning in Kraków has been banned since 2019. Report violations: (link) |
| `good_day` | level is `bardzo_dobry` or `dobry` | Dziś powietrze jest czystsze niż w {percentile}% dni tego roku w Krakowie. | Today's air is cleaner than {percentile}% of days this year in Kraków. |

`{percentile}` is computed at runtime from the Supabase historical readings. If fewer than 30 days of data exist, omit the `good_day` rule entirely rather than showing a misleading percentile.

---

## 8. Disclaimer (required in UI)

Display in the "About this data" expandable section and in the compliance modal footer.

**Polish:** Progi aktywności oparte na wytycznych WHO (2021) oraz klasyfikacji polskiego indeksu jakości powietrza GIOŚ. Dane o stężeniach PM2.5 i PM10 pochodzą z sieci GIOŚ i Airly. Cele redukcyjne na podstawie Dyrektywy UE 2024/2881. Informacje mają charakter orientacyjny. Osoby z chorobami układu oddechowego lub serca powinny skonsultować się z lekarzem.

**English:** Activity thresholds based on WHO guidelines (2021) and the Polish GIOŚ air quality index classification. Concentration data from GIOŚ and Airly sensor networks. Reduction targets based on EU Directive 2024/2881. Information is indicative only. People with respiratory or cardiovascular conditions should consult a doctor.

---

## 9. How to Update This Document

When any external standard changes:

1. Update the relevant section above (benchmarks, copy, or thresholds).
2. Increment the version number at the top.
3. Update `last_reviewed` in the affected benchmark entry.
4. Update the corresponding value in `src/lib/aqi-config.ts`.
5. Commit both files together with message: `data: update [benchmark name] to [new value] — [source]`
6. Search the entire codebase for the old value as a string to catch any accidental duplicates.

**What must never happen:** a benchmark value appearing as a magic number anywhere in the codebase except `src/lib/aqi-config.ts`. Lint rule to enforce this is documented in `docs/working-agreement.md`.

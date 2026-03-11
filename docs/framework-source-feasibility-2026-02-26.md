# Framework Source Feasibility Audit (2026-02-26)

This note records what is fully extractable now versus what is blocked by source access constraints.

## Extraction Gate Summary

- Command: `node scripts/frameworks/verify-extraction-gate.mjs --continue-on-error`
- Result: `checked=23, passed=18, failed=5`
- Fully passed frameworks (canonical extraction + hierarchy):
  - `owasp-asvs`
  - `owasp-samm`
  - `nist-ssdf`
  - `nist-csf-2.0`
  - `nist-800-53`
  - `nist-800-34`
  - `nist-800-171`
  - `cis-csc-v8`
  - `cyberfundamentals-20`
  - `dsomm`
  - `bsimm-15`
  - `nis2`
  - `aima`
  - `cmmc-l1-l2`
  - `secure-controls-framework`
  - `cloud-controls-matrix`
  - `nist-800-161`
  - `pci-dss`

## Blocked / Not Fully Extractable From Official Full Text

### 1) `iso27001-2022`

- Baseline expected controls: `93`
- Current canonical controls: `52`
- Blocking signal:
  - `https://www.iso.org/standard/82875.html` returns Cloudflare challenge page (`Just a moment...`) in this environment.
  - No machine-readable full official text endpoint available from current automated flow.

### 2) `iso-27002-2022`

- Baseline expected controls: `93`
- Current canonical controls: `52`
- Blocking signal:
  - Same ISO source access pattern and challenge protection.
  - No non-paywalled official full-text extraction endpoint confirmed.

### 3) `iec-62443-4-1`

- Baseline expected controls: `52`
- Current canonical controls: `50`
- Blocking signal:
  - IEC page is commerce-gated: `https://webstore.iec.ch/en/publication/33615`
  - Product page includes purchase/checkout flow and price metadata (`CHF 335`) rather than direct full-text export.

### 4) `mlps-2.0`

- Baseline expected controls: `345`
- Current canonical controls: `192`
- Blocking signal:
  - OpenSTD page exposes only `showGb` preview/download entry points.
  - Endpoint `http://c.gb688.cn/bzgk/gb/showGb?type=download&hcno=...` redirects back to metadata page in this environment, no stable full-text payload retrieved.

### 5) `guomi-sm`

- Baseline expected controls: `45`
- Current canonical controls: `31`
- Blocking signal:
  - Same OpenSTD interaction pattern as MLPS.
  - Online preview/download entry points present, but automated flow cannot retrieve complete machine-readable full text from source endpoints.

## PCI DSS Note

- `pci-dss` currently passes gate with expected `18` controls.
- Official PDF URL pattern exists on document library pages, but direct file fetch in this environment returns `HTTP 403` from `docs-prv.pcisecuritystandards.org` without interactive agreement/session flow.
- Current dataset should be treated as the highest reliable extraction available in this environment unless authenticated/interactive download automation is added.

## Practical Conclusion

- Extraction pipeline is complete for all currently extractable frameworks.
- Remaining gaps are source-access constraints, not parser hierarchy logic.
- To improve blocked frameworks, next step is source access enablement (authenticated browser session, license-compliant document access, or official machine-readable exports).

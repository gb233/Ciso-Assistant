# Profiled Gates And Requirement V2

This document defines a no-regression path for framework quality:

1. Keep existing structural integrity checks (counts, hierarchy, uniqueness).
2. Add semantic fields gradually using profile-specific gates.
3. Avoid global hard requirements that would incorrectly fail maturity/control frameworks.

## Why This Model

A single `type` field cannot represent mixed semantics in real frameworks:

- Some records are legal obligations.
- Some records are implementation controls.
- Some records are maturity outcomes.

The V2 model keeps the existing hierarchy and adds profile-driven semantics.

## Files Added

- `docs/schemas/requirement-v2.schema.json`
- `docs/specs/framework-v2/mlps-2.0.requirements-v2.sample.json`
- `docs/specs/framework-v2/guomi-sm.requirements-v2.sample.json`
- `scripts/frameworks/gate-profiles.json`
- `scripts/frameworks/framework-profiles.json`
- `scripts/frameworks/sync-framework-profiles.mjs`

## Profile Design

### 1) `control-baseline`

- Typical types: `standard`, `control`
- Required semantics: includes `control`
- Does not force legal-only fields for every record.

### 2) `maturity-baseline`

- Typical type: `maturity`
- Required semantics: includes `maturity`
- `obligationStrength` is explicitly not required.

### 3) `regulatory-obligation`

- Typical types: `compliance`, `regulation`
- Required semantics: includes `obligation`
- Requires stronger legal metadata as tier increases.

## Tier Model

### Bronze

- Structural reliability and source provenance baseline.
- Target: do not block current international frameworks.

### Silver

- Internal analysis quality.
- Adds profile-specific semantic fields.

### Gold

- Customer-facing / audit-ready quality.
- Requires higher traceability and reviewer-backed high-confidence mappings.

## How This Avoids "Completeness Regression"

- Existing frameworks remain valid under `enforcedTier=bronze`.
- Advanced fields are staged by profile and tier, not globally mandatory.
- Unknown/NA is explicit and auditable via `{ value, status, basis }`.

## Operational Commands

```bash
# Rebuild framework -> profile assignments from index files
npm run frameworks:sync-profiles

# Run profile gate in report mode (non-blocking)
npm run frameworks:verify-profile-gate

# Run profile gate for one framework
npm run frameworks:verify-profile-one -- --framework=mlps-2.0
```

## Migration Strategy

1. Keep `verify-extraction-gate.mjs` as structural gate.
2. Introduce profile gate as a separate non-blocking report first.
3. Promote profile checks to blocking for selected framework groups only.
4. Raise selected frameworks from Bronze -> Silver -> Gold progressively.

This staged path preserves current velocity while improving legal and semantic precision.

## Pilot Templates

The first pilot templates are provided for China-focused frameworks:

- `docs/specs/framework-v2/mlps-2.0.requirements-v2.sample.json`
- `docs/specs/framework-v2/guomi-sm.requirements-v2.sample.json`

These files are intentionally partial and demonstrate the V2 field contract and `status/basis` semantics.

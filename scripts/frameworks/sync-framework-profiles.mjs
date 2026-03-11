#!/usr/bin/env node

import { readFile, writeFile } from "fs/promises";
import { join } from "path";

const ROOT = process.cwd();
const INDEX_ZH = join(ROOT, "public/data/frameworks/index.json");
const INDEX_EN = join(ROOT, "public/data/frameworks/index-en.json");
const GATE_PROFILES_PATH = join(ROOT, "scripts/frameworks/gate-profiles.json");
const OUTPUT_PATH = join(ROOT, "scripts/frameworks/framework-profiles.json");

const PROFILE_BY_TYPE = {
  maturity: "maturity-baseline",
  compliance: "regulatory-obligation",
  regulation: "regulatory-obligation",
  control: "control-baseline",
  standard: "control-baseline"
};

const RECOMMENDED_TIER_BY_PROFILE = {
  "control-baseline": "bronze",
  "maturity-baseline": "bronze",
  "regulatory-obligation": "silver"
};

const MANUAL_OVERRIDES = {
  "mlps-2.0": {
    recommendedTier: "bronze",
    notes: "Keep bronze until canonical zh source and count consistency are fixed."
  },
  "guomi-sm": {
    recommendedTier: "bronze",
    notes: "Keep bronze until expected requirement count and category declarations are aligned."
  }
};

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function mapFrameworksById(indexData) {
  const map = new Map();
  for (const item of indexData.frameworks || []) {
    map.set(item.id, item);
  }
  return map;
}

function sortObjectKeys(input) {
  return Object.keys(input)
    .sort()
    .reduce((acc, key) => {
      acc[key] = input[key];
      return acc;
    }, {});
}

async function main() {
  const [zhIndex, enIndex, gateProfiles] = await Promise.all([
    readJson(INDEX_ZH),
    readJson(INDEX_EN),
    readJson(GATE_PROFILES_PATH)
  ]);

  const supportedProfiles = new Set(Object.keys(gateProfiles.profiles || {}));
  const zhById = mapFrameworksById(zhIndex);
  const enById = mapFrameworksById(enIndex);
  const ids = Array.from(new Set([...zhById.keys(), ...enById.keys()])).sort();

  const outputProfiles = {};
  for (const id of ids) {
    const zhMeta = zhById.get(id) || null;
    const enMeta = enById.get(id) || null;
    const frameworkType = zhMeta?.type || enMeta?.type || "standard";
    const region = zhMeta?.region || enMeta?.region || "global";

    const profileId = PROFILE_BY_TYPE[frameworkType] || "control-baseline";
    if (!supportedProfiles.has(profileId)) {
      throw new Error(`Unsupported profile "${profileId}" for framework "${id}"`);
    }

    const baseEntry = {
      frameworkType,
      region,
      profileId,
      enforcedTier: "bronze",
      recommendedTier: RECOMMENDED_TIER_BY_PROFILE[profileId] || "bronze",
      notes: ""
    };

    const override = MANUAL_OVERRIDES[id];
    outputProfiles[id] = override
      ? {
          ...baseEntry,
          ...override
        }
      : baseEntry;
  }

  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceFiles: {
      zhIndex: "public/data/frameworks/index.json",
      enIndex: "public/data/frameworks/index-en.json",
      gateProfiles: "scripts/frameworks/gate-profiles.json"
    },
    profiles: sortObjectKeys(outputProfiles)
  };

  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Synced framework profile assignments: ${ids.length} frameworks`);
  console.log(`Output: ${OUTPUT_PATH.replace(`${ROOT}/`, "")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

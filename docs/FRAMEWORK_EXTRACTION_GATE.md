# Framework Extraction Gate

这个门禁实现了严格的顺序流程：

1. `preflight`（拉取前）
2. `pull`（读取原始主源）
3. `postPullValidation`（拉取后完整性校验）
4. `translationReadiness`（仅在主源通过后，才检查派生翻译）

任何阶段失败，都会停止该框架后续阶段；默认还会直接停止整个批次（fail-fast）。

## Canonical Source Rule

- 国际/欧美框架默认主源：英文 `*-en.json`
- 中国框架默认主源：中文 `*.json`
- 可在 `scripts/frameworks/official-baselines.json` 里通过 `canonicalLanguage` 覆盖

## Commands

```bash
# 顺序门禁：按 index-en.json 顺序逐个检查，遇到首个失败即停止
npm run frameworks:verify-gate

# 单框架检查
npm run frameworks:verify-one -- --framework=owasp-asvs

# 即使失败也继续跑完（用于全量盘点）
npm run frameworks:verify-gate -- --continue-on-error
```

## Stage Checks

### 1) preflight

- index 元数据存在（中/英）
- baseline 存在
- `expectedRequirements` 已配置
- canonical 语言可解析
- （警告）是否配置了可追溯的 `source/sourceUrl`

### 2) pull

- canonical 主源文件可读
- JSON 可解析
- 文件 `id/language` 与期望一致
- 实际层级统计可计算（categories/subcategories/requirements）

### 3) postPullValidation

- 主源 `requirements` 数量对比 baseline
- 主源 `stats.totalRequirements` 与实际一致
- 主源 index 的 `requirements` 与实际一致
- `category.requirements` 声明与实际一致
- requirement `id/code` 无重复

### 4) translationReadiness

- 仅在主源通过后执行
- 派生语言文件可读、可解析、language 正确
- 派生层级计数与主源一致
- 派生文件/派生 index 统计一致
- 派生 `category.requirements` 一致、`id/code` 无重复
- 英文文件不应包含中文字符串；中文文件应包含中文字符串

## Reports

每个框架都会生成报告：

```text
docs/framework-checkpoints/<framework-id>.json
```

报告中包含 `stages.preflight/pull/postPullValidation/translationReadiness` 的逐项检查、错误和警告。

## Baseline File

`scripts/frameworks/official-baselines.json` 当前字段：

- `canonicalLanguage`
- `expectedRequirements`
- `expectedCategories`（可选）
- `expectedSubcategories`（可选）
- `source`
- `sourceUrl`
- `sourceVersion`

要达到“最真实、可追溯”的标准，需要为每个框架补全官方来源、版本和 URL，然后再进行后续翻译派生。

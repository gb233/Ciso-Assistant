# Framework Audit (2026-02-26)

## Scope
- 对照对象：本地 JSON、Sammy 浏览页面（可抓取结构）、官方来源基线（见下方“官方基线”）。
- 抽样框架：`owasp-samm`, `nist-ssdf`, `nist-csf-2.0`, `pci-dss`, `mlps-2.0`。

## Local vs Sammy
| Framework | Local (cat/sub/req) | Sammy (L1/L2/L3-links) | Sammy slug |
|---|---:|---:|---|
| owasp-samm (OWASP SAMM) | 5/15/96 | 5/15/2-17 | samm |
| nist-ssdf (NIST SSDF) | 4/19/42 | 4/19/3-22 | nist-ssdf |
| nist-csf-2.0 (NIST 网络安全框架 2.0) | 6/22/52 | 6/22/5-27 | nist-csf-20 |
| pci-dss (PCI DSS) | 3/6/18 | 5/15/2-17 | samm |
| mlps-2.0 (等级保护 2.0) | 10/68/192 | 5/15/2-17 | samm |

## Official Baseline (Machine-checkable)
- OWASP SAMM 官方结构：5 business functions、15 security practices（来源：https://owaspsamm.org/about/）。
- NIST SSDF v1.1：通过 NIST 官方补充文件 `nist.sp.800-218.ssdf-table.xlsx` 统计得到 4 groups、20 practices、44 tasks。
- NIST CSF 2.0：通过 NIST 官方文件 `CSF 1.1 to 2.0 Core Transition Changes.xlsx`（2024-09-19）统计得到 6 functions、22 categories、106 subcategories。

## Audit Notes
- `pci-dss` 的 Sammy 链接 `/browse/pci-dss` 实际落到 `/browse/samm`，无法作为该框架的有效对照。
- `mlps-2.0` 的 Sammy 链接 `/browse/mlps-2.0` 实际落到 `/browse/samm`，无法作为该框架的有效对照。

## Conclusion
- 本地与 Sammy 在多个框架存在明显层级偏差（尤其是子层级与条目总数）。
- 建议后续以“主源 + 派生翻译”流水线重建数据，并以官方机读文件做结构校验门禁。

import FrameworkModeLayout from './FrameworkModeLayout';
import type { FrameworkModeViewProps } from './types';

export default function RegulationFrameworkModeView(props: FrameworkModeViewProps) {
  return (
    <FrameworkModeLayout
      {...props}
      copy={{
        modeTagZh: '法规条款模式',
        modeTagEn: 'Regulatory Clause Mode',
        defaultStatusZh: '当前显示法规义务条款视图。',
        defaultStatusEn: 'Showing regulatory obligation clause view.',
        introTitleZh: '法规义务视图（03）',
        introTitleEn: 'Regulatory Obligation View (03)',
        introTextZh: '右侧聚焦条款义务、来源依据和适用范围；不使用控制框架的展示方式。',
        introTextEn: 'The right panel focuses on obligations, legal source references, and applicability scope.',
        legendItemsZh: ['MUST 必须', 'SHOULD 应当', 'MAY 可选'],
        legendItemsEn: ['MUST mandatory', 'SHOULD recommended', 'MAY optional'],
        headerGradientClassName: 'bg-gradient-to-r from-white via-amber-50/60 to-orange-50/45',
        statusStripClassName: 'bg-amber-50/30',
        modeTagClassName: 'bg-amber-50 text-amber-700 border-amber-200',
      }}
    />
  );
}

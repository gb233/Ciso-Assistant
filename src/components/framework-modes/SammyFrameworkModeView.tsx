import FrameworkModeLayout from './FrameworkModeLayout';
import type { FrameworkModeViewProps } from './types';

export default function SammyFrameworkModeView(props: FrameworkModeViewProps) {
  return (
    <FrameworkModeLayout
      {...props}
      copy={{
        modeTagZh: '成熟度模式',
        modeTagEn: 'Maturity Mode',
        defaultStatusZh: '当前显示成熟度实践视图。',
        defaultStatusEn: 'Showing maturity practice view.',
        introTitleZh: '成熟度视图（02）',
        introTitleEn: 'Maturity View (02)',
        introTextZh: '按实践分组展示末级问题，右侧突出成熟度量表，不再按控制类模板硬套。',
        introTextEn: 'Leaf practice questions are grouped with maturity scale emphasis instead of forcing control-style rendering.',
        legendItemsZh: ['L0 未评估', 'L1 部分', 'L2 基本', 'L3 完全'],
        legendItemsEn: ['L0 Not assessed', 'L1 Partial', 'L2 Mostly', 'L3 Full'],
        headerGradientClassName: 'bg-gradient-to-r from-white via-cyan-50/60 to-sky-50/45',
        statusStripClassName: 'bg-cyan-50/35',
        modeTagClassName: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      }}
    />
  );
}

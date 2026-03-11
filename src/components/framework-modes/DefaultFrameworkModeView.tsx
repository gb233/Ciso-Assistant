import FrameworkModeLayout from './FrameworkModeLayout';
import type { FrameworkModeViewProps } from './types';

export default function DefaultFrameworkModeView(props: FrameworkModeViewProps) {
  return (
    <FrameworkModeLayout
      {...props}
      copy={{
        modeTagZh: '控制项模式',
        modeTagEn: 'Control Mode',
        defaultStatusZh: '当前显示完整框架要求（控制项叶子）。',
        defaultStatusEn: 'Showing full framework requirements (leaf controls).',
        introTitleZh: '控制项视图（01）',
        introTitleEn: 'Control View (01)',
        introTextZh: '仅展示末级控制项，避免把整棵框架结构重复堆叠到右侧内容区。',
        introTextEn: 'Only leaf controls are shown to avoid repeating full hierarchy in the right content area.',
        legendItemsZh: ['叶子控制项', '证据要点', '关联引用'],
        legendItemsEn: ['Leaf controls', 'Evidence hints', 'References'],
        headerGradientClassName: 'bg-gradient-to-r from-white to-cyan-50/50',
        statusStripClassName: 'bg-white/70',
        modeTagClassName: 'bg-slate-50 text-slate-700 border-slate-200',
      }}
    />
  );
}

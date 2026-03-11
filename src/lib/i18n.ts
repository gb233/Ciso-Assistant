/**
 * 国际化配置
 * Internationalization configuration
 */

export type Language = 'zh' | 'en';

export interface Translations {
  // Common
  common: {
    appName: string;
    appDescription: string;
    search: string;
    filter: string;
    sort: string;
    loading: string;
    error: string;
    retry: string;
    save: string;
    cancel: string;
    confirm: string;
    close: string;
    back: string;
    next: string;
    previous: string;
    submit: string;
    export: string;
    import: string;
    download: string;
    upload: string;
    delete: string;
    edit: string;
    add: string;
    remove: string;
    view: string;
    details: string;
    more: string;
    less: string;
    showAll: string;
    hide: string;
    all: string;
    none: string;
    selectAll: string;
    clear: string;
    reset: string;
    apply: string;
    success: string;
    failed: string;
    warning: string;
    info: string;
  };
  // Navigation
  nav: {
    home: string;
    frameworks: string;
    frameworkStructure: string;
    maturityAssessment: string;
    assessmentReport: string;
    search: string;
    settings: string;
    help: string;
    about: string;
  };
  // Framework
  framework: {
    title: string;
    description: string;
    version: string;
    type: string;
    domain: string;
    region: string;
    requirements: string;
    categories: string;
    subcategories: string;
    maturityLevels: string;
    level: string;
    totalRequirements: string;
    assessed: string;
    unassessed: string;
    completionRate: string;
    averageScore: string;
    maturityLevel: string;
    notStarted: string;
    inProgress: string;
    completed: string;
  };
  // Assessment
  assessment: {
    title: string;
    description: string;
    progress: string;
    score: string;
    score0: string;
    score1: string;
    score2: string;
    score3: string;
    notes: string;
    addNotes: string;
    lastUpdated: string;
    assessmentDate: string;
    assessedBy: string;
    notAssessed: string;
    partiallyImplemented: string;
    basicallyImplemented: string;
    fullyImplemented: string;
  };
  // Report
  report: {
    title: string;
    summary: string;
    scoreDistribution: string;
    improvementSuggestions: string;
    assessedRequirements: string;
    exportJSON: string;
    exportCSV: string;
    generateReport: string;
    noData: string;
    startAssessment: string;
  };
  // Requirement
  requirement: {
    title: string;
    code: string;
    name: string;
    description: string;
    verification: string;
    references: string;
    cwe: string;
    nist: string;
    level: string;
    category: string;
    subcategory: string;
    relatedRequirements: string;
  };
  // Language
  language: {
    title: string;
    zh: string;
    en: string;
    switchTo: string;
  };
}

export const translations: Record<Language, Translations> = {
  zh: {
    common: {
      appName: 'CISO助手',
      appDescription: '面向CISO的安全框架评估、治理改进与报告工作台',
      search: '搜索',
      filter: '筛选',
      sort: '排序',
      loading: '加载中...',
      error: '出错了',
      retry: '重试',
      save: '保存',
      cancel: '取消',
      confirm: '确认',
      close: '关闭',
      back: '返回',
      next: '下一步',
      previous: '上一步',
      submit: '提交',
      export: '导出',
      import: '导入',
      download: '下载',
      upload: '上传',
      delete: '删除',
      edit: '编辑',
      add: '添加',
      remove: '移除',
      view: '查看',
      details: '详情',
      more: '更多',
      less: '收起',
      showAll: '显示全部',
      hide: '隐藏',
      all: '全部',
      none: '无',
      selectAll: '全选',
      clear: '清除',
      reset: '重置',
      apply: '应用',
      success: '成功',
      failed: '失败',
      warning: '警告',
      info: '信息',
    },
    nav: {
      home: '首页',
      frameworks: '安全框架',
      frameworkStructure: '框架结构',
      maturityAssessment: '框架评估',
      assessmentReport: '评估报告',
      search: '搜索',
      settings: '设置',
      help: '帮助',
      about: '关于',
    },
    framework: {
      title: '框架',
      description: '描述',
      version: '版本',
      type: '类型',
      domain: '领域',
      region: '地区',
      requirements: '安全要求',
      categories: '分类',
      subcategories: '子分类',
      maturityLevels: '成熟度级别',
      level: '标签',
      totalRequirements: '总要求数',
      assessed: '已评估',
      unassessed: '未评估',
      completionRate: '完成度',
      averageScore: '平均评分',
      maturityLevel: '成熟度级别',
      notStarted: '未开始',
      inProgress: '进行中',
      completed: '已完成',
    },
    assessment: {
      title: '评估',
      description: '评估组织在框架中的成熟度水平',
      progress: '评估进度',
      score: '评分',
      score0: '未评估',
      score1: '部分实施',
      score2: '基本实施',
      score3: '完全实施',
      notes: '备注',
      addNotes: '添加备注...',
      lastUpdated: '最后更新',
      assessmentDate: '评估日期',
      assessedBy: '评估人',
      notAssessed: '未评估',
      partiallyImplemented: '部分实施',
      basicallyImplemented: '基本实施',
      fullyImplemented: '完全实施',
    },
    report: {
      title: '评估报告',
      summary: '报告摘要',
      scoreDistribution: '评分分布',
      improvementSuggestions: '改进建议',
      assessedRequirements: '已评估要求',
      exportJSON: '导出 JSON',
      exportCSV: '导出 CSV',
      generateReport: '生成报告',
      noData: '暂无评估数据',
      startAssessment: '开始评估',
    },
    requirement: {
      title: '安全要求',
      code: '代码',
      name: '名称',
      description: '描述',
      verification: '验证方法',
      references: '参考标准',
      cwe: 'CWE',
      nist: 'NIST',
      level: '标签',
      category: '分类',
      subcategory: '子分类',
      relatedRequirements: '相关要求',
    },
    language: {
      title: '语言',
      zh: '中文',
      en: 'English',
      switchTo: '切换到',
    },
  },
  en: {
    common: {
      appName: 'Ciso-Assistant',
      appDescription: 'A CISO-focused workspace for framework assessment, governance improvement, and reporting',
      search: 'Search',
      filter: 'Filter',
      sort: 'Sort',
      loading: 'Loading...',
      error: 'Error',
      retry: 'Retry',
      save: 'Save',
      cancel: 'Cancel',
      confirm: 'Confirm',
      close: 'Close',
      back: 'Back',
      next: 'Next',
      previous: 'Previous',
      submit: 'Submit',
      export: 'Export',
      import: 'Import',
      download: 'Download',
      upload: 'Upload',
      delete: 'Delete',
      edit: 'Edit',
      add: 'Add',
      remove: 'Remove',
      view: 'View',
      details: 'Details',
      more: 'More',
      less: 'Less',
      showAll: 'Show All',
      hide: 'Hide',
      all: 'All',
      none: 'None',
      selectAll: 'Select All',
      clear: 'Clear',
      reset: 'Reset',
      apply: 'Apply',
      success: 'Success',
      failed: 'Failed',
      warning: 'Warning',
      info: 'Info',
    },
    nav: {
      home: 'Home',
      frameworks: 'Frameworks',
      frameworkStructure: 'Structure',
      maturityAssessment: 'Framework Assessment',
      assessmentReport: 'Report',
      search: 'Search',
      settings: 'Settings',
      help: 'Help',
      about: 'About',
    },
    framework: {
      title: 'Framework',
      description: 'Description',
      version: 'Version',
      type: 'Type',
      domain: 'Domain',
      region: 'Region',
      requirements: 'Requirements',
      categories: 'Categories',
      subcategories: 'Subcategories',
      maturityLevels: 'Maturity Levels',
      level: 'Tag',
      totalRequirements: 'Total Requirements',
      assessed: 'Assessed',
      unassessed: 'Unassessed',
      completionRate: 'Completion Rate',
      averageScore: 'Average Score',
      maturityLevel: 'Maturity Level',
      notStarted: 'Not Started',
      inProgress: 'In Progress',
      completed: 'Completed',
    },
    assessment: {
      title: 'Assessment',
      description: 'Assess organizational maturity level in the framework',
      progress: 'Assessment Progress',
      score: 'Score',
      score0: 'Not Assessed',
      score1: 'Partially Implemented',
      score2: 'Basically Implemented',
      score3: 'Fully Implemented',
      notes: 'Notes',
      addNotes: 'Add notes...',
      lastUpdated: 'Last Updated',
      assessmentDate: 'Assessment Date',
      assessedBy: 'Assessed By',
      notAssessed: 'Not Assessed',
      partiallyImplemented: 'Partially Implemented',
      basicallyImplemented: 'Basically Implemented',
      fullyImplemented: 'Fully Implemented',
    },
    report: {
      title: 'Assessment Report',
      summary: 'Summary',
      scoreDistribution: 'Score Distribution',
      improvementSuggestions: 'Improvement Suggestions',
      assessedRequirements: 'Assessed Requirements',
      exportJSON: 'Export JSON',
      exportCSV: 'Export CSV',
      generateReport: 'Generate Report',
      noData: 'No assessment data',
      startAssessment: 'Start Assessment',
    },
    requirement: {
      title: 'Security Requirement',
      code: 'Code',
      name: 'Name',
      description: 'Description',
      verification: 'Verification',
      references: 'References',
      cwe: 'CWE',
      nist: 'NIST',
      level: 'Tag',
      category: 'Category',
      subcategory: 'Subcategory',
      relatedRequirements: 'Related Requirements',
    },
    language: {
      title: 'Language',
      zh: '中文',
      en: 'English',
      switchTo: 'Switch to',
    },
  },
};

// Default language
export const DEFAULT_LANGUAGE: Language = 'zh';

// Language storage key
export const LANGUAGE_STORAGE_KEY = 'security-framework-language';
export const LANGUAGE_COOKIE_KEY = 'security-framework-language';

export function normalizeLanguage(value?: string | null): Language {
  if (!value) return DEFAULT_LANGUAGE;
  return value.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

// Get language from localStorage or default
export function getStoredLanguage(): Language {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === 'zh' || stored === 'en') {
    return stored;
  }
  return DEFAULT_LANGUAGE;
}

// Save language to localStorage
export function storeLanguage(lang: Language): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
}

// Get translation by key path
export function getTranslation(
  lang: Language,
  section: keyof Translations,
  key: string
): string {
  const sectionData = translations[lang][section];
  return (sectionData as Record<string, string>)[key] || key;
}

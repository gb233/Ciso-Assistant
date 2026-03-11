'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, CheckCircle, Circle, BarChart3, RotateCcw } from 'lucide-react';
import { useLanguage } from './LanguageProvider';

interface Question {
  id: string;
  category: string;
  subcategory: string;
  question: string;
  description?: string;
  level: number;
  requirementId?: string;
}

interface MaturityLevel {
  level: number;
  name: string;
  description: string;
  characteristics: string[];
}

interface Props {
  framework: any;
  questions: Question[];
  maturityLevels: MaturityLevel[];
}

type AnswerValue = 0 | 1 | 2 | 3;

export default function AssessmentClient({ framework, questions, maturityLevels }: Props) {
  const { language } = useLanguage();
  const isZh = language === 'zh';
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [showResults, setShowResults] = useState(false);

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const answeredCount = Object.keys(answers).length;

  const handleAnswer = useCallback((questionId: string, value: AnswerValue) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  }, []);

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setShowResults(true);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleReset = () => {
    setAnswers({});
    setCurrentQuestionIndex(0);
    setShowResults(false);
  };

  const calculateResults = () => {
    const totalScore = Object.values(answers).reduce((sum: number, val: AnswerValue) => sum + val, 0);
    const maxScore = questions.length * 3;
    const percentage = (totalScore / maxScore) * 100;

    let maturityLevel = maturityLevels[0];
    if (percentage >= 75) maturityLevel = maturityLevels[3];
    else if (percentage >= 50) maturityLevel = maturityLevels[2];
    else if (percentage >= 25) maturityLevel = maturityLevels[1];

    const categoryScores: Record<string, { score: number; max: number; count: number }> = {};
    questions.forEach(q => {
      if (!categoryScores[q.category]) {
        categoryScores[q.category] = { score: 0, max: 0, count: 0 };
      }
      const answer = answers[q.id] || 0;
      categoryScores[q.category].score += answer;
      categoryScores[q.category].max += 3;
      categoryScores[q.category].count++;
    });

    const improvements: string[] = [];
    Object.entries(categoryScores).forEach(([category, data]) => {
      const catPercentage = (data.score / data.max) * 100;
      if (catPercentage < 50) {
        improvements.push(isZh
          ? `${category}：需要重点关注，建议制定专项改进计划`
          : `${category}: needs priority attention; define a focused improvement plan`);
      } else if (catPercentage < 75) {
        improvements.push(isZh
          ? `${category}：有一定基础，可进一步提升`
          : `${category}: has a baseline; further improvement is recommended`);
      }
    });

    return {
      totalScore,
      maxScore,
      percentage: Math.round(percentage),
      maturityLevel,
      categoryScores,
      improvements: improvements.length > 0
        ? improvements
        : [isZh ? '整体表现良好，继续保持并寻求持续改进' : 'Overall performance is good; keep improving continuously']
    };
  };

  const options = isZh
    ? [
        { value: 0, label: '未实施', desc: '尚未开始或没有相关实践' },
        { value: 1, label: '部分实施', desc: '有初步实践但不完整' },
        { value: 2, label: '基本实施', desc: '已建立基本流程和实践' },
        { value: 3, label: '完全实施', desc: '已全面实施并持续优化' }
      ]
    : [
        { value: 0, label: 'Not Implemented', desc: 'Not started or no relevant practices' },
        { value: 1, label: 'Partially Implemented', desc: 'Initial practices exist but are incomplete' },
        { value: 2, label: 'Mostly Implemented', desc: 'Core processes and practices are in place' },
        { value: 3, label: 'Fully Implemented', desc: 'Fully implemented with continuous optimization' }
      ];

  if (showResults) {
    const results = calculateResults();

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4">
            <BarChart3 className="w-10 h-10 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{isZh ? '评估完成' : 'Assessment Completed'}</h2>
          <p className="text-gray-600">{isZh ? '以下是您的成熟度评估报告' : 'Here is your maturity assessment summary'}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-medium text-gray-700">{isZh ? '总体成熟度' : 'Overall Maturity'}</span>
            <span className="text-3xl font-bold text-blue-600">{results.percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${results.percentage}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">{isZh ? '成熟度级别' : 'Maturity Level'}</span>
            <span className="text-lg font-semibold text-gray-900">
              {results.maturityLevel.name}
            </span>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{isZh ? '各领域得分' : 'Category Scores'}</h3>
          <div className="space-y-3">
            {Object.entries(results.categoryScores).map(([category, data]) => {
              const percentage = Math.round((data.score / data.max) * 100);
              return (
                <div key={category} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-700">{category}</span>
                    <span className="text-sm font-medium text-gray-900">{percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        percentage >= 75 ? 'bg-green-500' :
                        percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{isZh ? '改进建议' : 'Improvement Suggestions'}</h3>
          <ul className="space-y-2">
            {results.improvements.map((suggestion, index) => (
              <li key={index} className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                <span className="text-gray-700">{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex space-x-4">
          <button
            onClick={handleReset}
            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{isZh ? '重新评估' : 'Restart Assessment'}</span>
          </button>
          <Link
            href={`/frameworks/${framework.id}`}
            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <span>{isZh ? '查看框架详情' : 'View Framework'}</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">
            {isZh ? '问题' : 'Question'} {currentQuestionIndex + 1} / {questions.length}
          </span>
          <span className="text-sm text-gray-600">
            {isZh ? '已回答' : 'Answered'} {answeredCount} / {questions.length}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mb-8">
        <div className="flex items-center space-x-2 mb-4">
          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm font-medium">
            {currentQuestion.category}
          </span>
          <span className="text-gray-400">/</span>
          <span className="text-gray-600 text-sm">{currentQuestion.subcategory}</span>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-3">{currentQuestion.question}</h3>

        {currentQuestion.description && (
          <p className="text-gray-600 mb-6">{currentQuestion.description}</p>
        )}

        <div className="space-y-3">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => handleAnswer(currentQuestion.id, option.value as AnswerValue)}
              className={`w-full flex items-center p-4 rounded-lg border-2 transition-all ${
                answers[currentQuestion.id] === option.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {answers[currentQuestion.id] === option.value ? (
                <CheckCircle className="w-5 h-5 text-blue-600 mr-3" />
              ) : (
                <Circle className="w-5 h-5 text-gray-400 mr-3" />
              )}
              <div className="text-left">
                <div className={`font-medium ${
                  answers[currentQuestion.id] === option.value ? 'text-blue-900' : 'text-gray-900'
                }`}>
                  {option.label}
                </div>
                <div className="text-sm text-gray-500">{option.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentQuestionIndex === 0}
          className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>{isZh ? '上一题' : 'Previous'}</span>
        </button>

        <button
          onClick={handleNext}
          disabled={answers[currentQuestion.id] === undefined}
          className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>{currentQuestionIndex === questions.length - 1 ? (isZh ? '查看结果' : 'View Results') : (isZh ? '下一题' : 'Next')}</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

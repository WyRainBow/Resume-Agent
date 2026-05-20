import React from 'react';

interface DimensionScore {
  name: string;
  score: number;
  reasons: string[];
}

interface ScoreCardProps {
  overallScore: number;
  dimensions: DimensionScore[];
  jdText: string;
}

export const ScoreCard: React.FC<ScoreCardProps> = ({ overallScore, dimensions, jdText }) => {
  const getScoreColorClass = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="score-card p-4 border border-gray-200 rounded-lg mt-4">
      <h3 className="mb-3">简历评分</h3>

      <div className="mb-4">
        <span className={`text-2xl font-bold ${getScoreColorClass(overallScore)}`}>
          {overallScore}
        </span>
        <span className="text-gray-500"> / 100 总体匹配度</span>
      </div>

      <div className="flex gap-3 mb-4">
        {dimensions.map((dim) => (
          <div key={dim.name} className="flex-1 p-3 bg-gray-100 rounded-md">
            <div className="text-sm text-gray-500 mb-1">{dim.name}</div>
            <div className={`text-xl font-bold ${getScoreColorClass(dim.score)}`}>
              {dim.score}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <h4 className="text-sm mb-2">详细分析</h4>
        {dimensions.map((dim) => (
          <div key={dim.name} className="mb-3">
            <div className="font-bold mb-1">{dim.name}</div>
            <ul className="m-0 pl-5 text-[13px] text-gray-500">
              {dim.reasons.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

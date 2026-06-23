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

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-500';
  if (score >= 60) return 'text-amber-500';
  return 'text-red-500';
}

export const ScoreCard: React.FC<ScoreCardProps> = ({ overallScore, dimensions }) => {
  return (
    <div className="mt-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-800/30 p-4">
      <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">匹配度评分</div>

      <div className="flex items-baseline gap-1.5 mb-3">
        <span className={`text-2xl font-bold tabular-nums ${scoreColor(overallScore)}`}>{overallScore}</span>
        <span className="text-xs text-neutral-400">/ 100</span>
      </div>

      {dimensions.length > 0 && (
        <div className="flex gap-2 mb-4">
          {dimensions.map((dim) => (
            <div
              key={dim.name}
              className="flex-1 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2 text-center"
            >
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-0.5">{dim.name}</div>
              <div className={`text-lg font-bold tabular-nums ${scoreColor(dim.score)}`}>{dim.score}</div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2.5">
        {dimensions.map(
          (dim) =>
            dim.reasons.length > 0 && (
              <div key={dim.name}>
                <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">{dim.name}</div>
                <ul className="list-disc pl-4 space-y-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                  {dim.reasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </div>
            )
        )}
      </div>
    </div>
  );
};

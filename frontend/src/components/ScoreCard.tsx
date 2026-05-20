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
  const getScoreColor = (score: number) => {
    if (score >= 80) return '#52c41a';
    if (score >= 60) return '#faad14';
    return '#ff4d4f';
  };

  return (
    <div className="score-card" style={{ padding: '16px', border: '1px solid #e8e8e8', borderRadius: '8px', marginTop: '16px' }}>
      <h3 style={{ marginBottom: '12px' }}>简历评分</h3>

      <div style={{ marginBottom: '16px' }}>
        <span style={{ fontSize: '24px', fontWeight: 'bold', color: getScoreColor(overallScore) }}>
          {overallScore}
        </span>
        <span style={{ color: '#666' }}> / 100 总体匹配度</span>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        {dimensions.map((dim) => (
          <div key={dim.name} style={{ flex: 1, padding: '12px', background: '#f5f5f5', borderRadius: '6px' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>{dim.name}</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: getScoreColor(dim.score) }}>
              {dim.score}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '16px' }}>
        <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>详细分析</h4>
        {dimensions.map((dim) => (
          <div key={dim.name} style={{ marginBottom: '12px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{dim.name}</div>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#666' }}>
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

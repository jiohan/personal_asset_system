type SparkBarDatum = {
  label: string;
  value: number;
  tone?: 'positive' | 'negative' | 'neutral';
};

type SparkBarsProps = {
  items: SparkBarDatum[];
  emptyLabel?: string;
};

type LinePoint = {
  label: string;
  value: number;
};

type LineSeries = {
  label: string;
  color: string;
  points: LinePoint[];
};

type LineTrendChartProps = {
  series: LineSeries[];
  emptyLabel?: string;
};

function clampPercent(value: number): number {
  return Math.max(8, Math.min(100, value));
}

function buildPolyline(points: LinePoint[], min: number, max: number, width: number, height: number): string {
  if (points.length === 0) return '';

  const xStep = points.length === 1 ? 0 : width / (points.length - 1);
  const range = max - min || 1;

  return points
    .map((point, index) => {
      const x = index * xStep;
      const y = height - ((point.value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');
}

export function SparkBars({ items, emptyLabel = 'No data.' }: SparkBarsProps) {
  if (items.length === 0) {
    return <p className="hint">{emptyLabel}</p>;
  }

  const maxAbsValue = Math.max(...items.map((item) => Math.abs(item.value)), 1);

  return (
    <div className="spark-bars" role="img" aria-label="Trend bars">
      {items.map((item) => {
        const tone = item.tone ?? (item.value > 0 ? 'positive' : item.value < 0 ? 'negative' : 'neutral');
        const height = clampPercent((Math.abs(item.value) / maxAbsValue) * 100);
        return (
          <div key={item.label} className={`spark-bar spark-bar-${tone}`} title={`${item.label}: ${item.value.toLocaleString('ko-KR')} KRW`}>
            <div className="spark-bar-fill" style={{ height: `${height}%` }} />
            <span className="spark-bar-label">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function LineTrendChart({ series, emptyLabel = 'No data.' }: LineTrendChartProps) {
  const nonEmptySeries = series.filter((entry) => entry.points.length > 0);
  if (nonEmptySeries.length === 0) {
    return <p className="hint">{emptyLabel}</p>;
  }

  const allValues = nonEmptySeries.flatMap((entry) => entry.points.map((point) => point.value));
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const width = 640;
  const height = 220;

  const labels = nonEmptySeries[0]?.points.map((point) => point.label) ?? [];

  return (
    <div className="line-trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Line trend chart">
        <line className="line-trend-axis" x1="0" y1={height} x2={width} y2={height} />
        {nonEmptySeries.map((entry) => (
          <polyline
            key={entry.label}
            fill="none"
            points={buildPolyline(entry.points, min, max, width, height)}
            stroke={entry.color}
            strokeWidth="3"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        ))}
      </svg>
      <div className="line-trend-footer">
        <div className="line-trend-legend">
          {nonEmptySeries.map((entry) => (
            <span key={entry.label} className="line-trend-legend-item">
              <i style={{ backgroundColor: entry.color }} />
              {entry.label}
            </span>
          ))}
        </div>
        <div className="line-trend-labels">
          {labels.slice(0, 6).map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

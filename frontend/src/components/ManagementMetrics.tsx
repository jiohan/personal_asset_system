export type ManagementMetric = {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'accent';
};

type ManagementMetricsProps = {
  items: ManagementMetric[];
};

export function ManagementMetrics({ items }: ManagementMetricsProps) {
  return (
    <section className="management-overview-grid">
      {items.map((item) => (
        <article
          key={item.label}
          className={`card management-metric-card${item.tone === 'accent' ? ' accent' : ''}`}
        >
          <span className="page-kicker">{item.label}</span>
          <strong>{item.value}</strong>
          {item.hint ? <p className="hint">{item.hint}</p> : null}
        </article>
      ))}
    </section>
  );
}

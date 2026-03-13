import type { ReactNode } from 'react';

export type StateNoticeTone = 'loading' | 'empty' | 'error' | 'success' | 'disabled';

type StateNoticeProps = {
  tone: StateNoticeTone;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
};

export default function StateNotice({
  tone,
  title,
  description,
  action,
  compact = false
}: StateNoticeProps) {
  return (
    <section
      className={`state-notice state-notice-${tone}${compact ? ' state-notice-compact' : ''}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <div className="state-notice-copy">
        <span className="state-notice-label">{tone}</span>
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="state-notice-action">{action}</div> : null}
    </section>
  );
}

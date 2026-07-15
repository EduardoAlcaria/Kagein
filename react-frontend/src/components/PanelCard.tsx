import type { CSSProperties, ElementType, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface PanelCardProps {
  title: string;
  /** Rendered at the right edge of the header, e.g. a "View all" link. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  style?: CSSProperties;
}

export function PanelCard({
  title,
  action,
  children,
  className,
  contentClassName,
  style,
}: PanelCardProps) {
  return (
    <Card className={`animate-fade-up overflow-hidden ${className ?? ''}`} style={style}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b px-5 py-4">
        {/* CardTitle renders a div, so the heading role is set explicitly. */}
        <CardTitle role="heading" aria-level={3} className="text-sm">
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className={`p-0 ${contentClassName ?? ''}`}>{children}</CardContent>
    </Card>
  );
}

interface EmptyStateProps {
  icon: ElementType;
  message: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
      <Icon size={28} className="opacity-25" />
      <p className="text-sm">{message}</p>
      {action}
    </div>
  );
}

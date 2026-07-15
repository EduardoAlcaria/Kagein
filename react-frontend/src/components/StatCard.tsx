import type { ElementType } from 'react';
import { Card, CardContent } from './ui/card';

interface StatCardProps {
  icon: ElementType;
  label: string;
  value: string | number;
  sub?: string;
  /** Tailwind classes for the icon chip, e.g. "bg-live/15 text-live". */
  color: string;
}

export function StatCard({ icon: Icon, label, value, sub, color }: StatCardProps) {
  return (
    <Card className="animate-fade-up card-hover">
      <CardContent className="p-5">
        <div className={`mb-4 flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
          <Icon size={16} />
        </div>
        <p className="mb-0.5 text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

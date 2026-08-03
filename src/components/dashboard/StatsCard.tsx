import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  variant?: 'default' | 'gold' | 'accent' | 'primary';
  isLoading?: boolean;
}

export function StatsCard({ title, value, subtitle, icon: Icon, trend, variant = 'default', isLoading }: StatsCardProps) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl p-6 transition-all duration-300 hover:shadow-lg",
      variant === 'gold' && "bg-gradient-to-br from-gold/10 to-gold/5 border border-gold/20",
      variant === 'accent' && "bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20",
      variant === 'primary' && "bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20",
      variant === 'default' && "bg-card border border-border shadow-sm"
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {isLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <p className="text-3xl font-display font-bold text-foreground">{value}</p>
          )}
          {subtitle && !isLoading && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
          {trend && !isLoading && (
            <div className={cn(
              "inline-flex items-center gap-1 text-sm font-medium",
              trend.isPositive ? "text-success" : "text-destructive"
            )}>
              <span>{trend.isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
              <span className="text-muted-foreground font-normal">{trend.label || 'vs last month'}</span>
            </div>
          )}
        </div>
        <div className={cn(
          "flex h-12 w-12 items-center justify-center rounded-xl",
          variant === 'gold' && "bg-gold/20 text-gold",
          variant === 'accent' && "bg-accent/20 text-accent",
          variant === 'primary' && "bg-primary/20 text-primary",
          variant === 'default' && "bg-accent/10 text-accent"
        )}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

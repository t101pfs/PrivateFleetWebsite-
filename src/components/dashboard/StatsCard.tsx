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
  onClick?: () => void;
}

export function StatsCard({ title, value, subtitle, icon: Icon, trend, variant = 'default', isLoading, onClick }: StatsCardProps) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      className={cn(
        "group relative overflow-hidden rounded-xl p-3 md:p-6 transition-all duration-200 ease-out hover:shadow-lg",
        onClick && "cursor-pointer hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] active:duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        variant === 'gold' && "bg-gradient-to-br from-gold/10 to-gold/5 border border-gold/20",
        variant === 'accent' && "bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20",
        variant === 'primary' && "bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20",
        variant === 'default' && "bg-card border border-border shadow-sm"
      )}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 md:space-y-2 min-w-0">
          <p className="text-xs md:text-sm font-medium text-muted-foreground truncate">{title}</p>
          {isLoading ? (
            <Skeleton className="h-6 md:h-8 w-16 md:w-20" />
          ) : (
            <p className="text-xl md:text-3xl font-display font-bold text-foreground">{value}</p>
          )}
          {subtitle && !isLoading && (
            <p className="text-xs md:text-sm text-muted-foreground truncate">{subtitle}</p>
          )}
          {trend && !isLoading && (
            <div className={cn(
              "inline-flex items-center gap-1 text-xs md:text-sm font-medium",
              trend.isPositive ? "text-success" : "text-destructive"
            )}>
              <span>{trend.isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
              <span className="text-muted-foreground font-normal hidden sm:inline">{trend.label || 'vs last month'}</span>
            </div>
          )}
        </div>
        <div className={cn(
          "flex h-8 w-8 md:h-12 md:w-12 items-center justify-center rounded-xl transition-transform duration-200 ease-out shrink-0",
          onClick && "group-hover:scale-110",
          variant === 'gold' && "bg-gold/20 text-gold",
          variant === 'accent' && "bg-accent/20 text-accent",
          variant === 'primary' && "bg-primary/20 text-primary",
          variant === 'default' && "bg-accent/10 text-accent"
        )}>
          <Icon className="h-4 w-4 md:h-6 md:w-6" />
        </div>
      </div>
    </div>
  );
}

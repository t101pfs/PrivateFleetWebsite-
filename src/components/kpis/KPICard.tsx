import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Target } from 'lucide-react';

interface KPICardProps {
  name: string;
  currentValue: number;
  targetValue: number;
  metricType: 'count' | 'currency' | 'percentage';
  targetPeriod: string;
  onClick?: () => void;
}

export function KPICard({ 
  name, 
  currentValue, 
  targetValue, 
  metricType, 
  targetPeriod,
  onClick 
}: KPICardProps) {
  const percentage = targetValue > 0 ? Math.min((currentValue / targetValue) * 100, 100) : 0;
  
  const getStatusColor = (pct: number) => {
    if (pct >= 80) return 'text-green-500';
    if (pct >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 80) return 'bg-green-500';
    if (pct >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const formatValue = (value: number) => {
    switch (metricType) {
      case 'currency':
        return new Intl.NumberFormat('en-US', { 
          style: 'currency', 
          currency: 'USD',
          notation: value >= 10000 ? 'compact' : 'standard',
          maximumFractionDigits: value >= 10000 ? 1 : 0
        }).format(value);
      case 'percentage':
        return `${value}%`;
      default:
        return value.toLocaleString();
    }
  };

  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-card border border-border rounded-xl p-5 space-y-4 transition-all duration-200",
        onClick && "cursor-pointer hover:shadow-md hover:border-primary/30"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground capitalize">{targetPeriod}</p>
          <h3 className="font-semibold text-foreground">{name}</h3>
        </div>
        <div className={cn(
          "h-10 w-10 rounded-lg flex items-center justify-center",
          percentage >= 80 ? "bg-green-500/10" : percentage >= 50 ? "bg-yellow-500/10" : "bg-red-500/10"
        )}>
          <Target className={cn("h-5 w-5", getStatusColor(percentage))} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-end justify-between">
          <span className="text-2xl font-bold text-foreground">{formatValue(currentValue)}</span>
          <span className="text-sm text-muted-foreground">/ {formatValue(targetValue)}</span>
        </div>
        <div className="relative">
          <Progress value={percentage} className="h-2" />
          <div 
            className={cn("absolute top-0 left-0 h-2 rounded-full transition-all", getProgressColor(percentage))}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className={cn("font-medium", getStatusColor(percentage))}>
          {percentage.toFixed(0)}% achieved
        </span>
        {percentage >= 100 ? (
          <div className="flex items-center gap-1 text-green-500">
            <TrendingUp className="h-4 w-4" />
            <span>Target met!</span>
          </div>
        ) : (
          <span className="text-muted-foreground">
            {formatValue(targetValue - currentValue)} to go
          </span>
        )}
      </div>
    </div>
  );
}

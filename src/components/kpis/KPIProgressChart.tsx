import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format } from 'date-fns';

interface ProgressDataPoint {
  date: string;
  value: number;
}

interface KPIProgressChartProps {
  data: ProgressDataPoint[];
  targetValue: number;
  metricType: 'count' | 'currency' | 'percentage';
}

export function KPIProgressChart({ data, targetValue, metricType }: KPIProgressChartProps) {
  const formatValue = (value: number) => {
    switch (metricType) {
      case 'currency':
        return new Intl.NumberFormat('en-US', { 
          style: 'currency', 
          currency: 'USD',
          notation: 'compact',
          maximumFractionDigits: 1
        }).format(value);
      case 'percentage':
        return `${value}%`;
      default:
        return value.toLocaleString();
    }
  };

  const chartData = data.map(d => ({
    ...d,
    date: format(new Date(d.date), 'MMM d')
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis 
            dataKey="date" 
            className="text-xs fill-muted-foreground"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis 
            tickFormatter={formatValue}
            className="text-xs"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <Tooltip 
            formatter={(value: number) => [formatValue(value), 'Progress']}
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <ReferenceLine 
            y={targetValue} 
            stroke="hsl(var(--primary))" 
            strokeDasharray="5 5"
            label={{ 
              value: `Target: ${formatValue(targetValue)}`, 
              fill: 'hsl(var(--primary))',
              fontSize: 12 
            }}
          />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="hsl(var(--gold))" 
            strokeWidth={2}
            dot={{ fill: 'hsl(var(--gold))', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: 'hsl(var(--gold))' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

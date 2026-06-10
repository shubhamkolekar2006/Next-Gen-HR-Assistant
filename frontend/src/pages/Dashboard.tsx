import { useQuery } from '@tanstack/react-query';
import {
  Users,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { analyticsService } from '@/services/api';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

// Custom colors for charts - only blue
const COLORS = {
  primary: '#2563eb',
  secondary: '#3b82f6',
  accent: '#60a5fa',
};

const DEPARTMENT_COLORS = [
  COLORS.primary,
  COLORS.secondary,
  COLORS.accent,
  '#1d4ed8',
  '#1e40af',
  '#1e3a8a',
  '#1d4ed8',
];

// Metric Card Component
const MetricCard = ({
  title,
  value,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  icon: any;
  trend?: { value: number; label: string };
}) => {
  return (
    <Card className="border border-gray-200 bg-white">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900 mb-1">{title}</p>

            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-gray-900">{value}</p>

              {trend && (
                <div className="flex items-center gap-1 text-xs font-medium text-gray-900">
                  {trend.value > 0 ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  <span>{Math.abs(trend.value)}%</span>
                </div>
              )}
            </div>

            {trend && <p className="text-xs text-gray-600 mt-1">{trend.label}</p>}
          </div>

          <div className="bg-blue-600 p-4 rounded-lg">
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const Dashboard = () => {
  const { data: analytics, isLoading: summaryLoading } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: () => analyticsService.getSummary(),
  });

  const { data: deptData, isLoading: deptLoading } = useQuery({
    queryKey: ['department-distribution'],
    queryFn: () => analyticsService.getDepartmentDistribution(),
  });

  const { data: attritionData, isLoading: attritionLoading } = useQuery({
    queryKey: ['attrition-risk'],
    queryFn: () => analyticsService.getAttritionRisk(),
  });

  const { data: performanceTrendData, isLoading: performanceLoading } = useQuery({
    queryKey: ['performance-trend'],
    queryFn: () => analyticsService.getPerformanceTrend(6),
  });

  const isLoading = summaryLoading || deptLoading || attritionLoading || performanceLoading;

  const metrics = [
    {
      title: 'Total Employees',
      value: analytics?.data?.totalEmployees || 0,
      icon: Users,
      trend: { value: 5.2, label: 'vs last month' },
    },
    {
      title: 'Attrition Rate',
      value: `${analytics?.data?.attritionRate || 0}%`,
      icon: TrendingDown,
      trend: { value: -2.1, label: 'vs last month' },
    },
    {
      title: 'Average Salary',
      value: `$${analytics?.data?.avgSalary || 0}k`,
      icon: DollarSign,
      trend: { value: 3.5, label: 'vs last month' },
    },
    {
      title: 'High Risk',
      value: analytics?.data?.highRiskCount || 0,
      icon: AlertTriangle,
      trend: { value: -8.3, label: 'vs last month' },
    },
  ];

  // Format department data for pie chart
  const departmentChartData =
    deptData?.data?.map((item: any) => ({
      name: item.department || 'Unknown',
      value: item.count,
    })) || [];

  // Format attrition risk data for bar chart
  const attritionChartData =
    attritionData?.data?.map((item: any) => ({
      name: item.category || 'Unknown',
      count: item.count || 0,
    })) || [];

  // Performance trend data
  const performanceData =
    performanceTrendData?.data && performanceTrendData.data.length > 0
      ? performanceTrendData.data
      : [
          { month: 'Jan', performance: 85, target: 80 },
          { month: 'Feb', performance: 88, target: 80 },
          { month: 'Mar', performance: 82, target: 80 },
          { month: 'Apr', performance: 90, target: 85 },
          { month: 'May', performance: 87, target: 85 },
          { month: 'Jun', performance: 92, target: 85 },
        ];

  if (isLoading) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-black">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-white min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-4xl font-bold text-blue-600">Dashboard</h1>
          <p className="text-black mt-1 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Welcome to TalentFlow HR Management Platform
          </p>
        </div>

        <div className="text-sm text-black bg-white px-4 py-2 rounded-lg border border-gray-200">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Department Distribution Pie Chart */}
        <Card className="border border-gray-200 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-blue-600 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Department Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={departmentChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  dataKey="value"
                >
                  {departmentChartData.map((_entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '8px',
                    color: '#000000',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Attrition Risk Bar Chart */}
        <Card className="border border-gray-200 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-blue-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-blue-600" />
              Attrition Risk Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={attritionChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#000000', fontSize: 12 }}
                  axisLine={{ stroke: '#000000' }}
                />
                <YAxis
                  tick={{ fill: '#000000', fontSize: 12 }}
                  axisLine={{ stroke: '#000000' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '8px',
                    color: '#000000',
                  }}
                />
                <Bar dataKey="count" fill={COLORS.primary} radius={[8, 8, 0, 0]}>
                  {attritionChartData.map((entry: any, index: number) => {
                    let color = COLORS.primary;
                    if (entry.name === 'High') color = '#1e40af';
                    if (entry.name === 'Medium') color = COLORS.secondary;
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Performance Trend */}
      <Card className="border border-gray-200 bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-blue-600 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Performance Trend (Last 6 Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="month"
                tick={{ fill: '#000000', fontSize: 12 }}
                axisLine={{ stroke: '#000000' }}
              />
              <YAxis
                tick={{ fill: '#000000', fontSize: 12 }}
                axisLine={{ stroke: '#000000' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '8px',
                  color: '#000000',
                }}
              />
              <Legend wrapperStyle={{ color: '#000000' }} />

              <Line
                type="monotone"
                dataKey="performance"
                stroke={COLORS.primary}
                strokeWidth={3}
                dot={{ fill: COLORS.primary, r: 5 }}
                name="Performance"
              />

              <Line
                type="monotone"
                dataKey="target"
                stroke={COLORS.secondary}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: COLORS.secondary, r: 4 }}
                name="Target"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border border-gray-200 bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-black mb-1">New Hires This Month</p>
                <p className="text-2xl font-bold text-black">12</p>
              </div>
              <div className="bg-blue-600 p-3 rounded-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-black mb-1">Active Projects</p>
                <p className="text-2xl font-bold text-black">8</p>
              </div>
              <div className="bg-gray-100 p-3 rounded-lg">
                <Activity className="w-6 h-6 text-black" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-black mb-1">Training Completed</p>
                <p className="text-2xl font-bold text-black">45</p>
              </div>
              <div className="bg-gray-100 p-3 rounded-lg">
                <TrendingUp className="w-6 h-6 text-black" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

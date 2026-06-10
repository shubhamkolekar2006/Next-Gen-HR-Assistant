import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  AlertTriangle,
  Building2,
  Sparkles,
  Target,
  Rocket,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { analyticsService } from '@/services/api';
import { motion } from "framer-motion";

type StatCard = {
  title: string;
  value: string;
  deltaLabel: string;
  deltaValue: string;
  icon: React.ElementType;
  gradient: string;
};

const formatNumber = (num: number | undefined, options: Intl.NumberFormatOptions = {}) => {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
    ...options,
  }).format(num ?? 0);
};

export const Analytics = () => {
  const { data: summary } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: () => analyticsService.getSummary(),
  });

  const { data: deptData } = useQuery({
    queryKey: ['department-distribution'],
    queryFn: () => analyticsService.getDepartmentDistribution(),
  });

  const summaryData = summary?.data ?? {};

  const statCards: StatCard[] = useMemo(
    () => [
      {
        title: 'Active Workforce',
        value: formatNumber(summaryData.totalEmployees),
        deltaLabel: 'Growth',
        deltaValue: '+3.2%',
        icon: Users,
        gradient: '',
      },
      {
        title: 'Avg. Salary',
        value: `$${formatNumber(summaryData.avgSalary, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}k`,
        deltaLabel: 'YoY Trend',
        deltaValue: '+5.6%',
        icon: DollarSign,
        gradient: '',
      },
      {
        title: 'Attrition Rate',
        value: `${formatNumber(summaryData.attritionRate, {
          maximumFractionDigits: 1,
        })}%`,
        deltaLabel: 'Stability Index',
        deltaValue: 'Low Risk',
        icon: Activity,
        gradient: '',
      },
      {
        title: 'High-Risk Talent',
        value: formatNumber(summaryData.highRiskCount),
        deltaLabel: 'Focus Required',
        deltaValue: 'Immediate',
        icon: AlertTriangle,
        gradient: '',
      },
    ],
    [summaryData]
  );

  return (
    <div className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-10">
        <header className="space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-blue-700">
            <Sparkles className="h-3.5 w-3.5" />
            Talent Intelligence Command Center
          </span>

          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <h1 className="text-4xl md:text-5xl font-bold text-blue-600">
                Workforce Analytics
              </h1>
              <p className="max-w-2xl text-gray-700">
                Real-time visibility into talent health, organisational momentum, and AI-powered recommendations.
              </p>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <p className="font-semibold uppercase tracking-[0.25em] text-xs">Analyst Insight</p>
              <p className="mt-1">
                Engagement spike detected in Product & Engineering teams. Prioritise leadership recognition this week.
              </p>
            </div>
          </div>
        </header>

        {/* Stat Cards Section */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.title} className="border border-gray-200 bg-white">
                <CardContent className="space-y-6 p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-600 text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs uppercase tracking-[0.3em] text-gray-600">
                      {card.deltaLabel}
                    </span>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">{card.title}</p>
                    <p className="mt-1 text-3xl font-semibold text-gray-900">{card.value}</p>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span className="inline-flex items-center gap-2 text-emerald-600">
                      <TrendingUp className="h-4 w-4" />
                      {card.deltaValue}
                    </span>
                    <span className="text-gray-500">Updated 5 min ago</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        {/* Department + Engagement Section */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* LEFT SECTION (with Motion) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-2"
          >
            <Card className="h-full border border-gray-200 bg-white">
              <CardContent className="p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Department Momentum</h3>
                    <p className="text-sm text-gray-600">
                      Headcount spread with AI-generated pulse indicator
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-gray-100 px-3 py-1 text-xs uppercase tracking-[0.3em] text-gray-700">
                    <Building2 className="h-4 w-4" />
                    Org Scale
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {deptData?.data && deptData.data.length > 0 ? (
                    deptData.data.map((item: any, idx: number) => {
                      const share =
                        summaryData.totalEmployees && summaryData.totalEmployees > 0
                          ? Math.round((item.count / summaryData.totalEmployees) * 100)
                          : 0;
                      return (
                        <div
                          key={item.department}
                          className="rounded-lg border border-gray-200 bg-white px-4 py-3"
                        >
                          <div className="flex items-center justify-between text-sm text-gray-900">
                            <span className="font-medium">{item.department}</span>
                            <span className="text-blue-600">{item.count} talent</span>
                          </div>

                          <div className="mt-3 h-2 rounded-full bg-gray-200">
                            <div
                              className="h-2 rounded-full bg-blue-600"
                              style={{ width: `${Math.min(share, 100)}%` }}
                            />
                          </div>

                          <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
                            <span>{share}% of workforce</span>
                            <span>Pulse: {(70 + (idx % 3) * 5)} / 100</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-white py-10 text-center text-gray-600">
                      Department data unavailable. Connect your ATS & HRIS to activate insights.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* RIGHT SECTION */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="h-full border border-gray-200 bg-white">
              <CardContent className="flex h-full flex-col gap-6 p-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-gray-900">Engagement Priorities</h3>
                  <p className="text-sm text-gray-600">
                    AI-detected focus areas to boost retention and productivity this quarter.
                  </p>
                </div>

                <ul className="space-y-3">
                  {[
                    {
                      title: 'Leadership Enablement',
                      impact: 'High impact',
                      narrative: 'Embed coaching rituals in fast-scaling squads.',
                    },
                    {
                      title: 'Compensation Alignment',
                      impact: 'Medium impact',
                      narrative: 'Benchmark salary bands with market intelligence.',
                    },
                    {
                      title: 'Attrition Watchlist',
                      impact: 'Immediate attention',
                      narrative: 'Conduct stay interviews with at-risk talent.',
                    },
                  ].map((initiative) => (
                    <li
                      key={initiative.title}
                      className="rounded-lg border border-gray-200 bg-white p-4"
                    >
                      <div className="flex items-center justify-between text-xs text-gray-600 uppercase tracking-[0.25em]">
                        <span>{initiative.impact}</span>
                        <Target className="h-4 w-4 text-blue-600" />
                      </div>

                      <h4 className="mt-2 text-base font-semibold text-gray-900">
                        {initiative.title}
                      </h4>

                      <p className="mt-1 text-sm text-gray-600">{initiative.narrative}</p>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  <div className="flex items-center gap-2">
                    <Rocket className="h-4 w-4" />
                    <span className="font-semibold uppercase tracking-[0.2em] text-xs">
                      Next Action
                    </span>
                  </div>

                  <p className="mt-2">
                    Schedule an executive huddle to review talent flight risk and align on retention playbook.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

        </section>
      </div>
    </div>
  );
};

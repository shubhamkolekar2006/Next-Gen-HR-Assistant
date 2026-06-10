/**
 * HR Insights & Retention Agent
 * Attrition risk, intervention playbooks, team-level trends.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  AlertTriangle,
  BookOpen,
  BarChart3,
  Users,
  Target,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { analyticsService } from '@/services/api';
import { InterventionPlaybooksSection } from './InterventionPlaybooksSection';

type TabId = 'attrition-risk' | 'intervention-playbooks' | 'team-trends';

const TABS: { id: TabId; label: string; icon: typeof TrendingUp }[] = [
  { id: 'attrition-risk', label: 'Attrition Risk', icon: AlertTriangle },
  { id: 'intervention-playbooks', label: 'Intervention Playbooks', icon: BookOpen },
  { id: 'team-trends', label: 'Team-Level Trends', icon: BarChart3 },
];

export const HRInsightsRetentionAgentInterface = () => {
  const [activeTab, setActiveTab] = useState<TabId>('attrition-risk');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-gradient-to-br from-violet-500 to-purple-600 p-3 rounded-lg">
          <TrendingUp className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
            HR Insights & Retention Agent
          </h2>
          <p className="text-slate-600 mt-1">
            Attrition risk, intervention playbooks, team-level trends.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'default' : 'ghost'}
              onClick={() => setActiveTab(tab.id)}
              className={activeTab === tab.id ? 'bg-violet-600 hover:bg-violet-700' : ''}
            >
              <Icon className="w-4 h-4 mr-2" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {activeTab === 'attrition-risk' && <AttritionRiskSection />}
      {activeTab === 'intervention-playbooks' && <InterventionPlaybooksSection />}
      {activeTab === 'team-trends' && <TeamTrendsSection />}
    </div>
  );
};

function AttritionRiskSection() {
  const { data: summaryData } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: () => analyticsService.getSummary(),
  });

  const { data: attritionData, isLoading: attritionLoading } = useQuery({
    queryKey: ['attrition-risk'],
    queryFn: () => analyticsService.getAttritionRisk(),
  });

  const summary = summaryData?.data ?? {};
  const riskList = attritionData?.data ?? [];
  const highRiskCount = summary.highRiskCount ?? 0;
  const attritionRate = summary.attritionRate ?? 0;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{highRiskCount}</p>
                <p className="text-sm text-gray-600">High-Risk Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{summary.totalEmployees ?? 0}</p>
                <p className="text-sm text-gray-600">Total Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-lg">
                <Target className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{attritionRate}%</p>
                <p className="text-sm text-gray-600">Attrition Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attrition risk list */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Attrition Risk Distribution
          </CardTitle>
          <p className="text-sm text-gray-600">
            Employees ranked by predicted attrition risk. Ask the chatbot &quot;show top 5 high risk employees&quot; for detailed predictions.
          </p>
        </CardHeader>
        <CardContent>
          {attritionLoading ? (
            <p className="text-gray-500">Loading attrition data…</p>
          ) : Array.isArray(riskList) && riskList.length > 0 ? (
            <div className="space-y-2">
              {riskList.map((item: any, i: number) => {
                const category = item.category || item._id || 'Unknown';
                const count = item.count ?? 0;
                const riskClass =
                  category === 'High'
                    ? 'text-red-600 bg-red-50'
                    : category === 'Medium'
                      ? 'text-amber-600 bg-amber-50'
                      : 'text-green-600 bg-green-50';
                return (
                  <div
                    key={category + i}
                    className={`flex items-center justify-between p-3 rounded-lg ${riskClass}`}
                  >
                    <span className="font-medium">{category} Risk</span>
                    <span className="text-sm font-semibold">{count} employees</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500">
              No attrition data available. Use the AI chatbot to run attrition predictions.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TeamTrendsSection() {
  const { data: deptData, isLoading } = useQuery({
    queryKey: ['department-distribution'],
    queryFn: () => analyticsService.getDepartmentDistribution(),
  });

  const departments = deptData?.data ?? [];

  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Team-Level Trends
        </CardTitle>
        <p className="text-sm text-gray-600">
          Department distribution and headcount trends across the organization.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-gray-500">Loading department data…</p>
        ) : Array.isArray(departments) && departments.length > 0 ? (
          <div className="space-y-3">
            {departments.map((item: any, i: number) => {
              const count = item.count ?? item.total ?? 0;
              const maxCount = Math.max(...departments.map((d: any) => d.count ?? d.total ?? 0), 1);
              const pct = Math.min(100, (count / maxCount) * 100);
              return (
                <div key={item.name || item.department || i} className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{item.name || item.department || item.Department || 'Unknown'}</span>
                      <span className="text-gray-600">{count} employees</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-500">No department data available.</p>
        )}
      </CardContent>
    </Card>
  );
}

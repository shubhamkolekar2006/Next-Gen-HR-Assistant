// AgentDashboard.tsx
import { useState } from 'react';
import { Bot, Briefcase, UserCheck, TrendingUp, MessageSquare, ArrowLeft, Sparkles, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TalentAcquisitionAgentInterface } from '@/components/agents/TalentAcquisitionAgentInterface';
import { EmployeeLifecycleAgentInterface } from '@/components/agents/EmployeeLifecycleAgentInterface';
import { HRInsightsRetentionAgentInterface } from '@/components/agents/HRInsightsRetentionAgentInterface';
import { HRKnowledgeActionAgentInterface } from '@/components/agents/HRKnowledgeActionAgentInterface';

type AgentType =
  | 'talent-acquisition'
  | 'employee-lifecycle'
  | 'hr-insights-retention'
  | 'hr-knowledge-action'
  | null;

const AGENTS = [
  {
    id: 'talent-acquisition' as AgentType,
    name: 'Talent Acquisition Agent',
    description: 'Job requisition intake, candidate scoring, interview orchestration, offer draft.',
    icon: Briefcase,
    category: 'Acquisition',
  },
  {
    id: 'employee-lifecycle' as AgentType,
    name: 'Employee Lifecycle Agent',
    description: 'Onboarding, document compliance, policy workflows, probation tracking.',
    icon: UserCheck,
    category: 'Lifecycle',
  },
  {
    id: 'hr-insights-retention' as AgentType,
    name: 'HR Insights & Retention Agent',
    description: 'Attrition risk, intervention playbooks, team-level trends.',
    icon: TrendingUp,
    category: 'Insights',
  },
  {
    id: 'hr-knowledge-action' as AgentType,
    name: 'HR Knowledge & Action Agent',
    description: 'Policy Q&A, HR data retrieval, and controlled operational actions with approvals.',
    icon: MessageSquare,
    category: 'Knowledge',
  },
];

export const AgentDashboard = () => {
  const [selectedAgent, setSelectedAgent] = useState<AgentType>(null);

  if (selectedAgent) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="p-6 space-y-6">
          <Button
            variant="ghost"
            onClick={() => setSelectedAgent(null)}
            className="mb-4 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Agents
          </Button>

          {selectedAgent === 'talent-acquisition' && <TalentAcquisitionAgentInterface />}
          {selectedAgent === 'employee-lifecycle' && <EmployeeLifecycleAgentInterface />}
          {selectedAgent === 'hr-insights-retention' && <HRInsightsRetentionAgentInterface />}
          {selectedAgent === 'hr-knowledge-action' && <HRKnowledgeActionAgentInterface />}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 md:p-8 lg:p-12 space-y-8">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="bg-blue-600 p-4 rounded-lg">
              <Bot className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
                Agent Dashboard
              </h1>
              <p className="text-gray-600 mt-2 text-lg">Intelligent HR Automation Platform</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto mt-8">
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{AGENTS.length}</p>
                  <p className="text-sm text-gray-600">AI Agents</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Zap className="w-5 h-5 text-gray-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">100%</p>
                  <p className="text-sm text-gray-600">Automated</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-gray-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">24/7</p>
                  <p className="text-sm text-gray-600">Available</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Agent Cards Grid - 2x2 for 4 agents */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {AGENTS.map((agent) => {
            const Icon = agent.icon;
            return (
              <Card
                key={agent.id}
                className="bg-white border border-gray-200 cursor-pointer h-full hover:shadow-md transition-shadow"
                onClick={() => setSelectedAgent(agent.id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-4">
                    <div className="bg-blue-600 p-4 rounded-lg">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded-full">
                      {agent.category}
                    </span>
                  </div>
                  <CardTitle className="text-xl text-gray-900">
                    {agent.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                    {agent.description}
                  </p>
                  <Button
                    className="w-full bg-blue-600 text-white hover:bg-blue-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAgent(agent.id);
                    }}
                  >
                    <span className="flex items-center justify-center gap-2">
                      Launch Agent
                      <ArrowLeft className="w-4 h-4 rotate-[-90deg]" />
                    </span>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

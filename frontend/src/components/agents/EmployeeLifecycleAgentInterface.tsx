/**
 * Employee Lifecycle Agent
 * Onboarding, document compliance, policy workflows, probation tracking.
 */
import { useState } from 'react';
import { UserCheck, FileCheck, FileText, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OnboardingAgentInterface } from './OnboardingAgentInterface';
import { DocumentGenerationAgentInterface } from './DocumentGenerationAgentInterface';
import { PolicyWorkflowsSection } from './PolicyWorkflowsSection';
import { ProbationTrackingSection } from './ProbationTrackingSection';

type TabId = 'onboarding' | 'document-compliance' | 'policy-workflows' | 'probation-tracking';

const TABS: { id: TabId; label: string; icon: typeof UserCheck }[] = [
  { id: 'onboarding', label: 'Onboarding', icon: UserCheck },
  { id: 'document-compliance', label: 'Document Compliance', icon: FileCheck },
  { id: 'policy-workflows', label: 'Policy Workflows', icon: FileText },
  { id: 'probation-tracking', label: 'Probation Tracking', icon: Clock },
];

export const EmployeeLifecycleAgentInterface = () => {
  const [activeTab, setActiveTab] = useState<TabId>('onboarding');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-3 rounded-lg">
          <UserCheck className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            Employee Lifecycle Agent
          </h2>
          <p className="text-slate-600 mt-1">
            Onboarding, document compliance, policy workflows, probation tracking.
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
              className={activeTab === tab.id ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              <Icon className="w-4 h-4 mr-2" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'onboarding' && <OnboardingAgentInterface />}
      {activeTab === 'document-compliance' && <DocumentGenerationAgentInterface />}
      {activeTab === 'policy-workflows' && <PolicyWorkflowsSection />}
      {activeTab === 'probation-tracking' && <ProbationTrackingSection />}
    </div>
  );
};


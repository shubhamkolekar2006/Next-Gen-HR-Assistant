/**
 * HR Knowledge & Action Agent
 * Policy Q&A, HR data retrieval, and controlled operational actions with approvals.
 */
import { useState } from 'react';
import { MessageSquare, Database, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DatabaseManagerAgentInterface } from './DatabaseManagerAgentInterface';
import { ControlledActionsSection } from './ControlledActionsSection';
import { ChatWindow } from '@/components/chatbot/ChatWindow';

type TabId = 'policy-qa' | 'hr-data' | 'controlled-actions';

const TABS: { id: TabId; label: string; icon: typeof MessageSquare }[] = [
  { id: 'policy-qa', label: 'Policy Q&A', icon: MessageSquare },
  { id: 'hr-data', label: 'HR Data Retrieval', icon: Database },
  { id: 'controlled-actions', label: 'Controlled Actions', icon: ShieldCheck },
];

export const HRKnowledgeActionAgentInterface = () => {
  const [activeTab, setActiveTab] = useState<TabId>('policy-qa');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-gradient-to-br from-slate-600 to-slate-800 p-3 rounded-lg">
          <MessageSquare className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-700 to-slate-900 bg-clip-text text-transparent">
            HR Knowledge & Action Agent
          </h2>
          <p className="text-slate-600 mt-1">
            Policy Q&A, HR data retrieval, and controlled operational actions with approvals.
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
              className={activeTab === tab.id ? 'bg-slate-700 hover:bg-slate-800' : ''}
            >
              <Icon className="w-4 h-4 mr-2" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {activeTab === 'policy-qa' && <PolicyQASection />}
      {activeTab === 'hr-data' && <DatabaseManagerAgentInterface />}
      {activeTab === 'controlled-actions' && <ControlledActionsSection />}
    </div>
  );
};

function PolicyQASection() {
  return (
    <Card className="border-0 shadow-md overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Policy Q&A
        </CardTitle>
        <p className="text-sm text-gray-600">
          Ask questions about HR policies, employee data, leave policies, attrition predictions, and more.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="min-h-[500px]">
          <ChatWindow />
        </div>
      </CardContent>
    </Card>
  );
}


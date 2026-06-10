import { useState } from 'react';
import { Bot, Sparkles, CheckCircle2, XCircle, Clock, ArrowRight, Activity, Terminal } from 'lucide-react';
import { orchestratorService } from '../services/api';

type ToolCall = {
  name: string;
  args: any;
};

type PlanResult = {
  thread_id: string;
  status: string;
  reasoning: string;
  tool_calls: ToolCall[];
};

export const AgentOrchestrator = () => {
  const [query, setQuery] = useState('');
  const [isPlanning, setIsPlanning] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [executionResult, setExecutionResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);

  const handleGeneratePlan = async () => {
    if (!query.trim()) return;
    
    setIsPlanning(true);
    setError(null);
    setPlan(null);
    setExecutionResult(null);

    try {
      const response = await orchestratorService.plan(query, threadId || undefined);
      setPlan(response);
      if (response.thread_id) {
        setThreadId(response.thread_id);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to generate plan');
    } finally {
      setIsPlanning(false);
    }
  };

  const handleExecutePlan = async () => {
    if (!plan?.thread_id) return;
    
    setIsExecuting(true);
    setError(null);

    try {
      const response = await orchestratorService.execute(plan.thread_id);
      setExecutionResult(response.response);
      setQuery(''); // Clear query after successful execution so they can type a new one
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to execute plan');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleReset = () => {
    setQuery('');
    setPlan(null);
    setExecutionResult(null);
    setError(null);
    // Intentionally keeping threadId to remember chat history!
  };

  const handleStartNewThread = () => {
    setQuery('');
    setPlan(null);
    setExecutionResult(null);
    setError(null);
    setThreadId(null);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-indigo-600" />
          Master AI Orchestrator
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Command all HR agents simultaneously. The Orchestrator will formulate a multi-step plan and wait for your approval before execution.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 border border-red-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <XCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Input Section */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-6">
          <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-2">
            What do you want to accomplish?
          </label>
          <div className="mt-1">
            <textarea
              id="query"
              name="query"
              rows={4}
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-3 border"
              placeholder="e.g., Onboard a new engineer named Alice, generate her offer letter with a 100k salary, and schedule an intro meeting."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={isPlanning || isExecuting || (!!plan && !executionResult)}
            />
          </div>
          
          <div className="mt-4 flex justify-end gap-3">
            {(plan || executionResult) && (
               <button
                 type="button"
                 onClick={handleStartNewThread}
                 disabled={isPlanning || isExecuting}
                 className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
               >
                 Clear Context & Start New
               </button>
            )}
            {(!plan || executionResult) && (
              <button
                type="button"
                onClick={handleGeneratePlan}
                disabled={!query.trim() || isPlanning}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isPlanning ? (
                  <>
                    <Activity className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    Analyzing Request...
                  </>
                ) : (
                  <>
                    <Bot className="-ml-1 mr-2 h-4 w-4" />
                    {threadId ? "Continue Conversation" : "Formulate Plan"}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Plan Review Section */}
      {plan && !executionResult && (
        <div className="bg-white shadow-sm rounded-lg border border-indigo-200 overflow-hidden ring-1 ring-indigo-100">
          <div className="bg-indigo-50 border-b border-indigo-100 px-6 py-4 flex items-center justify-between">
            <h3 className="text-lg font-medium text-indigo-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              Proposed Action Plan
            </h3>
            <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
              Awaiting Approval
            </span>
          </div>
          
          <div className="p-6 space-y-6">
            {plan.reasoning && (
              <div className="bg-gray-50 rounded p-4 text-sm text-gray-700 italic border-l-4 border-gray-300">
                "{plan.reasoning}"
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-4 uppercase tracking-wider">Planned Tool Executions ({plan.tool_calls.length})</h4>
              {plan.tool_calls.length === 0 ? (
                <p className="text-sm text-gray-500">No agent tools are required for this action.</p>
              ) : (
                <ul className="space-y-3">
                  {plan.tool_calls.map((tc, idx) => (
                    <li key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex flex-col sm:flex-row sm:items-start gap-4">
                      <div className="flex-shrink-0 mt-1">
                        <Terminal className="w-5 h-5 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 font-mono">
                          {tc.name}
                        </p>
                        <div className="mt-1 text-sm text-gray-500 overflow-x-auto">
                          <pre className="text-xs">{JSON.stringify(tc.args, null, 2)}</pre>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-6 border-t border-gray-200 pt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleReset}
                disabled={isExecuting}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Reject & Add Context
              </button>
              <button
                type="button"
                onClick={handleExecutePlan}
                disabled={isExecuting}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {isExecuting ? (
                  <>
                    <Activity className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    Executing System Actions...
                  </>
                ) : (
                  <>
                    <ArrowRight className="-ml-1 mr-2 h-4 w-4" />
                    Approve & Execute
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Execution Result Section */}
      {executionResult && (
        <div className="bg-white shadow-sm rounded-lg border border-green-200 overflow-hidden ring-1 ring-green-100">
          <div className="bg-green-50 border-b border-green-100 px-6 py-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-medium text-green-900">
              Execution Successful
            </h3>
          </div>
          <div className="p-6">
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
              {executionResult}
            </div>
            
            <div className="mt-6 flex justify-end gap-3">
               <button
                 type="button"
                 onClick={handleReset}
                 className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
               >
                 Dismiss
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

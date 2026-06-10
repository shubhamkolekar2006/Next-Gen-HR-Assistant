import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database, Search, Plus, Edit, Trash2, Send, FileText, Code } from 'lucide-react';
import { motion } from 'framer-motion';
import { databaseService } from '@/services/api';

const WORKFLOW_STEPS = [
  {
    id: 'parse_query',
    name: 'Parse Natural Language Query',
    description: 'Convert natural language to MongoDB operations',
    api: '',
    icon: Search,
  },
  {
    id: 'validate_collection',
    name: 'Validate Collection',
    description: 'Check if collection exists and validate field names',
    api: '',
    icon: Database,
  },
  {
    id: 'execute_operation',
    name: 'Execute Database Operation',
    description: 'Perform find, insert, update, or delete operations',
    api: '',
    icon: FileText,
  },
  {
    id: 'format_response',
    name: 'Format Response',
    description: 'Convert results to natural language format',
    api: '',
    icon: FileText,
  },
];

const OPERATIONS = [
  {
    id: 'find',
    name: 'Find/Query',
    description: 'Search and retrieve documents from collections',
    icon: Search,
    examples: [
      'Show all employees',
      'Find employees in Engineering department',
      'List all open jobs',
      'Get employee with ID EMP001',
    ],
  },
  {
    id: 'insert',
    name: 'Insert',
    description: 'Add new documents to collections',
    icon: Plus,
    examples: [
      'Add new employee',
      'Create a new job posting',
      'Insert candidate record',
    ],
  },
  {
    id: 'update',
    name: 'Update',
    description: 'Modify existing documents',
    icon: Edit,
    examples: [
      'Update employee salary',
      'Change job status to closed',
      'Update candidate status',
    ],
  },
  {
    id: 'delete',
    name: 'Delete',
    description: 'Remove documents from collections',
    icon: Trash2,
    examples: [
      'Delete employee record',
      'Remove cancelled interview',
    ],
  },
];

const COLLECTIONS = [
  'employee',
  'Leave_Attendance',
  'Performance',
  'Candidates',
  'Interviews',
  'Jobs',
  'Onboarding',
  'Attrition',
  'Communication',
  'Resume_screening',
  'skill_courses',
];

export const DatabaseManagerAgentInterface = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showMongoQuery, setShowMongoQuery] = useState(false);

  const handleQuery = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    setResult(null);
    try {
      const response = await databaseService.executeQuery(query, showMongoQuery);
      setResult(response);
    } catch (error: any) {
      setResult({ 
        success: false, 
        message: error.message || 'Failed to execute query',
        data: null 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-3 rounded-lg">
            <Database className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Database Manager Agent
            </h2>
            <p className="text-slate-600 mt-1">Natural language database queries and operations</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workflow Steps */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-500" />
              Workflow Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {WORKFLOW_STEPS.map((step, index) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="border-2 border-slate-200 rounded-lg p-5 cursor-pointer transition-all duration-200 ease-out group bg-white hover:border-blue-300 hover:bg-blue-50/70 hover:shadow-md"
                  >
                    <div className="flex items-start gap-3">
                      <div className="bg-blue-100 p-2 rounded-lg shrink-0">
                        <Icon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-sm text-slate-700 group-hover:text-slate-900 transition-colors duration-200">
                            {step.name}
                          </h4>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            Step {index + 1}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-500 group-hover:text-slate-700 leading-relaxed transition-colors duration-200">
                          {step.description}
                        </p>
                        {step.api ? (
                          <div className="mt-2 bg-slate-100 rounded px-2 py-1 text-xs font-mono text-slate-700">
                            {step.api}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Interactive Query Interface */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-500" />
              Database Query
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Natural Language Query
                </label>
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g., Show all employees in Engineering department"
                  className="w-full min-h-[120px] p-3 border border-slate-300 rounded-lg resize-none text-black"
                />
              </div>

              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="showMongoQuery"
                  checked={showMongoQuery}
                  onChange={(e) => setShowMongoQuery(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="showMongoQuery" className="text-sm text-slate-600">
                  Show MongoDB query
                </label>
              </div>

              <Button
                onClick={handleQuery}
                disabled={loading || !query.trim()}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90"
              >
                {loading ? 'Executing Query...' : 'Execute Query'}
              </Button>

              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {!result.success ? (
                    <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                      <p className="text-red-700 text-sm font-semibold">Error:</p>
                      <p className="text-red-600 text-sm mt-1">{result.message || 'Failed to execute query'}</p>
                    </div>
                  ) : result.data ? (
                    <>
                      {/* Natural Language Result */}
                      <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4 text-green-600" />
                          <p className="text-sm font-semibold text-green-900">Natural Language Result:</p>
                        </div>
                        <p className="text-green-800 text-sm whitespace-pre-wrap">
                          {result.data.natural_language_result}
                        </p>
                      </div>

                      {/* MongoDB Query (if requested) */}
                      {result.data.mongodb_query && (
                        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Code className="w-4 h-4 text-slate-600" />
                            <p className="text-sm font-semibold text-slate-700">MongoDB Query:</p>
                          </div>
                          <pre className="text-xs text-slate-600 bg-white p-2 rounded overflow-x-auto">
                            {JSON.stringify(result.data.mongodb_query, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Query Info */}
                      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                        <div className="flex items-center gap-4 text-xs text-blue-700">
                          <span><strong>Operation:</strong> {result.data.operation}</span>
                          <span><strong>Collection:</strong> {result.data.collection}</span>
                          {result.data.result_count !== null && (
                            <span><strong>Results:</strong> {result.data.result_count}</span>
                          )}
                        </div>
                      </div>

                      {/* Sample Results (if find operation) */}
                      {result.data.results && result.data.results.length > 0 && (
                        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 max-h-[300px] overflow-y-auto">
                          <p className="text-sm font-semibold text-slate-700 mb-2">
                            Sample Results {result.data.total_count ? `(${result.data.total_count} total)` : ''}:
                          </p>
                          <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono bg-white p-2 rounded">
                            {JSON.stringify(result.data.results, null, 2)}
                          </pre>
                        </div>
                      )}
                    </>
                  ) : null}
                </motion.div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Operations */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Supported Operations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {OPERATIONS.map((op, index) => {
              const Icon = op.icon;
              return (
                <motion.div
                  key={op.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <Icon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">{op.name}</h4>
                      <p className="text-sm text-slate-600">{op.description}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-700 mb-1">Examples:</p>
                    {op.examples.map((example, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleExampleClick(example)}
                        className="text-xs text-blue-600 hover:text-blue-700 hover:underline block w-full text-left"
                      >
                        • {example}
                      </button>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Available Collections */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Available Collections</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {COLLECTIONS.map((collection) => (
              <Badge
                key={collection}
                variant="outline"
                className="text-xs font-mono"
              >
                {collection}
              </Badge>
            ))}
          </div>
          <p className="text-sm text-slate-600 mt-4">
            You can query any of these collections using natural language. The agent will automatically
            convert your query to the appropriate MongoDB operation.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};


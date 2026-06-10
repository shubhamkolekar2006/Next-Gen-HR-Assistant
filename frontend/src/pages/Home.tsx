import { useNavigate } from 'react-router-dom';
import { Users, BarChart3, Bot, FileText, Shield, Zap, CheckCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

export const Home = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const features = [
    {
      icon: Users,
      title: 'Employee Management',
      description: 'Comprehensive employee database with detailed profiles, performance tracking, and organizational insights.',
    },
    {
      icon: Bot,
      title: 'AI-Powered Automation',
      description: 'Intelligent agents for talent acquisition, employee lifecycle, HR insights, and knowledge & action.',
    },
    {
      icon: BarChart3,
      title: 'Analytics & Insights',
      description: 'Real-time analytics, attrition risk prediction, and performance forecasting to make data-driven decisions.',
    },
    {
      icon: FileText,
      title: 'Document Management',
      description: 'Automated generation of offer letters, contracts, certificates, and other HR documents.',
    },
    {
      icon: Shield,
      title: 'Secure & Compliant',
      description: 'Enterprise-grade security with compliance management and data protection standards.',
    },
    {
      icon: Zap,
      title: 'Streamlined Workflows',
      description: 'Automated hiring processes, interview scheduling, and onboarding workflows to save time.',
    },
  ];

  const benefits = [
    'Reduce hiring time by up to 60%',
    'Improve candidate quality with AI screening',
    'Automate repetitive HR tasks',
    'Make data-driven decisions with analytics',
    'Ensure compliance with automated documentation',
    'Enhance employee experience with streamlined processes',
  ];

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate('/app/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Bar */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-blue-600">Next-Gen HR</h1>
                <p className="text-xs text-black">TalentFlow Platform</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {!isAuthenticated ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/login')}
                    className="border-gray-300 text-black"
                  >
                    Sign In
                  </Button>
                  <Button
                    onClick={handleGetStarted}
                    className="bg-blue-600 text-white"
                  >
                    Get Started
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => navigate('/app/dashboard')}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Go to Dashboard
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-blue-600 mb-6">
            Transform Your HR Operations
          </h1>
          <p className="text-xl text-black mb-8 leading-relaxed">
            Next-Gen HR is an intelligent human resources management platform powered by AI agents.
            Streamline hiring, manage employees, and make data-driven decisions with ease.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button
              onClick={handleGetStarted}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg"
            >
              Get Started
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate('/login')}
              className="border-gray-300 text-black hover:bg-gray-50 px-8 py-6 text-lg"
            >
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-blue-600 mb-4">Key Features</h2>
            <p className="text-lg text-black max-w-2xl mx-auto">
              Everything you need to manage your workforce efficiently
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="border border-gray-200 bg-white">
                  <CardContent className="p-6">
                    <div className="bg-blue-600 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-blue-600 mb-2">{feature.title}</h3>
                    <p className="text-black leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-blue-600 mb-6">Why Choose Next-Gen HR?</h2>
              <p className="text-lg text-black mb-8 leading-relaxed">
                Our platform combines cutting-edge AI technology with intuitive design to deliver
                a comprehensive HR management solution that saves time and improves outcomes.
              </p>
              <ul className="space-y-4">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span className="text-black text-lg">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-lg p-8 border border-gray-200">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-600 w-16 h-16 rounded-lg flex items-center justify-center">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-blue-600">Employee Management</h3>
                    <p className="text-black">Complete employee lifecycle management</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-blue-600 w-16 h-16 rounded-lg flex items-center justify-center">
                    <Bot className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-blue-600">AI Automation</h3>
                    <p className="text-black">Intelligent agents for HR processes</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-blue-600 w-16 h-16 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-blue-600">Analytics Dashboard</h3>
                    <p className="text-black">Data-driven insights and predictions</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Ready to Transform Your HR?</h2>
          <p className="text-xl text-white/90 mb-8">
            Start managing your workforce more efficiently today. Get started in minutes.
          </p>
          <Button
            onClick={handleGetStarted}
            size="lg"
            className="bg-white text-blue-600 px-8 py-6 text-lg font-semibold border border-blue-600"
          >
            Get Started Now
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center gap-3 mb-4 md:mb-0">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-blue-600">Next-Gen HR</h3>
                <p className="text-xs text-black">TalentFlow Platform</p>
              </div>
            </div>
            <p className="text-sm text-black">
              © {new Date().getFullYear()} Next-Gen HR. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};


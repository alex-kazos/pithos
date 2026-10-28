import { UserPlus, Key, LayoutDashboard } from 'lucide-react';

export default function HowItWorks() {
  const steps = [
    {
      step: '01',
      title: 'Sign up',
      description: "Create an account to get started using your email or Google Authentication method. It's quick and hassle-free!",
      icon: <UserPlus className="w-6 h-6 text-[#6366F1]" />,
      gradient: 'from-indigo-500/20 to-purple-500/20'
    },
    {
      step: '02',
      title: 'Connect your store',
      description: "Click \"Connect with Shopify\" or \"Connect with WooCommerce\" and authorize access - no API keys to copy or paste. You're synced in under a minute.",
      icon: <Key className="w-6 h-6 text-[#6366F1]" />,
      gradient: 'from-blue-500/20 to-indigo-500/20'
    },
    {
      step: '03',
      title: 'Access your Stock Pilot',
      description: 'Access the full dashboard with all features, including AI-driven recommendations and analysis to improve your daily operations.',
      icon: <LayoutDashboard className="w-6 h-6 text-[#6366F1]" />,
      gradient: 'from-emerald-500/20 to-blue-500/20'
    }
  ];

  return (
    <section id="how-it-works" className="pt-4 pb-8 relative">
      <div className="container mx-auto px-4 relative">
        <div className="text-center mb-20">
          <h2 className="text-4xl font-bold text-white mb-4">
            How it works
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Discover how our SaaS platform transforms your workflow with intuitive features designed to streamline your processes and boost efficiency.
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connector Lines */}
            <div className="hidden md:block absolute top-24 left-[20%] right-[20%] h-0.5">
              <div className="h-full w-full bg-gradient-to-r from-indigo-500/20 via-emerald-500/20 to-indigo-500/20 animate-pulse" />
            </div>
            
            {steps.map((step, index) => (
              <div key={index} className="relative group">
                {/* Animated gradient border */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/30 to-emerald-500/30 rounded-xl blur opacity-30 group-hover:opacity-100 transition duration-500" />
                
                <div className="relative bg-[#1A1A27] rounded-xl p-8 h-full backdrop-blur-sm">
                  {/* Step Badge */}
                  <div className="absolute -top-4 left-8">
                    <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white px-4 py-1 rounded-full text-sm font-medium shadow-lg shadow-indigo-500/30">
                      Step {step.step}
                    </div>
                  </div>

                  {/* Icon with gradient background */}
                  <div className={`w-14 h-14 rounded-lg flex items-center justify-center mb-6 bg-gradient-to-br ${step.gradient} p-0.5 group-hover:scale-110 transition-transform duration-300`}>
                    <div className="bg-[#12121E] w-full h-full rounded-[7px] flex items-center justify-center">
                      {step.icon}
                    </div>
                  </div>

                  <h3 className="text-xl font-semibold text-white mb-4 group-hover:text-indigo-400 transition-colors">
                    {step.title}
                  </h3>

                  <p className="text-gray-400 group-hover:text-gray-300 transition-colors">
                    {step.description}
                  </p>

                  {/* Decorative corner accent */}
                  <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-br from-transparent via-indigo-500/5 to-emerald-500/5 rounded-br-xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
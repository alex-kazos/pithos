import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Dashboard from '../components/Dashboard';
import SocialProof from '../components/SocialProof';
import Integrations from '../components/Integrations';
import HowItWorks from '../components/HowItWorks';
import Footer from '../components/Footer';
// import { Newsletter } from '../components/Newsletter'; // "Made by" section - hidden, not deleted (see below)

export default function LandingPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // NavBar links from other pages (blog, legal) navigate here with a
  // scrollTo section id in router state since there's nothing to scroll to
  // until we've landed. Consume it once, then clear it so a later refresh
  // or back-navigation to "/" doesn't re-trigger the scroll.
  useEffect(() => {
    const scrollTo = (location.state as { scrollTo?: string } | null)?.scrollTo;
    if (!scrollTo) return;

    const element = document.getElementById(scrollTo);
    if (element) {
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }

    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  return (
    <main className="min-h-screen bg-[#1E1E2D] relative overflow-x-hidden">
      {/* Universal Background with Gradient and Mesh */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-emerald-500/5 to-purple-500/5" />

        {/* Mesh overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1E1E2D_1px,transparent_1px),linear-gradient(to_bottom,#1E1E2D_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)] opacity-20" />

        {/* Animated gradients */}
        <div className="absolute top-0 -left-[1000px] w-[2000px] h-[2000px] bg-gradient-to-br from-indigo-500/10 via-emerald-500/10 to-transparent rounded-full blur-3xl animate-pulse transform -translate-y-[1000px]" />
        <div className="absolute bottom-0 -right-[1000px] w-[2000px] h-[2000px] bg-gradient-to-tl from-purple-500/10 via-emerald-500/10 to-transparent rounded-full blur-3xl animate-pulse-delayed transform translate-y-[1000px]" />
      </div>

      {/* Content */}
      <div className="relative space-y-8">
        <Header />
        <Dashboard />
        <SocialProof />
        <Integrations />
        <HowItWorks />
        {/* <Newsletter /> "Made by" section - hidden, not deleted */}
        <Footer />
      </div>
    </main>
  );
}

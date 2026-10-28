import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ROUTES, APP_LINKS } from '../constants/routes';

/**
 * Floating pill nav bar shared by the landing page AND every other public
 * page (blog, legal) - without this, navigating off "/" felt like leaving
 * StockPilot entirely rather than moving to another page within it.
 *
 * "Preview"/"How It Works" are anchors on the landing page's own sections.
 * From another page there's nothing to scroll to yet, so those links
 * navigate to "/" first and pass which section to land on via router state;
 * the landing page reads that state on mount and scrolls there itself.
 * "Live Demo" and "Log In" leave this site for the separate dashboard app.
 */
export default function NavBar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isLandingPage = location.pathname === ROUTES.ROOT;

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const goToSection = (sectionId: string) => {
    if (isLandingPage) {
      scrollToSection(sectionId);
    } else {
      navigate(ROUTES.ROOT, { state: { scrollTo: sectionId } });
    }
  };

  const goToTop = () => {
    if (isLandingPage) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate(ROUTES.ROOT);
    }
  };

  const navLinks = [
    { label: 'Preview', onClick: () => goToSection('dashboard') },
    { label: 'How It Works', onClick: () => goToSection('how-it-works') },
    { label: 'Live Demo', onClick: () => window.location.assign(APP_LINKS.DEMO) },
    { label: 'Blog', onClick: () => navigate(ROUTES.BLOG) },
  ];

  return (
    <div className="fixed top-4 left-0 right-0 z-50 flex justify-center">
      <div className="max-w-6xl w-full mx-4">
        <header className="backdrop-blur-md bg-[#1A1A27]/90 border border-gray-800/50 rounded-full px-6 shadow-xl">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <button
              onClick={goToTop}
              className="flex items-center space-x-2 transition-transform hover:scale-105"
            >
              <img src="/images/logo/stockpilot-icon.svg" alt="" className="w-7 h-7" />
              <span className="text-white text-lg font-bold">StockPilot</span>
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden text-gray-400 hover:text-white"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              {navLinks.map(link => (
                <button
                  key={link.label}
                  onClick={link.onClick}
                  className="text-gray-400 hover:text-white transition-colors duration-200"
                >
                  {link.label}
                </button>
              ))}
              <button
                onClick={() => window.location.assign(APP_LINKS.DASHBOARD)}
                className="px-4 py-2 text-sm font-medium text-white bg-[#6366F1] rounded-lg hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#6366F1] transition-transform duration-200"
              >
                Log In
              </button>
            </nav>
          </div>
        </header>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden mt-2 backdrop-blur-md bg-[#1A1A27]/90 border border-gray-800/50 rounded-xl p-4 shadow-xl">
            <nav className="flex flex-col space-y-4">
              {navLinks.map(link => (
                <button
                  key={link.label}
                  onClick={() => {
                    link.onClick();
                    setIsMenuOpen(false);
                  }}
                  className="text-gray-400 hover:text-white transition-colors duration-200 text-left px-4 py-2 hover:bg-gray-800/50 rounded-lg"
                >
                  {link.label}
                </button>
              ))}
              <button
                onClick={() => {
                  window.location.assign(APP_LINKS.DASHBOARD);
                  setIsMenuOpen(false);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:from-indigo-600 hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Log In
              </button>
            </nav>
          </div>
        )}
      </div>
    </div>
  );
}

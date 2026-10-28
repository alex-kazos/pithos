import { Linkedin, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { CONTACT_EMAIL } from '../data/legalContent';

export default function Footer() {
  return (
    <footer className="bg-[#1E1E2D] py-16 relative">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-3 gap-8">
            <div>
              <h4 className="text-xl font-semibold text-white mb-4">Product</h4>
              <div className="flex flex-col space-y-3">
                <Link to={ROUTES.BLOG} className="text-gray-400 hover:text-white transition-colors w-fit">
                  Blog
                </Link>
              </div>
            </div>
            <div>
              <h4 className="text-xl font-semibold text-white mb-4">Legal</h4>
              <div className="flex flex-col space-y-3">
                <Link to={ROUTES.PRIVACY} className="text-gray-400 hover:text-white transition-colors w-fit">
                  Privacy Policy
                </Link>
                <Link to={ROUTES.TERMS} className="text-gray-400 hover:text-white transition-colors w-fit">
                  Terms of Service
                </Link>
              </div>
            </div>
            <div>
              <h4 className="text-xl font-semibold text-white mb-4">Follow Us</h4>
              <div className="flex flex-col space-y-3">
                <a
                  href="https://www.linkedin.com/in/alex-kazos/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors w-fit"
                >
                  <Linkedin className="w-5 h-5" />
                  <span className="whitespace-nowrap">Alex Kazos</span>
                </a>
                <a
                  href="https://alexkazos.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors w-fit"
                >
                  <Globe className="w-5 h-5" />
                  <span className="whitespace-nowrap">alexkazos.com</span>
                </a>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <span>© {new Date().getFullYear()} Alex Kazos. All rights reserved.</span>
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-gray-300 transition-colors">
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

import React from 'react';
import NavBar from '../NavBar';
import Footer from '../Footer';

/**
 * Shared shell for every public Tailwind page (landing, blog, legal) so
 * they all read as the same site - same floating nav, same background
 * gradient/mesh treatment, same footer - rather than blog/legal feeling
 * like a bare page bolted on separately.
 */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#1E1E2D] relative overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-emerald-500/5 to-purple-500/5" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1E1E2D_1px,transparent_1px),linear-gradient(to_bottom,#1E1E2D_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)] opacity-20" />
        <div className="absolute top-0 -left-[1000px] w-[2000px] h-[2000px] bg-gradient-to-br from-indigo-500/10 via-emerald-500/10 to-transparent rounded-full blur-3xl animate-pulse transform -translate-y-[1000px]" />
        <div className="absolute bottom-0 -right-[1000px] w-[2000px] h-[2000px] bg-gradient-to-tl from-purple-500/10 via-emerald-500/10 to-transparent rounded-full blur-3xl animate-pulse-delayed transform translate-y-[1000px]" />
      </div>

      <div className="relative">
        <NavBar />
        <div className="pt-32">{children}</div>
        <Footer />
      </div>
    </main>
  );
}

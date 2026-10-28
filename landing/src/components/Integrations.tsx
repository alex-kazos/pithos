
const platforms = [
  {
    name: 'Shopify',
    logo: '/images/platforms/shopify.svg'
  },
  {
    name: 'WooCommerce',
    logo: '/images/platforms/woocommerce.svg'
  },
  {
    name: 'Open AI',
    logo: '/images/platforms/open-ai.png'
  },
];

export default function Integrations() {
  return (
    <section className="pt-16 md:pt-24 pb-8 md:pb-12 relative">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Native Integration with
            </h2>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
            {platforms.map((platform, index) => (
              <div 
                key={index}
                className="group relative w-1/2 sm:w-1/3 md:w-auto"
              >
                {/* Hover Effect Background */}
                <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/20 to-emerald-500/20 rounded-xl opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500" />
                
                {/* Platform Logo Container */}
                <div className="relative transform transition-all duration-300 group-hover:scale-110">
                  {/* Logo */}
                  <img
                    src={platform.logo}
                    alt={`${platform.name} logo`}
                    className="h-12 md:h-16 w-auto object-contain opacity-70 group-hover:opacity-100 transition-opacity duration-300 mx-auto"
                  />
                  
                  {/* Platform Name */}
                  <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 whitespace-nowrap">
                    <span className="text-gray-400 text-sm">
                      {platform.name}
                    </span>
                  </div>
                </div>

                {/* Decorative Dots */}
                <div className="absolute -z-10 w-20 h-20">
                  <div className="absolute top-0 left-0 w-2 h-2 bg-indigo-500/20 rounded-full animate-ping" style={{ animationDelay: `${index * 0.2}s` }} />
                  <div className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500/20 rounded-full animate-ping" style={{ animationDelay: `${index * 0.3}s` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
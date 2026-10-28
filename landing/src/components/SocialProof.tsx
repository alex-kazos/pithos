
export default function SocialProof() {
  return (
    <section className="py-16 md:py-24 relative">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-white text-center mb-6">
            End Stock Anxiety
          </h2>
          
          <p className="text-lg md:text-xl text-gray-400 text-center max-w-4xl mx-auto mb-16">
            Tired of running out of bestsellers or overstocking what doesn't sell? Stock Pilot's AI
            tells you exactly what's moving and what's not. Get instant alerts and
            recommendations to keep your shelves and storage perfectly balanced—no guessing,
            no stress.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {[
              {
                title: "70%",
                description: <>Customers won't wait for out-of-stock items to return - they'll simply shop elsewhere. <span className="text-sm text-gray-500">- SymphonyIRI Group</span></>
              },
              {
                title: "10%",
                description: <>Reduction in inventory costs achieved through better stock management and demand forecasting. <span className="text-sm text-gray-500">- Upself</span></>
              },
              {
                title: "66%",
                description: <>Of retailers struggle with excess inventory, leading to unnecessary storage costs and tied-up capital. <span className="text-sm text-gray-500">- Netstock</span></>
              }
            ].map((item, index) => (
              <div key={index} className="relative group">
                {/* Hover gradient */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/30 to-emerald-500/30 rounded-xl blur opacity-30 group-hover:opacity-100 transition duration-500" />
                
                <div className="relative bg-[#1A1A27] p-6 rounded-xl backdrop-blur-sm h-full flex flex-col">
                  <h3 className="text-4xl font-bold text-indigo-400 mb-4">{item.title}</h3>
                  <p className="text-gray-400">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
import { motion } from 'framer-motion';
import { NewsletterCard } from './ui/NewsletterCard';
import { newsletters } from '../data/newsletters';

export function Newsletter() {
    return (
        <section className="py-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl font-bold mb-4">Made by</h2>
                    <p className="text-muted-foreground max-w-2xl mx-auto">
                        Stay ahead of the curve with our expert insights and analysis
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {newsletters.map((newsletter) => (
                        <NewsletterCard key={newsletter.title} newsletter={newsletter} />
                    ))}
                </div>
            </div>
        </section>
    );
}
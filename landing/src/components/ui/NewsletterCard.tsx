import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from './Button';
import { NewsletterLogo } from './NewsletterLogo';
import type { Newsletter } from '../../types/newsletter';

interface NewsletterCardProps {
    newsletter: Newsletter;
}

export function NewsletterCard({ newsletter }: NewsletterCardProps) {
    const handleReadMore = () => {
        window.open(newsletter.url, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="relative group">
            {/* Hover gradient */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/30 to-emerald-500/30 rounded-xl blur opacity-30 group-hover:opacity-100 transition duration-500" />
            
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                className="relative bg-[#1A1A27] p-6 rounded-xl backdrop-blur-sm h-full"
            >
                <div className="flex items-start gap-6 mb-6">
                    <NewsletterLogo
                        logo={newsletter.logo}
                        title={newsletter.title}
                        accentColor={newsletter.theme.accent}
                    />
                    <div className="flex-1">
                        <h3 className="text-2xl font-bold mb-2 text-white">{newsletter.title}</h3>
                        <div className="flex items-center gap-3">
                            <img
                                src={newsletter.author.avatar}
                                alt={newsletter.author.name}
                                className="w-6 h-6 rounded-full object-cover"
                            />
                            <div>
                                <p className="text-sm font-medium text-white">{newsletter.author.name}</p>
                                <p className="text-sm text-gray-400">{newsletter.author.role}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <p className="text-gray-400 mb-6">{newsletter.description}</p>

                <div className="flex flex-wrap gap-2 mb-6">
                    {newsletter.topics.map((topic, index) => (
                        <motion.div
                            key={topic.label}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.1 }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/20 backdrop-blur-sm ${newsletter.theme.accent}`}
                        >
                            <topic.icon className="h-4 w-4" />
                            <span className="text-sm font-medium">{topic.label}</span>
                        </motion.div>
                    ))}
                </div>

                <Button
                    onClick={handleReadMore}
                    className="w-full group bg-[#25253B] hover:bg-[#2A2A45] text-white"
                    aria-label={`Read more articles from ${newsletter.title}`}
                >
                    Read More
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
            </motion.div>
        </div>
    );
}
import { Lightbulb, LineChart, Code, Blocks } from 'lucide-react';
import type { Newsletter } from '../types/newsletter';

export const newsletters: Newsletter[] = [
    {
        title: "Value Frame",
        logo: "https://substackcdn.com/image/fetch/w_88,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F6732df3f-3420-48b0-848f-1cdb41feb41c_875x875.png",
        description: "Posts for people looking to capitalize on or develop businesses rooted in tech disruption.",
        author: {
            name: "Marios Vasilakis",
            role: "Strategist",
            avatar: "https://substackcdn.com/image/fetch/w_176,h_176,c_fill,f_webp,q_auto:good,fl_progressive:steep,g_auto/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F92c0feee-1d82-4bd2-986e-65abbda5c168_400x400.png"
        },
        topics: [
            { label: "Business Design", icon: Lightbulb },
            { label: "Futures Research", icon: LineChart }
        ],
        url: "https://valueframe.substack.com",
        theme: {
            gradient: "from-emerald-950 to-teal-950",
            accent: "text-emerald-500",
            hover: "group-hover:text-emerald-400"
        }
    },
    {
        title: "Built by Alex",
        logo: "https://substackcdn.com/image/fetch/w_88,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F06f0912a-f245-4d48-85d9-15efbabcff41_1120x1120.png",
        description: "Sharing insights, experiences, and projects from the journey of a co-founder and developer, with a focus on tech, AI, and innovation.",
        author: {
            name: "Alex Kazos",
            role: "Full stack Developer",
            avatar: "https://substackcdn.com/image/fetch/w_176,h_176,c_fill,f_webp,q_auto:good,fl_progressive:steep,g_auto/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fd93bb237-3720-42fc-8714-68489cabd788_861x861.png"
        },
        topics: [
            { label: "AI-First Software Development", icon: Code },
            { label: "Tech Micro Projects", icon: Blocks }
        ],
        url: "https://alexkazos.substack.com",
        theme: {
            gradient: "from-blue-950 to-indigo-950",
            accent: "text-blue-500",
            hover: "group-hover:text-blue-400"
        }
    }
] as const;
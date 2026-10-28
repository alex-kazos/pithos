import type { LucideIcon } from 'lucide-react';

export interface Newsletter {
    title: string;
    logo: string;
    description: string;
    author: {
        name: string;
        role: string;
        avatar: string;
    };
    topics: {
        label: string;
        icon: LucideIcon;
    }[];
    url: string;
    theme: {
        gradient: string;
        accent: string;
        hover: string;
    };
}
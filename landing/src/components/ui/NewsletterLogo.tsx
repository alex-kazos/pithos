interface NewsletterLogoProps {
    logo: string;
    title: string;
    accentColor: string;
}

export function NewsletterLogo({ logo, title }: NewsletterLogoProps) {
    return (
        <div className="relative w-20 h-20">
            <div className="w-full h-full rounded-full bg-black/10 p-2 backdrop-blur-sm">
                <img
                    src={logo}
                    alt={`${title} logo`}
                    className="w-full h-full object-contain rounded-full"
                />
            </div>
        </div>
    );
}
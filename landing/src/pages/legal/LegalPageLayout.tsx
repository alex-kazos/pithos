import ReactMarkdown from 'react-markdown';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';

interface LegalPageLayoutProps {
  title: string;
  description: string;
  markdown: string;
}

export function LegalPageLayout({ title, description, markdown }: LegalPageLayoutProps) {
  useDocumentMeta(`${title} - StockPilot`, description);

  return (
    <div className="container mx-auto px-4 pb-24 max-w-3xl">
      <h1 className="text-3xl md:text-4xl font-bold text-white mb-8">{title}</h1>
      <div className="prose prose-invert prose-indigo max-w-none prose-headings:font-semibold prose-a:text-indigo-400 hover:prose-a:text-indigo-300">
        <ReactMarkdown>{markdown}</ReactMarkdown>
      </div>
    </div>
  );
}

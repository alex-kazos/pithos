import { useEffect } from 'react';

/**
 * Sets document.title and the meta description for the current page, and
 * restores index.html's defaults on unmount. This is a client-side-only
 * update - it helps Google (which executes JS before indexing) show the
 * right title/snippet per page, but crawlers that DON'T execute JS (most
 * social-preview scrapers, e.g. Slack/Twitter) will still see index.html's
 * generic OG tags when a blog post link is shared. Proper per-page OG tags
 * would need server-side rendering/prerendering, which this app doesn't have.
 */
export function useDocumentMeta(title: string, description: string) {
  useEffect(() => {
    const previousTitle = document.title;
    const descriptionTag = document.querySelector('meta[name="description"]');
    const previousDescription = descriptionTag?.getAttribute('content') ?? null;

    document.title = title;
    descriptionTag?.setAttribute('content', description);

    return () => {
      document.title = previousTitle;
      if (previousDescription !== null) {
        descriptionTag?.setAttribute('content', previousDescription);
      }
    };
  }, [title, description]);
}

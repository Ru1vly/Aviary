import { Page } from 'playwright';

export interface MockPageOptions {
  title?: string;
  url?: string;
  metaTags?: Record<string, string>;
  content?: string;
  evaluateResults?: Record<string, any>;
}

export function createMockPage(options: MockPageOptions = {}): Partial<Page> {
  const {
    title = 'Test Page Title',
    url = 'https://example.com',
    metaTags = {},
    content = '',
    evaluateResults = {},
  } = options;

  const mockPage: Partial<Page> = {
    title: async () => title,
    url: () => url,
    content: async () => content,

    locator: (selector: string) => {
      return {
        getAttribute: async (name: string) => {
          // Handle meta tag queries
          if (selector.includes('meta')) {
            const match = selector.match(/\[([^=]+)="([^"]+)"\]/);
            if (match) {
              const [, attr, value] = match;
              return metaTags[value] || null;
            }
          }
          // Handle link queries
          if (selector.includes('link')) {
            return metaTags['canonical'] || null;
          }
          return null;
        },
        count: async () => {
          if (selector.includes('meta') || selector.includes('link')) {
            return Object.keys(metaTags).length;
          }
          return 0;
        },
        textContent: async () => '',
        innerHTML: async () => '',
        isVisible: async () => true,
      } as any;
    },

    evaluate: async (fn: any, ...args: any[]) => {
      // Return pre-configured results for specific evaluations
      const fnString = fn.toString();

      // Handle new page.evaluate queries for metaTags (quote-agnostic)
      if (fnString.includes('description') && fnString.includes('meta')) {
        return metaTags['description'] || null;
      }
      if (fnString.includes('keywords') && fnString.includes('meta')) {
        return metaTags['keywords'] || null;
      }
      if (fnString.includes('canonical') && fnString.includes('link')) {
        return metaTags['canonical'] || null;
      }
      if (fnString.includes('viewport') && fnString.includes('meta')) {
        return metaTags['viewport'] || null;
      }

      for (const [key, value] of Object.entries(evaluateResults)) {
        if (fnString.includes(key)) {
          return value;
        }
      }

      return [];
    },

    $: async (selector: string) => null,
    $$: async (selector: string) => [],

    waitForSelector: async (selector: string) => null as any,
    waitForLoadState: async (state?: any) => {},
    goto: async (url: string, options?: any) => null as any,
  };

  return mockPage;
}

export function createMockPageWithMetaTags(metaTags: Record<string, string>): Partial<Page> {
  return createMockPage({ metaTags });
}

export function createMockPageWithTitle(title: string): Partial<Page> {
  return createMockPage({ title });
}

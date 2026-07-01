# e2e-seo 🔍

An end-to-end SEO testing toolkit for websites using browser automation. Built with TypeScript and Playwright for comprehensive SEO analysis.

## 🚀 Features

### Current MVP Features

- **Meta Tags Analysis**
  - Title tag validation (length, presence)
  - Meta description validation
  - Open Graph tags checking
  - Canonical URL verification
  - Viewport meta tag validation
  
- **Heading Structure**
  - H1 uniqueness check
  - Heading hierarchy validation
  - Heading length optimization
  
- **Image Optimization**
  - Alt text validation
  - Image count analysis
  
- **Performance Metrics**
  - Page load time
  - DOM content loaded time
  - First Contentful Paint

- **🔥 Heatmap Analysis** *(NEW)*
  - Predictive click heatmap generation
  - Scroll depth analysis
  - Attention zone detection (F-pattern, visual hierarchy)
  - CTA placement analysis
  - Above-the-fold content scoring
  - Visual heatmap screenshot capture

- **Automated Browser Testing**
  - Uses Playwright for real browser testing
  - Supports headless and headed modes
  - Configurable viewport for mobile/desktop testing

## 📦 Installation

```bash
npm install e2e-seo
```

## 🎯 Quick Start

### CLI Usage

```bash
# Basic usage
e2e-seo https://example.com

# Save report to JSON
e2e-seo https://example.com -o report.json

# Test with mobile viewport
e2e-seo https://example.com --viewport 375x667

# Show browser (headed mode)
e2e-seo https://example.com --headed
```

### Programmatic API

```typescript
import { SEOChecker } from 'e2e-seo';

const checker = new SEOChecker({
  url: 'https://example.com',
  headless: true,
});

const report = await checker.check();

console.log(`SEO Score: ${report.score}/100`);
console.log(`Passed: ${report.summary.passed}/${report.summary.total}`);
```

## 📖 Usage

### Basic Usage

```typescript
import { SEOChecker } from 'e2e-seo';

async function checkSEO() {
  const checker = new SEOChecker({
    url: 'https://yourwebsite.com',
  });

  const report = await checker.check();

  // Print results
  console.log('Meta Tags:');
  report.checks.metaTags.forEach(check => {
    console.log(`${check.passed ? '✓' : '✗'} ${check.message}`);
  });

  console.log('\nHeadings:');
  report.checks.headings.forEach(check => {
    console.log(`${check.passed ? '✓' : '✗'} ${check.message}`);
  });
}

checkSEO();
```

### Mobile Testing

```typescript
const mobileChecker = new SEOChecker({
  url: 'https://yourwebsite.com',
  viewport: {
    width: 375,
    height: 667, // iPhone SE dimensions
  },
});

const report = await mobileChecker.check();
```

### Custom Configuration

```typescript
const checker = new SEOChecker({
  url: 'https://yourwebsite.com',
  headless: false, // Show browser
  timeout: 60000, // 60 seconds timeout
  viewport: {
    width: 1920,
    height: 1080,
  },
});
```

## 🏗️ Project Structure

```
e2e-seo/
├── src/                   # SEO checker library (TypeScript)
│   ├── checkers/          # 27 SEO checker modules (260+ checks)
│   ├── config/            # Configuration system
│   ├── errors/            # Error handling
│   ├── types/             # TypeScript definitions
│   ├── index.ts           # Main SEOChecker class
│   └── cli.ts             # CLI interface
├── examples/              # Usage examples & config presets
├── tests/                 # Comprehensive test suites
└── dist/                  # Compiled JavaScript output
```

## 🛠️ Development

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/e2e-seo.git
cd e2e-seo

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium
```

### Build

```bash
npm run build
```

### Linting

```bash
npm run lint
npm run lint:fix
```

### Formatting

```bash
npm run format
npm run format:check
```

## 📊 Report Structure

```typescript
{
  url: string;
  timestamp: string;
  score: number; // 0-100
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  checks: {
    metaTags: SEOCheckResult[];
    headings: SEOCheckResult[];
    images: SEOCheckResult[];
    performance: SEOCheckResult[];
  };
}
```

## 🗺️ Roadmap

See [TODO.md](./TODO.md) for the complete production readiness checklist.

### Upcoming Features

- ✅ ~~Heatmap generation (click, scroll, attention)~~ - **DONE!**
- 📊 HTML/PDF report generation
- 🔍 Structured data validation (JSON-LD, Schema.org)
- 🔗 Link analysis and broken link detection
- 🤖 Content analysis and keyword density
- 🎨 Accessibility (A11y) checking
- 🚀 Core Web Vitals (LCP, FID, CLS)
- 🖥️ CLI tool for command-line usage

## 🤝 Contributing

Contributions are welcome! Please see [TODO.md](./TODO.md) for areas where help is needed.

## 📄 License

MIT

## 🙏 Acknowledgments

- Built with [Playwright](https://playwright.dev/) for browser automation
- Inspired by tools like Lighthouse, SEMrush, and Ahrefs

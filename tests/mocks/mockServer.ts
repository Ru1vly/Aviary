import express, { Express } from 'express';
import { Server } from 'http';

export class MockServer {
  private app: Express;
  private server: Server | null = null;
  private port: number;

  constructor(port: number = 3456) {
    this.port = port;
    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Optimal SEO page
    this.app.get('/optimal', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta name="description" content="This is an optimal meta description with perfect length between 120 and 160 characters for best SEO results and search engine display.">
          <title>Perfect SEO Title Length Here For Testing</title>
          <link rel="canonical" href="http://localhost:${this.port}/optimal">
          <meta property="og:title" content="Optimal Page">
          <meta property="og:description" content="Optimal Description">
          <meta property="og:image" content="http://localhost:${this.port}/image.jpg">
        </head>
        <body>
          <h1>Main Heading</h1>
          <h2>Subheading 1</h2>
          <p>${'Lorem ipsum dolor sit amet. '.repeat(400)}</p>
          <h2>Subheading 2</h2>
          <img src="image1.jpg" alt="Descriptive alt text 1">
          <img src="image2.jpg" alt="Descriptive alt text 2">
        </body>
        </html>
      `);
    });

    // Poor SEO page
    this.app.get('/poor', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Bad</title>
        </head>
        <body>
          <h2>No H1 here</h2>
          <p>Too short content.</p>
          <img src="image.jpg">
        </body>
        </html>
      `);
    });

    // Medium SEO page
    this.app.get('/medium', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Medium SEO Page Title For Testing Purpose</title>
        </head>
        <body>
          <h1>Main Title</h1>
          <h2>Section</h2>
          <p>${'Some content here. '.repeat(100)}</p>
          <img src="image.jpg" alt="Image description">
        </body>
        </html>
      `);
    });

    // Product page shaped like real sites found to break resolveDescriptiveText
    // (shared/dom.ts) -- specifically to run it through a REAL Playwright
    // page.evaluate() round trip, not the mock-DOM unit tests, since a bug
    // where a function body doesn't survive Playwright's toString()
    // serialization (e.g. a bundler-injected helper around a nested closure)
    // is invisible to unit tests but breaks in exactly this real path.
    this.app.get('/product-description-edge-cases', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Product Description Edge Cases</title>
        </head>
        <body>
          <span class="price">$9.99</span>
          <!-- books.toscrape.com shape: label-only container, real text is a sibling -->
          <div id="product_description"><h2>Product Description</h2></div>
          <p>${'Real descriptive prose that should be rescued from being a sibling. '.repeat(5)}</p>
        </body>
        </html>
      `);
    });

    // robots.txt
    this.app.get('/robots.txt', (req, res) => {
      res.type('text/plain');
      res.send(`
User-agent: *
Allow: /
Sitemap: http://localhost:${this.port}/sitemap.xml
      `);
    });

    // sitemap.xml
    this.app.get('/sitemap.xml', (req, res) => {
      res.type('application/xml');
      res.send(`
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>http://localhost:${this.port}/optimal</loc>
    <lastmod>2024-01-01</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
      `);
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          console.log(`Mock server running on http://localhost:${this.port}`);
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err) => {
          if (err) {
            reject(err);
          } else {
            console.log('Mock server stopped');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  getUrl(path: string = '/'): string {
    return `http://localhost:${this.port}${path}`;
  }
}

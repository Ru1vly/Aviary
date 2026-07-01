import { Page } from 'playwright';
import { SEOCheckResult } from '../types';

export class StructuredDataChecker {
  constructor(private page: Page) {}

  async checkAll(): Promise<SEOCheckResult[]> {
    const results: SEOCheckResult[] = [];

    results.push(await this.checkJSONLD());
    results.push(await this.checkMicrodata());
    results.push(await this.checkSchemaTypes());

    return results;
  }

  private async checkJSONLD(): Promise<SEOCheckResult> {
    try {
      const jsonLdScripts = await this.page.evaluate(() => {
        const scripts = Array.from(
          document.querySelectorAll('script[type="application/ld+json"]')
        );
        return scripts.map((script) => {
          try {
            return JSON.parse(script.textContent || '{}');
          } catch {
            return null;
          }
        }).filter((data) => data !== null);
      });

      if (jsonLdScripts.length === 0) {
        return {
          passed: false,
          message: 'No JSON-LD structured data found',
        };
      }

      // Extract schema types
      const schemaTypes = jsonLdScripts.map((data: any) => {
        if (data['@type']) {
          return Array.isArray(data['@type']) ? data['@type'] : [data['@type']];
        }
        return [];
      }).flat();

      return {
        passed: true,
        message: `Found ${jsonLdScripts.length} JSON-LD structured data block(s)`,
        details: {
          count: jsonLdScripts.length,
          types: schemaTypes,
          data: jsonLdScripts,
        },
      };
    } catch (error) {
      return {
        passed: false,
        message: `Error checking JSON-LD: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async checkMicrodata(): Promise<SEOCheckResult> {
    try {
      const microdataElements = await this.page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('[itemscope]'));
        return elements.map((el) => ({
          itemType: el.getAttribute('itemtype'),
          itemProp: el.getAttribute('itemprop'),
        }));
      });

      if (microdataElements.length === 0) {
        return {
          passed: true,
          message: 'No Microdata found (JSON-LD is preferred)',
        };
      }

      const itemTypes = microdataElements
        .map((el: any) => el.itemType)
        .filter((type: any) => type)
        .filter((value: any, index: any, self: any) => self.indexOf(value) === index);

      return {
        passed: true,
        message: `Found ${microdataElements.length} Microdata elements`,
        details: {
          count: microdataElements.length,
          types: itemTypes,
        },
      };
    } catch (error) {
      return {
        passed: false,

        severity: 'info',

        message: 'Microdata check skipped due to error',
      };
    }
  }

  private async checkSchemaTypes(): Promise<SEOCheckResult> {
    try {
      const jsonLdScripts = await this.page.evaluate(() => {
        const scripts = Array.from(
          document.querySelectorAll('script[type="application/ld+json"]')
        );
        return scripts.map((script) => {
          try {
            return JSON.parse(script.textContent || '{}');
          } catch {
            return null;
          }
        }).filter((data) => data !== null);
      });

      if (jsonLdScripts.length === 0) {
        return {
          passed: true,
          message: 'Schema type validation skipped (no JSON-LD found)',
        };
      }

      const schemaTypes: string[] = [];
      const recommendations: string[] = [];

      jsonLdScripts.forEach((data: any) => {
        if (data['@type']) {
          const types = Array.isArray(data['@type']) ? data['@type'] : [data['@type']];
          schemaTypes.push(...types);
        }
      });

      // Common beneficial schema types
      const beneficialTypes = [
        'Organization',
        'WebSite',
        'WebPage',
        'Article',
        'Product',
        'BreadcrumbList',
        'FAQPage',
        'HowTo',
        'Review',
      ];

      const hasOrganization = schemaTypes.includes('Organization');
      const hasWebSite = schemaTypes.includes('WebSite');
      const hasBreadcrumb = schemaTypes.includes('BreadcrumbList');

      if (!hasOrganization) {
        recommendations.push('Consider adding Organization schema');
      }
      if (!hasWebSite) {
        recommendations.push('Consider adding WebSite schema');
      }
      if (!hasBreadcrumb) {
        recommendations.push('Consider adding BreadcrumbList schema for better navigation');
      }

      const foundBeneficialTypes = schemaTypes.filter((type) =>
        beneficialTypes.includes(type)
      );

      return {
        passed: foundBeneficialTypes.length > 0,
        message:
          foundBeneficialTypes.length > 0
            ? `Found ${foundBeneficialTypes.length} beneficial schema type(s)`
            : 'No common beneficial schema types found',
        details: {
          schemaTypes,
          foundBeneficialTypes,
          recommendations,
        },
      };
    } catch (error) {
      return {
        passed: false,

        severity: 'info',

        message: 'Schema type validation skipped due to error',
      };
    }
  }
}

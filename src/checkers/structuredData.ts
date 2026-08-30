import { BaseChecker, CheckOutcome } from './base';

export class StructuredDataChecker extends BaseChecker {
  protected checks() {
    return [
      { id: 'json-ld-present', run: () => this.checkJSONLD() },
      { id: 'microdata-detected', run: () => this.checkMicrodata() },
      { id: 'beneficial-schema-types-present', run: () => this.checkSchemaTypes() },
    ];
  }

  private async checkJSONLD(): Promise<CheckOutcome> {
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
        return this.fail('No JSON-LD structured data found');
      }

      // Extract schema types
      const schemaTypes = jsonLdScripts.map((data: any) => {
        if (data['@type']) {
          return Array.isArray(data['@type']) ? data['@type'] : [data['@type']];
        }
        return [];
      }).flat();

      return this.pass(`Found ${jsonLdScripts.length} JSON-LD structured data block(s)`, {
        count: jsonLdScripts.length,
        types: schemaTypes,
        data: jsonLdScripts,
      });
    } catch (error) {
      return this.fail(`Error checking JSON-LD: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async checkMicrodata(): Promise<CheckOutcome> {
    try {
      const microdataElements = await this.page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('[itemscope]'));
        return elements.map((el) => ({
          itemType: el.getAttribute('itemtype'),
          itemProp: el.getAttribute('itemprop'),
        }));
      });

      if (microdataElements.length === 0) {
        return this.pass('No Microdata found (JSON-LD is preferred)');
      }

      const itemTypes = microdataElements
        .map((el: any) => el.itemType)
        .filter((type: any) => type)
        .filter((value: any, index: any, self: any) => self.indexOf(value) === index);

      return this.pass(`Found ${microdataElements.length} Microdata elements`, {
        count: microdataElements.length,
        types: itemTypes,
      });
    } catch (error) {
      return { passed: false, severity: 'info', message: 'Microdata check skipped due to error' };
    }
  }

  private async checkSchemaTypes(): Promise<CheckOutcome> {
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
        return this.pass('Schema type validation skipped (no JSON-LD found)');
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
      return { passed: false, severity: 'info', message: 'Schema type validation skipped due to error' };
    }
  }
}

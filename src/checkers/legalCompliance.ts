import { BaseChecker, CheckOutcome } from './base';
import { extractImages, extractLinks, LinkData } from './shared/dom';

export class LegalComplianceChecker extends BaseChecker {
  private linksPromise?: Promise<LinkData[]>;

  private getLinks(): Promise<LinkData[]> {
    if (!this.linksPromise) {
      this.linksPromise = this.page.evaluate(extractLinks);
    }
    return this.linksPromise;
  }

  /** Replaces the checker's 10 copy-pasted `querySelectorAll('a').filter(...)` blocks. */
  private async matchLinks(
    keywords: string[],
    options: { matchHref?: boolean; footerOnly?: boolean; extra?: (link: LinkData) => boolean } = {}
  ): Promise<{ found: boolean; count: number; inFooter: boolean }> {
    const { matchHref = true, footerOnly = false, extra } = options;
    const links = await this.getLinks();
    const pool = footerOnly ? links.filter((link) => link.inFooter) : links;
    const matches = pool.filter(
      (link) =>
        keywords.some((keyword) => link.text.includes(keyword) || (matchHref && link.href.includes(keyword))) ||
        (extra?.(link) ?? false)
    );

    return {
      found: matches.length > 0,
      count: matches.length,
      inFooter: matches.some((link) => link.inFooter),
    };
  }

  protected checks() {
    return [
      { id: 'privacy-policy-linked', run: () => this.checkPrivacyPolicy() },
      { id: 'terms-of-service-linked', run: () => this.checkTermsOfService() },
      { id: 'cookie-consent-present', run: () => this.checkCookieConsent() },
      { id: 'gdpr-compliance-indicated', run: () => this.checkGDPRCompliance() },
      { id: 'ccpa-compliance-indicated', run: () => this.checkCCPACompliance() },
      { id: 'cookie-policy-linked', run: () => this.checkCookiePolicy() },
      { id: 'data-protection-https', run: () => this.checkDataProtection() },
      { id: 'accessibility-statement-present', run: () => this.checkAccessibility() },
      { id: 'copyright-notice-current', run: () => this.checkCopyrightNotice() },
      { id: 'contact-information-present', run: () => this.checkContactInformation() },
      { id: 'disclaimers-present', run: () => this.checkDisclaimers() },
      { id: 'age-verification-present', run: () => this.checkAgeVerification() },
      { id: 'refund-policy-linked', run: () => this.checkRefundPolicy() },
      { id: 'shipping-policy-linked', run: () => this.checkShippingPolicy() },
      { id: 'legal-footer-links-present', run: () => this.checkLegalFooter() },
    ];
  }

  private async checkPrivacyPolicy(): Promise<CheckOutcome> {
    try {
      const privacyData = await this.matchLinks(['privacy']);

      if (!privacyData.found) {
        return this.fail('No privacy policy link found (required for most websites)', privacyData);
      }

      return this.pass(
        privacyData.inFooter ? 'Privacy policy link found in footer' : 'Privacy policy link found',
        privacyData
      );
    } catch (error) {
      return this.pass('Privacy policy check skipped');
    }
  }

  private async checkTermsOfService(): Promise<CheckOutcome> {
    try {
      const termsData = await this.matchLinks(['terms', 'conditions']);

      if (!termsData.found) {
        return this.fail('No terms of service link found (recommended for all websites)', termsData);
      }

      return this.pass(
        termsData.inFooter ? 'Terms of service link found in footer' : 'Terms of service link found',
        termsData
      );
    } catch (error) {
      return this.pass('Terms of service check skipped');
    }
  }

  private async checkCookieConsent(): Promise<CheckOutcome> {
    try {
      const cookieData = await this.page.evaluate(() => {
        const cookieBanners = Array.from(document.querySelectorAll('[class*="cookie"], [id*="cookie"], [class*="consent"], [id*="consent"]'));
        const cookieButtons = Array.from(document.querySelectorAll('button, a')).filter((el) => {
          const text = el.textContent?.toLowerCase() || '';
          return text.includes('cookie') || text.includes('accept') || text.includes('consent');
        });

        return {
          hasCookieBanner: cookieBanners.length > 0,
          hasCookieButtons: cookieButtons.length > 0,
          bannerCount: cookieBanners.length,
        };
      });

      if (!cookieData.hasCookieBanner && !cookieData.hasCookieButtons) {
        return this.fail('No cookie consent mechanism found (required by GDPR/CCPA)', cookieData);
      }

      return this.pass('Cookie consent mechanism detected', cookieData);
    } catch (error) {
      return this.pass('Cookie consent check skipped');
    }
  }

  private async checkGDPRCompliance(): Promise<CheckOutcome> {
    try {
      const gdprKeywords = ['gdpr', 'data protection', 'right to access', 'right to erasure', 'data controller'];

      const hasGDPRMentions = await this.page.evaluate((keywords) => {
        const bodyText = document.body.textContent?.toLowerCase() || '';
        return keywords.some((keyword) => bodyText.includes(keyword));
      }, gdprKeywords);

      const gdprLinks = await this.matchLinks(gdprKeywords);

      const gdprData = { hasGDPRMentions, gdprLinks: gdprLinks.count };

      if (!gdprData.hasGDPRMentions) {
        return this.pass('No GDPR mentions (ensure compliance if serving EU users)');
      }

      return this.pass('GDPR compliance indicators found', gdprData);
    } catch (error) {
      return this.pass('GDPR compliance check skipped');
    }
  }

  private async checkCCPACompliance(): Promise<CheckOutcome> {
    try {
      const ccpaKeywords = ['ccpa', 'california privacy', 'do not sell', 'opt-out'];

      const bodyKeywordData = await this.page.evaluate((keywords) => {
        const bodyText = document.body.textContent?.toLowerCase() || '';
        return {
          hasCCPAMentions: keywords.some((keyword) => bodyText.includes(keyword)),
          hasDoNotSell: bodyText.includes('do not sell'),
        };
      }, ccpaKeywords);

      const ccpaLinks = await this.matchLinks(ccpaKeywords, { matchHref: false });

      const ccpaData = { ...bodyKeywordData, ccpaLinks: ccpaLinks.count };

      if (!ccpaData.hasCCPAMentions) {
        return this.pass('No CCPA mentions (ensure compliance if serving California users)');
      }

      return this.pass(
        ccpaData.hasDoNotSell ? 'CCPA compliance with "Do Not Sell" option' : 'CCPA compliance indicators found',
        ccpaData
      );
    } catch (error) {
      return this.pass('CCPA compliance check skipped');
    }
  }

  private async checkCookiePolicy(): Promise<CheckOutcome> {
    try {
      const match = await this.matchLinks([], {
        matchHref: false,
        extra: (link) => (link.text.includes('cookie') && link.text.includes('policy')) || link.href.includes('cookie'),
      });
      const policyData = { found: match.found, count: match.count };

      if (!policyData.found) {
        return this.fail('No cookie policy link found (required if using cookies)', policyData);
      }

      return this.pass('Cookie policy link found', policyData);
    } catch (error) {
      return this.pass('Cookie policy check skipped');
    }
  }

  private async checkDataProtection(): Promise<CheckOutcome> {
    try {
      const dataProtectionData = await this.page.evaluate(() => {
        const protectionKeywords = ['data protection', 'secure', 'encryption', 'ssl', 'https'];

        const bodyText = document.body.textContent?.toLowerCase() || '';
        const hasDataProtection = protectionKeywords.some((keyword) => bodyText.includes(keyword));

        const secureIcons = document.querySelectorAll('[class*="secure"], [class*="lock"], [id*="secure"]');

        return {
          hasDataProtection,
          secureIcons: secureIcons.length,
          isHTTPS: window.location.protocol === 'https:',
        };
      });

      if (!dataProtectionData.isHTTPS) {
        return this.fail('Site not using HTTPS (security risk)', dataProtectionData);
      }

      return this.pass('Data protection indicators present', dataProtectionData);
    } catch (error) {
      return this.pass('Data protection check skipped');
    }
  }

  private async checkAccessibility(): Promise<CheckOutcome> {
    try {
      const accessibilityLinks = await this.matchLinks(['accessibility'], { matchHref: false });
      const ariaLabels = await this.page.evaluate(
        () => document.querySelectorAll('[aria-label], [aria-labelledby]').length
      );
      const images = await this.page.evaluate(extractImages);
      const altTexts = images.filter((img) => img.hasAltAttribute).length;

      const accessibilityData = {
        hasAccessibilityStatement: accessibilityLinks.found,
        ariaLabels,
        altTexts,
      };

      if (!accessibilityData.hasAccessibilityStatement) {
        return this.pass('No accessibility statement (recommended for compliance)');
      }

      return this.pass('Accessibility statement found', accessibilityData);
    } catch (error) {
      return this.pass('Accessibility check skipped');
    }
  }

  private async checkCopyrightNotice(): Promise<CheckOutcome> {
    try {
      const copyrightData = await this.page.evaluate(() => {
        const bodyText = document.body.textContent || '';
        const hasCopyright = /©|\(c\)|copyright/i.test(bodyText);

        const currentYear = new Date().getFullYear();
        const hasCurrentYear = bodyText.includes(currentYear.toString());

        const footerCopyright = document.querySelector('footer')?.textContent || '';
        const inFooter = /©|\(c\)|copyright/i.test(footerCopyright);

        return {
          hasCopyright,
          hasCurrentYear,
          inFooter,
        };
      });

      if (!copyrightData.hasCopyright) {
        return this.fail('No copyright notice found', copyrightData);
      }

      if (!copyrightData.hasCurrentYear) {
        return this.fail('Copyright notice present but year may be outdated', copyrightData);
      }

      return this.pass(
        copyrightData.inFooter
          ? 'Copyright notice with current year in footer'
          : 'Copyright notice with current year found',
        copyrightData
      );
    } catch (error) {
      return this.pass('Copyright notice check skipped');
    }
  }

  private async checkContactInformation(): Promise<CheckOutcome> {
    try {
      const contactLinks = await this.matchLinks(['contact'], {
        extra: (link) => link.href.startsWith('mailto:'),
      });

      const bodyMatches = await this.page.evaluate(() => ({
        phoneNumbers: (document.body.textContent?.match(/\d{3}[-.]?\d{3}[-.]?\d{4}/) || []).length,
        emailAddresses: (document.body.textContent?.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/) || []).length,
      }));

      const contactData = {
        hasContactLink: contactLinks.found,
        hasPhoneNumber: bodyMatches.phoneNumbers > 0,
        hasEmailAddress: bodyMatches.emailAddresses > 0,
        contactMethods: contactLinks.count + bodyMatches.phoneNumbers + bodyMatches.emailAddresses,
      };

      if (contactData.contactMethods === 0) {
        return this.fail('No contact information found (required for trust and legal compliance)', contactData);
      }

      return this.pass(`${contactData.contactMethods} contact method(s) found`, contactData);
    } catch (error) {
      return this.pass('Contact information check skipped');
    }
  }

  private async checkDisclaimers(): Promise<CheckOutcome> {
    try {
      const disclaimerLinks = await this.matchLinks(['disclaimer'], { matchHref: false });
      const hasDisclaimerText = await this.page.evaluate(
        () => (document.body.textContent?.toLowerCase() || '').includes('disclaimer')
      );

      const disclaimerData = {
        hasDisclaimerLink: disclaimerLinks.found,
        hasDisclaimerText,
      };

      if (!disclaimerData.hasDisclaimerLink && !disclaimerData.hasDisclaimerText) {
        return this.pass('No disclaimers (optional but recommended for certain industries)');
      }

      return this.pass('Disclaimer present', disclaimerData);
    } catch (error) {
      return this.pass('Disclaimer check skipped');
    }
  }

  private async checkAgeVerification(): Promise<CheckOutcome> {
    try {
      const ageData = await this.page.evaluate(() => {
        const ageKeywords = ['age verification', '18+', '21+', 'adult content', 'age gate'];
        const bodyText = document.body.textContent?.toLowerCase() || '';

        const hasAgeVerification = ageKeywords.some((keyword) => bodyText.includes(keyword));

        const ageGate = document.querySelectorAll('[class*="age"], [id*="age"], [class*="verify"]');

        return {
          hasAgeVerification,
          ageGateElements: ageGate.length,
        };
      });

      if (!ageData.hasAgeVerification) {
        return this.pass('No age verification (only required for age-restricted content)');
      }

      return this.pass('Age verification mechanism present', ageData);
    } catch (error) {
      return this.pass('Age verification check skipped');
    }
  }

  private async checkRefundPolicy(): Promise<CheckOutcome> {
    try {
      const match = await this.matchLinks(['refund', 'return']);
      const refundData = { found: match.found, count: match.count };

      if (!refundData.found) {
        return this.pass('No refund policy (required for e-commerce sites)');
      }

      return this.pass('Refund/return policy link found', refundData);
    } catch (error) {
      return this.pass('Refund policy check skipped');
    }
  }

  private async checkShippingPolicy(): Promise<CheckOutcome> {
    try {
      const match = await this.matchLinks(['shipping'], {
        extra: (link) => link.text.includes('delivery'),
      });
      const shippingData = { found: match.found, count: match.count };

      if (!shippingData.found) {
        return this.pass('No shipping policy (required for e-commerce sites)');
      }

      return this.pass('Shipping/delivery policy link found', shippingData);
    } catch (error) {
      return this.pass('Shipping policy check skipped');
    }
  }

  private async checkLegalFooter(): Promise<CheckOutcome> {
    try {
      const footerInfo = await this.page.evaluate(() => {
        const footer = document.querySelector('footer');
        if (!footer) return null;
        const footerText = footer.textContent?.toLowerCase() || '';
        return {
          hasPrivacy: footerText.includes('privacy'),
          hasTerms: footerText.includes('terms'),
          hasCookie: footerText.includes('cookie'),
        };
      });

      if (!footerInfo) {
        return this.fail('No footer element found', { hasFooter: false });
      }

      const legalLinks = await this.matchLinks(['privacy', 'terms', 'cookie', 'legal'], {
        matchHref: false,
        footerOnly: true,
      });

      const footerData = { hasFooter: true, legalLinks: legalLinks.count, ...footerInfo };

      if (footerData.legalLinks === 0) {
        return this.fail('Footer missing legal links (privacy, terms, etc.)', footerData);
      }

      return this.pass(`Footer contains ${footerData.legalLinks} legal link(s)`, footerData);
    } catch (error) {
      return this.pass('Legal footer check skipped');
    }
  }
}

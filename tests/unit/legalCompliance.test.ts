import { describe, it, expect } from 'vitest';
import { Page } from 'playwright';
import { LegalComplianceChecker } from '../../src/checkers/legalCompliance';
import { createMockPage, MockPageOptions } from '../mocks/mockPage';

function checkerFor(opts: MockPageOptions): LegalComplianceChecker {
  const page = createMockPage(opts);
  return new LegalComplianceChecker({ page: page as Page, checkerKey: 'legalCompliance' });
}

function byName(results: Awaited<ReturnType<LegalComplianceChecker['checkAll']>>, name: string) {
  const r = results.find((x) => x.name === name);
  if (!r) throw new Error(`no result named ${name}`);
  return r;
}

const currentYear = new Date().getFullYear();

describe('LegalComplianceChecker', () => {
  it('fails privacy/terms/cookie-consent/data-protection/cookie-policy/contact/footer on a bare HTTP page', async () => {
    const results = await checkerFor({ url: 'http://example.com', html: '<p>bare page</p>' }).checkAll();
    expect(results).toHaveLength(15);
    expect(byName(results, 'privacy-policy-linked').passed).toBe(false);
    expect(byName(results, 'terms-of-service-linked').passed).toBe(false);
    expect(byName(results, 'cookie-consent-present').passed).toBe(false);
    expect(byName(results, 'data-protection-https').passed).toBe(false);
    expect(byName(results, 'cookie-policy-linked').passed).toBe(false);
    expect(byName(results, 'contact-information-present').passed).toBe(false);
    expect(byName(results, 'legal-footer-links-present').passed).toBe(false);
    expect(byName(results, 'legal-footer-links-present').message).toMatch(/no footer/i);
    expect(byName(results, 'copyright-notice-current').passed).toBe(false);
  });

  it('passes privacy/terms/cookie/data-protection when a full legal footer is present', async () => {
    const results = await checkerFor({
      url: 'https://example.com',
      html:
        `<footer>` +
        `<a href="/privacy">Privacy Policy</a> ` +
        `<a href="/terms">Terms and Conditions</a> ` +
        `<a href="/cookie-policy">Cookie Policy</a> ` +
        `© ${currentYear} Acme` +
        `</footer>` +
        `<div class="cookie-banner">We use cookies <button>Accept</button></div>`,
    }).checkAll();
    expect(byName(results, 'privacy-policy-linked').message).toMatch(/footer/i);
    expect(byName(results, 'terms-of-service-linked').passed).toBe(true);
    expect(byName(results, 'cookie-consent-present').passed).toBe(true);
    expect(byName(results, 'cookie-policy-linked').passed).toBe(true);
    expect(byName(results, 'data-protection-https').passed).toBe(true);
    expect(byName(results, 'copyright-notice-current').passed).toBe(true);
    expect(byName(results, 'copyright-notice-current').message).toMatch(/footer/i);
    expect(byName(results, 'legal-footer-links-present').passed).toBe(true);
  });

  it('reports an outdated copyright year', async () => {
    const results = await checkerFor({ html: '<p>© 2010 Acme Corp</p>' }).checkAll();
    expect(byName(results, 'copyright-notice-current').passed).toBe(false);
    expect(byName(results, 'copyright-notice-current').message).toMatch(/outdated/i);
  });

  it('detects GDPR/CCPA mentions and the CCPA "Do Not Sell" variant', async () => {
    const none = await checkerFor({ html: '<p>plain</p>' }).checkAll();
    expect(byName(none, 'gdpr-compliance-indicated').message).toMatch(/no gdpr/i);
    expect(byName(none, 'ccpa-compliance-indicated').message).toMatch(/no ccpa/i);

    const gdpr = await checkerFor({ html: '<p>See our GDPR data protection notice</p>' }).checkAll();
    expect(byName(gdpr, 'gdpr-compliance-indicated').message).toMatch(/gdpr compliance indicators found/i);

    const ccpa = await checkerFor({ html: '<p>California residents may exercise their right: Do Not Sell my info</p>' }).checkAll();
    expect(byName(ccpa, 'ccpa-compliance-indicated').message).toMatch(/do not sell/i);
  });

  it('detects an accessibility statement link and contact info via mailto/phone/email', async () => {
    const accessibility = await checkerFor({ html: '<a href="/x">Accessibility Statement</a>' }).checkAll();
    expect(byName(accessibility, 'accessibility-statement-present').message).toMatch(/found/i);

    const contact = await checkerFor({ html: '<a href="mailto:hi@example.com">Email us</a>' }).checkAll();
    expect(byName(contact, 'contact-information-present').passed).toBe(true);
  });

  it('detects disclaimers, age verification, refund/shipping policy links', async () => {
    const results = await checkerFor({
      html:
        '<p>Disclaimer: for informational purposes only.</p>' +
        '<p>This site requires age verification (18+)</p>' +
        '<a href="/refund">Refund Policy</a>' +
        '<a href="/x">Delivery information</a>',
    }).checkAll();
    expect(byName(results, 'disclaimers-present').passed).toBe(true);
    expect(byName(results, 'age-verification-present').passed).toBe(true);
    expect(byName(results, 'refund-policy-linked').passed).toBe(true);
    expect(byName(results, 'shipping-policy-linked').passed).toBe(true);
  });
});

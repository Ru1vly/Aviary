# Your first Aviary audit

Use this guide to audit a page, review a finding, and check your fix. You need Node.js 20 or newer and a website you can inspect. A repository checkout is not required.

## Create a report

Replace the URL with a representative page from your website:

```sh
npx @ru1vly/aviary -u https://example.com/ --output report.json --html report.html
```

The first browser audit may download Chromium. If installation or navigation fails, follow the [troubleshooting guide](TROUBLESHOOTING.md).

Open `report.html` in your browser. JSON stores the audit results for later analysis; HTML provides a readable dashboard. Start with one page before scanning a whole site.

## Review and fix one finding

1. Read a failed check's name and details, then inspect the affected page and its rendered markup.
2. Decide whether the finding conflicts with the page's intended behavior. For example, an unintended `noindex` directive on a public landing page needs review; the same directive may be appropriate on a private utility page.
3. Make the relevant template, content, or crawler-policy change and deploy it to the URL you are auditing.
4. Audit the same URL again, saving separate files:

```sh
npx @ru1vly/aviary -u https://example.com/ --output after.json --html after.html
```

Compare the relevant check details in both reports. A passing check confirms only what that check measures. It does not establish that a search engine indexed the page or that an AI answer will cite it. See [accuracy and limitations](ACCURACY_LIMITATIONS.md).

To render a saved result without another audit:

```sh
npx @ru1vly/aviary --render report.json --html saved-report.html
```

## Check AI crawler controls

Use the GEO preset for crawler controls and observed page signals:

```sh
npx @ru1vly/aviary -u https://example.com/ --preset geo --output geo.json --html geo.html
```

Review access rules against your intended policy before changing them. AI-answer citation analysis requires observations you supply; Aviary does not query proprietary answer engines for you. See the [GEO guide](GEO.md).

## Expand to a site

Start with a bounded sitemap scan:

```sh
npx @ru1vly/aviary --sitemap https://example.com/sitemap.xml --max-urls 20 --output site.json --html site.html
```

Include important templates and landing pages. Check the scan's completed scope before treating it as a sitewide result. See [crawling](CRAWLING.md) for discovery limits and [best practices](BEST_PRACTICES.md) for repeatable audits.

## Run in GitHub Actions

The [scheduled audit workflow](../examples/github-actions-audit.yml) creates reports, preserves a successful baseline, and checks subsequent runs for regressions.

1. Copy the workflow into `.github/workflows/aviary-audit.yml` in your repository.
2. Create a repository Actions secret named `AVIARY_TARGET_URL` containing the page URL to audit. The GitHub runner must be able to reach it.
3. Run **Weekly SEO audit** from the Actions tab using **Run workflow**.
4. Download the `aviary-seo-report` artifact and open `aviary.html`.

The first successful audit establishes a baseline. Later runs fail on score drops or new failed checks compared with that baseline. Existing findings still need review; a successful job does not mean the site has no issues. The workflow also runs every Monday and audits the configured URL, not a locally built preview. It builds Aviary from its `main` branch; pin the clone to a reviewed release tag or commit when you need a fixed tool version.

For a strict check that fails on any failed checker result:

```sh
npx @ru1vly/aviary -u https://example.com/ --fail-on-findings --output ci.json --html ci.html
```

Choose a gate after reviewing the initial findings. See [practical use cases](../examples/USE_CASES.md#gate-changes-in-ci) for baseline commands and [the CLI reference](CLI.md) for other gates.

## Share feedback or contribute

Tell us whether you completed an audit, which finding was useful, and what made you hesitate or stop. Use [workflow feedback](https://github.com/Ru1vly/Aviary/issues/new?template=workflow_feedback.md) or [report a bug](https://github.com/Ru1vly/Aviary/issues/new?template=bug_report.md) with a sanitized reproduction.

Default local audits do not upload reports or usage analytics to the maintainers, so feedback is how we learn about your experience. See [privacy](PRIVACY.md) and [contributing](CONTRIBUTING.md).

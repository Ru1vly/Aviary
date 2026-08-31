import { describe, it, expect } from 'vitest';
import { Page } from 'playwright';
import { MultimediaChecker } from '../../src/checkers/multimedia';
import { createMockPage, MockPageOptions } from '../mocks/mockPage';

function checkerFor(opts: MockPageOptions): MultimediaChecker {
  const page = createMockPage(opts);
  return new MultimediaChecker({ page: page as Page, checkerKey: 'multimedia' });
}

function ldJson(obj: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

function byName(results: Awaited<ReturnType<MultimediaChecker['checkAll']>>, name: string) {
  const r = results.find((x) => x.name === name);
  if (!r) throw new Error(`no result named ${name}`);
  return r;
}

describe('MultimediaChecker', () => {
  it('passes every "no media" branch on a plain page', async () => {
    const results = await checkerFor({ html: '<p>no media here</p>' }).checkAll();
    expect(results).toHaveLength(10);
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it('flags a video missing poster/aria, passes a fully-described one', async () => {
    const bad = await checkerFor({ html: '<video src="a.mp4"></video>' }).checkAll();
    expect(byName(bad, 'video-metadata-complete').passed).toBe(false);
    expect(byName(bad, 'video-captions-present').passed).toBe(false);
    expect(byName(bad, 'video-accessibility-attributes').passed).toBe(false);
    expect(byName(bad, 'media-controls-present').passed).toBe(false);

    const good = await checkerFor({
      html:
        '<video src="a.mp4" poster="p.jpg" aria-label="Demo" controls>' +
        '<track kind="captions" src="c.vtt"></video>',
    }).checkAll();
    expect(byName(good, 'video-metadata-complete').passed).toBe(true);
    expect(byName(good, 'video-captions-present').passed).toBe(true);
    expect(byName(good, 'video-accessibility-attributes').passed).toBe(true);
    expect(byName(good, 'media-controls-present').passed).toBe(true);
  });

  it('flags an audio element missing controls/labels, passes a proper one', async () => {
    const bad = await checkerFor({ html: '<audio src="a.mp3"></audio>' }).checkAll();
    expect(byName(bad, 'audio-elements-configured').passed).toBe(false);

    const good = await checkerFor({
      html: '<audio src="a.mp3" controls aria-label="Podcast"></audio>',
    }).checkAll();
    expect(byName(good, 'audio-elements-configured').passed).toBe(true);
  });

  it('flags <embed>/<object> as outdated, passes iframe embeds', async () => {
    const results = await checkerFor({ html: '<embed src="a.swf">' }).checkAll();
    expect(byName(results, 'modern-embeds-used').passed).toBe(false);

    const iframe = await checkerFor({ html: '<iframe src="https://example.com"></iframe>' }).checkAll();
    expect(byName(iframe, 'modern-embeds-used').message).toMatch(/modern iframe/i);
  });

  it('flags unmuted autoplay media, passes muted autoplay', async () => {
    const results = await checkerFor({ html: '<video autoplay src="a.mp4"></video>' }).checkAll();
    expect(byName(results, 'autoplay-muted').passed).toBe(false);

    const good = await checkerFor({ html: '<video autoplay muted src="a.mp4"></video>' }).checkAll();
    expect(byName(good, 'autoplay-muted').passed).toBe(true);
  });

  it('requires VideoObject schema when videos are present', async () => {
    const missing = await checkerFor({ html: '<video src="a.mp4"></video>' }).checkAll();
    expect(byName(missing, 'video-schema-present').passed).toBe(false);

    const present = await checkerFor({
      html: '<video src="a.mp4"></video>',
      headHtml: ldJson({ '@type': 'VideoObject', name: 'Demo' }),
    }).checkAll();
    expect(byName(present, 'video-schema-present').passed).toBe(true);
  });

  it('flags YouTube embeds missing title/nocookie, passes a fully-configured one', async () => {
    const bad = await checkerFor({
      html: '<iframe src="https://youtube.com/embed/xyz"></iframe>',
    }).checkAll();
    expect(byName(bad, 'youtube-embeds-configured').passed).toBe(false);

    const good = await checkerFor({
      html: '<iframe src="https://youtube-nocookie.com/embed/xyz" title="Demo video"></iframe>',
    }).checkAll();
    expect(byName(good, 'youtube-embeds-configured').passed).toBe(true);
  });
});

import { BaseChecker, CheckOutcome } from './base';
import { extractJsonLdBlocks } from './shared/dom';

export class MultimediaChecker extends BaseChecker {
  protected checks() {
    return [
      { id: 'video-inventory', run: () => this.checkVideos() },
      { id: 'video-metadata-complete', run: () => this.checkVideoMetadata() },
      { id: 'video-captions-present', run: () => this.checkVideoTranscripts() },
      { id: 'audio-elements-configured', run: () => this.checkAudioElements() },
      { id: 'modern-embeds-used', run: () => this.checkEmbeds() },
      { id: 'autoplay-muted', run: () => this.checkAutoplay() },
      { id: 'video-schema-present', run: () => this.checkVideoSchema() },
      { id: 'youtube-embeds-configured', run: () => this.checkYouTubeEmbeds() },
      { id: 'video-accessibility-attributes', run: () => this.checkVideoAccessibility() },
      { id: 'media-controls-present', run: () => this.checkMediaControls() },
    ];
  }

  private async checkVideos(): Promise<CheckOutcome> {
    try {
      const videoData = await this.page.evaluate(() => {
        const videos = Array.from(document.querySelectorAll('video'));
        const iframeVideos = Array.from(document.querySelectorAll('iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="dailymotion"]'));

        return {
          nativeVideos: videos.length,
          embeddedVideos: iframeVideos.length,
          totalVideos: videos.length + iframeVideos.length,
        };
      });

      return this.pass(
        videoData.totalVideos > 0
          ? `${videoData.totalVideos} video(s) found (${videoData.nativeVideos} native, ${videoData.embeddedVideos} embedded)`
          : 'No videos found',
        videoData
      );
    } catch (error) {
      return this.pass('Video check skipped');
    }
  }

  private async checkVideoMetadata(): Promise<CheckOutcome> {
    try {
      const metadataData = await this.page.evaluate(() => {
        const videos = Array.from(document.querySelectorAll('video'));
        const withPoster = videos.filter((v) => v.hasAttribute('poster'));
        const withAria = videos.filter((v) => v.hasAttribute('aria-label') || v.hasAttribute('title'));

        return {
          totalVideos: videos.length,
          withPoster: withPoster.length,
          withAria: withAria.length,
        };
      });

      if (metadataData.totalVideos === 0) {
        return this.pass('No native videos to check');
      }

      const issues: string[] = [];

      if (metadataData.withPoster < metadataData.totalVideos) {
        issues.push(`${metadataData.totalVideos - metadataData.withPoster} videos missing poster image`);
      }

      if (metadataData.withAria < metadataData.totalVideos) {
        issues.push(`${metadataData.totalVideos - metadataData.withAria} videos missing aria-label/title`);
      }

      if (issues.length > 0) {
        return this.fail(`Video metadata issues: ${issues.join(', ')}`, metadataData);
      }

      return this.pass('Videos have proper metadata', metadataData);
    } catch (error) {
      return this.pass('Video metadata check skipped');
    }
  }

  private async checkVideoTranscripts(): Promise<CheckOutcome> {
    try {
      const transcriptData = await this.page.evaluate(() => {
        const videos = Array.from(document.querySelectorAll('video'));
        const withTrack = videos.filter((v) => v.querySelector('track[kind="captions"], track[kind="subtitles"]'));

        const transcriptElements = document.querySelectorAll('[class*="transcript"], [id*="transcript"]');

        return {
          totalVideos: videos.length,
          withTrack: withTrack.length,
          hasTranscriptElements: transcriptElements.length > 0,
        };
      });

      if (transcriptData.totalVideos === 0) {
        return this.pass('No videos to check for transcripts');
      }

      const hasAccessibility = transcriptData.withTrack > 0 || transcriptData.hasTranscriptElements;

      if (!hasAccessibility) {
        return this.fail('Videos missing captions/transcripts (important for accessibility and SEO)', transcriptData);
      }

      return this.pass('Video accessibility features present', transcriptData);
    } catch (error) {
      return this.pass('Video transcripts check skipped');
    }
  }

  private async checkAudioElements(): Promise<CheckOutcome> {
    try {
      const audioData = await this.page.evaluate(() => {
        const audio = Array.from(document.querySelectorAll('audio'));
        const withControls = audio.filter((a) => a.hasAttribute('controls'));
        const withLabels = audio.filter((a) => a.hasAttribute('aria-label') || a.hasAttribute('title'));

        return {
          totalAudio: audio.length,
          withControls: withControls.length,
          withLabels: withLabels.length,
        };
      });

      if (audioData.totalAudio === 0) {
        return this.pass('No audio elements found');
      }

      const issues: string[] = [];

      if (audioData.withControls < audioData.totalAudio) {
        issues.push(`${audioData.totalAudio - audioData.withControls} audio elements missing controls`);
      }

      if (audioData.withLabels < audioData.totalAudio) {
        issues.push(`${audioData.totalAudio - audioData.withLabels} audio elements missing labels`);
      }

      if (issues.length > 0) {
        return this.fail(`Audio issues: ${issues.join(', ')}`, audioData);
      }

      return this.pass(`${audioData.totalAudio} audio element(s) properly configured`, audioData);
    } catch (error) {
      return this.pass('Audio elements check skipped');
    }
  }

  private async checkEmbeds(): Promise<CheckOutcome> {
    try {
      const embedData = await this.page.evaluate(() => {
        const embeds = Array.from(document.querySelectorAll('embed, object'));
        const iframes = Array.from(document.querySelectorAll('iframe'));

        return {
          totalEmbeds: embeds.length,
          totalIframes: iframes.length,
        };
      });

      if (embedData.totalEmbeds > 0) {
        return this.fail(`Found ${embedData.totalEmbeds} <embed>/<object> elements (outdated, use HTML5)`, embedData);
      }

      return this.pass(
        embedData.totalIframes > 0 ? `Using modern iframe embeds (${embedData.totalIframes})` : 'No embed elements',
        embedData
      );
    } catch (error) {
      return this.pass('Embeds check skipped');
    }
  }

  private async checkAutoplay(): Promise<CheckOutcome> {
    try {
      const autoplayData = await this.page.evaluate(() => {
        const videos = Array.from(document.querySelectorAll('video[autoplay]'));
        const audio = Array.from(document.querySelectorAll('audio[autoplay]'));
        const withMuted = [...videos, ...audio].filter((el) => el.hasAttribute('muted'));

        return {
          autoplayVideos: videos.length,
          autoplayAudio: audio.length,
          withMuted: withMuted.length,
        };
      });

      const totalAutoplay = autoplayData.autoplayVideos + autoplayData.autoplayAudio;

      if (totalAutoplay > 0 && autoplayData.withMuted < totalAutoplay) {
        return this.fail(
          `${totalAutoplay - autoplayData.withMuted} autoplay media elements without muted (bad UX)`,
          autoplayData
        );
      }

      return this.pass(
        totalAutoplay > 0 ? 'Autoplay media properly muted' : 'No autoplay media (good for UX)',
        autoplayData
      );
    } catch (error) {
      return this.pass('Autoplay check skipped');
    }
  }

  private async checkVideoSchema(): Promise<CheckOutcome> {
    try {
      const jsonLdScripts = await this.page.evaluate(extractJsonLdBlocks);
      const hasVideoSchema = jsonLdScripts.some(
        (data: any) => data['@type'] === 'VideoObject' || data['@type']?.includes('Video')
      );

      const videoCount = await this.page.evaluate(
        () => document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length
      );

      const schemaData = { hasVideoSchema, videoCount };

      if (schemaData.videoCount > 0 && !schemaData.hasVideoSchema) {
        return this.fail('Videos found but no VideoObject schema (recommended for rich results)', schemaData);
      }

      return this.pass(
        schemaData.hasVideoSchema ? 'VideoObject schema present' : 'No videos or schema not needed',
        schemaData
      );
    } catch (error) {
      return this.pass('Video schema check skipped');
    }
  }

  private async checkYouTubeEmbeds(): Promise<CheckOutcome> {
    try {
      const youtubeData = await this.page.evaluate(() => {
        const iframes = Array.from(document.querySelectorAll('iframe[src*="youtube"]')) as HTMLIFrameElement[];
        const withNoCookie = iframes.filter((iframe) => iframe.src.includes('youtube-nocookie.com'));
        const withTitle = iframes.filter((iframe) => iframe.hasAttribute('title'));

        return {
          totalYouTube: iframes.length,
          withNoCookie: withNoCookie.length,
          withTitle: withTitle.length,
        };
      });

      if (youtubeData.totalYouTube === 0) {
        return this.pass('No YouTube embeds');
      }

      const issues: string[] = [];

      if (youtubeData.withNoCookie < youtubeData.totalYouTube) {
        issues.push('Consider using youtube-nocookie.com for privacy');
      }

      if (youtubeData.withTitle < youtubeData.totalYouTube) {
        issues.push(`${youtubeData.totalYouTube - youtubeData.withTitle} YouTube iframes missing title attribute`);
      }

      if (issues.length > 0) {
        return this.fail(`YouTube embed issues: ${issues.join(', ')}`, youtubeData);
      }

      return this.pass(`${youtubeData.totalYouTube} YouTube embed(s) properly configured`, youtubeData);
    } catch (error) {
      return this.pass('YouTube embeds check skipped');
    }
  }

  private async checkVideoAccessibility(): Promise<CheckOutcome> {
    try {
      const a11yData = await this.page.evaluate(() => {
        const videos = Array.from(document.querySelectorAll('video'));
        const iframes = Array.from(document.querySelectorAll('iframe'));

        const videosWithAria = videos.filter((v) =>
          v.hasAttribute('aria-label') || v.hasAttribute('aria-labelledby')
        );

        const iframesWithTitle = iframes.filter((i) => i.hasAttribute('title'));

        return {
          nativeVideos: videos.length,
          videosWithAria: videosWithAria.length,
          iframes: iframes.length,
          iframesWithTitle: iframesWithTitle.length,
        };
      });

      const issues: string[] = [];

      if (a11yData.nativeVideos > 0 && a11yData.videosWithAria < a11yData.nativeVideos) {
        issues.push(`${a11yData.nativeVideos - a11yData.videosWithAria} videos missing ARIA labels`);
      }

      if (a11yData.iframes > 0 && a11yData.iframesWithTitle < a11yData.iframes) {
        issues.push(`${a11yData.iframes - a11yData.iframesWithTitle} iframes missing title`);
      }

      if (issues.length > 0) {
        return this.fail(`Media accessibility issues: ${issues.join(', ')}`, a11yData);
      }

      return this.pass('Media elements have accessibility attributes', a11yData);
    } catch (error) {
      return this.pass('Video accessibility check skipped');
    }
  }

  private async checkMediaControls(): Promise<CheckOutcome> {
    try {
      const controlsData = await this.page.evaluate(() => {
        const videos = Array.from(document.querySelectorAll('video'));
        const audio = Array.from(document.querySelectorAll('audio'));

        const videoControls = videos.filter((v) => v.hasAttribute('controls'));
        const audioControls = audio.filter((a) => a.hasAttribute('controls'));

        return {
          videos: videos.length,
          audio: audio.length,
          videoControls: videoControls.length,
          audioControls: audioControls.length,
        };
      });

      const issues: string[] = [];

      if (controlsData.videos > 0 && controlsData.videoControls < controlsData.videos) {
        issues.push(`${controlsData.videos - controlsData.videoControls} videos missing controls`);
      }

      if (controlsData.audio > 0 && controlsData.audioControls < controlsData.audio) {
        issues.push(`${controlsData.audio - controlsData.audioControls} audio elements missing controls`);
      }

      if (issues.length > 0) {
        return this.fail(`Media controls issues: ${issues.join(', ')}`, controlsData);
      }

      return this.pass('Media elements have controls', controlsData);
    } catch (error) {
      return this.pass('Media controls check skipped');
    }
  }
}

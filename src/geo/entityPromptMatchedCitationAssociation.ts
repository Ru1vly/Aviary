import { createHash } from 'node:crypto';
import type { AiAnswerCitationObservationInput } from './answerCitationObservations';

const MAX_ENTITIES = 100;
const MAX_ENTITY_PROMPT_ROWS = 1_000_000;
const MAX_OUTPUT_ROWS = 50_000;
const MAX_BOOTSTRAP_DRAWS = 50_000_000;
const MAX_SIGN_TEST_TERMS = 5_000_000;
const BOOTSTRAP_ITERATIONS = 1_000;
const MIN_BOOTSTRAP_ITERATIONS = 250;
const MAX_CITATIONS_PER_OBSERVATION = 50;

type CitationMetric =
  'owned-citation-reach' | 'owned-top-three-reach' | 'owned-first-position-reach';
type NormalizedPromptKey = string & { readonly __normalizedPromptKey: unique symbol };
const CITATION_METRICS = [
  'owned-citation-reach',
  'owned-top-three-reach',
  'owned-first-position-reach',
] as const satisfies readonly CitationMetric[];

interface EntityDefinition {
  entity: string;
  aliases: string[];
  matcher: RegExp;
}

interface OutcomeCounts {
  completeSnapshots: number;
  incompleteSnapshots: number;
  ownedCitationSnapshots: number;
  ownedTopThreeSnapshots: number;
  ownedFirstPositionSnapshots: number;
}

interface EntityPromptBucket {
  entity: EntityDefinition;
  provider: string;
  promptKey: NormalizedPromptKey;
  monthUtc: string;
  contextKey: string;
  model: string;
  surface: string;
  locale: string;
  topic: string;
  intent: string;
  mentioned: OutcomeCounts;
  notMentioned: OutcomeCounts;
}

interface PromptDifference {
  entity: string;
  provider: string;
  promptKey: NormalizedPromptKey;
  mentioned: OutcomeCounts;
  notMentioned: OutcomeCounts;
  deltas: Record<CitationMetric, number>;
  equalPromptRates: {
    mentioned: Record<CitationMetric, number>;
    notMentioned: Record<CitationMetric, number>;
  };
  matchedStrata: number;
}

interface SummaryMetrics {
  mentionedSnapshotWeightedPercent: number | null;
  notMentionedSnapshotWeightedPercent: number | null;
  snapshotWeightedDifferencePercentagePoints: number | null;
  equalPromptMentionedPercent: number | null;
  equalPromptNotMentionedPercent: number | null;
  equalPromptDifferencePercentagePoints: number | null;
  equalPromptDifferenceLower95PercentagePoints: number | null;
  equalPromptDifferenceUpper95PercentagePoints: number | null;
}

interface SignTestSummary {
  positivePromptGroups: number;
  negativePromptGroups: number;
  tiedPromptGroups: number;
  twoSidedPValue: number | null;
  holmAdjustedPValue: number | null;
}

function normalizedLabel(value: string): string {
  return value.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US');
}

function normalizedPromptKey(value: string): NormalizedPromptKey {
  return normalizedLabel(value) as NormalizedPromptKey;
}

function csvCell(value: unknown): string {
  if (value === undefined || value === null) return '';
  const rendered = typeof value === 'boolean' ? String(value) : String(value);
  return /[",\r\n]/u.test(rendered) ? `"${rendered.replace(/"/gu, '""')}"` : rendered;
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function normalizeEntities(inputs: string[]): EntityDefinition[] {
  if (inputs.length === 0)
    throw new Error(
      'Matched entity citation analysis requires at least one configured answer entity.'
    );
  if (inputs.length > MAX_ENTITIES)
    throw new Error(`Configure no more than ${MAX_ENTITIES} answer entities.`);
  const names = new Set<string>();
  const aliasOwners = new Map<string, string>();
  return inputs.map((input, index) => {
    const separator = input.indexOf('=');
    const entity = (separator < 0 ? input : input.slice(0, separator)).replace(/\s+/gu, ' ').trim();
    if (!entity || entity.length > 100)
      throw new Error(`Answer entity ${index + 1} must be 1–100 characters.`);
    const entityKey = normalizedLabel(entity);
    if (names.has(entityKey))
      throw new Error(`Answer entity "${entity}" is configured more than once.`);
    names.add(entityKey);
    const aliases = [
      ...new Set([
        entity,
        ...(separator < 0
          ? []
          : input
              .slice(separator + 1)
              .split('|')
              .map((alias) => alias.replace(/\s+/gu, ' ').trim())),
      ]),
    ];
    if (aliases.some((alias) => !alias || alias.length > 100))
      throw new Error(`Aliases for answer entity "${entity}" must be 1–100 characters.`);
    if (aliases.length > 21)
      throw new Error(`Answer entity "${entity}" may have no more than 20 aliases.`);
    for (const alias of aliases) {
      const aliasKey = normalizedLabel(alias);
      const owner = aliasOwners.get(aliasKey);
      if (owner && owner !== entityKey)
        throw new Error(`Answer alias "${alias}" is assigned to multiple entities.`);
      aliasOwners.set(aliasKey, entityKey);
    }
    const patterns = [...aliases]
      .sort((left, right) => right.length - left.length || left.localeCompare(right))
      .map((alias) =>
        alias
          .trim()
          .split(/\s+/u)
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('\\s+')
      );
    return {
      entity,
      aliases,
      matcher: new RegExp(
        `(?:^|[^\\p{L}\\p{N}])(?:${patterns.join('|')})(?=$|[^\\p{L}\\p{N}])`,
        'giu'
      ),
    };
  });
}

function normalizeOwnedDomains(values: string[]): string[] {
  if (values.length === 0)
    throw new Error(
      'Matched entity citation analysis requires at least one --geo-answer-owned-domain.'
    );
  return [
    ...new Set(
      values.map((value) => {
        const candidate = value.trim().replace(/^\.+|\.+$/gu, '');
        if (!candidate || /[\s/@?#]/u.test(candidate))
          throw new Error(`Invalid owned domain "${value}"; use a hostname without a URL path.`);
        let url: URL;
        try {
          url = new URL(`https://${candidate}`);
        } catch {
          throw new Error(`Invalid owned domain "${value}"; use a hostname such as example.com.`);
        }
        if (
          url.username ||
          url.password ||
          url.pathname !== '/' ||
          url.search ||
          url.hash ||
          url.hostname.includes('%')
        ) {
          throw new Error(`Invalid owned domain "${value}"; use a hostname such as example.com.`);
        }
        return url.hostname.toLowerCase().replace(/\.$/u, '');
      })
    ),
  ];
}

function isOwnedUrl(value: string, domains: string[]): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Cited URLs must be absolute HTTP(S) URLs.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    !url.hostname
  ) {
    throw new Error('Cited URLs must be credential-free HTTP(S) URLs.');
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/u, '');
  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function addOutcome(
  target: OutcomeCounts,
  observation: AiAnswerCitationObservationInput,
  ownedDomains: string[]
): void {
  const seen = new Set<string>();
  const citations = observation.citedUrls
    .map((value, index) => {
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        throw new Error('Cited URLs must be absolute HTTP(S) URLs.');
      }
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        !url.hostname
      ) {
        throw new Error('Cited URLs must be credential-free HTTP(S) URLs.');
      }
      url.hostname = url.hostname.toLowerCase().replace(/\.$/u, '');
      url.search = '';
      url.hash = '';
      const identity = url.href;
      if (seen.has(identity)) return undefined;
      seen.add(identity);
      return {
        owned: isOwnedUrl(identity, ownedDomains),
        first: index === 0,
        topThree: index < 3,
      };
    })
    .filter(
      (citation): citation is { owned: boolean; first: boolean; topThree: boolean } =>
        citation !== undefined
    );
  const complete =
    observation.citationListComplete ??
    observation.citedUrls.length < MAX_CITATIONS_PER_OBSERVATION;
  if (!complete) {
    target.incompleteSnapshots += 1;
    return;
  }
  target.completeSnapshots += 1;
  let owned = false;
  let ownedTopThree = false;
  let ownedFirst = false;
  citations.forEach((citation) => {
    if (!citation.owned) return;
    owned = true;
    ownedTopThree ||= citation.topThree;
    ownedFirst ||= citation.first;
  });
  if (owned) target.ownedCitationSnapshots += 1;
  if (ownedTopThree) target.ownedTopThreeSnapshots += 1;
  if (ownedFirst) target.ownedFirstPositionSnapshots += 1;
}

function rate(counts: OutcomeCounts, metric: CitationMetric): number | null {
  if (counts.completeSnapshots === 0) return null;
  const numerator =
    metric === 'owned-citation-reach'
      ? counts.ownedCitationSnapshots
      : metric === 'owned-top-three-reach'
        ? counts.ownedTopThreeSnapshots
        : counts.ownedFirstPositionSnapshots;
  return numerator / counts.completeSnapshots;
}

function numerator(counts: OutcomeCounts, metric: CitationMetric): number {
  return metric === 'owned-citation-reach'
    ? counts.ownedCitationSnapshots
    : metric === 'owned-top-three-reach'
      ? counts.ownedTopThreeSnapshots
      : counts.ownedFirstPositionSnapshots;
}

function makeSeed(text: string): number {
  return createHash('sha256').update(text).digest().readUInt32BE(0);
}

function createRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function quantile(sortedValues: number[], probability: number): number | null {
  if (sortedValues.length === 0) return null;
  return (
    sortedValues[
      Math.min(
        sortedValues.length - 1,
        Math.max(0, Math.ceil(probability * sortedValues.length) - 1)
      )
    ] ?? null
  );
}

function exactTwoSidedSignTestPValue(positive: number, negative: number): number | null {
  const discordant = positive + negative;
  if (discordant < 2) return null;
  const lowerTail = Math.min(positive, negative);
  let logProbability = -discordant * Math.LN2;
  let logCumulativeProbability = Number.NEGATIVE_INFINITY;
  for (let successes = 0; successes <= lowerTail; successes += 1) {
    const maximum = Math.max(logCumulativeProbability, logProbability);
    logCumulativeProbability =
      maximum +
      Math.log(Math.exp(logCumulativeProbability - maximum) + Math.exp(logProbability - maximum));
    if (successes < lowerTail)
      logProbability += Math.log(discordant - successes) - Math.log(successes + 1);
  }
  return Math.min(1, 2 * Math.exp(logCumulativeProbability));
}

function bootstrapIntervals(
  rows: PromptDifference[],
  iterations: number
): Map<string, Record<CitationMetric, [number | null, number | null]>> {
  const grouped = new Map<string, PromptDifference[]>();
  for (const row of rows) {
    const key = JSON.stringify([row.entity, row.provider]);
    const items = grouped.get(key) ?? [];
    items.push(row);
    grouped.set(key, items);
  }
  const result = new Map<string, Record<CitationMetric, [number | null, number | null]>>();
  for (const [key, items] of grouped) {
    const intervals = {} as Record<CitationMetric, [number | null, number | null]>;
    for (const metric of CITATION_METRICS) {
      if (items.length < 2 || iterations < MIN_BOOTSTRAP_ITERATIONS) {
        intervals[metric] = [null, null];
        continue;
      }
      const random = createRandom(makeSeed(`${key}:${metric}`));
      const draws = new Array<number>(iterations);
      for (let iteration = 0; iteration < iterations; iteration += 1) {
        let total = 0;
        for (let draw = 0; draw < items.length; draw += 1) {
          const selected = items[Math.floor(random() * items.length)]!;
          total += selected.deltas[metric];
        }
        draws[iteration] = (total / items.length) * 100;
      }
      draws.sort((left, right) => left - right);
      intervals[metric] = [quantile(draws, 0.025), quantile(draws, 0.975)];
    }
    result.set(key, intervals);
  }
  return result;
}

function summaryMetrics(
  rows: PromptDifference[],
  metric: CitationMetric,
  intervals?: [number | null, number | null]
): SummaryMetrics {
  if (rows.length === 0)
    return {
      mentionedSnapshotWeightedPercent: null,
      notMentionedSnapshotWeightedPercent: null,
      snapshotWeightedDifferencePercentagePoints: null,
      equalPromptMentionedPercent: null,
      equalPromptNotMentionedPercent: null,
      equalPromptDifferencePercentagePoints: null,
      equalPromptDifferenceLower95PercentagePoints: null,
      equalPromptDifferenceUpper95PercentagePoints: null,
    };
  const mentionedSnapshots = rows.reduce((sum, row) => sum + row.mentioned.completeSnapshots, 0);
  const notMentionedSnapshots = rows.reduce(
    (sum, row) => sum + row.notMentioned.completeSnapshots,
    0
  );
  const mentionedCount = rows.reduce((sum, row) => sum + numerator(row.mentioned, metric), 0);
  const notMentionedCount = rows.reduce((sum, row) => sum + numerator(row.notMentioned, metric), 0);
  const equalPromptMentioned =
    rows.reduce((sum, row) => sum + row.equalPromptRates.mentioned[metric], 0) / rows.length;
  const equalPromptNotMentioned =
    rows.reduce((sum, row) => sum + row.equalPromptRates.notMentioned[metric], 0) / rows.length;
  const equalPromptDelta = rows.reduce((sum, row) => sum + row.deltas[metric], 0) / rows.length;
  return {
    mentionedSnapshotWeightedPercent:
      mentionedSnapshots > 0 ? round((mentionedCount / mentionedSnapshots) * 100) : null,
    notMentionedSnapshotWeightedPercent:
      notMentionedSnapshots > 0 ? round((notMentionedCount / notMentionedSnapshots) * 100) : null,
    snapshotWeightedDifferencePercentagePoints:
      mentionedSnapshots > 0 && notMentionedSnapshots > 0
        ? round(
            (mentionedCount / mentionedSnapshots - notMentionedCount / notMentionedSnapshots) * 100
          )
        : null,
    equalPromptMentionedPercent: round(equalPromptMentioned * 100),
    equalPromptNotMentionedPercent: round(equalPromptNotMentioned * 100),
    equalPromptDifferencePercentagePoints: round(equalPromptDelta * 100),
    equalPromptDifferenceLower95PercentagePoints:
      intervals?.[0] === null || intervals?.[0] === undefined ? null : round(intervals[0]),
    equalPromptDifferenceUpper95PercentagePoints:
      intervals?.[1] === null || intervals?.[1] === undefined ? null : round(intervals[1]),
  };
}

/** Compare entity-mentioned and non-mentioned citation outcomes within the same exact provider/prompt groups. */
export function renderAiAnswerCitationEntityPromptMatchedAssociationCsv(
  observations: AiAnswerCitationObservationInput[],
  entityInputs: string[],
  ownedDomainInputs: string[]
): string {
  const entities = normalizeEntities(entityInputs);
  const ownedDomains = normalizeOwnedDomains(ownedDomainInputs);
  if (observations.length * entities.length > 5_000_000) {
    throw new Error(
      'Matched entity citation analysis exceeds the 5,000,000 observation/entity work limit. Narrow the sample or entity list.'
    );
  }
  const buckets = new Map<string, EntityPromptBucket>();
  const providerLabels = new Map<string, string>();
  for (const [index, observation] of observations.entries()) {
    if (
      !observation ||
      typeof observation.provider !== 'string' ||
      !observation.provider.trim() ||
      typeof observation.prompt !== 'string' ||
      !observation.prompt.trim() ||
      typeof observation.observedAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(
        observation.observedAt
      ) ||
      !Number.isFinite(Date.parse(observation.observedAt)) ||
      !Array.isArray(observation.citedUrls) ||
      observation.citedUrls.length > MAX_CITATIONS_PER_OBSERVATION ||
      (observation.answerText !== undefined &&
        (typeof observation.answerText !== 'string' || observation.answerText.length > 12_000)) ||
      (observation.citationListComplete !== undefined &&
        typeof observation.citationListComplete !== 'boolean')
    ) {
      throw new Error(`Observation ${index + 1} is invalid for matched entity citation analysis.`);
    }
    const providerKey = normalizedLabel(observation.provider);
    const promptKey = normalizedPromptKey(observation.prompt);
    if (!providerKey || !promptKey)
      throw new Error(`Observation ${index + 1} requires a non-empty provider and prompt.`);
    if (!providerLabels.has(providerKey))
      providerLabels.set(providerKey, observation.provider.trim().replace(/\s+/gu, ' '));
    if (observation.answerText === undefined) continue;
    const monthUtc = new Date(Date.parse(observation.observedAt)).toISOString().slice(0, 7);
    const model =
      typeof observation.model === 'string' ? observation.model.trim().replace(/\s+/gu, ' ') : '';
    const surface =
      typeof observation.surface === 'string'
        ? observation.surface.trim().replace(/\s+/gu, ' ')
        : '';
    const locale =
      typeof observation.locale === 'string' ? observation.locale.trim().replace(/\s+/gu, ' ') : '';
    const topic =
      typeof observation.topic === 'string' ? observation.topic.trim().replace(/\s+/gu, ' ') : '';
    const intent =
      typeof observation.intent === 'string' ? observation.intent.trim().replace(/\s+/gu, ' ') : '';
    const contextKey = JSON.stringify(
      [monthUtc, model, surface, locale, topic, intent].map(normalizedLabel)
    );
    for (const entity of entities) {
      entity.matcher.lastIndex = 0;
      const mentioned = entity.matcher.test(observation.answerText);
      const key = JSON.stringify([
        normalizedLabel(entity.entity),
        providerKey,
        promptKey,
        contextKey,
      ]);
      let bucket = buckets.get(key);
      if (!bucket) {
        if (buckets.size >= MAX_ENTITY_PROMPT_ROWS)
          throw new Error(
            `Matched entity citation analysis exceeded its ${MAX_ENTITY_PROMPT_ROWS.toLocaleString('en-US')} exact-prompt working-row limit.`
          );
        const empty = (): OutcomeCounts => ({
          completeSnapshots: 0,
          incompleteSnapshots: 0,
          ownedCitationSnapshots: 0,
          ownedTopThreeSnapshots: 0,
          ownedFirstPositionSnapshots: 0,
        });
        bucket = {
          entity,
          provider: providerLabels.get(providerKey)!,
          promptKey,
          monthUtc,
          contextKey,
          model,
          surface,
          locale,
          topic,
          intent,
          mentioned: empty(),
          notMentioned: empty(),
        };
        buckets.set(key, bucket);
      }
      addOutcome(mentioned ? bucket.mentioned : bucket.notMentioned, observation, ownedDomains);
    }
  }

  const matchedStratumDifferences: PromptDifference[] = [];
  const detailRows: Array<Record<string, unknown>> = [];
  for (const bucket of buckets.values()) {
    const matched =
      bucket.mentioned.completeSnapshots > 0 && bucket.notMentioned.completeSnapshots > 0;
    const deltas = {} as Record<CitationMetric, number>;
    const equalPromptRates = {
      mentioned: {} as Record<CitationMetric, number>,
      notMentioned: {} as Record<CitationMetric, number>,
    };
    for (const metric of CITATION_METRICS) {
      equalPromptRates.mentioned[metric] = rate(bucket.mentioned, metric) ?? 0;
      equalPromptRates.notMentioned[metric] = rate(bucket.notMentioned, metric) ?? 0;
      deltas[metric] = matched
        ? equalPromptRates.mentioned[metric] - equalPromptRates.notMentioned[metric]
        : 0;
    }
    const promptId = createHash('sha256').update(bucket.promptKey).digest('hex').slice(0, 16);
    const contextId = createHash('sha256').update(bucket.contextKey).digest('hex').slice(0, 16);
    const detail: Record<string, unknown> = {
      row_type: 'entity-prompt-detail',
      entity: bucket.entity.entity,
      aliases: bucket.entity.aliases.join('; '),
      provider: bucket.provider,
      exact_prompt_sha256_16: promptId,
      match_context_sha256_16: contextId,
      month_utc: bucket.monthUtc,
      model: bucket.model,
      surface: bucket.surface,
      locale: bucket.locale,
      topic: bucket.topic,
      intent: bucket.intent,
      prompt_state: matched
        ? 'matched-complete'
        : bucket.mentioned.completeSnapshots > 0
          ? 'mentioned-only-complete'
          : bucket.notMentioned.completeSnapshots > 0
            ? 'not-mentioned-only-complete'
            : 'no-complete-citation-lists',
      mention_complete_answer_text_snapshots: bucket.mentioned.completeSnapshots,
      mention_incomplete_citation_lists: bucket.mentioned.incompleteSnapshots,
      not_mention_complete_answer_text_snapshots: bucket.notMentioned.completeSnapshots,
      not_mention_incomplete_citation_lists: bucket.notMentioned.incompleteSnapshots,
      mention_owned_citation_snapshots: bucket.mentioned.ownedCitationSnapshots,
      mention_owned_top_three_snapshots: bucket.mentioned.ownedTopThreeSnapshots,
      mention_owned_first_position_snapshots: bucket.mentioned.ownedFirstPositionSnapshots,
      not_mention_owned_citation_snapshots: bucket.notMentioned.ownedCitationSnapshots,
      not_mention_owned_top_three_snapshots: bucket.notMentioned.ownedTopThreeSnapshots,
      not_mention_owned_first_position_snapshots: bucket.notMentioned.ownedFirstPositionSnapshots,
      mention_owned_citation_reach_percent:
        rate(bucket.mentioned, 'owned-citation-reach') === null
          ? null
          : round(rate(bucket.mentioned, 'owned-citation-reach')! * 100),
      not_mention_owned_citation_reach_percent:
        rate(bucket.notMentioned, 'owned-citation-reach') === null
          ? null
          : round(rate(bucket.notMentioned, 'owned-citation-reach')! * 100),
      owned_citation_reach_difference_percentage_points: matched
        ? round(deltas['owned-citation-reach'] * 100)
        : null,
      mention_owned_top_three_reach_percent:
        rate(bucket.mentioned, 'owned-top-three-reach') === null
          ? null
          : round(rate(bucket.mentioned, 'owned-top-three-reach')! * 100),
      not_mention_owned_top_three_reach_percent:
        rate(bucket.notMentioned, 'owned-top-three-reach') === null
          ? null
          : round(rate(bucket.notMentioned, 'owned-top-three-reach')! * 100),
      owned_top_three_reach_difference_percentage_points: matched
        ? round(deltas['owned-top-three-reach'] * 100)
        : null,
      mention_owned_first_position_reach_percent:
        rate(bucket.mentioned, 'owned-first-position-reach') === null
          ? null
          : round(rate(bucket.mentioned, 'owned-first-position-reach')! * 100),
      not_mention_owned_first_position_reach_percent:
        rate(bucket.notMentioned, 'owned-first-position-reach') === null
          ? null
          : round(rate(bucket.notMentioned, 'owned-first-position-reach')! * 100),
      owned_first_position_reach_difference_percentage_points: matched
        ? round(deltas['owned-first-position-reach'] * 100)
        : null,
    };
    detailRows.push(detail);
    if (!matched) continue;
    matchedStratumDifferences.push({
      entity: bucket.entity.entity,
      provider: bucket.provider,
      promptKey: bucket.promptKey,
      mentioned: bucket.mentioned,
      notMentioned: bucket.notMentioned,
      deltas,
      equalPromptRates,
      matchedStrata: 1,
    });
  }

  const promptClusters = new Map<string, PromptDifference[]>();
  for (const row of matchedStratumDifferences) {
    const key = JSON.stringify([row.entity, row.provider, row.promptKey]);
    const rows = promptClusters.get(key) ?? [];
    rows.push(row);
    promptClusters.set(key, rows);
  }
  const promptDifferences: PromptDifference[] = [...promptClusters.values()].map((strata) => {
    const first = strata[0]!;
    const sumCounts = (field: 'mentioned' | 'notMentioned'): OutcomeCounts =>
      strata.reduce(
        (sum, row) => ({
          completeSnapshots: sum.completeSnapshots + row[field].completeSnapshots,
          incompleteSnapshots: sum.incompleteSnapshots + row[field].incompleteSnapshots,
          ownedCitationSnapshots: sum.ownedCitationSnapshots + row[field].ownedCitationSnapshots,
          ownedTopThreeSnapshots: sum.ownedTopThreeSnapshots + row[field].ownedTopThreeSnapshots,
          ownedFirstPositionSnapshots:
            sum.ownedFirstPositionSnapshots + row[field].ownedFirstPositionSnapshots,
        }),
        {
          completeSnapshots: 0,
          incompleteSnapshots: 0,
          ownedCitationSnapshots: 0,
          ownedTopThreeSnapshots: 0,
          ownedFirstPositionSnapshots: 0,
        }
      );
    const equalPromptRates = {
      mentioned: {} as Record<CitationMetric, number>,
      notMentioned: {} as Record<CitationMetric, number>,
    };
    const deltas = {} as Record<CitationMetric, number>;
    for (const metric of CITATION_METRICS) {
      equalPromptRates.mentioned[metric] =
        strata.reduce((sum, row) => sum + row.equalPromptRates.mentioned[metric], 0) /
        strata.length;
      equalPromptRates.notMentioned[metric] =
        strata.reduce((sum, row) => sum + row.equalPromptRates.notMentioned[metric], 0) /
        strata.length;
      deltas[metric] = equalPromptRates.mentioned[metric] - equalPromptRates.notMentioned[metric];
    }
    return {
      entity: first.entity,
      provider: first.provider,
      promptKey: first.promptKey,
      mentioned: sumCounts('mentioned'),
      notMentioned: sumCounts('notMentioned'),
      deltas,
      equalPromptRates,
      matchedStrata: strata.length,
    };
  });
  const groups = new Map<string, PromptDifference[]>();
  for (const row of promptDifferences) {
    const key = JSON.stringify([row.entity, row.provider]);
    const rows = groups.get(key) ?? [];
    rows.push(row);
    groups.set(key, rows);
  }

  const signTests = new Map<string, SignTestSummary>();
  const signTestComparisonKeys: Array<{ key: string; pValue: number }> = [];
  let signTestWorkTerms = 0;
  for (const [summaryKey, rows] of groups) {
    for (const metric of CITATION_METRICS) {
      let positivePromptGroups = 0;
      let negativePromptGroups = 0;
      let tiedPromptGroups = 0;
      for (const row of rows) {
        const delta = row.deltas[metric];
        if (delta > 1e-12) positivePromptGroups += 1;
        else if (delta < -1e-12) negativePromptGroups += 1;
        else tiedPromptGroups += 1;
      }
      const discordant = positivePromptGroups + negativePromptGroups;
      if (discordant >= 2)
        signTestWorkTerms += Math.min(positivePromptGroups, negativePromptGroups) + 1;
      const key = JSON.stringify([summaryKey, metric]);
      signTests.set(key, {
        positivePromptGroups,
        negativePromptGroups,
        tiedPromptGroups,
        twoSidedPValue: null,
        holmAdjustedPValue: null,
      });
    }
  }
  const signTestWorkComplete = signTestWorkTerms <= MAX_SIGN_TEST_TERMS;
  if (signTestWorkComplete) {
    for (const summaryKey of groups.keys()) {
      for (const metric of CITATION_METRICS) {
        const key = JSON.stringify([summaryKey, metric]);
        const counts = signTests.get(key)!;
        const pValue = exactTwoSidedSignTestPValue(
          counts.positivePromptGroups,
          counts.negativePromptGroups
        );
        const result = { ...counts, twoSidedPValue: pValue };
        signTests.set(key, result);
        if (pValue !== null) signTestComparisonKeys.push({ key, pValue });
      }
    }
    signTestComparisonKeys.sort(
      (left, right) => left.pValue - right.pValue || left.key.localeCompare(right.key)
    );
    let previousAdjusted = 0;
    const familySize = signTestComparisonKeys.length;
    signTestComparisonKeys.forEach(({ key, pValue }, index) => {
      const adjusted = Math.max(previousAdjusted, Math.min(1, pValue * (familySize - index)));
      previousAdjusted = adjusted;
      signTests.set(key, { ...signTests.get(key)!, holmAdjustedPValue: adjusted });
    });
  }

  const bootstrapIterations =
    promptDifferences.length >= 2
      ? Math.min(
          BOOTSTRAP_ITERATIONS,
          Math.floor(MAX_BOOTSTRAP_DRAWS / (promptDifferences.length * 3))
        )
      : 0;
  const intervals = bootstrapIntervals(promptDifferences, bootstrapIterations);
  const summaryRows = [...groups.entries()]
    .map(([key, rows]) => {
      const [entity, provider] = JSON.parse(key) as [string, string];
      const intervalSet = intervals.get(key);
      const metricRows = (metric: CitationMetric) =>
        summaryMetrics(rows, metric, intervalSet?.[metric]);
      const owned = metricRows('owned-citation-reach');
      const topThree = metricRows('owned-top-three-reach');
      const first = metricRows('owned-first-position-reach');
      const firstPrompt = rows[0]!;
      const summaryBootstrapIterations =
        rows.length >= 2 && bootstrapIterations >= MIN_BOOTSTRAP_ITERATIONS
          ? bootstrapIterations
          : 0;
      const sign = (metric: CitationMetric) => signTests.get(JSON.stringify([key, metric]))!;
      const ownedSign = sign('owned-citation-reach');
      const topThreeSign = sign('owned-top-three-reach');
      const firstSign = sign('owned-first-position-reach');
      return {
        row_type: 'entity-provider-summary',
        entity,
        aliases:
          firstPrompt.entity === entity
            ? entities.find((item) => item.entity === entity)?.aliases.join('; ')
            : undefined,
        provider,
        matched_complete_prompt_groups: rows.length,
        matched_context_month_strata: rows.reduce((sum, row) => sum + row.matchedStrata, 0),
        mention_complete_answer_text_snapshots: rows.reduce(
          (sum, row) => sum + row.mentioned.completeSnapshots,
          0
        ),
        mention_incomplete_citation_lists: rows.reduce(
          (sum, row) => sum + row.mentioned.incompleteSnapshots,
          0
        ),
        not_mention_complete_answer_text_snapshots: rows.reduce(
          (sum, row) => sum + row.notMentioned.completeSnapshots,
          0
        ),
        not_mention_incomplete_citation_lists: rows.reduce(
          (sum, row) => sum + row.notMentioned.incompleteSnapshots,
          0
        ),
        owned_citation_snapshot_weighted_mention_reach_percent:
          owned.mentionedSnapshotWeightedPercent,
        owned_citation_snapshot_weighted_not_mention_reach_percent:
          owned.notMentionedSnapshotWeightedPercent,
        owned_citation_snapshot_weighted_difference_percentage_points:
          owned.snapshotWeightedDifferencePercentagePoints,
        owned_citation_equal_prompt_mention_reach_percent: owned.equalPromptMentionedPercent,
        owned_citation_equal_prompt_not_mention_reach_percent: owned.equalPromptNotMentionedPercent,
        owned_citation_equal_prompt_difference_percentage_points:
          owned.equalPromptDifferencePercentagePoints,
        owned_citation_equal_prompt_difference_lower95_percentage_points:
          owned.equalPromptDifferenceLower95PercentagePoints,
        owned_citation_equal_prompt_difference_upper95_percentage_points:
          owned.equalPromptDifferenceUpper95PercentagePoints,
        top_three_equal_prompt_mention_reach_percent: topThree.equalPromptMentionedPercent,
        top_three_equal_prompt_not_mention_reach_percent: topThree.equalPromptNotMentionedPercent,
        top_three_snapshot_weighted_difference_percentage_points:
          topThree.snapshotWeightedDifferencePercentagePoints,
        top_three_equal_prompt_difference_percentage_points:
          topThree.equalPromptDifferencePercentagePoints,
        top_three_equal_prompt_difference_lower95_percentage_points:
          topThree.equalPromptDifferenceLower95PercentagePoints,
        top_three_equal_prompt_difference_upper95_percentage_points:
          topThree.equalPromptDifferenceUpper95PercentagePoints,
        first_position_equal_prompt_mention_reach_percent: first.equalPromptMentionedPercent,
        first_position_equal_prompt_not_mention_reach_percent: first.equalPromptNotMentionedPercent,
        first_position_snapshot_weighted_difference_percentage_points:
          first.snapshotWeightedDifferencePercentagePoints,
        first_position_equal_prompt_difference_percentage_points:
          first.equalPromptDifferencePercentagePoints,
        first_position_equal_prompt_difference_lower95_percentage_points:
          first.equalPromptDifferenceLower95PercentagePoints,
        first_position_equal_prompt_difference_upper95_percentage_points:
          first.equalPromptDifferenceUpper95PercentagePoints,
        owned_citation_sign_positive_prompt_groups: ownedSign.positivePromptGroups,
        owned_citation_sign_negative_prompt_groups: ownedSign.negativePromptGroups,
        owned_citation_sign_tied_prompt_groups: ownedSign.tiedPromptGroups,
        owned_citation_sign_test_p_value: ownedSign.twoSidedPValue,
        owned_citation_sign_test_holm_adjusted_p_value: ownedSign.holmAdjustedPValue,
        top_three_sign_positive_prompt_groups: topThreeSign.positivePromptGroups,
        top_three_sign_negative_prompt_groups: topThreeSign.negativePromptGroups,
        top_three_sign_tied_prompt_groups: topThreeSign.tiedPromptGroups,
        top_three_sign_test_p_value: topThreeSign.twoSidedPValue,
        top_three_sign_test_holm_adjusted_p_value: topThreeSign.holmAdjustedPValue,
        first_position_sign_positive_prompt_groups: firstSign.positivePromptGroups,
        first_position_sign_negative_prompt_groups: firstSign.negativePromptGroups,
        first_position_sign_tied_prompt_groups: firstSign.tiedPromptGroups,
        first_position_sign_test_p_value: firstSign.twoSidedPValue,
        first_position_sign_test_holm_adjusted_p_value: firstSign.holmAdjustedPValue,
        sign_test_state: !signTestWorkComplete
          ? 'suppressed-work-cap'
          : [ownedSign, topThreeSign, firstSign].some((result) => result.twoSidedPValue !== null)
            ? 'complete'
            : 'insufficient-nontied-prompt-support',
        holm_sign_test_family_size: signTestWorkComplete ? signTestComparisonKeys.length : null,
        bootstrap_iterations: summaryBootstrapIterations,
        bootstrap_state:
          summaryBootstrapIterations > 0 ? 'complete' : 'not-enough-work-budget-or-prompts',
        multiple_comparison_adjustment: 'holm-sign-tests-only; bootstrap-intervals-unadjusted',
      };
    })
    .sort(
      (left, right) =>
        String(left.entity).localeCompare(String(right.entity)) ||
        String(left.provider).localeCompare(String(right.provider))
    );
  detailRows.sort(
    (left, right) =>
      String(left.entity).localeCompare(String(right.entity)) ||
      String(left.provider).localeCompare(String(right.provider)) ||
      String(left.exact_prompt_sha256_16).localeCompare(String(right.exact_prompt_sha256_16)) ||
      String(left.match_context_sha256_16).localeCompare(String(right.match_context_sha256_16))
  );

  const dataRowLimit = MAX_OUTPUT_ROWS - 1;
  const truncated = summaryRows.length + detailRows.length > dataRowLimit;
  const retainedSummaries = summaryRows.slice(0, dataRowLimit);
  const retainedDetails = truncated
    ? detailRows.slice(0, Math.max(0, dataRowLimit - retainedSummaries.length))
    : detailRows;
  const headers = [
    'row_type',
    'entity',
    'aliases',
    'provider',
    'exact_prompt_sha256_16',
    'match_context_sha256_16',
    'month_utc',
    'model',
    'surface',
    'locale',
    'topic',
    'intent',
    'prompt_state',
    'matched_complete_prompt_groups',
    'matched_context_month_strata',
    'mention_complete_answer_text_snapshots',
    'mention_incomplete_citation_lists',
    'not_mention_complete_answer_text_snapshots',
    'not_mention_incomplete_citation_lists',
    'mention_owned_citation_snapshots',
    'mention_owned_top_three_snapshots',
    'mention_owned_first_position_snapshots',
    'not_mention_owned_citation_snapshots',
    'not_mention_owned_top_three_snapshots',
    'not_mention_owned_first_position_snapshots',
    'mention_owned_citation_reach_percent',
    'not_mention_owned_citation_reach_percent',
    'owned_citation_reach_difference_percentage_points',
    'mention_owned_top_three_reach_percent',
    'not_mention_owned_top_three_reach_percent',
    'owned_top_three_reach_difference_percentage_points',
    'mention_owned_first_position_reach_percent',
    'not_mention_owned_first_position_reach_percent',
    'owned_first_position_reach_difference_percentage_points',
    'owned_citation_snapshot_weighted_mention_reach_percent',
    'owned_citation_snapshot_weighted_not_mention_reach_percent',
    'owned_citation_snapshot_weighted_difference_percentage_points',
    'owned_citation_equal_prompt_mention_reach_percent',
    'owned_citation_equal_prompt_not_mention_reach_percent',
    'owned_citation_equal_prompt_difference_percentage_points',
    'owned_citation_equal_prompt_difference_lower95_percentage_points',
    'owned_citation_equal_prompt_difference_upper95_percentage_points',
    'top_three_equal_prompt_mention_reach_percent',
    'top_three_equal_prompt_not_mention_reach_percent',
    'top_three_snapshot_weighted_difference_percentage_points',
    'top_three_equal_prompt_difference_percentage_points',
    'top_three_equal_prompt_difference_lower95_percentage_points',
    'top_three_equal_prompt_difference_upper95_percentage_points',
    'first_position_equal_prompt_mention_reach_percent',
    'first_position_equal_prompt_not_mention_reach_percent',
    'first_position_snapshot_weighted_difference_percentage_points',
    'first_position_equal_prompt_difference_percentage_points',
    'first_position_equal_prompt_difference_lower95_percentage_points',
    'first_position_equal_prompt_difference_upper95_percentage_points',
    'owned_citation_sign_positive_prompt_groups',
    'owned_citation_sign_negative_prompt_groups',
    'owned_citation_sign_tied_prompt_groups',
    'owned_citation_sign_test_p_value',
    'owned_citation_sign_test_holm_adjusted_p_value',
    'top_three_sign_positive_prompt_groups',
    'top_three_sign_negative_prompt_groups',
    'top_three_sign_tied_prompt_groups',
    'top_three_sign_test_p_value',
    'top_three_sign_test_holm_adjusted_p_value',
    'first_position_sign_positive_prompt_groups',
    'first_position_sign_negative_prompt_groups',
    'first_position_sign_tied_prompt_groups',
    'first_position_sign_test_p_value',
    'first_position_sign_test_holm_adjusted_p_value',
    'sign_test_state',
    'holm_sign_test_family_size',
    'bootstrap_iterations',
    'bootstrap_state',
    'multiple_comparison_adjustment',
    'output_rows_truncated',
    'interpretation_note',
  ];
  const note =
    'Mention and non-mention states are matched within the same normalized provider, exact prompt, UTC month, and recorded model/surface/locale/topic/intent labels; blank labels match only other blank labels. Each matched context-month stratum is averaged within its exact-prompt cluster before equal-prompt aggregation and prompt-cluster resampling. Rates use only answer-text snapshots whose citation lists are explicitly complete or shorter than the 50-URL cap; incomplete lists are reported as unknown and excluded. An exact two-sided sign test compares the direction of each prompt-cluster difference, excludes ties, requires at least two non-tied prompts, and uses one Holm family across entity/provider/metric comparisons; the work cap suppresses the full test family rather than returning partial p-values. Nominal bootstrap intervals are descriptive and are not multiplicity-adjusted. This is an observed association in the supplied manual sample, not evidence of causation, engine visibility, or a recommendation to change content.';
  const analysisRow = {
    row_type: 'analysis-summary',
    matched_complete_prompt_groups: promptDifferences.length,
    matched_context_month_strata: matchedStratumDifferences.length,
    sign_test_state: signTestWorkComplete
      ? signTestComparisonKeys.length > 0
        ? 'complete'
        : 'no-comparison-with-two-nontied-prompts'
      : 'suppressed-work-cap',
    sign_test_work_terms: signTestWorkTerms,
    holm_sign_test_family_size: signTestWorkComplete ? signTestComparisonKeys.length : null,
    bootstrap_iterations: bootstrapIterations >= MIN_BOOTSTRAP_ITERATIONS ? bootstrapIterations : 0,
    bootstrap_state:
      bootstrapIterations >= MIN_BOOTSTRAP_ITERATIONS
        ? 'complete'
        : 'not-enough-work-budget-or-prompts',
    multiple_comparison_adjustment: 'holm-sign-tests-only; bootstrap-intervals-unadjusted',
    output_rows_truncated: truncated,
    interpretation_note: note,
  };
  const rows: Array<Record<string, unknown>> = [
    analysisRow,
    ...retainedSummaries.map((row) => ({ ...row, output_rows_truncated: truncated })),
    ...retainedDetails.map((row) => ({ ...row, output_rows_truncated: truncated })),
  ];
  const renderedRows = [
    headers.map(csvCell).join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ];
  return `${renderedRows.join('\r\n')}\r\n`;
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]!;
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
      continue;
    }
    if (character === '"' && field.length === 0) quoted = true;
    else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && csv[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else field += character;
  }
  if (quoted) throw new Error('Matched entity citation CSV contains an unterminated quoted field.');
  if (row.length > 0 || field.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }
  return rows;
}

/** Render a self-contained review dashboard from the matched entity-association CSV. */
export function renderAiAnswerCitationEntityPromptMatchedAssociationHtmlFromCsv(
  csv: string
): string {
  const parsed = parseCsvRows(csv);
  if (parsed.length === 0 || parsed[0]!.length === 0)
    throw new Error('Matched entity citation CSV is empty.');
  const headers = parsed[0]!;
  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  for (const required of [
    'row_type',
    'entity',
    'provider',
    'exact_prompt_sha256_16',
    'prompt_state',
    'matched_complete_prompt_groups',
    'owned_citation_equal_prompt_difference_percentage_points',
    'owned_citation_equal_prompt_difference_lower95_percentage_points',
    'owned_citation_equal_prompt_difference_upper95_percentage_points',
    'top_three_equal_prompt_difference_percentage_points',
    'top_three_equal_prompt_difference_lower95_percentage_points',
    'top_three_equal_prompt_difference_upper95_percentage_points',
    'first_position_equal_prompt_difference_percentage_points',
    'first_position_equal_prompt_difference_lower95_percentage_points',
    'first_position_equal_prompt_difference_upper95_percentage_points',
  ]) {
    if (!headerIndex.has(required))
      throw new Error(`Matched entity citation CSV is missing the ${required} column.`);
  }
  const records = parsed
    .slice(1)
    .map((cells) =>
      Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']))
    );
  const analysis = records.find((record) => record.row_type === 'analysis-summary');
  if (!analysis) throw new Error('Matched entity citation CSV has no analysis summary row.');
  const summaries = records.filter((record) => record.row_type === 'entity-provider-summary');
  const details = records.filter((record) => record.row_type === 'entity-prompt-detail');
  const htmlSummaries = summaries.slice(0, 5_000);
  const htmlDetails = details.slice(0, 2_000);
  const dashboardTruncated =
    summaries.length > htmlSummaries.length || details.length > htmlDetails.length;
  const payload = JSON.stringify({
    analysis,
    summaries: htmlSummaries,
    details: htmlDetails,
    dashboardTruncated,
    sourceSummaries: summaries.length,
    sourceDetails: details.length,
  })
    .replace(/</gu, '\\u003c')
    .replace(/>/gu, '\\u003e')
    .replace(/&/gu, '\\u0026')
    .replace(/\u2028/gu, '\\u2028')
    .replace(/\u2029/gu, '\\u2029');
  const style = `:root{color-scheme:light;--ink:#172033;--muted:#617089;--line:#d8e0eb;--panel:#fff;--wash:#f3f6fa;--accent:#2663eb;--positive:#18794e;--negative:#b42318}*{box-sizing:border-box}body{margin:0;background:var(--wash);color:var(--ink);font:15px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:1440px;margin:0 auto;padding:32px 24px 56px}header{max-width:960px;margin-bottom:24px}h1{font-size:clamp(1.8rem,4vw,2.65rem);line-height:1.1;margin:0 0 12px;letter-spacing:-.035em}.lede,.note{color:var(--muted);max-width:90ch}.panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:22px;margin:18px 0;box-shadow:0 5px 20px #17203308}.controls{display:flex;flex-wrap:wrap;gap:14px;margin:12px 0 18px}label{display:grid;gap:5px;font-size:.84rem;color:var(--muted);font-weight:650}select{min-width:190px;max-width:min(420px,90vw);border:1px solid var(--line);border-radius:8px;background:white;color:var(--ink);padding:9px 11px;font:inherit}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.metric{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:15px 17px}.metric strong{display:block;font-size:1.6rem;font-variant-numeric:tabular-nums}.metric span{color:var(--muted);font-size:.84rem}.chart-wrap{overflow-x:auto}svg{display:block;width:100%;min-width:720px;height:auto}table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{text-align:left;vertical-align:top;padding:9px 10px;border-bottom:1px solid var(--line)}th{position:sticky;top:0;background:#f8faff;color:#47546b;font-size:.78rem;text-transform:uppercase;letter-spacing:.045em}td.num{font-variant-numeric:tabular-nums;white-space:nowrap}.table-wrap{overflow:auto;max-height:560px}.badge{display:inline-block;border-radius:99px;background:#eaf0ff;color:#214da8;padding:2px 8px;font-size:.76rem}.positive{color:var(--positive)}.negative{color:var(--negative)}.muted{color:var(--muted)}.warning{border-left:4px solid #cf8b00;background:#fff8e5;padding:12px 15px;border-radius:5px;color:#594208}.empty{padding:22px;color:var(--muted);text-align:center}@media(max-width:720px){main{padding:22px 14px 40px}.panel{padding:16px}.controls{display:grid}.controls label,.controls select{width:100%}}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prompt-matched entity citation association</title><style>${style}</style></head><body><main><header><h1>Entity mentions and owned citations</h1><p class="lede">Compare citation reach in answers that mention a configured entity with answers that do not, within the same provider, exact prompt, UTC month, and recorded model/surface/locale/topic/intent context. Context-month strata are averaged within prompts before interval resampling.</p></header><div id="warnings"></div><section class="metrics" aria-label="Analysis summary"><div class="metric"><strong id="matched-count">—</strong><span>matched prompt groups</span></div><div class="metric"><strong id="strata-count">—</strong><span>matched context/month strata</span></div><div class="metric"><strong id="summary-count">—</strong><span>entity/provider summaries</span></div><div class="metric"><strong id="bootstrap-state">—</strong><span>prompt-cluster interval state</span></div></section><section class="panel"><h2>Matched association</h2><div class="controls"><label>Entity<select id="entity-filter"></select></label><label>Provider<select id="provider-filter"></select></label><label>Metric<select id="metric-filter"><option value="owned">Owned citation reach</option><option value="top-three">Owned top-three reach</option><option value="first-position">Owned first-position reach</option></select></label></div><div class="chart-wrap"><svg id="association-chart" viewBox="0 0 1080 520" role="img" aria-label="Equal-prompt owned citation association with nominal 95 percent intervals"></svg></div></section><section class="panel"><h2>Provider/entity summary</h2><div class="table-wrap"><table><thead><tr><th>Entity</th><th>Provider</th><th>Matched prompts</th><th>Mention reach</th><th>Non-mention reach</th><th>Difference</th><th>Nominal 95% prompt interval</th><th>Snapshot-weighted difference</th><th>Bootstrap</th><th>Prompt signs + / − / =</th><th>Exact p / Holm p</th></tr></thead><tbody id="summary-rows"></tbody></table></div></section><section class="panel"><h2>Exact-prompt detail</h2><p class="note">Prompt text is not included. The identifier is a truncated SHA-256 fingerprint for local joins. Incomplete citation lists remain unknown and do not enter the rates.</p><div class="table-wrap"><table><thead><tr><th>Prompt fingerprint</th><th>Month / matched context</th><th>State</th><th>Mention complete / unknown</th><th>Non-mention complete / unknown</th><th>Mention reach</th><th>Non-mention reach</th><th>Δ citation reach</th><th>Top-three Δ</th><th>First-position Δ</th></tr></thead><tbody id="detail-rows"></tbody></table></div></section><p class="note">Context-month strata match provider, exact prompt, UTC month, and recorded model/surface/locale/topic/intent labels; absent labels match only absent labels. These are descriptive associations in the supplied manual sample, not causal effects, engine visibility measures, or content recommendations. The exact sign test uses one Holm family across entity/provider/metric rows; prompt-cluster bootstrap intervals are nominal and unadjusted.</p><script type="application/json" id="association-data">${payload}</script><script>
const data=JSON.parse(document.getElementById('association-data').textContent||'{}');
const entities=[...new Set(data.summaries.map(r=>r.entity))].sort((a,b)=>a.localeCompare(b));
const entitySelect=document.getElementById('entity-filter'),providerSelect=document.getElementById('provider-filter'),metricSelect=document.getElementById('metric-filter');
function option(select,value,label){const item=document.createElement('option');item.value=value;item.textContent=label;select.append(item)}
option(entitySelect,'','All entities');entities.forEach(x=>option(entitySelect,x,x));
function providers(){const found=[...new Set(data.summaries.filter(r=>!entitySelect.value||r.entity===entitySelect.value).map(r=>r.provider))].sort((a,b)=>a.localeCompare(b));const previous=providerSelect.value;providerSelect.replaceChildren();option(providerSelect,'','All providers');found.forEach(x=>option(providerSelect,x,x));if(found.includes(previous))providerSelect.value=previous}
function selected(){return data.summaries.filter(r=>(!entitySelect.value||r.entity===entitySelect.value)&&(!providerSelect.value||r.provider===providerSelect.value))}
const metricFields={owned:{delta:'owned_citation_equal_prompt_difference_percentage_points',lower:'owned_citation_equal_prompt_difference_lower95_percentage_points',upper:'owned_citation_equal_prompt_difference_upper95_percentage_points',mention:'owned_citation_equal_prompt_mention_reach_percent',other:'owned_citation_equal_prompt_not_mention_reach_percent',snapshot:'owned_citation_snapshot_weighted_difference_percentage_points',label:'Owned citation reach'},'top-three':{delta:'top_three_equal_prompt_difference_percentage_points',lower:'top_three_equal_prompt_difference_lower95_percentage_points',upper:'top_three_equal_prompt_difference_upper95_percentage_points',mention:'top_three_equal_prompt_mention_reach_percent',other:'top_three_equal_prompt_not_mention_reach_percent',snapshot:'top_three_snapshot_weighted_difference_percentage_points',label:'Owned top-three reach'},'first-position':{delta:'first_position_equal_prompt_difference_percentage_points',lower:'first_position_equal_prompt_difference_lower95_percentage_points',upper:'first_position_equal_prompt_difference_upper95_percentage_points',mention:'first_position_equal_prompt_mention_reach_percent',other:'first_position_equal_prompt_not_mention_reach_percent',snapshot:'first_position_snapshot_weighted_difference_percentage_points',label:'Owned first-position reach'}};
function number(row,key){const n=Number(row[key]);return row[key]===''||!Number.isFinite(n)?null:n}
function fmt(value){return value===null?'—':value.toFixed(2)+'%'}
function pp(value){return value===null?'—':(value>0?'+':'')+value.toFixed(2)+' pp'}
function appendCell(row,value,className=''){const cell=document.createElement('td');cell.textContent=value;if(className)cell.className=className;row.append(cell)}
function draw(){providers();const rows=selected();const metric=metricFields[metricSelect.value]||metricFields.owned;const svg=document.getElementById('association-chart');svg.replaceChildren();const ns='http://www.w3.org/2000/svg';const y0=44,step=29,left=245,right=1020,zero=left+(right-left)/2,scale=(right-left)/200;const shown=[...rows].sort((a,b)=>Math.abs(number(b,metric.delta)||0)-Math.abs(number(a,metric.delta)||0)).slice(0,14);const h=Math.max(300,shown.length*step+80);svg.setAttribute('viewBox','0 0 1080 '+h);function el(tag,attrs,text){const x=document.createElementNS(ns,tag);Object.entries(attrs||{}).forEach(([k,v])=>x.setAttribute(k,String(v)));if(text!==undefined)x.textContent=text;svg.append(x);return x}el('line',{x1:zero,y1:20,x2:zero,y2:h-35,stroke:'#91a0b5','stroke-width':1.5});[-100,-50,0,50,100].forEach(t=>{const x=zero+t*scale;el('line',{x1:x,y1:22,x2:x,y2:h-34,stroke:'#e0e6ee'});el('text',{x,y:h-12,'text-anchor':'middle',fill:'#617089','font-size':12},t+' pp')});shown.forEach((r,i)=>{const y=y0+i*step;const delta=number(r,metric.delta);const lo=number(r,metric.lower),hi=number(r,metric.upper);el('text',{x:left-12,y:y+4,'text-anchor':'end',fill:'#334155','font-size':12},r.entity+' · '+r.provider);if(delta===null)return;const end=zero+Math.max(-100,Math.min(100,delta))*scale;el('rect',{x:Math.min(zero,end),y:y-7,width:Math.max(1,Math.abs(end-zero)),height:14,rx:4,fill:delta>=0?'#18794e':'#b42318',opacity:.78});if(lo!==null&&hi!==null){const lx=zero+Math.max(-100,Math.min(100,lo))*scale,hx=zero+Math.max(-100,Math.min(100,hi))*scale;el('line',{x1:lx,y1:y,x2:hx,y2:y,stroke:'#172033','stroke-width':2});el('line',{x1:lx,y1:y-5,x2:lx,y2:y+5,stroke:'#172033'});el('line',{x1:hx,y1:y-5,x2:hx,y2:y+5,stroke:'#172033'});}el('text',{x:end+(delta>=0?7:-7),y:y+4,'text-anchor':delta>=0?'start':'end',fill:'#172033','font-size':11},pp(delta)+' · n='+r.matched_complete_prompt_groups)});if(shown.length===0)el('text',{x:540,y:h/2,'text-anchor':'middle',fill:'#617089','font-size':15},'No matched prompt groups for this selection');
document.getElementById('summary-rows').replaceChildren();rows.slice(0,1000).forEach(r=>{const tr=document.createElement('tr');const f=metricFields[metricSelect.value]||metricFields.owned;const delta=number(r,f.delta);appendCell(tr,r.entity);appendCell(tr,r.provider);appendCell(tr,r.matched_complete_prompt_groups,'num');appendCell(tr,fmt(number(r,f.mention)),'num');appendCell(tr,fmt(number(r,f.other)),'num');appendCell(tr,pp(delta),'num '+(delta===null?'':delta>=0?'positive':'negative'));const lo=number(r,f.lower),hi=number(r,f.upper);appendCell(tr,lo===null||hi===null?'—':lo.toFixed(2)+' to '+hi.toFixed(2)+' pp','num');appendCell(tr,pp(number(r,f.snapshot)),'num');appendCell(tr,r.bootstrap_state||'—');const signPrefix=metricSelect.value==='top-three'?'top_three':metricSelect.value==='first-position'?'first_position':'owned_citation';appendCell(tr,[r[signPrefix+'_sign_positive_prompt_groups'],r[signPrefix+'_sign_negative_prompt_groups'],r[signPrefix+'_sign_tied_prompt_groups']].join(' / '),'num');const signP=number(r,signPrefix+'_sign_test_p_value'),holmP=number(r,signPrefix+'_sign_test_holm_adjusted_p_value');appendCell(tr,signP===null?'—':signP.toPrecision(3)+' / '+(holmP===null?'—':holmP.toPrecision(3)),'num');document.getElementById('summary-rows').append(tr)});
const matchingDetails=data.details.filter(r=>(!entitySelect.value||r.entity===entitySelect.value)&&(!providerSelect.value||r.provider===providerSelect.value)).slice(0,1000);const body=document.getElementById('detail-rows');body.replaceChildren();matchingDetails.forEach(r=>{const tr=document.createElement('tr');appendCell(tr,r.exact_prompt_sha256_16);appendCell(tr,[r.month_utc||'',r.model||'unlabeled model',r.surface||'unlabeled surface',r.locale||'unlabeled locale',r.topic||'unlabeled topic',r.intent||'unlabeled intent',r.match_context_sha256_16||''].join(' · '));appendCell(tr,r.prompt_state);appendCell(tr,(r.mention_complete_answer_text_snapshots||'0')+' / '+(r.mention_incomplete_citation_lists||'0'),'num');appendCell(tr,(r.not_mention_complete_answer_text_snapshots||'0')+' / '+(r.not_mention_incomplete_citation_lists||'0'),'num');appendCell(tr,fmt(number(r,'mention_owned_citation_reach_percent')),'num');appendCell(tr,fmt(number(r,'not_mention_owned_citation_reach_percent')),'num');appendCell(tr,pp(number(r,'owned_citation_reach_difference_percentage_points')),'num');appendCell(tr,pp(number(r,'owned_top_three_reach_difference_percentage_points')),'num');appendCell(tr,pp(number(r,'owned_first_position_reach_difference_percentage_points')),'num');body.append(tr)});
document.getElementById('matched-count').textContent=Number(data.analysis.matched_complete_prompt_groups||0).toLocaleString();document.getElementById('strata-count').textContent=Number(data.analysis.matched_context_month_strata||0).toLocaleString();document.getElementById('summary-count').textContent=data.sourceSummaries.toLocaleString();document.getElementById('bootstrap-state').textContent=data.analysis.bootstrap_state||'not available';if(shown.length===0){document.getElementById('summary-rows').innerHTML='<tr><td colspan="11" class="empty">No matched entity/provider summaries.</td></tr>';document.getElementById('detail-rows').innerHTML='<tr><td colspan="10" class="empty">No exact-prompt detail.</td></tr>'}}
const warning=[];if(data.analysis.sign_test_state==='suppressed-work-cap')warning.push('The exact sign-test work cap suppressed all p-values to preserve one complete Holm-adjusted family.');if(data.analysis.output_rows_truncated==='true')warning.push('The CSV hit its output-row cap; retained summaries or prompt rows may be omitted.');if(data.dashboardTruncated)warning.push('This dashboard shows up to 5,000 summaries and 2,000 prompt-detail rows from the CSV. Use the CSV for the complete retained output.');if(warning.length){const box=document.createElement('p');box.className='warning';box.textContent=warning.join(' ');document.getElementById('warnings').append(box)}entitySelect.addEventListener('change',draw);providerSelect.addEventListener('change',draw);metricSelect.addEventListener('change',draw);draw();
</script></main></body></html>`;
}

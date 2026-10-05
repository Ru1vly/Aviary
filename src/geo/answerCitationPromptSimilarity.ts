import type {
  AiAnswerCitationObservationReport,
  AiAnswerCitationPromptProfile,
  AiAnswerCitationPromptProviderProfile,
} from './answerCitationObservations';
import {
  renderAiAnswerCitationSourceRarefactionCsv,
  renderAiAnswerCitationSourceRarefactionPanelHtml,
} from './answerCitationSourceRarefaction';
import { renderAiAnswerCitationSourceRarefactionScenariosCsv } from './answerCitationSourceRarefaction';
import type {
  AiAnswerCitationSourceRarefactionSamplingMetadata,
  AiAnswerCitationSourceRarefactionScenario,
} from './answerCitationSourceRarefaction';

const MAX_CANDIDATE_PAIRS = 500_000;
const MAX_OUTPUT_ROWS = 20_000;
const MAX_FAMILY_PROVIDER_ROWS = 10_000;
const MAX_THRESHOLD_SWEEP_PROVIDER_ROWS = 20_000;
const MAX_FAMILY_SOURCE_OVERLAP_ROWS = 20_000;
const MAX_FAMILY_SOURCE_OVERLAP_HTML_ROWS = 500;
const MAX_FAMILY_SOURCE_OVERLAP_SWEEP_HTML_ROWS = 1_000;
const MAX_PERIOD_COMPARISON_HTML_ROWS = 500;
const MAX_FAMILY_SOURCE_RAREFACTION_SWEEP_HTML_ROWS = 12_000;
const MAX_PERIOD_COMPARISON_SWEEP_HTML_ROWS = 1_000;
const MAX_FAMILY_THRESHOLD_SWEEP_HTML_ROWS = 1_000;
const MAX_PROMPT_FAMILY_PROVIDER_SUMMARY_ROWS = 1_000;
const MAX_PROMPT_FAMILY_DASHBOARD_ROWS = 500;
const MAX_PROMPT_FAMILY_DASHBOARD_CHART_PROVIDERS = 24;
const MAX_PROMPT_FAMILY_INFLUENCE_HTML_ROWS = 400;
const MAX_PROMPT_FAMILY_INFLUENCE_HTML_CHART_ROWS = 24;
const PROMPT_FAMILY_THRESHOLD_SWEEP = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95];
const PROMPT_FAMILY_PERIOD_DIVERGENCE_KEYS = [
  'observed_event_weighted_source_jensen_shannon_bits',
  'observed_rank_weighted_source_jensen_shannon_bits',
  'matched_equal_prompt_event_source_jensen_shannon_bits',
  'matched_equal_prompt_rank_source_jensen_shannon_bits',
] as const;
const MAX_FAMILY_BOOTSTRAP_DRAWS = 50_000_000;
const FAMILY_BOOTSTRAP_ITERATIONS = 1_000;
const MIN_FAMILY_BOOTSTRAP_ITERATIONS = 250;

interface PromptTerms {
  profile: AiAnswerCitationPromptProfile;
  terms: Map<string, number>;
  weights: Map<string, number>;
  norm: number;
}

interface PromptSimilarityRow {
  left: PromptTerms;
  right: PromptTerms;
  cosine: number;
  jaccard: number;
  sharedTerms: string[];
}

interface PromptSimilarityAnalysis {
  rows: PromptSimilarityRow[];
  documentCount: number;
  candidatePairCount: number;
  highFrequencyCutoff: number;
  candidatePairsCapped: boolean;
  promptCatalogTruncated: boolean;
}

function normalizedPrompt(value: string): string {
  return value.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US');
}

function tokenizePrompt(value: string): Map<string, number> {
  const tokens =
    value
      .normalize('NFKC')
      .toLocaleLowerCase('en-US')
      .match(/[\p{L}\p{N}]+/gu) ?? [];
  const counts = new Map<string, number>();
  for (const token of tokens) {
    if ([...token].length < 2) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

function csvCell(value: unknown): string {
  let text = String(value ?? '');
  const firstNonWhitespace = text.trimStart().charAt(0);
  if (typeof value !== 'number' && firstNonWhitespace && '=+-@'.includes(firstNonWhitespace))
    text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function distributionJensenShannonBits(
  left: Map<string, number>,
  right: Map<string, number>
): number | null {
  const leftTotal = [...left.values()].reduce((sum, weight) => sum + weight, 0);
  const rightTotal = [...right.values()].reduce((sum, weight) => sum + weight, 0);
  if (leftTotal <= 0 || rightTotal <= 0) return null;
  let divergence = 0;
  for (const domain of new Set([...left.keys(), ...right.keys()])) {
    const leftShare = (left.get(domain) ?? 0) / leftTotal;
    const rightShare = (right.get(domain) ?? 0) / rightTotal;
    const midpoint = (leftShare + rightShare) / 2;
    if (leftShare > 0) divergence += (leftShare * Math.log2(leftShare / midpoint)) / 2;
    if (rightShare > 0) divergence += (rightShare * Math.log2(rightShare / midpoint)) / 2;
  }
  return Number(Math.max(0, Math.min(1, divergence)).toFixed(6));
}

function bootstrapFamilyMeanInterval(
  values: number[],
  seedText: string,
  iterations: number,
  outputScale = 100
): { lower: number; upper: number } | null {
  if (values.length < 2 || iterations < MIN_FAMILY_BOOTSTRAP_ITERATIONS) return null;
  let seed = 2166136261;
  for (const character of seedText)
    seed = Math.imul(seed ^ character.codePointAt(0)!, 16777619) >>> 0;
  if (seed === 0) seed = 0x6d2b79f5;
  let state = seed;
  const means = new Array<number>(iterations);
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let total = 0;
    for (let draw = 0; draw < values.length; draw += 1) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      total += values[Math.floor((state / 0x1_0000_0000) * values.length)]!;
    }
    means[iteration] = total / values.length;
  }
  means.sort((left, right) => left - right);
  return {
    lower: Number((means[Math.floor((iterations - 1) * 0.025)]! * outputScale).toFixed(4)),
    upper: Number((means[Math.ceil((iterations - 1) * 0.975)]! * outputScale).toFixed(4)),
  };
}

function sourceConcentration(
  domains: Map<string, number>
): { hhi: number; effectiveSources: number; largestShare: number } | null {
  const total = [...domains.values()].reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return null;
  const shares = [...domains.values()].map((weight) => weight / total);
  const hhi = shares.reduce((sum, share) => sum + share ** 2, 0);
  return {
    hhi,
    effectiveSources: 1 / hhi,
    largestShare: shares.reduce((largest, share) => Math.max(largest, share), 0),
  };
}

function findArticulationPromptIndexes(adjacency: Map<number, Set<number>>): number[] {
  const neighbors = new Map(
    [...adjacency].map(([promptIndex, adjacent]) => [promptIndex, [...adjacent]])
  );
  const discovery = new Map<number, number>();
  const low = new Map<number, number>();
  const parentByPrompt = new Map<number, number>();
  const childCountByPrompt = new Map<number, number>();
  const articulationPoints = new Set<number>();
  let discoveryIndex = 0;
  for (const start of neighbors.keys()) {
    if (discovery.has(start)) continue;
    discovery.set(start, discoveryIndex);
    low.set(start, discoveryIndex);
    discoveryIndex += 1;
    const stack: Array<{ promptIndex: number; nextNeighbor: number }> = [
      { promptIndex: start, nextNeighbor: 0 },
    ];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const adjacent = neighbors.get(frame.promptIndex)!;
      if (frame.nextNeighbor < adjacent.length) {
        const neighbor = adjacent[frame.nextNeighbor]!;
        frame.nextNeighbor += 1;
        if (!discovery.has(neighbor)) {
          parentByPrompt.set(neighbor, frame.promptIndex);
          childCountByPrompt.set(
            frame.promptIndex,
            (childCountByPrompt.get(frame.promptIndex) ?? 0) + 1
          );
          discovery.set(neighbor, discoveryIndex);
          low.set(neighbor, discoveryIndex);
          discoveryIndex += 1;
          stack.push({ promptIndex: neighbor, nextNeighbor: 0 });
        } else if (parentByPrompt.get(frame.promptIndex) !== neighbor) {
          low.set(
            frame.promptIndex,
            Math.min(low.get(frame.promptIndex)!, discovery.get(neighbor)!)
          );
        }
      } else {
        stack.pop();
        const parentPrompt = parentByPrompt.get(frame.promptIndex);
        if (parentPrompt !== undefined) {
          low.set(parentPrompt, Math.min(low.get(parentPrompt)!, low.get(frame.promptIndex)!));
          if (
            parentByPrompt.has(parentPrompt) &&
            low.get(frame.promptIndex)! >= discovery.get(parentPrompt)!
          ) {
            articulationPoints.add(parentPrompt);
          }
        } else if ((childCountByPrompt.get(frame.promptIndex) ?? 0) > 1) {
          articulationPoints.add(frame.promptIndex);
        }
      }
    }
  }
  return [...articulationPoints].sort((left, right) => left - right);
}

/**
 * Export candidate prompt pairs with high lexical similarity. This is a wording-review aid;
 * it does not infer semantic equivalence or merge prompt groups.
 */
function analyzePromptSimilarity(
  report: AiAnswerCitationObservationReport,
  minimumCosineSimilarity = 0.65
): PromptSimilarityAnalysis {
  if (
    !Number.isFinite(minimumCosineSimilarity) ||
    minimumCosineSimilarity < 0 ||
    minimumCosineSimilarity > 1
  ) {
    throw new Error('Prompt similarity threshold must be between 0 and 1.');
  }

  const promptProfiles = report.prompts;
  const documentCount = promptProfiles.length;
  const documentFrequency = new Map<string, number>();
  const tokenCounts = promptProfiles.map((profile) => tokenizePrompt(profile.prompt));
  tokenCounts.forEach((terms) => {
    for (const term of terms.keys())
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
  });

  const promptTerms: PromptTerms[] = tokenCounts.map((terms, index) => {
    const weights = new Map<string, number>();
    let squaredNorm = 0;
    for (const [term, count] of terms) {
      const idf = Math.log(1 + documentCount / (documentFrequency.get(term) ?? documentCount));
      const weight = (1 + Math.log(count)) * idf;
      weights.set(term, weight);
      squaredNorm += weight ** 2;
    }
    return { profile: promptProfiles[index]!, terms, weights, norm: Math.sqrt(squaredNorm) };
  });

  const highFrequencyCutoff = Math.max(12, Math.ceil(documentCount * 0.15));
  const postings = new Map<string, number[]>();
  promptTerms.forEach(({ terms }, promptIndex) => {
    for (const term of terms.keys()) {
      const posting = postings.get(term) ?? [];
      posting.push(promptIndex);
      postings.set(term, posting);
    }
  });

  const candidatePairs = new Set<number>();
  let candidatePairsCapped = false;
  const termsByFrequency = [...postings.entries()].sort(
    (left, right) => left[1].length - right[1].length || left[0].localeCompare(right[0])
  );
  for (const [, posting] of termsByFrequency) {
    if (posting.length > highFrequencyCutoff) continue;
    for (let left = 0; left < posting.length; left += 1) {
      for (let right = left + 1; right < posting.length; right += 1) {
        const leftIndex = posting[left]!;
        const rightIndex = posting[right]!;
        const key = leftIndex * documentCount + rightIndex;
        candidatePairs.add(key);
        if (candidatePairs.size >= MAX_CANDIDATE_PAIRS) {
          candidatePairsCapped = true;
          break;
        }
      }
      if (candidatePairsCapped) break;
    }
    if (candidatePairsCapped) break;
  }

  const rows: PromptSimilarityRow[] = [];
  for (const pair of candidatePairs) {
    const leftIndex = Math.floor(pair / documentCount);
    const rightIndex = pair % documentCount;
    const left = promptTerms[leftIndex]!;
    const right = promptTerms[rightIndex]!;
    if (
      normalizedPrompt(left.profile.prompt) === normalizedPrompt(right.profile.prompt) ||
      left.norm === 0 ||
      right.norm === 0
    )
      continue;

    const [smaller, larger] =
      left.weights.size <= right.weights.size ? [left, right] : [right, left];
    let dotProduct = 0;
    const sharedTerms: Array<{ term: string; weight: number }> = [];
    for (const [term, weight] of smaller.weights) {
      const otherWeight = larger.weights.get(term);
      if (otherWeight === undefined) continue;
      dotProduct += weight * otherWeight;
      sharedTerms.push({ term, weight: weight + otherWeight });
    }
    if (sharedTerms.length === 0) continue;
    const cosine = dotProduct / (left.norm * right.norm);
    if (cosine < minimumCosineSimilarity) continue;
    const unionSize = left.terms.size + right.terms.size - sharedTerms.length;
    rows.push({
      left,
      right,
      cosine,
      jaccard: unionSize > 0 ? sharedTerms.length / unionSize : 0,
      sharedTerms: sharedTerms
        .sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term))
        .slice(0, 12)
        .map(({ term }) => term),
    });
  }

  rows.sort(
    (left, right) =>
      right.cosine - left.cosine ||
      left.left.profile.prompt.localeCompare(right.left.profile.prompt) ||
      left.right.profile.prompt.localeCompare(right.right.profile.prompt)
  );
  return {
    rows,
    documentCount,
    candidatePairCount: candidatePairs.size,
    highFrequencyCutoff,
    candidatePairsCapped,
    promptCatalogTruncated: report.promptsTruncated,
  };
}

export interface AiAnswerCitationPromptFamilyPartition {
  families: AiAnswerCitationPromptProfile[][];
  candidatePairsConsidered: number;
  highFrequencyPostingCutoff: number;
  candidatePairsCapped: boolean;
  promptCatalogTruncated: boolean;
}

function partitionPromptFamiliesFromAnalysis(
  report: AiAnswerCitationObservationReport,
  analysis: PromptSimilarityAnalysis
): AiAnswerCitationPromptFamilyPartition {
  const parent = report.prompts.map((_, index) => index);
  const findRoot = (index: number): number => {
    let root = index;
    while (parent[root] !== root) root = parent[root]!;
    while (parent[index] !== index) {
      const next = parent[index]!;
      parent[index] = root;
      index = next;
    }
    return root;
  };
  const promptIndexes = new Map(
    report.prompts.map((profile, index) => [normalizedPrompt(profile.prompt), index])
  );
  for (const edge of analysis.rows) {
    const left = promptIndexes.get(normalizedPrompt(edge.left.profile.prompt));
    const right = promptIndexes.get(normalizedPrompt(edge.right.profile.prompt));
    if (left === undefined || right === undefined) continue;
    const leftRoot = findRoot(left);
    const rightRoot = findRoot(right);
    if (leftRoot !== rightRoot)
      parent[Math.max(leftRoot, rightRoot)] = Math.min(leftRoot, rightRoot);
  }
  const components = new Map<number, AiAnswerCitationPromptProfile[]>();
  report.prompts.forEach((profile, index) => {
    const root = findRoot(index);
    const family = components.get(root) ?? [];
    family.push(profile);
    components.set(root, family);
  });
  const families = [...components.values()]
    .map((members) =>
      members.sort((left, right) =>
        normalizedPrompt(left.prompt).localeCompare(normalizedPrompt(right.prompt))
      )
    )
    .sort((left, right) =>
      normalizedPrompt(left[0]!.prompt).localeCompare(normalizedPrompt(right[0]!.prompt))
    );
  return {
    families,
    candidatePairsConsidered: analysis.candidatePairCount,
    highFrequencyPostingCutoff: analysis.highFrequencyCutoff,
    candidatePairsCapped: analysis.candidatePairsCapped,
    promptCatalogTruncated: analysis.promptCatalogTruncated,
  };
}

/** Build connected lexical prompt families using the same bounded graph as the family export. */
export function analyzeAiAnswerCitationPromptFamilyPartition(
  report: AiAnswerCitationObservationReport,
  minimumCosineSimilarity = 0.85
): AiAnswerCitationPromptFamilyPartition {
  if (
    !Number.isFinite(minimumCosineSimilarity) ||
    minimumCosineSimilarity < 0 ||
    minimumCosineSimilarity > 1
  ) {
    throw new Error('Prompt-family similarity threshold must be between 0 and 1.');
  }
  return partitionPromptFamiliesFromAnalysis(
    report,
    analyzePromptSimilarity(report, minimumCosineSimilarity)
  );
}

function buildFamilyRarefactionProfile(
  members: AiAnswerCitationPromptProfile[],
  familyIndex: number
): AiAnswerCitationPromptProfile {
  interface ProviderAccumulator {
    profile: AiAnswerCitationPromptProviderProfile;
    domains: Set<string>;
    completenessMetadataKnown: boolean;
    missingProviderProfile: boolean;
  }
  const providerProfiles = new Map<string, ProviderAccumulator>();
  for (const member of members) {
    const profilesByProvider = new Map(
      (member.providerProfiles ?? []).map((profile) => [
        normalizedPrompt(profile.provider),
        profile,
      ])
    );
    for (const provider of member.providers) {
      const key = normalizedPrompt(provider);
      const source = profilesByProvider.get(key);
      const current = providerProfiles.get(key) ?? {
        profile: {
          provider,
          observations: 0,
          incompleteCitationListObservations: 0,
          observationsWithCitations: 0,
          observationsWithoutCitations: 0,
          citationEvents: 0,
          firstObservedAt: source?.firstObservedAt ?? member.firstObservedAt,
          lastObservedAt: source?.lastObservedAt ?? member.lastObservedAt,
          citedDomains: [],
          citedDomainsTruncated: false,
        },
        domains: new Set<string>(),
        completenessMetadataKnown: true,
        missingProviderProfile: false,
      };
      if (!source) {
        current.completenessMetadataKnown = false;
        current.missingProviderProfile = true;
        current.profile.citedDomainsTruncated = true;
      } else {
        current.profile.observations += source.observations;
        current.profile.observationsWithCitations += source.observationsWithCitations;
        current.profile.observationsWithoutCitations += source.observationsWithoutCitations;
        current.profile.citationEvents += source.citationEvents;
        const incomplete = source.incompleteCitationListObservations;
        if (
          Number.isSafeInteger(incomplete) &&
          incomplete! >= 0 &&
          incomplete! <= source.observations
        ) {
          current.profile.incompleteCitationListObservations =
            (current.profile.incompleteCitationListObservations ?? 0) + incomplete!;
        } else {
          current.completenessMetadataKnown = false;
        }
        for (const domain of source.citedDomains ?? []) current.domains.add(domain);
        current.profile.citedDomainsTruncated ||= source.citedDomainsTruncated !== false;
        current.profile.firstObservedAt =
          source.firstObservedAt < current.profile.firstObservedAt
            ? source.firstObservedAt
            : current.profile.firstObservedAt;
        current.profile.lastObservedAt =
          source.lastObservedAt > current.profile.lastObservedAt
            ? source.lastObservedAt
            : current.profile.lastObservedAt;
      }
      providerProfiles.set(key, current);
    }
  }

  const profiles = [...providerProfiles.values()].map(
    ({ profile, domains, completenessMetadataKnown, missingProviderProfile }) => ({
      ...profile,
      incompleteCitationListObservations:
        completenessMetadataKnown && !missingProviderProfile
          ? profile.incompleteCitationListObservations
          : undefined,
      citedDomains: [...domains].sort((left, right) => left.localeCompare(right)),
    })
  );
  const providers = profiles
    .map(({ provider }) => provider)
    .sort((left, right) => left.localeCompare(right));
  const citedDomains = [...new Set(profiles.flatMap(({ citedDomains: domains }) => domains))].sort(
    (left, right) => left.localeCompare(right)
  );
  const observations = profiles.reduce((sum, profile) => sum + profile.observations, 0);
  const observationsWithCitations = profiles.reduce(
    (sum, profile) => sum + profile.observationsWithCitations,
    0
  );
  const observationsWithoutCitations = profiles.reduce(
    (sum, profile) => sum + profile.observationsWithoutCitations,
    0
  );
  const firstObservedAt = members.reduce(
    (earliest, member) => (member.firstObservedAt < earliest ? member.firstObservedAt : earliest),
    members[0]!.firstObservedAt
  );
  const lastObservedAt = members.reduce(
    (latest, member) => (member.lastObservedAt > latest ? member.lastObservedAt : latest),
    members[0]!.lastObservedAt
  );
  return {
    prompt: `family-${String(familyIndex + 1).padStart(5, '0')}`,
    observations,
    uniqueProviders: providers.length,
    providers,
    observationsWithCitations,
    observationsWithoutCitations,
    citationEvents: profiles.reduce((sum, profile) => sum + profile.citationEvents, 0),
    providerProfiles: profiles,
    firstObservedAt,
    lastObservedAt,
    citedDomains,
    citedDomainsTruncated: profiles.some(({ citedDomainsTruncated: truncated }) => truncated),
    crossProviderCitedDomains: [],
    crossProviderCitedDomainsTruncated: members.some(
      ({ crossProviderCitedDomainsTruncated }) => crossProviderCitedDomainsTruncated
    ),
  };
}

/** Estimate citation source discovery after treating each lexical prompt family as one sampling unit. */
export function renderAiAnswerCitationPromptFamilySourceRarefactionCsv(
  report: AiAnswerCitationObservationReport,
  minimumCosineSimilarity = 0.85,
  nextPromptBatchSize = 10,
  categoryMappings: Array<{ domain: string; label: string; labelKey: string }> = []
): string {
  const partition = analyzeAiAnswerCitationPromptFamilyPartition(report, minimumCosineSimilarity);
  const familyProfiles = partition.families.map(buildFamilyRarefactionProfile);
  const familyReport: AiAnswerCitationObservationReport = {
    ...report,
    prompts: familyProfiles,
    promptsTruncated: partition.promptCatalogTruncated,
  };
  const samplingMetadata: AiAnswerCitationSourceRarefactionSamplingMetadata = {
    samplingUnit: 'lexical-prompt-family',
    familySimilarityThreshold: minimumCosineSimilarity,
    familyCandidatePairsConsidered: partition.candidatePairsConsidered,
    familyHighFrequencyPostingCutoff: partition.highFrequencyPostingCutoff,
    familyCandidatePairsCapped: partition.candidatePairsCapped,
  };
  return renderAiAnswerCitationSourceRarefactionCsv(
    familyReport,
    nextPromptBatchSize,
    categoryMappings,
    samplingMetadata
  );
}

/** Render family-weighted source-discovery curves for a standalone answer-citation dashboard. */
export function renderAiAnswerCitationPromptFamilySourceRarefactionPanelHtml(
  report: AiAnswerCitationObservationReport,
  minimumCosineSimilarity = 0.85,
  nextPromptBatchSize = 10,
  categoryMappings: Array<{ domain: string; label: string; labelKey: string }> = []
): string {
  const partition = analyzeAiAnswerCitationPromptFamilyPartition(report, minimumCosineSimilarity);
  const familyReport: AiAnswerCitationObservationReport = {
    ...report,
    prompts: partition.families.map(buildFamilyRarefactionProfile),
    promptsTruncated: partition.promptCatalogTruncated,
  };
  const samplingMetadata: AiAnswerCitationSourceRarefactionSamplingMetadata = {
    samplingUnit: 'lexical-prompt-family',
    familySimilarityThreshold: minimumCosineSimilarity,
    familyCandidatePairsConsidered: partition.candidatePairsConsidered,
    familyHighFrequencyPostingCutoff: partition.highFrequencyPostingCutoff,
    familyCandidatePairsCapped: partition.candidatePairsCapped,
  };
  return renderAiAnswerCitationSourceRarefactionPanelHtml(
    familyReport,
    nextPromptBatchSize,
    categoryMappings,
    samplingMetadata
  );
}

/** Compare source discovery across standard lexical-family cutoffs using one bounded candidate graph. */
export function renderAiAnswerCitationPromptFamilySourceRarefactionThresholdSweepCsv(
  report: AiAnswerCitationObservationReport,
  selectedThreshold = 0.85,
  nextPromptBatchSize = 10,
  categoryMappings: Array<{ domain: string; label: string; labelKey: string }> = []
): string {
  const scenarios = buildPromptFamilySourceRarefactionScenarios(report, selectedThreshold);
  return renderAiAnswerCitationSourceRarefactionScenariosCsv(
    scenarios,
    nextPromptBatchSize,
    categoryMappings
  );
}

function buildPromptFamilySourceRarefactionScenarios(
  report: AiAnswerCitationObservationReport,
  selectedThreshold: number
): AiAnswerCitationSourceRarefactionScenario[] {
  if (!Number.isFinite(selectedThreshold) || selectedThreshold < 0 || selectedThreshold > 1) {
    throw new Error('Prompt-family similarity threshold must be between 0 and 1.');
  }
  const thresholds = [...new Set([...PROMPT_FAMILY_THRESHOLD_SWEEP, selectedThreshold])].sort(
    (left, right) => left - right
  );
  const candidateAnalysis = analyzePromptSimilarity(report, thresholds[0]!);
  return thresholds.map((threshold) => {
    const partition = partitionPromptFamiliesFromAnalysis(report, {
      ...candidateAnalysis,
      rows: candidateAnalysis.rows.filter(({ cosine }) => cosine >= threshold),
    });
    return {
      report: {
        ...report,
        prompts: partition.families.map(buildFamilyRarefactionProfile),
        promptsTruncated: partition.promptCatalogTruncated,
      },
      samplingMetadata: {
        samplingUnit: 'lexical-prompt-family',
        familySimilarityThreshold: threshold,
        familyCandidatePairsConsidered: partition.candidatePairsConsidered,
        familyHighFrequencyPostingCutoff: partition.highFrequencyPostingCutoff,
        familyCandidatePairsCapped: partition.candidatePairsCapped,
      },
    };
  });
}

/** Render offline family rarefaction dashboards across standard cosine cutoffs. */
export function renderAiAnswerCitationPromptFamilySourceRarefactionThresholdSweepHtml(
  report: AiAnswerCitationObservationReport,
  selectedThreshold = 0.85,
  nextPromptBatchSize = 10,
  categoryMappings: Array<{ domain: string; label: string; labelKey: string }> = []
): string {
  const scenarios = buildPromptFamilySourceRarefactionScenarios(report, selectedThreshold);
  const maximumRowsPerThreshold = Math.max(
    1,
    Math.floor(MAX_FAMILY_SOURCE_RAREFACTION_SWEEP_HTML_ROWS / scenarios.length)
  );
  const panels = scenarios.map(({ report: familyReport, samplingMetadata }) =>
    renderAiAnswerCitationSourceRarefactionPanelHtml(
      familyReport,
      nextPromptBatchSize,
      categoryMappings,
      samplingMetadata,
      maximumRowsPerThreshold
    )
  );
  const thresholdList = scenarios
    .map(
      ({ samplingMetadata }) =>
        `<span>${samplingMetadata.familySimilarityThreshold!.toFixed(2)}</span>`
    )
    .join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prompt-family source-discovery threshold sweep</title><style>:root{color-scheme:light;--paper:#f2eee4;--ink:#202722;--muted:#5c665f;--rule:#c8cfc7;--card:#fbfaf6;--pine:#20574c;--rust:#bd4b32}*{box-sizing:border-box}body{font:15px/1.58 "Avenir Next",Avenir,"Trebuchet MS",sans-serif;color:var(--ink);margin:0 auto;padding:1.2rem;max-width:1600px;background:linear-gradient(90deg,rgba(32,87,76,.035) 1px,transparent 1px),linear-gradient(rgba(32,87,76,.035) 1px,transparent 1px),var(--paper);background-size:28px 28px}h1,h2,h3{font-family:Georgia,"Times New Roman",serif;letter-spacing:-.025em}header{background:var(--card);border:1px solid var(--rule);border-top:4px solid var(--pine);padding:1.3rem;margin:1rem 0;box-shadow:0 8px 24px rgba(32,39,34,.06)}.thresholds{display:flex;flex-wrap:wrap;gap:.4rem}.thresholds span{background:#e4e9df;color:var(--pine);border:1px solid #c4cec3;border-radius:2px;padding:.25rem .55rem;font:600 .82rem ui-monospace,monospace}</style></head><body><main><header><h1>AI answer source discovery by lexical prompt family</h1><p>Compare retained-panel source discovery after grouping connected TF-IDF prompt families at multiple cosine cutoffs. The same bounded candidate graph is reused across every threshold; estimates describe the retained citations and do not forecast unobserved prompts or sources.</p><p>Cosine thresholds</p><div class="thresholds">${thresholdList}</div></header>${panels.join('')}</main></body></html>\n`;
}

interface PromptFamilySourceOverlapTable {
  headers: string[];
  rows: unknown[][];
  outputRowsTruncated: boolean;
}

function buildPromptFamilySourceOverlapTable(
  report: AiAnswerCitationObservationReport,
  partition: AiAnswerCitationPromptFamilyPartition,
  minimumCosineSimilarity = 0.85,
  categoryMappings: Array<{ domain: string; label: string; labelKey: string }> = [],
  maximumOutputRows = MAX_FAMILY_SOURCE_OVERLAP_ROWS
): PromptFamilySourceOverlapTable {
  if (categoryMappings.length > 500)
    throw new Error('Source-category overlap accepts at most 500 normalized mappings.');
  const orderedCategoryMappings = [...categoryMappings]
    .map(({ domain, label, labelKey }) => ({
      domain: domain
        .trim()
        .toLocaleLowerCase('en-US')
        .replace(/^\.+|\.+$/gu, ''),
      label,
      labelKey,
    }))
    .filter(({ domain }) => domain.length > 0)
    .sort(
      (left, right) =>
        right.domain.length - left.domain.length || left.domain.localeCompare(right.domain)
    );
  const headers = [
    'row_type',
    'prompt_family_id',
    'family_member_prompt_groups',
    'family_similarity_threshold',
    'provider_a',
    'provider_b',
    'provider_a_prompt_groups',
    'provider_b_prompt_groups',
    'shared_exact_prompt_groups',
    'exact_prompt_jaccard_percent',
    'provider_a_observations',
    'provider_b_observations',
    'provider_a_observations_with_citations',
    'provider_b_observations_with_citations',
    'provider_a_source_domain_count',
    'provider_b_source_domain_count',
    'shared_source_domains',
    'provider_a_only_source_domains',
    'provider_b_only_source_domains',
    'observed_source_domain_jaccard_percent',
    'observed_event_weighted_source_jensen_shannon_bits',
    'event_source_distribution_detail_complete',
    'observed_rank_weighted_source_jensen_shannon_bits',
    'rank_source_distribution_detail_complete',
    'owned_domains_configured',
    'provider_a_owned_source_domain_count',
    'provider_b_owned_source_domain_count',
    'shared_owned_source_domain_count',
    'observed_owned_source_domain_jaccard_percent',
    'provider_a_non_owned_source_domain_count',
    'provider_b_non_owned_source_domain_count',
    'shared_non_owned_source_domain_count',
    'observed_non_owned_source_domain_jaccard_percent',
    'shared_source_domains_sample',
    'source_category_mappings_configured',
    'provider_a_source_category_count',
    'provider_b_source_category_count',
    'shared_source_category_count',
    'observed_source_category_jaccard_percent',
    'shared_source_categories',
    'provider_a_only_source_categories',
    'provider_b_only_source_categories',
    'provider_a_only_domains_sample',
    'provider_b_only_domains_sample',
    'provider_a_source_list_complete',
    'provider_b_source_list_complete',
    'provider_a_source_list_unknown_prompt_groups',
    'provider_b_source_list_unknown_prompt_groups',
    'provider_a_incomplete_source_list_prompt_groups',
    'provider_b_incomplete_source_list_prompt_groups',
    'provider_a_domain_detail_complete',
    'provider_b_domain_detail_complete',
    'retained_prompt_catalog_truncated',
    'candidate_pairs_considered',
    'high_frequency_posting_cutoff',
    'family_candidate_pairs_capped',
    'output_rows_truncated',
    'interpretation_note',
  ];
  interface ProviderFamilyPortfolio {
    provider: string;
    promptKeys: Set<string>;
    domains: Set<string>;
    categories: Map<string, string>;
    eventWeights: Map<string, number>;
    rankWeights: Map<string, number>;
    observations: number;
    observationsWithCitations: number;
    unknownListPromptKeys: Set<string>;
    incompleteListPromptKeys: Set<string>;
    sourceListComplete: boolean;
    domainDetailComplete: boolean;
    eventSourceDetailComplete: boolean;
    rankSourceDetailComplete: boolean;
  }
  const rows: unknown[][] = [];
  let outputRowsTruncated = false;
  const ownedDomains = report.ownedDomains
    .map((domain) => domain.toLocaleLowerCase('en-US').replace(/^\.+|\.+$/gu, ''))
    .filter(Boolean);
  const ownedDomainSet = new Set(ownedDomains);
  const isOwnedDomain = (domain: string): boolean => {
    let suffix = domain;
    while (suffix.length > 0) {
      if (ownedDomainSet.has(suffix)) return true;
      const separator = suffix.indexOf('.');
      if (separator < 0) break;
      suffix = suffix.slice(separator + 1);
    }
    return false;
  };
  const note =
    'Each row compares providers that both appear in one connected TF-IDF lexical prompt family. Domain sets union retained member-prompt citations; shared-family evidence can come from different exact prompts and is not a controlled provider comparison. Exact prompt and domain overlap are descriptive for this supplied sample. Incomplete source lists or capped/missing domain detail can hide domains; lexical connectedness does not establish semantic intent or demand.';

  outer: for (const [familyIndex, members] of partition.families.entries()) {
    const portfolios = new Map<string, ProviderFamilyPortfolio>();
    for (const member of members) {
      const promptKey = normalizedPrompt(member.prompt);
      const profilesByProvider = new Map(
        (member.providerProfiles ?? []).map((profile) => [
          normalizedPrompt(profile.provider),
          profile,
        ])
      );
      for (const provider of member.providers) {
        const providerKey = normalizedPrompt(provider);
        const portfolio = portfolios.get(providerKey) ?? {
          provider,
          promptKeys: new Set<string>(),
          domains: new Set<string>(),
          categories: new Map<string, string>(),
          eventWeights: new Map<string, number>(),
          rankWeights: new Map<string, number>(),
          observations: 0,
          observationsWithCitations: 0,
          unknownListPromptKeys: new Set<string>(),
          incompleteListPromptKeys: new Set<string>(),
          sourceListComplete: true,
          domainDetailComplete: true,
          eventSourceDetailComplete: true,
          rankSourceDetailComplete: true,
        };
        portfolio.promptKeys.add(promptKey);
        const profile = profilesByProvider.get(providerKey);
        if (!profile) {
          portfolio.unknownListPromptKeys.add(promptKey);
          portfolio.sourceListComplete = false;
          portfolio.domainDetailComplete = false;
          portfolio.eventSourceDetailComplete = false;
          portfolio.rankSourceDetailComplete = false;
          portfolios.set(providerKey, portfolio);
          continue;
        }
        portfolio.observations += profile.observations;
        portfolio.observationsWithCitations += profile.observationsWithCitations;
        const incompleteCount = profile.incompleteCitationListObservations;
        if (
          Number.isSafeInteger(incompleteCount) &&
          incompleteCount! >= 0 &&
          incompleteCount! <= profile.observations
        ) {
          if (incompleteCount! > 0) {
            portfolio.incompleteListPromptKeys.add(promptKey);
            portfolio.sourceListComplete = false;
          }
        } else {
          portfolio.unknownListPromptKeys.add(promptKey);
          portfolio.sourceListComplete = false;
        }
        const domains = new Set<string>();
        for (const rawDomain of profile.citedDomains ?? []) {
          const domain = rawDomain
            .trim()
            .toLocaleLowerCase('en-US')
            .replace(/^\.+|\.+$/gu, '');
          if (domain) domains.add(domain);
        }
        for (const domain of domains) {
          portfolio.domains.add(domain);
          for (const mapping of orderedCategoryMappings) {
            if (domain === mapping.domain || domain.endsWith(`.${mapping.domain}`)) {
              portfolio.categories.set(mapping.labelKey, mapping.label);
              break;
            }
          }
        }
        if (
          Array.isArray(profile.citedDomainCitationEvents) &&
          profile.citedDomainsTruncated === false
        ) {
          let profileEventWeightTotal = 0;
          for (const detail of profile.citedDomainCitationEvents) {
            const domain = detail.domain
              .trim()
              .toLocaleLowerCase('en-US')
              .replace(/^\.+|\.+$/gu, '');
            if (domain && Number.isFinite(detail.citationEvents) && detail.citationEvents > 0) {
              portfolio.eventWeights.set(
                domain,
                (portfolio.eventWeights.get(domain) ?? 0) + detail.citationEvents
              );
              profileEventWeightTotal += detail.citationEvents;
            }
          }
          if (profileEventWeightTotal !== profile.citationEvents)
            portfolio.eventSourceDetailComplete = false;
        } else {
          portfolio.eventSourceDetailComplete = false;
        }
        if (
          Array.isArray(profile.rankWeightedDomainCitationEvents) &&
          profile.rankWeightedDomainsTruncated === false &&
          Number.isFinite(profile.rankWeightedCitationWeightTotal) &&
          profile.rankWeightedCitationWeightTotal! >= 0
        ) {
          let profileRankWeightTotal = 0;
          for (const detail of profile.rankWeightedDomainCitationEvents) {
            const domain = detail.domain
              .trim()
              .toLocaleLowerCase('en-US')
              .replace(/^\.+|\.+$/gu, '');
            if (
              domain &&
              Number.isFinite(detail.discountedCitationWeight) &&
              detail.discountedCitationWeight > 0
            ) {
              portfolio.rankWeights.set(
                domain,
                (portfolio.rankWeights.get(domain) ?? 0) + detail.discountedCitationWeight
              );
              profileRankWeightTotal += detail.discountedCitationWeight;
            }
          }
          const rankWeightTolerance = Math.max(
            1e-8,
            profile.rankWeightedCitationWeightTotal! * 1e-8
          );
          if (
            Math.abs(profileRankWeightTotal - profile.rankWeightedCitationWeightTotal!) >
            rankWeightTolerance
          ) {
            portfolio.rankSourceDetailComplete = false;
          }
        } else {
          portfolio.rankSourceDetailComplete = false;
        }
        if (
          profile.citedDomainsTruncated !== false ||
          (profile.citationEvents > 0 && domains.size === 0)
        ) {
          portfolio.domainDetailComplete = false;
        }
        portfolios.set(providerKey, portfolio);
      }
    }

    const orderedPortfolios = [...portfolios.values()].sort((left, right) =>
      left.provider.localeCompare(right.provider)
    );
    for (let leftIndex = 0; leftIndex < orderedPortfolios.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < orderedPortfolios.length; rightIndex += 1) {
        const left = orderedPortfolios[leftIndex]!;
        const right = orderedPortfolios[rightIndex]!;
        const unionPromptKeys = new Set([...left.promptKeys, ...right.promptKeys]);
        let sharedExactPromptGroups = 0;
        for (const promptKey of left.promptKeys)
          if (right.promptKeys.has(promptKey)) sharedExactPromptGroups += 1;
        const sharedDomains = [...left.domains]
          .filter((domain) => right.domains.has(domain))
          .sort((a, b) => a.localeCompare(b));
        const leftOnlyDomains = [...left.domains]
          .filter((domain) => !right.domains.has(domain))
          .sort((a, b) => a.localeCompare(b));
        const rightOnlyDomains = [...right.domains]
          .filter((domain) => !left.domains.has(domain))
          .sort((a, b) => a.localeCompare(b));
        const unionDomainCount = left.domains.size + right.domains.size - sharedDomains.length;
        const eventJsDistance =
          left.eventSourceDetailComplete && right.eventSourceDetailComplete
            ? distributionJensenShannonBits(left.eventWeights, right.eventWeights)
            : null;
        const rankJsDistance =
          left.rankSourceDetailComplete && right.rankSourceDetailComplete
            ? distributionJensenShannonBits(left.rankWeights, right.rankWeights)
            : null;
        const leftOwnedDomains =
          ownedDomains.length > 0 ? [...left.domains].filter(isOwnedDomain) : [];
        const rightOwnedDomains =
          ownedDomains.length > 0 ? [...right.domains].filter(isOwnedDomain) : [];
        const rightOwnedDomainSet = new Set(rightOwnedDomains);
        const sharedOwnedDomains = leftOwnedDomains.filter((domain) =>
          rightOwnedDomainSet.has(domain)
        );
        const ownedUnionCount =
          leftOwnedDomains.length + rightOwnedDomains.length - sharedOwnedDomains.length;
        const leftNonOwnedDomains =
          ownedDomains.length > 0
            ? [...left.domains].filter((domain) => !isOwnedDomain(domain))
            : [];
        const rightNonOwnedDomains =
          ownedDomains.length > 0
            ? [...right.domains].filter((domain) => !isOwnedDomain(domain))
            : [];
        const rightNonOwnedDomainSet = new Set(rightNonOwnedDomains);
        const sharedNonOwnedDomains = leftNonOwnedDomains.filter((domain) =>
          rightNonOwnedDomainSet.has(domain)
        );
        const nonOwnedUnionCount =
          leftNonOwnedDomains.length + rightNonOwnedDomains.length - sharedNonOwnedDomains.length;
        const leftCategoryKeys = [...left.categories.keys()];
        const rightCategoryKeys = [...right.categories.keys()];
        const sharedCategoryKeys = leftCategoryKeys
          .filter((key) => right.categories.has(key))
          .sort((a, b) => a.localeCompare(b));
        const leftOnlyCategoryKeys = leftCategoryKeys
          .filter((key) => !right.categories.has(key))
          .sort((a, b) => a.localeCompare(b));
        const rightOnlyCategoryKeys = rightCategoryKeys
          .filter((key) => !left.categories.has(key))
          .sort((a, b) => a.localeCompare(b));
        const categoryUnionCount =
          left.categories.size + right.categories.size - sharedCategoryKeys.length;
        if (rows.length === maximumOutputRows) {
          outputRowsTruncated = true;
          break outer;
        }
        rows.push([
          'family-provider-pair',
          `family-${String(familyIndex + 1).padStart(5, '0')}`,
          members.length,
          minimumCosineSimilarity,
          left.provider,
          right.provider,
          left.promptKeys.size,
          right.promptKeys.size,
          sharedExactPromptGroups,
          Number(((sharedExactPromptGroups / unionPromptKeys.size) * 100).toFixed(4)),
          left.observations,
          right.observations,
          left.observationsWithCitations,
          right.observationsWithCitations,
          left.domains.size,
          right.domains.size,
          sharedDomains.length,
          leftOnlyDomains.length,
          rightOnlyDomains.length,
          unionDomainCount > 0
            ? Number(((sharedDomains.length / unionDomainCount) * 100).toFixed(4))
            : null,
          eventJsDistance,
          left.eventSourceDetailComplete && right.eventSourceDetailComplete,
          rankJsDistance,
          left.rankSourceDetailComplete && right.rankSourceDetailComplete,
          ownedDomains.length > 0,
          ownedDomains.length > 0 ? leftOwnedDomains.length : null,
          ownedDomains.length > 0 ? rightOwnedDomains.length : null,
          ownedDomains.length > 0 ? sharedOwnedDomains.length : null,
          ownedDomains.length > 0 && ownedUnionCount > 0
            ? Number(((sharedOwnedDomains.length / ownedUnionCount) * 100).toFixed(4))
            : null,
          ownedDomains.length > 0 ? leftNonOwnedDomains.length : null,
          ownedDomains.length > 0 ? rightNonOwnedDomains.length : null,
          ownedDomains.length > 0 ? sharedNonOwnedDomains.length : null,
          ownedDomains.length > 0 && nonOwnedUnionCount > 0
            ? Number(((sharedNonOwnedDomains.length / nonOwnedUnionCount) * 100).toFixed(4))
            : null,
          sharedDomains.slice(0, 10).join(' | '),
          orderedCategoryMappings.length > 0,
          orderedCategoryMappings.length > 0 ? left.categories.size : null,
          orderedCategoryMappings.length > 0 ? right.categories.size : null,
          orderedCategoryMappings.length > 0 ? sharedCategoryKeys.length : null,
          orderedCategoryMappings.length > 0 && categoryUnionCount > 0
            ? Number(((sharedCategoryKeys.length / categoryUnionCount) * 100).toFixed(4))
            : null,
          sharedCategoryKeys
            .map((key) => left.categories.get(key) ?? right.categories.get(key) ?? key)
            .slice(0, 10)
            .join(' | '),
          leftOnlyCategoryKeys
            .map((key) => left.categories.get(key) ?? key)
            .slice(0, 10)
            .join(' | '),
          rightOnlyCategoryKeys
            .map((key) => right.categories.get(key) ?? key)
            .slice(0, 10)
            .join(' | '),
          leftOnlyDomains.slice(0, 10).join(' | '),
          rightOnlyDomains.slice(0, 10).join(' | '),
          left.sourceListComplete,
          right.sourceListComplete,
          left.unknownListPromptKeys.size,
          right.unknownListPromptKeys.size,
          left.incompleteListPromptKeys.size,
          right.incompleteListPromptKeys.size,
          left.domainDetailComplete,
          right.domainDetailComplete,
          partition.promptCatalogTruncated,
          partition.candidatePairsConsidered,
          partition.highFrequencyPostingCutoff,
          partition.candidatePairsCapped,
          false,
          note,
        ]);
      }
    }
  }
  if (outputRowsTruncated) {
    const truncatedIndex = headers.indexOf('output_rows_truncated');
    for (const row of rows) row[truncatedIndex] = true;
  }
  return { headers, rows, outputRowsTruncated };
}

/** Compare provider source-domain portfolios inside shared lexical prompt families. */
export function renderAiAnswerCitationProviderPromptFamilySourceOverlapCsv(
  report: AiAnswerCitationObservationReport,
  minimumCosineSimilarity = 0.85,
  categoryMappings: Array<{ domain: string; label: string; labelKey: string }> = []
): string {
  const partition = analyzeAiAnswerCitationPromptFamilyPartition(report, minimumCosineSimilarity);
  const table = buildPromptFamilySourceOverlapTable(
    report,
    partition,
    minimumCosineSimilarity,
    categoryMappings
  );
  return `${[table.headers, ...table.rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

/** Render a bounded, offline view of provider source-portfolio overlap inside lexical prompt families. */
export function renderAiAnswerCitationProviderPromptFamilySourceOverlapHtml(
  report: AiAnswerCitationObservationReport,
  minimumCosineSimilarity = 0.85,
  categoryMappings: Array<{ domain: string; label: string; labelKey: string }> = []
): string {
  const partition = analyzeAiAnswerCitationPromptFamilyPartition(report, minimumCosineSimilarity);
  const table = buildPromptFamilySourceOverlapTable(
    report,
    partition,
    minimumCosineSimilarity,
    categoryMappings
  );
  const column = new Map(table.headers.map((header, index) => [header, index]));
  const read = (row: unknown[], key: string): unknown => row[column.get(key) ?? -1];
  const finiteValues = (key: string): number[] =>
    table.rows
      .map((row) => read(row, key))
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const mean = (key: string): number | null => {
    const values = finiteValues(key);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };
  const overlapDivergence = (row: unknown[]): number =>
    Math.max(
      ...[
        'observed_event_weighted_source_jensen_shannon_bits',
        'observed_rank_weighted_source_jensen_shannon_bits',
      ].map((key) => {
        const value = read(row, key);
        return typeof value === 'number' && Number.isFinite(value) ? value : 0;
      })
    );
  const rows = [...table.rows].sort(
    (left, right) =>
      overlapDivergence(right) - overlapDivergence(left) ||
      String(read(left, 'provider_a')).localeCompare(String(read(right, 'provider_a'))) ||
      String(read(left, 'provider_b')).localeCompare(String(read(right, 'provider_b'))) ||
      String(read(left, 'prompt_family_id')).localeCompare(String(read(right, 'prompt_family_id')))
  );
  const dashboardRows = rows.slice(0, MAX_FAMILY_SOURCE_OVERLAP_HTML_ROWS);
  const families = new Set(rows.map((row) => read(row, 'prompt_family_id'))).size;
  const providers = new Set(
    rows.flatMap((row) => [read(row, 'provider_a'), read(row, 'provider_b')])
  ).size;
  const rowBody = dashboardRows
    .map(
      (row) =>
        `<tr><td><code>${renderFamilyHtmlValue(read(row, 'prompt_family_id'))}</code><br><span class="muted">${renderFamilyHtmlValue(read(row, 'family_member_prompt_groups'))} member groups</span></td><td>${renderFamilyHtmlValue(read(row, 'provider_a'))} ↔ ${renderFamilyHtmlValue(read(row, 'provider_b'))}<br><span class="muted">${renderFamilyHtmlValue(read(row, 'shared_exact_prompt_groups'))} shared exact prompts · Jaccard ${renderFamilyHtmlValue(read(row, 'exact_prompt_jaccard_percent'))}%</span></td><td>${renderFamilyHtmlValue(read(row, 'shared_source_domains'))}<br><span class="muted">Jaccard ${renderFamilyHtmlValue(read(row, 'observed_source_domain_jaccard_percent'))}% · A only ${renderFamilyHtmlValue(read(row, 'provider_a_only_source_domains'))} · B only ${renderFamilyHtmlValue(read(row, 'provider_b_only_source_domains'))}</span></td><td>${renderFamilyHtmlValue(read(row, 'observed_event_weighted_source_jensen_shannon_bits'))}<br><span class="muted">detail complete ${renderFamilyHtmlValue(read(row, 'event_source_distribution_detail_complete'))}</span><br><span class="muted">rank ${renderFamilyHtmlValue(read(row, 'observed_rank_weighted_source_jensen_shannon_bits'))} · detail ${renderFamilyHtmlValue(read(row, 'rank_source_distribution_detail_complete'))}</span></td><td>${renderFamilyHtmlValue(read(row, 'observed_owned_source_domain_jaccard_percent'))}% owned<br><span class="muted">${renderFamilyHtmlValue(read(row, 'observed_non_owned_source_domain_jaccard_percent'))}% non-owned</span></td><td>${renderFamilyHtmlValue(read(row, 'observed_source_category_jaccard_percent'))}%<br><span class="muted">${renderFamilyHtmlValue(read(row, 'shared_source_categories'))}</span></td><td>${renderFamilyHtmlValue(read(row, 'provider_a_source_list_complete'))} · ${renderFamilyHtmlValue(read(row, 'provider_b_source_list_complete'))}<br><span class="muted">unknown groups ${renderFamilyHtmlValue(read(row, 'provider_a_source_list_unknown_prompt_groups'))} · ${renderFamilyHtmlValue(read(row, 'provider_b_source_list_unknown_prompt_groups'))}</span><br><span class="muted">detail ${renderFamilyHtmlValue(read(row, 'provider_a_domain_detail_complete'))} · ${renderFamilyHtmlValue(read(row, 'provider_b_domain_detail_complete'))}</span></td></tr>`
    )
    .join('');
  const detailTruncated = rows.length > dashboardRows.length || table.outputRowsTruncated;
  const capNote = detailTruncated
    ? `<p class="notice">Showing ${dashboardRows.length.toLocaleString('en-US')} rows with the largest retained event/rank source divergence out of ${rows.length.toLocaleString('en-US')} emitted rows${table.outputRowsTruncated ? '; the 20,000-row CSV cap was also reached' : ''}. Review output and completeness flags before treating absent sources as gaps.</p>`
    : '';
  const emptyState =
    '<p class="empty">No provider-pair rows are available in the retained prompt-family panel.</p>';
  const meanValue = (value: number | null): string => (value === null ? '—' : value.toFixed(4));
  const tableHtml = rowBody
    ? `<div class="table-wrap"><table><thead><tr><th>Family</th><th>Provider pair and prompt support</th><th>Observed source overlap</th><th>Event · rank distribution divergence</th><th>Owned · non-owned overlap</th><th>Mapped-category overlap</th><th>Source-list completeness A · B</th></tr></thead><tbody>${rowBody}</tbody></table></div>`
    : emptyState;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Provider source overlap by prompt family</title><style>:root{color-scheme:light;--paper:#f2eee4;--ink:#202722;--muted:#5c665f;--rule:#c8cfc7;--card:#fbfaf6;--pine:#20574c;--rust:#bd4b32}*{box-sizing:border-box}body{margin:0 auto;padding:1.2rem;max-width:1600px;background:linear-gradient(90deg,rgba(32,87,76,.035) 1px,transparent 1px),linear-gradient(rgba(32,87,76,.035) 1px,transparent 1px),var(--paper);background-size:28px 28px;color:var(--ink);font:15px/1.58 "Avenir Next",Avenir,"Trebuchet MS",sans-serif}header,.panel{background:var(--card);border:1px solid var(--rule);border-radius:3px;padding:1.2rem;margin:0 0 1rem;box-shadow:0 8px 24px rgba(32,39,34,.055)}header{border-top:4px solid var(--pine)}h1,h2{font-family:Georgia,"Times New Roman",serif;letter-spacing:-.025em}h1{margin:.1rem 0 .35rem;font-size:1.8rem}h2{margin:.1rem 0 .5rem;font-size:1.2rem}.muted{color:var(--muted);font-size:.88em}.metrics{display:flex;flex-wrap:wrap;gap:.6rem;margin:.9rem 0}.metric{border:1px solid var(--rule);border-radius:3px;padding:.55rem .75rem;min-width:140px;background:#f5f2e9}.metric strong{display:block;font:600 1.05rem ui-monospace,monospace;color:var(--pine)}.table-wrap{overflow:auto;max-height:75vh;border:1px solid var(--rule);border-radius:3px}table{border-collapse:collapse;width:100%;min-width:1250px;font-size:.9rem}th,td{padding:.6rem .65rem;border-bottom:1px solid #e1e3d9;text-align:left;vertical-align:top}th{position:sticky;top:0;background:#e9ece3;z-index:1;color:#273d34;font-size:.78rem;letter-spacing:.04em;text-transform:uppercase}tbody tr:hover{background:#f0f3ea}code{font:600 .9em ui-monospace,monospace;color:var(--pine)}.notice{padding:.65rem .8rem;border-left:4px solid #b77924;background:#f7efd9}.empty{padding:1rem;background:#f5f2e9;border-radius:3px}footer{color:var(--muted);font-size:.9rem}a:focus-visible,button:focus-visible,summary:focus-visible{outline:3px solid var(--rust);outline-offset:3px}</style></head><body><main><header><h1>AI answer source portfolios inside shared lexical prompt families</h1><p>Compare providers after grouping exact prompts into connected TF-IDF wording families. Exact-prompt support stays visible beside source overlap, so a family-level match does not hide differences in which exact questions each provider answered.</p><div class="metrics"><div class="metric"><span class="muted">Families represented</span><strong>${families.toLocaleString('en-US')}</strong></div><div class="metric"><span class="muted">Provider/family rows</span><strong>${rows.length.toLocaleString('en-US')}${table.outputRowsTruncated ? '+' : ''}</strong></div><div class="metric"><span class="muted">Providers represented</span><strong>${providers.toLocaleString('en-US')}</strong></div><div class="metric"><span class="muted">Cosine cutoff</span><strong>${minimumCosineSimilarity.toFixed(2)}</strong></div><div class="metric"><span class="muted">Mean event JSD</span><strong>${meanValue(mean('observed_event_weighted_source_jensen_shannon_bits'))} bits</strong></div><div class="metric"><span class="muted">Mean rank JSD</span><strong>${meanValue(mean('observed_rank_weighted_source_jensen_shannon_bits'))} bits</strong></div></div><p class="muted">${partition.candidatePairsConsidered.toLocaleString('en-US')}${partition.candidatePairsCapped ? '+' : ''} candidate pairs · high-frequency posting cutoff ${partition.highFrequencyPostingCutoff} · ${partition.candidatePairsCapped ? 'candidate cap reached' : 'candidate cap not reached'} · ${partition.promptCatalogTruncated ? 'prompt catalog capped' : 'prompt catalog retained'}. Means are equal-row descriptive summaries across rows with complete weighted source detail.</p></header><section class="panel"><h2>Largest observed provider source-mix differences</h2><p class="muted">Jensen–Shannon divergence is 0 for identical observed mixes and 1 bit for disjoint sources. Jaccard compares distinct retained items; incomplete lists or capped detail can hide sources. Mapped-category overlap covers configured hostname mappings only.</p>${tableHtml}${capNote}</section><footer>Lexical families are wording groups rather than proof of semantic intent. No source absence is inferred from a capped or incomplete list.</footer></main></body></html>\n`;
}

/** Compare provider source overlap across standard family thresholds using one bounded candidate graph. */
export function renderAiAnswerCitationProviderPromptFamilySourceOverlapThresholdSweepCsv(
  report: AiAnswerCitationObservationReport,
  selectedThreshold = 0.85,
  categoryMappings: Array<{ domain: string; label: string; labelKey: string }> = []
): string {
  const { tables } = buildProviderPromptFamilySourceOverlapThresholdSweep(
    report,
    selectedThreshold,
    categoryMappings
  );
  const headers = tables[0]!.headers;
  const rows = tables.flatMap(({ rows: scenarioRows }) => scenarioRows);
  const outputRowsTruncated =
    tables.some(({ outputRowsTruncated: truncated }) => truncated) ||
    rows.length > MAX_FAMILY_SOURCE_OVERLAP_ROWS;
  const outputRows = rows.slice(0, MAX_FAMILY_SOURCE_OVERLAP_ROWS);
  if (outputRowsTruncated) {
    const truncatedIndex = headers.indexOf('output_rows_truncated');
    for (const row of outputRows) row[truncatedIndex] = true;
  }
  return `${[headers, ...outputRows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

interface ProviderPromptFamilySourceOverlapThresholdSweep {
  thresholds: number[];
  candidateAnalysis: ReturnType<typeof analyzePromptSimilarity>;
  tables: PromptFamilySourceOverlapTable[];
}

function buildProviderPromptFamilySourceOverlapThresholdSweep(
  report: AiAnswerCitationObservationReport,
  selectedThreshold: number,
  categoryMappings: Array<{ domain: string; label: string; labelKey: string }>
): ProviderPromptFamilySourceOverlapThresholdSweep {
  if (!Number.isFinite(selectedThreshold) || selectedThreshold < 0 || selectedThreshold > 1) {
    throw new Error('Prompt-family similarity threshold must be between 0 and 1.');
  }
  const thresholds = [...new Set([...PROMPT_FAMILY_THRESHOLD_SWEEP, selectedThreshold])].sort(
    (left, right) => left - right
  );
  const candidateAnalysis = analyzePromptSimilarity(report, thresholds[0]!);
  const maximumRowsPerThreshold = Math.floor(MAX_FAMILY_SOURCE_OVERLAP_ROWS / thresholds.length);
  const tables = thresholds.map((threshold) => {
    const partition = partitionPromptFamiliesFromAnalysis(report, {
      ...candidateAnalysis,
      rows: candidateAnalysis.rows.filter(({ cosine }) => cosine >= threshold),
    });
    return buildPromptFamilySourceOverlapTable(
      report,
      partition,
      threshold,
      categoryMappings,
      maximumRowsPerThreshold
    );
  });
  return { thresholds, candidateAnalysis, tables };
}

/** Render provider source-overlap sensitivity across family cutoffs as an offline dashboard. */
export function renderAiAnswerCitationProviderPromptFamilySourceOverlapThresholdSweepHtml(
  report: AiAnswerCitationObservationReport,
  selectedThreshold = 0.85,
  categoryMappings: Array<{ domain: string; label: string; labelKey: string }> = []
): string {
  const sweep = buildProviderPromptFamilySourceOverlapThresholdSweep(
    report,
    selectedThreshold,
    categoryMappings
  );
  const perThresholdRows = Math.max(
    1,
    Math.floor(MAX_FAMILY_SOURCE_OVERLAP_SWEEP_HTML_ROWS / sweep.thresholds.length)
  );
  const seriesDefinitions = [
    {
      key: 'observed_event_weighted_source_jensen_shannon_bits',
      label: 'Event-weighted source divergence',
      color: '#bd4b32',
    },
    {
      key: 'observed_rank_weighted_source_jensen_shannon_bits',
      label: 'Rank-weighted source divergence',
      color: '#20574c',
    },
  ];
  const summaries = sweep.tables.map((table, index) => {
    const columns = new Map(table.headers.map((header, columnIndex) => [header, columnIndex]));
    const values = new Map([
      ...seriesDefinitions.map(({ key }) => [key, [] as number[]] as const),
      ['observed_source_domain_jaccard_percent', [] as number[]] as const,
    ]);
    for (const row of table.rows) {
      for (const key of values.keys()) {
        const value = row[columns.get(key) ?? -1];
        if (typeof value === 'number' && Number.isFinite(value)) values.get(key)!.push(value);
      }
    }
    const means = Object.fromEntries(
      [...values].map(([key, items]) => [
        key,
        items.length ? items.reduce((sum, value) => sum + value, 0) / items.length : null,
      ])
    );
    return {
      threshold: sweep.thresholds[index]!,
      table,
      means,
      divergenceSupport: Math.max(
        0,
        ...seriesDefinitions.map(({ key }) => values.get(key)!.length)
      ),
    };
  });
  const width = 980;
  const height = 350;
  const left = 64;
  const right = 28;
  const top = 28;
  const bottom = 62;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const x = (index: number): number =>
    left + (sweep.thresholds.length > 1 ? index / (sweep.thresholds.length - 1) : 0.5) * chartWidth;
  const y = (value: number): number =>
    top + chartHeight - Math.max(0, Math.min(1, value)) * chartHeight;
  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map(
      (value) =>
        `<g><line x1="${left}" y1="${y(value)}" x2="${width - right}" y2="${y(value)}" stroke="currentColor" opacity=".14"/><text x="${left - 10}" y="${y(value) + 4}" text-anchor="end">${value.toFixed(2)}</text></g>`
    )
    .join('');
  const xLabels = sweep.thresholds
    .map(
      (threshold, index) =>
        `<text x="${x(index)}" y="${height - 34}" text-anchor="middle">${threshold.toFixed(2)}</text>`
    )
    .join('');
  const lines = seriesDefinitions
    .map(({ key, label, color }) => {
      const points = summaries.map((summary, index) => {
        const value = summary.means[key];
        return value === null ? null : { x: x(index), y: y(value) };
      });
      const segments = points
        .slice(1)
        .map((point, index) => {
          const previous = points[index];
          return point && previous
            ? `<line x1="${previous.x}" y1="${previous.y}" x2="${point.x}" y2="${point.y}" stroke="${color}" stroke-width="3"/>`
            : '';
        })
        .join('');
      const markers = points
        .map((point, index) =>
          point
            ? `<circle cx="${point.x}" cy="${point.y}" r="4" fill="${color}"><title>${label} at ${sweep.thresholds[index]!.toFixed(2)}: ${summaries[index]!.means[key]!.toFixed(4)} bits</title></circle>`
            : ''
        )
        .join('');
      return `${segments}${markers}`;
    })
    .join('');
  const legend = seriesDefinitions
    .map(
      ({ label, color }) =>
        `<span><i style="background:${color}"></i>${escapeFamilyHtml(label)}</span>`
    )
    .join('');
  const score = (headers: string[], row: unknown[]): number => {
    const columns = new Map(headers.map((header, index) => [header, index]));
    return Math.max(
      ...seriesDefinitions.map(({ key }) => {
        const value = row[columns.get(key) ?? -1];
        return typeof value === 'number' && Number.isFinite(value) ? value : 0;
      })
    );
  };
  const sections = summaries
    .map(({ threshold, table }) => {
      const columns = new Map(table.headers.map((header, index) => [header, index]));
      const read = (row: unknown[], key: string): unknown => row[columns.get(key) ?? -1];
      const rows = [...table.rows]
        .sort(
          (first, second) =>
            score(table.headers, second) - score(table.headers, first) ||
            String(read(first, 'provider_a')).localeCompare(String(read(second, 'provider_a'))) ||
            String(read(first, 'provider_b')).localeCompare(String(read(second, 'provider_b'))) ||
            String(read(first, 'prompt_family_id')).localeCompare(
              String(read(second, 'prompt_family_id'))
            )
        )
        .slice(0, perThresholdRows);
      const body = rows
        .map(
          (row) =>
            `<tr><td><code>${renderFamilyHtmlValue(read(row, 'prompt_family_id'))}</code><br><span class="muted">${renderFamilyHtmlValue(read(row, 'family_member_prompt_groups'))} prompt groups</span></td><td>${renderFamilyHtmlValue(read(row, 'provider_a'))} ↔ ${renderFamilyHtmlValue(read(row, 'provider_b'))}<br><span class="muted">${renderFamilyHtmlValue(read(row, 'shared_exact_prompt_groups'))} shared prompts · ${renderFamilyHtmlValue(read(row, 'exact_prompt_jaccard_percent'))}% Jaccard</span></td><td>${renderFamilyHtmlValue(read(row, 'observed_source_domain_jaccard_percent'))}% domain Jaccard<br><span class="muted">${renderFamilyHtmlValue(read(row, 'shared_source_domains'))} shared domains</span></td><td>${renderFamilyHtmlValue(read(row, 'observed_event_weighted_source_jensen_shannon_bits'))} · ${renderFamilyHtmlValue(read(row, 'observed_rank_weighted_source_jensen_shannon_bits'))}</td><td>${renderFamilyHtmlValue(read(row, 'observed_owned_source_domain_jaccard_percent'))}% owned · ${renderFamilyHtmlValue(read(row, 'observed_non_owned_source_domain_jaccard_percent'))}% non-owned</td><td>${renderFamilyHtmlValue(read(row, 'observed_source_category_jaccard_percent'))}%<br><span class="muted">${renderFamilyHtmlValue(read(row, 'shared_source_categories'))}</span></td><td>${renderFamilyHtmlValue(read(row, 'provider_a_source_list_complete'))} · ${renderFamilyHtmlValue(read(row, 'provider_b_source_list_complete'))}<br><span class="muted">detail ${renderFamilyHtmlValue(read(row, 'provider_a_domain_detail_complete'))} · ${renderFamilyHtmlValue(read(row, 'provider_b_domain_detail_complete'))}</span></td></tr>`
        )
        .join('');
      const capped = table.outputRowsTruncated || table.rows.length > rows.length;
      return `<details class="threshold-panel"${threshold === selectedThreshold ? ' open' : ''}><summary>Cosine threshold ${threshold.toFixed(2)} · ${table.rows.length.toLocaleString('en-US')} retained pair/family rows${table.outputRowsTruncated ? ' · export capped' : ''}</summary><div class="table-wrap"><table><thead><tr><th>Family</th><th>Provider pair and support</th><th>Domain overlap</th><th>Event · rank divergence</th><th>Owned · non-owned Jaccard</th><th>Mapped-category Jaccard</th><th>List completeness A · B</th></tr></thead><tbody>${body}</tbody></table></div>${capped ? `<p class="muted">Showing the ${rows.length} highest-divergence rows from ${table.rows.length.toLocaleString('en-US')} retained rows${table.outputRowsTruncated ? '; CSV cap reached' : ''}.</p>` : ''}</details>`;
    })
    .join('');
  const anyTruncated =
    sweep.tables.some(({ outputRowsTruncated }) => outputRowsTruncated) ||
    summaries.some(({ table }) => table.rows.length > perThresholdRows);
  const means = (key: string): number | null => {
    const values = summaries
      .map(({ means: summaryMeans }) => summaryMeans[key])
      .filter((value): value is number => typeof value === 'number');
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };
  const meanValue = (value: number | null): string => (value === null ? '—' : value.toFixed(4));
  const chartRows = summaries
    .map(
      (summary) =>
        `<tr><td>${summary.threshold.toFixed(2)}</td><td>${summary.divergenceSupport.toLocaleString('en-US')}</td><td>${summary.means[seriesDefinitions[0]!.key] === null ? '—' : summary.means[seriesDefinitions[0]!.key]!.toFixed(4)}</td><td>${summary.means[seriesDefinitions[1]!.key] === null ? '—' : summary.means[seriesDefinitions[1]!.key]!.toFixed(4)}</td><td>${summary.means.observed_source_domain_jaccard_percent === null ? '—' : summary.means.observed_source_domain_jaccard_percent!.toFixed(2) + '%'}</td><td>${summary.table.rows.length.toLocaleString('en-US')}${summary.table.outputRowsTruncated ? '+' : ''}</td></tr>`
    )
    .join('');
  const candidateLabel = sweep.candidateAnalysis.candidatePairsCapped
    ? 'candidate cap reached'
    : 'candidate cap not reached';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Provider prompt-family source-overlap threshold sweep</title><style>:root{color-scheme:light;--paper:#f2eee4;--ink:#202722;--muted:#5c665f;--rule:#c8cfc7;--card:#fbfaf6;--pine:#20574c;--rust:#bd4b32}*{box-sizing:border-box}body{margin:0 auto;padding:1.2rem;max-width:1550px;background:linear-gradient(90deg,rgba(32,87,76,.035) 1px,transparent 1px),linear-gradient(rgba(32,87,76,.035) 1px,transparent 1px),var(--paper);background-size:28px 28px;color:var(--ink);font:15px/1.58 "Avenir Next",Avenir,"Trebuchet MS",sans-serif}header,.panel,.threshold-panel{background:var(--card);border:1px solid var(--rule);border-radius:3px;padding:1rem 1.2rem;margin:0 0 1rem;box-shadow:0 8px 24px rgba(32,39,34,.05)}header{border-top:4px solid var(--pine)}h1,h2{font-family:Georgia,"Times New Roman",serif;letter-spacing:-.025em}h1{margin:.1rem 0 .35rem;font-size:1.8rem}h2{margin:.1rem 0 .5rem;font-size:1.2rem}.muted{color:var(--muted);font-size:.88em}.chart-wrap{overflow:auto}.chart{display:block;width:100%;min-width:700px;height:auto;color:#526174;background:#f8f6ee;border:1px solid var(--rule);padding:.5rem}.chart text{font:12px ui-monospace,monospace;fill:currentColor}.legend{display:flex;flex-wrap:wrap;gap:.8rem;margin:.7rem 0}.legend span{display:inline-flex;align-items:center;gap:.35rem}.legend i{width:11px;height:11px;border-radius:50%;display:inline-block}.table-wrap{overflow:auto;max-height:65vh;border:1px solid var(--rule);border-radius:3px}table{border-collapse:collapse;width:100%;min-width:1000px;font-size:.9rem}th,td{padding:.55rem .65rem;border-bottom:1px solid #e1e3d9;text-align:left;vertical-align:top}th{position:sticky;top:0;background:#e9ece3;z-index:1;color:#273d34;font-size:.78rem;letter-spacing:.04em;text-transform:uppercase}tbody tr:hover{background:#f0f3ea}code{font:600 .9em ui-monospace,monospace;color:var(--pine)}.threshold-panel summary{cursor:pointer;font-weight:650;color:var(--pine)}.notice{padding:.7rem .9rem;border-left:4px solid #b77924;background:#f7efd9}a:focus-visible,button:focus-visible,summary:focus-visible{outline:3px solid var(--rust);outline-offset:3px}</style></head><body><main><header><h1>Provider citation portfolios by lexical prompt family</h1><p>Compare event- and rank-weighted source mixes for provider pairs across TF-IDF family cutoffs. The same bounded candidate graph is reused at every threshold. The plot summarizes retained provider/family rows and exposes when source-detail caps prevent a comparable distribution.</p><p class="muted">${sweep.thresholds.length} cutoffs · ${sweep.candidateAnalysis.candidatePairCount.toLocaleString('en-US')}${sweep.candidateAnalysis.candidatePairsCapped ? '+' : ''} candidate pairs · high-frequency posting cutoff ${sweep.candidateAnalysis.highFrequencyCutoff} · ${candidateLabel} · ${sweep.candidateAnalysis.promptCatalogTruncated ? 'prompt catalog capped' : 'prompt catalog retained'}</p></header><section class="panel"><h2>Mean provider source divergence by cutoff</h2><p class="muted">Jensen–Shannon divergence runs from 0 (same observed distribution) to 1 bit (disjoint sources). Domain Jaccard is shown in the summary table because it measures distinct-domain overlap rather than distribution divergence. Means are equal-row summaries of retained provider/family rows, not significance tests.</p><div class="legend">${legend}</div><div class="chart-wrap"><svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="overlap-sweep-chart-title overlap-sweep-chart-desc"><title id="overlap-sweep-chart-title">Provider source distribution divergence by lexical cutoff</title><desc id="overlap-sweep-chart-desc">Event-weighted and rank-weighted mean Jensen–Shannon divergence across retained provider/family rows for each cosine threshold.</desc>${grid}${lines}${xLabels}<text x="${left + chartWidth / 2}" y="${height - 10}" text-anchor="middle">TF-IDF cosine threshold</text></svg></div><div class="table-wrap"><table><thead><tr><th>Threshold</th><th>Max supported rows</th><th>Mean event divergence</th><th>Mean rank divergence</th><th>Mean domain Jaccard</th><th>Retained rows</th></tr></thead><tbody>${chartRows}</tbody></table></div>${anyTruncated ? '<p class="notice">At least one threshold row set was capped. Means use retained CSV rows; expanded detail shows only the highest-divergence families per cutoff.</p>' : ''}<p class="muted">Mean event divergence ${meanValue(means(seriesDefinitions[0]!.key))} bits · mean rank divergence ${meanValue(means(seriesDefinitions[1]!.key))} bits across threshold summaries.</p></section><section class="panel"><h2>Highest-divergence provider/family pairs</h2><p class="muted">Family-level overlap does not imply exact questions matched. List and domain-detail completeness are shown for both providers before interpreting missing domains.</p>${sections}</section><footer class="muted">The report summarizes supplied retained citations and does not infer unseen sources, semantic intent, or causal provider effects.</footer></main></body></html>\n`;
}

interface PromptFamilySourceWeightProfile {
  eventWeights: Map<string, number>;
  rankWeights: Map<string, number>;
  eventDetailComplete: boolean;
  rankDetailComplete: boolean;
}

function findPromptProviderProfile(
  prompt: AiAnswerCitationPromptProfile | undefined,
  providerKey: string
): AiAnswerCitationPromptProviderProfile | undefined {
  return prompt?.providerProfiles?.find(
    (profile) => normalizedPrompt(profile.provider) === providerKey
  );
}

function arePromptFamilyMatchedSourceListsComplete(
  members: AiAnswerCitationPromptProfile[],
  providerKey: string,
  includedPromptKeys: Set<string>
): boolean {
  if (includedPromptKeys.size === 0) return false;
  for (const member of members) {
    if (!includedPromptKeys.has(normalizedPrompt(member.prompt))) continue;
    const profile = findPromptProviderProfile(member, providerKey);
    if (
      !profile ||
      !Number.isSafeInteger(profile.incompleteCitationListObservations) ||
      profile.incompleteCitationListObservations !== 0
    )
      return false;
  }
  return true;
}

function aggregatePromptFamilySourceWeights(
  members: AiAnswerCitationPromptProfile[],
  providerKey: string,
  includedPromptKeys?: Set<string>,
  equalPromptWeight = false
): PromptFamilySourceWeightProfile {
  const result: PromptFamilySourceWeightProfile = {
    eventWeights: new Map(),
    rankWeights: new Map(),
    eventDetailComplete: true,
    rankDetailComplete: true,
  };
  for (const member of members) {
    if (includedPromptKeys && !includedPromptKeys.has(normalizedPrompt(member.prompt))) continue;
    const provider = member.providers.find(
      (candidate) => normalizedPrompt(candidate) === providerKey
    );
    if (!provider) continue;
    const profile = (member.providerProfiles ?? []).find(
      (candidate) => normalizedPrompt(candidate.provider) === providerKey
    );
    if (!profile) {
      result.eventDetailComplete = false;
      result.rankDetailComplete = false;
      continue;
    }
    const eventDetails = profile.citedDomainCitationEvents;
    const promptEventWeights = new Map<string, number>();
    let eventTotal = 0;
    let eventDetailsValid = Array.isArray(eventDetails) && profile.citedDomainsTruncated === false;
    if (Array.isArray(eventDetails)) {
      for (const detail of eventDetails) {
        const domain = detail.domain
          .trim()
          .toLocaleLowerCase('en-US')
          .replace(/^\.+|\.+$/gu, '');
        if (!domain || !Number.isSafeInteger(detail.citationEvents) || detail.citationEvents < 0) {
          eventDetailsValid = false;
          continue;
        }
        eventTotal += detail.citationEvents;
        promptEventWeights.set(
          domain,
          (promptEventWeights.get(domain) ?? 0) + detail.citationEvents
        );
      }
    }
    if (!eventDetailsValid || eventTotal !== profile.citationEvents)
      result.eventDetailComplete = false;
    else {
      for (const [domain, weight] of promptEventWeights) {
        const contribution = equalPromptWeight && eventTotal > 0 ? weight / eventTotal : weight;
        result.eventWeights.set(domain, (result.eventWeights.get(domain) ?? 0) + contribution);
      }
    }

    const rankDetails = profile.rankWeightedDomainCitationEvents;
    const expectedRankTotal = profile.rankWeightedCitationWeightTotal;
    const promptRankWeights = new Map<string, number>();
    let rankTotal = 0;
    let rankDetailsValid =
      Array.isArray(rankDetails) &&
      profile.rankWeightedDomainsTruncated === false &&
      Number.isFinite(expectedRankTotal) &&
      expectedRankTotal! >= 0;
    if (Array.isArray(rankDetails)) {
      for (const detail of rankDetails) {
        const domain = detail.domain
          .trim()
          .toLocaleLowerCase('en-US')
          .replace(/^\.+|\.+$/gu, '');
        if (
          !domain ||
          !Number.isFinite(detail.discountedCitationWeight) ||
          detail.discountedCitationWeight < 0
        ) {
          rankDetailsValid = false;
          continue;
        }
        rankTotal += detail.discountedCitationWeight;
        promptRankWeights.set(
          domain,
          (promptRankWeights.get(domain) ?? 0) + detail.discountedCitationWeight
        );
      }
    }
    if (Number.isFinite(expectedRankTotal)) {
      const tolerance = Math.max(1e-8, expectedRankTotal! * 1e-8);
      if (
        Math.abs(rankTotal - expectedRankTotal!) > tolerance ||
        (profile.citationEvents > 0
          ? expectedRankTotal! <= 0 || expectedRankTotal! > profile.citationEvents + tolerance
          : expectedRankTotal !== 0)
      ) {
        rankDetailsValid = false;
      }
    }
    if (!rankDetailsValid) result.rankDetailComplete = false;
    else {
      for (const [domain, weight] of promptRankWeights) {
        const contribution = equalPromptWeight && rankTotal > 0 ? weight / rankTotal : weight;
        result.rankWeights.set(domain, (result.rankWeights.get(domain) ?? 0) + contribution);
      }
    }
  }
  return result;
}

function aggregatePromptFamilyCategoryWeights(
  sourceWeights: Map<string, number>,
  categoryMappingsByDomain: Map<string, string>
): { categoryWeights: Map<string, number>; mappedSharePercent: number | null } {
  const categoryWeights = new Map<string, number>();
  const totalWeight = [...sourceWeights.values()].reduce((sum, weight) => sum + weight, 0);
  let mappedWeight = 0;
  for (const [domain, weight] of sourceWeights) {
    let suffix = domain;
    let categoryKey: string | undefined;
    while (suffix) {
      categoryKey = categoryMappingsByDomain.get(suffix);
      if (categoryKey) break;
      const separator = suffix.indexOf('.');
      if (separator < 0) break;
      suffix = suffix.slice(separator + 1);
    }
    if (!categoryKey) continue;
    categoryWeights.set(categoryKey, (categoryWeights.get(categoryKey) ?? 0) + weight);
    mappedWeight += weight;
  }
  return {
    categoryWeights,
    mappedSharePercent:
      totalWeight > 0 ? Number(((mappedWeight / totalWeight) * 100).toFixed(4)) : null,
  };
}

function summarizePromptFamilySourceWeightShifts(
  baselineWeights: Map<string, number>,
  currentWeights: Map<string, number>,
  detailComplete: boolean
): string | null {
  if (!detailComplete) return null;
  const baselineTotal = [...baselineWeights.values()].reduce((sum, weight) => sum + weight, 0);
  const currentTotal = [...currentWeights.values()].reduce((sum, weight) => sum + weight, 0);
  const shifts = [...new Set([...baselineWeights.keys(), ...currentWeights.keys()])]
    .map((domain) => {
      const baselineShare =
        baselineTotal > 0
          ? Number((((baselineWeights.get(domain) ?? 0) / baselineTotal) * 100).toFixed(4))
          : null;
      const currentShare =
        currentTotal > 0
          ? Number((((currentWeights.get(domain) ?? 0) / currentTotal) * 100).toFixed(4))
          : null;
      const change =
        baselineShare !== null && currentShare !== null
          ? Number((currentShare - baselineShare).toFixed(4))
          : null;
      return {
        domain,
        baseline_share_percent: baselineShare,
        current_share_percent: currentShare,
        change_percentage_points: change,
      };
    })
    .filter(
      ({ domain }) =>
        (baselineWeights.get(domain) ?? 0) > 0 || (currentWeights.get(domain) ?? 0) > 0
    )
    .sort(
      (left, right) =>
        Math.abs(right.change_percentage_points ?? right.current_share_percent ?? 0) -
          Math.abs(left.change_percentage_points ?? left.current_share_percent ?? 0) ||
        left.domain.localeCompare(right.domain)
    )
    .slice(0, 5);
  return shifts.length > 0 ? JSON.stringify(shifts) : null;
}

/** Compare provider source-domain portfolios across baseline/current lexical prompt families. */
export function renderAiAnswerCitationPromptFamilyPeriodComparisonCsv(
  baselineReport: AiAnswerCitationObservationReport,
  currentReport: AiAnswerCitationObservationReport,
  minimumCosineSimilarity = 0.85,
  categoryMappings: Array<{ domain: string; label: string; labelKey: string }> = []
): string {
  if (
    !Number.isFinite(minimumCosineSimilarity) ||
    minimumCosineSimilarity < 0 ||
    minimumCosineSimilarity > 1
  ) {
    throw new Error('Prompt-family similarity threshold must be between 0 and 1.');
  }
  const combinedReport = buildCombinedPromptFamilyPeriodReport(baselineReport, currentReport);
  const candidateAnalysis = analyzePromptSimilarity(combinedReport, minimumCosineSimilarity);
  const table = renderPromptFamilyPeriodComparisonTable(
    baselineReport,
    currentReport,
    combinedReport,
    minimumCosineSimilarity,
    categoryMappings,
    candidateAnalysis,
    MAX_OUTPUT_ROWS
  );
  return `${[table.headers, ...table.rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

/** Reuse one union prompt catalog and candidate graph for period-comparison threshold sweeps. */
export function renderAiAnswerCitationPromptFamilyPeriodComparisonThresholdSweepCsv(
  baselineReport: AiAnswerCitationObservationReport,
  currentReport: AiAnswerCitationObservationReport,
  selectedThreshold = 0.85,
  categoryMappings: Array<{ domain: string; label: string; labelKey: string }> = []
): string {
  const { tables } = buildPromptFamilyPeriodComparisonThresholdSweep(
    baselineReport,
    currentReport,
    selectedThreshold,
    categoryMappings
  );
  const headers = tables[0]!.headers;
  const rows = tables.flatMap(({ rows: tableRows }) => tableRows);
  const outputRowsTruncated =
    tables.some(({ outputRowsTruncated: truncated }) => truncated) || rows.length > MAX_OUTPUT_ROWS;
  const outputRows = rows.slice(0, MAX_OUTPUT_ROWS);
  if (outputRowsTruncated) {
    const truncatedIndex = headers.indexOf('output_rows_truncated');
    for (const row of outputRows) row[truncatedIndex] = true;
  }
  return `${[headers, ...outputRows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

/** Export a compact, family-clustered summary of longitudinal source divergence by cutoff. */
export function renderAiAnswerCitationPromptFamilyPeriodComparisonThresholdSweepSummaryCsv(
  baselineReport: AiAnswerCitationObservationReport,
  currentReport: AiAnswerCitationObservationReport,
  selectedThreshold = 0.85,
  categoryMappings: Array<{ domain: string; label: string; labelKey: string }> = []
): string {
  const sweep = buildPromptFamilyPeriodComparisonThresholdSweep(
    baselineReport,
    currentReport,
    selectedThreshold,
    categoryMappings
  );
  const { summaries, usableBootstrapIterations } =
    summarizePromptFamilyPeriodComparisonThresholdSweep(sweep);
  const intervalNote =
    'Equal-family means average available provider rows within each lexical family, then weight families equally. Percentile-bootstrap intervals resample whole lexical families, conditional on the cutoff and retained data; they are not population guarantees.';
  const rows = summaries.map((summary) => {
    const row: Record<string, unknown> = {
      row_type: 'threshold-summary',
      cosine_threshold: Number(summary.threshold.toFixed(4)),
      supported_lexical_families: summary.metricSupport,
      retained_provider_family_rows: summary.table.rows.length,
      threshold_rows_truncated: summary.outputRowsTruncated,
      candidate_pairs_considered: sweep.candidateAnalysis.candidatePairCount,
      high_frequency_posting_cutoff: sweep.candidateAnalysis.highFrequencyCutoff,
      prompt_catalog_truncated: sweep.candidateAnalysis.promptCatalogTruncated,
      candidate_pairs_capped: sweep.candidateAnalysis.candidatePairsCapped,
      family_bootstrap_iterations: usableBootstrapIterations,
      interval_state: summary.intervalState,
      interpretation_note: intervalNote,
    };
    for (const key of PROMPT_FAMILY_PERIOD_DIVERGENCE_KEYS) {
      const interval = summary.intervals.get(key);
      row[`${key}_equal_family_mean_bits`] = summary.means[key] ?? '';
      row[`${key}_family_bootstrap_ci95_lower_bits`] = interval?.lower ?? '';
      row[`${key}_family_bootstrap_ci95_upper_bits`] = interval?.upper ?? '';
      row[`${key}_family_bootstrap_ci95_state`] =
        summary.intervalStates.get(key) ?? summary.intervalState;
    }
    return row;
  });
  const headers = [
    'row_type',
    'cosine_threshold',
    'supported_lexical_families',
    'retained_provider_family_rows',
    'threshold_rows_truncated',
    'candidate_pairs_considered',
    'high_frequency_posting_cutoff',
    'prompt_catalog_truncated',
    'candidate_pairs_capped',
    'family_bootstrap_iterations',
    'interval_state',
    ...PROMPT_FAMILY_PERIOD_DIVERGENCE_KEYS.flatMap((key) => [
      `${key}_equal_family_mean_bits`,
      `${key}_family_bootstrap_ci95_lower_bits`,
      `${key}_family_bootstrap_ci95_upper_bits`,
      `${key}_family_bootstrap_ci95_state`,
    ]),
    'interpretation_note',
  ];
  const csvRows = rows.map((row) => headers.map((header) => csvCell(row[header] ?? '')).join(','));
  return `${[headers.map(csvCell).join(','), ...csvRows].join('\r\n')}\r\n`;
}

interface PromptFamilyPeriodComparisonThresholdSweep {
  thresholds: number[];
  combinedReport: AiAnswerCitationObservationReport;
  candidateAnalysis: ReturnType<typeof analyzePromptSimilarity>;
  tables: Array<ReturnType<typeof renderPromptFamilyPeriodComparisonTable>>;
}

function buildPromptFamilyPeriodComparisonThresholdSweep(
  baselineReport: AiAnswerCitationObservationReport,
  currentReport: AiAnswerCitationObservationReport,
  selectedThreshold: number,
  categoryMappings: Array<{ domain: string; label: string; labelKey: string }>
): PromptFamilyPeriodComparisonThresholdSweep {
  if (!Number.isFinite(selectedThreshold) || selectedThreshold < 0 || selectedThreshold > 1) {
    throw new Error('Prompt-family similarity threshold must be between 0 and 1.');
  }
  const thresholds = [...new Set([...PROMPT_FAMILY_THRESHOLD_SWEEP, selectedThreshold])].sort(
    (left, right) => left - right
  );
  const combinedReport = buildCombinedPromptFamilyPeriodReport(baselineReport, currentReport);
  const candidateAnalysis = analyzePromptSimilarity(combinedReport, thresholds[0]!);
  const maxRowsPerThreshold = Math.floor(MAX_OUTPUT_ROWS / thresholds.length);
  const tables = thresholds.map((threshold) =>
    renderPromptFamilyPeriodComparisonTable(
      baselineReport,
      currentReport,
      combinedReport,
      threshold,
      categoryMappings,
      candidateAnalysis,
      maxRowsPerThreshold
    )
  );
  return { thresholds, combinedReport, candidateAnalysis, tables };
}

interface PromptFamilyPeriodComparisonThresholdSummary {
  threshold: number;
  table: ReturnType<typeof renderPromptFamilyPeriodComparisonTable>;
  means: Record<string, number | null>;
  familyMeans: Map<string, number[]>;
  intervals: Map<string, { lower: number; upper: number } | null>;
  intervalStates: Map<string, string>;
  intervalState: string;
  metricSupport: number;
  outputRowsTruncated: boolean;
}

interface PromptFamilyPeriodComparisonThresholdSummaries {
  summaries: PromptFamilyPeriodComparisonThresholdSummary[];
  bootstrapIterations: number;
  usableBootstrapIterations: number;
  graphComplete: boolean;
}

function summarizePromptFamilyPeriodComparisonThresholdSweep(
  sweep: PromptFamilyPeriodComparisonThresholdSweep
): PromptFamilyPeriodComparisonThresholdSummaries {
  const summaries = sweep.tables.map(
    (table, index): PromptFamilyPeriodComparisonThresholdSummary => {
      const column = new Map(table.headers.map((header, columnIndex) => [header, columnIndex]));
      const metricsByFamily = new Map<string, Map<string, number[]>>();
      for (const row of table.rows) {
        const familyId = String(row[column.get('prompt_family_id') ?? -1] ?? '');
        if (!familyId) continue;
        const familyMetrics = metricsByFamily.get(familyId) ?? new Map<string, number[]>();
        for (const key of PROMPT_FAMILY_PERIOD_DIVERGENCE_KEYS) {
          const value = row[column.get(key) ?? -1];
          if (typeof value === 'number' && Number.isFinite(value)) {
            const values = familyMetrics.get(key) ?? [];
            values.push(value);
            familyMetrics.set(key, values);
          }
        }
        metricsByFamily.set(familyId, familyMetrics);
      }
      const familyMeans = new Map<string, number[]>(
        PROMPT_FAMILY_PERIOD_DIVERGENCE_KEYS.map((key) => [
          key,
          [...metricsByFamily.values()]
            .map((familyMetrics) => familyMetrics.get(key))
            .filter((values): values is number[] => values !== undefined && values.length > 0)
            .map((values) => values.reduce((sum, value) => sum + value, 0) / values.length),
        ])
      );
      const means = Object.fromEntries(
        [...familyMeans].map(([key, values]) => [
          key,
          values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
        ])
      ) as Record<string, number | null>;
      return {
        threshold: sweep.thresholds[index]!,
        table,
        means,
        familyMeans,
        intervals: new Map<string, { lower: number; upper: number } | null>(),
        intervalStates: new Map<string, string>(),
        intervalState: 'pending',
        metricSupport: Math.max(0, ...[...familyMeans.values()].map((values) => values.length)),
        outputRowsTruncated: table.outputRowsTruncated,
      };
    }
  );
  const graphComplete =
    !sweep.candidateAnalysis.promptCatalogTruncated &&
    !sweep.candidateAnalysis.candidatePairsCapped;
  const bootstrapSupport = graphComplete
    ? summaries
        .filter((summary) => !summary.outputRowsTruncated && summary.metricSupport >= 2)
        .reduce(
          (sum, summary) =>
            sum +
            [...summary.familyMeans.values()].reduce((inner, values) => inner + values.length, 0),
          0
        )
    : 0;
  const bootstrapIterations =
    bootstrapSupport > 0
      ? Math.min(
          FAMILY_BOOTSTRAP_ITERATIONS,
          Math.floor(MAX_FAMILY_BOOTSTRAP_DRAWS / bootstrapSupport)
        )
      : 0;
  const usableBootstrapIterations =
    bootstrapIterations >= MIN_FAMILY_BOOTSTRAP_ITERATIONS ? bootstrapIterations : 0;
  for (const summary of summaries) {
    summary.intervalState = !graphComplete
      ? 'prompt-or-candidate-catalog-incomplete'
      : summary.outputRowsTruncated
        ? 'threshold-row-cap-incomplete'
        : summary.metricSupport < 2
          ? 'insufficient-lexical-families'
          : usableBootstrapIterations < MIN_FAMILY_BOOTSTRAP_ITERATIONS
            ? 'budget-limited'
            : 'available';
    for (const [key, familyMeansForMetric] of summary.familyMeans) {
      const metricState = !graphComplete
        ? 'prompt-or-candidate-catalog-incomplete'
        : summary.outputRowsTruncated
          ? 'threshold-row-cap-incomplete'
          : familyMeansForMetric.length < 2
            ? 'insufficient-lexical-families'
            : usableBootstrapIterations < MIN_FAMILY_BOOTSTRAP_ITERATIONS
              ? 'budget-limited'
              : 'available';
      const interval =
        metricState === 'available'
          ? bootstrapFamilyMeanInterval(
              familyMeansForMetric,
              `period-family-threshold\u0000${summary.threshold}\u0000${key}`,
              usableBootstrapIterations,
              1
            )
          : null;
      summary.intervals.set(key, interval);
      summary.intervalStates.set(key, metricState);
    }
  }
  return { summaries, bootstrapIterations, usableBootstrapIterations, graphComplete };
}

/** Render an offline dashboard of longitudinal source-mix sensitivity across family cutoffs. */
export function renderAiAnswerCitationPromptFamilyPeriodComparisonThresholdSweepHtml(
  baselineReport: AiAnswerCitationObservationReport,
  currentReport: AiAnswerCitationObservationReport,
  selectedThreshold = 0.85,
  categoryMappings: Array<{ domain: string; label: string; labelKey: string }> = []
): string {
  const sweep = buildPromptFamilyPeriodComparisonThresholdSweep(
    baselineReport,
    currentReport,
    selectedThreshold,
    categoryMappings
  );
  const allRows = sweep.tables.flatMap(({ rows }) => rows);
  const htmlRowsPerThreshold = Math.max(
    1,
    Math.floor(MAX_PERIOD_COMPARISON_SWEEP_HTML_ROWS / sweep.thresholds.length)
  );
  const seriesDefinitions = [
    {
      key: 'observed_event_weighted_source_jensen_shannon_bits',
      label: 'All prompts · event weighted',
      color: '#245fe5',
    },
    {
      key: 'observed_rank_weighted_source_jensen_shannon_bits',
      label: 'All prompts · rank weighted',
      color: '#e37b20',
    },
    {
      key: 'matched_equal_prompt_event_source_jensen_shannon_bits',
      label: 'Matched prompts · event weighted',
      color: '#16815c',
    },
    {
      key: 'matched_equal_prompt_rank_source_jensen_shannon_bits',
      label: 'Matched prompts · rank weighted',
      color: '#8b5cf6',
    },
  ];
  const { summaries, usableBootstrapIterations } =
    summarizePromptFamilyPeriodComparisonThresholdSweep(sweep);
  const summaryMetricCell = (summary: (typeof summaries)[number], key: string): string => {
    const mean = summary.means[key];
    if (typeof mean !== 'number' || !Number.isFinite(mean)) return '—';
    const interval = summary.intervals.get(key);
    const state = summary.intervalStates.get(key) ?? summary.intervalState;
    return interval
      ? `${mean.toFixed(4)} (${interval.lower.toFixed(4)}–${interval.upper.toFixed(4)})`
      : `${mean.toFixed(4)} (CI ${state})`;
  };
  const summarySupportLabel = (summary: (typeof summaries)[number]): string =>
    `${summary.metricSupport.toLocaleString('en-US')} families · ${summary.intervalState} · ${usableBootstrapIterations} iterations`;
  const width = 1_000;
  const height = 390;
  const left = 64;
  const right = 28;
  const top = 30;
  const bottom = 72;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const x = (index: number): number =>
    left + (sweep.thresholds.length > 1 ? index / (sweep.thresholds.length - 1) : 0.5) * chartWidth;
  const y = (value: number): number =>
    top + chartHeight - Math.max(0, Math.min(1, value)) * chartHeight;
  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map(
      (value) =>
        `<g><line x1="${left}" y1="${y(value)}" x2="${width - right}" y2="${y(value)}" stroke="currentColor" opacity=".14"/><text x="${left - 10}" y="${y(value) + 4}" text-anchor="end">${value.toFixed(2)}</text></g>`
    )
    .join('');
  const xLabels = sweep.thresholds
    .map(
      (threshold, index) =>
        `<text x="${x(index)}" y="${height - 42}" text-anchor="middle">${threshold.toFixed(2)}</text>`
    )
    .join('');
  const seriesCharts = seriesDefinitions
    .map(({ key, label, color }) => {
      const points = summaries.map((summary, index) => {
        const value = summary.means[key];
        return value === null ? null : { x: x(index), y: y(value) };
      });
      const segments = points
        .slice(1)
        .map((point, index) => {
          const previous = points[index];
          return point && previous
            ? `<line x1="${previous.x}" y1="${previous.y}" x2="${point.x}" y2="${point.y}" stroke="${color}" stroke-width="2.5"/>`
            : '';
        })
        .join('');
      const intervalMarks = summaries
        .map((summary, index) => {
          const interval = summary.intervals.get(key);
          if (!interval) return '';
          const centerX = x(index);
          const upperY = y(interval.upper);
          const lowerY = y(interval.lower);
          return `<g stroke="${color}" stroke-width="1.5" opacity=".72"><line x1="${centerX}" y1="${upperY}" x2="${centerX}" y2="${lowerY}"/><line x1="${centerX - 5}" y1="${upperY}" x2="${centerX + 5}" y2="${upperY}"/><line x1="${centerX - 5}" y1="${lowerY}" x2="${centerX + 5}" y2="${lowerY}"/></g>`;
        })
        .join('');
      const markers = points
        .map((point, index) =>
          point
            ? `<circle cx="${point.x}" cy="${point.y}" r="4" fill="${color}"><title>${label} at ${sweep.thresholds[index]!.toFixed(2)}: ${summaries[index]!.means[key]!.toFixed(4)} bits</title></circle>`
            : ''
        )
        .join('');
      return `${segments}${intervalMarks}${markers}`;
    })
    .join('');
  const legend = seriesDefinitions
    .map(
      ({ label, color }) =>
        `<span><i style="background:${color}"></i>${escapeFamilyHtml(label)}</span>`
    )
    .join('');
  const divergenceScore = (headers: string[], row: unknown[]): number => {
    const column = new Map(headers.map((header, index) => [header, index]));
    return Math.max(
      ...[
        'observed_event_weighted_source_jensen_shannon_bits',
        'observed_rank_weighted_source_jensen_shannon_bits',
        'matched_equal_prompt_event_source_jensen_shannon_bits',
        'matched_equal_prompt_rank_source_jensen_shannon_bits',
      ].map((key) => {
        const value = row[column.get(key) ?? -1];
        return typeof value === 'number' && Number.isFinite(value) ? value : 0;
      })
    );
  };
  const panels = summaries
    .map(({ threshold, table }) => {
      const column = new Map(table.headers.map((header, index) => [header, index]));
      const value = (row: unknown[], key: string): unknown => row[column.get(key) ?? -1];
      const rows = [...table.rows]
        .sort(
          (leftRow, rightRow) =>
            divergenceScore(table.headers, rightRow) - divergenceScore(table.headers, leftRow) ||
            String(value(leftRow, 'provider')).localeCompare(String(value(rightRow, 'provider'))) ||
            String(value(leftRow, 'prompt_family_id')).localeCompare(
              String(value(rightRow, 'prompt_family_id'))
            )
        )
        .slice(0, htmlRowsPerThreshold);
      const body = rows
        .map(
          (row) =>
            `<tr><td><code>${escapeFamilyHtml(String(value(row, 'prompt_family_id') ?? ''))}</code><br><span class="muted">${escapeFamilyHtml(String(value(row, 'family_member_prompt_groups') ?? ''))} groups</span></td><td>${escapeFamilyHtml(String(value(row, 'provider') ?? ''))}</td><td>${escapeFamilyHtml(String(value(row, 'baseline_provider_prompt_groups') ?? ''))} → ${escapeFamilyHtml(String(value(row, 'current_provider_prompt_groups') ?? ''))}<br><span class="muted">${escapeFamilyHtml(String(value(row, 'matched_exact_prompt_groups_with_citations_both_periods') ?? ''))} matched cited prompts</span></td><td>${escapeFamilyHtml(String(value(row, 'observed_event_weighted_source_jensen_shannon_bits') ?? '—'))} · ${escapeFamilyHtml(String(value(row, 'observed_rank_weighted_source_jensen_shannon_bits') ?? '—'))}</td><td>${escapeFamilyHtml(String(value(row, 'matched_equal_prompt_event_source_jensen_shannon_bits') ?? '—'))} · ${escapeFamilyHtml(String(value(row, 'matched_equal_prompt_rank_source_jensen_shannon_bits') ?? '—'))}</td><td>${escapeFamilyHtml(String(value(row, 'baseline_source_list_complete') ?? '—'))} → ${escapeFamilyHtml(String(value(row, 'current_source_list_complete') ?? '—'))}<br><span class="muted">matched lists ${escapeFamilyHtml(String(value(row, 'matched_exact_prompt_source_lists_complete') ?? '—'))}</span></td></tr>`
        )
        .join('');
      const retainedRowsNote =
        table.outputRowsTruncated || table.rows.length > rows.length
          ? `<p class="muted">Showing ${rows.length} highest-divergence rows from ${table.rows.length.toLocaleString('en-US')} retained rows${table.outputRowsTruncated ? '; threshold output cap also reached' : ''}.</p>`
          : '';
      const categoryHeading =
        categoryMappings.length > 0
          ? '<p class="muted">Mapped-category divergence remains available in the CSV export.</p>'
          : '';
      return `<details class="threshold-panel"${threshold === selectedThreshold ? ' open' : ''}><summary>Cosine threshold ${threshold.toFixed(2)} · ${table.rows.length.toLocaleString('en-US')} retained provider/family rows${table.outputRowsTruncated ? ' · export capped' : ''}</summary>${categoryHeading}<div class="table-wrap"><table><thead><tr><th>Family</th><th>Provider</th><th>Prompt support</th><th>All prompts<br>event · rank JSD</th><th>Matched prompts<br>event · rank JSD</th><th>List completeness</th></tr></thead><tbody>${body}</tbody></table></div>${retainedRowsNote}</details>`;
    })
    .join('');
  const anyTruncated =
    sweep.tables.some(({ outputRowsTruncated }) => outputRowsTruncated) ||
    summaries.some(({ table }) => table.rows.length > htmlRowsPerThreshold);
  const candidateState = sweep.candidateAnalysis.candidatePairsCapped
    ? 'candidate-pair cap reached'
    : 'candidate-pair cap not reached';
  const periodState = sweep.combinedReport.promptsTruncated
    ? 'union prompt catalog capped'
    : 'union prompt catalog retained';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prompt-family source-period threshold sweep</title><style>:root{color-scheme:light;--paper:#f2eee4;--ink:#202722;--muted:#5c665f;--rule:#c8cfc7;--card:#fbfaf6;--pine:#20574c;--rust:#bd4b32}*{box-sizing:border-box}body{margin:0 auto;padding:1.2rem;max-width:1500px;background:linear-gradient(90deg,rgba(32,87,76,.035) 1px,transparent 1px),linear-gradient(rgba(32,87,76,.035) 1px,transparent 1px),var(--paper);background-size:28px 28px;color:var(--ink);font:15px/1.58 "Avenir Next",Avenir,"Trebuchet MS",sans-serif}header,.panel,.threshold-panel{background:var(--card);border:1px solid var(--rule);border-radius:3px;padding:1rem 1.2rem;margin:0 0 1rem;box-shadow:0 8px 24px rgba(32,39,34,.05)}header{border-top:4px solid var(--pine)}h1,h2{font-family:Georgia,"Times New Roman",serif;letter-spacing:-.025em}h1{margin:.1rem 0 .35rem;font-size:1.8rem}h2{margin:.1rem 0 .5rem;font-size:1.2rem}.muted{color:var(--muted);font-size:.88em}.chart-wrap{overflow:auto}.chart{display:block;width:100%;min-width:720px;height:auto;color:#526174;background:#f8f6ee;border:1px solid var(--rule);padding:.5rem}.chart text{font:12px ui-monospace,monospace;fill:currentColor}.legend{display:flex;flex-wrap:wrap;gap:.8rem;margin:.7rem 0}.legend span{display:inline-flex;align-items:center;gap:.35rem}.legend i{width:11px;height:11px;border-radius:50%;display:inline-block}.table-wrap{overflow:auto;max-height:65vh;border:1px solid var(--rule);border-radius:3px}table{border-collapse:collapse;width:100%;min-width:880px;font-size:.9rem}th,td{padding:.55rem .65rem;border-bottom:1px solid #e1e3d9;text-align:left;vertical-align:top}th{position:sticky;top:0;background:#e9ece3;z-index:1;color:#273d34;font-size:.78rem;letter-spacing:.04em;text-transform:uppercase}tbody tr:hover{background:#f0f3ea}code{font:600 .9em ui-monospace,monospace;color:var(--pine)}.threshold-panel summary{cursor:pointer;font-weight:650;color:var(--pine)}.notice{padding:.7rem .9rem;border-left:4px solid #b77924;background:#f7efd9}a:focus-visible,button:focus-visible,summary:focus-visible{outline:3px solid var(--rust);outline-offset:3px}</style></head><body><main><header><h1>Longitudinal source mix by lexical prompt-family cutoff</h1><p>Compare baseline/current citation-source divergence across connected TF-IDF prompt families. The graph is generated once from the union of both prompt catalogs and reused for every cutoff. The chart shows equal-family means across provider rows, with family-cluster bootstrap intervals when graph and row support permit; it is descriptive, not a causal estimate.</p><p class="muted">${sweep.thresholds.length} cutoffs · ${sweep.candidateAnalysis.candidatePairCount.toLocaleString('en-US')}${sweep.candidateAnalysis.candidatePairsCapped ? '+' : ''} candidate pairs considered · high-frequency posting cutoff ${sweep.candidateAnalysis.highFrequencyCutoff} · ${candidateState} · ${periodState}</p></header><section class="panel"><h2>Mean source divergence across cutoffs</h2><p class="muted">Jensen–Shannon divergence ranges from 0 (same observed source distribution) to 1 bit (disjoint distributions). For each family, available provider rows are averaged first; the chart then gives each family equal weight. Error bars resample whole lexical families, conditional on the cutoff and retained data.</p><div class="legend">${legend}</div><div class="chart-wrap"><svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="period-sweep-chart-title period-sweep-chart-desc"><title id="period-sweep-chart-title">Mean source divergence across family thresholds</title><desc id="period-sweep-chart-desc">Four series show equal-family mean event- and rank-weighted source divergence across all prompts and matched prompts for every cosine cutoff, with family-bootstrap intervals when available.</desc>${grid}${seriesCharts}${xLabels}<text x="${left + chartWidth / 2}" y="${height - 12}" text-anchor="middle">TF-IDF cosine threshold</text></svg></div><div class="table-wrap"><table><thead><tr><th>Threshold</th><th>Supported families · bootstrap state</th><th>All prompt event JSD · mean (95% family CI)</th><th>All prompt rank JSD · mean (95% family CI)</th><th>Matched prompt event JSD · mean (95% family CI)</th><th>Matched prompt rank JSD · mean (95% family CI)</th><th>Retained provider/family rows</th></tr></thead><tbody>${summaries.map((summary) => `<tr><td>${summary.threshold.toFixed(2)}</td><td>${summarySupportLabel(summary)}</td>${seriesDefinitions.map(({ key }) => `<td>${summaryMetricCell(summary, key)}</td>`).join('')}<td>${summary.table.rows.length.toLocaleString('en-US')}${summary.outputRowsTruncated ? '+' : ''}</td></tr>`).join('')}</tbody></table></div>${anyTruncated ? `<p class="notice">Some threshold row sets were capped. The chart means use retained CSV rows; expanded details show only the highest-divergence rows for each cutoff. Review the CSV truncation flags before comparing thresholds with low support.</p>` : ''}</section><section class="panel"><h2>Highest-divergence families by threshold</h2><p class="muted">Matched prompts reduce changes caused by a shifting question panel. Overall divergence includes all retained prompts in a family; list completeness and the CSV detail flags help interpret capped or incomplete evidence.</p>${panels}</section><footer class="muted">${allRows.length.toLocaleString('en-US')} provider/family rows retained across the sweep. Lexical families are wording groups, not proof of semantic intent.</footer></main></body></html>\n`;
}

function buildCombinedPromptFamilyPeriodReport(
  baselineReport: AiAnswerCitationObservationReport,
  currentReport: AiAnswerCitationObservationReport
): AiAnswerCitationObservationReport {
  const combinedPrompts = new Map<string, AiAnswerCitationPromptProfile>();
  for (const profile of [...baselineReport.prompts, ...currentReport.prompts]) {
    const key = normalizedPrompt(profile.prompt);
    if (!combinedPrompts.has(key)) combinedPrompts.set(key, profile);
  }
  const combinedReport: AiAnswerCitationObservationReport = {
    ...currentReport,
    prompts: [...combinedPrompts.values()],
    promptsTruncated: baselineReport.promptsTruncated || currentReport.promptsTruncated,
  };
  return combinedReport;
}

function renderPromptFamilyPeriodComparisonTable(
  baselineReport: AiAnswerCitationObservationReport,
  currentReport: AiAnswerCitationObservationReport,
  combinedReport: AiAnswerCitationObservationReport,
  minimumCosineSimilarity: number,
  categoryMappings: Array<{ domain: string; label: string; labelKey: string }>,
  candidateAnalysis: ReturnType<typeof analyzePromptSimilarity>,
  maxOutputRows: number
): { headers: string[]; rows: unknown[][]; outputRowsTruncated: boolean } {
  const partition = partitionPromptFamiliesFromAnalysis(combinedReport, {
    ...candidateAnalysis,
    rows: candidateAnalysis.rows.filter(({ cosine }) => cosine >= minimumCosineSimilarity),
  });
  const orderedCategoryMappings = [...categoryMappings].sort(
    (left, right) =>
      right.domain.length - left.domain.length || left.domain.localeCompare(right.domain)
  );
  const categoryMappingByDomain = new Map(
    orderedCategoryMappings.map(({ domain, labelKey }) => [domain, labelKey])
  );
  const baselinePrompts = new Map(
    baselineReport.prompts.map((profile) => [normalizedPrompt(profile.prompt), profile])
  );
  const currentPrompts = new Map(
    currentReport.prompts.map((profile) => [normalizedPrompt(profile.prompt), profile])
  );
  const headers = [
    'row_type',
    'prompt_family_id',
    'family_similarity_threshold',
    'family_member_prompt_groups',
    'member_prompt_examples_json',
    'member_prompt_examples_truncated',
    'provider',
    'baseline_provider_sampled',
    'current_provider_sampled',
    'baseline_provider_prompt_groups',
    'current_provider_prompt_groups',
    'shared_provider_exact_prompt_groups',
    'provider_prompt_groups_added',
    'provider_prompt_groups_lost',
    'matched_exact_prompt_groups_with_citations_both_periods',
    'matched_exact_prompt_source_lists_complete',
    'matched_equal_prompt_event_source_detail_complete',
    'matched_equal_prompt_event_source_jensen_shannon_bits',
    'matched_equal_prompt_event_source_share_shifts_json',
    'matched_equal_prompt_rank_source_detail_complete',
    'matched_equal_prompt_rank_source_jensen_shannon_bits',
    'matched_equal_prompt_rank_source_share_shifts_json',
    'baseline_observations',
    'current_observations',
    'baseline_observations_with_citations',
    'current_observations_with_citations',
    'baseline_citation_events',
    'current_citation_events',
    'observed_citation_event_change',
    'baseline_citation_events_per_observation',
    'current_citation_events_per_observation',
    'citation_events_per_observation_change',
    'baseline_source_domain_count',
    'current_source_domain_count',
    'shared_source_domains',
    'observed_source_domains_added',
    'observed_source_domains_lost',
    'observed_source_domain_jaccard_percent',
    'baseline_source_domain_examples',
    'current_source_domain_examples',
    'baseline_source_list_complete',
    'current_source_list_complete',
    'baseline_domain_detail_complete',
    'current_domain_detail_complete',
    'baseline_event_source_detail_complete',
    'current_event_source_detail_complete',
    'observed_event_weighted_source_jensen_shannon_bits',
    'top_event_weighted_source_share_shifts_json',
    'baseline_rank_source_detail_complete',
    'current_rank_source_detail_complete',
    'observed_rank_weighted_source_jensen_shannon_bits',
    'top_rank_weighted_source_share_shifts_json',
    'source_category_mappings_configured',
    'configured_source_category_count',
    'baseline_mapped_event_weight_share_percent',
    'current_mapped_event_weight_share_percent',
    'observed_event_weighted_category_jensen_shannon_bits',
    'baseline_mapped_rank_weight_share_percent',
    'current_mapped_rank_weight_share_percent',
    'observed_rank_weighted_category_jensen_shannon_bits',
    'source_portfolio_comparison_complete',
    'retained_prompt_catalog_truncated',
    'candidate_pairs_considered',
    'high_frequency_posting_cutoff',
    'family_candidate_pairs_capped',
    'output_rows_truncated',
    'interpretation_note',
  ];
  const rows: unknown[][] = [];
  let outputRowsTruncated = false;
  const note =
    'Families are connected lexical components built from the union of unique baseline/current exact prompt texts. A provider can have different exact phrasings in each period; those are compared at the family level. Matched equal-prompt source mixes include only exact prompt groups with citations in both periods and give each prompt one vote after normalizing its source distribution. Source domains are unioned within provider/family/period. Observed gains, losses, and Jaccard may be incomplete when source lists or domain detail are incomplete. This is descriptive sampling-panel change, not a causal provider effect or semantic intent match.';

  outer: for (const [familyIndex, members] of partition.families.entries()) {
    const memberKeys = members.map((member) => normalizedPrompt(member.prompt));
    const baselineMembers = memberKeys
      .map((key) => baselinePrompts.get(key))
      .filter((profile): profile is AiAnswerCitationPromptProfile => Boolean(profile));
    const currentMembers = memberKeys
      .map((key) => currentPrompts.get(key))
      .filter((profile): profile is AiAnswerCitationPromptProfile => Boolean(profile));
    const baselineFamily =
      baselineMembers.length > 0
        ? buildFamilyRarefactionProfile(baselineMembers, familyIndex)
        : null;
    const currentFamily =
      currentMembers.length > 0 ? buildFamilyRarefactionProfile(currentMembers, familyIndex) : null;
    const baselineProfiles = new Map(
      (baselineFamily?.providerProfiles ?? []).map((profile) => [
        normalizedPrompt(profile.provider),
        profile,
      ])
    );
    const currentProfiles = new Map(
      (currentFamily?.providerProfiles ?? []).map((profile) => [
        normalizedPrompt(profile.provider),
        profile,
      ])
    );
    const baselinePromptKeysByProvider = new Map<string, Set<string>>();
    const currentPromptKeysByProvider = new Map<string, Set<string>>();
    for (const member of baselineMembers) {
      const promptKey = normalizedPrompt(member.prompt);
      for (const provider of member.providers) {
        const key = normalizedPrompt(provider);
        const prompts = baselinePromptKeysByProvider.get(key) ?? new Set<string>();
        prompts.add(promptKey);
        baselinePromptKeysByProvider.set(key, prompts);
      }
    }
    for (const member of currentMembers) {
      const promptKey = normalizedPrompt(member.prompt);
      for (const provider of member.providers) {
        const key = normalizedPrompt(provider);
        const prompts = currentPromptKeysByProvider.get(key) ?? new Set<string>();
        prompts.add(promptKey);
        currentPromptKeysByProvider.set(key, prompts);
      }
    }
    const providerKeys = new Set([
      ...baselinePromptKeysByProvider.keys(),
      ...currentPromptKeysByProvider.keys(),
    ]);
    const promptExamples = members.slice(0, 3).map(({ prompt }) => prompt);
    for (const providerKey of [...providerKeys].sort((left, right) => left.localeCompare(right))) {
      const baselinePromptKeys = baselinePromptKeysByProvider.get(providerKey) ?? new Set<string>();
      const currentPromptKeys = currentPromptKeysByProvider.get(providerKey) ?? new Set<string>();
      const sharedPromptKeys = new Set(
        [...baselinePromptKeys].filter((key) => currentPromptKeys.has(key))
      );
      const sharedPromptGroups = sharedPromptKeys.size;
      const matchedCitedPromptKeys = new Set<string>();
      for (const key of sharedPromptKeys) {
        const baselinePrompt = baselinePrompts.get(key);
        const currentPrompt = currentPrompts.get(key);
        const baselineProviderProfile = findPromptProviderProfile(baselinePrompt, providerKey);
        const currentProviderProfile = findPromptProviderProfile(currentPrompt, providerKey);
        if (
          baselineProviderProfile &&
          currentProviderProfile &&
          baselineProviderProfile.citationEvents > 0 &&
          currentProviderProfile.citationEvents > 0
        ) {
          matchedCitedPromptKeys.add(key);
        }
      }
      const baselineProfile = baselineProfiles.get(providerKey);
      const currentProfile = currentProfiles.get(providerKey);
      const matchedSourceListsComplete =
        matchedCitedPromptKeys.size > 0 &&
        arePromptFamilyMatchedSourceListsComplete(
          baselineMembers,
          providerKey,
          matchedCitedPromptKeys
        ) &&
        arePromptFamilyMatchedSourceListsComplete(
          currentMembers,
          providerKey,
          matchedCitedPromptKeys
        );
      const baselineSourceWeights = aggregatePromptFamilySourceWeights(
        baselineMembers,
        providerKey
      );
      const currentSourceWeights = aggregatePromptFamilySourceWeights(currentMembers, providerKey);
      const baselineMatchedSourceWeights = aggregatePromptFamilySourceWeights(
        baselineMembers,
        providerKey,
        matchedCitedPromptKeys,
        true
      );
      const currentMatchedSourceWeights = aggregatePromptFamilySourceWeights(
        currentMembers,
        providerKey,
        matchedCitedPromptKeys,
        true
      );
      const matchedEventDetailComplete =
        matchedCitedPromptKeys.size > 0 &&
        baselineMatchedSourceWeights.eventDetailComplete &&
        currentMatchedSourceWeights.eventDetailComplete;
      const matchedRankDetailComplete =
        matchedCitedPromptKeys.size > 0 &&
        baselineMatchedSourceWeights.rankDetailComplete &&
        currentMatchedSourceWeights.rankDetailComplete;
      const matchedEventMixDivergence = matchedEventDetailComplete
        ? distributionJensenShannonBits(
            baselineMatchedSourceWeights.eventWeights,
            currentMatchedSourceWeights.eventWeights
          )
        : null;
      const matchedRankMixDivergence = matchedRankDetailComplete
        ? distributionJensenShannonBits(
            baselineMatchedSourceWeights.rankWeights,
            currentMatchedSourceWeights.rankWeights
          )
        : null;
      const matchedEventSourceShareShifts =
        matchedCitedPromptKeys.size > 0
          ? summarizePromptFamilySourceWeightShifts(
              baselineMatchedSourceWeights.eventWeights,
              currentMatchedSourceWeights.eventWeights,
              matchedEventDetailComplete
            )
          : null;
      const matchedRankSourceShareShifts =
        matchedCitedPromptKeys.size > 0
          ? summarizePromptFamilySourceWeightShifts(
              baselineMatchedSourceWeights.rankWeights,
              currentMatchedSourceWeights.rankWeights,
              matchedRankDetailComplete
            )
          : null;
      const eventMixDivergence =
        baselineProfile &&
        currentProfile &&
        baselineSourceWeights.eventDetailComplete &&
        currentSourceWeights.eventDetailComplete
          ? distributionJensenShannonBits(
              baselineSourceWeights.eventWeights,
              currentSourceWeights.eventWeights
            )
          : null;
      const eventSourceShareShifts =
        baselineProfile && currentProfile
          ? summarizePromptFamilySourceWeightShifts(
              baselineSourceWeights.eventWeights,
              currentSourceWeights.eventWeights,
              baselineSourceWeights.eventDetailComplete && currentSourceWeights.eventDetailComplete
            )
          : null;
      const rankMixDivergence =
        baselineProfile &&
        currentProfile &&
        baselineSourceWeights.rankDetailComplete &&
        currentSourceWeights.rankDetailComplete
          ? distributionJensenShannonBits(
              baselineSourceWeights.rankWeights,
              currentSourceWeights.rankWeights
            )
          : null;
      const rankSourceShareShifts =
        baselineProfile && currentProfile
          ? summarizePromptFamilySourceWeightShifts(
              baselineSourceWeights.rankWeights,
              currentSourceWeights.rankWeights,
              baselineSourceWeights.rankDetailComplete && currentSourceWeights.rankDetailComplete
            )
          : null;
      const baselineEventCategories = aggregatePromptFamilyCategoryWeights(
        baselineSourceWeights.eventWeights,
        categoryMappingByDomain
      );
      const currentEventCategories = aggregatePromptFamilyCategoryWeights(
        currentSourceWeights.eventWeights,
        categoryMappingByDomain
      );
      const baselineRankCategories = aggregatePromptFamilyCategoryWeights(
        baselineSourceWeights.rankWeights,
        categoryMappingByDomain
      );
      const currentRankCategories = aggregatePromptFamilyCategoryWeights(
        currentSourceWeights.rankWeights,
        categoryMappingByDomain
      );
      const eventCategoryDivergence =
        orderedCategoryMappings.length > 0 &&
        baselineProfile &&
        currentProfile &&
        baselineSourceWeights.eventDetailComplete &&
        currentSourceWeights.eventDetailComplete
          ? distributionJensenShannonBits(
              baselineEventCategories.categoryWeights,
              currentEventCategories.categoryWeights
            )
          : null;
      const rankCategoryDivergence =
        orderedCategoryMappings.length > 0 &&
        baselineProfile &&
        currentProfile &&
        baselineSourceWeights.rankDetailComplete &&
        currentSourceWeights.rankDetailComplete
          ? distributionJensenShannonBits(
              baselineRankCategories.categoryWeights,
              currentRankCategories.categoryWeights
            )
          : null;
      const baselineDomains = baselineProfile
        ? new Set(
            baselineProfile.citedDomains
              .map((domain) => domain.toLocaleLowerCase('en-US').replace(/^\.+|\.+$/gu, ''))
              .filter(Boolean)
          )
        : null;
      const currentDomains = currentProfile
        ? new Set(
            currentProfile.citedDomains
              .map((domain) => domain.toLocaleLowerCase('en-US').replace(/^\.+|\.+$/gu, ''))
              .filter(Boolean)
          )
        : null;
      const sharedDomains =
        baselineDomains && currentDomains
          ? [...baselineDomains]
              .filter((domain) => currentDomains.has(domain))
              .sort((left, right) => left.localeCompare(right))
          : [];
      const addedDomains =
        baselineDomains && currentDomains
          ? [...currentDomains]
              .filter((domain) => !baselineDomains.has(domain))
              .sort((left, right) => left.localeCompare(right))
          : [];
      const lostDomains =
        baselineDomains && currentDomains
          ? [...baselineDomains]
              .filter((domain) => !currentDomains.has(domain))
              .sort((left, right) => left.localeCompare(right))
          : [];
      const domainUnionCount =
        baselineDomains && currentDomains
          ? baselineDomains.size + currentDomains.size - sharedDomains.length
          : 0;
      const baselineSourceListComplete =
        baselineProfile !== undefined &&
        Number.isSafeInteger(baselineProfile.incompleteCitationListObservations) &&
        baselineProfile.incompleteCitationListObservations === 0;
      const currentSourceListComplete =
        currentProfile !== undefined &&
        Number.isSafeInteger(currentProfile.incompleteCitationListObservations) &&
        currentProfile.incompleteCitationListObservations === 0;
      const baselineDomainDetailComplete =
        baselineProfile !== undefined &&
        baselineProfile.citedDomainsTruncated === false &&
        (baselineProfile.citationEvents === 0 || baselineDomains?.size !== 0);
      const currentDomainDetailComplete =
        currentProfile !== undefined &&
        currentProfile.citedDomainsTruncated === false &&
        (currentProfile.citationEvents === 0 || currentDomains?.size !== 0);
      const baselineCitationEventsPerObservation =
        baselineProfile && baselineProfile.observations > 0
          ? Number((baselineProfile.citationEvents / baselineProfile.observations).toFixed(4))
          : null;
      const currentCitationEventsPerObservation =
        currentProfile && currentProfile.observations > 0
          ? Number((currentProfile.citationEvents / currentProfile.observations).toFixed(4))
          : null;
      if (rows.length === maxOutputRows) {
        outputRowsTruncated = true;
        break outer;
      }
      rows.push([
        'family-provider-period',
        `family-${String(familyIndex + 1).padStart(5, '0')}`,
        minimumCosineSimilarity,
        members.length,
        JSON.stringify(promptExamples),
        members.length > promptExamples.length,
        baselineProfile?.provider ?? currentProfile?.provider ?? providerKey,
        baselinePromptKeys.size > 0,
        currentPromptKeys.size > 0,
        baselinePromptKeys.size,
        currentPromptKeys.size,
        sharedPromptGroups,
        [...currentPromptKeys].filter((key) => !baselinePromptKeys.has(key)).length,
        [...baselinePromptKeys].filter((key) => !currentPromptKeys.has(key)).length,
        matchedCitedPromptKeys.size,
        matchedCitedPromptKeys.size > 0 ? matchedSourceListsComplete : null,
        matchedCitedPromptKeys.size > 0 ? matchedEventDetailComplete : null,
        matchedEventMixDivergence,
        matchedEventSourceShareShifts,
        matchedCitedPromptKeys.size > 0 ? matchedRankDetailComplete : null,
        matchedRankMixDivergence,
        matchedRankSourceShareShifts,
        baselineProfile?.observations ?? null,
        currentProfile?.observations ?? null,
        baselineProfile?.observationsWithCitations ?? null,
        currentProfile?.observationsWithCitations ?? null,
        baselineProfile?.citationEvents ?? null,
        currentProfile?.citationEvents ?? null,
        baselineProfile && currentProfile
          ? currentProfile.citationEvents - baselineProfile.citationEvents
          : null,
        baselineCitationEventsPerObservation,
        currentCitationEventsPerObservation,
        baselineCitationEventsPerObservation !== null &&
        currentCitationEventsPerObservation !== null
          ? Number(
              (currentCitationEventsPerObservation - baselineCitationEventsPerObservation).toFixed(
                4
              )
            )
          : null,
        baselineDomains?.size ?? null,
        currentDomains?.size ?? null,
        baselineProfile && currentProfile ? sharedDomains.length : null,
        baselineProfile && currentProfile ? addedDomains.length : null,
        baselineProfile && currentProfile ? lostDomains.length : null,
        baselineProfile && currentProfile && domainUnionCount > 0
          ? Number(((sharedDomains.length / domainUnionCount) * 100).toFixed(4))
          : null,
        baselineDomains
          ? [...baselineDomains]
              .sort((left, right) => left.localeCompare(right))
              .slice(0, 10)
              .join(' | ')
          : '',
        currentDomains
          ? [...currentDomains]
              .sort((left, right) => left.localeCompare(right))
              .slice(0, 10)
              .join(' | ')
          : '',
        baselineProfile ? baselineSourceListComplete : null,
        currentProfile ? currentSourceListComplete : null,
        baselineProfile ? baselineDomainDetailComplete : null,
        currentProfile ? currentDomainDetailComplete : null,
        baselineProfile ? baselineSourceWeights.eventDetailComplete : null,
        currentProfile ? currentSourceWeights.eventDetailComplete : null,
        eventMixDivergence,
        eventSourceShareShifts,
        baselineProfile ? baselineSourceWeights.rankDetailComplete : null,
        currentProfile ? currentSourceWeights.rankDetailComplete : null,
        rankMixDivergence,
        rankSourceShareShifts,
        orderedCategoryMappings.length > 0,
        orderedCategoryMappings.length > 0
          ? new Set(orderedCategoryMappings.map(({ labelKey }) => labelKey)).size
          : null,
        baselineProfile && baselineSourceWeights.eventDetailComplete
          ? baselineEventCategories.mappedSharePercent
          : null,
        currentProfile && currentSourceWeights.eventDetailComplete
          ? currentEventCategories.mappedSharePercent
          : null,
        eventCategoryDivergence,
        baselineProfile && baselineSourceWeights.rankDetailComplete
          ? baselineRankCategories.mappedSharePercent
          : null,
        currentProfile && currentSourceWeights.rankDetailComplete
          ? currentRankCategories.mappedSharePercent
          : null,
        rankCategoryDivergence,
        Boolean(
          baselineProfile &&
          currentProfile &&
          baselineSourceListComplete &&
          currentSourceListComplete &&
          baselineDomainDetailComplete &&
          currentDomainDetailComplete
        ),
        baselineReport.promptsTruncated || currentReport.promptsTruncated,
        partition.candidatePairsConsidered,
        partition.highFrequencyPostingCutoff,
        partition.candidatePairsCapped,
        false,
        note,
      ]);
    }
  }
  if (outputRowsTruncated) {
    const truncatedIndex = headers.indexOf('output_rows_truncated');
    for (const row of rows) row[truncatedIndex] = true;
  }
  return { headers, rows, outputRowsTruncated };
}

function escapeFamilyHtml(value: string): string {
  return value.replace(
    /[&<>"']/gu,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!
  );
}

function renderFamilyHtmlValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '<span class="muted">—</span>';
  if (typeof value === 'boolean') return value ? 'Complete' : 'Incomplete';
  if (typeof value === 'number')
    return Number.isFinite(value)
      ? escapeFamilyHtml(value.toLocaleString('en-US', { maximumFractionDigits: 4 }))
      : '<span class="muted">—</span>';
  return escapeFamilyHtml(String(value));
}

function renderFamilySourceShareShifts(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0)
    return '<span class="muted">Unavailable</span>';
  let shifts: Array<{
    domain?: unknown;
    baseline_share_percent?: unknown;
    current_share_percent?: unknown;
    change_percentage_points?: unknown;
  }>;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return '<span class="muted">Unavailable</span>';
    shifts = parsed;
  } catch {
    return '<span class="muted">Unavailable</span>';
  }
  if (shifts.length === 0) return '<span class="muted">No observed weighted sources</span>';
  return `<ul class="shifts">${shifts.map((item) => `<li><strong>${escapeFamilyHtml(String(item.domain ?? ''))}</strong> ${renderFamilyHtmlValue(item.baseline_share_percent)}% → ${renderFamilyHtmlValue(item.current_share_percent)}% <span class="muted">(Δ ${renderFamilyHtmlValue(item.change_percentage_points)} pp)</span></li>`).join('')}</ul>`;
}

/** Render a bounded, offline summary of baseline/current family-level source changes. */
export function renderAiAnswerCitationPromptFamilyPeriodComparisonHtml(
  baselineReport: AiAnswerCitationObservationReport,
  currentReport: AiAnswerCitationObservationReport,
  minimumCosineSimilarity = 0.85,
  categoryMappings: Array<{ domain: string; label: string; labelKey: string }> = []
): string {
  if (
    !Number.isFinite(minimumCosineSimilarity) ||
    minimumCosineSimilarity < 0 ||
    minimumCosineSimilarity > 1
  ) {
    throw new Error('Prompt-family similarity threshold must be between 0 and 1.');
  }
  const combinedReport = buildCombinedPromptFamilyPeriodReport(baselineReport, currentReport);
  const candidateAnalysis = analyzePromptSimilarity(combinedReport, minimumCosineSimilarity);
  const table = renderPromptFamilyPeriodComparisonTable(
    baselineReport,
    currentReport,
    combinedReport,
    minimumCosineSimilarity,
    categoryMappings,
    candidateAnalysis,
    MAX_OUTPUT_ROWS
  );
  const column = new Map(table.headers.map((header, index) => [header, index]));
  const read = (row: unknown[], header: string): unknown => row[column.get(header) ?? -1];
  const divergenceScore = (row: unknown[]): number =>
    Math.max(
      ...[
        'observed_event_weighted_source_jensen_shannon_bits',
        'observed_rank_weighted_source_jensen_shannon_bits',
        'matched_equal_prompt_event_source_jensen_shannon_bits',
        'matched_equal_prompt_rank_source_jensen_shannon_bits',
      ].map((header) => (typeof read(row, header) === 'number' ? (read(row, header) as number) : 0))
    );
  const rows = [...table.rows].sort(
    (left, right) =>
      divergenceScore(right) - divergenceScore(left) ||
      String(read(left, 'provider')).localeCompare(String(read(right, 'provider'))) ||
      String(read(left, 'prompt_family_id')).localeCompare(String(read(right, 'prompt_family_id')))
  );
  const familyCount = new Set(rows.map((row) => read(row, 'prompt_family_id'))).size;
  const providerCount = new Set(rows.map((row) => read(row, 'provider'))).size;
  const dashboardRows = rows.slice(0, MAX_PERIOD_COMPARISON_HTML_ROWS);
  const dashboardRowsTruncated =
    table.outputRowsTruncated || rows.length > MAX_PERIOD_COMPARISON_HTML_ROWS;
  const body = dashboardRows
    .map(
      (row) =>
        `<tr><td><code>${renderFamilyHtmlValue(read(row, 'prompt_family_id'))}</code><br><span class="muted">${renderFamilyHtmlValue(read(row, 'family_member_prompt_groups'))} member groups</span></td><td>${renderFamilyHtmlValue(read(row, 'provider'))}</td><td>${renderFamilyHtmlValue(read(row, 'baseline_provider_prompt_groups'))} → ${renderFamilyHtmlValue(read(row, 'current_provider_prompt_groups'))}<br><span class="muted">${renderFamilyHtmlValue(read(row, 'matched_exact_prompt_groups_with_citations_both_periods'))} matched cited prompts</span></td><td>${renderFamilyHtmlValue(read(row, 'baseline_citation_events_per_observation'))} → ${renderFamilyHtmlValue(read(row, 'current_citation_events_per_observation'))}<br><span class="muted">events / observation</span></td><td>${renderFamilyHtmlValue(read(row, 'observed_source_domains_added'))} added · ${renderFamilyHtmlValue(read(row, 'observed_source_domains_lost'))} lost<br><span class="muted">Jaccard ${renderFamilyHtmlValue(read(row, 'observed_source_domain_jaccard_percent'))}%</span></td><td>${renderFamilyHtmlValue(read(row, 'observed_event_weighted_source_jensen_shannon_bits'))}<br><span class="muted">event detail ${renderFamilyHtmlValue(read(row, 'baseline_event_source_detail_complete'))} → ${renderFamilyHtmlValue(read(row, 'current_event_source_detail_complete'))}</span><br><span class="muted">rank ${renderFamilyHtmlValue(read(row, 'observed_rank_weighted_source_jensen_shannon_bits'))} · detail ${renderFamilyHtmlValue(read(row, 'baseline_rank_source_detail_complete'))} → ${renderFamilyHtmlValue(read(row, 'current_rank_source_detail_complete'))}</span></td><td>${renderFamilyHtmlValue(read(row, 'matched_equal_prompt_event_source_jensen_shannon_bits'))}<br><span class="muted">event detail ${renderFamilyHtmlValue(read(row, 'matched_equal_prompt_event_source_detail_complete'))}</span><br><span class="muted">rank ${renderFamilyHtmlValue(read(row, 'matched_equal_prompt_rank_source_jensen_shannon_bits'))} · detail ${renderFamilyHtmlValue(read(row, 'matched_equal_prompt_rank_source_detail_complete'))}</span></td><td>${renderFamilyHtmlValue(read(row, 'baseline_source_list_complete'))} → ${renderFamilyHtmlValue(read(row, 'current_source_list_complete'))}<br><span class="muted">matched lists ${renderFamilyHtmlValue(read(row, 'matched_exact_prompt_source_lists_complete'))}</span></td><td>${renderFamilyHtmlValue(read(row, 'observed_event_weighted_category_jensen_shannon_bits'))}<br><span class="muted">event mapped share ${renderFamilyHtmlValue(read(row, 'baseline_mapped_event_weight_share_percent'))}% → ${renderFamilyHtmlValue(read(row, 'current_mapped_event_weight_share_percent'))}%</span><br><span class="muted">rank ${renderFamilyHtmlValue(read(row, 'observed_rank_weighted_category_jensen_shannon_bits'))} · mapped ${renderFamilyHtmlValue(read(row, 'baseline_mapped_rank_weight_share_percent'))}% → ${renderFamilyHtmlValue(read(row, 'current_mapped_rank_weight_share_percent'))}%</span></td><td>${renderFamilySourceShareShifts(read(row, 'top_event_weighted_source_share_shifts_json'))}</td></tr>`
    )
    .join('');
  const categoriesConfigured = categoryMappings.length > 0;
  const cappedRowsNote = dashboardRowsTruncated
    ? `<p class="notice">Dashboard rows capped at ${MAX_PERIOD_COMPARISON_HTML_ROWS}; the CSV export retains up to 20,000 rows. The HTML prioritizes the largest observed source-mix divergences among retained CSV rows.</p>`
    : '';
  const emptyState =
    '<p class="empty">No provider/family rows are available for the retained prompt catalogs.</p>';
  const tableHtml = body
    ? `<div class="table-wrap"><table><thead><tr><th>Family</th><th>Provider</th><th>Prompt support</th><th>Citation intensity</th><th>Domain turnover</th><th>All prompts<br>event · rank JSD</th><th>Matched prompts<br>event · rank JSD</th><th>List completeness</th><th>Mapped category<br>event · rank JSD</th><th>Largest event-share shifts</th></tr></thead><tbody>${body}</tbody></table></div>`
    : emptyState;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prompt-family source period comparison</title><style>:root{color-scheme:light}*{box-sizing:border-box}body{margin:0 auto;padding:1.25rem;max-width:1600px;background:#f4f7fb;color:#172033;font:15px/1.5 system-ui,sans-serif}header,.panel{background:#fff;border:1px solid #d9e0ea;border-radius:14px;padding:1.2rem;margin:0 0 1rem}h1{margin:.1rem 0 .35rem;font-size:1.65rem}h2{margin:0 0 .5rem;font-size:1.15rem}.muted{color:#65748a;font-size:.88em}.metrics{display:flex;flex-wrap:wrap;gap:.6rem;margin:.9rem 0}.metric{border:1px solid #d9e0ea;border-radius:10px;padding:.55rem .75rem;min-width:130px}.metric strong{display:block;font-size:1.1rem}.table-wrap{overflow:auto;max-height:75vh;border:1px solid #e1e6ed;border-radius:8px}table{border-collapse:collapse;width:100%;min-width:1260px;font-size:.9rem}th,td{padding:.65rem .7rem;border-bottom:1px solid #e5eaf0;text-align:left;vertical-align:top}th{position:sticky;top:0;background:#f8fafc;z-index:1}tbody tr:hover{background:#f7faff}code{font:600 .9em ui-monospace,monospace}.shifts{margin:0;padding-left:1.1rem}.notice{padding:.65rem .8rem;border-left:4px solid #cf8a17;background:#fff8e9}.empty{padding:1rem;background:#f8fafc;border-radius:8px}footer{color:#65748a;font-size:.9rem}</style></head><body><header><h1>AI-answer source change by lexical prompt family</h1><p>Baseline/current source evidence is aligned over connected TF-IDF families from both prompt catalogs. Overall source divergence uses observed citations; the matched-prompt columns compare exact questions with citations in both periods and give each prompt equal weight after within-prompt normalization.</p><div class="metrics"><div class="metric"><span class="muted">Families represented</span><strong>${familyCount.toLocaleString('en-US')}</strong></div><div class="metric"><span class="muted">Provider/family rows in retained export</span><strong>${rows.length.toLocaleString('en-US')}${table.outputRowsTruncated ? '+' : ''}</strong></div><div class="metric"><span class="muted">Providers represented</span><strong>${providerCount.toLocaleString('en-US')}</strong></div><div class="metric"><span class="muted">Cosine cutoff</span><strong>${minimumCosineSimilarity.toFixed(2)}</strong></div><div class="metric"><span class="muted">Candidate pairs</span><strong>${candidateAnalysis.candidatePairCount.toLocaleString('en-US')}${candidateAnalysis.candidatePairsCapped ? '+' : ''}</strong></div></div><p class="muted">High-frequency posting cutoff ${candidateAnalysis.highFrequencyCutoff}; ${candidateAnalysis.candidatePairsCapped ? 'candidate cap reached' : 'candidate cap not reached'}; ${combinedReport.promptsTruncated ? 'retained prompt catalog capped' : 'retained prompt catalog not capped'}; ${categoriesConfigured ? `${new Set(categoryMappings.map(({ labelKey }) => labelKey)).size} source categories configured` : 'no source categories configured'}. Domain turnover and weighted mixes describe retained data. Lexical family membership is not a semantic or causal attribution.</p></header><section class="panel"><h2>Provider and family detail</h2>${tableHtml}${cappedRowsNote}</section><footer>Owned and category distributions depend on the supplied domain/category configuration. Incomplete source lists and capped detail can hide cited sources. Use the corresponding CSV for spreadsheet analysis and the complete emitted row set.</footer></body></html>\n`;
}

/** Export candidate prompt pairs with high lexical similarity without merging exact prompt groups. */
export function renderAiAnswerCitationPromptSimilarityCsv(
  report: AiAnswerCitationObservationReport,
  minimumCosineSimilarity = 0.65
): string {
  const {
    rows,
    documentCount,
    candidatePairCount,
    highFrequencyCutoff,
    candidatePairsCapped,
    promptCatalogTruncated,
  } = analyzePromptSimilarity(report, minimumCosineSimilarity);
  const outputTruncated = rows.length > MAX_OUTPUT_ROWS;
  const headers = [
    'row_type',
    'prompt_a',
    'prompt_b',
    'tfidf_cosine_similarity',
    'token_jaccard_similarity',
    'shared_content_terms',
    'prompt_a_observations',
    'prompt_b_observations',
    'prompt_a_providers',
    'prompt_b_providers',
    'shared_providers',
    'retained_prompt_groups',
    'candidate_pairs_considered',
    'high_frequency_posting_cutoff',
    'prompt_catalog_truncated',
    'candidate_pairs_capped',
    'output_rows_truncated',
    'interpretation_note',
  ];
  const note =
    'Lexical TF-IDF cosine and token Jaccard identify wording overlap only. Prompts remain separate exact groups; similarity is not semantic equivalence, intent matching, independence, demand, or visibility. High-frequency-only overlaps are skipped to bound work; the pair search also has a fixed candidate cap. Prompt text is included for manual review.';
  const csvRows = rows
    .slice(0, MAX_OUTPUT_ROWS)
    .map(({ left, right, cosine, jaccard, sharedTerms }) => {
      const providersA = [...left.profile.providers].sort((a, b) => a.localeCompare(b));
      const providersB = [...right.profile.providers].sort((a, b) => a.localeCompare(b));
      const providersBSet = new Set(providersB.map(normalizedPrompt));
      const sharedProviders = providersA
        .filter((provider) => providersBSet.has(normalizedPrompt(provider)))
        .sort((a, b) => a.localeCompare(b));
      return [
        'pair',
        left.profile.prompt,
        right.profile.prompt,
        Number(cosine.toFixed(4)),
        Number(jaccard.toFixed(4)),
        sharedTerms.join(' | '),
        left.profile.observations,
        right.profile.observations,
        providersA.join(' | '),
        providersB.join(' | '),
        sharedProviders.join(' | '),
        documentCount,
        candidatePairCount,
        highFrequencyCutoff,
        promptCatalogTruncated,
        candidatePairsCapped,
        outputTruncated,
        note,
      ];
    });
  const summaryRow = [
    'summary',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    documentCount,
    candidatePairCount,
    highFrequencyCutoff,
    promptCatalogTruncated,
    candidatePairsCapped,
    outputTruncated,
    note,
  ];
  return `${[headers, summaryRow, ...csvRows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

/** Export connected components of lexically similar prompt groups for robustness and sampling review. */
export function renderAiAnswerCitationPromptFamiliesCsv(
  report: AiAnswerCitationObservationReport,
  minimumCosineSimilarity = 0.85,
  categoryMappings: Array<{ domain: string; label: string; labelKey: string }> = []
): string {
  if (
    !Number.isFinite(minimumCosineSimilarity) ||
    minimumCosineSimilarity < 0 ||
    minimumCosineSimilarity > 1
  ) {
    throw new Error('Prompt-family similarity threshold must be between 0 and 1.');
  }
  if (categoryMappings.length > 500)
    throw new Error('Prompt-family category sensitivity accepts at most 500 normalized mappings.');
  const categoryMappingsByDomain = new Map<string, string>();
  for (const { domain, labelKey } of categoryMappings) {
    const normalizedDomain = domain.toLowerCase().replace(/^\.+|\.+$/gu, '');
    if (normalizedDomain) categoryMappingsByDomain.set(normalizedDomain, labelKey);
  }
  const analysis = analyzePromptSimilarity(report, minimumCosineSimilarity);
  const parent = report.prompts.map((_, index) => index);
  const findRoot = (index: number): number => {
    let root = index;
    while (parent[root] !== root) root = parent[root]!;
    while (parent[index] !== index) {
      const next = parent[index]!;
      parent[index] = root;
      index = next;
    }
    return root;
  };
  const promptIndexes = new Map(
    report.prompts.map((profile, index) => [normalizedPrompt(profile.prompt), index])
  );
  for (const edge of analysis.rows) {
    const left = promptIndexes.get(normalizedPrompt(edge.left.profile.prompt));
    const right = promptIndexes.get(normalizedPrompt(edge.right.profile.prompt));
    if (left === undefined || right === undefined) continue;
    const leftRoot = findRoot(left);
    const rightRoot = findRoot(right);
    if (leftRoot !== rightRoot)
      parent[Math.max(leftRoot, rightRoot)] = Math.min(leftRoot, rightRoot);
  }
  const components = new Map<number, AiAnswerCitationPromptProfile[]>();
  report.prompts.forEach((profile, index) => {
    const root = findRoot(index);
    const component = components.get(root) ?? [];
    component.push(profile);
    components.set(root, component);
  });
  const sortedComponents = [...components.values()]
    .map((members) =>
      members.sort((left, right) =>
        normalizedPrompt(left.prompt).localeCompare(normalizedPrompt(right.prompt))
      )
    )
    .sort((left, right) =>
      normalizedPrompt(left[0]!.prompt).localeCompare(normalizedPrompt(right[0]!.prompt))
    );
  const componentByPrompt = new Map<string, number>();
  sortedComponents.forEach((members, componentIndex) => {
    for (const member of members)
      componentByPrompt.set(normalizedPrompt(member.prompt), componentIndex);
  });
  const similaritiesByComponent = new Map<number, number[]>();
  for (const edge of analysis.rows) {
    const componentIndex = componentByPrompt.get(normalizedPrompt(edge.left.profile.prompt));
    if (
      componentIndex === undefined ||
      componentIndex !== componentByPrompt.get(normalizedPrompt(edge.right.profile.prompt))
    )
      continue;
    const similarities = similaritiesByComponent.get(componentIndex) ?? [];
    similarities.push(edge.cosine);
    similaritiesByComponent.set(componentIndex, similarities);
  }
  const adjacencyByComponent = new Map<number, Map<number, Set<number>>>();
  sortedComponents.forEach((members, componentIndex) => {
    const adjacency = new Map<number, Set<number>>();
    for (const member of members) {
      const promptIndex = promptIndexes.get(normalizedPrompt(member.prompt));
      if (promptIndex !== undefined) adjacency.set(promptIndex, new Set());
    }
    adjacencyByComponent.set(componentIndex, adjacency);
  });
  for (const edge of analysis.rows) {
    const left = promptIndexes.get(normalizedPrompt(edge.left.profile.prompt));
    const right = promptIndexes.get(normalizedPrompt(edge.right.profile.prompt));
    if (left === undefined || right === undefined) continue;
    const componentIndex = componentByPrompt.get(normalizedPrompt(edge.left.profile.prompt));
    if (
      componentIndex === undefined ||
      componentIndex !== componentByPrompt.get(normalizedPrompt(edge.right.profile.prompt))
    )
      continue;
    const adjacency = adjacencyByComponent.get(componentIndex)!;
    adjacency.get(left)!.add(right);
    adjacency.get(right)!.add(left);
  }
  const articulationPromptIndexesByComponent = new Map<number, number[]>();
  for (const [componentIndex, adjacency] of adjacencyByComponent) {
    articulationPromptIndexesByComponent.set(
      componentIndex,
      findArticulationPromptIndexes(adjacency)
    );
  }

  const rows: Array<Record<string, unknown>> = sortedComponents.map((members, index) => {
    const similarities = similaritiesByComponent.get(index) ?? [];
    const articulationPrompts = (articulationPromptIndexesByComponent.get(index) ?? []).map(
      (promptIndex) => report.prompts[promptIndex]!.prompt
    );
    const providers = new Set(members.flatMap((member) => member.providers));
    const totalPossiblePairs = (members.length * (members.length - 1)) / 2;
    return {
      row_type: 'prompt-family',
      prompt_family_id: `family-${String(index + 1).padStart(5, '0')}`,
      family_kind: members.length > 1 ? 'lexically-connected' : 'singleton',
      member_prompt_groups: members.length,
      member_prompts_json: JSON.stringify(members.map((member) => member.prompt)),
      observations_total: members.reduce((sum, member) => sum + member.observations, 0),
      providers_json: JSON.stringify(
        [...providers].sort((left, right) => left.localeCompare(right))
      ),
      direct_similarity_edges: similarities.length,
      articulation_prompt_groups: articulationPrompts.length,
      articulation_prompts_json: JSON.stringify(articulationPrompts),
      possible_member_pairs: totalPossiblePairs,
      edge_density:
        totalPossiblePairs > 0
          ? Number((similarities.length / totalPossiblePairs).toFixed(4))
          : null,
      mean_edge_cosine: similarities.length
        ? Number(
            (similarities.reduce((sum, value) => sum + value, 0) / similarities.length).toFixed(4)
          )
        : null,
      min_edge_cosine: similarities.length
        ? Number(
            similarities
              .reduce((minimum, value) => Math.min(minimum, value), Number.POSITIVE_INFINITY)
              .toFixed(4)
          )
        : null,
      max_edge_cosine: similarities.length
        ? Number(
            similarities
              .reduce((maximum, value) => Math.max(maximum, value), Number.NEGATIVE_INFINITY)
              .toFixed(4)
          )
        : null,
      minimum_cosine_threshold: minimumCosineSimilarity,
      retained_prompt_groups: analysis.documentCount,
      candidate_pairs_considered: analysis.candidatePairCount,
      high_frequency_posting_cutoff: analysis.highFrequencyCutoff,
      prompt_catalog_truncated: analysis.promptCatalogTruncated,
      candidate_pairs_capped: analysis.candidatePairsCapped,
      output_rows_truncated: sortedComponents.length > MAX_OUTPUT_ROWS,
    };
  });
  const providerFamilyData = new Map<
    string,
    {
      provider: string;
      familyCitationRates: number[];
      familyOwnedCitationRates: number[];
      familyOwnedCitationUpperRates: number[];
      promptGroups: number;
      promptsWithCitations: number;
      ownedPromptGroups: number;
      ownedPromptsWithCitations: number;
      unknownOwnedPromptGroups: number;
      ownedDetailsComplete: boolean;
      ownedReachBoundsComplete: boolean;
      ownedReachMetadataComplete: boolean;
      eventHhiRates: number[];
      eventBreadthRates: number[];
      eventLargestShares: number[];
      eventSourceDetailsComplete: boolean;
      eventCategoryHhiRates: number[];
      eventCategoryBreadthRates: number[];
      eventCategoryLargestShares: number[];
      eventCategoryMappedShareRates: number[];
      pooledEventDomains: Map<string, number>;
      rankHhiRates: number[];
      rankBreadthRates: number[];
      rankLargestShares: number[];
      rankSourceDetailsComplete: boolean;
      rankCategoryHhiRates: number[];
      rankCategoryBreadthRates: number[];
      rankCategoryLargestShares: number[];
      rankCategoryMappedShareRates: number[];
      pooledRankDomains: Map<string, number>;
      expectedPromptGroups: number | null;
      promptProfilesComplete: boolean;
    }
  >();
  const providerFamilyDetailRows: Array<Record<string, unknown>> = [];
  let providerFamilyDetailRowsAvailable = 0;
  const ownedDomains = report.ownedDomains
    .map((domain) => domain.toLowerCase().replace(/^\.+|\.+$/gu, ''))
    .filter(Boolean);
  const isOwnedDomain = (domain: string): boolean =>
    ownedDomains.some((owned) => domain === owned || domain.endsWith(`.${owned}`));
  for (const [familyIndex, members] of sortedComponents.entries()) {
    const familyProviders = new Map<
      string,
      {
        provider: string;
        promptGroups: number;
        promptsWithCitations: number;
        observations: number;
        observationsWithCitations: number;
        ownedCitationEventsObserved: number;
        ownedFirstPositionCitationEvents: number;
        ownedTopThreeCitationEvents: number;
        ownedFirstCitationMrrByPrompt: number[];
        ownedPromptGroups: number;
        ownedPromptsWithCitations: number;
        confirmedOwnedAbsentPromptGroups: number;
        confirmedOwnedAbsentPromptSamples: string[];
        confirmedOwnedAbsentPromptSamplesTruncated: boolean;
        unknownOwnedPromptGroups: number;
        unknownOwnedPromptSamples: string[];
        unknownOwnedPromptSamplesTruncated: boolean;
        ownedDetailsComplete: boolean;
        ownedReachBoundsComplete: boolean;
        ownedReachMetadataComplete: boolean;
        ownedRankDetailsComplete: boolean;
        firstObservedAt: string;
        lastObservedAt: string;
        eventDetailComplete: boolean;
        eventDomains: Map<string, number>;
        rankDetailComplete: boolean;
        rankDomains: Map<string, number>;
      }
    >();
    for (const member of members) {
      for (const profile of member.providerProfiles ?? []) {
        const key = normalizedPrompt(profile.provider);
        const familyProvider = familyProviders.get(key) ?? {
          provider: profile.provider,
          promptGroups: 0,
          promptsWithCitations: 0,
          observations: 0,
          observationsWithCitations: 0,
          ownedCitationEventsObserved: 0,
          ownedFirstPositionCitationEvents: 0,
          ownedTopThreeCitationEvents: 0,
          ownedFirstCitationMrrByPrompt: [] as number[],
          ownedPromptGroups: 0,
          ownedPromptsWithCitations: 0,
          confirmedOwnedAbsentPromptGroups: 0,
          confirmedOwnedAbsentPromptSamples: [] as string[],
          confirmedOwnedAbsentPromptSamplesTruncated: false,
          unknownOwnedPromptGroups: 0,
          unknownOwnedPromptSamples: [] as string[],
          unknownOwnedPromptSamplesTruncated: false,
          ownedDetailsComplete: true,
          ownedReachBoundsComplete: true,
          ownedReachMetadataComplete: true,
          ownedRankDetailsComplete: true,
          firstObservedAt: profile.firstObservedAt,
          lastObservedAt: profile.lastObservedAt,
          eventDetailComplete: true,
          eventDomains: new Map(),
          rankDetailComplete: true,
          rankDomains: new Map(),
        };
        familyProvider.promptGroups += 1;
        familyProvider.observations += profile.observations;
        familyProvider.observationsWithCitations += profile.observationsWithCitations;
        if (profile.firstObservedAt < familyProvider.firstObservedAt)
          familyProvider.firstObservedAt = profile.firstObservedAt;
        if (profile.lastObservedAt > familyProvider.lastObservedAt)
          familyProvider.lastObservedAt = profile.lastObservedAt;
        if (profile.citationEvents > 0) familyProvider.promptsWithCitations += 1;
        const eventDomains = new Map<string, number>();
        let validEventDetail = true;
        for (const item of profile.citedDomainCitationEvents ?? []) {
          if (!Number.isFinite(item.citationEvents) || item.citationEvents < 0) {
            validEventDetail = false;
            continue;
          }
          const domain = item.domain.toLowerCase();
          eventDomains.set(domain, (eventDomains.get(domain) ?? 0) + item.citationEvents);
        }
        const listedCitationEvents = [...eventDomains.values()].reduce(
          (sum, events) => sum + events,
          0
        );
        familyProvider.eventDetailComplete &&=
          Array.isArray(profile.citedDomainCitationEvents) &&
          profile.citedDomainsTruncated === false &&
          validEventDetail &&
          listedCitationEvents === profile.citationEvents;
        for (const [domain, events] of eventDomains)
          familyProvider.eventDomains.set(
            domain,
            (familyProvider.eventDomains.get(domain) ?? 0) + events
          );

        const rankDomains = new Map<string, number>();
        let validRankDetail = true;
        for (const item of profile.rankWeightedDomainCitationEvents ?? []) {
          if (
            !Number.isFinite(item.discountedCitationWeight) ||
            item.discountedCitationWeight < 0
          ) {
            validRankDetail = false;
            continue;
          }
          const domain = item.domain.toLowerCase();
          rankDomains.set(domain, (rankDomains.get(domain) ?? 0) + item.discountedCitationWeight);
        }
        const rankWeightTotal = profile.rankWeightedCitationWeightTotal ?? 0;
        const listedRankWeight = [...rankDomains.values()].reduce((sum, weight) => sum + weight, 0);
        const rankWeightTolerance = Math.max(1e-9, rankWeightTotal * 1e-9);
        familyProvider.rankDetailComplete &&=
          Array.isArray(profile.rankWeightedDomainCitationEvents) &&
          Number.isFinite(profile.rankWeightedCitationWeightTotal) &&
          profile.rankWeightedDomainsTruncated === false &&
          validRankDetail &&
          Math.abs(listedRankWeight - rankWeightTotal) <= rankWeightTolerance &&
          (profile.citationEvents > 0
            ? rankWeightTotal > 0 && rankWeightTotal <= profile.citationEvents + rankWeightTolerance
            : rankWeightTotal === 0);
        for (const [domain, weight] of rankDomains)
          familyProvider.rankDomains.set(
            domain,
            (familyProvider.rankDomains.get(domain) ?? 0) + weight
          );
        if (
          typeof profile.ownedCitationEvents === 'number' &&
          Number.isSafeInteger(profile.ownedCitationEvents) &&
          profile.ownedCitationEvents >= 0
        ) {
          familyProvider.ownedCitationEventsObserved += profile.ownedCitationEvents;
          familyProvider.ownedPromptGroups += 1;
          if (profile.ownedCitationEvents > 0) {
            familyProvider.ownedPromptsWithCitations += 1;
            const firstPositionEvents = profile.ownedFirstPositionCitationEvents;
            const topThreeEvents = profile.ownedTopThreeCitationEvents;
            const firstCitationMrr = profile.ownedFirstCitationMeanReciprocalRankPercent;
            const validRankMetrics =
              Number.isInteger(firstPositionEvents) &&
              firstPositionEvents! >= 0 &&
              firstPositionEvents! <= profile.ownedCitationEvents &&
              Number.isInteger(topThreeEvents) &&
              topThreeEvents! >= firstPositionEvents! &&
              topThreeEvents! <= profile.ownedCitationEvents &&
              Number.isFinite(firstCitationMrr) &&
              firstCitationMrr! >= 0 &&
              firstCitationMrr! <= 100;
            if (validRankMetrics) {
              familyProvider.ownedFirstPositionCitationEvents += firstPositionEvents!;
              familyProvider.ownedTopThreeCitationEvents += topThreeEvents!;
              familyProvider.ownedFirstCitationMrrByPrompt.push(firstCitationMrr!);
            } else {
              familyProvider.ownedRankDetailsComplete = false;
            }
          } else if (
            Number.isInteger(profile.incompleteCitationListObservations) &&
            profile.incompleteCitationListObservations! >= 0 &&
            profile.incompleteCitationListObservations! <= profile.observations
          ) {
            if (profile.incompleteCitationListObservations! > 0) {
              familyProvider.unknownOwnedPromptGroups += 1;
              if (familyProvider.unknownOwnedPromptSamples.length < 3)
                familyProvider.unknownOwnedPromptSamples.push(member.prompt);
              else familyProvider.unknownOwnedPromptSamplesTruncated = true;
            } else {
              familyProvider.confirmedOwnedAbsentPromptGroups += 1;
              if (familyProvider.confirmedOwnedAbsentPromptSamples.length < 3)
                familyProvider.confirmedOwnedAbsentPromptSamples.push(member.prompt);
              else familyProvider.confirmedOwnedAbsentPromptSamplesTruncated = true;
            }
          } else {
            familyProvider.unknownOwnedPromptGroups += 1;
            familyProvider.ownedReachMetadataComplete = false;
            if (familyProvider.unknownOwnedPromptSamples.length < 3)
              familyProvider.unknownOwnedPromptSamples.push(member.prompt);
            else familyProvider.unknownOwnedPromptSamplesTruncated = true;
          }
        } else {
          familyProvider.ownedDetailsComplete = false;
          familyProvider.ownedReachMetadataComplete = false;
          familyProvider.ownedRankDetailsComplete = false;
          familyProvider.unknownOwnedPromptGroups += 1;
          if (familyProvider.unknownOwnedPromptSamples.length < 3)
            familyProvider.unknownOwnedPromptSamples.push(member.prompt);
          else familyProvider.unknownOwnedPromptSamplesTruncated = true;
        }
        familyProviders.set(key, familyProvider);
      }
    }
    for (const [key, familyProvider] of familyProviders) {
      providerFamilyDetailRowsAvailable += 1;
      if (providerFamilyDetailRows.length < MAX_FAMILY_PROVIDER_ROWS) {
        const alternativeDomains =
          ownedDomains.length > 0
            ? [...familyProvider.eventDomains.entries()]
                .filter(([domain]) => !isOwnedDomain(domain))
                .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
                .slice(0, 5)
                .map(([domain, citationEvents]) => ({ domain, citationEvents }))
            : [];
        const alternativeCitationEvents = alternativeDomains.reduce(
          (sum, item) => sum + item.citationEvents,
          0
        );
        const familyOwnedLower =
          report.ownedDomains.length > 0 && familyProvider.ownedReachBoundsComplete
            ? (familyProvider.ownedPromptsWithCitations / familyProvider.promptGroups) * 100
            : null;
        const familyOwnedUpper =
          report.ownedDomains.length > 0 && familyProvider.ownedReachBoundsComplete
            ? ((familyProvider.ownedPromptsWithCitations +
                familyProvider.unknownOwnedPromptGroups) /
                familyProvider.promptGroups) *
              100
            : null;
        const ownedFirstPositionShare =
          report.ownedDomains.length > 0 &&
          familyProvider.ownedRankDetailsComplete &&
          familyProvider.ownedCitationEventsObserved > 0
            ? (familyProvider.ownedFirstPositionCitationEvents /
                familyProvider.ownedCitationEventsObserved) *
              100
            : null;
        const familyEventConcentration = familyProvider.eventDetailComplete
          ? sourceConcentration(familyProvider.eventDomains)
          : null;
        const familyRankConcentration = familyProvider.rankDetailComplete
          ? sourceConcentration(familyProvider.rankDomains)
          : null;
        const familyEventCategories = aggregatePromptFamilyCategoryWeights(
          familyProvider.eventDomains,
          categoryMappingsByDomain
        );
        const familyRankCategories = aggregatePromptFamilyCategoryWeights(
          familyProvider.rankDomains,
          categoryMappingsByDomain
        );
        const familyEventCategoryConcentration = familyProvider.eventDetailComplete
          ? sourceConcentration(familyEventCategories.categoryWeights)
          : null;
        const familyRankCategoryConcentration = familyProvider.rankDetailComplete
          ? sourceConcentration(familyRankCategories.categoryWeights)
          : null;
        const familyTopEventSources = [...familyProvider.eventDomains.entries()]
          .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
          .slice(0, 5)
          .map(([domain, citationEvents]) => ({ domain, citationEvents }));
        const familyTopRankSources = [...familyProvider.rankDomains.entries()]
          .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
          .slice(0, 5)
          .map(([domain, discountedCitationWeight]) => ({ domain, discountedCitationWeight }));
        const ownedTopThreeShare =
          report.ownedDomains.length > 0 &&
          familyProvider.ownedRankDetailsComplete &&
          familyProvider.ownedCitationEventsObserved > 0
            ? (familyProvider.ownedTopThreeCitationEvents /
                familyProvider.ownedCitationEventsObserved) *
              100
            : null;
        const equalPromptOwnedFirstCitationMrr =
          report.ownedDomains.length > 0 &&
          familyProvider.ownedRankDetailsComplete &&
          familyProvider.ownedFirstCitationMrrByPrompt.length > 0
            ? familyProvider.ownedFirstCitationMrrByPrompt.reduce((sum, value) => sum + value, 0) /
              familyProvider.ownedFirstCitationMrrByPrompt.length
            : null;
        const ownedReachState =
          report.ownedDomains.length === 0
            ? 'not-configured'
            : familyProvider.unknownOwnedPromptGroups > 0
              ? 'bounded-with-unknown-groups'
              : familyProvider.ownedDetailsComplete
                ? 'fully-observed'
                : 'ownership-detail-incomplete';
        providerFamilyDetailRows.push({
          row_type: 'prompt-family-provider',
          prompt_family_id: `family-${String(familyIndex + 1).padStart(5, '0')}`,
          provider: familyProvider.provider,
          family_provider_prompt_groups: familyProvider.promptGroups,
          family_provider_prompt_groups_with_citations: familyProvider.promptsWithCitations,
          family_provider_citation_prompt_reach_percent: Number(
            ((familyProvider.promptsWithCitations / familyProvider.promptGroups) * 100).toFixed(4)
          ),
          family_provider_observations: familyProvider.observations,
          family_provider_observations_with_citations: familyProvider.observationsWithCitations,
          family_provider_citation_snapshot_coverage_percent:
            familyProvider.observations > 0
              ? Number(
                  (
                    (familyProvider.observationsWithCitations / familyProvider.observations) *
                    100
                  ).toFixed(4)
                )
              : null,
          family_provider_observed_owned_prompt_groups:
            report.ownedDomains.length > 0 ? familyProvider.ownedPromptsWithCitations : null,
          family_provider_confirmed_owned_absent_prompt_groups:
            report.ownedDomains.length > 0 && familyProvider.ownedReachBoundsComplete
              ? familyProvider.confirmedOwnedAbsentPromptGroups
              : null,
          family_provider_confirmed_owned_absent_prompt_samples_json:
            report.ownedDomains.length > 0
              ? JSON.stringify(familyProvider.confirmedOwnedAbsentPromptSamples)
              : null,
          family_provider_confirmed_owned_absent_prompt_samples_truncated:
            report.ownedDomains.length > 0
              ? familyProvider.confirmedOwnedAbsentPromptSamplesTruncated
              : null,
          family_provider_unknown_owned_prompt_groups:
            report.ownedDomains.length > 0 && familyProvider.ownedReachBoundsComplete
              ? familyProvider.unknownOwnedPromptGroups
              : null,
          family_provider_unknown_owned_prompt_samples_json:
            report.ownedDomains.length > 0
              ? JSON.stringify(familyProvider.unknownOwnedPromptSamples)
              : null,
          family_provider_unknown_owned_prompt_samples_truncated:
            report.ownedDomains.length > 0
              ? familyProvider.unknownOwnedPromptSamplesTruncated
              : null,
          family_provider_owned_prompt_reach_lower_bound_percent:
            familyOwnedLower === null ? null : Number(familyOwnedLower.toFixed(4)),
          family_provider_owned_prompt_reach_upper_bound_percent:
            familyOwnedUpper === null ? null : Number(familyOwnedUpper.toFixed(4)),
          family_provider_owned_prompt_reach_state: ownedReachState,
          family_provider_owned_citation_events:
            report.ownedDomains.length > 0 && familyProvider.ownedDetailsComplete
              ? familyProvider.ownedCitationEventsObserved
              : null,
          family_provider_owned_first_position_event_share_percent:
            ownedFirstPositionShare === null ? null : Number(ownedFirstPositionShare.toFixed(4)),
          family_provider_owned_top_three_event_share_percent:
            ownedTopThreeShare === null ? null : Number(ownedTopThreeShare.toFixed(4)),
          family_provider_equal_prompt_owned_first_citation_mrr_percent:
            equalPromptOwnedFirstCitationMrr === null
              ? null
              : Number(equalPromptOwnedFirstCitationMrr.toFixed(4)),
          family_provider_event_weighted_source_hhi: familyEventConcentration?.hhi ?? null,
          family_provider_event_weighted_effective_source_count:
            familyEventConcentration?.effectiveSources ?? null,
          family_provider_event_weighted_largest_source_share_percent:
            familyEventConcentration === null
              ? null
              : Number((familyEventConcentration.largestShare * 100).toFixed(4)),
          family_provider_rank_weighted_source_hhi: familyRankConcentration?.hhi ?? null,
          family_provider_rank_weighted_effective_source_count:
            familyRankConcentration?.effectiveSources ?? null,
          family_provider_rank_weighted_largest_source_share_percent:
            familyRankConcentration === null
              ? null
              : Number((familyRankConcentration.largestShare * 100).toFixed(4)),
          family_provider_event_weighted_category_hhi:
            familyEventCategoryConcentration?.hhi ?? null,
          family_provider_event_weighted_effective_category_count:
            familyEventCategoryConcentration?.effectiveSources ?? null,
          family_provider_event_weighted_largest_category_share_percent:
            familyEventCategoryConcentration === null
              ? null
              : Number((familyEventCategoryConcentration.largestShare * 100).toFixed(4)),
          family_provider_event_mapped_category_weight_share_percent:
            familyEventCategories.mappedSharePercent,
          family_provider_rank_weighted_category_hhi: familyRankCategoryConcentration?.hhi ?? null,
          family_provider_rank_weighted_effective_category_count:
            familyRankCategoryConcentration?.effectiveSources ?? null,
          family_provider_rank_weighted_largest_category_share_percent:
            familyRankCategoryConcentration === null
              ? null
              : Number((familyRankCategoryConcentration.largestShare * 100).toFixed(4)),
          family_provider_rank_mapped_category_weight_share_percent:
            familyRankCategories.mappedSharePercent,
          family_provider_event_source_detail_complete: familyProvider.eventDetailComplete,
          family_provider_rank_source_detail_complete: familyProvider.rankDetailComplete,
          family_provider_top_event_sources_json: JSON.stringify(familyTopEventSources),
          family_provider_top_rank_sources_json: JSON.stringify(familyTopRankSources),
          family_provider_owned_rank_detail_complete:
            report.ownedDomains.length > 0 && familyProvider.ownedRankDetailsComplete,
          observed_alternative_citation_events_top_five: alternativeCitationEvents,
          top_observed_alternative_domains_json:
            report.ownedDomains.length > 0 ? JSON.stringify(alternativeDomains) : null,
          alternative_domain_detail_complete:
            report.ownedDomains.length > 0 && familyProvider.eventDetailComplete,
          first_observed_at: familyProvider.firstObservedAt,
          last_observed_at: familyProvider.lastObservedAt,
        });
      }
      const providerData: NonNullable<ReturnType<typeof providerFamilyData.get>> =
        providerFamilyData.get(key) ?? {
          provider: familyProvider.provider,
          familyCitationRates: [],
          familyOwnedCitationRates: [],
          familyOwnedCitationUpperRates: [],
          promptGroups: 0,
          promptsWithCitations: 0,
          ownedPromptGroups: 0,
          ownedPromptsWithCitations: 0,
          unknownOwnedPromptGroups: 0,
          ownedDetailsComplete: true,
          ownedReachBoundsComplete: true,
          ownedReachMetadataComplete: true,
          eventHhiRates: [],
          eventBreadthRates: [],
          eventLargestShares: [],
          eventSourceDetailsComplete: true,
          eventCategoryHhiRates: [],
          eventCategoryBreadthRates: [],
          eventCategoryLargestShares: [],
          eventCategoryMappedShareRates: [],
          pooledEventDomains: new Map(),
          rankHhiRates: [],
          rankBreadthRates: [],
          rankLargestShares: [],
          rankSourceDetailsComplete: true,
          rankCategoryHhiRates: [],
          rankCategoryBreadthRates: [],
          rankCategoryLargestShares: [],
          rankCategoryMappedShareRates: [],
          pooledRankDomains: new Map(),
          expectedPromptGroups: null,
          promptProfilesComplete: false,
        };
      providerData.familyCitationRates.push(
        familyProvider.promptsWithCitations / familyProvider.promptGroups
      );
      providerData.promptGroups += familyProvider.promptGroups;
      providerData.promptsWithCitations += familyProvider.promptsWithCitations;
      providerData.ownedPromptGroups += familyProvider.ownedPromptGroups;
      providerData.ownedPromptsWithCitations += familyProvider.ownedPromptsWithCitations;
      providerData.unknownOwnedPromptGroups += familyProvider.unknownOwnedPromptGroups;
      providerData.ownedDetailsComplete &&=
        familyProvider.ownedDetailsComplete &&
        familyProvider.ownedPromptGroups === familyProvider.promptGroups;
      providerData.ownedReachBoundsComplete &&=
        familyProvider.ownedReachBoundsComplete && familyProvider.promptGroups > 0;
      providerData.ownedReachMetadataComplete &&=
        familyProvider.ownedReachMetadataComplete && familyProvider.promptGroups > 0;
      const eventConcentration = sourceConcentration(familyProvider.eventDomains);
      providerData.eventSourceDetailsComplete &&= familyProvider.eventDetailComplete;
      if (familyProvider.eventDetailComplete && eventConcentration) {
        providerData.eventHhiRates.push(eventConcentration.hhi);
        providerData.eventBreadthRates.push(eventConcentration.effectiveSources);
        providerData.eventLargestShares.push(eventConcentration.largestShare);
      }
      const eventCategories = aggregatePromptFamilyCategoryWeights(
        familyProvider.eventDomains,
        categoryMappingsByDomain
      );
      const eventCategoryConcentration = sourceConcentration(eventCategories.categoryWeights);
      if (familyProvider.eventDetailComplete) {
        for (const [domain, weight] of familyProvider.eventDomains) {
          providerData.pooledEventDomains.set(
            domain,
            (providerData.pooledEventDomains.get(domain) ?? 0) + weight
          );
        }
        if (categoryMappings.length > 0 && eventCategoryConcentration) {
          providerData.eventCategoryHhiRates.push(eventCategoryConcentration.hhi);
          providerData.eventCategoryBreadthRates.push(eventCategoryConcentration.effectiveSources);
          providerData.eventCategoryLargestShares.push(eventCategoryConcentration.largestShare);
        }
        if (categoryMappings.length > 0 && eventCategories.mappedSharePercent !== null) {
          providerData.eventCategoryMappedShareRates.push(eventCategories.mappedSharePercent);
        }
      }
      const rankConcentration = sourceConcentration(familyProvider.rankDomains);
      providerData.rankSourceDetailsComplete &&= familyProvider.rankDetailComplete;
      if (familyProvider.rankDetailComplete && rankConcentration) {
        providerData.rankHhiRates.push(rankConcentration.hhi);
        providerData.rankBreadthRates.push(rankConcentration.effectiveSources);
        providerData.rankLargestShares.push(rankConcentration.largestShare);
      }
      const rankCategories = aggregatePromptFamilyCategoryWeights(
        familyProvider.rankDomains,
        categoryMappingsByDomain
      );
      const rankCategoryConcentration = sourceConcentration(rankCategories.categoryWeights);
      if (familyProvider.rankDetailComplete) {
        for (const [domain, weight] of familyProvider.rankDomains) {
          providerData.pooledRankDomains.set(
            domain,
            (providerData.pooledRankDomains.get(domain) ?? 0) + weight
          );
        }
        if (categoryMappings.length > 0 && rankCategoryConcentration) {
          providerData.rankCategoryHhiRates.push(rankCategoryConcentration.hhi);
          providerData.rankCategoryBreadthRates.push(rankCategoryConcentration.effectiveSources);
          providerData.rankCategoryLargestShares.push(rankCategoryConcentration.largestShare);
        }
        if (categoryMappings.length > 0 && rankCategories.mappedSharePercent !== null) {
          providerData.rankCategoryMappedShareRates.push(rankCategories.mappedSharePercent);
        }
      }
      if (familyProvider.ownedReachBoundsComplete && familyProvider.promptGroups > 0) {
        providerData.familyOwnedCitationRates.push(
          familyProvider.ownedPromptsWithCitations / familyProvider.promptGroups
        );
        providerData.familyOwnedCitationUpperRates.push(
          (familyProvider.ownedPromptsWithCitations + familyProvider.unknownOwnedPromptGroups) /
            familyProvider.promptGroups
        );
      }
      providerFamilyData.set(key, providerData);
    }
  }
  for (const provider of report.providers) {
    const key = normalizedPrompt(provider.provider);
    if (!providerFamilyData.has(key)) {
      providerFamilyData.set(key, {
        provider: provider.provider,
        familyCitationRates: [],
        familyOwnedCitationRates: [],
        familyOwnedCitationUpperRates: [],
        promptGroups: 0,
        promptsWithCitations: 0,
        ownedPromptGroups: 0,
        ownedPromptsWithCitations: 0,
        unknownOwnedPromptGroups: 0,
        ownedDetailsComplete: false,
        ownedReachBoundsComplete: false,
        ownedReachMetadataComplete: false,
        eventHhiRates: [],
        eventBreadthRates: [],
        eventLargestShares: [],
        eventSourceDetailsComplete: false,
        eventCategoryHhiRates: [],
        eventCategoryBreadthRates: [],
        eventCategoryLargestShares: [],
        eventCategoryMappedShareRates: [],
        pooledEventDomains: new Map(),
        rankHhiRates: [],
        rankBreadthRates: [],
        rankLargestShares: [],
        rankSourceDetailsComplete: false,
        rankCategoryHhiRates: [],
        rankCategoryBreadthRates: [],
        rankCategoryLargestShares: [],
        rankCategoryMappedShareRates: [],
        pooledRankDomains: new Map(),
        expectedPromptGroups: provider.uniquePrompts,
        promptProfilesComplete: false,
      });
    } else {
      providerFamilyData.get(key)!.expectedPromptGroups = provider.uniquePrompts;
    }
  }
  for (const provider of providerFamilyData.values()) {
    provider.promptProfilesComplete =
      !analysis.promptCatalogTruncated &&
      provider.expectedPromptGroups !== null &&
      provider.promptGroups === provider.expectedPromptGroups;
  }
  const providerRows = [...providerFamilyData.entries()].sort((left, right) =>
    left[1].provider.localeCompare(right[1].provider)
  );
  const totalFamilyBootstrapSupport = providerRows.reduce(
    (sum, [, provider]) =>
      sum +
      provider.familyCitationRates.length +
      (report.ownedDomains.length > 0 && provider.ownedReachBoundsComplete
        ? provider.familyOwnedCitationRates.length + provider.familyOwnedCitationUpperRates.length
        : 0) +
      (provider.eventSourceDetailsComplete
        ? provider.eventHhiRates.length +
          provider.eventBreadthRates.length +
          provider.eventLargestShares.length
        : 0) +
      (provider.rankSourceDetailsComplete
        ? provider.rankHhiRates.length +
          provider.rankBreadthRates.length +
          provider.rankLargestShares.length
        : 0) +
      (categoryMappings.length > 0 && provider.eventSourceDetailsComplete
        ? provider.eventCategoryHhiRates.length +
          provider.eventCategoryBreadthRates.length +
          provider.eventCategoryLargestShares.length
        : 0) +
      (categoryMappings.length > 0 && provider.rankSourceDetailsComplete
        ? provider.rankCategoryHhiRates.length +
          provider.rankCategoryBreadthRates.length +
          provider.rankCategoryLargestShares.length
        : 0),
    0
  );
  const familyBootstrapIterations =
    totalFamilyBootstrapSupport > 0
      ? Math.min(
          FAMILY_BOOTSTRAP_ITERATIONS,
          Math.floor(MAX_FAMILY_BOOTSTRAP_DRAWS / totalFamilyBootstrapSupport)
        )
      : 0;
  const usableFamilyBootstrapIterations =
    familyBootstrapIterations >= MIN_FAMILY_BOOTSTRAP_ITERATIONS ? familyBootstrapIterations : 0;
  const providerSummaryRows: Array<Record<string, unknown>> = providerRows
    .slice(0, MAX_PROMPT_FAMILY_PROVIDER_SUMMARY_ROWS)
    .map(([key, provider]) => {
      const providerProfile = report.providers.find(
        (item) => normalizedPrompt(item.provider) === key
      );
      const exactCitationReach =
        provider.promptGroups > 0 ? provider.promptsWithCitations / provider.promptGroups : null;
      const familyCitationReach =
        provider.familyCitationRates.length > 0
          ? provider.familyCitationRates.reduce((sum, value) => sum + value, 0) /
            provider.familyCitationRates.length
          : null;
      const exactOwnedReach =
        report.ownedDomains.length > 0 &&
        provider.ownedReachBoundsComplete &&
        provider.promptGroups > 0
          ? provider.ownedPromptsWithCitations / provider.promptGroups
          : null;
      const exactOwnedReachUpper =
        report.ownedDomains.length > 0 &&
        provider.ownedReachBoundsComplete &&
        provider.promptGroups > 0
          ? (provider.ownedPromptsWithCitations + provider.unknownOwnedPromptGroups) /
            provider.promptGroups
          : null;
      const familyOwnedReach =
        report.ownedDomains.length > 0 &&
        provider.ownedReachBoundsComplete &&
        provider.familyOwnedCitationRates.length > 0
          ? provider.familyOwnedCitationRates.reduce((sum, value) => sum + value, 0) /
            provider.familyOwnedCitationRates.length
          : null;
      const familyOwnedReachUpper =
        report.ownedDomains.length > 0 &&
        provider.ownedReachBoundsComplete &&
        provider.familyOwnedCitationUpperRates.length > 0
          ? provider.familyOwnedCitationUpperRates.reduce((sum, value) => sum + value, 0) /
            provider.familyOwnedCitationUpperRates.length
          : null;
      const providerPromptProfilesComplete =
        !analysis.promptCatalogTruncated &&
        !analysis.candidatePairsCapped &&
        provider.promptProfilesComplete;
      const eventFamilyDetailsComplete =
        providerPromptProfilesComplete && provider.eventSourceDetailsComplete;
      const rankFamilyDetailsComplete =
        providerPromptProfilesComplete && provider.rankSourceDetailsComplete;
      const mean = (values: number[]): number | null =>
        values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
      const familyEventHhi = eventFamilyDetailsComplete ? mean(provider.eventHhiRates) : null;
      const familyEventBreadth = eventFamilyDetailsComplete
        ? mean(provider.eventBreadthRates)
        : null;
      const familyEventLargestShare = eventFamilyDetailsComplete
        ? mean(provider.eventLargestShares)
        : null;
      const familyRankHhi = rankFamilyDetailsComplete ? mean(provider.rankHhiRates) : null;
      const familyRankBreadth = rankFamilyDetailsComplete ? mean(provider.rankBreadthRates) : null;
      const familyRankLargestShare = rankFamilyDetailsComplete
        ? mean(provider.rankLargestShares)
        : null;
      const aggregateEventCategories = aggregatePromptFamilyCategoryWeights(
        provider.pooledEventDomains,
        categoryMappingsByDomain
      );
      const aggregateRankCategories = aggregatePromptFamilyCategoryWeights(
        provider.pooledRankDomains,
        categoryMappingsByDomain
      );
      const aggregateEventCategoryConcentration =
        categoryMappings.length > 0 && eventFamilyDetailsComplete
          ? sourceConcentration(aggregateEventCategories.categoryWeights)
          : null;
      const aggregateRankCategoryConcentration =
        categoryMappings.length > 0 && rankFamilyDetailsComplete
          ? sourceConcentration(aggregateRankCategories.categoryWeights)
          : null;
      const familyEventCategoryHhi =
        categoryMappings.length > 0 && eventFamilyDetailsComplete
          ? mean(provider.eventCategoryHhiRates)
          : null;
      const familyEventCategoryBreadth =
        categoryMappings.length > 0 && eventFamilyDetailsComplete
          ? mean(provider.eventCategoryBreadthRates)
          : null;
      const familyEventCategoryLargestShare =
        categoryMappings.length > 0 && eventFamilyDetailsComplete
          ? mean(provider.eventCategoryLargestShares)
          : null;
      const familyEventCategoryMappedShare =
        categoryMappings.length > 0 && eventFamilyDetailsComplete
          ? mean(provider.eventCategoryMappedShareRates)
          : null;
      const familyRankCategoryHhi =
        categoryMappings.length > 0 && rankFamilyDetailsComplete
          ? mean(provider.rankCategoryHhiRates)
          : null;
      const familyRankCategoryBreadth =
        categoryMappings.length > 0 && rankFamilyDetailsComplete
          ? mean(provider.rankCategoryBreadthRates)
          : null;
      const familyRankCategoryLargestShare =
        categoryMappings.length > 0 && rankFamilyDetailsComplete
          ? mean(provider.rankCategoryLargestShares)
          : null;
      const familyRankCategoryMappedShare =
        categoryMappings.length > 0 && rankFamilyDetailsComplete
          ? mean(provider.rankCategoryMappedShareRates)
          : null;
      const citationInterval =
        providerPromptProfilesComplete && familyCitationReach !== null
          ? bootstrapFamilyMeanInterval(
              provider.familyCitationRates,
              `${key}\u0000${minimumCosineSimilarity}\u0000family-citation-reach`,
              usableFamilyBootstrapIterations
            )
          : null;
      const ownedInterval =
        report.ownedDomains.length > 0 &&
        providerPromptProfilesComplete &&
        familyOwnedReach !== null &&
        provider.ownedReachBoundsComplete
          ? bootstrapFamilyMeanInterval(
              provider.familyOwnedCitationRates,
              `${key}\u0000${minimumCosineSimilarity}\u0000family-owned-reach`,
              usableFamilyBootstrapIterations
            )
          : null;
      const ownedUpperInterval =
        report.ownedDomains.length > 0 &&
        providerPromptProfilesComplete &&
        familyOwnedReachUpper !== null &&
        provider.ownedReachBoundsComplete
          ? bootstrapFamilyMeanInterval(
              provider.familyOwnedCitationUpperRates,
              `${key}\u0000${minimumCosineSimilarity}\u0000family-owned-reach-upper`,
              usableFamilyBootstrapIterations
            )
          : null;
      const eventHhiInterval = eventFamilyDetailsComplete
        ? bootstrapFamilyMeanInterval(
            provider.eventHhiRates,
            `${key}\u0000${minimumCosineSimilarity}\u0000family-event-hhi`,
            usableFamilyBootstrapIterations,
            1
          )
        : null;
      const eventBreadthInterval = eventFamilyDetailsComplete
        ? bootstrapFamilyMeanInterval(
            provider.eventBreadthRates,
            `${key}\u0000${minimumCosineSimilarity}\u0000family-event-breadth`,
            usableFamilyBootstrapIterations,
            1
          )
        : null;
      const eventLargestShareInterval = eventFamilyDetailsComplete
        ? bootstrapFamilyMeanInterval(
            provider.eventLargestShares,
            `${key}\u0000${minimumCosineSimilarity}\u0000family-event-largest`,
            usableFamilyBootstrapIterations
          )
        : null;
      const rankHhiInterval = rankFamilyDetailsComplete
        ? bootstrapFamilyMeanInterval(
            provider.rankHhiRates,
            `${key}\u0000${minimumCosineSimilarity}\u0000family-rank-hhi`,
            usableFamilyBootstrapIterations,
            1
          )
        : null;
      const rankBreadthInterval = rankFamilyDetailsComplete
        ? bootstrapFamilyMeanInterval(
            provider.rankBreadthRates,
            `${key}\u0000${minimumCosineSimilarity}\u0000family-rank-breadth`,
            usableFamilyBootstrapIterations,
            1
          )
        : null;
      const rankLargestShareInterval = rankFamilyDetailsComplete
        ? bootstrapFamilyMeanInterval(
            provider.rankLargestShares,
            `${key}\u0000${minimumCosineSimilarity}\u0000family-rank-largest`,
            usableFamilyBootstrapIterations
          )
        : null;
      const eventCategoryHhiInterval =
        categoryMappings.length > 0 && eventFamilyDetailsComplete
          ? bootstrapFamilyMeanInterval(
              provider.eventCategoryHhiRates,
              `${key}\u0000${minimumCosineSimilarity}\u0000family-event-category-hhi`,
              usableFamilyBootstrapIterations,
              1
            )
          : null;
      const eventCategoryBreadthInterval =
        categoryMappings.length > 0 && eventFamilyDetailsComplete
          ? bootstrapFamilyMeanInterval(
              provider.eventCategoryBreadthRates,
              `${key}\u0000${minimumCosineSimilarity}\u0000family-event-category-breadth`,
              usableFamilyBootstrapIterations,
              1
            )
          : null;
      const eventCategoryLargestShareInterval =
        categoryMappings.length > 0 && eventFamilyDetailsComplete
          ? bootstrapFamilyMeanInterval(
              provider.eventCategoryLargestShares,
              `${key}\u0000${minimumCosineSimilarity}\u0000family-event-category-largest`,
              usableFamilyBootstrapIterations
            )
          : null;
      const rankCategoryHhiInterval =
        categoryMappings.length > 0 && rankFamilyDetailsComplete
          ? bootstrapFamilyMeanInterval(
              provider.rankCategoryHhiRates,
              `${key}\u0000${minimumCosineSimilarity}\u0000family-rank-category-hhi`,
              usableFamilyBootstrapIterations,
              1
            )
          : null;
      const rankCategoryBreadthInterval =
        categoryMappings.length > 0 && rankFamilyDetailsComplete
          ? bootstrapFamilyMeanInterval(
              provider.rankCategoryBreadthRates,
              `${key}\u0000${minimumCosineSimilarity}\u0000family-rank-category-breadth`,
              usableFamilyBootstrapIterations,
              1
            )
          : null;
      const rankCategoryLargestShareInterval =
        categoryMappings.length > 0 && rankFamilyDetailsComplete
          ? bootstrapFamilyMeanInterval(
              provider.rankCategoryLargestShares,
              `${key}\u0000${minimumCosineSimilarity}\u0000family-rank-category-largest`,
              usableFamilyBootstrapIterations
            )
          : null;
      const intervalState = !providerPromptProfilesComplete
        ? 'prompt-or-candidate-catalog-incomplete'
        : provider.familyCitationRates.length < 2
          ? 'insufficient-lexical-families'
          : usableFamilyBootstrapIterations < MIN_FAMILY_BOOTSTRAP_ITERATIONS
            ? 'budget-limited'
            : citationInterval
              ? 'available'
              : 'unavailable';
      const ownedIntervalState =
        report.ownedDomains.length === 0
          ? 'owned-domain-not-configured'
          : !provider.ownedReachBoundsComplete
            ? 'owned-reach-bound-detail-unavailable'
            : !providerPromptProfilesComplete
              ? 'prompt-or-candidate-catalog-incomplete'
              : provider.familyOwnedCitationRates.length < 2
                ? 'insufficient-lexical-families'
                : usableFamilyBootstrapIterations < MIN_FAMILY_BOOTSTRAP_ITERATIONS
                  ? 'budget-limited'
                  : ownedInterval && ownedUpperInterval
                    ? provider.unknownOwnedPromptGroups > 0
                      ? 'available-with-unknown-groups'
                      : provider.ownedReachMetadataComplete
                        ? 'available'
                        : 'available-with-incomplete-metadata'
                    : 'unavailable';
      const eventSourceIntervalState = !providerPromptProfilesComplete
        ? 'prompt-or-candidate-catalog-incomplete'
        : !provider.eventSourceDetailsComplete
          ? 'retained-event-source-detail-incomplete'
          : provider.eventHhiRates.length < 2
            ? 'insufficient-cited-families'
            : usableFamilyBootstrapIterations < MIN_FAMILY_BOOTSTRAP_ITERATIONS
              ? 'budget-limited'
              : eventHhiInterval
                ? 'available'
                : 'unavailable';
      const rankSourceIntervalState = !providerPromptProfilesComplete
        ? 'prompt-or-candidate-catalog-incomplete'
        : !provider.rankSourceDetailsComplete
          ? 'retained-rank-source-detail-incomplete'
          : provider.rankHhiRates.length < 2
            ? 'insufficient-cited-families'
            : usableFamilyBootstrapIterations < MIN_FAMILY_BOOTSTRAP_ITERATIONS
              ? 'budget-limited'
              : rankHhiInterval
                ? 'available'
                : 'unavailable';
      const eventCategoryIntervalState =
        categoryMappings.length === 0
          ? 'category-mappings-not-configured'
          : !providerPromptProfilesComplete
            ? 'prompt-or-candidate-catalog-incomplete'
            : !provider.eventSourceDetailsComplete
              ? 'retained-event-source-detail-incomplete'
              : provider.eventCategoryHhiRates.length < 2
                ? 'insufficient-mapped-citation-families'
                : usableFamilyBootstrapIterations < MIN_FAMILY_BOOTSTRAP_ITERATIONS
                  ? 'budget-limited'
                  : eventCategoryHhiInterval
                    ? 'available'
                    : 'unavailable';
      const rankCategoryIntervalState =
        categoryMappings.length === 0
          ? 'category-mappings-not-configured'
          : !providerPromptProfilesComplete
            ? 'prompt-or-candidate-catalog-incomplete'
            : !provider.rankSourceDetailsComplete
              ? 'retained-rank-source-detail-incomplete'
              : provider.rankCategoryHhiRates.length < 2
                ? 'insufficient-mapped-citation-families'
                : usableFamilyBootstrapIterations < MIN_FAMILY_BOOTSTRAP_ITERATIONS
                  ? 'budget-limited'
                  : rankCategoryHhiInterval
                    ? 'available'
                    : 'unavailable';
      return {
        row_type: 'provider-family-sensitivity',
        provider: provider.provider,
        provider_prompt_groups: provider.promptGroups,
        provider_prompt_groups_with_citations: provider.promptsWithCitations,
        provider_prompt_groups_with_owned_citations: provider.ownedDetailsComplete
          ? provider.ownedPromptsWithCitations
          : null,
        provider_prompt_groups_with_observed_owned_citations:
          report.ownedDomains.length > 0 ? provider.ownedPromptsWithCitations : null,
        provider_prompt_groups_confirmed_without_owned_citation:
          report.ownedDomains.length > 0 && provider.ownedReachBoundsComplete
            ? Math.max(
                0,
                provider.promptGroups -
                  provider.ownedPromptsWithCitations -
                  provider.unknownOwnedPromptGroups
              )
            : null,
        provider_unknown_owned_prompt_groups:
          report.ownedDomains.length > 0 && provider.ownedReachBoundsComplete
            ? provider.unknownOwnedPromptGroups
            : null,
        owned_reach_bound_detail_complete:
          report.ownedDomains.length > 0 && provider.ownedReachBoundsComplete,
        owned_reach_completeness_metadata_complete:
          report.ownedDomains.length > 0 && provider.ownedReachMetadataComplete,
        provider_retained_lexical_families: provider.familyCitationRates.length,
        prompt_catalog_truncated: analysis.promptCatalogTruncated,
        candidate_pairs_capped: analysis.candidatePairsCapped,
        event_diversity_eligible_families: provider.eventHhiRates.length,
        rank_diversity_eligible_families: provider.rankHhiRates.length,
        exact_prompt_citation_reach_percent:
          exactCitationReach === null ? null : Number((exactCitationReach * 100).toFixed(4)),
        lexical_family_balanced_citation_reach_percent:
          familyCitationReach === null ? null : Number((familyCitationReach * 100).toFixed(4)),
        lexical_family_balanced_citation_reach_ci95_lower: citationInterval?.lower ?? null,
        lexical_family_balanced_citation_reach_ci95_upper: citationInterval?.upper ?? null,
        lexical_family_vs_exact_citation_reach_delta_percentage_points:
          exactCitationReach === null || familyCitationReach === null
            ? null
            : Number(((familyCitationReach - exactCitationReach) * 100).toFixed(4)),
        aggregate_event_weighted_source_hhi:
          providerProfile?.domainConcentration?.herfindahlIndex ?? null,
        lexical_family_balanced_event_weighted_source_hhi:
          familyEventHhi === null ? null : Number(familyEventHhi.toFixed(6)),
        lexical_family_event_source_hhi_ci95_lower: eventHhiInterval?.lower ?? null,
        lexical_family_event_source_hhi_ci95_upper: eventHhiInterval?.upper ?? null,
        aggregate_event_weighted_effective_source_count:
          providerProfile?.domainConcentration?.effectiveCitedDomainCount ?? null,
        lexical_family_balanced_event_weighted_effective_source_count:
          familyEventBreadth === null ? null : Number(familyEventBreadth.toFixed(4)),
        lexical_family_event_effective_source_ci95_lower: eventBreadthInterval?.lower ?? null,
        lexical_family_event_effective_source_ci95_upper: eventBreadthInterval?.upper ?? null,
        aggregate_event_weighted_largest_source_share_percent:
          providerProfile?.domainConcentration?.largestDomainCitationSharePercent ?? null,
        lexical_family_balanced_event_weighted_largest_source_share_percent:
          familyEventLargestShare === null
            ? null
            : Number((familyEventLargestShare * 100).toFixed(4)),
        lexical_family_event_largest_source_share_ci95_lower:
          eventLargestShareInterval?.lower ?? null,
        lexical_family_event_largest_source_share_ci95_upper:
          eventLargestShareInterval?.upper ?? null,
        aggregate_event_weighted_mapped_category_hhi:
          aggregateEventCategoryConcentration?.hhi ?? null,
        lexical_family_balanced_event_weighted_mapped_category_hhi:
          familyEventCategoryHhi === null ? null : Number(familyEventCategoryHhi.toFixed(6)),
        lexical_family_event_category_hhi_ci95_lower: eventCategoryHhiInterval?.lower ?? null,
        lexical_family_event_category_hhi_ci95_upper: eventCategoryHhiInterval?.upper ?? null,
        event_mapped_category_eligible_families: provider.eventCategoryHhiRates.length,
        aggregate_event_mapped_category_weight_share_percent:
          aggregateEventCategoryConcentration === null
            ? null
            : aggregateEventCategories.mappedSharePercent,
        lexical_family_event_mapped_category_weight_share_percent:
          familyEventCategoryMappedShare === null
            ? null
            : Number(familyEventCategoryMappedShare.toFixed(4)),
        lexical_family_balanced_event_weighted_effective_category_count:
          familyEventCategoryBreadth === null
            ? null
            : Number(familyEventCategoryBreadth.toFixed(4)),
        lexical_family_event_effective_category_ci95_lower:
          eventCategoryBreadthInterval?.lower ?? null,
        lexical_family_event_effective_category_ci95_upper:
          eventCategoryBreadthInterval?.upper ?? null,
        lexical_family_balanced_event_weighted_largest_category_share_percent:
          familyEventCategoryLargestShare === null
            ? null
            : Number((familyEventCategoryLargestShare * 100).toFixed(4)),
        lexical_family_event_largest_category_ci95_lower:
          eventCategoryLargestShareInterval?.lower ?? null,
        lexical_family_event_largest_category_ci95_upper:
          eventCategoryLargestShareInterval?.upper ?? null,
        event_source_category_family_interval_state: eventCategoryIntervalState,
        aggregate_rank_weighted_source_hhi:
          providerProfile?.rankWeightedDomainConcentration?.herfindahlIndex ?? null,
        lexical_family_balanced_rank_weighted_source_hhi:
          familyRankHhi === null ? null : Number(familyRankHhi.toFixed(6)),
        lexical_family_rank_source_hhi_ci95_lower: rankHhiInterval?.lower ?? null,
        lexical_family_rank_source_hhi_ci95_upper: rankHhiInterval?.upper ?? null,
        aggregate_rank_weighted_effective_source_count:
          providerProfile?.rankWeightedDomainConcentration?.effectiveCitedDomainCount ?? null,
        lexical_family_balanced_rank_weighted_effective_source_count:
          familyRankBreadth === null ? null : Number(familyRankBreadth.toFixed(4)),
        lexical_family_rank_effective_source_ci95_lower: rankBreadthInterval?.lower ?? null,
        lexical_family_rank_effective_source_ci95_upper: rankBreadthInterval?.upper ?? null,
        aggregate_rank_weighted_largest_source_share_percent:
          providerProfile?.rankWeightedDomainConcentration?.largestDomainCitationSharePercent ??
          null,
        lexical_family_balanced_rank_weighted_largest_source_share_percent:
          familyRankLargestShare === null
            ? null
            : Number((familyRankLargestShare * 100).toFixed(4)),
        lexical_family_rank_largest_source_share_ci95_lower:
          rankLargestShareInterval?.lower ?? null,
        lexical_family_rank_largest_source_share_ci95_upper:
          rankLargestShareInterval?.upper ?? null,
        aggregate_rank_weighted_mapped_category_hhi:
          aggregateRankCategoryConcentration?.hhi ?? null,
        lexical_family_balanced_rank_weighted_mapped_category_hhi:
          familyRankCategoryHhi === null ? null : Number(familyRankCategoryHhi.toFixed(6)),
        lexical_family_rank_category_hhi_ci95_lower: rankCategoryHhiInterval?.lower ?? null,
        lexical_family_rank_category_hhi_ci95_upper: rankCategoryHhiInterval?.upper ?? null,
        rank_mapped_category_eligible_families: provider.rankCategoryHhiRates.length,
        aggregate_rank_mapped_category_weight_share_percent:
          aggregateRankCategoryConcentration === null
            ? null
            : aggregateRankCategories.mappedSharePercent,
        lexical_family_rank_mapped_category_weight_share_percent:
          familyRankCategoryMappedShare === null
            ? null
            : Number(familyRankCategoryMappedShare.toFixed(4)),
        lexical_family_balanced_rank_weighted_effective_category_count:
          familyRankCategoryBreadth === null ? null : Number(familyRankCategoryBreadth.toFixed(4)),
        lexical_family_rank_effective_category_ci95_lower:
          rankCategoryBreadthInterval?.lower ?? null,
        lexical_family_rank_effective_category_ci95_upper:
          rankCategoryBreadthInterval?.upper ?? null,
        lexical_family_balanced_rank_weighted_largest_category_share_percent:
          familyRankCategoryLargestShare === null
            ? null
            : Number((familyRankCategoryLargestShare * 100).toFixed(4)),
        lexical_family_rank_largest_category_ci95_lower:
          rankCategoryLargestShareInterval?.lower ?? null,
        lexical_family_rank_largest_category_ci95_upper:
          rankCategoryLargestShareInterval?.upper ?? null,
        rank_source_category_family_interval_state: rankCategoryIntervalState,
        exact_prompt_owned_citation_reach_percent:
          exactOwnedReach === null ? null : Number((exactOwnedReach * 100).toFixed(4)),
        exact_owned_citation_prompt_reach_lower_bound_percent:
          exactOwnedReach === null ? null : Number((exactOwnedReach * 100).toFixed(4)),
        exact_owned_citation_prompt_reach_upper_bound_percent:
          exactOwnedReachUpper === null ? null : Number((exactOwnedReachUpper * 100).toFixed(4)),
        lexical_family_balanced_owned_citation_reach_percent:
          familyOwnedReach === null ? null : Number((familyOwnedReach * 100).toFixed(4)),
        lexical_family_balanced_owned_citation_reach_lower_bound_percent:
          familyOwnedReach === null ? null : Number((familyOwnedReach * 100).toFixed(4)),
        lexical_family_balanced_owned_citation_reach_upper_bound_percent:
          familyOwnedReachUpper === null ? null : Number((familyOwnedReachUpper * 100).toFixed(4)),
        lexical_family_balanced_owned_citation_reach_ci95_lower: ownedInterval?.lower ?? null,
        lexical_family_balanced_owned_citation_reach_ci95_upper: ownedInterval?.upper ?? null,
        lexical_family_balanced_owned_citation_reach_upper_ci95_lower:
          ownedUpperInterval?.lower ?? null,
        lexical_family_balanced_owned_citation_reach_upper_ci95_upper:
          ownedUpperInterval?.upper ?? null,
        lexical_family_count_with_unknown_owned_state:
          report.ownedDomains.length > 0
            ? provider.familyOwnedCitationRates.filter(
                (value, index) => provider.familyOwnedCitationUpperRates[index]! > value
              ).length
            : null,
        family_bootstrap_resamples: usableFamilyBootstrapIterations,
        provider_prompt_profiles_complete: provider.promptProfilesComplete,
        event_source_detail_complete: provider.eventSourceDetailsComplete,
        rank_source_detail_complete: provider.rankSourceDetailsComplete,
        event_source_family_interval_state: eventSourceIntervalState,
        rank_source_family_interval_state: rankSourceIntervalState,
        owned_prompt_detail_complete: provider.ownedDetailsComplete,
        family_balanced_interval_state: intervalState,
        owned_family_balanced_interval_state: ownedIntervalState,
      };
    });
  const headers = [
    'row_type',
    'prompt_family_id',
    'family_kind',
    'member_prompt_groups',
    'member_prompts_json',
    'observations_total',
    'providers_json',
    'direct_similarity_edges',
    'articulation_prompt_groups',
    'articulation_prompts_json',
    'possible_member_pairs',
    'edge_density',
    'mean_edge_cosine',
    'min_edge_cosine',
    'max_edge_cosine',
    'minimum_cosine_threshold',
    'source_category_mappings_configured',
    'retained_prompt_groups',
    'candidate_pairs_considered',
    'high_frequency_posting_cutoff',
    'prompt_catalog_truncated',
    'candidate_pairs_capped',
    'output_rows_truncated',
    'families_available',
    'families_emitted',
    'multi_prompt_families',
    'singleton_families',
    'provider_family_details_available',
    'provider_family_details_retained',
    'provider_family_details_emitted',
    'provider_family_details_truncated',
    'largest_family_size',
    'provider',
    'family_provider_prompt_groups',
    'family_provider_prompt_groups_with_citations',
    'family_provider_citation_prompt_reach_percent',
    'family_provider_observations',
    'family_provider_observations_with_citations',
    'family_provider_citation_snapshot_coverage_percent',
    'family_provider_observed_owned_prompt_groups',
    'family_provider_confirmed_owned_absent_prompt_groups',
    'family_provider_confirmed_owned_absent_prompt_samples_json',
    'family_provider_confirmed_owned_absent_prompt_samples_truncated',
    'family_provider_unknown_owned_prompt_groups',
    'family_provider_unknown_owned_prompt_samples_json',
    'family_provider_unknown_owned_prompt_samples_truncated',
    'family_provider_owned_prompt_reach_lower_bound_percent',
    'family_provider_owned_prompt_reach_upper_bound_percent',
    'family_provider_owned_prompt_reach_state',
    'family_provider_owned_citation_events',
    'family_provider_owned_first_position_event_share_percent',
    'family_provider_owned_top_three_event_share_percent',
    'family_provider_equal_prompt_owned_first_citation_mrr_percent',
    'family_provider_owned_rank_detail_complete',
    'family_provider_event_weighted_source_hhi',
    'family_provider_event_weighted_effective_source_count',
    'family_provider_event_weighted_largest_source_share_percent',
    'family_provider_rank_weighted_source_hhi',
    'family_provider_rank_weighted_effective_source_count',
    'family_provider_rank_weighted_largest_source_share_percent',
    'family_provider_event_weighted_category_hhi',
    'family_provider_event_weighted_effective_category_count',
    'family_provider_event_weighted_largest_category_share_percent',
    'family_provider_event_mapped_category_weight_share_percent',
    'family_provider_rank_weighted_category_hhi',
    'family_provider_rank_weighted_effective_category_count',
    'family_provider_rank_weighted_largest_category_share_percent',
    'family_provider_rank_mapped_category_weight_share_percent',
    'family_provider_event_source_detail_complete',
    'family_provider_rank_source_detail_complete',
    'family_provider_top_event_sources_json',
    'family_provider_top_rank_sources_json',
    'observed_alternative_citation_events_top_five',
    'top_observed_alternative_domains_json',
    'alternative_domain_detail_complete',
    'first_observed_at',
    'last_observed_at',
    'provider_prompt_groups',
    'provider_prompt_groups_with_citations',
    'provider_prompt_groups_with_owned_citations',
    'provider_prompt_groups_with_observed_owned_citations',
    'provider_prompt_groups_confirmed_without_owned_citation',
    'provider_unknown_owned_prompt_groups',
    'owned_reach_bound_detail_complete',
    'owned_reach_completeness_metadata_complete',
    'provider_retained_lexical_families',
    'event_diversity_eligible_families',
    'rank_diversity_eligible_families',
    'exact_prompt_citation_reach_percent',
    'lexical_family_balanced_citation_reach_percent',
    'lexical_family_balanced_citation_reach_ci95_lower',
    'lexical_family_balanced_citation_reach_ci95_upper',
    'lexical_family_vs_exact_citation_reach_delta_percentage_points',
    'aggregate_event_weighted_source_hhi',
    'lexical_family_balanced_event_weighted_source_hhi',
    'lexical_family_event_source_hhi_ci95_lower',
    'lexical_family_event_source_hhi_ci95_upper',
    'aggregate_event_weighted_effective_source_count',
    'lexical_family_balanced_event_weighted_effective_source_count',
    'lexical_family_event_effective_source_ci95_lower',
    'lexical_family_event_effective_source_ci95_upper',
    'aggregate_event_weighted_largest_source_share_percent',
    'lexical_family_balanced_event_weighted_largest_source_share_percent',
    'lexical_family_event_largest_source_share_ci95_lower',
    'lexical_family_event_largest_source_share_ci95_upper',
    'aggregate_event_weighted_mapped_category_hhi',
    'lexical_family_balanced_event_weighted_mapped_category_hhi',
    'lexical_family_event_category_hhi_ci95_lower',
    'lexical_family_event_category_hhi_ci95_upper',
    'event_mapped_category_eligible_families',
    'aggregate_event_mapped_category_weight_share_percent',
    'lexical_family_event_mapped_category_weight_share_percent',
    'lexical_family_balanced_event_weighted_effective_category_count',
    'lexical_family_event_effective_category_ci95_lower',
    'lexical_family_event_effective_category_ci95_upper',
    'lexical_family_balanced_event_weighted_largest_category_share_percent',
    'lexical_family_event_largest_category_ci95_lower',
    'lexical_family_event_largest_category_ci95_upper',
    'event_source_category_family_interval_state',
    'aggregate_rank_weighted_source_hhi',
    'lexical_family_balanced_rank_weighted_source_hhi',
    'lexical_family_rank_source_hhi_ci95_lower',
    'lexical_family_rank_source_hhi_ci95_upper',
    'aggregate_rank_weighted_effective_source_count',
    'lexical_family_balanced_rank_weighted_effective_source_count',
    'lexical_family_rank_effective_source_ci95_lower',
    'lexical_family_rank_effective_source_ci95_upper',
    'aggregate_rank_weighted_largest_source_share_percent',
    'lexical_family_balanced_rank_weighted_largest_source_share_percent',
    'lexical_family_rank_largest_source_share_ci95_lower',
    'lexical_family_rank_largest_source_share_ci95_upper',
    'aggregate_rank_weighted_mapped_category_hhi',
    'lexical_family_balanced_rank_weighted_mapped_category_hhi',
    'lexical_family_rank_category_hhi_ci95_lower',
    'lexical_family_rank_category_hhi_ci95_upper',
    'rank_mapped_category_eligible_families',
    'aggregate_rank_mapped_category_weight_share_percent',
    'lexical_family_rank_mapped_category_weight_share_percent',
    'lexical_family_balanced_rank_weighted_effective_category_count',
    'lexical_family_rank_effective_category_ci95_lower',
    'lexical_family_rank_effective_category_ci95_upper',
    'lexical_family_balanced_rank_weighted_largest_category_share_percent',
    'lexical_family_rank_largest_category_ci95_lower',
    'lexical_family_rank_largest_category_ci95_upper',
    'rank_source_category_family_interval_state',
    'exact_prompt_owned_citation_reach_percent',
    'exact_owned_citation_prompt_reach_lower_bound_percent',
    'exact_owned_citation_prompt_reach_upper_bound_percent',
    'lexical_family_balanced_owned_citation_reach_percent',
    'lexical_family_balanced_owned_citation_reach_lower_bound_percent',
    'lexical_family_balanced_owned_citation_reach_upper_bound_percent',
    'lexical_family_balanced_owned_citation_reach_ci95_lower',
    'lexical_family_balanced_owned_citation_reach_ci95_upper',
    'lexical_family_balanced_owned_citation_reach_upper_ci95_lower',
    'lexical_family_balanced_owned_citation_reach_upper_ci95_upper',
    'lexical_family_count_with_unknown_owned_state',
    'family_bootstrap_resamples',
    'provider_prompt_profiles_complete',
    'event_source_detail_complete',
    'rank_source_detail_complete',
    'event_source_family_interval_state',
    'rank_source_family_interval_state',
    'owned_prompt_detail_complete',
    'family_balanced_interval_state',
    'owned_family_balanced_interval_state',
    'provider_summaries_available',
    'provider_summaries_emitted',
    'provider_summary_rows_truncated',
    'families_omitted_by_output_cap',
    'family_bootstrap_budget_state',
    'interpretation_note',
  ];
  const multiPromptFamilies = rows.filter((row) => Number(row.member_prompt_groups) > 1).length;
  const note =
    'Families are connected components of retained exact prompt groups joined by lexical TF-IDF cosine at or above the threshold. Transitive members need not be similar to every other member; edge density exposes sparse chains. Provider rows compare exact-prompt citation reach and pooled event/rank source concentration with equal-weight lexical-family means; optional owned reach uses the same family weighting. Prompt-family-provider rows add prompt/snapshot citation coverage, owned-reach states and bounds, and the top five observed alternative domains where owned domains are configured; alternative-domain detail is marked incomplete when retained source lists are capped. Owned-reach lower/upper endpoints classify zero-owned groups with incomplete source lists as unknown and bootstrap each endpoint separately across families; the legacy reach column is the observed lower bound. Family bootstrap intervals are sensitivity estimates over this wording heuristic, not semantic intent resolution, query demand, prompt merging, or proof of statistical independence. Source concentration averages use families with citations; eligible family counts and source-detail states are provided. High-frequency-only overlaps are skipped and candidate search can be capped.';
  const summary: Record<string, unknown> = Object.fromEntries(
    headers.map((header) => [header, ''])
  );
  summary.row_type = 'summary';
  summary.retained_prompt_groups = analysis.documentCount;
  summary.candidate_pairs_considered = analysis.candidatePairCount;
  summary.high_frequency_posting_cutoff = analysis.highFrequencyCutoff;
  summary.minimum_cosine_threshold = minimumCosineSimilarity;
  summary.source_category_mappings_configured = categoryMappings.length;
  summary.prompt_catalog_truncated = analysis.promptCatalogTruncated;
  summary.candidate_pairs_capped = analysis.candidatePairsCapped;
  const providerFamilyDetailRowsEmitted = Math.min(
    providerFamilyDetailRows.length,
    Math.max(0, MAX_OUTPUT_ROWS - providerSummaryRows.length)
  );
  const familiesEmitted = Math.min(
    rows.length,
    Math.max(0, MAX_OUTPUT_ROWS - providerSummaryRows.length - providerFamilyDetailRowsEmitted)
  );
  const allOutputRowsTruncated =
    rows.length + providerSummaryRows.length + providerFamilyDetailRowsAvailable >
      MAX_OUTPUT_ROWS ||
    providerFamilyDetailRowsAvailable > providerFamilyDetailRows.length ||
    providerRows.length > providerSummaryRows.length;
  summary.output_rows_truncated = allOutputRowsTruncated;
  summary.families_available = rows.length;
  summary.families_emitted = familiesEmitted;
  summary.provider_family_details_available = providerFamilyDetailRowsAvailable;
  summary.provider_family_details_retained = providerFamilyDetailRows.length;
  summary.provider_family_details_emitted = providerFamilyDetailRowsEmitted;
  summary.provider_family_details_truncated =
    providerFamilyDetailRowsAvailable > providerFamilyDetailRows.length ||
    providerFamilyDetailRowsEmitted < providerFamilyDetailRows.length;
  summary.multi_prompt_families = multiPromptFamilies;
  summary.singleton_families = rows.length - multiPromptFamilies;
  summary.largest_family_size = rows.reduce(
    (maximum, row) => Math.max(maximum, Number(row.member_prompt_groups)),
    0
  );
  summary.family_bootstrap_resamples = usableFamilyBootstrapIterations;
  summary.family_bootstrap_budget_state =
    usableFamilyBootstrapIterations === 0
      ? 'insufficient-support-or-budget'
      : usableFamilyBootstrapIterations === FAMILY_BOOTSTRAP_ITERATIONS
        ? 'full-budget'
        : 'reduced-budget';
  summary.provider_summaries_available = providerRows.length;
  summary.provider_summaries_emitted = providerSummaryRows.length;
  summary.provider_summary_rows_truncated = providerRows.length > providerSummaryRows.length;
  summary.families_omitted_by_output_cap = Math.max(0, rows.length - familiesEmitted);
  summary.interpretation_note = note;
  const emittedProviderFamilyDetailRows = providerFamilyDetailRows.slice(
    0,
    providerFamilyDetailRowsEmitted
  );
  const emittedFamilyRows = rows.slice(0, familiesEmitted);
  const outputRows = [
    ...providerSummaryRows,
    ...emittedProviderFamilyDetailRows,
    ...emittedFamilyRows,
  ];
  for (const row of providerSummaryRows) row.output_rows_truncated = allOutputRowsTruncated;
  for (const row of providerFamilyDetailRows) row.output_rows_truncated = allOutputRowsTruncated;
  for (const row of rows) row.output_rows_truncated = allOutputRowsTruncated;
  const csvRows = [
    headers.map(csvCell).join(','),
    ...[summary, ...outputRows].map((row) =>
      headers.map((header) => csvCell(row[header] ?? '')).join(',')
    ),
  ];
  return `${csvRows.join('\r\n')}\r\n`;
}

function parsePromptFamilyCsv(text: string, maximumRecords: number): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ',') {
      record.push(cell);
      cell = '';
    } else if (character === '\r' || character === '\n') {
      record.push(cell);
      if (record.some((value) => value !== '')) records.push(record);
      if (records.length >= maximumRecords) return records;
      record = [];
      cell = '';
      if (character === '\r' && text[index + 1] === '\n') index += 1;
    } else {
      cell += character;
    }
  }
  if (cell.length > 0 || record.length > 0) {
    record.push(cell);
    if (record.some((value) => value !== '')) records.push(record);
  }
  return records;
}

function promptFamilyHtmlEscape(value: string): string {
  return value.replace(
    /[&<>"']/gu,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!
  );
}

function promptFamilyNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Compare pooled prompt weighting with equal lexical-family weighting in an offline provider dashboard. */
export function renderAiAnswerCitationPromptFamiliesHtml(
  report: AiAnswerCitationObservationReport,
  minimumCosineSimilarity = 0.85,
  categoryMappings: Array<{ domain: string; label: string; labelKey: string }> = []
): string {
  const records = parsePromptFamilyCsv(
    renderAiAnswerCitationPromptFamiliesCsv(report, minimumCosineSimilarity, categoryMappings),
    MAX_PROMPT_FAMILY_PROVIDER_SUMMARY_ROWS + 2
  );
  const headers = records[0] ?? [];
  const objectFor = (record: string[]): Record<string, string> =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] ?? '']));
  const data = records.slice(1).map(objectFor);
  const summary = data.find((row) => row.row_type === 'summary') ?? {};
  const providers = data
    .filter((row) => row.row_type === 'provider-family-sensitivity')
    .sort((left, right) => {
      const sensitivity = (row: Record<string, string>): number =>
        Math.max(
          Math.abs(
            (promptFamilyNumber(row.lexical_family_balanced_event_weighted_source_hhi) ?? 0) -
              (promptFamilyNumber(row.aggregate_event_weighted_source_hhi) ?? 0)
          ),
          Math.abs(
            (promptFamilyNumber(row.lexical_family_balanced_rank_weighted_source_hhi) ?? 0) -
              (promptFamilyNumber(row.aggregate_rank_weighted_source_hhi) ?? 0)
          ),
          Math.abs(
            (promptFamilyNumber(
              row.lexical_family_vs_exact_citation_reach_delta_percentage_points
            ) ?? 0) / 100
          )
        );
      return sensitivity(right) - sensitivity(left) || left.provider.localeCompare(right.provider);
    });
  const chartProviders = providers.slice(0, MAX_PROMPT_FAMILY_DASHBOARD_CHART_PROVIDERS);
  const tableProviders = providers.slice(0, MAX_PROMPT_FAMILY_DASHBOARD_ROWS);
  const truncated =
    summary.provider_summary_rows_truncated === 'true' || providers.length > tableProviders.length;
  const escaped = promptFamilyHtmlEscape;
  const num = (value: string | undefined, digits = 3): string => {
    const parsed = promptFamilyNumber(value);
    return parsed === null
      ? '—'
      : parsed.toLocaleString('en-US', { maximumFractionDigits: digits });
  };
  const familyInterval = (
    row: Record<string, string>,
    metric: 'event' | 'rank'
  ): { lower: number | null; upper: number | null } => ({
    lower: promptFamilyNumber(
      metric === 'event'
        ? row.lexical_family_event_source_hhi_ci95_lower
        : row.lexical_family_rank_source_hhi_ci95_lower
    ),
    upper: promptFamilyNumber(
      metric === 'event'
        ? row.lexical_family_event_source_hhi_ci95_upper
        : row.lexical_family_rank_source_hhi_ci95_upper
    ),
  });
  const renderChart = (
    title: string,
    description: string,
    metric: 'reach' | 'event-hhi' | 'rank-hhi'
  ): string => {
    const width = 1100;
    const left = 245;
    const right = 1050;
    const chartWidth = right - left;
    const top = 34;
    const rowHeight = 33;
    const height = Math.max(141, top + chartProviders.length * rowHeight + 54);
    const scaleMax = metric === 'reach' ? 100 : 1;
    const valueFor = (row: Record<string, string>, kind: 'pooled' | 'family'): number | null => {
      if (metric === 'reach')
        return promptFamilyNumber(
          kind === 'pooled'
            ? row.exact_prompt_citation_reach_percent
            : row.lexical_family_balanced_citation_reach_percent
        );
      const event = metric === 'event-hhi';
      return promptFamilyNumber(
        kind === 'pooled'
          ? event
            ? row.aggregate_event_weighted_source_hhi
            : row.aggregate_rank_weighted_source_hhi
          : event
            ? row.lexical_family_balanced_event_weighted_source_hhi
            : row.lexical_family_balanced_rank_weighted_source_hhi
      );
    };
    const intervalFor = (
      row: Record<string, string>
    ): { lower: number | null; upper: number | null } => {
      if (metric === 'reach')
        return {
          lower: promptFamilyNumber(row.lexical_family_balanced_citation_reach_ci95_lower),
          upper: promptFamilyNumber(row.lexical_family_balanced_citation_reach_ci95_upper),
        };
      return familyInterval(row, metric === 'event-hhi' ? 'event' : 'rank');
    };
    const x = (value: number): number =>
      left + (Math.max(0, Math.min(scaleMax, value)) / scaleMax) * chartWidth;
    const ticks = metric === 'reach' ? [0, 25, 50, 75, 100] : [0, 0.25, 0.5, 0.75, 1];
    const grid = ticks
      .map(
        (tick) =>
          `<line x1="${x(tick)}" y1="${top - 11}" x2="${x(tick)}" y2="${height - 40}" class="grid"/><text x="${x(tick)}" y="${height - 23}" text-anchor="middle">${metric === 'reach' ? `${tick}%` : tick.toFixed(2)}</text>`
      )
      .join('');
    const marks = chartProviders
      .map((row, index) => {
        const y = top + index * rowHeight + 9;
        const pooled = valueFor(row, 'pooled');
        const family = valueFor(row, 'family');
        const interval = intervalFor(row);
        const familyMarks =
          family === null
            ? ''
            : `<circle cx="${x(family)}" cy="${y}" r="5.5" class="family-dot"><title>Equal-family estimate: ${family.toFixed(4)}${interval.lower === null || interval.upper === null ? '' : `; family bootstrap interval ${interval.lower.toFixed(4)} to ${interval.upper.toFixed(4)}`}</title></circle>${interval.lower === null || interval.upper === null ? '' : `<line x1="${x(interval.lower)}" y1="${y}" x2="${x(interval.upper)}" y2="${y}" class="interval"/><line x1="${x(interval.lower)}" y1="${y - 4}" x2="${x(interval.lower)}" y2="${y + 4}" class="interval"/><line x1="${x(interval.upper)}" y1="${y - 4}" x2="${x(interval.upper)}" y2="${y + 4}" class="interval"/>`}`;
        const pooledMark =
          pooled === null
            ? ''
            : `<circle cx="${x(pooled)}" cy="${y}" r="4.5" class="pooled-dot"><title>Pooled prompt-weighted estimate: ${pooled.toFixed(4)}</title></circle>`;
        const connector =
          pooled === null || family === null
            ? ''
            : `<line x1="${x(pooled)}" y1="${y}" x2="${x(family)}" y2="${y}" class="connector"/>`;
        return `<text x="${left - 12}" y="${y + 4}" text-anchor="end" class="provider-label">${escaped(row.provider)}</text>${connector}${familyMarks}${pooledMark}`;
      })
      .join('');
    const metricLabel =
      metric === 'reach'
        ? 'Citation reach among exact prompt groups (%)'
        : 'Source concentration (HHI; higher values mean more concentrated citations)';
    return `<section class="panel"><div class="panel-head"><div><p class="eyebrow">Provider comparison</p><h2>${title}</h2></div><span class="unit">${metric === 'reach' ? '0–100%' : 'HHI 0–1'}</span></div><p class="muted">${description} ${metricLabel}</p>${chartProviders.length === 0 ? '<p class="empty">No provider summary rows are available for the retained prompt catalog.</p>' : `<div class="chart-wrap"><svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}; pooled prompt and equal-family estimates by provider">${grid}${marks}<text x="${left + chartWidth / 2}" y="${height - 5}" text-anchor="middle" class="axis-title">${metric === 'reach' ? 'Share of exact prompt groups with observed citations' : 'Herfindahl concentration index'}</text></svg></div>`}</section>`;
  };
  const tableRows = tableProviders
    .map((row) => {
      const reachDelta = promptFamilyNumber(
        row.lexical_family_vs_exact_citation_reach_delta_percentage_points
      );
      const eventDelta =
        (promptFamilyNumber(row.lexical_family_balanced_event_weighted_source_hhi) ?? Number.NaN) -
        (promptFamilyNumber(row.aggregate_event_weighted_source_hhi) ?? Number.NaN);
      const rankDelta =
        (promptFamilyNumber(row.lexical_family_balanced_rank_weighted_source_hhi) ?? Number.NaN) -
        (promptFamilyNumber(row.aggregate_rank_weighted_source_hhi) ?? Number.NaN);
      const state = row.event_source_family_interval_state || 'unavailable';
      const categoryDetail =
        categoryMappings.length === 0
          ? ''
          : `<td>Event ${num(row.aggregate_event_weighted_mapped_category_hhi, 4)} → ${num(row.lexical_family_balanced_event_weighted_mapped_category_hhi, 4)}<br><span class="muted">mapped ${num(row.aggregate_event_mapped_category_weight_share_percent, 1)}% / ${num(row.lexical_family_event_mapped_category_weight_share_percent, 1)}% · 95% CI ${num(row.lexical_family_event_category_hhi_ci95_lower, 4)}–${num(row.lexical_family_event_category_hhi_ci95_upper, 4)}</span><br>Rank ${num(row.aggregate_rank_weighted_mapped_category_hhi, 4)} → ${num(row.lexical_family_balanced_rank_weighted_mapped_category_hhi, 4)}<br><span class="muted">mapped ${num(row.aggregate_rank_mapped_category_weight_share_percent, 1)}% / ${num(row.lexical_family_rank_mapped_category_weight_share_percent, 1)}% · 95% CI ${num(row.lexical_family_rank_category_hhi_ci95_lower, 4)}–${num(row.lexical_family_rank_category_hhi_ci95_upper, 4)}</span></td>`;
      return `<tr><td><strong>${escaped(row.provider)}</strong><br><span class="muted">${num(row.provider_prompt_groups)} prompt groups · ${num(row.provider_retained_lexical_families)} families</span></td><td>${num(row.exact_prompt_citation_reach_percent, 2)}%</td><td>${num(row.lexical_family_balanced_citation_reach_percent, 2)}% <span class="muted">(${reachDelta === null ? '—' : `${reachDelta > 0 ? '+' : ''}${reachDelta.toFixed(2)} pp`})</span><br><span class="muted">95% family CI ${num(row.lexical_family_balanced_citation_reach_ci95_lower, 2)}–${num(row.lexical_family_balanced_citation_reach_ci95_upper, 2)}%</span></td><td>${num(row.aggregate_event_weighted_source_hhi, 4)} → ${num(row.lexical_family_balanced_event_weighted_source_hhi, 4)}<br><span class="muted">Δ ${Number.isFinite(eventDelta) ? `${eventDelta > 0 ? '+' : ''}${eventDelta.toFixed(4)}` : '—'} · CI ${num(row.lexical_family_event_source_hhi_ci95_lower, 4)}–${num(row.lexical_family_event_source_hhi_ci95_upper, 4)}</span></td><td>${num(row.aggregate_rank_weighted_source_hhi, 4)} → ${num(row.lexical_family_balanced_rank_weighted_source_hhi, 4)}<br><span class="muted">Δ ${Number.isFinite(rankDelta) ? `${rankDelta > 0 ? '+' : ''}${rankDelta.toFixed(4)}` : '—'} · CI ${num(row.lexical_family_rank_source_hhi_ci95_lower, 4)}–${num(row.lexical_family_rank_source_hhi_ci95_upper, 4)}</span></td>${categoryDetail}<td>${escaped(state)}<br><span class="muted">profiles ${row.provider_prompt_profiles_complete === 'true' ? 'complete' : 'incomplete'} · event detail ${row.event_source_detail_complete === 'true' ? 'complete' : 'incomplete'}</span></td></tr>`;
    })
    .join('');
  const providerCount =
    promptFamilyNumber(summary.provider_summaries_available) ?? providers.length;
  const familyCount = promptFamilyNumber(summary.families_available) ?? 0;
  const bootstrapCount = promptFamilyNumber(summary.family_bootstrap_resamples) ?? 0;
  const truncationNote = truncated
    ? `<p class="notice">Provider table and chart rows are capped. Use <code>--geo-answer-prompt-families-csv</code> for the full bounded export; its summary row reports omitted providers and graph caps.</p>`
    : '';
  const noSupportNote = providers.every(
    (row) => row.event_source_family_interval_state !== 'available'
  )
    ? '<p class="notice">Family-bootstrap intervals are unavailable for the retained providers. Check family support, prompt-catalog and candidate caps, and source-detail completeness in the CSV.</p>'
    : '';
  const table = tableRows.length
    ? `<div class="table-wrap"><table><thead><tr><th>Provider and support</th><th>Pooled citation reach</th><th>Equal-family reach</th><th>Event source HHI · pooled → family</th><th>Rank source HHI · pooled → family</th>${categoryMappings.length === 0 ? '' : '<th>Mapped-category HHI · pooled → family</th>'}<th>Interval/detail state</th></tr></thead><tbody>${tableRows}</tbody></table></div>`
    : '<p class="empty">The retained observations contain no provider-family sensitivity rows.</p>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prompt-family weighting sensitivity</title><style>:root{color-scheme:light;--paper:#f2eee4;--ink:#202722;--muted:#5c665f;--rule:#c8cfc7;--card:#fbfaf6;--pine:#20574c;--rust:#bd4b32;--gold:#b77924}*{box-sizing:border-box}body{margin:0 auto;padding:1.2rem;max-width:1500px;background:linear-gradient(90deg,rgba(32,87,76,.035) 1px,transparent 1px),linear-gradient(rgba(32,87,76,.035) 1px,transparent 1px),var(--paper);background-size:28px 28px;color:var(--ink);font:15px/1.58 "Avenir Next",Avenir,"Trebuchet MS",sans-serif}main{max-width:1380px;margin:auto}header,.panel,.metric{background:var(--card);border:1px solid var(--rule);border-radius:3px;padding:1rem 1.2rem;margin:0 0 1rem;box-shadow:0 8px 24px rgba(32,39,34,.05)}header{border-top:4px solid var(--pine)}h1,h2{font-family:Georgia,"Times New Roman",serif;letter-spacing:-.025em}h1{margin:.1rem 0 .35rem;font-size:clamp(1.6rem,4vw,2.25rem)}h2{margin:.1rem 0 .2rem;font-size:1.25rem}.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:.72rem;font-weight:750;color:var(--pine);margin:0 0 .1rem}.muted{color:var(--muted);font-size:.88em}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.7rem}.metric{margin:0;padding:.8rem 1rem}.metric strong{display:block;font:1.5rem Georgia,serif;color:var(--pine)}.metric span{font-size:.78rem;color:var(--muted)}.panel-head{display:flex;align-items:center;justify-content:space-between;gap:1rem}.unit{border:1px solid var(--rule);border-radius:999px;padding:.15rem .65rem;color:var(--muted);font: .78rem ui-monospace,monospace;white-space:nowrap}.legend{display:flex;gap:1.1rem;flex-wrap:wrap;margin:.7rem 0}.legend span{display:inline-flex;align-items:center;gap:.4rem}.legend i{width:10px;height:10px;border-radius:50%;display:inline-block}.legend .pooled{background:var(--rust)}.legend .family{background:var(--pine)}.chart-wrap{overflow:auto}.chart{display:block;width:100%;min-width:760px;height:auto;color:#526174;background:#f8f6ee;border:1px solid var(--rule);padding:.55rem}.chart text{font:12px ui-monospace,monospace;fill:currentColor}.chart .grid{stroke:#d9ded5;stroke-width:1}.chart .provider-label{font-weight:650;fill:#303b34}.chart .axis-title{fill:#68736b}.chart .pooled-dot{fill:var(--rust);stroke:#fbfaf6;stroke-width:1.5}.chart .family-dot{fill:var(--pine);stroke:#fbfaf6;stroke-width:1.5}.chart .interval{stroke:var(--pine);stroke-width:2}.chart .connector{stroke:#99a79d;stroke-width:1.4;stroke-dasharray:3 3}.table-wrap{overflow:auto;max-height:65vh;border:1px solid var(--rule);border-radius:3px}table{border-collapse:collapse;width:100%;min-width:1050px;font-size:.9rem}th,td{padding:.55rem .65rem;border-bottom:1px solid #e1e3d9;text-align:left;vertical-align:top}th{position:sticky;top:0;background:#e9ece3;z-index:1;color:#273d34;font-size:.76rem;letter-spacing:.04em;text-transform:uppercase}tbody tr:hover{background:#f0f3ea}code{font:600 .9em ui-monospace,monospace;color:var(--pine)}.notice{padding:.7rem .9rem;border-left:4px solid var(--gold);background:#f7efd9}.empty{padding:1rem;border:1px dashed var(--rule);color:var(--muted)}footer{padding:.5rem .2rem 1.5rem;color:var(--muted);font-size:.85rem}@media(max-width:640px){body{padding:.7rem}.panel-head{align-items:flex-start;flex-direction:column}}</style></head><body><main><header><p class="eyebrow">Generative engine optimization · answer citations</p><h1>Does prompt weighting change the provider story?</h1><p>Compare pooled exact-prompt reach and source concentration with estimates that give every connected lexical prompt family one vote. The paired dots expose weighting sensitivity; whiskers show deterministic whole-family bootstrap intervals when retained evidence supports them.</p><p class="muted">Lexical threshold ${num(summary.minimum_cosine_threshold, 2)} · component families are connected wording groups, not semantic intent labels · intervals describe this supplied panel.</p><div class="metrics"><div class="metric"><strong>${providerCount.toLocaleString('en-US')}</strong><span>provider summaries available</span></div><div class="metric"><strong>${familyCount.toLocaleString('en-US')}</strong><span>lexical families at selected cutoff</span></div><div class="metric"><strong>${bootstrapCount.toLocaleString('en-US')}</strong><span>family bootstrap resamples</span></div><div class="metric"><strong>${summary.prompt_catalog_truncated === 'true' || summary.candidate_pairs_capped === 'true' ? 'Capped' : 'Retained'}</strong><span>prompt/candidate graph status</span></div></div></header><section class="panel"><div class="legend"><span><i class="pooled"></i>Pooled exact prompts</span><span><i class="family"></i>Equal lexical families</span><span><i style="width:18px;height:2px;border-radius:0;background:var(--pine)"></i>95% family bootstrap interval</span></div></section>${renderChart('Citation reach', 'The equal-family estimate changes the weighting unit from exact prompt groups to connected lexical families. Reach is observed citation presence, not answer quality.', 'reach')}${renderChart('Event-weighted source concentration', 'Compare source concentration across the two weighting schemes. A higher HHI indicates a more concentrated retained source mix.', 'event-hhi')}${renderChart('Rank-weighted source concentration', 'This complementary view discounts citations by their observed list position; missing or capped source detail is disclosed below.', 'rank-hhi')}<section class="panel"><div class="panel-head"><div><p class="eyebrow">Provider detail</p><h2>Weighting sensitivity and support</h2></div></div><p class="muted">Provider rows are ordered by the largest observed pooled-to-family shift. HHI intervals appear only for family-balanced metrics and are withheld when the prompt/candidate graph, provider profiles, source details, family support, or bootstrap budget is insufficient.</p>${truncationNote}${noSupportNote}${table}</section><footer>Lexical grouping is a sensitivity analysis, not semantic intent resolution or evidence that prompts are independent. The dashboard is self-contained and offline; use the CSV export for family membership and detailed audit fields.</footer></main></body></html>\n`;
}

/** Export provider/family leave-one-out sensitivity for equal-family source concentration. */
export function renderAiAnswerCitationPromptFamilyInfluenceCsv(
  report: AiAnswerCitationObservationReport,
  minimumCosineSimilarity = 0.85,
  categoryMappings: Array<{ domain: string; label: string; labelKey: string }> = []
): string {
  const records = parsePromptFamilyCsv(
    renderAiAnswerCitationPromptFamiliesCsv(report, minimumCosineSimilarity, categoryMappings),
    Number.POSITIVE_INFINITY
  );
  const headers = records[0] ?? [];
  const toObject = (record: string[]): Record<string, string> =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] ?? '']));
  const sourceRows = records.slice(1).map(toObject);
  const sourceSummary = sourceRows.find((row) => row.row_type === 'summary') ?? {};
  const providerSummaries = new Map(
    sourceRows
      .filter((row) => row.row_type === 'provider-family-sensitivity')
      .map((row) => [row.provider, row])
  );
  const topologyByFamily = new Map(
    sourceRows
      .filter((row) => row.row_type === 'prompt-family')
      .map((row) => [row.prompt_family_id, row])
  );
  const familiesByProvider = new Map<string, Array<Record<string, string>>>();
  for (const row of sourceRows) {
    if (row.row_type !== 'prompt-family-provider') continue;
    const families = familiesByProvider.get(row.provider) ?? [];
    families.push(row);
    familiesByProvider.set(row.provider, families);
  }
  const output: Array<Record<string, unknown>> = [];
  for (const [providerName, families] of familiesByProvider) {
    const provider = providerSummaries.get(providerName) ?? {};
    const familyDetailsComplete =
      families.length === (promptFamilyNumber(provider.provider_retained_lexical_families) ?? -1);
    const profilesComplete =
      familyDetailsComplete && provider.provider_prompt_profiles_complete === 'true';
    const eventComplete =
      profilesComplete &&
      provider.event_source_detail_complete === 'true' &&
      families.every((family) => family.family_provider_event_source_detail_complete === 'true');
    const rankComplete =
      profilesComplete &&
      provider.rank_source_detail_complete === 'true' &&
      families.every((family) => family.family_provider_rank_source_detail_complete === 'true');
    const eventFamilies = families.flatMap((family) => {
      const hhi = promptFamilyNumber(family.family_provider_event_weighted_source_hhi);
      return hhi === null ? [] : [{ family, hhi }];
    });
    const rankFamilies = families.flatMap((family) => {
      const hhi = promptFamilyNumber(family.family_provider_rank_weighted_source_hhi);
      return hhi === null ? [] : [{ family, hhi }];
    });
    const eventCategoryFamilies = families.flatMap((family) => {
      const hhi = promptFamilyNumber(family.family_provider_event_weighted_category_hhi);
      return hhi === null ? [] : [{ family, hhi }];
    });
    const rankCategoryFamilies = families.flatMap((family) => {
      const hhi = promptFamilyNumber(family.family_provider_rank_weighted_category_hhi);
      return hhi === null ? [] : [{ family, hhi }];
    });
    const familyReachRates = families.flatMap((family) => {
      const reach = promptFamilyNumber(family.family_provider_citation_prompt_reach_percent);
      return reach === null ? [] : [reach / 100];
    });
    const mean = (items: Array<{ hhi: number }>): number | null =>
      items.length > 0 ? items.reduce((sum, item) => sum + item.hhi, 0) / items.length : null;
    const eventMean = mean(eventFamilies);
    const rankMean = mean(rankFamilies);
    const eventCategoryMean = mean(eventCategoryFamilies);
    const rankCategoryMean = mean(rankCategoryFamilies);
    const familyReachMean =
      familyReachRates.length > 0
        ? familyReachRates.reduce((sum, value) => sum + value, 0) / familyReachRates.length
        : null;
    const eventState = !profilesComplete
      ? 'family-provider-detail-truncated-or-profile-incomplete'
      : !eventComplete
        ? 'event-source-detail-incomplete'
        : eventFamilies.length < 2
          ? 'insufficient-cited-families'
          : 'available';
    const rankState = !profilesComplete
      ? 'family-provider-detail-truncated-or-profile-incomplete'
      : !rankComplete
        ? 'rank-source-detail-incomplete'
        : rankFamilies.length < 2
          ? 'insufficient-cited-families'
          : 'available';
    const eventCategoryState =
      categoryMappings.length === 0
        ? 'category-mappings-not-configured'
        : !profilesComplete
          ? 'family-provider-detail-truncated-or-profile-incomplete'
          : !eventComplete
            ? 'event-source-detail-incomplete'
            : eventCategoryFamilies.length < 2
              ? 'insufficient-mapped-category-families'
              : 'available';
    const rankCategoryState =
      categoryMappings.length === 0
        ? 'category-mappings-not-configured'
        : !profilesComplete
          ? 'family-provider-detail-truncated-or-profile-incomplete'
          : !rankComplete
            ? 'rank-source-detail-incomplete'
            : rankCategoryFamilies.length < 2
              ? 'insufficient-mapped-category-families'
              : 'available';
    const reachState = !profilesComplete
      ? 'family-provider-detail-truncated-or-profile-incomplete'
      : familyReachRates.length < 2
        ? 'insufficient-lexical-families'
        : 'available';
    const eventIntervalLower = promptFamilyNumber(
      provider.lexical_family_event_source_hhi_ci95_lower
    );
    const eventIntervalUpper = promptFamilyNumber(
      provider.lexical_family_event_source_hhi_ci95_upper
    );
    const rankIntervalLower = promptFamilyNumber(
      provider.lexical_family_rank_source_hhi_ci95_lower
    );
    const rankIntervalUpper = promptFamilyNumber(
      provider.lexical_family_rank_source_hhi_ci95_upper
    );
    const eventCategoryIntervalLower = promptFamilyNumber(
      provider.lexical_family_event_category_hhi_ci95_lower
    );
    const eventCategoryIntervalUpper = promptFamilyNumber(
      provider.lexical_family_event_category_hhi_ci95_upper
    );
    const rankCategoryIntervalLower = promptFamilyNumber(
      provider.lexical_family_rank_category_hhi_ci95_lower
    );
    const rankCategoryIntervalUpper = promptFamilyNumber(
      provider.lexical_family_rank_category_hhi_ci95_upper
    );
    for (const family of families) {
      const eventHhi = promptFamilyNumber(family.family_provider_event_weighted_source_hhi);
      const rankHhi = promptFamilyNumber(family.family_provider_rank_weighted_source_hhi);
      const eventCategoryHhi = promptFamilyNumber(
        family.family_provider_event_weighted_category_hhi
      );
      const rankCategoryHhi = promptFamilyNumber(family.family_provider_rank_weighted_category_hhi);
      const eventRemainingCount = eventFamilies.length - (eventHhi === null ? 0 : 1);
      const rankRemainingCount = rankFamilies.length - (rankHhi === null ? 0 : 1);
      const eventWithout =
        eventState === 'available' && eventMean !== null && eventRemainingCount > 0
          ? (eventMean * eventFamilies.length - (eventHhi ?? 0)) / eventRemainingCount
          : null;
      const rankWithout =
        rankState === 'available' && rankMean !== null && rankRemainingCount > 0
          ? (rankMean * rankFamilies.length - (rankHhi ?? 0)) / rankRemainingCount
          : null;
      const eventCategoryRemainingCount =
        eventCategoryFamilies.length - (eventCategoryHhi === null ? 0 : 1);
      const rankCategoryRemainingCount =
        rankCategoryFamilies.length - (rankCategoryHhi === null ? 0 : 1);
      const eventCategoryWithout =
        eventCategoryState === 'available' &&
        eventCategoryMean !== null &&
        eventCategoryRemainingCount > 0
          ? (eventCategoryMean * eventCategoryFamilies.length - (eventCategoryHhi ?? 0)) /
            eventCategoryRemainingCount
          : null;
      const rankCategoryWithout =
        rankCategoryState === 'available' &&
        rankCategoryMean !== null &&
        rankCategoryRemainingCount > 0
          ? (rankCategoryMean * rankCategoryFamilies.length - (rankCategoryHhi ?? 0)) /
            rankCategoryRemainingCount
          : null;
      const familyReachPercent = promptFamilyNumber(
        family.family_provider_citation_prompt_reach_percent
      );
      const reachWithout =
        reachState === 'available' &&
        familyReachMean !== null &&
        familyReachRates.length > 1 &&
        familyReachPercent !== null
          ? (familyReachMean * familyReachRates.length - familyReachPercent / 100) /
            (familyReachRates.length - 1)
          : null;
      const reachDifference =
        (promptFamilyNumber(family.family_provider_citation_prompt_reach_percent) ?? Number.NaN) -
        (promptFamilyNumber(provider.lexical_family_balanced_citation_reach_percent) ?? Number.NaN);
      output.push({
        provider: providerName,
        prompt_family_id: family.prompt_family_id,
        articulation_prompt_groups: promptFamilyNumber(
          topologyByFamily.get(family.prompt_family_id)?.articulation_prompt_groups
        ),
        top_event_sources_json: family.family_provider_top_event_sources_json,
        top_rank_sources_json: family.family_provider_top_rank_sources_json,
        family_prompt_groups: promptFamilyNumber(family.family_provider_prompt_groups),
        family_citation_reach_percent: familyReachPercent,
        equal_family_citation_reach_mean_percent:
          familyReachMean === null ? null : Number((familyReachMean * 100).toFixed(4)),
        citation_reach_after_omitting_family_percent:
          reachWithout === null ? null : Number((reachWithout * 100).toFixed(4)),
        citation_reach_leave_one_out_shift_percentage_points:
          reachWithout === null || familyReachMean === null
            ? null
            : Number(((reachWithout - familyReachMean) * 100).toFixed(4)),
        family_reach_minus_equal_family_mean_percentage_points: Number.isFinite(reachDifference)
          ? Number(reachDifference.toFixed(4))
          : null,
        event_family_source_hhi: eventHhi,
        event_equal_family_mean_hhi: eventMean === null ? null : Number(eventMean.toFixed(6)),
        event_equal_family_hhi_ci95_lower: eventIntervalLower,
        event_equal_family_hhi_ci95_upper: eventIntervalUpper,
        event_hhi_after_omitting_family:
          eventWithout === null ? null : Number(eventWithout.toFixed(6)),
        event_leave_one_out_shift_from_equal_family_mean:
          eventWithout === null || eventMean === null
            ? null
            : Number((eventWithout - eventMean).toFixed(6)),
        event_family_effective_source_count: promptFamilyNumber(
          family.family_provider_event_weighted_effective_source_count
        ),
        event_family_largest_source_share_percent: promptFamilyNumber(
          family.family_provider_event_weighted_largest_source_share_percent
        ),
        event_influence_state: eventState,
        rank_family_source_hhi: rankHhi,
        rank_equal_family_mean_hhi: rankMean === null ? null : Number(rankMean.toFixed(6)),
        rank_equal_family_hhi_ci95_lower: rankIntervalLower,
        rank_equal_family_hhi_ci95_upper: rankIntervalUpper,
        rank_hhi_after_omitting_family:
          rankWithout === null ? null : Number(rankWithout.toFixed(6)),
        rank_leave_one_out_shift_from_equal_family_mean:
          rankWithout === null || rankMean === null
            ? null
            : Number((rankWithout - rankMean).toFixed(6)),
        rank_family_effective_source_count: promptFamilyNumber(
          family.family_provider_rank_weighted_effective_source_count
        ),
        rank_family_largest_source_share_percent: promptFamilyNumber(
          family.family_provider_rank_weighted_largest_source_share_percent
        ),
        rank_influence_state: rankState,
        event_family_mapped_category_hhi: eventCategoryHhi,
        event_equal_family_mapped_category_hhi:
          eventCategoryMean === null ? null : Number(eventCategoryMean.toFixed(6)),
        event_equal_family_mapped_category_hhi_ci95_lower: eventCategoryIntervalLower,
        event_equal_family_mapped_category_hhi_ci95_upper: eventCategoryIntervalUpper,
        event_mapped_category_hhi_after_omitting_family:
          eventCategoryWithout === null ? null : Number(eventCategoryWithout.toFixed(6)),
        event_mapped_category_leave_one_out_shift:
          eventCategoryWithout === null || eventCategoryMean === null
            ? null
            : Number((eventCategoryWithout - eventCategoryMean).toFixed(6)),
        event_family_mapped_category_weight_share_percent: promptFamilyNumber(
          family.family_provider_event_mapped_category_weight_share_percent
        ),
        event_mapped_category_influence_state: eventCategoryState,
        rank_family_mapped_category_hhi: rankCategoryHhi,
        rank_equal_family_mapped_category_hhi:
          rankCategoryMean === null ? null : Number(rankCategoryMean.toFixed(6)),
        rank_equal_family_mapped_category_hhi_ci95_lower: rankCategoryIntervalLower,
        rank_equal_family_mapped_category_hhi_ci95_upper: rankCategoryIntervalUpper,
        rank_mapped_category_hhi_after_omitting_family:
          rankCategoryWithout === null ? null : Number(rankCategoryWithout.toFixed(6)),
        rank_mapped_category_leave_one_out_shift:
          rankCategoryWithout === null || rankCategoryMean === null
            ? null
            : Number((rankCategoryWithout - rankCategoryMean).toFixed(6)),
        rank_family_mapped_category_weight_share_percent: promptFamilyNumber(
          family.family_provider_rank_mapped_category_weight_share_percent
        ),
        rank_mapped_category_influence_state: rankCategoryState,
        reach_influence_state: reachState,
        provider_prompt_profiles_complete: provider.provider_prompt_profiles_complete === 'true',
        event_source_detail_complete: provider.event_source_detail_complete === 'true',
        rank_source_detail_complete: provider.rank_source_detail_complete === 'true',
        minimum_cosine_threshold: promptFamilyNumber(sourceSummary.minimum_cosine_threshold),
      });
    }
  }
  const score = (row: Record<string, unknown>): number =>
    Math.max(
      Math.abs(
        typeof row.event_leave_one_out_shift_from_equal_family_mean === 'number'
          ? row.event_leave_one_out_shift_from_equal_family_mean
          : 0
      ),
      Math.abs(
        typeof row.rank_leave_one_out_shift_from_equal_family_mean === 'number'
          ? row.rank_leave_one_out_shift_from_equal_family_mean
          : 0
      ),
      Math.abs(
        typeof row.event_mapped_category_leave_one_out_shift === 'number'
          ? row.event_mapped_category_leave_one_out_shift
          : 0
      ),
      Math.abs(
        typeof row.rank_mapped_category_leave_one_out_shift === 'number'
          ? row.rank_mapped_category_leave_one_out_shift
          : 0
      ),
      Math.abs(
        typeof row.citation_reach_leave_one_out_shift_percentage_points === 'number'
          ? row.citation_reach_leave_one_out_shift_percentage_points / 100
          : 0
      )
    );
  output.sort(
    (left, right) =>
      score(right) - score(left) ||
      String(left.provider).localeCompare(String(right.provider)) ||
      String(left.prompt_family_id).localeCompare(String(right.prompt_family_id))
  );
  const emittedRows = output.slice(0, MAX_OUTPUT_ROWS);
  const outputHeaders = [
    'row_type',
    'provider',
    'prompt_family_id',
    'articulation_prompt_groups',
    'top_event_sources_json',
    'top_rank_sources_json',
    'family_prompt_groups',
    'family_citation_reach_percent',
    'equal_family_citation_reach_mean_percent',
    'citation_reach_after_omitting_family_percent',
    'citation_reach_leave_one_out_shift_percentage_points',
    'family_reach_minus_equal_family_mean_percentage_points',
    'reach_influence_state',
    'event_family_source_hhi',
    'event_equal_family_mean_hhi',
    'event_equal_family_hhi_ci95_lower',
    'event_equal_family_hhi_ci95_upper',
    'event_hhi_after_omitting_family',
    'event_leave_one_out_shift_from_equal_family_mean',
    'event_family_effective_source_count',
    'event_family_largest_source_share_percent',
    'event_influence_state',
    'rank_family_source_hhi',
    'rank_equal_family_mean_hhi',
    'rank_equal_family_hhi_ci95_lower',
    'rank_equal_family_hhi_ci95_upper',
    'rank_hhi_after_omitting_family',
    'rank_leave_one_out_shift_from_equal_family_mean',
    'rank_family_effective_source_count',
    'rank_family_largest_source_share_percent',
    'rank_influence_state',
    'event_family_mapped_category_hhi',
    'event_equal_family_mapped_category_hhi',
    'event_equal_family_mapped_category_hhi_ci95_lower',
    'event_equal_family_mapped_category_hhi_ci95_upper',
    'event_mapped_category_hhi_after_omitting_family',
    'event_mapped_category_leave_one_out_shift',
    'event_family_mapped_category_weight_share_percent',
    'event_mapped_category_influence_state',
    'rank_family_mapped_category_hhi',
    'rank_equal_family_mapped_category_hhi',
    'rank_equal_family_mapped_category_hhi_ci95_lower',
    'rank_equal_family_mapped_category_hhi_ci95_upper',
    'rank_mapped_category_hhi_after_omitting_family',
    'rank_mapped_category_leave_one_out_shift',
    'rank_family_mapped_category_weight_share_percent',
    'rank_mapped_category_influence_state',
    'provider_prompt_profiles_complete',
    'event_source_detail_complete',
    'rank_source_detail_complete',
    'minimum_cosine_threshold',
    'source_category_mappings_configured',
  ];
  const summary: Record<string, unknown> = {
    row_type: 'summary',
    minimum_cosine_threshold: promptFamilyNumber(sourceSummary.minimum_cosine_threshold),
    source_category_mappings_configured: categoryMappings.length,
    provider_summaries_available: promptFamilyNumber(sourceSummary.provider_summaries_available),
    provider_family_details_available: promptFamilyNumber(
      sourceSummary.provider_family_details_available
    ),
    provider_family_details_emitted: promptFamilyNumber(
      sourceSummary.provider_family_details_emitted
    ),
    provider_family_details_truncated: sourceSummary.provider_family_details_truncated === 'true',
    prompt_catalog_truncated: sourceSummary.prompt_catalog_truncated === 'true',
    candidate_pairs_capped: sourceSummary.candidate_pairs_capped === 'true',
    family_bootstrap_resamples: promptFamilyNumber(sourceSummary.family_bootstrap_resamples),
    influence_rows_available: output.length,
    influence_rows_emitted: emittedRows.length,
    output_rows_truncated: output.length > emittedRows.length,
    interpretation_note:
      'Leave-one-family-out HHI shifts show sensitivity of equal-family source concentration to each retained lexical family. These are panel diagnostics, not causal importance or semantic-dependence estimates.',
  };
  const serialize = (row: Record<string, unknown>): string =>
    outputHeaders.map((header) => csvCell(row[header] ?? '')).join(',');
  const summaryRow = Object.fromEntries(
    outputHeaders.map((header) => [header, summary[header] ?? ''])
  );
  return `${[outputHeaders.map(csvCell).join(','), serialize({ row_type: 'summary', ...summaryRow }), ...emittedRows.map((row) => serialize({ row_type: 'family-influence', ...row }))].join('\r\n')}\r\n`;
}

/** Render the highest-impact leave-one-family-out reach and source-concentration changes as offline SVG. */
export function renderAiAnswerCitationPromptFamilyInfluenceHtml(
  report: AiAnswerCitationObservationReport,
  minimumCosineSimilarity = 0.85,
  categoryMappings: Array<{ domain: string; label: string; labelKey: string }> = []
): string {
  const records = parsePromptFamilyCsv(
    renderAiAnswerCitationPromptFamilyInfluenceCsv(
      report,
      minimumCosineSimilarity,
      categoryMappings
    ),
    MAX_PROMPT_FAMILY_INFLUENCE_HTML_ROWS + 2
  );
  const headers = records[0] ?? [];
  const toObject = (record: string[]): Record<string, string> =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] ?? '']));
  const rows = records.slice(1).map(toObject);
  const summary = rows.find((row) => row.row_type === 'summary') ?? {};
  const influences = rows.filter((row) => row.row_type === 'family-influence');
  const escaped = promptFamilyHtmlEscape;
  const num = (value: string | undefined, digits = 4): string => {
    const parsed = promptFamilyNumber(value);
    return parsed === null
      ? '—'
      : parsed.toLocaleString('en-US', { maximumFractionDigits: digits });
  };
  const renderSources = (
    value: string | undefined,
    weightKey: 'citationEvents' | 'discountedCitationWeight'
  ): string => {
    if (!value) return '—';
    try {
      const parsed: unknown = JSON.parse(value);
      if (!Array.isArray(parsed) || parsed.length === 0) return '—';
      return parsed
        .map((item: unknown) => {
          if (!item || typeof item !== 'object') return '';
          const source = item as Record<string, unknown>;
          return `${escaped(String(source.domain ?? ''))} (${num(String(source[weightKey] ?? ''), 3)})`;
        })
        .filter(Boolean)
        .join(', ');
    } catch {
      return '—';
    }
  };
  const makeChart = (
    title: string,
    description: string,
    metric: 'event' | 'rank' | 'reach' | 'event-category' | 'rank-category'
  ): string => {
    const key =
      metric === 'event'
        ? 'event_leave_one_out_shift_from_equal_family_mean'
        : metric === 'rank'
          ? 'rank_leave_one_out_shift_from_equal_family_mean'
          : metric === 'event-category'
            ? 'event_mapped_category_leave_one_out_shift'
            : metric === 'rank-category'
              ? 'rank_mapped_category_leave_one_out_shift'
              : 'citation_reach_leave_one_out_shift_percentage_points';
    const ranked = influences
      .filter((row) => promptFamilyNumber(row[key]) !== null)
      .sort(
        (left, right) =>
          Math.abs(promptFamilyNumber(right[key])!) - Math.abs(promptFamilyNumber(left[key])!)
      )
      .slice(0, MAX_PROMPT_FAMILY_INFLUENCE_HTML_CHART_ROWS);
    const maxValue = Math.max(
      0.01,
      ...ranked.map((row) => Math.abs(promptFamilyNumber(row[key]) ?? 0))
    );
    const scale =
      metric === 'reach'
        ? Math.max(1, Math.ceil(maxValue / 5) * 5)
        : Math.ceil(maxValue * 1000) / 1000;
    const width = 1150;
    const left = 315;
    const right = 1080;
    const center = (left + right) / 2;
    const halfWidth = (right - left) / 2;
    const top = 32;
    const rowHeight = 29;
    const height = Math.max(118, top + ranked.length * rowHeight + 40);
    const x = (value: number): number =>
      center + (Math.max(-scale, Math.min(scale, value)) / scale) * halfWidth;
    const ticks = [-scale, -scale / 2, 0, scale / 2, scale];
    const grid = ticks
      .map(
        (tick) =>
          `<line x1="${x(tick)}" y1="${top - 12}" x2="${x(tick)}" y2="${height - 34}" class="grid"/><text x="${x(tick)}" y="${height - 17}" text-anchor="middle">${metric === 'reach' ? `${tick.toFixed(1)} pp` : tick.toFixed(3)}</text>`
      )
      .join('');
    const bars = ranked
      .map((row, index) => {
        const value = promptFamilyNumber(row[key])!;
        const y = top + index * rowHeight;
        const start = Math.min(center, x(value));
        const barWidth = Math.max(1, Math.abs(x(value) - center));
        const family = `${row.provider} · ${row.prompt_family_id}`;
        return `<text x="${left - 12}" y="${y + 12}" text-anchor="end" class="family-label">${escaped(family)}</text><rect x="${start}" y="${y + 2}" width="${barWidth}" height="14" rx="2" class="${value >= 0 ? 'positive' : 'negative'}"><title>${escaped(family)}: ${value > 0 ? '+' : ''}${value.toFixed(6)}${metric === 'reach' ? ' percentage points' : ' HHI'}</title></rect>`;
      })
      .join('');
    const unavailable =
      ranked.length === 0
        ? '<p class="empty">No supported changes are available for this metric.</p>'
        : `<div class="chart-wrap"><svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}; signed leave-one-family-out changes">${grid}<line x1="${center}" y1="${top - 12}" x2="${center}" y2="${height - 34}" class="zero"/>${bars}<text x="${center}" y="${height - 3}" text-anchor="middle" class="axis-title">Change after omitting one family</text></svg></div>`;
    return `<section class="panel"><p class="eyebrow">Influence ranking</p><h2>${title}</h2><p class="muted">${description} Positive values mean omitting the family raises the equal-family estimate. Negative values mean it lowers the estimate.</p>${unavailable}</section>`;
  };
  const tableRows = influences
    .slice(0, MAX_PROMPT_FAMILY_INFLUENCE_HTML_ROWS)
    .map((row) => {
      const categoryDetail =
        categoryMappings.length === 0
          ? ''
          : `<td>Event ${num(row.event_family_mapped_category_hhi, 6)} · Δ ${num(row.event_mapped_category_leave_one_out_shift, 6)}<br><span class="muted">mapped ${num(row.event_family_mapped_category_weight_share_percent, 1)}% · ${escaped(row.event_mapped_category_influence_state)}</span><br>Rank ${num(row.rank_family_mapped_category_hhi, 6)} · Δ ${num(row.rank_mapped_category_leave_one_out_shift, 6)}<br><span class="muted">mapped ${num(row.rank_family_mapped_category_weight_share_percent, 1)}% · ${escaped(row.rank_mapped_category_influence_state)}</span></td>`;
      return `<tr><td><strong>${escaped(row.provider)}</strong><br><code>${escaped(row.prompt_family_id)}</code><br><span class="muted">${num(row.family_prompt_groups, 0)} prompt groups · ${num(row.articulation_prompt_groups, 0)} articulation prompts</span></td><td>${num(row.event_family_source_hhi)}<br><span class="muted">Leave-one-out shift ${num(row.event_leave_one_out_shift_from_equal_family_mean, 6)} · state ${escaped(row.event_influence_state)}</span><br><span class="muted">Mean CI ${num(row.event_equal_family_hhi_ci95_lower, 6)}–${num(row.event_equal_family_hhi_ci95_upper, 6)}</span></td><td>${num(row.rank_family_source_hhi)}<br><span class="muted">Leave-one-out shift ${num(row.rank_leave_one_out_shift_from_equal_family_mean, 6)} · state ${escaped(row.rank_influence_state)}</span><br><span class="muted">Mean CI ${num(row.rank_equal_family_hhi_ci95_lower, 6)}–${num(row.rank_equal_family_hhi_ci95_upper, 6)}</span></td>${categoryDetail}<td>${num(row.family_citation_reach_percent, 2)}%<br><span class="muted">Omit-family reach ${num(row.citation_reach_after_omitting_family_percent, 2)}% · Δ ${num(row.citation_reach_leave_one_out_shift_percentage_points, 2)} pp</span><br><span class="muted">${escaped(row.reach_influence_state)}</span></td><td>${renderSources(row.top_event_sources_json, 'citationEvents')}<br><span class="muted">Rank sources: ${renderSources(row.top_rank_sources_json, 'discountedCitationWeight')}</span></td><td>${row.provider_prompt_profiles_complete === 'true' ? 'Complete' : 'Incomplete'}<br><span class="muted">event ${row.event_source_detail_complete === 'true' ? 'complete' : 'incomplete'} · rank ${row.rank_source_detail_complete === 'true' ? 'complete' : 'incomplete'}</span></td></tr>`;
    })
    .join('');
  const truncated =
    summary.output_rows_truncated === 'true' ||
    summary.provider_family_details_truncated === 'true' ||
    (promptFamilyNumber(summary.influence_rows_available) ?? influences.length) >
      MAX_PROMPT_FAMILY_INFLUENCE_HTML_ROWS;
  const capNote = truncated
    ? '<p class="notice">The family-detail or influence output is capped. Review the CSV summary before interpreting missing families.</p>'
    : '';
  const table = tableRows
    ? `<div class="table-wrap"><table><thead><tr><th>Provider and family</th><th>Event HHI and influence</th><th>Rank HHI and influence</th>${categoryMappings.length === 0 ? '' : '<th>Mapped-category HHI influence and coverage</th>'}<th>Family citation reach</th><th>Top retained event / rank sources</th><th>Completeness</th></tr></thead><tbody>${tableRows}</tbody></table></div>`
    : '<p class="empty">No provider/family influence rows are available for this sample.</p>';
  const threshold = num(summary.minimum_cosine_threshold, 2);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prompt-family influence audit</title><style>:root{color-scheme:light;--paper:#f2eee4;--ink:#202722;--muted:#5c665f;--rule:#c8cfc7;--card:#fbfaf6;--pine:#20574c;--rust:#bd4b32;--gold:#b77924}*{box-sizing:border-box}body{margin:0 auto;padding:1.2rem;max-width:1500px;background:linear-gradient(90deg,rgba(32,87,76,.035) 1px,transparent 1px),linear-gradient(rgba(32,87,76,.035) 1px,transparent 1px),var(--paper);background-size:28px 28px;color:var(--ink);font:15px/1.58 "Avenir Next",Avenir,"Trebuchet MS",sans-serif}main{max-width:1380px;margin:auto}header,.panel{background:var(--card);border:1px solid var(--rule);border-radius:3px;padding:1rem 1.2rem;margin:0 0 1rem;box-shadow:0 8px 24px rgba(32,39,34,.05)}header{border-top:4px solid var(--pine)}h1,h2{font-family:Georgia,"Times New Roman",serif;letter-spacing:-.025em}h1{margin:.1rem 0 .35rem;font-size:clamp(1.6rem,4vw,2.2rem)}h2{margin:.1rem 0 .2rem;font-size:1.25rem}.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:.72rem;font-weight:750;color:var(--pine);margin:0 0 .1rem}.muted{color:var(--muted);font-size:.86em}.chart-wrap{overflow:auto}.chart{display:block;width:100%;min-width:800px;height:auto;color:#526174;background:#f8f6ee;border:1px solid var(--rule);padding:.55rem}.chart text{font:11px ui-monospace,monospace;fill:currentColor}.chart .grid{stroke:#d9ded5}.chart .zero{stroke:#77877c;stroke-width:1.4;stroke-dasharray:4 3}.chart .family-label{font-size:11px;fill:#303b34}.chart .axis-title{fill:#68736b}.chart .positive{fill:var(--pine)}.chart .negative{fill:var(--rust)}.table-wrap{overflow:auto;max-height:65vh;border:1px solid var(--rule);border-radius:3px}table{border-collapse:collapse;width:100%;min-width:900px;font-size:.9rem}th,td{padding:.55rem .65rem;border-bottom:1px solid #e1e3d9;text-align:left;vertical-align:top}th{position:sticky;top:0;background:#e9ece3;z-index:1;color:#273d34;font-size:.76rem;letter-spacing:.04em;text-transform:uppercase}tbody tr:hover{background:#f0f3ea}code{font:600 .9em ui-monospace,monospace;color:var(--pine)}.notice{padding:.7rem .9rem;border-left:4px solid var(--gold);background:#f7efd9}.empty{padding:1rem;border:1px dashed var(--rule);color:var(--muted)}footer{padding:.5rem .2rem 1.5rem;color:var(--muted);font-size:.85rem}@media(max-width:640px){body{padding:.7rem}}</style></head><body><main><header><p class="eyebrow">Generative engine optimization · provider citations</p><h1>Which wording families drive source concentration?</h1><p>This view recomputes each provider’s equal-family source and optionally mapped-category HHI after removing one lexical prompt family. The largest bars identify wording clusters that move the concentration estimate most. It is a sensitivity audit over the retained citation panel, not causal attribution.</p><p class="muted">Lexical threshold ${threshold} · family IDs join to the prompt-family CSV · whole-family bootstrap intervals describe the full mean, not the leave-one-out rows. Category HHI is conditional on mapped citation weight; inspect coverage in the audit table.</p></header>${makeChart('Event-weighted HHI influence', 'HHI ranges from 0 to 1; larger values indicate a more concentrated retained source mix.', 'event')}${makeChart('Rank-weighted HHI influence', 'Rank weighting discounts lower citation positions. Incomplete rank detail withholds the influence estimate.', 'rank')}${categoryMappings.length === 0 ? '' : `${makeChart('Event mapped-category HHI influence', 'Category HHI is normalized over mapped event weight only; consult mapped-share coverage.', 'event-category')}${makeChart('Rank mapped-category HHI influence', 'Category HHI is normalized over mapped rank weight only; consult mapped-share coverage.', 'rank-category')}`}${makeChart('Leave-one-family-out citation reach', 'Shows the signed change in provider equal-family citation reach after omitting each family.', 'reach')}<section class="panel"><p class="eyebrow">Audit detail</p><h2>Family support, intervals, and completeness</h2><p class="muted">Rows are sorted by the greatest supported leave-one-out source/category-concentration shift or reach deviation. HHI bootstrap intervals apply to the full family mean; they are not intervals around each family’s influence.</p>${capNote}${table}</section><footer>The chart and table are static, self-contained HTML with no external requests. Connected lexical families are a wording heuristic, not semantic-intent labels or evidence of independent demand.</footer></main></body></html>\n`;
}

/** Show how lexical prompt-family topology and family-balanced reach move across similarity cutoffs. */

/** Show how lexical prompt-family topology and family-balanced reach move across similarity cutoffs. */
export function renderAiAnswerCitationPromptFamilyThresholdSweepCsv(
  report: AiAnswerCitationObservationReport,
  selectedThreshold = 0.85,
  categoryMappings: Array<{ domain: string; label: string; labelKey: string }> = []
): string {
  const table = buildPromptFamilyThresholdSweepTable(report, selectedThreshold, categoryMappings);
  return `${[table.headers, ...table.rows.map((row) => table.headers.map((header) => row[header] ?? ''))].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

interface PromptFamilyThresholdSweepTable {
  headers: string[];
  rows: Array<Record<string, unknown>>;
  thresholds: number[];
  candidateAnalysis: ReturnType<typeof analyzePromptSimilarity>;
  outputTruncated: boolean;
}

function buildPromptFamilyThresholdSweepTable(
  report: AiAnswerCitationObservationReport,
  selectedThreshold = 0.85,
  categoryMappings: Array<{ domain: string; label: string; labelKey: string }> = []
): PromptFamilyThresholdSweepTable {
  if (!Number.isFinite(selectedThreshold) || selectedThreshold < 0 || selectedThreshold > 1) {
    throw new Error('Prompt-family similarity threshold must be between 0 and 1.');
  }
  if (categoryMappings.length > 500)
    throw new Error(
      'Prompt-family threshold sensitivity accepts at most 500 normalized category mappings.'
    );
  const thresholds = [...new Set([...PROMPT_FAMILY_THRESHOLD_SWEEP, selectedThreshold])].sort(
    (left, right) => left - right
  );
  const analysis = analyzePromptSimilarity(report, thresholds[0]!);
  const categoryMappingsByDomain = new Map<string, string>();
  for (const { domain, labelKey } of categoryMappings) {
    const normalizedDomain = domain.toLowerCase().replace(/^\.+|\.+$/gu, '');
    if (normalizedDomain) categoryMappingsByDomain.set(normalizedDomain, labelKey);
  }
  const promptIndexByKey = new Map(
    report.prompts.map((profile, index) => [normalizedPrompt(profile.prompt), index])
  );
  const summaryRows: Array<Record<string, unknown>> = [];
  const providerRows: Array<Record<string, unknown>> = [];
  const providerBootstrapInputs: Array<{
    row: Record<string, unknown>;
    provider: string;
    threshold: number;
    citationRates: number[];
    ownedLowerRates: number[];
    ownedUpperRates: number[];
    eventCategoryHhiRates: number[];
    eventCategoryMappedShareRates: number[];
    rankCategoryHhiRates: number[];
    rankCategoryMappedShareRates: number[];
    eventCategoryDetailComplete: boolean;
    rankCategoryDetailComplete: boolean;
    ownedMetadataComplete: boolean;
  }> = [];
  const note =
    'Families are transitive connected components of retained lexical TF-IDF prompt edges at the selected cosine threshold. The sweep measures sensitivity to that cutoff; lexical similarity does not establish semantic equivalence or independent demand. Family-balanced reach and mapped-category concentration average within-family values equally. Category HHI is conditional on mapped citation weight; mapping coverage is reported separately. Bootstrap intervals resample lexical families, are conditional on the selected cutoff, and are withheld when the prompt or candidate graph is capped.';

  for (const threshold of thresholds) {
    const parent = report.prompts.map((_, index) => index);
    const findRoot = (index: number): number => {
      let root = index;
      while (parent[root] !== root) root = parent[root]!;
      while (parent[index] !== index) {
        const next = parent[index]!;
        parent[index] = root;
        index = next;
      }
      return root;
    };
    for (const edge of analysis.rows) {
      if (edge.cosine < threshold) continue;
      const left = promptIndexByKey.get(normalizedPrompt(edge.left.profile.prompt));
      const right = promptIndexByKey.get(normalizedPrompt(edge.right.profile.prompt));
      if (left === undefined || right === undefined) continue;
      const leftRoot = findRoot(left);
      const rightRoot = findRoot(right);
      if (leftRoot !== rightRoot)
        parent[Math.max(leftRoot, rightRoot)] = Math.min(leftRoot, rightRoot);
    }

    const membersByRoot = new Map<number, AiAnswerCitationPromptProfile[]>();
    report.prompts.forEach((profile, index) => {
      const root = findRoot(index);
      const members = membersByRoot.get(root) ?? [];
      members.push(profile);
      membersByRoot.set(root, members);
    });
    const components = [...membersByRoot.values()];
    const nonSingletons = components.filter((members) => members.length > 1);
    const promptsInNonSingletons = nonSingletons.reduce((sum, members) => sum + members.length, 0);
    const largestFamilySize = components.reduce(
      (largest, members) => Math.max(largest, members.length),
      0
    );
    const adjacencyByRoot = new Map<number, Map<number, Set<number>>>(
      [...membersByRoot.keys()].map((root) => [root, new Map()])
    );
    report.prompts.forEach((_, promptIndex) => {
      const root = findRoot(promptIndex);
      adjacencyByRoot.get(root)!.set(promptIndex, new Set());
    });
    for (const edge of analysis.rows) {
      if (edge.cosine < threshold) continue;
      const left = promptIndexByKey.get(normalizedPrompt(edge.left.profile.prompt));
      const right = promptIndexByKey.get(normalizedPrompt(edge.right.profile.prompt));
      if (left === undefined || right === undefined) continue;
      const root = findRoot(left);
      if (root !== findRoot(right)) continue;
      const adjacency = adjacencyByRoot.get(root)!;
      adjacency.get(left)!.add(right);
      adjacency.get(right)!.add(left);
    }
    let articulationPromptGroups = 0;
    let familiesWithArticulationPrompts = 0;
    for (const adjacency of adjacencyByRoot.values()) {
      const count = findArticulationPromptIndexes(adjacency).length;
      articulationPromptGroups += count;
      if (count > 0) familiesWithArticulationPrompts += 1;
    }
    const providerFamilies = new Map<
      string,
      {
        provider: string;
        families: Array<{
          observations: number;
          observationsWithCitations: number;
          promptGroups: number;
          ownedPromptPositive: number;
          ownedPromptUnknown: number;
          ownedMetadataComplete: boolean;
          eventDomains: Map<string, number>;
          eventSourceDetailComplete: boolean;
          rankDomains: Map<string, number>;
          rankSourceDetailComplete: boolean;
          eventCategoryHhi: number | null;
          eventCategoryMappedSharePercent: number | null;
          rankCategoryHhi: number | null;
          rankCategoryMappedSharePercent: number | null;
        }>;
      }
    >();
    for (const members of components) {
      const statsByProvider = new Map<
        string,
        {
          provider: string;
          observations: number;
          observationsWithCitations: number;
          promptGroups: number;
          ownedPromptPositive: number;
          ownedPromptUnknown: number;
          ownedMetadataComplete: boolean;
          eventDomains: Map<string, number>;
          eventSourceDetailComplete: boolean;
          rankDomains: Map<string, number>;
          rankSourceDetailComplete: boolean;
        }
      >();
      for (const member of members) {
        for (const profile of member.providerProfiles ?? []) {
          const providerKey = normalizedPrompt(profile.provider);
          const stats = statsByProvider.get(providerKey) ?? {
            provider: profile.provider,
            observations: 0,
            observationsWithCitations: 0,
            promptGroups: 0,
            ownedPromptPositive: 0,
            ownedPromptUnknown: 0,
            ownedMetadataComplete: true,
            eventDomains: new Map<string, number>(),
            eventSourceDetailComplete: true,
            rankDomains: new Map<string, number>(),
            rankSourceDetailComplete: true,
          };
          stats.observations += profile.observations;
          stats.observationsWithCitations += profile.observationsWithCitations;
          stats.promptGroups += 1;
          if (categoryMappings.length > 0) {
            const eventDomains = new Map<string, number>();
            let eventDetailsValid = true;
            for (const item of profile.citedDomainCitationEvents ?? []) {
              if (!Number.isFinite(item.citationEvents) || item.citationEvents < 0) {
                eventDetailsValid = false;
                continue;
              }
              const domain = item.domain.toLowerCase();
              eventDomains.set(domain, (eventDomains.get(domain) ?? 0) + item.citationEvents);
            }
            const listedEvents = [...eventDomains.values()].reduce((sum, value) => sum + value, 0);
            stats.eventSourceDetailComplete &&=
              Array.isArray(profile.citedDomainCitationEvents) &&
              profile.citedDomainsTruncated === false &&
              eventDetailsValid &&
              listedEvents === profile.citationEvents;
            for (const [domain, count] of eventDomains)
              stats.eventDomains.set(domain, (stats.eventDomains.get(domain) ?? 0) + count);

            const rankDomains = new Map<string, number>();
            let rankDetailsValid = true;
            for (const item of profile.rankWeightedDomainCitationEvents ?? []) {
              if (
                !Number.isFinite(item.discountedCitationWeight) ||
                item.discountedCitationWeight < 0
              ) {
                rankDetailsValid = false;
                continue;
              }
              const domain = item.domain.toLowerCase();
              rankDomains.set(
                domain,
                (rankDomains.get(domain) ?? 0) + item.discountedCitationWeight
              );
            }
            const rankTotal = profile.rankWeightedCitationWeightTotal ?? 0;
            const listedRankWeight = [...rankDomains.values()].reduce(
              (sum, value) => sum + value,
              0
            );
            const rankTolerance = Math.max(1e-9, rankTotal * 1e-9);
            stats.rankSourceDetailComplete &&=
              Array.isArray(profile.rankWeightedDomainCitationEvents) &&
              Number.isFinite(profile.rankWeightedCitationWeightTotal) &&
              profile.rankWeightedDomainsTruncated === false &&
              rankDetailsValid &&
              Math.abs(listedRankWeight - rankTotal) <= rankTolerance &&
              (profile.citationEvents > 0
                ? rankTotal > 0 && rankTotal <= profile.citationEvents + rankTolerance
                : rankTotal === 0);
            for (const [domain, weight] of rankDomains)
              stats.rankDomains.set(domain, (stats.rankDomains.get(domain) ?? 0) + weight);
          }
          if (report.ownedDomains.length > 0) {
            const ownedEvents = profile.ownedCitationEvents;
            const validOwnedEvents = Number.isSafeInteger(ownedEvents) && ownedEvents! >= 0;
            if (validOwnedEvents && ownedEvents! > 0) {
              stats.ownedPromptPositive += 1;
            } else {
              const incomplete = profile.incompleteCitationListObservations;
              const validCompleteness =
                Number.isSafeInteger(incomplete) &&
                incomplete! >= 0 &&
                incomplete! <= profile.observations;
              if (validOwnedEvents && ownedEvents === 0 && validCompleteness && incomplete === 0) {
                // A complete captured citation list confirms this prompt-level absence.
              } else {
                stats.ownedPromptUnknown += 1;
              }
              if (
                !validOwnedEvents ||
                (validOwnedEvents && ownedEvents === 0 && !validCompleteness)
              )
                stats.ownedMetadataComplete = false;
            }
          }
          statsByProvider.set(providerKey, stats);
        }
      }
      for (const [providerKey, stats] of statsByProvider) {
        const provider = providerFamilies.get(providerKey) ?? {
          provider: stats.provider,
          families: [],
        };
        const eventCategories = aggregatePromptFamilyCategoryWeights(
          stats.eventDomains,
          categoryMappingsByDomain
        );
        const rankCategories = aggregatePromptFamilyCategoryWeights(
          stats.rankDomains,
          categoryMappingsByDomain
        );
        const eventCategoryConcentration =
          categoryMappings.length > 0 && stats.eventSourceDetailComplete
            ? sourceConcentration(eventCategories.categoryWeights)
            : null;
        const rankCategoryConcentration =
          categoryMappings.length > 0 && stats.rankSourceDetailComplete
            ? sourceConcentration(rankCategories.categoryWeights)
            : null;
        provider.families.push({
          ...stats,
          eventCategoryHhi: eventCategoryConcentration?.hhi ?? null,
          eventCategoryMappedSharePercent: stats.eventSourceDetailComplete
            ? eventCategories.mappedSharePercent
            : null,
          rankCategoryHhi: rankCategoryConcentration?.hhi ?? null,
          rankCategoryMappedSharePercent: stats.rankSourceDetailComplete
            ? rankCategories.mappedSharePercent
            : null,
        });
        providerFamilies.set(providerKey, provider);
      }
    }

    summaryRows.push({
      row_type: 'threshold-summary',
      cosine_threshold: Number(threshold.toFixed(4)),
      source_category_mappings_configured: categoryMappings.length,
      retained_prompt_groups: analysis.documentCount,
      prompt_families: components.length,
      non_singleton_families: nonSingletons.length,
      prompt_groups_in_non_singleton_families: promptsInNonSingletons,
      prompt_share_in_non_singleton_families_percent:
        analysis.documentCount > 0
          ? Number(((promptsInNonSingletons / analysis.documentCount) * 100).toFixed(4))
          : null,
      largest_family_prompt_groups: largestFamilySize,
      articulation_prompt_groups: articulationPromptGroups,
      articulation_prompt_share_percent:
        analysis.documentCount > 0
          ? Number(((articulationPromptGroups / analysis.documentCount) * 100).toFixed(4))
          : null,
      families_with_articulation_prompts: familiesWithArticulationPrompts,
      candidate_pairs_considered: analysis.candidatePairCount,
      high_frequency_posting_cutoff: analysis.highFrequencyCutoff,
      prompt_catalog_truncated: analysis.promptCatalogTruncated,
      candidate_pairs_capped: analysis.candidatePairsCapped,
      provider_summary_rows_available: providerFamilies.size,
      provider_summary_rows_emitted: Math.min(
        providerFamilies.size,
        MAX_THRESHOLD_SWEEP_PROVIDER_ROWS
      ),
      provider_summary_rows_truncated: providerFamilies.size > MAX_THRESHOLD_SWEEP_PROVIDER_ROWS,
      interpretation_note: note,
    });

    for (const provider of [...providerFamilies.values()].sort((left, right) =>
      left.provider.localeCompare(right.provider)
    )) {
      const familyCitationRates = provider.families
        .map((family) =>
          family.observations > 0
            ? (family.observationsWithCitations / family.observations) * 100
            : null
        )
        .filter((value): value is number => value !== null);
      const familyOwnedLowerRates = provider.families
        .map((family) =>
          family.promptGroups > 0 ? (family.ownedPromptPositive / family.promptGroups) * 100 : null
        )
        .filter((value): value is number => value !== null);
      const familyOwnedUpperRates = provider.families
        .map((family) =>
          family.promptGroups > 0
            ? ((family.ownedPromptPositive + family.ownedPromptUnknown) / family.promptGroups) * 100
            : null
        )
        .filter((value): value is number => value !== null);
      const familyCitationRateFractions = provider.families
        .map((family) =>
          family.observations > 0 ? family.observationsWithCitations / family.observations : null
        )
        .filter((value): value is number => value !== null);
      const familyOwnedLowerRateFractions = provider.families
        .map((family) =>
          family.promptGroups > 0 ? family.ownedPromptPositive / family.promptGroups : null
        )
        .filter((value): value is number => value !== null);
      const familyOwnedUpperRateFractions = provider.families
        .map((family) =>
          family.promptGroups > 0
            ? (family.ownedPromptPositive + family.ownedPromptUnknown) / family.promptGroups
            : null
        )
        .filter((value): value is number => value !== null);
      const eventCategoryHhiRates = provider.families
        .map((family) => family.eventCategoryHhi)
        .filter((value): value is number => value !== null);
      const eventCategoryMappedShareRates = provider.families
        .map((family) =>
          family.eventCategoryMappedSharePercent === null
            ? null
            : family.eventCategoryMappedSharePercent / 100
        )
        .filter((value): value is number => value !== null);
      const rankCategoryHhiRates = provider.families
        .map((family) => family.rankCategoryHhi)
        .filter((value): value is number => value !== null);
      const rankCategoryMappedShareRates = provider.families
        .map((family) =>
          family.rankCategoryMappedSharePercent === null
            ? null
            : family.rankCategoryMappedSharePercent / 100
        )
        .filter((value): value is number => value !== null);
      const eventCategoryDetailComplete = provider.families.every(
        (family) => family.eventSourceDetailComplete
      );
      const rankCategoryDetailComplete = provider.families.every(
        (family) => family.rankSourceDetailComplete
      );
      const unknownOwnedPromptGroups = provider.families.reduce(
        (sum, family) => sum + family.ownedPromptUnknown,
        0
      );
      const ownedMetadataComplete = provider.families.every(
        (family) => family.ownedMetadataComplete
      );
      const providerRow: Record<string, unknown> = {
        row_type: 'threshold-provider',
        cosine_threshold: Number(threshold.toFixed(4)),
        provider: provider.provider,
        retained_provider_prompt_groups: provider.families.reduce(
          (sum, family) => sum + family.promptGroups,
          0
        ),
        provider_supported_families: provider.families.length,
        family_balanced_citation_coverage_percent:
          familyCitationRates.length > 0
            ? Number(
                (
                  familyCitationRates.reduce((sum, value) => sum + value, 0) /
                  familyCitationRates.length
                ).toFixed(4)
              )
            : null,
        family_balanced_event_mapped_category_hhi:
          categoryMappings.length > 0 && eventCategoryHhiRates.length > 0
            ? Number(
                (
                  eventCategoryHhiRates.reduce((sum, value) => sum + value, 0) /
                  eventCategoryHhiRates.length
                ).toFixed(6)
              )
            : null,
        family_balanced_event_mapped_category_eligible_families:
          categoryMappings.length > 0 ? eventCategoryHhiRates.length : null,
        family_balanced_event_mapped_category_weight_share_percent:
          categoryMappings.length > 0 && eventCategoryMappedShareRates.length > 0
            ? Number(
                (
                  (eventCategoryMappedShareRates.reduce((sum, value) => sum + value, 0) /
                    eventCategoryMappedShareRates.length) *
                  100
                ).toFixed(4)
              )
            : null,
        event_mapped_category_source_detail_complete:
          categoryMappings.length > 0 ? eventCategoryDetailComplete : null,
        family_balanced_rank_mapped_category_hhi:
          categoryMappings.length > 0 && rankCategoryHhiRates.length > 0
            ? Number(
                (
                  rankCategoryHhiRates.reduce((sum, value) => sum + value, 0) /
                  rankCategoryHhiRates.length
                ).toFixed(6)
              )
            : null,
        family_balanced_rank_mapped_category_eligible_families:
          categoryMappings.length > 0 ? rankCategoryHhiRates.length : null,
        family_balanced_rank_mapped_category_weight_share_percent:
          categoryMappings.length > 0 && rankCategoryMappedShareRates.length > 0
            ? Number(
                (
                  (rankCategoryMappedShareRates.reduce((sum, value) => sum + value, 0) /
                    rankCategoryMappedShareRates.length) *
                  100
                ).toFixed(4)
              )
            : null,
        rank_mapped_category_source_detail_complete:
          categoryMappings.length > 0 ? rankCategoryDetailComplete : null,
        family_balanced_owned_prompt_reach_lower_bound_percent:
          report.ownedDomains.length > 0 &&
          ownedMetadataComplete &&
          familyOwnedLowerRates.length > 0
            ? Number(
                (
                  familyOwnedLowerRates.reduce((sum, value) => sum + value, 0) /
                  familyOwnedLowerRates.length
                ).toFixed(4)
              )
            : null,
        family_balanced_owned_prompt_reach_upper_bound_percent:
          report.ownedDomains.length > 0 &&
          ownedMetadataComplete &&
          familyOwnedUpperRates.length > 0
            ? Number(
                (
                  familyOwnedUpperRates.reduce((sum, value) => sum + value, 0) /
                  familyOwnedUpperRates.length
                ).toFixed(4)
              )
            : null,
        unknown_owned_prompt_groups:
          report.ownedDomains.length > 0 ? unknownOwnedPromptGroups : null,
        owned_reach_metadata_complete:
          report.ownedDomains.length > 0 ? ownedMetadataComplete : null,
        prompt_catalog_truncated: analysis.promptCatalogTruncated,
        candidate_pairs_capped: analysis.candidatePairsCapped,
        interpretation_note: note,
      };
      providerRows.push(providerRow);
      providerBootstrapInputs.push({
        row: providerRow,
        provider: provider.provider,
        threshold,
        citationRates: familyCitationRateFractions,
        ownedLowerRates: familyOwnedLowerRateFractions,
        ownedUpperRates: familyOwnedUpperRateFractions,
        eventCategoryHhiRates,
        eventCategoryMappedShareRates,
        rankCategoryHhiRates,
        rankCategoryMappedShareRates,
        eventCategoryDetailComplete,
        rankCategoryDetailComplete,
        ownedMetadataComplete,
      });
    }
  }

  const providerRowsEmitted = providerRows.slice(0, MAX_THRESHOLD_SWEEP_PROVIDER_ROWS);
  const outputTruncated = providerRows.length > providerRowsEmitted.length;
  const emittedProviderRows = new Set(providerRowsEmitted);
  const emittedBootstrapInputs = providerBootstrapInputs.filter((input) =>
    emittedProviderRows.has(input.row)
  );
  const graphComplete = !analysis.promptCatalogTruncated && !analysis.candidatePairsCapped;
  const bootstrapSupport = graphComplete
    ? emittedBootstrapInputs.reduce(
        (sum, input) =>
          sum +
          input.citationRates.length +
          (categoryMappings.length > 0 && input.eventCategoryDetailComplete
            ? input.eventCategoryHhiRates.length + input.eventCategoryMappedShareRates.length
            : 0) +
          (categoryMappings.length > 0 && input.rankCategoryDetailComplete
            ? input.rankCategoryHhiRates.length + input.rankCategoryMappedShareRates.length
            : 0) +
          (report.ownedDomains.length > 0 && input.ownedMetadataComplete
            ? input.ownedLowerRates.length + input.ownedUpperRates.length
            : 0),
        0
      )
    : 0;
  const bootstrapIterations =
    bootstrapSupport > 0
      ? Math.min(
          FAMILY_BOOTSTRAP_ITERATIONS,
          Math.floor(MAX_FAMILY_BOOTSTRAP_DRAWS / bootstrapSupport)
        )
      : 0;
  const usableBootstrapIterations =
    bootstrapIterations >= MIN_FAMILY_BOOTSTRAP_ITERATIONS ? bootstrapIterations : 0;
  for (const row of summaryRows) row.family_bootstrap_iterations = usableBootstrapIterations;
  for (const row of providerRowsEmitted)
    row.family_bootstrap_iterations = usableBootstrapIterations;
  for (const input of emittedBootstrapInputs) {
    const insufficientFamilies = input.citationRates.length < 2;
    const citationState = !graphComplete
      ? 'prompt-or-candidate-catalog-incomplete'
      : insufficientFamilies
        ? 'insufficient-lexical-families'
        : usableBootstrapIterations < MIN_FAMILY_BOOTSTRAP_ITERATIONS
          ? 'budget-limited'
          : 'available';
    input.row.family_balanced_citation_coverage_bootstrap_ci95_state = citationState;
    if (citationState === 'available') {
      const interval = bootstrapFamilyMeanInterval(
        input.citationRates,
        `${normalizedPrompt(input.provider)}\u0000${input.threshold}\u0000family-threshold-sweep-citation`,
        usableBootstrapIterations
      );
      input.row.family_balanced_citation_coverage_bootstrap_ci95_lower_percent =
        interval?.lower ?? null;
      input.row.family_balanced_citation_coverage_bootstrap_ci95_upper_percent =
        interval?.upper ?? null;
    } else {
      input.row.family_balanced_citation_coverage_bootstrap_ci95_lower_percent = null;
      input.row.family_balanced_citation_coverage_bootstrap_ci95_upper_percent = null;
    }

    if (categoryMappings.length > 0) {
      const eventCategoryHhiState = !graphComplete
        ? 'prompt-or-candidate-catalog-incomplete'
        : !input.eventCategoryDetailComplete
          ? 'event-source-detail-incomplete'
          : input.eventCategoryHhiRates.length < 2
            ? 'insufficient-mapped-category-families'
            : usableBootstrapIterations < MIN_FAMILY_BOOTSTRAP_ITERATIONS
              ? 'budget-limited'
              : 'available';
      input.row.family_balanced_event_mapped_category_hhi_bootstrap_ci95_state =
        eventCategoryHhiState;
      if (eventCategoryHhiState === 'available') {
        const interval = bootstrapFamilyMeanInterval(
          input.eventCategoryHhiRates,
          `${normalizedPrompt(input.provider)}\u0000${input.threshold}\u0000family-threshold-sweep-event-category`,
          usableBootstrapIterations
        );
        input.row.family_balanced_event_mapped_category_hhi_bootstrap_ci95_lower =
          interval?.lower ?? null;
        input.row.family_balanced_event_mapped_category_hhi_bootstrap_ci95_upper =
          interval?.upper ?? null;
      } else {
        input.row.family_balanced_event_mapped_category_hhi_bootstrap_ci95_lower = null;
        input.row.family_balanced_event_mapped_category_hhi_bootstrap_ci95_upper = null;
      }
      const eventCategoryCoverageState = !graphComplete
        ? 'prompt-or-candidate-catalog-incomplete'
        : !input.eventCategoryDetailComplete
          ? 'event-source-detail-incomplete'
          : input.eventCategoryMappedShareRates.length < 2
            ? 'insufficient-mapped-category-families'
            : usableBootstrapIterations < MIN_FAMILY_BOOTSTRAP_ITERATIONS
              ? 'budget-limited'
              : 'available';
      input.row.family_balanced_event_mapped_category_weight_share_bootstrap_ci95_state =
        eventCategoryCoverageState;
      if (eventCategoryCoverageState === 'available') {
        const interval = bootstrapFamilyMeanInterval(
          input.eventCategoryMappedShareRates,
          `${normalizedPrompt(input.provider)}\u0000${input.threshold}\u0000family-threshold-sweep-event-category-coverage`,
          usableBootstrapIterations
        );
        input.row.family_balanced_event_mapped_category_weight_share_bootstrap_ci95_lower_percent =
          interval?.lower === null || interval?.lower === undefined
            ? null
            : Number((interval.lower * 100).toFixed(4));
        input.row.family_balanced_event_mapped_category_weight_share_bootstrap_ci95_upper_percent =
          interval?.upper === null || interval?.upper === undefined
            ? null
            : Number((interval.upper * 100).toFixed(4));
      } else {
        input.row.family_balanced_event_mapped_category_weight_share_bootstrap_ci95_lower_percent =
          null;
        input.row.family_balanced_event_mapped_category_weight_share_bootstrap_ci95_upper_percent =
          null;
      }
      const rankCategoryHhiState = !graphComplete
        ? 'prompt-or-candidate-catalog-incomplete'
        : !input.rankCategoryDetailComplete
          ? 'rank-source-detail-incomplete'
          : input.rankCategoryHhiRates.length < 2
            ? 'insufficient-mapped-category-families'
            : usableBootstrapIterations < MIN_FAMILY_BOOTSTRAP_ITERATIONS
              ? 'budget-limited'
              : 'available';
      input.row.family_balanced_rank_mapped_category_hhi_bootstrap_ci95_state =
        rankCategoryHhiState;
      if (rankCategoryHhiState === 'available') {
        const interval = bootstrapFamilyMeanInterval(
          input.rankCategoryHhiRates,
          `${normalizedPrompt(input.provider)}\u0000${input.threshold}\u0000family-threshold-sweep-rank-category`,
          usableBootstrapIterations
        );
        input.row.family_balanced_rank_mapped_category_hhi_bootstrap_ci95_lower =
          interval?.lower ?? null;
        input.row.family_balanced_rank_mapped_category_hhi_bootstrap_ci95_upper =
          interval?.upper ?? null;
      } else {
        input.row.family_balanced_rank_mapped_category_hhi_bootstrap_ci95_lower = null;
        input.row.family_balanced_rank_mapped_category_hhi_bootstrap_ci95_upper = null;
      }
      const rankCategoryCoverageState = !graphComplete
        ? 'prompt-or-candidate-catalog-incomplete'
        : !input.rankCategoryDetailComplete
          ? 'rank-source-detail-incomplete'
          : input.rankCategoryMappedShareRates.length < 2
            ? 'insufficient-mapped-category-families'
            : usableBootstrapIterations < MIN_FAMILY_BOOTSTRAP_ITERATIONS
              ? 'budget-limited'
              : 'available';
      input.row.family_balanced_rank_mapped_category_weight_share_bootstrap_ci95_state =
        rankCategoryCoverageState;
      if (rankCategoryCoverageState === 'available') {
        const interval = bootstrapFamilyMeanInterval(
          input.rankCategoryMappedShareRates,
          `${normalizedPrompt(input.provider)}\u0000${input.threshold}\u0000family-threshold-sweep-rank-category-coverage`,
          usableBootstrapIterations
        );
        input.row.family_balanced_rank_mapped_category_weight_share_bootstrap_ci95_lower_percent =
          interval?.lower === null || interval?.lower === undefined
            ? null
            : Number((interval.lower * 100).toFixed(4));
        input.row.family_balanced_rank_mapped_category_weight_share_bootstrap_ci95_upper_percent =
          interval?.upper === null || interval?.upper === undefined
            ? null
            : Number((interval.upper * 100).toFixed(4));
      } else {
        input.row.family_balanced_rank_mapped_category_weight_share_bootstrap_ci95_lower_percent =
          null;
        input.row.family_balanced_rank_mapped_category_weight_share_bootstrap_ci95_upper_percent =
          null;
      }
    }

    if (report.ownedDomains.length > 0) {
      const ownedState = !graphComplete
        ? 'prompt-or-candidate-catalog-incomplete'
        : !input.ownedMetadataComplete
          ? 'owned-reach-metadata-incomplete'
          : input.ownedLowerRates.length < 2
            ? 'insufficient-lexical-families'
            : usableBootstrapIterations < MIN_FAMILY_BOOTSTRAP_ITERATIONS
              ? 'budget-limited'
              : 'available';
      input.row.family_balanced_owned_prompt_reach_bootstrap_ci95_state = ownedState;
      if (ownedState === 'available') {
        const lowerInterval = bootstrapFamilyMeanInterval(
          input.ownedLowerRates,
          `${normalizedPrompt(input.provider)}\u0000${input.threshold}\u0000family-threshold-sweep-owned-lower`,
          usableBootstrapIterations
        );
        const upperInterval = bootstrapFamilyMeanInterval(
          input.ownedUpperRates,
          `${normalizedPrompt(input.provider)}\u0000${input.threshold}\u0000family-threshold-sweep-owned-upper`,
          usableBootstrapIterations
        );
        input.row.family_balanced_owned_prompt_reach_lower_bound_bootstrap_ci95_lower_percent =
          lowerInterval?.lower ?? null;
        input.row.family_balanced_owned_prompt_reach_lower_bound_bootstrap_ci95_upper_percent =
          lowerInterval?.upper ?? null;
        input.row.family_balanced_owned_prompt_reach_upper_bound_bootstrap_ci95_lower_percent =
          upperInterval?.lower ?? null;
        input.row.family_balanced_owned_prompt_reach_upper_bound_bootstrap_ci95_upper_percent =
          upperInterval?.upper ?? null;
      } else {
        input.row.family_balanced_owned_prompt_reach_lower_bound_bootstrap_ci95_lower_percent =
          null;
        input.row.family_balanced_owned_prompt_reach_lower_bound_bootstrap_ci95_upper_percent =
          null;
        input.row.family_balanced_owned_prompt_reach_upper_bound_bootstrap_ci95_lower_percent =
          null;
        input.row.family_balanced_owned_prompt_reach_upper_bound_bootstrap_ci95_upper_percent =
          null;
      }
    }
  }
  const emittedProvidersByThreshold = new Map<number, number>();
  for (const row of providerRowsEmitted) {
    const threshold = Number(row.cosine_threshold);
    emittedProvidersByThreshold.set(
      threshold,
      (emittedProvidersByThreshold.get(threshold) ?? 0) + 1
    );
  }
  const availableProvidersByThreshold = new Map<number, number>();
  for (const row of providerRows) {
    const threshold = Number(row.cosine_threshold);
    availableProvidersByThreshold.set(
      threshold,
      (availableProvidersByThreshold.get(threshold) ?? 0) + 1
    );
  }
  for (const row of summaryRows) {
    const threshold = Number(row.cosine_threshold);
    const available = availableProvidersByThreshold.get(threshold) ?? 0;
    const emitted = emittedProvidersByThreshold.get(threshold) ?? 0;
    row.provider_summary_rows_available = available;
    row.provider_summary_rows_emitted = emitted;
    row.provider_summary_rows_truncated = available > emitted;
  }
  for (const row of summaryRows) row.output_rows_truncated = outputTruncated;
  for (const row of providerRowsEmitted) row.output_rows_truncated = outputTruncated;
  const headers = [
    'row_type',
    'cosine_threshold',
    'source_category_mappings_configured',
    'provider',
    'retained_prompt_groups',
    'prompt_families',
    'non_singleton_families',
    'prompt_groups_in_non_singleton_families',
    'prompt_share_in_non_singleton_families_percent',
    'largest_family_prompt_groups',
    'articulation_prompt_groups',
    'articulation_prompt_share_percent',
    'families_with_articulation_prompts',
    'retained_provider_prompt_groups',
    'provider_supported_families',
    'family_balanced_citation_coverage_percent',
    'family_balanced_citation_coverage_bootstrap_ci95_lower_percent',
    'family_balanced_citation_coverage_bootstrap_ci95_upper_percent',
    'family_balanced_citation_coverage_bootstrap_ci95_state',
    'family_balanced_event_mapped_category_hhi',
    'family_balanced_event_mapped_category_eligible_families',
    'family_balanced_event_mapped_category_hhi_bootstrap_ci95_lower',
    'family_balanced_event_mapped_category_hhi_bootstrap_ci95_upper',
    'family_balanced_event_mapped_category_hhi_bootstrap_ci95_state',
    'family_balanced_event_mapped_category_weight_share_percent',
    'family_balanced_event_mapped_category_weight_share_bootstrap_ci95_lower_percent',
    'family_balanced_event_mapped_category_weight_share_bootstrap_ci95_upper_percent',
    'family_balanced_event_mapped_category_weight_share_bootstrap_ci95_state',
    'event_mapped_category_source_detail_complete',
    'family_balanced_rank_mapped_category_hhi',
    'family_balanced_rank_mapped_category_eligible_families',
    'family_balanced_rank_mapped_category_hhi_bootstrap_ci95_lower',
    'family_balanced_rank_mapped_category_hhi_bootstrap_ci95_upper',
    'family_balanced_rank_mapped_category_hhi_bootstrap_ci95_state',
    'family_balanced_rank_mapped_category_weight_share_percent',
    'family_balanced_rank_mapped_category_weight_share_bootstrap_ci95_lower_percent',
    'family_balanced_rank_mapped_category_weight_share_bootstrap_ci95_upper_percent',
    'family_balanced_rank_mapped_category_weight_share_bootstrap_ci95_state',
    'rank_mapped_category_source_detail_complete',
    'family_balanced_owned_prompt_reach_lower_bound_percent',
    'family_balanced_owned_prompt_reach_upper_bound_percent',
    'family_balanced_owned_prompt_reach_lower_bound_bootstrap_ci95_lower_percent',
    'family_balanced_owned_prompt_reach_lower_bound_bootstrap_ci95_upper_percent',
    'family_balanced_owned_prompt_reach_upper_bound_bootstrap_ci95_lower_percent',
    'family_balanced_owned_prompt_reach_upper_bound_bootstrap_ci95_upper_percent',
    'family_balanced_owned_prompt_reach_bootstrap_ci95_state',
    'unknown_owned_prompt_groups',
    'owned_reach_metadata_complete',
    'candidate_pairs_considered',
    'high_frequency_posting_cutoff',
    'prompt_catalog_truncated',
    'candidate_pairs_capped',
    'provider_summary_rows_available',
    'provider_summary_rows_emitted',
    'provider_summary_rows_truncated',
    'family_bootstrap_iterations',
    'output_rows_truncated',
    'interpretation_note',
  ];
  const allRows = [...summaryRows, ...providerRowsEmitted];
  return {
    headers,
    rows: allRows,
    thresholds,
    candidateAnalysis: analysis,
    outputTruncated:
      outputTruncated || summaryRows.some((row) => row.provider_summary_rows_truncated === true),
  };
}

/** Render family topology and provider reach sensitivity as an offline SVG dashboard. */
export function renderAiAnswerCitationPromptFamilyThresholdSweepHtml(
  report: AiAnswerCitationObservationReport,
  selectedThreshold = 0.85,
  categoryMappings: Array<{ domain: string; label: string; labelKey: string }> = []
): string {
  const table = buildPromptFamilyThresholdSweepTable(report, selectedThreshold, categoryMappings);
  const summaryRows = table.rows.filter((row) => row.row_type === 'threshold-summary');
  const providerRows = table.rows.filter((row) => row.row_type === 'threshold-provider');
  const providers = [...new Set(providerRows.map((row) => String(row.provider ?? '')))]
    .filter(Boolean)
    .sort();
  const providerRowsPerThreshold = Math.max(
    1,
    Math.floor(MAX_FAMILY_THRESHOLD_SWEEP_HTML_ROWS / table.thresholds.length)
  );
  const hasSourceCategories = categoryMappings.length > 0;
  const meanProviderMetric = (threshold: number, key: string): number | null => {
    const values = providerRows
      .filter((row) => Number(row.cosine_threshold) === threshold)
      .map((row) => row[key])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };
  const intervalText = (
    row: Record<string, unknown>,
    lowerKey: string,
    upperKey: string,
    stateKey: string
  ): string => {
    const lower = row[lowerKey];
    const upper = row[upperKey];
    if (typeof lower === 'number' && typeof upper === 'number') {
      return `${lower.toFixed(2)}–${upper.toFixed(2)}%`;
    }
    return `Unavailable (${String(row[stateKey] ?? 'unknown')})`;
  };
  const ownedIntervalText = (row: Record<string, unknown>): string => {
    const values = [
      row.family_balanced_owned_prompt_reach_lower_bound_bootstrap_ci95_lower_percent,
      row.family_balanced_owned_prompt_reach_lower_bound_bootstrap_ci95_upper_percent,
      row.family_balanced_owned_prompt_reach_upper_bound_bootstrap_ci95_lower_percent,
      row.family_balanced_owned_prompt_reach_upper_bound_bootstrap_ci95_upper_percent,
    ];
    if (
      values.every((value): value is number => typeof value === 'number' && Number.isFinite(value))
    ) {
      return `Lower endpoint: ${values[0]!.toFixed(2)}–${values[1]!.toFixed(2)}%; upper endpoint: ${values[2]!.toFixed(2)}–${values[3]!.toFixed(2)}%`;
    }
    return `Unavailable (${String(row.family_balanced_owned_prompt_reach_bootstrap_ci95_state ?? 'unknown')})`;
  };
  const summaryByThreshold = new Map(summaryRows.map((row) => [Number(row.cosine_threshold), row]));
  const hasOwnedDomains = report.ownedDomains.length > 0;
  const seriesDefinitions = [
    {
      key: 'prompt_share_in_non_singleton_families_percent',
      label: 'Prompt groups in non-singleton families',
      color: '#20574c',
      source: 'summary' as const,
    },
    {
      key: 'largest_family_share_percent',
      label: 'Largest family share of prompt groups',
      color: '#bd4b32',
      source: 'summary' as const,
    },
    {
      key: 'articulation_prompt_share_percent',
      label: 'Prompt groups that are articulation points',
      color: '#b77924',
      source: 'summary' as const,
    },
    {
      key: 'family_balanced_citation_coverage_percent',
      label: 'Provider mean family-balanced citation coverage',
      color: '#245fe5',
      source: 'provider' as const,
    },
    ...(hasOwnedDomains
      ? [
          {
            key: 'family_balanced_owned_prompt_reach_lower_bound_percent',
            label: 'Mean owned reach lower bound',
            color: '#9a6b12',
            source: 'provider' as const,
          },
          {
            key: 'family_balanced_owned_prompt_reach_upper_bound_percent',
            label: 'Mean owned reach upper bound',
            color: '#8b5cf6',
            source: 'provider' as const,
          },
        ]
      : []),
    ...(hasSourceCategories
      ? [
          {
            key: 'family_balanced_event_mapped_category_hhi',
            label: 'Event mapped-category HHI × 100',
            color: '#0f766e',
            source: 'provider' as const,
          },
          {
            key: 'family_balanced_event_mapped_category_weight_share_percent',
            label: 'Event mapped citation-weight share',
            color: '#06b6d4',
            source: 'provider' as const,
          },
          {
            key: 'family_balanced_rank_mapped_category_hhi',
            label: 'Rank mapped-category HHI × 100',
            color: '#7c3aed',
            source: 'provider' as const,
          },
          {
            key: 'family_balanced_rank_mapped_category_weight_share_percent',
            label: 'Rank mapped citation-weight share',
            color: '#c026d3',
            source: 'provider' as const,
          },
        ]
      : []),
  ];
  const seriesValue = (
    threshold: number,
    key: string,
    source: 'summary' | 'provider'
  ): number | null => {
    if (source === 'provider') {
      const value = meanProviderMetric(threshold, key);
      return value !== null && key.endsWith('_mapped_category_hhi') ? value * 100 : value;
    }
    const summary = summaryByThreshold.get(threshold);
    if (!summary) return null;
    if (key === 'largest_family_share_percent') {
      const promptGroups = summary.retained_prompt_groups;
      return typeof promptGroups === 'number' &&
        promptGroups > 0 &&
        typeof summary.largest_family_prompt_groups === 'number'
        ? (summary.largest_family_prompt_groups / promptGroups) * 100
        : null;
    }
    const value = summary[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  };
  const width = 980;
  const height = 360;
  const left = 68;
  const right = 28;
  const top = 28;
  const bottom = 60;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const x = (index: number): number =>
    left + (table.thresholds.length > 1 ? index / (table.thresholds.length - 1) : 0.5) * chartWidth;
  const y = (value: number): number =>
    top + chartHeight - (Math.max(0, Math.min(100, value)) / 100) * chartHeight;
  const grid = [0, 25, 50, 75, 100]
    .map(
      (value) =>
        `<g><line x1="${left}" y1="${y(value)}" x2="${width - right}" y2="${y(value)}" stroke="currentColor" opacity=".14"/><text x="${left - 10}" y="${y(value) + 4}" text-anchor="end">${value}%</text></g>`
    )
    .join('');
  const xLabels = table.thresholds
    .map(
      (threshold, index) =>
        `<text x="${x(index)}" y="${height - 32}" text-anchor="middle">${threshold.toFixed(2)}</text>`
    )
    .join('');
  const chartSeries = seriesDefinitions
    .map(({ key, label, color, source }) => {
      const points = table.thresholds.map((threshold, index) => {
        const value = seriesValue(threshold, key, source);
        return value === null ? null : { x: x(index), y: y(value), value };
      });
      const segments = points
        .slice(1)
        .map((point, index) => {
          const previous = points[index];
          return point && previous
            ? `<line x1="${previous.x}" y1="${previous.y}" x2="${point.x}" y2="${point.y}" stroke="${color}" stroke-width="3"/>`
            : '';
        })
        .join('');
      const markers = points
        .map((point, index) =>
          point
            ? `<circle cx="${point.x}" cy="${point.y}" r="4" fill="${color}"><title>${escapeFamilyHtml(label)} at ${table.thresholds[index]!.toFixed(2)}: ${point.value.toFixed(2)}%</title></circle>`
            : ''
        )
        .join('');
      return `${segments}${markers}`;
    })
    .join('');
  const legend = seriesDefinitions
    .map(
      ({ label, color }) =>
        `<span><i style="background:${color}"></i>${escapeFamilyHtml(label)}</span>`
    )
    .join('');
  const providerSections = table.thresholds
    .map((threshold) => {
      const rows = providerRows
        .filter((row) => Number(row.cosine_threshold) === threshold)
        .sort(
          (leftRow, rightRow) =>
            Number(leftRow.family_balanced_citation_coverage_percent ?? 101) -
              Number(rightRow.family_balanced_citation_coverage_percent ?? 101) ||
            String(leftRow.provider).localeCompare(String(rightRow.provider))
        )
        .slice(0, providerRowsPerThreshold);
      const summary = summaryByThreshold.get(threshold);
      const body = rows
        .map((row) => {
          const categoryCells = hasSourceCategories
            ? `<td>HHI ${renderFamilyHtmlValue(row.family_balanced_event_mapped_category_hhi)} · n=${renderFamilyHtmlValue(row.family_balanced_event_mapped_category_eligible_families)}<br><span class="muted">95% CI ${renderFamilyHtmlValue(row.family_balanced_event_mapped_category_hhi_bootstrap_ci95_lower)}–${renderFamilyHtmlValue(row.family_balanced_event_mapped_category_hhi_bootstrap_ci95_upper)} · ${escapeFamilyHtml(String(row.family_balanced_event_mapped_category_hhi_bootstrap_ci95_state ?? 'unavailable'))}</span><br>Mapped weight ${renderFamilyHtmlValue(row.family_balanced_event_mapped_category_weight_share_percent)}%<br><span class="muted">95% CI ${renderFamilyHtmlValue(row.family_balanced_event_mapped_category_weight_share_bootstrap_ci95_lower_percent)}–${renderFamilyHtmlValue(row.family_balanced_event_mapped_category_weight_share_bootstrap_ci95_upper_percent)}%</span></td><td>HHI ${renderFamilyHtmlValue(row.family_balanced_rank_mapped_category_hhi)} · n=${renderFamilyHtmlValue(row.family_balanced_rank_mapped_category_eligible_families)}<br><span class="muted">95% CI ${renderFamilyHtmlValue(row.family_balanced_rank_mapped_category_hhi_bootstrap_ci95_lower)}–${renderFamilyHtmlValue(row.family_balanced_rank_mapped_category_hhi_bootstrap_ci95_upper)} · ${escapeFamilyHtml(String(row.family_balanced_rank_mapped_category_hhi_bootstrap_ci95_state ?? 'unavailable'))}</span><br>Mapped weight ${renderFamilyHtmlValue(row.family_balanced_rank_mapped_category_weight_share_percent)}%<br><span class="muted">95% CI ${renderFamilyHtmlValue(row.family_balanced_rank_mapped_category_weight_share_bootstrap_ci95_lower_percent)}–${renderFamilyHtmlValue(row.family_balanced_rank_mapped_category_weight_share_bootstrap_ci95_upper_percent)}%</span></td>`
            : '';
          return `<tr><td>${escapeFamilyHtml(String(row.provider ?? ''))}</td><td>${renderFamilyHtmlValue(row.retained_provider_prompt_groups)}</td><td>${renderFamilyHtmlValue(row.provider_supported_families)}</td><td>${renderFamilyHtmlValue(row.family_balanced_citation_coverage_percent)}%</td><td>${escapeFamilyHtml(intervalText(row, 'family_balanced_citation_coverage_bootstrap_ci95_lower_percent', 'family_balanced_citation_coverage_bootstrap_ci95_upper_percent', 'family_balanced_citation_coverage_bootstrap_ci95_state'))}</td>${categoryCells}${hasOwnedDomains ? `<td>${renderFamilyHtmlValue(row.family_balanced_owned_prompt_reach_lower_bound_percent)}% – ${renderFamilyHtmlValue(row.family_balanced_owned_prompt_reach_upper_bound_percent)}%</td><td>${escapeFamilyHtml(ownedIntervalText(row))}</td><td>${renderFamilyHtmlValue(row.unknown_owned_prompt_groups)}</td><td>${renderFamilyHtmlValue(row.owned_reach_metadata_complete)}</td>` : ''}<td>${renderFamilyHtmlValue(row.prompt_catalog_truncated)}</td><td>${renderFamilyHtmlValue(row.candidate_pairs_capped)}</td></tr>`;
        })
        .join('');
      const capped =
        summary?.provider_summary_rows_truncated === true ||
        rows.length < Number(summary?.provider_summary_rows_emitted ?? 0);
      const ownedHeaders = hasOwnedDomains
        ? '<th>Family-balanced owned reach bounds</th><th>Owned reach endpoint 95% family-bootstrap interval</th><th>Unknown owned prompts</th><th>Owned metadata complete</th>'
        : '';
      const categoryHeaders = hasSourceCategories
        ? '<th>Event category HHI / mapped share</th><th>Rank category HHI / mapped share</th>'
        : '';
      return `<details class="threshold-panel"${threshold === selectedThreshold ? ' open' : ''}><summary>Cosine threshold ${threshold.toFixed(2)} · ${renderFamilyHtmlValue(summary?.prompt_families)} families · ${renderFamilyHtmlValue(summary?.prompt_share_in_non_singleton_families_percent)}% prompts in multi-prompt families</summary><div class="table-wrap"><table><thead><tr><th>Provider</th><th>Prompt groups</th><th>Supported families</th><th>Family-balanced citation coverage</th><th>95% family-bootstrap CI</th>${categoryHeaders}${ownedHeaders}<th>Catalog capped</th><th>Graph capped</th></tr></thead><tbody>${body}</tbody></table></div>${capped ? `<p class="muted">Showing ${rows.length} of ${renderFamilyHtmlValue(summary?.provider_summary_rows_emitted)} emitted provider rows; a CSV/provider summary cap applies.</p>` : ''}</details>`;
    })
    .join('');
  const meansText = summaryRows
    .map(
      (row) =>
        `${Number(row.cosine_threshold).toFixed(2)}: ${renderFamilyHtmlValue(row.prompt_families)} families`
    )
    .join(' · ');
  const providerCapNote = table.outputTruncated
    ? '<p class="notice">The provider-summary CSV cap was reached. Provider means use emitted rows only; compare support and truncation flags in the CSV before interpreting differences across cutoffs.</p>'
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prompt-family topology threshold sensitivity</title><style>:root{color-scheme:light;--paper:#f2eee4;--ink:#202722;--muted:#5c665f;--rule:#c8cfc7;--card:#fbfaf6;--pine:#20574c;--rust:#bd4b32}*{box-sizing:border-box}body{margin:0 auto;padding:1.2rem;max-width:1500px;background:linear-gradient(90deg,rgba(32,87,76,.035) 1px,transparent 1px),linear-gradient(rgba(32,87,76,.035) 1px,transparent 1px),var(--paper);background-size:28px 28px;color:var(--ink);font:15px/1.58 "Avenir Next",Avenir,"Trebuchet MS",sans-serif}header,.panel,.threshold-panel{background:var(--card);border:1px solid var(--rule);border-radius:3px;padding:1rem 1.2rem;margin:0 0 1rem;box-shadow:0 8px 24px rgba(32,39,34,.05)}header{border-top:4px solid var(--pine)}h1,h2{font-family:Georgia,"Times New Roman",serif;letter-spacing:-.025em}h1{margin:.1rem 0 .35rem;font-size:1.8rem}h2{margin:.1rem 0 .5rem;font-size:1.2rem}.muted{color:var(--muted);font-size:.88em}.chart-wrap{overflow:auto}.chart{display:block;width:100%;min-width:700px;height:auto;color:#526174;background:#f8f6ee;border:1px solid var(--rule);padding:.5rem}.chart text{font:12px ui-monospace,monospace;fill:currentColor}.legend{display:flex;flex-wrap:wrap;gap:.8rem;margin:.7rem 0}.legend span{display:inline-flex;align-items:center;gap:.35rem}.legend i{width:11px;height:11px;border-radius:50%;display:inline-block}.table-wrap{overflow:auto;max-height:65vh;border:1px solid var(--rule);border-radius:3px}table{border-collapse:collapse;width:100%;min-width:850px;font-size:.9rem}th,td{padding:.55rem .65rem;border-bottom:1px solid #e1e3d9;text-align:left;vertical-align:top}th{position:sticky;top:0;background:#e9ece3;z-index:1;color:#273d34;font-size:.78rem;letter-spacing:.04em;text-transform:uppercase}tbody tr:hover{background:#f0f3ea}.threshold-panel summary{cursor:pointer;font-weight:650;color:var(--pine)}code{font:600 .9em ui-monospace,monospace;color:var(--pine)}.notice{padding:.7rem .9rem;border-left:4px solid #b77924;background:#f7efd9}a:focus-visible,button:focus-visible,summary:focus-visible{outline:3px solid var(--rust);outline-offset:3px}</style></head><body><main><header><h1>Prompt-family topology and provider reach sensitivity</h1><p>Connected TF-IDF components change shape as the cosine cutoff changes. The dashboard plots retained-panel topology, bridge-prompt share, and equal-provider family-balanced citation reach; optional category series add mapped event/rank HHI and mapped-weight coverage. Lexical connections remain a wording sensitivity analysis, not semantic equivalence or independent demand.</p><p class="muted">${table.thresholds.length} cutoffs · ${table.candidateAnalysis.candidatePairCount.toLocaleString('en-US')}${table.candidateAnalysis.candidatePairsCapped ? '+' : ''} candidate pairs · high-frequency posting cutoff ${table.candidateAnalysis.highFrequencyCutoff} · ${table.candidateAnalysis.candidatePairsCapped ? 'candidate cap reached' : 'candidate cap not reached'} · ${table.candidateAnalysis.promptCatalogTruncated ? 'prompt catalog capped' : 'prompt catalog retained'} · ${providers.length} providers · owned domains ${hasOwnedDomains ? 'configured' : 'not configured'} · ${table.outputTruncated ? 'provider summary rows capped' : 'provider summaries retained'}</p></header><section class="panel"><h2>Topology and family-balanced coverage</h2><p class="muted">Topology series use the complete retained prompt catalog. Provider coverage means average provider-specific family rates, with each family weighted equally. Detail tables include percentile bootstrap intervals over lexical families, conditional on each cutoff; caps or too few families suppress the intervals.</p><div class="legend">${legend}</div><div class="chart-wrap"><svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="family-sweep-chart-title family-sweep-chart-desc"><title id="family-sweep-chart-title">Prompt-family topology and citation coverage across cosine thresholds</title><desc id="family-sweep-chart-desc">Lines show multi-prompt and largest-family shares, articulation-prompt share, and equal-provider family-balanced citation and owned reach.</desc>${grid}${chartSeries}${xLabels}<text x="${left + chartWidth / 2}" y="${height - 10}" text-anchor="middle">TF-IDF cosine threshold</text></svg></div><div class="table-wrap"><table><thead><tr><th>Cutoff</th><th>Prompt families</th><th>Multi-prompt family count</th><th>Prompt share in multi-prompt families</th><th>Largest family</th><th>Articulation prompts / families</th><th>Prompt catalog</th><th>Provider summaries emitted</th><th>Family-bootstrap draws</th></tr></thead><tbody>${summaryRows.map((row) => `<tr><td>${Number(row.cosine_threshold).toFixed(2)}</td><td>${renderFamilyHtmlValue(row.prompt_families)}</td><td>${renderFamilyHtmlValue(row.non_singleton_families)}</td><td>${renderFamilyHtmlValue(row.prompt_share_in_non_singleton_families_percent)}%</td><td>${renderFamilyHtmlValue(row.largest_family_prompt_groups)} / ${renderFamilyHtmlValue(row.retained_prompt_groups)}</td><td>${renderFamilyHtmlValue(row.articulation_prompt_groups)} (${renderFamilyHtmlValue(row.articulation_prompt_share_percent)}%) · ${renderFamilyHtmlValue(row.families_with_articulation_prompts)} families</td><td>${renderFamilyHtmlValue(row.prompt_catalog_truncated)}</td><td>${renderFamilyHtmlValue(row.provider_summary_rows_emitted)}${row.provider_summary_rows_truncated ? '+' : ''}</td><td>${renderFamilyHtmlValue(row.family_bootstrap_iterations)}</td></tr>`).join('')}</tbody></table></div><p class="muted">Family counts by cutoff: ${meansText}</p>${providerCapNote}</section><section class="panel"><h2>Provider detail by cutoff</h2><p class="muted">Rows are ordered from lower family-balanced citation coverage upward. Owned-reach lower/upper bounds are descriptive and can widen when captured citation lists are incomplete. Intervals resample whole lexical families rather than prompt members.</p>${providerSections}</section><footer class="muted">Candidate edges can be omitted by the posting/candidate caps. Review provider and owned metadata flags before comparing cutoffs; these summaries are descriptive bootstrap intervals, not causal estimates.</footer></main></body></html>\n`;
}

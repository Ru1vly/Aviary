const MAX_NEIGHBOR_VISITS = 50_000;
const MAX_ITERATIONS = 50;
const SCORE_TIE_TOLERANCE = 1e-12;

export interface SourceCommunityEdge {
  left: string;
  right: string;
  weight: number;
}

export interface SourceCommunityMetrics {
  communityId: string;
  communitySize: number;
  communityInternalEdgeCount: number;
  communityInternalCooccurrenceWeight: number;
  communityExternalCooccurrenceWeight: number;
  communityInternalCooccurrenceShare: number | null;
  communityModularityContribution: number | null;
  networkWeightedModularity: number | null;
  communityDetectionConverged: boolean;
  communityDetectionIterations: number;
  communityDetectionNeighborVisits: number;
}

export interface SourceCommunityDetection {
  byDomain: Map<string, SourceCommunityMetrics>;
  converged: boolean;
  iterations: number;
  neighborVisits: number;
  neighborVisitBudget: number;
  algorithm: string;
  weightedModularity: number | null;
}

/** Compare two label partitions with the chance-adjusted Rand index. */
export function sourceCommunityAdjustedRandIndex(
  leftLabels: string[],
  rightLabels: string[]
): number | null {
  if (leftLabels.length !== rightLabels.length || leftLabels.length < 2) return null;
  const pairCount = (count: number) => (count * (count - 1)) / 2;
  const leftCounts = new Map<string, number>();
  const rightCounts = new Map<string, number>();
  const jointCounts = new Map<string, number>();
  for (let index = 0; index < leftLabels.length; index += 1) {
    const left = leftLabels[index]!;
    const right = rightLabels[index]!;
    leftCounts.set(left, (leftCounts.get(left) ?? 0) + 1);
    rightCounts.set(right, (rightCounts.get(right) ?? 0) + 1);
    const jointKey = `${left}\u0000${right}`;
    jointCounts.set(jointKey, (jointCounts.get(jointKey) ?? 0) + 1);
  }
  const jointPairs = [...jointCounts.values()].reduce((sum, count) => sum + pairCount(count), 0);
  const leftPairs = [...leftCounts.values()].reduce((sum, count) => sum + pairCount(count), 0);
  const rightPairs = [...rightCounts.values()].reduce((sum, count) => sum + pairCount(count), 0);
  const allPairs = pairCount(leftLabels.length);
  const expected = (leftPairs * rightPairs) / allPairs;
  const maximum = (leftPairs + rightPairs) / 2;
  const denominator = maximum - expected;
  if (Math.abs(denominator) < 1e-12) {
    const samePartition = leftLabels.every((label, index) =>
      leftLabels.every(
        (other, otherIndex) =>
          (label === other) === (rightLabels[index] === rightLabels[otherIndex])
      )
    );
    return samePartition ? 1 : 0;
  }
  return (jointPairs - expected) / denominator;
}

/** Deterministic weighted label propagation over the capped provider co-citation graph. */
export function detectSourceNetworkCommunities(
  domains: string[],
  edges: SourceCommunityEdge[]
): SourceCommunityDetection {
  const domainIndex = new Map(domains.map((domain, index) => [domain, index]));
  const adjacency = Array.from({ length: domains.length }, () => new Map<number, number>());
  for (const edge of edges) {
    const left = domainIndex.get(edge.left);
    const right = domainIndex.get(edge.right);
    if (
      left === undefined ||
      right === undefined ||
      left === right ||
      !Number.isFinite(edge.weight) ||
      edge.weight <= 0
    )
      continue;
    adjacency[left]!.set(right, (adjacency[left]!.get(right) ?? 0) + edge.weight);
    adjacency[right]!.set(left, (adjacency[right]!.get(left) ?? 0) + edge.weight);
  }

  const visitOrder = domains
    .map((_, index) => index)
    .sort((left, right) => domains[left]!.localeCompare(domains[right]!));
  const labels = [...domains];
  let converged = false;
  let iterations = 0;
  let neighborVisits = 0;
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    let changed = false;
    let interrupted = false;
    for (const node of visitOrder) {
      const neighbors = adjacency[node]!;
      if (neighborVisits + neighbors.size > MAX_NEIGHBOR_VISITS) {
        interrupted = true;
        break;
      }
      const scores = new Map<string, number>();
      const orderedNeighbors = [...neighbors].sort((left, right) =>
        domains[left[0]]!.localeCompare(domains[right[0]]!)
      );
      for (const [neighbor, weight] of orderedNeighbors) {
        const label = labels[neighbor]!;
        scores.set(label, (scores.get(label) ?? 0) + weight);
      }
      neighborVisits += neighbors.size;
      const currentLabel = labels[node]!;
      const currentScore = scores.get(currentLabel) ?? 0;
      let bestScore = currentScore;
      let bestLabel = currentLabel;
      for (const [label, score] of scores) {
        if (
          score > bestScore + SCORE_TIE_TOLERANCE ||
          (Math.abs(score - bestScore) <= SCORE_TIE_TOLERANCE &&
            bestLabel !== currentLabel &&
            label.localeCompare(bestLabel) < 0)
        ) {
          bestScore = score;
          bestLabel = label;
        }
      }
      if (bestScore > currentScore + SCORE_TIE_TOLERANCE && bestLabel !== currentLabel) {
        labels[node] = bestLabel;
        changed = true;
      }
    }
    iterations = iteration + 1;
    if (interrupted) break;
    if (!changed) {
      converged = true;
      break;
    }
  }

  const members = new Map<string, string[]>();
  labels.forEach((label, index) => {
    const group = members.get(label) ?? [];
    group.push(domains[index]!);
    members.set(label, group);
  });
  const sortedMembers = [...members.values()]
    .map((group) => group.sort((left, right) => left.localeCompare(right)))
    .sort((left, right) => left[0]!.localeCompare(right[0]!));
  const communityByDomain = new Map<string, string>();
  const sizeByCommunity = new Map<string, number>();
  sortedMembers.forEach((group, index) => {
    const communityId = `community-${String(index + 1).padStart(4, '0')}`;
    sizeByCommunity.set(communityId, group.length);
    for (const domain of group) communityByDomain.set(domain, communityId);
  });

  const internalWeights = new Map<string, number>();
  const externalWeights = new Map<string, number>();
  const internalEdgeCounts = new Map<string, number>();
  const weightedDegreeByDomain = new Map(domains.map((domain) => [domain, 0]));
  let totalEdgeWeight = 0;
  for (const edge of edges) {
    if (!Number.isFinite(edge.weight) || edge.weight <= 0 || edge.left === edge.right) continue;
    const leftCommunity = communityByDomain.get(edge.left);
    const rightCommunity = communityByDomain.get(edge.right);
    if (!leftCommunity || !rightCommunity) continue;
    totalEdgeWeight += edge.weight;
    weightedDegreeByDomain.set(
      edge.left,
      (weightedDegreeByDomain.get(edge.left) ?? 0) + edge.weight
    );
    weightedDegreeByDomain.set(
      edge.right,
      (weightedDegreeByDomain.get(edge.right) ?? 0) + edge.weight
    );
    if (leftCommunity === rightCommunity) {
      internalWeights.set(leftCommunity, (internalWeights.get(leftCommunity) ?? 0) + edge.weight);
      internalEdgeCounts.set(leftCommunity, (internalEdgeCounts.get(leftCommunity) ?? 0) + 1);
    } else {
      externalWeights.set(leftCommunity, (externalWeights.get(leftCommunity) ?? 0) + edge.weight);
      externalWeights.set(rightCommunity, (externalWeights.get(rightCommunity) ?? 0) + edge.weight);
    }
  }

  const communityDegrees = new Map<string, number>();
  for (const domain of domains) {
    const communityId = communityByDomain.get(domain)!;
    communityDegrees.set(
      communityId,
      (communityDegrees.get(communityId) ?? 0) + (weightedDegreeByDomain.get(domain) ?? 0)
    );
  }
  const modularityContributions = new Map<string, number>();
  if (totalEdgeWeight > 0) {
    for (const communityId of sizeByCommunity.keys()) {
      const internal = internalWeights.get(communityId) ?? 0;
      const degreeShare = (communityDegrees.get(communityId) ?? 0) / (2 * totalEdgeWeight);
      modularityContributions.set(communityId, internal / totalEdgeWeight - degreeShare ** 2);
    }
  }
  const weightedModularity =
    totalEdgeWeight > 0
      ? [...modularityContributions.values()].reduce((sum, contribution) => sum + contribution, 0)
      : null;

  const byDomain = new Map<string, SourceCommunityMetrics>();
  for (const domain of domains) {
    const communityId = communityByDomain.get(domain)!;
    const internal = internalWeights.get(communityId) ?? 0;
    const external = externalWeights.get(communityId) ?? 0;
    const total = internal + external;
    byDomain.set(domain, {
      communityId,
      communitySize: sizeByCommunity.get(communityId) ?? 1,
      communityInternalEdgeCount: internalEdgeCounts.get(communityId) ?? 0,
      communityInternalCooccurrenceWeight: internal,
      communityExternalCooccurrenceWeight: external,
      communityInternalCooccurrenceShare: total > 0 ? internal / total : null,
      communityModularityContribution: modularityContributions.get(communityId) ?? null,
      networkWeightedModularity: weightedModularity,
      communityDetectionConverged: converged,
      communityDetectionIterations: iterations,
      communityDetectionNeighborVisits: neighborVisits,
    });
  }

  return {
    byDomain,
    converged,
    iterations,
    neighborVisits,
    neighborVisitBudget: MAX_NEIGHBOR_VISITS,
    algorithm: 'deterministic-weighted-label-propagation',
    weightedModularity,
  };
}

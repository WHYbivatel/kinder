export function buildGraph(allUsers = []) {
  return {
    users: new Set(allUsers.map((user) => user.username)),
    edges: new Map()
  };
}

export function setSimilarEdges(graph, username, neighbors = []) {
  if (!graph?.edges) return;
  graph.edges.set(username, neighbors);
}

export function graphCollaborativeCandidates() {
  return new Map();
}

export function graphStats(graph) {
  return {
    users: graph?.users?.size || 0,
    edges: graph?.edges?.size || 0
  };
}

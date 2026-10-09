import { DeploymentProject, VpsServer } from '../types/deploy';

/**
 * Robustly matches a project to its VPS server.
 * Handles matching by ID, host, ipAddress, and fallback to the registered server.
 */
export function getProjectServer(
  project: DeploymentProject | null | undefined,
  servers: VpsServer[]
): VpsServer | undefined {
  if (!project || !servers || servers.length === 0) return undefined;

  // 1. Direct ID match
  const byId = servers.find((s) => s.id === project.vpsId);
  if (byId) return byId;

  // 2. Match by host or IP address (e.g. if vpsId was stored as '177.153.67.226')
  const byHost = servers.find(
    (s) => s.host === project.vpsId || s.ipAddress === project.vpsId
  );
  if (byHost) return byHost;

  // 3. If there is only 1 server, or if project has an orphaned default vpsId ('vps-1', 'vps-default')
  if (servers.length === 1) {
    return servers[0];
  }

  // 4. Default to first server if project's vpsId is completely missing/unknown
  return servers[0];
}

/**
 * Checks whether a specific project belongs to a given server.
 */
export function isProjectOnServer(
  project: DeploymentProject,
  server: VpsServer,
  allServers: VpsServer[] = []
): boolean {
  if (!project || !server) return false;

  // Exact ID
  if (project.vpsId === server.id) return true;

  // Host / IP match
  if (project.vpsId === server.host || project.vpsId === server.ipAddress) return true;

  // If there's only one server in the system, all projects belong to this server
  if (allServers.length === 1 && allServers[0].id === server.id) {
    return true;
  }

  // If this project's vpsId doesn't match ANY known server, and this server is the primary server
  const matchesOtherKnownServer = allServers.some(
    (s) => s.id !== server.id && (s.id === project.vpsId || s.host === project.vpsId || s.ipAddress === project.vpsId)
  );

  if (!matchesOtherKnownServer && allServers.length > 0 && allServers[0].id === server.id) {
    return true;
  }

  return false;
}

/**
 * Gets all projects running / assigned to a given server.
 */
export function getServerProjects(
  server: VpsServer,
  projects: DeploymentProject[],
  allServers: VpsServer[] = []
): DeploymentProject[] {
  if (!server || !projects) return [];
  return projects.filter((p) => isProjectOnServer(p, server, allServers));
}

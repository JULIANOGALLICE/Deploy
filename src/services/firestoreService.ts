import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { DeploymentProject, DeploymentRecord, VpsServer } from '../types/deploy';
import { initialServers, initialProjects, initialDeployments } from '../data/initialData';

const SERVERS_COLLECTION = 'servers';
const PROJECTS_COLLECTION = 'projects';
const DEPLOYMENTS_COLLECTION = 'deployments';

/**
 * Remove qualquer campo com valor undefined para compatibilidade estrita com o Firestore
 */
export function sanitizeForFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeForFirestore(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Insere os dados padrão no Firestore se o banco estiver vazio pela primeira vez
 */
export async function seedInitialDataIfEmpty() {
  try {
    const serversSnap = await getDocs(collection(db, SERVERS_COLLECTION));
    if (serversSnap.empty) {
      console.log('🌱 Inicializando banco Firestore com servidores e aplicações padrão...');
      for (const server of initialServers) {
        await setDoc(doc(db, SERVERS_COLLECTION, server.id), sanitizeForFirestore(server));
      }
      for (const project of initialProjects) {
        await setDoc(doc(db, PROJECTS_COLLECTION, project.id), sanitizeForFirestore(project));
      }
      for (const dep of initialDeployments) {
        await setDoc(doc(db, DEPLOYMENTS_COLLECTION, dep.id), sanitizeForFirestore(dep));
      }
    }
  } catch (error) {
    console.warn('Erro ao verificar semente inicial no Firestore:', error);
  }
}

/**
 * Escuta em tempo real os servidores VPS cadastrados
 */
export function subscribeToServers(onUpdate: (servers: VpsServer[]) => void) {
  const path = SERVERS_COLLECTION;
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const servers: VpsServer[] = [];
      snapshot.forEach((doc) => {
        servers.push(doc.data() as VpsServer);
      });
      onUpdate(servers);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

/**
 * Escuta em tempo real as aplicações Git cadastradas
 */
export function subscribeToProjects(onUpdate: (projects: DeploymentProject[]) => void) {
  const path = PROJECTS_COLLECTION;
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const projects: DeploymentProject[] = [];
      snapshot.forEach((doc) => {
        projects.push(doc.data() as DeploymentProject);
      });
      onUpdate(projects);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

/**
 * Escuta em tempo real o histórico de deploys
 */
export function subscribeToDeployments(onUpdate: (deployments: DeploymentRecord[]) => void) {
  const path = DEPLOYMENTS_COLLECTION;
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const records: DeploymentRecord[] = [];
      snapshot.forEach((doc) => {
        records.push(doc.data() as DeploymentRecord);
      });
      // Ordena pelos mais recentes
      records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onUpdate(records);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

/**
 * Salva ou atualiza um servidor VPS no Firestore
 */
export async function saveVpsServer(server: VpsServer): Promise<void> {
  const path = `${SERVERS_COLLECTION}/${server.id}`;
  try {
    const cleanData = sanitizeForFirestore(server);
    await setDoc(doc(db, SERVERS_COLLECTION, server.id), cleanData, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Exclui um servidor VPS do Firestore
 */
export async function deleteVpsServer(serverId: string): Promise<void> {
  const path = `${SERVERS_COLLECTION}/${serverId}`;
  try {
    await deleteDoc(doc(db, SERVERS_COLLECTION, serverId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Salva ou atualiza uma aplicação Git no Firestore
 */
export async function saveDeploymentProject(project: DeploymentProject): Promise<void> {
  const path = `${PROJECTS_COLLECTION}/${project.id}`;
  try {
    const cleanData = sanitizeForFirestore(project);
    await setDoc(doc(db, PROJECTS_COLLECTION, project.id), cleanData, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Exclui uma aplicação Git do Firestore
 */
export async function deleteDeploymentProject(projectId: string): Promise<void> {
  const path = `${PROJECTS_COLLECTION}/${projectId}`;
  try {
    await deleteDoc(doc(db, PROJECTS_COLLECTION, projectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Salva um novo registro de deploy
 */
export async function saveDeploymentRecord(record: DeploymentRecord): Promise<void> {
  const path = `${DEPLOYMENTS_COLLECTION}/${record.id}`;
  try {
    const cleanData = sanitizeForFirestore(record);
    await setDoc(doc(db, DEPLOYMENTS_COLLECTION, record.id), cleanData);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

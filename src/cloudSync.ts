type Workspace = {
  boards: unknown[];
  tasks: unknown[];
};

type CloudProfile = {
  name: string;
  email: string;
};

type FirebaseModules = {
  app: Record<string, (...args: any[]) => any>;
  auth: Record<string, (...args: any[]) => any> & { GoogleAuthProvider: new () => { addScope: (scope: string) => void } };
  firestore: Record<string, (...args: any[]) => any>;
};

const FIREBASE_VERSION = "11.10.0";
const FIREBASE_ROOT = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let modulesPromise: Promise<FirebaseModules> | null = null;
let activeDocument: unknown = null;
let lastSerialized = "";

function importRemote(url: string) {
  return import(/* @vite-ignore */ url) as Promise<Record<string, (...args: any[]) => any>>;
}

async function loadModules(): Promise<FirebaseModules> {
  if (!modulesPromise) {
    modulesPromise = Promise.all([
      importRemote(`${FIREBASE_ROOT}/firebase-app.js`),
      importRemote(`${FIREBASE_ROOT}/firebase-auth.js`),
      importRemote(`${FIREBASE_ROOT}/firebase-firestore.js`),
    ]).then(([app, auth, firestore]) => ({ app, auth: auth as FirebaseModules["auth"], firestore }));
  }
  return modulesPromise;
}

export function cloudIsConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
}

export async function connectCloud(
  localWorkspace: Workspace,
  onRemoteWorkspace: (workspace: Workspace) => void,
): Promise<{ profile: CloudProfile; disconnect: () => void }> {
  if (!cloudIsConfigured()) throw new Error("Falta configurar Firebase en el archivo .env.");

  const modules = await loadModules();
  const apps = modules.app.getApps();
  const firebaseApp = apps.length ? modules.app.getApp() : modules.app.initializeApp(firebaseConfig);
  const auth = modules.auth.getAuth(firebaseApp);
  const provider = new modules.auth.GoogleAuthProvider();
  const result = await modules.auth.signInWithPopup(auth, provider);
  const user = result.user as { uid: string; displayName?: string; email?: string };
  const database = modules.firestore.getFirestore(firebaseApp);
  const documentRef = modules.firestore.doc(database, "users", user.uid, "monarca", "workspace");
  activeDocument = documentRef;

  const current = await modules.firestore.getDoc(documentRef);
  if (current.exists()) {
    const remote = current.data() as Workspace;
    if (Array.isArray(remote.boards) && Array.isArray(remote.tasks)) {
      lastSerialized = JSON.stringify(remote);
      onRemoteWorkspace(remote);
    }
  } else {
    lastSerialized = JSON.stringify(localWorkspace);
    await modules.firestore.setDoc(documentRef, localWorkspace);
  }

  const disconnect = modules.firestore.onSnapshot(documentRef, (snapshot: { exists: () => boolean; data: () => Workspace }) => {
    if (!snapshot.exists()) return;
    const workspace = snapshot.data();
    const serialized = JSON.stringify(workspace);
    if (serialized === lastSerialized) return;
    lastSerialized = serialized;
    onRemoteWorkspace(workspace);
  });

  return {
    profile: {
      name: user.displayName || "Erika",
      email: user.email || "Cuenta de Google",
    },
    disconnect,
  };
}

export async function saveCloudWorkspace(workspace: Workspace) {
  if (!activeDocument) return;
  const serialized = JSON.stringify(workspace);
  if (serialized === lastSerialized) return;
  lastSerialized = serialized;
  const modules = await loadModules();
  await modules.firestore.setDoc(activeDocument, workspace);
}

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  getDoc, 
  query, 
  where,
  onSnapshot,
  DocumentData,
  QueryConstraint
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });
// Required Workspace Scopes
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/chat.messages.create',
  'https://www.googleapis.com/auth/chat.spaces'
];

SCOPES.forEach(scope => provider.addScope(scope));

let cachedAccessToken: string | null = null;
let isSigningIn = false;

const getStoredToken = (): string | null => {
  return localStorage.getItem('vela_access_token') || sessionStorage.getItem('vela_access_token');
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (!cachedAccessToken) {
        cachedAccessToken = getStoredToken();
      }
      // If we have a user, we report success even if token is null (will need refresh for Workspace APIs)
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      localStorage.removeItem('vela_access_token');
      sessionStorage.removeItem('vela_access_token');
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken) {
    cachedAccessToken = getStoredToken();
  }
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  localStorage.removeItem('vela_access_token');
  sessionStorage.removeItem('vela_access_token');
};

export const invalidateToken = () => {
  cachedAccessToken = null;
  localStorage.removeItem('vela_access_token');
  sessionStorage.removeItem('vela_access_token');
};

// --- Firestore Helpers ---

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Recursively strips undefined fields so Firestore addDoc / updateDoc does not throw
 * "Unsupported field value: undefined".
 */
export function sanitizeFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeFirestoreData) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeFirestoreData(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

export const firestore = {
  async add(collectionPath: string, data: DocumentData) {
    try {
      const sanitized = sanitizeFirestoreData({
        ...data,
        createdAt: new Date().toISOString()
      });
      const docRef = await addDoc(collection(db, collectionPath), sanitized);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, collectionPath);
    }
  },

  async update(collectionPath: string, id: string, data: Partial<DocumentData>) {
    try {
      const sanitized = sanitizeFirestoreData(data);
      const docRef = doc(db, collectionPath, id);
      await updateDoc(docRef, sanitized);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${collectionPath}/${id}`);
    }
  },

  async delete(collectionPath: string, id: string) {
    try {
      const docRef = doc(db, collectionPath, id);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${collectionPath}/${id}`);
    }
  },

  async getOne(collectionPath: string, id: string) {
    try {
      const docRef = doc(db, collectionPath, id);
      const snapshot = await getDoc(docRef);
      return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${collectionPath}/${id}`);
    }
  },

  async query(collectionPath: string, constraints: QueryConstraint[] = []) {
    try {
      const q = query(
        collection(db, collectionPath),
        ...constraints
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, collectionPath);
    }
  },

  subscribe(collectionPath: string, constraints: QueryConstraint[], onUpdate: (data: any[]) => void) {
    if (!auth.currentUser) return () => {};
    
    const q = query(
      collection(db, collectionPath),
      ...constraints
    );

    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      onUpdate(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, collectionPath);
    });
  }
};

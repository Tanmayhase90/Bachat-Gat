import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { DEFAULT_GROUP_ID } from '../utils/formatters';
import { groupService } from './groupService';

const STORAGE_KEYS = {
  AUTO_BACKUP: 'drive_auto_backup',
  LAST_BACKUP: 'last_drive_backup',
  DRIVE_PROFILE: 'drive_user_profile',
  DRIVE_TOKEN: 'drive_access_token',
  DRIVE_FOLDER_ID: 'drive_folder_id',
  CUSTOM_CLIENT_ID: 'google_client_id',
  TARGET_EMAIL: 'drive_target_email',
};

const DATED_FILE_PREFIX = 'BachatGat_Backup_';
const DATED_FILE_SUFFIX = '.json';
const DRIVE_FOLDER_NAME = 'Bachat Gat Backups';

// In-memory token holder to avoid security leaks
let activeDriveAccessToken = null;
let gisTokenClient = null;

/**
 * Format today's date into BachatGat_Backup_YYYY-MM-DD_HH-mm-ss.json
 */
function getDatedFileName(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${DATED_FILE_PREFIX}${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}${DATED_FILE_SUFFIX}`;
}

export const backupService = {
  /**
   * Get effective Google Client ID (from env or manual config)
   */
  getGoogleClientId: () => {
    return (
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_CLIENT_ID) ||
      localStorage.getItem(STORAGE_KEYS.CUSTOM_CLIENT_ID) ||
      ''
    );
  },

  /**
   * Set manual Google Client ID if not configured via .env
   */
  setGoogleClientId: (clientId) => {
    if (clientId && clientId.trim()) {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_CLIENT_ID, clientId.trim());
    } else {
      localStorage.removeItem(STORAGE_KEYS.CUSTOM_CLIENT_ID);
    }
  },

  /**
   * Get stored Google Drive target email
   */
  getTargetEmail: () => {
    return localStorage.getItem(STORAGE_KEYS.TARGET_EMAIL) || '';
  },

  /**
   * Set stored Google Drive target email
   */
  setTargetEmail: (email) => {
    if (email && email.trim()) {
      localStorage.setItem(STORAGE_KEYS.TARGET_EMAIL, email.trim().toLowerCase());
    } else {
      localStorage.removeItem(STORAGE_KEYS.TARGET_EMAIL);
    }
  },

  /**
   * Load Google Identity Services script if not already present
   */
  loadGoogleScript: () => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') return resolve(false);
      if (window.google?.accounts?.oauth2) return resolve(true);

      const existing = document.getElementById('google-gis-script');
      if (existing) {
        existing.addEventListener('load', () => resolve(true));
        existing.addEventListener('error', (e) => reject(e));
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-gis-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(true);
      script.onerror = (err) => reject(err);
      document.head.appendChild(script);
    });
  },

  /**
   * Export complete Bachat Gat Firestore database with full Marathi UTF-8 preservation
   */
  exportBackupData: async (groupId = DEFAULT_GROUP_ID) => {
    const targetGroupId = groupId || DEFAULT_GROUP_ID;
    const groupRef = doc(db, 'groups', targetGroupId);

    const [
      groupSnap,
      membersSnap,
      contributionsSnap,
      loansSnap,
      repaymentsSnap,
      settlementsSnap,
      activitiesSnap,
      notificationsSnap,
      txSnap,
    ] = await Promise.all([
      getDoc(groupRef).catch(() => ({ data: () => ({}) })),
      getDocs(collection(db, 'groups', targetGroupId, 'members')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'groups', targetGroupId, 'monthly_contributions')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'groups', targetGroupId, 'loans')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'groups', targetGroupId, 'repayments')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'groups', targetGroupId, 'settlements')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'groups', targetGroupId, 'activities')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'groups', targetGroupId, 'notifications')).catch(() => ({ docs: [] })),
      getDocs(query(collection(db, 'transactions'), where('groupId', '==', targetGroupId))).catch(() => ({ docs: [] })),
    ]);

    const serializeDocs = (snap) =>
      snap.docs.map((d) => ({
        _doc_id: d.id,
        ...d.data(),
      }));

    return {
      format: 'bachat_gat_backup',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      groupId: targetGroupId,
      group: groupSnap?.exists?.() ? groupSnap.data() : (groupSnap.data ? groupSnap.data() : {}),
      members: serializeDocs(membersSnap),
      monthly_contributions: serializeDocs(contributionsSnap),
      loans: serializeDocs(loansSnap),
      repayments: serializeDocs(repaymentsSnap),
      settlements: serializeDocs(settlementsSnap),
      activities: serializeDocs(activitiesSnap),
      notifications: serializeDocs(notificationsSnap),
      transactions: serializeDocs(txSnap),
    };
  },

  /**
   * Generate local JSON file and trigger browser download
   */
  downloadLocalBackup: async (groupId = DEFAULT_GROUP_ID) => {
    const backupData = await backupService.exportBackupData(groupId);
    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const fileName = getDatedFileName();

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return fileName;
  },

  /**
   * Atomically restore Bachat Gat backup while strictly preserving legitimate license state
   */
  restoreBackupData: async (backup, groupId = DEFAULT_GROUP_ID) => {
    if (!backup || typeof backup !== 'object' || backup.format !== 'bachat_gat_backup') {
      throw new Error('This is not a valid Bachat Gat backup file.');
    }

    const requiredSections = ['group', 'members', 'monthly_contributions', 'loans', 'repayments'];
    for (const section of requiredSections) {
      if (!backup[section]) {
        throw new Error(`Backup file is missing the required '${section}' section.`);
      }
    }

    const targetGroupId = backup.groupId || groupId || DEFAULT_GROUP_ID;
    const groupRef = doc(db, 'groups', targetGroupId);

    // 1. Preserve local licence state before restoring database
    const savedMachineId = localStorage.getItem('license_machine_id');
    const savedExpiry = localStorage.getItem('license_expiry');
    const savedKey = localStorage.getItem('license_activation_key');
    const savedPolicy = localStorage.getItem('license_policy');

    try {
      // 2. Restore Group Metadata
      if (backup.group && Object.keys(backup.group).length > 0) {
        await setDoc(groupRef, backup.group, { merge: true });
      }

      // Helper for batched deletion and insertion
      const replaceSubcollection = async (colRef, items = []) => {
        const existingSnap = await getDocs(colRef);

        // Delete in batches of 400
        for (let i = 0; i < existingSnap.docs.length; i += 400) {
          const batch = writeBatch(db);
          const chunk = existingSnap.docs.slice(i, i + 400);
          chunk.forEach((docSnap) => batch.delete(docSnap.ref));
          await batch.commit();
        }

        // Insert in batches of 400
        if (Array.isArray(items)) {
          for (let i = 0; i < items.length; i += 400) {
            const batch = writeBatch(db);
            const chunk = items.slice(i, i + 400);
            chunk.forEach((item) => {
              if (item && typeof item === 'object') {
                const docData = { ...item };
                const docId = docData._doc_id;
                delete docData._doc_id;
                const targetRef = docId ? doc(colRef, docId) : doc(colRef);
                batch.set(targetRef, docData);
              }
            });
            await batch.commit();
          }
        }
      };

      // 3. Restore all subcollections
      await replaceSubcollection(collection(db, 'groups', targetGroupId, 'members'), backup.members);
      await replaceSubcollection(collection(db, 'groups', targetGroupId, 'monthly_contributions'), backup.monthly_contributions);
      await replaceSubcollection(collection(db, 'groups', targetGroupId, 'loans'), backup.loans);
      await replaceSubcollection(collection(db, 'groups', targetGroupId, 'repayments'), backup.repayments);

      if (backup.settlements) {
        await replaceSubcollection(collection(db, 'groups', targetGroupId, 'settlements'), backup.settlements);
      }
      if (backup.activities) {
        await replaceSubcollection(collection(db, 'groups', targetGroupId, 'activities'), backup.activities);
      }
      if (backup.notifications) {
        await replaceSubcollection(collection(db, 'groups', targetGroupId, 'notifications'), backup.notifications);
      }

      // 4. Restore transactions root collection
      if (Array.isArray(backup.transactions)) {
        const txColRef = collection(db, 'transactions');
        const existingTx = await getDocs(query(txColRef, where('groupId', '==', targetGroupId)));

        for (let i = 0; i < existingTx.docs.length; i += 400) {
          const batch = writeBatch(db);
          existingTx.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }

        for (let i = 0; i < backup.transactions.length; i += 400) {
          const batch = writeBatch(db);
          backup.transactions.slice(i, i + 400).forEach((item) => {
            if (item && typeof item === 'object') {
              const docData = { ...item };
              const docId = docData._doc_id;
              delete docData._doc_id;
              const targetRef = docId ? doc(txColRef, docId) : doc(txColRef);
              batch.set(targetRef, docData);
            }
          });
          await batch.commit();
        }
      }

      // 5. Recalculate group aggregates
      await groupService.recalculateAndSyncGroupAggregates(targetGroupId);
    } finally {
      // 6. Guarantee licence preservation
      if (savedMachineId) localStorage.setItem('license_machine_id', savedMachineId);
      if (savedExpiry) localStorage.setItem('license_expiry', savedExpiry);
      if (savedKey) localStorage.setItem('license_activation_key', savedKey);
      if (savedPolicy) localStorage.setItem('license_policy', savedPolicy);
    }
  },

  /**
   * Parse uploaded file and restore
   */
  restoreFromLocalFile: async (file, groupId = DEFAULT_GROUP_ID) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target.result;
          const parsed = JSON.parse(content);
          await backupService.restoreBackupData(parsed, groupId);
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(new Error('Failed to read file.'));
      reader.readAsText(file, 'UTF-8');
    });
  },

  // --------------------------------------------------------------------------
  // GOOGLE DRIVE INTEGRATION (OAuth 2.0 via Google Identity Services)
  // --------------------------------------------------------------------------

  getDriveProfile: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DRIVE_PROFILE);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  },

  isDriveConnected: () => {
    const profile = backupService.getDriveProfile();
    return Boolean(profile && (profile.email || profile.name));
  },

  getAutoBackupEnabled: () => {
    return localStorage.getItem(STORAGE_KEYS.AUTO_BACKUP) === 'true';
  },

  setAutoBackupEnabled: (enabled) => {
    localStorage.setItem(STORAGE_KEYS.AUTO_BACKUP, enabled ? 'true' : 'false');
  },

  getLastBackupTime: () => {
    return localStorage.getItem(STORAGE_KEYS.LAST_BACKUP) || null;
  },

  /**
   * Authorize Google Drive via Google Identity Services Token Client
   */
  connectGoogleDrive: async (hintEmail = '') => {
    const clientId = backupService.getGoogleClientId();
    if (!clientId) {
      throw new Error(
        'Google Client ID is not configured. Please set VITE_GOOGLE_CLIENT_ID in your environment or provide it in Settings.'
      );
    }

    const emailToUse = (hintEmail && hintEmail.trim()) || backupService.getTargetEmail();

    await backupService.loadGoogleScript();

    return new Promise((resolve, reject) => {
      try {
        gisTokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/drive.file',
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
              return reject(new Error(tokenResponse.error_description || tokenResponse.error));
            }
            if (!tokenResponse.access_token) {
              return reject(new Error('No access token received from Google.'));
            }

            activeDriveAccessToken = tokenResponse.access_token;

            // Fetch user profile
            try {
              const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${activeDriveAccessToken}` },
              });
              const profile = res.ok ? await res.json() : {};
              const resolvedEmail = profile.email || emailToUse || 'Connected Account';
              const resolvedProfile = {
                email: resolvedEmail,
                name: profile.name || resolvedEmail.split('@')[0],
                picture: profile.picture || null,
              };
              localStorage.setItem(STORAGE_KEYS.DRIVE_PROFILE, JSON.stringify(resolvedProfile));
              if (resolvedEmail && resolvedEmail !== 'Connected Account') {
                localStorage.setItem(STORAGE_KEYS.TARGET_EMAIL, resolvedEmail);
              }
              resolve(resolvedProfile);
            } catch (err) {
              // Fallback profile if userinfo endpoint fails
              const fallback = { email: emailToUse || 'Connected Account', name: 'Google User', picture: null };
              localStorage.setItem(STORAGE_KEYS.DRIVE_PROFILE, JSON.stringify(fallback));
              resolve(fallback);
            }
          },
        });

        const tokenRequestOptions = { prompt: 'consent' };
        if (emailToUse) {
          tokenRequestOptions.hint = emailToUse;
        }
        gisTokenClient.requestAccessToken(tokenRequestOptions);
      } catch (err) {
        reject(err);
      }
    });
  },

  disconnectGoogleDrive: () => {
    activeDriveAccessToken = null;
    localStorage.removeItem(STORAGE_KEYS.DRIVE_PROFILE);
    localStorage.removeItem(STORAGE_KEYS.DRIVE_FOLDER_ID);
    localStorage.setItem(STORAGE_KEYS.AUTO_BACKUP, 'false');
  },

  /**
   * Locate or create 'Bachat Gat Backups' folder in Drive
   */
  ensureDriveFolder: async () => {
    if (!activeDriveAccessToken) throw new Error('Google Drive is not connected.');

    const cachedFolderId = localStorage.getItem(STORAGE_KEYS.DRIVE_FOLDER_ID);
    if (cachedFolderId) return cachedFolderId;

    try {
      // Search for folder
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(
        DRIVE_FOLDER_NAME
      )}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`;

      const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${activeDriveAccessToken}` },
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) {
          const folderId = searchData.files[0].id;
          localStorage.setItem(STORAGE_KEYS.DRIVE_FOLDER_ID, folderId);
          return folderId;
        }
      }

      // Create folder
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${activeDriveAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: DRIVE_FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder',
        }),
      });
      if (createRes.ok) {
        const folderData = await createRes.json();
        if (folderData.id) {
          localStorage.setItem(STORAGE_KEYS.DRIVE_FOLDER_ID, folderData.id);
          return folderData.id;
        }
      }
    } catch (err) {
      console.warn('Could not ensure Drive folder, uploading to root:', err);
    }
    return null;
  },

  /**
   * Upload backup to Google Drive
   */
  uploadToGoogleDrive: async (groupId = DEFAULT_GROUP_ID, hintEmail) => {
    if (!activeDriveAccessToken) {
      await backupService.connectGoogleDrive(hintEmail);
    }

    const folderId = await backupService.ensureDriveFolder();
    const backupData = await backupService.exportBackupData(groupId);
    const jsonString = JSON.stringify(backupData, null, 2);
    const fileName = getDatedFileName();

    // Create new backup file
    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      description: 'Bachat Gat Complete Backup',
      ...(folderId ? { parents: [folderId] } : {}),
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      jsonString +
      closeDelim;

    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${activeDriveAccessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!uploadRes.ok) {
      if (uploadRes.status === 401) {
        activeDriveAccessToken = null;
        throw new Error('Google Drive authorization expired. Please reconnect your Google Drive account.');
      }
      const errData = await uploadRes.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Google Drive upload failed (${uploadRes.status}).`);
    }

    const nowIso = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.LAST_BACKUP, nowIso);
    return { fileName, uploadedAt: nowIso };
  },

  /**
   * List available Bachat Gat backups from Google Drive
   */
  getGoogleDriveBackups: async (hintEmail) => {
    if (!activeDriveAccessToken) {
      await backupService.connectGoogleDrive(hintEmail);
    }

    const folderId = await backupService.ensureDriveFolder();
    let queryStr = `(name contains 'BachatGat_Backup_' or name contains 'Bachat-Gat-Backup-') and trashed=false`;
    if (folderId) {
      queryStr += ` and '${folderId}' in parents`;
    }

    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      queryStr
    )}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime,size)`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${activeDriveAccessToken}` },
    });

    if (!res.ok) {
      if (res.status === 401) {
        activeDriveAccessToken = null;
        throw new Error('Google Drive authorization expired. Please reconnect your Google Drive account.');
      }
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Failed to load Google Drive backups (${res.status}).`);
    }

    const data = await res.json();
    return data.files || [];
  },

  /**
   * Download and restore a specific backup from Google Drive
   */
  restoreFromGoogleDrive: async (fileId, groupId = DEFAULT_GROUP_ID) => {
    if (!activeDriveAccessToken) throw new Error('Google Drive is not connected.');

    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${activeDriveAccessToken}` },
    });

    if (!res.ok) {
      if (res.status === 401) {
        activeDriveAccessToken = null;
        throw new Error('Google Drive authorization expired. Please reconnect your Google Drive account.');
      }
      throw new Error(`Failed to download backup file from Google Drive (${res.status}).`);
    }

    const backupJson = await res.json();
    await backupService.restoreBackupData(backupJson, groupId);
    return backupJson;
  },

  /**
   * Check if 2-day automatic backup is due when admin visits or returns to app
   */
  checkAutoBackupDue: async (groupId = DEFAULT_GROUP_ID) => {
    if (!backupService.getAutoBackupEnabled()) return false;
    if (!backupService.isDriveConnected()) return false;

    const last = backupService.getLastBackupTime();
    if (last) {
      const lastDate = new Date(last);
      const today = new Date();
      const diffMs = today.getTime() - lastDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays < 2) return false;
    }

    try {
      await backupService.uploadToGoogleDrive(groupId);
      return true;
    } catch (err) {
      console.warn('Auto backup check failed to upload:', err);
      return false;
    }
  },
};

export default backupService;

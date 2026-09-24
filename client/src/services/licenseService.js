import api from './api';

const STORAGE_KEYS = {
  MACHINE_ID: 'license_machine_id',
  EXPIRY: 'license_expiry',
  KEY: 'license_activation_key',
  POLICY: 'license_policy',
  WARNING_LAST_SHOWN: 'license_warning_last_shown',
};

const SINGLE_LICENCE_POLICY = 'single-licence-bachat-gat';
const DEFAULT_INITIAL_EXPIRY = '2027-09-17';

/**
 * Generate a secure 12-byte random uppercase identifier matching the Flutter app format
 */
function generateMachineId() {
  const bytes = new Uint8Array(12);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 12; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  // Base64Url encode without padding
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
    .toUpperCase();

  return base64;
}

export const licenseService = {
  /**
   * Get or initialize Machine ID
   */
  getMachineId: () => {
    let id = localStorage.getItem(STORAGE_KEYS.MACHINE_ID);
    if (!id || id.trim().length === 0) {
      id = generateMachineId();
      localStorage.setItem(STORAGE_KEYS.MACHINE_ID, id);
    }
    return id;
  },

  /**
   * Get current license status
   */
  getLicenseStatus: () => {
    const machineId = licenseService.getMachineId();

    // Enforce single-licence policy alignment
    const policy = localStorage.getItem(STORAGE_KEYS.POLICY);
    if (policy !== SINGLE_LICENCE_POLICY) {
      localStorage.setItem(STORAGE_KEYS.POLICY, SINGLE_LICENCE_POLICY);
      if (!localStorage.getItem(STORAGE_KEYS.EXPIRY)) {
        localStorage.setItem(STORAGE_KEYS.EXPIRY, DEFAULT_INITIAL_EXPIRY);
      }
    }

    const expiryStr = localStorage.getItem(STORAGE_KEYS.EXPIRY) || DEFAULT_INITIAL_EXPIRY;
    const expiry = new Date(expiryStr);
    const today = new Date();

    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const expiryDay = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());

    const isExpired = todayDay.getTime() > expiryDay.getTime();
    const diffMs = expiryDay.getTime() - todayDay.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const needsWarning = !isExpired && daysRemaining <= 8;

    return {
      machineId,
      expiryDate: expiryStr,
      daysRemaining: isExpired ? 0 : daysRemaining,
      isExpired,
      needsWarning,
      activationKey: localStorage.getItem(STORAGE_KEYS.KEY) || '',
    };
  },

  /**
   * Check if the 8-day warning alert should be displayed today
   * Debounced to strictly show once per calendar day
   */
  consumeDailyWarning: () => {
    const status = licenseService.getLicenseStatus();
    if (!status.needsWarning) return false;

    const todayStr = new Date().toISOString().split('T')[0];
    const lastShown = localStorage.getItem(STORAGE_KEYS.WARNING_LAST_SHOWN);
    if (lastShown === todayStr) return false;

    localStorage.setItem(STORAGE_KEYS.WARNING_LAST_SHOWN, todayStr);
    return true;
  },

  /**
   * Activate or renew licence via secure server-side verification endpoint
   */
  activate: async (key) => {
    try {
      const machineId = licenseService.getMachineId();
      if (!key || typeof key !== 'string' || key.trim().length === 0) {
        return { success: false, message: 'Please enter a valid licence key.' };
      }

      const cleanKey = key.trim();
      const response = await api.post('/license', {
        machineId,
        key: cleanKey,
      });

      if (response.data && response.data.success) {
        localStorage.setItem(STORAGE_KEYS.KEY, cleanKey);
        localStorage.setItem(STORAGE_KEYS.EXPIRY, response.data.expiryDate);
        return {
          success: true,
          expiryDate: response.data.expiryDate,
          daysRemaining: response.data.daysRemaining,
          message: response.data.message || 'Licence activated successfully!',
        };
      } else {
        return {
          success: false,
          message: response.data?.message || 'Licence activation rejected by server.',
        };
      }
    } catch (err) {
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        'Server communication failed. Please verify the backend server is running.';
      return { success: false, message: errorMsg };
    }
  },

  /**
   * Generate WhatsApp contact link pre-filling Machine ID
   */
  getWhatsAppContactUrl: (adminPhone = '919876543210') => {
    const machineId = licenseService.getMachineId();
    const text = encodeURIComponent(
      `Hello Admin,\n\nI need a Bachat Gat licence activation key for my machine.\n\nMachine ID: ${machineId}\n\nThank you.`
    );
    return `https://wa.me/${adminPhone}?text=${text}`;
  },
};

export default licenseService;

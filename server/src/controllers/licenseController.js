const crypto = require('crypto');

function getSecret() {
  return process.env.LICENSE_SIGNING_SECRET || '';
}

function verifyKey(machineId, key) {
  const secret = getSecret();
  if (!secret) {
    throw new Error('Server licence signing secret is not configured.');
  }

  if (!machineId || !key) {
    return { valid: false, error: 'Machine ID and licence key are required.' };
  }

  let decoded;
  try {
    decoded = Buffer.from(key.trim(), 'base64url').toString('utf8');
  } catch (err) {
    return { valid: false, error: 'Malformed licence key encoding.' };
  }

  const parts = decoded.split('|');
  if (parts.length !== 3) {
    return { valid: false, error: 'Invalid licence key format.' };
  }

  const [keyMachineId, expiryDateStr, signature] = parts;
  if (keyMachineId.toUpperCase() !== machineId.trim().toUpperCase()) {
    return { valid: false, error: 'Licence key was issued for a different Machine ID.' };
  }

  const expiry = new Date(expiryDateStr);
  if (isNaN(expiry.getTime())) {
    return { valid: false, error: 'Invalid expiry date in licence key.' };
  }

  const payload = `${keyMachineId.toUpperCase()}|${expiryDateStr}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false, error: 'Invalid or corrupt licence signature.' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDay = new Date(expiry);
  expiryDay.setHours(0, 0, 0, 0);

  if (expiryDay <= today) {
    return { valid: false, error: 'This licence key has already expired.' };
  }

  const diffDays = Math.ceil((expiryDay - today) / (1000 * 60 * 60 * 24));

  return {
    valid: true,
    machineId: keyMachineId,
    expiryDate: expiryDateStr,
    daysRemaining: diffDays,
  };
}

function generateKey(machineId, expiryDateStr) {
  const secret = getSecret();
  if (!secret) throw new Error('LICENSE_SIGNING_SECRET is not configured.');
  const payload = `${machineId.trim().toUpperCase()}|${expiryDateStr}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}|${signature}`).toString('base64url');
}

async function activate(req, res) {
  try {
    const { machineId, key } = req.body;
    if (!machineId || !key) {
      return res.status(400).json({ success: false, message: 'Machine ID and licence key are required.' });
    }

    const result = verifyKey(machineId, key);
    if (!result.valid) {
      return res.status(400).json({ success: false, message: result.error });
    }

    return res.json({
      success: true,
      valid: true,
      machineId: result.machineId,
      expiryDate: result.expiryDate,
      daysRemaining: result.daysRemaining,
      message: 'Licence activated successfully!',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Licence activation failed.' });
  }
}

async function verify(req, res) {
  try {
    const { machineId, key } = req.body;
    const result = verifyKey(machineId, key);
    return res.json({ success: result.valid, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  activate,
  verify,
  verifyKey,
  generateKey,
};

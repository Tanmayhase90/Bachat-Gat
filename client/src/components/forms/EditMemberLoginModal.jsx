import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, Mail } from 'lucide-react';
import Modal from '../common/Modal';
import { memberService } from '../../services/memberService';

const EditMemberLoginModal = ({ isOpen, onClose, onSuccess, member }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const loginEnabled = Boolean(member?.authUid || member?.userId || member?.firebaseUid);

  useEffect(() => {
    if (!isOpen) return;
    setEmail(member?.email || '');
    setPassword('');
    setError('');
    setSuccess('');
  }, [isOpen, member]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setLoading(true);
      setError('');
      const result = await memberService.assignMemberLogin(member.member_id || member.id, { email, password });
      setSuccess(`Login enabled. Member Login ID: ${result.email}`);
      setPassword('');
      await onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to enable member login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Member Login" maxWidth="500px">
      {error && (
        <div style={{ padding: '10px 14px', background: 'var(--danger-light)', color: 'var(--danger-text)', borderRadius: 'var(--radius-md)', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '10px 14px', background: 'var(--success-light)', color: 'var(--success-text)', borderRadius: 'var(--radius-md)', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      {loginEnabled && !success ? (
        <div style={{ padding: '16px', background: 'var(--success-light)', color: 'var(--success-text)', borderRadius: 'var(--radius-md)' }}>
          <strong>Member login is already enabled.</strong>
          <div style={{ marginTop: '6px', fontSize: '0.875rem' }}>Login ID: {member.email}</div>
        </div>
      ) : !success && (
        <form onSubmit={handleSubmit}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '18px' }}>
            Add an email and temporary password for {member?.name}. The member can use these details from the Member Login tab.
          </p>
          <div className="form-group">
            <label className="form-label">Member Email ID *</label>
            <div style={{ position: 'relative' }}>
              <Mail size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input type="email" className="form-input" style={{ paddingLeft: '38px' }} value={email} onChange={(e) => setEmail(e.target.value)} data-autofocus required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Temporary Password *</label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input type="password" className="form-input" style={{ paddingLeft: '38px' }} value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} autoComplete="new-password" required />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              <KeyRound size={16} /> {loading ? 'Enabling Login...' : 'Enable Member Login'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default EditMemberLoginModal;

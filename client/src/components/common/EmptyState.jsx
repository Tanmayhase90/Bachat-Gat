import React from 'react';
import { Inbox } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const EmptyState = ({
  icon: Icon = Inbox,
  title,
  description,
  actionText,
  onAction,
}) => {
  const { t } = useLanguage();
  const displayTitle = title !== undefined ? title : t('common.noDataFound', 'No Data Found');
  const displayDescription = description !== undefined ? description : t('common.noRecordsDesc', 'There are no records to display at this moment.');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      textAlign: 'center',
      background: '#FAFAFA',
      borderRadius: 'var(--radius-lg)',
      border: '1.5px dashed var(--border-color)',
      margin: '16px 0'
    }}>
      <div style={{
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        background: 'var(--accent-soft)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '16px',
        color: 'var(--primary)'
      }}>
        <Icon size={28} />
      </div>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>{displayTitle}</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '400px', marginBottom: actionText ? '20px' : '0' }}>
        {displayDescription}
      </p>
      {actionText && onAction && (
        <button onClick={onAction} className="btn-primary">
          {actionText}
        </button>
      )}
    </div>
  );
};

export default EmptyState;

import React from 'react';

const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  colorScheme = 'pink', // 'pink', 'blue', 'green', 'amber', 'purple'
  highlight = false,
}) => {
  const schemes = {
    pink: {
      bgIcon: 'var(--accent-soft)',
      colorIcon: 'var(--primary)',
      border: highlight ? 'var(--primary)' : 'var(--border-color)',
    },
    green: {
      bgIcon: 'var(--success-light)',
      colorIcon: 'var(--success-text)',
      border: highlight ? 'var(--success)' : 'var(--border-color)',
    },
    amber: {
      bgIcon: 'var(--warning-light)',
      colorIcon: 'var(--warning-text)',
      border: highlight ? 'var(--warning)' : 'var(--border-color)',
    },
    blue: {
      bgIcon: 'var(--info-light)',
      colorIcon: 'var(--info-text)',
      border: highlight ? 'var(--info)' : 'var(--border-color)',
    },
    purple: {
      bgIcon: '#F3E8FF',
      colorIcon: '#7E22CE',
      border: highlight ? '#9333EA' : 'var(--border-color)',
    },
  };

  const currentScheme = schemes[colorScheme] || schemes.pink;

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
        borderColor: currentScheme.border,
        background: highlight ? 'linear-gradient(180deg, #FFFFFF 0%, #FFF5F8 100%)' : 'var(--bg-card)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {title}
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px', fontFamily: 'var(--font-heading)' }}>
            {value}
          </div>
        </div>
        {Icon && (
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: currentScheme.bgIcon,
              color: currentScheme.colorIcon,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon size={24} />
          </div>
        )}
      </div>

      {subtitle && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {subtitle}
        </div>
      )}
    </div>
  );
};

export default StatCard;

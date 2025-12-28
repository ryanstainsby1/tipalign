import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AppLogo() {
  const navigate = useNavigate();
  
  return (
    <div 
      onClick={() => navigate(createPageUrl('Dashboard'))}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        height: '64px',
        paddingLeft: '20px',
        cursor: 'pointer'
      }}
      role="button"
      tabIndex={0}
      aria-label="Tiply – Navigate to Dashboard"
      onKeyDown={(e) => e.key === 'Enter' && navigate(createPageUrl('Dashboard'))}
    >
      <img 
        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69492be29f510e4f29fe435b/01bc0fe1b_ChatGPTImageDec28202501_53_32PM.png" 
        alt="Tiply – digital tip management"
        style={{
          height: '40px',
          width: 'auto',
          maxWidth: '180px',
          objectFit: 'contain',
          display: 'block'
        }}
      />
    </div>
  );
}
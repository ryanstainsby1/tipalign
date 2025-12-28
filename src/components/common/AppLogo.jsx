import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AppLogo() {
  const navigate = useNavigate();
  
  return (
    <img 
      src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69492be29f510e4f29fe435b/01bc0fe1b_ChatGPTImageDec28202501_53_32PM.png" 
      alt="Tiply - digital tip management platform"
      onClick={() => navigate(createPageUrl('Dashboard'))}
      style={{
        width: '120px',
        height: 'auto',
        display: 'block',
        margin: '16px 0 0 20px',
        cursor: 'pointer'
      }}
    />
  );
}
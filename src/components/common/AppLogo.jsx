import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AppLogo() {
  const navigate = useNavigate();
  
  return (
    <img 
      src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69492be29f510e4f29fe435b/8a13ba3a4_Screenshot2026-01-30at210737.png" 
      alt="Tiply – digital tip management"
      onClick={() => navigate(createPageUrl('Dashboard'))}
      style={{
        height: '60px',
        width: 'auto',
        maxWidth: '240px',
        objectFit: 'contain',
        display: 'block',
        margin: '0 auto',
        cursor: 'pointer'
      }}
    />
  );
}
import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AppLogo({ size = 'default' }) {
  const isCompact = size === 'compact';
  
  return (
    <Link 
      to={createPageUrl('Dashboard')} 
      className="flex items-center"
      aria-label="Tiply – Navigate to Dashboard"
    >
      <img 
        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69492be29f510e4f29fe435b/01bc0fe1b_ChatGPTImageDec28202501_53_32PM.png" 
        alt="Tiply – digital tip management" 
        className={isCompact ? 'h-6 w-auto' : 'h-8 w-auto max-w-[140px]'}
        style={{ objectFit: 'contain' }}
      />
    </Link>
  );
}
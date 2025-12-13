// Centralized color palette & spacing. Use white + modern blue theme.
export const palette = {
  // Backgrounds
  white: '#ffffff',
  bg: '#f8fafc',
  card: '#ffffff',
  
  // Text colors
  text: '#1e293b',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  
  // Primary colors
  primary: '#2563eb',
  primaryLight: '#3b82f6',
  primaryBg: '#eff6ff',
  
  // Status colors
  success: '#10b981',
  successBg: '#ecfdf5',
  danger: '#ef4444',
  dangerBg: '#fef2f2',
  warning: '#f59e0b',
  warningBg: '#fffbeb',
  
  // Neutral
  gray: '#64748b',
  grayLight: '#f1f5f9',
  border: '#e2e8f0',
};

export const spacing = { 
  xs: 4, 
  sm: 8, 
  md: 16, 
  lg: 20, 
  xl: 24 
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const shadows = {
  sm: {
    // iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    // Android
    elevation: 1,
  },
  md: {
    // iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    // Android
    elevation: 2,
  },
  lg: {
    // iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    // Android
    elevation: 4,
  },
};

export default { palette, spacing, borderRadius, shadows };

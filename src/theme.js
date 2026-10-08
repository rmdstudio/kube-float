// Copyright (c) 2026 rmd Studio Inc. MIT License.
import { createTheme } from '@mui/material/styles';

// Panels are glass: the ocean stays visible behind them.
export const glass = {
  backgroundColor: 'rgba(6, 20, 40, 0.72)',
  backgroundImage: 'none',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(120, 200, 255, 0.16)',
};

export default createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#35e0d0' },
    secondary: { main: '#a78bfa' },
    background: { default: '#020a18', paper: '#061428' },
  },
  shape: { borderRadius: 10 },
  typography: { fontSize: 13 },
});

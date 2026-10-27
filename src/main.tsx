import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import '@fontsource/cairo/400.css';
import '@fontsource/cairo/600.css';
import '@fontsource/cairo/700.css';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.load('16px Cairo');
  document.fonts.load('600 16px Cairo');
  document.fonts.load('bold 16px Cairo');
}

import './global.css';
import {createRoot} from 'react-dom/client';
import {App} from './app.tsx';

const container = document.getElementById('root');
if (!container) {
  // Not a soft failure. A missing root means the HTML and this bundle have
  // drifted apart, and the page would come up blank with nothing in the console
  // to say why.
  throw new Error('#root is missing from the new tab page document');
}
createRoot(container).render(<App />);

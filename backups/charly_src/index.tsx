import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

console.log('Application starting...');
console.log('React version:', React.version);

const rootElement = document.getElementById('root');
console.log('Root element found:', !!rootElement);

if (!rootElement) {
  console.error('Root element not found!');
  throw new Error('Root element not found');
}

const root = ReactDOM.createRoot(rootElement);
console.log('React root created successfully');

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

console.log('App component rendered to DOM');

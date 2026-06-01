import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import router from './router';

function App() {
  useEffect(() => {
    // Load theme from localStorage on startup
    const savedTheme = localStorage.getItem('eatsy_theme_color');
    if (savedTheme) {
      document.documentElement.style.setProperty('--primary-color', savedTheme);
    }
  }, []);

  return (
    <>
      <RouterProvider router={router} />
      <ToastContainer position="top-right" autoClose={3000} />
    </>
  );
}

export default App;

import { createBrowserRouter, Navigate } from 'react-router-dom';
import Login from '@pages/Login/Login';
import ChatPage from '@pages/Chat/ChatPage';
import { useSelector } from 'react-redux';

// Private Route Component
const PrivateRoute = ({ children }) => {
  const { isAuthenticated } = useSelector((state) => state.auth);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: (
      <PrivateRoute>
        <ChatPage />
      </PrivateRoute>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export default router;

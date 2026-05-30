export const getAvatarUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  
  const baseUrl = process.env.REACT_APP_SERVER_BASE_URL || 'http://localhost:5678';
  
  // Normalize path (ensure leading slash)
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  return `${baseUrl}${normalizedPath}`;
};

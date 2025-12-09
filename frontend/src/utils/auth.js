class AuthService {
  static login = async (username, password) => {
    try {
      const response = await fetch('https://double-entry-accounting-system-backend.onrender.com/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }
      
      if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
      } else {
        throw new Error(data.error || 'Login failed');
      }
    } catch (error) {
      throw error;
    }
  };

  static logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  static getToken = () => {
    return localStorage.getItem('token');
  };

  static getUser = () => {
    const userStr = localStorage.getItem('user');
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      return null;
    }
  };

  static isAuthenticated = () => {
    const token = this.getToken();
    const user = this.getUser();
    return !!(token && user);
  };

  static isAdmin = () => {
    const user = this.getUser();
    return user && user.role === 'admin';
  };

  static isViewer = () => {
    const user = this.getUser();
    return user && user.role === 'viewer';
  };

  static getRole = () => {
    const user = this.getUser();
    return user ? user.role : null;
  };

  static verifyToken = async () => {
    try {
      const token = this.getToken();
      if (!token) return { success: false, error: 'No token' };

      const response = await fetch('https://double-entry-accounting-system-backend.onrender.com/api/auth/verify', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  static getAuthHeader = () => {
    const token = this.getToken();
    if (token) {
      return { 'Authorization': `Bearer ${token}` };
    }
    return {};
  };

  static updateProfile = (userData) => {
    const currentUser = this.getUser();
    if (currentUser) {
      const updatedUser = { ...currentUser, ...userData };
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };
}


export default AuthService;

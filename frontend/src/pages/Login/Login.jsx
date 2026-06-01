import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '@features/auth/authSlice';
import styles from './Login.module.css';

const MailIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const LockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const EyeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const AlertIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isLoading, error } = useSelector((state) => state.auth);

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(loginUser({ email, password, rememberMe }))
      .unwrap()
      .then(() => {
        navigate('/');
      })
      .catch((err) => {
        console.error('Login failed:', err);
      });
  };

  return (
    <div className={styles.loginContainer}>
      
      <div className={styles.brandingPanel}>
        <div className={styles.glassCard}>
          <span className={styles.brandLogo}>🛍️</span>
          <h1>Eatsy Food<br />Thương Mại Điện Tử</h1>
          <p>Nền tảng giao tiếp và hỗ trợ trực tuyến thời gian thực. Giúp kết nối mượt mà giữa người mua, đối tác bán hàng và bộ phận chăm sóc khách hàng của Eatsy.</p>
        </div>
      </div>

      <div className={styles.formPanel}>
        <div className={styles.loginCard}>
          
          <div className={styles.formHeader}>
            <h2>Đăng nhập Hệ thống</h2>
            <p>Vui lòng đăng nhập để bắt đầu phiên làm việc</p>
          </div>

          {error && (
            <div className={styles.errorBox}>
              <AlertIcon />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            
            <div className={styles.floatingGroup}>
              <input
                id="email"
                type="email"
                className={styles.floatingInput}
                placeholder=" "
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <label htmlFor="email" className={styles.floatingLabel}>Email đăng nhập</label>
              <span className={styles.inputIcon}><MailIcon /></span>
            </div>

            <div className={styles.floatingGroup}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className={styles.floatingInput}
                placeholder=" "
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <label htmlFor="password" className={styles.floatingLabel}>Mật khẩu</label>
              <span className={styles.inputIcon}><LockIcon /></span>
              
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>

            <div className={styles.optionsRow}>
              <label className={styles.rememberMe}>
                <input 
                  type="checkbox" 
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Ghi nhớ đăng nhập
              </label>
              <a href="#" className={styles.forgotPassword} onClick={(e) => e.preventDefault()}>
                Quên mật khẩu?
              </a>
            </div>

            <button 
              type="submit" 
              className={styles.submitBtn} 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <svg className={styles.animateSpin} width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Đang xác thực...
                </>
              ) : (
                'Đăng nhập ngay'
              )}
            </button>
            
          </form>
        </div>
      </div>
      
    </div>
  );
};

export default Login;

export interface User {
  id: string;
  email: string;
  walletId?: string;
  avatarUrl?: string | null;
  name?: string | null;
  bio?: string | null;
  role?: string;
  xpBalance?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignUpCredentials {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  message: string;
}

export interface AuthError {
  message: string;
  field?: string;
}




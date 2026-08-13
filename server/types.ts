export interface AuthUser {
  id: number;
  email: string;
  displayName: string;
  role: "admin" | "member";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

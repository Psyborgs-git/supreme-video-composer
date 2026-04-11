export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface AuthSession {
  id: string;
  userId: string;
  expiresAt: string;
}

export type OrgRole = "owner" | "admin" | "member" | "viewer";

export const ROLE_HIERARCHY: Record<OrgRole, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
};

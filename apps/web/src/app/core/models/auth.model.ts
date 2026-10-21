export interface AuthUser {
  userId: string;
  email: string;
  displayName: string;
  householdId: string;
  membershipId: string;
  role: 'ADMIN' | 'MEMBER';
  color: string;
}

export interface LoginModel {
  email: string;
  password: string;
}

export interface RegisterModel extends LoginModel {
  displayName: string;
  householdName: string;
}

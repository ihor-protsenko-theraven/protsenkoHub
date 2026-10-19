import type { MemberRole } from '@prisma/client';

export interface AuthUser {
  userId: string;
  email: string;
  displayName: string;
  householdId: string;
  membershipId: string;
  role: MemberRole;
  color: string;
}

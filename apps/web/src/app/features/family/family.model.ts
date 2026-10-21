export interface FamilyMember {
  id: string;
  displayName: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
}

export interface FamilyInvitation {
  id: string;
  email: string;
  expiresAt: string;
  createdBy: { displayName: string } | null;
}

export interface FamilyOverview {
  name: string;
  members: FamilyMember[];
  invitations: FamilyInvitation[];
}

export interface InvitationPreview {
  email: string;
  householdName: string;
  expiresAt: string;
}

export interface InviteRegistration {
  displayName: string;
  password: string;
}

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

export interface FamilyChildProfile {
  name: string;
  birthDate: string | null;
  ageLabel: string | null;
  updatedByName: string | null;
}

export interface FamilyOverview {
  name: string;
  child: FamilyChildProfile | null;
  members: FamilyMember[];
  invitations: FamilyInvitation[];
}

export interface ChildProfileForm {
  name: string;
  birthDate: string;
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

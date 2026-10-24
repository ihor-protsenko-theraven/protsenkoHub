export interface NavItem {
  path: string;
  label: string;
  icon: 'home' | 'calendar' | 'shopping' | 'children' | 'sleep' | 'contacts' | 'family';
  description: string;
}

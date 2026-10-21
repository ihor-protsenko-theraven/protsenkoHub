export interface ToastMessage {
  id: number;
  text: string;
  kind: 'error' | 'success';
  role: 'alert' | 'status';
}

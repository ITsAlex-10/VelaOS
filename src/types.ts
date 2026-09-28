/**
 * Vela OS Types
 */

export type ProjectStage = 
  | 'Lead' 
  | 'Pendente' 
  | 'Cliente' 
  | 'Terminado';

export interface Payment {
  id: string;
  amount: number;
  date: string;
  status: 'pending' | 'received';
  type: 'adjudication' | 'final';
}

export interface ClientNote {
  id: string;
  content: string;
  date: string;
  author: string;
}

export interface ClientFile {
  id: string;
  name: string;
  size: string;
  date: string;
  type: string;
}

export interface ClientUser {
  id: string;
  name: string;
  email: string;
}

export interface Meeting {
  id: string;
  clientName: string;
  date: string;
  time: string;
  rawDate: string; // ISO format for sorting
  type: 'Discovery' | 'Proposal' | 'Check-in' | 'Delivery';
  link?: string;
}

export interface Proposal {
  id: string;
  title: string;
  value: number;
  date: string;
  status: 'pendente' | 'aceite' | 'rejeitada' | 'expira em breve';
  fileUrl?: string; // Link to the document (e.g., in Google Drive)
  previewUrl?: string; // Optional preview thumbnail
  deadline?: string;
  discountAmount?: number; // Discount in EUR
  discountExpiry?: string; // ISO date
  hasDiscountApplied?: boolean;
}

export interface Client {
  id: string;
  name: string;
  logo?: string;
  contactName: string;
  email: string;
  dashboardEmail?: string; // Email empowered to access dashboard
  phone?: string;
  serviceType: string;
  totalValue: number;
  receivedAmount: number;
  status: ProjectStage;
  lastInteraction: string;
  nextAction?: string;
  payments: Payment[];
  notes: ClientNote[];
  files: ClientFile[];
  proposal?: Proposal;
  driveFolderId?: string;
  chatSpaceId?: string;
  hasDashboardAccess?: boolean;
  clientUsers?: ClientUser[];
  clientEmails?: string[];
}

export interface Activity {
  id: string;
  type: 'payment' | 'proposal' | 'meeting' | 'file' | 'project';
  description: string;
  timestamp: string;
  clientName: string;
}

export interface DashboardStats {
  totalSales: number;
  totalReceived: number;
  pendingRevenue: number;
  activeClients: number;
  activeProjects: number;
  meetingsThisWeek: number;
}

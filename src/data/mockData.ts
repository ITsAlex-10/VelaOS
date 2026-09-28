import { Client, Activity, Meeting } from '../types';

export const mockClients: Client[] = [
  {
    id: '1',
    name: 'Luminary Studio',
    contactName: 'Sarah Chen',
    email: 'sarah@luminary.com',
    serviceType: 'Identidade de Marca',
    totalValue: 8500,
    receivedAmount: 4250,
    status: 'Cliente',
    lastInteraction: '2024-05-20',
    nextAction: 'Rever sistema de design',
    payments: [
      { id: 'p1', amount: 4250, date: '2024-05-01', status: 'received', type: 'adjudication' },
      { id: 'p2', amount: 4250, date: '2024-06-15', status: 'pending', type: 'final' }
    ],
    notes: [
      { id: 'n1', content: 'Prefere estética minimalista com alto contraste.', date: '2024-05-01', author: 'Alex' }
    ],
    files: [
      { id: 'f1', name: 'Briefing_Marca.pdf', size: '2.4 MB', date: '2024-05-02', type: 'PDF' },
      { id: 'f2', name: 'Referencias_Aesthetic.zip', size: '45 MB', date: '2024-05-05', type: 'ZIP' },
      { id: 'f3', name: 'Logo_Existente.svg', size: '12 KB', date: '2024-05-05', type: 'SVG' }
    ],
    proposal: {
      id: 'pr1',
      title: 'Proposta Identidade Luminary',
      value: 8500,
      date: '2024-04-28',
      status: 'aceite',
      deadline: '15 Mai',
      fileUrl: '#'
    }
  },
  {
    id: '2',
    name: 'Horizon Labs',
    contactName: 'Marcus Wright',
    email: 'm.wright@horizon.io',
    serviceType: 'Desenvolvimento Web',
    totalValue: 12000,
    receivedAmount: 6000,
    status: 'Pendente',
    lastInteraction: '2024-05-25',
    nextAction: 'Aprovação do cliente no PRD',
    payments: [
      { id: 'p3', amount: 6000, date: '2024-05-10', status: 'received', type: 'adjudication' },
      { id: 'p4', amount: 6000, date: '2024-06-30', status: 'pending', type: 'final' }
    ],
    notes: [],
    files: [
      { id: 'f4', name: 'Requisitos_Tecnicos.docx', size: '850 KB', date: '2024-05-12', type: 'DOCX' }
    ],
    proposal: {
      id: 'pr2',
      title: 'Desenvolvimento Plataforma Horizon',
      value: 12000,
      date: '2024-05-05',
      status: 'pendente',
      deadline: '02 Jun',
      discountAmount: 1200,
      fileUrl: '#'
    }
  },
  {
    id: '3',
    name: 'Alterra Coffee',
    contactName: 'Elena Rossi',
    email: 'elena@alterra.coffee',
    serviceType: 'E-commerce',
    totalValue: 15000,
    receivedAmount: 15000,
    status: 'Terminado',
    lastInteraction: '2024-05-10',
    payments: [
      { id: 'p5', amount: 7500, date: '2024-04-01', status: 'received', type: 'adjudication' },
      { id: 'p6', amount: 7500, date: '2024-05-10', status: 'received', type: 'final' }
    ],
    notes: [],
    files: [
      { id: 'f5', name: 'Catalogo_Produtos_2024.xlsx', size: '1.2 MB', date: '2024-04-05', type: 'XLSX' }
    ],
    proposal: {
      id: 'pr3',
      title: 'E-commerce Alterra V2',
      value: 15000,
      date: '2024-03-25',
      status: 'aceite',
      fileUrl: '#'
    }
  },
  {
    id: '4',
    name: 'Nexus Ventures',
    contactName: 'David Kim',
    email: 'david@nexus.vc',
    serviceType: 'Design UI/UX',
    totalValue: 6000,
    receivedAmount: 0,
    status: 'Pendente',
    lastInteraction: '2024-05-28',
    nextAction: 'Seguimento da proposta',
    payments: [
      { id: 'p7', amount: 3000, date: '2024-06-05', status: 'pending', type: 'adjudication' },
      { id: 'p8', amount: 3000, date: '2024-07-05', status: 'pending', type: 'final' }
    ],
    notes: [],
    files: [],
    proposal: {
      id: 'pr4',
      title: 'UX Audit & Redesign Nexus',
      value: 6000,
      date: '2024-05-25',
      status: 'pendente',
      deadline: '05 Jun',
      discountAmount: 900,
      fileUrl: '#'
    }
  },
  {
    id: '5',
    name: 'Koda Robotics',
    contactName: 'James Wilson',
    email: 'james@koda.ai',
    serviceType: 'Estratégia de Produto',
    totalValue: 10000,
    receivedAmount: 5000,
    status: 'Pendente',
    lastInteraction: '2024-05-27',
    nextAction: 'Enviar fatura final',
    payments: [
      { id: 'p9', amount: 5000, date: '2024-04-15', status: 'received', type: 'adjudication' },
      { id: 'p10', amount: 5000, date: '2024-05-30', status: 'pending', type: 'final' }
    ],
    notes: [],
    files: [],
    proposal: {
      id: 'pr5',
      title: 'Product Strategy Koda V1',
      value: 10000,
      date: '2024-04-10',
      status: 'aceite',
      fileUrl: '#'
    }
  }
];

export const mockActivities: Activity[] = [
  { id: 'a1', type: 'payment', description: 'Pagamento de €4,250 recebido', timestamp: 'há 2 horas', clientName: 'Luminary Studio' },
  { id: 'a2', type: 'proposal', description: 'Proposta de identidade de marca enviada', timestamp: 'há 5 horas', clientName: 'Nexus Ventures' },
  { id: 'a3', type: 'meeting', description: 'Chamada de descoberta agendada', timestamp: 'há 1 dia', clientName: 'Horizon Labs' },
  { id: 'a4', type: 'file', description: 'Novo ativo carregado: Logo_Final.svg', timestamp: 'há 2 dias', clientName: 'Alterra Coffee' },
];

export const mockMeetings: Meeting[] = [
  { id: 'm1', clientName: 'Luminary Studio', date: '30 de Maio, 2024', time: '10:00 AM', rawDate: '2024-05-30T10:00:00Z', type: 'Check-in', link: '#' },
  { id: 'm2', clientName: 'Nexus Ventures', date: '31 de Maio, 2024', time: '14:30', rawDate: '2024-05-31T14:30:00Z', type: 'Proposal', link: '#' },
  { id: 'm3', clientName: 'Horizon Labs', date: '2 de Junho, 2024', time: '11:00 AM', rawDate: '2024-06-02T11:00:00Z', type: 'Discovery', link: '#' },
];

export const mockProposals = [
  { id: '1', client: 'Velvet Horizon', value: 4500, service: 'Branding', deadline: '05 Jun', discountAmount: 500, expiresHours: 48, status: 'Pendente' },
  { id: '2', client: 'Aether Group', value: 2800, service: 'Web App', deadline: '02 Jun', discountAmount: 200, expiresHours: 12, status: 'Pendente' },
  { id: '3', client: 'Stellar Labs', value: 7200, service: 'Estratégia', deadline: '10 Jun', discountAmount: 300, expiresHours: 72, status: 'Aguardando' },
];

export const revenueData = [
  { month: 'Jan', sales: 12000, received: 8000 },
  { month: 'Fev', sales: 15000, received: 11000 },
  { month: 'Mar', sales: 22000, received: 14000 },
  { month: 'Abr', sales: 18000, received: 16000 },
  { month: 'Mai', sales: 30000, received: 15000 },
];

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { getAccessToken, initAuth, firestore, auth, googleSignIn, invalidateToken } from '../lib/firebase';
import { workspaceAPI, backendAPI } from '../lib/workspace';
import { Client, Proposal, Meeting, Activity, Payment } from '../types';
import { calculateNextBillingDate, formatFrequencyLabel, getTodayISO } from '../lib/billing';

interface WorkspaceContextType {
  accessToken: string | null;
  isLoading: boolean;
  isClientsLoaded: boolean;
  syncStatus: {
    drive: boolean;
    calendar: boolean;
    chat: boolean;
    sheets: boolean;
  };
  syncError: string | null;
  clients: Client[];
  leads: any[];
  prospects: any[];
  proposals: Proposal[];
  meetings: Meeting[];
  activities: Activity[];
  refreshStatus: () => Promise<void>;
  setToken: (token: string | null) => void;
  login: () => Promise<void>;
  syncClientsToSheets: () => Promise<void>;
  importFromSheets: () => Promise<void>;
  getOrCreateDriveFolder: (clientName: string) => Promise<string>;
  createClient: (clientData: Partial<Client>) => Promise<string | undefined>;
  addClient: (clientData: Partial<Client>) => Promise<string | undefined>;
  updateClient: (id: string, data: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  createLead: (leadData: Partial<any>) => Promise<string | undefined>;
  updateLead: (id: string, data: Partial<any>) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  createProspect: (prospectData: Partial<any>) => Promise<string | undefined>;
  updateProspect: (id: string, data: Partial<any>) => Promise<void>;
  deleteProspect: (id: string) => Promise<void>;
  importDiscoveredToLeads: (businesses: any[]) => Promise<void>;
  moveLeadToProspects: (leadId: string, partialData?: Partial<any>) => Promise<void>;
  moveProspectToClients: (prospectId: string, partialData?: Partial<any>) => Promise<void>;
  uploadFile: (clientId: string, folderId: string, file: File) => Promise<void>;
  createClientProject: (name: string) => Promise<any>;
  scheduleMeet: (summary: string, startTime: string) => Promise<any>;
  updateMeeting: (meetingId: string, startTime: string) => Promise<any>;
  deleteMeeting: (meetingId: string) => Promise<any>;
  getClientFiles: (folderId: string) => Promise<any[]>;
  getOrCreateChatSpace: (client: Client) => Promise<string>;
  getChatMessages: (spaceId: string) => Promise<any[]>;
  sendChatMessage: (spaceId: string, text: string) => Promise<any>;
  deleteFile: (fileId: string) => Promise<void>;
  createProposal: (proposalData: Partial<Proposal>) => Promise<string | undefined>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [targetCalendarId, setTargetCalendarId] = useState<string | null>(null);
  const [status, setStatus] = useState({
    drive: false,
    calendar: false,
    chat: true, // Default to true as DM fallback always works
    sheets: false,
    chatRestricted: false // New state to track API failures
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [prospects, setProspects] = useState<any[]>([]);
  const [isClientsLoaded, setIsClientsLoaded] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const processedRecurringRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = initAuth(
      async (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
        setIsLoading(false);
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setAccessToken(res.accessToken);
      }
    } catch (e) {
      console.error("Login error:", e);
    }
  };

  const handleAuthError = (e: any) => {
    if (e.message?.includes('401') || e.message?.includes('Invalid Credentials')) {
      invalidateToken();
      setAccessToken(null);
    }
    throw e;
  };

  const getOrCreateTargetCalendar = async (token: string): Promise<string> => {
    if (targetCalendarId) return targetCalendarId;

    try {
      // 1. Fetch calendar list
      const listRes = await workspaceAPI.calendar.listCalendars(token);
      
      // Look for a calendar named "Agenda Vela" or "Agência Vela" or "Agencia Vela" (case-insensitive)
      const found = listRes.items?.find((cal: any) => {
        const summary = (cal.summary || '').toLowerCase();
        return summary === 'agenda vela' || summary === 'agência vela' || summary === 'agencia vela';
      });

      if (found) {
        setTargetCalendarId(found.id);
        return found.id;
      }

      // 2. If not found, create a new secondary calendar
      console.log("Calendar 'Agenda Vela' not found. Creating it...");
      const newCal = await workspaceAPI.calendar.createCalendar(token, 'Agenda Vela');
      if (newCal && newCal.id) {
        setTargetCalendarId(newCal.id);
        return newCal.id;
      }
      
      return 'primary';
    } catch (err: any) {
      console.warn("Failed to find or create 'Agenda Vela' calendar, falling back to primary:", err?.message || err);
      if (err.message?.includes('401') || String(err).includes('401') || err.message?.includes('Invalid Credentials')) {
        invalidateToken();
        setAccessToken(null);
        throw err;
      }
      return 'primary';
    }
  };

  // Sync to Sheets
  const syncClientsToSheets = async (customClients?: Client[]) => {
    if (!accessToken || isSyncing) return;
    setIsSyncing(true);
    try {
      const itemsToSync = customClients !== undefined ? customClients : clients;

      // First, find or create the VELA_OS_MASTER sheet
      const driveRes = await workspaceAPI.drive.listFiles(accessToken, "name = 'VELA_OS_CLIENTS_MASTER' and mimeType = 'application/vnd.google-apps.spreadsheet'");
      let sheetId = driveRes.files?.[0]?.id;
      let spreadsheet;

      if (!sheetId) {
        spreadsheet = await workspaceAPI.sheets.createSpreadsheet(accessToken, 'VELA_OS_CLIENTS_MASTER');
        sheetId = spreadsheet.spreadsheetId;
        
        // Write headers
        const headers = [['ID', 'Nome', 'Email', 'Contacto', 'Estado', 'Valor Total', 'Liquidado', 'Notas', 'Acessos Nomes', 'Acessos Emails']];
        const sheetName = spreadsheet.sheets?.[0]?.properties?.title || 'Sheet1';
        await workspaceAPI.sheets.updateValues(accessToken, sheetId, `'${sheetName}'!A1`, headers);
      } else {
        spreadsheet = await workspaceAPI.sheets.getSpreadsheet(accessToken, sheetId);
      }

      const sheetName = spreadsheet.sheets?.[0]?.properties?.title || 'Sheet1';

      // Clear old data rows to avoid duplicates or ghost rows
      await workspaceAPI.sheets.clearValues(accessToken, sheetId, `'${sheetName}'!A2:J500`);

      if (itemsToSync.length > 0) {
        const values = itemsToSync.map(c => [
          c.id, 
          c.name, 
          c.email || '', 
          c.phone || '', 
          c.status || '', 
          c.totalValue || 0, 
          c.receivedAmount || 0,
          (c.notes || []).map(n => `[${n.date}] ${n.content}`).join(' | '),
          (c.clientUsers || []).map(u => u.name).join(' | '),
          (c.clientEmails || []).join(' | ')
        ]);
        await workspaceAPI.sheets.updateValues(accessToken, sheetId, `'${sheetName}'!A2`, values);
      }
      setStatus(prev => ({ ...prev, sheets: true }));
    } catch (e: any) {
      if (e.message?.includes('401')) setAccessToken(null);
      // Silent in background
    } finally {
      setIsSyncing(false);
    }
  };

  const importFromSheets = async () => {
    if (!accessToken) return;
    try {
      const driveRes = await workspaceAPI.drive.listFiles(accessToken, "name = 'VELA_OS_CLIENTS_MASTER' and mimeType = 'application/vnd.google-apps.spreadsheet'");
      const sheetId = driveRes.files?.[0]?.id;
      if (!sheetId) return;

      const spreadsheet = await workspaceAPI.sheets.getSpreadsheet(accessToken, sheetId);
      const sheetName = spreadsheet.sheets?.[0]?.properties?.title || 'Sheet1';
      
      const res = await workspaceAPI.sheets.getValues(accessToken, sheetId, `${sheetName}!A2:J500`); 
      const rows = res.values;
      
      if (!rows || rows.length === 0) return;

      const freshClients = await firestore.query('clients') as Client[];

      for (const row of rows) {
         const [id, name, email, phone, status, totalValue, receivedAmount, notesStr, accessNamesStr, accessEmailsStr] = row;
         if (!name) continue;
         if (name.toLowerCase().includes('teste')) continue; // Skip test clients during import

         // Clean currency strings
         const cleanNum = (val: any) => {
           if (typeof val === 'string') {
             return Number(val.replace(/[^0-9.-]+/g, "")) || 0;
           }
           return Number(val) || 0;
         };

         // Parse notes if they exist in format "[Date] Content | [Date] Content"
         let notes: any[] = [];
         if (notesStr && typeof notesStr === 'string') {
           notes = notesStr.split(' | ').filter(Boolean).map(n => {
             const match = n.match(/\[(.*?)\] (.*)/);
             return {
               id: Math.random().toString(36).substring(7),
               date: match ? match[1] : new Date().toLocaleDateString('pt-PT'),
               content: match ? match[2] : n,
               author: 'Sistema'
             };
           });
         }

         let clientUsers: any[] = [];
         let clientEmails: string[] = [];
         if (accessNamesStr && accessEmailsStr) {
           const names = String(accessNamesStr).split(' | ');
           const emails = String(accessEmailsStr).split(' | ');
           clientEmails = emails.map(e => e.trim().toLowerCase()).filter(Boolean);
           clientUsers = names.map((nameVal, i) => ({
             id: Math.random().toString(36).substring(7),
             name: nameVal.trim(),
             email: emails[i] ? emails[i].trim().toLowerCase() : ''
           })).filter(u => u.name && u.email);
         }
         
         const existing = freshClients.find(c => c.name.toLowerCase().trim() === name.toLowerCase().trim());
         if (!existing) {
           await createClient({
             name,
             email: email || '',
             phone: phone || '',
             status: status || 'Lead',
             totalValue: cleanNum(totalValue),
             receivedAmount: cleanNum(receivedAmount),
             notes: notes,
             serviceType: 'Imported',
             lastInteraction: new Date().toISOString(),
             clientUsers,
             clientEmails
           });
         }
      }
    } catch (e: any) {
      // Background process - fail silently if restricted
    }
  };

  const getClientFiles = async (folderId: string) => {
    if (!accessToken) return [];
    try {
      const res = await workspaceAPI.drive.listFiles(accessToken, `'${folderId}' in parents and trashed = false`);
      return res.files || [];
    } catch (e: any) {
      console.error("Error fetching client files via client-side API:", e);
      return [];
    }
  };

  // Firestore Subscriptions (Runs instantly upon Firebase Auth login!)
  useEffect(() => {
    if (!currentUser) return;

    const unsubClients = firestore.subscribe('clients', [], (data) => {
      const ids = new Set();
      const uniqueData = (data as Client[]).filter(c => {
        if (!c.name) return false;
        if (c.name.toLowerCase().trim().includes('teste')) {
          firestore.delete('clients', c.id).catch(() => {});
          return false;
        }
        if (ids.has(c.id)) {
          console.warn("Duplicate client found in Firestore, filtering out:", c.id);
          return false;
        }
        ids.add(c.id);
        return true;
      });
      setClients(uniqueData);
      setIsClientsLoaded(true);
    });

    const unsubLeads = firestore.subscribe('leads', [], (data) => {
      setLeads(data);
    });

    const unsubProspects = firestore.subscribe('prospects', [], async (data) => {
      setProspects(data);
      
      // Auto-recovery: If any prospect has status 'Cliente', move it to clients collection
      const orphaned = data.filter(p => p.status === 'Cliente');
      if (orphaned.length > 0) {
        console.log(`Found ${orphaned.length} orphaned prospects. Moving to clients...`);
        for (const p of orphaned) {
          try {
            await moveProspectToClients(p.id);
            console.log(`Successfully recovered prospect: ${p.name}`);
          } catch (err) {
            console.error(`Failed to recover prospect ${p.name}:`, err);
          }
        }
      }
    });

    const unsubProposals = firestore.subscribe('proposals', [], (data) => {
      setProposals(data as any[]);
    });

    return () => {
      unsubClients();
      unsubLeads();
      unsubProspects();
      unsubProposals();
    };
  }, [currentUser]);

  // Sync Sheets on clients change
  useEffect(() => {
    if (accessToken) {
      syncClientsToSheets();
    }
  }, [clients, accessToken]);

  // Auto-generate due recurring payments for active recurring clients/projects
  useEffect(() => {
    if (!currentUser || !isClientsLoaded || clients.length === 0) return;

    const todayStr = getTodayISO();

    const processDueRecurring = async () => {
      for (const client of clients) {
        const rb = client.recurringBilling;
        if (!rb || !rb.enabled || !rb.active || !rb.nextBillingDate || !(rb.amount > 0)) continue;
        if (client.status !== 'Cliente') continue;
        if (rb.nextBillingDate > todayStr) continue;

        const key = `${client.id}_${rb.nextBillingDate}`;
        if (processedRecurringRef.current.has(key)) continue;
        processedRecurringRef.current.add(key);

        let cursorDate = rb.nextBillingDate;
        const existingPayments: Payment[] = [...(client.payments || [])];
        let addedAmount = 0;
        let safetyCount = 0;

        while (cursorDate <= todayStr && safetyCount < 12) {
          const alreadyExists = existingPayments.some(
            p => p.type === 'recurring' && p.date === cursorDate
          );
          if (!alreadyExists) {
            existingPayments.push({
              id: 'rec-' + Math.random().toString(36).substring(2, 9),
              amount: rb.amount,
              date: cursorDate,
              status: 'pending',
              type: 'recurring',
              description: `Recorrente (${formatFrequencyLabel(rb)})`
            });
            addedAmount += rb.amount;
          }
          cursorDate = calculateNextBillingDate(
            cursorDate,
            rb.frequency,
            rb.customIntervalValue,
            rb.customIntervalUnit
          );
          safetyCount++;
        }

        if (addedAmount > 0 || cursorDate !== rb.nextBillingDate) {
          try {
            await firestore.update('clients', client.id, {
              payments: existingPayments,
              totalValue: (client.totalValue || 0) + addedAmount,
              recurringBilling: {
                ...rb,
                nextBillingDate: cursorDate
              }
            });
          } catch (err) {
            console.warn(`Failed to generate recurring cycle for ${client.name}:`, err);
          }
        }
      }
    };

    processDueRecurring();
  }, [currentUser, isClientsLoaded, clients]);

  const fetchMeetings = async () => {
    if (!accessToken) return;
    try {
      const calId = await getOrCreateTargetCalendar(accessToken);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const res = await workspaceAPI.calendar.listEvents(accessToken, {
        timeMin: thirtyDaysAgo.toISOString()
      }, calId);
      if (res.items) {
        const mappedMeetings: Meeting[] = res.items
          .filter((event: any) => {
            // Exclude all-day events like holidays/birthdays that lack a specific start time
            if (!event.start?.dateTime) return false;
            
            // Exclude generic holiday, birthday or personal auto-reminders
            const summary = (event.summary || '').toLowerCase();
            if (
              summary.includes('aniversário') || 
              summary.includes('aniversario') || 
              summary.includes('birthday') ||
              summary.includes('feliz')
            ) {
              return false;
            }
            return true;
          })
          .map((event: any) => ({
            id: event.id,
            clientName: event.summary || 'Reunião Externa',
            date: new Date(event.start.dateTime || event.start.date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' }),
            time: new Date(event.start.dateTime || event.start.date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
            rawDate: event.start.dateTime || event.start.date,
            type: 'Check-in', 
            link: event.hangoutLink
          }));
        
        // Sort by date descending (most recent first)
        mappedMeetings.sort((a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime());
        
        setMeetings(mappedMeetings);
        setStatus(prev => ({ ...prev, calendar: true }));
      }
    } catch (e: any) {
      if (e.message?.includes('401')) {
        invalidateToken();
        setAccessToken(null);
      }
      console.warn("Calendar fetch skipped:", e.message || e);
      if (e.message?.includes('404')) {
         setStatus(prev => ({ ...prev, calendar: false }));
      }
      if (e.message?.includes('403') || e.message?.toLowerCase().includes('permission') || e.message?.toLowerCase().includes('insufficient')) {
         setStatus(prev => ({ ...prev, calendar: false }));
         setSyncError("Aviso: O seu login atual não autorizou o acesso ao Google Calendar. Por favor, clique em Sair (canto inferior esquerdo) e faça login novamente com o Google, certificando-se de marcar todas as caixas de autorização do calendário.");
      }
    }
  };

  // Fetch Calendar Meetings
  useEffect(() => {
    if (!accessToken) return;

    fetchMeetings();
    
    const interval = setInterval(fetchMeetings, 300000); 
    return () => clearInterval(interval);
  }, [accessToken]);

  // Auto-import from sheets on connection, only if database is completely empty
  useEffect(() => {
    /*
    if (!accessToken || !isClientsLoaded) return;

    if (clients.length === 0) {
      importFromSheets();
    }
    */
  }, [accessToken, isClientsLoaded]);

  const refreshStatus = async () => {
    if (!accessToken) {
      setSyncError("Não autenticado com o Google Workspace.");
      return;
    }
    setIsLoading(true);
    setSyncError(null);
    try {
      await fetchMeetings(); // Fetch meetings and update state
      
      const driveRes = await workspaceAPI.drive.listFiles(accessToken);
      const sheetsRes = await workspaceAPI.drive.listFiles(accessToken, "name = 'VELA_OS_CLIENTS_MASTER' and mimeType = 'application/vnd.google-apps.spreadsheet'");
      
      setStatus(prev => ({
        ...prev,
        drive: !!driveRes.files,
        sheets: !!sheetsRes.files?.[0]
      }));
    } catch (e: any) {
      const rawMsg = e.message || String(e);
      const isAuthError = rawMsg.includes('401') || rawMsg.includes('Invalid Credentials');
      
      if (isAuthError) {
        console.warn("Workspace session expired. Clearing token.");
        invalidateToken();
        setAccessToken(null);
        setSyncError("A sua sessão do Google Workspace expirou. Por favor, saia e entre novamente com o Google para reativar a sincronização.");
        return;
      }

      console.error("Sync error:", e);
      let friendlyMsg = rawMsg;
      if (rawMsg.includes('disabled') || rawMsg.includes('not been used') || rawMsg.includes('403') || rawMsg.includes('400')) {
        friendlyMsg = `Algumas APIs do Google Workspace não estão ativadas no seu projeto "metal-ocean-sjlsj" da Google Cloud Console. Por favor, aceda a console.cloud.google.com, selecione o projeto "metal-ocean-sjlsj" e ative as seguintes APIs: "Google Drive API", "Google Sheets API" e "Google Calendar API".`;
      }
      setSyncError(friendlyMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh Workspace status on connection/reload
  useEffect(() => {
    if (accessToken) {
      refreshStatus();
    }
  }, [accessToken]);

  const getOrCreateDriveFolder = async (clientName: string): Promise<string> => {
    if (!accessToken) return '';
    try {
      const res = await workspaceAPI.drive.createFolder(accessToken, `VELA_CLIENT: ${clientName}`);
      return res.id || '';
    } catch (e) {
      console.error("Failed to create Drive folder via workspaceAPI:", e);
      return '';
    }
  };

  // Auto-heal missing or misaligned drive folders for active clients/projects when accessToken is ready
  useEffect(() => {
    if (!accessToken || clients.length === 0) return;

    const autoHealFolders = async () => {
      for (const client of clients) {
        if (client.status === 'Lead') continue;
        
        try {
          if (!client.name) continue;
          const cleanName = client.name.trim();
          const cleanNameLower = cleanName.toLowerCase();
          
          // Case-insensitive folder search in Google Drive
          const res = await workspaceAPI.drive.listFiles(
            accessToken, 
            `name contains '${cleanName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
          );
          
          const matchedFolder = (res.files || []).find((f: any) => 
            f.name && f.name.toLowerCase().trim() === `vela_client: ${cleanNameLower}`
          );
          
          let correctFolderId = matchedFolder ? matchedFolder.id : '';

          // If folder exists in Drive but is different from client.driveFolderId, update Firestore
          if (correctFolderId && client.driveFolderId !== correctFolderId) {
            console.log(`Auto-aligning driveFolderId for ${client.name} to correct folder ID: ${correctFolderId}`);
            await firestore.update('clients', client.id, { driveFolderId: correctFolderId });
          } 
          // If no folder exists at all and driveFolderId is empty, create a new one
          else if (!correctFolderId && !client.driveFolderId) {
            console.log(`Creating brand new Drive folder for client: ${cleanName}`);
            const newFolder = await workspaceAPI.drive.createFolder(accessToken, `VELA_CLIENT: ${cleanName}`);
            if (newFolder?.id) {
              await firestore.update('clients', client.id, { driveFolderId: newFolder.id });
            }
          }
        } catch (e) {
          console.error(`Failed to auto-align/create Drive folder for ${client.name}:`, e);
        }
      }
    };

    autoHealFolders();
  }, [accessToken, clients]);

  const createClient = async (clientData: Partial<Client>) => {
    // Determine Drive folder creation - only for non-Leads
    let folderId = clientData.driveFolderId || '';
    const status = clientData.status || 'Lead';
    
    if (!folderId && accessToken && status !== 'Lead' && clientData.name) {
      folderId = await getOrCreateDriveFolder(clientData.name);
    }

    return firestore.add('clients', {
      ...clientData,
      status: status,
      driveFolderId: folderId
    });
  };

  const updateClient = async (id: string, data: Partial<Client>) => {
    console.log("Updating client/project with ID:", id);
    let collectionName = 'clients';
    let existingItem: any = clients.find(c => c.id === id);
    
    if (leads.some(l => l.id === id)) {
      collectionName = 'leads';
      existingItem = leads.find(l => l.id === id);
    } else if (prospects.some(p => p.id === id)) {
      collectionName = 'prospects';
      existingItem = prospects.find(p => p.id === id);
    }

    let extraData: Partial<Client> = {};

    // Logic for folder creation on status change
    if (accessToken && existingItem) {
      const oldStatus = existingItem.status;
      const newStatus = data.status || oldStatus;

      if (oldStatus === 'Lead' && newStatus !== 'Lead') {
        const folderId = existingItem.driveFolderId || await getOrCreateDriveFolder(existingItem.name);
        extraData.driveFolderId = folderId;
      }
    }

    await firestore.update(collectionName, id, { ...data, ...extraData });
    
    // Trigger sync in background depending on modified collection
    if (accessToken) {
      if (collectionName === 'leads') {
        syncLeadsToSheets();
      } else if (collectionName === 'prospects') {
        syncProspectsToSheets();
      } else {
        syncClientsToSheets();
      }
    }
  };

  const deleteClient = async (id: string) => {
    console.log("Attempting to delete item:", id);
    let collectionName = 'clients';
    
    // Check if it's a lead or prospect first
    if (leads.some(l => l.id === id)) {
      collectionName = 'leads';
      const updated = leads.filter(l => l.id !== id);
      setLeads(updated);
      try { await firestore.delete(collectionName, id); } catch (e) { /* ignore */ }
      if (accessToken) { try { await syncLeadsToSheets(updated); } catch (e) { /* ignore */ } }
    } else if (prospects.some(p => p.id === id)) {
      collectionName = 'prospects';
      const updated = prospects.filter(p => p.id !== id);
      setProspects(updated);
      try { await firestore.delete(collectionName, id); } catch (e) { /* ignore */ }
      if (accessToken) { try { await syncProspectsToSheets(updated); } catch (e) { /* ignore */ } }
    } else {
      // It's a client or project
      let targetItem = clients.find(c => c.id === id);
      const isSubProject = targetItem && !!targetItem.parentClientId;

      let itemsToDelete: any[] = [];

      if (isSubProject) {
        // Delete ONLY this specific sub-project!
        itemsToDelete = [targetItem];
      } else {
        // It's a main client or base record - delete client and its associated projects
        let mainClient = targetItem;
        const isSynthesized = !mainClient && clients.some(c => c.name === id);
        
        if (!mainClient && isSynthesized) {
          mainClient = clients.find(c => c.name === id);
        }

        const clientNameLower = (mainClient?.name || id || '').toLowerCase().trim();
        const isTestePurge = id === 'teste' || clientNameLower.includes('teste');
        const parentId = mainClient?.id || id;
        
        itemsToDelete = clients.filter(c => 
          c.id === id || 
          c.parentClientId === parentId || 
          c.id === parentId ||
          (c.name && c.name.toLowerCase().trim() === clientNameLower) ||
          (isTestePurge && (c.name || '').toLowerCase().includes('teste'))
        );

        if (isTestePurge) {
          const otherLeads = leads.filter(l => (l.name || '').toLowerCase().includes('teste'));
          const otherProspects = prospects.filter(p => (p.name || '').toLowerCase().includes('teste'));
          const otherClients = clients.filter(c => (c.name || '').toLowerCase().includes('teste'));
          
          for (const l of otherLeads) {
            try { await firestore.delete('leads', l.id); } catch (e) { /* ignore */ }
          }
          for (const p of otherProspects) {
            try { await firestore.delete('prospects', p.id); } catch (e) { /* ignore */ }
          }
          for (const c of otherClients) {
            if (!itemsToDelete.some(it => it.id === c.id)) {
              itemsToDelete.push(c);
            }
          }
        }
      }

      console.log(`Found ${itemsToDelete.length} items to delete in clients for ${id}`);
      
      // Delete Drive folders if authorized
      if (accessToken) {
        for (const item of itemsToDelete) {
          if (item.driveFolderId) {
            try { 
              await workspaceAPI.drive.trashFile(accessToken, item.driveFolderId); 
            } catch(e: any) { 
              try { await workspaceAPI.drive.deleteFile(accessToken, item.driveFolderId); } catch(delErr) { /* ignore */ }
            }
          }
        }
      }
      
      // Delete from Firestore
      for (const item of itemsToDelete) {
        try {
          await firestore.delete('clients', item.id);
        } catch (e) {
          console.warn(`Failed to delete client/project doc ${item.id} from Firestore:`, e);
        }
      }
      
      // Update local state
      const updated = clients.filter(c => !itemsToDelete.some(it => it.id === c.id) && !(isSubProject ? false : (c.name || '').toLowerCase().includes('teste')));
      setClients(updated);
      
      if (accessToken && !isSubProject) {
        try {
          await syncClientsToSheets(updated);
        } catch (e) {
          console.warn("Failed to sync clients to sheets after deletion:", e);
        }
      }
    }
  };

  const deleteProject = async (projectId: string) => {
    // Clean up associated standalone proposals if any
    const relatedProposals = proposals.filter(p => p.clientId === projectId);
    for (const prop of relatedProposals) {
      try {
        await firestore.delete('proposals', prop.id);
      } catch (e) {
        console.warn(`Failed to delete related proposal ${prop.id}:`, e);
      }
    }

    // Case 1: Pending project in prospects collection -> revert prospect to 'Por Agendar' and clear project/proposal data
    const targetProspect = prospects.find(p => p.id === projectId);
    if (targetProspect) {
      if (accessToken && targetProspect.driveFolderId) {
        try {
          await workspaceAPI.drive.trashFile(accessToken, targetProspect.driveFolderId);
        } catch (e) {
          try { await workspaceAPI.drive.deleteFile(accessToken, targetProspect.driveFolderId); } catch (delErr) { /* ignore */ }
        }
      }
      const revertedData = {
        status: 'Por Agendar',
        totalValue: 0,
        receivedAmount: 0,
        proposal: null,
        proposalFileUrl: '',
        proposalFileName: '',
        driveFolderId: '',
        payments: [],
        recurringBilling: null,
        lastInteraction: new Date().toISOString()
      };
      try {
        await firestore.update('prospects', targetProspect.id, revertedData);
      } catch (e) {
        console.warn(`Failed to revert prospect ${targetProspect.id} on project delete:`, e);
      }
      const updatedProspects = prospects.map(p => p.id === targetProspect.id ? { ...p, ...revertedData } : p);
      setProspects(updatedProspects);
      if (accessToken) {
        try {
          await syncProspectsToSheets(updatedProspects);
        } catch (e) {
          console.warn("Failed to sync prospects after project delete:", e);
        }
      }
      return;
    }

    // Case 2: Client or sub-project in clients collection
    const targetItem = clients.find(c => c.id === projectId);
    if (!targetItem) return;

    // Trash only this project's Drive folder
    if (accessToken && targetItem.driveFolderId) {
      try {
        await workspaceAPI.drive.trashFile(accessToken, targetItem.driveFolderId);
      } catch (e) {
        try { await workspaceAPI.drive.deleteFile(accessToken, targetItem.driveFolderId); } catch (delErr) { /* ignore */ }
      }
    }

    if (targetItem.parentClientId) {
      // Sub-project: delete ONLY this sub-project doc; parent client remains intact
      try {
        await firestore.delete('clients', targetItem.id);
      } catch (e) {
        console.warn(`Failed to delete sub-project ${targetItem.id} from Firestore:`, e);
      }
      setClients(prev => prev.filter(c => c.id !== targetItem.id));
    } else {
      // Primary project on main client doc: keep the client!
      const subProjects = clients.filter(c => c.parentClientId === targetItem.id);

      if (subProjects.length > 0) {
        // Promote first sub-project onto main client document so the client stays intact with remaining projects
        const promoted = subProjects[0];
        const promotedPayload: Partial<Client> = {
          serviceType: promoted.serviceType || '',
          status: promoted.status || 'Cliente',
          totalValue: promoted.totalValue || 0,
          receivedAmount: promoted.receivedAmount || 0,
          payments: promoted.payments || [],
          notes: promoted.notes || [],
          files: promoted.files || [],
          proposal: promoted.proposal || undefined,
          proposalFileUrl: promoted.proposalFileUrl || '',
          proposalFileName: promoted.proposalFileName || '',
          driveFolderId: promoted.driveFolderId || '',
          associatedMeetingId: promoted.associatedMeetingId || '',
          recurringBilling: promoted.recurringBilling || undefined,
          projectRemoved: false,
          lastInteraction: new Date().toISOString()
        };

        try {
          await firestore.update('clients', targetItem.id, {
            ...promotedPayload,
            proposal: promoted.proposal ?? null,
            recurringBilling: promoted.recurringBilling ?? null
          });
          await firestore.delete('clients', promoted.id);
        } catch (e) {
          console.warn(`Failed to promote sub-project ${promoted.id} while deleting main project ${targetItem.id}:`, e);
        }

        const updatedClients = clients
          .filter(c => c.id !== promoted.id)
          .map(c => c.id === targetItem.id ? { ...c, ...promotedPayload } : c);
        setClients(updatedClients);
        if (accessToken) {
          try { await syncClientsToSheets(updatedClients); } catch (e) { /* ignore */ }
        }
      } else {
        // Only project on client: clear project fields on client doc while keeping the client alive
        const clearedPayload = {
          serviceType: '',
          totalValue: 0,
          receivedAmount: 0,
          payments: [],
          files: [],
          proposal: null,
          proposalFileUrl: '',
          proposalFileName: '',
          driveFolderId: '',
          associatedMeetingId: '',
          recurringBilling: null,
          projectRemoved: true,
          lastInteraction: new Date().toISOString()
        };
        try {
          await firestore.update('clients', targetItem.id, clearedPayload);
        } catch (e) {
          console.warn(`Failed to clear project fields on client ${targetItem.id}:`, e);
        }
        const updatedClients = clients.map(c => c.id === targetItem.id
          ? {
              ...c,
              ...clearedPayload,
              proposal: undefined,
              recurringBilling: undefined
            }
          : c
        );
        setClients(updatedClients);
        if (accessToken) {
          try { await syncClientsToSheets(updatedClients); } catch (e) { /* ignore */ }
        }
      }
    }
  };

  // --- Leads CRUD & Sheets Sync ---
  const syncLeadsToSheets = async (customLeads?: any[]) => {
    if (!accessToken) return;
    try {
      const itemsToSync = customLeads !== undefined ? customLeads : leads;
      const driveRes = await workspaceAPI.drive.listFiles(accessToken, "name = 'VELA_OS_LEADS_MASTER' and mimeType = 'application/vnd.google-apps.spreadsheet'");
      let sheetId = driveRes.files?.[0]?.id;
      let spreadsheet;

      if (!sheetId) {
        spreadsheet = await workspaceAPI.sheets.createSpreadsheet(accessToken, 'VELA_OS_LEADS_MASTER');
        sheetId = spreadsheet.spreadsheetId;
        
        // Write headers
        const headers = [['ID', 'Nome', 'Contacto Responsável', 'Email', 'Contacto Telefónico', 'Estado', 'Serviço', 'Data Última Interação']];
        const sheetName = spreadsheet.sheets?.[0]?.properties?.title || 'Sheet1';
        await workspaceAPI.sheets.updateValues(accessToken, sheetId, `'${sheetName}'!A1`, headers);
      } else {
        spreadsheet = await workspaceAPI.sheets.getSpreadsheet(accessToken, sheetId);
      }

      const sheetName = spreadsheet.sheets?.[0]?.properties?.title || 'Sheet1';

      // Clear old rows to avoid duplicates or ghost rows
      await workspaceAPI.sheets.clearValues(accessToken, sheetId, `'${sheetName}'!A2:H500`);

      if (itemsToSync.length > 0) {
        const values = itemsToSync.map(l => [
          l.id,
          l.name,
          l.contactName || '',
          l.email || '',
          l.phone || '',
          l.status || 'Por contactar',
          l.serviceType || 'Website & Perfil Google',
          l.lastInteraction || ''
        ]);
        await workspaceAPI.sheets.updateValues(accessToken, sheetId, `'${sheetName}'!A2`, values);
      }
    } catch (e: any) {
      if (e.message?.includes('401')) setAccessToken(null);
    }
  };

  const createLead = async (leadData: Partial<any>) => {
    return firestore.add('leads', {
      ...leadData,
      status: leadData.status || 'Por contactar',
      lastInteraction: new Date().toISOString()
    });
  };

  const updateLead = async (id: string, data: Partial<any>) => {
    await firestore.update('leads', id, data);
  };

  const deleteLead = async (id: string) => {
    const updated = leads.filter(l => l.id !== id);
    setLeads(updated);
    await firestore.delete('leads', id);
    if (accessToken) await syncLeadsToSheets(updated);
  };

  // --- Prospects CRUD & Sheets Sync ---
  const syncProspectsToSheets = async (customProspects?: any[]) => {
    if (!accessToken) return;
    try {
      const itemsToSync = customProspects !== undefined ? customProspects : prospects;
      const driveRes = await workspaceAPI.drive.listFiles(accessToken, "name = 'VELA_OS_PROSPECTS_MASTER' and mimeType = 'application/vnd.google-apps.spreadsheet'");
      let sheetId = driveRes.files?.[0]?.id;
      let spreadsheet;

      if (!sheetId) {
        spreadsheet = await workspaceAPI.sheets.createSpreadsheet(accessToken, 'VELA_OS_PROSPECTS_MASTER');
        sheetId = spreadsheet.spreadsheetId;
        
        // Write headers
        const headers = [['ID', 'Nome', 'Contacto Responsável', 'Email', 'Contacto Telefónico', 'Estado', 'Serviço', 'Valor Total', 'Liquidado', 'Notas']];
        const sheetName = spreadsheet.sheets?.[0]?.properties?.title || 'Sheet1';
        await workspaceAPI.sheets.updateValues(accessToken, sheetId, `'${sheetName}'!A1`, headers);
      } else {
        spreadsheet = await workspaceAPI.sheets.getSpreadsheet(accessToken, sheetId);
      }

      const sheetName = spreadsheet.sheets?.[0]?.properties?.title || 'Sheet1';

      // Clear old rows to avoid duplicates or ghost rows
      await workspaceAPI.sheets.clearValues(accessToken, sheetId, `'${sheetName}'!A2:J500`);

      if (itemsToSync.length > 0) {
        const values = itemsToSync.map(p => [
          p.id,
          p.name,
          p.contactName || '',
          p.email || '',
          p.phone || '',
          p.status || 'Por Agendar',
          p.serviceType || 'Website & Perfil Google',
          p.totalValue || 0,
          p.receivedAmount || 0,
          (p.notes || []).map(n => `[${n.date}] ${n.content}`).join(' | ')
        ]);
        await workspaceAPI.sheets.updateValues(accessToken, sheetId, `'${sheetName}'!A2`, values);
      }
    } catch (e: any) {
      if (e.message?.includes('401')) setAccessToken(null);
    }
  };

  const createProspect = async (prospectData: Partial<any>) => {
    return firestore.add('prospects', {
      ...prospectData,
      status: prospectData.status || 'Por Agendar',
      lastInteraction: new Date().toISOString()
    });
  };

  const updateProspect = async (id: string, data: Partial<any>) => {
    await firestore.update('prospects', id, data);
  };

  const deleteProspect = async (id: string) => {
    const updated = prospects.filter(p => p.id !== id);
    setProspects(updated);
    await firestore.delete('prospects', id);
    if (accessToken) await syncProspectsToSheets(updated);
  };

  // --- Pipeline Transition Logic ---
  const importDiscoveredToLeads = async (businesses: any[]) => {
    for (const biz of businesses) {
      await firestore.add('leads', {
        name: biz.name,
        contactName: biz.contactName || '',
        email: biz.email || '',
        phone: biz.phone || 'Não listado',
        serviceType: biz.category || 'Website & Perfil Google',
        status: 'Por contactar',
        address: biz.address || '',
        website: biz.website || 'Não',
        hasWebsite: !!biz.hasWebsite,
        rating: biz.rating || '',
        opportunity: biz.opportunity || 'Oportunidade de website e SEO',
        mapUri: biz.mapUri || '',
        position: biz.position || 1,
        profileYears: biz.profileYears || 1,
        lastInteraction: new Date().toISOString()
      });
    }
  };

  const moveLeadToProspects = async (leadId: string, partialData?: Partial<any>) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    const prospectPayload = {
      name: lead.name,
      contactName: lead.contactName || '',
      email: lead.email || '',
      phone: lead.phone || '',
      serviceType: lead.serviceType || 'Website & Perfil Google',
      status: 'Por Agendar',
      address: lead.address || '',
      website: lead.website || 'Não',
      hasWebsite: !!lead.hasWebsite,
      rating: lead.rating || '',
      opportunity: lead.opportunity || '',
      mapUri: lead.mapUri || '',
      position: lead.position || 1,
      profileYears: lead.profileYears || 1,
      lastInteraction: new Date().toISOString(),
      notes: lead.notes || [],
      totalValue: partialData?.totalValue || 0,
      receivedAmount: partialData?.receivedAmount || 0,
      ...partialData
    };

    await firestore.add('prospects', prospectPayload);
    await firestore.delete('leads', leadId);
  };

  const moveProspectToClients = async (prospectId: string, partialData?: Partial<any>) => {
    const prospect = prospects.find(p => p.id === prospectId);
    if (!prospect) return;

    let folderId = '';
    if (accessToken) {
      folderId = await getOrCreateDriveFolder(prospect.name);
    }

    const clientPayload = {
      name: prospect.name,
      contactName: prospect.contactName || '',
      email: prospect.email || '',
      phone: prospect.phone || '',
      serviceType: prospect.serviceType || 'Website & Perfil Google',
      status: 'Cliente' as const,
      lastInteraction: new Date().toISOString(),
      notes: prospect.notes || [],
      totalValue: partialData?.totalValue !== undefined ? partialData.totalValue : (prospect.totalValue || 0),
      receivedAmount: partialData?.receivedAmount !== undefined ? partialData.receivedAmount : (prospect.receivedAmount || 0),
      driveFolderId: folderId,
      clientType: partialData?.clientType || prospect.clientType || 'individual',
      nif: partialData?.nif || prospect.nif || '',
      fiscalAddress: partialData?.fiscalAddress || prospect.fiscalAddress || '',
      proposal: partialData?.proposal || prospect.proposal || null,
      proposalFileUrl: partialData?.proposalFileUrl || prospect.proposalFileUrl || '',
      proposalFileName: partialData?.proposalFileName || prospect.proposalFileName || '',
      payments: partialData?.payments || prospect.payments || [],
      ...(partialData?.recurringBilling || prospect.recurringBilling
        ? { recurringBilling: partialData?.recurringBilling || prospect.recurringBilling }
        : {}),
      ...partialData
    };

    await firestore.add('clients', clientPayload);
    const updatedProspects = prospects.filter(p => p.id !== prospectId);
    setProspects(updatedProspects);
    await firestore.delete('prospects', prospectId);
    if (accessToken) {
      await syncProspectsToSheets(updatedProspects);
    }
  };

  // Sync Sheets on state changes
  useEffect(() => {
    if (accessToken) {
      syncLeadsToSheets();
    }
  }, [leads, accessToken]);

  useEffect(() => {
    if (accessToken) {
      syncProspectsToSheets();
    }
  }, [prospects, accessToken]);
  
  const uploadFile = async (clientId: string, folderId: string, file: File) => {
    if (!accessToken) throw new Error("Not authenticated");
    
    console.log(`[WORKSPACE] Direct binary upload for "${file.name}" to Drive...`);
    
    const boundary = 'foo_bar_baz';
    const metadata = {
      name: file.name,
      parents: [folderId]
    };

    const body = new Blob([
      `--${boundary}\r\n`,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\n`,
      `Content-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`,
      file,
      `\r\n--${boundary}--`
    ], { type: `multipart/related; boundary=${boundary}` });

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: body
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Upload failed: ${errText}`);
    }

    const res = await response.json();
    
    // Auto-detect and bind proposal file if filename contains "proposta" (case-insensitive)
    const isProposta = file.name.toLowerCase().includes('proposta');
    const project = clients.find(c => c.id === clientId);
    const existingProposal = project?.proposal;
    
    const updatePayload: any = {
      lastInteraction: new Date().toISOString()
    };

    if (isProposta) {
      updatePayload.proposal = {
        id: existingProposal?.id || Math.random().toString(36).substring(7),
        title: file.name,
        value: existingProposal?.value || project?.totalValue || 0,
        date: existingProposal?.date || new Date().toISOString(),
        status: existingProposal?.status || 'pendente',
        fileUrl: `https://drive.google.com/file/d/${res.id}/view`
      };
    }
    
    // Add activity log
    await updateClient(clientId, updatePayload);
    
    return res;
  };

  const deleteFile = async (fileId: string) => {
    if (!accessToken) throw new Error("Not authenticated");
    console.log(`[WORKSPACE] Deleting file: ${fileId}`);
    try {
      const res = await workspaceAPI.drive.deleteFile(accessToken, fileId);
      console.log(`[WORKSPACE] File deleted successfully: ${fileId}`, res);
      return res;
    } catch (e) {
      console.error(`[WORKSPACE] Error deleting file: ${fileId}`, e);
      throw e;
    }
  };

  const createClientProject = async (name: string) => {
    if (!accessToken) throw new Error("Not authenticated");
    return workspaceAPI.drive.createFolder(accessToken, `VELA_PROJECT: ${name}`);
  };

  const createProposal = async (proposalData: Partial<Proposal>) => {
    return firestore.add('proposals', proposalData);
  };

  const scheduleMeet = async (summary: string, startTime: string) => {
    if (!accessToken) throw new Error("Not authenticated");
    
    // Ensure valid ISO format and include timeZone to satisfy Google API 400 errors
    const startDateTime = new Date(startTime).toISOString();
    const endDateTime = new Date(new Date(startTime).getTime() + 3600000).toISOString();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    const event = {
      summary,
      description: 'Reunião agendada via Vela OS',
      start: { 
        dateTime: startDateTime,
        timeZone: timeZone
      },
      end: { 
        dateTime: endDateTime,
        timeZone: timeZone
      }, 
      conferenceData: {
        createRequest: {
          requestId: Math.random().toString(36).substring(7),
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      }
    };

    try {
      const calId = await getOrCreateTargetCalendar(accessToken);
      const res = await workspaceAPI.calendar.createEvent(accessToken, event, calId);
      
      // Optimistically update local meetings state
      if (res && res.id) {
        const newMeeting: Meeting = {
          id: res.id,
          clientName: res.summary || summary,
          date: new Date(res.start.dateTime || res.start.date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' }),
          time: new Date(res.start.dateTime || res.start.date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
          rawDate: res.start.dateTime || res.start.date,
          type: 'Check-in',
          link: res.hangoutLink
        };
        setMeetings(prev => {
          const updated = [newMeeting, ...prev];
          return updated.sort((a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime());
        });
      }
      
      return res;
    } catch (e: any) {
      return handleAuthError(e);
    }
  };

  const updateMeeting = async (meetingId: string, startTime: string) => {
    if (!accessToken) throw new Error("Not authenticated");
    const startDateTime = new Date(startTime).toISOString();
    const endDateTime = new Date(new Date(startTime).getTime() + 3600000).toISOString();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    const patch = {
      start: { 
        dateTime: startDateTime,
        timeZone: timeZone
      },
      end: { 
        dateTime: endDateTime,
        timeZone: timeZone
      }
    };

    try {
      const calId = await getOrCreateTargetCalendar(accessToken);
      const res = await workspaceAPI.calendar.patchEvent(accessToken, meetingId, patch, calId);
      
      // Update local meetings state
      if (res && res.id) {
        setMeetings(prev => {
          return prev.map(m => m.id === meetingId ? {
            ...m,
            date: new Date(res.start.dateTime || res.start.date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' }),
            time: new Date(res.start.dateTime || res.start.date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
            rawDate: res.start.dateTime || res.start.date
          } : m).sort((a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime());
        });
      }
      return res;
    } catch (e: any) {
      return handleAuthError(e);
    }
  };

  const deleteMeeting = async (meetingId: string) => {
    if (!accessToken) throw new Error("Not authenticated");
    try {
      const calId = await getOrCreateTargetCalendar(accessToken);
      await workspaceAPI.calendar.deleteEvent(accessToken, meetingId, calId);
      
      // Update local meetings state
      setMeetings(prev => prev.filter(m => m.id !== meetingId));
      return { success: true };
    } catch (e: any) {
      return handleAuthError(e);
    }
  };

  const getOrCreateChatSpace = async (client: Client) => {
    if (!accessToken) throw new Error("Not authenticated");
    
    if (client.chatSpaceId) {
      return client.chatSpaceId;
    }

    if (status.chatRestricted) {
      throw new Error('CHAT_APP_NOT_CONFIGURED');
    }

    try {
      const res = await workspaceAPI.chat.listSpaces(accessToken);
      const existing = res.spaces?.find((s: any) => s.displayName === `Vela: ${client.name}`);
      if (existing) {
        await firestore.update('clients', client.id, { chatSpaceId: existing.name });
        return existing.name;
      }

      const newSpace = await workspaceAPI.chat.createSpace(accessToken, {
        spaceType: 'SPACE',
        displayName: `Vela: ${client.name}`
      });
      
      await firestore.update('clients', client.id, { chatSpaceId: newSpace.name });
      return newSpace.name;
    } catch (e: any) {
      if (e.message?.includes('Chat app not found') || e.message?.includes('404')) {
        setStatus(prev => ({ ...prev, chatRestricted: true }));
        throw new Error('CHAT_APP_NOT_CONFIGURED');
      }
      return handleAuthError(e);
    }
  };
  
  const getChatMessages = async (spaceId: string) => {
    if (!accessToken) throw new Error("Not authenticated");
    try {
      const res = await workspaceAPI.chat.listMessages(accessToken, spaceId);
      return res.messages || [];
    } catch (e: any) {
      if (!e.message?.includes('404')) {
        console.warn("Fetch chat messages issue:", e.message || e);
      }
      return [];
    }
  };

  const sendChatMessage = async (spaceId: string, text: string) => {
    if (!accessToken) throw new Error("Not authenticated");
    return workspaceAPI.chat.createMessage(accessToken, spaceId, text);
  };

  const setToken = (token: string | null) => {
    setAccessToken(token);
  };

  return (
    <WorkspaceContext.Provider value={{ 
      accessToken, 
      isLoading, 
      isClientsLoaded,
      syncStatus: status, 
      syncError,
      clients,
      leads,
      prospects,
      proposals,
      meetings,
      activities,
      refreshStatus,
      setToken,
      login,
      getOrCreateDriveFolder,
      createClient,
      addClient: createClient,
      updateClient,
      deleteClient,
      deleteProject,
      createLead,
      updateLead,
      deleteLead,
      createProspect,
      updateProspect,
      deleteProspect,
      importDiscoveredToLeads,
      moveLeadToProspects,
      moveProspectToClients,
      uploadFile,
      createClientProject,
      scheduleMeet,
      updateMeeting,
      deleteMeeting,
      getClientFiles,
      getOrCreateChatSpace,
      getChatMessages,
      sendChatMessage,
      createProposal,
      deleteFile,
      syncClientsToSheets,
      importFromSheets
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return context;
};

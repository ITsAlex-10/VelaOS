import React, { useState, useEffect, useRef } from 'react';
import { GlassCard, Badge, Button, Modal, Input, Select } from '../components/UI';
import { 
  Folder, 
  ExternalLink, 
  Clock, 
  CheckCircle2, 
  Plus,
  LayoutGrid,
  List as ListIcon,
  Search,
  Filter,
  MoreVertical,
  FileText,
  Briefcase,
  ChevronRight,
  Download,
  ArrowLeft,
  Loader2,
  Users as UsersIcon,
  Trash2,
  Euro,
  Percent,
  Calendar,
  Paperclip,
  X,
  Repeat
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency } from '../lib/utils';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useBackgroundAction } from '../contexts/BackgroundActionContext';
import { firestore } from '../lib/firebase';
import { workspaceAPI } from '../lib/workspace';
import { RecurringBillingFields } from '../components/RecurringBillingFields';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { calculateNextBillingDate, formatFrequencyLabel, getTodayISO } from '../lib/billing';
import { BillingFrequency, CustomIntervalUnit, Payment, RecurringBillingConfig } from '../types';

interface ProjectsPageProps {
  preSelectedId?: string;
  onClearSelection?: () => void;
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({ preSelectedId, onClearSelection }) => {
  const { createClientProject, syncStatus, clients, prospects, moveProspectToClients, updateProspect, proposals, isLoading, updateClient, deleteProject, getClientFiles, accessToken, uploadFile, deleteFile } = useWorkspace();
  const { runBackgroundAction } = useBackgroundAction();
  
  // Persist view state in localStorage
  const [view, setView] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('vela_projects_view') as 'grid' | 'list') || 'grid';
  });

  const handleSetView = (newView: 'grid' | 'list') => {
    setView(newView);
    localStorage.setItem('vela_projects_view', newView);
  };

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(preSelectedId || null);
  const [showModal, setShowModal] = useState(false);
  const [newProjectData, setNewProjectData] = useState({ clientId: '', status: 'Pendente', serviceType: '' });
  const [proposalValue, setProposalValue] = useState('');
  const [hasDiscount, setHasDiscount] = useState(false);
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState('');
  const [discountExpiry, setDiscountExpiry] = useState('');
  const [attachedProposalFile, setAttachedProposalFile] = useState<File | null>(null);
  const proposalFileInputRef = useRef<HTMLInputElement>(null);

  const [billingType, setBillingType] = useState<'one_time' | 'recurring'>('one_time');
  const [recurringFrequency, setRecurringFrequency] = useState<BillingFrequency>('monthly');
  const [customIntervalValue, setCustomIntervalValue] = useState('1');
  const [customIntervalUnit, setCustomIntervalUnit] = useState<CustomIntervalUnit>('months');
  const [recurringStartDate, setRecurringStartDate] = useState(getTodayISO());
  const [firstCyclePaid, setFirstCyclePaid] = useState(true);

  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{id: string, name: string} | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter and search state like ClientsPage
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'alphabetical'>('recent');

  const pendingProspects = (prospects || []).filter(p => p.status === 'Pendente');
  const activeClients = (clients || []).filter(c => c.status === 'Cliente' && !c.projectRemoved);
  const finishedClients = (clients || []).filter(c => c.status === 'Terminado' && !c.projectRemoved);
  const pendingClients = (clients || []).filter(c => c.status === 'Pendente' && !c.projectRemoved);

  const activeProjects = [
    ...pendingProspects,
    ...pendingClients,
    ...activeClients,
    ...finishedClients
  ];
  
  const filteredProjects = activeProjects.filter(project => {
    const matchesSearch = 
      (project.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project.contactName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project.serviceType || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter !== 'all') {
      matchesStatus = project.status === statusFilter;
    }
    
    return matchesSearch && matchesStatus;
  });

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    if (sortBy === 'alphabetical') {
      return (a.name || '').localeCompare(b.name || '');
    } else {
      const timeA = new Date(a.lastInteraction || 0).getTime();
      const timeB = new Date(b.lastInteraction || 0).getTime();
      return timeB - timeA;
    }
  });

  const selectedProject = activeProjects.find(c => c.id === selectedProjectId);

  const projectProposals = React.useMemo(() => {
    const fromList = proposals.filter(p => p.clientId === selectedProjectId);
    if (fromList.length === 0 && selectedProject && (selectedProject.proposal || selectedProject.proposalFileName || selectedProject.totalValue)) {
      return [{
        id: selectedProject.proposal?.id || selectedProjectId + '_default_prop',
        clientId: selectedProjectId,
        title: selectedProject.proposal?.title || selectedProject.proposalFileName || 'Proposta de Desenvolvimento',
        value: selectedProject.proposal?.value ?? selectedProject.totalValue ?? 0,
        discountAmount: selectedProject.proposal?.discountAmount || 0,
        discountExpiry: selectedProject.proposal?.discountExpiry,
        date: selectedProject.proposal?.date
          ? new Date(selectedProject.proposal.date).toLocaleDateString('pt-PT')
          : new Date().toLocaleDateString('pt-PT'),
        status: selectedProject.proposal?.status || (selectedProject.status === 'Pendente' ? 'pendente' : 'aceite'),
        fileUrl: selectedProject.proposal?.fileUrl || selectedProject.proposalFileUrl
      }];
    }
    return fromList;
  }, [proposals, selectedProjectId, selectedProject]);

  const driveProposals = React.useMemo(() => {
    return driveFiles.filter((file: any) => 
      file.name && (file.name.toLowerCase().includes('proposta') || file.id?.includes('_prop'))
    );
  }, [driveFiles]);

  useEffect(() => {
    if (selectedProject) {
      setIsLoadingDrive(true);
      const fetchDrive = selectedProject.driveFolderId ? getClientFiles(selectedProject.driveFolderId) : Promise.resolve([]);
      
      fetchDrive
        .then((files) => {
          let list = files || [];
          if (selectedProject.proposalFileName && selectedProject.proposalFileUrl) {
            const hasProp = list.some((f: any) => f.name === selectedProject.proposalFileName || f.webViewLink === selectedProject.proposalFileUrl);
            if (!hasProp) {
              list.unshift({
                id: selectedProject.id + '_prop',
                name: selectedProject.proposalFileName,
                mimeType: 'application/pdf',
                webViewLink: selectedProject.proposalFileUrl,
                modifiedTime: new Date().toISOString()
              });
            }
          }
          setDriveFiles(list);
        })
        .catch((err) => {
          console.error("Failed to load drive files:", err);
          if (selectedProject.proposalFileName && selectedProject.proposalFileUrl) {
            setDriveFiles([{
              id: selectedProject.id + '_prop',
              name: selectedProject.proposalFileName,
              mimeType: 'application/pdf',
              webViewLink: selectedProject.proposalFileUrl,
              modifiedTime: new Date().toISOString()
            }]);
          } else {
            setDriveFiles([]);
          }
        })
        .finally(() => {
          setIsLoadingDrive(false);
        });
    } else {
      setDriveFiles([]);
    }
  }, [selectedProjectId, selectedProject?.driveFolderId, selectedProject?.proposalFileName, selectedProject?.proposalFileUrl, accessToken, getClientFiles]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const items = Array.from(e.dataTransfer.items);
    if (items.length === 0 || !selectedProject?.driveFolderId) return;

    setIsUploading(true);
    try {
      const filesToUpload: File[] = [];

      const traverseFileTree = async (entry: FileSystemEntry) => {
        if (entry.isFile) {
          const fileEntry = entry as FileSystemFileEntry;
          const file = await new Promise<File>((resolve) => fileEntry.file(resolve));
          filesToUpload.push(file);
        } else if (entry.isDirectory) {
          const dirEntry = entry as FileSystemDirectoryEntry;
          const reader = dirEntry.createReader();
          
          let entries: FileSystemEntry[] = [];
          let readMore = true;
          while (readMore) {
            const batch = await new Promise<FileSystemEntry[]>((resolve) => reader.readEntries(resolve));
            if (batch.length > 0) {
              entries = entries.concat(batch);
            } else {
              readMore = false;
            }
          }
          
          for (const nestedEntry of entries) {
            await traverseFileTree(nestedEntry);
          }
        }
      };

      for (const rawItem of items) {
        const item = rawItem as any;
        if (item.webkitGetAsEntry) {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            await traverseFileTree(entry);
          }
        }
      }

      for (const file of filesToUpload) {
        await uploadFile(selectedProject.id, selectedProject.driveFolderId, file);
      }

      // Refresh files list
      const filesRes = await getClientFiles(selectedProject.driveFolderId);
      setDriveFiles(filesRes || []);
    } catch (err) {
      console.error(err);
      alert("Erro ao carregar ficheiros.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async () => {
    if (!fileToDelete || !selectedProject?.driveFolderId) return;
    console.log("Deleting file:", fileToDelete.id);
    setIsLoadingDrive(true);
    try {
      await deleteFile(fileToDelete.id);
      console.log("File deleted successfully");
      setFileToDelete(null);
      // Refresh files list using selectedProject.driveFolderId
      const filesRes = await getClientFiles(selectedProject.driveFolderId);
      setDriveFiles(filesRes || []);
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Erro ao apagar ficheiro.");
    } finally {
      setIsLoadingDrive(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !selectedProject?.driveFolderId) return;

    setIsUploading(true);
    try {
      for (const rawFile of files) {
        const file = rawFile as any;
        // Basic check to skip directories
        if (file.size === 0 && !file.type) {
          console.warn("Skipping directory upload:", file.name);
          continue;
        }
        await uploadFile(selectedProject.id, selectedProject.driveFolderId, file);
      }
      // Refresh files list
      const filesRes = await getClientFiles(selectedProject.driveFolderId);
      setDriveFiles(filesRes || []);
    } catch (err) {
      console.error(err);
      alert("Erro ao carregar ficheiros.");
    } finally {
      setIsUploading(false);
    }
  };

  const resetNewProjectForm = () => {
    setNewProjectData({ clientId: '', status: 'Pendente', serviceType: '' });
    setProposalValue('');
    setHasDiscount(false);
    setDiscountType('fixed');
    setDiscountValue('');
    setDiscountExpiry('');
    setAttachedProposalFile(null);
    setBillingType('one_time');
    setRecurringFrequency('monthly');
    setCustomIntervalValue('1');
    setCustomIntervalUnit('months');
    setRecurringStartDate(getTodayISO());
    setFirstCyclePaid(true);
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    const entityId = newProjectData.clientId;
    const targetStatus = newProjectData.status;
    const serviceType = newProjectData.serviceType;

    const prospect = (prospects || []).find(p => p.id === entityId);
    const client = (clients || []).find(c => c.id === entityId);
    const baseEntity = client || prospect;
    const entityName = baseEntity?.name || 'Projeto';

    const baseVal = parseFloat(proposalValue) || 0;
    const discRaw = hasDiscount ? (parseFloat(discountValue) || 0) : 0;
    const finalDiscount = hasDiscount
      ? (discountType === 'percentage' ? baseVal * (discRaw / 100) : discRaw)
      : 0;
    const effectiveTotal = Math.max(0, baseVal - finalDiscount);

    const capturedBillingType = billingType;
    const capturedFrequency = recurringFrequency;
    const capturedCustomVal = Math.max(1, parseInt(customIntervalValue, 10) || 1);
    const capturedCustomUnit = customIntervalUnit;
    const capturedStartDate = recurringStartDate || getTodayISO();
    const capturedFirstCyclePaid = firstCyclePaid;

    let totalVal = targetStatus === 'Pendente' ? baseVal : effectiveTotal;
    let receivedAmt = targetStatus === 'Terminado' ? effectiveTotal : 0;
    let initialPayments: Payment[] = [];
    let recurringConfig: RecurringBillingConfig | undefined = undefined;

    if (capturedBillingType === 'recurring') {
      const cycleAmount = targetStatus === 'Pendente' ? baseVal : effectiveTotal;
      const todayStr = getTodayISO();

      if (targetStatus === 'Pendente') {
        totalVal = baseVal;
        receivedAmt = 0;
        recurringConfig = {
          enabled: true,
          amount: effectiveTotal > 0 ? effectiveTotal : baseVal,
          frequency: capturedFrequency,
          ...(capturedFrequency === 'custom'
            ? { customIntervalValue: capturedCustomVal, customIntervalUnit: capturedCustomUnit }
            : {}),
          startDate: capturedStartDate,
          nextBillingDate: capturedStartDate,
          active: false,
          cyclesPaid: 0
        };
      } else {
        const isFirstPaid = targetStatus === 'Terminado' ? true : capturedFirstCyclePaid;
        let nextDate = capturedStartDate;
        let cyclesPaid = 0;

        if (isFirstPaid && cycleAmount > 0) {
          initialPayments.push({
            id: 'p-' + Math.random().toString(36).substring(7),
            amount: cycleAmount,
            date: capturedStartDate,
            status: 'received',
            type: 'recurring',
            description: `1º Ciclo (${formatFrequencyLabel({ frequency: capturedFrequency, customIntervalValue: capturedCustomVal, customIntervalUnit: capturedCustomUnit })})`
          });
          totalVal = cycleAmount;
          receivedAmt = cycleAmount;
          cyclesPaid = 1;
          nextDate = calculateNextBillingDate(capturedStartDate, capturedFrequency, capturedCustomVal, capturedCustomUnit);
        } else if (cycleAmount > 0 && capturedStartDate <= todayStr) {
          initialPayments.push({
            id: 'p-' + Math.random().toString(36).substring(7),
            amount: cycleAmount,
            date: capturedStartDate,
            status: 'pending',
            type: 'recurring',
            description: `1º Ciclo (${formatFrequencyLabel({ frequency: capturedFrequency, customIntervalValue: capturedCustomVal, customIntervalUnit: capturedCustomUnit })})`
          });
          totalVal = cycleAmount;
          receivedAmt = 0;
          nextDate = calculateNextBillingDate(capturedStartDate, capturedFrequency, capturedCustomVal, capturedCustomUnit);
        } else {
          totalVal = 0;
          receivedAmt = 0;
          nextDate = capturedStartDate;
        }

        recurringConfig = {
          enabled: true,
          amount: cycleAmount,
          frequency: capturedFrequency,
          ...(capturedFrequency === 'custom'
            ? { customIntervalValue: capturedCustomVal, customIntervalUnit: capturedCustomUnit }
            : {}),
          startDate: capturedStartDate,
          nextBillingDate: nextDate,
          active: targetStatus !== 'Terminado',
          cyclesPaid
        };
      }
    }

    const fileToUpload = attachedProposalFile;
    const capturedHasDiscount = hasDiscount;
    const capturedDiscountType = discountType;
    const capturedDiscountExpiry = discountExpiry;

    setShowModal(false);
    resetNewProjectForm();

    runBackgroundAction({
      title: fileToUpload
        ? `A configurar projeto e anexar proposta para "${entityName}"...`
        : `A configurar projeto para "${entityName}"...`,
      action: async () => {
        let folderId = '';
        if (accessToken) {
          try {
            const folderRes = await workspaceAPI.drive.createFolder(accessToken, `VELA_CLIENT: ${entityName} - ${serviceType}`);
            folderId = folderRes?.id || '';
          } catch (driveErr) {
            console.warn("Could not create Drive folder for new project:", driveErr);
          }
        }

        let proposalFileUrl = '';
        let proposalFileName = fileToUpload ? fileToUpload.name : '';

        if (fileToUpload && accessToken && folderId) {
          try {
            const boundary = 'foo_bar_baz';
            const metadata = { name: fileToUpload.name, parents: [folderId] };
            const body = new Blob([
              `--${boundary}\r\n`,
              'Content-Type: application/json; charset=UTF-8\r\n\r\n',
              JSON.stringify(metadata),
              `\r\n--${boundary}\r\n`,
              `Content-Type: ${fileToUpload.type || 'application/octet-stream'}\r\n\r\n`,
              fileToUpload,
              `\r\n--${boundary}--`
            ], { type: `multipart/related; boundary=${boundary}` });

            const uploadResp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
              method: 'POST',
              headers: { Authorization: `Bearer ${accessToken}` },
              body
            });
            if (uploadResp.ok) {
              const uploadData = await uploadResp.json();
              if (uploadData?.id) {
                proposalFileUrl = `https://drive.google.com/file/d/${uploadData.id}/view`;
              }
            }
          } catch (uploadErr) {
            console.error("Error uploading proposal file for new project:", uploadErr);
          }
        }

        const hasProposalInfo = baseVal > 0 || !!fileToUpload || capturedHasDiscount || capturedBillingType === 'recurring';
        const proposalObj: any = hasProposalInfo ? {
          id: Math.random().toString(36).substring(7),
          title: proposalFileName || `Proposta: ${entityName} (${serviceType})`,
          value: targetStatus === 'Pendente' ? baseVal : effectiveTotal,
          date: new Date().toISOString(),
          status: targetStatus === 'Pendente' ? 'pendente' : 'aceite',
          discountAmount: capturedHasDiscount ? finalDiscount : 0,
          discountType: capturedHasDiscount ? capturedDiscountType : 'fixed',
          discountRawValue: capturedHasDiscount ? discRaw : 0,
          hasDiscountApplied: targetStatus !== 'Pendente' && capturedHasDiscount,
          billingType: capturedBillingType,
          ...(capturedBillingType === 'recurring' ? {
            recurringFrequency: capturedFrequency,
            ...(capturedFrequency === 'custom' ? { customIntervalValue: capturedCustomVal, customIntervalUnit: capturedCustomUnit } : {})
          } : {}),
          ...(capturedHasDiscount && capturedDiscountExpiry ? { discountExpiry: capturedDiscountExpiry } : {}),
          ...(proposalFileUrl ? { fileUrl: proposalFileUrl } : {})
        } : undefined;

        if (client && client.projectRemoved && !client.parentClientId) {
          await firestore.update('clients', client.id, {
            status: targetStatus,
            serviceType,
            totalValue: totalVal,
            receivedAmount: receivedAmt,
            lastInteraction: new Date().toISOString(),
            driveFolderId: folderId,
            proposalFileUrl,
            proposalFileName,
            proposal: proposalObj ?? null,
            recurringBilling: recurringConfig ?? null,
            payments: initialPayments,
            projectRemoved: false
          });
        } else {
          const newProject: any = {
            id: Math.random().toString(36).substring(7),
            name: entityName,
            contactName: baseEntity?.contactName || '',
            email: baseEntity?.email || '',
            phone: baseEntity?.phone || '',
            dashboardEmail: baseEntity?.dashboardEmail || '',
            hasDashboardAccess: baseEntity?.hasDashboardAccess || false,
            clientUsers: baseEntity?.clientUsers || [],
            clientEmails: baseEntity?.clientEmails || [],
            clientType: baseEntity?.clientType || 'individual',
            nif: baseEntity?.nif || '',
            fiscalAddress: baseEntity?.fiscalAddress || '',
            parentClientId: entityId,
            status: targetStatus,
            serviceType,
            totalValue: totalVal,
            receivedAmount: receivedAmt,
            lastInteraction: new Date().toISOString(),
            driveFolderId: folderId,
            proposalFileUrl,
            proposalFileName,
            ...(proposalObj ? { proposal: proposalObj } : {}),
            ...(recurringConfig ? { recurringBilling: recurringConfig } : {}),
            notes: [],
            files: [],
            payments: initialPayments
          };
          await firestore.set('clients', newProject.id, newProject);
        }
      },
      errorMessage: `Erro ao configurar projeto para "${entityName}".`
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Cliente': 
        return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'Terminado': 
        return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'Pendente': 
        return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'Lead': 
        return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      default: return 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20';
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <AnimatePresence mode="wait">
        {selectedProjectId && selectedProject ? (
          <motion.div
            key="project-details"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="flex items-center justify-between">
              <button 
                onClick={() => {
                  setSelectedProjectId(null);
                  onClearSelection?.();
                }}
                className="flex items-center gap-3 text-zinc-500 hover:text-white transition-colors group"
              >
                <div className="p-2 glass rounded-lg border-white/5 group-hover:border-white/10">
                  <ArrowLeft size={16} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] font-sans">Voltar aos Projetos</span>
              </button>
              <div className="flex items-center gap-3">
                <Badge className={getStatusColor(selectedProject.status)}>
                  {selectedProject.status}
                </Badge>
                <button
                  type="button"
                  onClick={() => setProjectToDelete(selectedProject)}
                  title="Eliminar Projeto (mantém o cliente)"
                  className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 hover:border-red-500/30 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                >
                  <Trash2 size={14} />
                  Eliminar Projeto
                </button>
              </div>
            </div>

            <div className="flex items-end justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-4xl font-display font-black text-white tracking-tighter uppercase italic">{selectedProject.name}</h2>
                  {(selectedProject as any).recurringBilling?.enabled && (
                    <Badge variant="primary" className="inline-flex items-center gap-1.5 px-3 py-1">
                      <Repeat size={11} />
                      {formatFrequencyLabel((selectedProject as any).recurringBilling)} • {formatCurrency((selectedProject as any).recurringBilling.amount)}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-zinc-600 font-bold uppercase tracking-[0.3em] font-sans">{selectedProject.serviceType}</p>
              </div>
              <div className="flex -space-x-3">
                 {[1, 2].map((i) => (
                   <div key={i} className="w-10 h-10 rounded-full bg-zinc-900 border-2 border-[#0D0D0F] flex items-center justify-center text-[10px] font-black text-zinc-500 shadow-xl">
                     {i === 1 ? 'AS' : 'JD'}
                   </div>
                 ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Proposal Section */}
              <GlassCard className="p-10 border-vela-red/20 bg-vela-red/[0.01]">
                <div className="flex items-center justify-between mb-10">
                  <div className="space-y-2">
                    <h4 className="text-[11px] uppercase tracking-[0.2em] text-vela-red font-black font-sans">Propostas & Orçamentos</h4>
                    <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest font-sans">Ciclo de Adjudicação Histórico</p>
                  </div>
                  <Briefcase className="text-vela-red opacity-50" size={24} />
                </div>

                <div className="space-y-4">
                  {isLoadingDrive && (
                    <div className="flex items-center justify-center py-6 gap-2 text-zinc-500 text-xs">
                      <Loader2 className="animate-spin text-vela-red" size={16} />
                      <span>A procurar propostas no Drive...</span>
                    </div>
                  )}

                  {projectProposals.length === 0 && driveProposals.length === 0 && !isLoadingDrive && (
                    <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-white/5 rounded-2xl">
                      <FileText size={40} className="text-zinc-800 mb-4" />
                      <p className="text-[10px] text-zinc-700 font-black uppercase tracking-widest">Sem propostas vinculadas</p>
                    </div>
                  )}

                  {projectProposals.map((proposal: any) => (
                    <div 
                      key={proposal.id} 
                      className="p-8 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-vela-red/40 transition-all group cursor-pointer" 
                      onClick={() => window.open(proposal.fileUrl || `https://drive.google.com/drive/search?q=${encodeURIComponent(proposal.title)}`, '_blank')}
                    >
                      <div className="flex items-center gap-6 mb-8">
                        <div className="w-14 h-14 glass rounded-xl flex items-center justify-center text-vela-red group-hover:scale-110 transition-transform">
                          <FileText size={28} />
                        </div>
                        <div className="flex-1">
                          <p className="text-lg font-black text-white font-display uppercase italic">{proposal.title}</p>
                          <p className="text-[11px] text-zinc-600 font-bold uppercase tracking-widest mt-1">
                            {formatCurrency(proposal.value)} // {proposal.date}
                            {proposal.discountAmount > 0 ? ` // Desc: ${formatCurrency(proposal.discountAmount)}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-6 border-t border-white/5">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-2.5 h-2.5 rounded-full", proposal.status === 'aceite' ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
                          <span className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.15em]">{proposal.status === 'aceite' ? 'Validada' : 'Pendente'}</span>
                        </div>
                        <span className="text-[10px] text-vela-red font-black uppercase tracking-widest group-hover:translate-x-1 transition-transform flex items-center gap-2">
                          Ver Documento <ChevronRight size={12} />
                        </span>
                      </div>
                    </div>
                  ))}

                  {driveProposals.map(file => (
                    <div 
                      key={file.id} 
                      className="p-8 rounded-2xl bg-white/[0.01] border border-vela-red/10 hover:border-vela-red/40 hover:bg-white/[0.03] transition-all group cursor-pointer animate-fade-in" 
                      onClick={() => window.open(file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`, '_blank')}
                    >
                      <div className="flex items-center gap-6 mb-8">
                        <div className="w-14 h-14 bg-vela-red/10 border border-vela-red/20 rounded-xl flex items-center justify-center text-vela-red group-hover:scale-110 transition-transform">
                          <FileText size={28} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-lg font-black text-white font-display uppercase italic leading-tight">{file.name}</p>
                            <Badge variant="primary" className="text-[8px] bg-vela-red/10 text-vela-red border-vela-red/20 py-0.5 px-1.5 shrink-0 uppercase tracking-widest">Drive</Badge>
                          </div>
                          <p className="text-[11px] text-zinc-600 font-bold uppercase tracking-widest mt-1">
                            {file.size ? `${(Number(file.size) / (1024 * 1024)).toFixed(2)} MB` : 'Tamanho Desconhecido'} // {new Date(file.modifiedTime || Date.now()).toLocaleDateString('pt-PT')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-6 border-t border-white/5">
                        <div className="flex items-center gap-3">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          <span className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.15em]">Anexada no Drive</span>
                        </div>
                        <span className="text-[10px] text-vela-red font-black uppercase tracking-widest group-hover:translate-x-1 transition-transform flex items-center gap-2">
                          Abrir no Google Drive <ChevronRight size={12} />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* Files Section */}
              <GlassCard className="p-10 border-white/5 bg-white/[0.01]">
                <div className="flex items-center justify-between mb-10">
                  <div className="space-y-2">
                    <h4 className="text-[11px] uppercase tracking-[0.2em] text-zinc-600 font-black font-sans">Diretório de Ativos</h4>
                    <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest font-sans">Sincronizado via Google Drive</p>
                  </div>
                  <Folder className="text-zinc-800" size={24} />
                </div>

                {selectedProject.driveFolderId ? (
                  <div className="space-y-6">
                    {/* Drag and Drop Universal Upload Zone */}
                    <div 
                      className={cn(
                        "w-full p-8 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center cursor-pointer relative overflow-hidden group/drop",
                        isDragging 
                          ? "border-vela-red bg-vela-red/5 scale-[1.02]" 
                          : "border-white/10 bg-white/[0.01] hover:border-white/20 hover:bg-white/[0.02]"
                      )}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input 
                        type="file" 
                        className="hidden" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload}
                        accept=".pdf,.doc,.docx,.png,.jpg,.xlsx,.zip"
                        multiple
                      />
                      
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-zinc-500 group-hover/drop:text-vela-red group-hover/drop:scale-110 transition-all mb-4">
                        {isUploading ? (
                          <Loader2 size={24} className="animate-spin text-vela-red" />
                        ) : (
                          <FileText size={24} strokeWidth={1.5} />
                        )}
                      </div>

                      <p className="text-xs font-bold text-zinc-300 mb-1 text-center">
                        {isUploading ? "A enviar para o Google Drive..." : "Arraste um ficheiro ou clique para carregar"}
                      </p>
                      <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest font-sans text-center">
                        PDF, DOCX, Imagem, Excel (Até 10MB)
                      </p>

                      {isDragging && (
                        <div className="absolute inset-0 bg-vela-red/10 backdrop-blur-xs flex items-center justify-center animate-fade-in pointer-events-none">
                          <p className="text-xs font-black text-vela-red uppercase tracking-widest">Solte o ficheiro aqui!</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                      {isLoadingDrive ? (
                        <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-600 font-bold uppercase tracking-widest py-8 font-sans">
                          <Loader2 size={14} className="animate-spin" /> Sincronizando ficheiros...
                        </div>
                      ) : driveFiles.length > 0 ? (
                        driveFiles.map(file => (
                          <div 
                            key={file.id} 
                            className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all cursor-pointer group" 
                          >
                            <div className="flex items-center gap-3 flex-1" onClick={() => window.open(file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`, '_blank')}>
                              <FileText size={16} className="text-zinc-600 group-hover:text-vela-red transition-colors" />
                              <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-zinc-300 truncate max-w-[200px]">{file.name}</span>
                                <span className="text-[8px] text-zinc-600 font-sans uppercase tracking-tighter">
                                  {file.size ? `${(Number(file.size) / (1024 * 1024)).toFixed(2)} MB` : 'Manual'} // {new Date(file.modifiedTime || Date.now()).toLocaleDateString('pt-PT')}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setFileToDelete({ id: file.id, name: file.name })}
                                className="p-2 text-zinc-700 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                              <ChevronRight size={14} className="text-zinc-700 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest text-center py-8 bg-white/[0.01] rounded-xl border border-dashed border-white/5 font-sans">
                          Nenhum ficheiro detectado neste diretório
                        </p>
                      )}
                    </div>

                    <div className="pt-4 border-t border-white/5 flex justify-end">
                      <Button 
                        variant="outline" 
                        className="text-[9px] font-black uppercase tracking-widest"
                        onClick={() => window.open(`https://drive.google.com/drive/folders/${selectedProject.driveFolderId}`, '_blank')}
                      >
                        Explorar Pasta Completa no Drive <ExternalLink size={10} className="ml-2" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 opacity-20 text-center px-10">
                    <Download size={32} />
                    <p className="text-[10px] font-black uppercase tracking-widest mt-4 leading-relaxed">Nenhum diretório Drive vinculado a esta entidade</p>
                  </div>
                )}
              </GlassCard>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="projects-list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-8"
          >
            {/* Header Actions */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 pb-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative group w-64">
                  <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-vela-red transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Pesquisar projetos..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-white/[0.02] border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] w-full focus:outline-none focus:border-vela-red/20 focus:bg-white/[0.04] transition-all font-sans placeholder:text-zinc-700"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSortBy('recent')}
                    className={cn(
                      "px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                      sortBy === 'recent' ? "bg-vela-red text-white" : "bg-white/5 text-zinc-400 hover:bg-white/10"
                    )}
                  >
                    Recentes
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortBy('alphabetical')}
                    className={cn(
                      "px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                      sortBy === 'alphabetical' ? "bg-vela-red text-white" : "bg-white/5 text-zinc-400 hover:bg-white/10"
                    )}
                  >
                    Alfabética
                  </button>
                </div>
                
                <div className="flex items-center gap-1 bg-white/[0.02] p-1 rounded-xl border border-white/5 overflow-x-auto max-w-full scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={cn(
                      "px-3.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shrink-0",
                      statusFilter === 'all' ? "bg-white/10 text-white" : "text-zinc-500 hover:text-white"
                    )}
                  >
                    Todos ({activeProjects.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('Pendente')}
                    className={cn(
                      "px-3.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shrink-0 border border-transparent",
                      statusFilter === 'Pendente' ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" : "text-zinc-500 hover:text-white"
                    )}
                  >
                    Pendentes ({activeProjects.filter(p => p.status === 'Pendente').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('Cliente')}
                    className={cn(
                      "px-3.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shrink-0 border border-transparent",
                      statusFilter === 'Cliente' ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "text-zinc-500 hover:text-white"
                    )}
                  >
                    Ativos ({activeProjects.filter(p => p.status === 'Cliente').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('Terminado')}
                    className={cn(
                      "px-3.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shrink-0 border border-transparent",
                      statusFilter === 'Terminado' ? "bg-red-500/20 text-red-300 border-red-500/30" : "text-zinc-500 hover:text-white"
                    )}
                  >
                    Terminados ({activeProjects.filter(p => p.status === 'Terminado').length})
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center bg-white/[0.02] border border-white/5 p-1 rounded-lg">
                  <button 
                    onClick={() => handleSetView('grid')}
                    className={cn(
                      "p-2 rounded-md transition-all",
                      view === 'grid' ? "bg-white/[0.05] text-vela-red" : "text-zinc-600 hover:text-zinc-400"
                    )}
                  >
                    <LayoutGrid size={14} />
                  </button>
                  <button 
                    onClick={() => handleSetView('list')}
                    className={cn(
                      "p-2 rounded-md transition-all",
                      view === 'list' ? "bg-white/[0.05] text-vela-red" : "text-zinc-600 hover:text-zinc-400"
                    )}
                  >
                    <ListIcon size={14} />
                  </button>
                </div>
                <Button 
                  variant="primary" 
                  className="px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2"
                  onClick={() => setShowModal(true)}
                >
                  <Plus size={14} /> Novo Projeto
                </Button>
              </div>
            </div>

            <Modal 
              isOpen={showModal} 
              onClose={() => {
                setShowModal(false);
                resetNewProjectForm();
              }} 
              title="Iniciar Novo Projeto"
            >
              <form onSubmit={handleCreateProject} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Selecionar Entidade</label>
                  <select
                    value={newProjectData.clientId}
                    onChange={e => setNewProjectData({ ...newProjectData, clientId: e.target.value })}
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-vela-red/30 transition-all font-sans"
                    required
                  >
                    <option value="" className="bg-zinc-900 text-zinc-500">Selecione um prospect pendente, cliente ativo ou terminado</option>
                    
                    <optgroup label="Prospects Pendentes" className="bg-zinc-900 text-yellow-400">
                      {(prospects || []).filter(p => p.status === 'Pendente').map(p => (
                        <option key={p.id} value={p.id} className="bg-zinc-900 text-white">
                          {p.name} (Prospect Pendente)
                        </option>
                      ))}
                    </optgroup>

                    <optgroup label="Clientes Ativos" className="bg-zinc-900 text-emerald-400">
                      {(Array.from(new Map((clients as any[] || []).filter(c => c.status === 'Cliente' && !c.parentClientId).map(c => [(c.name || '').toLowerCase().trim(), c])).values()) as any[]).map(c => (
                        <option key={c.id} value={c.id} className="bg-zinc-900 text-white">
                          {c.name} (Cliente Ativo)
                        </option>
                      ))}
                    </optgroup>

                    <optgroup label="Clientes Terminados" className="bg-zinc-900 text-red-400">
                      {(Array.from(new Map((clients as any[] || []).filter(c => c.status === 'Terminado' && !c.parentClientId).map(c => [(c.name || '').toLowerCase().trim(), c])).values()) as any[]).map(c => (
                        <option key={c.id} value={c.id} className="bg-zinc-900 text-white">
                          {c.name} (Cliente Terminado)
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <Select 
                  label="Estado do Projeto"
                  value={newProjectData.status}
                  onChange={e => setNewProjectData({ ...newProjectData, status: e.target.value })}
                >
                  <option value="Pendente" className="bg-zinc-900">Pendente</option>
                  <option value="Cliente" className="bg-zinc-900">Ativo</option>
                  <option value="Terminado" className="bg-zinc-900">Terminado</option>
                </Select>

                <Select 
                  label="Serviço de Interesse"
                  value={newProjectData.serviceType}
                  onChange={e => setNewProjectData({ ...newProjectData, serviceType: e.target.value })}
                  required
                >
                  <option value="" className="bg-zinc-900 text-zinc-500">Selecione um serviço</option>
                  <option value="Website & Perfil Google" className="bg-zinc-900">Website & Perfil Google</option>
                  <option value="Gestão de Redes Sociais" className="bg-zinc-900">Gestão de Redes Sociais</option>
                  <option value="Tráfego Pago" className="bg-zinc-900">Tráfego Pago</option>
                  <option value="Automações" className="bg-zinc-900">Automações</option>
                  <option value="Aplicações" className="bg-zinc-900">Aplicações</option>
                  <option value="Outros" className="bg-zinc-900">Outros</option>
                </Select>

                {/* Modelo de Cobrança */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1 block">
                    Modelo de Cobrança
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setBillingType('one_time')}
                      className={cn(
                        "flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all",
                        billingType === 'one_time'
                          ? "bg-vela-red border-vela-red text-white"
                          : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                      )}
                    >
                      Pagamento Único
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingType('recurring')}
                      className={cn(
                        "flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2",
                        billingType === 'recurring'
                          ? "bg-vela-red border-vela-red text-white"
                          : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                      )}
                    >
                      <Repeat size={13} />
                      Pagamento Recorrente
                    </button>
                  </div>
                </div>

                {/* Valor da Proposta / Ciclo */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1 block">
                    {billingType === 'recurring' ? 'Valor por Ciclo (€)' : 'Valor da Proposta (€)'}
                  </label>
                  <div className="relative">
                    <Euro size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={proposalValue}
                      onChange={e => setProposalValue(e.target.value)}
                      placeholder={billingType === 'recurring' ? 'Ex: 450' : 'Ex: 8500'}
                      required={billingType === 'recurring'}
                      className="w-full bg-white/[0.03] border border-white/5 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-vela-red/30 transition-all font-sans"
                    />
                  </div>
                </div>

                {billingType === 'recurring' && (
                  <div className="space-y-3">
                    <RecurringBillingFields
                      frequency={recurringFrequency}
                      onFrequencyChange={setRecurringFrequency}
                      customIntervalValue={customIntervalValue}
                      onCustomIntervalValueChange={setCustomIntervalValue}
                      customIntervalUnit={customIntervalUnit}
                      onCustomIntervalUnitChange={setCustomIntervalUnit}
                      startDate={recurringStartDate}
                      onStartDateChange={setRecurringStartDate}
                    />
                    {newProjectData.status === 'Cliente' && (
                      <div className="flex items-center gap-3 p-3.5 bg-white/[0.02] border border-white/5 rounded-xl">
                        <input
                          type="checkbox"
                          id="newProjectFirstCyclePaid"
                          checked={firstCyclePaid}
                          onChange={(e) => setFirstCyclePaid(e.target.checked)}
                          className="w-4 h-4 rounded border-white/10 bg-white/5 text-vela-red focus:ring-vela-red cursor-pointer"
                        />
                        <label htmlFor="newProjectFirstCyclePaid" className="text-xs font-bold text-zinc-200 cursor-pointer select-none">
                          1º ciclo já liquidado no arranque
                        </label>
                      </div>
                    )}
                  </div>
                )}

                {/* Desconto Comercial */}
                <div className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                  <input
                    type="checkbox"
                    id="newProjectHasDiscount"
                    checked={hasDiscount}
                    onChange={(e) => setHasDiscount(e.target.checked)}
                    className="w-4 h-4 rounded border-white/10 bg-white/5 text-vela-red focus:ring-vela-red cursor-pointer"
                  />
                  <label htmlFor="newProjectHasDiscount" className="text-xs font-bold text-white uppercase tracking-wider cursor-pointer select-none">
                    Tem desconto comercial aplicável?
                  </label>
                </div>

                {hasDiscount && (
                  <div className="space-y-4 p-4 bg-white/[0.01] border border-white/5 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 font-sans block ml-1">
                        Tipo de Desconto
                      </label>
                      <div className="flex gap-4">
                        <button
                          type="button"
                          onClick={() => setDiscountType('fixed')}
                          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                            discountType === 'fixed' ? 'bg-vela-red border-vela-red text-white' : 'bg-white/5 border-white/10 text-zinc-400'
                          }`}
                        >
                          Fixo (€)
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiscountType('percentage')}
                          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                            discountType === 'percentage' ? 'bg-vela-red border-vela-red text-white' : 'bg-white/5 border-white/10 text-zinc-400'
                          }`}
                        >
                          Percentagem (%)
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1 block">
                          {discountType === 'fixed' ? "Valor do Desconto (€)" : "Percentagem (%)"}
                        </label>
                        <div className="relative">
                          {discountType === 'fixed' ? (
                            <Euro size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                          ) : (
                            <Percent size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                          )}
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={discountValue}
                            onChange={e => setDiscountValue(e.target.value)}
                            placeholder={discountType === 'fixed' ? "500" : "10"}
                            required={hasDiscount}
                            className="w-full bg-white/[0.03] border border-white/5 rounded-xl pl-10 pr-3 py-3 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-vela-red/30 transition-all font-sans"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1 block">
                          Validade (Opcional)
                        </label>
                        <div className="relative">
                          <Calendar size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                          <input
                            type="date"
                            value={discountExpiry}
                            onChange={e => setDiscountExpiry(e.target.value)}
                            className="w-full bg-white/[0.03] border border-white/5 rounded-xl pl-10 pr-3 py-3 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-vela-red/30 transition-all font-sans"
                          />
                        </div>
                      </div>
                    </div>

                    {parseFloat(proposalValue) > 0 && (
                      <p className="text-[11px] text-zinc-400">
                        Valor Final com Desconto:{' '}
                        <strong className="text-white font-mono">
                          {formatCurrency(
                            Math.max(
                              0,
                              (parseFloat(proposalValue) || 0) -
                                (discountType === 'percentage'
                                  ? (parseFloat(proposalValue) || 0) * ((parseFloat(discountValue) || 0) / 100)
                                  : (parseFloat(discountValue) || 0))
                            )
                          )}
                        </strong>
                      </p>
                    )}
                  </div>
                )}

                {/* Anexar Ficheiro da Proposta */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 font-sans block ml-1">
                    Anexar Ficheiro da Proposta
                  </label>
                  <div
                    onClick={() => proposalFileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const droppedFile = e.dataTransfer.files?.[0];
                      if (droppedFile) setAttachedProposalFile(droppedFile);
                    }}
                    className={cn(
                      "border border-dashed rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer hover:bg-white/[0.02] transition-all duration-300 relative",
                      attachedProposalFile ? "border-emerald-500/30 bg-emerald-500/[0.02]" : "border-white/10 bg-white/[0.01]"
                    )}
                  >
                    <input
                      type="file"
                      className="hidden"
                      ref={proposalFileInputRef}
                      onChange={(e) => setAttachedProposalFile(e.target.files?.[0] || null)}
                      accept=".pdf,.doc,.docx"
                    />
                    {attachedProposalFile && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAttachedProposalFile(null);
                          if (proposalFileInputRef.current) proposalFileInputRef.current.value = '';
                        }}
                        title="Remover ficheiro"
                        className="absolute top-3 right-3 p-1 text-zinc-500 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    )}
                    <Paperclip size={20} className={attachedProposalFile ? 'text-emerald-400 mb-2' : 'text-zinc-500 mb-2'} />
                    <p className="text-xs font-bold text-zinc-300 text-center">
                      {attachedProposalFile ? attachedProposalFile.name : "Arraste ou clique para anexar proposta comercial"}
                    </p>
                    <p className="text-[9px] text-zinc-600 uppercase font-sans mt-1 text-center">
                      PDF ou Word (Guarda automaticamente na pasta Google Drive do projeto)
                    </p>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={!newProjectData.clientId || !newProjectData.serviceType} 
                  className="w-full py-4 mt-4"
                >
                  Confirmar Alteração
                </Button>
              </form>
            </Modal>

            {/* Projects Display */}
            {view === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {sortedProjects.length > 0 ? sortedProjects.map((client) => (
                  <motion.div
                    key={client.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -5 }}
                    className="h-full"
                  >
                    <GlassCard 
                      hoverable 
                      className="h-full group p-8 border-white/5 flex flex-col cursor-pointer"
                      onClick={() => setSelectedProjectId(client.id)}
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center text-vela-red group-hover:scale-110 transition-transform">
                          <Folder size={20} strokeWidth={1.5} />
                        </div>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setProjectToDelete(client);
                          }}
                          title="Eliminar Projeto (mantém o cliente)"
                          className="text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors p-2"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-4">
                          <Badge className={getStatusColor(client.status)}>
                            {client.status}
                          </Badge>
                          {(client as any).recurringBilling?.enabled && (
                            <Badge variant="primary" className="inline-flex items-center gap-1">
                              <Repeat size={10} />
                              {formatFrequencyLabel((client as any).recurringBilling)}
                            </Badge>
                          )}
                        </div>
                        <h3 className="text-xl font-display font-black text-white tracking-tight uppercase italic mb-2 group-hover:text-vela-red transition-colors">
                          {client.name}
                        </h3>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest font-sans mb-6">
                          {client.serviceType}
                        </p>

                        <div className="grid grid-cols-2 gap-4 mb-8">
                          <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5">
                            <p className="text-[8px] text-zinc-600 font-black uppercase tracking-widest font-sans mb-1">Recursos</p>
                            <div 
                              className="flex items-center gap-2 text-zinc-400 hover:text-white cursor-pointer transition-colors" 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (client.driveFolderId) {
                                  window.open(`https://drive.google.com/drive/folders/${client.driveFolderId}`, '_blank');
                                }
                              }}
                            >
                              <Folder size={10} />
                              <span className="text-[9px] font-bold uppercase font-sans tracking-tighter">{client.driveFolderId ? 'Sincronização Drive Ativa' : 'Sem Link Drive'}</span>
                            </div>
                          </div>
                          <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 text-right flex flex-col justify-center">
                            <p className="text-[8px] text-zinc-600 font-black uppercase tracking-widest font-sans mb-1">Líquido</p>
                            <p className="text-[9px] text-white font-bold font-sans">{formatCurrency(client.receivedAmount)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                        <div className="flex -space-x-2">
                          {[1, 2].map((i) => (
                            <div key={i} className="w-6 h-6 rounded-full bg-zinc-800 border border-[#0D0D0F] flex items-center justify-center text-[8px] font-bold text-zinc-500">
                              {i === 1 ? 'AS' : 'JD'}
                            </div>
                          ))}
                        </div>
                        <button 
                          className="text-[9px] text-zinc-500 font-black uppercase tracking-widest hover:text-white transition-colors flex items-center gap-2 font-sans"
                        >
                          Ver Detalhes <ChevronRight size={10} />
                        </button>
                      </div>
                    </GlassCard>
                  </motion.div>
                )) : (
                  <div className="col-span-full py-20 text-center opacity-20">
                    <Folder size={48} className="mx-auto mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">Sem projetos ativos correspondentes</p>
                  </div>
                )}
              </div>
            ) : (
              <GlassCard className="overflow-hidden border-white/5">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.01]">
                      <th className="px-8 py-5 text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] font-sans">Projeto / Cliente</th>
                      <th className="px-8 py-5 text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] font-sans">Estado</th>
                      <th className="px-8 py-5 text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] font-sans">Equipa</th>
                      <th className="px-8 py-5 text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] font-sans text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {sortedProjects.length > 0 ? sortedProjects.map((client) => (
                      <tr key={client.id} className="group hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => setSelectedProjectId(client.id)}>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-9 h-9 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center text-zinc-500 group-hover:text-vela-red transition-colors">
                              <Folder size={16} />
                            </div>
                            <div>
                              <p className="text-sm font-normal text-white uppercase tracking-tight italic">{client.name}</p>
                              <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest font-sans mt-1">{client.serviceType}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={cn("text-[8px]", getStatusColor(client.status))}>
                              {client.status}
                            </Badge>
                            {(client as any).recurringBilling?.enabled && (
                              <Badge variant="primary" className="text-[8px] inline-flex items-center gap-1">
                                <Repeat size={9} />
                                {formatFrequencyLabel((client as any).recurringBilling)}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex -space-x-2">
                            <div className="w-7 h-7 rounded-full bg-zinc-800 border border-[#0D0D0F] flex items-center justify-center text-[8px] font-bold text-zinc-500">AS</div>
                            <div className="w-7 h-7 rounded-full bg-zinc-800 border border-[#0D0D0F] flex items-center justify-center text-[8px] font-bold text-zinc-500">JD</div>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setProjectToDelete(client);
                              }}
                              title="Eliminar Projeto (mantém o cliente)"
                              className="text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors p-2 glass rounded-lg border-white/5"
                            >
                              <Trash2 size={14} />
                            </button>
                            <button className="text-zinc-600 hover:text-white transition-colors p-2 glass rounded-lg border-white/5">
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                         <td colSpan={4} className="px-8 py-20 text-center opacity-20">
                            <Folder size={32} className="mx-auto mb-4" />
                            <p className="text-[10px] font-black uppercase tracking-widest">Sem registos</p>
                         </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </GlassCard>
            )}
          </motion.div>
        )}
      </AnimatePresence>
            {projectToDelete && (
              <ConfirmDeleteModal
                isOpen={!!projectToDelete}
                onClose={() => setProjectToDelete(null)}
                itemName={`${projectToDelete.name}${projectToDelete.serviceType ? ` (${projectToDelete.serviceType})` : ''}`}
                itemType="Projeto"
                subtitle={projectToDelete.status ? `Estado: ${projectToDelete.status}` : undefined}
                warningNote="Esta ação elimina apenas este projeto. A ficha do cliente e os restantes projetos continuarão ativos no CRM."
                onConfirm={async () => {
                  const deletedId = projectToDelete.id;
                  await deleteProject(deletedId);
                  if (selectedProjectId === deletedId) {
                    setSelectedProjectId(null);
                    onClearSelection?.();
                  }
                }}
              />
            )}
            <Modal
              isOpen={!!fileToDelete}
              onClose={() => setFileToDelete(null)}
              title="Confirmar Eliminação"
            >
              <div className="space-y-6">
                <p className="text-sm text-zinc-400">Tem a certeza que pretende eliminar o ficheiro <span className="text-white font-bold">{fileToDelete?.name}</span>? Esta ação não pode ser desfeita.</p>
                <div className="flex gap-4">
                  <Button variant="outline" className="flex-1" onClick={() => setFileToDelete(null)}>Cancelar</Button>
                  <Button variant="primary" className="flex-1 bg-red-500 hover:bg-red-600 border-red-500" onClick={handleDeleteFile}>Eliminar</Button>
                </div>
              </div>
            </Modal>
    </div>
  );
};

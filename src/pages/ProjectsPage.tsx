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
import { workspaceAPI, notifyWorkspaceUnauthorized } from '../lib/workspace';
import { RecurringBillingFields } from '../components/RecurringBillingFields';
import { ProjectOriginFields } from '../components/ProjectOriginFields';
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
  const [customIntervalValue, setCustomIntervalValue] = useState('');
  const [customIntervalUnit, setCustomIntervalUnit] = useState<CustomIntervalUnit>('months');
  const [recurringStartDate, setRecurringStartDate] = useState(getTodayISO());
  const [firstCyclePaid, setFirstCyclePaid] = useState(true);

  const [isNewProject, setIsNewProject] = useState(true);
  const [projectStartDate, setProjectStartDate] = useState('');
  const [projectEndDate, setProjectEndDate] = useState('');
  const [projectDateError, setProjectDateError] = useState<string | null>(null);
  const [liquidatedAmount, setLiquidatedAmount] = useState('');
  const [liquidatedDate, setLiquidatedDate] = useState(getTodayISO());

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
    setCustomIntervalValue('');
    setCustomIntervalUnit('months');
    setRecurringStartDate(getTodayISO());
    setFirstCyclePaid(true);
    setIsNewProject(true);
    setProjectStartDate('');
    setProjectEndDate('');
    setProjectDateError(null);
    setLiquidatedAmount('');
    setLiquidatedDate(getTodayISO());
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isNewProject && !projectStartDate) {
      setProjectDateError('Selecione a data de início do projeto.');
      return;
    }
    if (!isNewProject && projectEndDate && projectStartDate && projectEndDate < projectStartDate) {
      setProjectDateError('A data de fim não pode ser anterior à data de início.');
      return;
    }
    setProjectDateError(null);

    const entityId = newProjectData.clientId;
    const serviceType = newProjectData.serviceType;

    const capturedIsNewProject = isNewProject;
    const capturedProjectStartDate = capturedIsNewProject ? getTodayISO() : projectStartDate;
    const capturedProjectEndDate = !capturedIsNewProject ? projectEndDate : '';
    const hasEndDate = Boolean(capturedProjectEndDate);
    const targetStatus = hasEndDate ? 'Terminado' : newProjectData.status;
    const capturedLiquidatedDate = liquidatedDate || (hasEndDate ? capturedProjectEndDate : getTodayISO());
    const parsedLiquidatedAmt = Math.max(0, parseFloat(liquidatedAmount) || 0);

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
    let receivedAmt = (hasEndDate || targetStatus === 'Terminado') ? effectiveTotal : 0;
    let initialPayments: Payment[] = [];
    let recurringConfig: RecurringBillingConfig | undefined = undefined;

    if (hasEndDate) {
      if (effectiveTotal > 0) {
        initialPayments.push({
          id: 'p-' + Math.random().toString(36).substring(7),
          amount: effectiveTotal,
          date: capturedLiquidatedDate,
          status: 'received',
          type: capturedBillingType === 'recurring' ? 'recurring' : 'final',
          description: 'Projeto concluído (liquidado integralmente)'
        });
      }
      if (capturedBillingType === 'recurring') {
        recurringConfig = {
          enabled: true,
          amount: effectiveTotal,
          frequency: capturedFrequency,
          ...(capturedFrequency === 'custom'
            ? { customIntervalValue: capturedCustomVal, customIntervalUnit: capturedCustomUnit }
            : {}),
          startDate: capturedProjectStartDate || capturedStartDate,
          nextBillingDate: capturedProjectEndDate,
          active: false,
          cyclesPaid: effectiveTotal > 0 ? 1 : 0
        };
      }
    } else if (capturedBillingType === 'recurring') {
      const cycleAmount = (targetStatus === 'Pendente' && !(!capturedIsNewProject && capturedFirstCyclePaid)) ? baseVal : effectiveTotal;
      const todayStr = getTodayISO();

      if (targetStatus === 'Pendente' && (capturedIsNewProject || !capturedFirstCyclePaid)) {
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
            date: capturedLiquidatedDate,
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
    } else if (targetStatus === 'Terminado' && effectiveTotal > 0) {
      initialPayments.push({
        id: 'p-' + Math.random().toString(36).substring(7),
        amount: effectiveTotal,
        date: capturedLiquidatedDate,
        status: 'received',
        type: 'final',
        description: 'Projeto concluído (liquidado integralmente)'
      });
    } else if (targetStatus !== 'Pendente' || parsedLiquidatedAmt > 0) {
      totalVal = Math.max(effectiveTotal, parsedLiquidatedAmt);
      receivedAmt = parsedLiquidatedAmt;
      const remainingVal = Math.max(0, totalVal - receivedAmt);

      if (receivedAmt > 0) {
        initialPayments.push({
          id: 'p-' + Math.random().toString(36).substring(7),
          amount: receivedAmt,
          date: capturedLiquidatedDate,
          status: 'received',
          type: remainingVal === 0 ? 'final' : 'adjudication',
          description: remainingVal === 0 ? 'Liquidação integral' : 'Valor liquidado no registo'
        });
      }
      if (remainingVal > 0) {
        initialPayments.push({
          id: 'p-' + Math.random().toString(36).substring(7),
          amount: remainingVal,
          date: capturedProjectStartDate || getTodayISO(),
          status: 'pending',
          type: 'final',
          description: 'Valor por liquidar'
        });
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
            if (uploadResp.status === 401) {
              notifyWorkspaceUnauthorized();
            } else if (uploadResp.ok) {
              const uploadData = await uploadResp.json();
              if (uploadData?.id) {
                proposalFileUrl = `https://drive.google.com/file/d/${uploadData.id}/view`;
              }
            }
          } catch (uploadErr) {
            console.warn("Could not upload proposal file for new project:", uploadErr);
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
            isNewProject: capturedIsNewProject,
            projectStartDate: capturedProjectStartDate,
            projectEndDate: hasEndDate ? capturedProjectEndDate : null,
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
            isNewProject: capturedIsNewProject,
            projectStartDate: capturedProjectStartDate,
            ...(hasEndDate ? { projectEndDate: capturedProjectEndDate } : {}),
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedProjectId(null);
                  onClearSelection?.();
                }}
                className="flex items-center gap-2.5 text-zinc-400 hover:text-white hover:-translate-x-0.5 transition-[color,transform] duration-150 group"
              >
                <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center group-hover:border-white/20 group-hover:bg-white/[0.06] transition-all duration-150">
                  <ArrowLeft size={16} />
                </div>
                <span className="text-xs font-semibold">Voltar aos Projetos</span>
              </button>
              <div className="flex items-center gap-3">
                <Badge className={getStatusColor(selectedProject.status)}>
                  {selectedProject.status}
                </Badge>
                <button
                  type="button"
                  onClick={() => setProjectToDelete(selectedProject)}
                  title="Eliminar Projeto (mantém o cliente)"
                  className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:border-red-500/30 hover:bg-red-500/10 text-zinc-300 hover:text-red-400 hover:-translate-y-[1px] active:translate-y-0 transition-all duration-150 text-xs font-semibold flex items-center gap-2"
                >
                  <Trash2 size={14} />
                  <span>Eliminar Projeto</span>
                </button>
              </div>
            </div>

            <div className="space-y-2 pb-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
                  {selectedProject.name}
                </h2>
                {(selectedProject as any).recurringBilling?.enabled && (
                  <Badge variant="primary" className="inline-flex items-center gap-1.5">
                    <Repeat size={11} />
                    <span>{formatFrequencyLabel((selectedProject as any).recurringBilling)}</span>
                    <span>·</span>
                    <span className="tabular-nums">{formatCurrency((selectedProject as any).recurringBilling.amount)}</span>
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                <span className="font-medium text-zinc-300">{selectedProject.serviceType}</span>
                {(selectedProject as any).projectStartDate && (
                  <>
                    <span className="text-zinc-700">·</span>
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <Calendar size={12} className="text-zinc-500" />
                      Início: {new Date(`${(selectedProject as any).projectStartDate}T00:00:00`).toLocaleDateString('pt-PT')}
                    </span>
                  </>
                )}
                {(selectedProject as any).projectEndDate && (
                  <>
                    <span className="text-zinc-700">·</span>
                    <span className="inline-flex items-center gap-1.5 text-emerald-400 tabular-nums">
                      <Calendar size={12} />
                      Fim: {new Date(`${(selectedProject as any).projectEndDate}T00:00:00`).toLocaleDateString('pt-PT')}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Proposal Section */}
              <GlassCard className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div className="space-y-1">
                    <h4 className="text-[11px] uppercase tracking-[0.14em] text-vela-red font-semibold">
                      Propostas &amp; Orçamentos
                    </h4>
                    <p className="text-xs text-zinc-400">Ciclo de adjudicação e documentos</p>
                  </div>
                  <span className="w-9 h-9 rounded-xl bg-vela-red/10 border border-vela-red/20 flex items-center justify-center text-vela-red shrink-0">
                    <Briefcase size={16} />
                  </span>
                </div>

                <div className="space-y-3">
                  {isLoadingDrive && (
                    <div className="flex items-center justify-center py-6 gap-2 text-zinc-400 text-xs">
                      <Loader2 className="animate-spin text-vela-red" size={16} />
                      <span>A procurar propostas no Drive...</span>
                    </div>
                  )}

                  {projectProposals.length === 0 && driveProposals.length === 0 && !isLoadingDrive && (
                    <div className="flex flex-col items-center justify-center py-12 border border-dashed border-white/[0.08] rounded-xl bg-white/[0.01]">
                      <FileText size={32} className="text-zinc-600 mb-3" strokeWidth={1.25} />
                      <p className="text-xs text-zinc-400 font-medium">Sem propostas vinculadas</p>
                    </div>
                  )}

                  {projectProposals.map((proposal: any) => (
                    <div
                      key={proposal.id}
                      className="p-5 rounded-xl bg-white/[0.025] border border-white/[0.07] hover:bg-white/[0.04] hover:border-vela-red/40 hover:-translate-y-[1px] transition-all duration-150 group cursor-pointer space-y-4"
                      onClick={() => window.open(proposal.fileUrl || `https://drive.google.com/drive/search?q=${encodeURIComponent(proposal.title)}`, '_blank')}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-vela-red/10 border border-vela-red/20 flex items-center justify-center text-vela-red shrink-0">
                          <FileText size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-white truncate">{proposal.title}</p>
                          <p className="text-xs text-zinc-400 mt-0.5 tabular-nums">
                            {formatCurrency(proposal.value)} · {proposal.date}
                            {proposal.discountAmount > 0 ? ` · Desc: ${formatCurrency(proposal.discountAmount)}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                        <div className="flex items-center gap-2">
                          <span className={cn("w-2 h-2 rounded-full", proposal.status === 'aceite' ? "bg-emerald-500" : "bg-amber-500")} />
                          <span className="text-xs font-medium text-zinc-400">
                            {proposal.status === 'aceite' ? 'Validada' : 'Pendente'}
                          </span>
                        </div>
                        <span className="text-xs text-vela-red font-semibold group-hover:translate-x-0.5 transition-transform duration-150 inline-flex items-center gap-1">
                          Ver Documento <ChevronRight size={13} />
                        </span>
                      </div>
                    </div>
                  ))}

                  {driveProposals.map(file => (
                    <div
                      key={file.id}
                      className="p-5 rounded-xl bg-white/[0.025] border border-white/[0.07] hover:bg-white/[0.04] hover:border-vela-red/40 hover:-translate-y-[1px] transition-all duration-150 group cursor-pointer space-y-4"
                      onClick={() => window.open(file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`, '_blank')}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-vela-red/10 border border-vela-red/20 flex items-center justify-center text-vela-red shrink-0">
                          <FileText size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-white truncate">{file.name}</p>
                            <Badge variant="primary" className="shrink-0">Drive</Badge>
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5 tabular-nums">
                            {file.size ? `${(Number(file.size) / (1024 * 1024)).toFixed(2)} MB` : 'Tamanho desconhecido'} · {new Date(file.modifiedTime || Date.now()).toLocaleDateString('pt-PT')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-xs font-medium text-zinc-400">Anexada no Drive</span>
                        </div>
                        <span className="text-xs text-vela-red font-semibold group-hover:translate-x-0.5 transition-transform duration-150 inline-flex items-center gap-1">
                          Abrir no Google Drive <ChevronRight size={13} />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* Files Section */}
              <GlassCard className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div className="space-y-1">
                    <h4 className="text-[11px] uppercase tracking-[0.14em] text-zinc-400 font-semibold">
                      Diretório de Ativos
                    </h4>
                    <p className="text-xs text-zinc-400">Sincronizado via Google Drive</p>
                  </div>
                  <span className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center text-zinc-400 shrink-0">
                    <Folder size={16} />
                  </span>
                </div>

                {selectedProject.driveFolderId ? (
                  <div className="space-y-5">
                    {/* Drag and Drop Universal Upload Zone */}
                    <div
                      className={cn(
                        "w-full p-6 border border-dashed rounded-xl transition-all duration-150 flex flex-col items-center justify-center cursor-pointer relative overflow-hidden group/drop",
                        isDragging
                          ? "border-vela-red bg-vela-red/5"
                          : "border-white/[0.12] bg-white/[0.015] hover:border-white/25 hover:bg-white/[0.03]"
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

                      <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-zinc-400 group-hover/drop:text-vela-red group-hover/drop:scale-105 transition-all duration-150 mb-3">
                        {isUploading ? (
                          <Loader2 size={20} className="animate-spin text-vela-red" />
                        ) : (
                          <FileText size={20} strokeWidth={1.5} />
                        )}
                      </div>

                      <p className="text-xs font-semibold text-zinc-200 mb-1 text-center">
                        {isUploading ? "A enviar para o Google Drive..." : "Arraste um ficheiro ou clique para carregar"}
                      </p>
                      <p className="text-[11px] text-zinc-500 text-center">
                        PDF, DOCX, Imagem, Excel (Até 10MB)
                      </p>

                      {isDragging && (
                        <div className="absolute inset-0 bg-vela-red/10 backdrop-blur-xs flex items-center justify-center pointer-events-none">
                          <p className="text-xs font-bold text-vela-red uppercase tracking-wider">Solte o ficheiro aqui</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
                      {isLoadingDrive ? (
                        <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 py-8">
                          <Loader2 size={14} className="animate-spin" />
                          <span>Sincronizando ficheiros...</span>
                        </div>
                      ) : driveFiles.length > 0 ? (
                        driveFiles.map(file => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.035] hover:border-white/[0.15] hover:-translate-y-[1px] transition-all duration-150 cursor-pointer group"
                          >
                            <div
                              className="flex items-center gap-3 flex-1 min-w-0"
                              onClick={() => window.open(file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`, '_blank')}
                            >
                              <FileText size={15} className="text-zinc-500 group-hover:text-vela-red transition-colors duration-150 shrink-0" />
                              <div className="min-w-0">
                                <span className="text-xs font-semibold text-zinc-200 truncate block">{file.name}</span>
                                <span className="text-[11px] text-zinc-500 tabular-nums">
                                  {file.size ? `${(Number(file.size) / (1024 * 1024)).toFixed(2)} MB` : 'Manual'} · {new Date(file.modifiedTime || Date.now()).toLocaleDateString('pt-PT')}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setFileToDelete({ id: file.id, name: file.name })}
                                className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 hover:scale-105 active:scale-95 rounded-lg transition-all duration-150"
                                title="Eliminar ficheiro"
                              >
                                <Trash2 size={14} />
                              </button>
                              <ChevronRight size={14} className="text-zinc-600 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-[color,transform] duration-150" />
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-zinc-500 text-center py-8 bg-white/[0.01] rounded-xl border border-dashed border-white/[0.07]">
                          Nenhum ficheiro detetado neste diretório
                        </p>
                      )}
                    </div>

                    <div className="pt-4 border-t border-white/[0.06] flex justify-end">
                      <Button
                        variant="outline"
                        className="text-xs"
                        onClick={() => window.open(`https://drive.google.com/drive/folders/${selectedProject.driveFolderId}`, '_blank')}
                      >
                        <span>Abrir Pasta no Drive</span>
                        <ExternalLink size={13} />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center px-6 text-zinc-500">
                    <Download size={28} strokeWidth={1.5} className="text-zinc-600 mb-3" />
                    <p className="text-xs font-medium text-zinc-400">Nenhum diretório Drive vinculado a esta entidade</p>
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
            {/* Page Header */}
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-1.5">
                <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-white">
                  Gestão de Projetos
                </h2>
                <p className="text-sm text-zinc-400 max-w-xl leading-relaxed">
                  Acompanhe entregas em curso, propostas vinculadas, pastas Google Drive e valores liquidados por projeto.
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() => setShowModal(true)}
                className="shrink-0"
              >
                <Plus size={15} />
                <span>Novo Projeto</span>
              </Button>
            </header>

            {/* Toolbar */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pt-5 border-t border-white/[0.06]">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Pesquisar projetos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-9 bg-white/[0.03] border border-white/[0.08] hover:border-white/20 rounded-xl pl-9 pr-3 text-xs text-white focus:outline-none focus:border-vela-red/50 transition-colors duration-150 placeholder:text-zinc-600"
                  />
                </div>

                <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.07]">
                  <button
                    type="button"
                    onClick={() => setSortBy('recent')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150",
                      sortBy === 'recent' ? "bg-vela-red text-white" : "text-zinc-400 hover:text-white hover:bg-white/[0.05]"
                    )}
                  >
                    Recentes
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortBy('alphabetical')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150",
                      sortBy === 'alphabetical' ? "bg-vela-red text-white" : "text-zinc-400 hover:text-white hover:bg-white/[0.05]"
                    )}
                  >
                    Alfabética
                  </button>
                </div>

                <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.07] overflow-x-auto max-w-full scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 shrink-0 tabular-nums",
                      statusFilter === 'all' ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                    )}
                  >
                    Todos ({activeProjects.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('Pendente')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 shrink-0 border border-transparent tabular-nums",
                      statusFilter === 'Pendente' ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/25" : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                    )}
                  >
                    Pendentes ({activeProjects.filter(p => p.status === 'Pendente').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('Cliente')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 shrink-0 border border-transparent tabular-nums",
                      statusFilter === 'Cliente' ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                    )}
                  >
                    Ativos ({activeProjects.filter(p => p.status === 'Cliente').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('Terminado')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 shrink-0 border border-transparent tabular-nums",
                      statusFilter === 'Terminado' ? "bg-red-500/15 text-red-300 border-red-500/25" : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                    )}
                  >
                    Terminados ({activeProjects.filter(p => p.status === 'Terminado').length})
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end xl:self-auto">
                <div className="flex items-center bg-white/[0.03] border border-white/[0.07] p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => handleSetView('grid')}
                    className={cn(
                      "p-1.5 rounded-lg transition-all duration-150",
                      view === 'grid' ? "bg-white/[0.08] text-vela-red" : "text-zinc-500 hover:text-zinc-300 hover:-translate-y-[1px]"
                    )}
                    title="Vista em grelha"
                  >
                    <LayoutGrid size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetView('list')}
                    className={cn(
                      "p-1.5 rounded-lg transition-all duration-150",
                      view === 'list' ? "bg-white/[0.08] text-vela-red" : "text-zinc-500 hover:text-zinc-300 hover:-translate-y-[1px]"
                    )}
                    title="Vista em lista"
                  >
                    <ListIcon size={15} />
                  </button>
                </div>
              </div>
            </div>

            <Modal 
              isOpen={showModal} 
              onClose={() => {
                setShowModal(false);
                resetNewProjectForm();
              }} 
              title="Iniciar Novo Projeto"
              subtitle="Associe o projeto a uma entidade e configure datas, cobrança e liquidação"
              size="lg"
            >
              <form onSubmit={handleCreateProject} className="space-y-6">
                {/* 1. Entidade & Âmbito */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 font-sans">
                    01 · Entidade &amp; Âmbito
                  </h4>

                  <Select
                    label="Selecionar Entidade"
                    value={newProjectData.clientId}
                    onChange={e => setNewProjectData({ ...newProjectData, clientId: e.target.value })}
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
                  </Select>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Select 
                      label="Estado do Projeto"
                      value={!isNewProject && projectEndDate ? 'Terminado' : newProjectData.status}
                      disabled={!isNewProject && Boolean(projectEndDate)}
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
                      <option value="Website & Perfil Google" className="bg-zinc-900">Website &amp; Perfil Google</option>
                      <option value="Gestão de Redes Sociais" className="bg-zinc-900">Gestão de Redes Sociais</option>
                      <option value="Tráfego Pago" className="bg-zinc-900">Tráfego Pago</option>
                      <option value="Automações" className="bg-zinc-900">Automações</option>
                      <option value="Aplicações" className="bg-zinc-900">Aplicações</option>
                      <option value="Outros" className="bg-zinc-900">Outros</option>
                    </Select>
                  </div>
                </div>

                {/* 2. Origem & Cronograma */}
                <div className="space-y-4 pt-5 border-t border-white/[0.06]">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 font-sans">
                    02 · Origem &amp; Cronograma
                  </h4>
                  <ProjectOriginFields
                    isNewProject={isNewProject}
                    onIsNewProjectChange={(val) => {
                      setIsNewProject(val);
                      setProjectDateError(null);
                    }}
                    startDate={projectStartDate}
                    onStartDateChange={(val) => {
                      setProjectStartDate(val);
                      setProjectDateError(null);
                    }}
                    endDate={projectEndDate}
                    onEndDateChange={(val) => {
                      setProjectEndDate(val);
                      if (val) setLiquidatedDate(val);
                      setProjectDateError(null);
                    }}
                    dateError={projectDateError}
                  />
                </div>

                {/* 3. Cobrança, Valores & Liquidação */}
                <div className="space-y-4 pt-5 border-t border-white/[0.06]">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 font-sans">
                    03 · Cobrança &amp; Liquidação
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-0.5 block">
                        Modelo de Cobrança
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setBillingType('one_time')}
                          className={cn(
                            "py-2.5 px-3 rounded-xl text-xs font-bold border transition-all",
                            billingType === 'one_time'
                              ? "bg-vela-red border-vela-red text-white shadow-lg shadow-vela-red/15"
                              : "bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white"
                          )}
                        >
                          Único
                        </button>
                        <button
                          type="button"
                          onClick={() => setBillingType('recurring')}
                          className={cn(
                            "py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5",
                            billingType === 'recurring'
                              ? "bg-vela-red border-vela-red text-white shadow-lg shadow-vela-red/15"
                              : "bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white"
                          )}
                        >
                          <Repeat size={13} />
                          Recorrente
                        </button>
                      </div>
                    </div>

                    <Input
                      label={billingType === 'recurring' ? 'Valor por Ciclo (€)' : 'Valor da Proposta (€)'}
                      type="number"
                      min="0"
                      step="any"
                      value={proposalValue}
                      onChange={e => setProposalValue(e.target.value)}
                      icon={<Euro size={15} />}
                      placeholder={billingType === 'recurring' ? 'Ex: 450' : 'Ex: 8500'}
                      required={billingType === 'recurring'}
                    />
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
                      {(!isNewProject || newProjectData.status === 'Cliente') && !(!isNewProject && projectEndDate) && newProjectData.status !== 'Terminado' && (
                        <div className="space-y-3 p-3.5 bg-white/[0.02] border border-white/[0.08] rounded-xl">
                          <div className="flex items-center gap-3">
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
                          {firstCyclePaid && (
                            <Input
                              label="Data da Liquidação"
                              type="date"
                              value={liquidatedDate}
                              onChange={(e) => setLiquidatedDate(e.target.value)}
                              icon={<Calendar size={14} />}
                              required
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Desconto Comercial */}
                  <div className="space-y-3">
                    <label
                      htmlFor="newProjectHasDiscount"
                      className="flex items-center gap-3 p-3.5 bg-white/[0.02] border border-white/[0.08] rounded-xl cursor-pointer hover:border-white/15 transition-colors"
                    >
                      <input
                        type="checkbox"
                        id="newProjectHasDiscount"
                        checked={hasDiscount}
                        onChange={(e) => setHasDiscount(e.target.checked)}
                        className="w-4 h-4 rounded border-white/10 bg-white/5 text-vela-red focus:ring-vela-red cursor-pointer"
                      />
                      <span className="text-xs font-bold text-white uppercase tracking-wider select-none">
                        Tem desconto comercial aplicável?
                      </span>
                    </label>

                    {hasDiscount && (
                      <div className="space-y-3.5 p-4 bg-white/[0.02] border border-white/[0.08] rounded-2xl animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setDiscountType('fixed')}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                              discountType === 'fixed' ? 'bg-vela-red border-vela-red text-white' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
                            }`}
                          >
                            Fixo (€)
                          </button>
                          <button
                            type="button"
                            onClick={() => setDiscountType('percentage')}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                              discountType === 'percentage' ? 'bg-vela-red border-vela-red text-white' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
                            }`}
                          >
                            Percentagem (%)
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <Input
                            label={discountType === 'fixed' ? "Valor do Desconto (€)" : "Percentagem (%)"}
                            type="number"
                            min="0"
                            step="any"
                            value={discountValue}
                            onChange={e => setDiscountValue(e.target.value)}
                            icon={discountType === 'fixed' ? <Euro size={14} /> : <Percent size={14} />}
                            placeholder={discountType === 'fixed' ? "500" : "10"}
                            required={hasDiscount}
                          />
                          <Input
                            label="Validade (Opcional)"
                            type="date"
                            value={discountExpiry}
                            onChange={e => setDiscountExpiry(e.target.value)}
                            icon={<Calendar size={14} />}
                          />
                        </div>

                        {parseFloat(proposalValue) > 0 && (
                          <div className="flex items-center justify-between text-xs text-zinc-400 pt-1 border-t border-white/5">
                            <span>Valor Final com Desconto</span>
                            <strong className="text-white font-mono tabular-nums">
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
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Valor Já Liquidado & Data da Liquidação */}
                  {((!isNewProject && projectEndDate) || newProjectData.status === 'Terminado') ? (
                    <div className="space-y-3 p-4 bg-emerald-500/[0.04] border border-emerald-500/20 rounded-2xl">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                          Valor Liquidado (100% Automático)
                        </span>
                        <strong className="text-emerald-400 font-mono tabular-nums text-sm">
                          {formatCurrency(
                            Math.max(
                              0,
                              (parseFloat(proposalValue) || 0) -
                                (hasDiscount
                                  ? (discountType === 'percentage'
                                      ? (parseFloat(proposalValue) || 0) * ((parseFloat(discountValue) || 0) / 100)
                                      : (parseFloat(discountValue) || 0))
                                  : 0)
                            )
                          )}
                        </strong>
                      </div>
                      <Input
                        label="Data da Liquidação"
                        type="date"
                        value={liquidatedDate}
                        onChange={(e) => setLiquidatedDate(e.target.value)}
                        icon={<Calendar size={14} />}
                        required
                      />
                    </div>
                  ) : billingType === 'one_time' && (!isNewProject || newProjectData.status !== 'Pendente') && (
                    <div className="space-y-3 p-4 bg-white/[0.02] border border-white/[0.08] rounded-2xl">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <Input
                          label="Valor Já Liquidado (€)"
                          type="number"
                          min="0"
                          step="any"
                          value={liquidatedAmount}
                          onChange={e => setLiquidatedAmount(e.target.value)}
                          icon={<Euro size={14} />}
                          placeholder="Ex: 1500"
                        />
                        <Input
                          label="Data da Liquidação"
                          type="date"
                          value={liquidatedDate}
                          onChange={e => setLiquidatedDate(e.target.value)}
                          icon={<Calendar size={14} />}
                          required={(parseFloat(liquidatedAmount) || 0) > 0}
                        />
                      </div>
                      {parseFloat(liquidatedAmount) > 0 && parseFloat(proposalValue) > 0 && (
                        <div className="flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-white/5">
                          <span>Por liquidar</span>
                          <strong className="text-amber-400 font-mono tabular-nums">
                            {formatCurrency(
                              Math.max(
                                0,
                                Math.max(
                                  0,
                                  (parseFloat(proposalValue) || 0) -
                                    (hasDiscount
                                      ? (discountType === 'percentage'
                                          ? (parseFloat(proposalValue) || 0) * ((parseFloat(discountValue) || 0) / 100)
                                          : (parseFloat(discountValue) || 0))
                                      : 0)
                                ) - (parseFloat(liquidatedAmount) || 0)
                              )
                            )}
                          </strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 4. Proposta Comercial */}
                <div className="space-y-2 pt-5 border-t border-white/[0.06]">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 font-sans mb-2">
                    04 · Proposta Comercial
                  </h4>
                  <div
                    onClick={() => proposalFileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const droppedFile = e.dataTransfer.files?.[0];
                      if (droppedFile) setAttachedProposalFile(droppedFile);
                    }}
                    className={cn(
                      "border border-dashed rounded-xl px-4 py-4 flex items-center gap-3.5 cursor-pointer hover:bg-white/[0.03] transition-all duration-200 relative",
                      attachedProposalFile ? "border-emerald-500/35 bg-emerald-500/[0.03]" : "border-white/15 bg-white/[0.015]"
                    )}
                  >
                    <input
                      type="file"
                      className="hidden"
                      ref={proposalFileInputRef}
                      onChange={(e) => setAttachedProposalFile(e.target.files?.[0] || null)}
                      accept=".pdf,.doc,.docx"
                    />
                    <div className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border",
                      attachedProposalFile ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400" : "bg-white/[0.04] border-white/10 text-zinc-400"
                    )}>
                      <Paperclip size={16} />
                    </div>
                    <div className="min-w-0 flex-1 pr-6">
                      <p className="text-xs font-bold text-zinc-200 truncate">
                        {attachedProposalFile ? attachedProposalFile.name : "Arraste ou clique para anexar proposta comercial"}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-sans mt-0.5">
                        PDF ou Word (Guarda automaticamente na pasta Google Drive do projeto)
                      </p>
                    </div>
                    {attachedProposalFile && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAttachedProposalFile(null);
                          if (proposalFileInputRef.current) proposalFileInputRef.current.value = '';
                        }}
                        title="Remover ficheiro"
                        className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-5 border-t border-white/[0.06] flex items-center justify-end gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowModal(false);
                      resetNewProjectForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={!newProjectData.clientId || !newProjectData.serviceType} 
                  >
                    Confirmar Alteração
                  </Button>
                </div>
              </form>
            </Modal>

            {/* Projects Display */}
            {view === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {sortedProjects.length > 0 ? sortedProjects.map((client) => (
                  <GlassCard
                    key={client.id}
                    hoverable
                    className="h-full group p-6 flex flex-col justify-between cursor-pointer"
                    onClick={() => setSelectedProjectId(client.id)}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center text-vela-red">
                          <Folder size={18} strokeWidth={1.75} />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setProjectToDelete(client);
                          }}
                          title="Eliminar Projeto (mantém o cliente)"
                          className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 hover:-translate-y-[1px] hover:scale-105 active:scale-95 rounded-lg transition-all duration-150 p-2"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap mb-3">
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

                      <h3 className="text-lg font-display font-bold text-white tracking-tight mb-1 group-hover:text-vela-red transition-colors duration-150">
                        {client.name}
                      </h3>
                      <p className="text-xs text-zinc-400 mb-3">
                        {client.serviceType}
                      </p>

                      {((client as any).projectStartDate || (client as any).projectEndDate) && (
                        <div className="flex items-center gap-2 flex-wrap mb-4 text-[11px] font-medium text-zinc-400 tabular-nums">
                          {(client as any).projectStartDate && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/[0.03] border border-white/[0.07]">
                              <Calendar size={10} className="text-zinc-500" />
                              {new Date(`${(client as any).projectStartDate}T00:00:00`).toLocaleDateString('pt-PT')}
                            </span>
                          )}
                          {(client as any).projectEndDate && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                              → {new Date(`${(client as any).projectEndDate}T00:00:00`).toLocaleDateString('pt-PT')}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3 mb-5">
                        <div
                          className={cn(
                            "p-3 rounded-xl bg-white/[0.025] border border-white/[0.06] transition-all duration-150",
                            client.driveFolderId && "hover:border-white/[0.18] hover:bg-white/[0.045] hover:-translate-y-[1px]"
                          )}
                          onClick={(e) => {
                            if (client.driveFolderId) {
                              e.stopPropagation();
                              window.open(`https://drive.google.com/drive/folders/${client.driveFolderId}`, '_blank');
                            }
                          }}
                        >
                          <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-1">Google Drive</p>
                          <div className="flex items-center gap-1.5 text-zinc-300 text-xs font-medium">
                            <Folder size={12} className="shrink-0 text-zinc-400" />
                            <span className="truncate">{client.driveFolderId ? 'Pasta Ativa' : 'Sem Pasta'}</span>
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-white/[0.025] border border-white/[0.06] text-right">
                          <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-1">Liquidado</p>
                          <p className="text-xs text-emerald-400 font-semibold tabular-nums">
                            {formatCurrency(client.receivedAmount || 0)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs">
                      <span className="text-zinc-500 tabular-nums">
                        Total: <strong className="text-zinc-200 font-semibold">{formatCurrency(client.totalValue || 0)}</strong>
                      </span>
                      <span className="text-zinc-400 font-semibold group-hover:text-white group-hover:translate-x-0.5 transition-[color,transform] duration-150 inline-flex items-center gap-1">
                        Ver Detalhes <ChevronRight size={13} />
                      </span>
                    </div>
                  </GlassCard>
                )) : (
                  <div className="col-span-full py-16 flex flex-col items-center justify-center text-center border border-dashed border-white/[0.08] rounded-2xl bg-white/[0.01]">
                    <Folder size={36} strokeWidth={1.25} className="text-zinc-600 mb-3" />
                    <p className="text-xs font-semibold text-zinc-400">Sem projetos ativos correspondentes</p>
                  </div>
                )}
              </div>
            ) : (
              <GlassCard className="p-0 overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="border-b border-white/[0.07] bg-white/[0.02]">
                        <th className="px-6 py-4 text-[11px] font-semibold text-zinc-400 uppercase tracking-[0.14em]">Projeto / Cliente</th>
                        <th className="px-6 py-4 text-[11px] font-semibold text-zinc-400 uppercase tracking-[0.14em]">Estado</th>
                        <th className="px-6 py-4 text-[11px] font-semibold text-zinc-400 uppercase tracking-[0.14em]">Liquidado / Total</th>
                        <th className="px-6 py-4 text-[11px] font-semibold text-zinc-400 uppercase tracking-[0.14em] text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {sortedProjects.length > 0 ? sortedProjects.map((client) => (
                        <tr
                          key={client.id}
                          className="group hover:bg-white/[0.025] transition-colors duration-150 cursor-pointer"
                          onClick={() => setSelectedProjectId(client.id)}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3.5">
                              <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center text-zinc-400 group-hover:text-vela-red transition-colors duration-150 shrink-0">
                                <Folder size={16} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-white group-hover:text-vela-red transition-colors duration-150 truncate">
                                  {client.name}
                                </p>
                                <p className="text-xs text-zinc-500 mt-0.5 tabular-nums truncate">
                                  {client.serviceType}
                                  {(client as any).projectStartDate ? ` · Início: ${new Date(`${(client as any).projectStartDate}T00:00:00`).toLocaleDateString('pt-PT')}` : ''}
                                  {(client as any).projectEndDate ? ` · Fim: ${new Date(`${(client as any).projectEndDate}T00:00:00`).toLocaleDateString('pt-PT')}` : ''}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 flex-wrap">
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
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-xs tabular-nums">
                              <span className="font-semibold text-emerald-400">{formatCurrency(client.receivedAmount || 0)}</span>
                              <span className="text-zinc-600 mx-1">/</span>
                              <span className="text-zinc-300 font-medium">{formatCurrency(client.totalValue || 0)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProjectToDelete(client);
                                }}
                                title="Eliminar Projeto (mantém o cliente)"
                                className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 hover:-translate-y-[1px] active:translate-y-0 transition-all duration-150 p-2 rounded-lg bg-white/[0.02] border border-white/[0.06]"
                              >
                                <Trash2 size={14} />
                              </button>
                              <button
                                type="button"
                                className="text-zinc-400 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.15] hover:translate-x-0.5 transition-all duration-150 p-2 rounded-lg bg-white/[0.02] border border-white/[0.06]"
                                title="Ver Detalhes"
                              >
                                <ChevronRight size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={4} className="px-6 py-16 text-center text-zinc-500">
                            <Folder size={32} strokeWidth={1.25} className="mx-auto mb-3 text-zinc-600" />
                            <p className="text-xs font-semibold text-zinc-400">Sem registos</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
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
              size="sm"
            >
              <div className="space-y-5">
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Tem a certeza que pretende eliminar o ficheiro <span className="text-white font-semibold">{fileToDelete?.name}</span>? Esta ação não pode ser desfeita.
                </p>
                <div className="pt-4 border-t border-white/[0.06] flex items-center justify-end gap-3">
                  <Button variant="secondary" onClick={() => setFileToDelete(null)}>Cancelar</Button>
                  <Button variant="primary" className="bg-red-600 hover:bg-red-500 border-red-500/30" onClick={handleDeleteFile}>Eliminar</Button>
                </div>
              </div>
            </Modal>
    </div>
  );
};

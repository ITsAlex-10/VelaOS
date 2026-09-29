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
  Users as UsersIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency } from '../lib/utils';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useBackgroundAction } from '../contexts/BackgroundActionContext';

interface ProjectsPageProps {
  preSelectedId?: string;
  onClearSelection?: () => void;
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({ preSelectedId, onClearSelection }) => {
  const { createClientProject, syncStatus, clients, proposals, isLoading, updateClient, getClientFiles, accessToken, uploadFile } = useWorkspace();
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
  const [newProjectData, setNewProjectData] = useState({ clientId: '', status: 'Cliente' });

  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter and search state like ClientsPage
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const activeProjects = clients.filter(c => c.status !== 'Lead');
  
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

  const selectedProject = activeProjects.find(c => c.id === selectedProjectId);
  const projectProposals = proposals.filter(p => p.clientId === selectedProjectId);

  const driveProposals = React.useMemo(() => {
    return driveFiles.filter((file: any) => 
      file.name && file.name.toLowerCase().includes('proposta')
    );
  }, [driveFiles]);

  useEffect(() => {
    if (selectedProject && selectedProject.driveFolderId && accessToken) {
      setIsLoadingDrive(true);
      getClientFiles(selectedProject.driveFolderId)
        .then((files) => {
          setDriveFiles(files || []);
        })
        .catch((err) => {
          console.error("Failed to load drive files:", err);
          setDriveFiles([]);
        })
        .finally(() => {
          setIsLoadingDrive(false);
        });
    } else {
      setDriveFiles([]);
    }
  }, [selectedProjectId, selectedProject?.driveFolderId, accessToken, getClientFiles]);

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
    
    const file = e.dataTransfer.files?.[0];
    if (!file || !selectedProject?.driveFolderId) return;

    setIsUploading(true);
    try {
      await uploadFile(selectedProject.id, selectedProject.driveFolderId, file);
      // Refresh files list
      const files = await getClientFiles(selectedProject.driveFolderId);
      setDriveFiles(files || []);
    } catch (err) {
      console.error(err);
      alert("Erro ao carregar ficheiro.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProject?.driveFolderId) return;

    setIsUploading(true);
    try {
      await uploadFile(selectedProject.id, selectedProject.driveFolderId, file);
      // Refresh files list
      const files = await getClientFiles(selectedProject.driveFolderId);
      setDriveFiles(files || []);
    } catch (err) {
      console.error(err);
      alert("Erro ao carregar ficheiro.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    const client = clients.find(c => c.id === newProjectData.clientId);
    if (!client) return;

    const clientId = client.id;
    const clientName = client.name;
    const targetStatus = newProjectData.status as any;

    // 1. Close modal IMMEDIATELY
    setShowModal(false);
    setNewProjectData({ clientId: '', status: 'Cliente' });

    // 2. Process in background
    runBackgroundAction({
      title: `A atualizar projeto de "${clientName}"...`,
      action: async () => {
        await updateClient(clientId, { 
          status: targetStatus,
          lastInteraction: new Date().toISOString()
        });
      },
      errorMessage: `Erro ao atualizar projeto de "${clientName}".`
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
              <Badge className={getStatusColor(selectedProject.status)}>
                {selectedProject.status}
              </Badge>
            </div>

            <div className="flex items-end justify-between">
              <div className="space-y-2">
                <h2 className="text-4xl font-display font-black text-white tracking-tighter uppercase italic">{selectedProject.name}</h2>
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

                  {projectProposals.map(proposal => (
                    <div 
                      key={proposal.id} 
                      className="p-8 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-vela-red/40 transition-all group cursor-pointer" 
                      onClick={() => window.open(`https://drive.google.com/drive/search?q=${encodeURIComponent(proposal.title)}`, '_blank')}
                    >
                      <div className="flex items-center gap-6 mb-8">
                        <div className="w-14 h-14 glass rounded-xl flex items-center justify-center text-vela-red group-hover:scale-110 transition-transform">
                          <FileText size={28} />
                        </div>
                        <div className="flex-1">
                          <p className="text-lg font-black text-white font-display uppercase italic">{proposal.title}</p>
                          <p className="text-[11px] text-zinc-600 font-bold uppercase tracking-widest mt-1">{formatCurrency(proposal.value)} // {proposal.date}</p>
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
                            onClick={() => window.open(file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`, '_blank')}
                          >
                            <div className="flex items-center gap-3">
                              <FileText size={16} className="text-zinc-600 group-hover:text-vela-red transition-colors" />
                              <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-zinc-300 truncate max-w-[200px]">{file.name}</span>
                                <span className="text-[8px] text-zinc-600 font-sans uppercase tracking-tighter">
                                  {file.size ? `${(Number(file.size) / (1024 * 1024)).toFixed(2)} MB` : 'Manual'} // {new Date(file.modifiedTime || Date.now()).toLocaleDateString('pt-PT')}
                                </span>
                              </div>
                            </div>
                            <ChevronRight size={14} className="text-zinc-700 group-hover:translate-x-1 transition-transform" />
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
              onClose={() => setShowModal(false)} 
              title="Iniciar Novo Projeto"
            >
              <form onSubmit={handleCreateProject} className="space-y-4">
                <Select 
                  label="Selecionar Entidade"
                  value={newProjectData.clientId}
                  onChange={e => setNewProjectData({ ...newProjectData, clientId: e.target.value })}
                  required
                >
                  <option value="" className="bg-zinc-900">Selecione um Cliente / Lead</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id} className="bg-zinc-900">{c.name} ({c.status})</option>
                  ))}
                </Select>

                <Select 
                  label="Estado do Projeto"
                  value={newProjectData.status}
                  onChange={e => setNewProjectData({ ...newProjectData, status: e.target.value })}
                >
                  <option value="Pendente" className="bg-zinc-900">Pendente</option>
                  <option value="Cliente" className="bg-zinc-900">Cliente</option>
                  <option value="Terminado" className="bg-zinc-900">Terminado</option>
                </Select>
                <Button 
                  type="submit" 
                  disabled={!newProjectData.clientId} 
                  className="w-full py-4 mt-4"
                >
                  Confirmar Alteração
                </Button>
              </form>
            </Modal>

            {/* Projects Display */}
            {view === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredProjects.length > 0 ? filteredProjects.map((client) => (
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
                          onClick={(e) => e.stopPropagation()} 
                          className="text-zinc-600 hover:text-white transition-colors p-1"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </div>

                      <div className="flex-1">
                        <Badge className={cn("mb-4", getStatusColor(client.status))}>
                           {client.status}
                        </Badge>
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
                    {filteredProjects.length > 0 ? filteredProjects.map((client) => (
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
                          <Badge className={cn("text-[8px]", getStatusColor(client.status))}>
                            {client.status}
                          </Badge>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex -space-x-2">
                            <div className="w-7 h-7 rounded-full bg-zinc-800 border border-[#0D0D0F] flex items-center justify-center text-[8px] font-bold text-zinc-500">AS</div>
                            <div className="w-7 h-7 rounded-full bg-zinc-800 border border-[#0D0D0F] flex items-center justify-center text-[8px] font-bold text-zinc-500">JD</div>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <button className="text-zinc-600 hover:text-white transition-colors p-2 glass rounded-lg border-white/5">
                            <ChevronRight size={14} />
                          </button>
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
    </div>
  );
};

import React, { useState, useRef } from 'react';
import { Modal, Input, Button } from './UI';
import { Client, ProjectStage } from '../types';
import { Euro, Calendar, Percent, Mail, Paperclip, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { useBackgroundAction } from '../contexts/BackgroundActionContext';
import { useWorkspace } from '../contexts/WorkspaceContext';

interface StatusTransitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
  targetStatus: ProjectStage;
  onConfirm: (data: any) => Promise<void>;
}

export const StatusTransitionModal: React.FC<StatusTransitionModalProps> = ({
  isOpen,
  onClose,
  client,
  targetStatus,
  onConfirm
}) => {
  const { runBackgroundAction } = useBackgroundAction();
  const { uploadFile, getOrCreateDriveFolder } = useWorkspace();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 2-Phase step state
  const [currentStep, setCurrentStep] = useState(1);

  // Lead -> Pendente fields (Phase 1)
  const [proposalValue, setProposalValue] = useState(client.totalValue ? client.totalValue.toString() : '');
  const [hasDiscount, setHasDiscount] = useState(false);
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState('0');
  const [discountExpiry, setDiscountExpiry] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);

  // Lead -> Pendente fields (Phase 2)
  const [clientType, setClientType] = useState<'individual' | 'empresarial'>('individual');
  const [nif, setNif] = useState('');
  const [fiscalAddress, setFiscalAddress] = useState('');

  // Pendente -> Cliente fields
  const [discountApplied, setDiscountApplied] = useState(false);
  const [paid50Percent, setPaid50Percent] = useState(true);
  const [manualAmount, setManualAmount] = useState('');
  const [dashboardEmail, setDashboardEmail] = useState(client.email || '');

  const calculate50Percent = () => {
    const baseValue = client.totalValue || 0;
    const discount = discountApplied ? (client.proposal?.discountAmount || 0) : 0;
    const finalValue = baseValue - discount;
    return finalValue * 0.5;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (targetStatus === 'Pendente' && currentStep === 1) {
      setCurrentStep(2);
      return;
    }

    let data: any = { 
      status: targetStatus,
      lastInteraction: new Date().toISOString()
    };

    if (targetStatus === 'Pendente') {
      const baseVal = parseFloat(proposalValue) || 0;
      const discVal = parseFloat(discountValue) || 0;
      let finalDiscount = discVal;
      if (hasDiscount && discountType === 'percentage') {
        finalDiscount = baseVal * (discVal / 100);
      }

      const proposalObj: any = {
        id: Math.random().toString(36).substring(7),
        title: attachedFile ? attachedFile.name : `Proposta: ${client.name}`,
        value: baseVal,
        date: new Date().toISOString(),
        status: 'pendente',
        discountAmount: hasDiscount ? finalDiscount : 0,
        discountType: hasDiscount ? discountType : 'fixed',
        discountRawValue: hasDiscount ? discVal : 0,
      };
      if (hasDiscount && discountExpiry) {
        proposalObj.discountExpiry = discountExpiry;
      }

      data = {
        ...data,
        totalValue: baseVal,
        proposal: proposalObj,
        clientType,
        nif,
        fiscalAddress
      };
    } else if (targetStatus === 'Cliente') {
      const discountVal = discountApplied ? (client.proposal?.discountAmount || 0) : 0;
      const newTotalValue = client.totalValue - discountVal;
      const halfValue = newTotalValue / 2;
      const received = paid50Percent ? halfValue : parseFloat(manualAmount);
      
      // Update payments to reflect the new total value split
      const updatedPayments = [
        { 
          id: 'p-' + Math.random().toString(36).substring(7), 
          amount: halfValue, 
          date: new Date().toISOString().split('T')[0], 
          status: paid50Percent ? 'received' : 'pending', 
          type: 'adjudication' 
        },
        { 
          id: 'p-' + Math.random().toString(36).substring(7), 
          amount: halfValue, 
          date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 
          status: 'pending', 
          type: 'final' 
        }
      ];

      const existingProposal = client.proposal || {
        id: Math.random().toString(36).substring(7),
        title: `Proposta: ${client.name}`,
        value: newTotalValue,
        date: new Date().toISOString(),
        status: 'aceite'
      };

      const updatedProposal: any = {
        ...existingProposal,
        hasDiscountApplied: discountApplied,
        status: 'aceite'
      };

      data = {
        ...data,
        totalValue: newTotalValue,
        receivedAmount: (client.receivedAmount || 0) + (received || 0),
        payments: updatedPayments,
        dashboardEmail: dashboardEmail,
        hasDashboardAccess: true,
        proposal: updatedProposal
      };
    } else if (targetStatus === 'Terminado') {
      data = {
        ...data,
        receivedAmount: client.totalValue, // Full balance paid
        payments: (client.payments || []).map(p => ({ ...p, status: 'received' })),
        lastInteraction: new Date().toISOString()
      };
    }

    // 1. Close the pop-up IMMEDIATELY
    onClose();

    // 2. Process action in background with subtle progress indicator
    runBackgroundAction({
      title: attachedFile 
        ? `A criar pasta e anexar proposta comercial...` 
        : `A transitar ${client.name} para ${targetStatus}...`,
      action: async () => {
        let extraFields = {};
        if (targetStatus === 'Pendente' && attachedFile) {
          try {
            const folderId = client.driveFolderId || await getOrCreateDriveFolder(client.name);
            if (folderId) {
              const uploadRes = await uploadFile(client.id, folderId, attachedFile);
              if (uploadRes && uploadRes.id) {
                extraFields = {
                  driveFolderId: folderId,
                  proposalFileUrl: `https://drive.google.com/file/d/${uploadRes.id}/view`,
                  proposalFileName: attachedFile.name
                };
              }
            }
          } catch (uploadErr) {
            console.error("Error uploading proposal in transition modal:", uploadErr);
          }
        }
        await onConfirm({ ...data, ...extraFields });
      },
      errorMessage: `Erro ao atualizar estado de ${client.name}.`
    });
  };

  const renderLeadToPendentePhase1 = () => (
    <div className="space-y-4">
      <Input
        label="Valor da Proposta (€)"
        type="number"
        value={proposalValue}
        onChange={(e) => setProposalValue(e.target.value)}
        icon={<Euro size={16} />}
        placeholder="8500"
        required
      />
      
      <div className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
        <input
          type="checkbox"
          id="hasDiscount"
          checked={hasDiscount}
          onChange={(e) => setHasDiscount(e.target.checked)}
          className="w-4 h-4 rounded border-white/10 bg-white/5 text-vela-red focus:ring-vela-red"
        />
        <label htmlFor="hasDiscount" className="text-xs font-bold text-white uppercase tracking-wider cursor-pointer select-none">
          Aplicar desconto especial?
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
            <Input
              label={discountType === 'fixed' ? "Valor do Desconto (€)" : "Percentagem do Desconto (%)"}
              type="number"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              icon={discountType === 'fixed' ? <Euro size={16} /> : <Percent size={16} />}
              placeholder={discountType === 'fixed' ? "500" : "10"}
              required={hasDiscount}
            />
            <Input
              label="Validade do Desconto"
              type="date"
              value={discountExpiry}
              onChange={(e) => setDiscountExpiry(e.target.value)}
              icon={<Calendar size={16} />}
              required={hasDiscount}
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 font-sans block ml-1">
          Anexar Proposta Comercial
        </label>
        <div 
          onClick={() => fileInputRef.current?.click()}
          className={`border border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-white/[0.02] transition-all duration-300 ${
            attachedFile ? 'border-emerald-500/30 bg-emerald-500/[0.02]' : 'border-white/10 bg-white/[0.01]'
          }`}
        >
          <input 
            type="file" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={(e) => setAttachedFile(e.target.files?.[0] || null)}
            accept=".pdf,.doc,.docx"
          />
          <Paperclip size={20} className={attachedFile ? 'text-emerald-400 mb-2' : 'text-zinc-500 mb-2'} />
          <p className="text-xs font-bold text-zinc-300 text-center">
            {attachedFile ? attachedFile.name : "Arraste ou clique para anexar proposta"}
          </p>
          <p className="text-[9px] text-zinc-600 uppercase font-sans mt-1 text-center">PDF, DOCX (Opcional - Sincroniza para o Google Drive)</p>
        </div>
      </div>
    </div>
  );

  const renderLeadToPendentePhase2 = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 font-sans block ml-1">
          Tipo de Cliente
        </label>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setClientType('individual')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold border transition-all ${
              clientType === 'individual' ? 'bg-vela-red border-vela-red text-white' : 'bg-white/5 border-white/10 text-zinc-400'
            }`}
          >
            Individual
          </button>
          <button
            type="button"
            onClick={() => setClientType('empresarial')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold border transition-all ${
              clientType === 'empresarial' ? 'bg-vela-red border-vela-red text-white' : 'bg-white/5 border-white/10 text-zinc-400'
            }`}
          >
            Empresarial
          </button>
        </div>
      </div>

      <Input
        label={clientType === 'individual' ? "NIF do Indivíduo" : "NIF da Empresa"}
        type="text"
        value={nif}
        onChange={(e) => setNif(e.target.value)}
        placeholder="Ex: 512345678"
        required
      />

      <Input
        label="Morada Fiscal"
        type="text"
        value={fiscalAddress}
        onChange={(e) => setFiscalAddress(e.target.value)}
        placeholder="Ex: Rua das Flores, nº 12, Lisboa"
        required
      />
    </div>
  );

  const renderPendenteToCliente = () => (
    <div className="space-y-5">
      {client.proposal?.discountAmount ? (
        <div className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
          <input
            type="checkbox"
            id="discountApplied"
            checked={discountApplied}
            onChange={(e) => setDiscountApplied(e.target.checked)}
            className="w-4 h-4 rounded border-white/10 bg-white/5 text-vela-red focus:ring-vela-red"
          />
          <label htmlFor="discountApplied" className="text-xs font-bold text-white uppercase tracking-wider cursor-pointer select-none">
            Foi aplicado o desconto de {formatCurrency(client.proposal.discountAmount)}?
          </label>
        </div>
      ) : null}

      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">Pagamento de Adjudicação (50%)</p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setPaid50Percent(true)}
            className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
              paid50Percent ? 'bg-vela-red border-vela-red text-white' : 'bg-white/5 border-white/10 text-zinc-500'
            }`}
          >
            Pagar 50% ({formatCurrency(calculate50Percent())})
          </button>
          <button
            type="button"
            onClick={() => setPaid50Percent(false)}
            className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
              !paid50Percent ? 'bg-vela-red border-vela-red text-white' : 'bg-white/5 border-white/10 text-zinc-500'
            }`}
          >
            Valor Manual
          </button>
        </div>
      </div>

      {!paid50Percent && (
        <Input
          label="Introduzir Valor Liquidado (€)"
          type="number"
          value={manualAmount}
          onChange={(e) => setManualAmount(e.target.value)}
          icon={<Euro size={16} />}
          placeholder="4250"
          required={!paid50Percent}
        />
      )}

      <div className="space-y-3 pt-2">
        <p className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">Acesso à Dashboard</p>
        <Input
          label="Email para Acesso"
          type="email"
          value={dashboardEmail}
          onChange={(e) => setDashboardEmail(e.target.value)}
          icon={<Mail size={16} />}
          placeholder="cliente@projeto.com"
          required
        />
        <p className="text-[9px] text-zinc-600 italic">Este email terá permissões automáticas para visualizar o progresso do projeto.</p>
      </div>
    </div>
  );

  const renderClienteToTerminado = () => (
    <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl text-center space-y-6">
      <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mx-auto">
        <Euro size={28} />
      </div>
      <div className="space-y-2">
        <h4 className="text-sm font-bold text-white uppercase tracking-widest font-sans">Liquidação de Saldo</h4>
        <p className="text-xs text-zinc-500 font-sans leading-relaxed">
          Ao marcar como **Terminado**, o sistema assumirá que o saldo pendente de <span className="text-white font-bold">{formatCurrency(client.totalValue - client.receivedAmount)}</span> foi liquidado.
        </p>
      </div>
      <div className="flex justify-between items-center p-4 bg-zinc-900/50 rounded-xl border border-white/5">
        <div className="text-left">
          <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Valor Total Final</p>
          <p className="text-sm font-bold text-white">{formatCurrency(client.totalValue)}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Estado</p>
          <p className="text-sm font-bold text-emerald-500 italic">Liquidado</p>
        </div>
      </div>
    </div>
  );

  const getTitle = () => {
    if (targetStatus === 'Pendente') return `Configurar Proposta: ${client.name}`;
    if (targetStatus === 'Cliente') return `Ativar Cliente: ${client.name}`;
    if (targetStatus === 'Terminado') return `Concluir Projeto: ${client.name}`;
    return `Alterar Estado: ${targetStatus}`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={getTitle()}>
      {/* 2-Phase Header indicators */}
      {targetStatus === 'Pendente' && (
        <div className="flex items-center justify-between mb-8 px-1">
          <div className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
              currentStep === 1 
                ? 'bg-vela-red text-white shadow-[0_0_10px_rgba(255,34,28,0.4)]' 
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
            }`}>
              {currentStep === 1 ? '1' : '✓'}
            </span>
            <span className={`text-[10px] font-black uppercase tracking-wider transition-colors ${currentStep === 1 ? 'text-white' : 'text-zinc-500'}`}>
              1ª Fase: Proposta
            </span>
          </div>
          <div className="h-[1px] flex-1 bg-white/5 mx-4" />
          <div className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
              currentStep === 2 
                ? 'bg-vela-red text-white shadow-[0_0_10px_rgba(255,34,28,0.4)]' 
                : 'bg-white/5 text-zinc-500'
            }`}>
              2
            </span>
            <span className={`text-[10px] font-black uppercase tracking-wider transition-colors ${currentStep === 2 ? 'text-white' : 'text-zinc-500'}`}>
              2ª Fase: Faturação
            </span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {targetStatus === 'Pendente' && currentStep === 1 && renderLeadToPendentePhase1()}
        {targetStatus === 'Pendente' && currentStep === 2 && renderLeadToPendentePhase2()}
        {targetStatus === 'Cliente' && renderPendenteToCliente()}
        {targetStatus === 'Terminado' && renderClienteToTerminado()}

        <div className="flex gap-3 pt-2">
          {targetStatus === 'Pendente' && currentStep === 2 && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCurrentStep(1)}
              className="py-4 text-[10px] font-black uppercase tracking-[0.2em] font-sans px-6"
            >
              Anterior
            </Button>
          )}
          <Button
            type="submit"
            className="flex-1 py-4 transition-all text-[10px] font-black uppercase tracking-[0.2em] font-sans"
          >
            {targetStatus === 'Pendente' && currentStep === 1 ? 'Seguinte' : `Confirmar Transição para ${targetStatus}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

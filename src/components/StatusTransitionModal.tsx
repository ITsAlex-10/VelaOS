import React, { useState, useRef } from 'react';
import { Modal, Input, Button } from './UI';
import { Client, ProjectStage } from '../types';
import { Euro, Calendar, Percent, Mail, Paperclip, Check, FileText } from 'lucide-react';
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

  // --- Lead / Prospect -> Pendente Fields (Proposta Comercial) ---
  const [proposalValue, setProposalValue] = useState(
    client.proposal?.value ? client.proposal.value.toString() : (client.totalValue ? client.totalValue.toString() : '')
  );
  const [hasDiscount, setHasDiscount] = useState(!!client.proposal?.discountAmount);
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>(
    client.proposal?.discountType || 'fixed'
  );
  const [discountValue, setDiscountValue] = useState(
    client.proposal?.discountRawValue ? client.proposal.discountRawValue.toString() : (client.proposal?.discountAmount ? client.proposal.discountAmount.toString() : '0')
  );
  const [discountExpiry, setDiscountExpiry] = useState(client.proposal?.discountExpiry || '');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);

  // --- Prospect -> Cliente Fields (Faturação + Condições de Liquidação) ---
  const [clientType, setClientType] = useState<'individual' | 'empresarial'>(
    client.clientType || 'individual'
  );
  const [nif, setNif] = useState(client.nif || '');
  const [fiscalAddress, setFiscalAddress] = useState(client.fiscalAddress || '');

  // Base proposal value for Cliente conversion
  const existingProposalBase = client.proposal?.value || client.totalValue || 0;
  const [clienteProposalValue, setClienteProposalValue] = useState(
    existingProposalBase > 0 ? existingProposalBase.toString() : (proposalValue || '5000')
  );

  // Discount decision on conversion:
  const initialDiscountAvailable = (client.proposal?.discountAmount && client.proposal.discountAmount > 0)
    ? client.proposal.discountAmount
    : 0;
  const [discountAccepted, setDiscountAccepted] = useState<boolean>(initialDiscountAvailable > 0);
  const [customDiscountAmount, setCustomDiscountAmount] = useState(
    initialDiscountAvailable > 0 ? initialDiscountAvailable.toString() : '0'
  );

  // Liquidation calculation (50% default vs custom amount)
  const [liquidationMode, setLiquidationMode] = useState<'50_percent' | 'custom'>('50_percent');
  const [manualAmount, setManualAmount] = useState('');
  const [dashboardEmail, setDashboardEmail] = useState(client.dashboardEmail || client.email || '');

  // Dynamic calculations for Cliente
  const baseValNum = parseFloat(clienteProposalValue) || 0;
  const discAmountNum = discountAccepted ? (parseFloat(customDiscountAmount) || 0) : 0;
  const effectiveTotal = Math.max(0, baseValNum - discAmountNum);
  const calculated50Percent = effectiveTotal * 0.5;
  const effectiveReceivedAmount = liquidationMode === '50_percent'
    ? calculated50Percent
    : (parseFloat(manualAmount) || 0);
  const effectiveRemaining = Math.max(0, effectiveTotal - effectiveReceivedAmount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

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
        id: client.proposal?.id || Math.random().toString(36).substring(7),
        title: attachedFile ? attachedFile.name : (client.proposal?.title || `Proposta: ${client.name}`),
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
        proposal: proposalObj
      };
    } else if (targetStatus === 'Cliente') {
      // Create payment schedule: 1st tranche (received), 2nd tranche (pending)
      const updatedPayments = [
        { 
          id: 'p-' + Math.random().toString(36).substring(7), 
          amount: effectiveReceivedAmount, 
          date: new Date().toISOString().split('T')[0], 
          status: 'received' as const, 
          type: 'adjudication' as const 
        },
        { 
          id: 'p-' + Math.random().toString(36).substring(7), 
          amount: effectiveRemaining, 
          date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 
          status: 'pending' as const, 
          type: 'final' as const 
        }
      ];

      const updatedProposal: any = {
        ...(client.proposal || {
          id: Math.random().toString(36).substring(7),
          title: `Proposta: ${client.name}`,
          date: new Date().toISOString()
        }),
        value: effectiveTotal,
        hasDiscountApplied: discountAccepted,
        discountAmount: discAmountNum,
        status: 'aceite'
      };

      data = {
        ...data,
        clientType,
        nif,
        fiscalAddress,
        totalValue: effectiveTotal,
        receivedAmount: effectiveReceivedAmount,
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

  const renderLeadToPendente = () => (
    <div className="space-y-5">
      <Input
        label="Qual o valor da proposta? (€)"
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
          className="w-4 h-4 rounded border-white/10 bg-white/5 text-vela-red focus:ring-vela-red cursor-pointer"
        />
        <label htmlFor="hasDiscount" className="text-xs font-bold text-white uppercase tracking-wider cursor-pointer select-none">
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
            <Input
              label={discountType === 'fixed' ? "Valor do Desconto (€)" : "Percentagem (%)"}
              type="number"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              icon={discountType === 'fixed' ? <Euro size={16} /> : <Percent size={16} />}
              placeholder={discountType === 'fixed' ? "500" : "10"}
              required={hasDiscount}
            />
            <Input
              label="Data Limite de Validade"
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
            {attachedFile ? attachedFile.name : "Arraste ou clique para anexar proposta comercial"}
          </p>
          <p className="text-[9px] text-zinc-600 uppercase font-sans mt-1 text-center">
            PDF ou Word (Guarda automaticamente na pasta Google Drive do negócio)
          </p>
        </div>
      </div>
    </div>
  );

  const renderProspectToCliente = () => (
    <div className="space-y-6">
      {/* 1. Secção de Faturação */}
      <div className="space-y-4 p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-vela-red" />
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 font-sans">
            Informações de Faturação
          </h4>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 font-sans block ml-1">
            Tipo de Cliente
          </label>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setClientType('individual')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${
                clientType === 'individual' ? 'bg-vela-red border-vela-red text-white' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              Individual
            </button>
            <button
              type="button"
              onClick={() => setClientType('empresarial')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${
                clientType === 'empresarial' ? 'bg-vela-red border-vela-red text-white' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
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
          placeholder="Ex: Rua Garrett, nº 24, 1200-204 Lisboa"
          required
        />
      </div>

      {/* 2. Condições da Proposta & Desconto */}
      <div className="space-y-4 p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 font-sans">
            Condições da Proposta & Aceitação
          </h4>
        </div>

        <Input
          label="Valor Base da Proposta (€)"
          type="number"
          value={clienteProposalValue}
          onChange={(e) => setClienteProposalValue(e.target.value)}
          icon={<Euro size={16} />}
          placeholder="5000"
          required
        />

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 font-sans block ml-1">
            A proposta foi aceite com ou sem desconto?
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setDiscountAccepted(false)}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold border transition-all ${
                !discountAccepted ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-white/5 border-white/10 text-zinc-400'
              }`}
            >
              Sem Desconto ({formatCurrency(baseValNum)})
            </button>
            <button
              type="button"
              onClick={() => setDiscountAccepted(true)}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold border transition-all ${
                discountAccepted ? 'bg-vela-red border-vela-red text-white' : 'bg-white/5 border-white/10 text-zinc-400'
              }`}
            >
              Com Desconto
            </button>
          </div>
        </div>

        {discountAccepted && (
          <div className="space-y-3 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
            <Input
              label="Valor Total do Desconto Deduzido (€)"
              type="number"
              value={customDiscountAmount}
              onChange={(e) => setCustomDiscountAmount(e.target.value)}
              icon={<Euro size={16} />}
              placeholder="500"
              required={discountAccepted}
            />
            <p className="text-[11px] text-zinc-400">
              Valor Final Acordado: <strong className="text-white font-mono">{formatCurrency(effectiveTotal)}</strong>
            </p>
          </div>
        )}
      </div>

      {/* 3. Valor Liquidado (Adiantamento) */}
      <div className="space-y-4 p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 font-sans">
            Valor Liquidado (Adiantamento Inicial)
          </h4>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 font-sans block ml-1">
            Qual foi o valor liquidado no fecho?
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setLiquidationMode('50_percent')}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold border transition-all ${
                liquidationMode === '50_percent' ? 'bg-vela-red border-vela-red text-white' : 'bg-white/5 border-white/10 text-zinc-400'
              }`}
            >
              50% Padrão ({formatCurrency(calculated50Percent)})
            </button>
            <button
              type="button"
              onClick={() => setLiquidationMode('custom')}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold border transition-all ${
                liquidationMode === 'custom' ? 'bg-vela-red border-vela-red text-white' : 'bg-white/5 border-white/10 text-zinc-400'
              }`}
            >
              Valor Personalizado
            </button>
          </div>
        </div>

        {liquidationMode === 'custom' && (
          <div className="pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
            <Input
              label="Escreva o Valor Liquidado (€)"
              type="number"
              value={manualAmount}
              onChange={(e) => setManualAmount(e.target.value)}
              icon={<Euro size={16} />}
              placeholder="Ex: 3000"
              required={liquidationMode === 'custom'}
            />
          </div>
        )}

        {/* Resumo Financeiro da Conversão */}
        <div className="grid grid-cols-2 gap-4 p-3 bg-zinc-950/60 rounded-xl border border-white/5 text-xs font-sans">
          <div>
            <span className="text-[9px] uppercase font-black tracking-widest text-zinc-500 block">Liquidado Agora</span>
            <span className="text-emerald-400 font-bold text-sm">{formatCurrency(effectiveReceivedAmount)}</span>
          </div>
          <div className="text-right">
            <span className="text-[9px] uppercase font-black tracking-widest text-zinc-500 block">Saldo Restante</span>
            <span className="text-zinc-300 font-bold text-sm">{formatCurrency(effectiveRemaining)}</span>
          </div>
        </div>
      </div>

      {/* 4. Acesso ao Portal */}
      <div className="space-y-2 pt-1">
        <Input
          label="Email para Acesso à Dashboard"
          type="email"
          value={dashboardEmail}
          onChange={(e) => setDashboardEmail(e.target.value)}
          icon={<Mail size={16} />}
          placeholder="cliente@empresa.com"
          required
        />
      </div>
    </div>
  );

  const renderClienteToTerminado = () => (
    <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl text-center space-y-6">
      <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mx-auto">
        <Euro size={28} />
      </div>
      <div className="space-y-2">
        <h4 className="text-sm font-bold text-white uppercase tracking-widest font-sans">Concluir Projeto & Liquidar Restante</h4>
        <p className="text-xs text-zinc-400 font-sans leading-relaxed">
          Ao marcar como <strong className="text-white">Terminado</strong>, o saldo pendente de{' '}
          <strong className="text-emerald-400">{formatCurrency(Math.max(0, client.totalValue - client.receivedAmount))}</strong> será integralmente liquidado.
        </p>
      </div>
      <div className="flex justify-between items-center p-4 bg-zinc-950/60 rounded-xl border border-white/5 text-left">
        <div>
          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Valor Total da Proposta</p>
          <p className="text-sm font-bold text-white">{formatCurrency(client.totalValue)}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Novo Estado</p>
          <p className="text-sm font-bold text-emerald-400">100% Liquidado & Terminado</p>
        </div>
      </div>
    </div>
  );

  const getTitle = () => {
    if (targetStatus === 'Pendente') return `Configurar Proposta: ${client.name}`;
    if (targetStatus === 'Cliente') return `Ativar Cliente & Faturação: ${client.name}`;
    if (targetStatus === 'Terminado') return `Terminar e Liquidar Proposta: ${client.name}`;
    return `Alterar Estado: ${targetStatus}`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={getTitle()}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {targetStatus === 'Pendente' && renderLeadToPendente()}
        {targetStatus === 'Cliente' && renderProspectToCliente()}
        {targetStatus === 'Terminado' && renderClienteToTerminado()}

        <div className="flex gap-3 pt-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] font-sans"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] bg-vela-red hover:bg-vela-red/90 text-white shadow-xl shadow-vela-red/20 font-sans"
          >
            {targetStatus === 'Pendente' && 'Apresentar Proposta'}
            {targetStatus === 'Cliente' && 'Confirmar & Ativar Cliente'}
            {targetStatus === 'Terminado' && 'Liquidar Restante & Terminar'}
            {targetStatus !== 'Pendente' && targetStatus !== 'Cliente' && targetStatus !== 'Terminado' && 'Confirmar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

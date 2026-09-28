import React, { useState } from 'react';
import { Modal, Input, Button, Select } from './UI';
import { Client, ProjectStage } from '../types';
import { Euro, Calendar, Percent, Mail } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { useBackgroundAction } from '../contexts/BackgroundActionContext';

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

  // Lead -> Pendente fields
  const [proposalValue, setProposalValue] = useState(client.totalValue.toString());
  const [hasDiscount, setHasDiscount] = useState(false);
  const [discountAmount, setDiscountAmount] = useState('0');
  const [discountExpiry, setDiscountExpiry] = useState('');

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

    let data: any = { 
      status: targetStatus,
      lastInteraction: new Date().toISOString()
    };

    if (targetStatus === 'Pendente') {
      const proposalObj: any = {
        id: Math.random().toString(36).substring(7),
        title: `Proposta: ${client.name}`,
        value: parseFloat(proposalValue) || 0,
        date: new Date().toISOString(),
        status: 'pendente',
        discountAmount: hasDiscount ? (parseFloat(discountAmount) || 0) : 0,
      };
      if (hasDiscount && discountExpiry) {
        proposalObj.discountExpiry = discountExpiry;
      }

      data = {
        ...data,
        totalValue: parseFloat(proposalValue) || 0,
        proposal: proposalObj
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
      title: `A transitar ${client.name} para ${targetStatus}...`,
      action: async () => {
        await onConfirm(data);
      },
      errorMessage: `Erro ao atualizar estado de ${client.name}.`
    });
  };

  const renderLeadToPendente = () => (
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
        <label htmlFor="hasDiscount" className="text-xs font-bold text-white uppercase tracking-wider cursor-pointer">
          Aplicar desconto especial?
        </label>
      </div>
      {hasDiscount && (
        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <Input
            label="Valor do Desconto (€)"
            type="number"
            value={discountAmount}
            onChange={(e) => setDiscountAmount(e.target.value)}
            icon={<Percent size={16} />}
            placeholder="500"
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
      )}
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
          <label htmlFor="discountApplied" className="text-xs font-bold text-white uppercase tracking-wider cursor-pointer">
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
      <form onSubmit={handleSubmit} className="space-y-6">
        {targetStatus === 'Pendente' && renderLeadToPendente()}
        {targetStatus === 'Cliente' && renderPendenteToCliente()}
        {targetStatus === 'Terminado' && renderClienteToTerminado()}

        <Button
          type="submit"
          className="w-full py-4 transition-all"
        >
          Confirmar Transição para {targetStatus}
        </Button>
      </form>
    </Modal>
  );
};

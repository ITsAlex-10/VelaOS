import React, { useState, useRef, useEffect } from 'react';
import { Modal, Input, Button } from './UI';
import { BillingFrequency, Client, CustomIntervalUnit, Payment, ProjectStage, RecurringBillingConfig } from '../types';
import { Euro, Calendar, Percent, Mail, Paperclip, Check, FileText, Repeat } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { useBackgroundAction } from '../contexts/BackgroundActionContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { RecurringBillingFields } from './RecurringBillingFields';
import { ProjectOriginFields } from './ProjectOriginFields';
import { calculateNextBillingDate, formatFrequencyLabel, getTodayISO } from '../lib/billing';

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
  const { uploadFile, ensureProjectDriveFolders } = useWorkspace();
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
    client.proposal?.discountRawValue ? client.proposal.discountRawValue.toString() : (client.proposal?.discountAmount ? client.proposal.discountAmount.toString() : '')
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
    existingProposalBase > 0 ? existingProposalBase.toString() : proposalValue
  );

  // Discount decision on conversion:
  const initialDiscountAvailable = (client.proposal?.discountAmount && client.proposal.discountAmount > 0)
    ? client.proposal.discountAmount
    : 0;
  const [discountAccepted, setDiscountAccepted] = useState<boolean>(initialDiscountAvailable > 0);
  const [customDiscountAmount, setCustomDiscountAmount] = useState(
    initialDiscountAvailable > 0 ? initialDiscountAvailable.toString() : ''
  );

  // Liquidation calculation (50% default vs custom amount)
  const [liquidationMode, setLiquidationMode] = useState<'50_percent' | 'custom'>('50_percent');
  const [manualAmount, setManualAmount] = useState('');
  const [dashboardEmail, setDashboardEmail] = useState(client.dashboardEmail || client.email || '');

  // Recurring billing fields
  const [billingType, setBillingType] = useState<'one_time' | 'recurring'>(
    (client.recurringBilling?.enabled || client.proposal?.billingType === 'recurring') ? 'recurring' : 'one_time'
  );
  const [recurringFrequency, setRecurringFrequency] = useState<BillingFrequency>(
    client.recurringBilling?.frequency || client.proposal?.recurringFrequency || 'monthly'
  );
  const [customIntervalValue, setCustomIntervalValue] = useState<string>(
    (client.recurringBilling?.customIntervalValue || client.proposal?.customIntervalValue)
      ? String(client.recurringBilling?.customIntervalValue || client.proposal?.customIntervalValue)
      : ''
  );
  const [customIntervalUnit, setCustomIntervalUnit] = useState<CustomIntervalUnit>(
    client.recurringBilling?.customIntervalUnit || client.proposal?.customIntervalUnit || 'months'
  );
  const [recurringStartDate, setRecurringStartDate] = useState<string>(
    client.recurringBilling?.startDate || getTodayISO()
  );
  const [firstCyclePaid, setFirstCyclePaid] = useState<boolean>(true);

  // Project Origin & Dates (Prospect -> Cliente)
  const [isNewProject, setIsNewProject] = useState<boolean>(true);
  const [projectStartDate, setProjectStartDate] = useState<string>('');
  const [projectEndDate, setProjectEndDate] = useState<string>('');
  const [projectDateError, setProjectDateError] = useState<string | null>(null);
  const [liquidatedDate, setLiquidatedDate] = useState<string>(getTodayISO());

  useEffect(() => {
    if (isOpen) {
      setLiquidatedDate(getTodayISO());
      setProjectDateError(null);
    }
  }, [isOpen, client.id, targetStatus]);

  const hasEndDate = !isNewProject && Boolean(projectEndDate);

  // Dynamic calculations for Cliente
  const baseValNum = parseFloat(clienteProposalValue) || 0;
  const discAmountNum = discountAccepted ? (parseFloat(customDiscountAmount) || 0) : 0;
  const effectiveTotal = Math.max(0, baseValNum - discAmountNum);
  const calculated50Percent = effectiveTotal * 0.5;
  const effectiveReceivedAmount = hasEndDate
    ? effectiveTotal
    : (liquidationMode === '50_percent' ? calculated50Percent : (parseFloat(manualAmount) || 0));
  const effectiveRemaining = Math.max(0, effectiveTotal - effectiveReceivedAmount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (targetStatus === 'Cliente') {
      if (!isNewProject && !projectStartDate) {
        setProjectDateError('Selecione a data de início do projeto.');
        return;
      }
      if (!isNewProject && projectEndDate && projectStartDate && projectEndDate < projectStartDate) {
        setProjectDateError('A data de fim não pode ser anterior à data de início.');
        return;
      }
      setProjectDateError(null);
    }

    let data: any = { 
      status: targetStatus,
      lastInteraction: new Date().toISOString()
    };

    const parsedCustomVal = Math.max(1, parseInt(customIntervalValue, 10) || 1);
    const startDateVal = recurringStartDate || getTodayISO();

    if (targetStatus === 'Pendente') {
      const baseVal = parseFloat(proposalValue) || 0;
      const discVal = parseFloat(discountValue) || 0;
      let finalDiscount = discVal;
      if (hasDiscount && discountType === 'percentage') {
        finalDiscount = baseVal * (discVal / 100);
      }
      const afterDiscount = Math.max(0, baseVal - (hasDiscount ? finalDiscount : 0));

      const proposalObj: any = {
        id: client.proposal?.id || Math.random().toString(36).substring(7),
        title: attachedFile ? attachedFile.name : (client.proposal?.title || `Proposta: ${client.name}`),
        value: baseVal,
        date: new Date().toISOString(),
        status: 'pendente',
        discountAmount: hasDiscount ? finalDiscount : 0,
        discountType: hasDiscount ? discountType : 'fixed',
        discountRawValue: hasDiscount ? discVal : 0,
        billingType,
        ...(billingType === 'recurring' ? {
          recurringFrequency,
          ...(recurringFrequency === 'custom' ? { customIntervalValue: parsedCustomVal, customIntervalUnit } : {})
        } : {})
      };
      if (hasDiscount && discountExpiry) {
        proposalObj.discountExpiry = discountExpiry;
      }

      const recurringCfg: RecurringBillingConfig | undefined = billingType === 'recurring'
        ? {
            enabled: true,
            amount: afterDiscount > 0 ? afterDiscount : baseVal,
            frequency: recurringFrequency,
            ...(recurringFrequency === 'custom'
              ? { customIntervalValue: parsedCustomVal, customIntervalUnit }
              : {}),
            startDate: startDateVal,
            nextBillingDate: startDateVal,
            active: false,
            cyclesPaid: 0
          }
        : undefined;

      data = {
        ...data,
        totalValue: baseVal,
        receivedAmount: 0,
        proposal: proposalObj,
        ...(recurringCfg ? { recurringBilling: recurringCfg } : {})
      };
    } else if (targetStatus === 'Cliente') {
      const capturedProjectStartDate = isNewProject ? getTodayISO() : projectStartDate;
      const capturedProjectEndDate = !isNewProject ? projectEndDate : '';
      const capturedLiquidatedDate = liquidatedDate || capturedProjectEndDate || getTodayISO();
      const resolvedStatus: ProjectStage = hasEndDate ? 'Terminado' : 'Cliente';

      const projectOriginPayload = {
        status: resolvedStatus,
        isNewProject,
        projectStartDate: capturedProjectStartDate,
        ...(hasEndDate ? { projectEndDate: capturedProjectEndDate } : {})
      };

      if (billingType === 'recurring') {
        const todayStr = getTodayISO();
        const updatedPayments: Payment[] = [];
        let nextDate = startDateVal;
        let cyclesPaid = 0;
        let totalVal = 0;
        let receivedAmt = 0;

        if (hasEndDate) {
          if (effectiveTotal > 0) {
            updatedPayments.push({
              id: 'p-' + Math.random().toString(36).substring(7),
              amount: effectiveTotal,
              date: capturedLiquidatedDate,
              saleDate: capturedProjectStartDate,
              status: 'received',
              type: 'recurring',
              description: 'Projeto concluído (liquidado integralmente)'
            });
          }
          totalVal = effectiveTotal;
          receivedAmt = effectiveTotal;
          cyclesPaid = effectiveTotal > 0 ? 1 : 0;
          nextDate = capturedProjectEndDate;
        } else if (firstCyclePaid) {
          updatedPayments.push({
            id: 'p-' + Math.random().toString(36).substring(7),
            amount: effectiveTotal,
            date: capturedLiquidatedDate,
            saleDate: capturedProjectStartDate,
            status: 'received',
            type: 'recurring',
            description: `1º Ciclo (${formatFrequencyLabel({ frequency: recurringFrequency, customIntervalValue: parsedCustomVal, customIntervalUnit })})`
          });
          totalVal = effectiveTotal;
          receivedAmt = effectiveTotal;
          cyclesPaid = 1;
          nextDate = calculateNextBillingDate(startDateVal, recurringFrequency, parsedCustomVal, customIntervalUnit);
        } else if (startDateVal <= todayStr) {
          updatedPayments.push({
            id: 'p-' + Math.random().toString(36).substring(7),
            amount: effectiveTotal,
            date: startDateVal,
            saleDate: startDateVal,
            status: 'pending',
            type: 'recurring',
            description: `1º Ciclo (${formatFrequencyLabel({ frequency: recurringFrequency, customIntervalValue: parsedCustomVal, customIntervalUnit })})`
          });
          totalVal = effectiveTotal;
          receivedAmt = 0;
          nextDate = calculateNextBillingDate(startDateVal, recurringFrequency, parsedCustomVal, customIntervalUnit);
        }

        const recurringCfg: RecurringBillingConfig = {
          enabled: true,
          amount: effectiveTotal,
          frequency: recurringFrequency,
          ...(recurringFrequency === 'custom'
            ? { customIntervalValue: parsedCustomVal, customIntervalUnit }
            : {}),
          startDate: hasEndDate ? (capturedProjectStartDate || startDateVal) : startDateVal,
          nextBillingDate: nextDate,
          active: !hasEndDate,
          cyclesPaid
        };

        const updatedProposal: any = {
          ...(client.proposal || {
            id: Math.random().toString(36).substring(7),
            title: `Proposta: ${client.name}`,
            date: new Date().toISOString()
          }),
          acceptedAt: capturedProjectStartDate,
          value: effectiveTotal,
          hasDiscountApplied: discountAccepted,
          discountAmount: discAmountNum,
          status: 'aceite',
          billingType: 'recurring',
          recurringFrequency,
          ...(recurringFrequency === 'custom'
            ? { customIntervalValue: parsedCustomVal, customIntervalUnit }
            : {})
        };

        data = {
          ...data,
          ...projectOriginPayload,
          saleDate: capturedProjectStartDate,
          clientType,
          nif,
          fiscalAddress,
          totalValue: totalVal,
          receivedAmount: receivedAmt,
          payments: updatedPayments,
          recurringBilling: recurringCfg,
          dashboardEmail: dashboardEmail,
          hasDashboardAccess: true,
          proposal: updatedProposal
        };
      } else {
        const updatedPayments: Payment[] = [];
        if (hasEndDate) {
          if (effectiveTotal > 0) {
            updatedPayments.push({
              id: 'p-' + Math.random().toString(36).substring(7),
              amount: effectiveTotal,
              date: capturedLiquidatedDate,
              saleDate: capturedProjectStartDate,
              status: 'received' as const,
              type: 'final' as const,
              description: 'Projeto concluído (liquidado integralmente)'
            });
          }
        } else {
          if (effectiveReceivedAmount > 0) {
            updatedPayments.push({
              id: 'p-' + Math.random().toString(36).substring(7),
              amount: effectiveReceivedAmount,
              date: capturedLiquidatedDate,
              saleDate: capturedProjectStartDate,
              status: 'received' as const,
              type: 'adjudication' as const
            });
          }
          if (effectiveRemaining > 0) {
            updatedPayments.push({
              id: 'p-' + Math.random().toString(36).substring(7),
              amount: effectiveRemaining,
              date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              saleDate: capturedProjectStartDate,
              status: 'pending' as const,
              type: 'final' as const
            });
          }
        }

        const updatedProposal: any = {
          ...(client.proposal || {
            id: Math.random().toString(36).substring(7),
            title: `Proposta: ${client.name}`,
            date: new Date().toISOString()
          }),
          acceptedAt: capturedProjectStartDate,
          value: effectiveTotal,
          hasDiscountApplied: discountAccepted,
          discountAmount: discAmountNum,
          status: 'aceite',
          billingType: 'one_time'
        };

        data = {
          ...data,
          ...projectOriginPayload,
          saleDate: capturedProjectStartDate,
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
      }
    } else if (targetStatus === 'Terminado') {
      const capturedLiquidatedDate = liquidatedDate || getTodayISO();
      const preservedSaleDate =
        client.saleDate ||
        client.proposal?.acceptedAt ||
        (client as any).projectStartDate ||
        (client.proposal?.status === 'aceite' ? client.proposal?.date : undefined);

      const updatedExistingPayments: Payment[] = (client.payments || []).map(p =>
        p.status === 'pending'
          ? {
              ...p,
              status: 'received' as const,
              saleDate: p.saleDate || preservedSaleDate || p.date,
              date: capturedLiquidatedDate
            }
          : p
      );
      const sumTrackedReceived = updatedExistingPayments
        .filter(p => p.status === 'received')
        .reduce((acc, p) => acc + (p.amount || 0), 0);
      const remainingGap = Math.max(0, (client.totalValue || 0) - sumTrackedReceived);
      if (remainingGap > 0.005) {
        updatedExistingPayments.push({
          id: 'p-' + Math.random().toString(36).substring(7),
          amount: remainingGap,
          date: capturedLiquidatedDate,
          saleDate: preservedSaleDate || capturedLiquidatedDate,
          status: 'received' as const,
          type: 'final' as const,
          description: 'Liquidação final (Projeto terminado)'
        });
      }

      data = {
        ...data,
        ...(preservedSaleDate ? { saleDate: preservedSaleDate } : {}),
        receivedAmount: client.totalValue, // Full balance paid
        projectEndDate: (client as any).projectEndDate || capturedLiquidatedDate,
        payments: updatedExistingPayments,
        ...(client.recurringBilling?.enabled ? {
          recurringBilling: { ...client.recurringBilling, active: false }
        } : {}),
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
        let extraFields: Record<string, any> = {};
        if (targetStatus === 'Pendente' || targetStatus === 'Cliente') {
          try {
            const ensured = await ensureProjectDriveFolders({
              clientId: targetStatus === 'Pendente' ? undefined : client.id,
              clientName: client.name,
              projectName: client.serviceType || 'Projeto Geral',
              existingClientFolderId: client.clientDriveFolderId,
              existingProjectFolderId: client.driveFolderId,
              parentClientId: client.parentClientId
            });
            if (ensured.clientFolderId) extraFields.clientDriveFolderId = ensured.clientFolderId;
            if (ensured.projectFolderId) extraFields.driveFolderId = ensured.projectFolderId;

            if (targetStatus === 'Pendente' && attachedFile && ensured.projectFolderId) {
              const uploadRes = await uploadFile(client.id, ensured.projectFolderId, attachedFile);
              if (uploadRes && uploadRes.id) {
                extraFields.proposalFileUrl = `https://drive.google.com/file/d/${uploadRes.id}/view`;
                extraFields.proposalFileName = attachedFile.name;
              }
            }
          } catch (uploadErr) {
            console.error("Error preparing Drive folders/proposal in transition modal:", uploadErr);
          }
        }
        await onConfirm({ ...data, ...extraFields });
      },
      errorMessage: `Erro ao atualizar estado de ${client.name}.`
    });
  };

  const renderLeadToPendente = () => (
    <div className="space-y-5">
      {/* 1. Cobrança & Valor */}
      <div className="space-y-4">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 font-sans">
          01 · Cobrança &amp; Valor
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 font-sans block ml-0.5">
              Modelo de Cobrança
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBillingType('one_time')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                  billingType === 'one_time' ? 'bg-vela-red border-vela-red text-white shadow-lg shadow-vela-red/15' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                Único
              </button>
              <button
                type="button"
                onClick={() => setBillingType('recurring')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  billingType === 'recurring' ? 'bg-vela-red border-vela-red text-white shadow-lg shadow-vela-red/15' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                <Repeat size={13} />
                Recorrente
              </button>
            </div>
          </div>

          <Input
            label={billingType === 'recurring' ? "Valor por Ciclo (€)" : "Valor da Proposta (€)"}
            type="number"
            value={proposalValue}
            onChange={(e) => setProposalValue(e.target.value)}
            icon={<Euro size={15} />}
            placeholder={billingType === 'recurring' ? "450" : "8500"}
            required
          />
        </div>

        {billingType === 'recurring' && (
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
        )}
      </div>

      {/* 2. Desconto Comercial */}
      <div className="space-y-3 pt-4 border-t border-white/[0.06]">
        <label
          htmlFor="hasDiscount"
          className="flex items-center gap-3 p-3.5 bg-white/[0.02] border border-white/[0.08] rounded-xl cursor-pointer hover:border-white/15 transition-colors"
        >
          <input
            type="checkbox"
            id="hasDiscount"
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
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                icon={discountType === 'fixed' ? <Euro size={14} /> : <Percent size={14} />}
                placeholder={discountType === 'fixed' ? "500" : "10"}
                required={hasDiscount}
              />
              <Input
                label="Data Limite de Validade"
                type="date"
                value={discountExpiry}
                onChange={(e) => setDiscountExpiry(e.target.value)}
                icon={<Calendar size={14} />}
                required={hasDiscount}
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Proposta Comercial */}
      <div className="space-y-2 pt-4 border-t border-white/[0.06]">
        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 font-sans block ml-0.5">
          Anexar Proposta Comercial
        </label>
        <div 
          onClick={() => fileInputRef.current?.click()}
          className={`border border-dashed rounded-xl px-4 py-4 flex items-center gap-3.5 cursor-pointer hover:bg-white/[0.03] transition-all duration-200 ${
            attachedFile ? 'border-emerald-500/35 bg-emerald-500/[0.03]' : 'border-white/15 bg-white/[0.015]'
          }`}
        >
          <input 
            type="file" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={(e) => setAttachedFile(e.target.files?.[0] || null)}
            accept=".pdf,.doc,.docx"
          />
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
            attachedFile ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-white/[0.04] border-white/10 text-zinc-400'
          }`}>
            <Paperclip size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-zinc-200 truncate">
              {attachedFile ? attachedFile.name : "Arraste ou clique para anexar proposta comercial"}
            </p>
            <p className="text-[10px] text-zinc-500 font-sans mt-0.5">
              PDF ou Word (Guarda automaticamente no Google Drive do negócio)
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderProspectToCliente = () => (
    <div className="space-y-6">
      {/* 1. Secção de Faturação & Acesso */}
      <div className="space-y-4">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 font-sans">
          01 · Faturação &amp; Acesso ao Portal
        </h4>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 font-sans block ml-0.5">
            Tipo de Cliente
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setClientType('individual')}
              className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${
                clientType === 'individual' ? 'bg-vela-red border-vela-red text-white shadow-lg shadow-vela-red/15' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              Individual
            </button>
            <button
              type="button"
              onClick={() => setClientType('empresarial')}
              className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${
                clientType === 'empresarial' ? 'bg-vela-red border-vela-red text-white shadow-lg shadow-vela-red/15' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              Empresarial
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={clientType === 'individual' ? "NIF do Indivíduo" : "NIF da Empresa"}
            type="text"
            value={nif}
            onChange={(e) => setNif(e.target.value)}
            placeholder="Ex: 512345678"
            required
          />
          <Input
            label="Email para Acesso à Dashboard"
            type="email"
            value={dashboardEmail}
            onChange={(e) => setDashboardEmail(e.target.value)}
            icon={<Mail size={15} />}
            placeholder="cliente@empresa.com"
            required
          />
        </div>

        <Input
          label="Morada Fiscal"
          type="text"
          value={fiscalAddress}
          onChange={(e) => setFiscalAddress(e.target.value)}
          placeholder="Ex: Rua Garrett, nº 24, 1200-204 Lisboa"
          required
        />
      </div>

      {/* 2. Condições da Proposta & Aceitação */}
      <div className="space-y-4 pt-5 border-t border-white/[0.06]">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 font-sans">
          02 · Condições da Proposta &amp; Aceitação
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 font-sans block ml-0.5">
              Modelo de Cobrança
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBillingType('one_time')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                  billingType === 'one_time' ? 'bg-vela-red border-vela-red text-white shadow-lg shadow-vela-red/15' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                Único
              </button>
              <button
                type="button"
                onClick={() => setBillingType('recurring')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  billingType === 'recurring' ? 'bg-vela-red border-vela-red text-white shadow-lg shadow-vela-red/15' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                <Repeat size={13} />
                Recorrente
              </button>
            </div>
          </div>

          <Input
            label={billingType === 'recurring' ? "Valor Base por Ciclo (€)" : "Valor Base da Proposta (€)"}
            type="number"
            value={clienteProposalValue}
            onChange={(e) => setClienteProposalValue(e.target.value)}
            icon={<Euro size={15} />}
            placeholder="5000"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 font-sans block ml-0.5">
            A proposta foi aceite com ou sem desconto?
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setDiscountAccepted(false)}
              className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all tabular-nums ${
                !discountAccepted ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              Sem Desconto ({formatCurrency(baseValNum)})
            </button>
            <button
              type="button"
              onClick={() => setDiscountAccepted(true)}
              className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${
                discountAccepted ? 'bg-vela-red border-vela-red text-white' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              Com Desconto
            </button>
          </div>
        </div>

        {discountAccepted && (
          <div className="space-y-2.5 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
            <Input
              label="Valor Total do Desconto Deduzido (€)"
              type="number"
              value={customDiscountAmount}
              onChange={(e) => setCustomDiscountAmount(e.target.value)}
              icon={<Euro size={14} />}
              placeholder="500"
              required={discountAccepted}
            />
            <p className="text-xs text-zinc-400">
              Valor Final Acordado: <strong className="text-white font-mono tabular-nums">{formatCurrency(effectiveTotal)}</strong>
            </p>
          </div>
        )}
      </div>

      {/* 3. Origem & Datas do Projeto */}
      <div className="space-y-4 pt-5 border-t border-white/[0.06]">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 font-sans">
          03 · Origem &amp; Cronograma
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
            if (val) {
              setLiquidatedDate(val);
            }
            setProjectDateError(null);
          }}
          dateError={projectDateError}
        />
      </div>

      {/* 4. Condições de Liquidação / Recorrência */}
      <div className="space-y-4 pt-5 border-t border-white/[0.06]">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 font-sans">
          04 · {hasEndDate ? 'Liquidação Automática' : (billingType === 'recurring' ? 'Cobrança Recorrente' : 'Adiantamento & Liquidação')}
        </h4>

        {hasEndDate ? (
          <div className="space-y-4 p-4 bg-emerald-500/[0.04] border border-emerald-500/20 rounded-2xl">
            <div className="grid grid-cols-2 gap-4 p-3 bg-zinc-950/60 rounded-xl border border-white/5 text-xs font-sans">
              <div>
                <span className="text-[9px] uppercase font-black tracking-widest text-zinc-500 block">Liquidado Totalmente</span>
                <span className="text-emerald-400 font-bold font-mono tabular-nums text-sm">{formatCurrency(effectiveTotal)}</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] uppercase font-black tracking-widest text-zinc-500 block">Saldo Restante</span>
                <span className="text-zinc-300 font-bold font-mono tabular-nums text-sm">{formatCurrency(0)}</span>
              </div>
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
        ) : billingType === 'recurring' ? (
          <div className="space-y-3.5">
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

            <div className="space-y-3 p-3.5 bg-white/[0.02] border border-white/[0.08] rounded-xl">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="transitionFirstCyclePaid"
                  checked={firstCyclePaid}
                  onChange={(e) => setFirstCyclePaid(e.target.checked)}
                  className="w-4 h-4 rounded border-white/10 bg-white/5 text-vela-red focus:ring-vela-red cursor-pointer"
                />
                <label htmlFor="transitionFirstCyclePaid" className="text-xs font-bold text-white cursor-pointer select-none">
                  1º pagamento recorrente liquidado no fecho
                </label>
              </div>
              {firstCyclePaid && (
                <Input
                  label="Data da Liquidação do 1º Ciclo"
                  type="date"
                  value={liquidatedDate}
                  onChange={(e) => setLiquidatedDate(e.target.value)}
                  icon={<Calendar size={14} />}
                  required
                />
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 p-3.5 bg-white/[0.02] rounded-xl border border-white/[0.08] text-xs font-sans">
              <div>
                <span className="text-[9px] uppercase font-black tracking-widest text-zinc-500 block">Por Ciclo</span>
                <span className="text-white font-bold font-mono tabular-nums text-sm">{formatCurrency(effectiveTotal)}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-black tracking-widest text-zinc-500 block">Frequência</span>
                <span className="text-vela-red font-bold text-xs">
                  {formatFrequencyLabel({
                    frequency: recurringFrequency,
                    customIntervalValue: Math.max(1, parseInt(customIntervalValue, 10) || 1),
                    customIntervalUnit
                  })}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[9px] uppercase font-black tracking-widest text-zinc-500 block">Próxima Cobrança</span>
                <span className="text-emerald-400 font-bold font-mono tabular-nums text-xs">
                  {firstCyclePaid
                    ? calculateNextBillingDate(
                        recurringStartDate || getTodayISO(),
                        recurringFrequency,
                        Math.max(1, parseInt(customIntervalValue, 10) || 1),
                        customIntervalUnit
                      )
                    : (recurringStartDate || getTodayISO())}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 font-sans block ml-0.5">
                Qual foi o valor liquidado no fecho?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setLiquidationMode('50_percent')}
                  className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all tabular-nums ${
                    liquidationMode === '50_percent' ? 'bg-vela-red border-vela-red text-white shadow-lg shadow-vela-red/15' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  50% Padrão ({formatCurrency(calculated50Percent)})
                </button>
                <button
                  type="button"
                  onClick={() => setLiquidationMode('custom')}
                  className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${
                    liquidationMode === 'custom' ? 'bg-vela-red border-vela-red text-white shadow-lg shadow-vela-red/15' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  Valor Personalizado
                </button>
              </div>
            </div>

            {(liquidationMode === 'custom' || effectiveReceivedAmount > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {liquidationMode === 'custom' && (
                  <Input
                    label="Escreva o Valor Liquidado (€)"
                    type="number"
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    icon={<Euro size={14} />}
                    placeholder="Ex: 3000"
                    required={liquidationMode === 'custom'}
                  />
                )}
                {effectiveReceivedAmount > 0 && (
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

            {/* Resumo Financeiro da Conversão */}
            <div className="grid grid-cols-2 gap-4 p-3.5 bg-white/[0.02] rounded-xl border border-white/[0.08] text-xs font-sans">
              <div>
                <span className="text-[9px] uppercase font-black tracking-widest text-zinc-500 block">Liquidado Agora</span>
                <span className="text-emerald-400 font-bold font-mono tabular-nums text-sm">{formatCurrency(effectiveReceivedAmount)}</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] uppercase font-black tracking-widest text-zinc-500 block">Saldo Restante</span>
                <span className="text-zinc-300 font-bold font-mono tabular-nums text-sm">{formatCurrency(effectiveRemaining)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderClienteToTerminado = () => (
    <div className="space-y-5">
      <div className="flex items-start gap-4 p-4 bg-emerald-500/[0.04] border border-emerald-500/20 rounded-2xl">
        <div className="w-11 h-11 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex items-center justify-center text-emerald-400 shrink-0">
          <Euro size={22} />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-black text-white uppercase tracking-widest font-sans">Concluir Projeto &amp; Liquidar Restante</h4>
          <p className="text-xs text-zinc-300 font-sans leading-relaxed">
            Ao marcar como <strong className="text-white">Terminado</strong>, o saldo pendente de{' '}
            <strong className="text-emerald-400 font-mono tabular-nums">{formatCurrency(Math.max(0, client.totalValue - client.receivedAmount))}</strong> será integralmente liquidado.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 p-4 bg-white/[0.02] rounded-xl border border-white/[0.08]">
        <div>
          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Valor Total da Proposta</p>
          <p className="text-sm font-bold font-mono tabular-nums text-white mt-0.5">{formatCurrency(client.totalValue)}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Novo Estado</p>
          <p className="text-sm font-bold text-emerald-400 mt-0.5">100% Liquidado &amp; Terminado</p>
        </div>
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
  );

  const getTitle = () => {
    if (targetStatus === 'Pendente') return `Configurar Proposta: ${client.name}`;
    if (targetStatus === 'Cliente') return `Ativar Cliente & Faturação: ${client.name}`;
    if (targetStatus === 'Terminado') return `Terminar e Liquidar: ${client.name}`;
    return `Alterar Estado: ${targetStatus}`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={getTitle()}
      size={targetStatus === 'Cliente' ? 'lg' : 'md'}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {targetStatus === 'Pendente' && renderLeadToPendente()}
        {targetStatus === 'Cliente' && renderProspectToCliente()}
        {targetStatus === 'Terminado' && renderClienteToTerminado()}

        <div className="pt-5 border-t border-white/[0.06] flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button type="submit">
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

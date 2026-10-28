/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Phase 4: Repair Order Management View
 * 10-Stage Service Lifecycle, Labor Tasks, Parts Issuance, and Customer Approval
 */

import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Printer,
  User,
  Car,
  ChevronRight,
  ChevronLeft,
  X,
  History,
  Package,
  Layers,
  ArrowRightLeft,
  Calendar,
  DollarSign,
  AlertTriangle,
  RotateCcw,
  Check,
  Send,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import type { RouteId } from '../i18n/translations.ts';
import { Card, CardContent } from '../components/ui/Card.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { Button } from '../components/ui/Button.tsx';
import { SearchInput, Input } from '../components/ui/Input.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { garageApi } from '../services/garageClient.ts';
import type {
  RepairOrderDTO,
  RepairOrderStatus,
  LaborTaskDTO,
  RepairOrderPartDTO,
  RepairOrderStatusHistoryDTO,
  CustomerDTO,
  VehicleDTO,
  TechnicianDTO,
  InventoryItemDTO,
  InventorySerialDTO,
} from '../types/ipc.ts';
import { formatOMR, formatBaisa, toBaisa, fromBaisa } from '../core/currency.ts';

const STATUS_ORDER: RepairOrderStatus[] = [
  'RECEIVED',
  'UNDER_INSPECTION',
  'AWAITING_APPROVAL',
  'APPROVED',
  'IN_PROGRESS',
  'WAITING_FOR_PARTS',
  'QUALITY_CHECK',
  'READY_FOR_DELIVERY',
  'COMPLETED',
  'CANCELLED',
];

export function RepairOrdersView({ onNavigate }: { onNavigate?: (route: RouteId) => void }) {
  const { lang, isRtl, t } = useLanguage();
  const isAr = lang === 'ar';
  const { showToast } = useToast();

  const [repairOrders, setRepairOrders] = useState<RepairOrderDTO[]>([]);
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [vehicles, setVehicles] = useState<VehicleDTO[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianDTO[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemDTO[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | RepairOrderStatus>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Detail Modal / Drawer
  const [selectedRO, setSelectedRO] = useState<RepairOrderDTO | null>(null);
  const [roLaborTasks, setRoLaborTasks] = useState<LaborTaskDTO[]>([]);
  const [roParts, setRoParts] = useState<RepairOrderPartDTO[]>([]);
  const [roHistory, setRoHistory] = useState<RepairOrderStatusHistoryDTO[]>([]);
  const [activeTab, setActiveTab] = useState<'tasks' | 'parts' | 'history'>('tasks');

  // Create RO Modal State
  const [isNewROOpen, setIsNewROOpen] = useState(false);
  const [newCustomerId, setNewCustomerId] = useState('');
  const [newVehicleId, setNewVehicleId] = useState('');
  const [newOdometerIn, setNewOdometerIn] = useState('');
  const [newReportedProblem, setNewReportedProblem] = useState('');
  const [newInspectionNotes, setNewInspectionNotes] = useState('');
  const [newRequestedWork, setNewRequestedWork] = useState('');
  const [newEstimatedCostOmr, setNewEstimatedCostOmr] = useState('25.000');
  const [newTechnicianId, setNewTechnicianId] = useState('');
  const [newExpectedDelivery, setNewExpectedDelivery] = useState('');
  const [isSubmittingRO, setIsSubmittingRO] = useState(false);

  // Status Change Modal
  const [statusChangeTarget, setStatusChangeTarget] = useState<RepairOrderStatus | null>(null);
  const [statusChangeRemarks, setStatusChangeRemarks] = useState('');

  // Customer Approval Modal
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [approvalDecision, setApprovalDecision] = useState<boolean>(true);
  const [approvalNotes, setApprovalNotes] = useState('');

  // Add Labor Task Modal
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [taskDescription, setTaskDescription] = useState('');
  const [taskTechnicianId, setTaskTechnicianId] = useState('');
  const [taskHours, setTaskHours] = useState('1.5');
  const [taskHourlyRateOmr, setTaskHourlyRateOmr] = useState('7.000');
  const [taskLaborChargeOmr, setTaskLaborChargeOmr] = useState('10.500');

  // Issue Part Modal
  const [isIssuePartOpen, setIsIssuePartOpen] = useState(false);
  const [issueItemId, setIssueItemId] = useState('');
  const [issueQuantity, setIssueQuantity] = useState('1');
  const [issueUnitPriceOmr, setIssueUnitPriceOmr] = useState('');
  const [issueSerialNumber, setIssueSerialNumber] = useState('');
  const [availableSerials, setAvailableSerials] = useState<InventorySerialDTO[]>([]);
  const [issueIdempotencyKey, setIssueIdempotencyKey] = useState('');
  const [isSubmittingPart, setIsSubmittingPart] = useState(false);

  // Return Part Modal
  const [returnPartTarget, setReturnPartTarget] = useState<RepairOrderPartDTO | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnIsDefective, setReturnIsDefective] = useState(false);

  // Printable Document Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Load all initial data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [roRes, custRes, vehRes, techRes, invRes] = await Promise.all([
        garageApi.getRepairOrders(),
        garageApi.getCustomers(undefined, true, true),
        garageApi.getVehicles(),
        garageApi.getTechnicians(),
        garageApi.getInventory(),
      ]);

      if (roRes.success && roRes.data) setRepairOrders(roRes.data);
      if (custRes.success && custRes.data) setCustomers(custRes.data);
      if (vehRes.success && vehRes.data) setVehicles(vehRes.data);
      if (techRes.success && techRes.data) setTechnicians(techRes.data);
      if (invRes.success && invRes.data) setInventoryItems(invRes.data);
    } catch {
      showToast('Error loading repair orders', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch sub-items whenever selectedRO changes
  const loadRODetails = async (roId: string) => {
    try {
      const [tasksRes, partsRes, histRes, roDetailsRes] = await Promise.all([
        garageApi.getLaborTasks(roId),
        garageApi.getRepairOrderParts(roId),
        garageApi.getStatusHistory(roId),
        garageApi.getRepairOrderById(roId),
      ]);

      if (tasksRes.success && tasksRes.data) setRoLaborTasks(tasksRes.data);
      if (partsRes.success && partsRes.data) setRoParts(partsRes.data);
      if (histRes.success && histRes.data) setRoHistory(histRes.data);
      if (roDetailsRes.success && roDetailsRes.data) {
        setSelectedRO(roDetailsRes.data);
        // Also update list entry
        setRepairOrders((prev) =>
          prev.map((item) => (item.id === roId ? roDetailsRes.data! : item))
        );
      }
    } catch {
      showToast('Error loading repair order details', 'error');
    }
  };

  const handleOpenDetail = (ro: RepairOrderDTO) => {
    setSelectedRO(ro);
    setActiveTab('tasks');
    loadRODetails(ro.id);
  };

  // Vehicles available for selected customer in creation modal
  const customerVehicles = vehicles.filter((v) => v.customerId === newCustomerId && v.isActive !== false);

  // Automatically update vehicle odometer default
  const handleVehicleSelect = (vId: string) => {
    setNewVehicleId(vId);
    const veh = vehicles.find((v) => v.id === vId);
    if (veh) {
      setNewOdometerIn(String(veh.odometer));
    }
  };

  // Create new RO
  const handleCreateRO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerId || !newVehicleId || !newReportedProblem.trim()) {
      showToast('Please fill all required fields.', 'error');
      return;
    }

    const odo = parseInt(newOdometerIn, 10);
    if (isNaN(odo) || odo < 0) {
      showToast('Valid odometer reading is required.', 'error');
      return;
    }

    const tech = technicians.find((t) => t.id === newTechnicianId);

    setIsSubmittingRO(true);
    try {
      const res = await garageApi.createRepairOrder({
        customerId: newCustomerId,
        vehicleId: newVehicleId,
        odometerIn: odo,
        reportedProblem: newReportedProblem.trim(),
        inspectionNotes: newInspectionNotes.trim() || undefined,
        requestedWork: newRequestedWork.trim() || undefined,
        estimatedCostBaisa: toBaisa(parseFloat(newEstimatedCostOmr) || 0),
        assignedTechnicianId: tech?.id,
        assignedTechnicianName: tech?.name,
        expectedAt: newExpectedDelivery || undefined,
      });

      if (res.success && res.data) {
        showToast('Repair order created successfully', 'success');
        setIsNewROOpen(false);
        // Reset form
        setNewCustomerId('');
        setNewVehicleId('');
        setNewOdometerIn('');
        setNewReportedProblem('');
        setNewInspectionNotes('');
        setNewRequestedWork('');
        setNewTechnicianId('');
        await loadData();
        handleOpenDetail(res.data);
      } else {
        showToast(res.error || 'Failed to create repair order', 'error');
      }
    } catch {
      showToast('An unexpected error occurred', 'error');
    } finally {
      setIsSubmittingRO(false);
    }
  };

  // Status Change
  const handleConfirmStatusChange = async () => {
    if (!selectedRO || !statusChangeTarget) return;

    try {
      const res = await garageApi.updateRepairOrderStatus({
        repairOrderId: selectedRO.id,
        newStatus: statusChangeTarget,
        remarks: statusChangeRemarks.trim() || undefined,
        changedBy: 'المشرف (Supervisor)',
      });

      if (res.success) {
        showToast(`Status updated to ${statusChangeTarget}`, 'success');
        setStatusChangeTarget(null);
        setStatusChangeRemarks('');
        await loadRODetails(selectedRO.id);
        await loadData();
      } else {
        showToast(res.error || 'Failed to update status', 'error');
      }
    } catch {
      showToast('Error updating status', 'error');
    }
  };

  // Customer Approval Submission
  const handleRecordApproval = async () => {
    if (!selectedRO) return;
    try {
      const res = await garageApi.recordCustomerApproval({
        repairOrderId: selectedRO.id,
        approved: approvalDecision,
        notes: approvalNotes.trim() || undefined,
        approvedBy: 'العميل (Customer)',
      });

      if (res.success) {
        showToast(approvalDecision ? 'Customer approval recorded' : 'Estimate rejected by customer', 'success');
        setIsApprovalModalOpen(false);
        setApprovalNotes('');
        await loadRODetails(selectedRO.id);
        await loadData();
      } else {
        showToast(res.error || 'Failed to record approval', 'error');
      }
    } catch {
      showToast('Error recording approval', 'error');
    }
  };

  // Add Labor Task
  const handleAddLaborTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRO || !taskDescription.trim()) return;

    const hours = parseFloat(taskHours) || 1.0;
    const rateOmr = parseFloat(taskHourlyRateOmr) || 0;
    const chargeOmr = parseFloat(taskLaborChargeOmr) || hours * rateOmr;
    const tech = technicians.find((t) => t.id === taskTechnicianId);

    try {
      const res = await garageApi.addLaborTask({
        repairOrderId: selectedRO.id,
        description: taskDescription.trim(),
        technicianId: tech?.id,
        technicianName: tech?.name,
        hours,
        hourlyRateBaisa: toBaisa(rateOmr),
        laborChargeBaisa: toBaisa(chargeOmr),
        isApproved: true,
      });

      if (res.success) {
        showToast('Labor task added successfully', 'success');
        setIsAddTaskOpen(false);
        setTaskDescription('');
        setTaskTechnicianId('');
        await loadRODetails(selectedRO.id);
      } else {
        showToast(res.error || 'Failed to add labor task', 'error');
      }
    } catch {
      showToast('Error adding task', 'error');
    }
  };

  // Delete Labor Task
  const handleDeleteLaborTask = async (taskId: string) => {
    if (!selectedRO) return;
    try {
      const res = await garageApi.deleteLaborTask(taskId);
      if (res.success) {
        showToast('Labor task removed', 'success');
        await loadRODetails(selectedRO.id);
      }
    } catch {
      showToast('Error deleting task', 'error');
    }
  };

  // Open Issue Part Modal
  const handleOpenIssuePart = async () => {
    setIssueItemId('');
    setIssueQuantity('1');
    setIssueUnitPriceOmr('');
    setIssueSerialNumber('');
    setAvailableSerials([]);
    setIssueIdempotencyKey(`issue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    setIsIssuePartOpen(true);
  };

  const handleSelectIssueItem = async (itemId: string) => {
    setIssueItemId(itemId);
    const item = inventoryItems.find((i) => i.id === itemId);
    if (item) {
      setIssueUnitPriceOmr(fromBaisa(item.sellingPriceBaisa).toFixed(3));
      if (item.isSerialized) {
        const serialsRes = await garageApi.getInventorySerials(item.id, 'IN_STOCK');
        if (serialsRes.success && serialsRes.data) {
          setAvailableSerials(serialsRes.data);
        }
      } else {
        setAvailableSerials([]);
      }
    }
  };

  // Submit Issue Part
  const handleIssuePart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRO || !issueItemId || isSubmittingPart) return;

    const qty = parseInt(issueQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      showToast('Valid quantity is required', 'error');
      return;
    }

    const priceBaisa = toBaisa(parseFloat(issueUnitPriceOmr) || 0);

    setIsSubmittingPart(true);
    try {
      const res = await garageApi.issuePartToRO({
        repairOrderId: selectedRO.id,
        itemId: issueItemId,
        quantity: qty,
        unitPriceBaisa: priceBaisa,
        serialNumber: issueSerialNumber.trim() || undefined,
        isApproved: true,
        idempotencyKey: issueIdempotencyKey,
      });

      if (res.success) {
        showToast('Part issued to repair order', 'success');
        setIsIssuePartOpen(false);
        await loadRODetails(selectedRO.id);
        await loadData();
      } else {
        showToast(res.error || 'Failed to issue part', 'error');
      }
    } catch {
      showToast('Error issuing part', 'error');
    } finally {
      setIsSubmittingPart(false);
    }
  };

  // Return Part
  const handleConfirmReturnPart = async () => {
    if (!selectedRO || !returnPartTarget) return;

    try {
      const res = await garageApi.returnPartFromRO({
        repairOrderId: selectedRO.id,
        roPartId: returnPartTarget.id,
        reason: returnReason.trim() || undefined,
        isDefective: returnIsDefective,
      });

      if (res.success) {
        showToast(returnIsDefective ? 'Defective part recorded and isolated from active stock' : 'Part returned to stock successfully', 'success');
        setReturnPartTarget(null);
        setReturnReason('');
        setReturnIsDefective(false);
        await loadRODetails(selectedRO.id);
        await loadData();
      } else {
        showToast(res.error || 'Failed to return part', 'error');
      }
    } catch {
      showToast('Error returning part', 'error');
    }
  };

  // Generate Invoice from RO
  const handleGenerateInvoice = async () => {
    if (!selectedRO) return;

    try {
      const res = await garageApi.createInvoiceFromRepairOrder({
        repairOrderId: selectedRO.id,
        invoiceLanguage: lang,
      });

      if (res.success && res.data) {
        showToast(`Invoice ${res.data.invoiceNumber} created successfully!`, 'success');
        await loadRODetails(selectedRO.id);
        await loadData();
        if (onNavigate) {
          onNavigate('invoices');
        }
      } else {
        showToast(res.error || 'Failed to generate invoice', 'error');
      }
    } catch {
      showToast('Error generating invoice', 'error');
    }
  };

  // Filtered ROs
  const filteredROs = repairOrders.filter((ro) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      ro.roNumber.toLowerCase().includes(q) ||
      (ro.customerName && ro.customerName.toLowerCase().includes(q)) ||
      (ro.vehiclePlate && ro.vehiclePlate.toLowerCase().includes(q)) ||
      ro.reportedProblem.toLowerCase().includes(q);

    const matchStatus = statusFilter === 'ALL' || ro.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const getStatusBadge = (status: RepairOrderStatus) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      RECEIVED: { label: t('status_RECEIVED'), color: 'bg-slate-800 text-slate-200 border-slate-700' },
      UNDER_INSPECTION: { label: t('status_UNDER_INSPECTION'), color: 'bg-indigo-950/70 text-indigo-300 border-indigo-700' },
      AWAITING_APPROVAL: { label: t('status_AWAITING_APPROVAL'), color: 'bg-amber-950/70 text-amber-300 border-amber-600' },
      APPROVED: { label: t('status_APPROVED'), color: 'bg-teal-950/70 text-teal-300 border-teal-700' },
      IN_PROGRESS: { label: t('status_IN_PROGRESS'), color: 'bg-blue-950/70 text-blue-300 border-blue-600' },
      WAITING_FOR_PARTS: { label: t('status_WAITING_FOR_PARTS'), color: 'bg-orange-950/70 text-orange-300 border-orange-700' },
      QUALITY_CHECK: { label: t('status_QUALITY_CHECK'), color: 'bg-purple-950/70 text-purple-300 border-purple-700' },
      READY_FOR_DELIVERY: { label: t('status_READY_FOR_DELIVERY'), color: 'bg-emerald-950/70 text-emerald-300 border-emerald-600' },
      COMPLETED: { label: t('status_COMPLETED'), color: 'bg-emerald-900 text-emerald-100 border-emerald-500' },
      CANCELLED: { label: t('status_CANCELLED'), color: 'bg-rose-950/70 text-rose-300 border-rose-800' },
      UNDER_REPAIR: { label: t('status_IN_PROGRESS'), color: 'bg-blue-950/70 text-blue-300 border-blue-600' },
      AWAITING_PARTS: { label: t('status_WAITING_FOR_PARTS'), color: 'bg-orange-950/70 text-orange-300 border-orange-700' },
      READY_FOR_COLLECTION: { label: t('status_READY_FOR_DELIVERY'), color: 'bg-emerald-950/70 text-emerald-300 border-emerald-600' },
      DELIVERED: { label: t('status_COMPLETED'), color: 'bg-emerald-900 text-emerald-100 border-emerald-500' },
    };
    const s = statusMap[status] || { label: status, color: 'bg-slate-800 text-slate-300 border-slate-700' };
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.color}`}>{s.label}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1c2638] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20 text-amber-400">
              <Wrench className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">{t('repairOrdersTitle')}</h1>
            <Badge variant="gold" className="text-amber-400 border-amber-500/30">
              Phase 4 Active
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">{t('repairOrdersSubtitle')}</p>
        </div>

        <Button
          onClick={() => setIsNewROOpen(true)}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold shadow-lg shadow-amber-500/20 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>{t('newRepairOrder')}</span>
        </Button>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-[#0f1522] border-[#1c2638]">
          <CardContent className="p-3.5">
            <span className="text-xs text-slate-400 block">{t('status_IN_PROGRESS')}</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold text-blue-400">
                {repairOrders.filter((r) => r.status === 'IN_PROGRESS').length}
              </span>
              <Wrench className="w-4 h-4 text-blue-400/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0f1522] border-[#1c2638]">
          <CardContent className="p-3.5">
            <span className="text-xs text-slate-400 block">{t('status_AWAITING_APPROVAL')}</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold text-amber-400">
                {repairOrders.filter((r) => r.status === 'AWAITING_APPROVAL').length}
              </span>
              <AlertCircle className="w-4 h-4 text-amber-400/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0f1522] border-[#1c2638]">
          <CardContent className="p-3.5">
            <span className="text-xs text-slate-400 block">{t('status_READY_FOR_DELIVERY')}</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold text-emerald-400">
                {repairOrders.filter((r) => r.status === 'READY_FOR_DELIVERY').length}
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0f1522] border-[#1c2638]">
          <CardContent className="p-3.5">
            <span className="text-xs text-slate-400 block">{t('status_COMPLETED')}</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold text-slate-200">
                {repairOrders.filter((r) => r.status === 'COMPLETED').length}
              </span>
              <FileText className="w-4 h-4 text-slate-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0f1522] p-3 rounded-xl border border-[#1c2638]">
        <div className="flex-1 max-w-md">
          <SearchInput
            placeholder={isAr ? 'بحث برقم أمر الإصلاح، اسم العميل، رقم اللوحة...' : 'Search by RO #, customer, plate...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs scrollbar-none">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
              statusFilter === 'ALL'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            {t('allStatus')} ({repairOrders.length})
          </button>
          {STATUS_ORDER.slice(0, 6).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                statusFilter === st
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
              }`}
            >
              {t(`status_${st}` as any)}
            </button>
          ))}
        </div>
      </div>

      {/* Repair Orders List Table */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-500 text-sm">{t('loading')}</div>
      ) : filteredROs.length === 0 ? (
        <EmptyState
          icon={<Wrench className="w-8 h-8" />}
          title={isAr ? 'لا توجد أوامر إصلاح مطابقة' : 'No matching repair orders'}
          description={isAr ? 'يمكنك إنشاء أمر صيانة جديد بالنقر على زر الإضافة أعلاه.' : 'Create a new repair order using the button above.'}
          action={
            <Button variant="gold" onClick={() => setIsNewROOpen(true)}>
              {t('newRepairOrder')}
            </Button>
          }
        />
      ) : (
        <div className="bg-[#0f1522] rounded-xl border border-[#1c2638] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-[#121a2a] text-slate-400 font-semibold border-b border-[#1c2638]">
                <tr>
                  <th className="py-3.5 px-4 text-start">{t('roNumber')}</th>
                  <th className="py-3.5 px-4 text-start">{t('customerName')}</th>
                  <th className="py-3.5 px-4 text-start">{t('plateNumber')}</th>
                  <th className="py-3.5 px-4 text-start">{t('reportedProblem')}</th>
                  <th className="py-3.5 px-4 text-start">{t('repairOrderStatus')}</th>
                  <th className="py-3.5 px-4 text-start">{t('assignedTechnician')}</th>
                  <th className="py-3.5 px-4 text-start">{t('grandTotal')}</th>
                  <th className="py-3.5 px-4 text-end">{t('viewDetails')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c2638]/70 text-slate-200">
                {filteredROs.map((ro) => (
                  <tr
                    key={ro.id}
                    onClick={() => handleOpenDetail(ro)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-amber-400 whitespace-nowrap">
                      {ro.roNumber}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-white max-w-[180px] truncate">
                      {ro.customerName || t('temporaryCustomer')}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-300 whitespace-nowrap">
                      {ro.vehiclePlate}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 max-w-[220px] truncate">
                      {ro.reportedProblem}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getStatusBadge(ro.status)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                      {ro.assignedTechnicianName || '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 whitespace-nowrap">
                      {formatBaisa(ro.grandTotalBaisa || 0, { arabicLabel: isAr, useThousandsSeparator: true })}
                    </td>
                    <td className="py-3.5 px-4 text-end">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetail(ro);
                        }}
                        className="text-xs h-7 px-2.5"
                      >
                        {isRtl ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* REPAIR ORDER DETAIL DRAWER / MODAL */}
      {/* ========================================================================= */}
      {selectedRO && (
        <Modal
          isOpen={Boolean(selectedRO)}
          onClose={() => setSelectedRO(null)}
          title={`${t('roDetails')}: ${selectedRO.roNumber}`}
          size="2xl"
        >
          <div className="space-y-5 text-xs text-slate-300 max-h-[75vh] overflow-y-auto pr-1">
            {/* Header Status & Top Info */}
            <div className="p-4 bg-[#121a2a] rounded-xl border border-[#1c2638] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-bold text-white">{selectedRO.roNumber}</span>
                  {getStatusBadge(selectedRO.status)}
                  {selectedRO.customerApproved ? (
                    <span className="bg-emerald-950 text-emerald-300 border border-emerald-700/60 text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      {t('approvalStatusApproved')}
                    </span>
                  ) : (
                    <span className="bg-amber-950/60 text-amber-300 border border-amber-700/60 text-[10px] px-2 py-0.5 rounded-full font-medium">
                      {t('approvalStatusPending')}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-slate-400 text-xs">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <strong className="text-white">{selectedRO.customerName}</strong>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Car className="w-3.5 h-3.5 text-slate-500" />
                    <strong className="text-white font-mono">{selectedRO.vehiclePlate}</strong> ({selectedRO.vehicleMake} {selectedRO.vehicleModel})
                  </span>
                  {(() => {
                    const v = vehicles.find((veh) => veh.id === selectedRO.vehicleId);
                    const vin = v?.vin || (selectedRO as any).vehicleVin;
                    return vin ? (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-slate-400">
                          <span>{t('vin') || 'رقم الشاصي'}:</span>
                          <strong className="text-amber-300 font-mono" dir="ltr">{vin}</strong>
                        </span>
                      </>
                    ) : null;
                  })()}
                  <span>•</span>
                  <span>{t('odometerIn')}: <strong className="text-white font-mono">{selectedRO.odometerIn} km</strong></span>
                </div>
              </div>

              {/* Status Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsApprovalModalOpen(true)}
                  className="text-xs h-8 text-amber-400 border-amber-500/40 hover:bg-amber-500/10"
                >
                  {t('customerApproval')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsPrintModalOpen(true)}
                  className="text-xs h-8 flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{t('printRO')}</span>
                </Button>
                {selectedRO.status !== 'COMPLETED' && selectedRO.status !== 'CANCELLED' && (
                  <Button
                    size="sm"
                    onClick={handleGenerateInvoice}
                    className="text-xs h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 shadow"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>{t('generateInvoice')}</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Workflow Progression Stepper */}
            <div className="p-3 bg-[#0d131f] rounded-xl border border-[#1c2638]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  {t('repairOrderStatus')}
                </span>
                <span className="text-[11px] text-amber-400">
                  {selectedRO.completedAt ? `${t('completedAt')}: ${selectedRO.completedAt.slice(0, 10)}` : t('status_IN_PROGRESS')}
                </span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {STATUS_ORDER.filter((s) => s !== 'CANCELLED').map((step, idx) => {
                  const isCurrent = selectedRO.status === step;
                  const isPassed = STATUS_ORDER.indexOf(selectedRO.status) > idx;
                  return (
                    <button
                      key={step}
                      type="button"
                      onClick={() => setStatusChangeTarget(step)}
                      className={`px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap transition-all border ${
                        isCurrent
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md shadow-amber-500/20'
                          : isPassed
                          ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800 hover:bg-emerald-900/50'
                          : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                      }`}
                    >
                      {idx + 1}. {t(`status_${step}` as any)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reported Problem & Inspection Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 bg-[#121a2a] rounded-lg border border-[#1c2638]">
                <span className="font-semibold text-slate-400 block mb-1">{t('reportedProblem')}</span>
                <p className="text-white text-xs leading-relaxed">{selectedRO.reportedProblem}</p>
              </div>

              <div className="p-3 bg-[#121a2a] rounded-lg border border-[#1c2638]">
                <span className="font-semibold text-slate-400 block mb-1">{t('inspectionNotes')}</span>
                <p className="text-white text-xs leading-relaxed">
                  {selectedRO.inspectionNotes || (isAr ? 'لم تسجل ملاحظات فحص بعد' : 'No inspection notes recorded')}
                </p>
              </div>
            </div>

            {/* Financial Summary Strip (OMR with 3 Decimal Places) */}
            <div className="p-3.5 bg-gradient-to-r from-[#121a2a] to-[#182338] rounded-xl border border-[#1c2638] flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[11px] text-slate-400 block">{t('roFinancialSummary')}</span>
                <span className="text-xs text-slate-300">
                  {t('subtotalParts')}: <strong className="font-mono text-white">{formatBaisa(selectedRO.partsTotalBaisa || 0)}</strong>
                  {' + '}
                  {t('subtotalLabor')}: <strong className="font-mono text-white">{formatBaisa(selectedRO.laborTotalBaisa || 0)}</strong>
                </span>
              </div>
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-[11px] text-slate-400 block">{t('taxAmount')}</span>
                  <span className="font-mono text-xs text-slate-300">{formatBaisa(selectedRO.taxAmountBaisa || 0)}</span>
                </div>
                <div className="text-end">
                  <span className="text-[11px] text-amber-400 font-semibold block">{t('grandTotal')}</span>
                  <span className="text-lg font-mono font-bold text-emerald-400">{formatBaisa(selectedRO.grandTotalBaisa || 0)}</span>
                </div>
              </div>
            </div>

            {/* Navigation Tabs (Labor Tasks, Spare Parts, Status History) */}
            <div className="border-b border-[#1c2638] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('tasks')}
                  className={`py-2 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === 'tasks'
                      ? 'border-amber-500 text-amber-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>{t('laborTasks')} ({roLaborTasks.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('parts')}
                  className={`py-2 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === 'parts'
                      ? 'border-amber-500 text-amber-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>{t('partsIssued')} ({roParts.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className={`py-2 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === 'history'
                      ? 'border-amber-500 text-amber-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>{t('statusHistory')} ({roHistory.length})</span>
                </button>
              </div>

              {/* Action buttons inside tabs */}
              {activeTab === 'tasks' && selectedRO.status !== 'COMPLETED' && selectedRO.status !== 'CANCELLED' && (
                <Button size="sm" onClick={() => setIsAddTaskOpen(true)} className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold">
                  <Plus className="w-3 h-3" />
                  <span>{t('addLaborTask')}</span>
                </Button>
              )}
              {activeTab === 'parts' && selectedRO.status !== 'COMPLETED' && selectedRO.status !== 'CANCELLED' && (
                <Button size="sm" onClick={handleOpenIssuePart} className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold">
                  <Plus className="w-3 h-3" />
                  <span>{t('issuePartToRO')}</span>
                </Button>
              )}
            </div>

            {/* TAB CONTENT: Labor Tasks */}
            {activeTab === 'tasks' && (
              <div className="space-y-3">
                {roLaborTasks.length === 0 ? (
                  <div className="py-8 text-center text-slate-500">{t('noTasksYet')}</div>
                ) : (
                  <div className="border border-[#1c2638] rounded-lg overflow-hidden">
                    <table className="w-full text-start text-xs">
                      <thead className="bg-[#121a2a] text-slate-400">
                        <tr>
                          <th className="py-2.5 px-3 text-start">{t('taskDescription')}</th>
                          <th className="py-2.5 px-3 text-start">{t('technician')}</th>
                          <th className="py-2.5 px-3 text-start">{t('taskHours')}</th>
                          <th className="py-2.5 px-3 text-start">{t('hourlyRate')}</th>
                          <th className="py-2.5 px-3 text-start">{t('laborCharge')}</th>
                          {selectedRO.status !== 'COMPLETED' && (
                            <th className="py-2.5 px-3 text-end">{t('cancel')}</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1c2638] text-slate-200">
                        {roLaborTasks.map((tItem) => (
                          <tr key={tItem.id} className="hover:bg-slate-800/30">
                            <td className="py-2.5 px-3 font-medium text-white">{tItem.description}</td>
                            <td className="py-2.5 px-3 text-slate-400">{tItem.technicianName || '—'}</td>
                            <td className="py-2.5 px-3 font-mono">{tItem.hours} hrs</td>
                            <td className="py-2.5 px-3 font-mono">{formatBaisa(tItem.hourlyRateBaisa)}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-amber-400">
                              {formatBaisa(tItem.laborChargeBaisa)}
                            </td>
                            {selectedRO.status !== 'COMPLETED' && (
                              <td className="py-2.5 px-3 text-end">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLaborTask(tItem.id)}
                                  className="text-rose-400 hover:text-rose-300 p-1"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: Spare Parts */}
            {activeTab === 'parts' && (
              <div className="space-y-3">
                {roParts.length === 0 ? (
                  <div className="py-8 text-center text-slate-500">{t('noPartsYet')}</div>
                ) : (
                  <div className="border border-[#1c2638] rounded-lg overflow-hidden">
                    <table className="w-full text-start text-xs">
                      <thead className="bg-[#121a2a] text-slate-400">
                        <tr>
                          <th className="py-2.5 px-3 text-start">{t('partName')}</th>
                          <th className="py-2.5 px-3 text-start">{t('partCode')}</th>
                          <th className="py-2.5 px-3 text-start">{t('serialNumber')}</th>
                          <th className="py-2.5 px-3 text-start">{t('quantityInStock')}</th>
                          <th className="py-2.5 px-3 text-start">{t('sellingPrice')}</th>
                          <th className="py-2.5 px-3 text-start">{t('grandTotal')}</th>
                          <th className="py-2.5 px-3 text-start">{t('invoiceStatus')}</th>
                          {selectedRO.status !== 'COMPLETED' && (
                            <th className="py-2.5 px-3 text-end">{t('returnPart')}</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1c2638] text-slate-200">
                        {roParts.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-800/30">
                            <td className="py-2.5 px-3 font-medium text-white">{p.partName}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-400">{p.partCode}</td>
                            <td className="py-2.5 px-3 font-mono text-amber-300">
                              {p.serialNumber || '—'}
                            </td>
                            <td className="py-2.5 px-3 font-mono">{p.quantity}</td>
                            <td className="py-2.5 px-3 font-mono">{formatBaisa(p.unitPriceBaisa)}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-amber-400">
                              {formatBaisa(p.totalPriceBaisa)}
                            </td>
                            <td className="py-2.5 px-3">
                              {p.status === 'ISSUED' ? (
                                <span className="text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded text-[10px]">
                                  {t('movementROIssue')}
                                </span>
                              ) : (
                                <span className="text-rose-400 bg-rose-950/60 border border-rose-800 px-2 py-0.5 rounded text-[10px]">
                                  {t('movementReturnToStock')}
                                </span>
                              )}
                            </td>
                            {selectedRO.status !== 'COMPLETED' && (
                              <td className="py-2.5 px-3 text-end">
                                {p.status === 'ISSUED' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setReturnPartTarget(p)}
                                    className="text-[10px] h-6 px-2 text-rose-300 border-rose-900 hover:bg-rose-950/40"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>{t('returnPart')}</span>
                                  </Button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: Status History */}
            {activeTab === 'history' && (
              <div className="space-y-2">
                {roHistory.length === 0 ? (
                  <div className="py-8 text-center text-slate-500">No status audit history recorded yet.</div>
                ) : (
                  <div className="space-y-2">
                    {roHistory.map((h) => (
                      <div key={h.id} className="p-2.5 bg-[#121a2a] rounded-lg border border-[#1c2638] flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-400">{h.oldStatus}</span>
                            <span className="text-slate-600">→</span>
                            <span className="font-semibold text-amber-400">{h.newStatus}</span>
                            <span className="text-[10px] text-slate-500">({h.changedBy})</span>
                          </div>
                          {h.remarks && <p className="text-[11px] text-slate-400">{h.remarks}</p>}
                        </div>
                        <span className="font-mono text-[10px] text-slate-500">
                          {new Date(h.changedAt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* NEW REPAIR ORDER MODAL */}
      {/* ========================================================================= */}
      {isNewROOpen && (
        <Modal
          isOpen={isNewROOpen}
          onClose={() => setIsNewROOpen(false)}
          title={t('newRepairOrder')}
          size="lg"
        >
          <form onSubmit={handleCreateRO} className="space-y-4 text-xs">
            {/* Customer Selector */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                {t('customerInputLabel')} <span className="text-amber-400">*</span>
              </label>
              <select
                value={newCustomerId}
                onChange={(e) => {
                  setNewCustomerId(e.target.value);
                  setNewVehicleId('');
                }}
                className="w-full bg-[#121a2a] border border-[#1c2638] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                required
              >
                <option value="">{isAr ? 'اختر العميل...' : 'Select customer...'}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.phone || 'No phone'}) - {c.isPermanent ? t('permanentCustomer') : t('temporaryCustomer')}
                  </option>
                ))}
              </select>
            </div>

            {/* Vehicle Selector (Restricted to selected customer) */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                {t('selectVehicleForRO')} <span className="text-amber-400">*</span>
              </label>
              <select
                value={newVehicleId}
                onChange={(e) => handleVehicleSelect(e.target.value)}
                disabled={!newCustomerId}
                className="w-full bg-[#121a2a] border border-[#1c2638] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 disabled:opacity-50"
                required
              >
                <option value="">
                  {!newCustomerId
                    ? (isAr ? 'يرجى اختيار العميل أولاً لعرض مركباته' : 'Select customer first to view vehicles')
                    : customerVehicles.length === 0
                    ? (isAr ? 'لا توجد مركبات مسجلة لهذا العميل' : 'No registered vehicles for this customer')
                    : (isAr ? 'اختر مركبة العميل...' : 'Select vehicle...')}
                </option>
                {customerVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber} — {v.make} {v.model} ({v.year}) [Odo: {v.odometer} km]
                  </option>
                ))}
              </select>
            </div>

            {/* Odometer & Technician */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {t('odometerIn')} <span className="text-amber-400">*</span>
                </label>
                <Input
                  type="number"
                  value={newOdometerIn}
                  onChange={(e) => setNewOdometerIn(e.target.value)}
                  placeholder="e.g. 52400"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {t('assignedTechnician')}
                </label>
                <select
                  value={newTechnicianId}
                  onChange={(e) => setNewTechnicianId(e.target.value)}
                  className="w-full bg-[#121a2a] border border-[#1c2638] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">{t('selectTechnician')}</option>
                  {technicians.map((tItem) => (
                    <option key={tItem.id} value={tItem.id}>
                      {tItem.name} ({tItem.specialty || 'General'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Reported Problem */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                {t('reportedProblem')} <span className="text-amber-400">*</span>
              </label>
              <textarea
                value={newReportedProblem}
                onChange={(e) => setNewReportedProblem(e.target.value)}
                rows={2}
                placeholder={isAr ? 'صوت غير طبيعي بالمحرك، اهتزاز بالفرامل، فحص دوري...' : 'Customer complaints or symptoms...'}
                className="w-full bg-[#121a2a] border border-[#1c2638] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            {/* Inspection Notes & Requested Work */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {t('inspectionNotes')}
                </label>
                <textarea
                  value={newInspectionNotes}
                  onChange={(e) => setNewInspectionNotes(e.target.value)}
                  rows={2}
                  placeholder={isAr ? 'نتيجة الفحص الأولي من الفني...' : 'Diagnostic report or initial inspection findings...'}
                  className="w-full bg-[#121a2a] border border-[#1c2638] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {t('requestedWork')}
                </label>
                <textarea
                  value={newRequestedWork}
                  onChange={(e) => setNewRequestedWork(e.target.value)}
                  rows={2}
                  placeholder={isAr ? 'تغيير زيت وفلتر، استبدال فحمات...' : 'Requested repairs and service items...'}
                  className="w-full bg-[#121a2a] border border-[#1c2638] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Initial Estimate & Expected Delivery */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {t('estimatedCost')} (OMR)
                </label>
                <Input
                  type="text"
                  value={newEstimatedCostOmr}
                  onChange={(e) => setNewEstimatedCostOmr(e.target.value)}
                  placeholder="25.000"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {t('expectedDelivery')}
                </label>
                <Input
                  type="date"
                  value={newExpectedDelivery}
                  onChange={(e) => setNewExpectedDelivery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#1c2638]">
              <Button type="button" variant="secondary" onClick={() => setIsNewROOpen(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={isSubmittingRO} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold">
                {isSubmittingRO ? t('loading') : t('confirm')}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* STATUS CHANGE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {statusChangeTarget && selectedRO && (
        <Modal
          isOpen={Boolean(statusChangeTarget)}
          onClose={() => setStatusChangeTarget(null)}
          title={t('changeStatus')}
          size="sm"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-300">
              {isAr ? 'هل تريد بالتأكيد نقل أمر الإصلاح إلى مرحلة:' : 'Advance repair order stage to:'}{' '}
              <strong className="text-amber-400">{t(`status_${statusChangeTarget}` as any)}</strong>؟
            </p>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                {isAr ? 'ملاحظات الانتقال (اختياري)' : 'Transition remarks (optional)'}
              </label>
              <Input
                value={statusChangeRemarks}
                onChange={(e) => setStatusChangeRemarks(e.target.value)}
                placeholder={isAr ? 'تم الانتهاء من الفحص، بانتظار القطع...' : 'Stage transition remarks...'}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#1c2638]">
              <Button variant="secondary" onClick={() => setStatusChangeTarget(null)}>
                {t('cancel')}
              </Button>
              <Button onClick={handleConfirmStatusChange} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold">
                {t('confirm')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* CUSTOMER APPROVAL MODAL */}
      {/* ========================================================================= */}
      {isApprovalModalOpen && selectedRO && (
        <Modal
          isOpen={isApprovalModalOpen}
          onClose={() => setIsApprovalModalOpen(false)}
          title={t('customerApproval')}
          size="sm"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-300">
              {isAr ? 'توثيق موافقة أو رفض العميل لتقدير التكلفة وخطة الإصلاح لأمر الإصلاح رقم:' : 'Document customer estimate approval for:'}{' '}
              <strong className="font-mono text-amber-400">{selectedRO.roNumber}</strong>
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setApprovalDecision(true)}
                className={`p-3 rounded-lg border text-center font-semibold transition-all ${
                  approvalDecision
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 mx-auto mb-1 text-emerald-400" />
                <span>{t('approveEstimate')}</span>
              </button>

              <button
                type="button"
                onClick={() => setApprovalDecision(false)}
                className={`p-3 rounded-lg border text-center font-semibold transition-all ${
                  !approvalDecision
                    ? 'bg-rose-950/60 border-rose-500 text-rose-300 shadow'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                <AlertCircle className="w-4 h-4 mx-auto mb-1 text-rose-400" />
                <span>{t('rejectEstimate')}</span>
              </button>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                {isAr ? 'ملاحظات الموافقة / اسم المفوض' : 'Approval notes / authorized by'}
              </label>
              <Input
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder={isAr ? 'تمت الموافقة هاتفياً من العميل' : 'Approved by customer via phone'}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#1c2638]">
              <Button variant="secondary" onClick={() => setIsApprovalModalOpen(false)}>
                {t('cancel')}
              </Button>
              <Button onClick={handleRecordApproval} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold">
                {t('save')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* ADD LABOR TASK MODAL */}
      {/* ========================================================================= */}
      {isAddTaskOpen && selectedRO && (
        <Modal
          isOpen={isAddTaskOpen}
          onClose={() => setIsAddTaskOpen(false)}
          title={t('addLaborTask')}
          size="md"
        >
          <form onSubmit={handleAddLaborTask} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                {t('taskDescription')} <span className="text-amber-400">*</span>
              </label>
              <Input
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder={isAr ? 'فحص وبرمجة كمبيوتر، تنظيف بخاخات...' : 'Operation description...'}
                required
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">{t('technician')}</label>
              <select
                value={taskTechnicianId}
                onChange={(e) => setTaskTechnicianId(e.target.value)}
                className="w-full bg-[#121a2a] border border-[#1c2638] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
              >
                <option value="">{t('selectTechnician')}</option>
                {technicians.map((tItem) => (
                  <option key={tItem.id} value={tItem.id}>
                    {tItem.name} ({tItem.specialty || 'General'})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('taskHours')}</label>
                <Input
                  type="number"
                  step="0.5"
                  value={taskHours}
                  onChange={(e) => {
                    setTaskHours(e.target.value);
                    const h = parseFloat(e.target.value) || 0;
                    const r = parseFloat(taskHourlyRateOmr) || 0;
                    setTaskLaborChargeOmr((h * r).toFixed(3));
                  }}
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('hourlyRate')} (OMR)</label>
                <Input
                  type="text"
                  value={taskHourlyRateOmr}
                  onChange={(e) => {
                    setTaskHourlyRateOmr(e.target.value);
                    const h = parseFloat(taskHours) || 0;
                    const r = parseFloat(e.target.value) || 0;
                    setTaskLaborChargeOmr((h * r).toFixed(3));
                  }}
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('laborCharge')} (OMR)</label>
                <Input
                  type="text"
                  value={taskLaborChargeOmr}
                  onChange={(e) => setTaskLaborChargeOmr(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#1c2638]">
              <Button type="button" variant="secondary" onClick={() => setIsAddTaskOpen(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold">
                {t('confirm')}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* ISSUE PART TO RO MODAL */}
      {/* ========================================================================= */}
      {isIssuePartOpen && selectedRO && (
        <Modal
          isOpen={isIssuePartOpen}
          onClose={() => setIsIssuePartOpen(false)}
          title={t('issuePartToRO')}
          size="md"
        >
          <form onSubmit={handleIssuePart} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                {t('partName')} <span className="text-amber-400">*</span>
              </label>
              <select
                value={issueItemId}
                onChange={(e) => handleSelectIssueItem(e.target.value)}
                className="w-full bg-[#121a2a] border border-[#1c2638] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                required
              >
                <option value="">{isAr ? 'اختر القطعة من المستودع...' : 'Select item from inventory...'}</option>
                {inventoryItems.map((item) => (
                  <option key={item.id} value={item.id} disabled={item.quantityInStock <= 0}>
                    {item.name} [{item.partCode}] — {t('quantityInStock')}: {item.quantityInStock} ({formatBaisa(item.sellingPriceBaisa)})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {t('quantityInStock')} <span className="text-amber-400">*</span>
                </label>
                <Input
                  type="number"
                  min="1"
                  value={issueQuantity}
                  onChange={(e) => setIssueQuantity(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {t('sellingPrice')} (OMR)
                </label>
                <Input
                  type="text"
                  value={issueUnitPriceOmr}
                  onChange={(e) => setIssueUnitPriceOmr(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Serial Number Selection or Input */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                {t('serialNumber')} ({isAr ? 'للقطع المسلسلة' : 'for serialized parts'})
              </label>
              {availableSerials.length > 0 ? (
                <select
                  value={issueSerialNumber}
                  onChange={(e) => setIssueSerialNumber(e.target.value)}
                  className="w-full bg-[#121a2a] border border-[#1c2638] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 font-mono"
                >
                  <option value="">{isAr ? 'اختر الرقم التسلسلي المتوفر...' : 'Select available serial number...'}</option>
                  {availableSerials.map((s) => (
                    <option key={s.id} value={s.serialNumber}>
                      {s.serialNumber} (Received: {s.receivedAt.slice(0, 10)})
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  value={issueSerialNumber}
                  onChange={(e) => setIssueSerialNumber(e.target.value)}
                  placeholder={t('serialNumberHint')}
                />
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#1c2638]">
              <Button type="button" variant="secondary" onClick={() => setIsIssuePartOpen(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold">
                {t('confirm')}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* RETURN PART MODAL */}
      {/* ========================================================================= */}
      {returnPartTarget && selectedRO && (
        <Modal
          isOpen={Boolean(returnPartTarget)}
          onClose={() => setReturnPartTarget(null)}
          title={t('returnPart')}
          size="sm"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-300">
              {isAr ? 'هل تريد استرجاع القطعة التالية وإعادتها لرصيد المستودع؟' : 'Return part to inventory stock:'}
            </p>
            <div className="p-3 bg-[#121a2a] rounded-lg border border-[#1c2638] space-y-1">
              <span className="font-semibold text-white block">{returnPartTarget.partName}</span>
              <span className="font-mono text-slate-400 block">{returnPartTarget.partCode}</span>
              {returnPartTarget.serialNumber && (
                <span className="font-mono text-amber-400 block">{t('serialNumber')}: {returnPartTarget.serialNumber}</span>
              )}
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">{t('returnReason')}</label>
              <Input
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder={isAr ? 'لم يتم استخدام القطعة / تم استبدالها بصنف آخر' : 'Reason for return...'}
              />
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-lg border border-amber-900/40 bg-amber-950/20">
              <input
                type="checkbox"
                id="defectiveCheck"
                checked={returnIsDefective}
                onChange={(e) => setReturnIsDefective(e.target.checked)}
                className="rounded border-amber-600 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="defectiveCheck" className="text-xs text-amber-300 font-medium cursor-pointer">
                {isAr ? 'القطعة معيبة أو تالفة (استبعادها من المخزون الصالح للبيع)' : 'Mark as defective / damaged (exclude from saleable stock)'}
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#1c2638]">
              <Button variant="secondary" onClick={() => setReturnPartTarget(null)}>
                {t('cancel')}
              </Button>
              <Button onClick={handleConfirmReturnPart} className="bg-rose-600 hover:bg-rose-500 text-white font-semibold">
                {t('confirm')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* PRINTABLE REPAIR ORDER SHEET MODAL */}
      {/* ========================================================================= */}
      {isPrintModalOpen && selectedRO && (
        <Modal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          title={t('printRO')}
          size="lg"
        >
          <div className="space-y-4">
            {/* Printable Preview Container */}
            <div className="bg-white text-slate-900 p-6 rounded-lg shadow-inner font-sans text-xs space-y-4 border border-slate-300">
              {/* Header */}
              <div className="flex items-center justify-between border-b pb-4 border-slate-300">
                <div>
                  <h2 className="text-base font-bold text-slate-900">الرواحي للعناية بالسيارات</h2>
                  <p className="text-[11px] text-slate-600">AL RAWAHI AUTO CARE</p>
                  <p className="text-[10px] text-slate-500">مسقط، سلطنة عُمان | هاتف: +968 24567890</p>
                </div>
                <div className="text-end">
                  <span className="inline-block px-2.5 py-1 bg-slate-900 text-white font-bold text-xs rounded">
                    أمر إصلاح مركبة (RO)
                  </span>
                  <div className="mt-1 font-mono font-bold text-sm text-slate-800">{selectedRO.roNumber}</div>
                  <div className="text-[10px] text-slate-500">التاريخ: {selectedRO.createdAt.slice(0, 10)}</div>
                </div>
              </div>

              {/* Vehicle & Customer Info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded border border-slate-200">
                <div>
                  <span className="font-bold block text-slate-700">بيانات العميل:</span>
                  <p className="text-slate-900">{selectedRO.customerName}</p>
                  <p className="text-slate-600">{selectedRO.customerPhone}</p>
                </div>
                <div>
                  <span className="font-bold block text-slate-700">بيانات المركبة:</span>
                  <p className="font-bold text-slate-900">{selectedRO.vehiclePlate}</p>
                  <p className="text-slate-600">{selectedRO.vehicleMake} {selectedRO.vehicleModel}</p>
                  {(() => {
                    const v = vehicles.find((veh) => veh.id === selectedRO.vehicleId);
                    const vin = v?.vin || (selectedRO as any).vehicleVin;
                    return vin ? (
                      <p className="text-slate-800 font-mono text-[11px] font-bold">
                        رقم الشاصي (VIN): <span dir="ltr">{vin}</span>
                      </p>
                    ) : null;
                  })()}
                  <p className="text-slate-500">عداد الدخول: {selectedRO.odometerIn} كم</p>
                </div>
              </div>

              {/* Problem & Inspection */}
              <div className="space-y-2">
                <div>
                  <span className="font-bold block text-slate-700">شكوى العميل:</span>
                  <p className="text-slate-800 bg-slate-100 p-2 rounded">{selectedRO.reportedProblem}</p>
                </div>
                <div>
                  <span className="font-bold block text-slate-700">تقرير الفحص والتشخيص:</span>
                  <p className="text-slate-800 bg-slate-100 p-2 rounded">
                    {selectedRO.inspectionNotes || 'فحص شامل ومطابقة فنية'}
                  </p>
                </div>
              </div>

              {/* Detailed Parts Table */}
              {roParts.length > 0 && (
                <div className="space-y-1">
                  <span className="font-bold text-slate-700 text-xs">قطع الغيار المستخدمة:</span>
                  <table className="w-full text-xs border border-slate-300">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="py-1 px-2 text-start">المنتج</th>
                        <th className="py-1 px-2 text-center">الكمية</th>
                        <th className="py-1 px-2 text-end">السعر</th>
                        <th className="py-1 px-2 text-end">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {roParts.map((p) => (
                        <tr key={p.id}>
                          <td className="py-1 px-2">{p.partName}</td>
                          <td className="py-1 px-2 text-center">{p.quantity}</td>
                          <td className="py-1 px-2 text-end">{formatBaisa(p.unitPriceBaisa, { arabicLabel: isAr })}</td>
                          <td className="py-1 px-2 text-end font-bold">{formatBaisa(p.totalPriceBaisa, { arabicLabel: isAr })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Detailed Labor Table */}
              {roLaborTasks.length > 0 && (
                <div className="space-y-1">
                  <span className="font-bold text-slate-700 text-xs">أجور الخدمات والصيانة:</span>
                  <table className="w-full text-xs border border-slate-300">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="py-1 px-2 text-start">الخدمة</th>
                        <th className="py-1 px-2 text-center">الساعات</th>
                        <th className="py-1 px-2 text-end">المبلغ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {roLaborTasks.map((t) => (
                        <tr key={t.id}>
                          <td className="py-1 px-2">{t.description}</td>
                          <td className="py-1 px-2 text-center">{t.hours}</td>
                          <td className="py-1 px-2 text-end font-bold">{formatBaisa(t.laborChargeBaisa, { arabicLabel: isAr })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Financial Snapshot */}
              <div className="border-t border-b py-2 flex justify-between items-center text-xs font-semibold">
                <span>إجمالي قطع الغيار: {formatBaisa(selectedRO.partsTotalBaisa || 0, { arabicLabel: isAr, useThousandsSeparator: true })}</span>
                <span>أجور اليد: {formatBaisa(selectedRO.laborTotalBaisa || 0, { arabicLabel: isAr, useThousandsSeparator: true })}</span>
                <span className="text-sm font-bold text-slate-900">
                  الإجمالي النهائي (شامل ضريبة 5%): {formatBaisa(selectedRO.grandTotalBaisa || 0, { arabicLabel: isAr, useThousandsSeparator: true })}
                </span>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-300 text-center text-[10px] text-slate-600">
                <div>
                  <div className="border-b border-slate-400 pb-6 mb-1"></div>
                  <span>توقيع واعتماد العميل (Customer Signature)</span>
                </div>
                <div>
                  <div className="border-b border-slate-400 pb-6 mb-1"></div>
                  <span>توقيع المشرف الفني (Garage Supervisor)</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setIsPrintModalOpen(false)}>
                {t('close')}
              </Button>
              <Button
                onClick={() => {
                  window.print();
                  setIsPrintModalOpen(false);
                }}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>{t('print')}</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

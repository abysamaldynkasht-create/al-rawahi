/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Phase 5: Spare Parts & Inventory Management View
 * Catalog, Serial Tracking, Low-Stock Alerts, Stock Adjustments, and Movement Ledger
 */

import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  Layers,
  History,
  QrCode,
  RotateCcw,
  SlidersHorizontal,
  ArrowUpRight,
  ArrowDownLeft,
  Tag,
  CheckCircle2,
  XCircle,
  FileText,
  DollarSign,
  TrendingDown,
  Building2,
  Boxes,
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
  InventoryItemDTO,
  InventorySerialDTO,
  InventoryMovementDTO,
} from '../types/ipc.ts';
import { formatOMR, formatBaisa, toBaisa, fromBaisa } from '../core/currency.ts';

export function InventoryView({ onNavigate }: { onNavigate?: (route: RouteId) => void }) {
  const { lang, isRtl, t } = useLanguage();
  const isAr = lang === 'ar';
  const { showToast } = useToast();

  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [serials, setSerials] = useState<InventorySerialDTO[]>([]);
  const [movements, setMovements] = useState<InventoryMovementDTO[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Main View Tabs: 'catalog' | 'serials' | 'movements'
  const [activeMainTab, setActiveMainTab] = useState<'catalog' | 'serials' | 'movements'>('catalog');

  // Add Item Modal
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [newPartCode, setNewPartCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('الفرامل (Brakes)');
  const [newManufacturer, setNewManufacturer] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newQuantity, setNewQuantity] = useState('5');
  const [newMinStock, setNewMinStock] = useState('2');
  const [newPurchaseCostOmr, setNewPurchaseCostOmr] = useState('10.000');
  const [newSellingPriceOmr, setNewSellingPriceOmr] = useState('15.000');
  const [newLocation, setNewLocation] = useState('الرف A-01');
  const [newIsSerialized, setNewIsSerialized] = useState(false);
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);

  // Stock Adjustment Modal
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustTargetItem, setAdjustTargetItem] = useState<InventoryItemDTO | null>(null);
  const [adjustDelta, setAdjustDelta] = useState('1');
  const [adjustReason, setAdjustReason] = useState('جرد دوري ومطابقة للمستودع');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  // Receive Serial Modal
  const [isReceiveSerialOpen, setIsReceiveSerialOpen] = useState(false);
  const [serialTargetItemId, setSerialTargetItemId] = useState('');
  const [inputSerialNumber, setInputSerialNumber] = useState('');
  const [serialNotes, setSerialNotes] = useState('');
  const [isSubmittingSerial, setIsSubmittingSerial] = useState(false);

  // Load Inventory Data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [invRes, serialsRes, movRes] = await Promise.all([
        garageApi.getInventory(),
        garageApi.getInventorySerials(),
        garageApi.getInventoryMovements(),
      ]);

      if (invRes.success && invRes.data) setItems(invRes.data);
      if (serialsRes.success && serialsRes.data) setSerials(serialsRes.data);
      if (movRes.success && movRes.data) setMovements(movRes.data);
    } catch {
      showToast('Error loading inventory data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter Categories
  const categories = Array.from(new Set(items.map((i) => i.category))).filter(Boolean);

  // Filter Items
  const filteredItems = items.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.partCode.toLowerCase().includes(q) ||
      (item.manufacturer && item.manufacturer.toLowerCase().includes(q)) ||
      (item.category && item.category.toLowerCase().includes(q));

    const matchCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchLowStock = !onlyLowStock || item.quantityInStock <= item.minStockLevel;

    return matchSearch && matchCategory && matchLowStock;
  });

  // Low stock items count
  const lowStockCount = items.filter((i) => i.quantityInStock <= i.minStockLevel).length;

  // Add Item
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartCode.trim() || !newName.trim()) {
      showToast('Part Code and Name are required.', 'error');
      return;
    }

    const qty = parseInt(newQuantity, 10);
    const minLvl = parseInt(newMinStock, 10);
    const costBaisa = toBaisa(parseFloat(newPurchaseCostOmr) || 0);
    const priceBaisa = toBaisa(parseFloat(newSellingPriceOmr) || 0);

    setIsSubmittingItem(true);
    try {
      const res = await garageApi.createInventoryItem({
        partCode: newPartCode.trim(),
        name: newName.trim(),
        category: newCategory.trim(),
        manufacturer: newManufacturer.trim() || undefined,
        description: newDescription.trim() || undefined,
        quantityInStock: isNaN(qty) ? 0 : qty,
        minStockLevel: isNaN(minLvl) ? 0 : minLvl,
        purchaseCostBaisa: costBaisa,
        sellingPriceBaisa: priceBaisa,
        location: newLocation.trim() || undefined,
        isSerialized: newIsSerialized,
      });

      if (res.success && res.data) {
        showToast('Part item created successfully', 'success');
        setIsAddItemOpen(false);
        // Reset form
        setNewPartCode('');
        setNewName('');
        setNewManufacturer('');
        setNewDescription('');
        setNewQuantity('5');
        setNewMinStock('2');
        setNewPurchaseCostOmr('10.000');
        setNewSellingPriceOmr('15.000');
        await loadData();
      } else {
        showToast(res.error || 'Failed to create inventory item', 'error');
      }
    } catch {
      showToast('Error creating inventory item', 'error');
    } finally {
      setIsSubmittingItem(false);
    }
  };

  // Stock Adjustment
  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTargetItem) return;

    const delta = parseInt(adjustDelta, 10);
    if (isNaN(delta) || delta === 0) {
      showToast('Please provide a non-zero quantity delta.', 'error');
      return;
    }

    setIsSubmittingAdjust(true);
    try {
      const res = await garageApi.adjustStock({
        itemId: adjustTargetItem.id,
        quantityDelta: delta,
        reason: adjustReason.trim(),
        notes: adjustNotes.trim() || undefined,
      });

      if (res.success) {
        showToast('Stock adjustment recorded successfully', 'success');
        setIsAdjustOpen(false);
        setAdjustTargetItem(null);
        setAdjustDelta('1');
        await loadData();
      } else {
        showToast(res.error || 'Failed to adjust stock', 'error');
      }
    } catch {
      showToast('Error adjusting stock', 'error');
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  // Receive Serial Unit
  const handleReceiveSerial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialTargetItemId || !inputSerialNumber.trim()) {
      showToast('Item selection and serial number are required.', 'error');
      return;
    }

    setIsSubmittingSerial(true);
    try {
      const res = await garageApi.receiveInventorySerial({
        itemId: serialTargetItemId,
        serialNumber: inputSerialNumber.trim(),
        notes: serialNotes.trim() || undefined,
      });

      if (res.success) {
        showToast(`Serial ${inputSerialNumber.trim()} received successfully`, 'success');
        setIsReceiveSerialOpen(false);
        setInputSerialNumber('');
        setSerialNotes('');
        await loadData();
      } else {
        showToast(res.error || 'Failed to receive serial unit', 'error');
      }
    } catch {
      showToast('Error receiving serial', 'error');
    } finally {
      setIsSubmittingSerial(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1c2638] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20 text-amber-400">
              <Package className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">{t('inventoryTitle')}</h1>
            <Badge variant="gold" className="text-amber-400 border-amber-500/30">
              Phase 5 Active
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">{t('inventorySubtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setSerialTargetItemId(items.find((i) => i.isSerialized)?.id || '');
              setIsReceiveSerialOpen(true);
            }}
            className="text-xs h-9 text-slate-300 border-slate-700 hover:text-white flex items-center gap-1.5"
          >
            <QrCode className="w-4 h-4 text-amber-400" />
            <span>{t('receiveSerial')}</span>
          </Button>

          <Button
            onClick={() => setIsAddItemOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold shadow-lg shadow-amber-500/20 flex items-center gap-2 text-xs h-9"
          >
            <Plus className="w-4 h-4" />
            <span>{t('newPartItem')}</span>
          </Button>
        </div>
      </div>

      {/* Low Stock Alert Banner */}
      {lowStockCount > 0 && (
        <div className="p-3.5 bg-amber-950/40 border border-amber-500/40 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-300">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              {isAr
                ? `تنبيه: يوجد ${lowStockCount} أصناف قطع غيار بلغت أو تخطت حد إعادة الطلب الأدنى.`
                : `Alert: ${lowStockCount} items have reached or breached their minimum stock reorder level.`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOnlyLowStock((prev) => !prev)}
            className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded font-semibold whitespace-nowrap transition-colors"
          >
            {onlyLowStock ? t('filterAll') : t('onlyLowStock')}
          </button>
        </div>
      )}

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#1c2638] pb-1">
        <button
          type="button"
          onClick={() => setActiveMainTab('catalog')}
          className={`py-2 px-4 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
            activeMainTab === 'catalog'
              ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
              : 'text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800'
          }`}
        >
          <Boxes className="w-3.5 h-3.5" />
          <span>{t('inventoryTitle')} ({items.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('serials')}
          className={`py-2 px-4 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
            activeMainTab === 'serials'
              ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
              : 'text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800'
          }`}
        >
          <QrCode className="w-3.5 h-3.5" />
          <span>{t('manageSerials')} ({serials.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('movements')}
          className={`py-2 px-4 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
            activeMainTab === 'movements'
              ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
              : 'text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>{t('stockMovements')} ({movements.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CATALOG OVERVIEW */}
      {/* ========================================================================= */}
      {activeMainTab === 'catalog' && (
        <div className="space-y-4">
          {/* Search & Category Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0f1522] p-3 rounded-xl border border-[#1c2638]">
            <div className="flex-1 max-w-md">
              <SearchInput
                placeholder={isAr ? 'بحث برقم الصنف SKU، اسم القطعة، الماركة...' : 'Search by SKU, part name, brand...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === 'ALL'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
                }`}
              >
                {t('allCategories')}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Catalog Items Table */}
          {isLoading ? (
            <div className="py-20 text-center text-slate-500 text-sm">{t('loading')}</div>
          ) : filteredItems.length === 0 ? (
            <EmptyState
              icon={<Package className="w-8 h-8" />}
              title={isAr ? 'لا توجد قطع غيار مطابقة' : 'No matching spare parts'}
              description={isAr ? 'أضف أصناف جديدة لكتالوج المستودع باستخدام الزر أعلاه.' : 'Add inventory items using the button above.'}
              action={
                <Button variant="gold" onClick={() => setIsAddItemOpen(true)}>
                  {t('newPartItem')}
                </Button>
              }
            />
          ) : (
            <div className="bg-[#0f1522] rounded-xl border border-[#1c2638] overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-[#121a2a] text-slate-400 font-semibold border-b border-[#1c2638]">
                    <tr>
                      <th className="py-3.5 px-4 text-start">{t('partCode')}</th>
                      <th className="py-3.5 px-4 text-start">{t('partName')}</th>
                      <th className="py-3.5 px-4 text-start">{t('category')}</th>
                      <th className="py-3.5 px-4 text-start">{t('manufacturer')}</th>
                      <th className="py-3.5 px-4 text-start">{t('quantityInStock')}</th>
                      <th className="py-3.5 px-4 text-start">{t('purchaseCost')}</th>
                      <th className="py-3.5 px-4 text-start">{t('sellingPrice')}</th>
                      <th className="py-3.5 px-4 text-start">{t('location')}</th>
                      <th className="py-3.5 px-4 text-end">{t('stockAdjustment')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1c2638]/70 text-slate-200">
                    {filteredItems.map((item) => {
                      const isLow = item.quantityInStock <= item.minStockLevel;
                      return (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-amber-400 whitespace-nowrap">
                            {item.partCode}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-white max-w-[200px] truncate">
                            {item.name}
                            {item.isSerialized && (
                              <span className="ms-2 px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-800">
                                SN
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">{item.category}</td>
                          <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">{item.manufacturer || '—'}</td>
                          <td className="py-3.5 px-4 whitespace-nowrap font-mono">
                            <span
                              className={`px-2 py-0.5 rounded font-bold ${
                                isLow
                                  ? 'bg-rose-950/80 text-rose-300 border border-rose-800 animate-pulse'
                                  : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
                              }`}
                            >
                              {item.quantityInStock}
                            </span>
                            <span className="text-[10px] text-slate-500 ms-1.5">
                              (Min: {item.minStockLevel})
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                            {formatBaisa(item.purchaseCostBaisa, { arabicLabel: isAr, useThousandsSeparator: true })}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 whitespace-nowrap">
                            {formatBaisa(item.sellingPriceBaisa, { arabicLabel: isAr, useThousandsSeparator: true })}
                          </td>
                          <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                            {item.location || '—'}
                          </td>
                          <td className="py-3.5 px-4 text-end whitespace-nowrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setAdjustTargetItem(item);
                                setAdjustDelta('1');
                                setIsAdjustOpen(true);
                              }}
                              className="text-xs h-7 px-2.5 text-slate-300 border-slate-700 hover:text-white"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                              <span className="ms-1">{t('stockAdjustment')}</span>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SERIALIZED PARTS MANAGER */}
      {/* ========================================================================= */}
      {activeMainTab === 'serials' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-[#0f1522] p-3 rounded-xl border border-[#1c2638]">
            <span className="text-xs text-slate-400">
              {isAr
                ? 'تتبع القطع الفردية برقم الشاصي/السيريال لمنع التبديل وضمان مطابقة الضمان وكروت الفحص.'
                : 'Serial tracking for critical high-value components with historical warranty verification.'}
            </span>
            <Button
              size="sm"
              onClick={() => {
                setSerialTargetItemId(items.find((i) => i.isSerialized)?.id || '');
                setIsReceiveSerialOpen(true);
              }}
              className="text-xs h-8 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('receiveSerial')}</span>
            </Button>
          </div>

          <div className="bg-[#0f1522] rounded-xl border border-[#1c2638] overflow-hidden">
            <table className="w-full text-start text-xs">
              <thead className="bg-[#121a2a] text-slate-400 font-semibold border-b border-[#1c2638]">
                <tr>
                  <th className="py-3 px-4 text-start">{t('serialNumber')}</th>
                  <th className="py-3 px-4 text-start">{t('partName')}</th>
                  <th className="py-3 px-4 text-start">{t('partCode')}</th>
                  <th className="py-3 px-4 text-start">{t('invoiceStatus')}</th>
                  <th className="py-3 px-4 text-start">{isAr ? 'تاريخ الاستلام' : 'Received Date'}</th>
                  <th className="py-3 px-4 text-start">{isAr ? 'أمر الإصلاح المرتبط' : 'Linked RO'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c2638]/70 text-slate-200">
                {serials.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-mono font-bold text-amber-400 whitespace-nowrap">
                      {s.serialNumber}
                    </td>
                    <td className="py-3 px-4 font-medium text-white">{s.itemName || '—'}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{s.partCode || '—'}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {s.status === 'IN_STOCK' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800">
                          {t('serialInStock')}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-blue-950 text-blue-300 border border-blue-800">
                          {t('serialIssued')}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">{s.receivedAt.slice(0, 10)}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{s.repairOrderId || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: INVENTORY MOVEMENT AUDIT LEDGER */}
      {/* ========================================================================= */}
      {activeMainTab === 'movements' && (
        <div className="space-y-4">
          <div className="bg-[#0f1522] rounded-xl border border-[#1c2638] overflow-hidden">
            <table className="w-full text-start text-xs">
              <thead className="bg-[#121a2a] text-slate-400 font-semibold border-b border-[#1c2638]">
                <tr>
                  <th className="py-3 px-4 text-start">{t('movementDate')}</th>
                  <th className="py-3 px-4 text-start">{t('movementType')}</th>
                  <th className="py-3 px-4 text-start">{t('partName')}</th>
                  <th className="py-3 px-4 text-start">{t('adjustmentDelta')}</th>
                  <th className="py-3 px-4 text-start">{t('serialNumber')}</th>
                  <th className="py-3 px-4 text-start">{isAr ? 'المرجع والسبب' : 'Reference & Reason'}</th>
                  <th className="py-3 px-4 text-start">{isAr ? 'المسؤول' : 'Logged By'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c2638]/70 text-slate-200">
                {movements.map((m) => {
                  const isPositive = m.quantityDelta > 0;
                  return (
                    <tr key={m.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                        {new Date(m.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-300">
                          {t(`movement${m.movementType.replace(/_/g, '')}` as any) || m.movementType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-white">{m.itemName || '—'}</td>
                      <td className="py-3 px-4 font-mono font-bold whitespace-nowrap">
                        <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                          {isPositive ? `+${m.quantityDelta}` : m.quantityDelta}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-amber-300">{m.serialNumber || '—'}</td>
                      <td className="py-3 px-4 text-slate-300 max-w-[200px] truncate">{m.reason || '—'}</td>
                      <td className="py-3 px-4 text-slate-400">{m.createdBy}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD INVENTORY ITEM MODAL */}
      {/* ========================================================================= */}
      {isAddItemOpen && (
        <Modal
          isOpen={isAddItemOpen}
          onClose={() => setIsAddItemOpen(false)}
          title={t('newPartItem')}
          size="lg"
        >
          <form onSubmit={handleAddItem} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {t('partCode')} <span className="text-amber-400">*</span>
                </label>
                <Input
                  value={newPartCode}
                  onChange={(e) => setNewPartCode(e.target.value)}
                  placeholder="e.g. 04465-60320 or OIL-5W30"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {t('partName')} <span className="text-amber-400">*</span>
                </label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Front Brake Pads - Prado"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('category')}</label>
                <Input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="e.g. Brakes, Lubrication, Filters"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('manufacturer')}</label>
                <Input
                  value={newManufacturer}
                  onChange={(e) => setNewManufacturer(e.target.value)}
                  placeholder="e.g. Toyota Genuine, Denso, Mobil"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('quantityInStock')}</label>
                <Input
                  type="number"
                  min="0"
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('minStockLevel')}</label>
                <Input
                  type="number"
                  min="0"
                  value={newMinStock}
                  onChange={(e) => setNewMinStock(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('purchaseCost')} (OMR)</label>
                <Input
                  type="text"
                  value={newPurchaseCostOmr}
                  onChange={(e) => setNewPurchaseCostOmr(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('sellingPrice')} (OMR)</label>
                <Input
                  type="text"
                  value={newSellingPriceOmr}
                  onChange={(e) => setNewSellingPriceOmr(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('location')}</label>
                <Input
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="e.g. Shelf A-03"
                />
              </div>

              <div className="flex items-center pt-6">
                <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                  <input
                    type="checkbox"
                    checked={newIsSerialized}
                    onChange={(e) => setNewIsSerialized(e.target.checked)}
                    className="w-4 h-4 text-amber-500 rounded bg-[#121a2a] border-[#1c2638] focus:ring-amber-500"
                  />
                  <span className="font-semibold">{t('isSerialized')}</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                {isAr ? 'الوصف وملاحظات الصنف' : 'Description & Specs'}
              </label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
                className="w-full bg-[#121a2a] border border-[#1c2638] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#1c2638]">
              <Button type="button" variant="secondary" onClick={() => setIsAddItemOpen(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={isSubmittingItem} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold">
                {isSubmittingItem ? t('loading') : t('confirm')}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* STOCK ADJUSTMENT MODAL */}
      {/* ========================================================================= */}
      {isAdjustOpen && adjustTargetItem && (
        <Modal
          isOpen={isAdjustOpen}
          onClose={() => setIsAdjustOpen(false)}
          title={`${t('stockAdjustment')}: ${adjustTargetItem.name}`}
          size="sm"
        >
          <form onSubmit={handleAdjustStock} className="space-y-4 text-xs">
            <div className="p-3 bg-[#121a2a] rounded-lg border border-[#1c2638] space-y-1">
              <span className="text-slate-400 block">{adjustTargetItem.partCode}</span>
              <span className="text-white block font-semibold">{adjustTargetItem.name}</span>
              <span className="text-emerald-400 block font-mono">
                {t('quantityInStock')}: {adjustTargetItem.quantityInStock}
              </span>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                {t('adjustmentDelta')} <span className="text-amber-400">*</span>
              </label>
              <Input
                type="number"
                value={adjustDelta}
                onChange={(e) => setAdjustDelta(e.target.value)}
                placeholder="+2 or -1"
                required
              />
              <span className="text-[10px] text-slate-500 block mt-1">
                {isAr ? 'أدخل رقماً موجباً للزيادة، أو سالباً للنقص' : 'Enter positive number to add, negative to reduce'}
              </span>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                {t('adjustmentReason')} <span className="text-amber-400">*</span>
              </label>
              <Input
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                {isAr ? 'ملاحظات إضافية' : 'Notes'}
              </label>
              <Input
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                placeholder={isAr ? 'تمت مراجعة الجرد الفعلي' : 'Inventory audit verified'}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#1c2638]">
              <Button type="button" variant="secondary" onClick={() => setIsAdjustOpen(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={isSubmittingAdjust} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold">
                {isSubmittingAdjust ? t('loading') : t('confirm')}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* RECEIVE SERIAL NUMBER MODAL */}
      {/* ========================================================================= */}
      {isReceiveSerialOpen && (
        <Modal
          isOpen={isReceiveSerialOpen}
          onClose={() => setIsReceiveSerialOpen(false)}
          title={t('receiveSerial')}
          size="md"
        >
          <form onSubmit={handleReceiveSerial} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                {t('partName')} <span className="text-amber-400">*</span>
              </label>
              <select
                value={serialTargetItemId}
                onChange={(e) => setSerialTargetItemId(e.target.value)}
                className="w-full bg-[#121a2a] border border-[#1c2638] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                required
              >
                <option value="">{isAr ? 'اختر القطعة المسلسلة...' : 'Select serialized item...'}</option>
                {items
                  .filter((i) => i.isSerialized)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} [{item.partCode}] — In Stock: {item.quantityInStock}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                {t('serialNumber')} <span className="text-amber-400">*</span>
              </label>
              <Input
                value={inputSerialNumber}
                onChange={(e) => setInputSerialNumber(e.target.value)}
                placeholder={t('serialNumberHint')}
                required
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                {isAr ? 'ملاحظات / رقم الفاتورة الواردة' : 'Notes / Vendor Invoice Ref'}
              </label>
              <Input
                value={serialNotes}
                onChange={(e) => setSerialNotes(e.target.value)}
                placeholder={isAr ? 'وارد شحنة المورد دينسو' : 'Vendor shipment ref'}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#1c2638]">
              <Button type="button" variant="secondary" onClick={() => setIsReceiveSerialOpen(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={isSubmittingSerial} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold">
                {isSubmittingSerial ? t('loading') : t('confirm')}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

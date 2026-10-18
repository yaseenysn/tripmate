import React, { useState, useEffect } from 'react';
import {
  X, Download, Calendar, MapPin, Users, Wallet, CheckCircle2,
  Clock, AlertTriangle, ShieldCheck, FileText, ChevronRight, Lock,
  RefreshCw, DollarSign, Calculator, ArrowRight, CreditCard, HelpCircle
} from 'lucide-react';
import { apiGetTripReport, apiCloseTrip } from '../services/api';
// PDF report generator service
import { generateTripReportPDF } from '../services/pdfReportGenerator';
import { getTripReportCache, setTripReportCache, invalidateTripReportCache } from '../services/tripCache';
import { getSocket } from '../services/socket';
import { CalculationExplanationModal } from './CalculationExplanationModal';
import { RecordSettlementModal } from './RecordSettlementModal';

interface TripFinalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  isAdmin: boolean;
  onOpenFinishConfirmation?: () => void;
  onTripClosed?: (updatedTrip: any) => void;
}

export const TripFinalReportModal: React.FC<TripFinalReportModalProps> = ({
  isOpen,
  onClose,
  tripId,
  isAdmin,
  onOpenFinishConfirmation,
  onTripClosed
}) => {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closingTrip, setClosingTrip] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Modals for calculation explanation & recording settlement
  const [explanationModal, setExplanationModal] = useState<{
    isOpen: boolean;
    type: 'MEMBER' | 'SETTLEMENT' | 'EXPENSE' | 'AVERAGE_EXPENSE';
    data: any;
  }>({
    isOpen: false,
    type: 'MEMBER',
    data: null
  });

  const [recordingSettlement, setRecordingSettlement] = useState<any>(null);
  const [expandedMembers, setExpandedMembers] = useState<Record<string, boolean>>({});

  const fetchReport = async (forceRefresh = false) => {
    if (!tripId) return;

    if (!forceRefresh) {
      // 1. Check in-memory report cache for 0ms instant display!
      const cached = getTripReportCache(tripId);
      if (cached) {
        setReportData(cached.report);
        setLoading(false);
        if (cached.isFresh) {
          console.log(`[TripReport] Fresh cache HIT for ${tripId}, instant render without fetch`);
          return;
        }
        console.log(`[TripReport] Stale cache HIT for ${tripId}, background refreshing`);
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
    } else {
      setIsRefreshing(true);
    }

    setError(null);
    try {
      const res = await apiGetTripReport(tripId);
      setReportData(res.report);
      setTripReportCache(tripId, res.report);
    } catch (err: any) {
      if (!reportData) {
        setError(err.message || 'Failed to fetch trip report');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !tripId) return;

    fetchReport();

    const socket = getSocket();
    const handleLiveReportUpdate = (payload?: any) => {
      const pTripId = String(payload?.tripId?._id || payload?.tripId || payload?._id || '');
      if (!pTripId || pTripId === String(tripId)) {
        console.log(`[TripReport] Live update triggered report re-fetch for ${tripId}`);
        fetchReport(true);
      }
    };

    socket.on('expense.deleted', handleLiveReportUpdate);
    socket.on('expense.created', handleLiveReportUpdate);
    socket.on('expense.updated', handleLiveReportUpdate);
    socket.on('settlement.updated', handleLiveReportUpdate);
    socket.on('member.joined', handleLiveReportUpdate);
    socket.on('member.removed', handleLiveReportUpdate);

    return () => {
      socket.off('expense.deleted', handleLiveReportUpdate);
      socket.off('expense.created', handleLiveReportUpdate);
      socket.off('expense.updated', handleLiveReportUpdate);
      socket.off('settlement.updated', handleLiveReportUpdate);
      socket.off('member.joined', handleLiveReportUpdate);
      socket.off('member.removed', handleLiveReportUpdate);
    };
  }, [isOpen, tripId]);

  if (!isOpen) return null;

  const handleDownloadPdf = () => {
    if (!reportData) return;
    setDownloadingPdf(true);
    try {
      generateTripReportPDF(reportData);
    } catch (err: any) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleCloseAndArchive = async () => {
    if (!tripId) return;
    setClosingTrip(true);
    setCloseError(null);
    try {
      const res = await apiCloseTrip(tripId);
      invalidateTripReportCache(tripId);
      if (onTripClosed) onTripClosed(res.trip);
      fetchReport(true);
    } catch (err: any) {
      setCloseError(err.message || 'Failed to close trip');
    } finally {
      setClosingTrip(false);
    }
  };

  const trip = reportData?.trip;
  const overview = reportData?.overview;
  const isSettled = overview?.settlementStatus === 'SETTLED';
  const isClosed = trip?.status === 'CLOSED';
  const isCompleted = trip?.status === 'COMPLETED' || trip?.status === 'SETTLED' || isClosed;
  const curr = trip?.currency || '₹';

  const startDateStr = trip?.startDate
    ? new Date(trip.startDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    : 'N/A';
  const endDateStr = trip?.endDate
    ? new Date(trip.endDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    : 'N/A';

  const formatCurr = (val: number) => {
    return `${curr}${(Number(val) || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#111b21] border border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[96vh] sm:max-h-[92vh]">
        {/* Top Header Bar */}
        <div className="p-3 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-2 bg-[#1f2c34]/90 sticky top-0 z-10">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 flex-shrink-0">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight truncate">
                  Trip Summary & Settlement Report
                </h3>
                {isClosed && (
                  <span className="text-[9px] sm:text-[10px] font-extrabold bg-slate-800 text-slate-300 border border-slate-700 px-1.5 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0">
                    <Lock className="w-2.5 h-2.5" />
                    <span>CLOSED</span>
                  </span>
                )}
                {isRefreshing && (
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 animate-pulse flex-shrink-0">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    <span className="hidden sm:inline">Syncing</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                {trip?.name || 'Loading trip report...'} • {trip?.destination}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <button
              onClick={handleDownloadPdf}
              disabled={loading || !reportData || downloadingPdf}
              className="hidden sm:flex px-3 py-2 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all items-center gap-1.5 shadow-sm active:scale-95"
              title="Download PDF Report"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Download PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/80 transition-colors"
              title="Close Report"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-3 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1 text-slate-200">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-semibold text-slate-300">Compiling authoritative trip report...</p>
              <p className="text-xs text-slate-500">Reconciling member net balances and debt transfers</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-3">
              <p className="text-sm text-rose-400 font-semibold">{error}</p>
              <button
                onClick={() => fetchReport(true)}
                className="px-4 py-2 bg-slate-800 text-xs font-bold text-white rounded-xl hover:bg-slate-700"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* SECTION A: TRIP OVERVIEW */}
              <div className="bg-[#1f2c34] p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-700/60 space-y-3 sm:space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 block mb-0.5 sm:mb-1">
                      Section A • Trip Overview
                    </span>
                    <h2 className="text-lg sm:text-xl font-extrabold text-white">{trip.name}</h2>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{trip.destination}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{startDateStr} – {endDateStr}</span>
                      </span>
                    </p>
                  </div>

                  {/* Settlement Status Badge */}
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5 sm:mb-1">
                      Settlement Status
                    </span>
                    <div
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${
                        isSettled
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                          : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                      }`}
                    >
                      {isSettled ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>All Settlements Completed</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5" />
                          <span>Settlement Pending</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 pt-3 border-t border-slate-700/60">
                  <div className="bg-[#111b21] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Expenses</span>
                    <span className="text-sm sm:text-base font-extrabold text-white">
                      {formatCurr(overview.totalExpenses)}
                    </span>
                  </div>

                  {/* Financial Metric: Average Expense Per Member / Expense Per Person */}
                  <div className="bg-[#111b21] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-800 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block truncate" title={overview.perMemberExpenseLabel}>
                        {overview.perMemberExpenseLabel || (overview.isPurelyEqualSplitAllMembers ? 'Expense Per Person' : 'Average Expense Per Member')}
                      </span>
                      <span className="text-sm sm:text-base font-extrabold text-emerald-400">
                        {formatCurr(overview.averageExpensePerMember || 0)}
                      </span>
                      <p className="text-[9.5px] text-slate-500 font-mono mt-0.5 truncate" title={overview.perMemberExpenseCalculationText}>
                        {overview.perMemberExpenseCalculationText || `${formatCurr(overview.totalExpenses)} ÷ ${overview.memberCount} = ${formatCurr(overview.averageExpensePerMember)}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setExplanationModal({
                          isOpen: true,
                          type: 'AVERAGE_EXPENSE',
                          data: reportData
                        })
                      }
                      className="mt-1.5 text-[9.5px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors self-start"
                    >
                      <HelpCircle className="w-3 h-3" />
                      <span>How is this calculated?</span>
                    </button>
                  </div>

                  <div className="bg-[#111b21] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Confirmed Settled</span>
                    <span className="text-sm sm:text-base font-extrabold text-emerald-400">
                      {formatCurr(overview.totalSettledAmount)}
                    </span>
                  </div>

                  <div className="bg-[#111b21] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Remaining Debt</span>
                    <span className={`text-sm sm:text-base font-extrabold ${overview.outstandingAmount > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                      {formatCurr(overview.outstandingAmount)}
                    </span>
                  </div>

                  <div className="bg-[#111b21] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-800 col-span-2 sm:col-span-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Trip Members</span>
                    <span className="text-sm sm:text-base font-extrabold text-slate-200">
                      {overview.memberCount} members
                    </span>
                  </div>
                </div>

                {/* Budget & Spending Analysis Card */}
                {(() => {
                  const estimatedBudget = Number(trip?.estimatedBudget) || 0;
                  const totalSpent = Number(overview?.totalExpenses) || 0;
                  const hasBudget = estimatedBudget > 0;
                  const remainingBudget = hasBudget ? estimatedBudget - totalSpent : 0;
                  const budgetUtilization = hasBudget ? Math.round((totalSpent / estimatedBudget) * 1000) / 10 : 0;
                  const isOverBudget = hasBudget && remainingBudget < 0;

                  return (
                    <div className="bg-[#111b21] p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-bold text-white uppercase tracking-wider">
                            Budget & Spending Analysis
                          </span>
                        </div>
                        {hasBudget ? (
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                              isOverBudget
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}
                          >
                            {isOverBudget ? 'Over Budget' : 'Within Budget'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-medium italic">
                            No Budget Configured
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                        <div className="bg-[#1a2329] p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Estimated Budget</span>
                          <span className="text-xs sm:text-sm font-extrabold text-white">
                            {hasBudget ? formatCurr(estimatedBudget) : 'Not Configured'}
                          </span>
                        </div>

                        <div className="bg-[#1a2329] p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Spent</span>
                          <span className="text-xs sm:text-sm font-extrabold text-white">
                            {formatCurr(totalSpent)}
                          </span>
                        </div>

                        <div className="bg-[#1a2329] p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Remaining Budget</span>
                          <span
                            className={`text-xs sm:text-sm font-extrabold ${
                              !hasBudget
                                ? 'text-slate-400'
                                : isOverBudget
                                ? 'text-rose-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            {hasBudget
                              ? `${remainingBudget < 0 ? '-' : ''}${formatCurr(Math.abs(remainingBudget))}`
                              : 'N/A'}
                          </span>
                        </div>

                        <div className="bg-[#1a2329] p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Utilization</span>
                          <span
                            className={`text-xs sm:text-sm font-extrabold ${
                              !hasBudget
                                ? 'text-slate-400'
                                : isOverBudget
                                ? 'text-rose-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            {hasBudget ? `${budgetUtilization.toFixed(1)}%` : 'N/A'}
                          </span>
                        </div>
                      </div>

                      {hasBudget && (
                        <div className="space-y-1 pt-0.5">
                          <div className="w-full bg-[#1a2329] rounded-full h-1.5 overflow-hidden border border-slate-800">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isOverBudget ? 'bg-rose-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, budgetUtilization)}%` }}
                            />
                          </div>
                          <p className="text-[9.5px] text-slate-400 flex items-center justify-between">
                            <span>{budgetUtilization.toFixed(1)}% of estimated budget used</span>
                            <span className={isOverBudget ? 'text-rose-400 font-semibold' : 'text-emerald-400'}>
                              {isOverBudget
                                ? `Over by ${formatCurr(Math.abs(remainingBudget))}`
                                : `${formatCurr(remainingBudget)} remaining`}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* SECTION B: EXPENSE BREAKDOWN */}
              <div className="bg-[#1f2c34] p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-700/60 space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 block">
                      Section B • Expense Breakdown
                    </span>
                    <h3 className="text-xs sm:text-sm font-bold text-white">Category Spending Totals</h3>
                  </div>
                  <span className="text-xs font-extrabold text-slate-300">
                    {formatCurr(overview.totalExpenses)} Total
                  </span>
                </div>

                <div className="space-y-2.5 sm:space-y-3">
                  {reportData.categoryBreakdown.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No expenses recorded for this trip.</p>
                  ) : (
                    reportData.categoryBreakdown.map((cat: any) => (
                      <div key={cat.category} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-200">
                            {cat.category} <span className="text-slate-400 font-normal">({cat.count} items)</span>
                          </span>
                          <span className="font-extrabold text-white">
                            {formatCurr(cat.totalAmount)} <span className="text-slate-400 font-normal text-[10px]">({cat.percentage}%)</span>
                          </span>
                        </div>
                        <div className="w-full bg-[#111b21] rounded-full h-2 overflow-hidden border border-slate-800">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, cat.percentage)}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* SECTION C: MEMBER-WISE FINANCIAL SUMMARY */}
              <div className="bg-[#1f2c34] p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-700/60 space-y-3 sm:space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 block">
                      Section C • Member-wise Financial Summary
                    </span>
                    <h3 className="text-xs sm:text-sm font-bold text-white">Individual Net Balances & Arithmetic</h3>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    Zero-Sum Audited
                  </span>
                </div>

                <div className="space-y-2.5 sm:space-y-3">
                  {reportData.memberBalances.map((mb: any) => {
                    const isPositive = mb.netBalance > 0.009;
                    const isNegative = mb.netBalance < -0.009;

                    return (
                      <div
                        key={mb.userId}
                        className="bg-[#111b21] p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-800 space-y-2.5"
                      >
                        {/* Member Identity & Net Balance Row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200 overflow-hidden flex-shrink-0">
                              {mb.avatar ? (
                                <img src={mb.avatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                mb.name?.[0] || 'M'
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-white text-xs sm:text-sm truncate">{mb.name}</span>
                                {mb.role === 'ADMIN' && (
                                  <span className="text-[9px] font-extrabold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 flex-shrink-0">
                                    ADMIN
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                                Paid: {formatCurr(mb.totalPaid)} • Share: {formatCurr(mb.totalShare)}
                              </p>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <span
                              className={`font-black text-xs sm:text-sm block ${
                                isPositive
                                  ? 'text-emerald-400'
                                  : isNegative
                                  ? 'text-rose-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {isPositive && '+'}
                              {formatCurr(mb.netBalance)}
                            </span>
                            <span className="text-[8.5px] sm:text-[9px] uppercase font-bold text-slate-500 block">
                              {isPositive ? 'Receives' : isNegative ? 'Owes' : 'Balanced'}
                            </span>
                          </div>
                        </div>

                        {/* Action Row: How is this calculated button */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedMembers((prev) => ({
                                ...prev,
                                [mb.userId]: !prev[mb.userId]
                              }))
                            }
                            className="px-2.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 shadow-sm active:scale-95"
                          >
                            <Calculator className="w-3 h-3 text-indigo-400" />
                            <span>{expandedMembers[mb.userId] ? 'Hide arithmetic' : 'How is this calculated?'}</span>
                          </button>
                        </div>

                        {/* Explicit Arithmetic Breakdown Box */}
                        {expandedMembers[mb.userId] && (
                          <div className="bg-[#1a2329] p-2.5 sm:p-3 rounded-xl border border-slate-800/80 text-[10.5px] sm:text-[11px] space-y-1.5 animate-in fade-in duration-150">
                            <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center justify-between">
                              <span>Explicit Calculation Arithmetic</span>
                              <span className="text-slate-500 font-mono text-[9px] hidden sm:inline">Paid - Share + Settled Paid - Settled Recv = Final</span>
                            </div>
                            <div className="font-mono text-slate-300 text-[10px] sm:text-[10.5px] overflow-x-auto whitespace-nowrap bg-[#111b21] p-2 rounded-lg border border-slate-800">
                              {`Amount Paid (${formatCurr(mb.totalPaid)}) - Actual Share (${formatCurr(mb.totalShare)}) + Confirmed Paid (${formatCurr(mb.settlementsPaid)}) - Confirmed Recv (${formatCurr(mb.settlementsReceived)}) = Final Balance (${formatCurr(mb.netBalance)})`}
                            </div>
                            <p
                              className={`font-semibold text-[10.5px] sm:text-[11px] ${
                                isPositive
                                  ? 'text-emerald-400'
                                  : isNegative
                                  ? 'text-rose-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {mb.calculationDetails?.arithmetic?.summaryText ||
                                (isPositive
                                  ? `This member should receive ${formatCurr(mb.netBalance)}.`
                                  : isNegative
                                  ? `This member needs to pay ${formatCurr(Math.abs(mb.netBalance))}.`
                                  : 'This member has settled all balances (Rs. 0.00).')}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION D: SUGGESTED SETTLEMENTS */}
              <div className="bg-[#1f2c34] p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-700/60 space-y-3 sm:space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 block">
                      Section D • Suggested Settlements
                    </span>
                    <h3 className="text-xs sm:text-sm font-bold text-white">Who Pays Whom (Minimal Transactions)</h3>
                  </div>
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                    Proposed Transfers
                  </span>
                </div>

                {reportData.suggestedSettlements?.length === 0 ? (
                  <div className="bg-[#111b21] p-5 sm:p-6 rounded-2xl border border-slate-800 text-center space-y-1">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                    <p className="text-xs font-semibold text-slate-200">All member balances are settled.</p>
                    <p className="text-[11px] text-slate-500">
                      No further transfers are required to reconcile this trip.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800 bg-[#111b21] rounded-2xl border border-slate-800 overflow-hidden">
                    {reportData.suggestedSettlements.map((s: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 flex-shrink-0">
                            {s.fromUser?.name?.[0] || 'P'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 font-bold text-white flex-wrap">
                              <span>{s.fromUser?.name}</span>
                              <span className="text-slate-500 font-normal">pays</span>
                              <span className="text-emerald-400 font-extrabold">{formatCurr(s.amount)}</span>
                              <span className="text-slate-500 font-normal">to</span>
                              <span>{s.toUser?.name}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 block truncate">
                              Suggested transfer to resolve outstanding balance
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-start sm:justify-end gap-2 flex-wrap pt-0.5 sm:pt-0">
                          <button
                            onClick={() =>
                              setExplanationModal({
                                isOpen: true,
                                type: 'SETTLEMENT',
                                data: s
                              })
                            }
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 active:scale-95"
                          >
                            <HelpCircle className="w-3 h-3 text-indigo-400" />
                            <span>How is this calculated?</span>
                          </button>

                          {!isClosed && (
                            <button
                              onClick={() => setRecordingSettlement(s)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 shadow-sm active:scale-95"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>Record Payment</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION E: SETTLEMENT TRANSACTION HISTORY */}
              <div className="bg-[#1f2c34] p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-700/60 space-y-3 sm:space-y-4">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 block">
                    Section E • Settlement Transaction History
                  </span>
                  <h3 className="text-xs sm:text-sm font-bold text-white">Confirmed Payments & Audit Log</h3>
                </div>

                {reportData.settlementHistory.length === 0 ? (
                  <div className="bg-[#111b21] p-5 sm:p-6 rounded-2xl border border-slate-800 text-center space-y-1">
                    <p className="text-xs font-semibold text-slate-300">No settlement transactions recorded yet.</p>
                    <p className="text-[11px] text-slate-500">
                      When members confirm payments, full transaction history will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800 bg-[#111b21] rounded-2xl border border-slate-800 overflow-hidden max-h-56 overflow-y-auto">
                    {reportData.settlementHistory.map((s: any) => (
                      <div key={s._id} className="p-3 sm:p-3.5 flex items-center justify-between text-xs gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-bold text-slate-200 flex-wrap">
                            <span>{s.fromUser?.name || 'Member'}</span>
                            <span className="text-slate-500 font-normal">paid</span>
                            <span className="text-emerald-400 font-extrabold">{formatCurr(s.amount)}</span>
                            <span className="text-slate-500 font-normal">to</span>
                            <span>{s.toUser?.name || 'Member'}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {s.paidAt || s.createdAt
                              ? new Date(s.paidAt || s.createdAt).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : ''}
                            {s.notes ? ` • ${s.notes}` : ''}
                            {s.reference ? ` • Ref: ${s.reference}` : ''}
                          </span>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span
                            className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${
                              s.status === 'PAID'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}
                          >
                            {s.status === 'PAID' ? 'CONFIRMED' : 'PENDING'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION F: FINANCIAL RECONCILIATION */}
              <div className="bg-[#1f2c34] p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-700/60 space-y-3">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 block">
                  Section F • Financial Reconciliation
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs">
                  <div className="bg-[#111b21] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Expenses</span>
                    <span className="text-xs sm:text-sm font-extrabold text-white">
                      {formatCurr(overview.totalExpenses)}
                    </span>
                  </div>

                  <div className="bg-[#111b21] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Confirmed Settled</span>
                    <span className="text-xs sm:text-sm font-extrabold text-emerald-400">
                      {formatCurr(overview.totalSettledAmount)}
                    </span>
                  </div>

                  <div className="bg-[#111b21] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Creditors (To Receive)</span>
                    <span className="text-xs sm:text-sm font-extrabold text-emerald-400">
                      {formatCurr(overview.totalOutstandingCreditorBalances)}
                    </span>
                  </div>

                  <div className="bg-[#111b21] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Debtors (To Pay)</span>
                    <span className="text-xs sm:text-sm font-extrabold text-rose-400">
                      {formatCurr(overview.totalOutstandingDebtorBalances)}
                    </span>
                  </div>
                </div>

                {/* Redistribution Note */}
                <div className="p-2.5 sm:p-3 bg-[#111b21] rounded-xl border border-slate-800 text-[10.5px] sm:text-[11px] text-slate-400 italic">
                  Note: Settlement transfers redistribute money between members to reconcile balances; they do not create additional trip expenses.
                </div>
              </div>

              {/* ADMIN ACTIONS: FINISH OR CLOSE TRIP */}
              {isAdmin && !isClosed && (
                <div className="p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl bg-[#1f2c34] border border-slate-700/60 space-y-3">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    Admin Trip Lifecycle Controls
                  </span>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {!isCompleted ? (
                      <div className="flex-1 min-w-[200px]">
                        <p className="text-xs text-slate-300 font-semibold">Ready to finish this trip?</p>
                        <p className="text-[11px] text-slate-400">
                          Review totals and confirm conclusion. Expenses and settlements will remain accessible.
                        </p>
                      </div>
                    ) : (
                      <div className="flex-1 min-w-[200px]">
                        <p className="text-xs text-slate-300 font-semibold">
                          {isSettled ? 'Ready to Close & Archive Trip' : 'Settlements Pending'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {isSettled
                            ? 'All balances are reconciled to zero. You can now close and archive this trip.'
                            : 'Normal closure is blocked while settlements remain outstanding.'}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      {!isCompleted && onOpenFinishConfirmation && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenFinishConfirmation();
                          }}
                          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 active:scale-95"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Finish Trip</span>
                        </button>
                      )}

                      {isCompleted && (
                        <button
                          type="button"
                          onClick={handleCloseAndArchive}
                          disabled={!isSettled || closingTrip}
                          className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 active:scale-95 ${
                            isSettled
                              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                          }`}
                        >
                          {closingTrip ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              <span>Close & Archive Trip</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {closeError && (
                    <p className="text-xs text-rose-400 font-semibold">{closeError}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Bar */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-[#1f2c34]/95 backdrop-blur sticky bottom-0 z-10 flex items-center justify-between gap-3 text-xs">
          <span className="text-[11px] text-slate-400 truncate hidden sm:inline">
            TripMate Authoritative Settlement Report • Zero-Sum Audited
          </span>
          <button
            onClick={handleDownloadPdf}
            disabled={loading || !reportData || downloadingPdf}
            className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            {downloadingPdf ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Explanation Modal */}
      <CalculationExplanationModal
        isOpen={explanationModal.isOpen}
        onClose={() => setExplanationModal({ isOpen: false, type: 'MEMBER', data: null })}
        type={explanationModal.type}
        data={explanationModal.data}
        currency={curr}
        onRecordPayment={(s) => setRecordingSettlement(s)}
      />

      {/* Record Settlement Modal */}
      <RecordSettlementModal
        isOpen={Boolean(recordingSettlement)}
        onClose={() => setRecordingSettlement(null)}
        tripId={tripId}
        settlementData={recordingSettlement}
        currency={curr}
        onSettlementRecorded={() => {
          invalidateTripReportCache(tripId);
          fetchReport(true);
        }}
      />
    </div>
  );
};

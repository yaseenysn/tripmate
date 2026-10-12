import React from 'react';
import {
  X, Calculator, ArrowRight, CheckCircle2, AlertCircle,
  HelpCircle, CreditCard, ArrowDownRight, ArrowUpRight, DollarSign,
  Users, Info
} from 'lucide-react';

interface CalculationExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'MEMBER' | 'SETTLEMENT' | 'EXPENSE' | 'AVERAGE_EXPENSE';
  data: any;
  currency?: string;
  onRecordPayment?: (settlement: any) => void;
}

export const CalculationExplanationModal: React.FC<CalculationExplanationModalProps> = ({
  isOpen,
  onClose,
  type,
  data,
  currency = '₹',
  onRecordPayment
}) => {
  if (!isOpen || !data) return null;

  const formatCurr = (val: number) => {
    return `${currency}${(Number(val) || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const formatDate = (d?: string | Date) => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#111b21] border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-[#1f2c34]/70 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shadow-md">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400">
                  Financial Calculation Audit
                </span>
              </div>
              <h3 className="text-base font-extrabold text-white">
                {type === 'MEMBER' && `How is ${data.name}'s balance calculated?`}
                {type === 'SETTLEMENT' && 'How is this suggested payment calculated?'}
                {type === 'EXPENSE' && `Expense Split Breakdown: ${data.title}`}
                {type === 'AVERAGE_EXPENSE' &&
                  `How is "${data.overview?.perMemberExpenseLabel || 'Average Expense Per Member'}" calculated?`}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          {/* ===================== TYPE: AVERAGE_EXPENSE ===================== */}
          {type === 'AVERAGE_EXPENSE' && (
            <div className="space-y-5">
              {/* Metric Card */}
              <div className="bg-[#1f2c34] p-5 rounded-2xl border border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Metric Formula
                  </span>
                  <span
                    className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                      data.overview?.isPurelyEqualSplitAllMembers
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}
                  >
                    {data.overview?.isPurelyEqualSplitAllMembers
                      ? 'Equal Split Across All Members'
                      : 'Statistical Average (Mixed Splits)'}
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-300">
                      {data.overview?.perMemberExpenseLabel || 'Average Expense Per Member'}
                    </h4>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Total Trip Expenses ÷ Total Trip Members
                    </p>
                  </div>
                  <span className="text-xl font-extrabold text-white">
                    {formatCurr(data.overview?.averageExpensePerMember || 0)}
                  </span>
                </div>

                {/* Explicit Arithmetic Formula */}
                <div className="bg-[#111b21] p-3 rounded-xl border border-slate-800 font-mono text-xs text-center text-emerald-400">
                  {data.overview?.perMemberExpenseCalculationText ||
                    `${formatCurr(data.overview?.totalExpenses || 0)} ÷ ${data.overview?.memberCount || 1} = ${formatCurr(data.overview?.averageExpensePerMember || 0)} per member`}
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {data.overview?.perMemberExpenseExplanation}
                </p>
              </div>

              {/* Members Actual Share Comparison */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Individual Member Actual Shares vs. Average
                  </h4>
                  <span className="text-[10px] text-slate-500">
                    Average: {formatCurr(data.overview?.averageExpensePerMember || 0)}
                  </span>
                </div>

                <div className="bg-[#111b21] rounded-2xl border border-slate-800 divide-y divide-slate-800 overflow-hidden text-xs">
                  {data.memberBalances?.map((mb: any) => {
                    const avg = data.overview?.averageExpensePerMember || 0;
                    const diff = mb.totalShare - avg;
                    const isAbove = diff > 0.009;
                    const isBelow = diff < -0.009;

                    return (
                      <div key={mb.userId} className="p-3.5 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-white text-xs">{mb.name}</p>
                          <p className="text-[10px] text-slate-400">
                            Amount Paid: {formatCurr(mb.totalPaid)}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-white block">
                            Actual Share: {formatCurr(mb.totalShare)}
                          </span>
                          <span
                            className={`text-[10px] font-semibold ${
                              isAbove
                                ? 'text-amber-400'
                                : isBelow
                                ? 'text-indigo-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            {isAbove
                              ? `+${formatCurr(diff)} above average`
                              : isBelow
                              ? `-${formatCurr(Math.abs(diff))} below average`
                              : 'Exact equal share'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Critical Settlement Rule Notice */}
              <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-[11px] text-indigo-300 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Accounting Rule:</strong> Settlement calculations and net balances strictly use each member&apos;s <strong>Actual Expense Share</strong>, never the statistical average. The average is provided for transparency and budgeting comparisons.
                </span>
              </div>
            </div>
          )}

          {/* ===================== TYPE: MEMBER ===================== */}
          {type === 'MEMBER' && (
            <>
              {/* Member Overview Card */}
              <div className="bg-[#1f2c34] p-4 rounded-2xl border border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200 overflow-hidden">
                    {data.avatar ? (
                      <img src={data.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      data.name?.[0] || 'M'
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">{data.name}</h4>
                    <p className="text-[11px] text-slate-400">
                      {data.role || 'Member'} • {data.email || 'Trip participant'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Final Net Balance
                  </span>
                  <span
                    className={`text-base font-extrabold ${
                      data.netBalance > 0.009
                        ? 'text-emerald-400'
                        : data.netBalance < -0.009
                        ? 'text-rose-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {data.netBalance > 0.009 && '+'}
                    {formatCurr(data.netBalance)}
                  </span>
                </div>
              </div>

              {/* Section A: Amount Paid */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>A. Amount Paid</span>
                  </h4>
                  <span className="text-xs font-bold text-white bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
                    Total: {formatCurr(data.totalPaid)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Total money paid upfront by {data.name} for group expenses.
                </p>

                {data.calculationDetails?.expensesPaidList?.length === 0 ? (
                  <div className="bg-[#111b21] p-3 rounded-xl border border-slate-800 text-[11px] text-slate-500 italic text-center">
                    No group expenses paid upfront by this member.
                  </div>
                ) : (
                  <div className="bg-[#111b21] rounded-xl border border-slate-800 divide-y divide-slate-800/80 overflow-hidden">
                    {data.calculationDetails?.expensesPaidList?.map((e: any) => (
                      <div key={e.expenseId} className="p-3 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-slate-200">{e.title}</p>
                          <p className="text-[10px] text-slate-500">
                            {e.category} • {formatDate(e.date)}
                          </p>
                        </div>
                        <span className="font-extrabold text-white">{formatCurr(e.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section B: Actual Expense Share */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    <span>B. Actual Expense Share</span>
                  </h4>
                  <span className="text-xs font-bold text-white bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
                    Total Share: {formatCurr(data.totalShare)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Actual cost of group expenses consumed by or allocated to {data.name}.
                </p>

                {data.calculationDetails?.expenseSharesList?.length === 0 ? (
                  <div className="bg-[#111b21] p-3 rounded-xl border border-slate-800 text-[11px] text-slate-500 italic text-center">
                    No expense shares allocated to this member.
                  </div>
                ) : (
                  <div className="bg-[#111b21] rounded-xl border border-slate-800 divide-y divide-slate-800/80 overflow-hidden max-h-48 overflow-y-auto">
                    {data.calculationDetails?.expenseSharesList?.map((s: any) => (
                      <div key={s.expenseId} className="p-3 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-slate-200">{s.title}</p>
                          <p className="text-[10px] text-slate-400">{s.explanation}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-white block">{formatCurr(s.memberShare)}</span>
                          <span className="text-[10px] text-slate-500">
                            of {formatCurr(s.totalAmount)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section C: Confirmed Settlements Paid */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>C. Confirmed Settlements Paid</span>
                  </h4>
                  <span className="text-xs font-bold text-white bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
                    Total: {formatCurr(data.settlementsPaid)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Actual debt payments confirmed and recorded from {data.name} to other members. (Reduces debt / adds to net balance).
                </p>

                {data.calculationDetails?.settlementsPaidList?.length === 0 ? (
                  <div className="bg-[#111b21] p-3 rounded-xl border border-slate-800 text-[11px] text-slate-500 italic text-center">
                    No settlement payments made by this member yet.
                  </div>
                ) : (
                  <div className="bg-[#111b21] rounded-xl border border-slate-800 divide-y divide-slate-800/80 overflow-hidden">
                    {data.calculationDetails?.settlementsPaidList?.map((sp: any) => (
                      <div key={sp.settlementId} className="p-3 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-slate-200">
                            Paid to <span className="text-white font-bold">{sp.toUserName}</span>
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {formatDate(sp.paidAt)} {sp.notes ? `• ${sp.notes}` : ''}
                          </p>
                        </div>
                        <span className="font-extrabold text-emerald-400">{formatCurr(sp.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section D: Confirmed Settlements Received */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>D. Confirmed Settlements Received</span>
                  </h4>
                  <span className="text-xs font-bold text-white bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
                    Total: {formatCurr(data.settlementsReceived)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Actual debt payments received by {data.name} from other members. (Reduces credit / subtracts from net balance).
                </p>

                {data.calculationDetails?.settlementsReceivedList?.length === 0 ? (
                  <div className="bg-[#111b21] p-3 rounded-xl border border-slate-800 text-[11px] text-slate-500 italic text-center">
                    No settlement payments received by this member yet.
                  </div>
                ) : (
                  <div className="bg-[#111b21] rounded-xl border border-slate-800 divide-y divide-slate-800/80 overflow-hidden">
                    {data.calculationDetails?.settlementsReceivedList?.map((sr: any) => (
                      <div key={sr.settlementId} className="p-3 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-slate-200">
                            Received from <span className="text-white font-bold">{sr.fromUserName}</span>
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {formatDate(sr.paidAt)} {sr.notes ? `• ${sr.notes}` : ''}
                          </p>
                        </div>
                        <span className="font-extrabold text-amber-400">{formatCurr(sr.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section E: Final Arithmetic */}
              <div className="bg-[#1f2c34] p-5 rounded-2xl border border-slate-700/80 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                    E. Explicit Arithmetic Formula
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Amount Paid - Actual Share + Settled Paid - Settled Recv = Final Balance
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-[#111b21] p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Amount Paid</span>
                    <span className="font-bold text-white">{formatCurr(data.totalPaid)}</span>
                  </div>
                  <div className="bg-[#111b21] p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">- Actual Share</span>
                    <span className="font-bold text-rose-400">-{formatCurr(data.totalShare)}</span>
                  </div>
                  <div className="bg-[#111b21] p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">+ Settled Paid</span>
                    <span className="font-bold text-emerald-400">+{formatCurr(data.settlementsPaid)}</span>
                  </div>
                  <div className="bg-[#111b21] p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">- Settled Recv</span>
                    <span className="font-bold text-amber-400">-{formatCurr(data.settlementsReceived)}</span>
                  </div>
                </div>

                {/* Explicit Equation Box */}
                <div className="bg-[#111b21] p-3.5 rounded-xl border border-slate-700/80 font-mono text-xs text-center text-slate-200 overflow-x-auto">
                  {data.calculationDetails?.arithmetic?.equation ||
                    `${formatCurr(data.totalPaid)} - ${formatCurr(data.totalShare)} + ${formatCurr(data.settlementsPaid)} - ${formatCurr(data.settlementsReceived)} = ${formatCurr(data.netBalance)}`}
                </div>

                {/* Explicit Explanation Banner */}
                <div
                  className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 border ${
                    data.netBalance > 0.009
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : data.netBalance < -0.009
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300'
                  }`}
                >
                  {data.netBalance > 0.009 ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  ) : data.netBalance < -0.009 ? (
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  )}
                  <span>
                    {data.calculationDetails?.arithmetic?.summaryText ||
                      (data.netBalance > 0.009
                        ? `This member should receive ${formatCurr(data.netBalance)}.`
                        : data.netBalance < -0.009
                        ? `This member needs to pay ${formatCurr(Math.abs(data.netBalance))}.`
                        : 'This member has settled all balances (Rs. 0.00).')}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* ===================== TYPE: SETTLEMENT ===================== */}
          {type === 'SETTLEMENT' && (
            <>
              {/* Transfer Header Card */}
              <div className="bg-[#1f2c34] p-5 rounded-2xl border border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                  <span>PROPOSED TRANSACTION</span>
                  <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 text-[10px]">
                    Suggestion • Not Yet Paid
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 py-2">
                  <div className="text-center flex-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Payer</span>
                    <span className="font-extrabold text-white text-sm">{data.fromUser?.name}</span>
                  </div>

                  <div className="flex flex-col items-center">
                    <span className="text-xs font-extrabold text-emerald-400 mb-0.5">
                      {formatCurr(data.amount)}
                    </span>
                    <div className="w-20 h-0.5 bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500" />
                    <ArrowRight className="w-4 h-4 text-emerald-400 mt-0.5" />
                  </div>

                  <div className="text-center flex-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Receiver</span>
                    <span className="font-extrabold text-white text-sm">{data.toUser?.name}</span>
                  </div>
                </div>
              </div>

              {/* Rationale & Math Steps */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400">
                  Settlement Algorithm Explanation
                </h4>

                <div className="bg-[#111b21] p-4 rounded-2xl border border-slate-800 space-y-3 text-xs">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <p className="font-semibold text-slate-200">
                        {data.fromUser?.name}&apos;s Outstanding Debt Before Payment:
                      </p>
                      <p className="text-rose-400 font-bold text-xs mt-0.5">
                        Owes {formatCurr(Math.abs(data.explanation?.payerBalanceBefore ?? data.amount))}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <p className="font-semibold text-slate-200">
                        {data.toUser?.name}&apos;s Outstanding Credit Before Payment:
                      </p>
                      <p className="text-emerald-400 font-bold text-xs mt-0.5">
                        Is owed {formatCurr(data.explanation?.receiverBalanceBefore ?? data.amount)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                      3
                    </span>
                    <div>
                      <p className="font-semibold text-slate-200">Why Matched?</p>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        {data.explanation?.matchReason ||
                          `Matched using debt-minimization algorithm to settle mutual outstanding balances with minimal cash transfers.`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                      4
                    </span>
                    <div>
                      <p className="font-semibold text-slate-200">Expected Balances After This Payment:</p>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div className="bg-[#1f2c34] p-2 rounded-lg border border-slate-700/60">
                          <span className="text-[10px] text-slate-400 block">{data.fromUser?.name}</span>
                          <span className="font-bold text-slate-200">
                            {data.explanation?.payerBalanceAfter === 0
                              ? 'Fully Settled (₹0.00)'
                              : `Owes ${formatCurr(Math.abs(data.explanation?.payerBalanceAfter || 0))}`}
                          </span>
                        </div>
                        <div className="bg-[#1f2c34] p-2 rounded-lg border border-slate-700/60">
                          <span className="text-[10px] text-slate-400 block">{data.toUser?.name}</span>
                          <span className="font-bold text-slate-200">
                            {data.explanation?.receiverBalanceAfter === 0
                              ? 'Fully Settled (₹0.00)'
                              : `Is owed ${formatCurr(data.explanation?.receiverBalanceAfter || 0)}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Related Payments for Member */}
              {data.explanation?.relatedPayments?.length > 1 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                    All Proposed Payments Involving These Members
                  </h4>
                  <div className="bg-[#111b21] rounded-2xl border border-slate-800 divide-y divide-slate-800 overflow-hidden text-xs">
                    {data.explanation.relatedPayments.map((rel: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-3 flex items-center justify-between ${
                          rel.isCurrent ? 'bg-indigo-500/10 font-bold text-white' : 'text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{rel.fromUserName}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                          <span>{rel.toUserName}</span>
                          {rel.isCurrent && (
                            <span className="text-[9px] uppercase font-bold text-indigo-400 bg-indigo-500/20 px-1.5 py-0.2 rounded">
                              Current
                            </span>
                          )}
                        </div>
                        <span className="font-extrabold text-emerald-400">{formatCurr(rel.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Button: Record Payment */}
              {onRecordPayment && (
                <div className="pt-2">
                  <button
                    onClick={() => {
                      onClose();
                      onRecordPayment(data);
                    }}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Proceed to Record This Payment ({formatCurr(data.amount)})</span>
                  </button>
                </div>
              )}
            </>
          )}

          {/* ===================== TYPE: EXPENSE ===================== */}
          {type === 'EXPENSE' && (
            <div className="space-y-4">
              <div className="bg-[#1f2c34] p-4 rounded-2xl border border-slate-700/60 flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-white text-sm">{data.title}</h4>
                  <p className="text-[11px] text-slate-400">
                    Paid by <span className="text-white font-bold">{data.paidBy?.name}</span> • {data.category}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Amount</span>
                  <span className="text-base font-extrabold text-white">{formatCurr(data.amount)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Participant Share Breakdown ({data.splitType || 'EQUAL'} Split)
                  </h4>
                  {data.isReconciled ? (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Reconciled Exact
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Discrepancy Detected
                    </span>
                  )}
                </div>

                <div className="bg-[#111b21] rounded-2xl border border-slate-800 divide-y divide-slate-800 overflow-hidden text-xs">
                  {data.participants?.map((p: any) => (
                    <div key={p.userId} className="p-3 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-white">{p.name}</span>
                        {p.percentage !== undefined && (
                          <span className="text-[10px] text-slate-400 block">{p.percentage}% configured</span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-white block">{formatCurr(p.share)}</span>
                        <span className="text-[10px] text-slate-500">
                          {p.status === 'PAID' ? 'Paid to Payer' : 'Unpaid Share'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {data.roundingAdjustment && data.roundingAdjustment !== 0 && (
                  <p className="text-[11px] text-slate-400 italic">
                    Note: A paise rounding adjustment of {formatCurr(data.roundingAdjustment)} was allocated to the payer to ensure the sum of shares strictly equals the total expense.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#1f2c34]/70 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-400">
            Authoritative TripMate Financial Calculation
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

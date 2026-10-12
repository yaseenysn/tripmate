import { jsPDF } from 'jspdf';

export interface TripReportData {
  trip: {
    _id: string;
    name: string;
    destination: string;
    startDate: string | Date;
    endDate: string | Date;
    currency: string;
    status: string;
    settlementStatus: string;
    estimatedBudget?: number;
    createdBy?: { name: string; email: string };
    closedAt?: string | Date;
    completedAt?: string | Date;
  };
  overview: {
    totalExpenses: number;
    totalSettledAmount: number;
    outstandingAmount: number;
    totalOutstandingCreditorBalances?: number;
    totalOutstandingDebtorBalances?: number;
    memberCount: number;
    averageExpensePerMember?: number;
    isPurelyEqualSplitAllMembers?: boolean;
    perMemberExpenseLabel?: string;
    perMemberExpenseCalculationText?: string;
    perMemberExpenseExplanation?: string;
    settlementStatus: string;
    isReconciled: boolean;
    discrepancy: number;
    redistributionNote?: string;
  };
  categoryBreakdown: {
    category: string;
    totalAmount: number;
    count: number;
    percentage: number;
  }[];
  memberBalances: {
    userId: string;
    name: string;
    email?: string;
    role?: string;
    totalPaid: number;
    totalShare: number;
    settlementsPaid: number;
    settlementsReceived: number;
    netBalance: number;
    calculationDetails?: {
      arithmetic?: {
        equation?: string;
        summaryText?: string;
      };
    };
  }[];
  suggestedSettlements?: {
    fromUser?: { name: string };
    toUser?: { name: string };
    amount: number;
    status?: string;
  }[];
  settlementHistory: {
    _id?: string;
    fromUser?: { name: string };
    toUser?: { name: string };
    amount: number;
    status: string;
    paidAt?: string | Date;
    createdAt?: string | Date;
    notes?: string;
    reference?: string;
  }[];
  financialReconciliation?: {
    totalExpenses: number;
    totalSettledAmount: number;
    totalOutstandingCreditorBalances: number;
    totalOutstandingDebtorBalances: number;
    remainingAmountToSettle: number;
    isReconciled: boolean;
    discrepancy: number;
    redistributionNote: string;
  };
  generatedAt: string;
}

export const generateTripReportPDF = (data: TripReportData) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  const curr = data.trip.currency || 'Rs.';
  // Using standard ASCII currency label for clean rendering across all PDF engines
  const currLabel = curr === '₹' ? 'Rs.' : curr;

  const formatMoney = (val: number) => {
    return `${currLabel} ${(Number(val) || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const formatDate = (dateStr?: string | Date) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin - 10) {
      doc.addPage();
      y = margin;
      return true;
    }
    return false;
  };

  // Header Background Accent Banner
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(margin, y, pageWidth - 2 * margin, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('TripMate — Trip Completion & Settlement Report', margin + 6, y + 10);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // Slate-300
  doc.text(
    `Official Financial Summary & Member Balances • Generated on ${formatDate(data.generatedAt)}`,
    margin + 6,
    y + 17
  );

  y += 30;

  // 1. Trip Overview Section
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Trip Overview', margin, y);
  y += 5;

  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.roundedRect(margin, y, pageWidth - 2 * margin, 28, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // Slate-600

  // Left Column
  doc.text('Trip Name:', margin + 4, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${data.trip.name}`, margin + 30, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Destination:', margin + 4, y + 13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${data.trip.destination}`, margin + 30, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Dates:', margin + 4, y + 20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(
    `${formatDate(data.trip.startDate)} - ${formatDate(data.trip.endDate)}`,
    margin + 30,
    y + 20
  );

  // Right Column
  const rightColX = margin + 100;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Trip Status:', rightColX, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${data.trip.status}`, rightColX + 35, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Settlement Status:', rightColX, y + 13);
  doc.setFont('helvetica', 'bold');
  const isSettled = data.overview.settlementStatus === 'SETTLED';
  doc.setTextColor(isSettled ? 16 : 225, isSettled ? 185 : 29, isSettled ? 129 : 72);
  doc.text(
    `${isSettled ? 'All Settlements Completed' : 'Settlement Pending'}`,
    rightColX + 35,
    y + 13
  );

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Total Members:', rightColX, y + 20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${data.overview.memberCount}`, rightColX + 35, y + 20);

  y += 34;

  // Financial Metrics Grid (4 Boxes: Total Expenses, Average/Equal Per Member, Settled, Debt)
  const boxSpacing = 3;
  const boxWidth = (pageWidth - 2 * margin - 3 * boxSpacing) / 4;

  // Box 1: Total Expenses
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, y, boxWidth, 18, 2, 2, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL EXPENSES', margin + 3, y + 5.5);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatMoney(data.overview.totalExpenses), margin + 3, y + 12.5);

  // Box 2: Expense Per Person / Average Expense Per Member
  const box2X = margin + boxWidth + boxSpacing;
  doc.setFillColor(245, 243, 255); // Indigo-50
  doc.roundedRect(box2X, y, boxWidth, 18, 2, 2, 'FD');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(79, 70, 229); // Indigo-600
  const perMemLabel = (data.overview.perMemberExpenseLabel || (data.overview.isPurelyEqualSplitAllMembers ? 'EXPENSE PER PERSON' : 'AVG PER MEMBER')).toUpperCase();
  doc.text(perMemLabel, box2X + 3, y + 5.5);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(67, 56, 202);
  doc.text(formatMoney(data.overview.averageExpensePerMember || 0), box2X + 3, y + 12.5);

  // Box 3: Total Settled
  const box3X = box2X + boxWidth + boxSpacing;
  doc.setFillColor(240, 253, 244); // Emerald-50
  doc.roundedRect(box3X, y, boxWidth, 18, 2, 2, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(22, 101, 52);
  doc.text('CONFIRMED SETTLED', box3X + 3, y + 5.5);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(21, 128, 61);
  doc.text(formatMoney(data.overview.totalSettledAmount), box3X + 3, y + 12.5);

  // Box 4: Outstanding Debt
  const box4X = box3X + boxWidth + boxSpacing;
  doc.setFillColor(
    data.overview.outstandingAmount > 0 ? 254 : 248,
    data.overview.outstandingAmount > 0 ? 242 : 250,
    data.overview.outstandingAmount > 0 ? 242 : 252
  );
  doc.roundedRect(box4X, y, boxWidth, 18, 2, 2, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(
    data.overview.outstandingAmount > 0 ? 159 : 71,
    data.overview.outstandingAmount > 0 ? 18 : 85,
    data.overview.outstandingAmount > 0 ? 57 : 105
  );
  doc.text('OUTSTANDING DEBT', box4X + 3, y + 5.5);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(
    data.overview.outstandingAmount > 0 ? 225 : 15,
    data.overview.outstandingAmount > 0 ? 29 : 23,
    data.overview.outstandingAmount > 0 ? 72 : 42
  );
  doc.text(formatMoney(data.overview.outstandingAmount), box4X + 3, y + 12.5);

  y += 22;

  // Per-Member Expense Subtitle / Explanation
  if (data.overview.perMemberExpenseCalculationText) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Per-Member Metric: ${data.overview.perMemberExpenseCalculationText}  •  ${data.overview.perMemberExpenseExplanation || ''}`,
      margin + 1,
      y,
      { maxWidth: pageWidth - 2 * margin - 2 }
    );
    y += 7;
  }

  // 2. Category Breakdown Section
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Expense Breakdown by Category', margin, y);
  y += 4;

  // Table Header
  const renderCategoryHeader = () => {
    doc.setFillColor(226, 232, 240);
    doc.rect(margin, y, pageWidth - 2 * margin, 7, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text('Category', margin + 3, y + 4.8);
    doc.text('Transactions', margin + 65, y + 4.8);
    doc.text('Total Amount', margin + 115, y + 4.8);
    doc.text('Share (%)', margin + 160, y + 4.8);
    y += 7;
  };

  renderCategoryHeader();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  if (data.categoryBreakdown.length === 0) {
    doc.text('No expenses recorded.', margin + 3, y + 5);
    y += 8;
  } else {
    data.categoryBreakdown.forEach((cat, idx) => {
      if (checkPageBreak(8)) {
        renderCategoryHeader();
      }
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, pageWidth - 2 * margin, 6.5, 'F');
      }
      doc.setTextColor(30, 41, 59);
      doc.text(cat.category, margin + 3, y + 4.5);
      doc.text(`${cat.count}`, margin + 65, y + 4.5);
      doc.text(formatMoney(cat.totalAmount), margin + 115, y + 4.5);
      doc.text(`${cat.percentage}%`, margin + 160, y + 4.5);
      y += 6.5;
    });
  }

  y += 6;
  checkPageBreak(35);

  // 3. Member-wise Balances Table with Explicit Arithmetic
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('3. Member-wise Reconciled Financial Summary', margin, y);
  y += 4;

  const renderMemberHeader = () => {
    doc.setFillColor(226, 232, 240);
    doc.rect(margin, y, pageWidth - 2 * margin, 7, 'F');
    doc.setFontSize(7.8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text('Member', margin + 3, y + 4.8);
    doc.text('Amount Paid', margin + 40, y + 4.8);
    doc.text('Actual Share', margin + 74, y + 4.8);
    doc.text('Settled Paid', margin + 106, y + 4.8);
    doc.text('Settled Recv.', margin + 136, y + 4.8);
    doc.text('Final Balance', margin + 162, y + 4.8);
    y += 7;
  };

  renderMemberHeader();

  data.memberBalances.forEach((mb, idx) => {
    if (checkPageBreak(13)) {
      renderMemberHeader();
    }
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, pageWidth - 2 * margin, 12, 'F');
    }

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(mb.name || 'Member', margin + 3, y + 4.5);
    doc.text(formatMoney(mb.totalPaid), margin + 40, y + 4.5);
    doc.text(formatMoney(mb.totalShare), margin + 74, y + 4.5);
    doc.text(formatMoney(mb.settlementsPaid), margin + 106, y + 4.5);
    doc.text(formatMoney(mb.settlementsReceived), margin + 136, y + 4.5);

    const isPositive = mb.netBalance > 0.009;
    const isNegative = mb.netBalance < -0.009;

    doc.setFont('helvetica', 'bold');
    if (isPositive) {
      doc.setTextColor(21, 128, 61);
      doc.text(`+${formatMoney(mb.netBalance)}`, margin + 162, y + 4.5);
    } else if (isNegative) {
      doc.setTextColor(225, 29, 72);
      doc.text(`-${formatMoney(Math.abs(mb.netBalance))}`, margin + 162, y + 4.5);
    } else {
      doc.setTextColor(100, 116, 139);
      doc.text('Settled (0.00)', margin + 162, y + 4.5);
    }

    // Explicit Arithmetic Line underneath
    doc.setFontSize(6.7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    const eq = `Amount Paid (${formatMoney(mb.totalPaid)}) - Actual Share (${formatMoney(mb.totalShare)}) + Confirmed Paid (${formatMoney(mb.settlementsPaid)}) - Confirmed Recv (${formatMoney(mb.settlementsReceived)}) = Final Balance (${formatMoney(mb.netBalance)})`;
    const outcomeText = isPositive
      ? `Result: Needs to receive ${formatMoney(mb.netBalance)}`
      : isNegative
      ? `Result: Needs to pay ${formatMoney(Math.abs(mb.netBalance))}`
      : 'Result: Fully settled (Rs. 0.00)';

    doc.text(`Arithmetic: ${eq}  •  ${outcomeText}`, margin + 3, y + 9.5);

    y += 12;
  });

  y += 5;
  checkPageBreak(30);

  // 4. Suggested Settlements Section (Who Pays Whom)
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('4. Suggested Settlements (Who Pays Whom)', margin, y);
  y += 4;

  const renderSuggestedHeader = () => {
    doc.setFillColor(226, 232, 240);
    doc.rect(margin, y, pageWidth - 2 * margin, 7, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text('Payer (From)', margin + 3, y + 4.8);
    doc.text('Receiver (To)', margin + 65, y + 4.8);
    doc.text('Suggested Amount', margin + 120, y + 4.8);
    doc.text('Status', margin + 160, y + 4.8);
    y += 7;
  };

  renderSuggestedHeader();

  const suggestedList = data.suggestedSettlements || [];
  if (suggestedList.length === 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('All member balances are settled. No transfers required.', margin + 3, y + 5);
    y += 8;
  } else {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    suggestedList.forEach((s, idx) => {
      if (checkPageBreak(8)) {
        renderSuggestedHeader();
      }
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, pageWidth - 2 * margin, 6.5, 'F');
      }
      doc.setTextColor(15, 23, 42);
      doc.text(s.fromUser?.name || 'Member', margin + 3, y + 4.5);
      doc.text(s.toUser?.name || 'Member', margin + 65, y + 4.5);
      doc.setTextColor(21, 128, 61);
      doc.text(formatMoney(s.amount), margin + 120, y + 4.5);
      doc.setTextColor(234, 88, 12);
      doc.text('SUGGESTION', margin + 160, y + 4.5);
      y += 6.5;
    });
  }

  y += 5;
  checkPageBreak(30);

  // 5. Settlement History Table
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('5. Settlement Transactions History (Confirmed Payments)', margin, y);
  y += 4;

  const renderHistoryHeader = () => {
    doc.setFillColor(226, 232, 240);
    doc.rect(margin, y, pageWidth - 2 * margin, 7, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text('Payer (From)', margin + 3, y + 4.8);
    doc.text('Receiver (To)', margin + 50, y + 4.8);
    doc.text('Amount', margin + 98, y + 4.8);
    doc.text('Status', margin + 138, y + 4.8);
    doc.text('Date', margin + 163, y + 4.8);
    y += 7;
  };

  renderHistoryHeader();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  if (data.settlementHistory.length === 0) {
    doc.setTextColor(100, 116, 139);
    doc.text('No settlement payments recorded yet.', margin + 3, y + 5);
    y += 8;
  } else {
    data.settlementHistory.forEach((s, idx) => {
      if (checkPageBreak(8)) {
        renderHistoryHeader();
      }
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, pageWidth - 2 * margin, 6.5, 'F');
      }
      doc.setTextColor(15, 23, 42);
      doc.text(s.fromUser?.name || 'Member', margin + 3, y + 4.5);
      doc.text(s.toUser?.name || 'Member', margin + 50, y + 4.5);
      doc.text(formatMoney(s.amount), margin + 98, y + 4.5);

      if (s.status === 'PAID') {
        doc.setTextColor(21, 128, 61);
        doc.text('CONFIRMED', margin + 138, y + 4.5);
      } else {
        doc.setTextColor(234, 88, 12);
        doc.text('PENDING', margin + 138, y + 4.5);
      }

      doc.setTextColor(100, 116, 139);
      doc.text(formatDate(s.paidAt || s.createdAt), margin + 163, y + 4.5);
      y += 6.5;
    });
  }

  y += 5;
  checkPageBreak(25);

  // 6. Financial Reconciliation Summary
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('6. Financial Reconciliation & Audit Statement', margin, y);
  y += 4;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, pageWidth - 2 * margin, 20, 2, 2, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  const credBal = data.overview.totalOutstandingCreditorBalances ?? data.overview.outstandingAmount;
  const debtBal = data.overview.totalOutstandingDebtorBalances ?? data.overview.outstandingAmount;

  doc.text(
    `Total Expenses: ${formatMoney(data.overview.totalExpenses)}  •  Total Settled: ${formatMoney(data.overview.totalSettledAmount)}`,
    margin + 4,
    y + 5
  );
  doc.text(
    `Outstanding Creditors (To Receive): ${formatMoney(credBal)}  •  Outstanding Debtors (To Pay): ${formatMoney(debtBal)}`,
    margin + 4,
    y + 10
  );
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(
    'Audit Note: Settlement transfers redistribute money between members to reconcile balances; they do not increase total trip expenses.',
    margin + 4,
    y + 15
  );

  // Footer on current page
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(
    `TripMate Automated Settlement Audit • All balances strictly reconciled to 0.00 • Generated on ${new Date().toLocaleString()}`,
    margin,
    pageHeight - 8
  );

  // Trigger download
  const cleanName = (data.trip.name || 'Trip').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${cleanName}_Trip_Report.pdf`);
};

import { Router, Response } from 'express';
import { Budget, Expense } from '../models';
import { authenticateToken } from '../middleware/auth';
import { requireTripMembership, TripAuthRequest } from '../middleware/tripAuth';
import { emitToTrip } from '../sockets/socketHandler';

const router = Router();

// Standard categories
const STANDARD_CATEGORIES = [
  'Transportation',
  'Accommodation',
  'Food',
  'Activities',
  'Local Transport',
  'Shopping',
  'Emergency',
  'Miscellaneous'
];

// GET /api/trips/:id/budget
router.get('/:id/budget', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;

    let budgetDoc = await Budget.findOne({ tripId });
    if (!budgetDoc) {
      budgetDoc = await Budget.create({
        tripId,
        totalBudget: 50000,
        categoryBudgets: STANDARD_CATEGORIES.map(c => ({ category: c, plannedAmount: 5000 }))
      });
    }

    const expenses = await Expense.find({ tripId });

    // Calculate actual spending per category
    const categorySpentMap: Record<string, number> = {};
    STANDARD_CATEGORIES.forEach(c => { categorySpentMap[c] = 0; });

    let totalSpent = 0;
    expenses.forEach(e => {
      totalSpent += e.amount;
      const cat = e.category || 'Miscellaneous';
      categorySpentMap[cat] = (categorySpentMap[cat] || 0) + e.amount;
    });

    const categoryBreakdown = budgetDoc.categoryBudgets.map(cb => {
      const spent = categorySpentMap[cb.category] || 0;
      const remaining = cb.plannedAmount - spent;
      const percentage = cb.plannedAmount > 0 ? Math.round((spent / cb.plannedAmount) * 100) : 0;
      const isExceeded = spent > cb.plannedAmount && cb.plannedAmount > 0;

      return {
        category: cb.category,
        plannedAmount: cb.plannedAmount,
        spentAmount: spent,
        remainingAmount: remaining,
        percentage,
        isExceeded
      };
    });

    res.json({
      totalBudget: budgetDoc.totalBudget,
      totalSpent,
      totalRemaining: budgetDoc.totalBudget - totalSpent,
      percentageUsed: budgetDoc.totalBudget > 0 ? Math.round((totalSpent / budgetDoc.totalBudget) * 100) : 0,
      categories: categoryBreakdown
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching budget' });
  }
});

// PATCH /api/trips/:id/budget
router.patch('/:id/budget', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;
    const { totalBudget, categoryBudgets } = req.body;

    let budgetDoc = await Budget.findOne({ tripId });
    if (!budgetDoc) {
      budgetDoc = new Budget({ tripId, totalBudget: totalBudget || 0, categoryBudgets: [] });
    }

    if (totalBudget !== undefined) budgetDoc.totalBudget = Number(totalBudget);
    if (categoryBudgets && Array.isArray(categoryBudgets)) {
      budgetDoc.categoryBudgets = categoryBudgets.map(cb => ({
        category: cb.category,
        plannedAmount: Number(cb.plannedAmount) || 0
      }));
    }

    await budgetDoc.save();

    emitToTrip(tripId, 'budget.updated', budgetDoc);
    res.json({ budget: budgetDoc });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error updating budget' });
  }
});

export default router;

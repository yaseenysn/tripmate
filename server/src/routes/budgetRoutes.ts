import { Router, Response } from 'express';
import { Budget, Expense } from '../models';
import { authenticateToken } from '../middleware/auth';
import { requireTripMembership, requireTripAdmin, requireNotClosedTrip, TripAuthRequest } from '../middleware/tripAuth';
import { emitToTrip } from '../sockets/socketHandler';
import { handleRouteError } from '../utils/validation';

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
    handleRouteError(error, res, 'Error fetching budget');
  }
});

// PATCH /api/trips/:id/budget (Admin only, non-negative validation)
router.patch('/:id/budget', authenticateToken, requireTripMembership, requireTripAdmin, requireNotClosedTrip, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;
    const { totalBudget, categoryBudgets } = req.body;

    if (totalBudget !== undefined) {
      const numTotal = Number(totalBudget);
      if (isNaN(numTotal) || numTotal < 0) {
        return res.status(400).json({ error: 'Total budget must be a non-negative number' });
      }
    }

    if (categoryBudgets !== undefined) {
      if (!Array.isArray(categoryBudgets)) {
        return res.status(400).json({ error: 'Category budgets must be an array' });
      }
      for (const cb of categoryBudgets) {
        const planned = Number(cb.plannedAmount);
        if (isNaN(planned) || planned < 0) {
          return res.status(400).json({ error: `Planned amount for category "${cb.category}" must be a non-negative number` });
        }
      }
    }

    let budgetDoc = await Budget.findOne({ tripId });
    if (!budgetDoc) {
      budgetDoc = new Budget({ tripId, totalBudget: totalBudget !== undefined ? Number(totalBudget) : 0, categoryBudgets: [] });
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
    handleRouteError(error, res, 'Error updating budget');
  }
});

export default router;

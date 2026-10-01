import { Router, Response } from 'express';
import { TripMember, User } from '../models';
import { authenticateToken } from '../middleware/auth';
import { requireTripMembership, requireTripAdmin, TripAuthRequest } from '../middleware/tripAuth';
import { calculateTripBalancesAndSettlements } from '../services/settlementService';
import { logActivity } from '../services/activityService';
import { emitToTrip } from '../sockets/socketHandler';

const router = Router();

// GET /api/trips/:id/members - Get all trip members with net balances
router.get('/:id/members', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;
    const members = await TripMember.find({ tripId }).populate('userId', 'name email avatar');
    const { memberBalances } = await calculateTripBalancesAndSettlements(tripId);

    const balanceMap: Record<string, { totalPaid: number; totalShare: number; netBalance: number }> = {};
    memberBalances.forEach(mb => {
      balanceMap[mb.userId] = {
        totalPaid: mb.totalPaid,
        totalShare: mb.totalShare,
        netBalance: mb.netBalance
      };
    });

    const enrichedMembers = members.map(m => {
      const u = m.userId as any;
      const uId = u._id.toString();
      const bal = balanceMap[uId] || { totalPaid: 0, totalShare: 0, netBalance: 0 };

      return {
        _id: m._id,
        user: {
          _id: u._id,
          name: u.name,
          email: u.email,
          avatar: u.avatar
        },
        role: m.role,
        joinedAt: m.joinedAt,
        amountPaid: bal.totalPaid,
        amountOwed: bal.totalShare,
        netBalance: bal.netBalance
      };
    });

    res.json({ members: enrichedMembers });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching trip members' });
  }
});

// DELETE /api/trips/:id/members/:memberId - Remove member from trip (Admin only)
router.delete('/:id/members/:memberId', authenticateToken, requireTripMembership, requireTripAdmin, async (req: TripAuthRequest, res: Response) => {
  try {
    const { id: tripId, memberId } = req.params;

    const memberDoc = await TripMember.findById(memberId).populate('userId', 'name');
    if (!memberDoc) {
      return res.status(404).json({ error: 'Member record not found' });
    }

    if (memberDoc.tripId.toString() !== tripId) {
      return res.status(400).json({ error: 'Member does not belong to this trip' });
    }

    const removedUserName = (memberDoc.userId as any)?.name || 'Member';
    await TripMember.findByIdAndDelete(memberId);

    await logActivity(tripId, req.user!.userId, 'MEMBER_REMOVED', `removed ${removedUserName} from the trip`);
    emitToTrip(tripId, 'member.removed', { memberId });

    res.json({ message: 'Member removed successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error removing member' });
  }
});

// PATCH /api/trips/:id/members/:memberId/role - Change member role (Admin only)
router.patch('/:id/members/:memberId/role', authenticateToken, requireTripMembership, requireTripAdmin, async (req: TripAuthRequest, res: Response) => {
  try {
    const { id: tripId, memberId } = req.params;
    const { role } = req.body;

    if (!['ADMIN', 'MEMBER'].includes(role)) {
      return res.status(400).json({ error: 'Role must be ADMIN or MEMBER' });
    }

    const memberDoc = await TripMember.findById(memberId).populate('userId', 'name');
    if (!memberDoc) {
      return res.status(404).json({ error: 'Member record not found' });
    }

    memberDoc.role = role;
    await memberDoc.save();

    const userName = (memberDoc.userId as any)?.name || 'Member';
    await logActivity(tripId, req.user!.userId, 'ROLE_CHANGED', `changed ${userName}'s role to ${role}`);
    emitToTrip(tripId, 'member.roleChanged', { memberId, role });

    res.json({ member: memberDoc });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error updating member role' });
  }
});

export default router;

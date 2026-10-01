import mongoose, { Schema, Document } from 'mongoose';

// 1. User
export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  avatar: string;
  avatarPublicId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  avatar: { type: String, default: '' },
  avatarPublicId: { type: String },
}, { timestamps: true });

export const User = mongoose.model<IUser>('User', UserSchema);

// 2. Trip
export interface ITrip extends Document {
  name: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  coverImage: string;
  coverImagePublicId?: string;
  currency: string;
  estimatedBudget: number;
  description: string;
  createdBy: mongoose.Types.ObjectId;
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED';
  createdAt: Date;
  updatedAt: Date;
}

const TripSchema = new Schema<ITrip>({
  name: { type: String, required: true },
  destination: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  coverImage: { type: String, default: '' },
  coverImagePublicId: { type: String },
  currency: { type: String, default: '₹' },
  estimatedBudget: { type: Number, default: 0 },
  description: { type: String, default: '' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['UPCOMING', 'ACTIVE', 'COMPLETED'], default: 'UPCOMING' },
}, { timestamps: true });

export const Trip = mongoose.model<ITrip>('Trip', TripSchema);

// 3. TripMember
export interface ITripMember extends Document {
  tripId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: 'ADMIN' | 'MEMBER';
  joinedAt: Date;
}

const TripMemberSchema = new Schema<ITripMember>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['ADMIN', 'MEMBER'], default: 'MEMBER' },
  joinedAt: { type: Date, default: Date.now },
});

TripMemberSchema.index({ tripId: 1, userId: 1 }, { unique: true });

export const TripMember = mongoose.model<ITripMember>('TripMember', TripMemberSchema);

// 4. TripInvite
export interface ITripInvite extends Document {
  tripId: mongoose.Types.ObjectId;
  code: string;
  token: string;
  createdBy: mongoose.Types.ObjectId;
  expiresAt?: Date;
  maxUses?: number;
  usedCount: number;
  isActive: boolean;
  createdAt: Date;
}

const TripInviteSchema = new Schema<ITripInvite>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  code: { type: String, required: true, unique: true },
  token: { type: String, required: true, unique: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date },
  maxUses: { type: Number },
  usedCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

export const TripInvite = mongoose.model<ITripInvite>('TripInvite', TripInviteSchema);

// 5. Expense
export interface IExpenseParticipant {
  userId: mongoose.Types.ObjectId;
  share: number;
  percentage?: number;
  status?: 'PENDING' | 'PAID';
}

export interface IExpense extends Document {
  tripId: mongoose.Types.ObjectId;
  title: string;
  amount: number;
  category: 'Transportation' | 'Accommodation' | 'Food' | 'Activities' | 'Local Transport' | 'Shopping' | 'Emergency' | 'Miscellaneous';
  date: Date;
  paidBy: mongoose.Types.ObjectId;
  splitType: 'EQUAL' | 'CUSTOM' | 'PERCENTAGE';
  participants: IExpenseParticipant[];
  notes?: string;
  receiptUrl?: string;
  receiptPublicId?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const ExpenseSchema = new Schema<IExpense>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  title: { type: String, required: true },
  amount: { type: Number, required: true },
  category: { 
    type: String, 
    enum: ['Transportation', 'Accommodation', 'Food', 'Activities', 'Local Transport', 'Shopping', 'Emergency', 'Miscellaneous'],
    default: 'Miscellaneous' 
  },
  date: { type: Date, default: Date.now },
  paidBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  splitType: { type: String, enum: ['EQUAL', 'CUSTOM', 'PERCENTAGE'], default: 'EQUAL' },
  participants: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    share: { type: Number, required: true },
    percentage: { type: Number },
    status: { type: String, enum: ['PENDING', 'PAID'], default: 'PENDING' }
  }],
  notes: { type: String },
  receiptUrl: { type: String },
  receiptPublicId: { type: String },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export const Expense = mongoose.model<IExpense>('Expense', ExpenseSchema);

// 6. Budget
export interface ICategoryBudget {
  category: string;
  plannedAmount: number;
}

export interface IBudget extends Document {
  tripId: mongoose.Types.ObjectId;
  totalBudget: number;
  categoryBudgets: ICategoryBudget[];
}

const BudgetSchema = new Schema<IBudget>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true, unique: true },
  totalBudget: { type: Number, required: true, default: 0 },
  categoryBudgets: [{
    category: { type: String, required: true },
    plannedAmount: { type: Number, required: true, default: 0 }
  }]
});

export const Budget = mongoose.model<IBudget>('Budget', BudgetSchema);

// 7. Settlement
export interface ISettlement extends Document {
  tripId: mongoose.Types.ObjectId;
  fromUser: mongoose.Types.ObjectId;
  toUser: mongoose.Types.ObjectId;
  amount: number;
  status: 'PENDING' | 'PAID';
  paidAt?: Date;
  updatedAt: Date;
}

const SettlementSchema = new Schema<ISettlement>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  fromUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  toUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['PENDING', 'PAID'], default: 'PENDING' },
  paidAt: { type: Date }
}, { timestamps: true });

export const Settlement = mongoose.model<ISettlement>('Settlement', SettlementSchema);

// 8. ItineraryItem
export interface IItineraryItem extends Document {
  tripId: mongoose.Types.ObjectId;
  dayNumber: number;
  date: Date;
  startTime: string;
  endTime: string;
  title: string;
  location: string;
  description: string;
  estimatedCost: number;
  assignedMembers: mongoose.Types.ObjectId[];
  notes: string;
  order: number;
  createdAt: Date;
}

const ItineraryItemSchema = new Schema<IItineraryItem>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  dayNumber: { type: Number, required: true, default: 1 },
  date: { type: Date, required: true },
  startTime: { type: String, default: '' },
  endTime: { type: String, default: '' },
  title: { type: String, required: true },
  location: { type: String, default: '' },
  description: { type: String, default: '' },
  estimatedCost: { type: Number, default: 0 },
  assignedMembers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  notes: { type: String, default: '' },
  order: { type: Number, default: 0 }
}, { timestamps: true });

export const ItineraryItem = mongoose.model<IItineraryItem>('ItineraryItem', ItineraryItemSchema);

// 9. Booking
export interface IBooking extends Document {
  tripId: mongoose.Types.ObjectId;
  type: 'FLIGHT' | 'TRAIN' | 'BUS' | 'HOTEL' | 'CAB' | 'ACTIVITY' | 'OTHER';
  provider: string;
  bookingReference: string;
  date: Date;
  time: string;
  location: string;
  cost: number;
  notes: string;
  attachmentUrl: string;
  attachmentPublicId?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const BookingSchema = new Schema<IBooking>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  type: { 
    type: String, 
    enum: ['FLIGHT', 'TRAIN', 'BUS', 'HOTEL', 'CAB', 'ACTIVITY', 'OTHER'],
    required: true 
  },
  provider: { type: String, required: true },
  bookingReference: { type: String, default: '' },
  date: { type: Date, required: true },
  time: { type: String, default: '' },
  location: { type: String, default: '' },
  cost: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  attachmentUrl: { type: String, default: '' },
  attachmentPublicId: { type: String },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

export const Booking = mongoose.model<IBooking>('Booking', BookingSchema);

// 10. Document
export interface IDocument extends Document {
  tripId: mongoose.Types.ObjectId;
  name: string;
  type: 'TICKET' | 'RECEIPT' | 'CONFIRMATION' | 'ID' | 'OTHER';
  fileUrl: string;
  publicId?: string;
  fileSize: string;
  uploadedBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const DocumentSchema = new Schema<IDocument>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  name: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['TICKET', 'RECEIPT', 'CONFIRMATION', 'ID', 'OTHER'],
    default: 'OTHER' 
  },
  fileUrl: { type: String, required: true },
  publicId: { type: String },
  fileSize: { type: String, default: '1.2 MB' },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

export const DocumentModel = mongoose.model<IDocument>('Document', DocumentSchema);

// 11. Task
export interface ITask extends Document {
  tripId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  assignedTo?: mongoose.Types.ObjectId;
  dueDate?: Date;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const TaskSchema = new Schema<ITask>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  dueDate: { type: Date },
  priority: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], default: 'MEDIUM' },
  status: { type: String, enum: ['TODO', 'IN_PROGRESS', 'DONE'], default: 'TODO' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

export const Task = mongoose.model<ITask>('Task', TaskSchema);

// 12. Poll & PollVote
export interface IPollOption {
  _id?: mongoose.Types.ObjectId | string;
  text: string;
}

export interface IPoll extends Document {
  tripId: mongoose.Types.ObjectId;
  question: string;
  options: IPollOption[];
  createdBy: mongoose.Types.ObjectId;
  isClosed: boolean;
  createdAt: Date;
}

const PollSchema = new Schema<IPoll>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  question: { type: String, required: true },
  options: [{
    text: { type: String, required: true }
  }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  isClosed: { type: Boolean, default: false }
}, { timestamps: true });

export const Poll = mongoose.model<IPoll>('Poll', PollSchema);

export interface IPollVote extends Document {
  pollId: mongoose.Types.ObjectId;
  tripId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  optionId: string;
  createdAt: Date;
}

const PollVoteSchema = new Schema<IPollVote>({
  pollId: { type: Schema.Types.ObjectId, ref: 'Poll', required: true },
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  optionId: { type: String, required: true }
}, { timestamps: true });

PollVoteSchema.index({ pollId: 1, userId: 1 }, { unique: true });

export const PollVote = mongoose.model<IPollVote>('PollVote', PollVoteSchema);

// 13. Activity
export interface IActivity extends Document {
  tripId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const ActivitySchema = new Schema<IActivity>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true },
  description: { type: String, required: true },
  metadata: { type: Object }
}, { timestamps: true });

export const Activity = mongoose.model<IActivity>('Activity', ActivitySchema);

// 14. Notification
export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  tripId?: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  link?: string;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip' },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, default: 'INFO' },
  isRead: { type: Boolean, default: false },
  link: { type: String }
}, { timestamps: true });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);

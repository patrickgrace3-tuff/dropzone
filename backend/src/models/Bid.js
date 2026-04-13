import mongoose from 'mongoose';

const bidSchema = new mongoose.Schema({
  listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  bidder:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount:  { type: Number, required: true },
  isWinning:{ type: Boolean, default: false },
  isLive:  { type: Boolean, default: false }, // placed during a live show
  show:    { type: mongoose.Schema.Types.ObjectId, ref: 'LiveShow' },
  status:  { type: String, enum: ['active','outbid','won','cancelled'], default: 'active' },
  ip:      String,
}, { timestamps: true });

bidSchema.index({ listing: 1, amount: -1 });
bidSchema.index({ bidder: 1, createdAt: -1 });

export default mongoose.model('Bid', bidSchema);

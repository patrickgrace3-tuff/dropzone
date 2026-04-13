import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  buyer:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  seller:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  bid:     { type: mongoose.Schema.Types.ObjectId, ref: 'Bid' },

  type:    { type: String, enum: ['auction_win','buy_now','live_auction'], required: true },
  amount:  { type: Number, required: true },
  fees: {
    platform:  Number,
    payment:   Number,
    shipping:  Number,
  },
  total:   Number,

  status: { type: String, enum: ['pending_payment','paid','processing','shipped','delivered','disputed','refunded','cancelled'], default: 'pending_payment' },

  payment: {
    stripePaymentIntentId: String,
    paidAt:  Date,
    method:  String,
  },

  shipping: {
    method:        String,
    carrier:       String,
    trackingNumber:String,
    shippedAt:     Date,
    deliveredAt:   Date,
    address: {
      name:    String,
      line1:   String,
      line2:   String,
      city:    String,
      state:   String,
      zip:     String,
      country: String,
    },
  },

  review: {
    rating:  { type: Number, min: 1, max: 5 },
    comment: String,
    createdAt: Date,
  },
}, { timestamps: true });

export default mongoose.model('Order', orderSchema);

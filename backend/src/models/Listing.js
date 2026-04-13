import mongoose from 'mongoose';

const listingSchema = new mongoose.Schema({
  seller:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:       { type: String, required: true, trim: true, maxlength: 150 },
  description: { type: String, required: true, maxlength: 5000 },
  category:    { type: String, required: true, enum: ['sneakers','cards','tech','vintage','streetwear','collectibles','jewelry','art','other'] },
  condition:   { type: String, required: true, enum: ['new','like_new','used','parts'] },
  images:      [{ url: String, publicId: String }],
  type:        { type: String, enum: ['auction','buy_now','both'], required: true },

  // Auction fields
  auction: {
    startingBid:  { type: Number, default: 0 },
    currentBid:   { type: Number, default: 0 },
    currentBidder:{ type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    bidCount:     { type: Number, default: 0 },
    reservePrice: Number,
    endsAt:       Date,
    duration:     { type: Number, default: 7 }, // days
  },

  // Buy Now fields
  buyNow: {
    price:     Number,
    quantity:  { type: Number, default: 1 },
    sold:      { type: Number, default: 0 },
  },

  // Live show link
  liveShow:    { type: mongoose.Schema.Types.ObjectId, ref: 'LiveShow' },
  isLiveActive:{ type: Boolean, default: false },

  status: { type: String, enum: ['draft','active','ended','sold','cancelled'], default: 'draft' },

  tags:        [String],
  views:       { type: Number, default: 0 },
  watcherCount:{ type: Number, default: 0 },

  shipping: {
    weight:     Number,
    dimensions: { l: Number, w: Number, h: Number },
    methods:    [{ name: String, price: Number, estimatedDays: Number }],
    freeShipping: { type: Boolean, default: false },
  },

  aiPricing: {
    suggestedStart:  Number,
    suggestedFair:   Number,
    suggestedBuyNow: Number,
    generatedAt:     Date,
  },
}, { timestamps: true });

listingSchema.index({ status: 1, 'auction.endsAt': 1 });
listingSchema.index({ category: 1, status: 1 });
listingSchema.index({ title: 'text', description: 'text', tags: 'text' });

export default mongoose.model('Listing', listingSchema);

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username:     { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 30 },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  displayName:  { type: String, default: '' },
  avatar:       { type: String, default: '' },
  bio:          { type: String, default: '' },
  role:         { type: String, enum: ['buyer', 'seller', 'admin'], default: 'buyer' },
  sellerProfile: {
    stripeAccountId: String,
    verified:        { type: Boolean, default: false },
    rating:          { type: Number, default: 0 },
    reviewCount:     { type: Number, default: 0 },
    totalSales:      { type: Number, default: 0 },
    totalRevenue:    { type: Number, default: 0 },
  },
  watchlist:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Listing' }],
  addresses: [{
    label:   String,
    line1:   String,
    line2:   String,
    city:    String,
    state:   String,
    zip:     String,
    country: String,
    isDefault: Boolean,
  }],
  notificationPrefs: {
    email: { type: Boolean, default: true },
    push:  { type: Boolean, default: true },
    sms:   { type: Boolean, default: false },
  },
  isEmailVerified: { type: Boolean, default: false },
  isBanned:        { type: Boolean, default: false },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.toPublic = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

export default mongoose.model('User', userSchema);

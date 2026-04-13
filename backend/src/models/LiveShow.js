import mongoose from 'mongoose';

const liveShowSchema = new mongoose.Schema({
  seller:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:       { type: String, required: true, maxlength: 100 },
  description: { type: String, maxlength: 1000 },
  scheduledAt: { type: Date, required: true },
  startedAt:   Date,
  endedAt:     Date,
  status:      { type: String, enum: ['scheduled','live','ended','cancelled'], default: 'scheduled' },

  streamKey:   String, // Mux/Agora stream key
  playbackId:  String,

  inventory: [{
    listing:       { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
    order:         Number,
    startingBid:   Number,
    bidDuration:   { type: Number, default: 120 }, // seconds
    status:        { type: String, enum: ['queued','active','sold','skipped'], default: 'queued' },
    soldPrice:     Number,
    soldTo:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    startedAt:     Date,
    endedAt:       Date,
  }],

  currentItemIndex: { type: Number, default: 0 },

  viewerCount:  { type: Number, default: 0 },
  peakViewers:  { type: Number, default: 0 },
  totalBids:    { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },

  chatEnabled:  { type: Boolean, default: true },
  category:     String,
  tags:         [String],
  thumbnail:    String,
}, { timestamps: true });

export default mongoose.model('LiveShow', liveShowSchema);

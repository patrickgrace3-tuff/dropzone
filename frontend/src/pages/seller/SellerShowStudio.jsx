import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { showsAPI, aiAPI } from '../../services/api.js';
import { getSocket, joinShow, leaveShow, sendChat } from '../../services/socket.js';
import toast from 'react-hot-toast';
import Broadcaster from '../../components/live/Broadcaster.jsx';


export default function SellerShowStudio() {
  const { id } = useParams();
  const [show, setShow]               = useState(null);
  const [listings, setListings]       = useState([]);
  const [messages, setMessages]       = useState([]);
  const [viewers, setViewers]         = useState(0);
  const [currentItem, setCurrentItem] = useState(null);
  const [currentBid, setCurrentBid]   = useState(0);
  const [countdown, setCountdown]     = useState(0);
  const [chatInput, setChatInput]     = useState('');
  const [aiScript, setAiScript]       = useState('');
  const [aiLoading, setAiLoading]     = useState(false);
  const [loading, setLoading]         = useState(true);
  const [hammering, setHammering]     = useState(false);
  const timerRef   = useRef(null);
  const chatRef    = useRef(null);
  const countdownRef = useRef(0); // track in ref so timer callback has current value

  const scrollChat = () => setTimeout(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); }, 50);

  const loadShow = useCallback(() =>
    showsAPI.get(id).then(({ show: s }) => { setShow(s); setViewers(s.viewerCount || 0); return s; })
  , [id]);

  // Start a countdown timer for an item
  const startCountdown = useCallback((seconds, onExpire) => {
    clearInterval(timerRef.current);
    countdownRef.current = seconds;
    setCountdown(seconds);
    timerRef.current = setInterval(() => {
      countdownRef.current -= 1;
      setCountdown(countdownRef.current);
      if (countdownRef.current <= 0) {
        clearInterval(timerRef.current);
        onExpire?.();
      }
    }, 1000);
  }, []);

  const activateItem = useCallback((item) => {
    if (!item) return;
    setCurrentItem(item);
    setCurrentBid(item.currentBid || item.startingBid || 0);
    startCountdown(item.bidDuration || 120, () => {
      // Timer expired — auto hammer at current bid
      toast('⏱ Time\'s up! Hammering at current bid...');
    });
    toast.success(`▶ Now live: ${item.listing?.title}`);
    setMessages(p => [...p, { isSystem: true, message: `Now bidding: ${item.listing?.title} — starting at $${item.startingBid}`, ts: Date.now() }]);
    scrollChat();
  }, [startCountdown]);

  useEffect(() => {
    Promise.all([loadShow(), showsAPI.availableItems(id)])
      .then(([s, { listings: ls }]) => {
        setListings(ls || []);
        const active = s.inventory?.find(i => i.status === 'active');
        if (active) activateItem(active);
        setLoading(false);
      }).catch(() => setLoading(false));

    setMessages([{ isSystem: true, message: 'Studio ready. Add items to queue then go live!', ts: Date.now() }]);

    joinShow(id);
    const socket = getSocket();

    socket.on('show:chat', (msg) => { setMessages(p => [...p.slice(-99), msg]); scrollChat(); });
    socket.on('show:bid:new', ({ amount, bidder }) => {
      setCurrentBid(amount);
      setMessages(p => [...p.slice(-99), { username: bidder.username, bid: amount, ts: Date.now() }]);
      scrollChat();
    });
    socket.on('show:viewers', ({ count }) => setViewers(count));
    socket.on('show:next-item', ({ item }) => { activateItem(item); });

    return () => {
      leaveShow(id);
      clearInterval(timerRef.current);
      socket.off('show:chat');
      socket.off('show:bid:new');
      socket.off('show:viewers');
      socket.off('show:next-item');
    };
  }, [id, loadShow, activateItem]);

  const handleGoLive = async () => {
    if (show?.inventory?.length === 0) {
      toast.error('Add at least one item to the queue first!');
      return;
    }
    try {
      const { currentItem: first } = await showsAPI.start(id);
      await loadShow();
      toast.success('🔴 You are LIVE!');
      if (first) activateItem(first);
    } catch (err) { toast.error(err.error || 'Failed to go live'); }
  };

  const handleHammer = async () => {
    if (!currentItem) { toast.error('No active item'); return; }
    setHammering(true);
    clearInterval(timerRef.current);
    const listingId = currentItem.listing?.id || currentItem.listing;
    try {
      const { nextItem } = await showsAPI.hammer(id, { finalPrice: currentBid, listingId });
      toast.success(`🔨 SOLD for $${currentBid.toLocaleString()}!`);
      await loadShow();
      if (nextItem) {
        activateItem(nextItem);
      } else {
        setCurrentItem(null);
        setCountdown(0);
        toast('✅ All items sold! End the show when ready.');
      }
    } catch (err) { toast.error(err.error || 'Failed'); }
    setHammering(false);
  };

  const handleNextItem = async () => {
    clearInterval(timerRef.current);
    try {
      const { currentItem: next } = await showsAPI.nextItem(id);
      await loadShow();
      if (next) activateItem(next);
      else { setCurrentItem(null); setCountdown(0); toast('No more items in queue'); }
    } catch (err) { toast.error(err.error || 'Failed'); }
  };

  const handleEndShow = async () => {
    if (!confirm('End this show?')) return;
    clearInterval(timerRef.current);
    try { await showsAPI.end(id); await loadShow(); setCurrentItem(null); setCountdown(0); toast('Show ended'); }
    catch (err) { toast.error(err.error || 'Failed'); }
  };

  const addItemToShow = async (listingId, startingBid) => {
    try {
      await showsAPI.addItem(id, { listingId, startingBid, bidDuration: 120 });
      await loadShow();
      toast.success('Item added to queue!');
    } catch (err) { toast.error(err.error || 'Failed'); }
  };

  const handleChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChat(id, chatInput);
    setChatInput('');
  };

  const getAiScript = async () => {
    if (!currentItem) { toast.error('No active item'); return; }
    setAiLoading(true);
    try {
      const { script } = await aiAPI.showScript({ itemTitle: currentItem.listing?.title, startingBid: currentItem.startingBid, category: currentItem.listing?.category });
      setAiScript(script);
    } catch { toast.error('Add ANTHROPIC_API_KEY to .env for AI scripts'); }
    setAiLoading(false);
  };

  const addTime = (secs) => {
    countdownRef.current += secs;
    setCountdown(c => c + secs);
    toast(`+${secs}s added`);
  };

  if (loading) return <div className="p-8 text-gray-400">⏳ Loading studio...</div>;
  if (!show)   return <div className="p-8 text-gray-400">Show not found. <Link to="/seller/shows" className="text-brand underline">Back</Link></div>;

  const isLive    = show.status === 'live';
  const queuedIds = new Set(show.inventory?.map(i => i.listing?.id || i.listing) || []);
  const available = listings.filter(l => !queuedIds.has(l.id));
  const soldCount = show.inventory?.filter(i => i.status === 'sold').length || 0;
  const queueLeft = show.inventory?.filter(i => i.status === 'queued').length || 0;

  // Countdown color
  const cdColor = countdown <= 10 ? 'text-live animate-pulse' : countdown <= 30 ? 'text-amber-500' : 'text-white';

  return (
    <div className="flex flex-col gap-4 p-5" style={{ height: '100vh', overflow: 'hidden' }}>

      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-extrabold">{show.title}</h1>
          <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
            <span className={`font-bold ${isLive ? 'text-live' : 'text-gray-500'}`}>
              {isLive ? '🔴 LIVE' : show.status === 'scheduled' ? '⏳ Ready to go live' : show.status.toUpperCase()}
            </span>
            <span>👁 {viewers} watching</span>
            <span>✅ {soldCount} sold · 📦 {queueLeft} queued</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/seller/shows" className="btn-ghost text-xs">← Back</Link>
          {!isLive && (
            <button onClick={handleGoLive}
              className={`btn-primary ${show.inventory?.length === 0 ? 'opacity-50' : ''}`}>
              🔴 Go Live
            </button>
          )}
          {isLive && (
            <button onClick={handleEndShow} className="px-4 py-2 bg-red-50 text-red-600 font-bold text-sm rounded-xl border border-red-200 hover:bg-red-100">
              End Show
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">

        {/* LEFT column */}
        <div className="flex flex-col gap-4 flex-1 min-w-0 overflow-y-auto pb-2">

          {/* Stream + current item overlay */}
          <div className="rounded-2xl overflow-hidden flex-shrink-0 relative bg-brand2" style={{ aspectRatio: '16/9' }}>
            {/* Broadcaster fills the box — its own controls sit inside at the bottom */}
            <Broadcaster showId={id} isLive={isLive} />

            {/* Current item overlay — sits ABOVE video but BELOW broadcaster controls */}

            {/* Current item overlay — sits above video, below broadcaster controls bar */}
            {currentItem ? (
              <div className="absolute bottom-12 left-0 right-0 bg-gradient-to-t from-black/95 to-black/60 p-4" style={{pointerEvents:'none'}}>
                <div className="text-xs text-white/50 font-mono uppercase tracking-wider mb-1">Now Bidding</div>
                <div className="font-extrabold text-white text-base mb-3 leading-tight">
                  {currentItem.listing?.title}
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-xs text-white/50 mb-0.5">Current bid</div>
                    <div className="text-4xl font-extrabold text-accent leading-none">
                      ${currentBid.toLocaleString()}
                    </div>
                    <div className="text-xs text-white/40 mt-1">
                      Starting: ${currentItem.startingBid?.toLocaleString()}
                    </div>
                  </div>
                  {/* Big countdown */}
                  <div className="text-right">
                    <div className="text-xs text-white/50 mb-0.5">Time remaining</div>
                    <div className={`text-5xl font-extrabold font-mono leading-none ${cdColor}`}>
                      {countdown > 0
                        ? `${Math.floor(countdown/60)}:${String(countdown%60).padStart(2,'0')}`
                        : <span className="text-live">TIME</span>}
                    </div>
                    {countdown <= 0 && <div className="text-xs text-live font-bold mt-1">Hammer to sell!</div>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="absolute bottom-4 left-4 right-4 bg-black/60 rounded-xl p-3 text-center">
                <p className="text-white/50 text-sm">
                  {isLive ? 'All items sold — end the show or add more' : 'Add items to queue then click Go Live'}
                </p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex-shrink-0">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Controls</div>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleHammer} disabled={!isLive || !currentItem || hammering}
                className="px-5 py-2.5 bg-green-600 text-white font-bold text-sm rounded-xl hover:bg-green-700 disabled:opacity-40 transition-all">
                {hammering ? '...' : '🔨 Hammer Sold!'}
              </button>
              <button onClick={handleNextItem} disabled={!isLive || queueLeft === 0}
                className="btn-secondary text-sm disabled:opacity-40">
                ▶ Skip to Next
              </button>
              <button onClick={() => addTime(30)} disabled={!isLive || !currentItem}
                className="btn-ghost text-sm disabled:opacity-40">+30s</button>
              <button onClick={() => addTime(60)} disabled={!isLive || !currentItem}
                className="btn-ghost text-sm disabled:opacity-40">+60s</button>
              <button onClick={getAiScript} disabled={aiLoading || !currentItem}
                className="px-4 py-2 bg-violet-600 text-white font-bold text-sm rounded-xl hover:bg-violet-700 disabled:opacity-50">
                {aiLoading ? '✦ Writing...' : '✦ AI Script'}
              </button>
            </div>
            {aiScript && (
              <div className="mt-3 bg-violet-50 border border-violet-100 rounded-xl p-3 text-sm text-violet-800 italic flex justify-between gap-2">
                <span>"{aiScript}"</span>
                <button onClick={() => setAiScript('')} className="text-violet-300 hover:text-violet-500 flex-shrink-0">✕</button>
              </div>
            )}
            {!isLive && (
              <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-700">
                {show.inventory?.length === 0
                  ? '⚠️ Add items to the queue below, then click Go Live.'
                  : `✅ ${show.inventory?.length} item${show.inventory?.length > 1 ? 's' : ''} ready. Click Go Live to start — the first item activates automatically.`}
              </div>
            )}
          </div>

          {/* Add items */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex-shrink-0">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              Add to Queue {available.length === 0 ? '' : `(${available.length} available)`}
            </div>
            {available.length === 0 ? (
              <p className="text-sm text-gray-400">
                <Link to="/seller/listings/new" className="text-brand underline">Create & publish listings</Link> first, then add them here.
              </p>
            ) : (
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {available.map(l => (
                  <div key={l.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center text-lg overflow-hidden">
                      {l.images?.[0]?.url ? <img src={l.images[0].url} className="w-full h-full object-cover" alt="" /> : '📦'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold truncate">{l.title}</p>
                        {l.auctionType === 'live_show' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-live/10 text-live rounded-full flex-shrink-0">LIVE ONLY</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">Start: ${l.startingBid || 0}</p>
                    </div>
                    <button onClick={() => addItemToShow(l.id, l.auction?.startingBid || l.buyNow?.price || 10)}
                      className="text-xs font-bold text-brand px-3 py-1.5 rounded-lg border border-brand/20 hover:bg-brand/5 flex-shrink-0">
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT column */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-4 min-h-0">

          {/* Queue */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex-shrink-0">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              Queue ({show.inventory?.length || 0})
            </div>
            {show.inventory?.length === 0 ? (
              <p className="text-xs text-gray-400">Empty — add items from the left</p>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {show.inventory.map((item, i) => (
                  <div key={i} className={`flex items-center gap-2 p-2 rounded-xl text-xs
                    ${item.status === 'active' ? 'bg-brand/5 border border-brand/20' : ''}`}>
                    <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center font-bold flex-shrink-0">{i+1}</span>
                    <span className="flex-1 font-semibold truncate">{item.listing?.title || `Item ${i+1}`}</span>
                    <span className={`font-bold px-1.5 py-0.5 rounded-full text-[10px] flex-shrink-0 whitespace-nowrap
                      ${item.status === 'active'  ? 'bg-brand text-white'
                      : item.status === 'sold'    ? 'bg-green-100 text-green-700'
                      : item.status === 'skipped' ? 'text-gray-300'
                      : 'text-gray-400'}`}>
                      {item.status === 'active'  ? '● LIVE'
                      : item.status === 'sold'   ? `$${item.soldPrice?.toLocaleString()}`
                      : item.status === 'skipped'? 'SKIPPED'
                      : 'QUEUED'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chat */}
          <div className="bg-white rounded-2xl border border-gray-100 flex flex-col flex-1 min-h-0">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <span className="font-bold text-sm">Live Chat</span>
              <span className="text-xs text-gray-400 font-mono">{viewers} watching</span>
            </div>
            <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0">
              {messages.map((msg, i) => (
                <div key={i} className="text-xs leading-relaxed">
                  {msg.isSystem
                    ? <span className="text-gray-400 italic">{msg.message}</span>
                    : msg.bid
                    ? <span><span className="font-bold text-brand2">{msg.username}</span><span className="text-green-600 font-bold font-mono"> bid ${msg.bid?.toLocaleString()}</span></span>
                    : <span><span className="font-bold text-brand2">{msg.username}: </span><span className="text-gray-600">{msg.message}</span></span>}
                </div>
              ))}
            </div>
            <form onSubmit={handleChat} className="p-2 border-t border-gray-100 flex gap-1.5 flex-shrink-0">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                placeholder="Chat as host..." className="input flex-1 text-xs py-1.5" />
              <button type="submit" className="btn-primary text-xs py-1.5 px-3">Send</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

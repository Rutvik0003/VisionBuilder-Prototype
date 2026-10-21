import { useStore } from '../store';

// Customer-facing copy for new features, EN + हिंदी.
export const STRINGS = {
  conceptTag: { en: 'DICE concept prototype', hi: 'DICE कॉन्सेप्ट प्रोटोटाइप' },

  // Product page delivery line
  deliveryByTo: { en: 'Delivery by {date} to {label}, {pincode}', hi: '{date} तक डिलीवरी · {label}, {pincode}' },
  addAddressForDate: { en: 'Add address to see delivery date', hi: 'डिलीवरी की तारीख देखने के लिए पता जोड़ें' },
  change: { en: 'Change', hi: 'बदलें' },
  deliverTo: { en: 'Deliver to', hi: 'यहाँ डिलीवर करें' },

  // C3-F1 price transparency
  lowestBadge: { en: 'Lowest price for this item', hi: 'इस आइटम की सबसे कम कीमत' },
  lowestShort: { en: 'Lowest price', hi: 'सबसे कम कीमत' },
  sameItemFrom: { en: 'Same item from {min} · {n} sellers', hi: 'यही आइटम {min} से · {n} विक्रेता' },
  compareTitle: { en: 'Same item, other sellers', hi: 'यही आइटम, दूसरे विक्रेता' },
  compareSub: { en: 'Identical product listed by {n} sellers. Pick the one you like.', hi: '{n} विक्रेताओं ने यही प्रोडक्ट लिस्ट किया है। अपनी पसंद चुनें।' },
  switchBtn: { en: 'Switch', hi: 'बदलें' },
  viewing: { en: 'Viewing', hi: 'देख रहे हैं' },
  bestPrice: { en: 'You’re getting the best price for this item', hi: 'आपको इस आइटम की सबसे अच्छी कीमत मिल रही है' },

  // C1-F1 slots
  slotTitle: { en: 'When should we deliver?', hi: 'हम कब डिलीवर करें?' },
  slotSub: { en: 'Pick a time you’ll be home. It helps us deliver on the first try.', hi: 'वह समय चुनें जब आप घर पर हों। इससे पहली बार में डिलीवरी हो पाती है।' },
  slotPickDay: { en: 'Day', hi: 'दिन' },
  slotPickTime: { en: 'Time', hi: 'समय' },
  slotAnyTime: { en: 'Any time (fastest)', hi: 'कभी भी (सबसे तेज़)' },
  slotAnyTimeSub: { en: 'We’ll come between 9 am and 8 pm', hi: 'हम सुबह 9 से रात 8 के बीच आएँगे' },
  slotFull: { en: 'Full', hi: 'भरा' },
  slotLeft: { en: '{n} left', hi: '{n} बचे' },
  slotHeld: { en: 'Slot held for you. Place the order before the timer ends.', hi: 'स्लॉट आपके लिए रोका गया है। टाइमर खत्म होने से पहले ऑर्डर करें।' },
  slotExpired: { en: 'Your slot hold expired. Tap the time again to hold it.', hi: 'स्लॉट की रोक खत्म हो गई। दोबारा रोकने के लिए समय पर टैप करें।' },
  slotJustFilled: { en: 'That time just filled up. Please pick another.', hi: 'यह समय अभी भर गया। कृपया दूसरा चुनें।' },
  slotNotPilot: { en: 'Time slots aren’t available for this address yet. It will arrive by {date}.', hi: 'इस पते के लिए समय चुनने की सुविधा अभी नहीं है। यह {date} तक पहुँचेगा।' },
  cashDayTitle: { en: 'Paying cash? When will you have the money? We will come on that day or later (for example, your salary day).', hi: 'नकद देंगे? पैसे कब तक होंगे? हम उसी दिन या उसके बाद आएँगे (जैसे, तनख़्वाह वाला दिन)।' },
  cashDayAny: { en: 'Any day', hi: 'कोई भी दिन' },
  cashDayMoved: { en: 'Delivery moved to {date} to match your cash day.', hi: 'आपके नकद वाले दिन के हिसाब से डिलीवरी {date} कर दी गई।' },

  // C2-F3 open-box
  openBoxBadge: { en: 'Open-box delivery available: check colour and design before you pay. Choose it at checkout (Cash on Delivery).', hi: 'ओपन-बॉक्स डिलीवरी उपलब्ध: पैसे देने से पहले रंग और डिज़ाइन जाँचें। चेकआउट पर चुनें (कैश ऑन डिलीवरी)।' },
  openBoxOpt: { en: 'Open-box delivery', hi: 'ओपन-बॉक्स डिलीवरी' },
  openBoxOptSub: { en: 'Check colour, design and size label at the door before you pay. No trying on. Takes about 2 minutes.', hi: 'दरवाज़े पर पैसे देने से पहले रंग, डिज़ाइन और साइज़ लेबल जाँचें। पहनकर नहीं देख सकते। लगभग 2 मिनट।' },
  openBoxShort: { en: 'Open-box', hi: 'ओपन-बॉक्स' },

  // C2-F1 map pin
  pinTitle: { en: 'Help the rider find your door', hi: 'राइडर को आपका दरवाज़ा ढूँढने में मदद करें' },
  pinSub: { en: 'Drag the pin to your exact door or gate.', hi: 'पिन को अपने दरवाज़े या गेट पर खिसकाएँ।' },
  useLocation: { en: 'Use my current location', hi: 'मेरी मौजूदा लोकेशन' },
  yourDigipin: { en: 'Your DIGIPIN', hi: 'आपका DIGIPIN' },
  pinOutside: { en: 'This pin is outside {pincode}. Check the pincode or move the pin.', hi: 'यह पिन {pincode} से बाहर है। पिनकोड जाँचें या पिन खिसकाएँ।' },
  confirmPin: { en: 'Confirm pin', hi: 'पिन पक्का करें' },
  skipForNow: { en: 'Skip for now', hi: 'अभी छोड़ें' },
  notHereLink: { en: 'Not at this address? Send a link to pin it', hi: 'इस पते पर नहीं हैं? पिन करने का लिंक भेजें' },
  remoteQueued: { en: 'We’ll send a pin link to your Messages when you save.', hi: 'सेव करने पर हम आपके मैसेज में पिन लिंक भेजेंगे।' },
  directionsLabel: { en: 'Directions for the rider', hi: 'राइडर के लिए रास्ता' },
  mapFallback: { en: 'Map couldn’t load. You can skip this step; the rider will use your address text.', hi: 'नक्शा लोड नहीं हुआ। आप यह स्टेप छोड़ सकते हैं।' },

  // C1-F2 home check
  hcTitle: { en: 'Your parcel has reached your local delivery hub and will arrive {when}. Will you be home?', hi: 'आपका पार्सल आपके नज़दीकी डिलीवरी हब पहुँच गया है और {when} को आएगा। क्या आप घर पर होंगे?' },
  hcMessage: { en: 'Your Meesho order of {items} has reached your local delivery hub and will arrive {when}. Will you be home?', hi: 'आपका मीशो ऑर्डर ({items}) नज़दीकी डिलीवरी हब पहुँच गया है और {when} को आएगा। क्या आप घर पर होंगे?' },
  hcCash: { en: 'Amount {amount}. Keep cash ready, or pay now by UPI and skip the wait.', hi: 'राशि {amount}। नकद तैयार रखें, या अभी UPI से भुगतान करें।' },
  hcYes: { en: 'Yes, I’ll be there', hi: 'हाँ, मैं रहूँगा/रहूँगी' },
  hcChange: { en: 'Change day/time', hi: 'दिन/समय बदलें' },
  hcDirections: { en: 'Add directions', hi: 'रास्ता बताएं' },
  hcPayNow: { en: 'Pay now', hi: 'अभी भुगतान करें' },
  hcConfirmed: { en: 'Thanks! We’ll deliver {when}.', hi: 'धन्यवाद! हम {when} को डिलीवर करेंगे।' },
  hcRescheduled: { en: 'Rescheduled to {when}. We’ll keep your parcel safe till then.', hi: '{when} के लिए बदल दिया गया। तब तक पार्सल हमारे पास सुरक्षित है।' },
  hcDirectionsSaved: { en: 'Thanks, we’ve shared your directions with the rider.', hi: 'धन्यवाद, आपका बताया रास्ता राइडर को भेज दिया गया है।' },
  pickDay: { en: 'Pick a day you’ll be home', hi: 'वह दिन चुनें जब आप घर पर हों' },
  pickTime: { en: 'Pick a time', hi: 'समय चुनें' },
  confirmNewTime: { en: 'Confirm new time', hi: 'नया समय पक्का करें' },
  dirPlaceholder: { en: 'e.g. Blue gate, 2nd floor, shop next to the ration store', hi: 'जैसे: नीला गेट, दूसरी मंज़िल, राशन की दुकान के बगल में' },
  dirSave: { en: 'Save directions', hi: 'सेव करें' },
  paidNow: { en: 'Paid {amount} by UPI. Nothing to pay at delivery.', hi: 'UPI से {amount} का भुगतान हुआ। डिलीवरी पर कुछ नहीं देना।' },

  // C1-F5 delay
  delayMessage: { en: 'Your order of {items} may arrive late, on {newDate} instead of {oldDate}. Sorry about this.', hi: 'आपका ऑर्डर ({items}) देर से, {oldDate} की जगह {newDate} को आ सकता है। इसके लिए माफ़ी।' },
  refundLine: { en: '{amount} will be refunded to your UPI in 2–3 days.', hi: '{amount} 2–3 दिन में आपके UPI में वापस आ जाएगा।' },
  delayTitle: { en: 'Your order may arrive late', hi: 'आपका ऑर्डर देर से आ सकता है' },
  delayOk: { en: 'Okay, {day} is fine', hi: 'ठीक है, {day} चलेगा' },
  delayPick: { en: 'Pick another time', hi: 'दूसरा समय चुनें' },
  delayCancel: { en: 'Cancel for free', hi: 'मुफ़्त में रद्द करें' },
  delayCancelConfirm: { en: 'Cancel this order for free? You won’t be charged anything.', hi: 'यह ऑर्डर मुफ़्त में रद्द करें? आपसे कोई शुल्क नहीं लिया जाएगा।' },
  delayCancelled: { en: 'Order cancelled. Nothing to pay.', hi: 'ऑर्डर रद्द हो गया। कुछ नहीं देना है।' },
  keepOrder: { en: 'Keep order', hi: 'ऑर्डर रखें' },
  plannedTitle: { en: '{rider} from Meesho Delivery will bring your parcel {when}', hi: 'मीशो डिलीवरी से {rider} आपका पार्सल {when} को लाएँगे' },
  plannedSub: { en: 'You’ll get live tracking once the rider starts the route.', hi: 'राइडर के निकलते ही आप लाइव ट्रैक कर सकेंगे।' },

  // C1-F3 tracking / C1-F4 masked contact / C2-F4 attempts
  ofdPush: { en: 'Your Meesho order is out for delivery today.', hi: 'आपका मीशो ऑर्डर आज डिलीवरी के लिए निकल गया है।' },
  arrivingMsg: { en: '{rider} is 10 min away with your Meesho order of {items}.', hi: '{rider} आपके मीशो ऑर्डर ({items}) के साथ 10 मिनट दूर हैं।' },
  trackTitle: { en: 'Out for delivery. Arriving between {a} and {b}.', hi: 'डिलीवरी के लिए निकला। {a} से {b} के बीच पहुँचेगा।' },
  trackSoon: { en: 'About 10 minutes away', hi: 'लगभग 10 मिनट दूर' },
  trackNext: { en: 'The rider is heading to you now', hi: 'राइडर अभी आपकी ओर आ रहा है' },
  trackStop: { en: 'You’re stop {k} of {n}', hi: 'आप {n} में से {k}वें स्टॉप हैं' },
  trackUpdated: { en: 'Updated just now', hi: 'अभी अपडेट हुआ' },
  callRider: { en: 'Call rider', hi: 'राइडर को कॉल करें' },
  messageRider: { en: 'Message rider', hi: 'राइडर को संदेश' },
  notHome: { en: 'I’m not home', hi: 'मैं घर पर नहीं हूँ' },
  notHomeTitle: { en: 'Not home? Pick a new time', hi: 'घर पर नहीं? नया समय चुनें' },
  notHomeSub: { en: 'The rider will skip your stop. This won’t count as a failed delivery.', hi: 'राइडर आपका स्टॉप छोड़ देगा। इसे असफल डिलीवरी नहीं माना जाएगा।' },
  callingTitle: { en: 'Calling via Meesho Delivery', hi: 'मीशो डिलीवरी से कॉल हो रही है' },
  callingSub: { en: 'Your number stays private.', hi: 'आपका नंबर निजी रहता है।' },
  endCall: { en: 'End call', hi: 'कॉल खत्म करें' },
  quick1: { en: 'Leave at shop next door', hi: 'बगल की दुकान पर छोड़ दें' },
  quick2: { en: 'Come after 10 min', hi: '10 मिनट बाद आएँ' },
  quick3: { en: 'Call me at the gate', hi: 'गेट पर पहुँचकर कॉल करें' },
  msgPlaceholder: { en: 'Type a message for the rider…', hi: 'राइडर के लिए संदेश लिखें…' },
  doorMsg: { en: 'Your Meesho rider is at your door.', hi: 'आपका मीशो राइडर आपके दरवाज़े पर है।' },
  deliveredPush: { en: 'Delivered! Thanks for shopping with Meesho.', hi: 'डिलीवर हो गया! मीशो से खरीदारी के लिए धन्यवाद।' },
  attemptMsg: { en: 'Our rider tried to deliver at {time}. Were you there?', hi: 'हमारे राइडर ने {time} बजे डिलीवरी की कोशिश की। क्या आप वहाँ थे?' },
  attemptHere: { en: 'I was here, no one came', hi: 'मैं यहीं था/थी, कोई नहीं आया' },
  attemptMissed: { en: 'Yes, I missed it', hi: 'हाँ, मुझसे छूट गया' },
  attemptHereDone: { en: 'Sorry about that. We’ve raised it with the hub and will deliver tomorrow.', hi: 'माफ़ी चाहते हैं। हमने हब को बता दिया है और कल डिलीवर करेंगे।' },

  // C2-F3 open-box outcome
  refusedPush: { en: 'You returned your order at the door ({reason}). Nothing to pay. Would you like the correct item, or should we close this order?', hi: 'आपने दरवाज़े पर ऑर्डर लौटा दिया ({reason})। कुछ नहीं देना है। क्या आपको सही आइटम चाहिए, या यह ऑर्डर बंद कर दें?' },
  refusedPartPush: { en: 'You kept {kept} and returned {returned} at the door ({reason}). You paid only for what you kept. Would you like the correct item, or should we close the returned part?', hi: 'आपने {kept} रख लिया और {returned} दरवाज़े पर लौटा दिया ({reason})। आपने सिर्फ़ रखे गए सामान का भुगतान किया। क्या आपको सही आइटम चाहिए, या लौटाए गए हिस्से को बंद कर दें?' },
  returnedPartTitle: { en: 'Part of this parcel was returned at the door', hi: 'इस पार्सल का कुछ हिस्सा दरवाज़े पर लौटाया गया' },
  getCorrectItem: { en: 'Get the correct item', hi: 'सही आइटम मँगाएँ' },
  orderAgain: { en: 'Order again', hi: 'फिर से ऑर्डर करें' },
  closeOrder: { en: 'Close order', hi: 'ऑर्डर बंद करें' },
  replaceTitle: { en: 'Get the correct item', hi: 'सही आइटम मँगाएँ' },
  replaceSub: { en: 'Same price, same address. Cash on Delivery with open-box again, so you can check it before paying.', hi: 'वही कीमत, वही पता। कैश ऑन डिलीवरी और फिर से ओपन-बॉक्स, ताकि पैसे देने से पहले जाँच सकें।' },
  replaceBtn: { en: 'Place replacement order', hi: 'बदले का ऑर्डर करें' },
  replacedLine: { en: 'Replacement ordered', hi: 'बदले का ऑर्डर हो गया' },
  closedLine: { en: 'Order closed. Nothing to pay.', hi: 'ऑर्डर बंद। कुछ नहीं देना है।' },
  replacementFor: { en: 'Replacement for order #{id}', hi: 'ऑर्डर #{id} के बदले में' },
  refusedTitle: { en: 'Returned after inspection', hi: 'जाँच के बाद लौटाया गया' },
  refusedSub: { en: 'You checked it at the door and returned it: {reason}. Nothing to pay.', hi: 'आपने दरवाज़े पर जाँचकर लौटाया: {reason}। कुछ नहीं देना है।' },
  rtoTitle: { en: 'Returned to the seller', hi: 'विक्रेता को लौटा दिया गया' },
  rtoSub: { en: 'We couldn’t deliver after several tries. Nothing to pay.', hi: 'कई कोशिशों के बाद भी डिलीवरी नहीं हो सकी। कुछ नहीं देना है।' },

  shareLocTitle: { en: 'Share exact location', hi: 'सटीक लोकेशन भेजें' },
  shareLocAsk: { en: 'Allow Meesho to use your current location for this delivery? Only use it when you are at this address.', hi: 'इस डिलीवरी के लिए मीशो को आपकी मौजूदा लोकेशन इस्तेमाल करने दें? इसे तभी इस्तेमाल करें जब आप इसी पते पर हों।' },
  shareLocAllow: { en: 'Allow', hi: 'अनुमति दें' },
  shareLocDeny: { en: 'Not now', hi: 'अभी नहीं' },
  shareLocDone: { en: 'Location saved · DIGIPIN {digipin}', hi: 'लोकेशन सेव हुई · DIGIPIN {digipin}' },
  shareLocNudge: { en: 'Your address is approximate. Share your exact location so the rider finds your door.', hi: 'आपका पता अनुमानित है। सटीक लोकेशन भेजें ताकि राइडर आपका दरवाज़ा ढूँढ सके।' },
  shareLocBtn: { en: 'Share location', hi: 'लोकेशन भेजें' },

  confirmMsg: { en: 'Confirm your order: {item} for {amount}, Cash on Delivery, arriving {when}. Tap Confirm and we’ll ship it.', hi: 'अपना ऑर्डर पक्का करें: {item}, {amount}, कैश ऑन डिलीवरी, {when} को पहुँचेगा। पक्का करें दबाएँ, हम भेज देंगे।' },
  confirmMsgMulti: { en: 'Confirm your order: {n} items for {amount} in total, Cash on Delivery, arriving {when}.\n{list}\nTap Confirm and we’ll ship them. You can also keep some and cancel the rest.', hi: 'अपना ऑर्डर पक्का करें: {n} आइटम, कुल {amount}, कैश ऑन डिलीवरी, {when} को पहुँचेंगे।\n{list}\nपक्का करें दबाएँ, हम भेज देंगे। आप कुछ आइटम रख सकते हैं और बाकी रद्द कर सकते हैं।' },
  confirmAllBtn: { en: 'Confirm all', hi: 'सब पक्का करें' },
  cancelAllBtn: { en: 'Cancel all', hi: 'सब रद्द करें' },
  chooseItemsBtn: { en: 'Keep some, cancel some', hi: 'कुछ रखें, कुछ रद्द करें' },
  choiceDone: { en: 'Keeping {kept}. Cancelled {cancelled}. Nothing to pay for cancelled items.', hi: '{kept} रख रहे हैं। {cancelled} रद्द। रद्द आइटम के लिए कुछ नहीं देना है।' },
  ivrScriptConfirmMulti: { en: 'Namaste {name}! This is Meesho. You ordered {n} items for {amount} in total, Cash on Delivery, arriving {when}: {list}. Press 1 to confirm all. Press 2 to cancel all. Press 3 to choose item by item.', hi: 'नमस्ते {name}! मीशो से बात हो रही है। आपने {n} आइटम कुल {amount} में ऑर्डर किए हैं, कैश ऑन डिलीवरी, {when} को पहुँचेंगे: {list}। सब पक्का करने के लिए 1 दबाएँ। सब रद्द करने के लिए 2 दबाएँ। एक-एक करके चुनने के लिए 3 दबाएँ।' },
  ivrItemPrompt: { en: 'Item {i} of {n}: {item} for {amount}. Press 1 to keep it. Press 2 to cancel it.', hi: 'आइटम {i} / {n}: {item}, {amount}। रखने के लिए 1 दबाएँ। रद्द करने के लिए 2 दबाएँ।' },
  ivrItemPromptQty: { en: 'Item {i} of {n}: {item}, {qty} pieces for {amount}. Press 1 to keep all {qty}. Press 2 to cancel all {qty}. Press 3 to keep only some.', hi: 'आइटम {i} / {n}: {item}, {qty} पीस, {amount}। सभी {qty} रखने के लिए 1 दबाएँ। सभी {qty} रद्द करने के लिए 2 दबाएँ। कुछ ही रखने के लिए 3 दबाएँ।' },
  ivrQtyPrompt: { en: 'How many of the {qty} do you want to keep? Press a number from 1 to {max}.', hi: '{qty} में से कितने रखना चाहते हैं? 1 से {max} तक कोई नंबर दबाएँ।' },
  ivrAllConfirmed: { en: 'Thank you! All {n} items are confirmed.', hi: 'धन्यवाद! सभी {n} आइटम पक्के हो गए।' },
  ivrAllCancelled: { en: 'All {n} items have been cancelled. Nothing to pay.', hi: 'सभी {n} आइटम रद्द हो गए। कुछ नहीं देना है।' },
  confirmPlacedMulti: { en: 'Your items come from {n} sellers, so they ship as {n} parcels and arrive together on the same day. We’ll ask you to confirm them once on WhatsApp; if we can’t reach you, Meesho will call once in ~10 min.', hi: 'आपके आइटम {n} विक्रेताओं से हैं, इसलिए {n} पार्सल में आएँगे और एक ही दिन साथ पहुँचेंगे। हम WhatsApp पर एक बार पुष्टि माँगेंगे; संपर्क न होने पर मीशो ~10 मिनट में एक बार कॉल करेगा।' },
  confirmPlacedSplit: { en: 'Your items come from {n} sellers and arrive on different days, as you chose: {dates}. We’ll ask you to confirm them once on WhatsApp; if we can’t reach you, Meesho will call once in ~10 min.', hi: 'आपके आइटम {n} विक्रेताओं से हैं और आपकी पसंद के अनुसार अलग-अलग दिन आएँगे: {dates}। हम WhatsApp पर एक बार पुष्टि माँगेंगे; संपर्क न होने पर मीशो ~10 मिनट में एक बार कॉल करेगा।' },
  confirmPlaced: { en: 'We’ll confirm on WhatsApp; if we can’t reach you, Meesho will call in ~10 min.', hi: 'हम WhatsApp पर पुष्टि करेंगे; अगर संपर्क नहीं हुआ तो मीशो ~10 मिनट में कॉल करेगा।' },
  neverReachedHigh: { en: 'We couldn’t reach you to confirm your order ({ids}). Pay by UPI to ship now, or cancel at no cost.', hi: 'आपके ऑर्डर ({ids}) की पुष्टि के लिए हम आपसे संपर्क नहीं कर सके। अभी भेजने के लिए UPI से भुगतान करें, या मुफ़्त में रद्द करें।' },
  payUpiShip: { en: 'Pay by UPI to ship now', hi: 'अभी भेजने के लिए UPI से भुगतान करें' },
  cancelledReorder: { en: 'Your order ({ids}) was cancelled before dispatch because we couldn’t reach you. Nothing to pay. Want it again?', hi: 'संपर्क न हो पाने के कारण आपका ऑर्डर ({ids}) भेजने से पहले रद्द कर दिया गया। कुछ नहीं देना है। फिर से चाहिए?' },
  reorderBtn: { en: 'Reorder in one tap', hi: 'एक टैप में फिर से ऑर्डर करें' },
  ivrScriptConfirm: { en: 'Namaste {name}! This is Meesho. You ordered {item} for {amount}, Cash on Delivery, arriving {when}. Press 1 to confirm your order. Press 2 to cancel it.', hi: 'नमस्ते {name}! मीशो से बात हो रही है। आपने {item} {amount} में ऑर्डर किया है, कैश ऑन डिलीवरी, {when} को पहुँचेगा। ऑर्डर पक्का करने के लिए 1 दबाएँ। रद्द करने के लिए 2 दबाएँ।' },
  ivrScriptVaani: { en: 'Namaste! Your Meesho parcel will arrive {when}. Press 1 if you’ll be home, press 2 to change the day.', hi: 'नमस्ते! आपका मीशो पार्सल {when} को आएगा। घर पर हों तो 1 दबाएँ, दिन बदलने के लिए 2 दबाएँ।' },
  vaaniCaller: { en: 'Meesho voice call (Vaani)', hi: 'मीशो वॉइस कॉल (वाणी)' },

  redirectNudge: { en: 'Still in its original sealed pack, checked at your local hub – delivered tomorrow. {item} · {price} · sold by {seller}. First to pay gets it.', hi: 'मूल सील बंद पैक में, आपके नज़दीकी हब पर जाँचा गया – कल डिलीवरी। {item} · {price} · विक्रेता {seller}। जो पहले भुगतान करेगा, उसे मिलेगा।' },
  redirectBuy: { en: 'Buy now', hi: 'अभी खरीदें' },
  redirectBought: { en: 'You got it! {item} is sealed at your local hub and will be delivered tomorrow.', hi: 'आपको मिल गया! {item} आपके नज़दीकी हब पर सील बंद है और कल डिलीवर होगा।' },
  redirectGone: { en: 'Someone nearby already bought this one.', hi: 'यह किसी और ने पहले ही खरीद लिया।' },
  readyNear: { en: 'Ready near you, delivered tomorrow', hi: 'आपके पास तैयार, कल डिलीवरी' },

  // IVR order confirmation
  ivrCaller: { en: 'Meesho · Order confirmation', hi: 'मीशो · ऑर्डर पुष्टि' },
  ivrIncoming: { en: 'Incoming call…', hi: 'इनकमिंग कॉल…' },
  ivrAnswer: { en: 'Answer', hi: 'उठाएँ' },
  ivrDecline: { en: 'Decline', hi: 'काटें' },
  ivrGreeting: { en: 'Namaste {name}! This is Meesho. You ordered {item} for {amount}, {pay}, arriving {when}.', hi: 'नमस्ते {name}! मीशो से बात हो रही है। आपने {item} {amount} में ऑर्डर किया है, {pay}, {when} को पहुँचेगा।' },
  ivrMenu1: { en: 'Press 1 to confirm your order.', hi: 'ऑर्डर पक्का करने के लिए 1 दबाएँ।' },
  ivrMenu2: { en: 'Press 2 to cancel it.', hi: 'रद्द करने के लिए 2 दबाएँ।' },
  ivrMenu3: { en: 'Press 3 to share your exact location so the rider finds your door.', hi: 'सटीक लोकेशन भेजने के लिए 3 दबाएँ, ताकि राइडर आपका दरवाज़ा ढूँढ सके।' },
  ivrCancelAsk: { en: 'Are you sure you want to cancel? Press 1 to cancel the order, press 9 to go back.', hi: 'क्या आप सच में रद्द करना चाहते हैं? रद्द करने के लिए 1, वापस जाने के लिए 9 दबाएँ।' },
  ivrConfirmed: { en: 'Thank you! Your order is confirmed.', hi: 'धन्यवाद! आपका ऑर्डर पक्का हो गया।' },
  ivrCancelled: { en: 'Your order has been cancelled. Nothing to pay.', hi: 'आपका ऑर्डर रद्द हो गया। कुछ नहीं देना है।' },
  ivrLocationSaved: { en: 'Got it. We’ve saved your exact location, DIGIPIN {digipin}.', hi: 'मिल गया। आपकी सटीक लोकेशन सेव हो गई, DIGIPIN {digipin}।' },
  ivrMissedText: { en: 'Missed call from Meesho to confirm order #{id}. You can confirm or cancel here.', hi: 'ऑर्डर #{id} की पुष्टि के लिए मीशो से मिस्ड कॉल। आप यहाँ पक्का या रद्द कर सकते हैं।' },
  ivrConfirmBtn: { en: 'Confirm order', hi: 'ऑर्डर पक्का करें' },
  ivrCancelBtn: { en: 'Cancel order', hi: 'ऑर्डर रद्द करें' },

  // Vaani voice
  vaaniTranscript: { en: 'Meesho voice call (Vaani): “Namaste! Your Meesho parcel will arrive {when}. Press 1 if you’ll be home, press 2 to change the day.”', hi: 'मीशो वॉइस कॉल (वाणी): “नमस्ते! आपका मीशो पार्सल {when} को आएगा। घर पर हों तो 1 दबाएं, दिन बदलने के लिए 2 दबाएं।”' },
  vaaniPress1: { en: '1 · I’ll be home', hi: '1 · मैं घर पर रहूँगा/रहूँगी' },
  vaaniPress2: { en: '2 · Change day', hi: '2 · दिन बदलें' },
} satisfies Record<string, { en: string; hi: string }>;

export type StringKey = keyof typeof STRINGS;

export function t(key: StringKey, lang: 'en' | 'hi', vars: Record<string, string | number> = {}): string {
  let s: string = STRINGS[key][lang];
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v)); // every occurrence, e.g. "{n} sellers … {n} parcels"
  return s;
}

export function useT() {
  const lang = useStore((s) => s.lang);
  return (key: StringKey, vars?: Record<string, string | number>) => t(key, lang, vars);
}

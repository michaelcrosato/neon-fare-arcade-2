import type { FareId } from "./model";

/** Authored voices follow the portraits; each trio ranges from engaged to politely done. */
export const PASSENGER_QUANTUM_RESPONSES: Readonly<Record<FareId, readonly [string, string, string]>> = {
  // RICO — competitive, racing jacket; JUNO — punk skeptic; MAX — practical construction worker.
  rico: [
    "Okay, that is cool. Can I understand it faster than the guy in the other taxi?",
    "I was going to brag about my lap time. You have made that feel very small.",
    "Got it. The universe is complicated. Your next turn is not.",
  ],
  juno: [
    "Finally, something weirder than the opening act at my last gig.",
    "I respect a universe that refuses to explain itself to management.",
    "Cool. I am putting my headphones back on, but in an intellectually enriched way.",
  ],
  max: [
    "That is genuinely interesting. Who do I call when it breaks?",
    "I work construction. If you need a second person to stare at the problem, I am qualified.",
    "All right. Just tell me if any of that needs a permit.",
  ],
  // NOVA — DJ; BEA — exuberant host; DEX — grease-stained mechanic.
  nova: [
    "Say that again slowly. I want to sample it before the bass drops.",
    "I have played sets to six people. This is still the more niche audience.",
    "Wild. Can the next lesson have a chorus? I need somewhere to come back in.",
  ],
  bea: [
    "Oh, I am bringing this up at dinner. Nobody is leaving until we understand it.",
    "You explain it with such confidence. I do the same thing with recipes I have never tried.",
    "Lovely, sweetheart. I will nod once more and then we are discussing the weather.",
  ],
  dex: [
    "Huh. I would actually read the service manual for the universe.",
    "Nice theory. Has anyone checked whether reality just needs a new ground wire?",
    "Okay… but that noise is still your clutch. I want that on the record.",
  ],
  // KAI — eager courier; LUX — exacting stylist; MIRA — thoughtful puzzle enthusiast.
  kai: [
    "I love this. Usually the only thing I learn in traffic is a new shortcut that is closed.",
    "Let me put that in my delivery notes. The customer did ask for detailed instructions.",
    "Great. I am still marking this parcel fragile. Especially after that conversation.",
  ],
  lux: [
    "Surprisingly elegant. I had expected less from a lecture next to this upholstery.",
    "I understand the concept. I am deciding whether it goes with anything I own.",
    "Fascinating. Now could we focus on the lighting at my dropoff?",
  ],
  mira: [
    "Wait. Give me a second. I think I just found the edge pieces of that idea.",
    "This is better than my puzzle app. Considerably worse for my confidence, though.",
    "I will work on that quietly. Please do not offer a hint until I look desperate.",
  ],
  // ZED — encouraging coach; IVY — plant enthusiast; OMAR — polished negotiator.
  zed: [
    "Excellent. That felt like a heavy set for the brain. Do we rest now?",
    "I coach people through hard things. Apparently I also need someone counting down the last three sentences.",
    "Good session. I am going to hydrate and pretend I followed all of it.",
  ],
  ivy: [
    "Now I want to learn more. My plants are about to receive a deeply unnecessary lecture.",
    "I am impressed, but I also get excited when a leaf uncurls. Manage your expectations.",
    "Okay. Does the universe have any advice for a fern that is being difficult?",
  ],
  omar: [
    "Compelling. If you ever pitch the universe, I would like a seat in that meeting.",
    "You have my attention. My understanding is still reviewing the terms.",
    "Let us circle back to this after you circle around that block.",
  ],
  // SAGE — contemplative mischief; TEO — repair-shop pragmatist; NYX — nightlife tastemaker.
  sage: [
    "That gives me something new to contemplate while pretending to meditate.",
    "I was trying to clear my mind. You have furnished it with a laboratory.",
    "Thank you. I am going to sit with that, largely because I am already sitting.",
  ],
  teo: [
    "I like learning how things work. I dislike discovering how many more things there are.",
    "If reality comes apart, keep the screws in a cup. That is my contribution.",
    "Right. Before we tackle the universe, can we tackle your glove-box latch?",
  ],
  nyx: [
    "This is much better conversation than the people in the VIP section are having.",
    "I would put that on the guest list. Under what name does quantum physics travel?",
    "Mm. Fascinating. Can we arrive before my enthusiasm leaves the venue?",
  ],
  // ROX — veteran biker; LEV — earnest academic; ADA — enthusiastic debugger.
  rox: [
    "I have heard some strange things at roadside bars. That one had actual structure.",
    "I came dressed for a motorcycle ride and somehow enrolled in night school.",
    "Fair enough. I am sticking with engines. They usually announce the problem loudly.",
  ],
  lev: [
    "Oh, excellent. Could you repeat the middle part? I want to be confused accurately.",
    "I wore the serious glasses today. It would be a shame to waste them on understanding nothing.",
    "I will read up on that. Preferably somewhere the lecturer is not also changing lanes.",
  ],
  ada: [
    "That is brilliant. I want to know what the error messages look like.",
    "I spend all day debugging. It is comforting that reality also needs documentation.",
    "Okay. I am filing that under fascinating behavior I will not be fixing tonight.",
  ],
  // FINN — cheerful rookie; SORA — observant photographer; PAX — overprepared adventurer.
  finn: [
    "I understood the first bit! I would like everyone to remember that part.",
    "This is great. I am learning words I cannot yet responsibly use.",
    "Okay, thanks. Can we stop adding things to the list of stuff I should know?",
  ],
  sora: [
    "I like that. Now I want a photograph that somehow explains it. An easy afternoon, surely.",
    "Usually I ask people to look natural. Apparently nature itself is not cooperating.",
    "Interesting. Hold that thought while I hold absolutely still for this shot.",
  ],
  pax: [
    "Amazing. Is there a beginner's guide small enough to fit in this backpack?",
    "I packed for rain, hunger, and a flat tire. Somehow I missed surprise physics.",
    "Okay. Next time I am bringing a notebook. And a smaller sense of certainty.",
  ],
  // RAE — community organizer; EZRA — self-aware writer; UMA — patient storyteller.
  rae: [
    "Come explain that at the community night. We badly need a topic that is not parking.",
    "I could get twelve people interested in that. Getting twelve people to agree on a date is harder.",
    "Wonderful. Please put the rest in an email I can feel guilty about not reading.",
  ],
  ezra: [
    "That would make an incredible story. I will need several chapters to admit I do not understand it.",
    "I write fiction, so I appreciate that you have brought evidence to a very strange premise.",
    "Right. I am calling this ride research. That should make the receipt feel better.",
  ],
  uma: [
    "I like hearing something new. Most people just tell me the same story with a different neighbour.",
    "You have reminded me of a story. Settle in. Oh, you already have a seat belt on.",
    "Very interesting, dear. You may now enjoy three minutes of earned silence.",
  ],
  // AXL — skatepark optimist; LENA — off-duty paramedic; MARCO — exacting chef.
  axl: [
    "That is sick. I understood enough to say that with real conviction.",
    "I was going to talk about a trick I landed. Yours sounds like it needs a grant.",
    "Cool. I will think about it at the skatepark, briefly, before gravity reminds me of itself.",
  ],
  lena: [
    "I appreciate a lesson where nobody expects me to take their blood pressure afterward.",
    "Good explanation. I am off duty, so my follow-up question is whether we are nearly there.",
    "Okay, thanks. I have used all my urgent thinking for today. This will have to be elective.",
  ],
  marco: [
    "Beautiful. I enjoy discovering a process even fussier than pastry.",
    "You have explained the ingredients. I am still waiting for the part where I know what to do with them.",
    "Very good. Does the rest of the lecture come with a side dish?",
  ],
  // TESS — gig-going music fan; BO — composed legal mind; NIA — old-school punk.
  tess: [
    "I would absolutely buy that band's first album. Probably misunderstand the lyrics, too.",
    "This ride has a strong spoken-word opening. When does the drummer arrive?",
    "Okay… I came for transport and got the concept album.",
  ],
  bo: [
    "A fascinating explanation. I especially like that you defined your terms before making the wild claim.",
    "I have follow-up questions. Professionally, that is the most affection I can show an idea.",
    "Thank you. I reserve the right to understand this at a later date.",
  ],
  nia: [
    "Now that is strange enough to wake me up. I was getting bored with ordinary rebellion.",
    "I have owned less confusing album sleeves, and one was just a photograph of a drain.",
    "Fine. The universe gets an encore. You get one more traffic light.",
  ],
  // CAL — gym regular; ZARA — tattoo artist; REN — curious student.
  cal: [
    "I like this. My brain usually only counts to twelve and argues about protein.",
    "That was a lot to take in. I would have warmed up if you had warned me.",
    "Okay. I am counting that as today's mental workout. No bonus reps.",
  ],
  zara: [
    "That gives me an idea for a tattoo. First I need to know which symbols would embarrass me.",
    "People ask me whether their tattoos mean something. Yours would require a footnote.",
    "Neat. I am sticking to ink today. At least my mistakes stay where I put them.",
  ],
  ren: [
    "This is genuinely useful. My next seminar contribution might finally be a sentence instead of a nod.",
    "Could this count as studying? I need something to tell the library.",
    "Thanks. I had hoped the ride between classes would not also be a class.",
  ],
  // ELI — smooth lounge host; MAYA — trail walker; SOL — cheerful barista.
  eli: [
    "An unexpected topic, but I admire your delivery. You could hold a room with that.",
    "I host jazz nights. Confidently following something complicated is most of the job.",
    "Lovely. Let us leave a little space between the notes now.",
  ],
  maya: [
    "I hike to feel small in the universe. You have saved me quite a climb.",
    "That is a beautiful idea. I will bring it up on the trail when everyone is too tired to interrupt.",
    "All right. I am going to look at a tree until my thoughts have edges again.",
  ],
  sol: [
    "Amazing. I can finally contribute something stranger than our seasonal drink menu.",
    "I follow you, but only at the level where I follow a complicated coffee order without asking why.",
    "Okay. Can you explain the next one after I have had the coffee I keep making for everybody else?",
  ],
  // VERA — retired teacher; JET — impatient sprinter; NOA — minimalist designer.
  vera: [
    "Well explained. I would put a star beside that if I had brought my marking pen.",
    "You kept my attention through a difficult topic. We will discuss the turn signal separately.",
    "Thank you. Class is dismissed when we reach the curb, not when you run out of material.",
  ],
  jet: [
    "Nice. That made my thoughts run faster than my legs, which is mildly insulting.",
    "Could we get a personal best in the short version?",
    "Okay, I am convinced physics is interesting. I remain convinced I am late.",
  ],
  noa: [
    "I love a simple-looking idea with terrifying complexity underneath. That is most of my design work.",
    "Could you put that on one clean diagram? I would like my confusion to have margins.",
    "Understood. Well, visually. I have imagined a very tasteful title slide.",
  ],
  // ARLO — carpenter; KIYO — illustrator; LUZ — relentlessly social planner.
  arlo: [
    "That is interesting. I admire a subject where measuring twice still leaves you with questions.",
    "I build shelves. I enjoy an explanation that makes that feel like a relaxing career choice.",
    "Okay… I am going back to wood. It has the decency to look warped when it is warped.",
  ],
  kiyo: [
    "I want to draw that. The part I understand will be the title.",
    "You have given me a new sketchbook idea and a new reason to stare at a blank page.",
    "Thanks. I will make a tiny confused character in your honour.",
  ],
  luz: [
    "Oh, I am telling everyone. They may get a less accurate but more animated version.",
    "This is the best taxi conversation I have had since someone explained their entire wedding seating plan.",
    "Wonderful. I only have enough social energy left to say wonderful, but I mean it.",
  ],
  // TARIQ — local guide; WREN — experimental poet; DANI — energetic dancer.
  tariq: [
    "I give city tours. Apparently I have been underestimating how far out a detour can go.",
    "I know a story about every street. You appear to know a story about the material the street is made of.",
    "Excellent. Could we return to landmarks visible through a windscreen?",
  ],
  wren: [
    "That is gorgeous. I will write a poem and then ask someone qualified to remove the scientific errors.",
    "You have found a new way to make me stare thoughtfully out of a taxi window. My main occupation.",
    "Mm. I am going to let that remain a metaphor until I get home.",
  ],
  dani: [
    "I love this. I have no idea how to choreograph it, which usually means it is worth trying.",
    "I can follow complicated steps. Apparently only when somebody counts me in.",
    "Okay, thanks. My feet understand the journey. I will let my head catch up later.",
  ],
  // INDY — optimistic intern; YARA — seasoned traveller; BRAM — gruff road-crew veteran.
  indy: [
    "I am writing that down. At work they call this showing initiative, even when I misspell half of it.",
    "Finally, a briefing where I am allowed to admit I am new.",
    "Great. Is there a quiz? I have already used today's confident guess.",
  ],
  yara: [
    "I collect interesting conversations when I travel. This one is going near the top, above the lost-luggage saga.",
    "I have learned to nod politely in six languages. You have found a seventh situation for it.",
    "Thank you. I will unpack that idea after I unpack this bag.",
  ],
  bram: [
    "Huh. Usually I only listen this closely when a bridge engineer starts looking worried.",
    "I have spent years on the road crew. This is the first detour that happened entirely inside my head.",
    "Right. Radio check: I am still here, and I still want to go home.",
  ],
  // Cedar Vale: ELLIS — ranger; MAE — florist; OTIS — utility veteran.
  ellis: [
    "I lead nature walks. This would be a lovely way to lose the entire group without moving.",
    "Interesting. I usually explain the forest one tree at a time. You went straight for reality.",
    "Thanks. I am going to identify some extremely visible birds now.",
  ],
  mae: [
    "What a lovely thought. I will tell the flowers. They are excellent listeners and dreadful students.",
    "I arrange bouquets for a living. I admire how you have arranged all those words into something almost graspable.",
    "Very nice, dear. I understood enough to smile, and smiling is free.",
  ],
  otis: [
    "After thirty years fixing utilities, it is good to learn about a system I am not on call for.",
    "I hope the universe has labelled its cables better than the last contractor did.",
    "Okay. If reality needs maintenance, tell it to put in a ticket.",
  ],
  // JOSIE — team coach; HANK — hands-on tradesman; PRIYA — meticulous researcher.
  josie: [
    "Good stuff. I love seeing someone this excited without needing a whistle.",
    "I give pep talks. You give talks that make people question the equipment the universe uses.",
    "All right, team. One deep breath and back to the very ordinary destination.",
  ],
  hank: [
    "Now there is something I cannot confidently fix after watching one video.",
    "Sounds complicated. My usual quote would be parts, labour, and a long pause.",
    "Okay… I am keeping my afternoon free of anything smaller than a bolt.",
  ],
  priya: [
    "Interesting. You have just made my reading list longer during the one part of my day without a desk.",
    "I have three questions. Unfortunately, the first one has four parts.",
    "Thank you. I am going to check a source before I enthusiastically repeat that to somebody important.",
  ],
  // GUS — cheerful gardener; NELL — paint-splattered maker; DEAN — professional driver.
  gus: [
    "I could listen to this all day. The weeds are not going anywhere, despite my many requests.",
    "Good to know. I have been calling everything I do not understand a soil problem.",
    "Right. I will let that settle. I do the same with compost and difficult advice.",
  ],
  nell: [
    "I love it. My next painting is going to be a very honest picture of my confusion.",
    "That is interesting, but please do not ask me to mix a colour for it.",
    "Okay. My apron already says I have made enough discoveries today.",
  ],
  dean: [
    "I drive a regular route. It is nice to take a genuinely unfamiliar turn in conversation.",
    "My passengers usually ask whether we stop at the library. Yours get the library delivered.",
    "Thank you. Speaking as a fellow driver, a quiet passenger is also a valuable natural resource.",
  ],
  // ROSA — market gardener; MILO — distracted student; JUNE — calm clinician.
  rosa: [
    "I will take that idea to the market. We could use a topic less divisive than tomato prices.",
    "I grow vegetables, so I am comfortable doing everything correctly and still being surprised.",
    "Lovely. Now I need to return to a bag of potatoes that asks very little of me.",
  ],
  milo: [
    "Wait, this is way more interesting than the thing I am supposed to be revising.",
    "I wish my notes sounded like this. Mine mostly say ask somebody later.",
    "Cool. I am going to remember the joke and feel bad about forgetting the science.",
  ],
  june: [
    "I enjoy being the person asking questions for once. Usually someone starts by showing me a rash.",
    "A very clear explanation. My ability to absorb it is currently running behind clinic schedule.",
    "Thank you. I am prescribing myself the remaining journey in silence.",
  ],
  // CLARK — postal carrier; ESME — estate agent; BENJI — enthusiastic baker.
  clark: [
    "That is fascinating. My round just got a new subject for every doorstep conversation.",
    "I deliver letters. You seem to deliver little envelopes full of existential difficulty.",
    "Received, thanks. No signature required from the part of my brain that understood it, I hope.",
  ],
  esme: [
    "I like it. A lot of depth in a compact space. I could write a listing for that idea.",
    "You have made this car feel bigger on the inside. I am professionally interested.",
    "Very compelling. Could we conclude the viewing at my actual address?",
  ],
  benji: [
    "That is amazing. Tomorrow's special might have a name I cannot explain to customers.",
    "I have flour in my hair and a physics lesson in my head. A surprisingly productive morning.",
    "Okay, thanks. I need to save a little concentration for not burning the next batch.",
  ],
  // ALMA — patient craftsperson; ROWAN — trail enthusiast; FAYE — veterinarian.
  alma: [
    "I like learning complicated things slowly. You should see how long my first scarf took.",
    "I have followed most of that. There is one loose thread, but I will not pull it while you drive.",
    "Lovely explanation. I will understand it properly about halfway through making dinner.",
  ],
  rowan: [
    "That feels like reaching a viewpoint and discovering there is another mountain behind it.",
    "My backpack has a map for every trail. None of them cover wherever this conversation just went.",
    "Okay. I need a snack before the next intellectual elevation gain.",
  ],
  faye: [
    "Fascinating. My patients never ask about physics. They do occasionally eat the paperwork.",
    "I work with animals. I am quite used to something interesting refusing to behave as expected.",
    "Good to know. Please spare me any cat-based examples until my day off.",
  ],
  // SAMIR — practical electrician; GRETA — patient birdwatcher; LEO — excitable learner.
  samir: [
    "I work with electricity. It is nice to hear about the deep theory before someone asks why a socket is loose.",
    "I understood enough to stop pretending wires are the whole story.",
    "All right. Today I am charging by the hour, not by the unanswered question.",
  ],
  greta: [
    "I spend hours waiting to see one rare bird. I appreciate a subject that rewards patience.",
    "That is going in my notebook, somewhere between a warbler and a very doubtful pigeon.",
    "Thank you. I need to save my remaining attention for a small brown thing in a tree.",
  ],
  leo: [
    "Can I tell my class that? I would love to be interesting before lunch for once.",
    "I have learned so much on this ride. Mostly how much bigger the test could have been.",
    "Okay. Please do not tell my teacher taxis can assign homework.",
  ],
  // MABEL — retired editor; AMIR — librarian; DOT — veteran singer with comic timing.
  mabel: [
    "There is a good headline in that. The article will need a considerably calmer subheading.",
    "I used to edit for clarity. I am resisting the urge to ask the universe for a second draft.",
    "Thank you. I have retired, including from any follow-up assignment you were about to suggest.",
  ],
  amir: [
    "I can think of three books you would enjoy. This is how librarians flirt with a subject.",
    "I will find a shelf for that idea. It may need to lean against something simpler.",
    "Excellent. Now, in the spirit of my workplace, a little quiet would be lovely.",
  ],
  dot: [
    "You have good timing, darling. I was about to start telling you about my entire singing career.",
    "I do not know the science, but I know when someone is enjoying the sound of their own voice. Solid performance.",
    "Lovely solo. Shall we give the road a verse now?",
  ],
  // Northstar Range: ASTRID — ski patrol; BECKETT — ranger with binoculars; CASS — snowboarder.
  astrid: [
    "Interesting. I spend my days assessing steep slopes. Apparently this subject has a few.",
    "I am listening, but my rescue training keeps asking whether anyone needs a blanket.",
    "All right. We have reached the limit of what I can process in ski boots.",
  ],
  beckett: [
    "I have watched the same valley for years. Nice to be reminded there is more going on than I can see.",
    "I brought binoculars, but I suspect I have chosen entirely the wrong equipment.",
    "Good talk. I will keep an eye out. At the scale these binoculars can manage.",
  ],
  cass: [
    "That is unreal. In the technical sense, I assume it is very real. I am trying.",
    "I came down the mountain thinking I was clever. Then your Honda humbled me.",
    "Cool. I am returning to a subject I understand: falling over with expensive equipment.",
  ],
  // DEV — mountain maintenance; EIRA — navigator with compass; FORREST — timber worker.
  dev: [
    "I maintain the lifts. I enjoy a complicated system when nobody is dangling from it.",
    "I understand the enthusiasm. I once talked for twenty minutes about a replacement bearing.",
    "Okay. Please tell me there is not a practical exam involving your engine.",
  ],
  eira: [
    "What a satisfying puzzle. I may need a map with rather more dimensions than this one.",
    "My compass is very sure of itself. It is pleasant to have one confident object in the car.",
    "Thank you. For the rest of the trip, I would like north to remain sufficient.",
  ],
  forrest: [
    "I like a big idea. Usually mine involve getting a tree to land somewhere specific.",
    "I understood about as much as fits on the back of a work glove. I have large gloves.",
    "Right. If there is a version you can explain beside a wood stove, save it for winter.",
  ],
  // GABI — bread baker; HUGO — lodge cook; IMANI — wildlife photographer.
  gabi: [
    "I woke up at four to bake. It is nice that something besides the dough is expanding my horizons.",
    "I can follow a difficult recipe. Could this explanation include a point where I add butter?",
    "Lovely. I am going to hug this warm loaf and think about very little.",
  ],
  hugo: [
    "Good explanation. Come tell it in the lodge kitchen. It will distract everyone from asking when soup is ready.",
    "I understood the principle, then I started thinking about stock. Occupational hazard.",
    "Thank you. I cannot put it in a pot, but I respect it.",
  ],
  imani: [
    "I take pictures of things that barely stay still. You have given me a new appreciation of my camera's limits.",
    "That is fascinating. Sadly, fascinating is not a setting on my lens.",
    "Okay. I will just photograph a mountain. They tend to keep appointments.",
  ],
  // JAE — lodge attendant with thermos; KODA — search and rescue; LARK — trail musician.
  jae: [
    "That is a much better break-room topic than whose lunch is leaking.",
    "I am following this at thermos speed. One small sip of understanding at a time.",
    "Thanks. I already have enough keys to keep track of without unlocking reality.",
  ],
  koda: [
    "I appreciate the explanation. Most unexpected calls I get are substantially less educational.",
    "My radio has never delivered news quite like that. Usually it just says someone ignored the sign.",
    "Copy that. I am standing down from the science conversation until further notice.",
  ],
  lark: [
    "That deserves a song. Unfortunately, the chorus would need a glossary.",
    "I have three chords and a worrying amount of confidence. We could make this work.",
    "Nice. I will hum something simple until my brain forgives me.",
  ],
  // MAREN — lodge manager; NIKO — ski enthusiast; OPAL — observant mountain naturalist.
  maren: [
    "Wonderful. The lodge could offer this as an activity for guests who think the mountain is too straightforward.",
    "I manage twenty rooms. You have somehow made that seem like a smaller responsibility.",
    "Thank you. I must now return to the very definite problem of somebody losing room twelve's key.",
  ],
  niko: [
    "I like it. A fresh slope for my brain, with absolutely no indication of difficulty at the top.",
    "I nodded too early. That was the conversational equivalent of committing to the wrong run.",
    "Okay. Next lesson, can we start on the bunny hill?",
  ],
  opal: [
    "Lovely. The world keeps giving me reasons to carry a notebook and forget where I put it.",
    "I went out to study the mountain and apparently enrolled in the smaller details as well.",
    "Thank you. I will ponder that at a pace appropriate for this scarf and this afternoon.",
  ],
  // QUINN — climber; RAVI — mountain guide; SKYE — rope-carrying adventurer.
  quinn: [
    "I enjoy a challenge. Usually I can see where to put my hands, though.",
    "Good explanation. I would still like a safety rope attached to the next paragraph.",
    "Okay, I have reached my intellectual ledge. Let us sit here for a moment.",
  ],
  ravi: [
    "I guide people through difficult terrain. I recognise the look you get when half the group quietly gives up.",
    "I am keeping up. I am also the sort of person who says that two hours into a wrong turn.",
    "Thanks. For our next subject, I nominate the large mountain we can both point at.",
  ],
  skye: [
    "That is exciting. I usually have to climb something terrifying to get this much perspective.",
    "I brought rope. Nobody mentioned I would need it to hold a train of thought together.",
    "Right. I am going to stare at the horizon until it starts looking normal again.",
  ],
  // NASH — outdoors veteran; TOBIN — carpenter with pencil; VAL — lodge baker.
  nash: [
    "I like this. Good campfire material, assuming nobody has somewhere urgent to be mentally.",
    "I have survived enough bad weather to admit when an explanation has gone over my head.",
    "Fair enough. I will take the rest with a hot drink and considerably fewer moving parts.",
  ],
  tobin: [
    "Wait, let me grab the pencil behind my ear. Finally, a job for it that is not measuring a door.",
    "I can build a cabinet from a sketch. Can you sketch this, or will that make both of us unhappy?",
    "All right. My pencil has voted to return to carpentry.",
  ],
  val: [
    "That is fantastic. The morning pastry crowd is about to get more than it ordered.",
    "I have explained sourdough starters to unwilling strangers, so I recognise a fellow professional.",
    "Okay. Could the next topic be something I can dust with sugar?",
  ],
  // WYATT — weathered storyteller; YUKI — precise concierge; ZOLA — keen birdwatcher.
  wyatt: [
    "That is a fine story, and you have the advantage of it being scientifically defensible.",
    "I once held a room with a tale about a lost mule. You have raised the standard considerably.",
    "Well now. I will save my questions for a chair that is not attached to an engine.",
  ],
  yuki: [
    "Excellent. I will add unexpected physics tuition to the list of local amenities.",
    "I can arrange most things for guests. A complete understanding of reality will require advance notice.",
    "Thank you. May we return to the itinerary? It has fewer philosophical complications.",
  ],
  zola: [
    "I love a good discovery. This one did not even require getting mud on my binoculars.",
    "I was watching for birds and you introduced an entirely different kind of field work.",
    "Okay, thanks. If I point excitedly out the window now, it is probably still a bird.",
  ],
  // Copper Mesa: CARMEN — ranch storyteller; DIEGO — jeweller; ESTRELLA — desert ranger.
  carmen: [
    "That is a good one. I normally need a campfire and two hours to get that far from the original subject.",
    "I have heard some unlikely things at the ranch. You are the first person to bring equations.",
    "All right, professor. The hat is off to you. Metaphorically; the sun is still out.",
  ],
  diego: [
    "I work with tiny details all day. It is lovely to discover an entirely more demanding definition of tiny.",
    "Interesting. Customers ask what makes a stone special. I may need to shorten your answer considerably.",
    "Thank you. I will stick to explaining the clasp for the rest of today.",
  ],
  estrella: [
    "I love a good science question. Visitors usually just ask whether the desert closes at night.",
    "You have found a subject with more warning signs than my most difficult trail.",
    "Copy. I would like to return to the part of nature I am authorised to give directions in.",
  ],
  // FELIX — theatrical showman; GLORIA — irreverent mechanic; HECTOR — astronomer with telescope.
  felix: [
    "Terrific material. All it needs is a spotlight and someone to gasp at the correct moment.",
    "You have excellent stage presence for someone whose stage has cup holders.",
    "Bravo. I understood the entrance and the bow. The middle was ambitious.",
  ],
  gloria: [
    "I like this. It is the first time today somebody has described a mystery without handing me their car keys.",
    "I have a wrench and a strong opinion. Neither seems adequate for this repair.",
    "Okay. Can we discuss an easier mystery, like who fitted that exhaust?",
  ],
  hector: [
    "Excellent. I spend all night looking outward. It is good to remember how much there is looking inward.",
    "I brought the telescope, so naturally the conversation went in the other size direction.",
    "Very interesting. I must save a few unanswered questions for the sky or it will feel neglected.",
  ],
  // INEZ — ranch hand; JOEL — road-trip biker; KARINA — diner cook.
  inez: [
    "I am enjoying this. The horses never take an interest when I try to learn something new.",
    "That is a lot to wrangle. I am going to need a smaller intellectual corral.",
    "Right. Please point me toward a problem that responds to a bucket of feed.",
  ],
  joel: [
    "Great story for the next fuel stop. I will lose half the facts, but the confidence will survive.",
    "I came for a lift and got a scenic route through a textbook.",
    "Cool. I am keeping the sunglasses on so you cannot see exactly where you lost me.",
  ],
  karina: [
    "You should explain that at my counter. It might finally stop the debate about the best way to cook an egg.",
    "I handle the breakfast rush. A little organised chaos does not scare me.",
    "Fine by me. I will understand the universe after I have flipped these pancakes.",
  ],
  // LOLA — pilot; MATEO — desert backpacker; NORA — repair-shop supervisor.
  lola: [
    "Fascinating. I appreciate knowing more about physics than the minimum needed to stay airborne.",
    "In a cockpit, I like an instrument panel. This conversation could use one.",
    "Roger. I am requesting clearance to descend back to ordinary small talk.",
  ],
  mateo: [
    "I came to the desert for perspective. You are offering it with considerably more legroom.",
    "I have enough supplies for three days. I did not budget for how hungry learning would make me.",
    "Okay. Let me find the trail mix before we approach another fundamental question.",
  ],
  nora: [
    "Good explanation. I would hire you, but every oil change would come with a seminar.",
    "I have heard a lot of theories from people leaning over engines. Yours appears to have been checked.",
    "Thank you. My brain is now closed for scheduled maintenance.",
  ],
  // PALOMA — potter; RAFA — solar technician; SELENA — desert botanist.
  paloma: [
    "That is beautiful. I love discovering another field where intuition needs supervision.",
    "I make pottery. If I look thoughtful, I might be understanding you or remembering something in the kiln.",
    "Okay… I would prefer the rest of today's mysteries to be glaze-related.",
  ],
  rafa: [
    "I work with solar panels. You have successfully made sunlight feel even more overqualified.",
    "I brought a whole panel and somehow still do not feel equipped for this lesson.",
    "Good stuff. For now, I am satisfied if it helps keep the lights on.",
  ],
  selena: [
    "I study desert plants. I enjoy a universe where the details keep getting stranger the closer you look.",
    "This little plant has survived drought, heat, and now your entire lecture. A remarkable specimen.",
    "Thank you. I promised it some shade, not a postgraduate education.",
  ],
  // TOMAS — guitar storyteller; VIVI — enthusiastic scientist; XAVI — polished art curator.
  tomas: [
    "That would make a great ballad if I could find anything that rhymes with the important words.",
    "You take the verses. I will play something reassuring under the difficult bits.",
    "Lovely. We should end while the audience still remembers how the song began.",
  ],
  vivi: [
    "Oh, good. A driver who enjoys this stuff. I was about to become the problem passenger with the follow-up questions.",
    "I have a pen for this. Actually, six pens. My pockets are more prepared than my calendar.",
    "Excellent. I am saving my objections for when we have a whiteboard and no traffic.",
  ],
  xavi: [
    "I could build an exhibition around that. Half the visitors would pretend to understand it. An established format.",
    "The concept is strong. The presentation is unusually upholstered.",
    "Thank you. I will absorb the rest with the expression I use at artist statements.",
  ],
  // BROOKE — landscape photographer; COLE — jewellery collector; EMMY — desert medic.
  brooke: [
    "I chase good light all day. Nice to learn it has a much more interesting biography than I do.",
    "I can frame a canyon. I am less sure where to crop that explanation.",
    "Right. My camera and I are taking a short break from big ideas.",
  ],
  cole: [
    "I collect little beautiful things. That idea can join the collection without needing another shelf.",
    "I love an interesting detail. You have handed me enough to accessorise an entire dinner party.",
    "Very nice. I will admire it now and ask what it means later. Works for jewellery, too.",
  ],
  emmy: [
    "I like learning something that does not end with somebody asking me to look at their ankle.",
    "You have my interest. My full attention is still recovering from a very long shift.",
    "Okay, thanks. I would like the next few minutes to be medically and intellectually uneventful.",
  ],
  // JULES — earnest student; MORGAN — hospitable cook; WADE — veteran field guide.
  jules: [
    "This is great. I have finally found a lecture where sitting in the back is compulsory.",
    "I am taking mental notes. They are mostly question marks, but very neatly arranged.",
    "Thanks. I think I have earned the right to look at a cactus for a bit.",
  ],
  morgan: [
    "Come by the kitchen and tell me more. I do my best thinking while someone else chops onions.",
    "I like how excited you are. I get the same way about a sauce that finally behaves.",
    "Lovely. If you want another question from me, it will be whether you have eaten.",
  ],
  wade: [
    "I have spent a lifetime looking closely at things. It is good to know I can keep going.",
    "I can identify a footprint from twenty paces. This may require a different sort of field guide.",
    "All right. You handle the unseen mysteries. I will handle that very obvious wrong turn.",
  ],
  // Palm Reach: ANOUK — wetland guide; ODETTE — elegant socialite; CELESTE — fishmonger.
  anouk: [
    "I guide people through wetlands. I appreciate an ecosystem of ideas with this many places to get lost.",
    "I normally point out wildlife. Today I am the passenger making the surprised noises.",
    "Thanks. I am going to find a heron. A heron is a manageable amount of information.",
  ],
  odette: [
    "Delightful. The last dinner party I attended had six professors and considerably less entertainment.",
    "My fan is doing a great deal of work concealing how hard I am thinking.",
    "Very good, darling. I am prepared to be impressed without taking ownership of the details.",
  ],
  celeste: [
    "That is fantastic. I will explain it at the fish counter and see who still asks what is fresh.",
    "I sell fish. I thought I was comfortable handling things that are difficult to hold onto.",
    "Okay… this fish and I have heard enough for one journey.",
  ],
  // DELIA — marine mechanic; EMMETT — harbour engineer; FRANKIE — cheerful boat guide.
  delia: [
    "Now there is a mystery I cannot solve by leaning on this wrench. Refreshing, honestly.",
    "I repair boats. If your explanation starts taking on water, I can help with that part.",
    "Good to know. I am going back to systems that complain by leaking.",
  ],
  emmett: [
    "Interesting. My harbour plans already have too many layers. I am tempted to add a physics one.",
    "I have rolled drawings for every eventuality except being academically ambushed in a taxi.",
    "Thank you. I would like the rest of the route at a scale of one street to one street.",
  ],
  frankie: [
    "That would go down brilliantly on a boat tour. People love a fact they can repeat slightly wrong.",
    "I tell visitors to keep their hands inside the boat. Should I be giving my brain similar advice?",
    "Cool. I am going to practise my tour-guide nod until we reach the dock.",
  ],
  // HAZEL — weather-loving rambler; ISAIAH — dock worker; JONAH — patient angler.
  hazel: [
    "I like surprises in nature. Usually mine are rain arriving through an allegedly waterproof jacket.",
    "I dressed for changeable weather. I should have dressed for changeable confidence.",
    "Okay. Could we talk about clouds next? The large, friendly sort.",
  ],
  isaiah: [
    "I move cargo all day. Nice to shift an idea around without somebody shouting from a forklift.",
    "That sounds like it needs careful handling. Do you have a label I can stick on the explanation?",
    "Understood enough. I am putting the rest in a container marked tomorrow.",
  ],
  jonah: [
    "That is interesting. I have plenty of time to think about it while the fish ignore me.",
    "I am very patient with things I cannot see and do not fully understand. I call it fishing.",
    "Fair enough. I will mull it over at the end of a pier, where my lack of progress looks intentional.",
  ],
  // KIT — sharp barista; LUCILLE — garden-tour host; MINH — record-store enthusiast.
  kit: [
    "I love it. Tomorrow I am writing a much stranger message on the cafe chalkboard.",
    "Customers ask me what makes the coffee special. I have been underusing the word quantum, apparently.",
    "Okay, thanks. My ability to respond intelligently is still waiting for its first espresso.",
  ],
  lucille: [
    "Lovely. My garden group will be thrilled to have something new to argue about.",
    "I have hosted some wandering conversations, but yours has needed the most comfortable shoes.",
    "Thank you, dear. We can let the idea grow without pulling it up every minute to check.",
  ],
  minh: [
    "Oh, I like this. It has the energy of discovering a record nobody warned you was experimental.",
    "I would recommend a related album, but even my weird section has limits.",
    "Nice. I need to flip the mental record over. This side is full.",
  ],
  // ODESSA — seasoned birdwatcher; PEARL — precise boat mechanic; REED — young deckhand.
  odessa: [
    "A wonderful explanation. I like being reminded that binoculars are only the beginning.",
    "I have identified hundreds of birds. I cannot identify the moment I stopped following this.",
    "Thank you. I am switching back to things that helpfully have feathers.",
  ],
  pearl: [
    "I enjoy an explanation that makes me want a better set of tools.",
    "I usually diagnose things by sound. Your car has offered several counterarguments during that lecture.",
    "Right. Fascinating science, but I would still replace that belt.",
  ],
  reed: [
    "That is brilliant. I now have something to say on deck besides asking where the spare rope is.",
    "I can tie six knots. After that explanation, my thoughts can tie a seventh.",
    "Okay. I will untangle that when I am somewhere with fewer actual ropes.",
  ],
  // SIMONE — lounge vocalist; THALIA — park ranger; ULYSSES — veteran captain.
  simone: [
    "Beautifully delivered. You found an audience member who appreciates a dramatic pause.",
    "I sing for a living. I know exactly how brave it is to keep going after that look from the back seat.",
    "Lovely performance. Shall we finish on a quiet note?",
  ],
  thalia: [
    "I love teaching visitors about nature. You have taken the tour considerably beyond my usual stopping point.",
    "I have a whole talk about mangroves. It suddenly feels charmingly uncomplicated.",
    "Thanks. I will return to explaining why feeding wildlife is a terrible idea.",
  ],
  ulysses: [
    "I have heard extraordinary things at sea. It is a treat to hear one with proper supporting evidence.",
    "That explanation took me farther offshore than I expected. I trust you brought charts.",
    "Aye. Let us bring the conversation into harbour before I start pretending to understand the currents.",
  ],
  // VINCENT — working fisherman; WILLOW — kayak guide; YVETTE — no-nonsense chef.
  vincent: [
    "Not bad. I normally have to wait much longer for a conversation with this much depth.",
    "I have brought home fish smaller than your vocabulary today.",
    "All right. I will believe the science. You believe the size of the fish I caught last week.",
  ],
  willow: [
    "I lead kayak trips. This feels like discovering an unexpected channel worth exploring.",
    "I am keeping my thoughts together, but they are starting to paddle in different directions.",
    "Thanks. I would like to coast for the rest of this conversation.",
  ],
  yvette: [
    "Interesting. You can explain the rest while peeling potatoes. I encourage useful conversation.",
    "That is quite a lot of theory for somebody who has not yet asked whether I want the window open.",
    "All right, chef of the universe. My destination is still the kitchen.",
  ],
  // ZEKE — upbeat DJ; BASIL — thoughtful naturalist; MERCY — rescue medic.
  zeke: [
    "I want to open a set with that. The crowd will either love it or very quietly leave.",
    "That is a deep cut. I usually pretend I knew those before everybody else.",
    "Okay. I am going to listen to something with a predictable beat now.",
  ],
  basil: [
    "That is the joy of studying nature. Every answer somehow produces more unpaid reading.",
    "I have carried field glasses for forty years. Apparently I should also have carried a mathematician.",
    "Thank you. Let us give the ordinary scenery a moment to recover its dignity.",
  ],
  mercy: [
    "I appreciate this. A surprise halfway through a journey usually means much more paperwork for me.",
    "I have heard some unusual things on the rescue radio. None came with this many new terms.",
    "Okay… thanks. Could the next unexpected event just be arriving on time?",
  ],
  // Solana Coast: SIENNA — surfer; DANTE — film electrician; LEILA — marine biologist.
  sienna: [
    "I thought surfing had given me a good grasp of waves. I appreciate the humbling update.",
    "That is cool. My brain caught about half of it and then fell off the board.",
    "Thanks. I am going back to waves I can see coming.",
  ],
  dante: [
    "I light film sets. It is nice to hear light discussed without somebody asking for it to be moodier.",
    "That explanation needs a close-up. My face right now is excellent reaction footage.",
    "Okay, cut. We got the interested nod. Let us move on before I ruin the take.",
  ],
  leila: [
    "I study marine life. I welcome a subject that gets stranger the more carefully you look at it.",
    "The sea urchin has been unusually quiet. I think you have finally found its weakness.",
    "Thank you. I have a sample to deliver and enough mysteries already in this tub.",
  ],
  // MILES — serious lifeguard; KEIKO — ceramic artist; EDEN — curious campus commuter.
  miles: [
    "Good explanation. I appreciate knowing more about the universe than which parts people can drown in.",
    "If my expression looks concerned, it is because I am trained to notice when someone is out of their depth.",
    "Okay. I am calling a short break from anything I cannot reach with this rescue float.",
  ],
  keiko: [
    "I love that. People ask whether my bowls are purely decorative. Yours is a whole useful conversation about reality.",
    "I make ceramics. I am familiar with carefully following a process and still opening the kiln in suspense.",
    "Thank you. Please take the next corner slowly. This bowl has enough uncertainty in its glaze.",
  ],
  eden: [
    "Wait, I actually want to learn more. A worrying development for someone already behind on coursework.",
    "I have a badge on my backpack for nearly everything. Apparently I need one for surviving this explanation.",
    "Okay. I am going to pretend this was the lecture I accidentally missed.",
  ],
  // MALIK — vinyl connoisseur; SERENA — location sound recordist; ADRIAN — railway mechanic.
  malik: [
    "That is a great rabbit hole. I know the feeling from searching for one record and losing a weekend.",
    "I understand this the way I understand jazz: enough to enjoy it, not enough to risk explaining it at a party.",
    "Nice. I am filing it between experimental and please do not ask me to dance to this.",
  ],
  serena: [
    "That was excellent. I spend all day asking for clean dialogue, and the best line happens in a taxi.",
    "I have a microphone right here. Somehow I still was not ready for the documentary this ride became.",
    "Thanks. Could we get thirty seconds of room tone? By which I mean absolutely no more talking.",
  ],
  adrian: [
    "I maintain trains. It is nice to discuss a complicated system without a whole platform waiting for the answer.",
    "I am following the explanation, although I may have changed onto the wrong mental track.",
    "Okay. Let us return to transport problems that a spanner can reach.",
  ],
  // KIRA — pastry chef; OWEN — relaxed pier angler; NADINE — coastal botanist.
  kira: [
    "I love it. I can now overexplain something other than why my croissants take three days.",
    "I have a tray of pastries and a head full of questions. One of those is easier to share.",
    "Thanks. Could we spend the next minute appreciating something uncomplicated and full of butter?",
  ],
  owen: [
    "Good stuff. I will have plenty of time to consider it while pretending the fish are about to bite.",
    "I came prepared to discuss bait. I can see I brought the wrong conversational equipment.",
    "Right. I am returning to the pier, where not understanding what is happening is considered relaxing.",
  ],
  nadine: [
    "I study coastal plants. Any explanation with that much happening beneath the surface has my attention.",
    "I brought a trowel. That now seems like an optimistic amount of research equipment.",
    "Thank you. I need to focus on something I can actually put in a pot.",
  ],
  // REMY — bicycle mechanic; CLEO — muralist; RONAN — working boat skipper.
  remy: [
    "I fix bicycles. I enjoy a mechanism that gets more interesting than two wheels and somebody's bad maintenance habits.",
    "I can true a wheel by feel. My confidence does not appear to transfer to this subject.",
    "Okay. I am keeping my next explanation below the complexity of a derailleur.",
  ],
  cleo: [
    "That is going into a mural somehow. I will need a bigger wall and a scientifically patient friend.",
    "You have given me a beautiful idea. The council will absolutely ask me to make it less confusing.",
    "Thanks. I am going to think about paint drying. I have professional reasons.",
  ],
  ronan: [
    "I run boats for a living. That is the most interesting thing I have heard today that did not begin with an engine alarm.",
    "I know where I am on the chart. In this conversation, I would like somebody to mark the buoy.",
    "Fair enough. I will keep to water deep enough for boats and shallow enough for my thoughts.",
  ],
  // ASHA — nurse off shift; LUCA — surfboard shaper; MARISOL — seedling grower.
  asha: [
    "That is lovely. I appreciate a little science delivered without an urgent request attached.",
    "I still have my work badge on, but the part of my brain that takes detailed notes has clocked out.",
    "Okay, thank you. I would like my next new fact to be that I have arrived home.",
  ],
  luca: [
    "I shape surfboards. I like hearing about precision from someone with an even more demanding definition of it.",
    "I can turn a block of foam into a board. Turning your explanation into understanding may take longer.",
    "Cool. I am sanding the rough edges off that thought as we speak.",
  ],
  marisol: [
    "I love a new idea. I will plant it somewhere in my head and see whether I remember to water it.",
    "These seedlings and I have learned a lot today. I expect they retained more.",
    "Thank you. For now, sunlight, water, and getting home without spilling soil will be enough.",
  ],
  // THEO — skateboarder; ELENA — architecture student; CALLUM — laid-back drummer.
  theo: [
    "That is brilliant. I usually learn physics by landing badly. This method hurts less.",
    "I am wearing a helmet, but apparently it does not protect against difficult ideas.",
    "Okay. Can we finish on something at the intellectual difficulty of an ollie?",
  ],
  elena: [
    "I study architecture. I like a subject where the structure is elegant even when the explanation needs scaffolding.",
    "I have brought plans, but none of them account for what just happened to my afternoon.",
    "Thanks. I will come back to that after I design a staircase people can actually use.",
  ],
  callum: [
    "That is great. I wish my band listened to explanations with the commitment I am showing you right now.",
    "I normally keep time. You have made me question whether I have enough of it to learn this.",
    "Nice solo. I will come back in when I hear something I can count to four over.",
  ],
  // VEDA — rooftop solar installer; JUNIPER — vintage-shop stylist; HOLLIS — travel photographer.
  veda: [
    "I install solar panels. Nice to hear the detailed story of the stuff paying my wages.",
    "This hard hat is designed for falling objects, not falling assumptions. I checked.",
    "Good talk. I would like the rest of the journey to involve fewer things above my head.",
  ],
  juniper: [
    "I sell vintage clothes. I appreciate an old idea that still makes people stop and stare.",
    "I understood enough to put it on a T-shirt and be unable to answer the follow-up questions.",
    "Okay. I am putting that thought back on the rack until I know what it goes with.",
  ],
  hollis: [
    "I photograph places for a living. You have found somewhere interesting I cannot book a flight to.",
    "I was going to complain about camera settings. Apparently I have been taking the easy part for granted.",
    "Thank you. I will let that develop at its own pace. A luxury my clients rarely allow.",
  ],
  // Ironwake Works: WALT — steelworks veteran; WINONA — shift supervisor; KENJI — dispatcher.
  walt: [
    "I have spent decades working with metal. Apparently I have only been meeting it at the surface level.",
    "I understood some of that. The hard hat is hiding the rest of my expression.",
    "Right. If the universe needs an extra shift, it can ask somebody younger.",
  ],
  winona: [
    "Fascinating. I am tempted to put this on the shift briefing just to see everyone finally look up.",
    "I have a clipboard, so people assume I understand everything. Please do not expose me like this.",
    "Thank you. Does any of that change the schedule? No? Then I am comfortable moving on.",
  ],
  kenji: [
    "I coordinate freight. I appreciate hearing about complexity without immediately having to redirect twelve trucks.",
    "I have a headset and the urge to ask somebody to repeat the last transmission.",
    "Copy that. I am switching this conversation to standby until after the dock clears.",
  ],
  // ROCIO — dry-witted welder; MEERA — inventive mechanic; DESMOND — harbour deckhand.
  rocio: [
    "That is cool. Most of the interesting physics in my day arrives as something I must not look directly at.",
    "I lifted my welding mask for this. I expected a shorter answer, but I respect the commitment.",
    "Okay… do I lower the mask again, or is the lecture finished?",
  ],
  meera: [
    "Now that is interesting. I love learning how something works before somebody asks me to fix it cheaply.",
    "This wrench has solved a lot of problems. It is looking less confident than usual.",
    "Thanks. If you need me, I will be considering a much smaller mystery under a bonnet.",
  ],
  desmond: [
    "I work the harbour. It is nice to hear something deep that does not come with a tide table.",
    "I have hauled heavier things than that explanation, but I had a crane helping me.",
    "All right. I came dressed for wet weather, not a shower of difficult facts.",
  ],
};

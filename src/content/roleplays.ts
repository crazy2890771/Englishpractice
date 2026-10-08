import type { RoleplayScenario } from "./types";

export const roleplays: RoleplayScenario[] = [
  {
    id: "job-interview-general",
    title: "Job Interview: Project Coordinator",
    category: "interview",
    setting:
      "You are in a bright meeting room at a mid-sized logistics company. You have applied for a project coordinator position and this is your first-round interview.",
    character: {
      name: "Sarah Mitchell",
      role: "HR Manager",
      personality: "Friendly and professional, but she asks for specific examples.",
    },
    learnerRole: "A candidate applying for a project coordinator job",
    objectives: [
      "Introduce yourself and summarise your relevant experience",
      "Describe one specific achievement using an example (situation, action, result)",
      "Ask the interviewer at least one question about the role or the team",
    ],
    opening:
      "Good morning, and thanks for coming in today. Please, have a seat. To start, could you tell me a little about yourself and your background?",
    demoTurns: [
      "Thank you, that's a helpful overview. What made you interested in this particular position with us?",
      "That makes sense. Can you tell me about a project you're proud of? What was your role, and what was the result?",
      "Impressive. And what about a time when things didn't go to plan? How did you handle the situation?",
      "I appreciate your honesty. How would your current colleagues describe you if I asked them?",
      "Good to know. Where do you see yourself professionally in, say, three to five years?",
      "Great. That's all from my side for now. Do you have any questions for me about the role or the team?",
    ],
    closing:
      "Thank you for your time today, it was a pleasure meeting you. We'll be in touch by the end of next week with the next steps.",
    usefulPhrases: [
      "I've been working as ... for about ... years.",
      "One thing I'm particularly proud of is ...",
      "In that situation, what I did was ...",
      "I'd say my main strength is ...",
      "Could you tell me a bit more about ...?",
    ],
    level: "B1",
  },
  {
    id: "job-interview-airline-crew",
    title: "Airline Interview: Cabin Crew or Pilot",
    category: "interview",
    setting:
      "You are at an airline's recruitment centre for a panel interview for a flight crew position. The interviewer has your CV and is interested in teamwork, safety and customer focus.",
    character: {
      name: "Captain David Okafor",
      role: "Senior Captain and recruitment panel member",
      personality: "Calm, observant and direct; he values safety awareness and clear communication.",
    },
    learnerRole: "A candidate interviewing for a cabin crew or first officer position",
    objectives: [
      "Explain why you want to work for this airline and in this role",
      "Give an example of working in a team under pressure",
      "Show how you would prioritise safety in a difficult situation",
    ],
    opening:
      "Welcome, please take a seat. I've had a look at your application. Before we go into details, why do you want to join our airline in particular?",
    demoTurns: [
      "Thank you. Aviation is a demanding career. What do you think is the most important quality for someone in this role, and why?",
      "Good. Tell me about a time you worked in a team under real pressure. What happened, and what did you personally do?",
      "Interesting. Now imagine a passenger, or a colleague, ignores a safety instruction. How would you deal with that?",
      "Right. And what if a more senior colleague made a decision you thought was unsafe? How would you raise it?",
      "That's an important point. How do you manage fatigue and stress with irregular schedules and long duty days?",
      "Okay, thank you. Is there anything you'd like to ask me about the training programme or life at the airline?",
    ],
    closing:
      "Thank you, that was a very good conversation. The panel will review all candidates this week, and you'll hear from us about the simulator assessment or group exercise shortly.",
    usefulPhrases: [
      "Safety always comes first, so I would ...",
      "In my experience, clear communication is essential because ...",
      "I would calmly explain the reason for the instruction.",
      "I would raise my concern respectfully but clearly.",
      "What does the initial training programme involve?",
    ],
    level: "B2",
  },
  {
    id: "hotel-check-in-problem",
    title: "Hotel Check-in: The Booking Is Missing",
    category: "hotel",
    setting:
      "You arrive at a city hotel late in the evening after a long journey. The receptionist cannot find your reservation in the system.",
    character: {
      name: "Tom Bennett",
      role: "Hotel receptionist",
      personality: "Polite and apologetic, a little stressed because the hotel is almost full.",
    },
    learnerRole: "A tired guest checking in at a hotel",
    objectives: [
      "Give your booking details clearly (name, dates, confirmation number)",
      "Politely insist that you have a valid reservation",
      "Agree on a solution, such as a different room or a discount",
    ],
    opening:
      "Good evening, welcome to the Riverside Hotel. Can I have the name the booking is under, please?",
    demoTurns: [
      "Thank you. Hmm, I'm sorry, I can't seem to find anything under that name. Did you book directly with us or through a website?",
      "I see. Do you happen to have a confirmation number or the confirmation email with you?",
      "Thank you for that. It looks like there was a problem with the booking system. I'm really sorry about this. How many nights were you planning to stay?",
      "Unfortunately the room type you booked is fully occupied tonight. I can offer you a twin room on the second floor instead. Would that be acceptable?",
      "I completely understand your frustration. To make up for it, I can include breakfast free of charge for your whole stay. How does that sound?",
      "Wonderful. Could I just see your passport and a card for incidentals, please? And would you like a wake-up call tomorrow?",
    ],
    closing:
      "Here's your key card, room 214. The lift is just on your left. Once again, I apologise for the confusion, and I hope you have a restful night.",
    usefulPhrases: [
      "I have a reservation under the name ...",
      "Here's my confirmation number.",
      "I booked it through ... about two weeks ago.",
      "I'm afraid that's not really what I booked.",
      "Would it be possible to ...?",
    ],
    level: "B1",
  },
  {
    id: "hotel-complaint",
    title: "Hotel Complaint: A Noisy Room",
    category: "hotel",
    setting:
      "It is the morning after your first night in a business hotel. Your room was noisy, the air conditioning didn't work properly and you slept badly, so you go to the front desk.",
    character: {
      name: "Elena Rossi",
      role: "Guest relations manager",
      personality: "Professional and diplomatic; she wants to solve the problem but needs details.",
    },
    learnerRole: "A hotel guest making a complaint",
    objectives: [
      "Describe the problems clearly and politely",
      "Explain how the problems affected your stay",
      "Request a specific solution (room change, refund or discount) and confirm it",
    ],
    opening:
      "Good morning. My colleague said you wanted to speak to a manager. I'm Elena from guest relations. How can I help you?",
    demoTurns: [
      "I'm very sorry to hear that. Could you tell me exactly what happened and what time the problem started?",
      "That certainly shouldn't happen. Was this the first time you noticed it, or did you report it to reception during the night?",
      "I understand. And apart from that, was everything else in the room as you expected?",
      "Thank you for letting me know. I can move you to a quieter room on a higher floor tonight. Would that work for you?",
      "That's a fair request. I can also offer a twenty percent discount on last night. Would you prefer that, or a free dinner in our restaurant?",
      "Certainly. I'll make a note on your booking now. Is there anything else we can do to make the rest of your stay more comfortable?",
    ],
    closing:
      "Thank you for your patience, and for telling us directly. Your new room will be ready from two o'clock, and the discount will appear on your final bill.",
    usefulPhrases: [
      "I'm afraid I have to make a complaint about ...",
      "I hardly slept at all because ...",
      "I'd appreciate it if you could ...",
      "Would it be possible to move to another room?",
      "I think a partial refund would be fair.",
    ],
    level: "B2",
  },
  {
    id: "airport-lost-baggage",
    title: "Airport: Reporting Lost Baggage",
    category: "airport",
    setting:
      "You have just landed after an international flight, but your suitcase did not appear on the baggage belt. You go to the baggage services desk in the arrivals hall.",
    character: {
      name: "Priya Sharma",
      role: "Baggage services agent",
      personality: "Efficient and patient; she follows a procedure and needs precise information.",
    },
    learnerRole: "A passenger whose suitcase is missing",
    objectives: [
      "Describe your bag in detail (size, colour, brand, special features)",
      "Give your flight details and a contact address",
      "Find out when and how the bag will be delivered and what you can claim",
    ],
    opening:
      "Hello, welcome to baggage services. I'm sorry to see you here. How can I help you today?",
    demoTurns: [
      "I'm sorry about that. The baggage tag is usually a sticker on the back of your boarding pass or passport. Could I see your boarding pass and the tag, please?",
      "Thank you. Now, can you describe the bag for me? What size and colour is it, and does it have any special features, like a ribbon or a name tag?",
      "That's helpful. And what was inside it? Anything valuable or anything you need urgently, like medication?",
      "Okay. Our system shows that the bag may still be at your connecting airport. Where are you staying, and what's the best phone number to contact you?",
      "Got it. We usually deliver delayed bags within twenty-four to forty-eight hours. In the meantime, do you need to buy any essential items?",
      "You can claim reasonable expenses if you keep the receipts. Do you have any other questions before I give you your reference number?",
    ],
    closing:
      "Here's your file reference. You can track the bag online with this number. I'm confident it will be with you by tomorrow evening. Have a good stay despite the trouble.",
    usefulPhrases: [
      "My suitcase didn't come out on the belt.",
      "It's a medium-sized, dark blue hard-shell case.",
      "It's got a red ribbon tied to the handle.",
      "How long will it take to find it?",
      "Can I claim for things I have to buy?",
    ],
    level: "B1",
  },
  {
    id: "airport-missed-connection",
    title: "Airport: Missed Connection",
    category: "airport",
    setting:
      "Your first flight was delayed by two hours, and you have just missed your connecting flight. You are at the airline transfer desk with a long queue behind you.",
    character: {
      name: "Mark Jensen",
      role: "Airline transfer desk agent",
      personality: "Busy but helpful; he responds well to calm, clear requests.",
    },
    learnerRole: "A transit passenger who has missed a connecting flight",
    objectives: [
      "Explain what happened and where you need to go",
      "Compare rebooking options and choose the best one for you",
      "Ask about your rights: meals, a hotel or compensation",
    ],
    opening:
      "Next, please. Hi there, sorry about the wait. What can I do for you?",
    demoTurns: [
      "Oh, I'm sorry to hear that. Can I have your passport and booking reference, please? Which flight were you supposed to be on?",
      "Right, I can see the delay on your first flight. The next direct flight is full, I'm afraid. I can put you on a flight via Frankfurt this evening, or a direct one tomorrow morning. Which would you prefer?",
      "Okay. Just so you know, the evening option has quite a short connection, about fifty minutes. Are you comfortable with that?",
      "No problem. Since the delay was our responsibility, you're entitled to meal vouchers. Do you need a hotel room for tonight as well?",
      "I'll arrange that for you. Your checked bag will be transferred automatically. Do you have any special requirements, like a particular seat?",
      "All done. Regarding compensation, you can submit a claim on our website after your trip. Is there anything else I can help you with?",
    ],
    closing:
      "Here's your new boarding pass, your meal vouchers and the hotel voucher. The shuttle bus leaves from door seven every twenty minutes. Again, sorry for the inconvenience.",
    usefulPhrases: [
      "My first flight was delayed, so I missed my connection.",
      "What are my options?",
      "I'd rather take the earlier flight, if possible.",
      "Am I entitled to a hotel room or meal vouchers?",
      "Will my luggage be transferred automatically?",
    ],
    level: "B2",
  },
  {
    id: "workplace-disagree-meeting",
    title: "Meeting: Disagreeing Politely",
    category: "workplace",
    setting:
      "You are in a weekly team meeting. Your manager has proposed moving a product launch forward by a month, and you think the plan is risky.",
    character: {
      name: "James Carter",
      role: "Team manager",
      personality: "Enthusiastic and ambitious; open to feedback if it is constructive and well argued.",
    },
    learnerRole: "A team member who disagrees with the proposal",
    objectives: [
      "Express disagreement politely without sounding negative or rude",
      "Give at least two clear reasons with evidence",
      "Suggest an alternative or compromise and agree on next steps",
    ],
    opening:
      "So, that's the plan: we launch in March instead of April. I think it gives us a real advantage over the competition. What do you all think? You look like you have some thoughts.",
    demoTurns: [
      "Okay, I hear you. But don't you think being first on the market is worth a bit of extra pressure?",
      "That's a fair point. Can you be more specific? Which parts of the project do you think would be most at risk?",
      "Hmm, I hadn't really looked at it from that angle. Do you have any numbers or examples to back that up?",
      "Right. I don't want to lose the advantage completely, though. So what would you suggest instead?",
      "That's an interesting compromise. The sales team are expecting a big launch, though. How would we explain it to them?",
      "Okay, I think that could work. Could you put together a short proposal by Thursday so we can discuss it with the directors?",
    ],
    closing:
      "Thanks, I really appreciate you speaking up. It's much better to hear these concerns now than after the launch. Let's review your proposal on Thursday.",
    usefulPhrases: [
      "I see where you're coming from, but ...",
      "I'm not sure that's the best approach because ...",
      "My main concern is ...",
      "What if we ... instead?",
      "Would it be possible to meet halfway?",
    ],
    level: "B2",
  },
  {
    id: "workplace-ask-colleague-help",
    title: "Office: Asking a Colleague for Help",
    category: "workplace",
    setting:
      "You need to prepare a report with a spreadsheet tool you don't know well, and the deadline is tomorrow. You walk over to the desk of a colleague who is an expert.",
    character: {
      name: "Lucy Chen",
      role: "Data analyst and colleague",
      personality: "Kind and helpful, but very busy this week.",
    },
    learnerRole: "An employee who needs help from a colleague",
    objectives: [
      "Ask for help politely and explain the problem clearly",
      "Negotiate a time that works for both of you",
      "Thank your colleague and offer something in return",
    ],
    opening:
      "Oh, hi! Is everything okay? You look a bit worried.",
    demoTurns: [
      "Ah, I see. What exactly are you trying to do? Is it the formulas or the charts that are causing problems?",
      "Okay, that's not too complicated once you know the trick. When is the report due?",
      "Tomorrow? That's tight. I've got a meeting in ten minutes and a deadline of my own this afternoon. Could we do it later today?",
      "Alright. Maybe you could send me the file now, so I can have a quick look before we sit down together?",
      "Sure, honestly, it's no problem. Some of the online tutorials are really good for beginners, too. Have you tried any of them?",
      "Ha, that's kind of you. So, shall we say half past four at your desk? Does that work for you?",
    ],
    closing:
      "Great, see you at half four, then. Don't worry, we'll get it sorted. And next time, just ask earlier!",
    usefulPhrases: [
      "Sorry to bother you, but do you have a minute?",
      "I'm having trouble with ...",
      "Would you mind showing me how to ...?",
      "Whenever suits you is fine.",
      "Thanks so much, I owe you one.",
    ],
    level: "B1",
  },
  {
    id: "customer-service-return-product",
    title: "Shop: Returning a Faulty Product",
    category: "customer-service",
    setting:
      "You bought a pair of wireless headphones at an electronics store ten days ago, and the left side has stopped working. You go back to the customer service counter.",
    character: {
      name: "Ben Harris",
      role: "Customer service assistant",
      personality: "Friendly but follows store policy closely.",
    },
    learnerRole: "A customer returning a faulty product",
    objectives: [
      "Explain what is wrong with the product and when you bought it",
      "Ask for a refund or replacement and respond to the store policy",
      "Confirm exactly what will happen next",
    ],
    opening:
      "Hi there, welcome to customer service. How can I help you today?",
    demoTurns: [
      "Oh no, sorry about that. When did you buy them, and do you have the receipt with you?",
      "Thanks. And what exactly is the problem? Did it start suddenly, or has it been getting worse?",
      "Okay. I need to check this before I can process a return: have they been dropped or damaged in any way?",
      "Fine, no problem. So, would you prefer a replacement pair or a refund?",
      "I'm afraid we're out of stock of that model at the moment. I could order a new pair, which takes about five days, or give you store credit today. Which would you like?",
      "Understood. Can I just take your name and a phone number for the record?",
    ],
    closing:
      "That's all sorted. You'll get a text message as soon as your item is ready, and you'll also receive an email confirmation. Thanks for your patience!",
    usefulPhrases: [
      "I bought these here about ten days ago.",
      "The left side has stopped working.",
      "I'd like a refund, please.",
      "I'd rather have my money back than store credit.",
      "How long will that take?",
    ],
    level: "B1",
  },
  {
    id: "customer-service-internet-call",
    title: "Phone Call: Internet Problem",
    category: "customer-service",
    setting:
      "Your home internet has been cutting out several times a day for a week, and you work from home. You phone your internet provider's technical support line.",
    character: {
      name: "Alex Moreno",
      role: "Technical support agent",
      personality: "Patient and methodical; follows a troubleshooting script.",
    },
    learnerRole: "A customer calling about an unreliable internet connection",
    objectives: [
      "Verify your identity and describe the problem precisely",
      "Follow and respond to the agent's troubleshooting instructions",
      "Arrange a technician visit or compensation and confirm the date",
    ],
    opening:
      "Thank you for calling FastLink support, this is Alex speaking. Before we start, can I have your account number or the full name on the account, please?",
    demoTurns: [
      "Thank you, I've found your account. So, what seems to be the problem with your connection?",
      "I see. How often does it happen, and does it affect all your devices or just one?",
      "Okay, let's try something. Could you check the lights on the front of your router and tell me what colour they are?",
      "Thanks. Now please turn the router off at the wall, wait thirty seconds, and turn it back on. Can you tell me when it's restarted?",
      "Alright. I've run a line test from our side, and there seems to be a fault outside your home. I can book a technician. Are you available on Tuesday or Wednesday?",
      "Perfect. As this has affected your service for a week, I can also add a credit to your next bill. Would you like me to email you the details?",
    ],
    closing:
      "Great, that's all booked. Your reference number is in the email, and the technician will call thirty minutes before arriving. Thanks for calling FastLink, and have a good day.",
    usefulPhrases: [
      "My connection keeps dropping.",
      "It happens several times a day, usually in the afternoon.",
      "The light on the router is flashing orange.",
      "Could you repeat that, please?",
      "Can I get some compensation for the lost service?",
    ],
    level: "B2",
  },
  {
    id: "aviation-crew-briefing",
    title: "Pre-flight Crew Briefing",
    category: "aviation",
    setting:
      "It is one hour before departure on a four-hour flight, and the crew are gathered in the briefing room. The captain is leading the briefing and asks crew members to contribute.",
    character: {
      name: "Captain Anna Lindqvist",
      role: "Captain (pilot in command)",
      personality: "Clear, structured and approachable; she encourages crew to speak up.",
    },
    learnerRole: "The purser (senior cabin crew member) or first officer",
    objectives: [
      "Confirm key flight information: passenger numbers, special passengers and catering",
      "Discuss expected turbulence and agree when the cabin service will be suspended",
      "Review a safety procedure and confirm communication signals between cockpit and cabin",
    ],
    opening:
      "Good morning, everyone. Welcome on board today. We have a full flight to Lisbon, flight time about three hours forty. Before I go through the weather, could you give us an update on the cabin side?",
    demoTurns: [
      "Thanks, that's very clear. Do we have any special category passengers today, for example reduced mobility, unaccompanied minors or medical cases?",
      "Good. Now, the forecast shows moderate turbulence about forty minutes after take-off, lasting around twenty minutes. How would you like to plan the service around that?",
      "That sounds sensible. If it gets worse, I'll switch on the seat belt sign and make a PA. Shall we agree that the cabin crew are seated when I call 'cabin crew, take your seats'?",
      "Agreed. Let's do a quick safety question. In case of an emergency evacuation, what are the first actions at your door?",
      "Correct, well done. And how will you contact the flight deck if there's a problem in the cabin, for example a sick passenger or smoke?",
      "Perfect. Last thing: is everyone fit to fly today, and does anyone have any questions or concerns before we go to the aircraft?",
    ],
    closing:
      "Excellent. Thank you, everyone. Remember, if anything doesn't look right, tell us early. Let's have a safe and pleasant flight. See you on board.",
    usefulPhrases: [
      "We have 186 passengers on board, including two infants.",
      "There is one passenger requiring wheelchair assistance.",
      "We'll start the service once the seat belt sign is off.",
      "In case of turbulence, we will secure the carts and be seated.",
      "Could you confirm the signal for ...?",
    ],
    level: "B2",
  },
  {
    id: "aviation-upset-passenger",
    title: "On Board: Handling an Upset Passenger",
    category: "aviation",
    setting:
      "During boarding on a busy morning flight, a passenger is angry because their pre-booked aisle seat has been given to someone else and there is no space for their bag. Other passengers are waiting in the aisle.",
    character: {
      name: "Mr. Richard Hale",
      role: "Frustrated frequent flyer",
      personality: "Impatient and loud at first, but he calms down if he feels listened to.",
    },
    learnerRole: "A cabin crew member handling the situation",
    objectives: [
      "Calm the passenger down using empathy and a polite, firm tone",
      "Offer practical solutions for the seat and the bag",
      "Keep boarding moving and explain clearly what will happen next",
    ],
    opening:
      "Excuse me! Someone is sitting in my seat, and there's no space anywhere for my bag. I paid extra for an aisle seat. This is ridiculous!",
    demoTurns: [
      "Well, I booked this seat three weeks ago. I've got a very important meeting when we land, and I need to get off quickly. What are you going to do about it?",
      "I don't want to sit in the middle for two hours. Why should I lose my seat because of your mistake?",
      "Fine, I'll listen. But my laptop is in my bag, and I'm not putting it in the hold. So what are you going to do about my bag?",
      "Okay, I suppose that's reasonable. But will someone make sure I get my money back for the seat?",
      "Alright. I'm sorry I raised my voice. It's just been a very stressful morning. Can I at least get a coffee once we're in the air?",
      "Thank you, I appreciate it. So, where exactly should I sit now, and where are you putting my bag?",
    ],
    closing:
      "Okay, thank you for sorting that out so quickly. You were very professional. I'll take my seat now.",
    usefulPhrases: [
      "I completely understand why you're upset.",
      "Let me see what I can do for you.",
      "I can offer you an aisle seat in row ...",
      "I'll place your bag in a locker nearby and keep an eye on it.",
      "Could you take a seat for now, so we can finish boarding on time?",
    ],
    level: "B1",
  },
];

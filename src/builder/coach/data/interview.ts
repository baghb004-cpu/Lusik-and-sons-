// ============================================================
// Communication Coach — Interview Coach content pack (§28)
// ============================================================
// Local library for honest interview prep: questions + multi-style
// example answers, answer frameworks, interview types, roleplay
// personas, a prep checklist, follow-up templates, an "avoid" list,
// and confidence prompts. Never coaches lying or exaggeration —
// it helps present REAL strengths clearly. Pure data.
// ============================================================

import type { InterviewQuestion, AnswerFramework, RoleplayScenario, FollowUpTemplate } from "../schemas.ts";

export const INTERVIEW_TYPES = [
  "Restaurant / kitchen", "Dishwasher", "Steward", "Prep cook", "Retail", "Customer service",
  "Office assistant", "Entry-level", "Trade", "Apprenticeship", "School / program", "Internship",
  "Freelance website meeting", "Small business client meeting", "Phone interview", "Video interview",
];

export const ANSWER_FRAMEWORKS: AnswerFramework[] = [
  {
    id: "star",
    name: "STAR Method (for 'tell me about a time…')",
    steps: [
      { label: "Situation", hint: "Briefly set the scene — where and when." },
      { label: "Task", hint: "What you needed to do." },
      { label: "Action", hint: "What YOU actually did (the main part)." },
      { label: "Result", hint: "How it turned out, and what you learned." },
    ],
    example: "At my last kitchen job (Situation), we got slammed during a rush (Task). I kept the dish pit moving and asked where to help next (Action), so the line never ran out of clean pans and we got through it (Result).",
  },
  {
    id: "beginner",
    name: "Simple Beginner Method",
    steps: [
      { label: "What happened", hint: "The situation, in one line." },
      { label: "What I did", hint: "Your part." },
      { label: "What I learned", hint: "The takeaway." },
    ],
    example: "A customer was upset (what happened). I stayed calm and got my manager (what I did). I learned to ask for help early instead of guessing (what I learned).",
  },
  {
    id: "experience",
    name: "Experience Method (for limited experience)",
    steps: [
      { label: "What I have done", hint: "Real things you've done, even small." },
      { label: "What I'm good at", hint: "An honest strength." },
      { label: "What I'm willing to learn", hint: "Show you're coachable." },
    ],
    example: "I've helped in a kitchen with cleaning and prep (done). I'm dependable and quick to pitch in (good at). And I'm eager to learn your way of doing things (willing to learn).",
  },
];

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  {
    id: "tell-me-about-yourself",
    question: "Tell me about yourself.",
    framework: "experience",
    tips: ["Keep it about 30 seconds.", "Focus on work, not personal life.", "End with what you're looking for."],
    answers: [
      { style: "beginner", text: "Sure. I'm someone who likes steady, hands-on work and I try to be dependable. I have experience helping in a kitchen environment, especially with dishwashing, cleaning, and supporting the team. I'm also studying culinary work, so I'm interested in continuing to learn and improve. I'm looking for a position where I can work hard, be useful, and grow over time." },
      { style: "professional", text: "I'm a reliable, hands-on worker. I've supported a kitchen team with cleaning, prep, and keeping things moving during busy periods, and I'm continuing to build my skills through study. I'm looking for a role where I can contribute right away and keep growing." },
      { style: "short", text: "I'm dependable and hands-on. I've helped in a kitchen with cleaning and prep, I'm studying to grow my skills, and I'm looking for a role where I can work hard and learn." },
    ],
  },
  {
    id: "why-want-job",
    question: "Why do you want this job?",
    tips: ["Tie it to something real about the place or the work.", "Avoid 'I just need a job'."],
    answers: [
      { style: "simple", text: "I like steady, hands-on work, and this looks like a place where I can be useful and learn. I'd rather do a job well and grow with a team than bounce around, so a role like this fits what I'm looking for." },
      { style: "confident", text: "I want work where being dependable and hard-working actually matters, and this role is exactly that. I'm ready to show up, do the job right, and grow with the team." },
    ],
  },
  {
    id: "why-hire-you",
    question: "Why should we hire you?",
    tips: ["Name 2–3 real strengths.", "Stay honest — no overselling."],
    answers: [
      { style: "confident", text: "I'm dependable, I show up on time, and I work hard without needing to be watched. I take direction well and I'm quick to pitch in where I'm needed. I may be early in my career, but I'll put in the effort and learn fast." },
      { style: "simple", text: "Because I'm reliable, I work hard, and I'm easy to work with. I'll do the job right and ask when I'm not sure." },
    ],
  },
  {
    id: "strengths",
    question: "What are your strengths?",
    tips: ["Pick strengths that fit the job.", "Give a quick example."],
    answers: [
      { style: "simple", text: "I'm dependable and I keep a steady pace, even when it's busy. I'm also good at staying calm and asking for help instead of guessing. People tend to trust me to get my part done." },
      { style: "professional", text: "Reliability and composure under pressure. I keep my area moving during a rush and I communicate early if something's off, which keeps the whole team on track." },
    ],
  },
  {
    id: "weakness",
    question: "What are your weaknesses?",
    tips: ["Be honest but pick something you're improving.", "Never say 'I have no weaknesses'."],
    answers: [
      { style: "professional", text: "I can be a bit quiet at first, so I sometimes wait too long to ask a question. I've been working on speaking up earlier, because asking right away actually keeps things moving better." },
      { style: "simple", text: "I'm still building experience, so some things are new to me. I handle that by paying close attention and asking when I'm unsure, instead of guessing." },
    ],
  },
  {
    id: "problem-at-work",
    question: "Tell me about a time you had a problem at work.",
    framework: "star",
    tips: ["Use STAR.", "Focus on what YOU did and what you learned."],
    answers: [
      { style: "beginner", text: "One time we got really busy and dishes were piling up. I focused on the most-needed pans first and asked where else to help. We caught up and the line never ran out. I learned to stay calm and tackle the most important thing first." },
    ],
  },
  {
    id: "handle-stress",
    question: "How do you handle stress?",
    tips: ["Show a calm, practical approach."],
    answers: [
      { style: "simple", text: "I slow down for a second, figure out the most important thing to do next, and just keep moving. If it's too much for one person, I ask for help early instead of letting it pile up." },
    ],
  },
  {
    id: "handle-criticism",
    question: "How do you handle criticism?",
    tips: ["Show you're coachable, not defensive."],
    answers: [
      { style: "professional", text: "I take it as information. If someone shows me a better way, I'd rather learn it than keep doing it wrong. I might ask a question to make sure I understand, then apply it." },
    ],
  },
  {
    id: "teamwork",
    question: "Are you comfortable working as part of a team?",
    tips: ["Yes — with a quick reason."],
    answers: [
      { style: "simple", text: "Definitely. I like knowing my part and helping where I'm needed. A good team makes a hard shift go a lot smoother, and I try to be someone people can count on." },
    ],
  },
  {
    id: "taking-direction",
    question: "Are you comfortable taking direction?",
    tips: ["Yes — show humility."],
    answers: [
      { style: "simple", text: "Yes. Every place does things its own way, and I'd rather learn yours than assume. I take direction well and ask if I'm unsure." },
    ],
  },
  {
    id: "availability",
    question: "What is your availability?",
    tips: ["Be honest and specific.", "Fill in your real availability."],
    answers: [
      { style: "simple", text: "My availability is [AVAILABILITY]. I'm flexible where I can be, and I'll always give as much notice as possible if something comes up." },
    ],
  },
  {
    id: "transportation",
    question: "Do you have reliable transportation?",
    tips: ["Answer honestly."],
    answers: [
      { style: "short", text: "Yes, I have a reliable way to get here on time." },
      { style: "simple", text: "I do — I've planned how I'll get here so I can be on time and consistent." },
    ],
  },
  {
    id: "experience",
    question: "What experience do you have?",
    framework: "experience",
    tips: ["Use the Experience Method.", "Never invent experience."],
    answers: [
      { style: "beginner", text: "I'm still building my experience, but I'm reliable, willing to learn, and comfortable starting with the basics. I understand that every workplace has its own way of doing things, and I'm open to training and feedback." },
      { style: "professional", text: "I have hands-on experience supporting a kitchen team with cleaning and prep, and I'm continuing to build my skills. I learn quickly and I'm comfortable starting with the fundamentals and growing from there." },
    ],
  },
  {
    id: "why-leave",
    question: "Why did you leave your last job?",
    tips: ["Stay positive.", "Never bad-mouth a former employer."],
    answers: [
      { style: "professional", text: "I'm looking for a place where I can settle in and grow rather than just fill a shift. I appreciated what I learned at my last role, and I'm ready for a steadier opportunity like this one." },
    ],
  },
  {
    id: "where-see-yourself",
    question: "Where do you see yourself in a few years?",
    tips: ["Show you want to grow and stay."],
    answers: [
      { style: "simple", text: "I'd like to have grown into someone the team relies on, with more skills than I have today. I'm not looking to bounce around — I want to get good at this and take on more over time." },
    ],
  },
  {
    id: "questions-for-us",
    question: "Do you have any questions for us?",
    tips: ["Always have two ready.", "Ask about the work or the team, not just pay."],
    answers: [
      { style: "simple", text: "Yes — what does a great first month look like in this role? And what's the team like to work with day to day?" },
      { style: "professional", text: "A couple: What would success look like in the first 90 days, and how does the team communicate during busy periods?" },
    ],
  },
];

export const INTERVIEW_AVOID = [
  "Speaking negatively about former employers or coworkers",
  "Sounding desperate ('I'll take anything')",
  "Oversharing personal problems",
  "Inventing experience or claiming skills you don't have",
  "Saying 'I don't know' with nothing after it",
  "Giving very long, rambling answers",
  "Bringing up pay too early or in the wrong way",
];

export const CONFIDENCE_PROMPTS = [
  "Name three things you're genuinely good at. Those are real — lead with them.",
  "Practice your 'tell me about yourself' out loud three times. It gets easier each time.",
  "Slow down. A calm, clear answer beats a fast, nervous one.",
  "It's okay to pause and think before answering. Silence is fine.",
  "You're not begging for a job — you're offering honest work. Stand in that.",
];

export const PREP_CHECKLIST = [
  "Know the job title and what the work involves",
  "Know the address and the exact interview time",
  "Plan your transportation (arrive 10 minutes early)",
  "Bring a resume if they asked for one",
  "Practice three short answers out loud",
  "Prepare two questions to ask them",
  "Know your availability",
  "(If online) research the company — but it's not required",
  "Plan to send a thank-you message afterward",
];

export const INTERVIEW_ROLEPLAY: RoleplayScenario[] = [
  {
    id: "restaurant-friendly",
    title: "Restaurant manager (friendly)",
    persona: "Friendly restaurant manager",
    difficulty: "beginner",
    startId: "r1",
    nodes: [
      {
        id: "r1",
        persona: "Friendly restaurant manager",
        prompt: "Thanks for coming in! So, tell me a little about yourself.",
        choices: [
          { label: "Dependable, hands-on, here to learn and work hard (30 sec).", nextId: "r2", feedback: "Great — short, honest, work-focused.", score: 3 },
          { label: "Talk for two minutes about your whole life story.", nextId: "r2", feedback: "Too long. Keep it ~30 seconds and work-focused.", score: 1 },
          { label: "\"I just really need a job right now.\"", nextId: "r2", feedback: "Sounds desperate. Focus on what you offer instead.", score: 0 },
        ],
      },
      {
        id: "r2",
        persona: "Friendly restaurant manager",
        prompt: "What's your availability like?",
        choices: [
          { label: "Give your real availability and offer flexibility.", nextId: "r3", feedback: "Honest and helpful — exactly right.", score: 3 },
          { label: "\"Whenever, I guess.\"", nextId: "r3", feedback: "Be specific — vague availability worries managers.", score: 1 },
        ],
      },
      {
        id: "r3",
        persona: "Friendly restaurant manager",
        prompt: "Do you have any questions for me?",
        choices: [
          { label: "Ask what a great first month looks like.", feedback: "Strong finish — shows you want to do well.", score: 3 },
          { label: "\"No, I think I'm good.\"", feedback: "Always have one question ready — it shows interest.", score: 1 },
          { label: "Ask only about pay and days off.", feedback: "Fine later, but lead with the work first.", score: 1 },
        ],
      },
    ],
  },
];

export const INTERVIEW_FOLLOWUPS: FollowUpTemplate[] = [
  {
    id: "thank-you-email",
    channel: "email",
    title: "Thank-you email",
    subject: "Thank you — [JOB_TITLE]",
    body: "Hi [CONTACT_NAME], thank you for taking the time to speak with me today about the [JOB_TITLE] position. I appreciated learning more about the role and the team. I'm still very interested and would be grateful for the opportunity to contribute. Thank you again for your time.\n\nBest,\n[USER_NAME]",
  },
  { id: "thank-you-text", channel: "text", title: "Thank-you text", body: "Hi [CONTACT_NAME], thank you for meeting with me today about the [JOB_TITLE] role. I really enjoyed it and I'm very interested. Thanks again! — [USER_NAME]" },
  { id: "follow-up-no-response", channel: "email", title: "Follow-up (no response)", subject: "Checking in — [JOB_TITLE]", body: "Hi [CONTACT_NAME],\n\nI wanted to follow up on the [JOB_TITLE] position and reaffirm my interest. If there's anything else you need from me, I'm glad to provide it. Thank you for your time.\n\nBest,\n[USER_NAME]" },
  { id: "confirm-time", channel: "email", title: "Confirm interview time", subject: "Confirming our meeting — [JOB_TITLE]", body: "Hi [CONTACT_NAME],\n\nJust confirming our interview for the [JOB_TITLE] role on [FOLLOW_UP_DATE]. I'm looking forward to it — please let me know if anything changes.\n\nThank you,\n[USER_NAME]" },
  { id: "reschedule", channel: "email", title: "Politely reschedule", subject: "Request to reschedule — [JOB_TITLE]", body: "Hi [CONTACT_NAME],\n\nI'm sorry for the short notice, but I need to request a different time for our [JOB_TITLE] interview. I remain very interested and can be flexible around your schedule. Thank you for understanding.\n\nBest,\n[USER_NAME]" },
  { id: "accept-offer", channel: "email", title: "Accept an offer", subject: "Accepting the [JOB_TITLE] offer", body: "Hi [CONTACT_NAME],\n\nThank you so much for the offer for the [JOB_TITLE] position — I'm happy to accept. I'm excited to join the team and contribute. Please let me know the next steps.\n\nBest,\n[USER_NAME]" },
  { id: "decline-offer", channel: "email", title: "Politely decline", subject: "Regarding the [JOB_TITLE] offer", body: "Hi [CONTACT_NAME],\n\nThank you very much for offering me the [JOB_TITLE] position. After careful thought, I've decided to go in a different direction at this time. I truly appreciate your time and the opportunity, and I hope our paths cross again.\n\nBest,\n[USER_NAME]" },
];

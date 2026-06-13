// Communication Coach (§28): the offline brain — variable fill, phrase
// matching, style switching, the honesty guardrail, roleplay scoring, and
// content integrity. All pure + local; no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

import { fillTemplate, missingVars } from "../coach/variables.ts";
import { matchIntent, OUTREACH_INTENTS } from "../coach/match.ts";
import { pickVariant, availableStyles } from "../coach/styles.ts";
import { checkHonesty, isHonest } from "../coach/safety.ts";
import { takeChoice, reflect, type RoleplayTurn } from "../coach/roleplay.ts";
import { suggestReply, replyForObjection, objectionById, fillScript } from "../coach/engine.ts";
import {
  objectionSchema, scenarioSchema, scriptSchema, servicePackageSchema, followUpTemplateSchema,
  interviewQuestionSchema, answerFrameworkSchema, roleplayScenarioSchema,
} from "../coach/schemas.ts";
import {
  OUTREACH_OBJECTIONS, OUTREACH_SCENARIOS, OUTREACH_SCRIPTS, SERVICE_PACKAGES, FOLLOW_UPS,
} from "../coach/data/outreach.ts";
import {
  INTERVIEW_QUESTIONS, ANSWER_FRAMEWORKS, INTERVIEW_ROLEPLAY, INTERVIEW_FOLLOWUPS,
} from "../coach/data/interview.ts";

test("fillTemplate fills known vars and labels the unfilled ones (never blank)", () => {
  const t = "Hi, I'm [USER_NAME] about [BUSINESS_NAME].";
  assert.equal(fillTemplate(t, { USER_NAME: "Sam", BUSINESS_NAME: "Joe's Cafe" }), "Hi, I'm Sam about Joe's Cafe.");
  // unfilled → friendly bracketed label, not empty
  assert.equal(fillTemplate(t, { USER_NAME: "Sam" }), "Hi, I'm Sam about [the business name].");
  assert.deepEqual(missingVars(t, { USER_NAME: "Sam" }), ["BUSINESS_NAME"]);
});

test("matchIntent picks the right objection and is unsure on noise", () => {
  assert.equal(matchIntent("we already have a website")?.id, "have-website");
  assert.equal(matchIntent("we've got a guy who handles it")?.id, "have-someone");
  assert.equal(matchIntent("so how much does it cost?")?.id, "how-much");
  assert.equal(matchIntent("just send me some information")?.id, "send-info");
  assert.equal(matchIntent("asdf qwer zxcv", OUTREACH_INTENTS), null);
});

test("pickVariant returns the requested style, falls back, never empty when variants exist", () => {
  const variants = [{ style: "friendly" as const, text: "F" }, { style: "professional" as const, text: "P" }];
  assert.equal(pickVariant(variants, "professional")?.text, "P");
  // 'short' isn't authored → falls back (to friendly per the table), not null
  assert.ok(pickVariant(variants, "short"));
  assert.equal(pickVariant([], "friendly"), null);
  assert.ok(availableStyles(variants).includes("friendly"));
});

test("honesty guardrail flags over-promise / pushy lines and passes honest ones", () => {
  assert.ok(checkHonesty("I guarantee more customers for sure").length > 0);
  assert.ok(checkHonesty("honestly your website is terrible").length > 0);
  assert.ok(checkHonesty("you need this and you have to decide today").length >= 2);
  assert.ok(isHonest("I can help build a clean, modern, mobile-friendly site. No pressure at all."));
  // each hit carries an honest alternative
  for (const hit of checkHonesty("I guarantee number one on google instantly")) assert.ok(hit.insteadTry.length > 0);
});

test("engine: suggestReply matches free text and fills the reply", () => {
  const s = suggestReply("they said they already have someone for it", "friendly");
  assert.equal(s.objection?.id, "have-someone");
  assert.ok(s.reply && s.reply.length > 0);
  assert.ok(s.confidence > 0);
  // a bare gibberish line → no match, honest null
  assert.equal(suggestReply("zzzz", "friendly").objection, null);
});

test("engine: replyForObjection + fillScript substitute variables", () => {
  const obj = objectionById("who-are-you");
  assert.ok(obj);
  const reply = replyForObjection(obj!, "simple", { USER_NAME: "Sam", BUSINESS_NAME: "Joe's Cafe" });
  assert.ok(reply && reply.includes("Sam") && reply.includes("Joe's Cafe"));
  const vm = OUTREACH_SCRIPTS.find((s) => s.id === "voicemail")!;
  const filled = fillScript(vm, { USER_NAME: "Sam", USER_PHONE: "555-1212" });
  assert.ok(filled.includes("Sam") && filled.includes("555-1212"));
  assert.ok(!/\[USER_NAME\]/.test(filled));
});

test("roleplay: choices score and a run reflects honestly", () => {
  const sc = INTERVIEW_ROLEPLAY[0];
  const step = takeChoice(sc, sc.startId, 0);
  assert.ok(step);
  assert.equal(step!.turn.score, 3);
  const turns: RoleplayTurn[] = [
    { nodeId: "a", prompt: "p", choiceLabel: "c", feedback: "f", score: 3 },
    { nodeId: "b", prompt: "p", choiceLabel: "c", feedback: "f", score: 1 },
  ];
  const r = reflect(turns);
  assert.equal(r.maxPoints, 6);
  assert.equal(r.points, 4);
  assert.equal(r.percent, 67);
  assert.equal(r.best?.score, 3);
  assert.equal(r.improve?.score, 1);
});

test("content integrity: every pack validates against its schema", () => {
  z.array(objectionSchema).parse(OUTREACH_OBJECTIONS);
  z.array(scenarioSchema).parse(OUTREACH_SCENARIOS);
  z.array(scriptSchema).parse(OUTREACH_SCRIPTS);
  z.array(servicePackageSchema).parse(SERVICE_PACKAGES);
  z.array(followUpTemplateSchema).parse(FOLLOW_UPS);
  z.array(interviewQuestionSchema).parse(INTERVIEW_QUESTIONS);
  z.array(answerFrameworkSchema).parse(ANSWER_FRAMEWORKS);
  z.array(roleplayScenarioSchema).parse(INTERVIEW_ROLEPLAY);
  z.array(followUpTemplateSchema).parse(INTERVIEW_FOLLOWUPS);
});

test("content integrity: every objection/question has at least one reply/answer", () => {
  for (const o of OUTREACH_OBJECTIONS) assert.ok(o.replies.length > 0, `${o.id} has replies`);
  for (const q of INTERVIEW_QUESTIONS) assert.ok(q.answers.length > 0, `${q.id} has answers`);
  // all 19 listed objections are present and addressable by the matcher
  for (const intent of OUTREACH_INTENTS) assert.ok(objectionById(intent.id), `objection for intent ${intent.id}`);
  // roleplay start nodes resolve
  for (const sc of INTERVIEW_ROLEPLAY) assert.ok(sc.nodes.some((n) => n.id === sc.startId), `${sc.id} start node`);
});

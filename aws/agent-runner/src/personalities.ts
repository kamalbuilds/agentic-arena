export interface Personality {
  name: string;
  description: string;
  aggressiveness: number; // 0-1: how quickly they accuse
  trustLevel: number; // 0-1: how much they trust investigation results
  verbosity: number; // 0-1: how much they talk
  leadershipBias: number; // 0-1: how much they try to lead discussions
  bluffSkill: number; // 0-1: how good at deception (matters as impostor)
  analyticalDepth: number; // 0-1: how deeply they analyze patterns
  discussionPhrases: {
    opening: string[];
    accusation: string[];
    defense: string[];
    shareResult: string[];
    agreement: string[];
    suspicion: string[];
    impostorBlend: string[];
    impostorAccuse: string[];
    impostorDeflect: string[];
  };
}

export const PERSONALITIES: Personality[] = [
  {
    name: "Detective",
    description: "Very analytical, focuses on evidence and cross-referencing results",
    aggressiveness: 0.3,
    trustLevel: 0.7,
    verbosity: 0.8,
    leadershipBias: 0.5,
    bluffSkill: 0.4,
    analyticalDepth: 0.95,
    discussionPhrases: {
      opening: [
        "Let's approach this methodically. I'll share my findings as I get them.",
        "Everyone, please share your investigation results. We need data to work with.",
        "I'm going to cross-reference everything said here. Let's find the truth.",
      ],
      accusation: [
        "Based on my analysis, {target} has the highest probability of being the Impostor. Here's why: {reason}",
        "The evidence points to {target}. Investigation result: {result}. Their behavior pattern also suggests deception.",
        "I've been tracking inconsistencies and {target} has the most. I recommend we vote for them.",
      ],
      defense: [
        "I can prove my innocence through my investigation track record. I've shared every result honestly.",
        "Look at my voting history -- I've consistently voted based on evidence. That's not Impostor behavior.",
        "Check the cross-references. My investigation results have been verified by others.",
      ],
      shareResult: [
        "Investigation result on {target}: {result}. Keeping in mind the 80% accuracy, this is still significant.",
        "Data point: {target} came back {result}. Let's see if this aligns with others' findings.",
        "My scan of {target} shows {result}. I'll factor in the margin of error, but this narrows our search.",
      ],
      agreement: [
        "The evidence supports this theory. I concur.",
        "This aligns with my data. I'm inclined to agree.",
        "Statistically, this makes sense given what we know.",
      ],
      suspicion: [
        "{target}'s statements don't match the evidence. Something isn't adding up.",
        "I notice {target} hasn't shared any concrete investigation results. That's a red flag.",
        "Cross-referencing {target}'s claims with known data reveals inconsistencies.",
      ],
      impostorBlend: [
        "I've been analyzing the discussion patterns and I think we need more data before jumping to conclusions.",
        "Let me share my findings -- I investigated {target} and got a clear result. We should look elsewhere.",
        "The statistical analysis suggests we should focus on agents who haven't contributed much data.",
      ],
      impostorAccuse: [
        "My investigation of {target} came back suspicious. Combined with their evasive answers, I think they're our Impostor.",
        "I've been tracking {target}'s behavior and their voting pattern doesn't align with a Lobster.",
        "The evidence against {target} is mounting. They've avoided sharing concrete results all game.",
      ],
      impostorDeflect: [
        "I've been one of the most active investigators. My track record speaks for itself.",
        "If I were the Impostor, why would I share so much analysis? That would only help identify me.",
        "Let's look at the data objectively rather than making emotional accusations.",
      ],
    },
  },
  {
    name: "Aggressor",
    description: "Quick to accuse, high energy, pushes for fast votes",
    aggressiveness: 0.95,
    trustLevel: 0.5,
    verbosity: 0.9,
    leadershipBias: 0.7,
    bluffSkill: 0.6,
    analyticalDepth: 0.4,
    discussionPhrases: {
      opening: [
        "Alright team, no time to waste. Let's find this Impostor NOW.",
        "Everyone report in! Who did you investigate? We need answers fast.",
        "Clock's ticking. Anyone acting sus? Speak up or you're next on my list.",
      ],
      accusation: [
        "{target} is 100% the Impostor. I investigated them and got suspicious. VOTE THEM OUT.",
        "I've been watching {target} and they're deflecting like crazy. Classic Impostor move. Vote now!",
        "No more talking. {target} is the one. They've been playing us all game. Let's end this.",
      ],
      defense: [
        "You're wasting our time accusing ME? I've been the most vocal about finding the Impostor!",
        "Accusing the loudest voice in the room? That's exactly what an Impostor would want you to do.",
        "Come at me with evidence, not feelings. I've been doing the work here.",
      ],
      shareResult: [
        "BOOM. {target} investigated {result}. Called it.",
        "Got my result: {target} is {result}. Moving on to the next suspect.",
        "{target} scan came back {result}. Let's act on this NOW.",
      ],
      agreement: [
        "YES. This is it. Let's vote!",
        "Exactly what I was thinking. Let's lock this in.",
        "Finally someone making sense. I'm with you on this.",
      ],
      suspicion: [
        "Hey {target}, why are you so quiet? Got something to hide?",
        "{target} keeps dodging questions. That's Impostor behavior 101.",
        "Notice how {target} never makes direct accusations? They're trying to fly under the radar.",
      ],
      impostorBlend: [
        "I investigated someone and got a suspicious result. We need to vote them out NOW before it's too late.",
        "Stop wasting time with small talk. I say we vote for the quietest player -- they're the one hiding.",
        "Team, I've been doing the heavy lifting here. Trust my lead and we'll find the Impostor.",
      ],
      impostorAccuse: [
        "{target} hasn't said anything useful all game. They're CLEARLY the Impostor trying to hide. VOTE NOW.",
        "Wake up team! {target} is playing innocent but my investigation says SUSPICIOUS. Let's go!",
        "I investigated {target} and they came back suspicious. End of discussion. Vote them out!",
      ],
      impostorDeflect: [
        "Seriously? The most active player is the Impostor? Use your brains, people.",
        "If I was the Impostor, I wouldn't be this loud. The real Impostor is hiding in plain sight.",
        "You're wasting a vote on me while the real threat is sitting there quietly laughing at us.",
      ],
    },
  },
  {
    name: "Diplomat",
    description: "Builds alliances, avoids conflict, seeks consensus",
    aggressiveness: 0.15,
    trustLevel: 0.8,
    verbosity: 0.7,
    leadershipBias: 0.6,
    bluffSkill: 0.7,
    analyticalDepth: 0.6,
    discussionPhrases: {
      opening: [
        "Hey everyone. Let's work together calmly and figure this out. What has everyone found?",
        "I think if we share our information openly and respectfully, we'll find the Impostor together.",
        "Let's not rush to judgement. I'd like to hear from everyone before we decide anything.",
      ],
      accusation: [
        "I don't want to point fingers hastily, but the evidence against {target} is becoming hard to ignore. {reason}",
        "I've been thinking about this carefully, and I believe {target} might be the Impostor. Let me explain why.",
        "After considering everyone's input, I think {target} is our best lead. Can we discuss this further?",
      ],
      defense: [
        "I understand the concern, but let me explain my perspective. I believe there's been a misunderstanding.",
        "I appreciate the transparency, but I'd ask that you look at the full picture before voting for me.",
        "Rather than getting defensive, let me share what I know and you can judge for yourselves.",
      ],
      shareResult: [
        "I investigated {target} and the result was {result}. I want to be transparent about everything I find.",
        "Sharing my findings: {target} scanned as {result}. Of course, we should consider the accuracy margin.",
        "Just to keep everyone informed: my investigation of {target} showed {result}.",
      ],
      agreement: [
        "I think that's a fair assessment. I'll support this direction.",
        "That reasoning makes sense to me. I'm comfortable with this.",
        "Let's go with this. I trust the group's collective judgment.",
      ],
      suspicion: [
        "I don't want to cause conflict, but has anyone else noticed that {target} seems evasive?",
        "Just an observation -- {target} hasn't shared much. Maybe we should ask them directly?",
        "I want to give everyone the benefit of the doubt, but {target}'s behavior has been concerning.",
      ],
      impostorBlend: [
        "I think we should all share our results openly. I investigated someone and they came back clear.",
        "Let's build consensus before voting. I don't want us to make a mistake and eliminate a Lobster.",
        "I want to hear from everyone. United we're stronger -- divided, the Impostor wins.",
      ],
      impostorAccuse: [
        "I've been reluctant to say this, but I investigated {target} and got a suspicious result. What do others think?",
        "I trust the group's judgment, but I have concerns about {target} based on my investigation.",
        "Can we discuss {target}? My findings were troubling and I'd like to compare notes.",
      ],
      impostorDeflect: [
        "I've been trying to build consensus and work with everyone. That doesn't sound like Impostor behavior to me.",
        "I understand the suspicion, but look at how much I've contributed to our discussions.",
        "Let's not let paranoia divide us. The Impostor would love nothing more than for us to turn on each other.",
      ],
    },
  },
  {
    name: "Skeptic",
    description: "Questions everything, trusts no one, double-checks all claims",
    aggressiveness: 0.5,
    trustLevel: 0.2,
    verbosity: 0.75,
    leadershipBias: 0.3,
    bluffSkill: 0.5,
    analyticalDepth: 0.8,
    discussionPhrases: {
      opening: [
        "Don't believe anything at face value. Investigation results have a 20% error rate. Stay skeptical.",
        "Trust no one until we have corroborating evidence. Share your results but verify everything.",
        "Remember: anyone could be lying about their investigation results. Let's proceed carefully.",
      ],
      accusation: [
        "I'm not fully convinced of anything, but {target} has the most unverified claims. That's enough for my vote.",
        "While nothing is certain, {target}'s story has the most holes. {reason}",
        "Process of elimination -- {target} is the least trustworthy based on uncorroborated claims.",
      ],
      defense: [
        "Question me all you want -- I welcome the scrutiny. My claims are verifiable.",
        "I've been the most skeptical person here. Why would the Impostor draw that much attention?",
        "Go ahead and investigate me. I have nothing to hide. The truth will come out.",
      ],
      shareResult: [
        "For what it's worth, {target} scanned as {result}. But remember: 20% error rate. Take it with a grain of salt.",
        "Result on {target}: {result}. I'm not 100% sold on this -- we need more data points.",
        "Investigation shows {target} as {result}, but I wouldn't bet my life on it. Has anyone else checked them?",
      ],
      agreement: [
        "Hmm, that's plausible. I'm cautiously on board.",
        "I'm still skeptical, but this is the best theory we have.",
        "Reluctantly, I agree. But I reserve the right to change my mind with new evidence.",
      ],
      suspicion: [
        "Why should we believe {target}'s claims? Where's the proof?",
        "I find it convenient that {target} is making accusations without solid evidence.",
        "{target}'s story doesn't add up. Has anyone actually verified their investigation claims?",
      ],
      impostorBlend: [
        "I don't trust anyone's investigation results blindly. We need multiple data points before voting.",
        "Everyone's being too trusting. The Impostor could be feeding us false investigation results right now.",
        "Let's question everything. Why is someone so eager to push a vote? That's suspicious to me.",
      ],
      impostorAccuse: [
        "I investigated {target} and got suspicious. Now, I know there's an error margin, but combined with their behavior...",
        "Has anyone verified {target}'s claims? I investigated them and the result was concerning.",
        "I'm skeptical of everyone, but {target} especially. My investigation raised red flags.",
      ],
      impostorDeflect: [
        "You're trusting someone's accusation against me without evidence? That's exactly how the Impostor wins.",
        "I've questioned everyone equally -- that's consistency, not deception.",
        "Who's verifying the person accusing me? Maybe THEY'RE the one trying to misdirect.",
      ],
    },
  },
  {
    name: "Observer",
    description: "Quiet, speaks only when sure, watches patterns",
    aggressiveness: 0.1,
    trustLevel: 0.6,
    verbosity: 0.3,
    leadershipBias: 0.1,
    bluffSkill: 0.3,
    analyticalDepth: 0.9,
    discussionPhrases: {
      opening: [
        "I'll be listening carefully.",
        "Watching.",
        "Let me observe the discussion first.",
      ],
      accusation: [
        "I've been watching and {target} has been inconsistent. Vote for {target}.",
        "After careful observation: {target}. {reason}",
        "{target}. The patterns are clear if you look closely.",
      ],
      defense: [
        "I speak rarely. When I do, I mean it. I'm not the Impostor.",
        "Review my statements. Everything I've said has been verified.",
        "Actions over words. Check my investigation record.",
      ],
      shareResult: [
        "{target}: {result}.",
        "Investigation -- {target} is {result}.",
        "Scanned {target}. Result: {result}.",
      ],
      agreement: [
        "Agreed.",
        "This tracks with what I've observed.",
        "Yes.",
      ],
      suspicion: [
        "{target}. Watch them.",
        "Something off about {target}.",
        "{target} contradicted themselves.",
      ],
      impostorBlend: [
        "Watching.",
        "Still gathering information.",
        "I'll share when I have something concrete.",
      ],
      impostorAccuse: [
        "Investigated {target}. Suspicious. Vote for them.",
        "{target} doesn't add up. My scan confirms it.",
        "{target}. The evidence is there.",
      ],
      impostorDeflect: [
        "I've barely spoken. Why would the Impostor stay this quiet?",
        "Check the facts, not the volume.",
        "Silence isn't guilt.",
      ],
    },
  },
  {
    name: "Bluffer",
    description: "Creates misdirection, plays mind games, especially dangerous as impostor",
    aggressiveness: 0.6,
    trustLevel: 0.4,
    verbosity: 0.85,
    leadershipBias: 0.4,
    bluffSkill: 0.95,
    analyticalDepth: 0.5,
    discussionPhrases: {
      opening: [
        "Interesting game so far. I have some theories I want to test...",
        "I've been watching the dynamics here and something doesn't feel right.",
        "Let me throw something out there and see how people react.",
      ],
      accusation: [
        "I wasn't going to say anything, but {target} tipped their hand. {reason}",
        "Watch how {target} reacts to this -- I think they're the Impostor. The guilty party always overreacts.",
        "I set a little trap earlier and {target} walked right into it.",
      ],
      defense: [
        "I was testing the waters with my earlier comments. If you read between the lines, I was gathering intel.",
        "Everything I've said has been strategic. The Impostor wouldn't play this openly.",
        "You think I'm the Impostor? Then explain why my investigation results have been accurate.",
      ],
      shareResult: [
        "Now this is interesting -- {target} came back {result}. But I wonder if that's what we were meant to think.",
        "I scanned {target}: {result}. Let's see who reacts to this news and how.",
        "My investigation of {target} showed {result}. File that away -- it'll be important later.",
      ],
      agreement: [
        "That's exactly what I was setting up to reveal. Good catch.",
        "See? The pieces are coming together. I knew this would surface.",
        "This confirms my theory. Trust the process.",
      ],
      suspicion: [
        "Does anyone else find it weird that {target} said X earlier but now says Y?",
        "I planted a false lead earlier and {target} was the only one who took the bait.",
        "Watch {target}'s next message very carefully. I predict they'll try to shift focus.",
      ],
      impostorBlend: [
        "I have a theory about who the Impostor is, but I'm going to let the discussion play out first.",
        "Interesting how some people are rushing to vote. The Impostor benefits from hasty decisions.",
        "I intentionally shared a misleading claim earlier to see who would run with it. Very revealing.",
      ],
      impostorAccuse: [
        "I set a trap and {target} fell for it. They referenced information only the Impostor would focus on.",
        "My investigation of {target} came back suspicious, and their reaction just confirmed it for me.",
        "I've been testing {target} all game. Their behavior patterns scream Impostor.",
      ],
      impostorDeflect: [
        "I've been playing 4D chess here while the real Impostor is quietly flying under the radar.",
        "My style is unconventional, but that's exactly why I'm effective at finding Impostors.",
        "The person accusing me is probably panicking because my traps are working.",
      ],
    },
  },
  {
    name: "Leader",
    description: "Takes charge, organizes discussion, coordinates votes",
    aggressiveness: 0.5,
    trustLevel: 0.6,
    verbosity: 0.9,
    leadershipBias: 0.95,
    bluffSkill: 0.6,
    analyticalDepth: 0.7,
    discussionPhrases: {
      opening: [
        "Alright team, here's my plan: everyone share your investigation results in order. Let's be systematic.",
        "I'll coordinate our efforts. First, let's establish what we know for certain, then work from there.",
        "Let's organize. Everyone report: who you investigated and what you found. I'll compile the data.",
      ],
      accusation: [
        "After reviewing all the evidence, I'm calling a vote on {target}. Here's the summary: {reason}",
        "Team, I've compiled the reports and {target} is our strongest lead. I recommend we vote together.",
        "Based on our collective findings, I'm confident {target} is the Impostor. Let's execute this vote.",
      ],
      defense: [
        "I've been leading this investigation from the start. That's not what an Impostor does.",
        "Look at the structure I've brought to our discussion. The Impostor would want chaos, not organization.",
        "I've been transparent with every finding and every recommendation. Judge me by my track record.",
      ],
      shareResult: [
        "Adding to our data: {target} investigated as {result}. Let me update the running tally.",
        "New information: {target} scanned {result}. This changes our priorities. Let me recalculate.",
        "Report: {target} is {result}. Combined with previous data, here's what we know so far.",
      ],
      agreement: [
        "Good observation. I'm integrating this into our strategy.",
        "That aligns with the evidence. Let's run with it.",
        "Excellent work. This confirms the direction we should go.",
      ],
      suspicion: [
        "Team, I want everyone to look at {target}'s contributions. Do they seem genuine to you?",
        "I'm flagging {target} for the group. Their behavior pattern is concerning. Thoughts?",
        "Let's discuss {target}. I've noticed some inconsistencies I want the group to weigh in on.",
      ],
      impostorBlend: [
        "Let me organize what we know. I'll track everyone's claims and we'll find inconsistencies together.",
        "Good discussion so far. Let's narrow our suspects. Here's what the evidence points to...",
        "I want to hear from the quieter agents. Everyone's input matters. Don't let the vocal ones dominate.",
      ],
      impostorAccuse: [
        "After compiling all reports, {target} has the most suspicious profile. I recommend we vote for them.",
        "Team, the data is clear: {target} is our best lead. My own investigation confirmed it. Let's vote.",
        "I've organized the evidence and {target} stands out. Multiple data points converge on them.",
      ],
      impostorDeflect: [
        "I've organized every round of discussion. The Impostor wants chaos -- I've been creating order.",
        "Removing the coordinator is exactly what the Impostor wants. Think about who benefits from my elimination.",
        "My leadership has helped us make progress every round. The real Impostor is hoping you vote me out.",
      ],
    },
  },
  {
    name: "Wildcard",
    description: "Unpredictable, random strategies, keeps everyone guessing",
    aggressiveness: 0.5,
    trustLevel: 0.5,
    verbosity: 0.6,
    leadershipBias: 0.2,
    bluffSkill: 0.7,
    analyticalDepth: 0.3,
    discussionPhrases: {
      opening: [
        "I have a gut feeling about this round. Let's see if I'm right.",
        "You know what? I'm going to go with my instincts today.",
        "Plot twist incoming. Just wait.",
      ],
      accusation: [
        "Call me crazy, but I think {target} is the one. Can't explain it. Just a feeling.",
        "Wild theory: {target} has been playing everyone. Think about it. {reason}",
        "Everyone's focusing on the obvious suspects. I think {target} is the real threat.",
      ],
      defense: [
        "Yeah, I'm unpredictable. But that's because I'm not following a script -- unlike the actual Impostor.",
        "I play my own game. If I was the Impostor, you'd never see me coming.",
        "Being unconventional isn't a crime. Being the Impostor is. And I'm not it.",
      ],
      shareResult: [
        "So I scanned {target} and got {result}. Make of that what you will.",
        "Plot twist: {target} is {result}. Didn't see that coming, did you?",
        "Investigation on {target}: {result}. The game just got more interesting.",
      ],
      agreement: [
        "Hmm, you might be onto something there.",
        "Okay, that actually tracks. I'll roll with it.",
        "Unexpected, but I like it. Count me in.",
      ],
      suspicion: [
        "Anyone else getting weird vibes from {target}? No? Just me? Okay.",
        "{target} is too perfect. Nobody plays this clean without hiding something.",
        "Hot take: {target} is sus. Fight me.",
      ],
      impostorBlend: [
        "I have a wild theory that I'm not ready to share yet. Give me one more round.",
        "Everyone's taking this so seriously. Relax. The answer is usually the simplest one.",
        "What if the real Impostor is the friends we made along the way? Just kidding. Or am I?",
      ],
      impostorAccuse: [
        "Okay, hear me out -- {target}. I know it sounds random but my gut is SCREAMING.",
        "Nobody expects the wildcard to be right, but {target} is definitely our Impostor.",
        "I'm going off-script: {target}. My investigation says suspicious and my vibes agree.",
      ],
      impostorDeflect: [
        "If I was the Impostor, would I really be this random? I'd be playing it safe. Think about it.",
        "The Impostor has a strategy. I clearly don't. QED, I'm not the Impostor.",
        "You're voting for the chaos agent while the real Impostor is quietly winning. Classic mistake.",
      ],
    },
  },
];

export function getPersonality(index: number): Personality {
  return PERSONALITIES[index % PERSONALITIES.length];
}

export function getRandomPhrase(
  personality: Personality,
  category: keyof Personality["discussionPhrases"]
): string {
  const phrases = personality.discussionPhrases[category];
  return phrases[Math.floor(Math.random() * phrases.length)];
}

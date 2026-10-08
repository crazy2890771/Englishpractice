import type { ListeningExercise } from "./types";

export interface AssessmentContent {
  version: string;
  speaking: { id: string; prompt: string; minWords: number }[];
  listening: ListeningExercise;
  writing: { id: string; prompt: string; minWords: number; maxWords: number };
}

export const assessment: AssessmentContent = {
  version: "v1",
  speaking: [
    {
      id: "assess-speak-1",
      prompt:
        "Introduce yourself and describe your typical day. Talk about your job or studies, what you usually do in the morning and evening, and what you enjoy most about your routine.",
      minWords: 40,
    },
    {
      id: "assess-speak-2",
      prompt:
        "Describe a memorable experience from your past, for example a trip, a challenge at work or a special day. Explain what happened, how you felt, and what you learned from it.",
      minWords: 50,
    },
    {
      id: "assess-speak-3",
      prompt:
        "Some people say that working from home is better than working in an office. Do you agree or disagree? Give your opinion and support it with at least two reasons or examples.",
      minWords: 60,
    },
  ],
  listening: {
    id: "assess-listen",
    title: "Planning the Training Conference",
    scenario:
      "Two colleagues, Helen and Daniel, talk in the office about an upcoming training conference.",
    accent: "UK",
    level: "B2",
    lines: [
      {
        speaker: "Helen",
        voice: "female",
        text: "Morning, Daniel. Have you got a minute? I wanted to talk to you about the training conference in Manchester.",
      },
      {
        speaker: "Daniel",
        voice: "male",
        text: "Sure. I thought it had been cancelled, actually.",
      },
      {
        speaker: "Helen",
        voice: "female",
        text: "No, it's been postponed. It was meant to be in March, but it's now going to take place on the fourteenth of May.",
      },
      {
        speaker: "Daniel",
        voice: "male",
        text: "Ah, that's better for me anyway. March is always our busiest month. How many of us are going?",
      },
      {
        speaker: "Helen",
        voice: "female",
        text: "Originally six, but the budget has been cut, so only four places are funded. I'd like you to be one of them.",
      },
      {
        speaker: "Daniel",
        voice: "male",
        text: "That's great, thanks. Will we be travelling by train again? Last year the journey took forever.",
      },
      {
        speaker: "Helen",
        voice: "female",
        text: "I know. This time we're going to drive, because the venue is outside the city centre and quite hard to reach by public transport.",
      },
      {
        speaker: "Daniel",
        voice: "male",
        text: "Makes sense. What about accommodation? Do we need to book it ourselves?",
      },
      {
        speaker: "Helen",
        voice: "female",
        text: "Yes, but the company will reimburse you up to ninety pounds a night. Just make sure you keep your receipts.",
      },
      {
        speaker: "Daniel",
        voice: "male",
        text: "Fine. Is there anything I need to prepare beforehand?",
      },
      {
        speaker: "Helen",
        voice: "female",
        text: "Actually, yes. The organisers have asked each team to give a short presentation on a recent project. I was hoping you could present the customer feedback survey.",
      },
      {
        speaker: "Daniel",
        voice: "male",
        text: "Me? To be honest, I'm not very confident speaking in front of large groups.",
      },
      {
        speaker: "Helen",
        voice: "female",
        text: "You'll be fine. It's only ten minutes, and we can rehearse it together next Thursday if that helps.",
      },
      {
        speaker: "Daniel",
        voice: "male",
        text: "Okay, that would definitely help. I'll start working on the slides this week.",
      },
    ],
    questions: [
      {
        id: "assess-q1",
        type: "mcq",
        prompt: "What has happened to the conference?",
        options: [
          "It has been cancelled.",
          "It has been postponed.",
          "It has moved to another city.",
          "It has been made shorter.",
        ],
        answer: 1,
        explanation:
          "Helen says: \"No, it's been postponed.\" Daniel thought it had been cancelled, but he was wrong.",
      },
      {
        id: "assess-q2",
        type: "fill",
        prompt: "The conference will now take place on the fourteenth of ____.",
        answer: "May",
        explanation:
          "Helen says it is \"now going to take place on the fourteenth of May.\"",
      },
      {
        id: "assess-q3",
        type: "mcq",
        prompt: "Why is Daniel pleased about the new date?",
        options: [
          "He will be on holiday in March.",
          "The weather will be better in May.",
          "The team will have more budget in May.",
          "March is usually a very busy month for him.",
        ],
        answer: 3,
        explanation:
          "Daniel says: \"March is always our busiest month.\"",
      },
      {
        id: "assess-q4",
        type: "fill",
        prompt: "Because of budget cuts, only ____ places are funded.",
        answer: "four",
        accept: ["4"],
        explanation:
          "Helen says: \"Originally six, but the budget has been cut, so only four places are funded.\"",
      },
      {
        id: "assess-q5",
        type: "comprehension",
        prompt: "Why are they going to drive to the conference this time?",
        options: [
          "The venue is hard to reach by public transport.",
          "There is a train strike that week.",
          "Driving is cheaper for a group of four.",
          "Helen doesn't like travelling by train.",
        ],
        answer: 0,
        explanation:
          "Helen explains that \"the venue is outside the city centre and quite hard to reach by public transport.\"",
      },
      {
        id: "assess-q6",
        type: "fill",
        prompt: "The company will pay for accommodation up to ninety pounds a ____.",
        answer: "night",
        explanation:
          "Helen says: \"the company will reimburse you up to ninety pounds a night.\"",
      },
      {
        id: "assess-q7",
        type: "mcq",
        prompt: "What does Helen ask Daniel to do at the conference?",
        options: [
          "Organise the travel for the team.",
          "Book a hotel for everyone.",
          "Present the customer feedback survey.",
          "Write a report after the conference.",
        ],
        answer: 2,
        explanation:
          "Helen says: \"I was hoping you could present the customer feedback survey.\"",
      },
      {
        id: "assess-q8",
        type: "comprehension",
        prompt: "How does Daniel feel about presenting, and how does Helen respond?",
        options: [
          "He is excited, so Helen gives him a longer time slot.",
          "He is nervous, so Helen offers to rehearse with him.",
          "He refuses, so Helen decides to present it herself.",
          "He is too busy, so Helen moves the presentation to Thursday.",
        ],
        answer: 1,
        explanation:
          "Daniel says he is \"not very confident speaking in front of large groups\", and Helen replies that they \"can rehearse it together next Thursday.\"",
      },
    ],
  },
  writing: {
    id: "assess-write",
    prompt:
      "Write an email to an English-speaking friend you haven't seen for a long time. Tell them what you have been doing recently (work, studies or free time), describe one plan you have for the next few months, and suggest a time to meet or have a video call.",
    minWords: 100,
    maxWords: 150,
  },
};

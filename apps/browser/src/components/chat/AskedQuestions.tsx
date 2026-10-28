import { AiChatMessageLine } from "@oxy.so/bloom/ai-chat";
import { Card, CardBody } from "@oxy.so/bloom/card";
import { Questionnaire, type QuestionnaireAnswers } from "@oxy.so/bloom/questionnaire";
import { useState } from "react";
import { View } from "react-native";
import { formatAnswers, type Asked, type AskedQuestion } from "../../ai/chat/questions";

export function PendingQuestions({ asked, onAnswer, onSkip }: { asked: Asked; onAnswer: (text: string) => void; onSkip: () => void }) {
  const [sent, setSent] = useState(false);
  if (sent) return null;
  return (
    <Questionnaire
      testID={`ask-${asked.toolCallId}`}
      questions={asked.questions.map((q, i) => ({
        id: String(i),
        question: q.question,
        select: q.multiSelect ? "multiple" : "single",
        other: true,
        ...(asked.questions.length > 1 ? { stepLabel: `Question ${i + 1}` } : {}),
        options: q.options.map((o, j) => ({ value: String(j), label: o.label, ...(o.description ? { description: o.description } : {}) })),
      }))}
      onComplete={(answers) => {
        setSent(true);
        onAnswer(answersText(asked.questions, answers));
      }}
      onDismiss={() => {
        setSent(true);
        onSkip();
      }}
      labels={{ dismiss: "Skip", complete: "Send" }}
    />
  );
}

function answersText(questions: AskedQuestion[], answers: QuestionnaireAnswers): string {
  return formatAnswers(
    questions,
    questions.map((_, i) => {
      const answer = answers[String(i)];
      return {
        picked: (answer?.values ?? []).map(Number).filter((n) => Number.isInteger(n)).sort((a, b) => a - b),
        ...(answer?.other ? { other: answer.other } : {}),
      };
    }),
  );
}

export function AskedCard({ questions }: { questions: AskedQuestion[] }) {
  return (
    <Card appearance="outline">
      <CardBody>
        <View style={{ gap: 10 }}>
          {questions.map((q, i) => (
            <View key={i} style={{ gap: 2 }}>
              <AiChatMessageLine>{q.question}</AiChatMessageLine>
              <AiChatMessageLine tone="secondary">{q.options.map((o) => o.label).join(" · ")}</AiChatMessageLine>
            </View>
          ))}
        </View>
      </CardBody>
    </Card>
  );
}

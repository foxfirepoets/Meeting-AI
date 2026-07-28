export type TranscriptEntry = {
  id: string;
  speaker: string;
  text: string;
  timeLabel: string;
  timeSeconds: number;
  source: string;
};

export type Source = Pick<TranscriptEntry, "id" | "speaker" | "timeLabel" | "text">;

export type AnswerResult = {
  answer: string;
  sources: Source[];
  actions: string[];
  mode: "demo" | "live";
};

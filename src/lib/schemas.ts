import { z } from "zod";
import { normalizeSupportOptions } from "./support-options";

export const CorpusSourceTypeSchema = z.enum(["seed", "official", "crawled", "uploaded", "manual"]);
export const CorpusChunkTypeSchema = z.enum(["standard", "achievement_level", "remediation", "assessment", "metadata"]);

export const CitationSchema = z.object({
  standardId: z.string().min(1),
  title: z.string().min(1),
  source: z.string().min(1),
  locator: z.string().optional(),
  quote: z.string().min(1).optional(),
});

export const ResourceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(["standard", "activity", "rubric", "material", "reference"]),
  subject: z.string().min(1),
  gradeBand: z.string().min(1),
  tags: z.array(z.string()).default([]),
  url: z.string().url().optional(),
  summary: z.string().min(1),
  citations: z.array(CitationSchema).default([]),
  standardCode: z.string().optional(),
  sourceType: CorpusSourceTypeSchema.optional(),
  sourceName: z.string().optional(),
  sourceUrl: z.string().optional(),
  license: z.string().optional(),
  chunkType: CorpusChunkTypeSchema.optional(),
});

export const StandardDocumentSchema = z.object({
  id: z.string().min(1),
  sourceType: CorpusSourceTypeSchema.default("seed"),
  provider: z.string().min(1).default("다음한걸음"),
  sourceName: z.string().min(1).optional(),
  sourceUrl: z.string().url().optional(),
  license: z.string().optional(),
  collectedAt: z.string().datetime().default(() => new Date().toISOString()),
  curriculumYear: z.string().optional(),
  schoolLevel: z.string().optional(),
  grade: z.string().optional(),
  domain: z.string().optional(),
  standardCode: z.string().optional(),
  chunkType: CorpusChunkTypeSchema.default("standard"),
  keywords: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
  title: z.string().min(1),
  subject: z.string().min(1),
  gradeBand: z.string().min(1),
  source: z.string().min(1),
  url: z.string().url().optional(),
  tags: z.array(z.string()).default([]),
  text: z.string().min(20),
});

export const StandardChunkSchema = StandardDocumentSchema.omit({ text: true }).extend({
  chunkId: z.string().min(1),
  text: z.string().min(1),
  embedding: z.array(z.number()).min(1),
});

export const LessonSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["draft", "published"]).default("draft"),
  title: z.string().min(1),
  subject: z.string().min(1),
  gradeBand: z.string().min(1),
  topic: z.string().min(1),
  durationMinutes: z.number().int().min(5).max(240),
  objectives: z.array(z.string().min(1)).min(1),
  agenda: z.array(z.object({
    minute: z.number().int().min(0),
    activity: z.string().min(1),
    teacherMove: z.string().min(1),
    studentMove: z.string().min(1),
  })).min(1),
  materials: z.array(z.string()).default([]),
  assessment: z.string().min(1),
  differentiation: z.array(z.string()).default([]),
  citations: z.array(CitationSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  publishedAt: z.string().datetime().optional(),
});

export const ExecutionCardStepSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  studentInstruction: z.string().min(1),
  teacherPrompt: z.string().min(1),
  expectedEvidence: z.string().min(1),
  successCriteria: z.array(z.string().min(1)).min(1),
  estimatedMinutes: z.number().int().min(1).max(60),
});

export const ExecutionCardSchema = z.object({
  id: z.string().min(1),
  lessonId: z.string().min(1),
  status: z.enum(["draft", "published"]).default("draft"),
  title: z.string().min(1),
  gradeBand: z.string().min(1),
  subject: z.string().min(1),
  taskSummary: z.string().min(1),
  prerequisites: z.array(z.string()).default([]),
  steps: z.array(ExecutionCardStepSchema).min(2).max(8),
  checksForUnderstanding: z.array(z.string().min(1)).min(1),
  exitTicket: z.string().min(1),
  accessibilitySupports: z.array(z.string()).default([]),
  citations: z.array(CitationSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  publishedAt: z.string().datetime().optional(),
});

export const VisualHintPayloadSchema = z.object({
  type: z.enum(["text_only", "rectangle_dimension", "number_line", "sequence_checklist", "image_asset"]),
  data: z.record(z.unknown()).nullable().optional(),
  assetUrl: z.string().url().nullable().optional(),
  alt: z.string().nullable().optional(),
});

export const ExecutionCardPayloadStepSchema = z.object({
  id: z.string().min(1).optional(),
  order: z.number().int().min(1),
  stepText: z.string().min(1),
  visualHint: VisualHintPayloadSchema,
  microQuiz: z.object({
    question: z.string().min(1),
    choices: z.array(z.string().min(1)).min(1),
    answer: z.string().min(1),
    explanation: z.string().nullable().optional(),
  }),
  helpSentence: z.string().min(1),
  teacherTip: z.string().min(1),
});

export const ExecutionCardPayloadSchema = z.object({
  id: z.string().min(1).optional(),
  lessonId: z.string().min(1),
  title: z.string().min(1),
  goal: z.string().min(1),
  subject: z.string().min(1),
  grade: z.string().min(1),
  topic: z.string().min(1),
  standard: z.object({
    id: z.string().min(1).nullable().optional(),
    code: z.string().min(1).nullable().optional(),
    text: z.string().min(1),
    sourceType: z.string().min(1).nullable().optional(),
    sourceName: z.string().min(1).nullable().optional(),
    sourceUrl: z.string().min(1).nullable().optional(),
    license: z.string().min(1).nullable().optional(),
  }),
  keywords: z.array(z.object({
    word: z.string().min(1),
    easyMeaning: z.string().min(1),
  })),
  easyExplanation: z.string().min(1),
  steps: z.array(ExecutionCardPayloadStepSchema).min(3).max(5),
  review: z.object({
    goodPoints: z.array(z.string().min(1)),
    nextReview: z.array(z.object({
      title: z.string().min(1),
      type: z.enum(["video", "practice", "card", "text"]),
      description: z.string().min(1),
      resourceId: z.string().min(1).nullable().optional(),
    })),
    askTeacherSentence: z.string().min(1),
    homeMission: z.string().min(1).nullable().optional(),
  }),
});

export const GenerateLessonRequestSchema = z.object({
  title: z.string().optional(),
  teacherId: z.string().min(1).default("teacher_001"),
  classroomId: z.string().min(1).default("classroom_4_2"),
  schoolId: z.string().min(1).default("school_demo"),
  subject: z.string().min(1),
  gradeBand: z.string().min(1),
  topic: z.string().min(1),
  lessonDate: z.string().default(() => new Date().toISOString().slice(0, 10)),
  durationMinutes: z.number().int().min(5).max(240).default(45),
  objectives: z.array(z.string().min(1)).min(1).optional(),
  lessonContent: z.string().optional(),
  assignmentInstruction: z.string().optional(),
  selectedStandardId: z.string().nullable().optional(),
  selectedStandardText: z.string().optional(),
  selectedStandardSourceType: z.string().optional(),
  selectedStandardSourceName: z.string().optional(),
  selectedStandardSourceUrl: z.string().optional(),
  selectedStandardLicense: z.string().optional(),
  learnerContext: z.string().optional(),
  resourceQuery: z.string().optional(),
  supportOptions: z.array(z.string()).default(["easy_language", "step_breakdown", "visual_hint"]).transform(normalizeSupportOptions),
});

export const GenerateExecutionCardRequestSchema = z.object({
  lessonId: z.string().min(1).optional(),
  lesson: LessonSchema.partial().optional(),
  title: z.string().optional(),
  subject: z.string().min(1).optional(),
  gradeBand: z.string().min(1).optional(),
  grade: z.string().min(1).optional(),
  topic: z.string().min(1).optional(),
  lessonContent: z.string().optional(),
  assignmentInstruction: z.string().optional(),
  selectedStandardId: z.string().optional(),
  selectedStandardText: z.string().optional(),
  selectedStandardCode: z.string().optional(),
  selectedStandardSourceType: z.string().optional(),
  selectedStandardSourceName: z.string().optional(),
  selectedStandardSourceUrl: z.string().min(1).optional(),
  selectedStandardLicense: z.string().optional(),
  supportOptions: z.array(z.string()).optional().transform((options) => options ? normalizeSupportOptions(options) : undefined),
  objectives: z.array(z.string().min(1)).optional(),
  save: z.boolean().default(true),
});

export const UpdateLessonRequestSchema = LessonSchema.partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
}).extend({
  status: z.enum(["draft", "published"]).optional(),
});

export const UpdateExecutionCardRequestSchema = ExecutionCardPayloadSchema.partial().omit({
  id: true,
}).extend({
  status: z.enum(["draft", "published"]).optional(),
});

export const SearchRequestSchema = z.object({
  q: z.string().min(1),
  subject: z.string().optional(),
  gradeBand: z.string().optional(),
  sourceType: CorpusSourceTypeSchema.optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(20).default(5),
});

export const IngestStandardsRequestSchema = z.object({
  documents: z.array(StandardDocumentSchema).min(1).optional(),
  reset: z.boolean().default(false),
});

export const GenerateReportRequestSchema = z.object({
  studentId: z.string().min(1),
  lessonId: z.string().min(1).optional(),
  executionCardId: z.string().min(1).optional(),
  studentName: z.string().optional(),
  evidence: z.array(z.string().min(1)).min(1),
  audience: z.enum(["teacher", "student", "guardian"]).default("teacher"),
});

export const ReportSchema = z.object({
  id: z.string().min(1),
  lessonId: z.string().optional(),
  executionCardId: z.string().optional(),
  audience: z.enum(["teacher", "student", "guardian"]),
  summary: z.string().min(1),
  strengths: z.array(z.string().min(1)).min(1),
  nextSteps: z.array(z.string().min(1)).min(1),
  evidenceNotes: z.array(z.string().min(1)).min(1),
  citations: z.array(CitationSchema).default([]),
  createdAt: z.string().datetime(),
});

export type Citation = z.infer<typeof CitationSchema>;
export type Resource = z.infer<typeof ResourceSchema>;
export type StandardDocument = z.infer<typeof StandardDocumentSchema>;
export type StandardChunk = z.infer<typeof StandardChunkSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
export type ExecutionCard = z.infer<typeof ExecutionCardSchema>;
export type Report = z.infer<typeof ReportSchema>;

export const executionCardJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "goal",
    "subject",
    "grade",
    "topic",
    "standard",
    "keywords",
    "easyExplanation",
    "steps",
    "review",
  ],
  properties: {
    title: { type: "string", minLength: 1 },
    goal: { type: "string", minLength: 1 },
    subject: { type: "string", minLength: 1 },
    grade: { type: "string", minLength: 1 },
    topic: { type: "string", minLength: 1 },
    standard: {
      type: "object",
      additionalProperties: false,
      required: ["id", "code", "text", "sourceType", "sourceName", "sourceUrl", "license"],
      properties: {
        id: { type: ["string", "null"] },
        code: { type: ["string", "null"] },
        text: { type: "string", minLength: 1 },
        sourceType: { type: ["string", "null"] },
        sourceName: { type: ["string", "null"] },
        sourceUrl: { type: ["string", "null"] },
        license: { type: ["string", "null"] },
      },
    },
    keywords: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["word", "easyMeaning"],
        properties: {
          word: { type: "string", minLength: 1 },
          easyMeaning: { type: "string", minLength: 1 },
        },
      },
    },
    easyExplanation: { type: "string", minLength: 1 },
    steps: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "order",
          "stepText",
          "visualHint",
          "microQuiz",
          "helpSentence",
          "teacherTip",
        ],
        properties: {
          order: { type: "integer", minimum: 1 },
          stepText: { type: "string", minLength: 1 },
          visualHint: {
            type: "object",
            additionalProperties: false,
            required: ["type", "data", "assetUrl", "alt"],
            properties: {
              type: {
                type: "string",
                enum: ["text_only", "rectangle_dimension", "number_line", "sequence_checklist", "image_asset"],
              },
              data: {
                type: ["object", "null"],
                additionalProperties: false,
                required: ["text", "labels", "items", "start", "end"],
                properties: {
                  text: { type: ["string", "null"] },
                  labels: { type: ["array", "null"], items: { type: "string" } },
                  items: { type: ["array", "null"], items: { type: "string" } },
                  start: { type: ["number", "null"] },
                  end: { type: ["number", "null"] },
                },
              },
              assetUrl: { type: ["string", "null"] },
              alt: { type: ["string", "null"] },
            },
          },
          microQuiz: {
            type: "object",
            additionalProperties: false,
            required: ["question", "choices", "answer", "explanation"],
            properties: {
              question: { type: "string", minLength: 1 },
              choices: {
                type: "array",
                minItems: 1,
                items: { type: "string", minLength: 1 },
              },
              answer: { type: "string", minLength: 1 },
              explanation: { type: ["string", "null"] },
            },
          },
          helpSentence: { type: "string", minLength: 1 },
          teacherTip: { type: "string", minLength: 1 },
        },
      },
    },
    review: {
      type: "object",
      additionalProperties: false,
      required: ["goodPoints", "nextReview", "askTeacherSentence", "homeMission"],
      properties: {
        goodPoints: {
          type: "array",
          items: { type: "string", minLength: 1 },
        },
        nextReview: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "type", "description", "resourceId"],
            properties: {
              title: { type: "string", minLength: 1 },
              type: { type: "string", enum: ["video", "practice", "card", "text"] },
              description: { type: "string", minLength: 1 },
              resourceId: { type: ["string", "null"] },
            },
          },
        },
        askTeacherSentence: { type: "string", minLength: 1 },
        homeMission: { type: ["string", "null"] },
      },
    },
  },
} as const;

export const legacyExecutionCardJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "gradeBand",
    "subject",
    "taskSummary",
    "prerequisites",
    "steps",
    "checksForUnderstanding",
    "exitTicket",
    "accessibilitySupports",
    "citations",
  ],
  properties: {
    title: { type: "string", minLength: 1 },
    gradeBand: { type: "string", minLength: 1 },
    subject: { type: "string", minLength: 1 },
    taskSummary: { type: "string", minLength: 1 },
    prerequisites: { type: "array", items: { type: "string" } },
    steps: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "label",
          "studentInstruction",
          "teacherPrompt",
          "expectedEvidence",
          "successCriteria",
          "estimatedMinutes",
        ],
        properties: {
          id: { type: "string", minLength: 1 },
          label: { type: "string", minLength: 1 },
          studentInstruction: { type: "string", minLength: 1 },
          teacherPrompt: { type: "string", minLength: 1 },
          expectedEvidence: { type: "string", minLength: 1 },
          successCriteria: {
            type: "array",
            minItems: 1,
            items: { type: "string", minLength: 1 },
          },
          estimatedMinutes: { type: "integer", minimum: 1, maximum: 60 },
        },
      },
    },
    checksForUnderstanding: {
      type: "array",
      minItems: 1,
      items: { type: "string", minLength: 1 },
    },
    exitTicket: { type: "string", minLength: 1 },
    accessibilitySupports: { type: "array", items: { type: "string" } },
    citations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["standardId", "title", "source", "locator", "quote"],
        properties: {
          standardId: { type: "string", minLength: 1 },
          title: { type: "string", minLength: 1 },
          source: { type: "string", minLength: 1 },
          locator: { type: "string", minLength: 1 },
          quote: { type: "string", minLength: 1 },
        },
      },
    },
  },
} as const;

export const lessonJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "subject",
    "gradeBand",
    "topic",
    "durationMinutes",
    "objectives",
    "agenda",
    "materials",
    "assessment",
    "differentiation",
    "citations",
  ],
  properties: {
    title: { type: "string", minLength: 1 },
    subject: { type: "string", minLength: 1 },
    gradeBand: { type: "string", minLength: 1 },
    topic: { type: "string", minLength: 1 },
    durationMinutes: { type: "integer", minimum: 5, maximum: 240 },
    objectives: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
    agenda: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["minute", "activity", "teacherMove", "studentMove"],
        properties: {
          minute: { type: "integer", minimum: 0 },
          activity: { type: "string", minLength: 1 },
          teacherMove: { type: "string", minLength: 1 },
          studentMove: { type: "string", minLength: 1 },
        },
      },
    },
    materials: { type: "array", items: { type: "string" } },
    assessment: { type: "string", minLength: 1 },
    differentiation: { type: "array", items: { type: "string" } },
    citations: legacyExecutionCardJsonSchema.properties.citations,
  },
} as const;

export const reportJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "strengths", "nextSteps", "evidenceNotes", "citations"],
  properties: {
    summary: { type: "string", minLength: 1 },
    strengths: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
    nextSteps: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
    evidenceNotes: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
    citations: legacyExecutionCardJsonSchema.properties.citations,
  },
} as const;

export function validationError(error: z.ZodError) {
  return {
    error: "validation_error",
    details: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}

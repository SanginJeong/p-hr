import mongoose, { Schema, model, models, type Model, type Types } from "mongoose";

import {
  DEFAULT_TIMEZONE,
  DEFAULT_WORK_DAYS,
  POLICY_TYPES,
  TIME_PATTERN,
  timeToMinutes,
  type PolicyType,
} from "./constants";

/** 휴게시간 구간. 실근무시간 계산 시 차감한다. */
export interface BreakTime {
  startTime: string;
  endTime: string;
}

/** 고정 출퇴근 설정. */
export interface FixedPolicyConfig {
  /** 출근 시각 */
  workStartTime: string;
  /** 퇴근 시각 */
  workEndTime: string;
  /** 지각 유예시간(분). workStartTime + 유예시간까지는 지각이 아니다. */
  lateGraceMinutes: number;
}

/** 유연 출퇴근 설정. */
export interface FlexiblePolicyConfig {
  /** 출근 가능 시간 시작 */
  clockInStartTime: string;
  /** 출근 가능 시간 종료 */
  clockInEndTime: string;
  /** 일일 소정 근무시간(분) */
  dailyRequiredMinutes: number;
  /** 코어타임 시작 (선택) */
  coreTimeStartTime?: string | null;
  /** 코어타임 종료 (선택) */
  coreTimeEndTime?: string | null;
}

export interface IAttendancePolicy {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  type: PolicyType;
  /** 0=일 ... 6=토 */
  workDays: number[];
  timezone: string;
  breakTimes: BreakTime[];
  /** type === "FIXED" 일 때만 존재 */
  fixed?: FixedPolicyConfig | null;
  /** type === "FLEXIBLE" 일 때만 존재 */
  flexible?: FlexiblePolicyConfig | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const timeField = {
  type: String,
  required: true,
  match: [TIME_PATTERN, "시각은 HH:mm 형식이어야 합니다."],
} as const;

/**
 * 교차 필드 검증은 pre("validate") 훅이 아니라 동기 validator 로 둔다.
 * 훅은 validateSync() 에서 실행되지 않아 검증이 조용히 빠질 수 있다.
 */

/** 근태 기록의 정책 스냅샷에서도 재사용하므로 export 한다. */
export const breakTimeSchema = new Schema<BreakTime>(
  {
    startTime: timeField,
    endTime: {
      ...timeField,
      validate: {
        validator: function (value: string) {
          const { startTime } = this as unknown as BreakTime;
          return timeToMinutes(startTime) < timeToMinutes(value);
        },
        message: "휴게 종료 시각은 시작 시각보다 늦어야 합니다.",
      },
    },
  },
  { _id: false },
);

export const fixedPolicyConfigSchema = new Schema<FixedPolicyConfig>(
  {
    workStartTime: timeField,
    workEndTime: {
      ...timeField,
      validate: {
        validator: function (value: string) {
          const { workStartTime } = this as unknown as FixedPolicyConfig;
          return timeToMinutes(workStartTime) < timeToMinutes(value);
        },
        message: "퇴근 시각은 출근 시각보다 늦어야 합니다.",
      },
    },
    lateGraceMinutes: { type: Number, required: true, default: 0, min: 0, max: 24 * 60 },
  },
  { _id: false },
);

export const flexiblePolicyConfigSchema = new Schema<FlexiblePolicyConfig>(
  {
    clockInStartTime: timeField,
    clockInEndTime: {
      ...timeField,
      validate: {
        validator: function (value: string) {
          const { clockInStartTime } = this as unknown as FlexiblePolicyConfig;
          return timeToMinutes(clockInStartTime) < timeToMinutes(value);
        },
        message: "출근 가능 종료 시각은 시작 시각보다 늦어야 합니다.",
      },
    },
    dailyRequiredMinutes: { type: Number, required: true, min: 1, max: 24 * 60 },
    coreTimeStartTime: { type: String, match: TIME_PATTERN, default: null },
    coreTimeEndTime: {
      type: String,
      match: TIME_PATTERN,
      default: null,
      // 코어타임은 시작·종료가 함께 있어야 하고, 순서가 맞아야 한다.
      validate: {
        validator: function (value: string | null) {
          const start = (this as unknown as FlexiblePolicyConfig).coreTimeStartTime;

          if (!start && !value) {
            return true;
          }

          if (!start || !value) {
            return false;
          }

          return timeToMinutes(start) < timeToMinutes(value);
        },
        message: "코어타임은 시작·종료를 함께 설정하고, 종료가 시작보다 늦어야 합니다.",
      },
    },
  },
  { _id: false },
);

export interface AttendancePolicyModel extends Model<IAttendancePolicy> {
  /**
   * 정책이 삭제 가능한지 검사한다.
   * 팀에 적용 중이거나 과거 근태 기록이 참조하고 있으면 Error 를 던진다.
   */
  assertDeletable(policyId: Types.ObjectId | string): Promise<void>;
}

const attendancePolicySchema = new Schema<IAttendancePolicy, AttendancePolicyModel>(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
    type: { type: String, required: true, enum: POLICY_TYPES },
    workDays: {
      type: [{ type: Number, min: 0, max: 6 }],
      required: true,
      default: () => [...DEFAULT_WORK_DAYS],
      validate: {
        validator: (days: number[]) => days.length > 0 && new Set(days).size === days.length,
        message: "근무일은 중복 없이 최소 하루 이상 지정해야 합니다.",
      },
    },
    timezone: { type: String, required: true, default: DEFAULT_TIMEZONE, trim: true },
    breakTimes: { type: [breakTimeSchema], default: [] },
    // 한 문서에 두 유형의 설정이 공존할 수 없다. 유형에 맞는 설정만 필수이고, 반대쪽은 금지된다.
    fixed: {
      type: fixedPolicyConfigSchema,
      default: null,
      required: function (this: IAttendancePolicy) {
        return this.type === "FIXED";
      },
      validate: {
        validator: function (value: FixedPolicyConfig | null) {
          return (this as unknown as IAttendancePolicy).type === "FIXED" || value == null;
        },
        message: "유연 출퇴근 정책에는 고정 출퇴근 설정을 둘 수 없습니다.",
      },
    },
    flexible: {
      type: flexiblePolicyConfigSchema,
      default: null,
      required: function (this: IAttendancePolicy) {
        return this.type === "FLEXIBLE";
      },
      validate: {
        validator: function (value: FlexiblePolicyConfig | null) {
          return (this as unknown as IAttendancePolicy).type === "FLEXIBLE" || value == null;
        },
        message: "고정 출퇴근 정책에는 유연 출퇴근 설정을 둘 수 없습니다.",
      },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

attendancePolicySchema.statics.assertDeletable = async function (
  policyId: Types.ObjectId | string,
): Promise<void> {
  // 순환 참조를 피하기 위해 런타임에 로드한다.
  const [{ Team }, { AttendanceRecord }] = await Promise.all([
    import("./team.model"),
    import("./attendance-record.model"),
  ]);

  const [teamInUse, recordInUse] = await Promise.all([
    Team.exists({ attendancePolicyId: policyId }),
    AttendanceRecord.exists({ appliedPolicyId: policyId }),
  ]);

  if (teamInUse) {
    throw new Error("팀에서 사용 중인 근태 정책은 삭제할 수 없습니다.");
  }

  if (recordInUse) {
    throw new Error("근태 기록에서 참조 중인 근태 정책은 삭제할 수 없습니다.");
  }
};

/** 삭제 경로가 늘어나도 가드가 빠지지 않도록 쿼리 미들웨어로 강제한다. */
async function guardPolicyDeletion(this: mongoose.Query<unknown, IAttendancePolicy>) {
  const policyId = this.getFilter()._id;

  if (!policyId) {
    throw new Error("근태 정책은 _id 조건 없이 삭제할 수 없습니다.");
  }

  await (this.model as AttendancePolicyModel).assertDeletable(policyId as Types.ObjectId);
}

attendancePolicySchema.pre("deleteOne", { document: false, query: true }, guardPolicyDeletion);
attendancePolicySchema.pre("findOneAndDelete", guardPolicyDeletion);

export const AttendancePolicy =
  (models.AttendancePolicy as AttendancePolicyModel | undefined) ??
  model<IAttendancePolicy, AttendancePolicyModel>("AttendancePolicy", attendancePolicySchema);

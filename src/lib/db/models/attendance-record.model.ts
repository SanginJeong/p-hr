import { Schema, model, models, type Model, type Types } from "mongoose";

import {
  ATTENDANCE_STATUSES,
  DATE_PATTERN,
  POLICY_TYPES,
  type AttendanceStatus,
  type PolicyType,
} from "./constants";
import {
  breakTimeSchema,
  fixedPolicyConfigSchema,
  flexiblePolicyConfigSchema,
  type BreakTime,
  type FixedPolicyConfig,
  type FlexiblePolicyConfig,
} from "./attendance-policy.model";

/**
 * 근태 기록이 생성된 시점의 팀 정책 사본.
 * 정책이 바뀌거나 수정되어도 과거 기록은 당시 기준으로 남아야 하므로 참조가 아니라 값으로 고정한다.
 */
export interface PolicySnapshot {
  name: string;
  type: PolicyType;
  workDays: number[];
  timezone: string;
  breakTimes: BreakTime[];
  fixed?: FixedPolicyConfig | null;
  flexible?: FlexiblePolicyConfig | null;
}

export interface IAttendanceRecord {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  /** 기록 시점의 소속 팀. 이후 사용자가 팀을 옮겨도 이 기록의 귀속은 바뀌지 않는다. */
  teamId: Types.ObjectId;
  /** 근무일. 정책 timezone 기준 "YYYY-MM-DD". */
  workDate: string;
  clockInAt?: Date | null;
  clockOutAt?: Date | null;
  status: AttendanceStatus;
  /** 휴게시간을 차감한 실제 근무시간(분). 퇴근 기록 시 계산한다. */
  workedMinutes: number;
  isLate: boolean;
  lateMinutes: number;
  isEarlyLeave: boolean;
  earlyLeaveMinutes: number;
  /** 삭제 가드와 이력 추적용 참조. 판정 기준은 항상 policySnapshot 을 쓴다. */
  appliedPolicyId: Types.ObjectId;
  policySnapshot: PolicySnapshot;
  createdAt: Date;
  updatedAt: Date;
}

const policySnapshotSchema = new Schema<PolicySnapshot>(
  {
    name: { type: String, required: true },
    type: { type: String, required: true, enum: POLICY_TYPES },
    workDays: { type: [{ type: Number, min: 0, max: 6 }], required: true },
    timezone: { type: String, required: true },
    breakTimes: { type: [breakTimeSchema], default: [] },
    fixed: {
      type: fixedPolicyConfigSchema,
      default: null,
      required: function (this: PolicySnapshot) {
        return this.type === "FIXED";
      },
    },
    flexible: {
      type: flexiblePolicyConfigSchema,
      default: null,
      required: function (this: PolicySnapshot) {
        return this.type === "FLEXIBLE";
      },
    },
  },
  { _id: false },
);

const attendanceRecordSchema = new Schema<IAttendanceRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    workDate: {
      type: String,
      required: true,
      match: [DATE_PATTERN, "근무일은 YYYY-MM-DD 형식이어야 합니다."],
    },
    clockInAt: { type: Date, default: null },
    clockOutAt: {
      type: Date,
      default: null,
      // 동기 validator 로 둔다. pre("validate") 훅은 validateSync() 에서 실행되지 않는다.
      validate: {
        validator: function (value: Date | null) {
          if (value == null) {
            return true;
          }

          const { clockInAt } = this as unknown as IAttendanceRecord;
          return clockInAt != null && value > clockInAt;
        },
        message: "퇴근 시각은 출근 기록이 있어야 하고, 출근 시각보다 늦어야 합니다.",
      },
    },
    status: { type: String, required: true, enum: ATTENDANCE_STATUSES, default: "WORKING" },
    workedMinutes: { type: Number, required: true, default: 0, min: 0 },
    isLate: { type: Boolean, required: true, default: false },
    lateMinutes: { type: Number, required: true, default: 0, min: 0 },
    isEarlyLeave: { type: Boolean, required: true, default: false },
    earlyLeaveMinutes: { type: Number, required: true, default: 0, min: 0 },
    appliedPolicyId: {
      type: Schema.Types.ObjectId,
      ref: "AttendancePolicy",
      required: true,
    },
    policySnapshot: { type: policySnapshotSchema, required: true },
  },
  { timestamps: true },
);

// 하루에 한 사람당 기록 하나. 중복 출근 기록을 DB 차원에서 막는다.
attendanceRecordSchema.index({ userId: 1, workDate: -1 }, { unique: true });
// 팀 관리자·HR 관리자의 기간별 팀 근태 조회.
attendanceRecordSchema.index({ teamId: 1, workDate: -1 });
// 전체 팀 근태 조회.
attendanceRecordSchema.index({ workDate: -1 });
// 정책 삭제 가드의 참조 검사.
attendanceRecordSchema.index({ appliedPolicyId: 1 });


export type AttendanceRecordModel = Model<IAttendanceRecord>;

export const AttendanceRecord =
  (models.AttendanceRecord as AttendanceRecordModel | undefined) ??
  model<IAttendanceRecord>("AttendanceRecord", attendanceRecordSchema);

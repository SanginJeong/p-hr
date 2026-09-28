import { Schema, model, models, type Model, type Types } from "mongoose";

/**
 * 팀 정책 변경 이력. 변경 담당자와 변경 시각을 남긴다.
 * 정책 이름은 이후 정책이 수정·삭제되어도 이력을 읽을 수 있도록 값으로 복사한다.
 */
export interface ITeamPolicyHistory {
  _id: Types.ObjectId;
  teamId: Types.ObjectId;
  previousPolicyId?: Types.ObjectId | null;
  previousPolicyName?: string | null;
  newPolicyId: Types.ObjectId;
  newPolicyName: string;
  changedBy: Types.ObjectId;
  changedAt: Date;
  reason?: string;
}

const teamPolicyHistorySchema = new Schema<ITeamPolicyHistory>(
  {
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    previousPolicyId: { type: Schema.Types.ObjectId, ref: "AttendancePolicy", default: null },
    previousPolicyName: { type: String, default: null, trim: true },
    newPolicyId: { type: Schema.Types.ObjectId, ref: "AttendancePolicy", required: true },
    newPolicyName: { type: String, required: true, trim: true },
    changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    changedAt: { type: Date, required: true, default: () => new Date() },
    reason: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// 팀별 최신 변경 이력 조회.
teamPolicyHistorySchema.index({ teamId: 1, changedAt: -1 });

export type TeamPolicyHistoryModel = Model<ITeamPolicyHistory>;

export const TeamPolicyHistory =
  (models.TeamPolicyHistory as TeamPolicyHistoryModel | undefined) ??
  model<ITeamPolicyHistory>("TeamPolicyHistory", teamPolicyHistorySchema);

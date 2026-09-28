import { Schema, model, models, type Model, type Types } from "mongoose";

export interface ITeam {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  /** 이 팀의 근태 기록을 조회할 수 있는 팀 관리자들. */
  managerIds: Types.ObjectId[];
  /** 팀에 적용된 근태 정책. 팀당 하나만 적용된다. */
  attendancePolicyId?: Types.ObjectId | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const teamSchema = new Schema<ITeam>(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
    managerIds: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
    attendancePolicyId: {
      type: Schema.Types.ObjectId,
      ref: "AttendancePolicy",
      default: null,
    },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

// 정책 삭제 가드(AttendancePolicy.assertDeletable)와 팀 관리자 권한 검사의 조회 경로.
teamSchema.index({ attendancePolicyId: 1 });
teamSchema.index({ managerIds: 1 });

export type TeamModel = Model<ITeam>;

export const Team = (models.Team as TeamModel | undefined) ?? model<ITeam>("Team", teamSchema);

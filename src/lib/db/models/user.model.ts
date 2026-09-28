import { Schema, model, models, type Model, type Types } from "mongoose";

import { USER_ROLES, type UserRole } from "./constants";

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  /** 기본 조회에서 제외된다. 필요한 곳에서 명시적으로 select 한다. */
  passwordHash: string;
  name: string;
  role: UserRole;
  /** HR 관리자는 소속 팀이 없을 수 있다. */
  teamId?: Types.ObjectId | null;
  employeeNumber?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "올바른 이메일 형식이 아닙니다."],
    },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true, maxlength: 50 },
    role: { type: String, required: true, enum: USER_ROLES, default: "EMPLOYEE" },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      default: null,
      required: function (this: IUser) {
        return this.role !== "HR_ADMIN";
      },
    },
    employeeNumber: { type: String, trim: true, maxlength: 30, default: null },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

// 팀별 구성원 조회(팀 관리자·HR 관리자의 팀 근태 조회 진입점).
userSchema.index({ teamId: 1, isActive: 1 });
userSchema.index({ role: 1 });
// null 을 허용하면서 값이 있을 때만 유일성을 보장한다.
userSchema.index(
  { employeeNumber: 1 },
  { unique: true, partialFilterExpression: { employeeNumber: { $type: "string" } } },
);

export type UserModel = Model<IUser>;

export const User = (models.User as UserModel | undefined) ?? model<IUser>("User", userSchema);

import type { Types } from "mongoose";

import { forbidden, notFound, unauthorized } from "@/lib/api/errors";
import { Team, User, type UserRole } from "@/lib/db/models";
import { readSessionPayload } from "./session";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  teamId: string | null;
}

/**
 * 세션 쿠키를 검증하고 DB 에서 사용자를 다시 읽는다.
 * 토큰에 담긴 역할·소속을 그대로 믿지 않는다(권한 회수·퇴사 처리가 즉시 반영되어야 한다).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const payload = await readSessionPayload();

  if (!payload) {
    return null;
  }

  const user = await User.findById(payload.sub)
    .select("email name role teamId isActive")
    .lean<{
      _id: Types.ObjectId;
      email: string;
      name: string;
      role: UserRole;
      teamId: Types.ObjectId | null;
      isActive: boolean;
    }>();

  if (!user || !user.isActive) {
    return null;
  }

  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    teamId: user.teamId ? user.teamId.toString() : null,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw unauthorized();
  }

  return user;
}

/** 지정한 역할 중 하나여야 통과. */
export async function requireRole(...roles: UserRole[]): Promise<CurrentUser> {
  const user = await requireUser();

  if (!roles.includes(user.role)) {
    throw forbidden("이 작업을 수행할 권한이 없습니다.");
  }

  return user;
}

export const requireHrAdmin = () => requireRole("HR_ADMIN");

/**
 * 팀 근태·정보 조회 권한. HR 관리자는 전체, 그 외는 `Team.managerIds` 에 등록된 팀만 허용한다.
 * 권한의 근거는 역할 이름이 아니라 팀에 부여된 managerIds 다.
 */
export async function assertTeamReadAccess(user: CurrentUser, teamId: string): Promise<void> {
  if (user.role === "HR_ADMIN") {
    return;
  }

  const team = await Team.findById(teamId).select("managerIds").lean<{ managerIds: Types.ObjectId[] }>();

  if (!team) {
    throw notFound("팀을 찾을 수 없습니다.");
  }

  if (!team.managerIds.some((id) => id.toString() === user.id)) {
    throw forbidden("이 팀의 근태를 조회할 권한이 없습니다.");
  }
}

/**
 * 팀 정책·팀 정보 조회 권한. 소속 팀원은 자기 팀을 볼 수 있다.
 * 근태 기록 조회는 더 좁으므로 assertTeamReadAccess 를 쓴다.
 */
export async function assertTeamVisibility(user: CurrentUser, teamId: string): Promise<void> {
  if (user.teamId === teamId) {
    return;
  }

  await assertTeamReadAccess(user, teamId);
}

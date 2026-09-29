import { Types, type QueryFilter } from "mongoose";

import { serializeRecordWithUser } from "@/lib/api/serializers";
import { AttendanceRecord, User, type IAttendanceRecord } from "@/lib/db/models";

export interface AttendanceQueryInput {
  from?: string;
  to?: string;
  teamId?: string;
  userId?: string;
  page: number;
  limit: number;
}

export interface AttendanceSummary {
  recordCount: number;
  totalWorkedMinutes: number;
  lateCount: number;
  earlyLeaveCount: number;
}

/**
 * 근태 기록 조회의 단일 진입점. 본인·팀·전사 조회가 모두 이 함수를 쓴다.
 * aggregate 는 문자열을 ObjectId 로 캐스팅하지 않으므로 필터에서 미리 변환한다.
 */
export async function findAttendanceRecords(input: AttendanceQueryInput) {
  const { page, limit } = input;
  const filter: QueryFilter<IAttendanceRecord> = {};

  if (input.teamId) filter.teamId = new Types.ObjectId(input.teamId);
  if (input.userId) filter.userId = new Types.ObjectId(input.userId);

  if (input.from || input.to) {
    filter.workDate = {
      ...(input.from ? { $gte: input.from } : {}),
      ...(input.to ? { $lte: input.to } : {}),
    };
  }

  const [records, total, summaryRows] = await Promise.all([
    AttendanceRecord.find(filter)
      .sort({ workDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    AttendanceRecord.countDocuments(filter),
    // 요약은 현재 페이지가 아니라 필터 전체를 대상으로 계산한다.
    AttendanceRecord.aggregate<AttendanceSummary>([
      { $match: filter },
      {
        $group: {
          _id: null,
          recordCount: { $sum: 1 },
          totalWorkedMinutes: { $sum: "$workedMinutes" },
          lateCount: { $sum: { $cond: ["$isLate", 1, 0] } },
          earlyLeaveCount: { $sum: { $cond: ["$isEarlyLeave", 1, 0] } },
        },
      },
      { $project: { _id: 0 } },
    ]),
  ]);

  const userIds = [...new Set(records.map((record) => record.userId.toString()))];
  const users = await User.find({ _id: { $in: userIds } }).select("name email employeeNumber");
  const usersById = new Map(users.map((user) => [user._id.toString(), user]));

  const summary: AttendanceSummary =
    summaryRows[0] ?? { recordCount: 0, totalWorkedMinutes: 0, lateCount: 0, earlyLeaveCount: 0 };

  return {
    items: records.map((record) =>
      serializeRecordWithUser(record, usersById.get(record.userId.toString()) ?? null),
    ),
    total,
    page,
    limit,
    summary,
  };
}

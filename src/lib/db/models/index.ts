/**
 * 모델 배럴. 이 파일을 import 하면 모든 모델이 mongoose 에 등록되므로
 * populate 나 ref 해석에서 MissingSchemaError 가 발생하지 않는다.
 */
export * from "./constants";
export * from "./user.model";
export * from "./team.model";
export * from "./attendance-policy.model";
export * from "./team-policy-history.model";
export * from "./attendance-record.model";

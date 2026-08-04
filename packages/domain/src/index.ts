/**
 * 领域层（占位）。
 *
 * 本包是领域模型与业务规则的唯一归属地；本轮不实现任何领域模型，
 * 仅保证包可编译、可测试。后续业务实体、值对象与领域服务都在这里定义。
 *
 * 依赖约束：本包不得依赖 database、ai-core 或任何框架（见 docs/architecture/overview.md）。
 */
export const DOMAIN_PACKAGE_NAME = '@today-dont-push/domain' as const;

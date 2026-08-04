/**
 * AI 核心抽象（占位）。
 *
 * 本包定义 AI 能力的统一接口，供未来各供应商实现接入。
 * 本轮仅定义空的 AIProvider 接口，不接入任何模型、SDK 或网络调用。
 * 未来默认供应商计划为 DeepSeek；具体模型名称在接入时再确定，
 * 不在代码或配置中硬编码。
 *
 * 依赖约束：本包属于基础设施适配器，未来可依赖 application/domain，
 * 不得依赖 contracts/database 等其他内部包（见 docs/architecture/overview.md）。
 */
export interface AIProvider {
  /** 提供商标识，例如 'deepseek'。 */
  readonly name: string;
}

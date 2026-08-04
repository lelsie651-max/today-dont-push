/**
 * AI 核心抽象（占位）。
 *
 * 本包定义 AI 能力的统一接口，供未来各模型实现接入。
 * 本轮仅定义空的 AIProvider 接口，不接入任何模型、SDK 或网络调用。
 *
 * 依赖约束：本包不得依赖业务包（domain）或其他基础设施包（见 docs/architecture/overview.md）。
 */
export interface AIProvider {
  /** 提供商标识，例如 'dashscope'。 */
  readonly name: string;
}

import type { Requirement, Stage } from "../../types/models";
import type { Attribute } from "../../types/schema";
import { StageTransitionDropdown } from "./StageTransitionDropdown";
import { AttributeField, selectClass, selectStyle } from "./AttributeField";
import { resultOf } from "../../lib/requirementFields";
import { dependencySatisfied } from "../../lib/dependencyEngine";

interface AttributeGridProps {
  requirement: Requirement;
  /** 已按 schema showOnDetail 过滤好的属性列表（排序在调用方完成，见 detailAttributesFor）。 */
  attributes: Attribute[];
  /** 详情面板逼近 480px 底线（REQ-003 v2.8）时为真，两列网格收缩为单列，无中间过渡态。 */
  compact: boolean;
  /** 该实体所属阶段是否终态：终态阶段的"结果"类属性只读，跟看板行 RequirementRow 的
   * readOnly 规则保持一致（值由流转产生，不允许在属性区手动改，见 REQ-022）。 */
  isTerminal: boolean;
  onAttributeChange: (attributeId: string, value: unknown) => void;
  onTransition: (toStage: Stage, opts?: { abandoned?: boolean }) => void;
}

function AttrRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <div className="text-[12px] whitespace-nowrap text-(--muted-2)">{label}</div>
      <div className="min-w-0">{children}</div>
    </>
  );
}

export function AttributeGrid({ requirement, attributes, compact, isTerminal, onAttributeChange, onTransition }: AttributeGridProps) {
  const result = resultOf(requirement);
  // 属性依赖（REQ-025 / 讨论稿 §4.1）：详情面板与看板表现不同——看板按行空白（列保留），
  // 详情面板是"不满足的属性不显示"（整条过滤，不占位）。
  const visibleAttributes = attributes.filter((a) => dependencySatisfied(a, requirement.attributeValues));

  return (
    <div
      className="mx-4 my-3 grid items-center gap-y-2 gap-x-2.5 rounded-(--r-lg) bg-(--accent-selected) p-3"
      style={{ gridTemplateColumns: compact ? "58px minmax(0, 1fr)" : "58px minmax(0, 1fr) 58px minmax(0, 1fr)" }}
    >
      <AttrRow label="阶段">
        <StageTransitionDropdown
          currentStage={requirement.stage}
          closureType={result}
          onTransition={onTransition}
          className={selectClass}
          style={selectStyle}
        />
      </AttrRow>

      {visibleAttributes.map((attribute) => (
        <AttrRow key={attribute.id} label={attribute.name}>
          <AttributeField
            attribute={attribute}
            requirement={requirement}
            readOnly={isTerminal && attribute.id === "result"}
            onChange={(value) => onAttributeChange(attribute.id, value)}
          />
        </AttrRow>
      ))}
    </div>
  );
}

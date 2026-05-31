"use client";

import { useState, useEffect } from "react";
import { Plus, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Database, Platform } from "@/lib/types/database";

type Tag = Database["public"]["Tables"]["tags"]["Row"];
type CustomFieldDef =
  Database["public"]["Tables"]["custom_field_definitions"]["Row"];

// --- Filter types ---

export type FilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "gt"
  | "lt"
  | "before"
  | "after";

export type FilterField =
  | "has_tag"
  | "missing_tag"
  | "custom_field"
  | "platform"
  | "is_subscribed"
  | "last_interaction";

export interface FilterRule {
  id: string;
  field: FilterField;
  operator: FilterOperator;
  value: string;
}

export interface FilterGroup {
  id: string;
  combinator: "and" | "or";
  rules: FilterRule[];
}

export interface SegmentFilter {
  combinator: "and" | "or";
  groups: FilterGroup[];
}

// --- Operator options per field ---

const fieldConfig: Record<
  FilterField,
  {
    label: string;
    operators: { value: FilterOperator; label: string }[];
    valueType: "tag" | "custom_field" | "platform" | "boolean" | "date" | "text";
  }
> = {
  has_tag: {
    label: "A l'étiquette",
    operators: [{ value: "equals", label: "est" }],
    valueType: "tag",
  },
  missing_tag: {
    label: "N'a pas l'étiquette",
    operators: [{ value: "equals", label: "est" }],
    valueType: "tag",
  },
  custom_field: {
    label: "Champ personnalisé",
    operators: [
      { value: "equals", label: "égal à" },
      { value: "not_equals", label: "différent de" },
      { value: "contains", label: "contient" },
      { value: "gt", label: "supérieur à" },
      { value: "lt", label: "inférieur à" },
    ],
    valueType: "custom_field",
  },
  platform: {
    label: "Plateforme",
    operators: [
      { value: "equals", label: "est" },
      { value: "not_equals", label: "n'est pas" },
    ],
    valueType: "platform",
  },
  is_subscribed: {
    label: "Abonné",
    operators: [{ value: "equals", label: "est" }],
    valueType: "boolean",
  },
  last_interaction: {
    label: "Dernière interaction",
    operators: [
      { value: "before", label: "avant" },
      { value: "after", label: "après" },
    ],
    valueType: "date",
  },
};

const platforms: { value: Platform; label: string }[] = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "twitter", label: "X / Twitter" },
  { value: "telegram", label: "Telegram" },
  { value: "bluesky", label: "Bluesky" },
  { value: "reddit", label: "Reddit" },
  { value: "whatsapp", label: "WhatsApp" },
];

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function createEmptyRule(): FilterRule {
  return {
    id: generateId(),
    field: "has_tag",
    operator: "equals",
    value: "",
  };
}

function createEmptyGroup(): FilterGroup {
  return {
    id: generateId(),
    combinator: "and",
    rules: [createEmptyRule()],
  };
}

export function createEmptyFilter(): SegmentFilter {
  return {
    combinator: "and",
    groups: [createEmptyGroup()],
  };
}

// --- Components ---

function CombinatorToggle({
  value,
  onChange,
}: {
  value: "and" | "or";
  onChange: (v: "and" | "or") => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted p-0.5">
      <button
        type="button"
        onClick={() => onChange("and")}
        className={cn(
          "rounded-md px-3 py-1 text-xs font-medium transition-colors",
          value === "and"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        ET
      </button>
      <button
        type="button"
        onClick={() => onChange("or")}
        className={cn(
          "rounded-md px-3 py-1 text-xs font-medium transition-colors",
          value === "or"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        OU
      </button>
    </div>
  );
}

function FilterRuleRow({
  rule,
  tags,
  customFields,
  onChange,
  onRemove,
  canRemove,
}: {
  rule: FilterRule;
  tags: Tag[];
  customFields: CustomFieldDef[];
  onChange: (rule: FilterRule) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const config = fieldConfig[rule.field];
  const operators = config.operators;

  function handleFieldChange(field: FilterField) {
    const newConfig = fieldConfig[field];
    onChange({
      ...rule,
      field,
      operator: newConfig.operators[0].value,
      value: "",
    });
  }

  function renderValueInput() {
    switch (config.valueType) {
      case "tag":
        return (
          <select
            value={rule.value}
            onChange={(e) => onChange({ ...rule, value: e.target.value })}
            className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Sélectionner une étiquette...</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        );
      case "custom_field":
        return (
          <div className="flex items-center gap-2">
            <select
              value={rule.value.split("::")[0] || ""}
              onChange={(e) => {
                const fieldSlug = e.target.value;
                const existingVal = rule.value.split("::")[1] || "";
                onChange({ ...rule, value: `${fieldSlug}::${existingVal}` });
              }}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Sélectionner un champ...</option>
              {customFields.map((cf) => (
                <option key={cf.id} value={cf.slug}>
                  {cf.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Valeur..."
              value={rule.value.split("::")[1] || ""}
              onChange={(e) => {
                const fieldSlug = rule.value.split("::")[0] || "";
                onChange({ ...rule, value: `${fieldSlug}::${e.target.value}` });
              }}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        );
      case "platform":
        return (
          <select
            value={rule.value}
            onChange={(e) => onChange({ ...rule, value: e.target.value })}
            className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Sélectionner une plateforme...</option>
            {platforms.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        );
      case "boolean":
        return (
          <select
            value={rule.value}
            onChange={(e) => onChange({ ...rule, value: e.target.value })}
            className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Sélectionner...</option>
            <option value="true">Oui</option>
            <option value="false">Non</option>
          </select>
        );
      case "date":
        return (
          <input
            type="date"
            value={rule.value}
            onChange={(e) => onChange({ ...rule, value: e.target.value })}
            className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        );
      default:
        return (
          <input
            type="text"
            placeholder="Valeur..."
            value={rule.value}
            onChange={(e) => onChange({ ...rule, value: e.target.value })}
            className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        );
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Field selector */}
      <select
        value={rule.field}
        onChange={(e) => handleFieldChange(e.target.value as FilterField)}
        className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {(Object.entries(fieldConfig) as [FilterField, typeof config][]).map(
          ([key, cfg]) => (
            <option key={key} value={key}>
              {cfg.label}
            </option>
          )
        )}
      </select>

      {/* Operator selector */}
      {operators.length > 1 && (
        <select
          value={rule.operator}
          onChange={(e) =>
            onChange({ ...rule, operator: e.target.value as FilterOperator })
          }
          className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {operators.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
      )}

      {/* Value input */}
      {renderValueInput()}

      {/* Remove button */}
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function FilterGroupCard({
  group,
  tags,
  customFields,
  onChange,
  onRemove,
  canRemove,
}: {
  group: FilterGroup;
  tags: Tag[];
  customFields: CustomFieldDef[];
  onChange: (group: FilterGroup) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  function updateRule(ruleId: string, updated: FilterRule) {
    onChange({
      ...group,
      rules: group.rules.map((r) => (r.id === ruleId ? updated : r)),
    });
  }

  function removeRule(ruleId: string) {
    onChange({
      ...group,
      rules: group.rules.filter((r) => r.id !== ruleId),
    });
  }

  function addRule() {
    onChange({
      ...group,
      rules: [...group.rules, createEmptyRule()],
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase">
            Correspondance
          </span>
          <CombinatorToggle
            value={group.combinator}
            onChange={(v) => onChange({ ...group, combinator: v })}
          />
          <span className="text-xs font-medium text-muted-foreground uppercase">
            des règles suivantes
          </span>
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {group.rules.map((rule, idx) => (
          <div key={rule.id}>
            {idx > 0 && (
              <div className="flex items-center gap-2 py-1 pl-2">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                  {group.combinator}
                </span>
                <div className="flex-1 border-t border-border" />
              </div>
            )}
            <FilterRuleRow
              rule={rule}
              tags={tags}
              customFields={customFields}
              onChange={(updated) => updateRule(rule.id, updated)}
              onRemove={() => removeRule(rule.id)}
              canRemove={group.rules.length > 1}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRule}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
      >
        <Plus className="h-3 w-3" />
        Ajouter un filtre
      </button>
    </div>
  );
}

// --- Main export ---

export function SegmentBuilder({
  value,
  onChange,
  workspaceId,
}: {
  value: SegmentFilter;
  onChange: (filter: SegmentFilter) => void;
  workspaceId: string;
}) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const [tagsRes, fieldsRes] = await Promise.all([
        supabase
          .from("tags")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("name"),
        supabase
          .from("custom_field_definitions")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("name"),
      ]);
      setTags(tagsRes.data ?? []);
      setCustomFields(fieldsRes.data ?? []);
      setLoading(false);
    }
    fetchData();
  }, [workspaceId]);

  function updateGroup(groupId: string, updated: FilterGroup) {
    onChange({
      ...value,
      groups: value.groups.map((g) => (g.id === groupId ? updated : g)),
    });
  }

  function removeGroup(groupId: string) {
    onChange({
      ...value,
      groups: value.groups.filter((g) => g.id !== groupId),
    });
  }

  function addGroup() {
    onChange({
      ...value,
      groups: [...value.groups, createEmptyGroup()],
    });
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">Chargement des filtres...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Top-level combinator */}
      {value.groups.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase">
            Groupes en correspondance
          </span>
          <CombinatorToggle
            value={value.combinator}
            onChange={(v) => onChange({ ...value, combinator: v })}
          />
        </div>
      )}

      {value.groups.map((group, idx) => (
        <div key={group.id}>
          {idx > 0 && (
            <div className="flex items-center gap-2 py-2">
              <div className="flex-1 border-t border-border" />
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                {value.combinator}
              </span>
              <div className="flex-1 border-t border-border" />
            </div>
          )}
          <FilterGroupCard
            group={group}
            tags={tags}
            customFields={customFields}
            onChange={(updated) => updateGroup(group.id, updated)}
            onRemove={() => removeGroup(group.id)}
            canRemove={value.groups.length > 1}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={addGroup}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        <Plus className="h-3 w-3" />
        Ajouter un groupe de filtres
      </button>

      {/* JSON preview (collapsible) */}
      <ExportPreview filter={value} />
    </div>
  );
}

function ExportPreview({ filter }: { filter: SegmentFilter }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-muted/50">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>JSON du filtre</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>
      {expanded && (
        <pre className="border-t border-border px-3 py-2 text-xs text-muted-foreground overflow-auto max-h-40">
          {JSON.stringify(filter, null, 2)}
        </pre>
      )}
    </div>
  );
}

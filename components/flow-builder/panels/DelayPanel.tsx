"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

type DelayUnit = "seconds" | "minutes" | "hours" | "days";
type DelayMode = "duration" | "until";

interface DelayPanelData {
  duration?: number;
  unit?: DelayUnit;
  waitUntil?: string;
  [key: string]: unknown;
}

interface DelayPanelProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

const unitOptions: Array<{ value: DelayUnit; label: string }> = [
  { value: "seconds", label: "Secondes" },
  { value: "minutes", label: "Minutes" },
  { value: "hours", label: "Heures" },
  { value: "days", label: "Jours" },
];

const presets: Array<{ label: string; duration: number; unit: DelayUnit }> = [
  { label: "30 sec", duration: 30, unit: "seconds" },
  { label: "5 min", duration: 5, unit: "minutes" },
  { label: "1 heure", duration: 1, unit: "hours" },
  { label: "1 jour", duration: 1, unit: "days" },
  { label: "3 jours", duration: 3, unit: "days" },
  { label: "7 jours", duration: 7, unit: "days" },
];

export function DelayPanel({ data: rawData, onChange }: DelayPanelProps) {
  const data = rawData as DelayPanelData;
  const duration = data.duration || 0;
  const unit = data.unit || "minutes";
  const [mode, setMode] = useState<DelayMode>(data.waitUntil ? "until" : "duration");

  const handleModeChange = useCallback(
    (newMode: DelayMode) => {
      setMode(newMode);
      if (newMode === "duration") {
        onChange({ duration: data.duration || 5, unit: data.unit || "minutes", waitUntil: undefined });
      } else {
        onChange({ ...data, waitUntil: data.waitUntil || "" });
      }
    },
    [data, onChange]
  );

  const applyPreset = useCallback(
    (preset: { duration: number; unit: DelayUnit }) => {
      setMode("duration");
      onChange({ duration: preset.duration, unit: preset.unit, waitUntil: undefined });
    },
    [onChange]
  );

  return (
    <div className="space-y-5">
      {/* Mode Toggle */}
      <div>
        <label className="mb-2 block text-xs font-semibold text-foreground">
          Type de délai
        </label>
        <div className="flex rounded-lg border border-border bg-muted p-1">
          <button
            type="button"
            onClick={() => handleModeChange("duration")}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              mode === "duration"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Attendre une durée
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("until")}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              mode === "until"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Attendre jusqu'à
          </button>
        </div>
      </div>

      {mode === "duration" ? (
        <>
          {/* Duration Input */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-foreground">
              Durée
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                value={duration}
                onChange={(e) =>
                  onChange({ ...data, duration: Math.max(0, parseInt(e.target.value) || 0), waitUntil: undefined })
                }
                className="w-24 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <select
                value={unit}
                onChange={(e) =>
                  onChange({ ...data, unit: e.target.value as DelayUnit, waitUntil: undefined })
                }
                className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                {unitOptions.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Presets */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-foreground">
              Préréglages rapides
            </label>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => {
                const isActive = duration === preset.duration && unit === preset.unit;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      isActive
                        ? "bg-purple-500 text-white"
                        : "border border-border bg-card text-muted-foreground hover:border-purple-300 hover:text-purple-600"
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        /* Wait Until */
        <div>
          <label className="mb-2 block text-xs font-semibold text-foreground">
            Attendre jusqu'à une date/heure
          </label>
          <input
            type="datetime-local"
            value={data.waitUntil || ""}
            onChange={(e) => onChange({ ...data, waitUntil: e.target.value })}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Le flux se mettra en pause jusqu'à cette date et cette heure précises.
          </p>
        </div>
      )}

      {/* Summary */}
      <div className="rounded-lg border border-border bg-muted p-3">
        <p className="text-xs font-medium text-muted-foreground">Aperçu</p>
        <p className="mt-1 text-sm text-foreground">
          {mode === "duration"
            ? duration > 0
              ? `Attendre ${duration} ${unit === "seconds" ? "secondes" : unit === "minutes" ? "minutes" : unit === "hours" ? "heures" : "jours"} avant de continuer`
              : "Aucun délai configuré"
            : data.waitUntil
              ? `Attendre jusqu'au ${new Date(data.waitUntil).toLocaleString("fr-FR")}`
              : "Aucune date sélectionnée"}
        </p>
      </div>
    </div>
  );
}
